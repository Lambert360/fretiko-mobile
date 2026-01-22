import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api';
import * as SecureStore from 'expo-secure-store';

/**
 * Connection States for WebSocket
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

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
 *
 * Uses industry-standard state management for reliable authentication
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

export interface JoinedStreamData {
  streamId: string;
  success: boolean;
  viewerCount: number;
}

class LiveStreamSocketService {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private isConnecting = false;
  private currentStreamId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Event listeners registry
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialize socket connection with authentication confirmation
   * Industry-standard: Waits for server to confirm authentication before resolving
   */
  async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.AUTHENTICATED) {
      console.log('✅ LiveStream Socket already authenticated');
      return;
    }

    if (this.connectionState === ConnectionState.CONNECTING ||
        this.connectionState === ConnectionState.AUTHENTICATING) {
      console.log('⏳ LiveStream Socket connection/authentication in progress...');
      return this.waitForAuthenticatedState();
    }

    this.connectionState = ConnectionState.CONNECTING;

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

      // Wait for authentication confirmation (industry standard pattern)
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.connectionState = ConnectionState.ERROR;
          reject(new Error('Authentication timeout - server did not confirm authentication'));
        }, 15000); // Increased timeout for auth

        // Connection established
        this.socket?.on('connect', () => {
          console.log('🔗 Socket connected, waiting for authentication...');
          this.connectionState = ConnectionState.CONNECTED;
        });

        // Debug: Listen for any events to see what's being emitted
        this.socket?.onAny((eventName, ...args) => {
          console.log('🔍 Socket event received:', eventName, 'args:', args);
        });

        // Authentication confirmed by server (industry standard)
        this.socket?.on('authenticated', (authData: any) => {
          clearTimeout(timeout);
          this.connectionState = ConnectionState.AUTHENTICATED;
          console.log('🎉 AUTHENTICATED EVENT RECEIVED!');
          console.log('✅ Auth data:', JSON.stringify(authData, null, 2));
          console.log('✅ LiveStream Socket authenticated for user:', authData?.userId, 'role:', authData?.role);
          resolve();
        });

        // Authentication failed
        this.socket?.on('unauthenticated', (error: any) => {
          clearTimeout(timeout);
          this.connectionState = ConnectionState.ERROR;
          console.error('❌ LiveStream Socket authentication failed:', error);
          reject(new Error(`Authentication failed: ${error?.message || 'Unknown error'}`));
        });

        // Connection errors
        this.socket?.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.connectionState = ConnectionState.ERROR;
          console.error('❌ LiveStream Socket connection error:', error);
          reject(error);
        });

        this.socket?.on('disconnect', () => {
          if (this.connectionState === ConnectionState.AUTHENTICATED) {
            this.connectionState = ConnectionState.CONNECTED; // Still connected but not authenticated
          } else {
            this.connectionState = ConnectionState.DISCONNECTED;
          }
        });
      });

    } catch (error) {
      this.connectionState = ConnectionState.ERROR;
      console.error('💥 LiveStream Socket connection failed:', error);
      throw error;
    }
  }

  /**
   * Wait for authenticated state (industry standard pattern)
   */
  private async waitForAuthenticatedState(): Promise<void> {
    if (this.connectionState === ConnectionState.AUTHENTICATED) {
      return;
    }

    return new Promise((resolve, reject) => {
      const checkState = () => {
        if (this.connectionState === ConnectionState.AUTHENTICATED) {
          resolve();
        } else if (this.connectionState === ConnectionState.ERROR ||
                   this.connectionState === ConnectionState.DISCONNECTED) {
          reject(new Error(`Connection failed: ${this.connectionState}`));
        } else {
          // Check again in 100ms
          setTimeout(checkState, 100);
        }
      };
      checkState();
    });
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
      // Rejoin stream if there was a disconnection and we're authenticated
      if (this.currentStreamId && this.connectionState === ConnectionState.AUTHENTICATED) {
        this.joinStream(this.currentStreamId).catch(console.error);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ LiveStream Socket disconnected:', reason);
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.connectionState = ConnectionState.CONNECTED; // Still connected but lost auth
      } else {
        this.connectionState = ConnectionState.DISCONNECTED;
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`🔄 LiveStream Socket reconnecting (${attemptNumber}/${this.maxReconnectAttempts})...`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('💥 LiveStream Socket reconnection failed');
      this.connectionState = ConnectionState.ERROR;
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

    this.socket.on('stream_ended', (data: { streamId: string; reason?: string; timestamp?: string }) => {
      this.emit('stream_ended', data);
    });

    this.socket.on('joined_stream', (data: JoinedStreamData) => {
      this.emit('joined_stream', data);
    });

    this.socket.on('showcase_item', (data: any) => {
      this.emit('showcase_item', data);
    });

    this.socket.on('error', (error: any) => {
      console.error('❌ LiveStream Socket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Join a live stream room (industry standard: ensures authentication)
   */
  async joinStream(streamId: string, role: 'viewer' | 'vendor' = 'viewer'): Promise<void> {
    // Ensure we're authenticated before joining (industry standard)
    if (this.connectionState !== ConnectionState.AUTHENTICATED) {
      console.log('⏳ Ensuring authentication before joining stream...');
      await this.connect(); // This will wait for authentication
    }

    return new Promise((resolve, reject) => {
      console.log(`🚪 Joining stream: ${streamId} as ${role}`);

      // Set currentStreamId immediately when attempting to join
      // This prevents "Not in a stream" errors if API join fails but socket join succeeds
      this.currentStreamId = streamId;

      // Also listen for the joined_stream event as a fallback
      const joinedHandler = (data: any) => {
        if (data.streamId === streamId) {
          console.log('✅ Received joined_stream event');
          this.socket?.off('joined_stream', joinedHandler);
          resolve();
        }
      };
      this.socket?.on('joined_stream', joinedHandler);

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        this.socket?.off('joined_stream', joinedHandler);
        if (this.currentStreamId === streamId) {
          // If we still have the streamId set, consider it a success
          console.log('⚠️ Join timeout, but keeping streamId set');
          resolve();
        } else {
          reject(new Error('Join stream timeout'));
        }
      }, 10000);

      this.socket?.emit('join_stream', { streamId, role }, (response: any) => {
        clearTimeout(timeout);
        this.socket?.off('joined_stream', joinedHandler);
        
        if (response?.success) {
          console.log('✅ Joined stream successfully');
          resolve();
        } else {
          console.error('❌ Failed to join stream:', response?.error);
          // Don't clear currentStreamId here - let it be cleared on explicit leave
          // This allows reactions/comments to work even if backend join had issues
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
      reactionType: reactionType, // Changed to match backend expectation
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
   * Emit showcase item event
   */
  emitShowcaseItem(data: any): void {
    if (!this.currentStreamId) {
      console.error('❌ Not in a stream');
      return;
    }

    this.socket?.emit('showcase_item', {
      streamId: this.currentStreamId,
      ...data,
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
