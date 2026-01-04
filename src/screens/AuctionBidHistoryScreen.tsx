import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auctionsAPI, PublicBidHistoryItem } from '../services/auctionsAPI';

/**
 * Format date as relative time (e.g., "2 minutes ago", "3 hours ago")
 */
const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  return `${years} year${years !== 1 ? 's' : ''} ago`;
};

/**
 * Auction Bid History Screen
 * 
 * Allows vendors to view full bid history for their auctions
 * Shows anonymous bid history (no real user identities)
 */
const AuctionBidHistoryScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { auctionId, auctionTitle } = route.params;

  // State
  const [bidHistory, setBidHistory] = useState<PublicBidHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load bid history
  const loadBidHistory = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch all bids (no limit for vendor view)
      const history = await auctionsAPI.getBidHistory(auctionId, 1000);
      setBidHistory(history);
    } catch (error) {
      console.error('Error loading bid history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBidHistory();
  }, [auctionId]);

  const renderBidHistoryItem = ({ item, index }: { item: PublicBidHistoryItem; index: number }) => {
    const isWinning = index === 0; // First item is current winning bid
    const isProxyBid = item.is_proxy_bid;

    return (
      <View
        style={[
          styles.bidHistoryItem,
          isWinning && styles.winningBidItem,
        ]}
      >
        <View style={styles.bidHistoryLeft}>
          <View style={styles.bidderRow}>
            <Text style={styles.bidderName}>{item.bidder_display_id}</Text>
            {isWinning && (
              <View style={styles.winningBadge}>
                <Ionicons name="trophy" size={12} color="#F39C12" />
                <Text style={styles.winningBadgeText}>Winning</Text>
              </View>
            )}
            {isProxyBid && (
              <View style={styles.proxyBadge}>
                <Text style={styles.proxyBadgeText}>Proxy</Text>
              </View>
            )}
          </View>
          <Text style={styles.bidTime}>
            {formatDistanceToNow(new Date(item.created_at))}
          </Text>
        </View>
        <View style={styles.bidHistoryRight}>
          <Text style={styles.bidAmount}>₣{item.amount.toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Bid History</Text>
      <Text style={styles.headerSubtitle}>{auctionTitle}</Text>
      {bidHistory.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{bidHistory.length}</Text>
            <Text style={styles.statLabel}>Total Bids</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {new Set(bidHistory.map(b => b.bidder_display_id)).size}
            </Text>
            <Text style={styles.statLabel}>Unique Bidders</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              ₣{bidHistory[0]?.amount.toLocaleString() || '0'}
            </Text>
            <Text style={styles.statLabel}>Current Bid</Text>
          </View>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Loading bid history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Bid History</Text>
        <TouchableOpacity onPress={() => loadBidHistory(true)} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Bid List */}
      <FlatList
        data={bidHistory}
        renderItem={renderBidHistoryItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="hourglass-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>No bids yet</Text>
            <Text style={styles.emptySubtext}>
              Be patient! Bids will appear here once people start bidding.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadBidHistory(true)}
            tintColor="#8E44AD"
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerBarTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
    borderRadius: 12,
    margin: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: {
    color: '#8E44AD',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
  },
  bidHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  winningBidItem: {
    borderColor: '#F39C12',
    borderWidth: 2,
    backgroundColor: '#2a2410',
  },
  bidHistoryLeft: {
    flex: 1,
  },
  bidderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bidderName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  winningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F39C12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
  },
  winningBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  proxyBadge: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  proxyBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bidTime: {
    color: '#888',
    fontSize: 13,
  },
  bidHistoryRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  bidAmount: {
    color: '#27AE60',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
});

export default AuctionBidHistoryScreen;

