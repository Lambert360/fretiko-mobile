import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  ActivityIndicator,
  Share,
} from 'react-native';
import { PanGestureHandler, PanGestureHandlerStateChangeEvent, State, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { liveSalesAPI, LiveStream, LiveStreamProduct, LiveStreamService, LivePortfolioService, GiftType } from '../services/liveSalesAPI';
import { liveStreamSocket, LiveComment, LiveReaction, LiveGift, ViewerCountUpdate } from '../services/liveStreamSocket';
import { chatAPI, ChatConversation } from '../services/chatAPI';
import { giftAPI, VirtualGift, UserGift } from '../services/giftAPI';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { cartAPI } from '../services/cartAPI';
import LottieGiftEffect from '../components/LottieGiftEffect';
import { playSoundboardSound, stopSoundboardSound } from '../services/auctionSoundService';
import GiftEffectStage from '../components/GiftEffectStage';
import GiftSelectorModal from '../components/GiftSelectorModal';
import WatchRewardPill from '../components/WatchRewardPill';
import { MediaViewerModal } from '../components/MediaViewerModal';
import { AdultContentGate, isAdultContentError } from '../components/AdultContentGate';
import { VideoView, useVideoPlayer } from 'expo-video';

// Import Agora RTC SDK for direct streaming (industry standard)
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
  RtcSurfaceView,
  RenderModeType,
} from 'react-native-agora';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Live Stream Viewer Screen
 * 
 * Full-screen viewer interface for watching live streams:
 * - Agora RTC direct video (industry standard - like TikTok/Instagram)
 * - Real-time comments via Socket.IO
 * - Reactions and gifts
 * - Live purchases
 * - Viewer count
 * - Auto-cleanup on unfocus
 * 
 * ARCHITECTURE:
 * - LIVE: Direct RTC connection (instant, low latency)
 * - VOD: HLS playback from S3 (Cloud Recording replay)
 */

const LiveStreamViewerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cart = useCart();
  
  const { streamId, stream: initialStream } = route.params;

  // Stream state
  const [stream, setStream] = useState<LiveStream | null>(initialStream || null);

  // VOD player for ended streams (HLS replay from Cloud Recording)
  const vodPlayer = useVideoPlayer(null, player => {
    player.loop = false;
  });
  const [viewerCount, setViewerCount] = useState(initialStream?.viewer_count || 0);
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  const [adultRestricted, setAdultRestricted] = useState(false);

  const [isHostVideoMuted, setIsHostVideoMuted] = useState(false);
  const [isHostAudioMuted, setIsHostAudioMuted] = useState(false);

  // Agora RTC state (for live viewing)
  const [agoraConfig, setAgoraConfig] = useState<any>(null);
  const [agoraEngine, setAgoraEngine] = useState<IRtcEngine | null>(null);
  const [isAgoraJoined, setIsAgoraJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const agoraEngineRef = useRef<IRtcEngine | null>(null);
  const [isAgoraInitialized, setIsAgoraInitialized] = useState(false);

  // Comments
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(true);
  const [isCommentInputExpanded, setIsCommentInputExpanded] = useState(false);
  const bottomPosition = useRef(new Animated.Value(0)).current;
  const commentsListRef = useRef<FlatList>(null);

  // Reactions
  const [reactions, setReactions] = useState<LiveReaction[]>([]);

  // Like system
  const [likeCount, setLikeCount] = useState(0);
  const [heartAnimations, setHeartAnimations] = useState<any[]>([]);

  // Gift animations
  const [activeGiftEffects, setActiveGiftEffects] = useState<Array<{
    id: string;
    gift: {
      id: string;
      name: string;
      emoji: string;
      quantity: number;
      display_lottie_url?: string;
      lottie_config?: any;
      sound_url?: string;
      animation_type?: string;
    };
  }>>([]);

  // Modals/Drawers
  const [showShopModal, setShowShopModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [chatConversationsLoading, setChatConversationsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shopModalHeight, setShopModalHeight] = useState(Dimensions.get('window').height * 0.5);
  const [giftModalHeight, setGiftModalHeight] = useState(Dimensions.get('window').height * 0.5);
  const [miniCartModalHeight, setMiniCartModalHeight] = useState(Dimensions.get('window').height * 0.5);
  const [shareModalHeight, setShareModalHeight] = useState(Dimensions.get('window').height * 0.5);

  // Shop/Gift data
  const [shopItems, setShopItems] = useState<(LiveStreamProduct | LiveStreamService)[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<LivePortfolioService[]>([]);
  const [availableGifts, setAvailableGifts] = useState<UserGift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  // Live Cart state
  const [liveCartItems, setLiveCartItems] = useState<any[]>([]);
  const [showMiniCart, setShowMiniCart] = useState(false);

  // Sync live product items with the global cart:
  // - remove any live product that was deleted from the main Cart screen
  // - attach the backend cart_item id (cartItemId) for products once they appear in the global cart
  useEffect(() => {
    const activeCartItemIds = new Set(cart.items.map(i => i.id));
    const cartItemsByProductId = new Map<string, string>();
    for (const ci of cart.items) {
      if (ci.productId && !cartItemsByProductId.has(ci.productId)) {
        cartItemsByProductId.set(ci.productId, ci.id);
      }
    }

    setLiveCartItems(prev => {
      const updated = prev.map(item => {
        if (item.type !== 'product' || !item.product_id) return item;

        if (item.cartItemId) {
          // If the synced backend item was deleted elsewhere, remove the live item too
          return activeCartItemIds.has(item.cartItemId) ? item : null;
        }

        // Link the live item to its new backend cart item
        const cartItemId = cartItemsByProductId.get(item.product_id);
        return cartItemId ? { ...item, cartItemId } : item;
      });
      return updated.filter(Boolean) as any[];
    });
  }, [cart.items]);

  // Showcase state (for viewers)
  const [showcasedItem, setShowcasedItem] = useState<any>(null);

  // Highlighted item (dynamic host card)
  const [highlightedItem, setHighlightedItem] = useState<any>(null);

  // Image viewer modal state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  // Video viewer for highlighted services whose primary media is a video
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerUri, setMediaViewerUri] = useState('');

  // Service/portfolio booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingItem, setBookingItem] = useState<any>(null);
  const [bookingSource, setBookingSource] = useState<'highlight' | 'showcase' | null>(null);

  // Swipe gesture state
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const swipeOpacity = useRef(new Animated.Value(1)).current;
  const swipeIndicatorOpacity = useRef(new Animated.Value(1)).current;
  const pausePulseAnim = useRef(new Animated.Value(1)).current;

  // UI state
  const [loading, setLoading] = useState(!initialStream);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Screen focus tracking
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Pause pulse animation
  useEffect(() => {
    if (isStreamPaused) {
      // Start pulsing animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pausePulseAnim, {
            toValue: 1.3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pausePulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pausePulseAnim.setValue(1);
    }
  }, [isStreamPaused]);

  // Load stream details
  useEffect(() => {
    if (!initialStream) {
      loadStreamDetails();
    } else {
      // If initial stream is provided, still need to load Agora config for live streams
      console.log('📦 Initial stream provided, checking if we need Agora config...');
      if (initialStream.status === 'live') {
        console.log('🎯 Stream is live, loading Agora config...');
        loadAgoraConfig();
      }
    }
  }, []);

  const loadStreamDetails = async () => {
    try {
      setLoading(true);
      const streamData = await liveSalesAPI.getStreamById(streamId);

      // ✅ INDUSTRY STANDARD: For LIVE streams, use RTC (no HLS needed)
      // ✅ For ENDED streams, HLS is available (Cloud Recording completed)
      if (streamData.status === 'ended' && !streamData.stream_url) {
        try {
          const hlsData = await liveSalesAPI.getHLSUrl(streamId);
          if (hlsData.hlsUrl) {
            streamData.stream_url = hlsData.hlsUrl;
          }
        } catch (hlsError) {
          console.warn('VOD URL not available yet:', hlsError);
        }
      }

      setStream(streamData);
      setViewerCount(streamData.viewer_count);

      // Load the replay source for ended streams
      if (streamData.status === 'ended' && streamData.stream_url) {
        try {
          await vodPlayer.replaceAsync(streamData.stream_url);
        } catch (vodError) {
          console.warn('Failed to load VOD source:', vodError);
        }
      }

      // ✅ If stream is LIVE, get Agora token for RTC
      if (streamData.status === 'live') {
        await loadAgoraConfig();
      }
    } catch (error) {
      console.error('Error loading stream:', error);
      if (isAdultContentError(error)) {
        setAdultRestricted(true);
      } else {
        Alert.alert('Error', 'Failed to load stream details');
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  // Load Agora configuration for RTC streaming
  const loadAgoraConfig = async () => {
    try {
      console.log('🎯 Loading Agora token for RTC viewer...', { streamId });
      const token = await liveSalesAPI.generateAgoraToken(streamId, 'audience');
      console.log('✅ Agora token received:', {
        appId: token.appId,
        channel: token.channel,
        uid: token.uid,
        hasToken: !!token.token
      });
      setAgoraConfig(token);
      console.log('📝 Agora config state updated');
    } catch (error) {
      console.error('❌ Error loading Agora config:', error);
      Alert.alert('Error', 'Failed to connect to live stream');
    }
  };

  // Initialize Agora RTC Engine (LIVE streams only)
  const initializeAgoraEngine = async () => {
    console.log('🎬 initializeAgoraEngine called:', {
      isAgoraInitialized,
      hasEngine: !!agoraEngineRef.current,
      hasConfig: !!agoraConfig,
      streamStatus: stream?.status
    });

    if (isAgoraInitialized || agoraEngineRef.current) {
      console.log('🔄 Agora already initialized, skipping...');
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
      const initResult = engine.initialize({
        appId: agoraConfig.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      if (initResult !== 0) {
        throw new Error(`Engine initialization failed: ${initResult}`);
      }
      console.log('✅ Agora Engine initialized');

      // ✅ INDUSTRY STANDARD: Set client role to AUDIENCE (viewer)
      await engine.setClientRole(ClientRoleType.ClientRoleAudience);
      console.log('✅ Client role set to Audience (viewer)');

      // Enable video and audio
      await engine.enableVideo();
      await engine.enableAudio();
      console.log('✅ Video and audio enabled');

      // Setup event listeners
      engine.addListener('onJoinChannelSuccess', (connection: any, elapsed: number) => {
        console.log('🎉 Viewer joined Agora channel successfully!', {
          channelId: connection?.channelId,
          localUid: connection?.localUid,
          elapsed
        });
        setIsAgoraJoined(true);
        console.log('✅ isAgoraJoined state set to true');
      });

      engine.addListener('onUserJoined', (connection: any, uid: number, elapsed: number) => {
        console.log('👤 🎉 Remote user joined (HOST DETECTED)!', {
          uid,
          elapsed,
          channelId: connection?.channelId
        });
        setRemoteUid(uid);
        setIsHostVideoMuted(false);
        setIsHostAudioMuted(false);
        console.log('✅ remoteUid state set to:', uid);
      });

      engine.addListener('onUserOffline', (connection: any, uid: number, reason: number) => {
        console.log('👋 Remote user left (host):', { uid, reason });
        setRemoteUid((prevUid) => {
          if (prevUid === uid) {
            console.log('🔇 Host disconnected, clearing remote UID');
            setIsHostVideoMuted(false);
            setIsHostAudioMuted(false);
            return null;
          }
          return prevUid;
        });
      });

      engine.addListener('onRemoteVideoStateChanged', (connection: any, uid: number, state: number, reason: number, elapsed: number) => {
        // state: 0=stopped, 1=starting, 2=decoding, 3=failed
        // reason: 0=user muted/unmuted, other values indicate non-user reasons
        if (remoteUid && uid !== remoteUid) return;
        const isMutedByHost = state === 0 && reason === 0;
        setIsHostVideoMuted(isMutedByHost);
      });

      engine.addListener('onRemoteAudioStateChanged', (connection: any, uid: number, state: number, reason: number, elapsed: number) => {
        // state: 0=stopped, 1=decoding, 2=starting
        if (remoteUid && uid !== remoteUid) return;
        setIsHostAudioMuted(state === 0);
      });

      engine.addListener('onError', (err: number, msg: string) => {
        console.error('💥 Agora error:', { err, msg });
      });

      engine.addListener('onConnectionStateChanged', (connection: any, state: number, reason: number) => {
        console.log('🔌 Agora connection state changed:', {
          state,
          reason,
          channelId: connection?.channelId
        });
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

    } catch (error) {
      console.error('Error initializing Agora:', error);
      Alert.alert('Connection Error', 'Failed to connect to live stream');
      setIsAgoraInitialized(false);
      agoraEngineRef.current = null;
    }
  };

  // Cleanup Agora on unmount
  const cleanupAgora = async () => {
    if (agoraEngineRef.current) {
      try {
        console.log('🧹 Cleaning up Agora...');
        await agoraEngineRef.current.leaveChannel();
        agoraEngineRef.current.removeAllListeners();
        agoraEngineRef.current.release();
        console.log('✅ Agora cleaned up');
      } catch (error) {
        console.error('Error cleaning up Agora:', error);
      }
      agoraEngineRef.current = null;
      setAgoraEngine(null);
      setIsAgoraInitialized(false);
      setIsAgoraJoined(false);
      setRemoteUid(null);
    }
  };

  // Initialize Agora when config is ready
  useEffect(() => {
    if (agoraConfig && stream?.status === 'live' && !isAgoraInitialized) {
      console.log('🚀 Triggering Agora initialization from useEffect...');
      initializeAgoraEngine();
    }
    // ⚠️ NO cleanup here! Cleanup happens on component unmount only
  }, [agoraConfig, stream?.status, isAgoraInitialized]);

  // Cleanup Agora ONLY on component unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up Agora...');
      cleanupAgora();
    };
  }, []);

  // Connect to WebSocket and join stream
  useEffect(() => {
    if (!stream || stream?.status === 'ended') return;

    // Create stable handler references for cleanup
    const highlightItemHandler = (data: any) => {
      console.log('🌟 Viewer received highlight_item event:', data);
      if (data.streamId === streamId) {
        if (data.item === null || data.type === 'dismiss') {
          console.log('❌ Dismissing highlighted item on viewer screen');
          setHighlightedItem(null);
        } else {
          console.log('✅ Setting highlighted item on viewer screen:', data.item);
          setHighlightedItem(data.item);
        }
      } else {
        console.log('⚠️ Highlight event streamId mismatch:', data.streamId, 'vs', streamId);
      }
    };

    // Host soundboard sounds — play the file natively, no visual indicator
    const soundPlayedHandler = (data: { streamId?: string; soundId: string; soundUrl?: string }) => {
      if (data?.soundId && (!data.streamId || data.streamId === streamId)) {
        playSoundboardSound(data.soundId, data.soundUrl);
      }
    };
    const soundStoppedHandler = (data: { streamId?: string; soundId: string }) => {
      if (data?.soundId && (!data.streamId || data.streamId === streamId)) {
        stopSoundboardSound(data.soundId);
      }
    };

    // Register event listeners EARLY, before async setupSocket completes
    // This ensures listeners are ready when events arrive
    liveStreamSocket.on('view_count_updated', handleViewerCountUpdate);
    liveStreamSocket.on('highlight_item', highlightItemHandler);
    liveStreamSocket.on('sound_played', soundPlayedHandler);
    liveStreamSocket.on('sound_stopped', soundStoppedHandler);

    const setupSocket = async () => {
      try {
        await liveStreamSocket.connect();
        
        // Join socket first, then API (socket is more critical for reactions)
        try {
          await liveStreamSocket.joinStream(streamId, 'viewer');
          console.log('✅ Socket join successful');
        } catch (socketError) {
          console.warn('⚠️ Socket join had issues, but continuing:', socketError);
          // Continue anyway - currentStreamId should be set
        }

        // Try API join, but don't fail if it has RLS issues
        try {
          await liveSalesAPI.joinStream(streamId);
          console.log('✅ API join successful');
        } catch (apiError: any) {
          console.warn('⚠️ API join failed (may be RLS issue), but continuing:', apiError?.message);
          // Don't fail the whole setup - socket join is more important
        }

        // Register remaining event listeners
        liveStreamSocket.on('comment', handleNewComment);
        liveStreamSocket.on('new_reaction', handleNewReaction);
        liveStreamSocket.on('new_gift', handleNewGift);
        liveStreamSocket.on('stream_status_update', handleStreamStatusUpdate);
        liveStreamSocket.on('showcase_item', handleShowcaseItem);

        console.log('✅ Connected to live stream socket');
      } catch (error) {
        console.error('Error connecting to stream:', error);
        // Don't show alert - let user try to interact anyway
      }
    };

    setupSocket();

    return () => {
      console.log('🧹 Cleaning up viewer screen socket listeners');
      // Remove specific listeners using stored references
      liveStreamSocket.off('view_count_updated', handleViewerCountUpdate);
      liveStreamSocket.off('highlight_item', highlightItemHandler);
      liveStreamSocket.off('comment', handleNewComment);
      liveStreamSocket.off('new_reaction', handleNewReaction);
      liveStreamSocket.off('new_gift', handleNewGift);
      liveStreamSocket.off('stream_status_update', handleStreamStatusUpdate);
      liveStreamSocket.off('showcase_item', handleShowcaseItem);
      liveStreamSocket.off('sound_played', soundPlayedHandler);
      liveStreamSocket.off('sound_stopped', soundStoppedHandler);
      liveStreamSocket.leaveStream();
      liveSalesAPI.leaveStream(streamId).catch(console.error);
    };
  }, [stream, streamId]);

  // Screen focus/unfocus handling
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);

      return () => {
        setIsScreenFocused(false);
        // Cleanup happens in useEffect cleanup
      };
    }, [])
  );

  // Socket event handlers
  const handleNewComment = (comment: LiveComment) => {
    // Prevent duplicate comments - check if comment ID already exists
    setComments(prev => {
      // Check if this comment already exists (by ID)
      const exists = prev.some(c => c.id === comment.id);
      if (exists) {
        console.log('⚠️ Duplicate comment ignored:', comment.id);
        return prev;
      }
      
      // If this is our own comment (isOwn: true), replace the optimistic comment
      if (comment.isOwn) {
        console.log('✅ Replacing optimistic comment with server response:', comment.id);
        // Remove temporary optimistic comment and add the real one
        return prev.filter(c => !c.id.startsWith('temp-')).concat(comment);
      }
      
      console.log('✅ Adding new comment from others:', comment.id);
      return [...prev, comment];
    });
    setTimeout(() => {
      commentsListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleNewReaction = (reaction: LiveReaction) => {
    setReactions(prev => [...prev, { ...reaction, id: Date.now() + Math.random() }]);
    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.slice(1));
    }, 3000);
  };

  const handleNewGift = (giftData: LiveGift | any) => {
    console.log('🎁 Gift received on viewer screen:', giftData);

    // Handle both LiveGift format and backend format
    const giftType = giftData.gift_type || giftData.giftType;
    const quantity = giftData.quantity || 1;

    const meta = giftData.giftMetadata || {};
    const animationId = `gift-${Date.now()}-${Math.random()}`;
    setActiveGiftEffects((prev) => [
      ...prev,
      {
        id: animationId,
        gift: {
          id: meta.id || giftData.giftId || giftData.gift_id || '',
          name: meta.name || giftData.giftName || giftData.gift_type || '',
          emoji: meta.emoji || giftData.giftEmoji || giftData.emoji || '🎁',
          quantity,
          display_lottie_url: meta.display_lottie_url,
          lottie_config: meta.lottie_config,
          sound_url: meta.sound_url,
          animation_type: meta.animation_type,
        },
      },
    ]);
  };

  const handleViewerCountUpdate = (data: ViewerCountUpdate | any) => {
    console.log('📊 Viewer count update received:', data);
    // Handle both old and new format
    const count = data.count || data.current_viewers || 0;
    setViewerCount(count);
  };

  const handleStreamStatusUpdate = (data: any) => {
    console.log('📡 Stream status update received:', data);
    
    if (data.status === 'paused') {
      setIsStreamPaused(true);
      console.log('⏸️ Stream paused by host');
    } else if (data.status === 'live') {
      setIsStreamPaused(false);
      console.log('▶️ Stream resumed by host');
    } else if (data.status === 'ended') {
      console.log('🔴 Stream ended by host');
      setStream(prev => (prev ? { ...prev, status: 'ended' } : null));
      cleanupAgora();
    }
  };

  const handleShowcaseItem = (data: any) => {
    console.log('🎯 Item showcased by host:', data);
    if (!data || !data.item) {
      console.warn('⚠️ Invalid showcase item data:', data);
      return;
    }
    
    setShowcasedItem(data.item);
    
    // Track analytics for portfolio items
    if (data.item && 'images' in data.item) {
      liveSalesAPI.trackPortfolioImpression(data.item.id).catch(console.error);
    }
    
    // Auto-hide after 10 seconds
    setTimeout(() => setShowcasedItem(null), 10000);
  };

  // Helper function to get showcase image URL
  const getShowcaseImageUrl = (item: any): string => {
    try {
      // Check if it's a portfolio item (has 'images' array property)
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const primaryImage = item.images.find((img: any) => img.is_primary);
        return primaryImage?.image_url || item.images[0]?.image_url || 'https://via.placeholder.com/200x200';
      }
      // Check if it's a product (has 'product' property or nested product)
      if (item.product) {
        const product = item.product;
        return product.primary_image_url || product.image_url || 'https://via.placeholder.com/200x200?text=Product';
      }
      // Check if it's a direct product item (from live_stream_products)
      const productId = (item as any)?.product_id;
      if (productId && item.product) {
        return item.product.primary_image_url || 'https://via.placeholder.com/200x200?text=Product';
      }
      // Service — use its uploaded thumbnail/image when available
      if (item.service) {
        const svc = item.service;
        return svc.images?.[0]
          || (svc.media_type === 'image' ? svc.primary_media_url : undefined)
          || '';
      }
      return ''; // Empty string signals we should use icon
    } catch (error) {
      console.error('Error getting showcase image URL:', error);
      return 'https://via.placeholder.com/200x200';
    }
  };

  // Helper function to get showcase item name
  const getShowcaseItemName = (item: any): string => {
    try {
      // Portfolio items have 'title' property
      if (item.title) {
        return item.title;
      }
      // Check if it's a product (has 'product' property or nested product)
      if (item.product) {
        const product = item.product;
        return product.name || 'Product';
      }
      // Check if it's a direct product item (from live_stream_products)
      const productId = (item as any)?.product_id;
      if (productId && item.product) {
        return item.product.name || 'Product';
      }
      // Check if it's a service
      if (item.service) {
        return item.service.name || 'Service';
      }
      // Fallback
      return item.name || 'Item';
    } catch (error) {
      console.error('Error getting showcase item name:', error);
      return 'Item';
    }
  };

  // Helper function to check if item is a service (not portfolio)
  const isServiceItem = (item: any): boolean => {
    return 'service' in item && !('product' in item) && !('title' in item);
  };

  const isProductItem = (item: any): boolean => {
    return 'product' in item;
  };

  // Send comment
  const handleSendComment = () => {
    if (!commentText.trim()) return;

    const messageText = commentText.trim();
    
    // Optimistic update: Add comment immediately to UI (will be replaced by server response)
    const optimisticComment: LiveComment = {
      id: `temp-${Date.now()}`,
      user: {
        id: user?.id || '',
        username: user?.username || 'You',
        avatar_url: user?.avatar_url,
      },
      message: messageText,
      is_pinned: false,
      created_at: new Date().toISOString(),
      isOwn: true, // Mark as own comment for optimistic update
    };
    
    setComments(prev => [...prev, optimisticComment]);
    setCommentText('');

    setIsCommentInputExpanded(false);
    Keyboard.dismiss();
    
    // Send to server
    liveStreamSocket.sendComment(messageText);
    
    // Scroll to show new comment
    setTimeout(() => {
      commentsListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Send reaction
  const handleSendReaction = (reactionType: string) => {
    liveStreamSocket.sendReaction(reactionType);
    // Optimistically add reaction
    handleNewReaction({
      user: { id: user?.id || '', username: user?.username || 'You' },
      reaction_type: reactionType,
      timestamp: Date.now(),
    });
  };

  // Like system - tap to like
  const handleScreenTap = () => {
    if (isCommentInputExpanded) {
      setIsCommentInputExpanded(false);
      Keyboard.dismiss();
      return;
    }
    setLikeCount(prev => prev + 1);
    // Send like to server
    liveStreamSocket.sendReaction('heart');
    
    // Toggle swipe indicators visibility
    toggleControls();

    // Create heart animation
    const heartId = Date.now() + Math.random();
    const newHeart = {
      id: heartId,
      x: Math.random() * (screenWidth - 50),
      y: screenHeight - 100,
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0),
    };

    setHeartAnimations(prev => [...prev, newHeart]);

    // Animate heart
    Animated.parallel([
      Animated.timing(newHeart.scale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(newHeart.translateY, {
        toValue: -200,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(newHeart.opacity, {
        toValue: 0,
        duration: 2000,
        delay: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setHeartAnimations(prev => prev.filter(h => h.id !== heartId));
    });
  };

  // Modal handlers
  const openShopModal = async () => {
    setShowShopModal(true);
    // Load shop items and portfolio
    try {
      const streamDetails = await liveSalesAPI.getStreamById(streamId);
      const items = [...(streamDetails.products || []), ...(streamDetails.services || [])];
      
      // Debug: Log what products are actually in the stream
      console.log('🛍️ Shop items loaded:', {
        streamId,
        totalItems: items.length,
        products: (streamDetails.products || []).map((p: any) => ({
          id: p.id,
          product_id: p.product_id,
          name: p.product?.name,
        })),
        services: (streamDetails.services || []).map((s: any) => ({
          id: s.id,
          service_id: s.service_id,
          name: s.service?.name,
        })),
      });
      
      setShopItems(items);
      
      // Load portfolio services
      const portfolioServices = await liveSalesAPI.getPortfolioServices(streamId);
      setPortfolioItems(portfolioServices);
    } catch (error) {
      console.error('Error loading shop items:', error);
    }
  };

  const openGiftModal = async () => {
    setShowGiftModal(true);
    await loadAvailableGifts();
  };

  // Load user's owned gifts (same as IndividualChatScreen)
  const loadAvailableGifts = async () => {
    try {
      setLoadingGifts(true);
      // Get user's owned gifts instead of all available gifts
      const userGiftsResponse = await giftAPI.getUserGifts();
      
      // Group gifts by gift_id and sum quantities
      const giftMap = new Map<string, UserGift>();

      userGiftsResponse.gifts.forEach((userGift) => {
        const existing = giftMap.get(userGift.gift_id);
        if (existing) {
          existing.quantity += userGift.quantity;
          existing.total_value += userGift.total_value || 0;
        } else {
          giftMap.set(userGift.gift_id, {
            id: userGift.id,
            gift_id: userGift.gift_id,
            gift_name: userGift.gift_name,
            emoji: userGift.emoji,
            quantity: userGift.quantity,
            total_value: userGift.total_value || 0,
            source: userGift.source,
            received_at: userGift.received_at,
            display_lottie_url: userGift.display_lottie_url,
            lottie_config: userGift.lottie_config,
            sound_id: userGift.sound_id,
            sound_url: userGift.sound_url,
            animation_type: userGift.animation_type,
          });
        }
      });

      // Convert map to array and filter out gifts with 0 quantity
      const ownedGifts = Array.from(giftMap.values()).filter((gift) => gift.quantity > 0);
      setAvailableGifts(ownedGifts);
    } catch (error: any) {
      console.error('Error loading gifts:', error);
      Alert.alert('Error', error.message || 'Failed to load gifts');
    } finally {
      setLoadingGifts(false);
    }
  };

  const openShareModal = async () => {
    setShowShareModal(true);
    setSelectedUsers([]);
    setChatConversationsLoading(true);

    try {
      const { conversations } = await chatAPI.getConversations(1, 50);
      setChatConversations(conversations);
    } catch (error) {
      console.error('Error loading chat conversations:', error);
      Alert.alert('Error', 'Failed to load conversations for sharing');
    } finally {
      setChatConversationsLoading(false);
    }
  };

  const handleShareExternally = async () => {
    try {
      const shareUrl = `https://www.fretiko.com/live/${streamId}`;
      const message = stream?.title
        ? `Join my live stream "${stream.title}" on Fretiko!\n\n${shareUrl}`
        : `Join my live stream on Fretiko!\n\n${shareUrl}`;

      await Share.share({
        message,
        url: shareUrl,
      });
    } catch (error) {
      console.error('Error sharing live stream:', error);
    }
  };

  const handleShareToChats = async () => {
    if (selectedUsers.length === 0) return;

    setIsSharing(true);

    try {
      const livestreamData = {
        id: streamId,
        title: stream?.title || 'Live Stream',
        isLive: stream?.status === 'live',
        viewers: viewerCount,
        thumbnailUrl: stream?.thumbnail_url || '',
      };

      await Promise.all(
        selectedUsers.map((conversation: ChatConversation) =>
          chatAPI.sendMessage({
            conversationId: conversation.id,
            messageType: 'text',
            content: stream?.title || 'Join my live stream',
            metadata: { livestreamData },
          })
        )
      );

      Alert.alert('Shared', `Live stream shared to ${selectedUsers.length} chat${selectedUsers.length === 1 ? '' : 's'}.`);
      setShowShareModal(false);
      setSelectedUsers([]);
    } catch (error) {
      console.error('Error sharing live stream to chats:', error);
      Alert.alert('Error', 'Failed to share live stream to chats');
    } finally {
      setIsSharing(false);
    }
  };

  // Comment input handlers
  const handleCommentInputFocus = () => {
    setIsCommentInputExpanded(true);
  };

  const handleCommentInputBlur = () => {
    setIsCommentInputExpanded(false);
  };

  // Ensure the comment UI returns to the compact state when the keyboard closes
  useEffect(() => {
    const keyboardShowSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(bottomPosition, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: false,
        }).start();
      }
    );
    const keyboardHideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(bottomPosition, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: false,
        }).start();
        setIsCommentInputExpanded(false);
      }
    );

    return () => {
      keyboardShowSub.remove();
      keyboardHideSub.remove();
    };
  }, [bottomPosition]);

  // Live Cart Functions
  const addToLiveCart = async (item: LiveStreamProduct | LiveStreamService | LivePortfolioService, quantity: number = 1, bookingDate?: string, bookingTime?: string) => {
    const isProduct = 'product' in item;
    const isService = 'service' in item;
    const isPortfolio = 'title' in item;
    const itemType = isProduct ? 'product' : isService ? 'service' : 'portfolio';
    const productId = isProduct ? (item as any).product_id : undefined;

    // Local update first for instant UI feedback
    setLiveCartItems(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem
        );
      } else {
        if (isPortfolio) {
          liveSalesAPI.trackPortfolioAddToCart(item.id).catch(console.error);
        }

        return [...prev, {
          ...item,
          quantity,
          type: itemType,
          cartId: `${Date.now()}-${Math.random()}`, // Unique cart ID
          // Store booking date/time for portfolio services
          ...(bookingDate && bookingTime && {
            bookingDate,
            bookingTime,
          }),
        }];
      }
    });

    // Products also go to the global cart so they appear there until checkout or deletion
    if (isProduct && productId) {
      try {
        await cartAPI.addToCart({
          productId,
          quantity,
          price: (item as any).live_price || 0,
        });
        await cart.refreshCart();

        // The cartItemId is attached automatically by the cart-items sync useEffect
        // once the backend cart state refreshes.
      } catch (error) {
        console.error('Failed to sync live product to global cart:', error);
        Alert.alert('Cart Sync Error', 'This item was added to the live cart but could not be saved to your main cart.');
      }
    }
  };

  const removeFromLiveCart = async (cartId: string) => {
    const localItem = liveCartItems.find(i => i.cartId === cartId);

    // Remove product from global cart if it has been synced
    if (localItem?.type === 'product' && localItem.product_id) {
      const cartItemId = localItem.cartItemId || cart.items.find(i => i.productId === localItem.product_id)?.id;
      if (cartItemId) {
        try {
          await cartAPI.removeFromCart(cartItemId);
          await cart.refreshCart();
        } catch (error) {
          console.error('Failed to remove live product from global cart:', error);
        }
      }
    }

    setLiveCartItems(prev => prev.filter(item => item.cartId !== cartId));
  };

  const updateLiveCartQuantity = async (cartId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromLiveCart(cartId);
      return;
    }

    const localItem = liveCartItems.find(i => i.cartId === cartId);

    // Sync quantity to global cart for products
    if (localItem?.type === 'product' && localItem.product_id) {
      const cartItemId = localItem.cartItemId || cart.items.find(i => i.productId === localItem.product_id)?.id;
      if (cartItemId) {
        try {
          await cartAPI.updateCartItem(cartItemId, { quantity });
          await cart.refreshCart();
        } catch (error) {
          console.error('Failed to update live product quantity in global cart:', error);
        }
      }
    }

    setLiveCartItems(prev =>
      prev.map(item =>
        item.cartId === cartId ? { ...item, quantity } : item
      )
    );
  };

  const clearLiveCart = async () => {
    // Remove any synced product items from the global cart on checkout
    for (const item of liveCartItems) {
      if (item.type !== 'product' || !item.product_id) continue;

      const cartItemId = item.cartItemId || cart.items.find(i => i.productId === item.product_id)?.id;
      if (cartItemId) {
        try {
          await cartAPI.removeFromCart(cartItemId);
        } catch (error) {
          console.error('Failed to remove live product from global cart on checkout:', error);
        }
      }
    }

    setLiveCartItems([]);
    await cart.refreshCart();
  };

  // Add product to live cart with alert and optional showcase close
  const handleAddProduct = (item: any, source: 'highlight' | 'showcase') => {
    addToLiveCart(item, 1);
    Alert.alert('Added to Cart', 'Item added to your cart!');
    if (source === 'showcase') {
      setShowcasedItem(null);
    }
  };

  // Open the booking date/time picker for services and portfolio
  const handleBookPress = (item: any, source: 'highlight' | 'showcase') => {
    setBookingItem(item);
    setBookingSource(source);
    setShowBookingModal(true);
  };

  // Confirm a booking and add it to the live cart
  const handleBookingConfirm = (bookingDate: string, bookingTime: string) => {
    if (!bookingItem) return;

    addToLiveCart(bookingItem, 1, bookingDate, bookingTime);
    setShowBookingModal(false);
    setBookingItem(null);

    if (bookingSource === 'showcase') {
      setShowcasedItem(null);
    }
    setBookingSource(null);

    const itemType = 'title' in bookingItem ? 'portfolio' : 'service';
    Alert.alert('Booked', `Your ${itemType} has been booked for ${bookingDate} at ${bookingTime}.`);
  };

  const getLiveCartTotal = () => {
    return liveCartItems.reduce((total, item) => total + (item.live_price * item.quantity), 0);
  };

  // Determine if swipe gestures should be enabled
  const swipeEnabled = !showShopModal && !showGiftModal && !showShareModal && !showMiniCart && !isCommentInputExpanded;

  // Swipe gesture handlers
  const handleSwipeGesture = (event: PanGestureHandlerGestureEvent) => {
    if (!swipeEnabled) return;

    const { translationX } = event.nativeEvent;
    swipeTranslateX.setValue(translationX);
  };

  const handleSwipeStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (!swipeEnabled) return;

    const { translationX, velocityX, state } = event.nativeEvent;

    if (state === State.END) {
      const swipeThreshold = screenWidth * 0.3; // 30% of screen width
      const velocityThreshold = 500; // Minimum velocity for swipe

      // Reset translation
      Animated.spring(swipeTranslateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();

      // Check for valid swipe
      if (Math.abs(translationX) > swipeThreshold || Math.abs(velocityX) > velocityThreshold) {
        if (translationX > 0) {
          // Swipe right - go back to Live Sales Discovery
          handleSwipeRight();
        } else {
          // Swipe left - go to vendor store
          handleSwipeLeft();
        }
      }
    }
  };

  const handleSwipeRight = () => {
    // Add visual feedback
    Animated.parallel([
      Animated.timing(swipeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(swipeTranslateX, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate to Live Sales Discovery
      navigation.replace('LiveSales');
    });
  };

  const handleSwipeLeft = () => {
    if (!stream) return;

    // Add visual feedback
    Animated.parallel([
      Animated.timing(swipeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(swipeTranslateX, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate to Vendor Store
      navigation.navigate('PublicStore', {
        userId: stream.vendor.id,
      });
    });
  };

  // Toggle controls visibility
  const toggleControls = () => {
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }

    if (showControls) {
      // Hide controls and swipe indicators
      Animated.parallel([
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(swipeIndicatorOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowControls(false));
    } else {
      // Show controls and swipe indicators
      setShowControls(true);
      Animated.parallel([
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(swipeIndicatorOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after 3 seconds
      controlsTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(controlsOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(swipeIndicatorOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setShowControls(false));
      }, 3000) as any;
    }
  };

  // Render comment item for middle overlay
  const renderCommentItem = ({ item }: { item: LiveComment }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentUser}>{item.user.username}</Text>
      <Text style={styles.commentText}>: {item.message}</Text>
    </View>
  );

  // Render reaction animation
  const renderReaction = (reaction: any, index: number) => {
    const randomOffset = Math.random() * (screenWidth - 100);
    return (
      <Animated.View
        key={`${reaction.timestamp}-${index}`}
        style={[
          styles.reactionBubble,
          {
            left: randomOffset,
            transform: [
              {
                translateY: new Animated.Value(0).interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight, -100],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.reactionEmoji}>
          {reaction.reaction_type === 'heart' ? '❤️' : reaction.reaction_type === 'fire' ? '🔥' : '👍'}
        </Text>
      </Animated.View>
    );
  };

  if (adultRestricted) {
    return <AdultContentGate navigation={navigation} contentLabel="live stream" />;
  }

  if (loading || !stream) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  if (stream?.status === 'ended') {
    return (
      <View style={styles.loadingContainer}>
        {stream.stream_url ? (
          <VideoView
            style={styles.vodPlayer}
            player={vodPlayer}
            nativeControls
            contentFit="contain"
          />
        ) : (
          <Ionicons name="videocam-off" size={64} color="#E74C3C" />
        )}
        <Text style={[styles.loadingText, { marginTop: 16, marginBottom: 8 }]}>
          This live stream has ended
        </Text>
        <TouchableOpacity
          style={styles.endedGoBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.endedGoBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <PanGestureHandler
      onGestureEvent={handleSwipeGesture}
      onHandlerStateChange={handleSwipeStateChange}
      enabled={swipeEnabled}
    >
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: swipeTranslateX }],
            opacity: swipeOpacity,
          },
        ]}
      >
      {/* Full Screen Video with Tap Gesture */}
      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={handleScreenTap}
      >
        {stream.status === 'live' ? (
          // ✅ LIVE: Direct RTC connection (like TikTok/Instagram Live)
          isAgoraJoined && remoteUid ? (
            <RtcSurfaceView
              style={styles.video}
              canvas={{
                uid: remoteUid,
                renderMode: RenderModeType.RenderModeFit,
              }}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <ActivityIndicator size="large" color="#3498DB" />
              <Text style={styles.videoPlaceholderText}>Connecting to host...</Text>
              <Text style={[styles.videoPlaceholderText, { fontSize: 12, marginTop: 8, opacity: 0.7 }]}>
                {!isAgoraJoined ? 'Joining channel...' : 'Waiting for host...'}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam-off" size={60} color="#666" />
            <Text style={styles.videoPlaceholderText}>
              {stream.status === 'setup' ? 'Stream starting soon...' : 'Stream not available'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Watch Reward Countdown */}
      {stream?.id && <WatchRewardPill streamId={stream.id} />}

      {/* Pause Overlay - Creative Design */}
      {isStreamPaused && stream.status === 'live' && (
        <Animated.View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.pauseOverlayContent}>
            <Animated.View 
              style={[
                styles.pauseIconContainer,
                {
                  transform: [{ scale: pausePulseAnim }],
                }
              ]}
            >
              <Ionicons name="pause-circle" size={80} color="rgba(255, 255, 255, 0.95)" />
            </Animated.View>
            <Text style={styles.pauseTitle}>Host Paused</Text>
            <Text style={styles.pauseSubtitle}>The live stream is paused</Text>
            <Animated.View 
              style={[
                styles.pausePulse,
                {
                  transform: [{ scale: pausePulseAnim }],
                  opacity: pausePulseAnim.interpolate({
                    inputRange: [1, 1.3],
                    outputRange: [0.2, 0.05],
                  }),
                }
              ]} 
            />
          </View>
        </Animated.View>
      )}

      {(isHostVideoMuted || isHostAudioMuted) && stream.status === 'live' && !isStreamPaused && (
        <View style={styles.hostMuteOverlay} pointerEvents="none">
          <View style={styles.hostMuteOverlayContent}>
            {isHostVideoMuted && (
              <View style={styles.hostMuteRow}>
                <Ionicons name="videocam-off" size={22} color="rgba(255,255,255,0.95)" />
                <Text style={styles.hostMuteText}>Host turned off video</Text>
              </View>
            )}
            {isHostAudioMuted && (
              <View style={styles.hostMuteRow}>
                <Ionicons name="mic-off" size={22} color="rgba(255,255,255,0.95)" />
                <Text style={styles.hostMuteText}>Host muted microphone</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Heart Animations Overlay */}
      <View style={styles.heartsOverlay} pointerEvents="none">
        {heartAnimations.map((heart) => (
          <Animated.View
            key={heart.id}
            style={[
              styles.heartAnimation,
              {
                left: heart.x,
                top: heart.y,
                transform: [{ scale: heart.scale }],
                opacity: heart.opacity,
              },
            ]}
          >
            <Animated.Text
              style={[
                styles.heartEmoji,
                {
                  transform: [{ translateY: heart.translateY }],
                  opacity: heart.opacity,
                },
              ]}
            >
              ❤️
            </Animated.Text>
          </Animated.View>
        ))}
      </View>

      {/* Dynamic Highlight Card */}
      {highlightedItem && (
        <View style={styles.highlightCard}>
          <TouchableOpacity
            onPress={() => {
              let imageUrls: string[] = [];
              let initialIndex = 0;

              if ('product' in highlightedItem) {
                const primary = (highlightedItem as LiveStreamProduct).product.primary_image_url;
                if (primary) imageUrls = [primary];
              } else if ('images' in highlightedItem) {
                const portfolio = highlightedItem as LivePortfolioService;
                imageUrls = portfolio.images?.map((img) => img.image_url) || [];
                initialIndex = portfolio.images?.findIndex((img) => img.is_primary) ?? 0;
                if (initialIndex < 0) initialIndex = 0;
              } else if (isServiceItem(highlightedItem)) {
                const svc = (highlightedItem as LiveStreamService).service;
                const videoUri = svc?.media_type === 'video'
                  ? (svc?.videos?.[0] || svc?.primary_media_url)
                  : undefined;
                if (videoUri) {
                  setMediaViewerUri(videoUri);
                  setMediaViewerVisible(true);
                  return;
                }
                imageUrls = svc?.images?.length
                  ? svc.images
                  : (svc?.media_type === 'image' && svc?.primary_media_url ? [svc.primary_media_url] : []);
              }

              if (imageUrls.length > 0) {
                setImageViewerImages(imageUrls);
                setImageViewerIndex(initialIndex);
                setImageViewerVisible(true);
              }
            }}
            activeOpacity={0.8}
          >
            {isServiceItem(highlightedItem) && !getShowcaseImageUrl(highlightedItem) ? (
              <View style={[styles.highlightCardImage, styles.showcaseServiceIcon]}>
                <Ionicons name="briefcase" size={24} color="#3498DB" />
              </View>
            ) : (
              <Image
                source={{
                  uri: 'product' in highlightedItem
                    ? (highlightedItem as LiveStreamProduct).product.primary_image_url || 'https://via.placeholder.com/80'
                    : 'images' in highlightedItem
                    ? (highlightedItem as LivePortfolioService).images.find(img => img.is_primary)?.image_url || (highlightedItem as LivePortfolioService).images[0]?.image_url || 'https://via.placeholder.com/80'
                    : getShowcaseImageUrl(highlightedItem) || 'https://via.placeholder.com/80'
                }}
                style={styles.highlightCardImage}
              />
            )}
          </TouchableOpacity>
          <View style={styles.highlightCardInfo}>
            <Text style={styles.highlightCardTitle} numberOfLines={1}>
              {'product' in highlightedItem
                ? (highlightedItem as LiveStreamProduct).product.name
                : 'title' in highlightedItem
                ? (highlightedItem as LivePortfolioService).title
                : (highlightedItem as LiveStreamService).service?.name}
            </Text>
            <Text style={styles.highlightCardPrice}>
              ₣{'price' in highlightedItem
                ? (highlightedItem as LivePortfolioService).price
                : highlightedItem.live_price}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.highlightCardAddButton}
            onPress={() =>
              isProductItem(highlightedItem)
                ? handleAddProduct(highlightedItem, 'highlight')
                : handleBookPress(highlightedItem, 'highlight')
            }
          >
            {isProductItem(highlightedItem) ? (
              <>
                <Ionicons name="cart" size={18} color="white" />
                <Text style={styles.highlightCardAddButtonText}>Add to Cart</Text>
              </>
            ) : (
              <>
                <Ionicons name="calendar" size={18} color="white" />
                <Text style={styles.highlightCardAddButtonText}>Book</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Showcase Overlay for Viewers */}
      {showcasedItem && (
        <View style={styles.showcaseOverlay}>
          <View style={styles.showcaseCard}>
            {/* Image or Icon based on item type */}
            {getShowcaseImageUrl(showcasedItem) ? (
              <Image
                source={{ uri: getShowcaseImageUrl(showcasedItem) }}
                style={styles.showcaseImage}
                onError={(e) => {
                  console.error('Error loading showcase image:', e.nativeEvent.error);
                }}
              />
            ) : isServiceItem(showcasedItem) ? (
              <View style={[styles.showcaseImage, styles.showcaseServiceIcon]}>
                <Ionicons name="briefcase" size={60} color="#3498DB" />
              </View>
            ) : (
              <View style={[styles.showcaseImage, styles.showcaseServiceIcon]}>
                <Ionicons name="image-outline" size={60} color="#666" />
              </View>
            )}
            
            <View style={styles.showcaseInfo}>
              <Text style={styles.showcaseTitle}>{getShowcaseItemName(showcasedItem)}</Text>
              <Text style={styles.showcasePrice}>₣{showcasedItem.live_price || showcasedItem.price || '0.00'}</Text>
              <TouchableOpacity
                style={styles.showcaseAddToCartButton}
                onPress={() =>
                  isProductItem(showcasedItem)
                    ? handleAddProduct(showcasedItem, 'showcase')
                    : handleBookPress(showcasedItem, 'showcase')
                }
              >
                {isProductItem(showcasedItem) ? (
                  <>
                    <Ionicons name="bag-add" size={20} color="white" />
                    <Text style={styles.showcaseAddToCartText}>Add to Cart</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="calendar" size={20} color="white" />
                    <Text style={styles.showcaseAddToCartText}>Book</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.showcaseCloseButton}
              onPress={() => setShowcasedItem(null)}
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Top Overlay - Host Info */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>

        <View style={styles.hostInfo}>
          <Image
            source={{ uri: stream.vendor.avatar_url || 'https://via.placeholder.com/40' }}
            style={styles.hostAvatar}
          />
          <View style={styles.hostDetails}>
            <Text style={styles.hostName}>{stream.vendor.username}</Text>
            <View style={styles.liveInfo}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.viewerCount}>{(viewerCount || 0).toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Swipe Indicators */}
      {swipeEnabled && (
        <>
          {/* Left swipe indicator (vendor store) */}
          <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorLeft, { opacity: swipeIndicatorOpacity }]}>
            <Ionicons name="storefront" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={styles.swipeIndicatorText}>Store</Text>
          </Animated.View>

          {/* Right swipe indicator (back to discovery) */}
          <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorRight, { opacity: swipeIndicatorOpacity }]}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={styles.swipeIndicatorText}>Discover</Text>
          </Animated.View>
        </>
      )}

      {/* Gift Animations - Render above video */}
      <GiftEffectStage>
        {activeGiftEffects.map((animation) => (
          <LottieGiftEffect
            key={animation.id}
            gift={animation.gift}
            onComplete={() => {
              setActiveGiftEffects((prev) => prev.filter((anim) => anim.id !== animation.id));
            }}
          />
        ))}
      </GiftEffectStage>

      {/* Middle Comments */}
      {showComments && comments.length > 0 && (
        <View style={styles.middleComments}>
          <FlatList
            ref={commentsListRef}
            data={comments.slice(-5)} // Show last 5 comments
            renderItem={renderCommentItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            showsVerticalScrollIndicator={false}
            style={styles.commentsList}
            inverted={false}
          />
        </View>
      )}

      {/* Bottom Controls */}
      {isCommentInputExpanded && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => {
            setIsCommentInputExpanded(false);
            Keyboard.dismiss();
          }}
        />
      )}
      <Animated.View
        style={[
          styles.bottomControls,
          {
            bottom: bottomPosition,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {!isCommentInputExpanded ? (
          // Compact bottom bar
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.commentInputCompact}
              onPress={() => setIsCommentInputExpanded(true)}
            >
              <Text style={styles.commentPlaceholder}>Add a comment...</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={openShopModal}>
              <Ionicons name="bag-handle" size={24} color="white" />
              {liveCartItems.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{liveCartItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={openGiftModal}>
              <Ionicons name="gift" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={openShareModal}>
              <Ionicons name="share-social" size={24} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          // Expanded comment input
          <View style={styles.expandedCommentContainer}>
            <View style={styles.expandedCommentInput}>
              <TextInput
                style={styles.expandedCommentText}
                placeholder="Add a comment..."
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={handleSendComment}
                onFocus={handleCommentInputFocus}
                onBlur={handleCommentInputBlur}
                autoFocus
                returnKeyType="send"
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.sendButtonExpanded, !commentText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendComment}
              disabled={!commentText.trim()}
            >
              <Ionicons name="send" size={20} color={commentText.trim() ? '#007AFF' : '#666'} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Shop Modal */}
      <Modal
        visible={showShopModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShopModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowShopModal(false)}
        />
        <ShopModal
            visible={showShopModal}
            onClose={() => setShowShopModal(false)}
            items={shopItems}
            portfolioItems={portfolioItems}
            modalHeight={shopModalHeight}
            onHeightChange={setShopModalHeight}
            cartItems={liveCartItems}
            onAddToCart={addToLiveCart}
            onOpenCart={() => {
              setShowShopModal(false);
              setShowMiniCart(true);
            }}
            insetsBottom={insets.bottom || 0}
            streamId={stream?.id}
          />
      </Modal>

      {/* Mini Cart Modal */}
      <Modal
        visible={showMiniCart}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMiniCart(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMiniCart(false)}
        />
        <MiniCartModal
            visible={showMiniCart}
            onClose={() => setShowMiniCart(false)}
            cartItems={liveCartItems}
            modalHeight={miniCartModalHeight}
            onHeightChange={setMiniCartModalHeight}
            onUpdateQuantity={updateLiveCartQuantity}
            onRemoveItem={removeFromLiveCart}
            insetsBottom={insets.bottom || 0}
            onCheckout={() => {
              setShowMiniCart(false);
              navigation.navigate('LiveCartCheckout', {
                streamId,
                cartItems: liveCartItems,
                streamTitle: stream.title,
                vendorId: stream.vendor.id,
                vendorLocation: stream.vendor?.location,
                onCheckoutSuccess: clearLiveCart,
              });
            }}
          />
      </Modal>

      {/* Gift Selector Modal */}
      <GiftSelectorModal
        visible={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        gifts={availableGifts}
        loading={loadingGifts}
        title="Send a Gift"
        subtitle="Select a gift to send to the stream"
        onSendGift={async (giftId: string, quantity: number) => {
          try {
            if (!stream?.vendor?.id || !user?.id) {
              Alert.alert('Error', 'Cannot send gift: missing stream or user info');
              return;
            }
            if (!stream?.id) {
              Alert.alert('Error', 'Cannot send gift: stream session not active');
              return;
            }
            if (quantity <= 0 || quantity > 10) {
              Alert.alert('Error', 'Gift quantity must be between 1 and 10');
              return;
            }

            const gift = availableGifts.find((g) => g.gift_id === giftId);
            if (!gift) {
              Alert.alert('Error', 'Gift not found in your inventory');
              return;
            }
            if (gift.quantity < quantity) {
              Alert.alert('Insufficient Gifts', `You only have ${gift.quantity} of this gift.`);
              return;
            }

            liveStreamSocket.sendGift(gift.gift_id, quantity);
            await loadAvailableGifts();
          } catch (error: any) {
            console.error('Error sending gift:', error);
            const errorMessage = error.message || 'Failed to send gift';
            if (errorMessage.includes('only have') || errorMessage.includes('Insufficient')) {
              Alert.alert('Insufficient Gifts', errorMessage);
            } else if (errorMessage.includes('not found')) {
              Alert.alert('Gift Not Found', 'The selected gift is no longer available');
            } else {
              Alert.alert('Error', errorMessage);
            }
          }
        }}
      />

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowShareModal(false)}
        />
        <ShareModal
            visible={showShareModal}
            onClose={() => setShowShareModal(false)}
            modalHeight={shareModalHeight}
            onHeightChange={setShareModalHeight}
            conversations={chatConversations}
            conversationsLoading={chatConversationsLoading}
            selectedUsers={selectedUsers}
            onUserSelect={setSelectedUsers}
            insetsBottom={insets.bottom || 0}
            onShare={handleShareToChats}
            onShareExternal={handleShareExternally}
            isSharing={isSharing}
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

          {imageViewerImages.length > 0 && (
            <View style={styles.imageViewerContainer}>
              <FlatList
                data={imageViewerImages}
                keyExtractor={(url, index) => `${url}-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.imageViewerSlide}>
                    <Image
                      source={{ uri: item }}
                      style={styles.imageViewerImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={imageViewerIndex}
                getItemLayout={(data, index) => ({
                  length: screenWidth,
                  offset: screenWidth * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                  setImageViewerIndex(newIndex);
                }}
                style={styles.imageViewerList}
                contentContainerStyle={styles.imageViewerListContent}
              />

              {imageViewerImages.length > 1 && (
                <View style={styles.imageViewerDots}>
                  {imageViewerImages.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.imageViewerDot,
                        index === imageViewerIndex && styles.imageViewerDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Video viewer for services whose primary media is a video */}
      <MediaViewerModal
        visible={mediaViewerVisible}
        onClose={() => setMediaViewerVisible(false)}
        type="video"
        uri={mediaViewerUri}
      />

      {/* Booking Modal for Services and Portfolio */}
      <LiveBookingModal
        visible={showBookingModal}
        item={bookingItem}
        onClose={() => {
          setShowBookingModal(false);
          setBookingItem(null);
          setBookingSource(null);
        }}
        onConfirm={handleBookingConfirm}
      />
      </Animated.View>
    </PanGestureHandler>
  );
};

const LiveBookingModal = ({
  visible,
  item,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  item: any;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      setSelectedDate(tomorrow);
      setSelectedTime(tomorrow);
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible]);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (time) {
      setSelectedTime(time);
    }
  };

  const handleConfirm = () => {
    const bookingDateTime = new Date(selectedDate);
    bookingDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    const now = new Date();

    if (bookingDateTime <= now) {
      Alert.alert('Invalid Date/Time', 'Please select a future date and time.');
      return;
    }

    const formattedDate = selectedDate.toISOString().split('T')[0];
    const formattedTime = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
    onConfirm(formattedDate, formattedTime);
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDisplayTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const itemName = item?.title || item?.service?.name || item?.product?.name || 'Item';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.bookingModalOverlay}>
        <View style={styles.bookingModalContent}>
          <View style={styles.bookingModalHeader}>
            <Text style={styles.bookingModalTitle}>Book {itemName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.bookingModalCloseButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bookingModalBody}>
            <Text style={styles.bookingModalLabel}>Select Date</Text>
            <TouchableOpacity
              style={styles.dateTimePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#3498DB" />
              <Text style={styles.dateTimePickerText}>{formatDisplayDate(selectedDate)}</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                themeVariant="dark"
                textColor="#FFFFFF"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
            {Platform.OS === 'android' && showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            <Text style={styles.bookingModalLabel}>Select Time</Text>
            <TouchableOpacity
              style={styles.dateTimePickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color="#3498DB" />
              <Text style={styles.dateTimePickerText}>{formatDisplayTime(selectedTime)}</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                themeVariant="dark"
                textColor="#FFFFFF"
                onChange={handleTimeChange}
              />
            )}
            {Platform.OS === 'android' && showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}

            <TouchableOpacity style={styles.bookingModalConfirm} onPress={handleConfirm}>
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={styles.bookingModalConfirmText}>Confirm Booking</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  },
  vodPlayer: {
    width: screenWidth,
    height: screenHeight * 0.6,
    backgroundColor: 'black',
  },
  endedGoBackButton: {
    marginTop: 24,
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  endedGoBackButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoPlaceholderText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  // Heart animations
  heartsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  heartAnimation: {
    position: 'absolute',
  },
  heartEmoji: {
    fontSize: 30,
  },
  // Reaction animations (legacy from old code)
  reactionBubble: {
    position: 'absolute',
    bottom: 0,
  },
  reactionEmoji: {
    fontSize: 40,
  },
  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  hostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FF0050',
  },
  hostDetails: {
    marginLeft: 10,
    flex: 1,
  },
  hostName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  liveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0050',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 4,
  },
  liveText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewerCount: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  // Middle comments
  middleComments: {
    position: 'absolute',
    left: 20,
    right: 100,
    bottom: 150,
    maxHeight: 200,
  },
  commentsList: {
    flexGrow: 0,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    maxWidth: '100%',
  },
  commentUser: {
    color: '#00F2EA',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  commentText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
  },
  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  commentInputCompact: {
    flex: 1,
    maxWidth: screenWidth * 0.55,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  commentPlaceholder: {
    color: '#CCC',
    fontSize: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  // Expanded comment input
  expandedCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  expandedCommentInput: {
    flex: 1,
    marginRight: 10,
  },
  expandedCommentText: {
    color: 'white',
    fontSize: 16,
    minHeight: 20,
    maxHeight: 80,
  },
  sendButtonExpanded: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,255,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
  },
  // Shop modal
  shopModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  giftModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 15,
  },
  cartButton: {
    position: 'relative',
    padding: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF0050',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  shopItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  shopItemServiceIcon: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  shopItemServiceBadge: {
    fontSize: 10,
    color: '#3498DB',
    fontWeight: '600',
    marginTop: 2,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeSlotsText: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
  },
  shopItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  shopItemName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  shopItemPrice: {
    color: '#00F2EA',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0050',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addToCartButtonAdded: {
    backgroundColor: '#27AE60',
  },
  addToCartText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Shop sections
  shopSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  portfolioSection: {
    marginBottom: 20,
  },
  portfolioSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  portfolioSectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  portfolioItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  portfolioImageContainer: {
    position: 'relative',
  },
  portfolioImageWrapper: {
    width: screenWidth - 32, // Full width minus margins
    position: 'relative',
  },
  portfolioItemImage: {
    width: screenWidth - 32,
    height: 200,
  },
  imageCaptionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
  },
  imageCaptionText: {
    color: 'white',
    fontSize: 12,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  imageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  imageIndicatorActive: {
    backgroundColor: 'white',
    width: 20,
  },
  portfolioItemOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  portfolioItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  portfolioItemBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  portfolioItemInfo: {
    padding: 12,
  },
  portfolioItemTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  portfolioItemDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
  },
  portfolioItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portfolioItemPrice: {
    color: '#3498DB',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bookServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookServiceButtonAdded: {
    backgroundColor: '#27AE60',
  },
  bookServiceButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyShopState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyShopText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  
  // Gift modal
  giftItem: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    margin: 4,
    minHeight: 80,
  },
  giftEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  giftName: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  giftQuantity: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  giftItemDisabled: {
    opacity: 0.4,
  },
  giftItemSelected: {
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  giftGridContent: {
    paddingBottom: 20,
  },
  sendButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 8,
  },
  sendButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  giftLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  giftLoadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    marginTop: 12,
  },
  giftEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  giftEmptyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  giftEmptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Mini cart modal
  miniCartContainer: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  miniCartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  miniCartTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyMiniCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyMiniCartText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyMiniCartSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  miniCartList: {
    flex: 1,
    marginBottom: 20,
  },
  miniCartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  miniCartItemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  miniCartItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  miniCartItemName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  miniCartItemPrice: {
    color: '#00F2EA',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  miniCartQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  miniCartQuantityButton: {
    backgroundColor: '#3498DB',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCartQuantityText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  miniCartRemoveButton: {
    padding: 6,
  },
  miniCartFooter: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 16,
  },
  miniCartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  miniCartTotalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  miniCartTotalValue: {
    color: '#00F2EA',
    fontSize: 18,
    fontWeight: 'bold',
  },
  miniCartCheckoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF0050',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  miniCartCheckoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Share modal
  shareModalContainer: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  shareModalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  shareSubtitle: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 15,
  },
  usersList: {
    flex: 1,
    marginBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userItemSelected: {
    backgroundColor: '#FF0050',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  userNameSelected: {
    color: 'white',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00F2EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: '#FF0050',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: '#333',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Swipe indicators
  swipeIndicator: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  swipeIndicatorLeft: {
    right: 20,
    transform: [{ translateY: -20 }],
  },
  swipeIndicatorRight: {
    left: 20,
    transform: [{ translateY: -20 }],
  },
  swipeIndicatorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  // Pause overlay - Creative Design
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  pauseOverlayContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pauseIconContainer: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 2,
  },
  pauseTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pauseSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  hostMuteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9997,
  },
  hostMuteOverlayContent: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 220,
  },
  hostMuteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  hostMuteText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '600',
  },
  pausePulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
    top: -20,
  },

  // Showcase styles
  showcaseOverlay: {
    position: 'absolute',
    top: '20%',
    left: 20,
    right: 20,
    zIndex: 15,
  },
  showcaseCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FF0050',
  },
  showcaseImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  showcaseServiceIcon: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3498DB',
  },
  showcaseInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  showcaseTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  showcasePrice: {
    color: '#00F2EA',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  showcaseAddToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0050',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  showcaseAddToCartText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  showcaseCloseButton: {
    padding: 8,
    marginLeft: 8,
  },
  // Highlight Card Styles
  highlightCard: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    elevation: 10,
    pointerEvents: 'auto',
  },
  highlightCardTransparent: {
    backgroundColor: 'rgba(0,0,0,0)',
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  highlightCardVisible: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    opacity: 1,
    height: 'auto',
  },
  highlightCardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  highlightCardInfo: {
    flex: 1,
  },
  highlightCardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  highlightCardPrice: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  highlightCardAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8E44AD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  highlightCardAddButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  // Booking Modal Styles
  bookingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  bookingModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  bookingModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  bookingModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  bookingModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingModalBody: {
    padding: 20,
  },
  bookingModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  dateTimePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  dateTimePickerText: {
    fontSize: 16,
    color: 'white',
    flex: 1,
  },
  notesInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: 'white',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  bookingModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#3498DB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bookingModalConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 12,
    padding: 16,
    marginTop: 30,
    marginBottom: 20,
    gap: 8,
  },
  bookingModalConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bookingInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  bookingInfoText: {
    fontSize: 12,
    color: '#3498DB',
    marginLeft: 4,
  },
  // Image Viewer Modal Styles
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
  imageViewerList: {
    flex: 1,
    width: '100%',
  },
  imageViewerListContent: {
    alignItems: 'center',
  },
  imageViewerSlide: {
    width: screenWidth,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerDots: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageViewerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  imageViewerDotActive: {
    backgroundColor: 'white',
    width: 10,
    height: 10,
    borderRadius: 5,
  },

});

// Shop Modal Component
const ShopModal = ({ visible, onClose, items, portfolioItems, modalHeight, onHeightChange, cartItems, onAddToCart, onOpenCart, insetsBottom = 0, streamId }: any) => {
  const panRef = useRef<any>(null);
  // Service booking picker — services need a date/time before adding to cart
  const [serviceBookingItem, setServiceBookingItem] = React.useState<any>(null);
  const baseHeight = useRef(modalHeight);
  const animatedHeight = useRef(new Animated.Value(modalHeight)).current;
  
  // Update animated height when prop changes
  React.useEffect(() => {
    Animated.spring(animatedHeight, {
      toValue: modalHeight,
      useNativeDriver: false, // Height requires layout animations
      tension: 300,
      friction: 30,
    }).start();
    baseHeight.current = modalHeight;
  }, [modalHeight]);

  const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationY } = event.nativeEvent;
    const screenHeight = Dimensions.get('window').height;
    const newHeight = Math.max(
      screenHeight * 0.5, // Minimum 50% height
      baseHeight.current - translationY
    );
    const finalHeight = Math.min(newHeight, screenHeight);
    
    // Update animated height in real-time for smooth drag
    animatedHeight.setValue(finalHeight);
    // Also update parent state
    onHeightChange(finalHeight);
  };

  const onPanHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      baseHeight.current = modalHeight;
    } else if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;

      // Snap to 50%, 75%, or 100% screen
      const screenHeight = Dimensions.get('window').height;
      const currentHeight = modalHeight;

      if (velocityY > 500 || translationY > 100) {
        // Close modal
        onClose();
      } else {
        // Snap to nearest position
        let targetHeight: number;
        if (currentHeight < screenHeight * 0.65) {
          targetHeight = screenHeight * 0.5; // Snap to 50%
        } else if (currentHeight < screenHeight * 0.85) {
          targetHeight = screenHeight * 0.75; // Snap to 75%
        } else {
          targetHeight = screenHeight; // Snap to 100%
        }
        
        // Animate to target height
        Animated.spring(animatedHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          tension: 300,
          friction: 30,
        }).start();
        
        onHeightChange(targetHeight);
      }
    }
  };

  const renderShopItem = ({ item }: any) => {
    const isInCart = cartItems.some((cartItem: any) => cartItem.id === item.id);
    const cartItem = cartItems.find((ci: any) => ci.id === item.id);
    const isProduct = 'product' in item;
    const isService = 'service' in item;

    // Helper to get image URL based on item type
    const getImageUrl = () => {
      if (isProduct) {
        return item.product?.primary_image_url || 'https://via.placeholder.com/60?text=Product';
      }
      if (isService) {
        const svc = item.service;
        return svc?.images?.[0]
          || (svc?.media_type === 'image' ? svc?.primary_media_url : undefined)
          || null;
      }
      return null;
    };

    // Helper to get item name
    const getItemName = () => {
      if (isProduct) {
        return item.product?.name || 'Product';
      }
      if (isService) {
        return item.service?.name || 'Service';
      }
      return 'Item';
    };

    const imageUrl = getImageUrl();

    return (
      <TouchableOpacity style={styles.shopItem}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.shopItemImage}
          />
        ) : (
          <View style={[styles.shopItemImage, styles.shopItemServiceIcon]}>
            <Ionicons name="briefcase" size={24} color="#3498DB" />
          </View>
        )}
        <View style={styles.shopItemInfo}>
          <Text style={styles.shopItemName}>{getItemName()}</Text>
          <Text style={styles.shopItemPrice}>₣{item.live_price}</Text>
          {isService && (
            <>
              <Text style={styles.shopItemServiceBadge}>Service</Text>
              {cartItem?.bookingDate && cartItem?.bookingTime ? (
                <View style={styles.timeSlotsContainer}>
                  <Ionicons name="calendar" size={12} color="#3498DB" />
                  <Text style={styles.timeSlotsText}>
                    {cartItem.bookingDate} at {cartItem.bookingTime}
                  </Text>
                </View>
              ) : item.available_slots && item.available_slots.length > 0 ? (
                <View style={styles.timeSlotsContainer}>
                  <Ionicons name="time" size={12} color="#3498DB" />
                  <Text style={styles.timeSlotsText}>
                    {item.available_slots.filter((slot: any) => slot.available).length} slots available
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addToCartButton, isInCart && styles.addToCartButtonAdded]}
          onPress={() => {
            if (isService) {
              if (!isInCart) setServiceBookingItem(item);
            } else {
              onAddToCart(item, 1);
            }
          }}
        >
          <Ionicons
            name={isInCart ? "checkmark" : isService ? "calendar" : "add"}
            size={16}
            color="white"
          />
          <Text style={styles.addToCartText}>
            {isInCart ? "Added" : isService ? "Book" : "Add"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // PortfolioItem component - separate component to properly use hooks
  const PortfolioItem = ({ item, cartItems, onAddToCart }: { item: any, cartItems: any[], onAddToCart: (item: any, quantity: number, bookingDate?: string, bookingTime?: string) => void }) => {
    const isInCart = cartItems.some((cartItem: any) => cartItem.id === item.id);
    const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
    const [showBookingModal, setShowBookingModal] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState(new Date());
    const [selectedTime, setSelectedTime] = React.useState(new Date());
    const [showDatePicker, setShowDatePicker] = React.useState(false);
    const [showTimePicker, setShowTimePicker] = React.useState(false);
    const [serviceNotes, setServiceNotes] = React.useState('');

    // Get cart item to show selected date/time if already in cart
    const cartItem = cartItems.find((cartItem: any) => cartItem.id === item.id);
    const hasBookingInfo = cartItem?.bookingDate && cartItem?.bookingTime;

    const handleBookPress = () => {
      if (isInCart) {
        // Already booked, do nothing or show booking details
        return;
      }
      // Show booking modal to select date/time
      setShowBookingModal(true);
      // Set initial date/time to tomorrow at 10 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      setSelectedDate(tomorrow);
      setSelectedTime(tomorrow);
    };

    const handleDateChange = (event: any, date?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      if (date) {
        setSelectedDate(date);
      }
    };

    const handleTimeChange = (event: any, time?: Date) => {
      if (Platform.OS === 'android') {
        setShowTimePicker(false);
      }
      if (time) {
        setSelectedTime(time);
      }
    };

    const handleConfirmBooking = () => {
      // Validate date/time is in the future
      const bookingDateTime = new Date(selectedDate);
      bookingDateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      const now = new Date();

      if (bookingDateTime <= now) {
        Alert.alert('Invalid Date/Time', 'Please select a future date and time for the service.');
        return;
      }

      // Format date as YYYY-MM-DD
      const formattedDate = selectedDate.toISOString().split('T')[0];
      // Format time as HH:MM
      const formattedTime = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;

      // Add to cart with booking date/time
      onAddToCart(item, 1, formattedDate, formattedTime);
      setShowBookingModal(false);
      setServiceNotes('');
    };

    const formatDisplayDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };

    const formatDisplayTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    };

    return (
      <>
        <View style={styles.portfolioItem}>
          {/* Image Gallery */}
          {item.images && item.images.length > 0 ? (
            <View style={styles.portfolioImageContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                  setCurrentImageIndex(index);
                }}
              >
                {item.images.map((img: any, index: number) => (
                  <View key={index} style={styles.portfolioImageWrapper}>
                    <Image
                      source={{ uri: img.image_url }}
                      style={styles.portfolioItemImage}
                    />
                    {img.caption && (
                      <View style={styles.imageCaptionOverlay}>
                        <Text style={styles.imageCaptionText}>{img.caption}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
              {item.images.length > 1 && (
                <View style={styles.imageIndicators}>
                  {item.images.map((_: any, index: number) => (
                    <View
                      key={index}
                      style={[
                        styles.imageIndicator,
                        index === currentImageIndex && styles.imageIndicatorActive
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Image
              source={{ uri: 'https://via.placeholder.com/200x200' }}
              style={styles.portfolioItemImage}
            />
          )}
          
          <View style={styles.portfolioItemOverlay}>
            <View style={styles.portfolioItemBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.portfolioItemBadgeText}>{item.category.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
          
          <View style={styles.portfolioItemInfo}>
            <Text style={styles.portfolioItemTitle}>{item.title}</Text>
            <Text style={styles.portfolioItemDescription} numberOfLines={2}>{item.description}</Text>
            {hasBookingInfo && (
              <View style={styles.bookingInfoContainer}>
                <Ionicons name="calendar-outline" size={12} color="#3498DB" />
                <Text style={styles.bookingInfoText}>
                  {cartItem.bookingDate} at {cartItem.bookingTime}
                </Text>
              </View>
            )}
            <View style={styles.portfolioItemFooter}>
              <Text style={styles.portfolioItemPrice}>₣{item.price}</Text>
              <TouchableOpacity
                style={[styles.bookServiceButton, isInCart && styles.bookServiceButtonAdded]}
                onPress={handleBookPress}
              >
                <Ionicons
                  name={isInCart ? "checkmark" : "calendar"}
                  size={14}
                  color="white"
                />
                <Text style={styles.bookServiceButtonText}>
                  {isInCart ? "Booked" : "Book"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Booking Date/Time Modal */}
        <Modal
          visible={showBookingModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowBookingModal(false)}
        >
          <View style={styles.bookingModalOverlay}>
            <View style={styles.bookingModalContent}>
              <View style={styles.bookingModalHeader}>
                <Text style={styles.bookingModalTitle}>Schedule Service</Text>
                <TouchableOpacity
                  onPress={() => setShowBookingModal(false)}
                  style={styles.bookingModalCloseButton}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.bookingModalBody}>
                <Text style={styles.bookingModalLabel}>Select Date</Text>
                <TouchableOpacity
                  style={styles.dateTimePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#3498DB" />
                  <Text style={styles.dateTimePickerText}>
                    {formatDisplayDate(selectedDate)}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.bookingModalLabel}>Select Time</Text>
                <TouchableOpacity
                  style={styles.dateTimePickerButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#3498DB" />
                  <Text style={styles.dateTimePickerText}>
                    {formatDisplayTime(selectedTime)}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.bookingModalLabel}>Special Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add any special requirements..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  value={serviceNotes}
                  onChangeText={setServiceNotes}
                />

                {Platform.OS === 'ios' && showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="spinner"
                    themeVariant="dark"
                    textColor="#FFFFFF"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}

                {Platform.OS === 'ios' && showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display="spinner"
                    themeVariant="dark"
                    textColor="#FFFFFF"
                    onChange={handleTimeChange}
                  />
                )}
              </ScrollView>

              <View style={styles.bookingModalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowBookingModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirmBooking}
                >
                  <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Android Date/Time Pickers */}
        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {Platform.OS === 'android' && showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </>
    );
  };

  return (
      <View style={styles.modalOverlay} pointerEvents="box-none">
        {/* Backdrop - tap to close */}
        <TouchableOpacity 
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        activeOffsetY={-10}
        failOffsetY={50}
      >
        <Animated.View 
          style={[styles.modalContainer, { height: animatedHeight }]}
          pointerEvents="box-none"
        >
          <View style={styles.modalHandle} />

          {/* Modal Header with Cart Icon and Close Button */}
          <View style={styles.shopModalHeader}>
            <Text style={styles.modalTitle}>Shop</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity style={styles.cartButton} onPress={onOpenCart}>
                <Ionicons name="bag-handle" size={24} color="white" />
                {cartItems.length > 0 && (
                  <View style={styles.cartBadge} pointerEvents="none">
                    <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 + (insetsBottom || 0) }}
            bounces={false}
            scrollEventThrottle={16}
          >
            {streamId ? (
              <WatchRewardPill streamId={streamId} mode="inline" />
            ) : null}

            {/* Regular Shop Items */}
            {items.length > 0 && (
              <View style={styles.shopSection}>
                <Text style={styles.sectionTitle}>Products & Services</Text>
                {items.map((item: LiveStreamProduct | LiveStreamService) => (
                  <View key={item.id}>
                    {renderShopItem({ item })}
                  </View>
                ))}
              </View>
            )}

            {/* Portfolio Section */}
            {portfolioItems && portfolioItems.length > 0 && (
              <View style={styles.portfolioSection}>
                <View style={styles.portfolioSectionHeader}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.portfolioSectionTitle}>Featured Portfolio</Text>
                </View>
                {portfolioItems.map((item: LivePortfolioService) => (
                  <PortfolioItem
                    key={item.id}
                    item={item}
                    cartItems={cartItems}
                    onAddToCart={onAddToCart}
                  />
                ))}
              </View>
            )}

            {/* Empty State */}
            {items.length === 0 && (!portfolioItems || portfolioItems.length === 0) && (
              <View style={styles.emptyShopState}>
                <Ionicons name="bag-outline" size={50} color="#666" />
                <Text style={styles.emptyShopText}>No items available</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </PanGestureHandler>

      {/* Booking picker for stream services (same modal the showcase path uses) */}
      <LiveBookingModal
        visible={!!serviceBookingItem}
        item={serviceBookingItem}
        onClose={() => setServiceBookingItem(null)}
        onConfirm={(date: string, time: string) => {
          onAddToCart(serviceBookingItem, 1, date, time);
          setServiceBookingItem(null);
        }}
      />
    </View>
  );
};

// Gift Modal Component
const GiftModal = ({ visible, onClose, availableGifts, loadingGifts, modalHeight, onHeightChange, onSendGift, insetsBottom = 0, streamId }: any) => {
  const panRef = useRef<any>(null);
  const baseHeight = useRef(modalHeight);
  const animatedHeight = useRef(new Animated.Value(modalHeight)).current;
  const [selectedGift, setSelectedGift] = useState<{id: string, emoji: string, name: string, quantity: number} | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedGift(null);
      setSending(false);
    }
  }, [visible]);

  const handleSelectGift = (item: {id: string, emoji: string, name: string, quantity: number}) => {
    setSelectedGift(item);
  };

  const handleSend = async () => {
    if (!selectedGift || sending) return;
    setSending(true);
    try {
      await onSendGift(selectedGift.id, 1);
      onClose();
    } catch (error) {
      setSending(false);
    }
  };

  // Update animated height when prop changes
  React.useEffect(() => {
    Animated.spring(animatedHeight, {
      toValue: modalHeight,
      useNativeDriver: false, // Height requires layout animations
      tension: 300,
      friction: 30,
    }).start();
    baseHeight.current = modalHeight;
  }, [modalHeight]);

  const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationY } = event.nativeEvent;
    const screenHeight = Dimensions.get('window').height;
    const newHeight = Math.max(
      screenHeight * 0.5, // Minimum 50% height
      baseHeight.current - translationY
    );
    const finalHeight = Math.min(newHeight, screenHeight);
    
    // Update animated height in real-time for smooth drag
    animatedHeight.setValue(finalHeight);
    // Also update parent state
    onHeightChange(finalHeight);
  };

  const onPanHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      baseHeight.current = modalHeight;
    } else if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;

      const screenHeight = Dimensions.get('window').height;
      const currentHeight = modalHeight;

      if (velocityY > 500 || translationY > 100) {
        onClose();
      } else {
        let targetHeight: number;
        if (currentHeight < screenHeight * 0.65) {
          targetHeight = screenHeight * 0.5; // Snap to 50%
        } else if (currentHeight < screenHeight * 0.85) {
          targetHeight = screenHeight * 0.75; // Snap to 75%
        } else {
          targetHeight = screenHeight; // Snap to 100%
        }
        
        // Animate to target height
        Animated.spring(animatedHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          tension: 300,
          friction: 30,
        }).start();
        
        onHeightChange(targetHeight);
      }
    }
  };

  const renderGiftItem = ({ item }: { item: {id: string, emoji: string, name: string, quantity: number} }) => {
    const isSelected = selectedGift?.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.giftItem,
          item.quantity === 0 && styles.giftItemDisabled,
          isSelected && styles.giftItemSelected,
        ]}
        onPress={() => handleSelectGift(item)}
        disabled={item.quantity === 0}
      >
        <Text style={styles.giftEmoji}>{item.emoji}</Text>
        <Text style={styles.giftName}>{item.name}</Text>
        <Text style={styles.giftQuantity}>x{item.quantity}</Text>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={20} color="#FFD700" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      {/* Backdrop - tap to close */}
      <TouchableOpacity 
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        activeOffsetY={-10}
        failOffsetY={50}
      >
        <Animated.View 
          style={[styles.modalContainer, { height: animatedHeight, paddingBottom: 20 + (insetsBottom || 0) }]}
          pointerEvents="box-none"
        >
          <View style={styles.modalHandle} />
          <View style={styles.giftModalHeader}>
            <Text style={styles.modalTitle}>Send Gift</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {streamId ? (
            <WatchRewardPill streamId={streamId} mode="inline" />
          ) : null}

          {loadingGifts ? (
            <View style={styles.giftLoadingContainer}>
              <ActivityIndicator size="large" color="#3498DB" />
              <Text style={styles.giftLoadingText}>Loading gifts...</Text>
            </View>
          ) : availableGifts.length === 0 ? (
            <View style={styles.giftEmptyContainer}>
              <Ionicons name="gift-outline" size={50} color="#666" />
              <Text style={styles.giftEmptyText}>You don't have any gifts</Text>
              <Text style={styles.giftEmptySubtext}>Purchase gifts from the marketplace to send during streams</Text>
            </View>
          ) : (
            <FlatList
              data={availableGifts}
              renderItem={renderGiftItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              numColumns={3}
              style={styles.modalContent}
              contentContainerStyle={[styles.giftGridContent, { paddingBottom: 20 + (insetsBottom || 0) }]}
              ListFooterComponent={
                selectedGift ? (
                  <View style={styles.sendButtonContainer}>
                    <TouchableOpacity
                      style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                      onPress={handleSend}
                      activeOpacity={0.8}
                      disabled={sending}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Ionicons name="gift" size={20} color="#FFF" />
                          <Text style={styles.sendButtonText}>
                            Send {selectedGift.emoji} {selectedGift.name}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          )}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

// Mini Cart Modal Component
const MiniCartModal = ({ visible, onClose, cartItems, modalHeight, onHeightChange, onUpdateQuantity, onRemoveItem, onCheckout, insetsBottom = 0 }: any) => {
  const panRef = useRef<any>(null);
  const baseHeight = useRef(modalHeight);
  const animatedHeight = useRef(new Animated.Value(modalHeight)).current;
  const total = cartItems.reduce((sum: number, item: any) => sum + ((item.live_price || item.price || 0) * item.quantity), 0);

  // Update animated height when prop changes
  React.useEffect(() => {
    Animated.spring(animatedHeight, {
      toValue: modalHeight,
      useNativeDriver: false, // Height requires layout animations
      tension: 300,
      friction: 30,
    }).start();
    baseHeight.current = modalHeight;
  }, [modalHeight]);

  const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationY } = event.nativeEvent;
    const screenHeight = Dimensions.get('window').height;
    const newHeight = Math.max(
      screenHeight * 0.5, // Minimum 50% height
      baseHeight.current - translationY
    );
    const finalHeight = Math.min(newHeight, screenHeight);
    
    // Update animated height in real-time for smooth drag
    animatedHeight.setValue(finalHeight);
    // Also update parent state
    onHeightChange(finalHeight);
  };

  const onPanHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      baseHeight.current = modalHeight;
    } else if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;

      // Snap to 50%, 75%, or 100% screen
      const screenHeight = Dimensions.get('window').height;
      const currentHeight = modalHeight;

      if (velocityY > 500 || translationY > 100) {
        // Close modal
        onClose();
      } else {
        // Snap to nearest position
        let targetHeight: number;
        if (currentHeight < screenHeight * 0.65) {
          targetHeight = screenHeight * 0.5; // Snap to 50%
        } else if (currentHeight < screenHeight * 0.85) {
          targetHeight = screenHeight * 0.75; // Snap to 75%
        } else {
          targetHeight = screenHeight; // Snap to 100%
        }
        
        // Animate to target height
        Animated.spring(animatedHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          tension: 300,
          friction: 30,
        }).start();
        
        onHeightChange(targetHeight);
      }
    }
  };

  const renderCartItem = ({ item }: { item: any }) => {
    // Helper functions to extract item data
    const getItemImageUrl = () => {
      if (item.primary_image_url) return item.primary_image_url;
      if (item.product?.primary_image_url) return item.product.primary_image_url;
      if (item.product?.image_url) return item.product.image_url;
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const primary = item.images.find((img: any) => img.is_primary);
        return primary?.image_url || item.images[0]?.image_url;
      }
      return 'https://via.placeholder.com/50';
    };

    const getItemName = () => {
      if (item.name) return item.name;
      if (item.title) return item.title;
      if (item.product?.name) return item.product.name;
      if (item.service?.name) return item.service.name;
      return 'Item';
    };

    const getItemPrice = () => {
      return item.live_price || item.price || 0;
    };

    return (
      <View style={styles.miniCartItem}>
        <Image
          source={{ uri: getItemImageUrl() }}
          style={styles.miniCartItemImage}
        />
        <View style={styles.miniCartItemInfo}>
          <Text style={styles.miniCartItemName} numberOfLines={1}>
            {getItemName()}
          </Text>
          <Text style={styles.miniCartItemPrice}>₣{getItemPrice()}</Text>
        </View>

      <View style={styles.miniCartQuantityControls}>
        <TouchableOpacity
          style={styles.miniCartQuantityButton}
          onPress={() => onUpdateQuantity(item.cartId, item.quantity - 1)}
        >
          <Ionicons name="remove" size={16} color="white" />
        </TouchableOpacity>

        <Text style={styles.miniCartQuantityText}>{item.quantity}</Text>

        <TouchableOpacity
          style={styles.miniCartQuantityButton}
          onPress={() => onUpdateQuantity(item.cartId, item.quantity + 1)}
        >
          <Ionicons name="add" size={16} color="white" />
        </TouchableOpacity>
      </View>

        <TouchableOpacity
          style={styles.miniCartRemoveButton}
          onPress={() => onRemoveItem(item.cartId)}
        >
          <Ionicons name="trash-outline" size={18} color="#FF4757" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      {/* Backdrop - tap to close */}
      <TouchableOpacity 
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        activeOffsetY={-10}
        failOffsetY={50}
      >
        <Animated.View 
          style={[styles.miniCartContainer, { height: animatedHeight, paddingBottom: 20 + (insetsBottom || 0) }]}
          pointerEvents="box-none"
        >
          <View style={styles.modalHandle} />
          <View style={styles.miniCartHeader}>
            <Text style={styles.miniCartTitle}>Shopping Cart</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

        {cartItems.length === 0 ? (
          <View style={styles.emptyMiniCart}>
            <Ionicons name="bag-handle-outline" size={48} color="#666" />
            <Text style={styles.emptyMiniCartText}>Your cart is empty</Text>
            <Text style={styles.emptyMiniCartSubtext}>Add items from the shop</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={cartItems}
              renderItem={renderCartItem}
              keyExtractor={(item) => String(item.cartId)}
              showsVerticalScrollIndicator={false}
              style={styles.miniCartList}
              contentContainerStyle={{ paddingBottom: 10 + (insetsBottom || 0) }}
            />

            <View style={styles.miniCartFooter}>
              <View style={styles.miniCartTotal}>
                <Text style={styles.miniCartTotalLabel}>Total</Text>
                <Text style={styles.miniCartTotalValue}>₣{total.toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={styles.miniCartCheckoutButton}
                onPress={onCheckout}
              >
                <Text style={styles.miniCartCheckoutText}>Checkout</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

// Share Modal Component
const ShareModal = ({ visible, onClose, modalHeight, onHeightChange, conversations, conversationsLoading, selectedUsers, onUserSelect, onShare, onShareExternal, isSharing = false, insetsBottom = 0 }: any) => {
  const panRef = useRef<any>(null);
  const baseHeight = useRef(modalHeight);
  const animatedHeight = useRef(new Animated.Value(modalHeight)).current;
  
  // Update animated height when prop changes
  React.useEffect(() => {
    Animated.spring(animatedHeight, {
      toValue: modalHeight,
      useNativeDriver: false, // Height requires layout animations
      tension: 300,
      friction: 30,
    }).start();
    baseHeight.current = modalHeight;
  }, [modalHeight]);

  const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationY } = event.nativeEvent;
    const screenHeight = Dimensions.get('window').height;
    const newHeight = Math.max(
      screenHeight * 0.5, // Minimum 50% height
      baseHeight.current - translationY
    );
    const finalHeight = Math.min(newHeight, screenHeight);
    
    // Update animated height in real-time for smooth drag
    animatedHeight.setValue(finalHeight);
    // Also update parent state
    onHeightChange(finalHeight);
  };

  const onPanHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      baseHeight.current = modalHeight;
    } else if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;

      // Snap to 50%, 75%, or 100% screen
      const screenHeight = Dimensions.get('window').height;
      const currentHeight = modalHeight;

      if (velocityY > 500 || translationY > 100) {
        // Close modal
        onClose();
      } else {
        // Snap to nearest position
        let targetHeight: number;
        if (currentHeight < screenHeight * 0.65) {
          targetHeight = screenHeight * 0.5; // Snap to 50%
        } else if (currentHeight < screenHeight * 0.85) {
          targetHeight = screenHeight * 0.75; // Snap to 75%
        } else {
          targetHeight = screenHeight; // Snap to 100%
        }
        
        // Animate to target height
        Animated.spring(animatedHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          tension: 300,
          friction: 30,
        }).start();
        
        onHeightChange(targetHeight);
      }
    }
  };

  const toggleUserSelection = (user: any) => {
    if (selectedUsers.find((u: any) => u.id === user.id)) {
      onUserSelect(selectedUsers.filter((u: any) => u.id !== user.id));
    } else {
      onUserSelect([...selectedUsers, user]);
    }
  };

  const renderUserItem = ({ item }: any) => {
    const isSelected = selectedUsers.find((u: any) => u.id === item.id);

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item)}
      >
        <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
        <Text style={[styles.userName, isSelected && styles.userNameSelected]}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.modalOverlay} pointerEvents="box-none">
      {/* Backdrop - tap to close */}
      <TouchableOpacity 
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        activeOffsetY={-10}
        failOffsetY={50}
      >
        <Animated.View 
          style={[styles.shareModalContainer, { height: animatedHeight, paddingBottom: 20 + (insetsBottom || 0) }]}
          pointerEvents="box-none"
        >
          <View style={styles.modalHandle} />
          <View style={styles.shareModalHeader}>
            <Text style={styles.shareModalTitle}>Share Live Stream</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

        <Text style={styles.shareSubtitle}>Select chats to share with</Text>

        <View style={{ flex: 1 }}>
          {conversationsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#3498DB" />
              <Text style={{ color: '#888', marginTop: 12 }}>Loading chats...</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={styles.usersList}
              contentContainerStyle={{ paddingBottom: 10 + (insetsBottom || 0) }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 30 }}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#666" />
                  <Text style={{ color: '#888', marginTop: 12 }}>No chat conversations yet</Text>
                </View>
              }
            />
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.shareButton,
            (selectedUsers.length === 0 || conversationsLoading || isSharing) && styles.shareButtonDisabled,
          ]}
          onPress={onShare}
          disabled={selectedUsers.length === 0 || conversationsLoading || isSharing}
        >
          {isSharing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.shareButtonText}>
              Share to Chats {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareButton, { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)' }]}
          onPress={onShareExternal}
        >
          <Text style={[styles.shareButtonText, { color: 'white' }]}>Share to Other Apps</Text>
        </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

export default LiveStreamViewerScreen;
