import { API_CONFIG } from '../config/api';
import * as SecureStore from 'expo-secure-store';

// =====================
// TYPE DEFINITIONS
// =====================

export interface LiveStream {
  id: string;
  vendor_id: string;
  vendor: {
    id: string;
    username: string;
    avatar_url?: string;
    is_verified?: boolean;
  };
  title: string;
  description?: string;
  stream_type: 'products' | 'services';
  status: 'setup' | 'live' | 'ended' | 'paused';
  viewer_count: number;
  total_viewers: number;
  total_sales: number;
  thumbnail_url?: string;
  stream_url?: string;
  products?: LiveStreamProduct[];
  services?: LiveStreamService[];
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface LiveStreamProduct {
  id: string;
  product_id: string;
  product: {
    id: string;
    name: string;
    primary_image_url?: string;
    category_name?: string;
  };
  live_price: number;
  live_stock: number;
  original_stock: number;
  sold_count: number;
  display_order: number;
  is_featured: boolean;
}

export interface LiveStreamService {
  id: string;
  service_id: string;
  service: {
    id: string;
    name: string;
    description?: string;
    category_name?: string;
    duration_minutes: number;
    location_type: 'online' | 'in_person' | 'hybrid';
  };
  live_price: number;
  available_slots: Array<{
    date: string;
    time: string;
    available: boolean;
  }>;
  booking_window_days: number;
  max_advance_days: number;
  display_order: number;
  is_featured: boolean;
}

export interface Comment {
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

export interface GiftType {
  id: string;
  name: string;
  display_name: string;
  icon_name: string;
  base_value: number;
  color: string;
  animation_type?: string;
}

export interface CreateStreamData {
  title: string;
  description?: string;
  stream_type: 'products' | 'services';
  thumbnail_url?: string;
  products?: {
    product_id: string;
    live_price: number;
    live_stock: number;
    display_order?: number;
    is_featured?: boolean;
  }[];
}

export interface LivePurchaseData {
  stream_id: string;
  product_id: string;
  quantity: number;
  continue_watching?: boolean;
  rider_id?: string;
  delivery_address?: any;
}

export interface LiveBookingData {
  stream_id: string;
  service_date: string;
  service_time: string;
  service_notes?: string;
  continue_watching?: boolean;
}

// =====================
// API SERVICE CLASS
// =====================

class LiveSalesAPI {
  private baseURL = API_CONFIG.BASE_URL;

  // Helper method to get auth headers
  private async getAuthHeaders() {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      console.log('🔑 Token for liveSalesAPI request:', accessToken ? `Present (${accessToken.substring(0, 20)}...)` : 'Missing');

      if (!accessToken) {
        console.log('❌ No access token found in liveSalesAPI');
        throw new Error('Authentication required. Please log in again.');
      }

      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };
    } catch (error) {
      console.error('Error getting auth headers in liveSalesAPI:', error);
      throw error;
    }
  }

  // Helper method for API requests
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = await this.getAuthHeaders();

    console.log('🌐 LiveSalesAPI Request:', {
      url,
      method: options.method || 'GET',
      hasAuth: !!headers.Authorization
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      console.log('📡 LiveSalesAPI Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ LiveSalesAPI Error Response:', errorData);
        throw new Error(errorData.message || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ LiveSalesAPI Success:', typeof data, Array.isArray(data) ? `${data.length} items` : 'object');
      return data;
    } catch (error) {
      console.error('💥 LiveSalesAPI Request Failed:', {
        url,
        error: error.message,
        name: error.name
      });
      throw error;
    }
  }

  // =====================
  // STREAM DISCOVERY
  // =====================

  /**
   * Get all active live streams for discovery feed
   */
  async getActiveStreams(limit = 20, offset = 0, excludePlugged = false): Promise<LiveStream[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      if (excludePlugged) {
        params.append('exclude_plugged', 'true');
      }

      return await this.request<LiveStream[]>(
        `/live-sales/streams?${params.toString()}`
      );
    } catch (error) {
      console.error('Error fetching active streams:', error);
      throw error;
    }
  }

  /**
   * Get live streams from connected vendors (plugged)
   */
  async getPluggedVendorsStreams(limit = 10): Promise<LiveStream[]> {
    try {
      return await this.request<LiveStream[]>(
        `/live-sales/plugged-vendors/streams?limit=${limit}`
      );
    } catch (error) {
      console.error('Error fetching plugged vendors streams:', error);
      throw error;
    }
  }

  /**
   * Get specific stream details
   */
  async getStreamById(streamId: string): Promise<LiveStream> {
    try {
      return await this.request<LiveStream>(`/live-sales/streams/${streamId}`);
    } catch (error) {
      console.error('Error fetching stream details:', error);
      throw error;
    }
  }

  // =====================
  // STREAM MANAGEMENT
  // =====================

  /**
   * Create a new live stream (vendors only)
   */
  async createStream(streamData: CreateStreamData): Promise<LiveStream> {
    try {
      return await this.request<LiveStream>('/live-sales/streams', {
        method: 'POST',
        body: JSON.stringify(streamData),
      });
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  }

  /**
   * Update stream status (setup -> live -> ended)
   */
  async updateStreamStatus(streamId: string, status: string, streamUrl?: string): Promise<LiveStream> {
    try {
      return await this.request<LiveStream>(`/live-sales/streams/${streamId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, stream_url: streamUrl }),
      });
    } catch (error) {
      console.error('Error updating stream status:', error);
      throw error;
    }
  }

  /**
   * End a live stream
   */
  async endStream(streamId: string): Promise<void> {
    try {
      await this.request(`/live-sales/streams/${streamId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error ending stream:', error);
      throw error;
    }
  }

  /**
   * Generate Agora token for broadcasting/viewing
   */
  async generateAgoraToken(streamId: string, role: 'host' | 'audience' = 'host'): Promise<{
    token: string;
    channel: string;
    uid: number;
    appId: string;
  }> {
    try {
      return await this.request(`/live-sales/streams/${streamId}/agora-token?role=${role}`);
    } catch (error) {
      console.error('Error generating Agora token:', error);
      throw error;
    }
  }

  // =====================
  // VIEWER ACTIONS
  // =====================

  /**
   * Join a live stream as viewer
   */
  async joinStream(streamId: string): Promise<void> {
    try {
      await this.request(`/live-sales/streams/${streamId}/join`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error joining stream:', error);
      throw error;
    }
  }

  /**
   * Leave a live stream
   */
  async leaveStream(streamId: string): Promise<void> {
    try {
      await this.request(`/live-sales/streams/${streamId}/leave`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error leaving stream:', error);
      throw error;
    }
  }

  // =====================
  // COMMENTS & REACTIONS
  // =====================

  /**
   * Get comments for a stream
   */
  async getStreamComments(streamId: string, limit = 50, offset = 0): Promise<Comment[]> {
    try {
      return await this.request<Comment[]>(
        `/live-sales/streams/${streamId}/comments?limit=${limit}&offset=${offset}`
      );
    } catch (error) {
      console.error('Error fetching stream comments:', error);
      throw error;
    }
  }

  /**
   * Post a comment to a stream
   */
  async postComment(streamId: string, message: string): Promise<Comment> {
    try {
      return await this.request<Comment>('/live-sales/comments', {
        method: 'POST',
        body: JSON.stringify({ stream_id: streamId, message }),
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      throw error;
    }
  }

  /**
   * Send a reaction to a stream
   */
  async sendReaction(streamId: string, reactionType: string): Promise<void> {
    try {
      await this.request('/live-sales/reactions', {
        method: 'POST',
        body: JSON.stringify({ stream_id: streamId, reaction_type: reactionType }),
      });
    } catch (error) {
      console.error('Error sending reaction:', error);
      throw error;
    }
  }

  // =====================
  // GIFTS & MONETIZATION
  // =====================

  /**
   * Get available gift types
   */
  async getGiftTypes(): Promise<GiftType[]> {
    try {
      return await this.request<GiftType[]>('/live-sales/gift-types');
    } catch (error) {
      console.error('Error fetching gift types:', error);
      throw error;
    }
  }

  /**
   * Send a gift to a stream vendor
   */
  async sendGift(streamId: string, giftType: string, quantity: number, message?: string): Promise<void> {
    try {
      await this.request('/live-sales/gifts', {
        method: 'POST',
        body: JSON.stringify({ 
          stream_id: streamId, 
          gift_type: giftType, 
          quantity, 
          message 
        }),
      });
    } catch (error) {
      console.error('Error sending gift:', error);
      throw error;
    }
  }

  // =====================
  // LIVE COMMERCE
  // =====================

  /**
   * Purchase a product during live stream
   */
  async purchaseProduct(purchaseData: LivePurchaseData): Promise<void> {
    try {
      await this.request('/live-sales/purchase/product', {
        method: 'POST',
        body: JSON.stringify(purchaseData),
      });
    } catch (error) {
      console.error('Error purchasing product:', error);
      throw error;
    }
  }

  /**
   * Book a service during live stream
   */
  async bookService(bookingData: LiveBookingData): Promise<void> {
    try {
      await this.request('/live-sales/purchase/service', {
        method: 'POST',
        body: JSON.stringify(bookingData),
      });
    } catch (error) {
      console.error('Error booking service:', error);
      throw error;
    }
  }

  // =====================
  // VENDOR ANALYTICS
  // =====================

  /**
   * Get vendor's own streams with analytics
   */
  async getMyStreams(status?: string, limit = 20, offset = 0): Promise<LiveStream[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      return await this.request<LiveStream[]>(`/live-sales/my-streams?${params.toString()}`);
    } catch (error) {
      console.error('Error fetching my streams:', error);
      throw error;
    }
  }

  /**
   * Get detailed analytics for a specific stream
   */
  async getStreamAnalytics(streamId: string): Promise<any> {
    try {
      return await this.request(`/live-sales/streams/${streamId}/analytics`);
    } catch (error) {
      console.error('Error fetching stream analytics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const liveSalesAPI = new LiveSalesAPI();