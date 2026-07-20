import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ordersAPI } from '../services/ordersAPI';
import { walletAPI } from '../services/walletAPI';
import AdaptiveText from '../components/AdaptiveText';

interface GroupedOrderScreenProps {
  navigation: any;
  route: {
    params: {
      groupId: string;
    };
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  vendor_name: string;
  vendor_id: string;
  rider_id: string;
  delivery_fee: number;
  items: any[];
  created_at: string;
  group_sequence: number;
}

interface OrderGroup {
  id: string;
  group_number: string;
  buyer_id: string;
  total_amount: number;
  total_orders: number;
  delivery_address: any;
  created_at: string;
}

const GroupedOrderScreen: React.FC<GroupedOrderScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;

  const [group, setGroup] = useState<OrderGroup | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingOrders, setConfirmingOrders] = useState<string[]>([]);

  useEffect(() => {
    loadGroupedOrder();
  }, [groupId]);

  const loadGroupedOrder = async () => {
    try {
      setLoading(true);
      const data = await ordersAPI.getOrderGroup(groupId);
      setGroup(data.group);
      setOrders(data.orders);
      console.log('📦 Loaded grouped order:', data.group.group_number);
    } catch (error) {
      console.error('Error loading grouped order:', error);
      Alert.alert('Error', 'Failed to load order group');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroupedOrder();
    setRefreshing(false);
  };

  const handleConfirmOrder = async (orderId: string) => {
    Alert.alert(
      'Confirm Order Received',
      'Have you received this order in good condition?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setConfirmingOrders([...confirmingOrders, orderId]);
              await ordersAPI.confirmOrderReceived(orderId);
              Alert.alert('Success', 'Order confirmed! Funds released to vendor.');
              await loadGroupedOrder();
            } catch (error) {
              console.error('Error confirming order:', error);
              Alert.alert('Error', 'Failed to confirm order');
            } finally {
              setConfirmingOrders(confirmingOrders.filter(id => id !== orderId));
            }
          },
        },
      ]
    );
  };

  const handleConfirmAll = async () => {
    const deliveredOrders = orders.filter(order => order.status === 'delivered');
    
    if (deliveredOrders.length === 0) {
      Alert.alert('No Orders Ready', 'No delivered orders to confirm yet.');
      return;
    }

    Alert.alert(
      'Confirm All Orders',
      `Confirm receipt of ${deliveredOrders.length} order${deliveredOrders.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm All',
          onPress: async () => {
            try {
              const orderIds = deliveredOrders.map(o => o.id);
              await ordersAPI.confirmMultipleOrders(orderIds);
              Alert.alert('Success', `${deliveredOrders.length} orders confirmed!`);
              await loadGroupedOrder();
            } catch (error) {
              console.error('Error confirming multiple orders:', error);
              Alert.alert('Error', 'Failed to confirm orders');
            }
          },
        },
      ]
    );
  };

  const handleOrderPress = (orderId: string) => {
    navigation.navigate('OrderDetails', { orderId });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'confirmed': return '#007AFF';
      case 'preparing': return '#5856D6';
      case 'ready_for_pickup': return '#AF52DE';
      case 'picked_up': return '#FF2D55';
      case 'out_for_delivery': return '#FF3B30';
      case 'delivered': return '#34C759';
      case 'completed': return '#27AE60';
      case 'cancelled': return '#E74C3C';
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading grouped order...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#E74C3C" />
        <Text style={styles.errorText}>Order group not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const allDelivered = orders.every(o => o.status === 'delivered' || o.status === 'completed');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Grouped Order</Text>
          <Text style={styles.headerSubtitle}>{group.group_number}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
        }
      >
        {/* Group Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="cube" size={24} color="#007AFF" />
            <Text style={styles.summaryTitle}>Order Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summaryValue}>{group.total_orders}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryValue}>{walletAPI.formatFreti(group.total_amount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Completed</Text>
            <Text style={styles.summaryValue}>
              {completedCount} / {group.total_orders}
            </Text>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <Ionicons name="location" size={20} color="#FF9500" />
            <Text style={styles.addressTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.addressText}>
            {group.delivery_address.fullName}
          </Text>
          <Text style={styles.addressText}>
            {group.delivery_address.address}
          </Text>
          <Text style={styles.addressText}>
            {group.delivery_address.city}, {group.delivery_address.state} {group.delivery_address.postalCode}
          </Text>
          <Text style={styles.addressText}>
            {group.delivery_address.phone}
          </Text>
        </View>

        {/* Individual Orders */}
        <View style={styles.ordersSection}>
          <View style={styles.ordersSectionHeader}>
            <Text style={styles.ordersSectionTitle}>Individual Orders</Text>
            {deliveredCount > 0 && (
              <TouchableOpacity style={styles.confirmAllButton} onPress={handleConfirmAll}>
                <Ionicons name="checkmark-done" size={16} color="#27AE60" />
                <Text style={styles.confirmAllText}>Confirm All ({deliveredCount})</Text>
              </TouchableOpacity>
            )}
          </View>

          {orders.map((order, index) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => handleOrderPress(order.id)}
              activeOpacity={0.7}
            >
              {/* Order Header */}
              <View style={styles.orderHeader}>
                <View style={styles.orderNumberContainer}>
                  <Text style={styles.orderSequence}>Order {order.group_sequence}</Text>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                    {getStatusText(order.status)}
                  </Text>
                </View>
              </View>

              {/* Vendor Info */}
              <View style={styles.vendorInfo}>
                <Ionicons name="storefront" size={16} color="#007AFF" />
                <AdaptiveText style={styles.vendorName} baseFontSize={14} minFontSize={10} maxChars={22} numberOfLines={1}>{order.vendor_name}</AdaptiveText>
              </View>

              {/* Order Details */}
              <View style={styles.orderDetails}>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Items</Text>
                  <Text style={styles.orderDetailValue}>{order.items?.length || 0}</Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Amount</Text>
                  <Text style={styles.orderDetailValue}>{walletAPI.formatFreti(order.total_amount)}</Text>
                </View>
                <View style={styles.orderDetailRow}>
                  <Text style={styles.orderDetailLabel}>Delivery</Text>
                  <Text style={styles.orderDetailValue}>{walletAPI.formatFreti(order.delivery_fee)}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              {order.status === 'delivered' && (
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleConfirmOrder(order.id)}
                  disabled={confirmingOrders.includes(order.id)}
                >
                  {confirmingOrders.includes(order.id) ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={styles.confirmButtonText}>Confirm Received</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {order.status === 'completed' && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                  <Text style={styles.completedText}>Confirmed & Completed</Text>
                </View>
              )}

              {/* Tap to view details */}
              <View style={styles.viewDetailsHint}>
                <Text style={styles.viewDetailsText}>Tap to view full details</Text>
                <Ionicons name="chevron-forward" size={14} color="#666" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* All Delivered Notice */}
        {allDelivered && completedCount < group.total_orders && (
          <View style={styles.allDeliveredNotice}>
            <Ionicons name="information-circle" size={20} color="#27AE60" />
            <Text style={styles.allDeliveredText}>
              All orders delivered! Confirm receipt to release funds to vendors.
            </Text>
          </View>
        )}

        {/* All Completed Notice */}
        {completedCount === group.total_orders && (
          <View style={styles.allCompletedNotice}>
            <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
            <Text style={styles.allCompletedText}>
              All orders completed! Thank you for shopping with us.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1A1F3A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E27',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E27',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#E74C3C',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#999',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  addressCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#CCC',
    marginBottom: 4,
  },
  ordersSection: {
    marginBottom: 16,
  },
  ordersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ordersSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  confirmAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  confirmAllText: {
    color: '#27AE60',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  orderCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumberContainer: {
    flex: 1,
  },
  orderSequence: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  orderNumber: {
    fontSize: 13,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  vendorName: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  orderDetails: {
    marginBottom: 12,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderDetailLabel: {
    fontSize: 13,
    color: '#999',
  },
  orderDetailValue: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '500',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  completedText: {
    color: '#27AE60',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  viewDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  allDeliveredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  allDeliveredText: {
    flex: 1,
    fontSize: 14,
    color: '#27AE60',
    marginLeft: 12,
    lineHeight: 20,
  },
  allCompletedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    padding: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  allCompletedText: {
    fontSize: 15,
    color: '#27AE60',
    fontWeight: '600',
    marginLeft: 12,
  },
});

export default GroupedOrderScreen;

