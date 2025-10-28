import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api';
import * as SecureStore from 'expo-secure-store';

/**
 * Live Stream Socket Service
 * 
 * Handles real-time WebSocket communication for live streams:
 * - Comments
 * - Reactions
 * - Gifts
 * - Live purchases/bookings
 * - Viewer count updates
 * - Stream status updates
 */

export interface LiveComment {
  id: string;
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  message: string;
  is_pinned: boolean;
  created_at: string;
}

export interface LiveReaction {
  user: {
    id: string;
    username: string;
  };
  reaction_type: string;
  timestamp: number;
}

export interface LiveGift {
  id: string;
  sender: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  gift_type: string;
  quantity: number;
  message?: string;
  total_value: number;
  timestamp: number;
}

export interface LivePurchase {
  buyer_username: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  timestamp: number;
}

export interface ViewerCountUpdate {
  current_viewers: number;
  total_viewers: number;
}

export interface StreamStatusUpdate {
  status: 'live' | 'paused' | 'ended';
  message?: string;
}

class LiveStreamSocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private currentStreamId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Event listeners registry
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialize socket connection
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('✅ LiveStream Socket already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('⏳ LiveStream Socket connection in progress...');
      return;
    }

    this.isConnecting = true;

    try {
      // Get auth token
      const accessToken = await SecureStore.getItemAsync('accessToken');
      if (!accessToken) {
        throw new Error('No auth token found');
      }

      console.log('🔌 Connecting to LiveStream Socket...');

      // Create socket connection
      this.socket = io(`${API_CONFIG.BASE_URL}/live-sales`, {
        auth: {
          token: accessToken,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // Setup event listeners
      this.setupSocketListeners();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket?.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ LiveStream Socket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket?.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('❌ LiveStream Socket connection error:', error);
          this.isConnecting = false;
          reject(error);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      console.error('💥 LiveStream Socket connection failed:', error);
      throw error;
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ LiveStream Socket connected');
      this.reconnectAttempts = 0;
      // Rejoin stream if there was a disconnection
      if (this.currentStreamId) {
        this.joinStream(this.currentStreamId).catch(console.error);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ LiveStream Socket disconnected:', reason);
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`🔄 LiveStream Socket reconnecting (${attemptNumber}/${this.maxReconnectAttempts})...`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('💥 LiveStream Socket reconnection failed');
    });

    // Stream events
    this.socket.on('new_comment', (comment: LiveComment) => {
      this.emit('comment', comment);
    });

    this.socket.on('new_reaction', (reaction: LiveReaction) => {
      this.emit('reaction', reaction);
    });

    this.socket.on('new_gift', (gift: LiveGift) => {
      this.emit('gift', gift);
    });

    this.socket.on('new_purchase', (purchase: LivePurchase) => {
      this.emit('purchase', purchase);
    });

    this.socket.on('viewer_count_update', (data: ViewerCountUpdate) => {
      this.emit('viewer_count', data);
    });

    this.socket.on('stream_status_update', (data: StreamStatusUpdate) => {
      this.emit('stream_status', data);
    });

    this.socket.on('error', (error: any) => {
      console.error('❌ LiveStream Socket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Join a live stream room
   */
  async joinStream(streamId: string, role: 'viewer' | 'vendor' = 'viewer'): Promise<void> {
    if (!this.socket?.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      console.log(`🚪 Joining stream: ${streamId} as ${role}`);

      this.socket?.emit('join_stream', { streamId, role }, (response: any) => {
        if (response?.success) {
          console.log('✅ Joined stream successfully');
          this.currentStreamId = streamId;
          resolve();
        } else {
          console.error('❌ Failed to join stream:', response?.error);
          reject(new Error(response?.error || 'Failed to join stream'));
        }
      });
    });
  }

  /**
   * Leave current stream
   */
  leaveStream(): void {
    if (!this.currentStreamId) return;

    console.log(`🚪 Leaving stream: ${this.currentStreamId}`);
    this.socket?.emit('leave_stream', { streamId: this.currentStreamId });
    this.currentStreamId = null;
  }

  /**
   * Send a comment
   */
  sendComment(message: string): void {
    if (!this.currentStreamId) {
      console.error('❌ Not in a stream');
      return;
    }

    this.socket?.emit('post_comment', {
      streamId: this.currentStreamId,
      message,
    });
  }

  /**
   * Send a reaction
   */
  sendReaction(reactionType: string): void {
    if (!this.currentStreamId) {
      console.error('❌ Not in a stream');
      return;
    }

    this.socket?.emit('send_reaction', {
      streamId: this.currentStreamId,
      reaction_type: reactionType,
    });
  }

  /**
   * Send a gift
   */
  sendGift(giftType: string, quantity: number, message?: string): void {
    if (!this.currentStreamId) {
      console.error('❌ Not in a stream');
      return;
    }

    this.socket?.emit('send_gift', {
      streamId: this.currentStreamId,
      gift_type: giftType,
      quantity,
      message,
    });
  }

  /**
   * Register an event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * Unregister an event listener
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit an event to registered listeners
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Clear all event listeners
   */
  clearListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.currentStreamId) {
      this.leaveStream();
    }

    this.socket?.disconnect();
    this.socket = null;
    this.currentStreamId = null;
    this.isConnecting = false;
    this.listeners.clear();
    console.log('🔌 LiveStream Socket disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return !!this.socket?.connected;
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
