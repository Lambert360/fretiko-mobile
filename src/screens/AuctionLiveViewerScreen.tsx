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
import { PanGestureHandler, PanGestureHandlerGestureEvent, PanGestureHandlerStateChangeEvent, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
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
  const [showCartModal, setShowCartModal] = useState(false);

  // Multi-item auction state
  const [currentItem, setCurrentItem] = useState<AuctionItem | null>(null);
  const [itemBiddingStatus, setItemBiddingStatus] = useState<'waiting' | 'countdown' | 'active' | 'ended' | 'sold' | 'passed'>('waiting');
  const [canBid, setCanBid] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [itemTimeLeft, setItemTimeLeft] = useState<number | null>(null);

  // Reactions state
  const [reactions, setReactions] = useState<Array<{ id: string; reaction_type: string; user_id: string; timestamp: string }>>([]);
  const [reactionAnimations, setReactionAnimations] = useState<Array<{ id: string; reaction_type: string; x: number; y: number; scale: Animated.Value; opacity: Animated.Value; translateY: Animated.Value }>>([]);

  // Image viewer modal state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Agora RTC state - Direct streaming for low latency
  const [agoraConfig, setAgoraConfig] = useState<any>(null);
  const [agoraEngine, setAgoraEngine] = useState<IRtcEngine | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isAgoraJoined, setIsAgoraJoined] = useState(false);
  const [isAgoraInitialized, setIsAgoraInitialized] = useState(false);
  const agoraEngineRef = useRef<IRtcEngine | null>(null);

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
          setItemTimeLeft(remaining);
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
            setCountdownValue(null);
            setItemTimeLeft(null);
            setBidAmount((data.starting_price + data.bid_increment).toString());
            break;
          
          case 'start_countdown':
            setItemBiddingStatus('countdown');
            setCanBid(false);
            setCountdownValue(3);
            break;
          
          case 'bidding_open':
            setItemBiddingStatus('active');
            setCanBid(true);
            setCountdownValue(null);
            setItemTimeLeft(data.duration || 120);
            setBidAmount((data.minimum_bid || data.starting_price + data.bid_increment).toString());
            break;
          
          case 'bidding_ended':
            setItemBiddingStatus('ended');
            setCanBid(false);
            setItemTimeLeft(null);
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
                
                Alert.alert(
                  '🎉 You Won!',
                  `${wonItem.title} for ₣${wonItem.winningBid.toFixed(2)}`,
                  [
                    { text: 'View Cart', onPress: () => setShowCartModal(true) },
                    { text: 'Continue', style: 'cancel' }
                  ]
                );
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
            
            // Show win notification
            Alert.alert(
              '🎉 Congratulations!',
              `You won "${auction.title}" for ₣${(data.winning_bid || auction.current_bid).toFixed(2)}!`,
              [
                { text: 'View Cart', onPress: () => setShowCartModal(true) },
                { text: 'Continue Watching', style: 'cancel' }
              ]
            );
          } else if (data.new_status === 'ended' && data.winner_id !== user?.id) {
            // User didn't win - just show ended message
            Alert.alert(
              'Auction Ended',
              'Auction has ended',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
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

    // Handle reactions
    const handleNewReaction = (reaction: any) => {
      if (reaction.auction_id === auctionId) {
        setReactions(prev => [...prev, { ...reaction, id: Date.now() + Math.random().toString() }]);
        
        // Create floating animation
        const reactionId = Date.now() + Math.random().toString();
        const randomX = Math.random() * (screenWidth - 100);
        const newReaction = {
          id: reactionId,
          reaction_type: reaction.reaction_type,
          x: randomX,
          y: screenHeight * 0.6,
          scale: new Animated.Value(0),
          opacity: new Animated.Value(1),
          translateY: new Animated.Value(0),
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
            toValue: -200,
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
          setReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 3000);
      }
    };

    auctionSocket.on('new_reaction', handleNewReaction);

    return () => {
      auctionSocket.off('new_bid', handleNewBid);
      auctionSocket.off('auction_status_changed', handleAuctionStatusChanged);
      auctionSocket.off('auction_won', handleAuctionWon);
      auctionSocket.off('item_event', handleItemEvent);
      auctionSocket.off('new_reaction', handleNewReaction);
      auctionSocket.leaveAuction(auctionId);
    };
  }, [auctionId, currentItem, itemBiddingStatus]);

  // Countdown timer (3-2-1)
  useEffect(() => {
    if (itemBiddingStatus === 'countdown' && countdownValue !== null && countdownValue > 0) {
      const timer = setTimeout(() => {
        setCountdownValue(countdownValue - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [itemBiddingStatus, countdownValue]);

  // Item bidding timer
  useEffect(() => {
    if (itemBiddingStatus === 'active' && itemTimeLeft !== null && itemTimeLeft > 0) {
      const timer = setTimeout(() => {
        setItemTimeLeft(itemTimeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [itemBiddingStatus, itemTimeLeft]);

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
    
    auctionSocket.sendReaction(auctionId, reactionType);
    
    // Optimistically add reaction animation
    const reactionId = Date.now() + Math.random().toString();
    const randomX = Math.random() * (screenWidth - 100);
    const newReaction = {
      id: reactionId,
      reaction_type: reactionType,
      x: randomX,
      y: screenHeight * 0.6,
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0),
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
        toValue: -200,
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

  return (
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

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>

          <View style={styles.viewerCount}>
            <Ionicons name="eye" size={16} color="white" />
            <Text style={styles.viewerText}>{auction.view_count || 0}</Text>
          </View>
        </View>

        {/* Countdown Display (3-2-1) */}
        {itemBiddingStatus === 'countdown' && countdownValue !== null && countdownValue > 0 && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdownValue}</Text>
          </View>
        )}

        {/* Reaction Animations Overlay */}
        <View style={styles.reactionsOverlay} pointerEvents="none">
          {reactionAnimations.map((reaction) => (
            <Animated.View
              key={reaction.id}
              style={[
                styles.reactionAnimation,
                {
                  left: reaction.x,
                  top: reaction.y,
                  transform: [
                    { scale: reaction.scale },
                    { translateY: reaction.translateY },
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
            {/* Item Image Thumbnail */}
            {currentItem && currentItem.images && currentItem.images.length > 0 && (
              <TouchableOpacity
                style={styles.itemImageContainer}
                onPress={() => {
                  setSelectedImageUrl(currentItem.images[0]);
                  setImageViewerVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: currentItem.images[0] }}
                  style={styles.itemImageThumbnail}
                  resizeMode="cover"
                />
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
              
              <View style={styles.bidRow}>
                <View>
                  <Text style={styles.label}>Current Bid</Text>
                  <Text style={styles.currentBid}>
                    ₣{(currentItem 
                      ? (currentItem.current_bid || currentItem.starting_price)
                      : auction.current_bid).toFixed(2)}
                  </Text>
                </View>
                
                <View>
                  <Text style={styles.label}>Time Left</Text>
                  <Text style={styles.timeLeft}>{formatTimeRemaining(timeRemaining || 0)}</Text>
                </View>

                <View>
                  <Text style={styles.label}>Bids</Text>
                  <Text style={styles.bidCount}>{auction.total_bids || 0}</Text>
                </View>
              </View>
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
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => handleSendReaction('heart')}
            >
              <Text style={styles.reactionButtonEmoji}>❤️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => handleSendReaction('thumbs_up')}
            >
              <Text style={styles.reactionButtonEmoji}>👍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => handleSendReaction('applause')}
            >
              <Text style={styles.reactionButtonEmoji}>👏</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => handleSendReaction('fire')}
            >
              <Text style={styles.reactionButtonEmoji}>🔥</Text>
            </TouchableOpacity>
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
            {itemTimeLeft !== null && itemBiddingStatus === 'active' && (
              <Text style={styles.modalInfo}>
                Time left: {formatTimeRemaining(itemTimeLeft)}
              </Text>
            )}

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
                  <Text style={styles.confirmButtonText}>Bid ₣{bidAmount}</Text>
                )}
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

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImageUrl && (
            <Image
              source={{ uri: selectedImageUrl }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  countdownOverlay: {
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
  countdownText: {
    color: 'white',
    fontSize: 120,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
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


