import { api } from './api';
import { io, Socket } from 'socket.io-client';

export interface RealtimeInteraction {
  id: string;
  type: 'like' | 'comment' | 'share' | 'view';
  serviceId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content?: string; // For comments
  timestamp: string;
}

export interface LiveComment {
  id: string;
  serviceId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  comment: string;
  timestamp: string;
  likes: number;
  isLiked: boolean;
}

export interface LiveStats {
  serviceId: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  isLiked: boolean;
  isBookmarked: boolean;
}

class RealtimeAPI {
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();
  private socket: Socket | null = null; // General/notifications connection
  private chatSocket: Socket | null = null; // Chat-specific connection
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for better resilience
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private chatHeartbeatInterval: NodeJS.Timeout | null = null;
  private pauseReconnections = false; // Flag to pause reconnections during AI calls
  private joinedRooms = new Set<string>(); // 🔥 FIX: Track joined rooms to prevent duplicates

  // Initialize dual WebSocket connections - general + chat
  connect(userId: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('📡 Initializing dual WebSocket connections for real-time features...');
        console.log('🔍 DEBUG: connect() function called with userId:', userId, 'token length:', token?.length || 0);
        console.log('🔍 DEBUG: Existing connections - General:', !!this.socket, 'Chat:', !!this.chatSocket);

        // 🔥 FIX: Check if already connected to prevent redundant connections
        if (this.socket?.connected && this.chatSocket?.connected) {
          console.log('✅ Already connected to both sockets, skipping reconnection');
          resolve();
          return;
        }

        let generalConnected = false;
        let chatConnected = false;
        let resolved = false;

        const resolveOnce = () => {
          if (!resolved) {
            resolved = true;
            this.reconnectAttempts = 0;
            resolve();
          }
        };

        const checkBothConnected = () => {
          if (generalConnected && chatConnected) {
            console.log('✅ Both connections established successfully');
            resolveOnce();
          }
        };

        // 1. General connection (notifications, user status)
        console.log('🔗 Connecting to general Socket.IO server...');
        this.socket = io('http://192.168.43.135:3000', {
          auth: token ? { token } : undefined,
          transports: ['polling', 'websocket'],
          timeout: 15000,
          forceNew: false, // 🔥 FIX: Reuse existing connections instead of forcing new ones
          autoConnect: true,
        });

        this.socket.on('connect', () => {
          console.log('📡 General real-time connection established');
          generalConnected = true;
          this.startHeartbeat();
          checkBothConnected();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('📡 General real-time connection closed:', reason);
          this.stopHeartbeat();
          generalConnected = false;

          if (reason === 'io server disconnect' || reason === 'io client disconnect') {
            console.log('✅ General connection closed normally');
            return;
          }

          this.attemptReconnect(userId, token);
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ General Socket.IO connection error:', error);
          generalConnected = false;
        });

        // Handle general real-time events (notifications, user status)
        this.socket.on('user_status', (data) => this.handleRealtimeMessage({ type: 'user_status', ...data }));
        this.socket.on('notification', (data) => this.handleRealtimeMessage({ type: 'notification', ...data }));

        // 2. Chat-specific connection (/chat namespace)
        console.log('💬 Connecting to chat Socket.IO server...');
        this.chatSocket = io('http://192.168.43.135:3000/chat', {
          auth: token ? { token } : undefined,
          transports: ['polling', 'websocket'],
          timeout: 15000,
          forceNew: false, // 🔥 FIX: Reuse existing connections instead of forcing new ones
          autoConnect: true,
        });

        this.chatSocket.on('connect', () => {
          console.log('💬 Chat real-time connection established');
          console.log(`🔍 Chat socket ID: ${this.chatSocket?.id}`);
          console.log(`🔍 Chat socket connected: ${this.chatSocket?.connected}`);
          chatConnected = true;
          this.startChatHeartbeat();
          checkBothConnected();
        });

        this.chatSocket.on('disconnect', (reason) => {
          console.log('💬 Chat real-time connection closed:', reason);
          this.stopChatHeartbeat();
          chatConnected = false;

          if (reason === 'io server disconnect' || reason === 'io client disconnect') {
            console.log('✅ Chat connection closed normally');
            return;
          }

          this.attemptChatReconnect(userId, token);
        });

        this.chatSocket.on('connect_error', (error) => {
          console.error('❌ Chat Socket.IO connection error:', error);
          chatConnected = false;
        });

        // 🔥 DEBUG: Catch ALL events to see what's actually arriving
        this.chatSocket.onAny((eventName, ...args) => {
          console.log('🌐 ANY EVENT RECEIVED:', eventName, args);
          console.log('🆔 Socket ID receiving event:', this.chatSocket?.id);
          console.log('🔍 Socket connected:', this.chatSocket?.connected);
          console.log('🔍 Event timestamp:', new Date().toISOString());

          // 🔥 SPECIFIC: Log if this is the expected chat_message event
          if (eventName === 'chat_message') {
            console.log('🎯 CRITICAL: chat_message event detected by frontend!');
            console.log('🎯 Event args:', args);
            console.log('🎯 Socket that received it:', this.chatSocket?.id);
          }
        });

        // 🔥 FIX: Handle ping/pong for heartbeat
        this.chatSocket.on('ping', (data) => {
          console.log('🏓 PING received, sending PONG');
          this.chatSocket.emit('pong', { timestamp: Date.now() });
        });

        // Handle chat-specific real-time events
        this.chatSocket.on('chat_message', (data) => {
          console.log('🎯 RAW chat_message EVENT RECEIVED:', data);
          console.log('🆔 SOCKET ID receiving event:', this.chatSocket?.id);
          console.log('🔍 Event keys:', Object.keys(data));
          console.log('🔍 conversationId:', data.conversationId);
          console.log('🔍 message:', data.message);
          this.handleRealtimeMessage({ type: 'chat_message', ...data });
        });
        this.chatSocket.on('message_update', (data) => {
          console.log('🔄 RAW message_update EVENT RECEIVED:', data);
          console.log('🆔 SOCKET ID receiving event:', this.chatSocket?.id);
          console.log('🔍 conversationId:', data.conversationId);
          console.log('🔍 message:', data.message);
          this.handleRealtimeMessage({ type: 'message_update', ...data });
        });
        this.chatSocket.on('reaction_update', (data) => {
          console.log('🎭 RAW reaction_update EVENT RECEIVED:', data);
          console.log('🆔 SOCKET ID receiving event:', this.chatSocket?.id);
          console.log('🔍 conversationId:', data.conversationId);
          console.log('🔍 messageId:', data.messageId);
          console.log('🔍 reactions:', data.reactions);
          this.handleRealtimeMessage({ type: 'reaction_update', ...data });
        });
        this.chatSocket.on('chat_typing', (data) => this.handleRealtimeMessage({ type: 'chat_typing', ...data }));
        this.chatSocket.on('message_status', (data) => this.handleRealtimeMessage({ type: 'message_status', ...data }));
        this.chatSocket.on('conversation_update', (data) => this.handleRealtimeMessage({ type: 'conversation_update', ...data }));
        this.chatSocket.on('call_event', (data) => {
          console.log('📞 RAW call_event EVENT RECEIVED:', data);
          this.handleRealtimeMessage({ type: 'call_event', ...data });
        });
        this.chatSocket.on('call_signal', (data) => {
          console.log('📞 RAW call_signal RECEIVED:', data);
          // Directly notify call_signal listeners (don't go through handleRealtimeMessage)
          const listeners = this.eventListeners.get('call_signal');
          if (listeners && listeners.length > 0) {
            console.log(`📡 Notifying ${listeners.length} listeners for call_signal`);
            listeners.forEach((callback, index) => {
              try {
                callback(data);
                console.log(`✅ Listener ${index + 1} called successfully for: call_signal`);
              } catch (error) {
                console.error(`❌ Error in listener ${index + 1} for call_signal:`, error);
              }
            });
          } else {
            console.warn('⚠️ No listeners registered for call_signal event');
          }
        });

        // Set a timeout to prevent hanging - resolve even if one connection fails
        setTimeout(() => {
          if (!resolved) {
            console.log('🔄 Connection timeout - continuing with available connections');
            console.log(`General: ${generalConnected ? 'connected' : 'failed'}, Chat: ${chatConnected ? 'connected' : 'failed'}`);
            resolveOnce();
          }
        }, 8000);
      } catch (error) {
        console.warn('WebSocket initialization failed, continuing without real-time features:', error);
        resolve(); // Don't reject to prevent app crash
      }
    });
  }

  // Attempt to reconnect general WebSocket
  private attemptReconnect(userId: string, token?: string) {
    // Don't reconnect if reconnections are paused (e.g., during AI calls)
    if (this.pauseReconnections) {
      console.log('⏸️ General reconnections paused - skipping reconnect attempt');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect general connection... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      // Exponential backoff with jitter, capped at 30 seconds
      const baseDelay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, 30000);

      console.log(`⏱️ Waiting ${Math.round(delay)}ms before general reconnect attempt`);

      setTimeout(() => {
        // Check again if reconnections are still paused
        if (this.pauseReconnections) {
          console.log('⏸️ General reconnections still paused - aborting reconnect');
          return;
        }

        this.connect(userId, token).catch((error) => {
          console.warn(`❌ General reconnect attempt ${this.reconnectAttempts} failed:`, error);
        });
      }, delay);
    } else {
      console.warn('⚠️ Max general reconnection attempts reached.');
    }
  }

  // Attempt to reconnect chat WebSocket
  private attemptChatReconnect(userId: string, token?: string) {
    if (this.pauseReconnections) {
      console.log('⏸️ Chat reconnections paused - skipping reconnect attempt');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`🔄 Attempting to reconnect chat connection... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      const baseDelay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, 30000);

      setTimeout(() => {
        if (this.pauseReconnections) {
          console.log('⏸️ Chat reconnections still paused - aborting reconnect');
          return;
        }

        // Reconnect only chat socket
        this.connectChatSocket(userId, token);
      }, delay);
    } else {
      console.warn('⚠️ Max chat reconnection attempts reached.');
    }
  }

  // Helper method to reconnect just the chat socket
  private connectChatSocket(userId: string, token?: string) {
    if (this.chatSocket) {
      this.chatSocket.disconnect();
    }

    this.chatSocket = io('http://192.168.43.135:3000/chat', {
      auth: token ? { token } : undefined,
      transports: ['polling', 'websocket'],
      timeout: 15000,
      forceNew: false, // 🔥 FIX: Reuse existing connections instead of forcing new ones
      autoConnect: true,
    });

    this.chatSocket.on('connect', () => {
      console.log('💬 Chat reconnection successful');
      this.startChatHeartbeat();
    });

    this.chatSocket.on('disconnect', (reason) => {
      console.log('💬 Chat reconnection closed:', reason);
      this.stopChatHeartbeat();
      if (reason !== 'io server disconnect' && reason !== 'io client disconnect') {
        this.attemptChatReconnect(userId, token);
      }
    });

    this.chatSocket.on('connect_error', (error) => {
      console.error('❌ Chat reconnection error:', error);
    });

    // 🔥 DEBUG: Catch ALL events on reconnect
    this.chatSocket.onAny((eventName, ...args) => {
      console.log('🌐 ANY EVENT RECEIVED (reconnect):', eventName, args);
      console.log('🆔 Socket ID receiving event (reconnect):', this.chatSocket?.id);
      console.log('🔍 Socket connected (reconnect):', this.chatSocket?.connected);
      console.log('🔍 Event timestamp (reconnect):', new Date().toISOString());

      // 🔥 SPECIFIC: Log if this is the expected chat_message event
      if (eventName === 'chat_message') {
        console.log('🎯 CRITICAL: chat_message event detected by frontend (reconnect)!');
        console.log('🎯 Event args (reconnect):', args);
        console.log('🎯 Socket that received it (reconnect):', this.chatSocket?.id);
      }
    });

    // 🔥 FIX: Handle ping/pong for heartbeat on reconnect
    this.chatSocket.on('ping', (data) => {
      console.log('🏓 PING received (reconnect), sending PONG');
      this.chatSocket.emit('pong', { timestamp: Date.now() });
    });

    // Re-setup chat event handlers
    this.chatSocket.on('chat_message', (data) => {
      console.log('🎯 RAW chat_message EVENT RECEIVED (reconnect):', data);
      console.log('🔍 Event keys (reconnect):', Object.keys(data));
      console.log('🔍 conversationId (reconnect):', data.conversationId);
      console.log('🔍 message (reconnect):', data.message);
      this.handleRealtimeMessage({ type: 'chat_message', ...data });
    });
    this.chatSocket.on('chat_typing', (data) => this.handleRealtimeMessage({ type: 'chat_typing', ...data }));
    this.chatSocket.on('message_status', (data) => this.handleRealtimeMessage({ type: 'message_status', ...data }));
    this.chatSocket.on('conversation_update', (data) => this.handleRealtimeMessage({ type: 'conversation_update', ...data }));
    this.chatSocket.on('call_event', (data) => {
      console.log('📞 RAW call_event EVENT RECEIVED (reconnect):', data);
      this.handleRealtimeMessage({ type: 'call_event', ...data });
    });
  }

  // Handle incoming real-time messages
  private handleRealtimeMessage(data: any) {
    const { type, payload } = data;

    switch (type) {
      case 'interaction':
        this.notifyListeners('interaction', payload);
        break;
      case 'comment':
        this.notifyListeners('comment', payload);
        break;
      case 'stats_update':
        this.notifyListeners('stats', payload);
        break;
      case 'live_activity':
        this.notifyListeners('activity', payload);
        break;
      // Chat-specific message types
      case 'chat_message':
        console.log('🔔 PROCESSING chat_message in handleRealtimeMessage:', data);
        this.notifyListeners('chat_message', data);
        break;
      case 'chat_typing':
        this.notifyListeners('chat_typing', data);
        break;
      case 'user_status':
        this.notifyListeners('user_status', data);
        break;
      case 'message_status':
        this.notifyListeners('message_status', data);
        break;
      case 'conversation_update':
        this.notifyListeners('conversation_update', data);
        break;
      case 'call_event':
        console.log('🔔 PROCESSING call_event in handleRealtimeMessage:', data);
        this.notifyListeners('call_event', data);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  // Subscribe to real-time events
  subscribe(event: string, callback: (data: any) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }

    // 🔥 FIX: Check for duplicate callbacks before adding
    const listeners = this.eventListeners.get(event)!;
    const isDuplicate = listeners.includes(callback);

    if (isDuplicate) {
      console.warn(`⚠️ Duplicate listener detected for event: ${event}, skipping registration`);
      return () => {}; // Return empty unsubscribe function
    }

    listeners.push(callback);
    console.log(`📡 Event listener registered for: ${event} (total: ${listeners.length})`);

    // Return unsubscribe function
    return () => {
      const currentListeners = this.eventListeners.get(event);
      if (currentListeners) {
        const index = currentListeners.indexOf(callback);
        if (index > -1) {
          currentListeners.splice(index, 1);
          console.log(`🗑️ Event listener unsubscribed for: ${event} (remaining: ${currentListeners.length})`);
        }
      }
    };
  }

  // Notify event listeners
  private notifyListeners(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      console.log(`📡 Notifying ${listeners.length} listeners for event: ${event}`);
      console.log(`📊 Event data:`, {
        type: event,
        conversationId: data.conversationId,
        messageId: data.message?.id,
        hasMessage: !!data.message
      });
      listeners.forEach((callback, index) => {
        try {
          callback(data);
          console.log(`✅ Listener ${index + 1} called successfully for: ${event}`);
        } catch (error) {
          console.error(`❌ Error in listener ${index + 1} for event ${event}:`, error);
        }
      });
    } else {
      console.warn(`⚠️ No listeners registered for event: ${event}`);
    }
  }

  // Send real-time like action
  async sendLike(serviceId: string, isLiking: boolean): Promise<LiveStats> {
    try {
      // Send via Socket.IO for real-time update
      if (this.socket && this.socket.connected) {
        this.socket.emit('like', {
          serviceId,
          action: isLiking ? 'add' : 'remove'
        });
      }

      // Also send via HTTP API for persistence
      const response = await api.post(`/services/${serviceId}/like`, {
        action: isLiking ? 'like' : 'unlike'
      });
      return response.data;
    } catch (error) {
      console.error('Error sending like:', error);
      throw error;
    }
  }

  // Send real-time comment
  async sendComment(serviceId: string, comment: string): Promise<LiveComment> {
    try {
      const response = await api.post(`/services/${serviceId}/comments`, {
        comment
      });

      const newComment = response.data;

      // Send via Socket.IO for real-time update
      if (this.socket && this.socket.connected) {
        this.socket.emit('comment', {
          serviceId,
          comment: newComment
        });
      }

      return newComment;
    } catch (error) {
      console.error('Error sending comment:', error);
      throw error;
    }
  }

  // Send real-time share action
  async sendShare(serviceId: string): Promise<void> {
    try {
      // Send via Socket.IO for real-time update
      if (this.socket && this.socket.connected) {
        this.socket.emit('share', {
          serviceId
        });
      }

      // Also send via HTTP API
      await api.post(`/services/${serviceId}/share`);
    } catch (error) {
      console.error('Error sending share:', error);
      throw error;
    }
  }

  // Track view for real-time analytics
  async trackView(serviceId: string): Promise<void> {
    try {
      // Send via Socket.IO for real-time update
      if (this.socket && this.socket.connected) {
        this.socket.emit('view', {
          serviceId
        });
      }

      // Also send via HTTP API
      await api.post(`/services/${serviceId}/view`);
    } catch (error) {
      console.error('Error tracking view:', error);
      // Don't throw error for view tracking
    }
  }

  // Get live stats for a service
  async getLiveStats(serviceId: string): Promise<LiveStats> {
    try {
      const response = await api.get(`/services/${serviceId}/live-stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching live stats:', error);
      // Return default stats
      return {
        serviceId,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        isLiked: false,
        isBookmarked: false,
      };
    }
  }

  // Get live comments for a service
  async getLiveComments(serviceId: string): Promise<LiveComment[]> {
    try {
      const response = await api.get(`/services/${serviceId}/live-comments`);
      return response.data;
    } catch (error) {
      console.error('Error fetching live comments:', error);
      return [];
    }
  }

  // Like/unlike a comment
  async toggleCommentLike(commentId: string): Promise<{ liked: boolean; likes: number }> {
    try {
      const response = await api.post(`/comments/${commentId}/like`);
      
      // Send real-time update
      if (this.socket && this.socket.connected) {
        this.socket.emit('comment_like', {
          commentId,
          ...response.data
        });
      }

      return response.data;
    } catch (error) {
      console.error('Error toggling comment like:', error);
      throw error;
    }
  }

  // Join a service "room" for real-time updates
  joinService(serviceId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_service', {
        serviceId
      });
    }
  }

  // Leave a service "room"
  leaveService(serviceId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_service', {
        serviceId
      });
    }
  }

  // Get recent activity for services
  async getRecentActivity(serviceIds: string[]): Promise<RealtimeInteraction[]> {
    try {
      const response = await api.post('/services/recent-activity', {
        serviceIds
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  }

  // Start heartbeat for general connection
  private startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  // Stop general heartbeat
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Start heartbeat for chat connection
  private startChatHeartbeat() {
    this.stopChatHeartbeat(); // Clear any existing heartbeat
    this.chatHeartbeatInterval = setInterval(() => {
      if (this.chatSocket && this.chatSocket.connected) {
        this.chatSocket.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds
  }

  // Stop chat heartbeat
  private stopChatHeartbeat() {
    if (this.chatHeartbeatInterval) {
      clearInterval(this.chatHeartbeatInterval);
      this.chatHeartbeatInterval = null;
    }
  }

  // Disconnect both Socket.IO connections
  disconnect() {
    this.stopHeartbeat();
    this.stopChatHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.chatSocket) {
      this.chatSocket.disconnect();
      this.chatSocket = null;
    }

    this.eventListeners.clear();
    this.reconnectAttempts = 0;
  }

  // Check if real-time connections are active
  isConnected(): boolean {
    return (this.socket !== null && this.socket.connected) || (this.chatSocket !== null && this.chatSocket.connected);
  }

  // Check if chat connection specifically is active
  isChatConnected(): boolean {
    return this.chatSocket !== null && this.chatSocket.connected;
  }

  // Send typing indicator for comments
  sendTypingIndicator(serviceId: string, isTyping: boolean) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing', {
        serviceId,
        isTyping
      });
    }
  }

  // Send presence update (user is viewing a service)
  sendPresence(serviceId: string, action: 'join' | 'leave') {
    if (this.socket && this.socket.connected) {
      this.socket.emit('presence', {
        serviceId,
        action
      });
    }
  }

  // === CHAT-SPECIFIC METHODS ===

  // Send chat message via Socket.IO
  sendMessage(conversationId: string, message: any) {
    if (this.chatSocket && this.chatSocket.connected) {
      this.chatSocket.emit('chat_message', {
        conversationId,
        message
      });
    } else {
      console.warn('💬 Chat socket not connected - message not sent');
    }
  }

  // Join a chat conversation for real-time updates
  joinConversation(conversationId: string) {
    // 🔥 FIX: Check if already joined to prevent duplicates
    if (this.joinedRooms.has(conversationId)) {
      console.log(`💬 Already joined conversation ${conversationId}, skipping duplicate join`);
      return;
    }

    if (this.chatSocket && this.chatSocket.connected) {
      console.log(`💬 Joining conversation: ${conversationId}`);
      console.log(`🔍 Chat socket status: ID=${this.chatSocket.id}, connected=${this.chatSocket.connected}`);

      // 🔥 FIX: Add callback to confirm successful join
      this.chatSocket.emit('join_conversation', {
        conversationId
      }, (response: any) => {
        if (response?.error) {
          console.error(`❌ Failed to join conversation ${conversationId}:`, response.error);
        } else {
          console.log(`✅ Successfully joined conversation: ${conversationId}`);
          this.joinedRooms.add(conversationId); // 🔥 Track successful join
        }
      });

      console.log(`📡 join_conversation event emitted for: ${conversationId}`);

      // 🔥 FIX: Listen for join confirmation
      this.chatSocket.once('joined_conversation', (data: any) => {
        if (data.conversationId === conversationId) {
          console.log(`🎉 Confirmed joined conversation: ${conversationId} (room size: ${data.roomSize})`);
          this.joinedRooms.add(conversationId); // 🔥 Track confirmed join
        }
      });
    } else {
      console.warn(`💬 Chat socket not connected - cannot join conversation ${conversationId}`);
      console.warn(`🔍 Socket state: exists=${!!this.chatSocket}, connected=${this.chatSocket?.connected}`);
    }
  }

  // Leave a chat conversation
  leaveConversation(conversationId: string) {
    if (this.chatSocket && this.chatSocket.connected) {
      console.log(`💬 Leaving conversation: ${conversationId}`);
      this.chatSocket.emit('leave_conversation', {
        conversationId
      });
      this.joinedRooms.delete(conversationId); // 🔥 Remove from joined rooms tracker
    } else {
      // Still remove from tracker even if disconnected
      this.joinedRooms.delete(conversationId);
    }
  }

  // Send typing indicator
  sendChatTyping(conversationId: string, isTyping: boolean) {
    if (this.chatSocket && this.chatSocket.connected) {
      this.chatSocket.emit('chat_typing', {
        conversationId,
        isTyping
      });
    }
  }

  // Send message read receipt
  sendReadReceipt(conversationId: string, messageId: string) {
    if (this.chatSocket && this.chatSocket.connected) {
      this.chatSocket.emit('message_read', {
        conversationId,
        messageId
      });
    }
  }

  // Send call signaling data
  sendCallSignal(callSessionId: string, signalType: string, data: any, conversationId?: string) {
    if (this.chatSocket && this.chatSocket.connected) {
      this.chatSocket.emit('call_signal', {
        callSessionId,
        signalType,
        data,
        conversationId // Optional - backend will fetch if not provided
      });
    }
  }

  // Start typing indicator for chat
  startTyping(conversationId: string) {
    if (this.chatSocket && this.chatSocket.connected) {
      this.chatSocket.emit('typing_start', {
        conversationId
      });
    }
  }

  // Stop typing indicator for chat
  stopTyping(conversationId: string) {
    if (this.chatSocket && this.chatSocket.connected) {
      this.chatSocket.emit('typing_stop', {
        conversationId
      });
    }
  }

  // Pause reconnections (useful during AI calls to prevent interference)
  pauseReconnection() {
    console.log('⏸️ Pausing real-time WebSocket reconnections');
    this.pauseReconnections = true;
  }

  // Resume reconnections
  resumeReconnection() {
    console.log('▶️ Resuming real-time WebSocket reconnections');
    this.pauseReconnections = false;
  }

}

export const realtimeAPI = new RealtimeAPI();