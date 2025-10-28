import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

// Import our new notifications API
import notificationsAPI, {
  Notification,
  NotificationStats,
  NotificationType,
  PaginatedNotifications
} from '../services/notificationsAPI';

const { width: screenWidth } = Dimensions.get('window');

// Map API notification to frontend format
interface FrontendNotification extends Omit<Notification, 'created_at' | 'is_read' | 'has_actions' | 'action_buttons'> {
  timestamp: string;
  isRead: boolean;
  hasActions: boolean;
  actionButtons?: { label: string; type: 'primary' | 'secondary' }[];
  avatar?: string;
}

const NotificationsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { accessToken, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'All' | 'Mentions' | 'Verified'>('All');
  const [notifications, setNotifications] = useState<FrontendNotification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  // Search state
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FrontendNotification[]>([]);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  /**
   * Convert API notification to frontend format
   */
  const convertNotification = useCallback((apiNotification: Notification): FrontendNotification => {
    // Calculate relative timestamp
    const now = new Date();
    const notificationDate = new Date(apiNotification.created_at);
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timestamp: string;
    if (diffMins < 1) {
      timestamp = 'now';
    } else if (diffMins < 60) {
      timestamp = `${diffMins}m`;
    } else if (diffHours < 24) {
      timestamp = `${diffHours}h`;
    } else {
      timestamp = `${diffDays}d`;
    }

    return {
      ...apiNotification,
      timestamp,
      isRead: apiNotification.is_read,
      hasActions: apiNotification.has_actions,
      actionButtons: apiNotification.action_buttons,
      avatar: apiNotification.avatar_url || apiNotification.data?.avatar_url,
    };
  }, []);

  /**
   * Load notifications from API
   */
  const loadNotifications = useCallback(async (refresh = false) => {
    try {
      if (!accessToken || !isAuthenticated) {
        console.log('⚠️ No auth token available, user not authenticated');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (refresh) {
        setRefreshing(true);
        setOffset(0);
      } else if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      console.log(`📲 Loading notifications (tab: ${activeTab}, refresh: ${refresh})`);
      
      let result: PaginatedNotifications;

      // Load notifications based on active tab
      if (activeTab === 'All') {
        result = await notificationsAPI.getNotifications(accessToken, {
          limit: 20,
          offset: refresh ? 0 : offset,
          sort_by: 'created_at',
          sort_order: 'desc'
        });
      } else if (activeTab === 'Mentions') {
        result = await notificationsAPI.getMentions(accessToken);
      } else { // Verified
        result = await notificationsAPI.getVerifiedNotifications(accessToken);
      }

      console.log(`✅ Loaded ${result.notifications.length} notifications`);

      const convertedNotifications = result.notifications.map(convertNotification);

      if (refresh || offset === 0) {
        setNotifications(convertedNotifications);
        setOffset(result.limit);
      } else {
        setNotifications(prev => [...prev, ...convertedNotifications]);
        setOffset(prev => prev + result.limit);
      }

      setHasMore(result.has_more);

      // ✅ Load stats in parallel (non-blocking)
      if (activeTab === 'All') {
        notificationsAPI.getNotificationStats(accessToken)
          .then(statsResult => setStats(statsResult))
          .catch(err => console.error('Stats loading failed (non-critical):', err));
      }

    } catch (error: any) {
      console.error('❌ Error loading notifications:', error);
      console.error('Error details:', error.message, error.response?.data);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab, offset, convertNotification, accessToken, isAuthenticated]);

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback((tab: 'All' | 'Mentions' | 'Verified') => {
    setActiveTab(tab);
    setOffset(0);
    setNotifications([]);
    setHasMore(true);
  }, []);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (id: string) => {
    try {
      if (!accessToken || !isAuthenticated) return;

      // Optimistically update UI
      setNotifications(prev => prev.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ));

      // Update stats
      if (stats) {
        setStats(prev => prev ? { ...prev, unread_count: Math.max(0, prev.unread_count - 1) } : null);
      }

      // Call API
      await notificationsAPI.markAsRead(accessToken, id);

    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update
      loadNotifications();
    }
  }, [stats, loadNotifications, accessToken, isAuthenticated]);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      if (!accessToken || !isAuthenticated) return;

      const result = await notificationsAPI.markAllAsRead(accessToken);
      
      // Update all notifications to read
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      
      // Update stats
      setStats(prev => prev ? { ...prev, unread_count: 0 } : null);
      
      Alert.alert('Success', `Marked ${result.updated_count} notifications as read! ✅`);

    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark all as read. Please try again.');
    }
  }, [accessToken, isAuthenticated]);

  /**
   * Handle notification press - navigate based on notification type
   */
  const handleNotificationPress = useCallback(async (notification: FrontendNotification) => {
    try {
      console.log('Notification pressed:', notification.type, notification.data);

      // Navigate based on notification type
      switch (notification.type) {
        case 'chat':
          // Extract conversation ID and sender info from notification data
          const conversationId = notification.data?.conversation_id;
          const senderUsername = notification.data?.sender_username || 'Unknown User';
          const senderName = notification.data?.sender_name || senderUsername;
          const isGroupChat = notification.data?.is_group || false;

          if (conversationId) {
            console.log('Navigating to chat conversation:', conversationId);
            // Navigate to IndividualChatScreen with the conversation details
            navigation.navigate('IndividualChatScreen', {
              chatId: conversationId,
              chatName: isGroupChat ? notification.data?.conversation_name || 'Group Chat' : senderName,
              chatType: isGroupChat ? 'group' : 'individual',
              isOnline: true // Default to online, will be updated by screen
            });
          } else {
            console.log('No conversation ID found in notification data:', notification.data);
            Alert.alert('Error', 'Unable to open chat conversation - missing conversation ID');
          }
          break;

        case 'order':
          // Navigate to order details
          const orderId = notification.data?.order_id;
          if (orderId) {
            console.log('Navigating to order:', orderId);
            navigation.navigate('Orders', {
              screen: 'OrderDetails',
              params: { orderId }
            } as any);
          } else {
            Alert.alert('Order Notification', notification.message);
          }
          break;

        case 'connection_request':
          // Navigate to connection requests screen
          console.log('Navigating to connection requests');
          navigation.navigate('ConnectionRequests' as never);
          break;

        case 'connection_accepted':
          // Navigate to the user's profile who accepted the connection
          const acceptedBy = notification.metadata?.acceptedBy || notification.data?.acceptedBy;
          if (acceptedBy) {
            console.log('Navigating to profile of user who accepted:', acceptedBy);
            navigation.navigate('PublicProfile' as never, { userId: acceptedBy } as never);
          } else {
            Alert.alert('Connection Accepted!', notification.message);
          }
          break;

        case 'social':
          // Navigate to user profile or post
          const senderId = notification.data?.sender_id;
          const postId = notification.data?.post_id;

          if (postId) {
            // Navigate to specific post
            console.log('Navigating to post:', postId);
            navigation.navigate('Social', {
              screen: 'Post',
              params: { postId }
            } as any);
          } else if (senderId) {
            // Navigate to user profile
            console.log('Navigating to profile:', senderId);
            navigation.navigate('Profile', {
              screen: 'UserProfile',
              params: { userId: senderId }
            } as any);
          } else {
            Alert.alert('Social Notification', notification.message);
          }
          break;

        case 'live':
          // Navigate to live stream
          const streamId = notification.data?.stream_id;
          if (streamId) {
            console.log('Navigating to live stream:', streamId);
            navigation.navigate('Live', {
              screen: 'LiveStream',
              params: { streamId }
            } as any);
          } else {
            Alert.alert('Live Notification', notification.message);
          }
          break;

        case 'delivery':
          // Navigate to order tracking
          const trackingOrderId = notification.data?.order_id;
          if (trackingOrderId) {
            console.log('Navigating to order tracking:', trackingOrderId);
            navigation.navigate('Orders', {
              screen: 'OrderTracking',
              params: { orderId: trackingOrderId }
            } as any);
          } else {
            Alert.alert('Delivery Notification', notification.message);
          }
          break;

        case 'payment':
          // Navigate to wallet or transaction details
          const transactionId = notification.data?.transaction_id;
          if (transactionId) {
            console.log('Navigating to transaction:', transactionId);
            navigation.navigate('Wallet', {
              screen: 'TransactionDetails',
              params: { transactionId }
            } as any);
          } else {
            navigation.navigate('Wallet' as any);
          }
          break;

        case 'promotion':
          // Navigate to promotions or specific offer
          const promotionId = notification.data?.promotion_id;
          const productId = notification.data?.product_id;

          if (productId) {
            console.log('Navigating to promoted product:', productId);
            navigation.navigate('Products', {
              screen: 'ProductDetails',
              params: { productId }
            } as any);
          } else if (promotionId) {
            console.log('Navigating to promotion:', promotionId);
            navigation.navigate('Promotions', {
              screen: 'PromotionDetails',
              params: { promotionId }
            } as any);
          } else {
            Alert.alert('Promotion', notification.message);
          }
          break;

        case 'system':
          // System notifications - show full message or navigate to settings
          if (notification.data?.navigate_to === 'settings') {
            navigation.navigate('Settings' as any);
          } else {
            Alert.alert('System Notification', `${notification.title}\n\n${notification.message}`);
          }
          break;

        default:
          // Generic notification handling - show full message
          console.log('Unknown notification type:', notification.type);
          Alert.alert(notification.title, notification.message);
          break;
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
      Alert.alert('Error', 'Unable to open notification. Please try again.');
    }
  }, [navigation]);

  /**
   * Handle notification action buttons
   */
  const handleAction = useCallback(async (notifId: string, action: string) => {
    try {
      console.log(`Action "${action}" pressed for notification ${notifId}`);

      // Mark notification as read when action is taken
      await markAsRead(notifId);

      // Handle specific actions
      switch (action.toLowerCase()) {
        case 'view':
        case 'open':
        case 'see details':
          // Find the notification and trigger its main navigation
          const notification = notifications.find(n => n.id === notifId);
          if (notification) {
            await handleNotificationPress(notification);
          }
          break;

        case 'view profile':
          // Navigate to the profile of the user in the notification
          const profileNotification = notifications.find(n => n.id === notifId);
          if (profileNotification) {
            const userId = profileNotification.data?.requester_id ||
                          profileNotification.data?.connected_user_id ||
                          profileNotification.data?.acceptedBy ||
                          profileNotification.data?.sender_id;
            if (userId) {
              console.log('Navigating to profile:', userId);
              navigation.navigate('PublicProfile' as never, { userId } as never);
            } else {
              Alert.alert('Error', 'Unable to find user profile');
            }
          }
          break;

        case 'accept':
        case 'confirm':
        case 'accept request':
          // For connection requests, navigate to connection requests screen
          const acceptNotification = notifications.find(n => n.id === notifId);
          if (acceptNotification?.type === 'connection_request') {
            navigation.navigate('ConnectionRequests' as never);
          } else {
            Alert.alert('Action Confirmed', `${action} completed successfully`);
          }
          break;

        case 'decline':
        case 'reject':
        case 'dismiss':
          Alert.alert('Action Completed', `${action} completed`);
          // TODO: Add specific decline/reject logic
          break;

        case 'reply':
          // For chat notifications, open the conversation
          const chatNotification = notifications.find(n => n.id === notifId);
          if (chatNotification?.type === 'chat') {
            await handleNotificationPress(chatNotification);
          } else {
            Alert.alert('Reply', 'Opening reply interface...');
          }
          break;

        case 'view chat':
          // For chat notifications, open the conversation
          const viewChatNotification = notifications.find(n => n.id === notifId);
          if (viewChatNotification?.type === 'chat') {
            await handleNotificationPress(viewChatNotification);
          } else {
            Alert.alert('Chat', 'Unable to open chat conversation');
          }
          break;

        case 'track order':
        case 'track':
          const orderNotification = notifications.find(n => n.id === notifId);
          if (orderNotification?.data?.order_id) {
            navigation.navigate('Orders', {
              screen: 'OrderTracking',
              params: { orderId: orderNotification.data.order_id }
            } as any);
          }
          break;

        default:
          Alert.alert('Action', `${action} completed`);
          break;
      }
    } catch (error) {
      console.error('Error handling notification action:', error);
      Alert.alert('Error', 'Unable to complete action. Please try again.');
    }
  }, [markAsRead, notifications, handleNotificationPress, navigation]);

  /**
   * Handle search
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    
    // Filter notifications based on search query
    const lowerQuery = query.toLowerCase();
    const filtered = notifications.filter(notif => 
      notif.title.toLowerCase().includes(lowerQuery) ||
      notif.message.toLowerCase().includes(lowerQuery) ||
      notif.type.toLowerCase().includes(lowerQuery)
    );
    
    setSearchResults(filtered);
  }, [notifications]);

  /**
   * Clear search
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = useCallback(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  /**
   * Load more notifications
   */
  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      loadNotifications();
    }
  }, [hasMore, loadingMore, loading, loadNotifications]);

  // Initial load and animations
  useEffect(() => {
    // Only load notifications if user is authenticated
    if (isAuthenticated && accessToken) {
      loadNotifications(true);
    }

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for unread notifications
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation for live notifications
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [isAuthenticated, accessToken]);

  // Reload when tab changes
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadNotifications(true);
    }
  }, [activeTab, isAuthenticated, accessToken]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order': return 'bag';
      case 'social': return 'heart';
      case 'promotion': return 'pricetag';
      case 'system': return 'settings';
      case 'delivery': return 'bicycle';
      case 'live': return 'radio';
      case 'payment': return 'card';
      case 'chat': return 'chatbubble';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order': return '#27AE60';
      case 'social': return '#E91E63';
      case 'promotion': return '#FF9800';
      case 'system': return '#3498DB';
      case 'delivery': return '#9C27B0';
      case 'live': return '#FF4757';
      case 'payment': return '#2ECC71';
      case 'chat': return '#17A2B8';
      default: return '#95A5A6';
    }
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'LIVE': return '#FF4757';
      case 'SHIPPED': return '#27AE60';
      case 'ARRIVING': return '#9C27B0';
      case 'AI DEALS': return '#E91E63';
      case 'PAID': return '#2ECC71';
      case 'RECAP': return '#3498DB';
      default: return '#95A5A6';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Mentions') return ['social', 'chat'].includes(notif.type);
    if (activeTab === 'Verified') return ['order', 'payment', 'system'].includes(notif.type);
    return true;
  });

  const unreadCount = stats?.unread_count || 0;

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Notifications</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerAction}
            onPress={() => Alert.alert('Coming Soon', 'Notification settings will be available in the next update! 🔔', [{ text: 'OK' }])}
          >
            <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerAction}
            onPress={() => setIsSearchModalVisible(true)}
          >
            <Ionicons name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs - Twitter style */}
      <View style={styles.tabsContainer}>
        {['All', 'Mentions', 'Verified'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => handleTabChange(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
            {tab === 'All' && unreadCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount}</Text>
              </View>
            )}
            {activeTab === tab && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      {unreadCount > 0 && activeTab === 'All' && (
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.markAllButton}
            onPress={markAllAsRead}
          >
            <Ionicons name="checkmark-done" size={16} color="#3498DB" />
            <Text style={styles.markAllText}>Mark all as read ({unreadCount})</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderNotification = ({ item, index }: { item: FrontendNotification; index: number }) => {
    const isLive = item.type === 'live';
    const isHighPriority = item.priority === 'high' && !item.isRead;

    return (
      <Animated.View
        style={[
          styles.notificationContainer,
          !item.isRead && styles.unreadNotification,
          isLive && styles.liveNotification,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30],
                }),
              },
              isHighPriority ? { scale: pulseAnim } : { scale: 1 },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.notification}
          onPress={() => {
            markAsRead(item.id);
            handleNotificationPress(item);
          }}
        >
          <View style={styles.notificationLeft}>
            {/* Avatar with type indicator */}
            <View style={styles.avatarContainer}>
              {item.avatar ? (
                <Image
                  source={typeof item.avatar === 'string' ? { uri: item.avatar } : item.avatar}
                  style={styles.notificationAvatar}
                />
              ) : (
                <View style={[styles.notificationAvatar, styles.defaultAvatar]}>
                  <Ionicons name="person-outline" size={24} color="#666" />
                </View>
              )}
              <View style={[styles.typeIndicator, { backgroundColor: getNotificationColor(item.type) }]}>
                <Ionicons name={getNotificationIcon(item.type) as any} size={12} color="white" />
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
          </View>

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.headerRight}>
                {item.badge && (
                  <Animated.View 
                    style={[
                      styles.badge, 
                      { backgroundColor: getBadgeColor(item.badge) },
                      isLive && {
                        shadowColor: getBadgeColor(item.badge),
                        shadowOpacity: glowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 0.8],
                        }),
                        shadowRadius: 8,
                        elevation: 8,
                      }
                    ]}
                  >
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </Animated.View>
                )}
                <Text style={styles.timestamp}>{item.timestamp}</Text>
                <TouchableOpacity 
                  style={styles.moreButton}
                  onPress={() => Alert.alert('Options', 'Notification options menu')}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
            </View>
            
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {item.message}
            </Text>

            {/* Action buttons */}
            {item.hasActions && item.actionButtons && (
              <View style={styles.actionButtons}>
                {item.actionButtons.map((action, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.actionButton,
                      action.type === 'primary' ? styles.primaryAction : styles.secondaryAction
                    ]}
                    onPress={() => handleAction(item.id, action.label)}
                  >
                    <Text style={[
                      styles.actionText,
                      action.type === 'primary' ? styles.primaryActionText : styles.secondaryActionText
                    ]}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyStateTitle}>All caught up! ✨</Text>
      <Text style={styles.emptyStateSubtitle}>
        No new notifications in {activeTab.toLowerCase()}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#3498DB" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  // Show loading state
  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        {renderHeader()}
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  // Show authentication required message
  if (!isAuthenticated || !accessToken) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.centerLoading}>
          <Ionicons name="lock-closed-outline" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyStateTitle}>Authentication Required</Text>
          <Text style={styles.emptyStateSubtitle}>
            Please log in to view your notifications
          </Text>
        </View>
      </View>
    );
  }

  const renderSearchModal = () => (
    <Modal
      visible={isSearchModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        setIsSearchModalVisible(false);
        clearSearch();
      }}
    >
      <KeyboardAvoidingView 
        style={styles.searchModalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.searchModalHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            onPress={() => {
              setIsSearchModalVisible(false);
              clearSearch();
            }}
            style={styles.searchModalBackButton}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.searchModalInputContainer}>
            <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.searchModalIcon} />
            <TextInput
              style={styles.searchModalInput}
              placeholder="Search notifications..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.searchModalClearButton}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.searchModalContent}>
          {searchQuery.length === 0 ? (
            <View style={styles.searchModalEmpty}>
              <Ionicons name="search-outline" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.searchModalEmptyTitle}>Search Notifications</Text>
              <Text style={styles.searchModalEmptySubtitle}>
                Search by title, message, or type
              </Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderNotification}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          ) : (
            <View style={styles.searchModalEmpty}>
              <Ionicons name="search-outline" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.searchModalEmptyTitle}>No Results</Text>
              <Text style={styles.searchModalEmptySubtitle}>
                No notifications found for "{searchQuery}"
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <View style={styles.notificationsList}>
        {filteredNotifications.length > 0 ? (
          <FlatList
            data={filteredNotifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.notificationsContent, { paddingBottom: insets.bottom + 20 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#3498DB"
                colors={['#3498DB']}
              />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.1}
            ListFooterComponent={renderFooter}
          />
        ) : (
          renderEmptyState()
        )}
      </View>
      
      {renderSearchModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    justifyContent: 'center',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginLeft: 8,
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 8,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498DB',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: '#E91E63',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#3498DB',
    borderRadius: 1,
  },
  quickActions: {
    marginBottom: 8,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  markAllText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  notificationsList: {
    flex: 1,
  },
  notificationsContent: {
    paddingTop: 8,
  },
  notificationContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  unreadNotification: {
    backgroundColor: 'rgba(52, 152, 219, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB',
  },
  liveNotification: {
    backgroundColor: 'rgba(255, 71, 87, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#FF4757',
  },
  notification: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notificationLeft: {
    marginRight: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  notificationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  defaultAvatar: {
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E91E63',
    borderWidth: 2,
    borderColor: '#000000',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  moreButton: {
    padding: 4,
  },
  notificationMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  primaryAction: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  secondaryAction: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryActionText: {
    color: '#FFFFFF',
  },
  secondaryActionText: {
    color: 'rgba(255,255,255,0.8)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
  },
  
  // Search Modal Styles
  searchModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  searchModalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchModalIcon: {
    marginRight: 8,
  },
  searchModalInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  searchModalClearButton: {
    marginLeft: 8,
  },
  searchModalContent: {
    flex: 1,
  },
  searchModalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  searchModalEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  searchModalEmptySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default NotificationsScreen;