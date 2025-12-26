import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';
import { warningsAPI } from '../services/warningsAPI';

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
    gender?: string
  ) => Promise<void>;
  migrate: (email: string, newPassword: string) => Promise<void>;
  signout: () => Promise<void>;
  logout: () => Promise<void>;
  clearNewUserFlag: () => void;
  checkAccountStatus: () => Promise<void>;
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

  // Load saved auth data on app start
  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      console.log('🔍 Loading auth data...');

      // Try to get saved tokens and user data with Expo SDK 54 compatibility
      let accessToken = null;
      try {
        // Check if SecureStore is available
        const isSecureStoreAvailable = SecureStore.isAvailableAsync ?
          await SecureStore.isAvailableAsync() : true;

        if (isSecureStoreAvailable) {
          accessToken = await SecureStore.getItemAsync('accessToken');
        }

        // Fallback to AsyncStorage if SecureStore fails or isn't available
        if (!accessToken) {
          accessToken = await AsyncStorage.getItem('accessToken_fallback');
          if (accessToken) {
            console.log('📦 Loaded token from AsyncStorage fallback');
          }
        }
      } catch (secureStoreError) {
        console.log('⚠️ SecureStore error, trying fallback:', secureStoreError.message);
        accessToken = await AsyncStorage.getItem('accessToken_fallback');
      }

      const userDataString = await AsyncStorage.getItem('userData');
      const suspensionStatusString = await AsyncStorage.getItem('suspensionStatus');

      if (accessToken && userDataString) {
        console.log('🔑 Found stored token and user data');
        
        // Load suspension status if available
        let storedSuspensionStatus = { isSuspended: false, isDeleted: false };
        if (suspensionStatusString) {
          try {
            storedSuspensionStatus = JSON.parse(suspensionStatusString);
          } catch (e) {
            console.log('⚠️ Error parsing suspension status:', e);
          }
        }

        // Validate token by checking if it's properly formatted JWT
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          try {
            // Decode token payload to check expiration
            const payload = JSON.parse(atob(tokenParts[1]));
            const currentTime = Date.now() / 1000;

            if (payload.exp && payload.exp > currentTime) {
              const userData = JSON.parse(userDataString);
              
              // ✅ Fetch fresh user profile to get role info (is_seller, is_rider)
              try {
                const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/profile`, {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                });
                
                if (response.ok) {
                  const profileData = await response.json();
                  console.log('🔍 Profile data from API:', profileData);
                  
                  // Merge profile data with stored user data
                  // Add BOTH naming conventions for compatibility
                  const enrichedUserData = {
                    ...userData,
                    // Backend returns camelCase
                    isSeller: profileData.isSeller,
                    isRider: profileData.isRider,
                    // Also add snake_case for consistency
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
                    isCheckingSuspension: !storedSuspensionStatus.isSuspended,
                  });
                  
                  // Check account status after loading user (if not already suspended)
                  if (!storedSuspensionStatus.isSuspended) {
                    checkAccountStatus();
                  }
                  
                  console.log('✅ Valid token loaded with roles:', { 
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
                    isCheckingSuspension: !storedSuspensionStatus.isSuspended,
                  });
                  // Check account status even with fallback data (if not already suspended)
                  if (!storedSuspensionStatus.isSuspended) {
                    checkAccountStatus();
                  }
                  console.log('⚠️ Profile fetch failed, using stored data');
                }
              } catch (profileError) {
                console.log('⚠️ Error fetching profile:', profileError);
                // Fallback to stored data
                setAuthState({
                  user: userData,
                  accessToken,
                  isLoading: false,
                  isAuthenticated: true,
                  isNewUser: false,
                  isSuspended: storedSuspensionStatus.isSuspended,
                  isDeleted: storedSuspensionStatus.isDeleted,
                  isCheckingSuspension: !storedSuspensionStatus.isSuspended,
                });
                // Check account status even with fallback data (if not already suspended)
                if (!storedSuspensionStatus.isSuspended) {
                  checkAccountStatus();
                }
              }
            } else {
              console.log('🔓 Token expired, clearing auth data');
              await clearAuthData();
              setAuthState(prev => ({ ...prev, isLoading: false, isSuspended: false, isCheckingSuspension: false }));
            }
          } catch (decodeError) {
            console.log('🔓 Invalid token format, clearing auth data');
            await clearAuthData();
            setAuthState(prev => ({ ...prev, isLoading: false, isSuspended: false, isCheckingSuspension: false }));
          }
        } else {
          console.log('🔓 Malformed token, clearing auth data');
          await clearAuthData();
          setAuthState(prev => ({ ...prev, isLoading: false, isSuspended: false, isCheckingSuspension: false }));
        }
      } else {
        console.log('ℹ️ No stored auth data found');
        setAuthState(prev => ({ ...prev, isLoading: false, isSuspended: false, isCheckingSuspension: false }));
      }
    } catch (error) {
      console.error('❌ Error loading auth data:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const saveAuthData = async (user: User, accessToken: string, refreshToken: string) => {
    try {
      console.log('💾 Saving auth data:');
      console.log('  - User ID:', user.id);
      console.log('  - Access token length:', accessToken?.length || 'N/A');
      console.log('  - Access token starts:', accessToken?.substring(0, 20) || 'N/A');
      console.log('  - Refresh token length:', refreshToken?.length || 'N/A');

      // Expo SDK 54 compatibility: Check if SecureStore is available
      const isSecureStoreAvailable = SecureStore.isAvailableAsync ?
        await SecureStore.isAvailableAsync() : true;

      if (isSecureStoreAvailable) {
        try {
          // Save tokens securely
          await SecureStore.setItemAsync('accessToken', accessToken);
          await SecureStore.setItemAsync('refreshToken', refreshToken);
          console.log('✅ Tokens saved to SecureStore');
        } catch (secureStoreError) {
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

  const clearAuthData = async () => {
    try {
      console.log('🧹 Clearing all auth data...');

      // Clear from SecureStore if available
      try {
        const isSecureStoreAvailable = SecureStore.isAvailableAsync ?
          await SecureStore.isAvailableAsync() : true;

        if (isSecureStoreAvailable) {
          await SecureStore.deleteItemAsync('accessToken');
          await SecureStore.deleteItemAsync('refreshToken');
        }
      } catch (secureStoreError) {
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
    // Get access token - try state first, then storage
    let accessToken: string | null = null;
    
    // Try to get from current state
    setAuthState(prev => {
      if (prev.accessToken) {
        accessToken = prev.accessToken;
      }
      return prev;
    });

    // If not in state, get from storage
    if (!accessToken) {
      try {
        const isSecureStoreAvailable = SecureStore.isAvailableAsync ?
          await SecureStore.isAvailableAsync() : true;
        if (isSecureStoreAvailable) {
          accessToken = await SecureStore.getItemAsync('accessToken');
        }
        if (!accessToken) {
          accessToken = await AsyncStorage.getItem('accessToken_fallback');
        }
      } catch (e) {
        accessToken = await AsyncStorage.getItem('accessToken_fallback');
      }
      
      // Update state with token if we got it from storage
      if (accessToken) {
        setAuthState(prev => {
          if (!prev.accessToken) {
            return { ...prev, accessToken };
          }
          return prev;
        });
      }
    }

    if (!accessToken) {
      setAuthState(prev => ({ ...prev, isCheckingSuspension: false }));
      return;
    }

    try {
      setAuthState(prev => ({ ...prev, isCheckingSuspension: true }));
      const accountStatus = await warningsAPI.getAccountStatus(accessToken);
      
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
      
      // Save suspension status for app reload
      const suspensionStatus = {
        isSuspended: isSuspended,
        isDeleted: false,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('suspensionStatus', JSON.stringify(suspensionStatus));

      // Update state - if suspended, set isSuspended immediately
      setAuthState({
        user: enrichedUser,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
        isNewUser: false,
        isSuspended: isSuspended,
        isDeleted: false,
        isCheckingSuspension: !isSuspended, // Only check if not already suspended
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
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error; // Re-throw other errors so the UI can handle them
    }
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dateOfBirth?: string,
    gender?: string
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
      });

      // Save auth data
      await saveAuthData(response.user, response.accessToken, response.refreshToken);

      // Update state - mark as new user to trigger role selection
      setAuthState({
        user: response.user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
        isNewUser: true,
        isSuspended: false,
        isDeleted: false,
        isCheckingSuspension: false,
      });
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error; // Re-throw so the UI can handle it
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

  const value: AuthContextType = {
    ...authState,
    signin,
    signup,
    migrate,
    signout,
    logout: signout, // Alias for signout
    clearNewUserFlag,
    checkAccountStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};