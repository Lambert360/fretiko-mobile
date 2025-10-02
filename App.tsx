import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';

// Import base64 polyfill first
import './src/utils/base64-polyfill';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

// Import contexts
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';

// Import auth screens
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';

// Import profile and user screens
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { RoleSelectionScreen } from './src/screens/RoleSelectionScreen';
import { ConnectionsListScreen } from './src/screens/ConnectionsListScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import { PublicStoreScreen } from './src/screens/PublicStoreScreen';

// Import wallet screens
import { WalletScreen } from './src/screens/WalletScreen';
import { WalletHistoryScreen } from './src/screens/WalletHistoryScreen';
import WalletDepositScreen from './src/screens/WalletDepositScreen';
import WalletWithdrawScreen from './src/screens/WalletWithdrawScreen';

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

// Import order and delivery screens
import OrdersScreen from './src/screens/OrdersScreen';
import OrderTrackingScreen from './src/screens/OrderTrackingScreen';
import RiderSelectionScreen from './src/screens/RiderSelectionScreen';

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
import CreateAuctionScreen from './src/screens/CreateAuctionScreen';
import LiveStreamViewerScreen from './src/screens/LiveStreamViewerScreen';
import LiveStreamHostScreen from './src/screens/LiveStreamHostScreen';
import LiveStreamSetupScreen from './src/screens/LiveStreamSetupScreen';
import LiveMiniCheckoutScreen from './src/screens/LiveMiniCheckoutScreen';
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

import { BottomTabNavigator } from './src/navigation/BottomTabNavigator';

const Stack = createStackNavigator();

// Deep linking configuration
const linking = {
  prefixes: [Linking.createURL('/'), 'fretiko://', 'https://fretiko.com', 'http://fretiko.com'],
  config: {
    screens: {
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
  const { isAuthenticated, isLoading, isNewUser } = useAuth();

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <View style={styles.loadingTextContainer}>
          {/* Optional: Add loading text for better UX */}
        </View>
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // Hide default headers for clean look
          cardStyle: { backgroundColor: '#000000' }, // Match app dark theme
          animationEnabled: true, // Smooth transitions
          gestureEnabled: true, // Allow swipe back gestures
        }}
      >
        {isAuthenticated ? (
          // User is logged in
          isNewUser ? (
            // New user - show role selection first
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
          ) : (
            // Existing user - show main app with bottom tabs
            <>
              {/* Main app with bottom tabs */}
              <Stack.Screen name="Main" component={BottomTabNavigator} />
              
              {/* Profile and user management screens */}
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
              <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
              <Stack.Screen name="ConnectionsList" component={ConnectionsListScreen} />
              <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
              <Stack.Screen name="PublicStore" component={PublicStoreScreen} />
              
              {/* Wallet screens */}
              <Stack.Screen name="Wallet" component={WalletScreen} />
              <Stack.Screen name="WalletHistory" component={WalletHistoryScreen} />
              <Stack.Screen name="WalletDeposit" component={WalletDepositScreen} />
              <Stack.Screen name="WalletWithdraw" component={WalletWithdrawScreen} />
              
              {/* Product screens */}
              <Stack.Screen name="ProductUpload" component={ProductUploadScreen} />
              <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
              
              {/* Service screens */}
              <Stack.Screen name="ServiceUpload" component={ServiceUploadScreen} />
              <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
              <Stack.Screen name="ServiceBooking" component={ServiceBookingScreen} />
              
              {/* Cart and checkout screens */}
              <Stack.Screen name="Cart" component={CartScreen} />
              <Stack.Screen name="Wishlist" component={WishlistScreen} />
              <Stack.Screen name="Checkout" component={CheckoutScreen} />
              
              {/* Order and delivery screens */}
              <Stack.Screen name="Orders" component={OrdersScreen} />
              <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
              <Stack.Screen name="RiderSelection" component={RiderSelectionScreen} />
              
              {/* Communication screens */}
              <Stack.Screen name="IndividualChatScreen" component={IndividualChatScreen} />

              {/* Invoice screens */}
              <Stack.Screen name="CreateInvoice" component={CreateInvoiceScreen} />
              <Stack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} />

              {/* Live sales screens */}
              <Stack.Screen name="LiveSales" component={LiveSalesScreen} />
              <Stack.Screen name="LiveStreamViewer" component={LiveStreamViewerScreen} />
              <Stack.Screen name="LiveStreamHost" component={LiveStreamHostScreen} />
              <Stack.Screen name="LiveStreamSetup" component={LiveStreamSetupScreen} />
              <Stack.Screen name="LiveMiniCheckout" component={LiveMiniCheckoutScreen} />
              
              {/* Stores screen */}
              <Stack.Screen name="Stores" component={StoresScreen} />

              {/* Stories screens */}
              <Stack.Screen name="Stories" component={StoriesScreen} />
              <Stack.Screen name="StoryUpload" component={StoryUploadScreen} />
              <Stack.Screen name="ShareStory" component={ShareStoryScreen} />
              <Stack.Screen name="StoryDeepLink" component={StoryDeepLinkScreen} />

              {/* Workspace screens */}
              <Stack.Screen name="Workspace" component={WorkspaceScreen} />
              <Stack.Screen name="Analytics" component={AnalyticsScreen} />
              <Stack.Screen name="VendorOrderDetails" component={VendorOrderDetailsScreen} />

              {/* Auction screens */}
              <Stack.Screen name="AuctionDiscovery" component={AuctionDiscoveryScreen} />
              <Stack.Screen name="AuctionCategory" component={AuctionCategoryScreen} />
              <Stack.Screen name="AuctionList" component={AuctionListScreen} />
              <Stack.Screen name="AuctionDetails" component={AuctionDetailsScreen} />
              <Stack.Screen name="CreateAuction" component={CreateAuctionScreen} />
            </>
          )
        ) : (
          // User is not logged in - show auth screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <AppNavigator />
          <StatusBar style="light" backgroundColor="#000000" />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
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
