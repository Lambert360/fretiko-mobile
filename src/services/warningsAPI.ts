/**
 * FRETIKO MOBILE - WARNINGS API SERVICE
 * Handles all API calls related to user warnings and account status
 */

import { API_CONFIG } from '../config/api';

// ============================================
// TYPES
// ============================================

export type WarningSeverity = 'low' | 'medium' | 'high';

export interface Warning {
  id: string;
  severity: WarningSeverity;
  reason: string;
  relatedContentId?: string;
  relatedContentType?: 'product' | 'service' | 'chat' | 'user';
  createdAt: string;
  warnedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface WarningStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  lastWarningAt: string | null;
}

export interface AccountStatus {
  accountStatus: 'active' | 'suspended' | 'deleted';
  warnings: WarningStats;
  suspension: {
    isSuspended: boolean;
    suspendedAt?: string | null;
    suspendedBy?: string | null;
    suspensionReason?: string | null;
  };
  deletion: {
    isDeleted: boolean;
    deletedAt?: string | null;
    deletedBy?: string | null;
  };
}

// ============================================
// API METHODS
// ============================================

// Helper to get auth token from storage or provided token
// If token is provided, use it; otherwise, get from storage
const getAuthToken = async (providedToken?: string | null): Promise<string | null> => {
  // If token is provided, use it (from auth context)
  if (providedToken) {
    return providedToken;
  }
  
  try {
    const SecureStore = await import('expo-secure-store');
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    
    // Try SecureStore first
    try {
      const isAvailable = SecureStore.default.isAvailableAsync 
        ? await SecureStore.default.isAvailableAsync() 
        : true;
      
      if (isAvailable) {
        const token = await SecureStore.default.getItemAsync('accessToken');
        if (token) return token;
      }
    } catch (e) {
      // Fallback to AsyncStorage
    }
    
    // Fallback to AsyncStorage
    const token = await AsyncStorage.default.getItem('accessToken_fallback');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export const warningsAPI = {
  /**
   * Get current user's warnings
   * GET /users/me/warnings
   */
  getMyWarnings: async (): Promise<Warning[]> => {
    const token = await getAuthToken();
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/users/me/warnings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch warnings' }));
      throw new Error(error.message || 'Failed to fetch warnings');
    }

    return response.json();
  },

  /**
   * Get account status (warnings, suspension, ban)
   * GET /users/me/account-status
   */
  getAccountStatus: async (providedToken?: string | null): Promise<AccountStatus> => {
    const token = await getAuthToken(providedToken);
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/users/me/account-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch account status' }));
      throw new Error(error.message || 'Failed to fetch account status');
    }

    return response.json();
  },
};

