import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { auctionsAPI, AuctionWithDetails } from '../services/auctionsAPI';

/**
 * Auction Watchlist Screen
 *
 * Displays all auctions the user has added to their watchlist
 * Users can view watched auctions and remove them from the watchlist
 */
const AuctionWatchlistScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [watchlist, setWatchlist] = useState<AuctionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Load watchlist
  const loadWatchlist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const data = await auctionsAPI.getUserWatchlist(50);
      setWatchlist(data);
    } catch (error: any) {
      console.error('Error loading watchlist:', error);
      if (error.message !== 'Authentication required') {
        Alert.alert('Error', 'Failed to load watchlist. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh watchlist when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadWatchlist();
      }
    }, [user])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadWatchlist();
  };

  const handleRemoveFromWatchlist = async (auctionId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to manage your watchlist');
      return;
    }

    setRemovingId(auctionId);
    try {
      await auctionsAPI.toggleWatchlist(auctionId);
      // Remove from local state
      setWatchlist(prev => prev.filter(a => a.id !== auctionId));
    } catch (error: any) {
      console.error('Error removing from watchlist:', error);
      Alert.alert('Error', 'Failed to remove from watchlist. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  const navigateToAuction = (auction: AuctionWithDetails) => {
    navigation.navigate('AuctionDetails', { auctionId: auction.id });
  };

  const renderAuctionItem = ({ item }: { item: AuctionWithDetails }) => (
    <TouchableOpacity
      style={styles.auctionCard}
      onPress={() => navigateToAuction(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.thumbnail_url || item.images[0] || 'https://via.placeholder.com/150' }}
        style={styles.auctionImage}
        resizeMode="cover"
      />

      <View style={styles.auctionInfo}>
        <View style={styles.auctionHeader}>
          <Text style={styles.auctionTitle} numberOfLines={2}>{item.title}</Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFromWatchlist(item.id)}
            disabled={removingId === item.id}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {removingId === item.id ? (
              <ActivityIndicator size="small" color="#FF4757" />
            ) : (
              <Ionicons name="close-circle" size={24} color="#FF4757" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.currentBid}>₣{auctionsAPI.formatPrice(item.current_bid)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: auctionsAPI.getStatusColor(item.time_status) }]}>
            <Text style={styles.statusText}>
              {item.time_status === 'active' ? 'LIVE' : item.time_status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.auctionFooter}>
          <Text style={styles.timeRemaining}>
            {item.time_status === 'upcoming'
              ? `Starts ${item.seconds_remaining ? auctionsAPI.formatTimeRemaining(item.seconds_remaining) : 'soon'}`
              : item.time_status === 'active'
                ? (item.seconds_remaining ? auctionsAPI.formatTimeRemaining(item.seconds_remaining) : 'Ending soon')
                : 'Ended'
            }
          </Text>
          <Text style={styles.bidCount}>{item.total_bids} bids</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Watchlist</Text>

          <View style={styles.backButton} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={64} color="#666" />
          <Text style={styles.emptyText}>Login Required</Text>
          <Text style={styles.emptySubtext}>Please log in to view your watchlist</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Watchlist</Text>

          <View style={styles.backButton} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E44AD" />
          <Text style={styles.loadingText}>Loading watchlist...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Watchlist</Text>

        <View style={styles.backButton} />
      </View>

      {/* Watchlist Count */}
      {watchlist.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {watchlist.length} {watchlist.length === 1 ? 'auction' : 'auctions'} watched
          </Text>
        </View>
      )}

      {/* Watchlist */}
      <FlatList
        data={watchlist}
        renderItem={renderAuctionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#8E44AD" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>Your watchlist is empty</Text>
            <Text style={styles.emptySubtext}>
              Start adding auctions to your watchlist to keep track of items you're interested in
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => navigation.navigate('AuctionDiscovery')}
            >
              <Text style={styles.browseButtonText}>Browse Auctions</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  countText: {
    color: '#888',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  auctionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  auctionImage: {
    width: 120,
    height: 120,
  },
  auctionInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  auctionTitle: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentBid: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  auctionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRemaining: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '600',
  },
  bidCount: {
    color: '#888',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#8E44AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#8E44AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AuctionWatchlistScreen;

