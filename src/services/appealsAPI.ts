/**
 * FRETIKO MOBILE - APPEALS API SERVICE
 * Handles all API calls related to suspension appeals
 */

import { API_CONFIG } from '../config/api';

// ============================================
// TYPES
// ============================================

export type AppealStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export interface Appeal {
  id: string;
  suspensionReason?: string | null;
  appealReason: string;
  status: AppealStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedByStaff?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface AppealStatusResponse {
  hasPendingAppeal: boolean;
  latestAppeal: Appeal | null;
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

export const appealsAPI = {
  /**
   * Submit a suspension appeal
   * POST /users/me/appeals
   */
  submitAppeal: async (reason: string, providedToken?: string | null): Promise<{ message: string; appealId: string }> => {
    const token = await getAuthToken(providedToken);
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/users/me/appeals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to submit appeal' }));
      throw new Error(error.message || 'Failed to submit appeal');
    }

    return response.json();
  },

  /**
   * Get current user's appeals
   * GET /users/me/appeals
   */
  getMyAppeals: async (): Promise<Appeal[]> => {
    const token = await getAuthToken();
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/users/me/appeals`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch appeals' }));
      throw new Error(error.message || 'Failed to fetch appeals');
    }

    const data = await response.json();
    
    // Map backend response to frontend format
    return (data || []).map((appeal: any) => ({
      id: appeal.id,
      suspensionReason: appeal.suspension_reason,
      appealReason: appeal.appeal_reason,
      status: appeal.status,
      reviewedBy: appeal.reviewed_by,
      reviewedAt: appeal.reviewed_at,
      reviewNotes: appeal.review_notes,
      createdAt: appeal.created_at,
      updatedAt: appeal.updated_at,
      reviewedByStaff: appeal.reviewed_by_staff ? {
        id: appeal.reviewed_by_staff.id,
        fullName: appeal.reviewed_by_staff.full_name,
        email: appeal.reviewed_by_staff.email,
      } : null,
    }));
  },

  /**
   * Get current user's appeal status
   * GET /users/me/appeals/status
   */
  getAppealStatus: async (providedToken?: string | null): Promise<AppealStatusResponse> => {
    const token = await getAuthToken(providedToken);
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/users/me/appeals/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch appeal status' }));
      throw new Error(error.message || 'Failed to fetch appeal status');
    }

    const data = await response.json();
    
    // Map latest appeal if exists
    const latestAppeal = data.latestAppeal ? {
      id: data.latestAppeal.id,
      suspensionReason: data.latestAppeal.suspension_reason,
      appealReason: data.latestAppeal.appeal_reason,
      status: data.latestAppeal.status,
      reviewedBy: data.latestAppeal.reviewed_by,
      reviewedAt: data.latestAppeal.reviewed_at,
      reviewNotes: data.latestAppeal.review_notes,
      createdAt: data.latestAppeal.created_at,
      updatedAt: data.latestAppeal.updated_at,
    } : null;

    return {
      hasPendingAppeal: data.hasPendingAppeal,
      latestAppeal,
    };
  },
};

