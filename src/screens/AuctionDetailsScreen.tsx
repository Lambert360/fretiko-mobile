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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../contexts/AuthContext';
import { auctionsAPI, auctionSocket, AuctionWithDetails, PublicBidHistoryItem } from '../services/auctionsAPI';
import { ordersAPI, Order } from '../services/ordersAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Video Viewer Component for Auction Media Viewer
 */
const AuctionVideoViewer: React.FC<{
  videoUri: string;
  isActive: boolean;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
}> = ({ videoUri, isActive, isPlaying, onPlayPauseToggle }) => {
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  useEffect(() => {
    if (isActive && isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isPlaying, player]);

  return (
    <View style={styles.videoViewerContainer}>
      <VideoView
        player={player}
        style={styles.videoViewer}
        contentFit="contain"
        nativeControls={false}
        fullscreenOptions={{
          allowFullscreen: false,
        }}
      />
      {!isPlaying && (
        <TouchableOpacity
          style={styles.videoPlayButton}
          onPress={onPlayPauseToggle}
          activeOpacity={0.8}
        >
          <View style={styles.videoPlayButtonCircle}>
            <Ionicons name="play" size={48} color="white" />
          </View>
        </TouchableOpacity>
      )}
      {isPlaying && (
        <TouchableOpacity
          style={styles.videoPauseOverlay}
          onPress={onPlayPauseToggle}
          activeOpacity={1}
        />
      )}
    </View>
  );
};

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
  const [proxyBidModalVisible, setProxyBidModalVisible] = useState(false);
  const [maxBidAmount, setMaxBidAmount] = useState('');
  const [placingBid, setPlacingBid] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [auctionOrder, setAuctionOrder] = useState<Order | null>(null);
  const [checkingOrder, setCheckingOrder] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);

  // Refs
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const imageViewerFlatListRef = useRef<FlatList>(null);
  const lastExtensionAlertRef = useRef<string | null>(null);

  // Load bid history separately for refresh
  const loadBidHistory = async () => {
    try {
      const history = await auctionsAPI.getBidHistory(auctionId, 20);
      setBidHistory(history);
    } catch (error) {
      console.error('Error loading bid history:', error);
    }
  };

  // Check if an order exists for this auction
  const checkAuctionOrder = async (id?: string) => {
    const targetAuctionId = id || auction?.id;
    if (!targetAuctionId || !user) return;
    
    setCheckingOrder(true);
    try {
      // Fetch user's orders
      const orders = await ordersAPI.getMyOrders();
      
      // Find order for this auction (source='auction' and metadata.auction_id matches)
      const order = orders.find(o => 
        o.source === 'auction' && 
        o.metadata?.auction_id === targetAuctionId
      );
      
      setAuctionOrder(order || null);
    } catch (error) {
      console.error('Error checking auction order:', error);
      // Don't show error to user - just assume no order exists
      setAuctionOrder(null);
    } finally {
      setCheckingOrder(false);
    }
  };

  // Load auction data
  const loadAuctionData = async () => {
    try {
      const auctionData = await auctionsAPI.getAuction(auctionId);
      setAuction(auctionData);
      
      // Calculate time remaining - for upcoming auctions, calculate from start_time
      if (auctionData.time_status === 'upcoming' && auctionData.start_time) {
        const startTime = new Date(auctionData.start_time);
        const now = new Date();
        const secondsUntilStart = Math.max(0, Math.floor((startTime.getTime() - now.getTime()) / 1000));
        setTimeRemaining(secondsUntilStart);
      } else {
        setTimeRemaining(auctionData.seconds_remaining || 0);
      }

      // Set initial bid amount to next increment
      const nextBid = auctionData.current_bid + auctionData.bid_increment;
      setBidAmount(nextBid.toString());

      // For ended live auctions where user is the winner, fetch the winning item
      if (auctionData.auction_type === 'live' && auctionData.status === 'sold' && auctionData.winner_id === user?.id) {
        try {
          const winningItem = await auctionsAPI.getCurrentItem(auctionId);
          setCurrentItem(winningItem);
          console.log(`✅ Loaded winning item for ended live auction ${auctionId}:`, winningItem?.title);
        } catch (error) {
          console.error('Error loading winning item:', error);
          setCurrentItem(null);
        }
      } else {
        setCurrentItem(null);
      }

      // Load bid history
      await loadBidHistory();
      
      // Check if order exists for this auction (if user is winner)
      if (auctionData.winner_id === user?.id && auctionData.status === 'sold') {
        await checkAuctionOrder(auctionData.id); // Pass auctionId directly
      }

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

  // Format start date and time for upcoming auctions
  const formatStartDateTime = (startTime: string) => {
    const date = new Date(startTime);
    const now = new Date();
    
    // Format date (e.g., "Jan 15, 2025")
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    
    // Format time (e.g., "2:30 PM")
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    // Compare calendar dates (not fractional days) to correctly identify Today vs Tomorrow
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (startDate.getTime() === today.getTime()) {
      return `Today at ${timeStr}`;
    } else if (startDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow at ${timeStr}`;
    } else {
      // Calculate days difference for days of week (up to 7 days)
      const diffTime = startDate.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        return `${dayName} at ${timeStr}`;
      } else {
        return `${dateStr} at ${timeStr}`;
      }
    }
  };

  // Format end date and time for active auctions
  const formatEndDateTime = (endTime: string) => {
    const date = new Date(endTime);
    
    // Format date
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    
    // Format time
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return `${dateStr} at ${timeStr}`;
  };

  useEffect(() => {
    loadAuctionData();

    // Connect to WebSocket for real-time updates
    auctionSocket.connect();
    auctionSocket.joinAuction(auctionId, user?.id);

    // Listen for real-time bid updates
    const handleNewBid = (data: any) => {
      if (data.auction_id === auctionId) {
        // Update auction with all statistics from the server
        setAuction(prev => prev ? {
          ...prev,
          current_bid: data.current_bid || data.amount,
          total_bids: data.total_bids || (prev.total_bids || 0) + 1,
          unique_bidders: data.unique_bidders !== undefined ? data.unique_bidders : prev.unique_bidders,
          view_count: data.view_count !== undefined ? data.view_count : prev.view_count,
          watch_count: data.watch_count !== undefined ? data.watch_count : prev.watch_count,
        } : null);
        
        // Refresh bid history
        loadBidHistory();
      }
    };

    const handleAuctionStatusChanged = (data: any) => {
      if (data.auction_id === auctionId) {
        loadAuctionData(); // Reload everything when status changes
      }
    };

    const handleAuctionExtended = (data: any) => {
      if (data.auction_id === auctionId && data.new_end_time) {
        const newEndTime = new Date(data.new_end_time);
        const now = new Date();
        const newSecondsRemaining = Math.floor((newEndTime.getTime() - now.getTime()) / 1000);
        setTimeRemaining(newSecondsRemaining);
        
        // Create a unique key for this extension event to prevent duplicate alerts
        const extensionKey = `${data.auction_id}-${data.new_end_time}`;
        
        // Only show alert if we haven't shown it for this specific extension
        if (lastExtensionAlertRef.current !== extensionKey) {
          lastExtensionAlertRef.current = extensionKey;
          const extensionMinutes = Math.round(data.extension_seconds / 60);
          Alert.alert(
            'Auction Extended', 
            `Auction extended by ${extensionMinutes} minute${extensionMinutes !== 1 ? 's' : ''} due to late bid!`,
            [{ text: 'OK' }]
          );
        }
      }
    };

    const handleWatchCountUpdate = (data: any) => {
      if (data.auction_id === auctionId) {
        setAuction(prev => prev ? {
          ...prev,
          watch_count: data.watch_count,
        } : null);
      }
    };

    const handleViewCountUpdate = (data: any) => {
      if (data.auction_id === auctionId) {
        setAuction(prev => prev ? {
          ...prev,
          view_count: data.view_count,
        } : null);
      }
    };

    auctionSocket.on('new_bid', handleNewBid);
    auctionSocket.on('auction_status_changed', handleAuctionStatusChanged);
    auctionSocket.on('auction_extended', handleAuctionExtended);
    auctionSocket.on('watch_count_updated', handleWatchCountUpdate);
    auctionSocket.on('view_count_updated', handleViewCountUpdate);

    return () => {
      auctionSocket.off('new_bid', handleNewBid);
      auctionSocket.off('auction_status_changed', handleAuctionStatusChanged);
      auctionSocket.off('auction_extended', handleAuctionExtended);
      auctionSocket.off('watch_count_updated', handleWatchCountUpdate);
      auctionSocket.off('view_count_updated', handleViewCountUpdate);
      auctionSocket.leaveAuction(auctionId);
    };
  }, [auctionId]);

  // Start timer - for both active auctions and upcoming auctions (to countdown to start)
  useEffect(() => {
    const shouldRunTimer = timeRemaining !== null && timeRemaining > 0 && (
      auction?.status === 'active' || 
      (auction?.time_status === 'upcoming' && auction?.start_time)
    );
    
    if (shouldRunTimer) {
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
  }, [timeRemaining, auction?.status, auction?.time_status, auction?.start_time]);

  // Refresh order status when screen comes into focus (e.g., after checkout)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (auction?.winner_id === user?.id && auction?.status === 'sold') {
        checkAuctionOrder();
      }
    });

    return unsubscribe;
  }, [navigation, auction, user]);

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

  const handlePlaceProxyBid = async () => {
    if (!user || !auction) return;

    const currentBidAmount = parseFloat(bidAmount);
    const maxBid = parseFloat(maxBidAmount);
    const minimumBid = auction.current_bid + auction.bid_increment;

    if (isNaN(currentBidAmount) || currentBidAmount < minimumBid) {
      Alert.alert('Invalid Bid', `Minimum bid is ₣${minimumBid.toFixed(2)}`);
      return;
    }

    if (isNaN(maxBid) || maxBid < currentBidAmount) {
      Alert.alert('Invalid Max Bid', 'Maximum bid must be greater than current bid');
      return;
    }

    setPlacingBid(true);

    try {
      await auctionsAPI.placeBid({
        auction_id: auctionId,
        amount: currentBidAmount,
        bid_type: 'proxy',
        max_bid_amount: maxBid,
      });

      setProxyBidModalVisible(false);
      Alert.alert(
        'Proxy Bid Set!',
        `You'll automatically bid up to ₣${maxBid.toFixed(2)} to stay winning.`
      );
      loadAuctionData();
    } catch (error: any) {
      // Error handled in API
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

      // Update local state immediately for instant UI feedback
      setAuction(prev => prev ? {
        ...prev,
        is_watched_by_user: result.watched
      } : null);

      // Show visual notification
      if (result.watched) {
        Alert.alert('Added to Watchlist', 'This lot has been added to your watchlist.');
      } else {
        Alert.alert('Removed from Watchlist', 'This lot has been removed from your watchlist.');
      }

      // Reload auction data in the background to ensure all data is fresh
      try {
        const updatedAuction = await auctionsAPI.getAuction(auctionId);
        setAuction(updatedAuction);
      } catch (reloadError) {
        console.error('Error reloading auction data:', reloadError);
        // Don't show error to user - local state already updated
      }

    } catch (error: any) {
      console.error('Watchlist toggle error:', error);
      console.error('Error response:', error?.response);
      console.error('Error response data:', error?.response?.data);
      
      // State wasn't updated since API call failed, so no need to revert
      // Extract error message from various possible error formats
      let errorMessage = 'Failed to update watchlist. Please try again.';
      
      if (error?.response?.data) {
        // NestJS error format
        if (Array.isArray(error.response.data.message)) {
          errorMessage = error.response.data.message.join(', ');
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleCancelAuction = async () => {
    if (!user || !auction || auction.seller_id !== user.id) {
      Alert.alert('Error', 'You can only cancel your own auctions');
      return;
    }

    // Confirm cancellation
    Alert.alert(
      'Cancel Auction',
      `Are you sure you want to cancel "${auction.title}"? This action cannot be undone.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await auctionsAPI.cancelAuction(auctionId, 'Cancelled by seller');
              Alert.alert('Success', 'Auction cancelled successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel auction');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Helper function to get all media items (images + video)
  const getAllMediaItems = () => {
    if (!auction) return [];
    
    const items: Array<{ type: 'image' | 'video'; uri: string }> = [];
    
    // For ended live auctions where user is the winner, prioritize winning item media
    if (auction.auction_type === 'live' && auction.status === 'sold' && auction.winner_id === user?.id && currentItem) {
      // Add winning item images first
      if (currentItem.images && currentItem.images.length > 0) {
        currentItem.images.forEach((imageUri: string) => {
          items.push({ type: 'image', uri: imageUri });
        });
      }
      
      // Add winning item video if exists
      if (currentItem.video_url) {
        items.push({ type: 'video', uri: currentItem.video_url });
      }
    } else {
      // For timed auctions or live auctions without winning item, use auction media
      // Add all images
      if (auction.images && auction.images.length > 0) {
        auction.images.forEach(imageUri => {
          items.push({ type: 'image', uri: imageUri });
        });
      }
      
      // Add video if exists
      if (auction.video_url) {
        items.push({ type: 'video', uri: auction.video_url });
      }
    }
    
    // Fallback to thumbnail if no images or video
    if (items.length === 0 && auction.thumbnail_url) {
      items.push({ type: 'image', uri: auction.thumbnail_url });
    }
    
    return items;
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

  const renderBidHistoryItem = ({ item }: { item: PublicBidHistoryItem }) => {
    // Check if auction is sold (has a winner)
    const isSold = auction && auction.status === 'sold';
    const badgeText = isSold ? 'WINNER' : 'WINNING';
    
    return (
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
              <Text style={styles.winningText}>{badgeText}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

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
              name={auction.is_watched_by_user ? "bookmark" : "bookmark-outline"}
              size={24}
              color={auction.is_watched_by_user ? "#F39C12" : "white"}
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 + (insets.bottom || 0) }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Image/Video Gallery */}
        <View style={styles.imageContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              console.log('🔍 Debug - Main image pressed');
              console.log('🔍 Debug - Auction images:', auction.images);
              console.log('🔍 Debug - Selected index:', selectedImageIndex);
              console.log('🔍 Debug - Thumbnail URL:', auction.thumbnail_url);
              
              const mediaItems = getAllMediaItems();
              console.log('🔍 Debug - Media items:', mediaItems);
              
              // Find the current item index
              let currentIndex = 0;
              if (auction.images.length > 0 && selectedImageIndex < auction.images.length) {
                currentIndex = selectedImageIndex;
              } else if (auction.video_url && auction.images.length === 0) {
                // If only video and no images, video is at index 0
                currentIndex = 0;
              } else if (auction.video_url && selectedImageIndex >= auction.images.length) {
                // If video exists and we're past images, video is last
                currentIndex = mediaItems.length - 1;
              }
              console.log('🔍 Debug - Calculated index:', currentIndex);
              setViewerImageIndex(currentIndex);
              setImageViewerVisible(true);
            }}
          >
            {auction.video_url && auction.images.length === 0 ? (
              // Show video thumbnail if only video exists (no images)
              <View style={styles.mainImageContainer}>
                <Image
                  source={{
                    uri: auction.thumbnail_url || 'https://via.placeholder.com/400x300'
                  }}
                  style={styles.mainImage}
                  resizeMode="cover"
                />
                <View style={styles.videoPlayButtonOverlay}>
                  <Ionicons name="play-circle" size={64} color="white" />
                </View>
              </View>
            ) : (
              // Show image (existing behavior)
              <Image
                source={{
                  uri: auction.images[selectedImageIndex] || auction.thumbnail_url || 'https://via.placeholder.com/400x300'
                }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            )}
            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: auctionsAPI.getStatusColor(auction.time_status) }]}>
              <Text style={styles.statusText}>
                {auction.time_status === 'active' ? 'LIVE AUCTION' : auction.time_status.toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Media Navigation (Images + Video indicator) */}
          {(auction.images.length > 1 || auction.video_url) && (
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
              ListFooterComponent={
                auction.video_url ? (
                  <TouchableOpacity
                    onPress={() => {
                      const mediaItems = getAllMediaItems();
                      setViewerImageIndex(mediaItems.length - 1);
                      setImageViewerVisible(true);
                    }}
                    style={[
                      styles.imageNavItem,
                      selectedImageIndex >= auction.images.length && styles.imageNavItemActive
                    ]}
                  >
                    <View style={styles.videoNavItem}>
                      <Image 
                        source={{ uri: auction.thumbnail_url || auction.video_url || 'https://via.placeholder.com/60x60' }} 
                        style={styles.imageNavImage}
                      />
                      <View style={styles.videoNavIcon}>
                        <Ionicons name="play" size={16} color="white" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null
              }
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

          <View style={styles.descriptionContainer}>
            <Text 
              style={styles.auctionDescription}
              numberOfLines={descriptionExpanded ? undefined : 3}
            >
              {auction.description}
            </Text>
            {auction.description && auction.description.length > 150 && (
              <TouchableOpacity
                onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                style={styles.seeMoreButton}
              >
                <Text style={styles.seeMoreText}>
                  {descriptionExpanded ? 'See Less' : 'See More'}
                </Text>
                <Ionicons 
                  name={descriptionExpanded ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color="#8E44AD" 
                />
              </TouchableOpacity>
            )}
          </View>

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
                {auction.time_status === 'upcoming' ? 'Starts At' : 'Time Remaining'}
              </Text>
              <Text style={[
                styles.timeRemaining,
                timeRemaining && timeRemaining < 3600 ? styles.timeUrgent : undefined,
                auction.time_status === 'upcoming' ? styles.timeUpcoming : undefined
              ].filter(Boolean as any)}>
                {auction.time_status === 'upcoming'
                  ? formatStartDateTime(auction.start_time)
                  : auction.time_status === 'active'
                    ? (timeRemaining ? auctionsAPI.formatTimeRemaining(timeRemaining) : 'Ending soon...')
                    : 'Ended'
                }
              </Text>
              {/* Show actual end time for active auctions */}
              {auction.time_status === 'active' && auction.end_time && (
                <Text style={styles.timeSubtext}>
                  Ends {formatEndDateTime(auction.end_time)}
                </Text>
              )}
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

          {/* Vendor Control Panel - Only visible to seller */}
          {user && auction.seller_id === user.id && (
            <View style={styles.vendorControlPanel}>
              <View style={styles.vendorHeader}>
                <Ionicons name="settings-outline" size={24} color="#3498DB" />
                <Text style={styles.vendorHeaderText}>Manage Your Auction</Text>
              </View>

              {/* Quick Stats */}
              <View style={styles.vendorStatsRow}>
                <View style={styles.vendorStatBox}>
                  <Text style={styles.vendorStatValue}>{auction.view_count}</Text>
                  <Text style={styles.vendorStatLabel}>Views</Text>
                </View>
                <View style={styles.vendorStatBox}>
                  <Text style={styles.vendorStatValue}>{auction.watch_count}</Text>
                  <Text style={styles.vendorStatLabel}>Watchers</Text>
                </View>
                <View style={styles.vendorStatBox}>
                  <Text style={styles.vendorStatValue}>{auction.total_bids}</Text>
                  <Text style={styles.vendorStatLabel}>Bids</Text>
                </View>
                <View style={styles.vendorStatBox}>
                  <Text style={styles.vendorStatValue}>{auction.unique_bidders}</Text>
                  <Text style={styles.vendorStatLabel}>Bidders</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.vendorActionsRow}>
                {/* Edit button - only for scheduled auctions with no bids */}
                {auction.status === 'scheduled' && auction.total_bids === 0 && (
                  <TouchableOpacity
                    style={styles.vendorActionButton}
                    onPress={() => navigation.navigate('CreateAuction', {
                      mode: 'edit',
                      auctionId: auction.id,
                      auctionData: auction,
                    })}
                  >
                    <Ionicons name="create-outline" size={20} color="#3498DB" />
                    <Text style={styles.vendorActionText}>Edit</Text>
                  </TouchableOpacity>
                )}

                {/* Cancel button - only for scheduled auctions */}
                {(auction.status === 'scheduled') && (
                  <TouchableOpacity
                    style={[styles.vendorActionButton, styles.vendorActionDanger]}
                    onPress={handleCancelAuction}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#E74C3C" />
                    <Text style={[styles.vendorActionText, styles.vendorActionDangerText]}>Cancel</Text>
                  </TouchableOpacity>
                )}

                {/* Relist button - only for ended/cancelled auctions */}
                {(auction.status === 'ended' || auction.status === 'cancelled') && (
                  <TouchableOpacity
                    style={styles.vendorActionButton}
                    onPress={() => navigation.navigate('CreateAuction', {
                      mode: 'relist',
                      auctionId: auction.id,
                      auctionData: auction,
                    })}
                  >
                    <Ionicons name="repeat-outline" size={20} color="#27AE60" />
                    <Text style={styles.vendorActionText}>Relist</Text>
                  </TouchableOpacity>
                )}

                {/* Seller message when auction ended but wasn't sold */}
                {auction.status === 'ended' && auction.time_status === 'ended' && (
                  <View style={styles.vendorMessageBox}>
                    <Ionicons name="information-circle-outline" size={20} color="#F39C12" />
                    <Text style={styles.vendorMessageText}>
                      {auction.current_bid === 0
                        ? 'Auction ended with no bids. You can relist this auction.'
                        : auction.auction_type === 'timed' && auction.unique_bidders < 2
                          ? `Auction ended but was not sold. Minimum 2 bidders required (only ${auction.unique_bidders} bidder participated). You can relist this auction.`
                          : auction.reserve_price && auction.current_bid < auction.reserve_price
                            ? `Auction ended but was not sold. Reserve price not met (reserve: ₣${auctionsAPI.formatPrice(auction.reserve_price)}, highest bid: ₣${auctionsAPI.formatPrice(auction.current_bid)}). You can relist this auction.`
                            : 'Auction ended but was not sold. You can relist this auction.'}
                    </Text>
                  </View>
                )}

                {/* View Full Bid History */}
                {auction.total_bids > 0 && (
                  <TouchableOpacity
                    style={styles.vendorActionButton}
                    onPress={() => navigation.navigate('AuctionBidHistory', {
                      auctionId: auction.id,
                      auctionTitle: auction.title,
                    })}
                  >
                    <Ionicons name="list-outline" size={20} color="#3498DB" />
                    <Text style={styles.vendorActionText}>Full History</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

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
        <View
          style={[
            styles.bidButtonContainer,
            { paddingBottom: Math.max(insets.bottom || 0, 16) },
          ]}
        >
          {/* Upcoming auction - Show countdown until start time, then reveal button */}
          {auction.time_status === 'upcoming' && timeRemaining !== null && timeRemaining > 0 ? (
            <View style={styles.upcomingNotice}>
              <Ionicons name="time-outline" size={28} color="#F39C12" />
              <Text style={styles.upcomingText}>Auction starts in</Text>
              <Text style={styles.upcomingCountdown}>
                {auctionsAPI.formatTimeRemaining(timeRemaining)}
              </Text>
            </View>
          ) : (
            <>
              {/* Active auction - Bid button OR Watch Live */}
              {auction.time_status === 'active' && (
            <>
              {auction.auction_type === 'live' && auction.stream_url && (
                <TouchableOpacity
                  style={[styles.bidButton, styles.liveButton]}
                  onPress={() => navigation.navigate('AuctionLiveViewer', { auctionId: auction.id })}
                >
                  <View style={styles.liveDot} />
                  <Text style={styles.bidButtonText}>Watch Live Stream</Text>
                  <Ionicons name="videocam" size={20} color="white" />
                </TouchableOpacity>
              )}
              
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.bidButton, { flex: 2 }, auction.auction_type === 'live' && styles.secondaryButton]}
                  onPress={openBidModal}
                  disabled={auction.seller_id === user.id}
                >
                  <Text style={styles.bidButtonText}>
                    {auction.seller_id === user.id ? 'Your Auction' : 'Place Bid'}
                  </Text>
                  <Ionicons name="hammer" size={20} color="white" />
                </TouchableOpacity>
                
                {auction.seller_id !== user.id && (
                  <TouchableOpacity
                    style={[styles.bidButton, styles.proxyBidButton, { flex: 1 }]}
                    onPress={() => setProxyBidModalVisible(true)}
                  >
                    <Ionicons name="flash" size={18} color="white" />
                    <Text style={[styles.bidButtonText, { fontSize: 14 }]}>Auto</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Ended auction - Winner checkout/order status (only for sold auctions) */}
          {auction.time_status === 'ended' && auction.status === 'sold' && auction.winner_id === user.id && (
            <>
              {checkingOrder ? (
                <View style={[styles.bidButton, styles.checkoutButton]}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.bidButtonText}>Checking order status...</Text>
                </View>
              ) : !auctionOrder ? (
                // No order yet - show checkout button
                <TouchableOpacity
                  style={[styles.bidButton, styles.checkoutButton]}
                  onPress={() => navigation.navigate('Checkout', {
                    source: 'auction',
                    auctionCheckout: { auctionId: auction.id }
                  })}
                >
                  <Text style={styles.bidButtonText}>🎉 Proceed to Checkout</Text>
                  <Ionicons name="card" size={20} color="white" />
                </TouchableOpacity>
              ) : ['pending', 'confirmed'].includes(auctionOrder.status) ? (
                // Order created but payment pending
                <View style={[styles.bidButton, styles.pendingOrderButton]}>
                  <Ionicons name="time-outline" size={20} color="white" />
                  <Text style={styles.pendingOrderText}>
                    Payment Pending - Order #{auctionOrder.orderNumber}
                  </Text>
                </View>
              ) : ['processing', 'shipped', 'out_for_delivery', 'delivered'].includes(auctionOrder.status) ? (
                // Order paid and processing - show congratulations
                <View style={[styles.bidButton, styles.congratulationsButton]}>
                  <Ionicons name="checkmark-circle" size={24} color="white" />
                  <Text style={styles.congratulationsText}>
                    🎉 Congratulations! Your order is being processed
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('OrderDetails', { orderId: auctionOrder.id })}
                    style={styles.viewOrderButton}
                  >
                    <Text style={styles.viewOrderText}>View Order</Text>
                  </TouchableOpacity>
                </View>
              ) : auctionOrder.status === 'cancelled' ? (
                // Order cancelled
                <View style={[styles.bidButton, styles.endedButton]}>
                  <Ionicons name="close-circle" size={20} color="#888" />
                  <Text style={styles.endedButtonText}>Order Cancelled</Text>
                </View>
              ) : null}
            </>
          )}

          {/* Auction ended but not sold - Winner message (if they were the only bidder) */}
          {auction.time_status === 'ended' && auction.status === 'ended' && auction.winner_id === user.id && auction.current_bid > 0 && (
            <View style={[styles.bidButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>
                {auction.auction_type === 'timed' && auction.unique_bidders < 2 
                  ? `Auction ended. Minimum 2 bidders required (only ${auction.unique_bidders} bidder participated).`
                  : auction.reserve_price && auction.current_bid < auction.reserve_price
                    ? `Auction ended. Reserve price not met (reserve: ₣${auctionsAPI.formatPrice(auction.reserve_price)}).`
                    : 'Auction ended but was not sold.'}
              </Text>
              <Ionicons name="information-circle" size={20} color="#888" />
            </View>
          )}

          {/* Auction ended but not sold - Lost bidder message */}
          {auction.time_status === 'ended' && auction.status === 'ended' && auction.winner_id && auction.winner_id !== user.id && (
            <View style={[styles.bidButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>
                {auction.auction_type === 'timed' && auction.unique_bidders < 2 
                  ? `Auction ended. Minimum 2 bidders required (only ${auction.unique_bidders} bidder participated).`
                  : 'Auction ended but was not sold.'}
              </Text>
              <Ionicons name="information-circle" size={20} color="#888" />
            </View>
          )}

          {/* Auction ended with no bids */}
          {auction.time_status === 'ended' && auction.status === 'ended' && !auction.winner_id && (
            <View style={[styles.bidButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>Auction ended with no bids.</Text>
              <Ionicons name="close-circle" size={20} color="#888" />
            </View>
          )}

          {/* Auction ended - Sold (non-winner message) */}
          {auction.time_status === 'ended' && auction.status === 'sold' && auction.winner_id && auction.winner_id !== user.id && (
            <View style={[styles.bidButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>Auction Ended</Text>
              <Ionicons name="close-circle" size={20} color="#888" />
            </View>
          )}
            </>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Proxy Bid Modal */}
      <Modal
        visible={proxyBidModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProxyBidModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>⚡ Set Auto-Bid</Text>
                <TouchableOpacity onPress={() => setProxyBidModalVisible(false)}>
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Set a maximum bid and we'll automatically bid for you up to that amount to keep you winning.
              </Text>

              <Text style={styles.modalInfo}>
                Current bid: ₣{auction?.current_bid.toFixed(2)}
              </Text>
              <Text style={styles.modalInfo}>
                Minimum bid: ₣{auction ? (auction.current_bid + auction.bid_increment).toFixed(2) : '0.00'}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Initial Bid</Text>
                <TextInput
                  style={styles.bidInput}
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  placeholder="Enter initial bid"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Maximum Bid (Auto-Bid Limit)</Text>
                <TextInput
                  style={styles.bidInput}
                  value={maxBidAmount}
                  onChangeText={setMaxBidAmount}
                  placeholder="Enter max bid"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.proxyExplainer}>
                <Ionicons name="information-circle" size={16} color="#3498DB" />
                <Text style={styles.proxyExplainerText}>
                  We'll only bid what's needed to keep you winning, up to your maximum.
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setProxyBidModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmButton, placingBid && styles.disabledButton]}
                  onPress={handlePlaceProxyBid}
                  disabled={placingBid}
                >
                  {placingBid ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Set Auto-Bid</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full Screen Image/Video Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsVideoPlaying(false);
          setImageViewerVisible(false);
        }}
      >
        <View style={styles.imageViewerContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={[styles.imageViewerCloseButton, { top: (insets.top || 50) + 10 }]}
            onPress={() => {
              setIsVideoPlaying(false);
              setImageViewerVisible(false);
            }}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          {/* Media List (Images + Video) */}
          <FlatList
            ref={imageViewerFlatListRef}
            data={getAllMediaItems()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            initialScrollIndex={viewerImageIndex}
            getItemLayout={(data, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
              setViewerImageIndex(index);
              const mediaItems = getAllMediaItems();
              // Pause video when scrolling away
              if (mediaItems[index]?.type !== 'video') {
                setIsVideoPlaying(false);
              }
            }}
            renderItem={({ item, index }) => (
              <View style={styles.imageViewerItem}>
                {item.type === 'video' ? (
                  <AuctionVideoViewer
                    videoUri={item.uri}
                    isActive={index === viewerImageIndex}
                    isPlaying={isVideoPlaying && index === viewerImageIndex}
                    onPlayPauseToggle={() => setIsVideoPlaying(!isVideoPlaying)}
                  />
                ) : (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.imageViewerImage}
                    resizeMode="contain"
                  />
                )}
              </View>
            )}
          />

          {/* Navigation Controls */}
          {getAllMediaItems().length > 1 && (
            <View style={[styles.imageViewerControls, { paddingBottom: (insets.bottom || 20) + 20 }]}>
              {/* Previous Button */}
              <TouchableOpacity
                style={[
                  styles.imageViewerNavButton,
                  viewerImageIndex === 0 && styles.imageViewerNavButtonDisabled
                ]}
                onPress={() => {
                  if (viewerImageIndex > 0) {
                    const newIndex = viewerImageIndex - 1;
                    setViewerImageIndex(newIndex);
                    setIsVideoPlaying(false);
                    imageViewerFlatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                  }
                }}
                disabled={viewerImageIndex === 0}
              >
                <Ionicons
                  name="chevron-back"
                  size={28}
                  color={viewerImageIndex === 0 ? '#555' : 'white'}
                />
              </TouchableOpacity>

              {/* Media Counter */}
              <View style={styles.imageViewerCounter}>
                <Text style={styles.imageViewerCounterText}>
                  {viewerImageIndex + 1} / {getAllMediaItems().length}
                </Text>
              </View>

              {/* Next Button */}
              <TouchableOpacity
                style={[
                  styles.imageViewerNavButton,
                  viewerImageIndex === getAllMediaItems().length - 1 && styles.imageViewerNavButtonDisabled
                ]}
                onPress={() => {
                  const mediaItems = getAllMediaItems();
                  if (viewerImageIndex < mediaItems.length - 1) {
                    const newIndex = viewerImageIndex + 1;
                    setViewerImageIndex(newIndex);
                    setIsVideoPlaying(false);
                    imageViewerFlatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
                  }
                }}
                disabled={viewerImageIndex === getAllMediaItems().length - 1}
              >
                <Ionicons
                  name="chevron-forward"
                  size={28}
                  color={viewerImageIndex === getAllMediaItems().length - 1 ? '#555' : 'white'}
                />
              </TouchableOpacity>
            </View>
          )}

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
  descriptionContainer: {
    marginBottom: 24,
  },
  auctionDescription: {
    color: '#888',
    fontSize: 16,
    lineHeight: 24,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    color: '#8E44AD',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
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
  timeSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
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
  // Vendor Control Panel Styles
  vendorControlPanel: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#3498DB',
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  vendorHeaderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  vendorStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  vendorStatBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  vendorStatValue: {
    color: '#3498DB',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vendorStatLabel: {
    color: '#888',
    fontSize: 12,
  },
  vendorActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vendorActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  vendorActionDanger: {
    borderColor: '#E74C3C',
  },
  vendorActionText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  vendorActionDangerText: {
    color: '#E74C3C',
  },
  vendorMessageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F39C12',
  },
  vendorMessageText: {
    flex: 1,
    color: '#F39C12',
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
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
  liveButton: {
    backgroundColor: '#E74C3C',
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: '#555',
  },
  checkoutButton: {
    backgroundColor: '#27AE60', // Green for winner
  },
  pendingOrderButton: {
    backgroundColor: '#FF9500', // Orange for pending
    opacity: 0.9,
  },
  pendingOrderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  congratulationsButton: {
    backgroundColor: '#34C759', // Green for success
    paddingVertical: 16,
    alignItems: 'center',
  },
  congratulationsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  viewOrderButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  viewOrderText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    maxHeight: '90%',
  },
  modalScrollContent: {
    flexGrow: 1,
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
  proxyBidButton: {
    backgroundColor: '#F39C12',
  },
  modalDescription: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  proxyExplainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  proxyExplainerText: {
    color: '#3498DB',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
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
  upcomingCountdown: {
    color: '#F39C12',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  // Image Viewer Modal Styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerItem: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: screenWidth,
    height: screenHeight,
  },
  imageViewerControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  imageViewerNavButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerNavButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.5,
  },
  imageViewerCounter: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageViewerCounterText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  mainImageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
  },
  videoPlayButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoNavItem: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  videoNavIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
  },
  videoViewerContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoViewer: {
    width: screenWidth,
    height: screenHeight,
  },
  videoPlayButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButtonCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  videoPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default AuctionDetailsScreen;