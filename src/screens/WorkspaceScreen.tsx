import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { workspaceAPI, WorkspaceOrder } from '../services/workspaceAPI';
import WorkspaceLiveStreamAnalytics from '../components/WorkspaceLiveStreamAnalytics';

const WorkspaceScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [activeOrders, setActiveOrders] = useState<WorkspaceOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<WorkspaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLiveStreamAnalytics, setShowLiveStreamAnalytics] = useState(false);
  const [workspaceStats, setWorkspaceStats] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadWorkspaceData();
    }, [])
  );

  const loadWorkspaceData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      const [activeData, completedData, statsData] = await Promise.all([
        workspaceAPI.getActiveOrders(),
        workspaceAPI.getCompletedOrders(),
        workspaceAPI.getWorkspaceStats(),
      ]);

      setActiveOrders(activeData);
      setCompletedOrders(completedData);
      setWorkspaceStats(statsData);
    } catch (error) {
      console.error('Error loading workspace data:', error);
      Alert.alert('Error', 'Failed to load workspace data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWorkspaceData(false);
  };

  const handleQuickAction = async (orderId: string, action: string) => {
    setActionLoading(orderId);
    try {
      switch (action) {
        case 'accept':
          await workspaceAPI.acceptOrder(orderId);
          break;
        case 'ready':
          await workspaceAPI.markOrderReady(orderId);
          break;
        case 'pickup':
          await workspaceAPI.confirmPickup(orderId);
          break;
        case 'delivered':
          await workspaceAPI.markDelivered(orderId);
          break;
      }

      // Reload data to reflect changes
      loadWorkspaceData(false);
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      Alert.alert('Error', `Failed to ${action} order`);
    } finally {
      setActionLoading(null);
    }
  };

  const getOrderStatusColor = (status: string) => {
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
      case 'regular': return { label: 'Store', icon: 'storefront-outline', color: '#007AFF' };
      case 'live_stream': return { label: 'Live', icon: 'videocam-outline', color: '#FF2D92' };
      case 'auction': return { label: 'Auction', icon: 'hammer-outline', color: '#FF9500' };
      case 'service_booking': return { label: 'Service', icon: 'construct-outline', color: '#34C759' };
      default: return { label: 'Store', icon: 'storefront-outline', color: '#007AFF' };
    }
  };

  const getQuickActionForOrder = (order: WorkspaceOrder) => {
    if (user?.isRider) {
      switch (order.status) {
        case 'ready_for_pickup': return { action: 'pickup', label: 'Pick Up', icon: 'bag-outline' };
        case 'out_for_delivery': return { action: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline' };
      }
    } else if (user?.isSeller) {
      switch (order.status) {
        case 'pending': return { action: 'accept', label: 'Accept', icon: 'checkmark-outline' };
        case 'processing': return { action: 'ready', label: 'Ready', icon: 'cube-outline' };
      }
    }
    return null;
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
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderItem = ({ item }: { item: WorkspaceOrder }) => {
    const quickAction = getQuickActionForOrder(item);
    const isLoadingAction = actionLoading === item.id;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('VendorOrderDetails', { orderId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
            {/* Order Source Badge */}
            {item.source && (() => {
              const sourceInfo = getOrderSourceInfo(item.source);
              return (
                <View style={[styles.sourceBadge, { backgroundColor: sourceInfo.color }]}>
                  <Ionicons name={sourceInfo.icon as any} size={10} color="white" />
                  <Text style={styles.sourceText}>{sourceInfo.label}</Text>
                </View>
              );
            })()}
          </View>
          <Text style={styles.orderTime}>{formatTime(item.createdAt)}</Text>
        </View>

        <View style={styles.customerInfo}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.customerText}>{item.customerName}</Text>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.itemsInfo}>
            <Text style={styles.itemCount}>{item.itemCount} item{item.itemCount > 1 ? 's' : ''}</Text>
            <Text style={styles.orderTotal}>{formatCurrency(item.total)}</Text>
          </View>

          <View style={styles.deliveryInfo}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.deliveryAddress} numberOfLines={1}>
              {item.deliveryAddress}
            </Text>
          </View>
        </View>

        {quickAction && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.quickActionButton, { opacity: isLoadingAction ? 0.6 : 1 }]}
              onPress={() => handleQuickAction(item.id, quickAction.action)}
              disabled={isLoadingAction}
            >
              {isLoadingAction ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name={quickAction.icon as any} size={16} color="white" />
                  <Text style={styles.quickActionText}>{quickAction.label}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={() => navigation.navigate('VendorOrderDetails', { orderId: item.id })}
            >
              <Text style={styles.viewDetailsText}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={activeTab === 'active' ? 'hourglass-outline' : 'checkmark-done-outline'}
        size={80}
        color="#ccc"
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'active' ? 'No Active Orders' : 'No Completed Orders'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'active'
          ? 'New orders will appear here when customers place them'
          : 'Completed orders will be listed here'
        }
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = activeTab === 'active' ? activeOrders : completedOrders;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Workspace</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowLiveStreamAnalytics(true)}
            style={styles.liveAnalyticsButton}
          >
            <Ionicons name="videocam" size={20} color="#FF2D92" />
            {workspaceStats?.liveStreamStats?.activeLiveStreams > 0 && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{workspaceStats.liveStreamStats.activeLiveStreams}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Analytics')}
            style={styles.analyticsButton}
          >
            <Ionicons name="analytics-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Stream Insights Panel */}
      {workspaceStats?.liveStreamStats && (
        <View style={styles.liveStreamInsights}>
          <View style={styles.insightItem}>
            <Ionicons name="videocam" size={16} color="#FF2D92" />
            <Text style={styles.insightValue}>{workspaceStats.liveStreamStats.activeLiveStreams}</Text>
            <Text style={styles.insightLabel}>Live</Text>
          </View>

          <View style={styles.insightItem}>
            <Ionicons name="cube" size={16} color="#34C759" />
            <Text style={styles.insightValue}>{workspaceStats.liveStreamStats.todayLiveOrders}</Text>
            <Text style={styles.insightLabel}>Live Orders</Text>
          </View>

          <View style={styles.insightItem}>
            <Ionicons name="cash" size={16} color="#FF9500" />
            <Text style={styles.insightValue}>{formatCurrency(workspaceStats.liveStreamStats.todayLiveRevenue)}</Text>
            <Text style={styles.insightLabel}>Live Revenue</Text>
          </View>

          <View style={styles.insightItem}>
            <Ionicons name="trending-up" size={16} color="#007AFF" />
            <Text style={styles.insightValue}>{workspaceStats.liveStreamStats.liveOrdersPercentage.toFixed(0)}%</Text>
            <Text style={styles.insightLabel}>of Orders</Text>
          </View>
        </View>
      )}

      {/* Auction Insights Panel */}
      {workspaceStats?.revenueBySource && workspaceStats.revenueBySource.auction > 0 && (
        <View style={styles.auctionInsights}>
          <View style={styles.insightHeader}>
            <Ionicons name="hammer" size={18} color="#8E44AD" />
            <Text style={styles.insightHeaderText}>Auction Performance</Text>
          </View>

          <View style={styles.insightRow}>
            <View style={styles.insightItem}>
              <Ionicons name="hammer-outline" size={16} color="#8E44AD" />
              <Text style={styles.insightValue}>{workspaceStats.ordersBySource.auction || 0}</Text>
              <Text style={styles.insightLabel}>Auctions Sold</Text>
            </View>

            <View style={styles.insightItem}>
              <Ionicons name="cash" size={16} color="#34C759" />
              <Text style={styles.insightValue}>{formatCurrency(workspaceStats.revenueBySource.auction || 0)}</Text>
              <Text style={styles.insightLabel}>Auction Revenue</Text>
            </View>

            <View style={styles.insightItem}>
              <Ionicons name="trending-up" size={16} color="#FF9500" />
              <Text style={styles.insightValue}>
                {workspaceStats.todayRevenue > 0
                  ? ((workspaceStats.revenueBySource.auction / workspaceStats.todayRevenue) * 100).toFixed(0)
                  : 0}%
              </Text>
              <Text style={styles.insightLabel}>of Revenue</Text>
            </View>

            <View style={styles.insightItem}>
              <Ionicons name="calculator" size={16} color="#007AFF" />
              <Text style={styles.insightValue}>
                {formatCurrency(
                  workspaceStats.ordersBySource.auction > 0
                    ? workspaceStats.revenueBySource.auction / workspaceStats.ordersBySource.auction
                    : 0
                )}
              </Text>
              <Text style={styles.insightLabel}>Avg Sale</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active Deals
          </Text>
          {activeOrders.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed Deals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <FlatList
        data={currentData}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          currentData.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="white"
            colors={['#007AFF']}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Live Stream Analytics Modal */}
      <WorkspaceLiveStreamAnalytics
        isVisible={showLiveStreamAnalytics}
        onClose={() => setShowLiveStreamAnalytics(false)}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveAnalyticsButton: {
    padding: 8,
    marginRight: 8,
    position: 'relative',
  },
  liveBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  analyticsButton: {
    padding: 8,
  },
  liveStreamInsights: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  auctionInsights: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#8E44AD',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E44AD',
    marginLeft: 8,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  insightItem: {
    alignItems: 'center',
  },
  insightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginVertical: 4,
  },
  insightLabel: {
    fontSize: 10,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  orderCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'white',
    marginLeft: 3,
  },
  orderTime: {
    fontSize: 14,
    color: '#666',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerText: {
    fontSize: 14,
    color: '#ccc',
    marginLeft: 6,
  },
  orderDetails: {
    marginBottom: 16,
  },
  itemsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryAddress: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    color: '#007AFF',
    fontSize: 14,
    marginRight: 4,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default WorkspaceScreen;