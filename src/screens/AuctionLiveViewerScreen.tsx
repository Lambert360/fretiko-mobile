import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PanGestureHandler, PanGestureHandlerGestureEvent, PanGestureHandlerStateChangeEvent, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useAuctionSounds } from '../services/auctionSoundService';
import GiftAnimation from '../components/GiftAnimation';
import { auctionsAPI, auctionSocket, AuctionWithDetails, AuctionItem } from '../services/auctionsAPI';

// Import Agora RTC SDK for low-latency live streaming
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, IRtcEngine, RtcSurfaceView, RenderModeType } from 'react-native-agora';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Comment {
  id: string;
  user: { username: string; avatar_url?: string };
  message: string;
  created_at: string;
}

interface WonAuctionItem {
  auctionId: string;
  title: string;
  winningBid: number;
  wonAt: string; // Always set, never null (fallback to current date if missing)
  thumbnail_url?: string;
  images?: string[];
}

/**
 * Mini Auction Cart Modal Component
 * Displays won auction items during live auction
 * Supports drag-to-dismiss gesture
 */
const MiniAuctionCartModal = ({
  visible,
  onClose,
  wonItems,
  onRemoveItem,
  onCheckout,
}: {
  visible: boolean;
  onClose: () => void;
  wonItems: WonAuctionItem[];
  onRemoveItem: (auctionId: string) => void;
  onCheckout: () => void;
}) => {
  const total = wonItems.reduce((sum, item) => sum + item.winningBid, 0);
  const panRef = useRef<any>(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const baseHeight = useRef(screenHeight * 0.75).current;

  // Reset animation when modal becomes visible
  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationY: ty } = event.nativeEvent;
    // Only allow downward drag (positive translationY)
    if (ty > 0) {
      translateY.setValue(ty);
    }
  };

  const onPanHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY: ty, velocityY } = event.nativeEvent;
      const dismissThreshold = screenHeight * 0.3; // 30% of screen height
      const velocityThreshold = 500; // Minimum velocity for quick dismiss

      // Dismiss if dragged down more than threshold or with sufficient velocity
      if (ty > dismissThreshold || velocityY > velocityThreshold) {
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          translateY.setValue(0);
          onClose();
        });
      } else {
        // Snap back to original position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 300,
          friction: 30,
        }).start();
      }
    }
  };

  if (!visible) return null;

  return (
    <View style={modalStyles.overlay}>
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        activeOffsetY={10}
        failOffsetX={[-50, 50]}
      >
        <Animated.View
          style={[
            modalStyles.container,
            {
              transform: [{ translateY }],
            },
          ]}
        >
        {/* Drag Handle Indicator */}
        <View style={modalStyles.dragHandleContainer}>
          <View style={modalStyles.dragHandle} />
        </View>
        
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>🏆 Won Items</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {wonItems.length === 0 ? (
          <View style={modalStyles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color="#666" />
            <Text style={modalStyles.emptyText}>No wins yet</Text>
            <Text style={modalStyles.emptySubtext}>Keep bidding!</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={wonItems}
              keyExtractor={(item) => item.auctionId}
              renderItem={({ item }) => (
                <View style={modalStyles.cartItem}>
                  <Image
                    source={{ uri: item.thumbnail_url || item.images?.[0] || 'https://via.placeholder.com/60' }}
                    style={modalStyles.cartItemImage}
                  />
                  <View style={modalStyles.cartItemInfo}>
                    <Text style={modalStyles.cartItemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={modalStyles.cartItemPrice}>
                      Winning Bid: ₣{item.winningBid.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={modalStyles.removeButton}
                    onPress={() => onRemoveItem(item.auctionId)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4757" />
                  </TouchableOpacity>
                </View>
              )}
              style={modalStyles.list}
              showsVerticalScrollIndicator={false}
            />

            <View style={modalStyles.footer}>
              <View style={modalStyles.totalRow}>
                <Text style={modalStyles.totalLabel}>Total</Text>
                <Text style={modalStyles.totalValue}>₣{total.toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={modalStyles.checkoutButton}
                onPress={onCheckout}
              >
                <Text style={modalStyles.checkoutButtonText}>Checkout All Items</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </>
        )}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

/**
 * Auction Live Viewer Screen
 * 
 * For viewers to watch live auction stream and place bids simultaneously
 * - HLS video playback (Expo Go compatible)
 * - Real-time bidding interface
 * - WebSocket bid updates
 * - Live comments
 */
const AuctionLiveViewerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { auctionId } = route.params;

  // Sound effects
  const { playCheer, playClap, playLaugh } = useAuctionSounds();

  // State
  const [auction, setAuction] = useState<AuctionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [placingBid, setPlacingBid] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Auction Cart State - stores won items during live auction
  const [wonItems, setWonItems] = useState<Array<{
    id?: string; // Win ID from database
    auctionId: string;
    itemId?: string | null; // For multi-item auctions
    title: string;
    winningBid: number;
    wonAt: string;
    thumbnail_url?: string;
    images?: string[];
  }>>([]);

  // Winner announcement modal state
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerData, setWinnerData] = useState<{
    winner_display_id: string;
    winning_bid: number;
    item_title: string;
    user_participated: boolean;
    is_winner: boolean;
  } | null>(null);
  const [userParticipated, setUserParticipated] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showBidDashboard, setShowBidDashboard] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  // Multi-item auction state
  const [currentItem, setCurrentItem] = useState<AuctionItem | null>(null);
  const [itemBiddingStatus, setItemBiddingStatus] = useState<'waiting' | 'countdown' | 'active' | 'ended' | 'sold' | 'passed'>('waiting');
  const [canBid, setCanBid] = useState(false);
  const [hasBids, setHasBids] = useState(false); // Track if any bids placed during current item

  // Bid notification state
  const [bidNotifications, setBidNotifications] = useState<Array<{
    id: string;
    bidder_display_id: string;
    amount: number;
    translateY: Animated.Value;
    opacity: Animated.Value;
  }>>([]);

  // Reaction animations state
  const [reactionAnimations, setReactionAnimations] = useState<Array<{
    id: string;
    reaction_type: string;
    translateX: Animated.Value;
    translateY: Animated.Value;
    scale: Animated.Value;
    opacity: Animated.Value;
  }>>([]);

  // Reactions state
  const [reactions, setReactions] = useState<Array<{ id: string; reaction_type: string; user_id: string; timestamp: string }>>([]);

  // Image viewer modal state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  // Agora RTC state - Direct streaming for low latency
  const [agoraConfig, setAgoraConfig] = useState<any>(null);
  const [agoraEngine, setAgoraEngine] = useState<IRtcEngine | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isAgoraJoined, setIsAgoraJoined] = useState(false);
  const [isAgoraInitialized, setIsAgoraInitialized] = useState(false);
  const agoraEngineRef = useRef<IRtcEngine | null>(null);

  // Bid Notification Bubble Component
  const BidNotificationBubble: React.FC<{
    notification: {
      id: string;
      bidder_display_id: string;
      amount: number;
      translateY: Animated.Value;
      opacity: Animated.Value;
    };
  }> = ({ notification }) => (
    <Animated.View style={[
      styles.bidNotificationBubble,
      {
        transform: [{ translateY: notification.translateY }],
        opacity: notification.opacity,
      }
    ]}>
      <Text style={styles.bidNotificationText}>
        {notification.bidder_display_id} bids for ₣{notification.amount}
      </Text>
    </Animated.View>
  );

  // Load existing wins from database
  const loadUserWins = async () => {
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
          wonAt: win.won_at || new Date().toISOString(), // Ensure wonAt is never null
          thumbnail_url: win.item?.images?.[0] || win.auction?.thumbnail_url || win.auction?.images?.[0],
          images: win.item?.images || win.auction?.images || [],
        }));
      
      setWonItems(auctionWins);
    } catch (error) {
      console.error('Error loading user wins:', error);
      // Don't block the UI if loading wins fails
    }
  };

  // Load auction data
  const loadAuctionData = async () => {
    try {
      const auctionData = await auctionsAPI.getAuction(auctionId);
      setAuction(auctionData);
      setTimeRemaining(auctionData.seconds_remaining || 0);

      // Load current auction item (if multi-item auction)
      const currentItemData = await auctionsAPI.getCurrentItem(auctionId);
      if (currentItemData) {
        setCurrentItem(currentItemData);
        setItemBiddingStatus(currentItemData.bidding_status);
        setCanBid(currentItemData.bidding_status === 'active');
        
        if (currentItemData.bidding_status === 'active' && currentItemData.bidding_started_at) {
          const started = new Date(currentItemData.bidding_started_at).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - started) / 1000);
          const remaining = Math.max(0, currentItemData.bidding_duration - elapsed);
          // Time left calculation removed - no longer displayed to viewers
        }

        // Set initial bid amount from current item
        const nextBid = (currentItemData.current_bid || currentItemData.starting_price) + currentItemData.bid_increment;
        setBidAmount(nextBid.toString());
      } else {
        // Single-item auction - use auction data
        const nextBid = auctionData.current_bid + auctionData.bid_increment;
        setBidAmount(nextBid.toString());
      }

      // Load existing wins from database
      await loadUserWins();

      // Load Agora config for live auctions (RTC streaming)
      if (auctionData.auction_type === 'live' && auctionData.status === 'active') {
        console.log('🎯 Live auction is active, loading Agora config...');
        await loadAgoraConfig();
      }
    } catch (error) {
      console.error('Error loading auction:', error);
      Alert.alert('Error', 'Failed to load auction');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Load Agora configuration for RTC streaming
  const loadAgoraConfig = async () => {
    try {
      console.log('🎯 Loading Agora token for RTC viewer...', { auctionId });
      const token = await auctionsAPI.generateAgoraToken(auctionId, 'audience');
      console.log('✅ Agora token received:', {
        appId: token.appId,
        channel: token.channel,
        uid: token.uid,
        hasToken: !!token.token
      });
      setAgoraConfig(token);
      console.log('📝 Agora config state updated');
    } catch (error) {
      console.error('Error loading Agora config:', error);
      // Don't block the UI - auction can still work with bidding even if video fails
    }
  };

  // Initialize Agora RTC Engine (LIVE auctions only)
  const initializeAgoraEngine = async () => {
    console.log('🎬 initializeAgoraEngine called:', {
      isAgoraInitialized,
      hasEngine: !!agoraEngineRef.current,
      hasConfig: !!agoraConfig,
      auctionType: auction?.auction_type,
      auctionStatus: auction?.status
    });

    if (isAgoraInitialized || agoraEngineRef.current) {
      console.log('🔄 Agora already initialized');
      return;
    }

    if (!agoraConfig) {
      console.log('⏳ Waiting for Agora config...');
      return;
    }

    try {
      console.log('🎥 Initializing Agora Engine for VIEWER...');
      console.log('📋 Agora config:', {
        appId: agoraConfig.appId,
        channel: agoraConfig.channel,
        uid: agoraConfig.uid
      });
      
      const engine = createAgoraRtcEngine();
      agoraEngineRef.current = engine;
      setAgoraEngine(engine);
      setIsAgoraInitialized(true);
      console.log('✅ Agora Engine created');

      // Initialize engine
      engine.initialize({
        appId: agoraConfig.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting
      });
      console.log('✅ Agora Engine initialized');

      // Set client role to Audience (viewer)
      await engine.setClientRole(ClientRoleType.ClientRoleAudience);
      console.log('✅ Client role set to Audience (viewer)');

      // Enable video and audio
      await engine.enableVideo();
      await engine.enableAudio();
      console.log('✅ Video and audio enabled');

      // Setup event listeners
      engine.addListener('onJoinChannelSuccess', (connection: any, elapsed: number) => {
        console.log('🎉 Viewer joined Agora channel successfully!', {
          channelId: connection.channelId,
          localUid: connection.localUid,
          elapsed
        });
        setIsAgoraJoined(true);
        console.log('✅ isAgoraJoined state set to true');
      });

      engine.addListener('onUserJoined', (connection: any, uid: number, elapsed: number) => {
        console.log('👤 🎉 Remote user joined (HOST DETECTED)!', {
          channelId: connection.channelId,
          uid,
          elapsed
        });
        setRemoteUid(uid);
        console.log('✅ remoteUid state set to:', uid);
      });

      engine.addListener('onUserOffline', (connection: any, uid: number, reason: number) => {
        console.log('👋 Remote user left (host):', { uid, reason });
        setRemoteUid((prevUid) => {
          if (prevUid === uid) {
            console.log('🔇 Host disconnected, clearing remote UID');
            return null;
          }
          return prevUid;
        });
      });

      engine.addListener('onConnectionStateChanged', (connection: any, state: number, reason: number) => {
        console.log('🔌 Agora connection state changed:', {
          channelId: connection.channelId,
          state,
          reason
        });
      });

      engine.addListener('onError', (err: number, msg: string) => {
        console.error('💥 Agora error:', { err, msg });
      });

      // Join the channel as audience (viewer)
      console.log('🎯 Attempting to join Agora channel...', {
        channel: agoraConfig.channel,
        uid: agoraConfig.uid,
        role: 'ClientRoleAudience'
      });
      
      const joinResult = await engine.joinChannel(
        agoraConfig.token,
        agoraConfig.channel,
        agoraConfig.uid,
        {
          clientRoleType: ClientRoleType.ClientRoleAudience,
        }
      );
      
      console.log('✅ joinChannel called, result:', joinResult);
      console.log('⏳ Waiting for onJoinChannelSuccess event...');

    } catch (error: any) {
      console.error('❌ Failed to initialize Agora Engine:', error);
      setIsAgoraInitialized(false);
      setAgoraEngine(null);
      agoraEngineRef.current = null;
      // Don't alert user - they can still bid even if video fails
    }
  };

  // Cleanup Agora engine
  const cleanupAgora = () => {
    console.log('🧹 Cleaning up Agora...');
    const engine = agoraEngine || agoraEngineRef.current;
    if (engine) {
      try {
        engine.removeAllListeners();
        engine.leaveChannel();
        engine.release();
        console.log('✅ Agora cleaned up');
      } catch (error) {
        console.warn('⚠️ Agora cleanup warning:', error);
      } finally {
        setAgoraEngine(null);
        agoraEngineRef.current = null;
        setIsAgoraJoined(false);
        setIsAgoraInitialized(false);
        setRemoteUid(null);
      }
    }
  };

  // Reload wins when screen comes into focus (e.g., after checkout)
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Screen focused - reloading user wins to clear checked out items');
      loadUserWins();
    }, [auctionId])
  );

  // Load auction data on mount
  useEffect(() => {
    loadAuctionData();
  }, []);

  // ✅ CRITICAL FIX: Initialize Agora when config is ready (NO cleanup here!)
  useEffect(() => {
    if (agoraConfig && auction?.auction_type === 'live' && !isAgoraInitialized) {
      console.log('🚀 Triggering Agora initialization from useEffect...');
      initializeAgoraEngine();
    }
    // ⚠️ NO cleanup here! Cleanup happens on component unmount only
  }, [agoraConfig, auction?.auction_type, isAgoraInitialized]);

  // ✅ CRITICAL FIX: Cleanup Agora ONLY on component unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up Agora...');
      cleanupAgora();
    };
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    auctionSocket.connect();
    auctionSocket.joinAuction(auctionId, user?.id);
    
    // Reset participation when joining auction
    setUserParticipated(false);
    
    // Reset modal state when joining auction
    setShowWinnerModal(false);
    setWinnerData(null);

    // Handle real-time bid updates
    const handleNewBid = (data: any) => {
      if (data.auction_id === auctionId) {
        // Update auction bid (for single-item auctions)
        setAuction(prev => prev ? {
          ...prev,
          current_bid: data.amount,
          total_bids: (prev.total_bids || 0) + 1
        } : null);

        // Update current item bid (for multi-item auctions)
        if (currentItem && itemBiddingStatus === 'active') {
          setCurrentItem(prev => prev ? {
            ...prev,
            current_bid: data.amount,
          } : null);
          
          // Update bid amount input
          const nextBid = data.amount + (currentItem?.bid_increment || 1);
          setBidAmount(nextBid.toString());
          
          // Mark that bids have been received - this will stop the countdown timer
          setHasBids(true);
          console.log('💰 Viewer: Bid received - countdown timer stopped');

          // NEW: Add bid notification (same as host)
          const notificationId = Date.now().toString();
          const newNotification = {
            id: notificationId,
            bidder_display_id: data.bidder_display_id || 'Bidder',
            amount: data.amount,
            translateY: new Animated.Value(100), // Start from bottom
            opacity: new Animated.Value(0), // Start transparent
          };
          
          // Clear existing notification (prevent clutter)
          setBidNotifications([]);
          
          // Add new notification
          setBidNotifications(prev => [...prev, newNotification]);
          
          // Animate: slide up (1.2s) → pause (2s) → fade out (0.8s) = ~5s total
          Animated.sequence([
            // Slide up from bottom to center
            Animated.timing(newNotification.translateY, {
              toValue: -200, // Move to center
              duration: 1200,
              useNativeDriver: true,
            }),
            // Pause at center (implicit - no animation for 2s)
            Animated.delay(2000),
            // Fade out with slight upward movement
            Animated.parallel([
              Animated.timing(newNotification.opacity, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(newNotification.translateY, {
                toValue: -250,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
          ]).start(() => {
            // Remove notification after animation
            setBidNotifications(prev => prev.filter(n => n.id !== notificationId));
          });
        }
      }
    };

    // Handle auction item events (multi-item auctions)
    const handleItemEvent = (data: any) => {
      if (data.auction_id === auctionId) {
        switch (data.event_type) {
          case 'item_ready':
            setCurrentItem(data);
            setItemBiddingStatus('waiting');
            setCanBid(false);
            setHasBids(false); // Reset bid tracking for new item
            setUserParticipated(false); // Reset participation tracking for new item
            setBidAmount((data.starting_price + data.bid_increment).toString());
            break;
          
          case 'start_countdown':
            setItemBiddingStatus('countdown');
            setCanBid(false);
            setHasBids(false); // Reset bid tracking when countdown starts
            break;
          
          case 'bidding_open':
            setItemBiddingStatus('active');
            setCanBid(true);
            setHasBids(false); // Reset bid tracking when bidding opens
            setBidAmount((data.minimum_bid || data.starting_price + data.bid_increment).toString());
            break;
          
          case 'bidding_ended':
            setItemBiddingStatus('ended');
            setCanBid(false);
            if (data.winner) {
              // Check if current user won
              if (data.winner.bidder_id === user?.id) {
                const wonItem = {
                  auctionId: auctionId,
                  itemId: data.item_id || null,
                  title: data.item_title || currentItem?.title || 'Auction Item',
                  winningBid: data.final_bid,
                  wonAt: new Date().toISOString(),
                  thumbnail_url: currentItem?.images?.[0],
                  images: currentItem?.images,
                };
                
                // Save win to database (backend handles duplicate prevention)
                try {
                  // Win is automatically saved by backend when markItemSold is called
                  // But we still add it to local state for immediate UI update
                } catch (error) {
                  console.error('Error saving auction win:', error);
                }
                
                setWonItems(prev => {
                  // Check if item already exists (by auctionId + itemId combination)
                  const exists = prev.find(item => 
                    item.auctionId === auctionId && 
                    (item.itemId === wonItem.itemId || (!item.itemId && !wonItem.itemId))
                  );
                  if (exists) {
                    return prev;
                  }
                  return [...prev, wonItem];
                });
                
                // Show winner notification with modal for multi-item auction
                try {
                  setWinnerData({
                    winner_display_id: user?.username || 'You',
                    winning_bid: data.final_bid || 0,
                    item_title: wonItem.title || 'Auction Item',
                    user_participated: userParticipated,
                    is_winner: true,
                  });
                  setShowWinnerModal(true);
                } catch (error) {
                  console.error('Error setting winner data:', error);
                }
              }
            }
            break;
          
          case 'item_sold':
            setItemBiddingStatus('sold');
            setCanBid(false);
            break;
        }
      }
    };

    const handleAuctionStatusChanged = (data: any) => {
      if (data.auction_id === auctionId) {
        loadAuctionData();
        if (data.new_status === 'sold' || data.new_status === 'ended') {
          // Check if user won this auction
          if (data.winner_id === user?.id && data.new_status === 'sold' && auction) {
            // Add won item to cart
            const wonItem = {
              auctionId: auction.id,
              title: auction.title,
              winningBid: data.winning_bid || auction.current_bid,
              wonAt: new Date().toISOString(),
              thumbnail_url: auction.thumbnail_url,
              images: auction.images,
            };
            
            setWonItems(prev => {
              // Check if already in cart (prevent duplicates)
              if (prev.find(item => item.auctionId === auction.id)) {
                return prev;
              }
              return [...prev, wonItem];
            });
            
            // Show win notification with modal
            try {
              setWinnerData({
                winner_display_id: user?.username || 'You',
                winning_bid: data.winning_bid || auction?.current_bid || 0,
                item_title: auction?.title || 'Auction Item',
                user_participated: userParticipated,
                is_winner: true,
              });
              setShowWinnerModal(true);
            } catch (error) {
              console.error('Error setting winner data:', error);
            }
          } else if (data.new_status === 'ended' && data.winner_id !== user?.id) {
            // User didn't win - show enhanced winner announcement modal
            try {
              setWinnerData({
                winner_display_id: data.bidder_display_id || 'Winner',
                winning_bid: data.winning_bid || auction?.current_bid || 0,
                item_title: currentItem?.title || auction?.title || 'Auction Item',
                user_participated: userParticipated,
                is_winner: false,
              });
              setShowWinnerModal(true);
            } catch (error) {
              console.error('Error setting winner data:', error);
            }
          }
        }
      }
    };

    // Handle auction won event (direct win notification)
    const handleAuctionWon = (data: any) => {
      if (data.auction_id && data.winner_id === user?.id && auction) {
        const wonItem = {
          auctionId: data.auction_id || auction.id,
          title: data.title || auction.title,
          winningBid: data.winning_bid || auction.current_bid,
          wonAt: new Date().toISOString(),
          thumbnail_url: auction.thumbnail_url,
          images: auction.images,
        };
        
        setWonItems(prev => {
          if (prev.find(item => item.auctionId === wonItem.auctionId)) {
            return prev;
          }
          return [...prev, wonItem];
        });
        
        Alert.alert(
          '🎉 You Won!',
          `${wonItem.title} for ₣${wonItem.winningBid.toFixed(2)}`,
          [
            { text: 'View Cart', onPress: () => setShowCartModal(true) },
            { text: 'Continue', style: 'cancel' }
          ]
        );
      }
    };

    auctionSocket.on('new_bid', handleNewBid);
    auctionSocket.on('auction_status_changed', handleAuctionStatusChanged);
    auctionSocket.on('auction_won', handleAuctionWon);
    auctionSocket.on('item_event', handleItemEvent);

    // Handle viewer count updates
    const handleViewCountUpdate = (data: any) => {
      if (data.auction_id === auctionId) {
        setViewerCount(data.view_count || data.current_viewers || 0);
      }
    };
    auctionSocket.on('view_count_update', handleViewCountUpdate);

    // Handle reactions
    const handleNewReaction = (reaction: any) => {
      if (reaction.auction_id === auctionId) {
        setReactions((prev: Array<{ id: string; reaction_type: string; user_id: string; timestamp: string }>) => [...prev, { ...reaction, id: Date.now().toString() }]);

        // Play sound effect based on reaction type
        switch (reaction.reaction_type) {
          case 'heart':
            playCheer();
            break;
          case 'applause':
            playClap();
            break;
          case 'thumbs_up':
            playCheer();
            break;
          case 'fire':
            playCheer();
            break;
        }
        
        // Create floating animation
        const reactionId = Date.now() + Math.random().toString();
        const randomX = Math.random() * (screenWidth - 100);
        const newReaction = {
          id: reactionId,
          reaction_type: reaction.reaction_type,
          translateX: new Animated.Value(randomX),
          translateY: new Animated.Value(screenHeight * 0.6),
          scale: new Animated.Value(0),
          opacity: new Animated.Value(1),
        };

        setReactionAnimations(prev => [...prev, newReaction]);

        // Animate reaction
        Animated.parallel([
          Animated.timing(newReaction.scale, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(newReaction.translateY, {
            toValue: (screenHeight * 0.6) - 200,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(newReaction.opacity, {
            toValue: 0,
            duration: 2000,
            delay: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setReactionAnimations(prev => prev.filter(r => r.id !== reactionId));
        });

        // Remove from reactions list after animation
        setTimeout(() => {
          setReactions((prev: Array<{ id: string; reaction_type: string; user_id: string; timestamp: string }>) => prev.filter((r: { id: string; reaction_type: string; user_id: string; timestamp: string }) => r.id !== reactionId));
        }, 3000);
      }
    };

    auctionSocket.on('new_reaction', handleNewReaction);

    return () => {
      auctionSocket.off('new_bid', handleNewBid);
      auctionSocket.off('auction_status_changed', handleAuctionStatusChanged);
      auctionSocket.off('auction_won', handleAuctionWon);
      auctionSocket.off('item_event', handleItemEvent);
      auctionSocket.off('view_count_update', handleViewCountUpdate);
      auctionSocket.off('new_reaction', handleNewReaction);
      auctionSocket.leaveAuction(auctionId);
    };
  }, [auctionId, currentItem, itemBiddingStatus]);

  // General auction countdown timer
  useEffect(() => {
    if (timeRemaining && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => (prev && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  // Handle bid placement
  const handlePlaceBid = async () => {
    if (!user || !auction) return;

    // Check if bidding is allowed
    if (!canBid && currentItem) {
      Alert.alert(
        'Bidding Not Available',
        itemBiddingStatus === 'waiting' 
          ? 'Waiting for auctioneer to start bidding...'
          : itemBiddingStatus === 'countdown'
          ? 'Bidding will start shortly...'
          : 'Bidding for this item has ended'
      );
      return;
    }

    const amount = parseFloat(bidAmount);
    const minimumBid = currentItem 
      ? (currentItem.current_bid || currentItem.starting_price) + currentItem.bid_increment
      : auction.current_bid + auction.bid_increment;

    if (isNaN(amount) || amount < minimumBid) {
      Alert.alert('Invalid Bid', `Minimum bid is ₣${minimumBid.toFixed(2)}`);
      return;
    }

    setPlacingBid(true);

    // Mark user as participated in this auction
    setUserParticipated(true);

    try {
      await auctionsAPI.placeBid({
        auction_id: auctionId,
        amount,
        bid_type: 'manual',
      });

      setBidModalVisible(false);
      Alert.alert('Success', 'Bid placed successfully!');
    } catch (error: any) {
      // Error handling in API service
    } finally {
      setPlacingBid(false);
    }
  };

  // Quick bid
  const handleQuickBid = (increment: number) => {
    if (!auction || !canBid) return;
    
    if (currentItem) {
      const currentBid = currentItem.current_bid || currentItem.starting_price;
      const amount = currentBid + (currentItem.bid_increment * increment);
      setBidAmount(amount.toString());
      setBidModalVisible(true);
    } else {
      const amount = auction.current_bid + (auction.bid_increment * increment);
      setBidAmount(amount.toString());
      setBidModalVisible(true);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Ended';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Send reaction
  const handleSendReaction = (reactionType: 'heart' | 'thumbs_up' | 'applause' | 'fire') => {
    if (!auctionId || !user) return;
    
    // Play sound effect for sender
    switch (reactionType) {
      case 'heart':
        playCheer();
        break;
      case 'applause':
        playClap();
        break;
      case 'thumbs_up':
        playCheer();
        break;
      case 'fire':
        playCheer();
        break;
    }
    
    auctionSocket.sendReaction(auctionId, reactionType);
    
    // Optimistically add reaction animation
    const reactionId = Date.now() + Math.random().toString();
    const randomX = Math.random() * (screenWidth - 100);
    const newReaction = {
      id: reactionId,
      reaction_type: reactionType,
      translateX: new Animated.Value(randomX),
      translateY: new Animated.Value(screenHeight * 0.6),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
    };

    setReactionAnimations(prev => [...prev, newReaction]);

    // Animate reaction
    Animated.parallel([
      Animated.timing(newReaction.scale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(newReaction.translateY, {
        toValue: (screenHeight * 0.6) - 200,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(newReaction.opacity, {
        toValue: 0,
        duration: 2000,
        delay: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setReactionAnimations(prev => prev.filter(r => r.id !== reactionId));
    });
  };

  // Get reaction emoji
  const getReactionEmoji = (reactionType: string): string => {
    switch (reactionType) {
      case 'heart': return '❤️';
      case 'thumbs_up': return '👍';
      case 'applause': return '👏';
      case 'fire': return '🔥';
      default: return '👍';
    }
  };

  if (loading || !auction) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Loading live auction...</Text>
      </View>
    );
  }

  const renderedContent = (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Agora RTC Video (for live auctions) */}
      {auction.auction_type === 'live' && (
        <>
          {isAgoraJoined && remoteUid ? (
            <RtcSurfaceView
              style={styles.video}
              canvas={{
                uid: remoteUid,
                renderMode: RenderModeType.RenderModeFit,
              }}
            />
          ) : (
            <View style={[styles.video, styles.videoPlaceholder]}>
              <ActivityIndicator size="large" color="#8E44AD" />
              <Text style={styles.placeholderText}>
                {!isAgoraJoined ? 'Connecting to auction...' : 'Waiting for host...'}
              </Text>
            </View>
          )}
        </>
      )}

      {/* Overlay UI */}
      <View style={styles.overlay}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>{auction.title}</Text>
            <View style={styles.viewerCountContainer}>
              <Ionicons name="eye" size={16} color="#8E44AD" />
              <Text style={styles.viewerCount}>{viewerCount}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.controlIconButton}
            onPress={() => setShowBidDashboard(true)}
          >
            <Ionicons name="stats-chart" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Reactions Display */}
        <View style={styles.reactionsContainer}>
          {reactionAnimations.map((reaction) => (
            <Animated.View
              key={reaction.id}
              style={[
                styles.reactionAnimation,
                {
                  transform: [
                    { translateX: reaction.translateX },
                    { translateY: reaction.translateY },
                    { scale: reaction.scale },
                  ],
                  opacity: reaction.opacity,
                },
              ]}
            >
              <Text style={styles.reactionEmoji}>
                {getReactionEmoji(reaction.reaction_type)}
              </Text>
            </Animated.View>
          ))}
        </View>

        {/* Auction Info Card */}
        <View style={[styles.auctionInfoCard, { top: (insets.top || 0) + 60 }]}>
          <View style={styles.auctionInfoContent}>
            {/* Item Image/Video Thumbnail */}
            {currentItem && (
              <TouchableOpacity
                style={styles.itemImageContainer}
                onPress={() => {
                  // Prioritize video if available, otherwise show first image
                  if (currentItem.video_url) {
                    setSelectedVideoUrl(currentItem.video_url);
                    setMediaType('video');
                    setImageViewerVisible(true);
                  } else if (currentItem.images && currentItem.images.length > 0) {
                    setSelectedImageUrl(currentItem.images[0]);
                    setMediaType('image');
                    setImageViewerVisible(true);
                  }
                }}
                activeOpacity={0.8}
              >
                {currentItem.video_url ? (
                  <View style={[styles.itemImageThumbnail, styles.videoThumbnailContainer]}>
                    <Ionicons name="play-circle" size={40} color="#FFFFFF" style={styles.videoPlayIcon} />
                    <Text style={styles.videoThumbnailText}>Video</Text>
                  </View>
                ) : currentItem.images && currentItem.images.length > 0 ? (
                  <Image
                    source={{ uri: currentItem.images[0] }}
                    style={styles.itemImageThumbnail}
                    resizeMode="cover"
                  />
                ) : null}
              </TouchableOpacity>
            )}
            
            <View style={styles.auctionInfoText}>
              {currentItem && (
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemNumber}>Item {currentItem.order_in_auction}</Text>
                </View>
              )}
              <Text style={styles.auctionTitle} numberOfLines={1}>
                {currentItem ? currentItem.title : auction.title}
              </Text>
              <View style={styles.bidInfoRow}>
                <Text style={styles.currentBidLabel}>Current bid:</Text>
                <Text style={styles.currentBidAmount}>
                  ₣{(currentItem 
                    ? (currentItem.current_bid || currentItem.starting_price)
                    : auction.current_bid).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.modalInfo}>
                Minimum bid: ₣{(currentItem 
                  ? ((currentItem.current_bid || currentItem.starting_price) + currentItem.bid_increment)
                  : auction.current_bid + auction.bid_increment).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Controls */}
        <View
          style={[
            styles.bottomControls,
            { paddingBottom: Math.max(insets.bottom || 0, 12) + 12 },
          ]}
        >
          <TouchableOpacity
            style={styles.quickBidButton}
            onPress={() => handleQuickBid(1)}
          >
            <Text style={styles.quickBidText}>+1</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bidButton, 
              (!canBid || auction.seller_id === user?.id) && styles.bidButtonDisabled
            ]}
            onPress={() => setBidModalVisible(true)}
            disabled={!canBid || auction.seller_id === user?.id || placingBid}
          >
            <Ionicons name="hammer" size={20} color="white" />
            <Text style={styles.bidButtonText}>
              {auction.seller_id === user?.id 
                ? 'Your Auction' 
                : !canBid && currentItem
                ? itemBiddingStatus === 'waiting' 
                  ? 'Waiting...' 
                  : itemBiddingStatus === 'countdown'
                  ? 'Starting...'
                  : itemBiddingStatus === 'ended'
                  ? 'Bidding Ended'
                  : 'Place Bid'
                : 'Place Bid'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => setShowCartModal(true)}
          >
            <Ionicons name="bag-handle" size={24} color="white" />
            {wonItems.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{wonItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Reaction Buttons */}
        {auction.seller_id !== user?.id && (
          <View style={styles.reactionButtonsContainer}>
            {[
  { emoji: '❤️', type: 'heart' },
  { emoji: '👏', type: 'applause' },
  { emoji: '😮', type: 'thumbs_up' },
  { emoji: '🔥', type: 'fire' }
].map((reaction) => (
  <TouchableOpacity
    key={reaction.type}
    style={styles.reactionButton}
    onPress={() => handleSendReaction(reaction.type as any)}
    activeOpacity={0.7}
  >
    <Text style={styles.reactionButtonEmoji}>{reaction.emoji}</Text>
  </TouchableOpacity>
))}
          </View>
        )}

        {/* Bid Notifications */}
        {bidNotifications.map((notification) => (
          <BidNotificationBubble
            key={notification.id}
            notification={notification}
          />
        ))}

        {/* Live Stream Indicator */}
        {auction.auction_type === 'live' && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

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
              Current bid: ₣{(currentItem 
                ? (currentItem.current_bid || currentItem.starting_price)
                : auction.current_bid).toFixed(2)}
            </Text>
            <Text style={styles.modalInfo}>
              Minimum bid: ₣{(currentItem 
                ? ((currentItem.current_bid || currentItem.starting_price) + currentItem.bid_increment)
                : auction.current_bid + auction.bid_increment).toFixed(2)}
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
                style={[
                  styles.placeBidButton,
                  (!canBid || parseFloat(bidAmount) <= (currentItem 
                    ? ((currentItem.current_bid || currentItem.starting_price) + currentItem.bid_increment)
                    : auction.current_bid + auction.bid_increment)) && styles.disabledButton
                ]}
                onPress={handlePlaceBid}
                disabled={!canBid || parseFloat(bidAmount) <= (currentItem 
                  ? ((currentItem.current_bid || currentItem.starting_price) + currentItem.bid_increment)
                  : auction.current_bid + auction.bid_increment)}
              >
                <Text style={styles.placeBidButtonText}>Place Bid</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mini Auction Cart Modal */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <MiniAuctionCartModal
          visible={showCartModal}
          onClose={() => setShowCartModal(false)}
          wonItems={wonItems}
          onRemoveItem={(auctionId) => {
            setWonItems(prev => prev.filter(item => item.auctionId !== auctionId));
          }}
          onCheckout={() => {
            setShowCartModal(false);
            navigation.navigate('LiveAuctionCartCheckout', {
              wonItems: wonItems,
            });
          }}
        />
      </Modal>
    </View>
  );

  // Media Viewer Modal - Rendered outside main view hierarchy for proper z-index
  return (
    <>
      {renderedContent}
      
      {/* Winner Announcement Modal */}
      {showWinnerModal && winnerData && (
        <Modal
          visible={showWinnerModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowWinnerModal(false)}
        >
          <View style={styles.winnerModalOverlay}>
            <View style={styles.winnerModalContent}>
              {winnerData.is_winner ? (
                <>
                  <Ionicons name="trophy" size={80} color="#FFD700" />
                  <Text style={styles.winnerModalTitle}>🎉 Congratulations!</Text>
                  <Text style={styles.winnerText}>You won "{winnerData.item_title}"</Text>
                  <Text style={styles.winnerBid}>for ₣{winnerData.winning_bid.toFixed(2)}</Text>
                  <View style={styles.winnerModalButtons}>
                    <TouchableOpacity
                      style={styles.winnerModalButtonPrimary}
                      onPress={() => {
                        setShowWinnerModal(false);
                        setShowCartModal(true);
                      }}
                      accessible={true}
                      accessibilityLabel="View Cart"
                      accessibilityHint="View your won items and proceed to checkout"
                    >
                      <Text style={styles.winnerModalButtonText}>View Cart</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.winnerModalButtonSecondary}
                      onPress={() => setShowWinnerModal(false)}
                      accessible={true}
                      accessibilityLabel="Continue Watching"
                      accessibilityHint="Close this modal and continue watching the auction"
                    >
                      <Text style={styles.winnerModalButtonText}>Continue Watching</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : winnerData.user_participated ? (
                <>
                  <Ionicons name="heart" size={80} color="#E74C3C" />
                  <Text style={styles.winnerModalTitle}>😔 Better Luck Next Time!</Text>
                  <Text style={styles.winnerText}> "{winnerData.item_title}"</Text>
                  <Text style={styles.winnerBid}>went to {winnerData.winner_display_id} for ₣{winnerData.winning_bid.toFixed(2)}</Text>
                  <Text style={styles.winnerSubtext}>Thanks for participating!</Text>
                  <TouchableOpacity
                    style={styles.winnerModalButton}
                    onPress={() => setShowWinnerModal(false)}
                    accessible={true}
                    accessibilityLabel="Continue Watching"
                    accessibilityHint="Close this modal and continue watching the auction"
                  >
                    <Text style={styles.winnerModalButtonText}>Continue Watching</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="trophy" size={80} color="#FFD700" />
                  <Text style={styles.winnerModalTitle}>🏆 Auction Complete!</Text>
                  <Text style={styles.winnerText}>{winnerData.winner_display_id} won</Text>
                  <Text style={styles.winnerBid}> "{winnerData.item_title}" for ₣{winnerData.winning_bid.toFixed(2)}</Text>
                  <TouchableOpacity
                    style={styles.winnerModalButton}
                    onPress={() => setShowWinnerModal(false)}
                    accessible={true}
                    accessibilityLabel="Continue Watching"
                    accessibilityHint="Close this modal and continue watching the auction"
                  >
                    <Text style={styles.winnerModalButtonText}>Continue Watching</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}
      
      {/* Image/Video Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setImageViewerVisible(false);
          setSelectedImageUrl(null);
          setSelectedVideoUrl(null);
          setMediaType('image');
        }}
        statusBarTranslucent={true}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => {
              setImageViewerVisible(false);
              setSelectedImageUrl(null);
              setSelectedVideoUrl(null);
              setMediaType('image');
            }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          {mediaType === 'image' && selectedImageUrl && (
            <Image
              source={{ uri: selectedImageUrl }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
          
          {mediaType === 'video' && selectedVideoUrl && (
            <SimpleVideoViewer videoUri={selectedVideoUrl} />
          )}
        </View>
      </Modal>
    </>
  );
};

// Simple Video Viewer Component
const SimpleVideoViewer: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.imageViewerImage}
      contentFit="contain"
      nativeControls={true}
      allowsFullscreen={false}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    // ... rest of the styles
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  video: {
    width: screenWidth,
    height: screenHeight,
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  viewerText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  // Missing styles for top bar
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  viewerCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  controlIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionsContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 200,
    pointerEvents: 'none',
  },
  bidInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  currentBidLabel: {
    color: '#888',
    fontSize: 14,
    marginRight: 8,
  },
  currentBidAmount: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
  },
  liveIndicator: {
    position: 'absolute',
    top: 80,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  placeBidButton: {
    flex: 1,
    backgroundColor: '#8E44AD',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
  },
  placeBidButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  auctionInfoCard: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    borderRadius: 12,
    zIndex: 10,
  },
  auctionInfoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  itemImageThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoThumbnailContainer: {
    backgroundColor: 'rgba(142, 68, 173, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayIcon: {
    marginBottom: 4,
  },
  videoThumbnailText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  auctionInfoText: {
    flex: 1,
    minWidth: 0,
  },
  auctionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  currentBid: {
    color: '#8E44AD',
    fontSize: 24,
    fontWeight: 'bold',
  },
  timeLeft: {
    color: '#F39C12',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bidCount: {
    color: '#3498DB',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 32,
  },
  quickBidButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(142, 68, 173, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(142, 68, 173, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickBidText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bidButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#8E44AD',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  bidButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bidButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#555',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemNumber: {
    color: '#8E44AD',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: screenWidth - 48,
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
    backgroundColor: '#2a2a2a',
    color: 'white',
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
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
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Reaction styles
  reactionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  reactionAnimation: {
    position: 'absolute',
  },
  reactionEmoji: {
    fontSize: 40,
  },
  reactionButtonsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    flexDirection: 'column',
    gap: 12,
  },
  reactionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  reactionButtonEmoji: {
    fontSize: 24,
  },
  // Bid Notification Styles
  bidNotificationBubble: {
    position: 'absolute',
    bottom: 100, // Start position
    left: 20,
    right: 20,
    backgroundColor: 'rgba(142, 68, 173, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000, // Ensure it's above other elements
  },
  bidNotificationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Image viewer styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  imageViewerImage: {
    width: '90%',
    height: '80%',
    resizeMode: 'contain',
  },
  // Winner Modal Styles
  winnerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
  },
  winnerModalTitle: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  winnerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  winnerBid: {
    color: '#8E44AD',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  winnerSubtext: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  winnerModalButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
  },
  winnerModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  winnerModalButtonPrimary: {
    backgroundColor: '#8E44AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  winnerModalButtonSecondary: {
    backgroundColor: '#555',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  winnerModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.75,
    paddingBottom: 32,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
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
    marginTop: 8,
  },
  list: {
    maxHeight: screenHeight * 0.5,
    paddingHorizontal: 20,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cartItemPrice: {
    color: '#8E44AD',
    fontSize: 14,
    fontWeight: 'bold',
  },
  removeButton: {
    padding: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    color: '#888',
    fontSize: 18,
    fontWeight: '600',
  },
  totalValue: {
    color: '#8E44AD',
    fontSize: 24,
    fontWeight: 'bold',
  },
  checkoutButton: {
    flexDirection: 'row',
    backgroundColor: '#8E44AD',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default AuctionLiveViewerScreen;


