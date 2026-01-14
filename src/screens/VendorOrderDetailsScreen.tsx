import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { workspaceAPI, WorkspaceOrder } from '../services/workspaceAPI';
import { disputesAPI } from '../services/disputesAPI';
import { riderLocationAPI } from '../services/riderLocationAPI';
import { realtimeAPI } from '../services/realtimeAPI';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VendorOrderDetailsParams {
  orderId: string;
}

interface OrderDetailsData extends WorkspaceOrder {
  vendor_id?: string; // ✅ Order-specific vendor ID
  rider_id?: string; // ✅ Order-specific rider ID
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    avatar?: string;
  };
  deliveryDetails: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    instructions?: string;
  };
  vendorLocation?: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
  };
  vendorInfo?: {
    id: string;
    name: string;
    phone?: string | null;
  };
  riderLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  timeline: Array<{
    status: string;
    timestamp: string;
    note?: string;
  }>;
  pickupPin?: string;
  deliveryPin?: string;
  pickupPinVerifiedAt?: string;
  deliveryPinVerifiedAt?: string;
}

const VendorOrderDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { orderId } = route.params as VendorOrderDetailsParams;

  const [orderDetails, setOrderDetails] = useState<OrderDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPrepTimeModal, setShowPrepTimeModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false); // ✅ Map modal state
  const [notes, setNotes] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [existingDisputeId, setExistingDisputeId] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const [showFullInstructions, setShowFullInstructions] = useState(false);

  useEffect(() => {
    loadOrderDetails();
    checkExistingDispute();
    requestLocationPermission();
    
    // Cleanup location subscription on unmount
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, [orderId]);

  // ✅ Screen focus refresh - reload order details when screen regains focus
  useFocusEffect(
    useCallback(() => {
      // Refresh order details when screen comes into focus
      if (orderId) {
        loadOrderDetails(false); // Don't show loading indicator on focus refresh
      }
    }, [orderId])
  );

  // ✅ WebSocket subscriptions for real-time updates
  useEffect(() => {
    console.log('🔌 Setting up WebSocket listeners for order:', orderId);

    // ✅ Subscribe to real-time rider location updates (only when map modal is open)
    const riderLocationListener = realtimeAPI.subscribe('rider_location_update', (data: any) => {
      // Only process if map modal is open
      if (!showMapModal) return;
      
      console.log('🏍️ Rider location update received:', data);
      
      // Update rider location in order details
      if (data.orderId === orderId && data.latitude && data.longitude) {
        setOrderDetails(prev => {
          if (!prev) return null;
          
          // Skip if order is already delivered
          if (prev.status === 'delivered') return prev;
          
          // Only update if location changed
          const locationChanged = !prev.riderLocation || 
            prev.riderLocation.latitude !== data.latitude || 
            prev.riderLocation.longitude !== data.longitude;
          
          if (!locationChanged) return prev;
          
          return {
            ...prev,
            riderLocation: {
              latitude: data.latitude,
              longitude: data.longitude,
              timestamp: data.timestamp || new Date().toISOString(),
            },
          };
        });
      }
    });

    // ✅ Subscribe to order status updates from workspace (vendor/rider updates)
    const orderStatusListener = realtimeAPI.subscribe('order_status_update', (data: any) => {
      console.log('📦 Order status update received from workspace:', data);
      
      // Update order status and related fields from workspace updates
      if (data.orderId === orderId) {
        setOrderDetails(prev => {
          if (!prev) return null;
          
          const updates: any = {};
          
          // Update status if provided
          if (data.status && prev.status !== data.status) {
            updates.status = data.status;
          }
          
          // Update timeline if provided
          if (data.timeline) {
            updates.timeline = data.timeline;
          }
          
          // Update metadata if provided
          if (data.metadata) {
            updates.metadata = { ...prev.metadata, ...data.metadata };
          }
          
          // Update rider location if provided
          if (data.riderLocation) {
            updates.riderLocation = data.riderLocation;
          }
          
          // Only update if there are actual changes
          if (Object.keys(updates).length === 0) return prev;
          
          return { ...prev, ...updates };
        });
        
        // If status changed significantly, reload full order details
        if (data.status && orderDetails && data.status !== orderDetails.status) {
          console.log(`✅ Order status changed from ${orderDetails.status} to ${data.status}, reloading...`);
          loadOrderDetails(false); // Silent reload
        }
        
        console.log(`✅ Order updated from workspace: ${data.status || 'metadata update'}`);
      }
    });

    // Cleanup
    return () => {
      console.log('🔌 Cleaning up WebSocket listeners for order:', orderId);
      riderLocationListener();
      orderStatusListener();
    };
  }, [orderId, showMapModal]); // ✅ Re-subscribe if orderId or map modal status changes

  // ✅ Request location permission for map
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        // Get current location for riders (only if they're the rider for this order)
        if (orderDetails?.rider_id === user?.id) {
          try {
            const location = await Location.getCurrentPositionAsync();
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
            
            // Start watching position for riders to update in real-time
            const subscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 5000, // Update every 5 seconds
                distanceInterval: 10, // Or every 10 meters
              },
              (location) => {
                setCurrentLocation({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                });
              }
            );
            locationSubscriptionRef.current = subscription;
          } catch (error) {
            console.error('Error getting current location:', error);
          }
        }
      } else {
        // Stop watching if permission revoked
        if (locationSubscriptionRef.current) {
          locationSubscriptionRef.current.remove();
          locationSubscriptionRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  // ✅ Open directions to buyer location
  const openDirections = () => {
    if (!orderDetails?.deliveryDetails?.coordinates) {
      Alert.alert('Error', 'Delivery location coordinates not available');
      return;
    }

    const { latitude, longitude } = orderDetails.deliveryDetails.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps app');
    });
  };

  // ✅ Open directions to vendor location (for riders)
  const openDirectionsToVendor = () => {
    if (!orderDetails?.vendorLocation?.coordinates) {
      Alert.alert('Error', 'Vendor location coordinates not available');
      return;
    }

    const { latitude, longitude } = orderDetails.vendorLocation.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps app');
    });
  };

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

  const loadOrderDetails = async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) setLoading(true);

      const data = await workspaceAPI.getOrderDetails(orderId);
      setOrderDetails(data);
    } catch (error) {
      console.error('Error loading order details:', error);
      Alert.alert('Error', 'Failed to load order details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrderDetails(false);
  };

  const handleAction = async (action: string) => {
    if (!orderDetails) return;

    setActionLoading(action);
    try {
      let result;
      switch (action) {
        case 'accept':
          result = await workspaceAPI.acceptOrder(orderId);
          Alert.alert('Success', 'Order accepted successfully');
          break;
        case 'decline':
          Alert.alert(
            'Decline Order',
            'Are you sure you want to decline this order?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Decline',
                style: 'destructive',
                onPress: async () => {
                  await workspaceAPI.declineOrder(orderId, 'Vendor declined');
                  Alert.alert('Order Declined', 'Order has been declined');
                  navigation.goBack();
                },
              },
            ]
          );
          return;
        case 'ready':
          result = await workspaceAPI.markOrderReady(orderId);
          Alert.alert('Success', 'Order marked as ready for pickup');
          break;
        case 'pickup':
          result = await workspaceAPI.confirmPickup(orderId);
          Alert.alert('Success', 'Pickup confirmed');
          break;
        case 'delivered':
          result = await workspaceAPI.markDelivered(orderId);
          Alert.alert('Success', 'Order marked as delivered');
          break;
      }

      // Reload order details to reflect changes
      loadOrderDetails(false);
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      Alert.alert('Error', `Failed to ${action} order`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNotes = async () => {
    if (!notes.trim()) return;

    try {
      await workspaceAPI.addOrderNotes(orderId, notes.trim());
      setNotes('');
      setShowNotesModal(false);
      Alert.alert('Success', 'Notes added successfully');
      loadOrderDetails(false);
    } catch (error) {
      console.error('Error adding notes:', error);
      Alert.alert('Error', 'Failed to add notes');
    }
  };

  const handleUpdatePrepTime = async () => {
    const minutes = parseInt(prepTime);
    if (!minutes || minutes <= 0) {
      Alert.alert('Invalid Time', 'Please enter a valid preparation time');
      return;
    }

    try {
      await workspaceAPI.updatePreparationTime(orderId, minutes);
      setPrepTime('');
      setShowPrepTimeModal(false);
      Alert.alert('Success', 'Preparation time updated');
      loadOrderDetails(false);
    } catch (error) {
      console.error('Error updating prep time:', error);
      Alert.alert('Error', 'Failed to update preparation time');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'processing': return '#007AFF';
      case 'ready_for_pickup': return '#34C759';
      case 'out_for_delivery': return '#5856D6';
      case 'delivered': return '#30D158';
      case 'cancelled': return '#FF3B30';
      default: return '#8E8E93';
    }
  };

  const getOrderSourceInfo = (source: string) => {
    switch (source) {
      case 'regular': return { label: 'Store Purchase', icon: 'storefront-outline', color: '#007AFF' };
      case 'live_stream': return { label: 'Live Stream Sale', icon: 'videocam-outline', color: '#FF2D92' };
      case 'auction': return { label: 'Auction Sale', icon: 'hammer-outline', color: '#FF9500' };
      case 'service_booking': return { label: 'Service Booking', icon: 'construct-outline', color: '#34C759' };
      default: return { label: 'Store Purchase', icon: 'storefront-outline', color: '#007AFF' };
    }
  };

  const getAvailableActions = () => {
    if (!orderDetails || !user) return [];

    const actions = [];
    const isVendorForThisOrder = orderDetails.vendor_id === user.id;
    const isRiderForThisOrder = orderDetails.rider_id === user.id;

    // ✅ Vendor actions (only if user is the vendor for THIS order)
    if (isVendorForThisOrder) {
      switch (orderDetails.status) {
        case 'pending':
          actions.push(
            { action: 'accept', label: 'Accept Order', icon: 'checkmark-outline', color: '#34C759' },
            { action: 'decline', label: 'Decline Order', icon: 'close-outline', color: '#FF3B30' }
          );
          break;
        case 'processing':
          actions.push(
            { action: 'ready', label: 'Ready for Pickup', icon: 'cube-outline', color: '#007AFF' }
          );
          break;
      }
    }

    // ✅ Rider actions (only if user is the rider for THIS order)
    if (isRiderForThisOrder) {
      switch (orderDetails.status) {
        case 'ready_for_pickup':
          actions.push(
            { action: 'pickup', label: 'Confirm Pickup', icon: 'bag-outline', color: '#007AFF' }
          );
          break;
        case 'out_for_delivery':
          actions.push(
            { action: 'delivered', label: 'Mark Delivered', icon: 'checkmark-circle-outline', color: '#34C759' }
          );
          break;
      }
    }

    return actions;
  };

  // ✅ Render Workspace Map (vendor/rider view)
  const renderWorkspaceMap = () => {
    if (!orderDetails) return null;

    const buyerLocation = orderDetails.deliveryDetails?.coordinates;
    const vendorLocation = orderDetails.vendorLocation?.coordinates;
    const riderLocation = orderDetails.riderLocation;
    const currentLoc = currentLocation;

    if (!locationPermission) {
      return (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="location-off" size={48} color="#888" />
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

    if (!buyerLocation) {
      return (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={48} color="#888" />
          <Text style={styles.mapPlaceholderText}>Delivery location not available</Text>
        </View>
      );
    }

    // Calculate distance and ETA for riders (only if user is the rider for this order)
    let distance = 0;
    let eta = 0;
    const isRiderForThisOrder = orderDetails.rider_id === user?.id;
    if (isRiderForThisOrder && (riderLocation || currentLoc) && buyerLocation) {
      distance = riderLocationAPI.calculateDistance(
        (riderLocation || currentLoc)!.latitude,
        (riderLocation || currentLoc)!.longitude,
        buyerLocation.latitude,
        buyerLocation.longitude
      );
      eta = riderLocationAPI.calculateETA(distance, 'bike');
    }

    return (
      <View style={styles.workspaceMapContainer}>
        {/* Map Visualization */}
        <View style={styles.workspaceMapVisualization}>
          {/* Vendor Point */}
          {vendorLocation && (
            <View style={styles.mapPoint}>
              <View style={styles.mapMarkerVendor}>
                <Ionicons name="storefront" size={24} color="white" />
              </View>
              <Text style={styles.mapPointLabel}>Vendor</Text>
            </View>
          )}

          {/* Route Line (if vendor and buyer) */}
          {vendorLocation && buyerLocation && (
            <View style={styles.mapRouteLine}>
              <View style={styles.mapRouteLineFill} />
            </View>
          )}

          {/* Rider/Current Location Point */}
          {(riderLocation || (isRiderForThisOrder && currentLoc)) && (
            <>
              {vendorLocation && buyerLocation && (
                <View style={styles.mapRouteLine}>
                  <View style={styles.mapRouteLineFill} />
                </View>
              )}
              <View style={styles.mapPoint}>
                <View style={styles.mapMarkerRider}>
                  <Ionicons name="car" size={20} color="white" />
                </View>
                <Text style={styles.mapPointLabel}>
                  {isRiderForThisOrder ? 'You' : 'Rider'}
                </Text>
              </View>
            </>
          )}

          {/* Buyer Point */}
          <View style={styles.mapPoint}>
            <View style={styles.mapMarkerBuyer}>
              <Ionicons name="home" size={24} color="white" />
            </View>
            <Text style={styles.mapPointLabel}>Delivery</Text>
          </View>
        </View>

        {/* Distance and ETA Overlay (for riders - only if user is the rider for this order) */}
        {isRiderForThisOrder && (riderLocation || currentLoc) && buyerLocation && (
          <View style={styles.mapOverlay}>
            <View style={styles.mapOverlayRow}>
              <Ionicons name="location" size={18} color="#007AFF" />
              <Text style={styles.mapOverlayText}>
                {riderLocationAPI.formatDistance(distance)} remaining
              </Text>
            </View>
            <View style={styles.mapOverlayRow}>
              <Ionicons name="time" size={18} color="#27AE60" />
              <Text style={styles.mapOverlayText}>
                ETA: {riderLocationAPI.formatETA(eta)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ✅ Render Map Modal
  const renderMapModal = () => {
    if (!orderDetails) return null;

    const buyerLocation = orderDetails.deliveryDetails?.coordinates;
    const vendorLocation = orderDetails.vendorLocation?.coordinates;
    const riderLocation = orderDetails.riderLocation;
    const currentLoc = currentLocation;
    const isRiderForThisOrder = orderDetails.rider_id === user?.id; // ✅ Check if user is rider for THIS order

    return (
      <View style={[styles.mapModalContainer, { paddingTop: insets.top }]}>
        {/* Modal Header */}
        <View style={styles.mapModalHeader}>
          <TouchableOpacity 
            style={styles.mapModalCloseButton}
            onPress={() => setShowMapModal(false)}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.mapModalTitle}>Order Map</Text>
          {buyerLocation && (
            <TouchableOpacity 
              style={styles.mapModalDirectionsButton}
              onPress={openDirections}
            >
              <Ionicons name="navigate" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Map Visualization */}
        <View style={styles.mapModalMapContainer}>
          {renderWorkspaceMap()}
        </View>

        {/* Location Info */}
        <View style={styles.mapModalInfo}>
          {buyerLocation && (
            <View style={styles.mapLocationItem}>
              <View style={[styles.mapLocationIcon, { backgroundColor: 'rgba(39, 174, 96, 0.2)' }]}>
                <Ionicons name="home" size={20} color="#27AE60" />
              </View>
              <View style={styles.mapLocationDetails}>
                <Text style={styles.mapLocationLabel}>Delivery Location</Text>
                <Text style={styles.mapLocationAddress} numberOfLines={2}>
                  {orderDetails.deliveryDetails.address}
                </Text>
              </View>
            </View>
          )}

          {vendorLocation && (
            <View style={styles.mapLocationItem}>
              <View style={[styles.mapLocationIcon, { backgroundColor: 'rgba(0, 122, 255, 0.2)' }]}>
                <Ionicons name="storefront" size={20} color="#007AFF" />
              </View>
              <View style={styles.mapLocationDetails}>
                <Text style={styles.mapLocationLabel}>Vendor Location</Text>
                <Text style={styles.mapLocationAddress} numberOfLines={2}>
                  {orderDetails.vendorLocation.address}
                </Text>
              </View>
            </View>
          )}

          {(riderLocation || (isRiderForThisOrder && currentLoc)) && (
            <View style={styles.mapLocationItem}>
              <View style={[styles.mapLocationIcon, { backgroundColor: 'rgba(243, 156, 18, 0.2)' }]}>
                <Ionicons name="car" size={20} color="#F39C12" />
              </View>
              <View style={styles.mapLocationDetails}>
                <Text style={styles.mapLocationLabel}>
                  {isRiderForThisOrder ? 'Your Location' : 'Rider Location'}
                </Text>
                <Text style={styles.mapLocationAddress}>
                  {isRiderForThisOrder ? 'Current Position' : 'In Transit'}
                </Text>
                {buyerLocation && (riderLocation || currentLoc) && (
                  <Text style={styles.mapDistanceText}>
                    {riderLocationAPI.formatDistance(
                      riderLocationAPI.calculateDistance(
                        (riderLocation || currentLoc)!.latitude,
                        (riderLocation || currentLoc)!.longitude,
                        buyerLocation.latitude,
                        buyerLocation.longitude
                      )
                    )} away
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#666" />
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity onPress={() => setShowNotesModal(true)} style={styles.notesButton}>
          <Ionicons name="document-text-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="white"
            colors={['#007AFF']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>#{orderDetails.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(orderDetails.status) }]}>
              <Text style={styles.statusText}>{orderDetails.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
            {/* Order Source Badge */}
            {orderDetails.source && (() => {
              const sourceInfo = getOrderSourceInfo(orderDetails.source);
              return (
                <View style={[styles.sourceBadge, { backgroundColor: sourceInfo.color }]}>
                  <Ionicons name={sourceInfo.icon as any} size={12} color="white" />
                  <Text style={styles.sourceText}>{sourceInfo.label}</Text>
                </View>
              );
            })()}
          </View>
          <Text style={styles.orderTime}>{formatTime(orderDetails.createdAt)}</Text>
          <Text style={styles.orderTotal}>{formatCurrency(orderDetails.total)}</Text>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.customerCard}>
            <Image
              source={{ uri: orderDetails.customer.avatar || 'https://via.placeholder.com/50' }}
              style={styles.customerAvatar}
            />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{orderDetails.customer.name}</Text>
              <Text style={styles.customerPhone}>{orderDetails.customer.phone}</Text>
              {orderDetails.customer.email && (
                <Text style={styles.customerEmail}>{orderDetails.customer.email}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="call-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* PIN Verification Section - Only show to Rider (pickup) or Buyer (delivery) */}
        {(orderDetails.pickupPin || orderDetails.deliveryPin) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔐 Verification PINs</Text>
            
            {/* Pickup PIN - Show to Rider */}
            {orderDetails.pickupPin && (
              <View style={styles.pinCard}>
                <View style={styles.pinHeader}>
                  <Ionicons name="bag-check-outline" size={24} color="#007AFF" />
                  <Text style={styles.pinTitle}>Pickup PIN</Text>
                  {orderDetails.pickupPinVerifiedAt && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.pinDescription}>
                  Show this PIN to the vendor when picking up the order
                </Text>
                <View style={styles.pinDisplay}>
                  <Text style={styles.pinText}>{orderDetails.pickupPin}</Text>
                </View>
              </View>
            )}

            {/* Delivery PIN - Show to Buyer */}
            {orderDetails.deliveryPin && (
              <View style={styles.pinCard}>
                <View style={styles.pinHeader}>
                  <Ionicons name="home-outline" size={24} color="#FF9500" />
                  <Text style={styles.pinTitle}>Delivery PIN</Text>
                  {orderDetails.deliveryPinVerifiedAt && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.pinDescription}>
                  Give this PIN to the rider upon delivery
                </Text>
                <View style={styles.pinDisplay}>
                  <Text style={styles.pinText}>{orderDetails.deliveryPin}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Pickup Location (Vendor Address) - Show to Riders (only if user is the rider for this order) */}
        {orderDetails.vendorLocation && orderDetails.rider_id === user?.id && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Pickup Location</Text>
              {orderDetails.vendorLocation.coordinates && (
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={() => setShowMapModal(true)}
                >
                  <Ionicons name="map-outline" size={20} color="#007AFF" />
                  <Text style={styles.mapButtonText}>Map</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.pickupCard}>
              {orderDetails.vendorInfo && (
                <View style={styles.vendorInfoRow}>
                  <Ionicons name="storefront-outline" size={20} color="#007AFF" />
                  <View style={styles.vendorInfoText}>
                    <Text style={styles.vendorName}>{orderDetails.vendorInfo.name}</Text>
                    {orderDetails.vendorInfo.phone && (
                      <Text style={styles.vendorPhone}>{orderDetails.vendorInfo.phone}</Text>
                    )}
                  </View>
                </View>
              )}
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={20} color="#666" />
                <Text style={styles.deliveryAddress}>{orderDetails.vendorLocation.address}</Text>
              </View>
              {orderDetails.vendorLocation.coordinates && (
                <TouchableOpacity 
                  style={styles.directionsButton}
                  onPress={openDirectionsToVendor}
                >
                  <Ionicons name="navigate" size={20} color="#007AFF" />
                  <Text style={styles.directionsButtonText}>Get Directions to Vendor</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Vendor Location (For Vendors to see their own location - only if user is the vendor for this order) */}
        {orderDetails.vendorLocation && orderDetails.vendor_id === user?.id && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Your Location</Text>
              {orderDetails.vendorLocation.coordinates && (
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={() => setShowMapModal(true)}
                >
                  <Ionicons name="map-outline" size={20} color="#007AFF" />
                  <Text style={styles.mapButtonText}>Map</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.pickupCard}>
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={20} color="#666" />
                <Text style={styles.deliveryAddress}>{orderDetails.vendorLocation.address}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Delivery Information */}
        {orderDetails.deliveryAddress && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Delivery Information</Text>
              {orderDetails.deliveryDetails.coordinates && (
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={() => setShowMapModal(true)}
                >
                  <Ionicons name="map-outline" size={20} color="#007AFF" />
                  <Text style={styles.mapButtonText}>Map</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.deliveryCard}>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={styles.deliveryAddress}>{orderDetails.deliveryDetails.address}</Text>
            </View>
            {orderDetails.deliveryDetails.instructions && (() => {
              const INSTRUCTIONS_LIMIT = 120;
              const instructions = orderDetails.deliveryDetails.instructions;
              const isLong = instructions.length > INSTRUCTIONS_LIMIT;
              const displayText = showFullInstructions || !isLong
                ? instructions
                : `${instructions.substring(0, INSTRUCTIONS_LIMIT)}...`;
              
              return (
                <View style={styles.instructionsRow}>
                  <Ionicons name="information-circle-outline" size={20} color="#666" />
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.deliveryInstructions}>{displayText}</Text>
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
            {orderDetails.deliveryDetails.coordinates && (
              <TouchableOpacity 
                style={styles.directionsButton}
                onPress={openDirections}
              >
                <Ionicons name="navigate" size={20} color="#007AFF" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            )}
            <View style={styles.deliveryFeeRow}>
              <Text style={styles.deliveryFeeLabel}>Delivery Fee:</Text>
              <Text style={styles.deliveryFeeAmount}>{formatCurrency(orderDetails.deliveryFee)}</Text>
            </View>
          </View>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items ({orderDetails.items.length})</Text>
          {orderDetails.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <Image source={{ uri: item.image }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
                {item.notes && <Text style={styles.itemNotes}>Note: {item.notes}</Text>}
                <View style={styles.itemPricing}>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Order Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          {orderDetails.timeline.map((event, index) => (
            <View key={index} style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: getStatusColor(event.status) }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{event.status.replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.timelineTime}>{formatTime(event.timestamp)}</Text>
                {event.note && <Text style={styles.timelineNote}>{event.note}</Text>}
              </View>
            </View>
          ))}
        </View>

        {/* Notes Section */}
        {orderDetails.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{orderDetails.notes}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {getAvailableActions().length > 0 && (
          <View style={styles.actionsSection}>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.prepTimeButton}
                onPress={() => setShowPrepTimeModal(true)}
              >
                <Ionicons name="time-outline" size={20} color="#007AFF" />
                <Text style={styles.prepTimeText}>Update Prep Time</Text>
              </TouchableOpacity>
              {existingDisputeId ? (
                <TouchableOpacity
                  style={styles.disputeButton}
                  onPress={() => (navigation as any).navigate('DisputeDetails', { disputeId: existingDisputeId })}
                >
                  <Ionicons name="document-text" size={20} color="#007AFF" />
                  <Text style={styles.disputeButtonText}>View Dispute</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.disputeButton, { borderColor: 'rgba(231, 76, 60, 0.3)' }]}
                  onPress={() => (navigation as any).navigate('CreateDispute', { orderId })}
                >
                  <Ionicons name="alert-circle" size={20} color="#E74C3C" />
                  <Text style={[styles.disputeButtonText, { color: '#E74C3C' }]}>File Dispute</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.mainActions}>
              {getAvailableActions().map((actionItem, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.actionButton, { backgroundColor: actionItem.color }]}
                  onPress={() => handleAction(actionItem.action)}
                  disabled={actionLoading === actionItem.action}
                >
                  {actionLoading === actionItem.action ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name={actionItem.icon as any} size={20} color="white" />
                      <Text style={styles.actionButtonText}>{actionItem.label}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Notes Modal */}
      <Modal transparent visible={showNotesModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Enter notes for this order..."
              placeholderTextColor="#666"
              value={notes}
              onChangeText={setNotes}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowNotesModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleAddNotes}
              >
                <Text style={styles.modalSaveText}>Save Notes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Prep Time Modal */}
      <Modal transparent visible={showPrepTimeModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Preparation Time</Text>
            <TextInput
              style={styles.prepTimeInput}
              placeholder="Enter time in minutes"
              placeholderTextColor="#666"
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPrepTimeModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleUpdatePrepTime}
              >
                <Text style={styles.modalSaveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowMapModal(false)}
      >
        {renderMapModal()}
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  notesButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  orderHeader: {
    backgroundColor: '#111',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
  orderTime: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 2,
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
  },
  callButton: {
    padding: 12,
    backgroundColor: '#222',
    borderRadius: 8,
  },
  deliveryCard: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
  },
  pickupCard: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  vendorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  vendorInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  vendorPhone: {
    fontSize: 14,
    color: '#888',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deliveryAddress: {
    fontSize: 16,
    color: 'white',
    marginLeft: 8,
    flex: 1,
    lineHeight: 22,
  },
  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionsContainer: {
    flex: 1,
    marginLeft: 8,
  },
  deliveryInstructions: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  seeMoreButton: {
    marginTop: 4,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '500',
  },
  deliveryFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  deliveryFeeLabel: {
    fontSize: 16,
    color: '#666',
  },
  deliveryFeeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemNotes: {
    fontSize: 12,
    color: '#ccc',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timelineNote: {
    fontSize: 14,
    color: '#ccc',
    fontStyle: 'italic',
  },
  notesCard: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
  },
  notesText: {
    fontSize: 16,
    color: 'white',
    lineHeight: 22,
  },
  actionsSection: {
    padding: 20,
  },
  quickActions: {
    marginBottom: 20,
  },
  prepTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
  },
  prepTimeText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disputeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  disputeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mainActions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // PIN Display Styles
  pinCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 12,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  pinDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
    lineHeight: 20,
  },
  pinDisplay: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  pinText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#666',
    fontSize: 18,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  notesInput: {
    backgroundColor: '#222',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  prepTimeInput: {
    backgroundColor: '#222',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    marginRight: 8,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: 'white',
    fontSize: 16,
  },
  modalSaveButton: {
    flex: 1,
    padding: 12,
    marginLeft: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // ✅ Map Modal Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
  },
  mapButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.3)',
    marginTop: 12,
  },
  directionsButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  mapModalCloseButton: {
    padding: 8,
  },
  mapModalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  mapModalDirectionsButton: {
    padding: 8,
  },
  mapModalMapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  mapModalInfo: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  mapLocationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  mapLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mapLocationDetails: {
    flex: 1,
  },
  mapLocationLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  mapLocationAddress: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  mapDistanceText: {
    color: '#007AFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  mapPlaceholderText: {
    color: '#888',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // ✅ Workspace Map Visualization Styles
  workspaceMapContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  workspaceMapVisualization: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  mapPoint: {
    alignItems: 'center',
    flex: 1,
  },
  mapMarkerVendor: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'white',
  },
  mapMarkerRider: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F39C12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'white',
  },
  mapMarkerBuyer: {
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
  mapPointLabel: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  mapRouteLine: {
    width: 4,
    height: 60,
    backgroundColor: '#333',
    marginHorizontal: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  mapRouteLineFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#007AFF',
  },
  mapOverlay: {
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
  mapOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapOverlayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default VendorOrderDetailsScreen;
