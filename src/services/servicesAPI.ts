import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface Service {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  description: string;
  base_price: number;
  duration?: string;
  images: string[];
  videos: string[];
  primary_media_url?: string;
  media_type: 'image' | 'video';
  location?: string;
  service_area?: string;
  availability: {
    weekdays: boolean;
    weekends: boolean;
    evenings: boolean;
    emergency: boolean;
  };
  tags: string[];
  booking_type: 'add_to_cart' | 'book_now';
  status: string;
  is_featured: boolean;
  view_count: number;
  like_count: number;
  save_count: number;
  booking_count: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon_name?: string;
  color_hex?: string;
  sort_order: number;
  is_active: boolean;
}

export interface CreateServiceRequest {
  name: string;
  description: string;
  base_price: number;
  duration?: string;
  category_id: string;
  images: string[];
  videos: string[];
  location?: string;
  service_area?: string;
  availability: {
    weekdays: boolean;
    weekends: boolean;
    evenings: boolean;
    emergency: boolean;
  };
  tags: string[];
  booking_type?: 'add_to_cart' | 'book_now';
}

export interface VideoFeedItem {
  id: string;
  title: string;
  thumbnail?: string;
  videoUri?: string;
  userId: string;
  username: string;
  userAvatar: string;
  description: string;
  likes: string;
  comments: string;
  shares: string;
  price: number;
  originalPrice?: number;
  location: string;
  serviceProvider: string;
  rating: number;
  completedJobs: string;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export interface ServiceComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  comment: string;
  createdAt: string;
  likes: number;
}

export interface ServiceBooking {
  id: string;
  serviceId: string;
  providerId: string;
  date: string;
  time: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  totalAmount: number;
}

export interface CreateBookingRequest {
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
}

class ServicesAPI {
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private cache = new Map<string, { data: any; timestamp: number }>();
  private offlineQueue: Array<{ 
    method: string; 
    endpoint: string; 
    data?: any; 
    timestamp: number;
    retries: number;
  }> = [];
  private isProcessingQueue = false;

  // Cache management
  private async cacheGet(key: string): Promise<any> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    // Try AsyncStorage for persistent cache
    try {
      const stored = await AsyncStorage.getItem(`api_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < this.cacheTimeout) {
          this.cache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
    
    return null;
  }

  private async cacheSet(key: string, data: any): Promise<void> {
    const cacheItem = { data, timestamp: Date.now() };
    this.cache.set(key, cacheItem);
    
    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem(`api_cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  // Enhanced error handling
  private handleError(error: any, fallbackMessage: string, showAlert: boolean = false): never {
    let errorMessage = fallbackMessage;
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error(fallbackMessage, error);
    
    if (showAlert) {
      Alert.alert('Error', errorMessage);
    }
    
    throw new Error(errorMessage);
  }

  // Queue management for offline operations
  private async addToQueue(method: string, endpoint: string, data?: any): Promise<void> {
    this.offlineQueue.push({
      method,
      endpoint,
      data,
      timestamp: Date.now(),
      retries: 0
    });
    
    // Persist queue
    try {
      await AsyncStorage.setItem('api_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.warn('Failed to persist offline queue:', error);
    }
  }

  private async loadOfflineQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('api_offline_queue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
        console.log(`📤 Loaded ${this.offlineQueue.length} offline operations`);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
    }
  }

  async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`📤 Processing ${this.offlineQueue.length} offline operations`);

    const failedOperations: typeof this.offlineQueue = [];

    for (const operation of this.offlineQueue) {
      try {
        // Check if operation is too old (24 hours)
        if (Date.now() - operation.timestamp > 24 * 60 * 60 * 1000) {
          console.warn('⏰ Skipping expired offline operation:', operation);
          continue;
        }

        console.log(`🔄 Processing: ${operation.method} ${operation.endpoint}`);
        
        switch (operation.method) {
          case 'POST':
            await api.post(operation.endpoint, operation.data);
            break;
          case 'PUT':
            await api.put(operation.endpoint, operation.data);
            break;
          case 'DELETE':
            await api.delete(operation.endpoint);
            break;
          default:
            console.warn('Unsupported offline operation method:', operation.method);
        }

        console.log('✅ Offline operation completed:', operation.endpoint);
      } catch (error) {
        operation.retries++;
        if (operation.retries < 3) {
          failedOperations.push(operation);
          console.warn(`⚠️ Offline operation failed (retry ${operation.retries}/3):`, operation.endpoint);
        } else {
          console.error('❌ Offline operation permanently failed:', operation.endpoint);
        }
      }
    }

    this.offlineQueue = failedOperations;
    
    // Update persisted queue
    try {
      await AsyncStorage.setItem('api_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.warn('Failed to update offline queue:', error);
    }

    this.isProcessingQueue = false;
    console.log(`📤 Queue processing completed. ${this.offlineQueue.length} operations remaining.`);
  }

  // Initialize service (call this when app starts)
  async initialize(): Promise<void> {
    await this.loadOfflineQueue();
    
    // Process queue if online
    const health = await this.checkHealth();
    if (health.apiHealth) {
      this.processOfflineQueue();
    }
  }

  // Check network connectivity and API health
  async checkHealth(): Promise<{ online: boolean; apiHealth: boolean }> {
    try {
      const response = await api.get('/health', { timeout: 5000 });
      return {
        online: true,
        apiHealth: response.status === 200
      };
    } catch (error) {
      return {
        online: navigator.onLine,
        apiHealth: false
      };
    }
  }

  // Get all service categories with caching
  async getCategories(): Promise<ServiceCategory[]> {
    const cacheKey = 'service_categories';
    
    try {
      // Check cache first
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        console.log('📦 Using cached service categories');
        return cached;
      }

      console.log('🌐 Fetching service categories from API');
      const response = await api.get('/services/categories');
      await this.cacheSet(cacheKey, response.data);
      return response.data;
    } catch (error) {
      // Try to return cached data as fallback
      const fallbackData = await this.cacheGet(cacheKey);
      if (fallbackData) {
        console.log('🔄 Using stale cache as fallback for service categories');
        return fallbackData;
      }
      
      this.handleError(error, 'Error fetching service categories');
    }
  }

  // Create a new service
  async createService(serviceData: CreateServiceRequest): Promise<Service> {
    try {
      const response = await api.post('/services', serviceData);
      return response.data;
    } catch (error) {
      console.error('Error creating service:', error);
      throw error;
    }
  }

  // Get services by user
  async getMyServices(): Promise<Service[]> {
    try {
      const response = await api.get('/services/my-services');
      return response.data;
    } catch (error) {
      console.error('Error fetching my services:', error);
      throw error;
    }
  }

  // Get all active services (for browsing)
  async getServices(params?: {
    category_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Service[]> {
    try {
      const response = await api.get('/services', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching services:', error);
      throw error;
    }
  }

  // Get services by user ID (for viewing other users' services)
  async getUserServices(userId: string): Promise<Service[]> {
    try {
      console.log('🚚 ServicesAPI fetching services for user:', userId);
      const response = await api.get(`/services/user/${userId}`);
      console.log('🚚 ServicesAPI received', response.data.length, 'services');
      return response.data;
    } catch (error) {
      console.error('Error fetching user services:', error);
      throw error;
    }
  }

  // Get single service
  async getService(id: string): Promise<Service> {
    try {
      const response = await api.get(`/services/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching service:', error);
      throw error;
    }
  }

  // Update service
  async updateService(id: string, serviceData: Partial<CreateServiceRequest>): Promise<Service> {
    try {
      const response = await api.put(`/services/${id}`, serviceData);
      return response.data;
    } catch (error) {
      console.error('Error updating service:', error);
      throw error;
    }
  }

  // Delete service
  async deleteService(id: string): Promise<void> {
    try {
      await api.delete(`/services/${id}`);
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  }

  // Get video feed for services (TikTok-style) with caching and offline support
  async getVideoFeed(params?: {
    limit?: number;
    offset?: number;
    category?: string;
  }): Promise<VideoFeedItem[]> {
    const cacheKey = `video_feed_${JSON.stringify(params || {})}`;

    try {
      // TEMPORARILY DISABLE CACHE to force fresh API call
      // const cached = await this.cacheGet(cacheKey);
      // if (cached) {
      //   console.log('📦 Using cached video feed');
      //   return cached;
      // }

      console.log('🎥 Fetching video feed from API - CACHE DISABLED');
      
      // Use the dedicated video-feed endpoint
      const response = await api.get('/services/video-feed', { 
        params,
        timeout: 15000 // Increased timeout for video loading
      });
      
      // The backend already returns data in the correct VideoFeedItem format
      const videoFeedItems: VideoFeedItem[] = response.data;

      console.log('🎥 ServicesAPI received data:', videoFeedItems.length, 'items');
      console.log('🎥 First item from API:', JSON.stringify(videoFeedItems[0], null, 2));

      // Check if userId is missing and try to fix it
      const fixedVideoFeedItems = videoFeedItems.map((item, index) => {
        if (!item.userId) {
          console.log(`🔧 WARNING: Missing userId in video item ${index}:`, JSON.stringify(item, null, 2));
          console.log('🔧 Available fields:', Object.keys(item));
          // Try to get userId from user_id field if it exists
          const fixedUserId = (item as any).user_id || `missing-user-id-${index}`;
          console.log('🔧 Setting userId to:', fixedUserId);
          return { ...item, userId: fixedUserId };
        }
        return item;
      });

      console.log('🎥 After userId fix - First item:', JSON.stringify(fixedVideoFeedItems[0], null, 2));

      await this.cacheSet(cacheKey, fixedVideoFeedItems);
      return fixedVideoFeedItems;
    } catch (error) {
      console.warn('Video feed API failed, trying cache...', error.message);
      
      // Try cache as fallback
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        console.log('📦 Using stale cached video feed');
        return cached;
      }
      
      // No fallback to mock data - throw error for real database requirement
      throw new Error('Unable to fetch video feed from database');
    }
  }


  // Like/unlike a service with offline support
  async toggleLike(serviceId: string): Promise<{ liked: boolean; likeCount: number }> {
    try {
      const response = await api.post(`/services/${serviceId}/like`);
      
      // Clear any cached data for this service to ensure fresh data
      this.cache.delete(`service_${serviceId}`);
      this.cache.delete('video_feed_{}');
      
      return response.data;
    } catch (error) {
      console.warn('Like action failed, queuing for offline processing:', error.message);
      
      // Add to offline queue for later processing
      await this.addToQueue('POST', `/services/${serviceId}/like`);
      
      // Return optimistic response
      return {
        liked: true, // Assume like action (can be refined with local state)
        likeCount: 0  // Will be updated when synced
      };
    }
  }

  // Get service comments (always fresh, no cache)
  async getServiceComments(serviceId: string): Promise<ServiceComment[]> {
    try {
      console.log('🌐 Fetching fresh comments from API for service:', serviceId);
      const response = await api.get(`/services/${serviceId}/comments`);
      console.log('✅ Received', response.data?.length || 0, 'comments from API');
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching service comments:', error);
      throw error;
    }
  }

  // Add comment to service with offline support
  async addComment(serviceId: string, content: string): Promise<ServiceComment> {
    try {
      const response = await api.post(`/services/${serviceId}/comments`, { content });

      // Clear cached comments to force refresh
      this.cache.delete(`service_comments_${serviceId}`);
      this.cache.delete('video_feed_{}');

      console.log('✅ Comment added successfully:', response.data);
      return response.data;
    } catch (error) {
      console.warn('Comment failed, queuing for offline processing:', error.message);

      // Add to offline queue
      await this.addToQueue('POST', `/services/${serviceId}/comments`, { content });

      // Return optimistic comment
      return {
        id: `temp_${Date.now()}`,
        userId: 'current_user', // Should come from auth context
        userName: 'You',
        userAvatar: undefined,
        comment: content,
        createdAt: new Date().toISOString(),
        likes: 0,
      };
    }
  }

  // Rate a service
  async rateService(serviceId: string, rating: number, comment?: string): Promise<void> {
    try {
      await api.post(`/services/${serviceId}/rate`, { rating, comment });
    } catch (error) {
      console.error('Error rating service:', error);
      throw error;
    }
  }

  // Book a service
  async bookService(bookingData: CreateBookingRequest): Promise<ServiceBooking> {
    try {
      const response = await api.post('/services/book', bookingData);
      return response.data;
    } catch (error) {
      console.error('Error booking service:', error);
      throw error;
    }
  }

  // Get user's service bookings
  async getMyBookings(): Promise<ServiceBooking[]> {
    try {
      const response = await api.get('/services/my-bookings');
      return response.data;
    } catch (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }
  }

  // Toggle bookmark with offline support
  async toggleBookmark(serviceId: string): Promise<{ bookmarked: boolean; saveCount: number }> {
    try {
      const response = await api.post(`/services/${serviceId}/bookmark`);

      // Clear cached data
      this.cache.delete(`service_${serviceId}`);
      this.cache.delete('video_feed_{}');

      return response.data;
    } catch (error) {
      console.warn('Bookmark action failed, queuing for offline processing:', error.message);

      // Add to offline queue
      await this.addToQueue('POST', `/services/${serviceId}/bookmark`);

      // Return optimistic response
      return {
        bookmarked: true,
        saveCount: 0
      };
    }
  }

  // Share service
  async shareService(serviceId: string): Promise<{ shareCount: number }> {
    try {
      const response = await api.post(`/services/${serviceId}/share`);

      // Clear cached data
      this.cache.delete(`service_${serviceId}`);
      this.cache.delete('video_feed_{}');

      return response.data;
    } catch (error) {
      console.warn('Share action failed, queuing for offline processing:', error.message);

      // Add to offline queue
      await this.addToQueue('POST', `/services/${serviceId}/share`);

      // Return optimistic response
      return {
        shareCount: 0
      };
    }
  }
}

export const servicesAPI = new ServicesAPI();