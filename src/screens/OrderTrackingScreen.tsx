import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
// import MapView, { Marker, Polyline } from 'expo-maps'; // Temporarily disabled
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ordersAPI, OrderDetails } from '../services/ordersAPI';
import { walletAPI } from '../services/walletAPI';

const { width, height } = Dimensions.get('window');

interface OrderPhase {
  phase: 'vendor' | 'rider' | 'buyer';
  status: 'pending' | 'active' | 'completed';
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number; // in minutes
}

interface TimerInfo {
  timeRemaining: number; // in seconds
  totalTime: number; // in seconds
  isOverdue: boolean;
  overdueBy: number; // in seconds
}

interface RiderLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp: string;
}

interface OrderWithTracking extends OrderDetails {
  currentPhase: OrderPhase;
  timerInfo?: TimerInfo;
  riderLocation?: RiderLocation;
  vendorLocation?: { latitude: number; longitude: number; address: string };
  buyerLocation?: { latitude: number; longitude: number; address: string };
  riderInfo?: {
    riderId: string;
    riderName: string;
    vehicleType: 'bike' | 'car' | 'wheelbarrow';
    phone: string;
    avatar?: string;
  };
  escrowInfo?: {
    status: 'held' | 'released' | 'disputed';
    autoReleaseTime?: string;
    canRelease: boolean;
  };
}

const OrderTrackingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { orderId } = route.params as { orderId: string };
  // const mapRef = useRef<MapView>(null); // Temporarily disabled
  
  const [order, setOrder] = useState<OrderWithTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [userRole, setUserRole] = useState<'vendor' | 'rider' | 'buyer'>('buyer'); // This would come from auth context
  const [locationPermission, setLocationPermission] = useState<boolean>(false);

  // Real-time updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (order && order.timerInfo) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const newTime = prev - 1;
          if (newTime <= 0 && !order.timerInfo?.isOverdue) {
            // Timer expired - trigger appropriate action
            handleTimerExpired();
          }
          return newTime;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [order]);

  useEffect(() => {
    initializeTracking();
    
    // Set up real-time location updates
    const locationInterval = setInterval(() => {
      if (order?.currentPhase.phase === 'rider') {
        updateRiderLocation();
      }
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(locationInterval);
  }, [orderId]);

  const initializeTracking = async () => {
    await requestLocationPermission();
    await loadOrderDetails();
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location access is needed to show real-time tracking.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      // This would be enhanced API call that includes tracking data
      const orderData = await ordersAPI.getOrderDetails(orderId);
      
      // Mock enhanced data - in real app this comes from API
      const enhancedOrder: OrderWithTracking = {
        ...orderData,
        currentPhase: {
          phase: 'rider', // This determines which phase is active
          status: 'active',
          startTime: new Date().toISOString(),
          estimatedDuration: 30, // 30 minutes for delivery
        },
        timerInfo: {
          timeRemaining: 1800, // 30 minutes in seconds
          totalTime: 1800,
          isOverdue: false,
          overdueBy: 0,
        },
        riderLocation: {
          latitude: 6.5244,
          longitude: 3.3792,
          timestamp: new Date().toISOString(),
        },
        vendorLocation: {
          latitude: 6.5200,
          longitude: 3.3750,
          address: "Tech Hub, Victoria Island, Lagos",
        },
        buyerLocation: {
          latitude: 6.5300,
          longitude: 3.3850,
          address: orderData.deliveryAddress?.address || "Delivery Address",
        },
        riderInfo: {
          riderId: 'rider-123',
          riderName: 'John Adebayo',
          vehicleType: 'bike',
          phone: '+234 801 234 5678',
          avatar: 'https://picsum.photos/100/100?random=1',
        },
        escrowInfo: {
          status: 'held',
          autoReleaseTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
          canRelease: false,
        },
      };
      
      setOrder(enhancedOrder);
      setTimerSeconds(enhancedOrder.timerInfo?.timeRemaining || 0);
      
    } catch (error) {
      console.error('Error loading order details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateRiderLocation = async () => {
    // In real app, this would fetch live GPS coordinates
    if (order) {
      const mockLocation: RiderLocation = {
        latitude: order.riderLocation!.latitude + (Math.random() - 0.5) * 0.001,
        longitude: order.riderLocation!.longitude + (Math.random() - 0.5) * 0.001,
        timestamp: new Date().toISOString(),
      };
      
      setOrder(prev => prev ? { ...prev, riderLocation: mockLocation } : null);
    }
  };

  const handleTimerExpired = () => {
    if (!order) return;
    
    switch (order.currentPhase.phase) {
      case 'vendor':
        Alert.alert('Order Overdue', 'This order is past the promised delivery time. The vendor\'s trust score will be affected.');
        break;
      case 'rider':
        Alert.alert('Delivery Delayed', 'The delivery is running late. Looking for alternative riders...');
        // Auto-reassign rider logic would go here
        break;
      case 'buyer':
        // Auto-release escrow
        handleAutoReleaseEscrow();
        break;
    }
  };

  const handleMilestoneAction = async (action: string) => {
    try {
      switch (action) {
        case 'preparing_order':
          // Vendor acknowledges order
          await ordersAPI.updateOrderStatus(orderId, 'processing');
          break;
        case 'ready_for_pickup':
          // Vendor marks ready, activates rider
          await ordersAPI.updateOrderStatus(orderId, 'ready_for_pickup');
          break;
        case 'picked_up':
          // Rider confirms pickup
          await ordersAPI.updateOrderStatus(orderId, 'picked_up');
          break;
        case 'delivered':
          // Rider marks as delivered
          await ordersAPI.updateOrderStatus(orderId, 'delivered');
          break;
        case 'order_received':
          // Buyer confirms receipt
          await handleOrderReceived();
          break;
      }
      
      // Reload order data
      await loadOrderDetails();
      
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status. Please try again.');
    }
  };

  const handleOrderReceived = async () => {
    try {
      // Simple verification - just release funds
      await ordersAPI.confirmOrderReceived(orderId);
      
      Alert.alert(
        'Order Confirmed',
        'Thank you for confirming your order. Funds have been released to the vendor.',
        [
          {
            text: 'Rate Order',
            onPress: () => navigation.navigate('RateOrder', { orderId }),
          },
          { text: 'Close', style: 'cancel' },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm order receipt.');
    }
  };

  const handleAutoReleaseEscrow = async () => {
    try {
      await ordersAPI.autoReleaseEscrow(orderId);
      Alert.alert('Funds Released', 'Funds have been automatically released to the vendor.');
      await loadOrderDetails();
    } catch (error) {
      console.error('Auto-release failed:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getAutoReleaseTime = (): string => {
    if (!order?.escrowInfo?.autoReleaseTime) return '';
    
    const releaseTime = new Date(order.escrowInfo.autoReleaseTime);
    const now = new Date();
    const diffMs = releaseTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffMs <= 0) return 'Overdue';
    if (diffHours > 0) return `${diffHours}h ${diffMinutes}m`;
    return `${diffMinutes}m`;
  };

  const renderMap = () => {
    if (!locationPermission) {
      return (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="location-off" size={40} color="#888" />
          <Text style={styles.mapPlaceholderText}>Location Permission Required</Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestLocationPermission}
          >
            <Text style={styles.permissionButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!order || !order.riderLocation || !order.vendorLocation || !order.buyerLocation) {
      return (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="location-outline" size={40} color="#888" />
          <Text style={styles.mapPlaceholderText}>Loading tracking data...</Text>
        </View>
      );
    }

    const { riderLocation, vendorLocation, buyerLocation } = order;
    
    return (
      <View style={styles.map}>
        {/* Temporary Map Placeholder - expo-maps disabled */}
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={60} color="#666" />
          <Text style={styles.mapPlaceholderText}>Map View</Text>
          <Text style={styles.mapPlaceholderSubtext}>
            Tracking: {order.riderInfo?.riderName || 'Delivery Rider'}
          </Text>
          <View style={styles.locationInfo}>
            <Text style={styles.locationText}>📍 From: {vendorLocation.address}</Text>
            <Text style={styles.locationText}>🏠 To: {buyerLocation.address}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTimerSection = () => {
    if (!order?.timerInfo) return null;

    const { timeRemaining, isOverdue } = order.timerInfo;
    const displayTime = Math.abs(timerSeconds || timeRemaining);
    
    return (
      <View style={styles.timerSection}>
        <View style={styles.timerHeader}>
          <Text style={styles.timerTitle}>
            {order.currentPhase.phase === 'vendor' && 'Vendor Preparation Time'}
            {order.currentPhase.phase === 'rider' && 'Delivery in Progress'}
            {order.currentPhase.phase === 'buyer' && 'Confirm Your Order'}
          </Text>
          
          {order.currentPhase.phase === 'buyer' && order.escrowInfo && (
            <Text style={styles.autoReleaseText}>
              Auto-release in: {getAutoReleaseTime()}
            </Text>
          )}
        </View>
        
        <View style={[
          styles.timerDisplay,
          { backgroundColor: isOverdue ? '#E74C3C' : '#3498DB' }
        ]}>
          <Text style={styles.timerText}>
            {isOverdue ? '+' : ''}{formatTime(displayTime)}
          </Text>
          <Text style={styles.timerSubtext}>
            {isOverdue ? 'Overdue' : 'Remaining'}
          </Text>
        </View>

        {/* Multi-item note */}
        {order.items.length > 1 && (
          <Text style={styles.multiItemNote}>
            📦 Some items may arrive earlier than others
          </Text>
        )}
      </View>
    );
  };

  const renderMilestoneButtons = () => {
    if (!order) return null;

    const { currentPhase } = order;
    
    // Show buttons based on user role and current phase
    const shouldShowButton = (phase: string) => {
      switch (phase) {
        case 'preparing_order':
        case 'ready_for_pickup':
          return userRole === 'vendor' && currentPhase.phase === 'vendor';
        case 'picked_up':
        case 'delivered':
          return userRole === 'rider' && currentPhase.phase === 'rider';
        case 'order_received':
          return userRole === 'buyer' && currentPhase.phase === 'buyer';
        default:
          return false;
      }
    };

    return (
      <View style={styles.milestoneSection}>
        <Text style={styles.sectionTitle}>Order Progress</Text>
        
        <View style={styles.milestoneButtons}>
          {shouldShowButton('preparing_order') && (
            <TouchableOpacity 
              style={styles.milestoneButton}
              onPress={() => handleMilestoneAction('preparing_order')}
            >
              <Ionicons name="checkmark-circle-outline" size={24} color="#3498DB" />
              <Text style={styles.milestoneButtonText}>Mark as Preparing</Text>
            </TouchableOpacity>
          )}

          {shouldShowButton('ready_for_pickup') && (
            <TouchableOpacity 
              style={styles.milestoneButton}
              onPress={() => handleMilestoneAction('ready_for_pickup')}
            >
              <Ionicons name="cube-outline" size={24} color="#27AE60" />
              <Text style={styles.milestoneButtonText}>Ready for Pickup</Text>
            </TouchableOpacity>
          )}

          {shouldShowButton('picked_up') && (
            <TouchableOpacity 
              style={styles.milestoneButton}
              onPress={() => handleMilestoneAction('picked_up')}
            >
              <Ionicons name="car-outline" size={24} color="#F39C12" />
              <Text style={styles.milestoneButtonText}>Picked Up Order</Text>
            </TouchableOpacity>
          )}

          {shouldShowButton('delivered') && (
            <TouchableOpacity 
              style={styles.milestoneButton}
              onPress={() => handleMilestoneAction('delivered')}
            >
              <Ionicons name="home-outline" size={24} color="#9B59B6" />
              <Text style={styles.milestoneButtonText}>Mark as Delivered</Text>
            </TouchableOpacity>
          )}

          {shouldShowButton('order_received') && (
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={() => handleMilestoneAction('order_received')}
            >
              <Ionicons name="checkmark-done" size={24} color="white" />
              <Text style={styles.confirmButtonText}>Confirm Order Received</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderRiderInfo = () => {
    if (!order?.riderInfo || order.currentPhase.phase === 'vendor') return null;

    return (
      <View style={styles.riderSection}>
        <Text style={styles.sectionTitle}>Your Delivery Rider</Text>
        <View style={styles.riderCard}>
          <Image 
            source={{ uri: order.riderInfo.avatar || 'https://picsum.photos/60/60?random=1' }}
            style={styles.riderAvatar}
          />
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>{order.riderInfo.riderName}</Text>
            <Text style={styles.riderVehicle}>
              {order.riderInfo.vehicleType.charAt(0).toUpperCase() + order.riderInfo.vehicleType.slice(1)} delivery
            </Text>
            <Text style={styles.riderPhone}>{order.riderInfo.phone}</Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call" size={20} color="#27AE60" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading || !order) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading order tracking...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrderDetails();
            }}
            tintColor="#3498DB"
          />
        }
      >
        {/* Timer Section */}
        {renderTimerSection()}

        {/* Real-time Map */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionTitle}>Live Tracking</Text>
          {renderMap()}
        </View>

        {/* Rider Information */}
        {renderRiderInfo()}

        {/* Milestone Buttons */}
        {renderMilestoneButtons()}

        {/* Escrow Status */}
        {order.escrowInfo && (
          <View style={styles.escrowSection}>
            <Text style={styles.sectionTitle}>Payment Status</Text>
            <View style={styles.escrowCard}>
              <Ionicons 
                name="shield-checkmark" 
                size={24} 
                color={order.escrowInfo.status === 'held' ? '#F39C12' : '#27AE60'} 
              />
              <View style={styles.escrowDetails}>
                <Text style={styles.escrowStatus}>
                  Funds {order.escrowInfo.status === 'held' ? 'Secured in Escrow' : 'Released to Vendor'}
                </Text>
                <Text style={styles.escrowDescription}>
                  {order.escrowInfo.status === 'held' 
                    ? 'Your money is safe until you confirm delivery'
                    : 'Payment has been completed'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items ({order.items.length})</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Image source={{ uri: item.image }} style={styles.itemImage} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.itemSeller}>Sold by {item.sellerName}</Text>
                <View style={styles.itemPricing}>
                  <Text style={styles.itemPrice}>{walletAPI.formatFreti(item.price)}</Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  shareButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  timerSection: {
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  timerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  autoReleaseText: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '600',
  },
  timerDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  timerText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timerSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  multiItemNote: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  mapSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  mapPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  mapPlaceholderSubtext: {
    color: '#666',
    fontSize: 12,
    marginBottom: 16,
  },
  locationInfo: {
    alignItems: 'center',
  },
  locationText: {
    color: '#999',
    fontSize: 11,
    marginVertical: 2,
  },
  permissionButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  vendorMarker: {
    backgroundColor: '#3498DB',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  buyerMarker: {
    backgroundColor: '#27AE60',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  riderMarker: {
    backgroundColor: '#F39C12',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  riderSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  riderAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  riderVehicle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  riderPhone: {
    color: '#3498DB',
    fontSize: 14,
  },
  callButton: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    padding: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27AE60',
  },
  milestoneSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  milestoneButtons: {
    gap: 12,
  },
  milestoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  milestoneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    padding: 16,
    borderRadius: 12,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  escrowSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  escrowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
  },
  escrowDetails: {
    flex: 1,
    marginLeft: 16,
  },
  escrowStatus: {
    color: '#F39C12',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  escrowDescription: {
    color: '#888',
    fontSize: 14,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemSeller: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemQuantity: {
    color: '#888',
    fontSize: 14,
  },
});

export default OrderTrackingScreen;