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
// import * as Battery from 'expo-battery'; // Uncomment if expo-battery is installed (may not work in Expo Go)
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ordersAPI, OrderDetails } from '../services/ordersAPI';
import { walletAPI } from '../services/walletAPI';
import { riderLocationAPI } from '../services/riderLocationAPI';
import { realtimeAPI } from '../services/realtimeAPI';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth();
  // const mapRef = useRef<MapView>(null); // Temporarily disabled

  const [order, setOrder] = useState<OrderWithTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true); // ✨ NEW: Separate loading for map/tracking
  const [refreshing, setRefreshing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [userRole, setUserRole] = useState<'vendor' | 'rider' | 'buyer'>('buyer');
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [distance, setDistance] = useState<number>(0);
  const [eta, setETA] = useState<number>(0);
  const [riderAddress, setRiderAddress] = useState<string>('');

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

  // ✅ Initialize tracking once on mount
  useEffect(() => {
    initializeTracking();
  }, [orderId]);

  // ✅ Separate effect for WebSocket subscriptions (only depends on orderId)
  useEffect(() => {
    console.log('🔌 Setting up WebSocket listeners for order:', orderId);

    // ✅ Subscribe to real-time rider location updates (MAP ONLY)
    const riderLocationListener = realtimeAPI.subscribe('rider_location_update', (data: any) => {
      console.log('🏍️ Rider location update received:', data);
      
      // ✅ ONLY update location fields, don't trigger full re-render
      if (data.orderId === orderId && data.latitude && data.longitude) {
        // Update rider location without touching order data
        setOrder(prev => {
          if (!prev) return null;
          
          // Skip if order is already delivered (no need for map updates)
          if (prev.status === 'delivered') return prev;
          
          // Create new object ONLY if location actually changed (avoid unnecessary renders)
          const locationChanged = !prev.riderLocation || 
            prev.riderLocation.latitude !== data.latitude || 
            prev.riderLocation.longitude !== data.longitude;
          
          if (!locationChanged) return prev; // No change, return same reference
          
          return {
            ...prev,
            riderLocation: {
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading,
              timestamp: data.timestamp,
            },
          };
        });

        // Recalculate distance and ETA (independent state)
        setOrder(prev => {
          if (prev?.buyerLocation) {
            const dist = riderLocationAPI.calculateDistance(
              { latitude: data.latitude, longitude: data.longitude },
              prev.buyerLocation
            );
            setDistance(dist);
            
            const etaMinutes = Math.ceil((dist / 30) * 60);
            setETA(etaMinutes);
          }
          return prev;
        });
      }
    });

    // ✅ Subscribe to order status updates (BUTTON STATE ONLY)
    const orderStatusListener = realtimeAPI.subscribe('order_status_update', (data: any) => {
      console.log('📦 Order status update received:', data);
      
      // ✅ ONLY update status field, don't reload entire order
      if (data.orderId === orderId && data.status) {
        setOrder(prev => {
          if (!prev) return null;
          
          // Only update if status actually changed
          if (prev.status === data.status) return prev;
          
          return {
            ...prev,
            status: data.status,
            // Update metadata if provided
            ...(data.metadata && { metadata: { ...prev.metadata, ...data.metadata } })
          };
        });
        
        // Don't call loadOrderDetails() - it causes full reload!
        console.log(`✅ Order status updated to: ${data.status}`);
      }
    });

    // Cleanup
    return () => {
      console.log('🔌 Cleaning up WebSocket listeners for order:', orderId);
      riderLocationListener();
      orderStatusListener();
    };
  }, [orderId]); // ✅ Only re-subscribe if orderId changes

  // ✅ Separate effect for location polling fallback
  useEffect(() => {
    // Don't poll if order is already delivered
    if (order?.status === 'delivered') return;
    
    // Fallback: Set up polling for location updates (in case WebSocket fails)
    const locationInterval = setInterval(() => {
      if (order?.currentPhase.phase === 'rider' && userRole !== 'rider') {
        updateRiderLocation();
      }
    }, 30000); // Poll every 30 seconds as fallback only (WebSocket is primary)

    return () => {
      clearInterval(locationInterval);
    };
  }, [order?.status, order?.currentPhase?.phase, userRole]);

  // Background location updates for riders (send location to backend)
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startRiderLocationUpdates = async () => {
      // Only start if user is a rider and has location permission
      if (userRole !== 'rider' || !locationPermission) return;

      try {
        // Check if user has an active order (is currently on a delivery)
        const hasActiveOrder = order?.currentPhase.phase === 'rider';

        // Request background location permission
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

        if (backgroundStatus !== 'granted') {
          console.log('⚠️ Background location permission not granted');
          // Fall back to foreground updates
        }

        // Start watching position
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 10, // Or when moved 10 meters
          },
          async (location) => {
            try {
              // Get battery level (with fallback for Expo Go)
              let batteryLevel: number | undefined = undefined;
              try {
                // Uncomment if expo-battery is installed:
                // const batteryState = await Battery.getBatteryLevelAsync();
                // batteryLevel = Math.round(batteryState * 100);
              } catch (batteryError) {
                // Battery API not available (Expo Go or not installed)
                console.log('⚠️ Battery API not available');
              }

              // Send location to backend
              await riderLocationAPI.updateRiderLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || undefined,
                isOnline: true,
                isAvailable: !hasActiveOrder, // Not available if on active delivery
                batteryLevel,
              });

              console.log('📍 Rider location updated:', {
                lat: location.coords.latitude,
                lon: location.coords.longitude,
                battery: batteryLevel ? `${batteryLevel}%` : 'N/A',
              });
            } catch (error) {
              console.error('Error sending rider location:', error);
            }
          }
        );
      } catch (error) {
        console.error('Error starting rider location updates:', error);
      }
    };

    // Start location updates if user is a rider
    if (userRole === 'rider' && locationPermission) {
      startRiderLocationUpdates();
    }

    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [userRole, locationPermission, order?.currentPhase.phase]);

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
      // ✅ STEP 1: Load ONLY core order data (fast - 200ms)
      if (!refreshing && !order) {
        setLoading(true);
      }

      const orderData = await ordersAPI.getOrderDetails(orderId);
      
      // ✅ STEP 2: Set order data immediately - UI can render NOW!
      setOrder({
        ...orderData,
        // Leave tracking fields undefined - they'll load separately
        currentPhase: { phase: 'vendor', status: 'pending' },
        timerInfo: undefined,
        riderLocation: undefined,
        vendorLocation: undefined,
        buyerLocation: undefined,
        riderInfo: undefined,
        escrowInfo: undefined,
      });
      
      setLoading(false); // ← Screen renders immediately!

      // ✅ STEP 3: Load tracking data ONLY if needed (for map section)
      // This is completely decoupled from order data
      loadTrackingDataIndependently();

    } catch (error) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', 'Failed to load order details');
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ NEW: Load tracking data independently without affecting order state
  const loadTrackingDataIndependently = async () => {
    try {
      setMapLoading(true);
      
      const trackingData = await ordersAPI.getOrderTrackingData(orderId);

      // ✅ ONLY update tracking-related fields, not the entire order
      setOrder(prev => prev ? {
        ...prev,
        currentPhase: trackingData.currentPhase,
        timerInfo: trackingData.timerInfo,
        riderLocation: trackingData.riderLocation,
        vendorLocation: trackingData.vendorLocation,
        buyerLocation: trackingData.buyerLocation,
        riderInfo: trackingData.riderInfo,
        escrowInfo: trackingData.escrowInfo,
      } : null);

      // Set timer from tracking data
      if (trackingData.timerInfo) {
        setTimerSeconds(trackingData.timerInfo.timeRemaining || 0);
      }

      // Calculate distance and ETA if rider location is available
      if (trackingData.riderLocation && trackingData.buyerLocation) {
        const dist = riderLocationAPI.calculateDistance(
          trackingData.riderLocation.latitude,
          trackingData.riderLocation.longitude,
          trackingData.buyerLocation.latitude,
          trackingData.buyerLocation.longitude
        );
        setDistance(dist);

        const estimatedTime = riderLocationAPI.calculateETA(
          dist,
          trackingData.riderInfo?.vehicleType || 'bike'
        );
        setETA(estimatedTime);
      }

    } catch (error) {
      console.error('Error loading tracking data (non-critical):', error);
      // Don't show alert - tracking is optional, order details already loaded
    } finally {
      setMapLoading(false);
    }
  };

  const updateRiderLocation = async () => {
    // ✅ Fetch real GPS coordinates from backend (MAP ONLY)
    if (order?.riderInfo?.riderId) {
      try {
        const locationData = await riderLocationAPI.getRiderLocation(order.riderInfo.riderId);

        if (locationData) {
          // ✅ Check if location actually changed before updating state
          const locationChanged = !order.riderLocation || 
            order.riderLocation.latitude !== locationData.latitude || 
            order.riderLocation.longitude !== locationData.longitude;
          
          if (!locationChanged) {
            console.log('🏍️ Rider location unchanged, skipping update');
            return; // Skip update if location hasn't changed
          }

          const updatedLocation: RiderLocation = {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            timestamp: locationData.lastPing,
          };

          // ✅ Only update riderLocation field, nothing else
          setOrder(prev => prev ? { ...prev, riderLocation: updatedLocation } : null);

          // Recalculate distance and ETA (independent state)
          if (order.buyerLocation) {
            const dist = riderLocationAPI.calculateDistance(
              locationData.latitude,
              locationData.longitude,
              order.buyerLocation.latitude,
              order.buyerLocation.longitude
            );
            setDistance(dist);

            const estimatedTime = riderLocationAPI.calculateETA(
              dist,
              order.riderInfo?.vehicleType || 'bike'
            );
            setETA(estimatedTime);
          }

          // Reverse geocode rider's location to get readable address
          reverseGeocodeRiderLocation(locationData.latitude, locationData.longitude);
        }
      } catch (error) {
        console.error('Error fetching rider location:', error);
      }
    }
  };

  const reverseGeocodeRiderLocation = async (latitude: number, longitude: number) => {
    try {
      const geocodedAddress = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (geocodedAddress && geocodedAddress.length > 0) {
        const address = geocodedAddress[0];
        const formattedAddress = [
          address.street,
          address.district || address.subregion,
          address.city,
        ]
          .filter(Boolean)
          .join(', ');

        setRiderAddress(formattedAddress || 'Location updating...');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      setRiderAddress('Heading to you...');
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
      console.log(`✅ Buyer confirming order receipt for: ${orderId}`);
      
      // Confirm order and release funds immediately
      await ordersAPI.confirmOrderReceived(orderId);
      
      console.log(`✅ Order confirmed successfully!`);
      
      // Navigate directly to rating screen (don't wait for reload)
      navigation.navigate('RateOrder', { orderId });
      
      // Try to reload order details in background (non-blocking)
      setTimeout(async () => {
        try {
          await loadOrderDetails();
          console.log(`✅ Order details reloaded successfully`);
        } catch (reloadError) {
          console.warn('⚠️ Failed to reload order details (non-critical):', reloadError);
          // Update status manually if reload fails
          setOrder(prev => prev ? { ...prev, status: 'completed' } : null);
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Error confirming order receipt:', error);
      Alert.alert('Error', 'Failed to confirm order receipt. Please try again.');
    }
  };

  // ✅ Buyer confirms and releases funds immediately
  const handleReleaseFunds = async () => {
    Alert.alert(
      'Release Funds',
      'Are you satisfied with your order? This will immediately release funds to the vendor and rider.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Release Funds',
          style: 'default',
          onPress: async () => {
            try {
              const result = await ordersAPI.confirmAndReleaseFunds(orderId);
              Alert.alert('Success', result.message);
              await loadOrderDetails();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to release funds');
            }
          },
        },
      ]
    );
  };

  // ✅ Buyer reports issue with order
  const handleReportIssue = async () => {
    Alert.prompt(
      'Report Issue',
      'Please describe the issue with your order:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit',
          onPress: async (description) => {
            if (!description || description.trim() === '') {
              Alert.alert('Error', 'Please provide a description');
              return;
            }

            try {
              const result = await ordersAPI.reportIssue(orderId, 'Order issue', description);
              Alert.alert('Issue Reported', result.message);
              await loadOrderDetails();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to report issue');
            }
          },
        },
      ],
      'plain-text'
    );
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

    // ✨ Show loading spinner specifically for map while rest of screen is interactive
    if (mapLoading || !order.riderLocation || !order.vendorLocation || !order.buyerLocation) {
      return (
        <View style={styles.mapPlaceholder}>
          <View style={styles.spinnerContainer}>
            <View style={styles.spinner} />
            <Ionicons name="location-outline" size={40} color="#3498DB" style={{ marginTop: 16 }} />
            <Text style={styles.mapPlaceholderText}>Loading live tracking...</Text>
            <Text style={styles.mapSubText}>Map will appear shortly</Text>
          </View>
        </View>
      );
    }

    const { riderLocation, vendorLocation, buyerLocation } = order;
    
    return (
      <View style={styles.map}>
        {/* Enhanced Map Placeholder with Real Tracking Data */}
        <View style={styles.enhancedPlaceholder}>
          {/* Distance and ETA Header */}
          <View style={styles.trackingHeader}>
            <View style={styles.trackingMetric}>
              <Ionicons name="location" size={24} color="#3498DB" />
              <Text style={styles.metricValue}>{riderLocationAPI.formatDistance(distance)}</Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.trackingDivider} />
            <View style={styles.trackingMetric}>
              <Ionicons name="time" size={24} color="#27AE60" />
              <Text style={styles.metricValue}>{riderLocationAPI.formatETA(eta)}</Text>
              <Text style={styles.metricLabel}>ETA</Text>
            </View>
          </View>

          {/* Rider Status */}
          <View style={styles.riderStatus}>
            <View style={styles.statusIndicator}>
              <View style={styles.pulseIndicator} />
              <Text style={styles.statusText}>In Transit</Text>
            </View>
            {order.riderLocation && (
              <Text style={styles.accuracyText}>
                📶 Accuracy: {Math.round((order.riderLocation.accuracy || 10))}m
              </Text>
            )}
          </View>

          {/* Rider Current Location */}
          {riderAddress && (
            <View style={styles.currentLocationBanner}>
              <Ionicons name="navigate" size={16} color="#3498DB" />
              <Text style={styles.currentLocationText} numberOfLines={1}>
                {riderAddress}
              </Text>
            </View>
          )}

          {/* Route Information */}
          <View style={styles.routeInfo}>
            <View style={styles.routePoint}>
              <Ionicons name="storefront" size={16} color="#3498DB" />
              <Text style={styles.routeText} numberOfLines={1}>
                {vendorLocation.address}
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <Ionicons name="home" size={16} color="#27AE60" />
              <Text style={styles.routeText} numberOfLines={1}>
                {buyerLocation.address}
              </Text>
            </View>
          </View>

          {/* Battery Level if available */}
          {order.riderLocation && order.riderInfo?.riderId && (
            <View style={styles.batteryInfo}>
              <Ionicons name="battery-half" size={16} color="#F39C12" />
              <Text style={styles.batteryText}>Rider's battery: Available</Text>
            </View>
          )}
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

          {/* ✅ NEW BUYER ACTION BUTTONS - Show when order is delivered */}
          {order?.status === 'delivered' && (
            <View style={styles.buyerActionsContainer}>
              <Text style={styles.buyerActionsTitle}>Order Delivered - What would you like to do?</Text>
              
              {/* 24-hour countdown timer */}
              {order?.escrowReleaseAt && (
                <View style={styles.timerContainer}>
                  <Ionicons name="time-outline" size={16} color="#FF9500" />
                  <Text style={styles.timerText}>
                    Funds will be released in {formatTime(Math.max(0, Math.floor((new Date(order.escrowReleaseAt).getTime() - Date.now()) / 1000)))}
                  </Text>
                </View>
              )}

              <View style={styles.buyerButtonsRow}>
                <TouchableOpacity 
                  style={styles.releaseFundsButton}
                  onPress={handleReleaseFunds}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.releaseFundsButtonText}>Release Funds</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.reportIssueButton}
                  onPress={handleReportIssue}
                >
                  <Ionicons name="warning" size={20} color="white" />
                  <Text style={styles.reportIssueButtonText}>Report Issue</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.buyerActionsNote}>
                If you're satisfied, release funds now. If there's an issue, report it within 24 hours to get a refund.
              </Text>
            </View>
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

  // ✅ SELF-PICKUP: Simplified UI (no rider tracking)
  if (order.deliveryType === 'pickup') {
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
          {/* Self-Pickup Status Card */}
          <View style={styles.selfPickupCard}>
            <View style={styles.pickupIconContainer}>
              <Ionicons name="walk" size={48} color="#27AE60" />
            </View>
            <Text style={styles.pickupTitle}>Self-Pickup Order</Text>
            <Text style={styles.pickupSubtitle}>
              {order.status === 'pending' && 'Vendor is preparing your order'}
              {order.status === 'accepted' && 'Order confirmed - being prepared'}
              {order.status === 'ready_for_pickup' && '✅ Ready for Pickup!'}
              {order.status === 'delivered' && '✅ Order Completed'}
            </Text>
            
            {/* Your Pickup PIN */}
            {order.deliveryPin && order.status !== 'delivered' && (
              <View style={styles.pinContainer}>
                <Text style={styles.pinLabel}>Your Pickup PIN</Text>
                <Text style={styles.pinCode}>{order.deliveryPin}</Text>
                <Text style={styles.pinInstruction}>
                  Provide this PIN to the vendor when collecting your order
                </Text>
              </View>
            )}
          </View>

          {/* Vendor Location & Contact */}
          {order.vendorInfo && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pickup Location</Text>
              <View style={styles.vendorCard}>
                <Ionicons name="storefront" size={24} color="#3498DB" />
                <View style={styles.vendorDetails}>
                  <Text style={styles.vendorName}>{order.vendorInfo.name}</Text>
                  {order.vendorLocation && (
                    <Text style={styles.vendorAddress}>{order.vendorLocation.address}</Text>
                  )}
                  {order.vendorInfo.phone && (
                    <TouchableOpacity 
                      style={styles.contactButton}
                      onPress={() => Alert.alert('Call Vendor', `Call ${order.vendorInfo.phone}?`)}
                    >
                      <Ionicons name="call" size={16} color="#27AE60" />
                      <Text style={styles.contactText}>{order.vendorInfo.phone}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.directionsButton}>
                  <Ionicons name="navigate" size={20} color="#3498DB" />
                  <Text style={styles.directionsText}>Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Timer Section */}
          {renderTimerSection()}

          {/* Order Status Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Progress</Text>
            <View style={styles.progressSteps}>
              <View style={[styles.progressStep, order.status !== 'pending' && styles.progressStepCompleted]}>
                <View style={[styles.progressDot, order.status !== 'pending' && styles.progressDotCompleted]}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                </View>
                <Text style={styles.progressLabel}>Order Placed</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={[styles.progressStep, ['accepted', 'ready_for_pickup', 'delivered'].includes(order.status) && styles.progressStepCompleted]}>
                <View style={[styles.progressDot, ['accepted', 'ready_for_pickup', 'delivered'].includes(order.status) && styles.progressDotCompleted]}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                </View>
                <Text style={styles.progressLabel}>Preparing</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={[styles.progressStep, ['ready_for_pickup', 'delivered'].includes(order.status) && styles.progressStepCompleted]}>
                <View style={[styles.progressDot, ['ready_for_pickup', 'delivered'].includes(order.status) && styles.progressDotCompleted]}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                </View>
                <Text style={styles.progressLabel}>Ready</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={[styles.progressStep, order.status === 'delivered' && styles.progressStepCompleted]}>
                <View style={[styles.progressDot, order.status === 'delivered' && styles.progressDotCompleted]}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                </View>
                <Text style={styles.progressLabel}>Collected</Text>
              </View>
            </View>
          </View>

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
                      ? 'Your money is safe until you confirm pickup'
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

          {/* Confirm Pickup Button (for buyer after delivered) */}
          {userRole === 'buyer' && order.status === 'delivered' && order.escrowInfo?.canRelease && (
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={() => handleMilestoneAction('order_received')}
            >
              <Text style={styles.confirmButtonText}>Confirm Pickup & Release Funds</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // ✅ REGULAR DELIVERY: Full tracking UI with rider/map
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

        {/* Real-time Map - Only show if order is not delivered */}
        {order.status !== 'delivered' && (
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Live Tracking</Text>
            {renderMap()}
          </View>
        )}

        {/* Rider Information - Only show if order is not delivered */}
        {order.status !== 'delivered' && renderRiderInfo()}

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
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#3498DB',
    borderTopColor: 'transparent',
    // Animation would be handled by Animated API in actual implementation
  },
  mapSubText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  enhancedPlaceholder: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  trackingMetric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  metricLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  trackingDivider: {
    width: 1,
    backgroundColor: '#333',
  },
  riderStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#27AE60',
    marginRight: 8,
  },
  statusText: {
    color: '#27AE60',
    fontSize: 14,
    fontWeight: '600',
  },
  accuracyText: {
    color: '#888',
    fontSize: 11,
  },
  currentLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  currentLocationText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  routeInfo: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  routeText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#3498DB',
    marginLeft: 7,
    marginVertical: 2,
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  batteryText: {
    color: '#F39C12',
    fontSize: 11,
    marginLeft: 6,
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
  },
  // ✅ NEW BUYER ACTION STYLES
  buyerActionsContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  buyerActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  timerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '500',
  },
  buyerButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  releaseFundsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  releaseFundsButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  reportIssueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  reportIssueButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  buyerActionsNote: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 16,
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
  // Self-Pickup Styles
  selfPickupCard: {
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(39, 174, 96, 0.3)',
  },
  pickupIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pickupTitle: {
    color: '#27AE60',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pickupSubtitle: {
    color: '#CCC',
    fontSize: 14,
    textAlign: 'center',
  },
  pinContainer: {
    marginTop: 20,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  pinLabel: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  pinCode: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 8,
  },
  pinInstruction: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  vendorCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  vendorDetails: {
    flex: 1,
    marginLeft: 12,
  },
  vendorName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vendorAddress: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactText: {
    color: '#27AE60',
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '600',
  },
  directionsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 8,
  },
  directionsText: {
    color: '#3498DB',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressStepCompleted: {
    opacity: 1,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressDotCompleted: {
    backgroundColor: '#27AE60',
  },
  progressLabel: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  progressLine: {
    height: 2,
    flex: 1,
    backgroundColor: '#333',
    marginHorizontal: 4,
  },
  confirmButton: {
    backgroundColor: '#27AE60',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OrderTrackingScreen;