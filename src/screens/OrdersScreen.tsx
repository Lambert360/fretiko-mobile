import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ordersAPI, Order } from '../services/ordersAPI';
import { walletAPI } from '../services/walletAPI';

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const ordersData = await ordersAPI.getMyOrders();
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'confirmed': return '#3498DB';
      case 'processing': return '#3498DB';
      case 'assigned': return '#9B59B6';
      case 'picked_up': return '#E67E22';
      case 'in_transit': return '#8E44AD';
      case 'out_for_delivery': return '#9B59B6';
      case 'delivered': return '#27AE60';
      case 'cancelled': return '#E74C3C';
      default: return '#888';
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'processing': return 'Processing';
      case 'assigned': return 'Rider Assigned';
      case 'picked_up': return 'Picked Up';
      case 'in_transit': return 'In Transit';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return walletAPI.formatFreti(price);
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={() => (navigation as any).navigate('OrderTracking', { orderId: item.id })}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
          <Text style={styles.orderDate}>{formatDate(item.orderDate)}</Text>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.orderItems}>
        {item.items.map((orderItem) => (
          <View key={orderItem.id} style={styles.orderItem}>
            <Image source={{ uri: orderItem.image }} style={styles.itemImage} />
            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={1}>
                {orderItem.name}
              </Text>
              <Text style={styles.itemQuantity}>Qty: {orderItem.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatPrice(orderItem.price)}</Text>
          </View>
        ))}
      </View>

      {/* Rider Information */}
      {(item as any).riderInfo && (
        <View style={styles.riderSection}>
          <View style={styles.riderInfo}>
            <Ionicons name="person-circle-outline" size={20} color="#3498DB" />
            <Text style={styles.riderName}>
              {(item as any).riderInfo.riderName === 'Self Pickup' ? 'Self Pickup' : `Rider: ${(item as any).riderInfo.riderName}`}
            </Text>
          </View>
          {(item as any).riderInfo.vehicleType && (item as any).riderInfo.vehicleType !== 'pickup' && (
            <Text style={styles.riderVehicle}>
              {(item as any).riderInfo.vehicleType.charAt(0).toUpperCase() + (item as any).riderInfo.vehicleType.slice(1)} delivery
            </Text>
          )}
        </View>
      )}

      {/* Escrow Status */}
      {(item as any).escrowStatus && (
        <View style={styles.escrowSection}>
          <View style={styles.escrowInfo}>
            <Ionicons 
              name={
                (item as any).escrowStatus === 'held' ? 'shield-checkmark' : 
                (item as any).escrowStatus === 'released' ? 'checkmark-circle' : 
                'time-outline'
              } 
              size={16} 
              color={
                (item as any).escrowStatus === 'held' ? '#F39C12' : 
                (item as any).escrowStatus === 'released' ? '#27AE60' : 
                '#888'
              } 
            />
            <Text style={styles.escrowText}>
              Funds {(item as any).escrowStatus === 'held' ? 'in escrow' : 
                    (item as any).escrowStatus === 'released' ? 'released' : 
                    'processed'}
            </Text>
          </View>
          {(item as any).escrowStatus === 'held' && item.status === 'delivered' && (
            <TouchableOpacity style={styles.releaseButton}>
              <Text style={styles.releaseButtonText}>Release Funds</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.orderFooter}>
        <View style={styles.orderSummary}>
          <Text style={styles.totalLabel}>Total: </Text>
          <Text style={styles.totalAmount}>{formatPrice(item.total)}</Text>
        </View>

        {item.estimatedDelivery && item.status !== 'delivered' && (
          <Text style={styles.deliveryInfo}>
            Est. delivery: {formatDate(item.estimatedDelivery)}
          </Text>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.trackButton}
            onPress={(e) => {
              e.stopPropagation();
              (navigation as any).navigate('OrderTracking', { orderId: item.id });
            }}
          >
            <Ionicons name="location-outline" size={16} color="#3498DB" />
            <Text style={styles.trackButtonText}>Track Order</Text>
          </TouchableOpacity>

          {item.status === 'delivered' && (
            <TouchableOpacity 
              style={styles.reviewButton}
              onPress={(e) => {
                e.stopPropagation();
                // Navigate to review screen
              }}
            >
              <Ionicons name="star-outline" size={16} color="#F39C12" />
              <Text style={styles.reviewButtonText}>Review</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="bag-outline" size={80} color="#666" />
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptySubtitle}>
        Your orders will appear here once you make a purchase
      </Text>
      <TouchableOpacity 
        style={styles.shopButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.shopButtonText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>My Orders</Text>
        
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          style={styles.ordersList}
          contentContainerStyle={styles.ordersContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadOrders();
              }}
              tintColor="#3498DB"
            />
          }
        />
      )}
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
  searchButton: {
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
    marginTop: 16,
  },
  ordersList: {
    flex: 1,
  },
  ordersContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orderDate: {
    color: '#888',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderItems: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333',
    paddingVertical: 12,
    marginVertical: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemQuantity: {
    color: '#888',
    fontSize: 12,
  },
  itemPrice: {
    color: '#27AE60',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderFooter: {
    alignItems: 'flex-end',
  },
  orderSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    color: '#888',
    fontSize: 14,
  },
  totalAmount: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deliveryInfo: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  trackButtonText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  riderSection: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.2)',
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  riderName: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  riderVehicle: {
    color: '#888',
    fontSize: 12,
    marginLeft: 28,
  },
  escrowSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
  },
  escrowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  escrowText: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  releaseButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  releaseButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F39C12',
  },
  reviewButtonText: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  shopButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OrdersScreen;