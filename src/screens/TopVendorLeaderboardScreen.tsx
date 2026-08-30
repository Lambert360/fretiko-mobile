import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { liveSalesAPI, LeaderboardEntry, GamificationConfig } from '../services/liveSalesAPI';
import { userAPI } from '../services/userAPI';

const PERIODS: Array<{ key: 'daily' | 'weekly' | 'monthly' | 'event'; label: string }> = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'event', label: 'Event' },
];

const RANK_BADGE_GRADIENTS: Record<number, readonly [string, string, ...string[]]> = {
  1: ['#FFD700', '#F5B041'],
  2: ['#E0E0E0', '#9E9E9E'],
  3: ['#CD7F32', '#A0522D'],
};

const TopVendorLeaderboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'event'>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [eventName, setEventName] = useState<string | undefined>();
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'none' | 'pending' | 'accepted' | 'blocked'>>({});
  const [connectionIds, setConnectionIds] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    (async () => {
      try {
        const cfg = await liveSalesAPI.getGamificationConfig();
        setConfig(cfg);
      } catch (error) {
        console.error('Error loading gamification config:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (period === 'event' && config?.special_event_enabled && config.special_event_name) {
      setEventName(config.special_event_name);
    } else if (period === 'event') {
      setEventName(undefined);
    }
  }, [period, config]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await liveSalesAPI.getVendorLeaderboard(period, eventName, 50);
      setEntries(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [period, eventName]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleExpand = (vendorId: string) => {
    setExpandedVendorId(prev => (prev === vendorId ? null : vendorId));
  };

  const handleWatchLive = (streamId?: string) => {
    if (!streamId) return;
    navigation.navigate('LiveStreamViewer', { streamId });
  };

  const loadConnectionStatus = useCallback(async (vendorId: string) => {
    try {
      const { status, connectionId } = await userAPI.getConnectionStatus(vendorId);
      setConnectionStatuses(prev => ({ ...prev, [vendorId]: status as 'none' | 'pending' | 'accepted' | 'blocked' }));
      setConnectionIds(prev => ({ ...prev, [vendorId]: connectionId }));
    } catch (error) {
      console.error('Error loading connection status:', error);
    }
  }, []);

  useEffect(() => {
    if (expandedVendorId && !connectionStatuses[expandedVendorId]) {
      loadConnectionStatus(expandedVendorId);
    }
  }, [expandedVendorId, connectionStatuses, loadConnectionStatus]);

  const handlePlug = async (vendorId: string) => {
    const status = connectionStatuses[vendorId];

    if (status === 'accepted') {
      Alert.alert('Already plugged', 'You are already connected to this vendor.');
      return;
    }

    if (status === 'pending') {
      Alert.alert('Pending', 'Connection request already sent to this vendor.');
      return;
    }

    try {
      const connection = await userAPI.sendConnectionRequest(vendorId);
      setConnectionStatuses(prev => ({ ...prev, [vendorId]: 'pending' }));
      setConnectionIds(prev => ({ ...prev, [vendorId]: connection.id }));
      Alert.alert('Plug sent', 'Connection request sent to this vendor.');
    } catch (error: any) {
      Alert.alert('Could not plug', error?.message || 'Something went wrong');
    }
  };

  const handleMessage = (vendorId: string) => {
    navigation.navigate('IndividualChatScreen', { userId: vendorId });
  };

  const handleViewProfile = (vendorId: string) => {
    navigation.navigate('PublicProfile', { userId: vendorId });
  };

  const RankBadge = ({ rank }: { rank: number }) => {
    if (rank <= 3) {
      return (
        <LinearGradient
          colors={RANK_BADGE_GRADIENTS[rank]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.rankBadge}
        >
          <Text style={styles.rankBadgeTextTop}>{rank}</Text>
        </LinearGradient>
      );
    }
    return (
      <View style={styles.rankBadgeOther}>
        <Text style={styles.rankBadgeTextOther}>{rank}</Text>
      </View>
    );
  };

  const getPlugButtonStyle = (status: string) => {
    if (status === 'accepted') return [styles.actionButton, styles.actionButtonPlugged];
    if (status === 'pending') return [styles.actionButton, styles.actionButtonPending];
    return [styles.actionButton];
  };

  const getPlugTextStyle = (status: string) => {
    if (status === 'accepted') return [styles.actionButtonText, styles.actionButtonTextPlugged];
    if (status === 'pending') return [styles.actionButtonText, styles.actionButtonTextPending];
    return [styles.actionButtonText];
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isExpanded = expandedVendorId === item.vendor_id;
    const connectionStatus = connectionStatuses[item.vendor_id] || 'none';
    const isPlugged = connectionStatus === 'accepted';
    const isPending = connectionStatus === 'pending';
    const plugLabel = isPlugged ? 'Plugged' : isPending ? 'Pending' : 'Plug';
    const plugIcon = isPlugged ? 'checkmark-circle' : 'person-add';
    const plugColor = isPlugged ? '#4CAF50' : isPending ? '#888888' : '#3498DB';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => toggleExpand(item.vendor_id)}
        style={[styles.card, isExpanded && styles.cardExpanded]}
      >
        <View style={styles.cardRow}>
          <RankBadge rank={item.rank} />

          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.cardAvatar} />
          ) : (
            <View style={styles.cardAvatarPlaceholder}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
          )}

          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item.vendor_name}</Text>
            <Text style={styles.cardMeta}>
              {item.total_streams} streams · {item.total_orders} orders · {item.total_viewers} viewers
            </Text>
          </View>

          <View style={styles.scorePill}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.scoreText}>{Math.round(item.score)}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedPanel}>
            <View style={styles.actionGrid}>
              {item.is_live && item.stream_id && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={(e) => { e.stopPropagation(); handleWatchLive(item.stream_id); }}
                  style={styles.actionButtonPrimary}
                >
                  <Ionicons name="videocam" size={18} color="#000" />
                  <Text style={styles.actionButtonPrimaryText}>Watch Live</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); handlePlug(item.vendor_id); }}
                style={getPlugButtonStyle(connectionStatus)}
              >
                <Ionicons name={plugIcon as any} size={18} color={plugColor} />
                <Text style={getPlugTextStyle(connectionStatus)}>{plugLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); handleMessage(item.vendor_id); }}
                style={styles.actionButton}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#3498DB" />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => { e.stopPropagation(); handleViewProfile(item.vendor_id); }}
                style={styles.actionButton}
              >
                <Ionicons name="person-circle" size={18} color="#3498DB" />
                <Text style={styles.actionButtonText}>Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Vendors</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.85}
            style={styles.periodButtonWrapper}
          >
            {period === p.key ? (
              <LinearGradient
                colors={['#3498DB', '#2C7DB0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.periodButton}
              >
                <Text style={styles.periodTextActive}>{p.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.periodButton}>
                <Text style={styles.periodText}>{p.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {period === 'event' && (
        <View style={styles.eventBanner}>
          <Ionicons name="sparkles" size={14} color="#FFD700" />
          <Text style={styles.eventBannerText}>
            {config?.special_event_enabled && config.special_event_name
              ? config.special_event_name
              : 'No active special event'}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={styles.loader} />
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="trophy-outline" size={40} color="#3498DB" />
          </View>
          <Text style={styles.emptyText}>No vendors ranked yet</Text>
          <Text style={styles.emptySubtext}>
            Come back soon to see who's leading the live sales leaderboard.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={(item) => item.vendor_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3498DB" />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingTop: 8 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  periodButtonWrapper: {
    flex: 1,
  },
  periodButton: {
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
  },
  periodText: {
    color: '#999999',
    fontWeight: '600',
    fontSize: 12,
  },
  periodTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  eventBannerText: {
    color: '#FFD700',
    fontWeight: '600',
    fontSize: 13,
  },
  loader: {
    marginTop: 60,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  cardExpanded: {
    borderColor: 'rgba(52, 152, 219, 0.35)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeOther: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#2A2A2A',
  },
  rankBadgeTextTop: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  rankBadgeTextOther: {
    color: '#999',
    fontSize: 13,
    fontWeight: '700',
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  cardAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  cardMeta: {
    fontSize: 12,
    color: '#888888',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD700',
  },
  expandedPanel: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButtonPrimaryText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonPlugged: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
  },
  actionButtonPending: {
    borderColor: '#888888',
    backgroundColor: '#2A2A2A',
  },
  actionButtonTextPlugged: {
    color: '#4CAF50',
  },
  actionButtonTextPending: {
    color: '#888888',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(52, 152, 219, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(52, 152, 219, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TopVendorLeaderboardScreen;
