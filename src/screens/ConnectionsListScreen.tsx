import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/userAPI';

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

export const ConnectionsListScreen: React.FC<ConnectionsListScreenProps> = ({
  navigation,
  route,
}) => {
  const { type, userId, title } = route.params;
  const [connections, setConnections] = useState<(Connection | ClientRelationship)[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConnections();
  }, [type, userId]);

  const loadConnections = async () => {
    try {
      if (type === 'plugs') {
        // Load user connections (plugs)
        const data = await userAPI.getConnections();
        setConnections(data);
      } else {
        // Load client relationships
        const data = await userAPI.getClientRelationships();
        setConnections(data);
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

  const getDisplayUser = (item: Connection | ClientRelationship): ConnectionUser | null => {
    if (type === 'plugs') {
      const connection = item as Connection;
      // Show the other person in the connection
      if (connection.requesterId === userId) {
        return connection.addressee || null;
      } else {
        return connection.requester || null;
      }
    } else {
      const relationship = item as ClientRelationship;
      // Show clients if user is provider, show providers if user is client
      if (relationship.providerId === userId) {
        return relationship.client || null;
      } else {
        return relationship.provider || null;
      }
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

  const renderConnectionItem = ({ item }: { item: Connection | ClientRelationship }) => {
    const user = getDisplayUser(item);
    
    if (!user) return null;

    return (
      <TouchableOpacity
        style={styles.connectionItem}
        onPress={() => navigation.navigate('PublicProfile', { userId: user.id })}
      >
        <Image
          source={{
            uri: user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'
          }}
          style={styles.avatar}
        />
        
        <View style={styles.userInfo}>
          <Text style={styles.username}>{user.username}</Text>
          {user.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
          )}
          
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user) }]}>
            <Text style={styles.roleText}>{getUserRole(user)}</Text>
          </View>
        </View>

        {type === 'clients' && (
          <View style={styles.clientStats}>
            <Text style={styles.statText}>
              {(item as ClientRelationship).totalOrders} orders
            </Text>
            <Text style={styles.statText}>
              ${(item as ClientRelationship).totalSpent}
            </Text>
          </View>
        )}
        
        <Ionicons name="chevron-forward" size={24} color="#666" />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
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
  );

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
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={connections}
        renderItem={renderConnectionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
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
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
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
});