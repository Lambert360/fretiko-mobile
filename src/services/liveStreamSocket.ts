import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

// Event interfaces for type safety
export interface SocketEvents {
  // Connection events
  authenticated: { success: boolean };
  authentication_error: { message: string };
  
  // Stream events
  joined_stream: { streamId: string; success: boolean; viewerCount: number };
  left_stream: { streamId: string; success: boolean };
  viewer_joined: { userId: string; timestamp: string };
  viewer_left: { userId: string; timestamp: string };
  viewer_count_update: { streamId: string; count: number };
  
  // Real-time interactions
  new_comment: {
    id: string;
    user: { id: string; username: string; profile_pic_url?: string };
    message: string;
    timestamp: string;
    isOwn: boolean;
  };
  new_reaction: {
    userId: string;
    reactionType: string;
    timestamp: string;
  };
  new_gift: {
    senderId: string;
    giftType: string;
    quantity: number;
    message?: string;
    timestamp: string;
  };
  
  // Commerce events
  product_purchased: {
    productId: string;
    quantity: number;
    timestamp: string;
  };
  service_booked: {
    date: string;
    time: string;
    notes?: string;
    timestamp: string;
  };
  
  // Vendor events
  vendor_message: {
    message: string;
    type: string;
    timestamp: string;
  };
  gift_received: {
    senderId: string;
    giftType: string;
    quantity: number;
    message?: string;
    timestamp: string;
  };
  sale_made: {
    productId: string;
    quantity: number;
    buyerId: string;
    timestamp: string;
  };
  
  // Error events
  error: { message: string };
}

/**
 * Live Stream WebSocket Service
 * 
 * Handles real-time communication for live streams including:
 * - Stream joining/leaving
 * - Live comments and reactions
 * - Gift sending and receiving
 * - Live commerce events
 * - Viewer count updates
 */
class LiveStreamSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentStreamId: string | null = null;
  private eventCallbacks: Map<string, Function[]> = new Map();

  /**
   * Connect to the live stream WebSocket server
   */
  async connect(): Promise<void> {
    try {
      if (this.socket?.connected) {
        return; // Already connected
      }

      // Get auth token for authentication
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Create socket connection
      this.socket = io(`${API_CONFIG.BASE_URL}/live-sales`, {
        auth: {
          token,
        },
        transports: ['websocket'],
        timeout: 10000,
      });

      // Setup connection event handlers
      this.setupConnectionHandlers();

      // Wait for connection
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }

        this.socket.on('connect', () => {
          console.log('Live stream socket connected');
          this.isConnected = true;
          this.authenticateUser();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Live stream socket connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        // Timeout fallback
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('Error connecting to live stream socket:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.currentStreamId) {
      this.leaveStream(this.currentStreamId);
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.currentStreamId = null;
    this.eventCallbacks.clear();
  }

  /**
   * Authenticate user with the server
   */
  private async authenticateUser(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');

      if (!token || !userId) {
        throw new Error('Missing authentication data');
      }

      this.emit('authenticate', { token, userId });
    } catch (error) {
      console.error('Error authenticating user:', error);
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', () => {
      console.log('Live stream socket disconnected');
      this.isConnected = false;
    });

    this.socket.on('authenticated', (data) => {
      console.log('Live stream socket authenticated:', data);
      this.triggerCallbacks('authenticated', data);
    });

    this.socket.on('authentication_error', (data) => {
      console.error('Live stream authentication error:', data);
      this.triggerCallbacks('authentication_error', data);
    });

    // Setup all event listeners
    this.setupEventListeners();
  }

  /**
   * Setup all event listeners for live stream events
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Stream events
    this.socket.on('joined_stream', (data) => this.triggerCallbacks('joined_stream', data));
    this.socket.on('left_stream', (data) => this.triggerCallbacks('left_stream', data));
    this.socket.on('viewer_joined', (data) => this.triggerCallbacks('viewer_joined', data));
    this.socket.on('viewer_left', (data) => this.triggerCallbacks('viewer_left', data));
    this.socket.on('viewer_count_update', (data) => this.triggerCallbacks('viewer_count_update', data));

    // Real-time interactions
    this.socket.on('new_comment', (data) => this.triggerCallbacks('new_comment', data));
    this.socket.on('new_reaction', (data) => this.triggerCallbacks('new_reaction', data));
    this.socket.on('new_gift', (data) => this.triggerCallbacks('new_gift', data));

    // Commerce events
    this.socket.on('product_purchased', (data) => this.triggerCallbacks('product_purchased', data));
    this.socket.on('service_booked', (data) => this.triggerCallbacks('service_booked', data));

    // Vendor events
    this.socket.on('vendor_message', (data) => this.triggerCallbacks('vendor_message', data));
    this.socket.on('gift_received', (data) => this.triggerCallbacks('gift_received', data));
    this.socket.on('sale_made', (data) => this.triggerCallbacks('sale_made', data));

    // Error events
    this.socket.on('error', (data) => this.triggerCallbacks('error', data));
  }

  /**
   * Join a live stream
   */
  joinStream(streamId: string): void {
    if (!this.isConnected || !this.socket) {
      throw new Error('Socket not connected');
    }

    if (this.currentStreamId && this.currentStreamId !== streamId) {
      // Leave current stream first
      this.leaveStream(this.currentStreamId);
    }

    this.currentStreamId = streamId;
    this.emit('join_stream', { streamId });
  }

  /**
   * Leave a live stream
   */
  leaveStream(streamId: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.emit('leave_stream', { streamId });
    
    if (this.currentStreamId === streamId) {
      this.currentStreamId = null;
    }
  }

  /**
   * Send a comment to the live stream
   */
  sendComment(streamId: string, message: string): void {
    this.emit('send_comment', { streamId, message });
  }

  /**
   * Send a reaction to the live stream
   */
  sendReaction(streamId: string, reactionType: string): void {
    this.emit('send_reaction', { streamId, reactionType });
  }

  /**
   * Send a gift to the stream vendor
   */
  sendGift(streamId: string, giftType: string, quantity: number, message?: string): void {
    this.emit('send_gift', { streamId, giftType, quantity, message });
  }

  /**
   * Purchase a product during live stream
   */
  purchaseProduct(streamId: string, productId: string, quantity: number): void {
    this.emit('product_purchase', { streamId, productId, quantity });
  }

  /**
   * Book a service during live stream
   */
  bookService(streamId: string, date: string, time: string, notes?: string): void {
    this.emit('service_booking', { streamId, date, time, notes });
  }

  /**
   * Send vendor message (vendor only)
   */
  sendVendorMessage(streamId: string, message: string, type: string): void {
    this.emit('vendor_message', { streamId, message, type });
  }

  /**
   * Register event callback
   */
  on<K extends keyof SocketEvents>(event: K, callback: (data: SocketEvents[K]) => void): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  /**
   * Unregister event callback
   */
  off<K extends keyof SocketEvents>(event: K, callback: (data: SocketEvents[K]) => void): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to server
   */
  private emit(event: string, data: any): void {
    if (!this.socket || !this.isConnected) {
      console.warn(`Cannot emit ${event}: socket not connected`);
      return;
    }

    this.socket.emit(event, data);
  }

  /**
   * Trigger registered callbacks for an event
   */
  private triggerCallbacks(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  isSocketConnected(): boolean {
    return this.isConnected && !!this.socket?.connected;
  }

  /**
   * Get current stream ID
   */
  getCurrentStreamId(): string | null {
    return this.currentStreamId;
  }
}

// Export singleton instance
export const liveStreamSocket = new LiveStreamSocketService();