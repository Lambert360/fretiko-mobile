import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { auctionsAPI, AuctionWithDetails, PublicBidHistoryItem } from '../services/auctionsAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Auction Details Screen
 *
 * Individual auction page featuring:
 * - Full auction details with image gallery
 * - Real-time bidding interface
 * - Bid history with anonymized bidders
 * - Watchlist functionality
 * - Live countdown timer
 * - Seller information
 */
const AuctionDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { auctionId } = route.params;

  // State
  const [auction, setAuction] = useState<AuctionWithDetails | null>(null);
  const [bidHistory, setBidHistory] = useState<PublicBidHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [placingBid, setPlacingBid] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Refs
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Load auction data
  const loadAuctionData = async () => {
    try {
      const auctionData = await auctionsAPI.getAuction(auctionId);
      setAuction(auctionData);
      setTimeRemaining(auctionData.seconds_remaining || 0);

      // Set initial bid amount to next increment
      const nextBid = auctionData.current_bid + auctionData.bid_increment;
      setBidAmount(nextBid.toString());

      // Load bid history
      const history = await auctionsAPI.getBidHistory(auctionId, 20);
      setBidHistory(history);

    } catch (error) {
      console.error('Error loading auction:', error);
      Alert.alert('Error', 'Failed to load auction details');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update countdown timer
  const updateTimer = () => {
    setTimeRemaining(prev => {
      if (prev && prev > 0) {
        return prev - 1;
      }
      return 0;
    });
  };

  useEffect(() => {
    loadAuctionData();
  }, [auctionId]);

  // Start timer
  useEffect(() => {
    if (timeRemaining && timeRemaining > 0 && auction?.status === 'active') {
      timeUpdateInterval.current = setInterval(updateTimer, 1000);
    } else {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    }

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [timeRemaining, auction?.status]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAuctionData();
  };

  const handlePlaceBid = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to place bids');
      return;
    }

    if (!auction) return;

    const amount = parseFloat(bidAmount);
    const minimumBid = auction.current_bid + auction.bid_increment;

    if (isNaN(amount) || amount < minimumBid) {
      Alert.alert('Invalid Bid', `Minimum bid is ${auctionsAPI.formatPrice(minimumBid)}`);
      return;
    }

    setPlacingBid(true);

    try {
      await auctionsAPI.placeBid({
        auction_id: auctionId,
        amount,
        bid_type: 'manual',
      });

      setBidModalVisible(false);
      loadAuctionData(); // Refresh auction data

    } catch (error) {
      // Error handling is done in the API service
    } finally {
      setPlacingBid(false);
    }
  };

  const handleWatchlist = async () => {
    if (!user || !auction) {
      Alert.alert('Login Required', 'Please log in to add to watchlist');
      return;
    }

    setWatchlistLoading(true);

    try {
      const result = await auctionsAPI.toggleWatchlist(auctionId);

      setAuction(prev => prev ? {
        ...prev,
        is_watched_by_user: result.watched
      } : null);

    } catch (error) {
      Alert.alert('Error', 'Failed to update watchlist');
    } finally {
      setWatchlistLoading(false);
    }
  };

  const openBidModal = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to place bids');
      return;
    }

    if (auction?.status !== 'active') {
      Alert.alert('Auction Not Active', 'This auction is not currently accepting bids');
      return;
    }

    setBidModalVisible(true);
  };

  const renderBidHistoryItem = ({ item }: { item: PublicBidHistoryItem }) => (
    <View style={styles.bidHistoryItem}>
      <View style={styles.bidHistoryLeft}>
        <Text style={styles.bidderName}>{item.bidder_display_id}</Text>
        <Text style={styles.bidTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
      </View>

      <View style={styles.bidHistoryRight}>
        <Text style={[styles.bidAmount, item.is_winning && styles.winningBid]}>
          {auctionsAPI.formatPrice(item.amount)}
        </Text>
        {item.is_winning && (
          <View style={styles.winningBadge}>
            <Text style={styles.winningText}>WINNING</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Loading auction...</Text>
      </View>
    );
  }

  if (!auction) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Auction not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {auction.title}
        </Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleWatchlist}
          disabled={watchlistLoading}
        >
          {watchlistLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons
              name={auction.is_watched_by_user ? "heart" : "heart-outline"}
              size={24}
              color={auction.is_watched_by_user ? "#E74C3C" : "white"}
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: auction.images[selectedImageIndex] || auction.thumbnail_url || 'https://via.placeholder.com/400x300'
            }}
            style={styles.mainImage}
            resizeMode="cover"
          />

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: auctionsAPI.getStatusColor(auction.time_status) }]}>
            <Text style={styles.statusText}>
              {auction.time_status === 'active' ? 'LIVE AUCTION' : auction.time_status.toUpperCase()}
            </Text>
          </View>

          {/* Image Navigation */}
          {auction.images.length > 1 && (
            <FlatList
              data={auction.images}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => index.toString()}
              style={styles.imageNavigation}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => setSelectedImageIndex(index)}
                  style={[
                    styles.imageNavItem,
                    index === selectedImageIndex && styles.imageNavItemActive
                  ]}
                >
                  <Image source={{ uri: item }} style={styles.imageNavImage} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Auction Info */}
        <View style={styles.auctionInfo}>
          <View style={styles.titleSection}>
            <Text style={styles.auctionTitle}>{auction.title}</Text>

            <View style={styles.categoryBadge}>
              <Ionicons name={auction.category.icon_name as any} size={16} color={auction.category.color} />
              <Text style={[styles.categoryText, { color: auction.category.color }]}>
                {auction.category.name}
              </Text>
            </View>
          </View>

          <Text style={styles.auctionDescription}>{auction.description}</Text>

          {/* Current Bid Section */}
          <View style={styles.bidSection}>
            <View style={styles.currentBidContainer}>
              <Text style={styles.currentBidLabel}>Current Bid</Text>
              <Text style={styles.currentBidAmount}>
                {auctionsAPI.formatPrice(auction.current_bid)}
              </Text>
              {auction.current_winning_bid && (
                <Text style={styles.currentBidder}>
                  by {auction.current_winning_bid.bidder_display_id}
                </Text>
              )}
            </View>

            {/* Time Remaining */}
            <View style={styles.timeContainer}>
              <Text style={styles.timeLabel}>
                {auction.time_status === 'upcoming' ? 'Starts In' : 'Time Remaining'}
              </Text>
              <Text style={[
                styles.timeRemaining,
                timeRemaining && timeRemaining < 3600 && styles.timeUrgent,
                auction.time_status === 'upcoming' && styles.timeUpcoming
              ]}>
                {auction.time_status === 'upcoming'
                  ? (timeRemaining ? auctionsAPI.formatTimeRemaining(timeRemaining) : 'Starting soon...')
                  : auction.time_status === 'active'
                    ? (timeRemaining ? auctionsAPI.formatTimeRemaining(timeRemaining) : 'Ending soon...')
                    : 'Ended'
                }
              </Text>
            </View>
          </View>

          {/* Auction Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{auction.total_bids}</Text>
              <Text style={styles.statLabel}>Bids</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{auction.unique_bidders}</Text>
              <Text style={styles.statLabel}>Bidders</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{auction.view_count}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{auctionsAPI.formatPrice(auction.starting_price)}</Text>
              <Text style={styles.statLabel}>Starting Bid</Text>
            </View>
          </View>

          {/* Seller Info */}
          <View style={styles.sellerSection}>
            <Text style={styles.sectionTitle}>Seller Information</Text>
            <View style={styles.sellerInfo}>
              <Image
                source={{ uri: auction.seller.avatar_url || 'https://via.placeholder.com/50' }}
                style={styles.sellerAvatar}
              />
              <View style={styles.sellerDetails}>
                <View style={styles.sellerNameContainer}>
                  <Text style={styles.sellerName}>{auction.seller.username}</Text>
                  {auction.seller.is_verified && (
                    <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                  )}
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: auction.seller.id })}>
                  <Text style={styles.viewProfileText}>View Profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bid History */}
          <View style={styles.bidHistorySection}>
            <Text style={styles.sectionTitle}>Bid History</Text>
            {bidHistory.length > 0 ? (
              <FlatList
                data={bidHistory}
                renderItem={renderBidHistoryItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                style={styles.bidHistoryList}
              />
            ) : (
              <Text style={styles.noBidsText}>No bids yet. Be the first to bid!</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {user && (
        <View style={styles.bidButtonContainer}>
          {/* Upcoming auction - Notify */}
          {auction.time_status === 'upcoming' && (
            <View style={styles.upcomingNotice}>
              <Ionicons name="time-outline" size={28} color="#F39C12" />
              <Text style={styles.upcomingText}>Auction starts soon!</Text>
              <Text style={styles.upcomingSubtext}>Check back when it goes live</Text>
            </View>
          )}

          {/* Active auction - Bid button */}
          {auction.time_status === 'active' && (
            <TouchableOpacity
              style={styles.bidButton}
              onPress={openBidModal}
              disabled={auction.seller_id === user.id}
            >
              <Text style={styles.bidButtonText}>
                {auction.seller_id === user.id ? 'Your Auction' : 'Place Bid'}
              </Text>
              <Ionicons name="hammer" size={20} color="white" />
            </TouchableOpacity>
          )}

          {/* Ended auction - Winner checkout button */}
          {auction.time_status === 'ended' && auction.winner_id === user.id && (
            <TouchableOpacity
              style={[styles.bidButton, styles.checkoutButton]}
              onPress={() => navigation.navigate('Checkout', {
                auctionCheckout: { auctionId: auction.id }
              })}
            >
              <Text style={styles.bidButtonText}>🎉 Proceed to Checkout</Text>
              <Ionicons name="card" size={20} color="white" />
            </TouchableOpacity>
          )}

          {/* Ended auction - Lost bidder message */}
          {auction.time_status === 'ended' && auction.winner_id && auction.winner_id !== user.id && (
            <View style={[styles.bidButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>Auction Ended</Text>
              <Ionicons name="close-circle" size={20} color="#888" />
            </View>
          )}
        </View>
      )}

      {/* Bid Modal */}
      <Modal
        visible={bidModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBidModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Place Your Bid</Text>
              <TouchableOpacity onPress={() => setBidModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInfo}>
              Current bid: {auctionsAPI.formatPrice(auction.current_bid)}
            </Text>
            <Text style={styles.modalInfo}>
              Minimum bid: {auctionsAPI.formatPrice(auction.current_bid + auction.bid_increment)}
            </Text>

            <TextInput
              style={styles.bidInput}
              value={bidAmount}
              onChangeText={setBidAmount}
              placeholder="Enter bid amount"
              placeholderTextColor="#888"
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setBidModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, placingBid && styles.disabledButton]}
                onPress={handlePlaceBid}
                disabled={placingBid}
              >
                {placingBid ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>Place Bid</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#8E44AD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  mainImage: {
    width: screenWidth,
    height: 300,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageNavigation: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  imageNavItem: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginHorizontal: 4,
    marginLeft: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageNavItemActive: {
    borderColor: '#8E44AD',
  },
  imageNavImage: {
    width: '100%',
    height: '100%',
  },
  auctionInfo: {
    padding: 20,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  auctionTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  auctionDescription: {
    color: '#888',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  bidSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
  },
  currentBidContainer: {
    flex: 1,
  },
  currentBidLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  currentBidAmount: {
    color: '#27AE60',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  currentBidder: {
    color: '#888',
    fontSize: 12,
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timeLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  timeRemaining: {
    color: '#F39C12',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeUrgent: {
    color: '#E74C3C',
  },
  timeUpcoming: {
    color: '#3498DB',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
  },
  sellerSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  sellerDetails: {
    flex: 1,
  },
  sellerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sellerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  viewProfileText: {
    color: '#8E44AD',
    fontSize: 14,
  },
  bidHistorySection: {
    marginBottom: 100, // Space for bid button
  },
  bidHistoryList: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  bidHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  bidHistoryLeft: {
    flex: 1,
  },
  bidderName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  bidTime: {
    color: '#888',
    fontSize: 12,
  },
  bidHistoryRight: {
    alignItems: 'flex-end',
  },
  bidAmount: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  winningBid: {
    color: '#27AE60',
  },
  winningBadge: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  winningText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  noBidsText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 32,
  },
  bidButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  bidButton: {
    backgroundColor: '#8E44AD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  bidButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  checkoutButton: {
    backgroundColor: '#27AE60', // Green for winner
  },
  endedButton: {
    backgroundColor: '#333',
    opacity: 0.7,
  },
  endedButtonText: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    width: screenWidth - 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalInfo: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  bidInput: {
    backgroundColor: '#333',
    color: 'white',
    fontSize: 18,
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#8E44AD',
    padding: 16,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  upcomingNotice: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 12,
  },
  upcomingText: {
    color: '#F39C12',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  upcomingSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default AuctionDetailsScreen;