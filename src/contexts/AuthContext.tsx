import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';
import { warningsAPI } from '../services/warningsAPI';
import { pushNotificationService } from '../services/pushNotificationService';
import { API_CONFIG } from '../config/api';

// Custom error class for unauthorized access
class UnauthorizedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedException';
  }
}

// Types for our auth system
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  user_role?: string;
  is_seller?: boolean;
  is_rider?: boolean;
  is_verified?: boolean;
  username?: string;
  avatar_url?: string;
  hasAcceptedTerms?: boolean;
  token?: string; // Add token property for PIN reset screens
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isNewUser: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  isCheckingSuspension: boolean;
}

export interface AuthContextType extends AuthState {
  signin: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    gender?: string,
    hasAcceptedTerms?: boolean,
    user_role?: 'citizen' | 'vendor' | 'rider',
    is_seller?: boolean,
    is_rider?: boolean
  ) => Promise<void>;
  socialSignIn: (provider: 'google' | 'apple', accessToken: string, idToken?: string) => Promise<void>;
  migrate: (email: string, newPassword: string) => Promise<void>;
  signout: () => Promise<void>;
  logout: () => Promise<void>;
  clearNewUserFlag: () => void;
  checkAccountStatus: () => Promise<void>;
  acceptTerms: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
    isNewUser: false,
    isSuspended: false,
    isDeleted: false,
    isCheckingSuspension: false,
  });

  // Ref to track latest auth state for AppState handler (prevents stale closure)
  const authStateRef = useRef(authState);
  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  // Function to load authentication data
  const loadAuthData = async () => {
    try {
      console.log('Loading auth data...');
      
      // Try to get saved tokens and user data
      let accessToken = null;
      try {
        let isSecureStoreAvailable = false;
        try {
          if (SecureStore.isAvailableAsync) {
            isSecureStoreAvailable = await SecureStore.isAvailableAsync();
          } else {
            isSecureStoreAvailable = true;
          }
        } catch (error) {
          console.log('SecureStore availability check failed:', error);
          isSecureStoreAvailable = false;
        }

        if (isSecureStoreAvailable) {
          accessToken = await SecureStore.getItemAsync('accessToken');
        }
        if (!accessToken) {
          accessToken = await AsyncStorage.getItem('accessToken_fallback');
        }
      } catch (error) {
        accessToken = await AsyncStorage.getItem('accessToken_fallback');
      }

      const userDataString = await AsyncStorage.getItem('userData');
      const suspensionStatusString = await AsyncStorage.getItem('suspensionStatus');
      
      let storedSuspensionStatus = { isSuspended: false, isDeleted: false };
      if (suspensionStatusString) {
        try {
          storedSuspensionStatus = JSON.parse(suspensionStatusString);
        } catch (e) {
          console.log('Error parsing suspension status:', e);
        }
      }

      if (accessToken && userDataString) {
        console.log('Found stored token and user data');
        
        // Validate token by checking if it's properly formatted JWT
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          try {
            // Decode token payload to check expiration
            const payload = JSON.parse(atob(tokenParts[1]));
            const currentTime = Date.now() / 1000;

            if (payload.exp && payload.exp > currentTime) {
              const userData = JSON.parse(userDataString);
              
              // Fetch fresh user profile to get role info
              try {
                const response = await fetch(`${API_CONFIG.BASE_URL}/users/profile`, {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                });
                
                if (response.ok) {
                  const profileData = await response.json();
                  console.log('Profile data from API:', profileData);
                  
                  // Merge profile data with stored user data
                  const enrichedUserData = {
                    ...userData,
                    isSeller: profileData.isSeller,
                    isRider: profileData.isRider,
                    is_seller: profileData.isSeller,
                    is_rider: profileData.isRider,
                    is_verified: profileData.is_verified,
                  };
                  
                  setAuthState({
                    user: enrichedUserData,
                    accessToken,
                    isLoading: false,
                    isAuthenticated: true,
                    isNewUser: false,
                    isSuspended: storedSuspensionStatus.isSuspended,
                    isDeleted: storedSuspensionStatus.isDeleted,
                    isCheckingSuspension: storedSuspensionStatus.isSuspended,
                  });
                  
                  console.log('Valid token loaded with roles:', { 
                    isSeller: enrichedUserData.isSeller,
                    isRider: enrichedUserData.isRider,
                    is_seller: enrichedUserData.is_seller, 
                    is_rider: enrichedUserData.is_rider 
                  });
                } else {
                  // Fallback to stored data if profile fetch fails
                  setAuthState({
                    user: userData,
                    accessToken,
                    isLoading: false,
                    isAuthenticated: true,
                    isNewUser: false,
                    isSuspended: storedSuspensionStatus.isSuspended,
                    isDeleted: storedSuspensionStatus.isDeleted,
                    isCheckingSuspension: storedSuspensionStatus.isSuspended,
                  });
                }
              } catch (profileError) {
                console.error('Error fetching profile:', profileError);
                // Fallback to stored data
                setAuthState({
                  user: userData,
                  accessToken,
                  isLoading: false,
                  isAuthenticated: true,
                  isNewUser: false,
                  isSuspended: storedSuspensionStatus.isSuspended,
                  isDeleted: storedSuspensionStatus.isDeleted,
                  isCheckingSuspension: storedSuspensionStatus.isSuspended,
                });
              }
            } else {
              console.log('Token expired, clearing auth data');
              await clearAuthData();
              setAuthState(prev => ({ 
                ...prev, 
                isLoading: false,
                isSuspended: false,
                isDeleted: false,
                isCheckingSuspension: false
              }));
            }
          } catch (decodeError) {
            console.log('Invalid token format, clearing auth data');
            await clearAuthData();
            setAuthState(prev => ({ 
              ...prev, 
              isLoading: false,
              isSuspended: false,
              isDeleted: false,
              isCheckingSuspension: false
            }));
          }
        } else {
          console.log('Malformed token, clearing auth data');
          await clearAuthData();
          setAuthState(prev => ({ 
            ...prev, 
            isLoading: false,
            isSuspended: false,
            isDeleted: false,
            isCheckingSuspension: false
          }));
        }
      } else {
        console.log('No stored auth data found');
        setAuthState(prev => ({ 
          ...prev, 
          isLoading: false,
          isSuspended: false,
          isDeleted: false,
          isCheckingSuspension: false
        }));
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false,
        isSuspended: false,
        isDeleted: false,
        isCheckingSuspension: false
      }));
    }
  };

  // Function to clear authentication data
  const clearAuthData = async () => {
    try {
      console.log('Clearing auth data...');
      
      // Clear SecureStore
      try {
        let isSecureStoreAvailable = false;
        try {
          if (SecureStore.isAvailableAsync) {
            isSecureStoreAvailable = await SecureStore.isAvailableAsync();
          } else {
            isSecureStoreAvailable = true;
          }
        } catch (error) {
          console.log('SecureStore availability check failed:', error);
          isSecureStoreAvailable = false;
        }

        if (isSecureStoreAvailable) {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
        }
      } catch (secureStoreError) {
        console.log('Error clearing SecureStore:', secureStoreError);
      }

      // Clear AsyncStorage
      await AsyncStorage.multiRemove([
        'accessToken_fallback',
        'refreshToken_fallback',
        'userData',
        'suspensionStatus'
      ]);

      console.log('Auth data cleared successfully');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  // Load saved auth data on app start
  useEffect(() => {
    loadAuthData();
  }, []);

  // Refresh auth session when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && authStateRef.current.isAuthenticated) {
        console.log('📱 App returned to foreground, refreshing auth session...');
        
        // Check if we have a stored token
        let accessToken = null;
        try {
          let isSecureStoreAvailable = false;
          try {
            if (SecureStore.isAvailableAsync) {
              isSecureStoreAvailable = await SecureStore.isAvailableAsync();
            } else {
              isSecureStoreAvailable = true;
            }
          } catch (error) {
            console.log('SecureStore availability check failed:', error);
            isSecureStoreAvailable = false;
          }

          if (isSecureStoreAvailable) {
            accessToken = await SecureStore.getItemAsync('accessToken');
          }
          if (!accessToken) {
            accessToken = await AsyncStorage.getItem('accessToken_fallback');
          }
        } catch (error) {
          accessToken = await AsyncStorage.getItem('accessToken_fallback');
        }

        // If we have a token, validate it and refresh user data
        if (accessToken) {
          try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/users/profile`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const profileData = await response.json();
              console.log('Profile data from API:', profileData);
              
              const userDataString = await AsyncStorage.getItem('userData');
              const userData = userDataString ? JSON.parse(userDataString) : {};
              const enrichedUserData = {
                ...userData,
                isSeller: profileData.isSeller,
                isRider: profileData.isRider,
                is_seller: profileData.isSeller,
                is_rider: profileData.isRider,
                is_verified: profileData.is_verified,
              };
              
              setAuthState({
                user: enrichedUserData,
                accessToken,
                isLoading: false,
                isAuthenticated: true,
                isNewUser: false,
                isSuspended: false,
                isDeleted: false,
                isCheckingSuspension: false,
              });
            } else {
              console.error('Failed to fetch user profile during refresh');
            }
          } catch (error) {
            console.error('Error refreshing auth session:', error);
          }
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Register push notification token when user is authenticated
  useEffect(() => {
    const registerPushToken = async () => {
      if (authState.isAuthenticated && authState.accessToken && authState.user) {
        try {
          console.log('📱 Registering push notification token for user:', authState.user.id);
          const success = await pushNotificationService.registerPushToken(authState.accessToken);
          
          if (success) {
            console.log('✅ Push token registered successfully');
          } else {
            console.log('⚠️ Push token registration skipped (not available on this device)');
          }
        } catch (error) {
          console.error('❌ Error registering push token:', error);
        }
      }
    };

    registerPushToken();
  }, [authState.isAuthenticated, authState.accessToken, authState.user?.id]);

  // Function to refresh access token
  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      // Get refresh token from storage
      let refreshToken = null;
      try {
        let isSecureStoreAvailable = false;
        try {
          if (SecureStore.isAvailableAsync) {
            isSecureStoreAvailable = await SecureStore.isAvailableAsync();
          } else {
            isSecureStoreAvailable = true;
          }
        } catch (error) {
          console.log('SecureStore availability check failed:', error);
          isSecureStoreAvailable = false;
        }

        if (isSecureStoreAvailable) {
          refreshToken = await SecureStore.getItemAsync('refreshToken');
        }
        if (!refreshToken) {
          refreshToken = await AsyncStorage.getItem('refreshToken_fallback');
        }
      } catch (error) {
        refreshToken = await AsyncStorage.getItem('refreshToken_fallback');
      }

      if (refreshToken) {
        // Attempt to refresh token via backend API
        const response = await fetch(`${API_CONFIG.BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        const refreshData = await response.json();

        if (response.ok && refreshData.success) {
          console.log('Token refreshed successfully');
          
          // Update stored tokens
          try {
            let isSecureStoreAvailable = false;
            try {
              if (SecureStore.isAvailableAsync) {
                isSecureStoreAvailable = await SecureStore.isAvailableAsync();
              } else {
                isSecureStoreAvailable = true;
              }
            } catch (error) {
              console.log('SecureStore availability check failed:', error);
              isSecureStoreAvailable = false;
            }

            if (isSecureStoreAvailable) {
              await SecureStore.setItemAsync('accessToken', refreshData.accessToken);
              await SecureStore.setItemAsync('refreshToken', refreshData.refreshToken);
            }
          } catch (secureStoreError) {
            console.log('Error storing tokens in SecureStore:', secureStoreError);
          }

          // Fallback to AsyncStorage
          await AsyncStorage.setItem('accessToken_fallback', refreshData.accessToken);
          await AsyncStorage.setItem('refreshToken_fallback', refreshData.refreshToken);

          // Update auth state
          setAuthState(prev => ({
            ...prev,
            accessToken: refreshData.accessToken,
          }));

          return true;
        } else {
          console.error('Token refresh failed:', refreshData.message || 'Unknown error');
          await clearAuthData();
          setAuthState(prev => ({
            ...prev,
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          }));
          return false;
        }
      } else {
        console.log('No refresh token available');
        await clearAuthData();
        setAuthState(prev => ({
          ...prev,
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        }));
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      await clearAuthData();
      setAuthState(prev => ({
        ...prev,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      }));
      return false;
    }
  };

  // Token refresh mechanism - refresh tokens only when needed or on activity
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.accessToken) {
      return;
    }

    const refreshTokenIfNeeded = async () => {
      try {
        // Additional null check for TypeScript
        if (!authState.accessToken) {
          return;
        }
        
        // Check if token is close to expiration (within 24 hours)
        const tokenParts = authState.accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const currentTime = Date.now() / 1000;
          const timeUntilExpiry = payload.exp - currentTime;
          
          // Refresh if token expires within 24 hours (86400 seconds)
          if (timeUntilExpiry < 86400) {
            console.log('🔄 Token expiring soon, refreshing...');
            await refreshAccessToken();
          } else {
            console.log('✅ Token still valid, no refresh needed');
          }
        }
      } catch (error) {
        console.error('❌ Error checking token expiration:', error);
      }
    };

    // Check token expiration immediately on mount
    refreshTokenIfNeeded();

    // Set up interval to check every 6 hours (more reasonable than 30 minutes)
    const checkInterval = setInterval(refreshTokenIfNeeded, 6 * 60 * 60 * 1000);

    return () => clearInterval(checkInterval);
  }, [authState.isAuthenticated, authState.accessToken]);

  const saveAuthData = async (user: User, accessToken: string, refreshToken: string) => {
    try {
      console.log('💾 Saving auth data:');
      console.log('  - User ID:', user.id);
      console.log('  - Access token length:', accessToken?.length || 'N/A');
      console.log('  - Access token starts:', accessToken?.substring(0, 20) || 'N/A');
      console.log('  - Refresh token length:', refreshToken?.length || 'N/A');

      // Expo SDK 54 compatibility: Check if SecureStore is available
      let isSecureStoreAvailable = false;
      try {
        // Check if SecureStore is available (works in both Expo Go and production)
        if (SecureStore.isAvailableAsync) {
          isSecureStoreAvailable = await SecureStore.isAvailableAsync();
        } else {
          // Fallback for older Expo versions
          isSecureStoreAvailable = true;
        }
      } catch (error) {
        console.log('⚠️ SecureStore availability check failed, using fallback:', error);
        isSecureStoreAvailable = false;
      }

      if (isSecureStoreAvailable) {
        try {
          // Save tokens securely
          await SecureStore.setItemAsync('accessToken', accessToken);
          await SecureStore.setItemAsync('refreshToken', refreshToken);
          console.log('✅ Tokens saved to SecureStore');
        } catch (secureStoreError: any) {
          console.log('⚠️ SecureStore save failed, using fallback:', secureStoreError.message);

          // Fallback to AsyncStorage for development
          await AsyncStorage.setItem('accessToken_fallback', accessToken);
          await AsyncStorage.setItem('refreshToken_fallback', refreshToken);
          console.log('✅ Tokens saved to AsyncStorage fallback');
        }
      } else {
        console.log('⚠️ SecureStore not available, using AsyncStorage');
        await AsyncStorage.setItem('accessToken_fallback', accessToken);
        await AsyncStorage.setItem('refreshToken_fallback', refreshToken);
        console.log('✅ Tokens saved to AsyncStorage fallback');
      }

      // Save user data in regular storage (less sensitive)
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      
      // Save suspension status separately for quick access on app reload
      // This ensures suspended users are immediately identified
      const suspensionStatus = {
        isSuspended: false,
        isDeleted: false,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('suspensionStatus', JSON.stringify(suspensionStatus));

      console.log('✅ Auth data saved successfully');
    } catch (error) {
      console.error('❌ Error saving auth data:', error);
      throw error;
    }
  };

  const clearAuthDataDuplicate = async () => {
    try {
      console.log('🧹 Clearing all auth data...');

      // Clear from SecureStore if available
      try {
        let isSecureStoreAvailable = false;
        try {
          if (SecureStore.isAvailableAsync) {
            isSecureStoreAvailable = await SecureStore.isAvailableAsync();
          } else {
            isSecureStoreAvailable = true;
          }
        } catch (error) {
          console.log('⚠️ SecureStore availability check failed:', error);
          isSecureStoreAvailable = false;
        }

        if (isSecureStoreAvailable) {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
        }
      } catch (secureStoreError: any) {
        console.log('⚠️ SecureStore clear error (expected in some cases):', secureStoreError.message);
      }

      // Clear fallback data from AsyncStorage
      await AsyncStorage.removeItem('accessToken_fallback');
      await AsyncStorage.removeItem('refreshToken_fallback');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('suspensionStatus');

      console.log('✅ Auth data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing auth data:', error);
    }
  };

  const checkAccountStatus = async () => {
    // Don't check if we're not authenticated
    if (!authState.isAuthenticated || !authState.accessToken) {
      setAuthState(prev => ({ ...prev, isCheckingSuspension: false }));
      return;
    }

    try {
      setAuthState(prev => ({ ...prev, isCheckingSuspension: true }));
      const accountStatus = await warningsAPI.getAccountStatus(authState.accessToken);
      
      const isSuspended = accountStatus.accountStatus === 'suspended' || 
                         accountStatus.suspension.isSuspended;
      const isDeleted = accountStatus.accountStatus === 'deleted' || 
                       accountStatus.deletion.isDeleted;
      
      setAuthState(prev => ({ 
        ...prev, 
        isSuspended,
        isDeleted,
        isCheckingSuspension: false 
      }));
      
      console.log('🔍 Account status checked:', { 
        accountStatus: accountStatus.accountStatus,
        isSuspended,
        isDeleted
      });
    } catch (error: any) {
      console.error('❌ Error checking account status:', error);
      // Don't block user if check fails - assume not suspended/deleted
      setAuthState(prev => ({ 
        ...prev, 
        isSuspended: false,
        isDeleted: false,
        isCheckingSuspension: false 
      }));
    }
  };

  const signin = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const response = await authAPI.signin({ email, password });
      
      // ✅ Backend returns snake_case (is_seller, is_rider)
      // Add camelCase aliases for compatibility with ProfileScreen
      const enrichedUser = {
        ...response.user,
        is_seller: response.user.is_seller,
        is_rider: response.user.is_rider,
        isSeller: response.user.is_seller,  // ✅ Add camelCase alias
        isRider: response.user.is_rider,    // ✅ Add camelCase alias
      };
      
      // Industry standard: Backend now returns isSuspended flag
      // Suspended users can authenticate but have limited access
      const isSuspended = response.isSuspended === true;
      
      // Save auth data
      await saveAuthData(enrichedUser, response.accessToken, response.refreshToken);
      
      // Update state - use backend suspension response directly
      setAuthState({
        user: enrichedUser,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
        isNewUser: false,
        isSuspended: isSuspended,
        isDeleted: false,
        isCheckingSuspension: isSuspended, // Only check if actually suspended
      });
      
      // Check account status after signin (if not already suspended)
      if (!isSuspended) {
        await checkAccountStatus();
      }
      
      console.log('✅ Signed in with roles:', { 
        is_seller: enrichedUser.is_seller, 
        is_rider: enrichedUser.is_rider,
        isSeller: enrichedUser.isSeller,
        isRider: enrichedUser.isRider 
      });
    } catch (error: any) {
      // Reset loading state on error
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      // Check if this is a suspension error
      if (error.message && error.message.includes('suspended')) {
        console.log('🚫 Account suspended during login');
        // Extract user ID from error response if available
        const userId = (error as any).userId || (error.response?.data?.userId) || '';
        // Set suspended state so App.tsx can navigate to SuspensionScreen
        setAuthState({
          user: { 
            id: userId, // Use user ID from error response if available
            email: (error as any).email || email,
            firstName: '',
            lastName: '',
          } as User,
          accessToken: null,
          isLoading: false,
          isAuthenticated: false,
          isNewUser: false,
          isSuspended: true,
          isDeleted: false,
          isCheckingSuspension: false,
        });
        // Don't throw - let the app handle navigation based on isSuspended state
        return;
      }
      
      // Check if this is a deletion error
      if (error.message && error.message.includes('deleted')) {
        console.log('🚫 Account deleted during login');
        // Extract user ID from error response if available
        const userId = (error as any).userId || (error.response?.data?.userId) || '';
        setAuthState({
          user: { 
            id: userId,
            email: (error as any).email || email,
            firstName: '',
            lastName: '',
          } as User,
          accessToken: null,
          isLoading: false,
          isAuthenticated: false,
          isNewUser: false,
          isSuspended: false,
          isDeleted: true,
          isCheckingSuspension: false,
        });
        return;
      }
      
      if (error.message && error.message.includes('Email not confirmed')) {
        throw new UnauthorizedException('Please confirm your email before signing in');
      }
      throw new UnauthorizedException('Invalid email or password');
    }
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    gender?: string,
    hasAcceptedTerms?: boolean,
    user_role?: 'citizen' | 'vendor' | 'rider',
    is_seller?: boolean,
    is_rider?: boolean
  ) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const response = await authAPI.signup({
        email,
        password,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        hasAcceptedTerms,
        user_role: user_role || 'citizen',
        is_seller: is_seller || false,
        is_rider: is_rider || false,
        is_verified: false,
      });

      // Handle the wrapped response from backend
      const user = response.user;
      const accessToken = response.accessToken;
      const refreshToken = response.refreshToken;
      const requiresEmailVerification = response.requiresEmailVerification;

      // Debug logging
      console.log('🔍 Backend response:', {
        hasUser: !!user,
        userId: user?.id,
        hasAccessToken: !!accessToken,
        requiresEmailVerification,
      });

      if (requiresEmailVerification) {
        // Navigate to email verification screen
        // This will be handled by the signup screen navigation logic
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Validate user data before saving
      if (!user || !user.id) {
        console.error('❌ Invalid user data received from backend:', user);
        throw new Error('Invalid user data received from server');
      }

      // Save auth data
      await saveAuthData(user, accessToken, refreshToken);

      // Update state - mark as new user to trigger role selection
      setAuthState({
        user: user,
        accessToken: accessToken,
        isLoading: false,
        isAuthenticated: true,
        isNewUser: true,
        isSuspended: false,
        isDeleted: false,
        isCheckingSuspension: false,
      });
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error; // Re-throw so UI can handle it
    }
  };

  const socialSignIn = async (provider: 'google' | 'apple', accessToken: string, idToken?: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/social/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          accessToken,
          idToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Save auth data
        await saveAuthData(data.user, data.accessToken, data.refreshToken);

        // Update state
        setAuthState({
          user: data.user,
          accessToken: data.accessToken,
          isLoading: false,
          isAuthenticated: true,
          isNewUser: data.isNewUser || false,
          isSuspended: data.isSuspended || false,
          isDeleted: false,
          isCheckingSuspension: data.isSuspended,
        });
      } else {
        throw new Error(data.message || 'Social authentication failed');
      }
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const migrate = async (email: string, newPassword: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authAPI.migrate({ email, newPassword });

      // Save auth data
      await saveAuthData(response.user, response.accessToken, response.refreshToken);

      // Update state
      setAuthState({
        user: response.user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
        isNewUser: false,
        isSuspended: false,
        isDeleted: false,
        isCheckingSuspension: true,
      });
      
      // Check account status after migration
      await checkAccountStatus();
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error; // Re-throw so the UI can handle it
    }
  };

  const signout = async () => {
    try {
      // Get refresh token for logout
      let refreshToken = null;
      try {
        let isSecureStoreAvailable = false;
        try {
          if (SecureStore.isAvailableAsync) {
            isSecureStoreAvailable = await SecureStore.isAvailableAsync();
          } else {
            isSecureStoreAvailable = true;
          }
        } catch (error) {
          console.log('⚠️ SecureStore availability check failed:', error);
          isSecureStoreAvailable = false;
        }

        if (isSecureStoreAvailable) {
          refreshToken = await SecureStore.getItemAsync('refreshToken');
        }
        if (!refreshToken) {
          refreshToken = await AsyncStorage.getItem('refreshToken_fallback');
        }
      } catch (error) {
        refreshToken = await AsyncStorage.getItem('refreshToken_fallback');
      }

      // Call logout endpoint to revoke refresh token
      if (refreshToken) {
        try {
          console.log('🔒 Revoking refresh token...');
          await fetch(`${API_CONFIG.BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });
          console.log('✅ Refresh token revoked');
        } catch (logoutError) {
          console.error('⚠️ Error revoking refresh token:', logoutError);
          // Continue with local logout even if server logout fails
        }
      }

      // Unregister push token before signing out
      if (authState.accessToken) {
        try {
          console.log('📱 Unregistering push notification token...');
          await pushNotificationService.unregisterPushToken(authState.accessToken);
          console.log('✅ Push token unregistered');
        } catch (pushError) {
          console.error('⚠️ Error unregistering push token:', pushError);
          // Continue with signout even if push token unregistration fails
        }
      }

      await clearAuthData();
      setAuthState({
        user: null,
        accessToken: null,
        isLoading: false,
        isAuthenticated: false,
        isNewUser: false,
        isSuspended: false,
        isDeleted: false,
        isCheckingSuspension: false,
      });
    } catch (error) {
      console.error('Error during signout:', error);
      // Still update state even if clearing data fails
      setAuthState({
        user: null,
        accessToken: null,
        isLoading: false,
        isAuthenticated: false,
        isNewUser: false,
        isSuspended: false,
        isDeleted: false,
        isCheckingSuspension: false,
      });
    }
  };

  const clearNewUserFlag = () => {
    setAuthState(prev => ({ ...prev, isNewUser: false }));
  };

  const refreshUserProfile = async () => {
    if (!authState.accessToken) {
      console.warn('Cannot refresh profile: No access token');
      return;
    }

    try {
      console.log('🔄 Refreshing user profile from API...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${authState.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const profileData = await response.json();
        console.log('✅ Profile refreshed successfully:', profileData);

        // Update auth state with fresh data
        setAuthState(prev => {
          if (!prev.user) return prev;

          return {
            ...prev,
            user: {
              ...prev.user,
              ...profileData,
              isSeller: profileData.isSeller,
              isRider: profileData.isRider,
              is_seller: profileData.isSeller,
              is_rider: profileData.isRider,
              is_verified: profileData.is_verified,
            },
          };
        });
      } else {
        console.error('Failed to refresh profile:', response.status);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const acceptTerms = async () => {
    try {
      console.log('📋 Accepting terms for user:', authState.user?.id);

      // TODO: Call backend API to accept terms
      // This will update user_profiles.terms_accepted_at, terms_accepted_ip, etc.
      // For now, just update local state
      setAuthState(prev => ({ ...prev, hasAcceptedTerms: true }));

      console.log('✅ Terms accepted successfully');
    } catch (error) {
      console.error('❌ Error accepting terms:', error);
      throw error;
    }
  };

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<AuthContextType>(() => ({
    ...authState,
    signin,
    signup,
    socialSignIn,
    migrate,
    signout,
    logout: signout, // Alias for signout
    clearNewUserFlag,
    checkAccountStatus,
    acceptTerms,
    refreshUserProfile,
  }), [authState, signin, signup, socialSignIn, migrate, signout, clearNewUserFlag, checkAccountStatus, acceptTerms, refreshUserProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
