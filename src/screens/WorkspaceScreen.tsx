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
import PINInputModal from '../components/PINInputModal';
import { walletAPI } from '../services/walletAPI';

const WorkspaceScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [activeOrders, setActiveOrders] = useState<WorkspaceOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<WorkspaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true); // ✨ NEW: Separate loading for stats
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLiveStreamAnalytics, setShowLiveStreamAnalytics] = useState(false);
  const [workspaceStats, setWorkspaceStats] = useState<any>(null);
  
  // PIN Modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalConfig, setPinModalConfig] = useState<{
    title: string;
    description: string;
    orderId: string;
    action: string;
  } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadWorkspaceData();
    }, [])
  );

  const loadWorkspaceData = async (showLoading = true) => {
    const startTime = Date.now();
    console.log('⏱️ [WORKSPACE-UI] Starting loadWorkspaceData...');
    
    try {
      if (showLoading && !refreshing) setLoading(true);

      // ✅ OPTIMIZATION: Load orders first (fast - 200-300ms)
      const ordersStart = Date.now();
      const [activeData, completedData] = await Promise.all([
        workspaceAPI.getActiveOrders(),
        workspaceAPI.getCompletedOrders(),
      ]);
      console.log(`⏱️ [WORKSPACE-UI] Orders fetched in ${Date.now() - ordersStart}ms`);

      // ✨ Set orders immediately so UI can render
      setActiveOrders(activeData);
      setCompletedOrders(completedData);
      setLoading(false); // ← Screen can render now!

      console.log(`⏱️ [WORKSPACE-UI] UI can render now (${Date.now() - startTime}ms)`);

      // ✅ Load stats in background (slower - 500-1000ms)
      setStatsLoading(true);
      const statsStart = Date.now();
      try {
        const statsData = await workspaceAPI.getWorkspaceStats();
        setWorkspaceStats(statsData);
        console.log(`⏱️ [WORKSPACE-UI] Stats fetched in ${Date.now() - statsStart}ms`);
      } catch (statsError) {
        console.error('Error loading workspace stats:', statsError);
        // Don't block UI if stats fail - continue with orders
      } finally {
        setStatsLoading(false);
        console.log(`⏱️ [WORKSPACE-UI] ✅ Total loadWorkspaceData completed in ${Date.now() - startTime}ms`);
      }

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
    // ✅ 'delivered' action requires PIN verification
    if (action === 'delivered') {
      const config = {
        orderId,
        action,
        title: 'Delivery Verification',
        description: 'Ask the buyer for their delivery PIN to confirm delivery',
      };
      setPinModalConfig(config);
      setPinModalVisible(true);
      return;
    }

    // ✅ 'pickup' action requires PIN verification (when rider arrives at vendor)
    if (action === 'pickup') {
      const config = {
        orderId,
        action,
        title: 'Pickup Verification',
        description: 'Ask the rider for their pickup PIN to confirm handoff',
      };
      setPinModalConfig(config);
      setPinModalVisible(true);
      return;
    }

    // ✅ 'confirm_pickup' action requires PIN verification (self-pickup: buyer at vendor)
    if (action === 'confirm_pickup') {
      const config = {
        orderId,
        action,
        title: 'Self-Pickup Verification',
        description: 'Ask the buyer for their pickup PIN to confirm they received the order',
      };
      setPinModalConfig(config);
      setPinModalVisible(true);
      return;
    }

    // ✅ Actions that don't require PIN
    setActionLoading(orderId);
    try {
      switch (action) {
        case 'accept':
          await workspaceAPI.acceptOrder(orderId);
          Alert.alert('Success', 'Order accepted successfully');
          break;
        case 'decline':
          await workspaceAPI.declineOrder(orderId, 'Vendor rejected order');
          Alert.alert('Order Rejected', 'Order has been rejected and the buyer will be refunded (escrow).');
          break;
        case 'ready':
          // ✅ Mark order ready WITHOUT PIN (rider delivery)
          await workspaceAPI.markOrderReady(orderId);
          Alert.alert('Success', 'Order marked as ready for pickup. Waiting for rider to arrive.');
          break;
        case 'ready_pickup':
          // ✅ Mark self-pickup order ready (no rider)
          await workspaceAPI.markOrderReadyForPickup(orderId);
          Alert.alert('Success', 'Order is ready! Buyer will be notified to collect it.');
          break;
      }
      loadWorkspaceData(false);
    } catch (error: any) {
      console.error(`Error performing ${action}:`, error);
      Alert.alert('Error', error.message || `Failed to ${action} order`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePINSubmit = async (pin: string) => {
    if (!pinModalConfig) return;

    const { orderId, action } = pinModalConfig;
    
    try {
      if (action === 'pickup') {
        // ✅ Confirm pickup WITH PIN (vendor enters rider's PIN)
        await workspaceAPI.confirmPickupWithPin(orderId, pin);
        Alert.alert('Success', 'Pickup confirmed! Order is now out for delivery.');
      } else if (action === 'confirm_pickup') {
        // ✅ Confirm self-pickup WITH PIN (vendor enters buyer's deliveryPin)
        await workspaceAPI.confirmSelfPickupWithPin(orderId, pin);
        Alert.alert('Success', 'Order collected successfully! Buyer has 24 hours to report issues.');
      } else if (action === 'delivered') {
        // ✅ Mark delivered WITH PIN (rider enters buyer's PIN)
        await workspaceAPI.markDelivered(orderId, pin);
        Alert.alert('Success', 'Order delivered and received! Buyer has 24 hours to report issues.');
      }
      
      setPinModalVisible(false);
      setPinModalConfig(null);
      loadWorkspaceData(false);
    } catch (error: any) {
      // Re-throw error so PIN modal can display it
      throw new Error(error.message || 'Invalid PIN');
    }
  };

  // ✅ Helper function to format delivery address
  const formatDeliveryAddress = (address: any): string => {
    if (!address) return 'No address provided';
    
    // If it's already a string, return it
    if (typeof address === 'string') return address;
    
    // If it's an object, format it
    const parts = [
      address.address,
      address.city,
      address.state,
      address.postalCode
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'No address provided';
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
    // ✅ If user can access workspace, they ARE a seller or rider
    // Show button based on order status, not user role check
    
    // ✅ Check if this is a self-pickup order - must be explicitly 'pickup' type
    const isSelfPickup = order.deliveryType === 'pickup';
    
    // VENDOR ACTIONS (for orders assigned to this vendor)
    switch (order.status) {
      case 'pending': 
        return { action: 'accept', label: 'Accept Order', icon: 'checkmark-outline', enabled: true };
      
      case 'processing': 
        // ✅ Self-pickup: Button says "Mark Ready for Pickup"
        // ✅ Rider delivery: Button says "Mark Ready" (for rider)
        if (isSelfPickup) {
          return { action: 'ready_pickup', label: 'Mark Ready for Pickup', icon: 'checkmark-circle-outline', enabled: true };
        } else {
          return { action: 'ready', label: 'Mark Ready', icon: 'cube-outline', enabled: true };
        }
      
      case 'ready_for_pickup':
        // ✅ Self-pickup: Vendor waits for buyer arrival, button shows PIN entry
        // ✅ Rider delivery: Rider picks up from vendor
        if (isSelfPickup) {
          return { action: 'confirm_pickup', label: 'Confirm Pickup', icon: 'lock-closed-outline', enabled: true };
        } else {
          return { action: 'pickup', label: 'Rider Pickup', icon: 'bag-outline', enabled: true };
        }
      
      case 'out_for_delivery': 
        return { action: 'delivered', label: 'Mark Delivered', icon: 'checkmark-circle-outline', enabled: true };
      
      // Faded states - show button but disabled
      case 'delivered':
        return { action: 'none', label: 'Delivered', icon: 'checkmark-done-outline', enabled: false };
      case 'completed':
        return { action: 'none', label: 'Completed', icon: 'checkmark-done-circle', enabled: false };
      case 'paid':
        return { action: 'none', label: 'Awaiting Vendor', icon: 'time-outline', enabled: false };
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return walletAPI.formatFreti(amount);
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
            <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode="tail">#{item.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
            {/* Order Source Badge */}
            {item.source && (() => {
              const sourceInfo = getOrderSourceInfo(item.source);
              return (
                <View style={[styles.sourceBadge, { backgroundColor: sourceInfo.color }]}>
                  <Ionicons name={sourceInfo.icon as any} size={10} color="white" />
                  <Text style={styles.sourceText} numberOfLines={1}>{sourceInfo.label}</Text>
                </View>
              );
            })()}
          </View>
          <Text style={styles.orderTime} numberOfLines={1}>{formatTime(item.createdAt)}</Text>
        </View>

        <View style={styles.customerInfo}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.customerText} numberOfLines={1} ellipsizeMode="tail">{item.customerName}</Text>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.itemsInfo}>
            <Text style={styles.itemCount}>{item.itemCount} item{item.itemCount > 1 ? 's' : ''}</Text>
            <Text style={styles.orderTotal}>{formatCurrency(item.total)}</Text>
          </View>

          <View style={styles.deliveryInfo}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.deliveryAddress} numberOfLines={1}>
              {formatDeliveryAddress(item.deliveryAddress)}
            </Text>
          </View>
        </View>

        {quickAction && (
          <View style={styles.actionRow}>
            {item.status === 'pending' ? (
              <View style={styles.pendingActionsRow}>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.acceptButton, { opacity: isLoadingAction ? 0.6 : 1 }]}
                  onPress={() => handleQuickAction(item.id, 'accept')}
                  disabled={isLoadingAction}
                >
                  {isLoadingAction ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-outline" size={16} color="white" />
                      <Text style={styles.quickActionText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickActionButton, styles.rejectButton, { opacity: isLoadingAction ? 0.6 : 1 }]}
                  onPress={() => {
                    Alert.alert(
                      'Reject Order',
                      'Are you sure you want to reject this order? The buyer will be refunded from escrow.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Reject', style: 'destructive', onPress: () => handleQuickAction(item.id, 'decline') },
                      ]
                    );
                  }}
                  disabled={isLoadingAction}
                >
                  <Ionicons name="close-outline" size={16} color="white" />
                  <Text style={styles.quickActionText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.quickActionButton,
                    {
                      opacity: isLoadingAction ? 0.6 : (quickAction.enabled ? 1 : 0.4),
                      backgroundColor: quickAction.enabled ? '#007AFF' : '#666',
                    },
                  ]}
                  onPress={() => quickAction.enabled && handleQuickAction(item.id, quickAction.action)}
                  disabled={isLoadingAction || !quickAction.enabled}
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
              </>
            )}
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
      {statsLoading ? (
        <View style={styles.statsLoadingContainer}>
          <ActivityIndicator size="small" color="#3498DB" />
          <Text style={styles.statsLoadingText}>Loading analytics...</Text>
        </View>
      ) : workspaceStats?.liveStreamStats && (
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

      {/* Escrow Metrics Panel */}
      {workspaceStats?.escrowMetrics && (
        workspaceStats.escrowMetrics.totalInEscrow > 0 || 
        workspaceStats.escrowMetrics.riderInEscrow > 0
      ) && (
        <View style={styles.escrowInsights}>
          <View style={styles.insightHeader}>
            <Ionicons name="lock-closed" size={18} color="#F39C12" />
            <Text style={styles.insightHeaderText}>Pending Earnings (Escrow)</Text>
            <TouchableOpacity 
              style={styles.infoIcon}
              onPress={() => Alert.alert(
                'Escrow Protection',
                'Funds are held securely and will be automatically released 24 hours after delivery confirmation. This protects both buyers and sellers.'
              )}
            >
              <Ionicons name="information-circle-outline" size={16} color="#F39C12" />
            </TouchableOpacity>
          </View>

          <View style={styles.insightRow}>
            {workspaceStats.escrowMetrics.totalInEscrow > 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="storefront-outline" size={16} color="#F39C12" />
                <Text style={[styles.insightValue, styles.fadedText]}>
                  {formatCurrency(workspaceStats.escrowMetrics.totalInEscrow)}
                </Text>
                <Text style={styles.insightLabel}>Vendor Earnings</Text>
                <Text style={styles.insightSubtext}>🔒 Held</Text>
              </View>
            )}

            {workspaceStats.escrowMetrics.riderInEscrow > 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="bicycle-outline" size={16} color="#27AE60" />
                <Text style={[styles.insightValue, styles.fadedText]}>
                  {formatCurrency(workspaceStats.escrowMetrics.riderInEscrow)}
                </Text>
                <Text style={styles.insightLabel}>Delivery Fees</Text>
                <Text style={styles.insightSubtext}>🔒 Held</Text>
              </View>
            )}

            {workspaceStats.escrowMetrics.pendingRelease > 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="time-outline" size={16} color="#34C759" />
                <Text style={styles.insightValue}>
                  {formatCurrency(workspaceStats.escrowMetrics.pendingRelease)}
                </Text>
                <Text style={styles.insightLabel}>Releasing Soon</Text>
                <Text style={styles.insightSubtext}>{"<24h"}</Text>
              </View>
            )}

            {workspaceStats.escrowMetrics.releasedToday > 0 && (
              <View style={styles.insightItem}>
                <Ionicons name="checkmark-circle" size={16} color="#30D158" />
                <Text style={styles.insightValue}>
                  {formatCurrency(workspaceStats.escrowMetrics.releasedToday)}
                </Text>
                <Text style={styles.insightLabel}>Released Today</Text>
                <Text style={styles.insightSubtext}>✓ Paid</Text>
              </View>
            )}
          </View>

          {workspaceStats.escrowMetrics.escrowCount > 0 && (
            <View style={styles.escrowFooter}>
              <Text style={styles.escrowFooterText}>
                {workspaceStats.escrowMetrics.escrowCount} active escrow{workspaceStats.escrowMetrics.escrowCount > 1 ? 's' : ''} • Auto-release in 24hrs after delivery
              </Text>
            </View>
          )}
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

      {/* PIN Verification Modal */}
      <PINInputModal
        visible={pinModalVisible}
        title={pinModalConfig?.title || ''}
        description={pinModalConfig?.description || ''}
        onSubmit={handlePINSubmit}
        onCancel={() => {
          setPinModalVisible(false);
          setPinModalConfig(null);
        }}
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
  statsLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  statsLoadingText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 8,
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
  insightSubtext: {
    fontSize: 9,
    color: '#888',
    marginTop: 2,
  },
  infoIcon: {
    marginLeft: 'auto',
    padding: 4,
  },
  fadedText: {
    opacity: 0.6,
  },
  escrowInsights: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  escrowFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(243, 156, 18, 0.2)',
  },
  escrowFooterText: {
    fontSize: 11,
    color: '#F39C12',
    textAlign: 'center',
    fontWeight: '500',
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
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 8,
    flexShrink: 1,
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
    flexShrink: 0,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'white',
    marginLeft: 3,
    maxWidth: 60,
  },
  orderTime: {
    fontSize: 12,
    color: '#666',
    flexShrink: 0,
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
    flex: 1,
    flexShrink: 1,
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
  pendingActionsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    flex: 1,
  },
  acceptButton: {
    backgroundColor: '#007AFF',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
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