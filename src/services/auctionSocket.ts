import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '../config/api';

/**
 * Auction WebSocket Service
 *
 * Handles real-time auction features:
 * - Live bidding updates
 * - Auction status changes
 * - AI auctioneer messages
 * - User notifications
 */
class AuctionSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Connect to auction WebSocket server
   */
  async connect(): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');

      this.socket = io(`${API_CONFIG.BASE_URL}/auctions`, {
        auth: {
          token: token || '',
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
      });

      this.setupEventHandlers();

    } catch (error) {
      console.error('Failed to connect to auction socket:', error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  /**
   * Join an auction room for real-time updates
   */
  async joinAuction(auctionId: string, userId?: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      await this.connect();
    }

    if (this.socket) {
      this.socket.emit('join_auction', {
        auction_id: auctionId,
        user_id: userId,
      });
    }
  }

  /**
   * Leave an auction room
   */
  leaveAuction(auctionId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_auction', {
        auction_id: auctionId,
      });
    }
  }

  /**
   * Place a bid through WebSocket
   */
  placeBid(auctionId: string, amount: number, bidType: string = 'manual'): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('place_bid', {
        auction_id: auctionId,
        amount,
        bid_type: bidType,
      });
    }
  }

  /**
   * Subscribe to auction events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  /**
   * Unsubscribe from auction events
   */
  off(event: string, callback?: Function): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback as any);

        // Remove from listeners
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          const index = eventListeners.indexOf(callback);
          if (index > -1) {
            eventListeners.splice(index, 1);
          }
        }
      } else {
        this.socket.off(event);
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Check if connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to auction socket');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Re-subscribe to events
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          this.socket?.on(event, callback as any);
        });
      });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from auction socket');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Auction socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('connection_established', (data) => {
      console.log('Auction socket connection established:', data);
    });

    // Handle auction-specific events
    this.socket.on('auction_joined', (data) => {
      console.log('Joined auction:', data);
    });

    this.socket.on('auction_left', (data) => {
      console.log('Left auction:', data);
    });

    this.socket.on('error', (data) => {
      console.error('Auction socket error:', data);
    });
  }
}

// Export singleton instance
export const auctionSocket = new AuctionSocketService();

// Event types for TypeScript
export interface AuctionSocketEvents {
  // Bidding events
  bid_placed: {
    auction_id: string;
    amount: number;
    bidder_display_id: string;
    timestamp: string;
    is_winning: boolean;
  };

  bid_confirmed: {
    auction_id: string;
    amount: number;
    status: 'winning' | 'outbid';
  };

  bid_error: {
    auction_id: string;
    message: string;
  };

  // Auction status events
  auction_status_changed: {
    auction_id: string;
    status: string;
    message?: string;
    timestamp: string;
  };

  auction_ending_soon: {
    auction_id: string;
    minutes_remaining: number;
    timestamp: string;
  };

  // AI Auctioneer events
  auctioneer_speaks: {
    auction_id: string;
    event_type: 'going_once' | 'going_twice' | 'sold' | 'new_bid';
    message: string;
    timestamp: string;
  };

  // User notifications
  user_notification: {
    type: 'outbid' | 'winning' | 'auction_won' | 'auction_ending';
    auction_id: string;
    message: string;
    timestamp: string;
  };

  // Viewer events
  viewer_joined: {
    auction_id: string;
    timestamp: string;
  };

  viewer_left: {
    auction_id: string;
    timestamp: string;
  };
}

// Helper hook for React components
export const useAuctionSocket = () => {
  return {
    connect: () => auctionSocket.connect(),
    disconnect: () => auctionSocket.disconnect(),
    joinAuction: (auctionId: string, userId?: string) => auctionSocket.joinAuction(auctionId, userId),
    leaveAuction: (auctionId: string) => auctionSocket.leaveAuction(auctionId),
    placeBid: (auctionId: string, amount: number, bidType?: string) => auctionSocket.placeBid(auctionId, amount, bidType),
    on: (event: string, callback: Function) => auctionSocket.on(event, callback),
    off: (event: string, callback?: Function) => auctionSocket.off(event, callback),
    isConnected: () => auctionSocket.getConnectionStatus(),
  };
};