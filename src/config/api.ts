// API Configuration for Fretiko Mobile App
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// For Expo development:
// Automatically detects the correct backend URL based on environment
// - iOS Simulator: Uses localhost (127.0.0.1)
// - Android Emulator: Uses 10.0.2.2 (Android's special alias for host)
// - Physical Device/Expo Go: Uses your computer's LAN IP from Expo manifest

/**
 * Get the appropriate backend URL based on the runtime environment
 */
const getBackendUrl = (): string => {
  // Production URL (when deployed)
  // Uncomment and set this when deploying to production
  // if (!__DEV__) {
  //   return 'https://your-production-api.com';
  // }

  // Development: Auto-detect based on platform and environment
  const localhost = Platform.select({
    ios: 'localhost',      // iOS Simulator uses localhost
    android: '10.0.2.2',   // Android Emulator uses this special IP
    default: 'localhost'
  });

  // If running on Expo Go or physical device, try to get the host IP from Expo
  const expoHostUri = Constants.expoConfig?.hostUri;

  if (expoHostUri) {
    // Extract IP from Expo's host URI (e.g., "192.168.1.5:8081" -> "192.168.1.5")
    const host = expoHostUri.split(':')[0];
    console.log('📱 Detected Expo host IP:', host);
    return `http://${host}:3000`;
  }

  // Fallback to localhost/emulator IP
  console.log('💻 Using local environment:', localhost);
  return `http://${localhost}:3000`;
};

export const API_CONFIG = {
  // Development configuration - auto-detects correct URL
  BASE_URL: getBackendUrl(),

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(getEndpointUrl(API_CONFIG.ENDPOINTS.HEALTH), {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log('Network test failed:', error);
    return false;
  }
};