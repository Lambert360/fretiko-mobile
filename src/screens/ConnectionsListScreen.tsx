import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/userAPI';
import { useFocusEffect } from '@react-navigation/native';

interface ConnectionsListScreenProps {
  navigation: any;
  route: {
    params: {
      type: 'plugs' | 'clients';
      userId: string;
      title: string;
    };
  };
}

interface ConnectionUser {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  isSeller?: boolean;
  isRider?: boolean;
}

interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'accepted';
  createdAt: string;
  requester?: ConnectionUser;
  addressee?: ConnectionUser;
}

interface ClientRelationship {
  id: string;
  providerId: string;
  clientId: string;
  relationshipType: string;
  totalOrders: number;
  totalSpent: number;
  provider?: ConnectionUser;
  client?: ConnectionUser;
}

interface ConnectionSection {
  title: string;
  data: (Connection | ClientRelationship)[];
  collapsed: boolean;
}

export const ConnectionsListScreen: React.FC<ConnectionsListScreenProps> = ({
  navigation,
  route,
}) => {
  const { type, userId, title } = route.params;
  const [sections, setSections] = useState<ConnectionSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadConnections();
  }, [type, userId]);

  // Load pending count when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadPendingCount();
    }, [])
  );

  const loadPendingCount = async () => {
    try {
      const stats = await userAPI.getStats();
      setPendingCount(stats.connectionRequestsCount || 0);
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  const loadConnections = async () => {
    try {
      // Use the new categorized endpoint
      const data = await userAPI.getCategorizedConnections(type);

      if (type === 'plugs') {
        // Plugs tab: Following + Patronage (I bought from)
        setSections([
          {
            title: 'Following',
            data: data.following || [],
            collapsed: false,
          },
          {
            title: 'Patronage',
            data: data.patronage || [],
            collapsed: false,
          },
        ]);
      } else {
        // Clients tab: Followers + Patronage (they bought from me)
        setSections([
          {
            title: 'Followers',
            data: data.followers || [],
            collapsed: false,
          },
          {
            title: 'Patronage',
            data: data.patronage || [],
            collapsed: false,
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error loading connections:', error);
      Alert.alert('Error', 'Failed to load connections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConnections();
  };

  const toggleSection = (index: number) => {
    setSections((prevSections) =>
      prevSections.map((section, i) =>
        i === index ? { ...section, collapsed: !section.collapsed } : section
      )
    );
  };

  const getDisplayUser = (item: any, sectionTitle: string): ConnectionUser | null => {
    // The new backend response structure includes a 'user' property for all items
    return item.user || null;
  };

  const isConnected = async (clientId: string): Promise<boolean> => {
    try {
      const connectionStatus = await userAPI.getConnectionStatus(clientId);
      return connectionStatus.status === 'accepted';
    } catch (error) {
      return false;
    }
  };

  const getUserRole = (user: ConnectionUser): string => {
    if (user.isRider && user.isSeller) return 'Vendor & Rider';
    if (user.isRider) return 'Rider';
    if (user.isSeller) return 'Vendor';
    return 'Citizen';
  };

  const getRoleColor = (user: ConnectionUser): string => {
    if (user.isRider && user.isSeller) return '#9B59B6';
    if (user.isRider) return '#3498DB';
    if (user.isSeller) return '#E67E22';
    return '#95A5A6';
  };

  const renderConnectionItem = ({ item, section }: { item: Connection | ClientRelationship; section: ConnectionSection }) => {
    const user = getDisplayUser(item, section.title);

    if (!user) return null;

    const isPatronage = section.title === 'Patronage';

    return (
      <TouchableOpacity
        style={styles.connectionItem}
        onPress={() => navigation.navigate('ConnectionDetails', { userId: user.id, type })}
      >
        <Image
          source={{
            uri: user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'
          }}
          style={styles.avatar}
        />

        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{user.username}</Text>
            {!isPatronage && type === 'clients' && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color="#4CAF50"
                style={styles.connectedIcon}
              />
            )}
          </View>
          {user.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
          )}

          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user) }]}>
            <Text style={styles.roleText}>{getUserRole(user)}</Text>
          </View>
        </View>

        {isPatronage && (
          <View style={styles.clientStats}>
            {item.totalOrders > 0 ? (
              <>
                <Text style={styles.statText}>
                  {item.totalOrders} orders
                </Text>
                <Text style={styles.statText}>
                  ₣{item.totalSpent.toFixed(2)}
                </Text>
              </>
            ) : (
              <Text style={styles.noOrdersText}>No orders yet</Text>
            )}
          </View>
        )}

        <Ionicons name="chevron-forward" size={24} color="#666" />
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section, index }: { section: ConnectionSection; index: number }) => {
    const count = section.data.length;

    return (
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(index)}
      >
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>
        <Ionicons
          name={section.collapsed ? 'chevron-down' : 'chevron-up'}
          size={20}
          color="#B0B0B0"
        />
      </TouchableOpacity>
    );
  };

  const renderEmptySection = () => (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>No connections in this category</Text>
    </View>
  );

  const getTotalConnections = () => {
    return sections.reduce((sum, section) => sum + section.data.length, 0);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading {title.toLowerCase()}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>

        {/* Bell icon with badge for connection requests */}
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => navigation.navigate('ConnectionRequests')}
        >
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {pendingCount > 99 ? '99+' : pendingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {getTotalConnections() === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={type === 'plugs' ? 'people-outline' : 'business-outline'}
            size={64}
            color="#666"
          />
          <Text style={styles.emptyTitle}>
            No {title.toLowerCase()} yet
          </Text>
          <Text style={styles.emptyMessage}>
            {type === 'plugs'
              ? 'Connect with other users to build your network'
              : 'Build relationships with clients through your services'
            }
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections.map((section, index) => ({
            ...section,
            data: section.collapsed ? [] : section.data,
            index,
          }))}
          renderItem={renderConnectionItem}
          renderSectionHeader={({ section }) => renderSectionHeader({ section, index: (section as any).index })}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
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
  listContent: {
    padding: 16,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  connectedIcon: {
    marginLeft: 6,
  },
  bio: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  clientStats: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  statText: {
    fontSize: 12,
    color: '#B0B0B0',
    marginBottom: 2,
  },
  noOrdersText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 24,
  },
  bellButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#121212',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptySection: {
    padding: 24,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});