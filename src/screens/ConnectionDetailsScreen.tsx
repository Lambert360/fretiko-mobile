import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/userAPI';
import { chatAPI } from '../services/chatAPI';
import { useAuth } from '../contexts/AuthContext';

interface ConnectionDetailsScreenProps {
  navigation: any;
  route: {
    params: {
      userId: string;
      type: 'plugs' | 'clients';
    };
  };
}

interface OrderItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  date: string;
  items: OrderItem[];
}

interface RelationshipDetails {
  targetUser: {
    id: string;
    username: string;
    bio?: string;
    avatarUrl?: string;
    isSeller: boolean;
    isRider: boolean;
  };
  connectionInfo: {
    status: string;
    connectionId?: string;
    connectedSince?: string;
  };
  relationshipType: 'plug' | 'client' | 'none';
  businessMetrics: {
    totalOrders: number;
    totalSpent: number;
    relationshipStatus: string;
    lastOrderDate: string;
  } | null;
  recentOrders: Order[];
}

export const ConnectionDetailsScreen: React.FC<ConnectionDetailsScreenProps> = ({
  navigation,
  route,
}) => {
  const { userId, type } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [relationshipData, setRelationshipData] = useState<RelationshipDetails | null>(null);

  useEffect(() => {
    loadRelationshipDetails();
  }, [userId]);

  const loadRelationshipDetails = async () => {
    try {
      const data = await userAPI.getRelationshipDetails(userId);
      setRelationshipData(data);
    } catch (error: any) {
      console.error('Error loading relationship details:', error);
      Alert.alert('Error', 'Failed to load relationship details');
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async () => {
    console.log('🔵 Message button pressed');
    console.log('🔵 relationshipData:', relationshipData);
    console.log('🔵 user:', user);

    if (!relationshipData?.targetUser) {
      console.log('❌ No target user');
      Alert.alert('Error', 'User information not available');
      return;
    }

    if (!user) {
      console.log('❌ No user');
      Alert.alert('Error', 'Please log in to send messages');
      return;
    }

    try {
      console.log('🔵 Starting chat creation...');

      // Determine chat type based on BOTH users' roles
      // Priority: rider > vendor > friend
      // Check if either the current user OR target user is a rider/vendor
      let chatType: 'friend' | 'vendor' | 'rider' = 'friend';

      // Check if either user is a rider (highest priority)
      if (user.is_rider || relationshipData.targetUser.isRider) {
        chatType = 'rider';
      }
      // Check if either user is a seller/vendor
      else if (user.is_seller || relationshipData.targetUser.isSeller) {
        chatType = 'vendor';
      }
      // Otherwise, both are regular users (citizens)
      else {
        chatType = 'friend';
      }

      console.log('🔵 Chat type determined:', chatType);
      console.log('🔵 Current user is_seller:', user.is_seller, 'is_rider:', user.is_rider);
      console.log('🔵 Target user isSeller:', relationshipData.targetUser.isSeller, 'isRider:', relationshipData.targetUser.isRider);
      console.log('🔵 Target user ID:', relationshipData.targetUser.id);

      // Find existing conversation or create a new one with the target user
      const conversation = await chatAPI.findOrCreateConversation(
        [relationshipData.targetUser.id], // The target user
        chatType
      );

      console.log('✅ Conversation found/created:', conversation.id);

      // Navigate to IndividualChatScreen with the conversation ID
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: relationshipData.targetUser.username,
        chatAvatar: relationshipData.targetUser.avatarUrl || 'https://via.placeholder.com/50',
        chatType: chatType as const,
        isOnline: true, // Assume online for now
        verified: false,
        isAI: false,
      });

      console.log('✅ Navigated to chat');
    } catch (error: any) {
      console.error('❌ Error creating conversation:', error);
      console.error('❌ Error details:', error.message, error.response?.data);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number): string => {
    return `₣${amount.toFixed(2)}`;
  };

  const getUserRole = (): string => {
    if (!relationshipData?.targetUser) return 'User';
    const { isSeller, isRider } = relationshipData.targetUser;
    if (isSeller && isRider) return 'Vendor & Rider';
    if (isRider) return 'Rider';
    if (isSeller) return 'Vendor';
    return 'Citizen';
  };

  const getRelationshipTypeLabel = (): string => {
    if (type === 'clients') return 'Your Client';
    if (type === 'plugs') return 'Your Plug';
    return 'Connection';
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return '#4CAF50';
      case 'pending':
      case 'processing':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connection Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!relationshipData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connection Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>Failed to load details</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { targetUser, connectionInfo, businessMetrics, recentOrders } = relationshipData;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connection Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={{
              uri: targetUser.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
            }}
            style={styles.avatar}
          />
          <Text style={styles.username}>@{targetUser.username}</Text>
          <Text style={styles.roleLabel}>{getUserRole()} • {getRelationshipTypeLabel()}</Text>
          {connectionInfo.status === 'accepted' && (
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}
        </View>

        {/* Business Metrics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relationship Summary</Text>

          {businessMetrics && businessMetrics.totalOrders > 0 ? (
            <>
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Ionicons name="cash-outline" size={32} color="#4CAF50" />
                  <Text style={styles.metricValue}>{formatCurrency(businessMetrics.totalSpent)}</Text>
                  <Text style={styles.metricLabel}>Total Spent</Text>
                </View>

                <View style={styles.metricCard}>
                  <Ionicons name="cart-outline" size={32} color="#2196F3" />
                  <Text style={styles.metricValue}>{businessMetrics.totalOrders}</Text>
                  <Text style={styles.metricLabel}>Orders</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color="#B0B0B0" />
                <Text style={styles.infoLabel}>Customer Since</Text>
                <Text style={styles.infoValue}>
                  {connectionInfo.connectedSince ? formatDate(connectionInfo.connectedSince) : 'N/A'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color="#B0B0B0" />
                <Text style={styles.infoLabel}>Last Order</Text>
                <Text style={styles.infoValue}>
                  {businessMetrics.lastOrderDate ? formatDate(businessMetrics.lastOrderDate) : 'N/A'}
                </Text>
              </View>

              <View style={styles.statusBadge}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.statusText}>
                  {businessMetrics.relationshipStatus === 'regular_client' ? 'Regular Client' : 'Customer'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noMetricsContainer}>
              <Ionicons name="cart-outline" size={48} color="#666" />
              <Text style={styles.noMetricsTitle}>No Purchase History</Text>
              <Text style={styles.noMetricsText}>
                {targetUser.username} is following you but hasn't made any purchases yet.
              </Text>
              {connectionInfo.connectedSince && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color="#B0B0B0" />
                  <Text style={styles.infoLabel}>Following Since</Text>
                  <Text style={styles.infoValue}>{formatDate(connectionInfo.connectedSince)}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
            <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* Order History Section */}
        {recentOrders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Order History ({recentOrders.length} orders)</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ordersContainer}
            >
              {recentOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}
                >
                  {order.items.length > 0 && order.items[0].image ? (
                    <Image
                      source={{ uri: order.items[0].image }}
                      style={styles.orderImage}
                    />
                  ) : (
                    <View style={[styles.orderImage, styles.placeholderImage]}>
                      <Ionicons name="cube-outline" size={32} color="#666" />
                    </View>
                  )}
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.date)}</Text>
                    <View style={[styles.orderStatus, { backgroundColor: getStatusColor(order.status) }]}>
                      <Text style={styles.orderStatusText}>{order.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {recentOrders.length >= 10 && (
              <TouchableOpacity style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All Orders</Text>
                <Ionicons name="arrow-forward" size={16} color="#2196F3" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  roleLabel: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 12,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A1E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connectedText: {
    color: '#4CAF50',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#B0B0B0',
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#2A2A1E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
  },
  statusText: {
    color: '#FFD700',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  noMetricsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noMetricsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  noMetricsText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  ordersContainer: {
    paddingRight: 20,
  },
  orderCard: {
    width: 140,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  orderImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#2A2A2A',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderInfo: {
    padding: 12,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#B0B0B0',
    marginBottom: 8,
  },
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  seeAllText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
});
