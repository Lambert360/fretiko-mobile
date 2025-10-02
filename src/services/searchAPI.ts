import { api } from './api';
import { API_CONFIG } from '../config/api';

// Types for search
export enum SearchType {
  ALL = 'all',
  PRODUCTS = 'products',
  SERVICES = 'services',
  PEOPLE = 'people',
  PROVIDERS = 'providers',
}

export interface SearchQuery {
  query?: string;
  type?: SearchType;
  category?: string;
  location?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'popular';
  page?: number;
  limit?: number;
}

// Result item interfaces
export interface UserResult {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  location?: string;
  trustScore?: number;
  isOnline?: boolean;
  mutualConnections?: number;
}

export interface RiderResult {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  vehicleType: string;
  totalDeliveries: number;
  isOnline: boolean;
  distance?: number;
  specialties?: string[];
  completionRate?: number;
  avgDeliveryTime?: number;
  verified?: boolean;
  recentActivity?: string;
  mediaAspectRatio?: string;
  customerSatisfaction?: number;
}

export interface SearchResult {
  query?: string;
  type: SearchType;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  results: {
    products: any[];
    services: any[];
    people: UserResult[];
    providers: RiderResult[];
  };
  suggestions: string[];
}

export interface DiscoverContent {
  trending: Array<{
    query: string;
    count: number;
    category: string;
  }>;
  featured: {
    products: any[];
    services: any[];
    people: any[];
    providers: any[];
  };
  recommendations: {
    products: any[];
    services: any[];
    people: any[];
    providers: any[];
  };
  timestamp: string;
}

// Search API functions
export const searchAPI = {
  // Main search function
  search: async (searchQuery: SearchQuery): Promise<SearchResult> => {
    try {
      console.log('🔍 Searching with query:', searchQuery);
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.SEARCH, {
        params: {
          ...searchQuery,
          tags: searchQuery.tags?.join(','), // Convert array to comma-separated string
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Search failed:', error);
      throw new Error(error.response?.data?.message || 'Search failed');
    }
  },

  // Get trending searches
  getTrendingSearches: async (location?: string, limit: number = 10) => {
    try {
      console.log('🔥 Fetching trending searches');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.TRENDING, {
        params: { location, limit }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get trending searches:', error);
      throw new Error(error.response?.data?.message || 'Failed to get trending searches');
    }
  },

  // Get featured content
  getFeaturedContent: async (type?: SearchType, location?: string, limit: number = 10) => {
    try {
      console.log('⭐ Fetching featured content');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.FEATURED, {
        params: { type, location, limit }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get featured content:', error);
      throw new Error(error.response?.data?.message || 'Failed to get featured content');
    }
  },

  // Get search suggestions
  getSearchSuggestions: async (query: string, limit: number = 5) => {
    try {
      console.log('💡 Getting search suggestions for:', query);
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.SUGGESTIONS, {
        params: { query, limit }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get search suggestions, returning empty array:', error);
      // Return empty array instead of throwing error to prevent app crashes
      return [];
    }
  },

  // Get personalized recommendations (requires authentication)
  getPersonalizedRecommendations: async (type?: SearchType, limit: number = 10) => {
    try {
      console.log('🎯 Fetching personalized recommendations');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.RECOMMENDATIONS, {
        params: { type, limit }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get personalized recommendations:', error);
      throw new Error(error.response?.data?.message || 'Failed to get recommendations');
    }
  },

  // Get comprehensive discover content for SearchScreen
  getDiscoverContent: async (): Promise<DiscoverContent> => {
    try {
      console.log('🌟 Fetching discover content');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.DISCOVER);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get discover content, using fallback data:', error);
      // Return fallback data instead of throwing error
      return {
        trending: [
          { query: 'iPhone 15', count: 1250, category: 'Electronics' },
          { query: 'Web Development', count: 890, category: 'Services' },
          { query: 'Fashion Lagos', count: 567, category: 'Fashion' },
        ],
        featured: {
          products: [],
          services: [],
          people: [],
          providers: [],
        },
        recommendations: {
          products: [],
          services: [],
          people: [],
          providers: [],
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  // Get popular searches
  getPopularSearches: async (limit: number = 10) => {
    try {
      console.log('🔥 Fetching popular searches');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.POPULAR, {
        params: { limit }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get popular searches:', error);
      throw new Error(error.response?.data?.message || 'Failed to get popular searches');
    }
  },

  // Get search categories for filters
  getSearchCategories: async () => {
    try {
      console.log('📂 Fetching search categories');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.CATEGORIES);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get search categories:', error);
      throw new Error(error.response?.data?.message || 'Failed to get search categories');
    }
  },

  // Get filters for search type
  getSearchFilters: async (type: SearchType) => {
    try {
      console.log('🔧 Fetching search filters for:', type);
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.FILTERS, {
        params: { type }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get search filters:', error);
      throw new Error(error.response?.data?.message || 'Failed to get search filters');
    }
  },

  // Specific search functions
  searchProducts: async (searchQuery: Omit<SearchQuery, 'type'>) => {
    try {
      console.log('📦 Searching products');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.PRODUCTS, {
        params: {
          ...searchQuery,
          tags: searchQuery.tags?.join(','),
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Product search failed:', error);
      throw new Error(error.response?.data?.message || 'Product search failed');
    }
  },

  searchServices: async (searchQuery: Omit<SearchQuery, 'type'>) => {
    try {
      console.log('🛠️ Searching services');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.SERVICES, {
        params: {
          ...searchQuery,
          tags: searchQuery.tags?.join(','),
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Service search failed:', error);
      throw new Error(error.response?.data?.message || 'Service search failed');
    }
  },

  searchPeople: async (searchQuery: Omit<SearchQuery, 'type'>) => {
    try {
      console.log('👥 Searching people');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.PEOPLE, {
        params: {
          ...searchQuery,
          tags: searchQuery.tags?.join(','),
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ People search failed:', error);
      throw new Error(error.response?.data?.message || 'People search failed');
    }
  },

  searchProviders: async (searchQuery: Omit<SearchQuery, 'type'>) => {
    try {
      console.log('🚚 Searching providers');
      const response = await api.get(API_CONFIG.ENDPOINTS.SEARCH.PROVIDERS, {
        params: {
          ...searchQuery,
          tags: searchQuery.tags?.join(','),
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Provider search failed:', error);
      throw new Error(error.response?.data?.message || 'Provider search failed');
    }
  },
};

// Export for backward compatibility
export default searchAPI;