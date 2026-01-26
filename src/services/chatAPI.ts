import { api } from './api';
import { realtimeAPI } from './realtimeAPI';
import { API_CONFIG } from '../config/api';

export interface ChatConversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  isAI?: boolean;
  isPinned?: boolean;
  chatType: 'friend' | 'vendor' | 'support' | 'ai' | 'rider';
  verified?: boolean;
  otherUserId?: string; // For 1:1 chats, the other participant's user ID
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'file' | 'livestream' | 'auction' | 'system' | 'invoice' | 'wishlist';
  status: 'sending' | 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  fileData?: {
    name: string;
    size: string;
    type: string;
    url: string;
  };
  invoiceData?: any; // Will be populated with Invoice object for invoice messages
  metadata?: {
    [key: string]: any;
    wishlistData?: any;
    productData?: any;
  };
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageRequest {
  conversationId: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'file';
  content?: string;
  mediaUrl?: string;
  fileData?: {
    name: string;
    size: string;
    type: string;
  };
  metadata?: {
    [key: string]: any;
    audioDuration?: number; // Duration in seconds for audio messages
  };
}

export interface CreateConversationRequest {
  participantIds: string[];
  chatType: 'friend' | 'vendor' | 'support' | 'ai' | 'rider';
  initialMessage?: string;
}

class ChatAPI {
  private token: string | null = null;

  setAuthToken(token: string) {
    this.token = token;
  }

  // Get total unread message count across all conversations
  async getTotalUnreadCount(): Promise<number> {
    try {
      // Fetch all conversations to sum up unread counts
      // Using a larger limit to get more accurate count
      const response = await api.get('/chat/conversations', {
        params: { page: 1, limit: 100 }
      });

      const backendConversations = response.data.data || [];
      const totalUnread = backendConversations.reduce((sum: number, conv: any) => {
        return sum + (conv.unreadCount || 0);
      }, 0);

      return totalUnread;
    } catch (error) {
      console.error('Error fetching total unread count:', error);
      return 0;
    }
  }

  // Get all conversations for the current user
  async getConversations(page = 1, limit = 20): Promise<{
    conversations: ChatConversation[];
    pagination: { page: number; limit: number; total: number };
  }> {
    try {
      const response = await api.get('/chat/conversations', {
        params: { page, limit }
      });

      // Map backend response to frontend ChatConversation format
      const backendConversations = response.data.data || [];
      const mappedConversations: ChatConversation[] = backendConversations.map((conv: any) => {
        // 🔥 FIX: Defensive name handling - handle null, undefined, empty strings, and whitespace
        const conversationName = conv.name && conv.name.trim() !== ''
          ? conv.name.trim()
          : 'Unknown';

        return {
          id: conv.id,
          name: conversationName,
          avatar: conv.avatarUrl || 'https://via.placeholder.com/56',
          lastMessage: conv.lastMessage?.content || conv.lastMessage || '',
          timestamp: conv.lastMessageAt || conv.createdAt,
          unreadCount: conv.unreadCount || 0,
          isOnline: conv.isOnline || false,
          isAI: conv.isAI,
          isPinned: conv.isPinned,
          chatType: conv.chatType,
          verified: conv.verified,
          otherUserId: conv.otherUserId,
        };
      });

      return {
        conversations: mappedConversations,
        pagination: response.data.pagination || { page, limit, total: 0 }
      };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // Return empty conversations to prevent app crash
      return {
        conversations: [],
        pagination: { page, limit, total: 0 }
      };
    }
  }

  // Get messages for a specific conversation
  async getMessages(conversationId: string, page = 1, limit = 50): Promise<{
    messages: ChatMessage[];
    pagination: { page: number; limit: number; total: number };
  }> {
    try {
      const response = await api.get(`/chat/conversations/${conversationId}/messages`, {
        params: { page, limit }
      });
      
      return {
        messages: response.data.data || [],
        pagination: response.data.pagination || { page, limit, total: 0 }
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Return empty messages to prevent app crash
      return {
        messages: [],
        pagination: { page, limit, total: 0 }
      };
    }
  }

  // Send a message
  async sendMessage(messageData: SendMessageRequest): Promise<ChatMessage> {
    try {
      const response = await api.post('/chat/messages', messageData);

      // Backend handles WebSocket broadcast via ChatService.notifyNewMessage()
      // No need to send via WebSocket here - would cause USE_HTTP_API error

      return response.data.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Send AI message (for user messages to AI or AI responses)
  async sendAIMessage(conversationId: string, content: string, isAIResponse: boolean = false): Promise<ChatMessage> {
    try {
      const response = await api.post('/chat/messages/ai', {
        conversationId,
        content,
        isAIResponse,
      });

      return response.data.data;
    } catch (error) {
      console.error('Error sending AI message:', error);
      throw error;
    }
  }

  // Create a new conversation
  async createConversation(conversationData: CreateConversationRequest): Promise<ChatConversation> {
    try {
      const response = await api.post('/chat/conversations', conversationData);
      return response.data.data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Find existing conversation or create a new one
  async findOrCreateConversation(
    participantIds: string[],
    chatType: 'friend' | 'vendor' | 'support' | 'ai' | 'rider'
  ): Promise<ChatConversation> {
    try {
      const response = await api.post('/chat/conversations/find-or-create', {
        participantIds,
        chatType,
      });

      return response.data.data;
    } catch (error) {
      console.error('Error in findOrCreateConversation:', error);
      // Fallback to creating a new conversation
      return await this.createConversation({
        participantIds,
        chatType,
      });
    }
  }

  // Update message status (read, delivered, etc.)
  async updateMessageStatus(messageId: string, status: 'delivered' | 'read'): Promise<void> {
    try {
      await api.put(`/chat/messages/${messageId}/status`, { status });
    } catch (error) {
      console.error('Error updating message status:', error);
      // Don't throw error for status updates
    }
  }

  // Update message content and metadata
  async updateMessage(messageId: string, data: {
    content?: string;
    mediaUrl?: string;
    fileData?: any
  }): Promise<ChatMessage> {
    try {
      const response = await api.put(`/chat/messages/${messageId}`, data);
      return response.data.data;
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  }

  // Upload file for chat
  async uploadFile(file: { uri: string; name: string; type: string }, messageId: string): Promise<{
    url: string;
    fileData: {
      name: string;
      size: string;
      type: string;
      url: string;
    };
  }> {
    try {
      console.log('📤 Uploading file:', { name: file.name, type: file.type, messageId });

      // Create FormData for React Native
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

      const endpoint = `/chat/messages/${messageId}/upload`;

      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  }

  // Start a call
  async startCall(conversationId: string, callType: 'audio' | 'video', participantIds?: string[]): Promise<{
    callSessionId: string;
    agoraConfig?: {
      appId: string;
      channel: string;
      token: string;
      uid: number;
    };
    rtcConfiguration?: any; // Backward compatibility
  }> {
    try {
      const response = await api.post('/chat/calls', {
        conversationId,
        callType,
        participantIds,
      }, {
        timeout: API_CONFIG.CALL_TIMEOUT, // Use longer timeout for calls
      });

      return response.data.data;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  // Join a call
  async joinCall(callSessionId: string): Promise<{
    agoraConfig?: {
      appId: string;
      channel: string;
      token: string;
      uid: number;
    };
    rtcConfiguration?: any; // Backward compatibility
    participants: any[];
  }> {
    try {
      console.log('📞 Attempting to join call:', callSessionId);
      console.log('📞 Join endpoint:', `/chat/calls/${callSessionId}/join`);
      const response = await api.post(`/chat/calls/${callSessionId}/join`, {}, {
        timeout: API_CONFIG.CALL_TIMEOUT,
      });
      console.log('✅ Join call response:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Error joining call:', error);
      console.error('❌ Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      });
      throw error;
    }
  }

  // End a call
  async endCall(callSessionId: string, reason: string = 'completed'): Promise<void> {
    try {
      await api.post(`/chat/calls/${callSessionId}/leave`, {
        reason,
        endedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error ending call:', error);
      // Don't throw error for call ending
    }
  }

  // Update call settings (mute, video, etc.)
  async updateCallSettings(callSessionId: string, settings: {
    isMuted?: boolean;
    isVideoEnabled?: boolean;
  }): Promise<void> {
    try {
      await api.put(`/chat/calls/${callSessionId}/settings`, settings);
    } catch (error) {
      console.error('Error updating call settings:', error);
      // Don't throw error for settings update
    }
  }

  // Send AI request
  async sendAIRequest(query: string, conversationId: string): Promise<{
    response: string;
    messageId: string;
  }> {
    try {
      const response = await api.post('/chat/ai/research', {
        query,
        conversationId,
        requestType: 'chat'
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error sending AI request:', error);
      throw error;
    }
  }

  // Mark conversation as read
  async markConversationAsRead(conversationId: string): Promise<void> {
    try {
      await api.put(`/chat/conversations/${conversationId}/read`);
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      // Don't throw error for read status
    }
  }

  // Archive conversation
  async archiveConversation(conversationId: string): Promise<void> {
    try {
      await api.put(`/chat/conversations/${conversationId}/archive`);
    } catch (error) {
      console.error('Error archiving conversation:', error);
      throw error;
    }
  }

  // Pin/unpin conversation
  async togglePinConversation(conversationId: string, isPinned: boolean): Promise<void> {
    try {
      await api.put(`/chat/conversations/${conversationId}/pin`, { isPinned });
    } catch (error) {
      console.error('Error toggling pin status:', error);
      throw error;
    }
  }

  // Unarchive conversation
  async unarchiveConversation(conversationId: string): Promise<void> {
    try {
      await api.put(`/chat/conversations/${conversationId}/unarchive`);
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
      throw error;
    }
  }

  // Mute/unmute conversation
  async toggleMuteConversation(conversationId: string, isMuted: boolean): Promise<void> {
    try {
      await api.put(`/chat/conversations/${conversationId}/mute`, { isMuted });
    } catch (error) {
      console.error('Error toggling mute status:', error);
      throw error;
    }
  }

  // =============================================================================
  // TYPING INDICATOR METHODS
  // =============================================================================

  // Update typing status
  async updateTypingStatus(conversationId: string, isTyping: boolean): Promise<void> {
    try {
      await api.post(`/chat/conversations/${conversationId}/typing`, { isTyping });

      // Also send via WebSocket for real-time updates
      if (realtimeAPI.isConnected()) {
        if (isTyping) {
          realtimeAPI.startTyping(conversationId);
        } else {
          realtimeAPI.stopTyping(conversationId);
        }
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
      // Don't throw error for typing updates
    }
  }

  // =============================================================================
  // USER STATUS METHODS
  // =============================================================================

  // Get user status
  async getUserStatus(userId: string): Promise<{
    userId: string;
    isOnline: boolean;
    lastSeen: string;
    isTyping?: boolean;
  }> {
    try {
      const response = await api.get(`/chat/users/${userId}/status`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user status:', error);
      // Return default status if API fails
      return {
        userId,
        isOnline: false,
        lastSeen: new Date().toISOString(),
      };
    }
  }

  // Update current user's online status
  async updateUserStatus(isOnline: boolean): Promise<void> {
    try {
      await api.put('/chat/users/status', { isOnline });
    } catch (error) {
      console.error('Error updating user status:', error);
      // Don't throw error for status updates
    }
  }

  // =============================================================================
  // ENHANCED CONVERSATION FILTERING
  // =============================================================================

  // Get conversations with filtering options
  async getFilteredConversations(options: {
    chatType?: 'friend' | 'vendor' | 'support' | 'ai' | 'rider';
    search?: string;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    conversations: ChatConversation[];
    pagination: { page: number; limit: number; total: number };
  }> {
    try {
      const params: any = {
        page: options.page || 1,
        limit: options.limit || 20,
      };

      if (options.chatType) params.chatType = options.chatType;
      if (options.search) params.search = options.search;
      if (options.includeArchived) params.includeArchived = options.includeArchived;
      if (options.archivedOnly) params.archivedOnly = options.archivedOnly;

      const response = await api.get('/chat/conversations', { params });

      console.log('📥 Raw backend response structure:', JSON.stringify(response.data, null, 2));

      // Map backend response to frontend ChatConversation format
      const backendConversations = response.data.data || [];

      if (backendConversations.length > 0) {
        console.log('📊 First conversation keys:', Object.keys(backendConversations[0]));
        console.log('📊 First conversation data:', JSON.stringify(backendConversations[0], null, 2));
      }

      const mappedConversations: ChatConversation[] = backendConversations.map((conv: any) => {
        console.log(`🔍 Mapping conversation ${conv.id}:`);
        console.log(`   - name: "${conv.name}" (type: ${typeof conv.name})`);
        console.log(`   - avatarUrl: "${conv.avatarUrl}" (type: ${typeof conv.avatarUrl})`);
        console.log(`   - chatType: "${conv.chatType}"`);
        console.log(`   - isAI: ${conv.isAI}`);

        // 🔥 FIX: Defensive name handling - handle null, undefined, empty strings, and whitespace
        const conversationName = conv.name && conv.name.trim() !== ''
          ? conv.name.trim()
          : 'Unknown';

        return {
          id: conv.id,
          name: conversationName,
          avatar: conv.avatarUrl || 'https://via.placeholder.com/56', // Map avatarUrl to avatar
          lastMessage: conv.lastMessage?.content || conv.lastMessage || '',
          timestamp: conv.lastMessageAt || conv.createdAt, // Map lastMessageAt to timestamp
          unreadCount: conv.unreadCount || 0,
          isOnline: conv.isOnline || false,
          isAI: conv.isAI,
          isPinned: conv.isPinned,
          chatType: conv.chatType,
          verified: conv.verified,
          otherUserId: conv.otherUserId,
        };
      });

      console.log('✅ Mapped conversations:', JSON.stringify(mappedConversations.slice(0, 2), null, 2));

      return {
        conversations: mappedConversations,
        pagination: response.data.pagination || { page: params.page, limit: params.limit, total: 0 }
      };
    } catch (error) {
      console.error('Error fetching filtered conversations:', error);
      // Return empty conversations to prevent app crash
      return {
        conversations: [],
        pagination: { page: options.page || 1, limit: options.limit || 20, total: 0 }
      };
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  // Set user as active (call this when app becomes active)
  async setUserActive(): Promise<void> {
    await this.updateUserStatus(true);
  }

  // Set user as inactive (call this when app goes to background)
  async setUserInactive(): Promise<void> {
    await this.updateUserStatus(false);
  }

  // Start typing in a conversation (with auto-stop after timeout)
  startTyping(conversationId: string, timeout: number = 3000): void {
    this.updateTypingStatus(conversationId, true);

    // Auto-stop typing after timeout
    setTimeout(() => {
      this.updateTypingStatus(conversationId, false);
    }, timeout);
  }

  // Stop typing in a conversation
  stopTyping(conversationId: string): void {
    this.updateTypingStatus(conversationId, false);
  }

  // Update conversation metadata (for AI conversations)
  async updateConversationMetadata(conversationId: string, lastMessagePreview?: string): Promise<void> {
    try {
      await api.put(`/chat/conversations/${conversationId}/metadata`, {
        lastMessagePreview,
      });
    } catch (error) {
      console.error('Error updating conversation metadata:', error);
      // Don't throw error for metadata updates
    }
  }

  // =============================================================================
  // EMOJI REACTION METHODS
  // =============================================================================

  // Add or remove emoji reaction to a message
  async addReaction(messageId: string, emoji: string): Promise<void> {
    try {
      await api.post(`/chat/messages/${messageId}/reactions`, { emoji });
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  // Get reactions for a message
  async getReactions(messageId: string): Promise<any> {
    try {
      const response = await api.get(`/chat/messages/${messageId}/reactions`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching reactions:', error);
      return {};
    }
  }
}

export const chatAPI = new ChatAPI();