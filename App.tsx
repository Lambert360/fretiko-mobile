import { enableScreens, enableFreeze } from 'react-native-screens';
enableScreens(true);
enableFreeze(true); // Prevents background screens from re-rendering

import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

// Import base64 polyfill first
import './src/utils/base64-polyfill';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

// Import contexts
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { RegistrationProvider } from './src/contexts/RegistrationContext';
import { CartProvider } from './src/contexts/CartContext';
import { FilterProvider } from './src/contexts/FilterContext';

// Import services
import { pushNotificationService } from './src/services/pushNotificationService';

// Import auth screens
import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import EmailVerificationScreen from './src/screens/EmailVerificationScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';

// Import profile and user screens
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { RoleSelectionScreen } from './src/screens/RoleSelectionScreen';
import { ConnectionsListScreen } from './src/screens/ConnectionsListScreen';
import { ConnectionDetailsScreen } from './src/screens/ConnectionDetailsScreen';
import ConnectionRequestsScreen from './src/screens/ConnectionRequestsScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import { PublicStoreScreen } from './src/screens/PublicStoreScreen';

// Import wallet screens
import { WalletScreen } from './src/screens/WalletScreen';
import { WalletHistoryScreen } from './src/screens/WalletHistoryScreen';
import WalletDepositScreen from './src/screens/WalletDepositScreen';
import WalletWithdrawScreen from './src/screens/WalletWithdrawScreen';
import AddBankAccountScreen from './src/screens/AddBankAccountScreen';
import CreatePINScreen from './src/screens/CreatePINScreen';
import PINResetTokenScreen from './src/screens/PINResetTokenScreen';
import PINResetNewPinScreen from './src/screens/PINResetNewPinScreen';
import PINResetSuccessScreen from './src/screens/PINResetSuccessScreen';

// Import product and service screens
import ProductUploadScreen from './src/screens/ProductUploadScreen';
import ProductDetailsScreen from './src/screens/ProductDetailsScreen';
import ServiceUploadScreen from './src/screens/ServiceUploadScreen';
import ServiceDetailsScreen from './src/screens/ServiceDetailsScreen';
import ServiceBookingScreen from './src/screens/ServiceBookingScreen';

// Import cart and checkout screens
import CartScreen from './src/screens/CartScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import GiftCheckoutScreen from './src/screens/GiftCheckoutScreen';
import AddressBookScreen from './src/screens/AddressBookScreen';

// Import order and delivery screens
import OrdersScreen from './src/screens/OrdersScreen';
import OrderTrackingScreen from './src/screens/OrderTrackingScreen';
import GroupedOrderScreen from './src/screens/GroupedOrderScreen';
import RiderSelectionScreen from './src/screens/RiderSelectionScreen';
import RiderDetailScreen from './src/screens/RiderDetailScreen';
import RateOrderScreen from './src/screens/RateOrderScreen';
import { RiderVerificationScreen } from './src/screens/RiderVerificationScreen';

// Import communication screens
import IndividualChatScreen from './src/screens/IndividualChatScreen';

// Import invoice screens
import CreateInvoiceScreen from './src/screens/CreateInvoiceScreen';
import InvoiceDetailsScreen from './src/screens/InvoiceDetailsScreen';

// Import live sales screens
import LiveSalesScreen from './src/screens/LiveSalesScreen';

// Import auction screens
import AuctionDiscoveryScreen from './src/screens/AuctionDiscoveryScreen';
import AuctionCategoryScreen from './src/screens/AuctionCategoryScreen';
import AuctionListScreen from './src/screens/AuctionListScreen';
import AuctionDetailsScreen from './src/screens/AuctionDetailsScreen';
import AuctionBidHistoryScreen from './src/screens/AuctionBidHistoryScreen';
import AuctionWatchlistScreen from './src/screens/AuctionWatchlistScreen';
import CreateAuctionScreen from './src/screens/CreateAuctionScreen';
import LiveStreamViewerScreen from './src/screens/LiveStreamViewerScreen';
import LiveStreamHostScreen from './src/screens/LiveStreamHostScreen';
import LiveStreamBroadcastScreen from './src/screens/LiveStreamBroadcastScreen';
import LiveStreamSetupScreen from './src/screens/LiveStreamSetupScreen';
import LiveMiniCheckoutScreen from './src/screens/LiveMiniCheckoutScreen';
import LiveCartCheckoutScreen from './src/screens/LiveCartCheckoutScreen';
import LiveAuctionCartCheckoutScreen from './src/screens/LiveAuctionCartCheckoutScreen';
import AuctionLiveViewerScreen from './src/screens/AuctionLiveViewerScreen';
import AuctionLiveBroadcastScreen from './src/screens/AuctionLiveBroadcastScreen';
import LiveAuctionDetailsScreen from './src/screens/LiveAuctionDetailsScreen';
import StoresScreen from './src/screens/StoresScreen';

// Import stories screens
import StoriesScreen from './src/screens/StoriesScreen';
import StoryUploadScreen from './src/screens/StoryUploadScreen';
import { ShareStoryScreen } from './src/screens/ShareStoryScreen';
import { StoryDeepLinkScreen } from './src/screens/StoryDeepLinkScreen';

// Import workspace screens
import WorkspaceScreen from './src/screens/WorkspaceScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import VendorOrderDetailsScreen from './src/screens/VendorOrderDetailsScreen';

// Import dispute screens
import DisputesScreen from './src/screens/DisputesScreen';
import CreateDisputeScreen from './src/screens/CreateDisputeScreen';
import DisputeDetailsScreen from './src/screens/DisputeDetailsScreen';

// Import content report screens
import CreateContentReportScreen from './src/screens/CreateContentReportScreen';

// Import account status screen
import { AccountStatusScreen } from './src/screens/AccountStatusScreen';
import { SuspensionScreen } from './src/screens/SuspensionScreen';

// Import notification settings screen
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';

// Import shared wishlist screen
import SharedWishlistScreen from './src/screens/SharedWishlistScreen';

// Import gift screens
import MyGiftsScreen from './src/screens/MyGiftsScreen';
import GiftMarketplaceScreen from './src/screens/GiftMarketplaceScreen';

import { BottomTabNavigator } from './src/navigation/BottomTabNavigator';

const Stack = createStackNavigator();

// Deep linking configuration
const linking: any = {
  prefixes: [Linking.createURL('/'), 'fretiko://', 'https://fretiko.com', 'http://fretiko.com'],
  config: {
    screens: {
      EmailVerification: {
        path: 'auth/callback',
        parse: {
          token: (token: string) => token,
          email: (email: string) => email,
        },
      },
      Main: {
        screens: {
          Stories: 'stories',
        },
      },
      StoryDeepLink: {
        path: 'story/:storyId',
        parse: {
          storyId: (storyId: string) => storyId,
        },
      },
      WalletDeposit: {
        path: 'wallet/deposit/callback',
        parse: {
          deposit_id: (deposit_id: string) => deposit_id,
        },
        screens: {
          Main: 'Wallet', // Navigate to Wallet screen instead of WalletDeposit
        },
      },
      SharedWishlist: {
        path: 'wishlist/:ownerId/:ownerUsername',
        parse: {
          ownerId: (ownerId: string) => ownerId,
          ownerUsername: (ownerUsername: string) => decodeURIComponent(ownerUsername),
        },
      },
      ShareStory: 'share-story',
      Workspace: 'workspace',
      Analytics: 'analytics',
      VendorOrderDetails: {
        path: 'order/:orderId',
        parse: {
          orderId: (orderId: string) => orderId,
        },
      },
    },
  },
};

// Simple error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorSubtext}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Navigation component that handles auth state
const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, isNewUser, isSuspended, isDeleted, isCheckingSuspension } = useAuth();
  const navigationRef = useRef<any>(null);

  // Configure Android notification channels
  useEffect(() => {
    pushNotificationService.configureNotificationChannel();
  }, []);

  // Setup notification handlers
  useEffect(() => {
    console.log('📱 Setting up notification handlers...');

    // Setup notification listeners
    pushNotificationService.setupNotificationListeners({
      onNotificationReceived: (notification) => {
        console.log('📬 Notification received in foreground:', notification.request.content);
        
        // Update badge count
        pushNotificationService.setBadgeCount(1);
        
        // Optional: Show a custom in-app notification banner
        // You can implement a custom notification component here if needed
      },
      onNotificationResponse: (response) => {
        console.log('👆 User tapped on notification:', response.notification.request.content);
        
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        
        if (navigationRef.current) {
          handleNotificationNavigation(data);
        }
      },
    });

    // Cleanup listeners on unmount
    return () => {
      console.log('🔇 Cleaning up notification listeners...');
      pushNotificationService.removeNotificationListeners();
    };
  }, []);

  // Handle navigation based on notification data
  const handleNotificationNavigation = (data: any) => {
    console.log('🧭 Handling notification navigation:', data);

    try {
      const { type, orderId, conversationId, messageId, userId, notificationId } = data;

      switch (type) {
        case 'order_status':
        case 'order_update':
          if (orderId) {
            navigationRef.current?.navigate('GroupedOrder', { orderId });
          }
          break;

        case 'message':
        case 'new_message':
          if (conversationId) {
            navigationRef.current?.navigate('IndividualChat', {
              userId,
              conversationId,
            });
          }
          break;

        case 'delivery_update':
        case 'rider_assigned':
          if (orderId) {
            navigationRef.current?.navigate('OrderTracking', { orderId });
          }
          break;

        case 'payment_received':
        case 'wallet_update':
          navigationRef.current?.navigate('Wallet');
          break;

        case 'connection_request':
          navigationRef.current?.navigate('ConnectionRequests');
          break;

        case 'live_stream_started':
          // Navigate to live stream viewer
          if (data.streamId) {
            navigationRef.current?.navigate('LiveStreamViewer', {
              streamId: data.streamId,
            });
          }
          break;

        case 'auction_update':
        case 'auction_won':
          if (data.auctionId) {
            navigationRef.current?.navigate('AuctionDetails', {
              auctionId: data.auctionId,
            });
          }
          break;

        default:
          console.log('⚠️ Unknown notification type:', type);
          // Navigate to home by default
          navigationRef.current?.navigate('Main');
          break;
      }

      // Clear the notification badge after handling
      pushNotificationService.setBadgeCount(0);
    } catch (error) {
      console.error('❌ Error handling notification navigation:', error);
    }
  };

  // Show loading screen while checking auth state or suspension status
  if (isLoading || isCheckingSuspension) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <View style={styles.loadingTextContainer}>
          {/* Optional: Add loading text for better UX */}
        </View>
      </View>
    );
  }

  // Show suspension screen if user is suspended or deleted (even if not fully authenticated)
  // This allows suspended users to see the screen and submit appeals
  if (isSuspended || isDeleted) {
    return (
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#000000' },
          }}
        >
          <Stack.Screen name="Suspension" component={SuspensionScreen} />
          <Stack.Screen name="AccountStatus" component={AccountStatusScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // Hide default headers for clean look
          cardStyle: { backgroundColor: '#000000' }, // Match app dark theme
          gestureEnabled: true, // Allow swipe back gestures
        }}
        key={`${isAuthenticated}-${isNewUser}-${isSuspended}-${isDeleted}`} // Force re-mount on auth state changes
      >
        {isAuthenticated ? (
          isNewUser ? (
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Main" component={BottomTabNavigator} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen as any} />
              <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
              <Stack.Screen name="RiderVerification" component={RiderVerificationScreen} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Stack.Screen name="AccountStatus" component={AccountStatusScreen} />
              <Stack.Screen name="Suspension" component={SuspensionScreen} />
              <Stack.Screen name="RoleSelection" component={RoleSelectionScreen as any} />
              <Stack.Screen name="ConnectionsList" component={ConnectionsListScreen as any} />
              <Stack.Screen name="ConnectionDetails" component={ConnectionDetailsScreen as any} />
              <Stack.Screen name="ConnectionRequests" component={ConnectionRequestsScreen} />
              <Stack.Screen name="PublicProfile" component={PublicProfileScreen as any} />
              <Stack.Screen name="PublicStore" component={PublicStoreScreen as any} />
              <Stack.Screen name="Wallet" component={WalletScreen} />
              <Stack.Screen name="WalletHistory" component={WalletHistoryScreen} />
              <Stack.Screen name="WalletDeposit" component={WalletDepositScreen} />
              <Stack.Screen name="WalletWithdraw" component={WalletWithdrawScreen} />
              <Stack.Screen name="AddBankAccount" component={AddBankAccountScreen} />
              <Stack.Screen name="CreatePIN" component={CreatePINScreen} />
              <Stack.Screen name="PINResetTokenScreen" component={PINResetTokenScreen} />
              <Stack.Screen name="PINResetNewPinScreen" component={PINResetNewPinScreen} />
              <Stack.Screen name="PINResetSuccessScreen" component={PINResetSuccessScreen} />
              <Stack.Screen name="ProductUpload" component={ProductUploadScreen} />
              <Stack.Screen name="ProductDetails" component={ProductDetailsScreen as any} />
              <Stack.Screen name="ServiceUpload" component={ServiceUploadScreen} />
              <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
              <Stack.Screen name="ServiceBooking" component={ServiceBookingScreen as any} />
              <Stack.Screen name="Cart" component={CartScreen} />
              <Stack.Screen name="Wishlist" component={WishlistScreen} />
              <Stack.Screen name="SharedWishlist" component={SharedWishlistScreen} />
              <Stack.Screen name="Checkout" component={CheckoutScreen} />
              <Stack.Screen name="AddressBook" component={AddressBookScreen} />
              <Stack.Screen name="GiftCheckout" component={GiftCheckoutScreen as any} />
              <Stack.Screen name="Orders" component={OrdersScreen} />
              <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
              <Stack.Screen name="GroupedOrder" component={GroupedOrderScreen as any} />
              <Stack.Screen name="MyGifts" component={MyGiftsScreen} />
              <Stack.Screen name="GiftMarketplace" component={GiftMarketplaceScreen} />
              <Stack.Screen 
                name="RateOrder" 
                component={RateOrderScreen} 
                options={{ 
                  presentation: 'modal',
                  headerShown: false,
                  gestureEnabled: true,
                  cardOverlayEnabled: true,
                }} 
              />
              <Stack.Screen name="RiderSelection" component={RiderSelectionScreen as any} />
              <Stack.Screen name="RiderDetailScreen" component={RiderDetailScreen} />
              <Stack.Screen name="IndividualChatScreen" component={IndividualChatScreen} />
              <Stack.Screen name="CreateInvoice" component={CreateInvoiceScreen} />
              <Stack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} />
              <Stack.Screen name="LiveSales" component={LiveSalesScreen} />
              <Stack.Screen name="LiveStreamViewer" component={LiveStreamViewerScreen} />
              <Stack.Screen name="LiveStreamHost" component={LiveStreamHostScreen} />
              <Stack.Screen name="LiveStreamBroadcast" component={LiveStreamBroadcastScreen} />
              <Stack.Screen name="LiveStreamSetup" component={LiveStreamSetupScreen} />
              <Stack.Screen name="LiveMiniCheckout" component={LiveMiniCheckoutScreen} />
              <Stack.Screen name="LiveCartCheckout" component={LiveCartCheckoutScreen as any} />
              <Stack.Screen name="LiveAuctionCartCheckout" component={LiveAuctionCartCheckoutScreen as any} />
              <Stack.Screen name="Stores" component={StoresScreen} />
              <Stack.Screen name="Stories" component={StoriesScreen} />
              <Stack.Screen name="StoryUpload" component={StoryUploadScreen} />
              <Stack.Screen name="ShareStory" component={ShareStoryScreen} />
              <Stack.Screen name="StoryDeepLink" component={StoryDeepLinkScreen} />
              <Stack.Screen name="Workspace" component={WorkspaceScreen} />
              <Stack.Screen name="Analytics" component={AnalyticsScreen} />
              <Stack.Screen name="VendorOrderDetails" component={VendorOrderDetailsScreen} />
              <Stack.Screen name="Disputes" component={DisputesScreen} />
              <Stack.Screen name="CreateDispute" component={CreateDisputeScreen} />
              <Stack.Screen name="DisputeDetails" component={DisputeDetailsScreen} />
              <Stack.Screen name="CreateContentReport" component={CreateContentReportScreen} />
              <Stack.Screen name="AuctionDiscovery" component={AuctionDiscoveryScreen} />
              <Stack.Screen name="AuctionCategory" component={AuctionCategoryScreen} />
              <Stack.Screen name="AuctionList" component={AuctionListScreen} />
              <Stack.Screen name="AuctionDetails" component={AuctionDetailsScreen} />
              <Stack.Screen name="AuctionBidHistory" component={AuctionBidHistoryScreen} />
              <Stack.Screen name="AuctionWatchlist" component={AuctionWatchlistScreen} />
              <Stack.Screen name="AuctionLiveViewer" component={AuctionLiveViewerScreen} />
              <Stack.Screen name="AuctionLiveBroadcast" component={AuctionLiveBroadcastScreen} />
              <Stack.Screen name="LiveAuctionDetails" component={LiveAuctionDetailsScreen} />
              <Stack.Screen name="CreateAuction" component={CreateAuctionScreen} />
            </>
          )
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen as any} />
            <Stack.Screen name="EmailVerification" component={EmailVerificationScreen as any} />
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <RegistrationProvider>
          <AuthProvider>
            <CartProvider>
              <FilterProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <AppNavigator />
                  <StatusBar style="light" backgroundColor="#000000" />
                </GestureHandlerRootView>
              </FilterProvider>
            </CartProvider>
          </AuthProvider>
        </RegistrationProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000', // Match app theme
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTextContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
});
