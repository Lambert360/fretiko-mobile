import { api } from './api';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import io, { Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api';

const API_URL = API_CONFIG.BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Auction Interfaces
 * Mirror the backend entity interfaces for type safety
 */
export interface AuctionCategory {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  color: string;
  slug: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuctionCategoryWithStats extends AuctionCategory {
  auction_count: number;
  active_auction_count: number;
  featured_auctions?: AuctionPreview[];
}

export interface AuctionPreview {
  id: string;
  title: string;
  current_bid: number;
  starting_price: number;
  thumbnail_url?: string;
  time_status: 'upcoming' | 'active' | 'ended';
  seconds_remaining?: number;
  total_bids: number;
}

export interface Auction {
  id: string;
  seller_id: string;
  category_id: string;
  title: string;
  description: string;
  lot_number?: string;
  starting_price: number;
  reserve_price?: number;
  current_bid: number;
  bid_increment: number;
  auction_type: 'timed' | 'live';
  start_time: string;
  end_time: string;
  soft_close_enabled: boolean;
  soft_close_extension: number;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled' | 'sold';
  total_bids: number;
  unique_bidders: number;
  view_count: number;
  watch_count: number;
  winner_id?: string;
  winning_bid?: number;
  sale_completed: boolean;
  images: string[];
  video_url?: string;
  thumbnail_url?: string;
  stream_url?: string;
  auctioneer_enabled: boolean;
  crowd_sounds_enabled: boolean;
  listing_fee: number;
  commission_rate: number;
  buyer_premium_rate: number;
  created_at: string;
  updated_at: string;
}

export interface AuctionWithDetails extends Auction {
  seller: {
    id: string;
    username: string;
    avatar_url?: string;
    is_verified: boolean;
  };
  category: {
    id: string;
    name: string;
    icon_name: string;
    color: string;
    slug: string;
  };
  current_winning_bid?: {
    id: string;
    bidder_display_id: string;
    amount: number;
    created_at: string;
  };
  time_status: 'upcoming' | 'active' | 'ended';
  seconds_remaining?: number;
  is_watched_by_user?: boolean;
  user_has_bid?: boolean;
}

export interface AuctionBid {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number;
  bid_type: 'manual' | 'proxy' | 'auto';
  max_bid_amount?: number;
  is_proxy_bid: boolean;
  proxy_bid_parent_id?: string;
  is_winning: boolean;
  is_valid: boolean;
  bidder_display_id: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface PublicBidHistoryItem {
  id: string;
  amount: number;
  bidder_display_id: string;
  is_winning: boolean;
  created_at: string;
  bid_type: 'manual' | 'proxy' | 'auto';
}

export interface AuctionFilters {
  search?: string;
  category_id?: string;
  category_slug?: string;
  status?: 'scheduled' | 'active' | 'ended' | 'cancelled' | 'sold';
  auction_type?: 'timed' | 'live';
  min_price?: number;
  max_price?: number;
  time_filter?: 'ending_soon' | 'just_started' | 'upcoming';
  sort?: 'price_asc' | 'price_desc' | 'time_asc' | 'time_desc' | 'bids_desc' | 'created_desc';
  limit?: number;
  offset?: number;
  featured_only?: boolean;
  no_reserve?: boolean;
  seller_id?: string;
}

export interface CreateAuctionData {
  title: string;
  description: string;
  lot_number?: string;
  category_id: string;
  starting_price: number;
  reserve_price?: number;
  bid_increment?: number;
  auction_type: 'timed' | 'live';
  start_time: string;
  end_time: string;
  soft_close_enabled?: boolean;
  soft_close_extension?: number;
  images?: string[];
  video_url?: string;
  thumbnail_url?: string;
  stream_url?: string;
  auctioneer_enabled?: boolean;
  crowd_sounds_enabled?: boolean;
}

export interface PlaceBidData {
  auction_id: string;
  amount: number;
  bid_type?: 'manual' | 'proxy';
  max_bid_amount?: number;
}

/**
 * Auctions API Service
 * Handles all auction-related API calls
 */
export const auctionsAPI = {
  /**
   * Get all auction categories
   */
  async getCategories(includeStats = false): Promise<AuctionCategory[] | AuctionCategoryWithStats[]> {
    try {
      const params = includeStats ? '?include_stats=true' : '';
      const response = await api.get(`/auctions/categories${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching auction categories:', error);
      throw error;
    }
  },

  /**
   * Get auctions with filtering
   */
  async getAuctions(filters: AuctionFilters = {}): Promise<{ auctions: AuctionWithDetails[]; total: number }> {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/auctions?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching auctions:', error);
      throw error;
    }
  },

  /**
   * Get featured auctions for discovery screen
   */
  async getFeaturedAuctions(): Promise<{ auctions: AuctionWithDetails[]; total: number }> {
    try {
      const response = await api.get('/auctions/featured');
      return response.data;
    } catch (error) {
      console.error('Error fetching featured auctions:', error);
      throw error;
    }
  },

  /**
   * Get auctions ending soon
   */
  async getAuctionsEndingSoon(): Promise<{ auctions: AuctionWithDetails[]; total: number }> {
    try {
      const response = await api.get('/auctions/ending-soon');
      return response.data;
    } catch (error) {
      console.error('Error fetching ending soon auctions:', error);
      throw error;
    }
  },

  /**
   * Get auctions by category
   */
  async getAuctionsByCategory(categorySlug: string, filters: AuctionFilters = {}): Promise<{ auctions: AuctionWithDetails[]; total: number }> {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/auctions/category/${categorySlug}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching auctions by category:', error);
      throw error;
    }
  },

  /**
   * Get single auction details
   */
  async getAuction(id: string): Promise<AuctionWithDetails> {
    try {
      const response = await api.get(`/auctions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching auction:', error);
      throw error;
    }
  },

  /**
   * Get bid history for an auction
   */
  async getBidHistory(auctionId: string, limit = 50): Promise<PublicBidHistoryItem[]> {
    try {
      const response = await api.get(`/auctions/${auctionId}/bids?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching bid history:', error);
      throw error;
    }
  },

  /**
   * Create a new auction (sellers only)
   */
  async createAuction(auctionData: CreateAuctionData): Promise<Auction> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post('/auctions', auctionData);
      return response.data;
    } catch (error) {
      console.error('Error creating auction:', error);
      throw error;
    }
  },

  /**
   * Create a new auction with image uploads (sellers only)
   */
  async createAuctionWithImages(formData: FormData): Promise<Auction> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post('/auctions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating auction with images:', error);
      throw error;
    }
  },

  /**
   * Place a bid on an auction
   */
  async placeBid(bidData: PlaceBidData): Promise<AuctionBid> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post('/auctions/bid', bidData);
      return response.data;
    } catch (error) {
      console.error('Error placing bid:', error);

      // Show user-friendly error messages
      if ((error as any).response?.status === 400) {
        const message = (error as any).response.data?.message || 'Invalid bid amount';

        // Handle specific wallet-related errors
        if (message.includes('Insufficient wallet balance')) {
          Alert.alert(
            'Insufficient Balance',
            'You don\'t have enough Freti in your wallet to place this bid. Please add funds to your wallet.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Add Funds', onPress: () => {
                // Navigate to wallet screen - this would need navigation context
                console.log('Navigate to wallet deposit');
              }}
            ]
          );
        } else {
          Alert.alert('Bid Error', message);
        }
      } else if ((error as any).response?.status === 401) {
        Alert.alert('Authentication Error', 'Please log in to place bids');
      } else {
        Alert.alert('Error', 'Failed to place bid. Please try again.');
      }

      throw error;
    }
  },

  /**
   * Add/remove auction from watchlist
   */
  async toggleWatchlist(auctionId: string, notificationEnabled = true): Promise<{ watched: boolean }> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post('/auctions/watchlist', {
        auction_id: auctionId,
        notification_enabled: notificationEnabled,
      });
      return response.data;
    } catch (error) {
      console.error('Error toggling watchlist:', error);
      throw error;
    }
  },

  /**
   * Get user's watchlist
   */
  async getUserWatchlist(limit = 50): Promise<AuctionWithDetails[]> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.get(`/auctions/user/watchlist?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      throw error;
    }
  },

  /**
   * Get user's auctions (as seller)
   */
  async getMyAuctions(filters: AuctionFilters = {}): Promise<{ auctions: AuctionWithDetails[]; total: number }> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/auctions/user/my-auctions?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching my auctions:', error);
      throw error;
    }
  },

  /**
   * Format time remaining for display
   */
  formatTimeRemaining(secondsRemaining?: number): string {
    if (!secondsRemaining || secondsRemaining <= 0) {
      return 'Ended';
    }

    const days = Math.floor(secondsRemaining / (24 * 60 * 60));
    const hours = Math.floor((secondsRemaining % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((secondsRemaining % (60 * 60)) / 60);
    const seconds = Math.floor(secondsRemaining % 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  },

  /**
   * Format price for display
   */
  formatPrice(amount: number): string {
    return `${amount.toFixed(2)} Freti`;
  },

  /**
   * Get status badge color
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return '#27AE60';
      case 'ending_soon':
        return '#F39C12';
      case 'ended':
        return '#95A5A6';
      case 'sold':
        return '#8E44AD';
      case 'cancelled':
        return '#E74C3C';
      default:
        return '#3498DB';
    }
  },

  /**
   * Complete auction sale (mark as sold and process payment)
   */
  async completeSale(auctionId: string): Promise<any> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post(`/auctions/${auctionId}/complete-sale`);
      return response.data;
    } catch (error) {
      console.error('Error completing auction sale:', error);
      throw error;
    }
  },
};

/**
 * Auction WebSocket Manager
 * Handles real-time auction updates via WebSocket
 */
class AuctionSocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private currentAuctionId: string | null = null;

  /**
   * Connect to auction WebSocket
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('Already connected to auction WebSocket');
      return;
    }

    try {
      const token = await SecureStore.getItemAsync('accessToken');

      this.socket = io(`${API_URL}/auctions`, {
        transports: ['websocket'],
        auth: {
          token: token || '',
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to auction WebSocket');
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from auction WebSocket');
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('Auction WebSocket connection error:', error);
      });

      this.socket.on('error', (error: any) => {
        console.error('Auction WebSocket error:', error);
      });

      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to connect to auction WebSocket:', error);
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connection_established', (data: any) => {
      console.log('Auction connection established:', data);
      this.emit('connection_established', data);
    });

    // Auction events
    this.socket.on('auction_joined', (data: any) => {
      console.log('Joined auction:', data);
      this.emit('auction_joined', data);
    });

    this.socket.on('auction_left', (data: any) => {
      console.log('Left auction:', data);
      this.emit('auction_left', data);
    });

    // Bidding events
    this.socket.on('bid_placed', (data: any) => {
      console.log('New bid placed:', data);
      this.emit('bid_placed', data);
    });

    this.socket.on('bid_confirmed', (data: any) => {
      console.log('Bid confirmed:', data);
      this.emit('bid_confirmed', data);
    });

    this.socket.on('bid_error', (data: any) => {
      console.error('Bid error:', data);
      this.emit('bid_error', data);
      Alert.alert('Bid Error', data.message || 'Failed to place bid');
    });

    // Auctioneer events
    this.socket.on('auctioneer_speaks', (data: any) => {
      console.log('Auctioneer speaks:', data);
      this.emit('auctioneer_speaks', data);
    });

    // Status events
    this.socket.on('auction_status_changed', (data: any) => {
      console.log('Auction status changed:', data);
      this.emit('auction_status_changed', data);
    });

    this.socket.on('auction_ending_soon', (data: any) => {
      console.log('Auction ending soon:', data);
      this.emit('auction_ending_soon', data);
    });

    // User notifications
    this.socket.on('user_notification', (data: any) => {
      console.log('User notification:', data);
      this.emit('user_notification', data);

      // Show alert for important notifications
      if (data.type === 'outbid') {
        Alert.alert('Outbid!', data.message);
      } else if (data.type === 'auction_won') {
        Alert.alert(data.title || 'Congratulations!', data.message);
      }
    });

    // Viewer events
    this.socket.on('viewer_joined', (data: any) => {
      this.emit('viewer_joined', data);
    });

    this.socket.on('viewer_left', (data: any) => {
      this.emit('viewer_left', data);
    });
  }

  /**
   * Join an auction room
   */
  async joinAuction(auctionId: string, userId?: string): Promise<void> {
    if (!this.socket?.connected) {
      await this.connect();
    }

    this.currentAuctionId = auctionId;

    this.socket?.emit('join_auction', {
      auction_id: auctionId,
      user_id: userId,
    });
  }

  /**
   * Leave an auction room
   */
  leaveAuction(auctionId?: string): void {
    const targetAuctionId = auctionId || this.currentAuctionId;

    if (!targetAuctionId) return;

    if (this.currentAuctionId === targetAuctionId) {
      this.currentAuctionId = null;
    }

    this.socket?.emit('leave_auction', {
      auction_id: targetAuctionId,
    });
  }

  /**
   * Place a bid via WebSocket (real-time)
   */
  placeBid(auctionId: string, amount: number, bidType: 'manual' | 'proxy' = 'manual'): void {
    if (!this.socket?.connected) {
      console.error('Not connected to auction WebSocket');
      Alert.alert('Connection Error', 'Not connected to auction server. Please refresh.');
      return;
    }

    this.socket.emit('place_bid', {
      auction_id: auctionId,
      amount,
      bid_type: bidType,
    });
  }

  /**
   * Send auctioneer event (host only)
   */
  sendAuctioneerEvent(
    auctionId: string,
    eventType: 'going_once' | 'going_twice' | 'sold' | 'new_bid' | 'no_sale',
    message?: string
  ): void {
    if (!this.socket?.connected) {
      console.error('Not connected to auction WebSocket');
      return;
    }

    this.socket.emit('auctioneer_event', {
      auction_id: auctionId,
      event_type: eventType,
      message,
    });
  }

  /**
   * Subscribe to auction events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * Unsubscribe from auction events
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Unsubscribe all callbacks for an event
   */
  offAll(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in auction event listener (${event}):`, error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.currentAuctionId) {
      this.leaveAuction(this.currentAuctionId);
    }
    this.socket?.disconnect();
    this.socket = null;
    this.listeners.clear();
    console.log('Disconnected from auction WebSocket');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get current auction ID
   */
  getCurrentAuctionId(): string | null {
    return this.currentAuctionId;
  }

  /**
   * Update auction (Vendor only, before it starts or with no bids)
   */
  async updateAuction(
    auctionId: string,
    updateData: Partial<CreateAuctionData>,
  ): Promise<Auction> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${API_URL}/auctions/${auctionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update auction');
    }

    const data = await response.json();
    console.log('Auction updated successfully:', auctionId);
    return data;
  }

  /**
   * Cancel auction (Vendor only)
   */
  async cancelAuction(auctionId: string, reason?: string): Promise<{ message: string }> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${API_URL}/auctions/${auctionId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to cancel auction');
    }

    const data = await response.json();
    console.log('Auction cancelled successfully:', auctionId);
    return data;
  }
}

// Singleton instance
export const auctionSocket = new AuctionSocketManager();