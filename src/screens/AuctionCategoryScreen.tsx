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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auctionsAPI, AuctionWithDetails } from '../services/auctionsAPI';

/**
 * Auction Category Screen
 *
 * Shows all auctions in a specific category
 */
const AuctionCategoryScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { categorySlug, categoryName, categoryColor } = route.params;

  const [auctions, setAuctions] = useState<AuctionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCategoryAuctions();
  }, [categorySlug]);

  const loadCategoryAuctions = async () => {
    try {
      const response = await auctionsAPI.getAuctions({
        category_slug: categorySlug,
        status: 'active',
        limit: 50,
      });
      setAuctions(response.auctions);
    } catch (error) {
      console.error('Error loading category auctions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCategoryAuctions();
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
        <Text style={styles.auctionTitle} numberOfLines={2}>{item.title}</Text>

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
            {item.seconds_remaining ? auctionsAPI.formatTimeRemaining(item.seconds_remaining) : 'Ended'}
          </Text>
          <Text style={styles.bidCount}>{item.total_bids} bids</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={categoryColor} />
          <Text style={styles.loadingText}>Loading auctions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: categoryColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{categoryName}</Text>

        <View style={styles.backButton} />
      </View>

      {/* Auctions List */}
      <FlatList
        data={auctions}
        renderItem={renderAuctionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={categoryColor} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="hammer" size={64} color="#444" />
            <Text style={styles.emptyText}>No active auctions in this category</Text>
            <Text style={styles.emptySubtext}>Check back soon for new listings!</Text>
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
    borderBottomWidth: 2,
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
  auctionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});

export default AuctionCategoryScreen;
