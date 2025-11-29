import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { workspaceAPI, WorkspaceOrder } from '../services/workspaceAPI';
import { disputesAPI } from '../services/disputesAPI';

interface VendorOrderDetailsParams {
  orderId: string;
}

interface OrderDetailsData extends WorkspaceOrder {
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

  const { orderId } = route.params as VendorOrderDetailsParams;

  const [orderDetails, setOrderDetails] = useState<OrderDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPrepTimeModal, setShowPrepTimeModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [existingDisputeId, setExistingDisputeId] = useState<string | null>(null);

  useEffect(() => {
    loadOrderDetails();
    checkExistingDispute();
  }, [orderId]);

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

    if (user.isSeller) {
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

    if (user.isRider) {
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

        {/* Delivery Information */}
        {orderDetails.deliveryAddress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Information</Text>
            <View style={styles.deliveryCard}>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={styles.deliveryAddress}>{orderDetails.deliveryDetails.address}</Text>
            </View>
            {orderDetails.deliveryDetails.instructions && (
              <View style={styles.instructionsRow}>
                <Ionicons name="information-circle-outline" size={20} color="#666" />
                <Text style={styles.deliveryInstructions}>{orderDetails.deliveryDetails.instructions}</Text>
              </View>
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
  deliveryInstructions: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
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
});

export default VendorOrderDetailsScreen;