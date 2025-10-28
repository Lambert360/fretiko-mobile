import React, { useState, useEffect, useCallback } from 'react';
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
import * as Haptics from 'expo-haptics';
import { userAPI, Connection } from '../services/userAPI';
import { useFocusEffect } from '@react-navigation/native';

interface ConnectionRequestsScreenProps {
  navigation: any;
}

export const ConnectionRequestsScreen: React.FC<ConnectionRequestsScreenProps> = ({
  navigation,
}) => {
  const [requests, setRequests] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [acceptingAll, setAcceptingAll] = useState(false);

  // Load requests on screen focus
  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  const loadRequests = async () => {
    try {
      console.log('📥 Loading connection requests...');
      const data = await userAPI.getPendingRequests();
      console.log('✅ Received requests:', data);
      console.log('📊 Number of requests:', data?.length || 0);
      setRequests(data);
    } catch (error: any) {
      console.error('❌ Error loading connection requests:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to load connection requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleAccept = async (connectionId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setProcessingIds(prev => new Set(prev).add(connectionId));

      await userAPI.updateConnection(connectionId, 'accepted');

      // Remove from list
      setRequests(prev => prev.filter(req => req.id !== connectionId));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error('Error accepting connection:', error);
      Alert.alert('Error', 'Failed to accept connection request');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  const handleIgnore = async (connectionId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setProcessingIds(prev => new Set(prev).add(connectionId));

      await userAPI.deleteConnection(connectionId);

      // Remove from list
      setRequests(prev => prev.filter(req => req.id !== connectionId));
    } catch (error: any) {
      console.error('Error ignoring connection:', error);
      Alert.alert('Error', 'Failed to ignore connection request');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionId);
        return newSet;
      });
    }
  };

  const handleBlock = async (connectionId: string, username: string) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${username}? They won't be able to send you connection requests in the future.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setProcessingIds(prev => new Set(prev).add(connectionId));

              await userAPI.updateConnection(connectionId, 'blocked');

              // Remove from list
              setRequests(prev => prev.filter(req => req.id !== connectionId));

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (error: any) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            } finally {
              setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(connectionId);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  const handleAcceptAll = async () => {
    if (requests.length === 0) return;

    Alert.alert(
      'Accept All Requests',
      `Accept all ${requests.length} connection request(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept All',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setAcceptingAll(true);

              const result = await userAPI.acceptAllConnectionRequests();

              setRequests([]);

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              Alert.alert(
                'Success',
                `Accepted ${result.accepted} connection request(s)`,
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              console.error('Error accepting all requests:', error);
              Alert.alert('Error', 'Failed to accept all requests');
              // Reload to get current state
              loadRequests();
            } finally {
              setAcceptingAll(false);
            }
          },
        },
      ]
    );
  };

  const renderRequestItem = ({ item }: { item: Connection }) => {
    const user = item.requester;
    if (!user) return null;

    const isProcessing = processingIds.has(item.id);

    return (
      <View style={styles.requestItem}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('PublicProfile', { userId: user.id })}
          disabled={isProcessing}
        >
          <Image
            source={{ uri: user.avatarUrl || 'https://via.placeholder.com/60' }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>@{user.username}</Text>
              {user.isSeller && (
                <View style={styles.badge}>
                  <Ionicons name="storefront" size={12} color="#F39C12" />
                  <Text style={styles.badgeText}>Seller</Text>
                </View>
              )}
              {user.isRider && (
                <View style={styles.badge}>
                  <Ionicons name="bicycle" size={12} color="#3498DB" />
                  <Text style={styles.badgeText}>Rider</Text>
                </View>
              )}
            </View>
            {user.bio && (
              <Text style={styles.bio} numberOfLines={1}>
                {user.bio}
              </Text>
            )}
            <Text style={styles.timestamp}>
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAccept(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.ignoreButton]}
            onPress={() => handleIgnore(item.id)}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.blockButton]}
            onPress={() => handleBlock(item.id, user.username)}
            disabled={isProcessing}
          >
            <Ionicons name="ban" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={80} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyTitle}>No Pending Requests</Text>
      <Text style={styles.emptySubtitle}>
        When someone wants to plug with you, they'll appear here
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connection Requests</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F39C12" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Connection Requests</Text>
          {requests.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{requests.length}</Text>
            </View>
          )}
        </View>
        {requests.length > 0 && (
          <TouchableOpacity
            style={styles.acceptAllButton}
            onPress={handleAcceptAll}
            disabled={acceptingAll}
          >
            {acceptingAll ? (
              <ActivityIndicator size="small" color="#F39C12" />
            ) : (
              <Text style={styles.acceptAllText}>Accept All</Text>
            )}
          </TouchableOpacity>
        )}
        {requests.length === 0 && <View style={{ width: 44 }} />}
      </View>

      <FlatList
        data={requests}
        renderItem={renderRequestItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F39C12"
            colors={['#F39C12']}
          />
        }
      />
    </SafeAreaView>
  );
};

// Helper function to format time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMs / 3600000);
  const diffInDays = Math.floor(diffInMs / 86400000);

  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: '#F39C12',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  acceptAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    minWidth: 80,
    alignItems: 'center',
  },
  acceptAllText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  requestItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  bio: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  timestamp: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#27AE60',
  },
  ignoreButton: {
    backgroundColor: '#7F8C8D',
  },
  blockButton: {
    backgroundColor: '#E74C3C',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ConnectionRequestsScreen;
