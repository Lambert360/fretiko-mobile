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
  FlatList,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../contexts/AuthContext';
import { auctionsAPI, auctionSocket, AuctionWithDetails, AuctionItem, PublicBidHistoryItem } from '../services/auctionsAPI';
import { ordersAPI, Order } from '../services/ordersAPI';
import AdaptiveText from '../components/AdaptiveText';

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
          enable: false,
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
 * Live Auction Details Screen
 *
 * Specialized screen for live auctions with:
 * - Live auction validation
 * - Special button states: Start Live / Join Live / Awaiting Auctioneer
 * - Real-time stream status updates
 * - Navigation to broadcast or viewer screens
 */
const LiveAuctionDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { auctionId } = route.params;

  // State
  const [auction, setAuction] = useState<AuctionWithDetails | null>(null);
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [bidHistory, setBidHistory] = useState<PublicBidHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [auctionOrder, setAuctionOrder] = useState<Order | null>(null);
  const [checkingOrder, setCheckingOrder] = useState(false);
  const [currentItem, setCurrentItem] = useState<AuctionItem | null>(null);
  const [userWonItems, setUserWonItems] = useState<Array<{
    id?: string;
    auctionId: string;
    itemId?: string | null;
    title: string;
    winningBid: number;
    wonAt: string;
    thumbnail_url?: string;
    images?: string[];
  }>>([]);
  const [loadingWins, setLoadingWins] = useState(false);

  // Refs
  const timeUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageViewerFlatListRef = useRef<FlatList>(null);
  const auctionRef = useRef<AuctionWithDetails | null>(null);
  const streamCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load bid history
  const loadBidHistory = async () => {
    try {
      const history = await auctionsAPI.getBidHistory(auctionId, 20);
      setBidHistory(history);
    } catch (error) {
      console.error('Error loading bid history:', error);
    }
  };

  // Load user's won items for this auction
  const loadUserWonItems = async () => {
    if (!user || !auctionId) return;
    
    setLoadingWins(true);
    try {
      const wins = await auctionsAPI.getUserAuctionWins('pending_checkout');
      
      // Filter wins for this auction only and format for display
      const auctionWins = wins
        .filter((win: any) => win.auction_id === auctionId)
        .map((win: any) => ({
          id: win.id,
          auctionId: win.auction_id,
          itemId: win.item_id || null,
          title: win.item?.title || win.auction?.title || 'Auction Item',
          winningBid: win.winning_bid,
          wonAt: win.won_at || new Date().toISOString(),
          thumbnail_url: win.item?.images?.[0] || win.auction?.thumbnail_url || win.auction?.images?.[0],
          images: win.item?.images || win.auction?.images || [],
        }));
      
      setUserWonItems(auctionWins);
      console.log(`✅ Loaded ${auctionWins.length} won item(s) for auction ${auctionId}`);
    } catch (error) {
      console.error('Error loading user won items:', error);
      setUserWonItems([]);
    } finally {
      setLoadingWins(false);
    }
  };

  // Check if an order exists for this auction
  const checkAuctionOrder = async (id?: string) => {
    const targetAuctionId = id || auction?.id;
    if (!targetAuctionId || !user) return;
    
    setCheckingOrder(true);
    try {
      const orders = await ordersAPI.getMyOrders();
      const order = orders.find(o => 
        o.source === 'auction' && 
        o.metadata?.auction_id === targetAuctionId
      );
      setAuctionOrder(order || null);
    } catch (error) {
      console.error('Error checking auction order:', error);
      setAuctionOrder(null);
    } finally {
      setCheckingOrder(false);
    }
  };

  // Load auction data
  const loadAuctionData = async () => {
    try {
      const auctionData = await auctionsAPI.getAuction(auctionId);

      // Validate this is a live auction
      if (auctionData.auction_type !== 'live') {
        Alert.alert(
          'Invalid Auction',
          'This is not a live auction. Redirecting to regular auction details.',
          [{ text: 'OK', onPress: () => navigation.replace('AuctionDetails', { auctionId }) }]
        );
        return;
      }

      setAuction(auctionData);
      auctionRef.current = auctionData; // Keep ref in sync
      
      // Load additional items for live auctions
      try {
        const items = await auctionsAPI.getAuctionItems(auctionId);
        setAuctionItems(items);
        console.log(`✅ Loaded ${items.length} additional items for auction ${auctionId}`);
      } catch (error) {
        console.error('Error loading auction items:', error);
        setAuctionItems([]); // Set empty array on error
      }

      // For active live auctions, fetch the current item
      if (auctionData.status === 'active' && auctionData.auction_type === 'live') {
        try {
          const currentItemData = await auctionsAPI.getCurrentItem(auctionId);
          setCurrentItem(currentItemData);
          console.log(`✅ Loaded current item for active auction ${auctionId}:`, currentItemData?.title);
        } catch (error) {
          console.error('Error loading current item:', error);
          setCurrentItem(null);
        }
      } else {
        setCurrentItem(null);
      }
      
      // Calculate time remaining - for upcoming auctions, calculate from start_time
      if (auctionData.time_status === 'upcoming' && auctionData.start_time) {
        const startTime = new Date(auctionData.start_time);
        const now = new Date();
        const secondsUntilStart = Math.max(0, Math.floor((startTime.getTime() - now.getTime()) / 1000));
        setTimeRemaining(secondsUntilStart);
      } else {
        setTimeRemaining(auctionData.seconds_remaining || 0);
      }

      // Load bid history
      await loadBidHistory();
      
      // Check if order exists for this auction (if user is winner)
      if (auctionData.winner_id === user?.id && auctionData.status === 'sold') {
        await checkAuctionOrder(auctionData.id);
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

  // Format end date and time
  const formatEndDateTime = (endTime: string) => {
    const date = new Date(endTime);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} at ${timeStr}`;
  };

  // Get action button state based on auction status, user role, and broadcast status
  const getActionButtonState = () => {
    if (!auction || !user) {
      return { text: 'Loading...', action: 'disabled', enabled: false, showSubtext: false };
    }

    const isHost = auction.seller_id === user.id;
    const isActive = auction.time_status === 'active';
    const isBroadcasting = !!auction.stream_url;

    // Host states
    if (isHost) {
      if (!isActive) {
        return { text: 'Coming Soon', action: 'disabled', enabled: false, showSubtext: false };
      }
      if (isActive && !isBroadcasting) {
        return { 
          text: 'Start Live', 
          action: 'start_live', 
          enabled: true,
          showSubtext: false
        };
      }
      if (isActive && isBroadcasting) {
        return { 
          text: 'Manage Broadcast', 
          action: 'manage_broadcast', 
          enabled: true,
          showSubtext: false
        };
      }
    }

    // Viewer states
    if (isActive && isBroadcasting) {
      return { 
        text: 'Join Live', 
        action: 'join_live', 
        enabled: true,
        showSubtext: false
      };
    }
    if (isActive && !isBroadcasting) {
      return { 
        text: 'Awaiting Auctioneer', 
        action: 'awaiting', 
        enabled: false,
        showSubtext: true
      };
    }

    return { text: 'Coming Soon', action: 'disabled', enabled: false, showSubtext: false };
  };

  useEffect(() => {
    loadAuctionData();

    // Connect to WebSocket for real-time updates
    auctionSocket.connect('details-screen');
    auctionSocket.joinAuction(auctionId, user?.id);

    // Track auction view for viewer count
    auctionsAPI.trackAuctionView(auctionId).catch(error => {
      console.error('Error tracking auction view:', error);
    });

    // Listen for real-time bid updates
    const handleNewBid = (data: any) => {
      if (data.auction_id === auctionId) {
        setAuction(prev => {
          const updated = prev ? {
            ...prev,
            current_bid: data.current_bid || data.amount,
            total_bids: data.total_bids || (prev.total_bids || 0) + 1,
            unique_bidders: data.unique_bidders !== undefined ? data.unique_bidders : prev.unique_bidders,
            view_count: data.view_count !== undefined ? data.view_count : prev.view_count,
            watch_count: data.watch_count !== undefined ? data.watch_count : prev.watch_count,
          } : null;
          auctionRef.current = updated;
          return updated;
        });
        loadBidHistory();
      }
    };

    const handleAuctionStatusChanged = (data: any) => {
      if (data.auction_id === auctionId) {
        // Reload to get updated stream_url and other auction data
        loadAuctionData();
        // Also reload user wins in case auction ended and user won
        if (data.status === 'ended' || data.status === 'sold') {
          loadUserWonItems();
        }
      }
    };

    // Listen for stream URL updates (when host starts/stops broadcasting)
    const handleStreamUrlUpdate = (data: any) => {
      if (data.auction_id === auctionId) {
        console.log('📺 Stream URL update received:', data.stream_url);
        setAuction(prev => {
          const updated = prev ? {
            ...prev,
            stream_url: data.stream_url, // Handle both start (string) and stop (null)
          } : null;
          auctionRef.current = updated;
          return updated;
        });
      }
    };

    // Listen for broadcast started event
    const handleBroadcastStarted = (data: any) => {
      if (data.auction_id === auctionId) {
        console.log('🎥 Broadcast started event received');
        // Reload auction data to get stream_url
        loadAuctionData();
      }
    };

    const handleAuctionExtended = (data: any) => {
      if (data.auction_id === auctionId && data.new_end_time) {
        const newEndTime = new Date(data.new_end_time);
        const now = new Date();
        const newSecondsRemaining = Math.floor((newEndTime.getTime() - now.getTime()) / 1000);
        setTimeRemaining(newSecondsRemaining);
      }
    };

    const handleWatchCountUpdate = (data: any) => {
      if (data.auction_id === auctionId) {
        setAuction(prev => {
          const updated = prev ? {
            ...prev,
            watch_count: data.watch_count,
          } : null;
          auctionRef.current = updated;
          return updated;
        });
      }
    };

    const handleViewCountUpdate = (data: any) => {
      if (data.auction_id === auctionId) {
        setAuction(prev => {
          const updated = prev ? {
            ...prev,
            view_count: data.view_count,
          } : null;
          auctionRef.current = updated;
          return updated;
        });
      }
    };

    auctionSocket.on('new_bid', handleNewBid);
    auctionSocket.on('auction_status_changed', handleAuctionStatusChanged);
    auctionSocket.on('auction_extended', handleAuctionExtended);
    auctionSocket.on('watch_count_updated', handleWatchCountUpdate);
    auctionSocket.on('view_count_updated', handleViewCountUpdate); // Fixed event name
    auctionSocket.on('stream_url_updated', handleStreamUrlUpdate);
    auctionSocket.on('broadcast_started', handleBroadcastStarted);

    // Poll for stream_url updates (fallback if WebSocket doesn't send it)
    // Poll less frequently and stop when stream_url is available or auction is not active

    // Start polling if needed
    if (auction?.time_status === 'active' && !auction?.stream_url && !streamCheckIntervalRef.current) {
      console.log('🔄 Starting stream_url polling...');
      streamCheckIntervalRef.current = setInterval(() => {
        const currentAuction = auctionRef.current;
        if (currentAuction?.time_status === 'active' && !currentAuction?.stream_url) {
          console.log('🔄 Polling for stream_url update...');
          loadAuctionData();
        } else {
          // Stop polling if we have stream_url or auction is not active
          console.log('✅ Stopping stream_url polling - stream available or auction not active');
          if (streamCheckIntervalRef.current) {
            clearInterval(streamCheckIntervalRef.current);
            streamCheckIntervalRef.current = null;
          }
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      auctionSocket.off('new_bid', handleNewBid);
      auctionSocket.off('auction_status_changed', handleAuctionStatusChanged);
      auctionSocket.off('auction_extended', handleAuctionExtended);
      auctionSocket.off('watch_count_updated', handleWatchCountUpdate);
      auctionSocket.off('view_count_updated', handleViewCountUpdate); // Fixed event name
      auctionSocket.off('stream_url_updated', handleStreamUrlUpdate);
      auctionSocket.off('broadcast_started', handleBroadcastStarted);
      auctionSocket.leaveAuction(auctionId);
      auctionSocket.disconnect('details-screen');
      if (streamCheckIntervalRef.current) {
        clearInterval(streamCheckIntervalRef.current);
        streamCheckIntervalRef.current = null;
      }
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadAuctionData();
  };

  const handleActionButton = () => {
    const buttonState = getActionButtonState();
    
    if (!buttonState.enabled) {
      console.log('Button is disabled, state:', buttonState);
      return;
    }

    console.log('Action button pressed:', buttonState.action, 'auctionId:', auctionId);

    try {
      if (buttonState.action === 'start_live') {
        // Navigate to broadcast screen
        console.log('Navigating to AuctionLiveBroadcast with auctionId:', auctionId);
        (navigation as any).navigate('AuctionLiveBroadcast', { auctionId });
      } else if (buttonState.action === 'join_live') {
        // Navigate to viewer screen
        console.log('Navigating to AuctionLiveViewer with auctionId:', auctionId);
        (navigation as any).navigate('AuctionLiveViewer', { auctionId });
      } else if (buttonState.action === 'manage_broadcast') {
        // Navigate to broadcast screen (already broadcasting)
        console.log('Navigating to AuctionLiveBroadcast (manage) with auctionId:', auctionId);
        (navigation as any).navigate('AuctionLiveBroadcast', { auctionId });
      }
    } catch (error) {
      console.error('Error navigating to broadcast screen:', error);
      Alert.alert('Navigation Error', 'Failed to navigate to broadcast screen. Please try again.');
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

      if (result.watched) {
        Alert.alert('Added to Watchlist', 'This lot has been added to your watchlist.');
      } else {
        Alert.alert('Removed from Watchlist', 'This lot has been removed from your watchlist.');
      }

      try {
        const updatedAuction = await auctionsAPI.getAuction(auctionId);
        setAuction(updatedAuction);
      } catch (reloadError) {
        console.error('Error reloading auction data:', reloadError);
      }

    } catch (error: any) {
      console.error('Watchlist toggle error:', error);
      let errorMessage = 'Failed to update watchlist. Please try again.';
      
      if (error?.response?.data) {
        if (Array.isArray(error.response.data.message)) {
          errorMessage = error.response.data.message.join(', ');
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Helper function to get all media items (images + video) from main auction and additional items
  const getAllMediaItems = () => {
    if (!auction) return [];
    
    const items: Array<{ type: 'image' | 'video'; uri: string; title?: string; price?: string }> = [];
    
    // For active live auctions with a current item, prioritize current item media
    if (auction.time_status === 'active' && auction.auction_type === 'live' && currentItem) {
      // Add current item images first
      if (currentItem.images && currentItem.images.length > 0) {
        currentItem.images.forEach(imageUri => {
          items.push({ 
            type: 'image', 
            uri: imageUri, 
            title: currentItem.title,
            price: `Current Bid: ₣${auction.current_bid}`
          });
        });
      }
      
      // Add current item video if exists
      if (currentItem.video_url) {
        items.push({ 
          type: 'video', 
          uri: currentItem.video_url, 
          title: currentItem.title,
          price: `Current Bid: ₣${auction.current_bid}`
        });
      }
    } else {
      // For non-active auctions or auctions without current item, show main auction media
      // Add main auction images first
      if (auction.images && auction.images.length > 0) {
        auction.images.forEach(imageUri => {
          items.push({ type: 'image', uri: imageUri, title: auction.title, price: `Starting: ₣${auction.starting_price}` });
        });
      }
      
      // Add main auction video if exists
      if (auction.video_url) {
        items.push({ type: 'video', uri: auction.video_url, title: auction.title, price: `Starting: ₣${auction.starting_price}` });
      }
      
      // Add additional items' images
      auctionItems.forEach(item => {
        if (item.images && item.images.length > 0) {
          item.images.forEach(imageUri => {
            items.push({ 
              type: 'image', 
              uri: imageUri, 
              title: item.title,
              price: `Starting: ₣${item.starting_price}`
            });
          });
        }
      });
      
      // Add additional items' videos
      auctionItems.forEach(item => {
        if (item.video_url) {
          items.push({ 
            type: 'video', 
            uri: item.video_url, 
            title: item.title,
            price: `Starting: ₣${item.starting_price}`
          });
        }
      });
    }
    
    // Fallback to thumbnail if no images
    if (items.length === 0 && auction.thumbnail_url) {
      items.push({ type: 'image', uri: auction.thumbnail_url, title: auction.title, price: `Starting: ₣${auction.starting_price}` });
    }
    
    return items;
  };

  const renderBidHistoryItem = ({ item }: { item: PublicBidHistoryItem }) => {
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
        <Text style={styles.loadingText}>Loading live auction...</Text>
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

  const buttonState = getActionButtonState();

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
              console.log('🔍 Debug - Live main image pressed');
              console.log('🔍 Debug - Auction images:', auction.images);
              console.log('🔍 Debug - Selected index:', selectedImageIndex);
              console.log('🔍 Debug - Thumbnail URL:', auction.thumbnail_url);
              
              const mediaItems = getAllMediaItems();
              console.log('🔍 Debug - Media items:', mediaItems);
              
              let currentIndex = 0;
              if (mediaItems.length > 0 && selectedImageIndex < mediaItems.length) {
                currentIndex = selectedImageIndex;
              }
              console.log('🔍 Debug - Calculated index:', currentIndex);
              setViewerImageIndex(currentIndex);
              setImageViewerVisible(true);
            }}
          >
            {/* Main Image/Video Display */}
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

          {/* Media Navigation */}
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
                timeRemaining !== null && timeRemaining < 3600 && styles.timeUrgent,
                auction.time_status === 'upcoming' && styles.timeUpcoming
              ]}>
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

          {/* Auction Items - Show all items available in this live auction */}
          {auctionItems.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.sectionTitle}>Available Items ({auctionItems.length + 1})</Text>
              <Text style={styles.sectionSubtitle}>
                All items that will be available during this live auction
              </Text>
              
              {/* Primary Auction Item */}
              <View style={styles.auctionItemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{auction.title}</Text>
                    <Text style={styles.itemLotNumber}>Primary Item</Text>
                  </View>
                  <View style={styles.itemPricing}>
                    <Text style={styles.itemPrice}>{auctionsAPI.formatPrice(auction.starting_price)}</Text>
                    {auction.reserve_price && (
                      <Text style={styles.itemReserve}>Reserve: {auctionsAPI.formatPrice(auction.reserve_price)}</Text>
                    )}
                  </View>
                </View>
                
                {/* Primary Item Images Preview */}
                {(auction.images && auction.images.length > 0) && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemImagesPreview}>
                    {auction.images.slice(0, 3).map((imageUri, index) => (
                      <Image key={`primary-${index}`} source={{ uri: imageUri }} style={styles.itemThumbnail} />
                    ))}
                    {auction.images.length > 3 && (
                      <View style={styles.moreImagesIndicator}>
                        <Text style={styles.moreImagesText}>+{auction.images.length - 3}</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Additional Items */}
              {auctionItems.map((item) => (
                <View key={item.id} style={styles.auctionItemCard}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemLotNumber}>{item.lot_number || `LOT-${item.id.slice(-4)}`}</Text>
                    </View>
                    <View style={styles.itemPricing}>
                      <Text style={styles.itemPrice}>{auctionsAPI.formatPrice(item.starting_price)}</Text>
                      {item.reserve_price && (
                        <Text style={styles.itemReserve}>Reserve: {auctionsAPI.formatPrice(item.reserve_price)}</Text>
                      )}
                    </View>
                  </View>
                  
                  {/* Additional Item Images Preview */}
                  {item.images && item.images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemImagesPreview}>
                      {item.images.slice(0, 3).map((imageUri, index) => (
                        <Image key={`${item.id}-${index}`} source={{ uri: imageUri }} style={styles.itemThumbnail} />
                      ))}
                      {item.images.length > 3 && (
                        <View style={styles.moreImagesIndicator}>
                          <Text style={styles.moreImagesText}>+{item.images.length - 3}</Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              ))}
            </View>
          )}

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
                  <AdaptiveText style={styles.sellerName} baseFontSize={16} maxChars={18} numberOfLines={1}>{auction.seller.username}</AdaptiveText>
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

      {/* Action Button */}
      {user && (
        <View
          style={[
            styles.bidButtonContainer,
            { paddingBottom: (insets.bottom || 0) + 20 },
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
              {/* Active auction - Live auction action button */}
              {(auction.time_status === 'active' || (auction.time_status === 'upcoming' && (!timeRemaining || timeRemaining <= 0))) && (
            <View style={styles.liveActionContainer}>
              <TouchableOpacity
                style={[
                  styles.liveActionButton,
                  !buttonState.enabled && styles.liveActionButtonDisabled,
                  buttonState.action === 'start_live' && styles.startLiveButton,
                  buttonState.action === 'join_live' && styles.joinLiveButton,
                ]}
                onPress={handleActionButton}
                disabled={!buttonState.enabled}
              >
                {buttonState.action === 'join_live' && <View style={styles.liveDot} />}
                <Text style={styles.liveActionButtonText}>{buttonState.text}</Text>
                {buttonState.action === 'start_live' && (
                  <Ionicons name="videocam" size={20} color="white" />
                )}
                {buttonState.action === 'join_live' && (
                  <Ionicons name="play-circle" size={20} color="white" />
                )}
              </TouchableOpacity>

              {buttonState.showSubtext && (
                <Text style={styles.liveActionSubtext}>
                  Live is about to start
                </Text>
              )}
            </View>
          )}

              {/* Ended auction - Winner checkout/order status */}
          {/* Show checkout button if user has won items and auction has ended */}
          {auction.time_status === 'ended' && userWonItems.length > 0 && (
            <>
              {loadingWins ? (
                <View style={[styles.liveActionButton, styles.checkoutButton]}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.liveActionButtonText}>Loading your wins...</Text>
                </View>
              ) : checkingOrder ? (
                <View style={[styles.liveActionButton, styles.checkoutButton]}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.liveActionButtonText}>Checking order status...</Text>
                </View>
              ) : !auctionOrder ? (
                // No order yet - show checkout button with user's won items
                <TouchableOpacity
                  style={[styles.liveActionButton, styles.checkoutButton]}
                  onPress={() => {
                    console.log(`🛒 Navigating to checkout with ${userWonItems.length} won item(s)`);
                    navigation.navigate('LiveAuctionCartCheckout', {
                      wonItems: userWonItems,
                    });
                  }}
                >
                  <Text style={styles.liveActionButtonText}>
                    🎉 Proceed to Checkout ({userWonItems.length} item{userWonItems.length > 1 ? 's' : ''})
                  </Text>
                  <Ionicons name="card" size={20} color="white" />
                </TouchableOpacity>
              ) : ['pending', 'confirmed'].includes(auctionOrder.status) ? (
                // Order created but payment pending
                <View style={[styles.liveActionButton, styles.pendingOrderButton]}>
                  <Ionicons name="time-outline" size={20} color="white" />
                  <Text style={styles.liveActionButtonText}>
                    Payment Pending - Order #{auctionOrder.orderNumber}
                  </Text>
                </View>
              ) : ['processing', 'shipped', 'out_for_delivery', 'delivered'].includes(auctionOrder.status) ? (
                // Order paid and processing - show congratulations
                <View style={[styles.liveActionButton, styles.congratulationsButton]}>
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
                <View style={[styles.liveActionButton, styles.endedButton]}>
                  <Ionicons name="close-circle" size={20} color="#888" />
                  <Text style={styles.endedButtonText}>Order Cancelled</Text>
                </View>
              ) : null}
            </>
          )}
          
          {/* Legacy: Single-item auction winner check (for backwards compatibility) */}
          {auction.time_status === 'ended' && auction.status === 'sold' && auction.winner_id === user.id && userWonItems.length === 0 && (
            <>
              {checkingOrder ? (
                <View style={[styles.liveActionButton, styles.checkoutButton]}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.liveActionButtonText}>Checking order status...</Text>
                </View>
              ) : !auctionOrder ? (
                // No order yet - show checkout button
                <TouchableOpacity
                  style={[styles.liveActionButton, styles.checkoutButton]}
                  onPress={() => navigation.navigate('Checkout', {
                    source: 'auction',
                    auctionCheckout: { auctionId: auction.id }
                  })}
                >
                  <Text style={styles.liveActionButtonText}>🎉 Proceed to Checkout</Text>
                  <Ionicons name="card" size={20} color="white" />
                </TouchableOpacity>
              ) : ['pending', 'confirmed'].includes(auctionOrder.status) ? (
                // Order created but payment pending
                <View style={[styles.liveActionButton, styles.pendingOrderButton]}>
                  <Ionicons name="time-outline" size={20} color="white" />
                  <Text style={styles.liveActionButtonText}>
                    Payment Pending - Order #{auctionOrder.orderNumber}
                  </Text>
                </View>
              ) : ['processing', 'shipped', 'out_for_delivery', 'delivered'].includes(auctionOrder.status) ? (
                // Order paid and processing - show congratulations
                <View style={[styles.liveActionButton, styles.congratulationsButton]}>
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
                <View style={[styles.liveActionButton, styles.endedButton]}>
                  <Ionicons name="close-circle" size={20} color="#888" />
                  <Text style={styles.endedButtonText}>Order Cancelled</Text>
                </View>
              ) : null}
            </>
          )}

          {/* Auction ended but not sold - Winner message (if they were the only bidder) */}
          {auction.time_status === 'ended' && auction.status === 'ended' && auction.winner_id === user.id && auction.current_bid > 0 && (
            <View style={[styles.liveActionButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>
                {auction.reserve_price && auction.current_bid < auction.reserve_price
                  ? `Auction ended. Reserve price not met (reserve: ${auctionsAPI.formatPrice(auction.reserve_price)}).`
                  : 'Auction ended but was not sold.'}
              </Text>
              <Ionicons name="information-circle" size={20} color="#888" />
            </View>
          )}

          {/* Auction ended but not sold - Lost bidder message */}
          {auction.time_status === 'ended' && auction.status === 'ended' && auction.winner_id && auction.winner_id !== user.id && (
            <View style={[styles.liveActionButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>
                Auction ended but was not sold.
              </Text>
              <Ionicons name="information-circle" size={20} color="#888" />
            </View>
          )}

          {/* Auction ended with no bids */}
          {auction.time_status === 'ended' && auction.status === 'ended' && !auction.winner_id && (
            <View style={[styles.liveActionButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>Auction ended with no bids.</Text>
              <Ionicons name="close-circle" size={20} color="#888" />
            </View>
          )}

          {/* Auction ended - Sold (non-winner message) */}
          {auction.time_status === 'ended' && auction.status === 'sold' && auction.winner_id && auction.winner_id !== user.id && (
            <View style={[styles.liveActionButton, styles.endedButton]}>
              <Text style={styles.endedButtonText}>Auction Ended</Text>
              <Ionicons name="close-circle" size={20} color="#888" />
            </View>
          )}
            </>
          )}
        </View>
      )}

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
          <TouchableOpacity
            style={[styles.imageViewerCloseButton, { top: (insets.top || 50) + 10 }]}
            onPress={() => {
              setIsVideoPlaying(false);
              setImageViewerVisible(false);
            }}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

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
                
                {/* Item Title and Price Overlay */}
                {(item.title || item.price) && (
                  <View style={styles.imageViewerItemInfo}>
                    {item.title && (
                      <Text style={styles.imageViewerItemTitle}>{item.title}</Text>
                    )}
                    {item.price && (
                      <Text style={styles.imageViewerItemPrice}>{item.price}</Text>
                    )}
                  </View>
                )}
              </View>
            )}
          />

          {getAllMediaItems().length > 1 && (
            <View style={[styles.imageViewerControls, { paddingBottom: (insets.bottom || 20) + 20 }]}>
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

              <View style={styles.imageViewerCounter}>
                <Text style={styles.imageViewerCounterText}>
                  {viewerImageIndex + 1} / {getAllMediaItems().length}
                </Text>
              </View>

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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  mainImageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
  },
  mainImage: {
    width: '100%',
    height: 300,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
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
  bidHistorySection: {
    marginBottom: 24,
  },
  bidHistoryList: {
    marginTop: 8,
  },
  bidHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
  },
  bidHistoryLeft: {
    flex: 1,
  },
  bidderName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bidTime: {
    color: '#888',
    fontSize: 12,
  },
  bidHistoryRight: {
    alignItems: 'flex-end',
  },
  bidAmount: {
    color: '#3498DB',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  winningBid: {
    color: '#27AE60',
  },
  winningBadge: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  winningText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  noBidsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  bidButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  liveActionContainer: {
    alignItems: 'center',
  },
  liveActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  startLiveButton: {
    backgroundColor: '#8E44AD',
  },
  joinLiveButton: {
    backgroundColor: '#E74C3C',
  },
  liveActionButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.6,
  },
  liveActionButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveActionSubtext: {
    color: '#F39C12',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
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
  endedNotice: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(136, 136, 136, 0.1)',
    borderRadius: 12,
  },
  endedText: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  checkoutButton: {
    backgroundColor: '#27AE60', // Green for winner
  },
  pendingOrderButton: {
    backgroundColor: '#FF9500', // Orange for pending
    opacity: 0.9,
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
  // New styles for enhanced image viewer
  imageViewerItemInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
    paddingBottom: 32,
  },
  imageViewerItemTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  imageViewerItemPrice: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: '600',
  },
  // New styles for auction items section
  itemsSection: {
    marginBottom: 24,
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  auctionItemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemLotNumber: {
    color: '#888',
    fontSize: 12,
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemReserve: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  itemImagesPreview: {
    marginTop: 8,
  },
  itemThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  moreImagesIndicator: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  moreImagesText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default LiveAuctionDetailsScreen;
