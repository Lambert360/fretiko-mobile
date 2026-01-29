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
  Modal,
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
import { disputesAPI } from '../services/disputesAPI';

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
  const [mapLoading, setMapLoading] = useState(false); // ✨ Only load when tracking is enabled
  const [refreshing, setRefreshing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showFullInstructions, setShowFullInstructions] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [distance, setDistance] = useState<number>(0);
  const [eta, setETA] = useState<number>(0);
  const [riderAddress, setRiderAddress] = useState<string>('');
  const [existingDisputeId, setExistingDisputeId] = useState<string | null>(null);
  const [showTracking, setShowTracking] = useState(false); // ✨ Track if user requested live tracking
  const [showTrackingModal, setShowTrackingModal] = useState(false); // ✨ Full-screen tracking modal

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

  // Check for existing dispute
  const checkExistingDispute = async () => {
    try {
      const disputes = await disputesAPI.getMyDisputes();
      const dispute = disputes.find((d) => d.orderId === orderId);
      if (dispute) {
        setExistingDisputeId(dispute.id);
      } else {
        setExistingDisputeId(null);
      }
    } catch (error) {
      console.error('Error checking existing dispute:', error);
      setExistingDisputeId(null);
    }
  };

  // ✅ Initialize tracking once on mount
  useEffect(() => {
    initializeTracking();
    checkExistingDispute();
  }, [orderId]);

  // ✅ Separate effect for WebSocket subscriptions (only depends on orderId)
  useEffect(() => {
    console.log('🔌 Setting up WebSocket listeners for order:', orderId);

    // ✅ Subscribe to real-time rider location updates (MAP ONLY)
    // Only process updates if tracking is enabled
    const riderLocationListener = realtimeAPI.subscribe('rider_location_update', (data: any) => {
      // Only process if tracking is enabled
      if (!showTracking) return;
      
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
              data.latitude,
              data.longitude,
              prev.buyerLocation.latitude,
              prev.buyerLocation.longitude
            );
            setDistance(dist);
            
            const etaMinutes = Math.ceil((dist / 30) * 60);
            setETA(etaMinutes);
          }
          return prev;
        });
      }
    });

    // ✅ Subscribe to order status updates from workspace (vendor/rider updates)
    const orderStatusListener = realtimeAPI.subscribe('order_status_update', (data: any) => {
      console.log('📦 Order status update received from workspace:', data);
      
      // ✅ Update order status and related fields from workspace updates
      if (data.orderId === orderId) {
        setOrder(prev => {
          if (!prev) return null;
          
          const updates: any = {};
          
          // Update status if provided
          if (data.status && prev.status !== data.status) {
            updates.status = data.status;
          }
          
          // Update current phase if provided
          if (data.currentPhase) {
            updates.currentPhase = data.currentPhase;
          }
          
          // Update timer info if provided
          if (data.timerInfo) {
            updates.timerInfo = data.timerInfo;
            if (data.timerInfo.timeRemaining) {
              setTimerSeconds(data.timerInfo.timeRemaining);
            }
          }
          
          // Update metadata if provided
          if (data.metadata) {
            updates.metadata = { ...prev.metadata, ...data.metadata };
          }
          
          // Only update if there are actual changes
          if (Object.keys(updates).length === 0) return prev;
          
          return { ...prev, ...updates };
        });
        
        console.log(`✅ Order updated from workspace: ${data.status || 'metadata update'}`);
      }
    });

    // Cleanup
    return () => {
      console.log('🔌 Cleaning up WebSocket listeners for order:', orderId);
      riderLocationListener();
      orderStatusListener();
    };
  }, [orderId, showTracking]); // ✅ Re-subscribe if orderId or tracking status changes

  // ✅ Separate effect for location polling fallback (buyer viewing rider location)
  // Only poll if tracking is enabled
  useEffect(() => {
    // Don't poll if order is already delivered or tracking not enabled
    if (order?.status === 'delivered' || !showTracking) return;
    
    // Fallback: Set up polling for location updates (in case WebSocket fails)
    // Only for buyer viewing rider location when tracking is enabled
    const locationInterval = setInterval(() => {
      if (order?.currentPhase.phase === 'rider') {
        updateRiderLocation();
      }
    }, 30000); // Poll every 30 seconds as fallback only (WebSocket is primary)

    return () => {
      clearInterval(locationInterval);
    };
  }, [order?.status, order?.currentPhase?.phase, showTracking]);

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

      // ✅ STEP 3: Don't load tracking data automatically - wait for user request
      // Tracking data will be loaded when user clicks "Show Live Tracking"

    } catch (error) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', 'Failed to load order details');
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ Load tracking data on demand (when user requests live tracking)
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
      Alert.alert('Tracking Unavailable', 'Unable to load live tracking. Order status will still update in real-time.');
    } finally {
      setMapLoading(false);
    }
  };

  // ✅ Enable live tracking on user request (opens modal)
  const enableLiveTracking = async () => {
    // Request location permission if not already granted
    if (!locationPermission) {
      await requestLocationPermission();
    }
    
    setShowTracking(true);
    await loadTrackingDataIndependently();
    setShowTrackingModal(true); // Open full-screen modal
  };

  // ✅ Calculate ETA from rider's current position to buyer (Bolt-style)
  const calculateETAFromRider = (): { distance: number; eta: number } => {
    if (!order?.riderLocation || !order?.buyerLocation) {
      return { distance: 0, eta: 0 };
    }

    const dist = riderLocationAPI.calculateDistance(
      order.riderLocation.latitude,
      order.riderLocation.longitude,
      order.buyerLocation.latitude,
      order.buyerLocation.longitude
    );

    const vehicleType = order.riderInfo?.vehicleType || 'bike';
    const etaMinutes = riderLocationAPI.calculateETA(dist, vehicleType);

    return { distance: dist, eta: etaMinutes };
  };

  // ✅ Calculate total route distance (vendor to buyer)
  const calculateTotalRouteDistance = (): number => {
    if (!order?.vendorLocation || !order?.buyerLocation) {
      return 0;
    }

    return riderLocationAPI.calculateDistance(
      order.vendorLocation.latitude,
      order.vendorLocation.longitude,
      order.buyerLocation.latitude,
      order.buyerLocation.longitude
    );
  };

  // ✅ Calculate progress percentage (rider position along route)
  const calculateRouteProgress = (): number => {
    if (!order?.vendorLocation || !order?.riderLocation || !order?.buyerLocation) {
      return 0;
    }

    // Distance from vendor to rider
    const vendorToRider = riderLocationAPI.calculateDistance(
      order.vendorLocation.latitude,
      order.vendorLocation.longitude,
      order.riderLocation.latitude,
      order.riderLocation.longitude
    );

    // Total distance from vendor to buyer
    const totalDistance = calculateTotalRouteDistance();

    if (totalDistance === 0) return 0;

    // Progress as percentage (0-100)
    return Math.min(100, Math.max(0, (vendorToRider / totalDistance) * 100));
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
    
    // Only handle buyer phase timer expiration (auto-release escrow)
    if (order.currentPhase.phase === 'buyer') {
      handleAutoReleaseEscrow();
    }
  };

  // ✅ Buyer-only action handler
  const handleBuyerAction = async (action: string) => {
    try {
      switch (action) {
        case 'order_received':
          // Buyer confirms receipt
          await handleOrderReceived();
          break;
        default:
          console.warn('Unknown buyer action:', action);
      }
      
      // Reload order data
      await loadOrderDetails();
      
    } catch (error) {
      Alert.alert('Error', 'Failed to complete action. Please try again.');
    }
  };

  const handleOrderReceived = async () => {
    try {
      console.log(`✅ Buyer confirming order receipt for: ${orderId}`);
      
      // Confirm order and release funds immediately
      await ordersAPI.confirmOrderReceived(orderId);
      
      console.log(`✅ Order confirmed successfully!`);
      
      // Navigate directly to rating screen (don't wait for reload)
      (navigation as any as { navigate: (screen: string, params: any) => void }).navigate('RateOrder', { orderId: orderId.toString() });
      
      // Try to reload order details in background (non-blocking)
      setTimeout(async () => {
        try {
          await loadOrderDetails();
// ... (rest of the code remains the same)
          console.log(` Order details reloaded successfully`);
        } catch (reloadError) {
          console.warn(' Failed to reload order details (non-critical):', reloadError);
          // Update status manually if reload fails
          setOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
        }
      }, 500);
      
    } catch (error) {
      console.error(' Error confirming order receipt:', error);
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
          onPress: async (description?: string) => {
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'confirmed': return '#3498DB';
      case 'processing': return '#3498DB';
      case 'shipped': return '#9B59B6';
      case 'out_for_delivery': return '#9B59B6';
      case 'delivered': return '#27AE60';
      case 'completed': return '#27AE60';
      case 'cancelled': return '#E74C3C';
      default: return '#888';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'processing': return 'Processing';
      case 'shipped': return 'Shipped';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const handleReorder = async () => {
    try {
      const result = await ordersAPI.reorderItems(orderId);
      Alert.alert('Success', `Added ${result.addedItems} item(s) to cart`);
      // Navigate to cart or home
      (navigation as any).navigate('Home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reorder items');
    }
  };

  const handleViewInvoice = async () => {
    try {
      const invoice = await ordersAPI.getOrderInvoice(orderId);
      // In a real app, you'd open the invoice URL
      Alert.alert('Invoice', `Invoice Number: ${invoice.invoiceNumber}\n\nInvoice URL: ${invoice.invoiceUrl}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load invoice');
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact support?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => Alert.alert('Call', 'Support: +234-XXX-XXXX') },
        { text: 'Email', onPress: () => Alert.alert('Email', 'support@fretiko.com') },
        { text: 'Chat', onPress: () => (navigation as any).navigate('Konnect') },
      ]
    );
  };

  // ✅ Render Full-Screen Tracking Modal (Bolt-style)
  const renderTrackingModal = () => {
    if (!order) return null;

    const { distance: remainingDistance, eta: remainingETA } = calculateETAFromRider();
    const progress = calculateRouteProgress();

    return (
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setShowTrackingModal(false)}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Live Tracking</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ETA and Distance Card */}
        <View style={styles.modalETACard}>
          <View style={styles.modalETARow}>
            <View style={styles.modalETAColumn}>
              <Text style={styles.modalETALabel}>Estimated Arrival</Text>
              <Text style={styles.modalETAValue}>
                {order.riderLocation && order.buyerLocation 
                  ? riderLocationAPI.formatETA(remainingETA)
                  : 'Calculating...'}
              </Text>
            </View>
            <View style={styles.modalETADivider} />
            <View style={styles.modalETAColumn}>
              <Text style={styles.modalETALabel}>Distance</Text>
              <Text style={styles.modalETAValue}>
                {order.riderLocation && order.buyerLocation
                  ? riderLocationAPI.formatDistance(remainingDistance)
                  : '--'}
              </Text>
            </View>
          </View>
          
          {/* Progress Bar */}
          {order.riderLocation && (
            <View style={styles.modalProgressContainer}>
              <View style={styles.modalProgressBar}>
                <View style={[styles.modalProgressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.modalProgressText}>
                {Math.round(progress)}% of route completed
              </Text>
            </View>
          )}
        </View>

        {/* Map Section */}
        <View style={styles.modalMapContainer}>
          {renderBoltStyleMap()}
        </View>

        {/* Route Information */}
        <View style={styles.modalRouteInfo}>
          <View style={styles.modalRoutePoint}>
            <View style={styles.modalRouteIconContainer}>
              <Ionicons name="storefront" size={20} color="#3498DB" />
            </View>
            <View style={styles.modalRouteDetails}>
              <Text style={styles.modalRouteLabel}>Pickup Location</Text>
              <Text style={styles.modalRouteAddress} numberOfLines={2}>
                {order.vendorLocation?.address || 'Vendor Location'}
              </Text>
            </View>
          </View>

          {order.riderLocation && (
            <View style={styles.modalRoutePoint}>
              <View style={[styles.modalRouteIconContainer, styles.modalRouteIconMoving]}>
                <Ionicons name="car" size={20} color="#F39C12" />
              </View>
              <View style={styles.modalRouteDetails}>
                <Text style={styles.modalRouteLabel}>Rider Location</Text>
                <Text style={styles.modalRouteAddress} numberOfLines={2}>
                  {riderAddress || 'In Transit...'}
                </Text>
                {order.riderInfo && (
                  <Text style={styles.modalRiderName}>
                    {order.riderInfo.riderName} • {order.riderInfo.vehicleType}
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.modalRoutePoint}>
            <View style={[styles.modalRouteIconContainer, styles.modalRouteIconDestination]}>
              <Ionicons name="home" size={20} color="#27AE60" />
            </View>
            <View style={styles.modalRouteDetails}>
              <Text style={styles.modalRouteLabel}>Delivery Location</Text>
              <Text style={styles.modalRouteAddress} numberOfLines={2}>
                {order.buyerLocation?.address || 'Your Address'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ✅ Render Bolt-Style Map (vendor → rider → buyer)
  const renderBoltStyleMap = () => {
    if (!locationPermission) {
      return (
        <View style={styles.modalMapPlaceholder}>
          <Ionicons name="location" size={48} color="#888" />
          <Text style={styles.modalMapPlaceholderText}>Location Permission Required</Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestLocationPermission}
          >
            <Text style={styles.permissionButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (mapLoading || !order?.riderLocation || !order?.vendorLocation || !order?.buyerLocation) {
      return (
        <View style={styles.modalMapPlaceholder}>
          <View style={styles.spinnerContainer}>
            <View style={styles.spinner} />
            <Ionicons name="location-outline" size={48} color="#3498DB" style={{ marginTop: 16 }} />
            <Text style={styles.modalMapPlaceholderText}>Loading live tracking...</Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.modalMap}>
        {/* Enhanced Map Visualization (Bolt-style) */}
        <View style={styles.boltMapContainer}>
          {/* Route Visualization */}
          <View style={styles.boltRouteVisualization}>
            {/* Vendor Point */}
            <View style={styles.boltMapPoint}>
              <View style={styles.boltMapMarkerVendor}>
                <Ionicons name="storefront" size={24} color="white" />
              </View>
              <Text style={styles.boltMapPointLabel}>Pickup</Text>
            </View>

            {/* Route Line */}
            <View style={styles.boltRouteLine}>
              <View style={[styles.boltRouteLineProgress, { height: `${calculateRouteProgress()}%` }]} />
            </View>

            {/* Rider Point (Moving) */}
            <View style={styles.boltMapPoint}>
              <View style={styles.boltMapMarkerRider}>
                <Ionicons name="car" size={20} color="white" />
                <View style={styles.boltMapMarkerPulse} />
              </View>
              <Text style={styles.boltMapPointLabel}>Rider</Text>
            </View>

            {/* Remaining Route Line */}
            <View style={styles.boltRouteLine}>
              <View style={[styles.boltRouteLineRemaining, { height: `${100 - calculateRouteProgress()}%` }]} />
            </View>

            {/* Buyer Point */}
            <View style={styles.boltMapPoint}>
              <View style={styles.boltMapMarkerBuyer}>
                <Ionicons name="home" size={24} color="white" />
              </View>
              <Text style={styles.boltMapPointLabel}>Delivery</Text>
            </View>
          </View>

          {/* Distance and ETA Overlay */}
          <View style={styles.boltMapOverlay}>
            <View style={styles.boltMapOverlayRow}>
              <Ionicons name="location" size={18} color="#3498DB" />
              <Text style={styles.boltMapOverlayText}>
                {riderLocationAPI.formatDistance(calculateETAFromRider().distance)} remaining
              </Text>
            </View>
            <View style={styles.boltMapOverlayRow}>
              <Ionicons name="time" size={18} color="#27AE60" />
              <Text style={styles.boltMapOverlayText}>
                ETA: {riderLocationAPI.formatETA(calculateETAFromRider().eta)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderMap = () => {
    if (!locationPermission) {
      return (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="location" size={40} color="#888" />
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
    if (mapLoading || !order?.riderLocation || !order?.vendorLocation || !order?.buyerLocation) {
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

    const { riderLocation, vendorLocation, buyerLocation } = order || {};
    
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
                📶 GPS Signal Available
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
                {vendorLocation?.address || 'Vendor Location'}
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <Ionicons name="home" size={16} color="#27AE60" />
              <Text style={styles.routeText} numberOfLines={1}>
                {buyerLocation?.address || 'Your Address'}
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

  // ✅ Cancel Order (only when pending)
  const handleCancelOrder = async () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? You will receive a full refund.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await ordersAPI.cancelOrder(orderId);
              Alert.alert('Order Cancelled', 'Your order has been cancelled and you will receive a full refund.');
              await loadOrderDetails();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel order');
            }
          },
        },
      ]
    );
  };

  // ✅ Render buyer actions only
  const renderBuyerActions = () => {
    if (!order) return null;

    return (
      <View style={styles.buyerActionsSection}>
        {/* Cancel Order Button - Show when order is pending */}
        {order.status === 'pending' && (
          <TouchableOpacity 
            style={styles.cancelOrderButton}
            onPress={handleCancelOrder}
          >
            <Ionicons name="close-circle" size={20} color="white" />
            <Text style={styles.cancelOrderButtonText}>Cancel Order</Text>
          </TouchableOpacity>
        )}

        {/* Confirm Receipt Button - Show when delivered */}
        {order.status === 'delivered' && order.currentPhase.phase === 'buyer' && (
          <TouchableOpacity 
            style={styles.confirmReceiptButton}
            onPress={() => handleBuyerAction('order_received')}
          >
            <Ionicons name="checkmark-done" size={24} color="white" />
            <Text style={styles.confirmReceiptButtonText}>Confirm Order Received</Text>
          </TouchableOpacity>
        )}

        {/* Buyer Action Buttons - Show when order is delivered */}
        {order.status === 'delivered' && (
          <View style={styles.buyerActionsContainer}>
            <Text style={styles.buyerActionsTitle}>Order Delivered - What would you like to do?</Text>
            
            {/* 24-hour countdown timer */}
            {order.escrowInfo?.autoReleaseTime && (
              <View style={styles.timerContainer}>
                <Ionicons name="time-outline" size={16} color="#FF9500" />
                <Text style={styles.timerText}>
                  Funds will be released in {getAutoReleaseTime()}
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

              {existingDisputeId ? (
                <TouchableOpacity 
                  style={styles.viewDisputeButton}
                  onPress={() => (navigation as any).navigate('DisputeDetails', { disputeId: existingDisputeId })}
                >
                  <Ionicons name="document-text" size={20} color="white" />
                  <Text style={styles.viewDisputeButtonText}>View Dispute</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.reportIssueButton}
                  onPress={() => (navigation as any).navigate('CreateDispute', { orderId })}
                >
                  <Ionicons name="alert-circle" size={20} color="white" />
                  <Text style={styles.reportIssueButtonText}>File Dispute</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.buyerActionsNote}>
              If you're satisfied, release funds now. If there's an issue, report it within 24 hours to get a refund.
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ✅ Render Order Summary Header
  const renderOrderSummary = () => {
    if (!order) return null;

    return (
      <View style={styles.orderSummarySection}>
        <View style={styles.orderSummaryHeader}>
          <View style={styles.orderSummaryLeft}>
            <Text style={styles.orderNumberText}>#{order.orderNumber}</Text>
            <Text style={styles.orderDateText}>{formatDate(order.orderDate)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(order.status)}</Text>
          </View>
        </View>
        <View style={styles.orderTotalRow}>
          <Text style={styles.orderTotalLabel}>Total Amount</Text>
          <Text style={styles.orderTotalAmount}>{walletAPI.formatFreti(order.total)}</Text>
        </View>
      </View>
    );
  };

  // ✅ Render Delivery Information Section
  const renderDeliveryInfo = () => {
    if (!order) return null;

    const deliveryAddress = order.deliveryAddress;
    if (!deliveryAddress) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Delivery Information</Text>
        <View style={styles.deliveryInfoCard}>
          <View style={styles.deliveryInfoRow}>
            <Ionicons name="location-outline" size={20} color="#3498DB" />
            <View style={styles.deliveryInfoContent}>
              {typeof deliveryAddress === 'string' ? (
                <Text style={styles.deliveryAddressText}>{deliveryAddress}</Text>
              ) : (
                <>
                  <Text style={styles.deliveryName}>{deliveryAddress.fullName || 'Delivery Address'}</Text>
                  <Text style={styles.deliveryAddressText}>
                    {[deliveryAddress.address, deliveryAddress.city, deliveryAddress.state, deliveryAddress.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                  {deliveryAddress.phone && (
                    <Text style={styles.deliveryPhone}>{deliveryAddress.phone}</Text>
                  )}
                </>
              )}
            </View>
          </View>
          {order.deliveryInstructions && (() => {
            const INSTRUCTIONS_LIMIT = 120;
            const isLong = order.deliveryInstructions.length > INSTRUCTIONS_LIMIT;
            const displayText = showFullInstructions || !isLong
              ? order.deliveryInstructions
              : `${order.deliveryInstructions.substring(0, INSTRUCTIONS_LIMIT)}...`;
            
            return (
              <View style={styles.deliveryInstructionsRow}>
                <Ionicons name="information-circle-outline" size={18} color="#888" />
                <View style={styles.deliveryInstructionsContainer}>
                  <Text style={styles.deliveryInstructionsText}>{displayText}</Text>
                  {isLong && (
                    <TouchableOpacity
                      onPress={() => setShowFullInstructions(!showFullInstructions)}
                      style={styles.seeMoreButton}
                    >
                      <Text style={styles.seeMoreText}>
                        {showFullInstructions ? 'See less' : 'See more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })()}
          {order.estimatedDelivery && (
            <View style={styles.estimatedDeliveryRow}>
              <Ionicons name="time-outline" size={18} color="#F39C12" />
              <Text style={styles.estimatedDeliveryText}>
                Estimated Delivery: {formatDate(order.estimatedDelivery)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ✅ Render Payment Details Section
  const renderPaymentDetails = () => {
    if (!order) return null;

    const escrowFee = order.metadata?.escrow_fee || 0;
    const taxAmount = order.tax || order.metadata?.tax_amount || 0;
    const subtotal = order.subtotal || (order.total - order.deliveryFee - escrowFee - taxAmount);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💳 Payment Details</Text>
        <View style={styles.paymentDetailsCard}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Subtotal</Text>
            <Text style={styles.paymentValue}>{walletAPI.formatFreti(subtotal)}</Text>
          </View>
          {order.deliveryFee > 0 && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Delivery Fee</Text>
              <Text style={styles.paymentValue}>{walletAPI.formatFreti(order.deliveryFee)}</Text>
            </View>
          )}
          {taxAmount > 0 && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Tax</Text>
              <Text style={styles.paymentValue}>{walletAPI.formatFreti(taxAmount)}</Text>
            </View>
          )}
          {escrowFee > 0 && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Escrow Fee</Text>
              <Text style={styles.paymentValue}>{walletAPI.formatFreti(escrowFee)}</Text>
            </View>
          )}
          <View style={styles.paymentDivider} />
          <View style={styles.paymentRow}>
            <Text style={styles.paymentTotalLabel}>Total</Text>
            <Text style={styles.paymentTotalValue}>{walletAPI.formatFreti(order.total)}</Text>
          </View>
          {order.escrowInfo && (
            <View style={styles.escrowStatusRow}>
              <Ionicons 
                name={order.escrowInfo.status === 'held' ? 'shield-checkmark' : 'checkmark-circle'} 
                size={18} 
                color={order.escrowInfo.status === 'held' ? '#F39C12' : '#27AE60'} 
              />
              <Text style={styles.escrowStatusText}>
                Payment {order.escrowInfo.status === 'held' ? 'Secured in Escrow' : 'Released'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ✅ Render Delivery PIN Section (for buyers)
  const renderDeliveryPIN = () => {
    if (!order) return null;

    // Show delivery PIN for delivery orders
    if (order.deliveryType !== 'pickup' && order.deliveryPin && order.status !== 'delivered') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔐 Delivery PIN</Text>
          <View style={styles.pinCard}>
            <Text style={styles.pinDescription}>
              Give this PIN to the rider when they deliver your order
            </Text>
            <View style={styles.pinDisplay}>
              <Text style={styles.pinText}>{order.deliveryPin}</Text>
            </View>
            <TouchableOpacity 
              style={styles.copyPinButton}
              onPress={() => {
                // In a real app, copy to clipboard
                Alert.alert('PIN Copied', 'Delivery PIN copied to clipboard');
              }}
            >
              <Ionicons name="copy-outline" size={16} color="#3498DB" />
              <Text style={styles.copyPinText}>Copy PIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  // ✅ Render Order Progress Timeline
  const renderOrderProgress = () => {
    if (!order) return null;

    const getProgressSteps = () => {
      const steps = [
        { key: 'placed', label: 'Order Placed', status: order.status !== 'pending' },
        { key: 'confirmed', label: 'Confirmed', status: ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status) },
        { key: 'processing', label: 'Processing', status: ['processing', 'shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status) },
        { key: 'shipped', label: 'Shipped', status: ['shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status) },
        { key: 'delivered', label: 'Delivered', status: ['delivered', 'completed'].includes(order.status) },
      ];

      return steps;
    };

    const steps = getProgressSteps();
    const currentStepIndex = steps.findIndex(step => step.status);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Order Progress</Text>
        <View style={styles.progressTimeline}>
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <View style={styles.progressStepContainer}>
                <View style={[
                  styles.progressStepDot,
                  step.status && styles.progressStepDotCompleted,
                  index === currentStepIndex && styles.progressStepDotCurrent
                ]}>
                  {step.status && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
                <Text style={[
                  styles.progressStepLabel,
                  step.status && styles.progressStepLabelCompleted
                ]}>
                  {step.label}
                </Text>
              </View>
              {index < steps.length - 1 && (
                <View style={[
                  styles.progressStepLine,
                  step.status && styles.progressStepLineCompleted
                ]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  };

  // ✅ Render Additional Actions
  const renderAdditionalActions = () => {
    if (!order) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>More Actions</Text>
        <View style={styles.additionalActionsRow}>
          <TouchableOpacity 
            style={styles.additionalActionButton}
            onPress={handleReorder}
          >
            <Ionicons name="repeat-outline" size={20} color="#3498DB" />
            <Text style={styles.additionalActionText}>Reorder</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.additionalActionButton}
            onPress={handleViewInvoice}
          >
            <Ionicons name="receipt-outline" size={20} color="#3498DB" />
            <Text style={styles.additionalActionText}>Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.additionalActionButton}
            onPress={handleContactSupport}
          >
            <Ionicons name="help-circle-outline" size={20} color="#3498DB" />
            <Text style={styles.additionalActionText}>Support</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRiderInfo = () => {
    if (!order?.riderInfo || order.currentPhase.phase === 'vendor') return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚴 Your Delivery Rider</Text>
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
              {order.status === 'confirmed' && 'Order confirmed - being prepared'}
              {order.status === 'processing' && '✅ Ready for Pickup!'}
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
                  {order.vendorInfo?.phone && (
                    <TouchableOpacity 
                      style={styles.contactButton}
                      onPress={() => Alert.alert('Call Vendor', `Call ${order.vendorInfo?.phone}?`)}
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

          {/* 1. Order Summary Header */}
          {renderOrderSummary()}

          {/* 2. Timer Section */}
          {renderTimerSection()}

          {/* 3. Order Progress Timeline */}
          {renderOrderProgress()}

          {/* 4. Pickup PIN (for self-pickup orders) */}
          {order.deliveryPin && order.status !== 'delivered' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔐 Your Pickup PIN</Text>
              <View style={styles.pinCard}>
                <Text style={styles.pinDescription}>
                  Provide this PIN to the vendor when collecting your order
                </Text>
                <View style={styles.pinDisplay}>
                  <Text style={styles.pinText}>{order.deliveryPin}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.copyPinButton}
                  onPress={() => {
                    Alert.alert('PIN Copied', 'Pickup PIN copied to clipboard');
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color="#3498DB" />
                  <Text style={styles.copyPinText}>Copy PIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 5. Vendor Location & Contact */}
          {order.vendorInfo && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏪 Pickup Location</Text>
              <View style={styles.vendorCard}>
                <Ionicons name="storefront" size={24} color="#3498DB" />
                <View style={styles.vendorDetails}>
                  <Text style={styles.vendorName}>{order.vendorInfo.name}</Text>
                  {order.vendorLocation && (
                    <Text style={styles.vendorAddress}>{order.vendorLocation.address}</Text>
                  )}
                  {order.vendorInfo?.phone && (
                    <TouchableOpacity 
                      style={styles.contactButton}
                      onPress={() => Alert.alert('Call Vendor', `Call ${order.vendorInfo?.phone}?`)}
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

          {/* 6. Order Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Order Items ({order.items.length})</Text>
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

          {/* 7. Payment Details */}
          {renderPaymentDetails()}

          {/* 8. Buyer Actions */}
          {renderBuyerActions()}

          {/* 9. Additional Actions */}
          {renderAdditionalActions()}
        </ScrollView>

        {/* ✅ Full-Screen Tracking Modal (Bolt-style) */}
        <Modal
          visible={showTrackingModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowTrackingModal(false)}
        >
          {renderTrackingModal()}
        </Modal>
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
        {/* 1. Order Summary Header */}
        {renderOrderSummary()}

        {/* 2. Timer Section */}
        {renderTimerSection()}

        {/* 3. Order Progress Timeline */}
        {renderOrderProgress()}

        {/* 4. Compact Tracking Card - Shows ETA and opens modal */}
        {order.status !== 'delivered' && 
         order.deliveryType === 'delivery' && 
         (order.status === 'out_for_delivery' || order.status === 'shipped' || order.currentPhase?.phase === 'rider') && (
          <View style={styles.section}>
            {showTracking ? (
              // Show compact tracking info when tracking is enabled
              <TouchableOpacity 
                style={styles.trackingCard}
                onPress={() => setShowTrackingModal(true)}
              >
                <View style={styles.trackingCardHeader}>
                  <View style={styles.trackingCardLeft}>
                    <Ionicons name="location" size={20} color="#3498DB" />
                    <View style={styles.trackingCardInfo}>
                      <Text style={styles.trackingCardTitle}>Live Tracking Active</Text>
                      {order.riderLocation && order.buyerLocation && (
                        <>
                          <Text style={styles.trackingCardETA}>
                            {riderLocationAPI.formatETA(calculateETAFromRider().eta)} • {riderLocationAPI.formatDistance(calculateETAFromRider().distance)} away
                          </Text>
                          <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${calculateRouteProgress()}%` }]} />
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </View>
              </TouchableOpacity>
            ) : (
              // Show "Enable Tracking" button when tracking not enabled
              <TouchableOpacity 
                style={styles.enableTrackingButton}
                onPress={enableLiveTracking}
              >
                <Ionicons name="location" size={24} color="white" />
                <View style={styles.enableTrackingContent}>
                  <Text style={styles.enableTrackingTitle}>Show Live Tracking</Text>
                  <Text style={styles.enableTrackingSubtitle}>
                    Track your order in real-time on the map
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 5. Rider Information - Only show if order is not delivered */}
        {order.status !== 'delivered' && order.riderInfo && renderRiderInfo()}

        {/* 6. Delivery PIN */}
        {renderDeliveryPIN()}

        {/* 7. Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Order Items ({order.items.length})</Text>
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

        {/* 8. Delivery Information */}
        {renderDeliveryInfo()}

        {/* 9. Payment Details */}
        {renderPaymentDetails()}

        {/* 10. Buyer Actions */}
        {renderBuyerActions()}

        {/* 11. Additional Actions */}
        {renderAdditionalActions()}
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
  timerContainerText: {
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
  viewDisputeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  viewDisputeButtonText: {
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
  // ✅ Order Summary Styles
  orderSummarySection: {
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  orderSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderSummaryLeft: {
    flex: 1,
  },
  orderNumberText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orderDateText: {
    color: '#888',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  orderTotalLabel: {
    color: '#888',
    fontSize: 14,
  },
  orderTotalAmount: {
    color: '#27AE60',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // ✅ Delivery Info Styles
  deliveryInfoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  deliveryInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  deliveryName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  deliveryAddressText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  deliveryPhone: {
    color: '#3498DB',
    fontSize: 14,
    marginTop: 4,
  },
  deliveryInstructionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'flex-start',
  },
  deliveryInstructionsContainer: {
    flex: 1,
    marginLeft: 8,
  },
  deliveryInstructionsText: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  seeMoreButton: {
    marginTop: 4,
    paddingVertical: 4,
  },
  seeMoreText: {
    color: '#3498DB',
    fontSize: 13,
    fontWeight: '500',
  },
  estimatedDeliveryRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  estimatedDeliveryText: {
    color: '#F39C12',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  // ✅ Payment Details Styles
  paymentDetailsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentLabel: {
    color: '#888',
    fontSize: 14,
  },
  paymentValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },
  paymentTotalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentTotalValue: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  escrowStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  escrowStatusText: {
    color: '#888',
    fontSize: 13,
    marginLeft: 8,
  },
  // ✅ Delivery PIN Styles
  pinCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pinDescription: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  pinDisplay: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(52, 152, 219, 0.3)',
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  pinText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  copyPinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  copyPinText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // ✅ Progress Timeline Styles
  progressTimeline: {
    paddingVertical: 8,
  },
  progressStepContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  progressStepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressStepDotCompleted: {
    backgroundColor: '#27AE60',
  },
  progressStepDotCurrent: {
    backgroundColor: '#3498DB',
    borderWidth: 3,
    borderColor: '#27AE60',
  },
  progressStepLabel: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  progressStepLabelCompleted: {
    color: '#CCC',
    fontWeight: '500',
  },
  progressStepLine: {
    width: 2,
    height: 24,
    backgroundColor: '#333',
    marginLeft: 15,
    marginBottom: 4,
  },
  progressStepLineCompleted: {
    backgroundColor: '#27AE60',
  },
  // ✅ Buyer Actions Styles
  buyerActionsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  confirmReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  confirmReceiptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelOrderButton: {
    backgroundColor: '#E74C3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  cancelOrderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // ✅ Additional Actions Styles
  additionalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  additionalActionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  additionalActionText: {
    color: '#3498DB',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  // ✅ Enable Tracking Button Styles
  enableTrackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2980B9',
  },
  enableTrackingContent: {
    flex: 1,
    marginLeft: 16,
  },
  enableTrackingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  enableTrackingSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hideTrackingButton: {
    padding: 8,
  },
  // ✅ Tracking Card Styles
  trackingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  trackingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackingCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trackingCardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  trackingCardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackingCardETA: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 2,
  },
  // ✅ Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalETACard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalETARow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  modalETAColumn: {
    alignItems: 'center',
    flex: 1,
  },
  modalETADivider: {
    width: 1,
    backgroundColor: '#333',
  },
  modalETALabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  modalETAValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalProgressContainer: {
    marginTop: 16,
  },
  modalProgressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modalProgressFill: {
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 3,
  },
  modalProgressText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  modalMapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  modalMap: {
    flex: 1,
  },
  modalMapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  modalMapPlaceholderText: {
    color: '#888',
    fontSize: 14,
    marginTop: 16,
  },
  // ✅ Bolt-Style Map Styles
  boltMapContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  boltRouteVisualization: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  boltMapPoint: {
    alignItems: 'center',
    flex: 1,
  },
  boltMapMarkerVendor: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'white',
  },
  boltMapMarkerRider: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F39C12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'white',
    position: 'relative',
  },
  boltMapMarkerPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(243, 156, 18, 0.3)',
  },
  boltMapMarkerBuyer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#27AE60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'white',
  },
  boltMapPointLabel: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  boltRouteLine: {
    width: 4,
    height: 60,
    backgroundColor: '#333',
    marginHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  boltRouteLineProgress: {
    width: '100%',
    backgroundColor: '#3498DB',
    position: 'absolute',
    bottom: 0,
  },
  boltRouteLineRemaining: {
    width: '100%',
    backgroundColor: '#555',
    position: 'absolute',
    top: 0,
  },
  boltMapOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  boltMapOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boltMapOverlayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // ✅ Modal Route Info Styles
  modalRouteInfo: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalRoutePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalRouteIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalRouteIconMoving: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
  },
  modalRouteIconDestination: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
  },
  modalRouteDetails: {
    flex: 1,
  },
  modalRouteLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  modalRouteAddress: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  modalRiderName: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
});

export default OrderTrackingScreen;