import { api } from './api';
import { API_CONFIG } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Types for user profile data
export interface UserProfile {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  bgPicUrl?: string;
  location?: string;
  phone?: string;
  dateOfBirth?: string;
  preferences?: any;
  isSeller: boolean;
  isRider: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  username?: string;
  bio?: string;
  avatarUrl?: string;
  bgPicUrl?: string;
  location?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  isSeller?: boolean;
  isRider?: boolean;
  preferences?: any;
}

export interface UserStats {
  plugsCount: number;
  clientsCount: number;
  connectionRequestsCount: number;
}

export interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
  updatedAt: string;
  requester?: {
    id: string;
    username: string;
    bio?: string;
    avatarUrl?: string;
    isSeller?: boolean;
    isRider?: boolean;
  };
  addressee?: {
    id: string;
    username: string;
    bio?: string;
    avatarUrl?: string;
    isSeller?: boolean;
    isRider?: boolean;
  };
}

export interface ClientRelationship {
  id: string;
  providerId: string;
  clientId: string;
  relationshipType: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  provider?: {
    id: string;
    username: string;
    bio?: string;
    avatarUrl?: string;
    isSeller?: boolean;
    isRider?: boolean;
  };
  client?: {
    id: string;
    username: string;
    bio?: string;
    avatarUrl?: string;
    isSeller?: boolean;
    isRider?: boolean;
  };
}

// Add auth token to requests automatically
const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('accessToken');
  
  return token ? { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  } : { 'Content-Type': 'application/json' };
};

export const userAPI = {
  // Get current user's profile
  getProfile: async (): Promise<UserProfile> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/users/profile', { headers, timeout: 10000 });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get profile');
    }
  },

  // Get public profile by user ID
  getPublicProfile: async (userId: string): Promise<Partial<UserProfile>> => {
    try {
      const response = await api.get(`/users/profile/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get public profile');
    }
  },

  // Update current user's profile
  updateProfile: async (updateData: UpdateProfileData): Promise<UserProfile> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.put('/users/profile', updateData, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update profile');
    }
  },

  // Upload avatar image
  uploadAvatar: async (imageUri: string): Promise<string> => {
    try {
      const headers = await getAuthHeaders();
      
      // Create FormData for image upload  
      const formData = new FormData();
      
      // Get file extension from URI
      const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
      
      console.log('📋 FormData details:');
      console.log('  - Image URI:', imageUri);
      console.log('  - File extension:', fileExtension);
      console.log('  - MIME type:', mimeType);
      
      // For React Native, FormData expects this specific format
      formData.append('avatar', {
        uri: imageUri,
        type: mimeType,
        name: `avatar.${fileExtension}`,
      } as any);
      
      console.log('✅ FormData created with avatar field');

      // Use fetch instead of axios for file uploads in React Native
      const token = await SecureStore.getItemAsync('accessToken');
      
      console.log('📤 Making fetch request to upload avatar...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/users/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch handle it for FormData
        },
        body: formData,
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('📥 Error response:', errorData);
        throw new Error(errorData.message || 'Upload failed');
      }

      const data = await response.json();
      
      return data.avatarUrl;
    } catch (error: any) {
      console.error('Avatar upload error:', error.response?.data || error.message);
      
      // Handle token expiration specifically
      if (error.response?.status === 401 && error.response?.data?.message === 'Invalid token') {
        throw new Error('Your session has expired. Please sign out and sign back in to continue uploading images.');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to upload avatar');
    }
  },

  // Upload background image
  uploadBackground: async (imageUri: string): Promise<string> => {
    try {
      const headers = await getAuthHeaders();
      
      // Create FormData for image upload  
      const formData = new FormData();
      
      // Get file extension from URI
      const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
      
      console.log('📋 Background FormData details:');
      console.log('  - Image URI:', imageUri);
      console.log('  - File extension:', fileExtension);
      console.log('  - MIME type:', mimeType);
      
      // For React Native, FormData expects this specific format
      formData.append('background', {
        uri: imageUri,
        type: mimeType,
        name: `background.${fileExtension}`,
      } as any);
      
      console.log('✅ Background FormData created');

      // Use fetch instead of axios for file uploads in React Native
      const token = await SecureStore.getItemAsync('accessToken');
      
      console.log('📤 Making fetch request to upload background...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/users/background`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch handle it for FormData
        },
        body: formData,
      });

      console.log('📥 Background response status:', response.status);
      console.log('📥 Background response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('📥 Background error response:', errorData);
        throw new Error(errorData.message || 'Background upload failed');
      }

      const data = await response.json();
      
      return data.bgPicUrl;
    } catch (error: any) {
      console.error('Background upload error:', error.response?.data || error.message);
      
      // Handle token expiration specifically
      if (error.response?.status === 401 && error.response?.data?.message === 'Invalid token') {
        throw new Error('Your session has expired. Please sign out and sign back in to continue uploading images.');
      }
      
      throw new Error(error.response?.data?.message || 'Failed to upload background image');
    }
  },

  // Search users by username or bio
  searchUsers: async (query: string, limit: number = 20): Promise<Partial<UserProfile>[]> => {
    try {
      const response = await api.get('/users/search', {
        params: { q: query, limit }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Search failed');
    }
  },

  // Get user stats (plugs, clients, connection requests)
  getStats: async (): Promise<UserStats> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/connections/stats', { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get user stats');
    }
  },

  // Get public user stats (for viewing other users' profiles)
  getPublicStats: async (userId: string): Promise<UserStats> => {
    try {
      const response = await api.get(`/connections/stats/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get public user stats');
    }
  },

  // Get user connections
  getConnections: async (): Promise<Connection[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/connections', { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get connections');
    }
  },

  // Get pending connection requests
  getPendingRequests: async (): Promise<Connection[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/connections/requests', { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get pending requests');
    }
  },

  // Send connection request
  sendConnectionRequest: async (addresseeId: string): Promise<Connection> => {
    try {
      console.log('📤 Sending connection request to:', addresseeId);
      const headers = await getAuthHeaders();
      console.log('📤 Request headers:', headers);
      const response = await api.post('/connections', { addresseeId }, { headers });
      console.log('✅ Connection request sent successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to send connection request:', error);
      console.error('Error response:', error.response?.data);
      throw new Error(error.response?.data?.message || 'Failed to send connection request');
    }
  },

  // Update connection (accept/reject)
  updateConnection: async (connectionId: string, status: 'accepted' | 'blocked'): Promise<Connection> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.put(`/connections/${connectionId}`, { status }, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update connection');
    }
  },

  // Delete connection
  deleteConnection: async (connectionId: string): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      await api.delete(`/connections/${connectionId}`, { headers });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to delete connection');
    }
  },

  // Get connection status with another user
  getConnectionStatus: async (targetUserId: string): Promise<{ status: string; connectionId?: string }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get(`/connections/status/${targetUserId}`, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get connection status');
    }
  },

  // Get client relationships
  getClientRelationships: async (): Promise<ClientRelationship[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/connections/clients', { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get client relationships');
    }
  },

  // Accept all pending connection requests
  acceptAllConnectionRequests: async (): Promise<{ accepted: number; failed: number; message: string }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.post('/connections/requests/accept-all', {}, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to accept all requests');
    }
  },

  // Get relationship details with another user
  getRelationshipDetails: async (targetUserId: string): Promise<any> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get(`/connections/relationship/${targetUserId}`, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get relationship details');
    }
  },

  // Get categorized connections (Plugs or Clients with subcategories)
  getCategorizedConnections: async (type: 'plugs' | 'clients'): Promise<any> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get(`/connections/categorized/${type}`, { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get categorized connections');
    }
  },

  // Delete user account permanently
  deleteAccount: async (): Promise<{ message: string; deletedData: any }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.delete('/users/account', { headers });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to delete account');
    }
  },
};

// Helper functions for profile data
export const profileUtils = {
  // Check if profile is complete
  isProfileComplete: (profile: UserProfile): boolean => {
    return !!(profile.username && profile.bio && profile.location);
  },

  // Get profile completion percentage
  getCompletionPercentage: (profile: UserProfile): number => {
    const fields = ['username', 'bio', 'location', 'phone', 'avatarUrl'];
    const completedFields = fields.filter(field => profile[field as keyof UserProfile]);
    return Math.round((completedFields.length / fields.length) * 100);
  },

  // Generate display name
  getDisplayName: (profile: UserProfile, fallback: string = 'User'): string => {
    return profile.username || fallback;
  },

  // Format date for display
  formatDate: (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'Invalid date';
    }
  },

  // Generate avatar initials
  getInitials: (firstName: string = '', lastName: string = ''): string => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'U';
  },
};