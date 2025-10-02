import { api } from './api';

// Interfaces for Iko search functionality
export interface IkoSearchProductsRequest {
  query: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  page?: number;
  tags?: string[];
}

export interface IkoSearchServicesRequest {
  query: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  duration?: string;
  limit?: number;
  page?: number;
}

export interface IkoSearchUsersRequest {
  query: string;
  location?: string;
  userType?: 'seller' | 'rider' | 'buyer' | 'all';
  limit?: number;
  page?: number;
}

export interface IkoRecommendationsRequest {
  type: 'products' | 'services' | 'mixed';
  category?: string;
  context?: 'budget_friendly' | 'premium' | 'trending' | 'popular';
  limit?: number;
}

export interface IkoQuickSearchRequest {
  query: string;
  type?: 'products' | 'services' | 'users' | 'all';
}

export interface IkoSearchResult {
  query: string;
  type: 'products' | 'services' | 'users';
  results: any[];
  count: number;
  hasMore: boolean;
  suggestions?: string[];
  userContext?: {
    preferredCategories?: string[];
    budgetRange?: number;
    locationPreference?: string;
  };
}

export interface IkoRecommendationResult {
  type: 'products' | 'services' | 'mixed';
  recommendations: any[];
  reason: string;
  userContext: {
    preferredCategories: string[];
    recentSearches: string[];
    budgetRanges: { [category: string]: number };
  };
}

export interface IkoProductResult {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  category: string;
  seller: {
    id: string;
    name: string;
    rating: number;
  };
  images: string[];
  rating: number;
  reviewCount: number;
  availability: string;
  location: string;
  tags: string[];
  isRecommended: boolean;
}

export interface IkoServiceResult {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  category: string;
  provider: {
    id: string;
    name: string;
    rating: number;
    completedJobs: number;
  };
  images: string[];
  rating: number;
  reviewCount: number;
  availability: string;
  location: string;
  tags: string[];
  isRecommended: boolean;
}

export interface IkoUserResult {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatar: string;
  location: string;
  isSeller: boolean;
  isRider: boolean;
  rating: number;
  connectionStatus: 'connected' | 'pending' | 'not_connected';
  mutualConnections: number;
}

// Function calling schemas that match the backend
export const IkoSearchFunctionSchemas = {
  searchProducts: {
    name: 'search_products',
    description: 'Search for products on the platform. Use this when users ask about buying, finding, or looking for physical items.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for products (e.g., "iPhone 15", "gaming laptop", "red dress")',
        },
        category: {
          type: 'string',
          description: 'Product category (e.g., "electronics", "fashion", "home")',
        },
        location: {
          type: 'string',
          description: 'Location preference for search (e.g., "nearby", "Lagos", "Abuja")',
        },
        minPrice: {
          type: 'number',
          description: 'Minimum price filter in Naira',
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum price filter in Naira',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (1-50, default: 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  searchServices: {
    name: 'search_services',
    description: 'Search for services on the platform. Use this when users ask about booking, hiring, or finding service providers.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for services (e.g., "hair styling", "web development", "house cleaning")',
        },
        category: {
          type: 'string',
          description: 'Service category (e.g., "beauty", "tech", "cleaning", "repair")',
        },
        location: {
          type: 'string',
          description: 'Location preference for search (e.g., "nearby", "Lagos", "Abuja")',
        },
        minPrice: {
          type: 'number',
          description: 'Minimum price filter in Naira',
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum price filter in Naira',
        },
        duration: {
          type: 'string',
          description: 'Expected duration (e.g., "1 hour", "2-3 hours", "1 day")',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (1-50, default: 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  searchUsers: {
    name: 'search_users',
    description: 'Search for users on the platform. Use this when users want to find people, sellers, or service providers.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for users (e.g., username, name, business name)',
        },
        location: {
          type: 'string',
          description: 'Location preference for search',
        },
        userType: {
          type: 'string',
          enum: ['seller', 'rider', 'buyer', 'all'],
          description: 'Type of user to search for',
          default: 'all',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (1-50, default: 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  getRecommendations: {
    name: 'get_recommendations',
    description: 'Get personalized recommendations based on user preferences and behavior.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['products', 'services', 'mixed'],
          description: 'Type of recommendations to get',
        },
        category: {
          type: 'string',
          description: 'Specific category for recommendations',
        },
        context: {
          type: 'string',
          enum: ['budget_friendly', 'premium', 'trending', 'popular'],
          description: 'Context for recommendations',
        },
        limit: {
          type: 'number',
          description: 'Number of recommendations to return (1-20, default: 10)',
          default: 10,
        },
      },
      required: ['type'],
    },
  },

  // Business Logic Functions
  bookService: {
    name: 'book_service',
    description: 'Book a service appointment with a provider. Use when users want to schedule or book services.',
    parameters: {
      type: 'object',
      properties: {
        serviceId: {
          type: 'string',
          description: 'ID of the service to book',
        },
        timeSlot: {
          type: 'string',
          description: 'Preferred time slot in ISO format (e.g., "2024-01-15T14:00:00Z")',
        },
        duration: {
          type: 'number',
          description: 'Expected duration in hours (optional)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or requirements for the service',
        },
        paymentMethodId: {
          type: 'string',
          description: 'Payment method ID (optional, will use default if not provided)',
        },
      },
      required: ['serviceId', 'timeSlot'],
    },
  },

  purchaseProduct: {
    name: 'purchase_product',
    description: 'Purchase a product from the platform. Use when users want to buy items.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'ID of the product to purchase',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to purchase',
          default: 1,
        },
        paymentMethodId: {
          type: 'string',
          description: 'Payment method ID (optional, will use default if not provided)',
        },
        deliveryAddress: {
          type: 'string',
          description: 'Delivery address (optional, will use default if not provided)',
        },
        notes: {
          type: 'string',
          description: 'Special instructions for the order',
        },
      },
      required: ['productId'],
    },
  },

  checkAvailability: {
    name: 'check_availability',
    description: 'Check availability for services or products. Use when users ask about availability or scheduling.',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'ID of the service or product to check',
        },
        itemType: {
          type: 'string',
          enum: ['service', 'product'],
          description: 'Type of item to check availability for',
        },
        date: {
          type: 'string',
          description: 'Date to check availability (ISO format)',
        },
        duration: {
          type: 'number',
          description: 'Required duration in hours (for services)',
        },
      },
      required: ['itemId', 'itemType'],
    },
  },

  createActivityPlan: {
    name: 'create_activity_plan',
    description: 'Create a personalized activity plan based on user preferences and budget.',
    parameters: {
      type: 'object',
      properties: {
        activity: {
          type: 'string',
          description: 'Type of activity to plan (e.g., "birthday party", "date night", "team building")',
        },
        budget: {
          type: 'number',
          description: 'Budget for the activity in Naira',
        },
        targetDate: {
          type: 'string',
          description: 'Target date for the activity (ISO format)',
        },
        participants: {
          type: 'number',
          description: 'Number of participants',
          default: 1,
        },
        preferences: {
          type: 'object',
          description: 'User preferences for the activity',
          properties: {
            location: { type: 'string' },
            style: { type: 'string' },
            duration: { type: 'string' },
          },
        },
        notes: {
          type: 'string',
          description: 'Additional requirements or notes',
        },
      },
      required: ['activity', 'budget'],
    },
  },

  setBudgetAlert: {
    name: 'set_budget_alert',
    description: 'Set up budget alerts and monitoring for spending categories.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Spending category (e.g., "food", "transportation", "entertainment")',
        },
        amount: {
          type: 'number',
          description: 'Budget limit in Naira',
        },
        period: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Budget period',
          default: 'monthly',
        },
        alertThreshold: {
          type: 'number',
          description: 'Percentage at which to send alert (e.g., 80 for 80%)',
          default: 80,
        },
      },
      required: ['category', 'amount'],
    },
  },

  getProductDetails: {
    name: 'get_product_details',
    description: 'Get detailed information about a specific product.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'ID of the product to get details for',
        },
        includeReviews: {
          type: 'boolean',
          description: 'Whether to include customer reviews',
          default: true,
        },
        includeSimilar: {
          type: 'boolean',
          description: 'Whether to include similar products',
          default: true,
        },
      },
      required: ['productId'],
    },
  },

  getServiceDetails: {
    name: 'get_service_details',
    description: 'Get detailed information about a specific service.',
    parameters: {
      type: 'object',
      properties: {
        serviceId: {
          type: 'string',
          description: 'ID of the service to get details for',
        },
        includeReviews: {
          type: 'boolean',
          description: 'Whether to include customer reviews',
          default: true,
        },
        includeAvailability: {
          type: 'boolean',
          description: 'Whether to include current availability',
          default: true,
        },
      },
      required: ['serviceId'],
    },
  },

  trackOrder: {
    name: 'track_order',
    description: 'Track the status of an order or booking.',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'ID of the order to track',
        },
        orderType: {
          type: 'string',
          enum: ['product', 'service'],
          description: 'Type of order to track',
        },
      },
      required: ['orderId'],
    },
  },
};

class IkoSearchAPI {
  private token: string | null = null;

  setAuthToken(token: string) {
    this.token = token;
  }

  /**
   * Search products through Iko
   */
  async searchProducts(params: IkoSearchProductsRequest): Promise<IkoSearchResult> {
    try {
      const response = await api.post('/iko/search/products', params);
      return response.data;
    } catch (error) {
      console.error('Error searching products via Iko:', error);
      throw error;
    }
  }

  /**
   * Search services through Iko
   */
  async searchServices(params: IkoSearchServicesRequest): Promise<IkoSearchResult> {
    try {
      const response = await api.post('/iko/search/services', params);
      return response.data;
    } catch (error) {
      console.error('Error searching services via Iko:', error);
      throw error;
    }
  }

  /**
   * Search users through Iko
   */
  async searchUsers(params: IkoSearchUsersRequest): Promise<IkoSearchResult> {
    try {
      const response = await api.post('/iko/search/users', params);
      return response.data;
    } catch (error) {
      console.error('Error searching users via Iko:', error);
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(params: IkoRecommendationsRequest): Promise<IkoRecommendationResult> {
    try {
      const response = await api.post('/iko/search/recommendations', params);
      return response.data;
    } catch (error) {
      console.error('Error getting Iko recommendations:', error);
      throw error;
    }
  }

  /**
   * Quick search across all categories
   */
  async quickSearch(params: IkoQuickSearchRequest): Promise<{
    products: IkoProductResult[];
    services: IkoServiceResult[];
    users: IkoUserResult[];
    suggestions: string[];
  }> {
    try {
      const response = await api.post('/iko/search/quick', params);
      return response.data;
    } catch (error) {
      console.error('Error in Iko quick search:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSearchSuggestions(type?: 'products' | 'services' | 'users'): Promise<{
    suggestions: string[];
    trending: string[];
    personalized: string[];
  }> {
    try {
      const response = await api.get('/iko/search/suggestions', {
        params: type ? { type } : undefined,
      });
      return response.data;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return {
        suggestions: [],
        trending: [],
        personalized: [],
      };
    }
  }

  /**
   * Get function calling schemas for Gemini AI
   */
  async getFunctionSchemas(): Promise<{ schemas: typeof IkoSearchFunctionSchemas }> {
    try {
      const response = await api.get('/iko/search/schemas');
      return response.data;
    } catch (error) {
      console.error('Error getting function schemas:', error);
      return { schemas: IkoSearchFunctionSchemas }; // Return local schemas as fallback
    }
  }

  /**
   * Book a service
   */
  async bookService(params: {
    serviceId: string;
    timeSlot: string;
    duration?: number;
    notes?: string;
    paymentMethodId?: string;
  }): Promise<{
    bookingId: string;
    status: string;
    message: string;
    details: any;
  }> {
    try {
      const response = await api.post('/iko/business/book-service', params);
      return response.data;
    } catch (error) {
      console.error('Error booking service:', error);
      throw error;
    }
  }

  /**
   * Purchase a product
   */
  async purchaseProduct(params: {
    productId: string;
    quantity?: number;
    paymentMethodId?: string;
    deliveryAddress?: string;
    notes?: string;
  }): Promise<{
    orderId: string;
    status: string;
    message: string;
    totalAmount: number;
    details: any;
  }> {
    try {
      const response = await api.post('/iko/business/purchase-product', params);
      return response.data;
    } catch (error) {
      console.error('Error purchasing product:', error);
      throw error;
    }
  }

  /**
   * Check availability for services or products
   */
  async checkAvailability(params: {
    itemId: string;
    itemType: 'service' | 'product';
    date?: string;
    duration?: number;
  }): Promise<{
    available: boolean;
    availableSlots?: string[];
    stockCount?: number;
    message: string;
  }> {
    try {
      const response = await api.post('/iko/business/check-availability', params);
      return response.data;
    } catch (error) {
      console.error('Error checking availability:', error);
      throw error;
    }
  }

  /**
   * Create activity plan
   */
  async createActivityPlan(params: {
    activity: string;
    budget: number;
    targetDate?: string;
    participants?: number;
    preferences?: object;
    notes?: string;
  }): Promise<{
    planId: string;
    title: string;
    activities: any[];
    totalEstimatedCost: number;
    timeline: any[];
    recommendations: any[];
  }> {
    try {
      const response = await api.post('/iko/business/create-activity-plan', params);
      return response.data;
    } catch (error) {
      console.error('Error creating activity plan:', error);
      throw error;
    }
  }

  /**
   * Set budget alert
   */
  async setBudgetAlert(params: {
    category: string;
    amount: number;
    period?: 'daily' | 'weekly' | 'monthly';
    alertThreshold?: number;
  }): Promise<{
    alertId: string;
    status: string;
    message: string;
  }> {
    try {
      const response = await api.post('/iko/business/set-budget-alert', params);
      return response.data;
    } catch (error) {
      console.error('Error setting budget alert:', error);
      throw error;
    }
  }

  /**
   * Get detailed product information
   */
  async getProductDetails(params: {
    productId: string;
    includeReviews?: boolean;
    includeSimilar?: boolean;
  }): Promise<{
    product: any;
    reviews?: any[];
    similarProducts?: any[];
    availability: any;
  }> {
    try {
      const response = await api.post('/iko/business/get-product-details', params);
      return response.data;
    } catch (error) {
      console.error('Error getting product details:', error);
      throw error;
    }
  }

  /**
   * Get detailed service information
   */
  async getServiceDetails(params: {
    serviceId: string;
    includeReviews?: boolean;
    includeAvailability?: boolean;
  }): Promise<{
    service: any;
    reviews?: any[];
    availability?: any;
    provider: any;
  }> {
    try {
      const response = await api.post('/iko/business/get-service-details', params);
      return response.data;
    } catch (error) {
      console.error('Error getting service details:', error);
      throw error;
    }
  }

  /**
   * Track order status
   */
  async trackOrder(params: {
    orderId: string;
    orderType?: 'product' | 'service';
  }): Promise<{
    order: any;
    status: string;
    timeline: any[];
    estimatedDelivery?: string;
    trackingInfo?: any;
  }> {
    try {
      const response = await api.post('/iko/business/track-order', params);
      return response.data;
    } catch (error) {
      console.error('Error tracking order:', error);
      throw error;
    }
  }

  /**
   * Helper: Execute function call from Gemini AI
   */
  async executeFunctionCall(functionName: string, parameters: any): Promise<any> {
    try {
      switch (functionName) {
        case 'search_products':
          return await this.searchProducts(parameters);
        case 'search_services':
          return await this.searchServices(parameters);
        case 'search_users':
          return await this.searchUsers(parameters);
        case 'get_recommendations':
          return await this.getRecommendations(parameters);
        case 'book_service':
          return await this.bookService(parameters);
        case 'purchase_product':
          return await this.purchaseProduct(parameters);
        case 'check_availability':
          return await this.checkAvailability(parameters);
        case 'create_activity_plan':
          return await this.createActivityPlan(parameters);
        case 'set_budget_alert':
          return await this.setBudgetAlert(parameters);
        case 'get_product_details':
          return await this.getProductDetails(parameters);
        case 'get_service_details':
          return await this.getServiceDetails(parameters);
        case 'track_order':
          return await this.trackOrder(parameters);
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Format search results for AI response
   */
  formatResultsForAI(results: IkoSearchResult): string {
    if (results.count === 0) {
      return `No ${results.type} found for "${results.query}". ${results.suggestions ? `Try searching for: ${results.suggestions.join(', ')}` : ''}`;
    }

    const resultTexts = results.results.slice(0, 5).map((item, index) => {
      if (results.type === 'products') {
        const product = item as IkoProductResult;
        return `${index + 1}. ${product.title} - ₦${product.price.toLocaleString()} by ${product.seller.name} (${product.rating}⭐)`;
      } else if (results.type === 'services') {
        const service = item as IkoServiceResult;
        return `${index + 1}. ${service.title} - ₦${service.price.toLocaleString()} by ${service.provider.name} (${service.rating}⭐)`;
      } else {
        const user = item as IkoUserResult;
        return `${index + 1}. ${user.displayName} (@${user.username}) - ${user.bio}`;
      }
    });

    return `Found ${results.count} ${results.type}:\n${resultTexts.join('\n')}${results.hasMore ? `\n\nShowing first ${results.results.length} results. There are more available.` : ''}`;
  }
}

export const ikoSearchAPI = new IkoSearchAPI();