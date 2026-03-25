import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '../config/api';

// Retry utility for network resilience
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (error?.response?.status && error.response.status >= 400 && error.response.status < 500) {
        throw error; // Client errors shouldn't be retried
      }

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`🔄 Retrying API call (attempt ${attempt + 2}/${maxRetries + 1}) after ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  async (config) => {
    try {
      // Expo SDK 54 compatibility: Check if SecureStore is available
      if (SecureStore.isAvailableAsync && !(await SecureStore.isAvailableAsync())) {
        console.log('⚠️ SecureStore not available on this platform');
        return config;
      }

      // Get the access token from secure storage with error handling
      let accessToken = null;
      try {
        accessToken = await SecureStore.getItemAsync('accessToken');
      } catch (secureStoreError: any) {
        console.log('⚠️ SecureStore error (common in Expo SDK 54):', secureStoreError.message);

        // Fallback to AsyncStorage for development
        const fallbackToken = await AsyncStorage.getItem('accessToken_fallback');
        if (fallbackToken) {
          console.log('📦 Using fallback token from AsyncStorage');
          accessToken = fallbackToken;
        }
      }

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      } else {
        console.log('⚠️ No access token found for API request - can\'t log in or create a new account.');

        // For debugging: Check if we're in development
        if (__DEV__) {
          console.log('🔍 Debug: Checking backend connectivity...');
          console.log('🔍 Backend URL:', config.baseURL);
        }
      }
    } catch (error) {
      console.error('❌ Error getting access token:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors here
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - is your backend running?');
    } else if (error.message === 'Network Error') {
      console.error('Network error - check your backend URL and connection');
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  // Sign up a new user
  signup: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    hasAcceptedTerms?: boolean;
    user_role?: string;
    is_seller?: boolean;
    is_rider?: boolean;
    is_verified?: boolean;
  }) => {
    try {
      // Use fetch instead of axios for local HTTP requests in React Native Expo
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Signup failed');
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
    }
  },

  // Sign in existing user
  signin: async (credentials: { email: string; password: string }) => {
    try {
      // Use fetch directly instead of axios to avoid token interceptor issues
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      console.log('🔍 Frontend Signin Response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ Frontend Signin Error:', errorData);
        throw new Error(errorData.message || 'Signin failed');
      }

      const responseData = await response.json();
      console.log('✅ Frontend Signin Success:', responseData);
      return responseData;
    } catch (error: any) {
      console.log('❌ Frontend Signin Exception:', error);
      throw new Error(error.message || 'Signin failed');
    }
  },

  // Migrate legacy account
  migrate: async (migrationData: { email: string; newPassword: string }) => {
    try {
      const response = await api.post('/auth/migrate', migrationData);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Migration failed');
    }
  },

  // Reset password
  resetPassword: async (email: string) => {
    try {
      const response = await api.post('/auth/reset-password', { email });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset failed');
    }
  },

  // Verify reset token
  verifyResetToken: async (email: string, token: string) => {
    try {
      const response = await api.post('/auth/verify-reset-token', { email, token });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Token verification failed');
    }
  },

  // Confirm password reset with token
  confirmResetPassword: async (email: string, token: string, newPassword: string) => {
    try {
      const response = await api.post('/auth/confirm-reset-password', { 
        email, 
        token, 
        newPassword 
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset confirmation failed');
    }
  },
};

// Test connection to backend
export const testConnection = async () => {
  try {
    const response = await api.get('/');
    console.log('✅ Backend connection successful');
    return true;
  } catch (error) {
    console.error('❌ Backend connection failed:', error);
    return false;
  }
};