// API Configuration for Fretiko Mobile App

// For Expo development:
// 1. Find your computer's IP address:
//    - Windows: run "ipconfig" in Command Prompt, look for "IPv4 Address"
//    - Mac/Linux: run "ifconfig" in Terminal, look for "inet" under your network interface
// 2. Replace "localhost" with your IP address below
// 3. Make sure your backend is running on the same network

export const API_CONFIG = {
  // Development configuration
  // Updated with your computer's IP address for Expo testing
  BASE_URL: 'http://192.168.43.135:3000', // Your computer's current IP address
  
  // Timeout settings - increased for better reliability
  TIMEOUT: 60000, // 60 seconds
  CALL_TIMEOUT: 90000, // 90 seconds for call-related operations
  
  // API endpoints
  ENDPOINTS: {
    AUTH: {
      SIGNUP: '/auth/signup',
      SIGNIN: '/auth/signin',
    },
    SEARCH: {
      SEARCH: '/search',
      TRENDING: '/search/trending',
      FEATURED: '/search/featured',
      SUGGESTIONS: '/search/suggestions',
      RECOMMENDATIONS: '/search/recommendations',
      DISCOVER: '/search/discover',
      POPULAR: '/search/popular',
      CATEGORIES: '/search/categories',
      FILTERS: '/search/filters',
      PRODUCTS: '/search/products',
      SERVICES: '/search/services',
      PEOPLE: '/search/people',
      PROVIDERS: '/search/providers',
    },
    PRODUCTS: '/products',
    SERVICES: '/services',
    USERS: '/users',
    RIDERS: '/riders',
    STORIES: '/stories',
    HEALTH: '/',
  },
};

// Helper function to get full endpoint URL
export const getEndpointUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Export API_BASE_URL for backwards compatibility
export const API_BASE_URL = API_CONFIG.BASE_URL;

// Network detection helper
export const testNetworkConnection = async () => {
  try {
    const response = await fetch(getEndpointUrl(API_CONFIG.ENDPOINTS.HEALTH), {
      method: 'GET',
      timeout: 5000,
    });
    return response.ok;
  } catch (error) {
    console.log('Network test failed:', error);
    return false;
  }
};