import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { auctionsAPI, auctionSocket, AuctionWithDetails, PublicBidHistoryItem, AuctionItem } from '../services/auctionsAPI';
import { useAuctionSounds } from '../services/auctionSoundService';
import * as ImagePicker from 'expo-image-picker';

// Import basic Agora SDK
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, IRtcEngine, ChannelMediaOptions, RtcSurfaceView, RenderModeType } from 'react-native-agora';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Auction Live Broadcast Screen
 * 
 * Full-screen camera interface for auction host broadcasting
 * - Agora video streaming
 * - Real-time bidding dashboard
 * - Auction controls (Going Once, Going Twice, SOLD!)
 * - Bid history and analytics
 * - Winner declaration
 */

const AuctionLiveBroadcastScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { auctionId } = route.params;

  // Sound effects
  const { playCheer, playClap, playLaugh, playTimer, startCrowd, stopCrowd, playGavel, playWinner } = useAuctionSounds();

  // Auction phase state machine
  type AuctionPhase = 'idle' | 'timer_playing' | 'bidding_active' | 'gavel_playing' | 'winner_playing' | 'complete';
  const [auctionPhase, setAuctionPhase] = useState<AuctionPhase>('idle');

  // Agora state - Industry Standard Implementation
  const [agoraConfig, setAgoraConfig] = useState<any>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [agoraEngine, setAgoraEngine] = useState<IRtcEngine | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPreviewStarted, setIsPreviewStarted] = useState(false);

  // Initialization guards
  const [isAgoraInitialized, setIsAgoraInitialized] = useState(false);
  const [isVideoViewReady, setIsVideoViewReady] = useState(false);
  const agoraEngineRef = useRef<IRtcEngine | null>(null);

  // Auction state
  const [auction, setAuction] = useState<AuctionWithDetails | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [bidHistory, setBidHistory] = useState<PublicBidHistoryItem[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Reactions state
  const [reactions, setReactions] = useState<Array<{ id: string; reaction_type: string; user_id: string; timestamp: string }>>([]);
  const [reactionCounts, setReactionCounts] = useState<{ [key: string]: number }>({
    heart: 0,
    thumbs_up: 0,
    applause: 0,
    fire: 0,
  });

  // Audio/Video controls
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // Camera and microphone permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Auction controls
  const [showBidDashboard, setShowBidDashboard] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerData, setWinnerData] = useState<any>(null);

  // Add Item Modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemLotNumber, setNewItemLotNumber] = useState('');
  const [newItemStartingPrice, setNewItemStartingPrice] = useState('');
  const [newItemReservePrice, setNewItemReservePrice] = useState('');
  const [newItemBidIncrement, setNewItemBidIncrement] = useState('');
  const [newItemImages, setNewItemImages] = useState<string[]>([]);
  const [creatingItem, setCreatingItem] = useState(false);

  // Multi-item auction state
  const [currentItem, setCurrentItem] = useState<AuctionItem | null>(null);
  const [itemBiddingStatus, setItemBiddingStatus] = useState<'waiting' | 'countdown' | 'active' | 'ended' | 'sold' | 'passed'>('waiting');
  const [countdownTimer, setCountdownTimer] = useState<number | null>(null);
  const [biddingTimeLeft, setBiddingTimeLeft] = useState<number | null>(null);
  const [itemTotalCount, setItemTotalCount] = useState<number>(0);
  const [itemQueue, setItemQueue] = useState<AuctionItem[]>([]);
  const [showItemQueue, setShowItemQueue] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Video view reference
  const rtcSurfaceViewRef = useRef<any>(null);

  // WebSocket listener refs for proper cleanup
  const bidHandlerRef = useRef<((data: any) => void) | null>(null);
  const statusHandlerRef = useRef<((data: any) => void) | null>(null);
  const viewCountHandlerRef = useRef<((data: any) => void) | null>(null);
  const itemEventHandlerRef = useRef<((data: any) => void) | null>(null);
  const reactionHandlerRef = useRef<((data: any) => void) | null>(null);

  // Initialize auction and stream
  useEffect(() => {
    initializeAuction();
    return () => {
      console.log('🏁 Component unmounting - cleaning up auction stream...');
      cleanupStream().catch(error => {
        console.error('❌ Cleanup on unmount failed:', error);
      });
      setIsAgoraInitialized(false);
      setIsVideoViewReady(false);
      agoraEngineRef.current = null;
    };
  }, []);

  // Initialize Agora engine when config is ready
  useEffect(() => {
    if (!agoraEngine && agoraConfig && !loading && !isAgoraInitialized && agoraEngineRef.current === null) {
      console.log('🔄 Triggering Agora initialization...');
      initializeAgoraEngine();
    }
  }, [agoraConfig, agoraEngine, loading, isAgoraInitialized]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => (prev && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  // Load item queue
  const loadItemQueue = async () => {
    try {
      setLoadingItems(true);
      const items = await auctionsAPI.getAuctionItems(auctionId);
      setItemQueue(items || []);
      setItemTotalCount(items?.length || 0);
    } catch (error: any) {
      console.error('Error loading item queue:', error);
      // Don't show alert - queue loading failure shouldn't block the auction
    } finally {
      setLoadingItems(false);
    }
  };

  // Handle selecting item from queue (loads it as current item)
  const handleSelectItem = async (item: AuctionItem) => {
    // Close modal immediately for better UX
    setShowItemQueue(false);
    
    try {
      // Use loadNextItem which will load the selected item if it's the next waiting item
      // Or we can call the backend to set current_item_id directly
      await auctionsAPI.loadNextItem(auctionId);
      // Item will be loaded via WebSocket item_ready event
    } catch (error: any) {
      console.error('Error loading item:', error);
      Alert.alert('Error', error.message || 'Failed to load item');
    }
  };

  const initializeAuction = async () => {
    try {
      setLoading(true);

      // Request permissions
      if (!cameraPermission?.granted) {
        const { granted } = await requestCameraPermission();
        if (!granted) {
          setLoading(false);
          Alert.alert('Permission Required', 'Camera permission is required for live streaming');
          navigation.goBack();
          return;
        }
      }

      if (!micPermission?.granted) {
        const { granted } = await requestMicPermission();
        if (!granted) {
          setLoading(false);
          Alert.alert('Permission Required', 'Microphone permission is required for live streaming');
          navigation.goBack();
          return;
        }
      }

      // Load auction data
      const auctionData = await auctionsAPI.getAuction(auctionId);
      setAuction(auctionData);
      setTimeRemaining(auctionData.seconds_remaining || 0);

      // Verify auction is live type and user is seller
      if (auctionData.auction_type !== 'live') {
        setLoading(false);
        Alert.alert('Invalid Auction', 'This is not a live auction');
        navigation.goBack();
        return;
      }

      if (auctionData.seller_id !== user?.id) {
        setLoading(false);
        Alert.alert('Unauthorized', 'Only the auction seller can broadcast');
        navigation.goBack();
        return;
      }

      // Load bid history
      const bids = await auctionsAPI.getBidHistory(auctionId, 50);
      setBidHistory(bids);

      // Load current auction item
      const currentItemData = await auctionsAPI.getCurrentItem(auctionId);
      if (currentItemData) {
        setCurrentItem(currentItemData);
        setItemBiddingStatus(currentItemData.bidding_status);
        if (currentItemData.bidding_status === 'active' && currentItemData.bidding_started_at) {
          const started = new Date(currentItemData.bidding_started_at).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - started) / 1000);
          const remaining = Math.max(0, currentItemData.bidding_duration - elapsed);
          setBiddingTimeLeft(remaining);
        }
      } else {
        // No current item - load first item
        try {
          await auctionsAPI.loadNextItem(auctionId);
        } catch (error: any) {
          console.error('Error loading first item:', error);
          // Don't block initialization - auction can still proceed
        }
      }

      // Connect to WebSocket
      await auctionSocket.connect();
      await auctionSocket.joinAuction(auctionId, user?.id);

      // Setup WebSocket listeners
      setupWebSocketListeners();

      // Load item queue
      await loadItemQueue();

      // Generate Agora token using auction API
      const tokenData = await auctionsAPI.generateAgoraToken(auctionId, 'host');
      
      const connectionData = {
        appId: tokenData.appId,
        channel: tokenData.channel,
        token: tokenData.token,
        uid: tokenData.uid,
      };

      setAgoraConfig(connectionData);
      setLoading(false); // Config is ready, Agora will initialize separately

    } catch (error: any) {
      console.error('Error initializing auction:', error);
      setLoading(false); // Always clear loading on error
      Alert.alert('Error', error.message || 'Failed to initialize live auction');
      navigation.goBack();
    }
  };

  const setupWebSocketListeners = () => {
    // Handle new bids
    const handleNewBid = (data: any) => {
      if (data.auction_id === auctionId) {
        setAuction(prev => prev ? {
          ...prev,
          current_bid: data.amount,
          total_bids: (prev.total_bids || 0) + 1
        } : null);

        // Add to bid history
        setBidHistory(prev => [{
          id: data.bid_id || Date.now().toString(),
          amount: data.amount,
          bidder_display_id: data.bidder_display_id || 'Bidder',
          is_winning: true,
          created_at: new Date().toISOString(),
          bid_type: 'manual',
        }, ...prev.slice(0, 49)]);
      }
    };
    bidHandlerRef.current = handleNewBid;

    // Handle status changes
    const handleStatusChanged = (data: any) => {
      if (data.auction_id === auctionId) {
        if (data.new_status === 'sold' || data.new_status === 'ended') {
          setWinnerData({
            winner_id: data.winner_id,
            winning_bid: data.winning_bid,
            bidder_display_id: data.bidder_display_id,
          });
          setShowWinnerModal(true);
        }
      }
    };
    statusHandlerRef.current = handleStatusChanged;

    // Handle viewer count
    const handleViewCountUpdate = (data: any) => {
      if (data.auction_id === auctionId) {
        setViewerCount(data.view_count || 0);
      }
    };
    viewCountHandlerRef.current = handleViewCountUpdate;

    // Handle reactions
    const handleNewReaction = (reaction: any) => {
      if (reaction.auction_id === auctionId) {
        // Generate unique ID for this reaction instance
        const reactionId = Date.now() + Math.random().toString();
        
        setReactions(prev => [...prev, { ...reaction, id: reactionId }]);
        
        // Update reaction counts
        setReactionCounts(prev => ({
          ...prev,
          [reaction.reaction_type]: (prev[reaction.reaction_type] || 0) + 1,
        }));

        // Remove reaction after 3 seconds using the generated ID
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 3000);
      }
    };
    reactionHandlerRef.current = handleNewReaction;

    // Handle auction item events
    const handleItemEvent = (data: any) => {
      if (data.auction_id === auctionId) {
        switch (data.event_type) {
          case 'item_ready':
            // Map item_ready event data to AuctionItem format (use item_id if id is not present)
            // Ensure id field exists (WebSocket events use item_id, API returns id)
            const itemId = data.item_id || data.id;
            console.log('📦 Item ready event received - item_id:', data.item_id, 'id:', data.id, 'final id:', itemId);
            const itemData: any = {
              ...data,
              id: itemId, // Ensure id field is set
            };
            setCurrentItem(itemData as AuctionItem);
            setItemBiddingStatus('waiting');
            setItemTotalCount(data.total_items || 0);
            setBiddingTimeLeft(null);
            setCountdownTimer(null);
            // Reload item queue when item becomes ready
            loadItemQueue().catch(err => console.error('Error reloading queue:', err));
            break;
          
          case 'start_countdown':
            setItemBiddingStatus('countdown');
            setCountdownTimer(3);
            // Start countdown animation
            break;
          
          case 'bidding_open':
            setItemBiddingStatus('active');
            setCountdownTimer(null);
            setBiddingTimeLeft(data.duration || 120);
            break;
          
          case 'bidding_ended':
            setItemBiddingStatus('ended');
            setBiddingTimeLeft(null);
            if (data.winner) {
              setWinnerData({
                winner_id: data.winner.bidder_id,
                winning_bid: data.winner.amount,
                bidder_display_id: data.winner.bidder_display_id,
              });
              // Show winner modal on host screen
              setShowWinnerModal(true);
            }
            break;
          
          case 'item_sold':
            setItemBiddingStatus('sold');
            // Reset phase to prepare for next item (cancel button will be hidden)
            setAuctionPhase('idle');
            break;
        }
      }
    };
    itemEventHandlerRef.current = handleItemEvent;

    // Register listeners
    auctionSocket.on('new_bid', handleNewBid);
    auctionSocket.on('bid_placed', handleNewBid);
    auctionSocket.on('auction_status_changed', handleStatusChanged);
    auctionSocket.on('view_count_updated', handleViewCountUpdate);
    auctionSocket.on('item_event', handleItemEvent);
    auctionSocket.on('new_reaction', handleNewReaction);
  };


  const cleanupStream = async () => {
    try {
      console.log('🧹 Starting cleanup...');
      
      // Notify backend that broadcast has stopped
      try {
        await auctionsAPI.stopBroadcast(auctionId);
        console.log('✅ Broadcast stopped notification sent to backend');
      } catch (error: any) {
        console.error('⚠️ Failed to notify backend of broadcast stop:', error);
        // Don't block cleanup
      }

      // Remove WebSocket listeners using stored refs
      if (bidHandlerRef.current) {
        auctionSocket.off('new_bid', bidHandlerRef.current);
        auctionSocket.off('bid_placed', bidHandlerRef.current);
        bidHandlerRef.current = null;
      }
      if (statusHandlerRef.current) {
        auctionSocket.off('auction_status_changed', statusHandlerRef.current);
        statusHandlerRef.current = null;
      }
      if (viewCountHandlerRef.current) {
        auctionSocket.off('view_count_updated', viewCountHandlerRef.current);
        viewCountHandlerRef.current = null;
      }
      if (itemEventHandlerRef.current) {
        auctionSocket.off('item_event', itemEventHandlerRef.current);
        itemEventHandlerRef.current = null;
      }
      if (reactionHandlerRef.current) {
        auctionSocket.off('new_reaction', reactionHandlerRef.current);
        reactionHandlerRef.current = null;
      }

      // Leave auction room
      auctionSocket.leaveAuction(auctionId);

      // Cleanup Agora engine - check both state and ref
      const engine = agoraEngine || agoraEngineRef.current;
      if (engine) {
        try {
          console.log('🎥 Cleaning up Agora engine...');
          engine.removeAllListeners();
          await engine.leaveChannel();
          await engine.release();
          console.log('✅ Agora engine cleaned up');
        } catch (cleanupError) {
          console.warn('⚠️ Agora cleanup warning:', cleanupError);
        } finally {
          setAgoraEngine(null);
          agoraEngineRef.current = null;
          setIsJoined(false);
          setIsPreviewStarted(false);
          setIsAgoraInitialized(false);
          setAgoraConfig(null);
        }
      }

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      // Ensure state is cleaned up even if errors occur
      setAgoraEngine(null);
      agoraEngineRef.current = null;
      setAgoraConfig(null);
      setIsJoined(false);
      setIsPreviewStarted(false);
      setIsAgoraInitialized(false);
    }
  };

  const handleJoinSuccess = async () => {
    console.log('🎉 Agora JoinChannelSuccess - camera active!');
    setIsInCall(true);
    setIsJoined(true);
    setLoading(false);
    console.log('✅ Auction live streaming active');
  };

  const initializeAgoraEngine = async () => {
    if (isAgoraInitialized || agoraEngineRef.current) {
      console.log('🔄 Agora engine already initialized, skipping');
      return;
    }

    if (!agoraConfig) {
      console.log('⏳ Waiting for config before initializing Agora...');
      return;
    }

    try {
      console.log('🎥 Initializing Agora Engine...');

      const engine = createAgoraRtcEngine();
      agoraEngineRef.current = engine;
      setAgoraEngine(engine);
      setIsAgoraInitialized(true);
      console.log('✅ Agora Engine created');

      const initResult = engine.initialize({
        appId: agoraConfig.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting
      });

      if (initResult !== 0) {
        throw new Error(`Engine initialization failed with code: ${initResult}`);
      }
      console.log('✅ Agora Engine initialized');

      await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      console.log('✅ Client role set to Broadcaster');

      await engine.enableVideo();
      await engine.enableAudio();
      console.log('✅ Video and audio enabled');

      await engine.startPreview();
      setIsPreviewStarted(true);
      console.log('✅ Preview started');

      // Setup event listeners
      engine.addListener('onJoinChannelSuccess', async (connection: any, elapsed: number) => {
        console.log('🎉 Agora onJoinChannelSuccess:', { connection, elapsed });
        setIsJoined(true);
        
        // Notify backend that broadcast has started
        try {
          await auctionsAPI.startBroadcast(auctionId);
          console.log('✅ Broadcast started notification sent to backend');
        } catch (error: any) {
          console.error('⚠️ Failed to notify backend of broadcast start:', error);
          // Don't block the UI - broadcast is still active even if notification fails
        }
        
        handleJoinSuccess();
      });

      engine.addListener('onError', (err: number, msg: string) => {
        console.error('💥 Agora onError:', { err, msg });
        if (err === 110) {
          console.warn('⚠️ Error 110: Video view not ready yet');
          return;
        } else {
          Alert.alert('Agora Error', `Engine error: ${err} - ${msg || 'Unknown error'}`);
        }
      });

      engine.addListener('onLeaveChannel', (connection: any, stats: any) => {
        console.log('👋 Agora onLeaveChannel');
        setIsJoined(false);
        setIsPreviewStarted(false);
        setAgoraEngine(null);
      });

      // Join channel
      const mediaOptions = new ChannelMediaOptions();
      mediaOptions.publishCameraTrack = true;
      mediaOptions.publishMicrophoneTrack = true;

      const joinResult = await (engine as any).joinChannel(
        agoraConfig.token || '',
        agoraConfig.channel,
        agoraConfig.uid,
        mediaOptions
      );

      console.log('🔍 joinChannel result:', joinResult);

      if (joinResult === 0) {
        console.log('✅ joinChannel succeeded');
      } else {
        throw new Error(`joinChannel failed with error code: ${joinResult}`);
      }

    } catch (error: any) {
      console.error('❌ Failed to initialize Agora Engine:', error);
      setIsPreviewStarted(false);
      setIsJoined(false);
      setAgoraEngine(null);
      Alert.alert('Agora Error', `Failed to start camera: ${error.message}`);
    }
  };

  // Countdown timer effect (3-2-1)
  useEffect(() => {
    if (itemBiddingStatus === 'countdown' && countdownTimer !== null && countdownTimer > 0) {
      const timer = setTimeout(() => {
        setCountdownTimer(countdownTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [itemBiddingStatus, countdownTimer]);

  // Bidding timer effect
  useEffect(() => {
    if (itemBiddingStatus === 'active' && biddingTimeLeft !== null && biddingTimeLeft > 0) {
      const timer = setTimeout(() => {
        setBiddingTimeLeft(biddingTimeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    // Removed auto-end logic - only gavel button should end bidding
    // Timer reaching zero does not automatically end the auction
  }, [itemBiddingStatus, biddingTimeLeft]);

  // Multi-item auction control handlers with sound sequencing
  const handleStartItemCountdown = async () => {
    if (!currentItem) return;

    // Capture currentItem.id in closure to avoid stale reference
    const itemId = currentItem.id;
    console.log('🎬 Starting countdown for item:', itemId);

    try {
      // Start auction phase: timer_playing
      setAuctionPhase('timer_playing');

      // Play timer sound - when it completes, activate bidding
      await playTimer(() => {
        console.log('✅ Timer sound completed - activating bidding for item:', itemId);
        
        // Move to bidding_active phase
        setAuctionPhase('bidding_active');
        
        // Start crowd sound (loops)
        startCrowd();

        // Start item countdown on backend (sends bidding_open event to viewers)
        auctionsAPI.startItemCountdown(auctionId, itemId).catch(error => {
          console.error('Error starting countdown:', error);
        });
      });
    } catch (error: any) {
      console.error('Error starting auction:', error);
      setAuctionPhase('idle');
      Alert.alert('Error', error.message || 'Failed to start auction');
    }
  };

  // Unified end bidding function - handles gavel sound, winner sound, marking as sold, and showing winner modal
  const handleEndBiddingNow = async () => {
    if (auctionPhase !== 'bidding_active' || !currentItem) return;

    // Capture values in closure to avoid stale references
    const itemId = currentItem.id;
    const currentBid = auction?.current_bid || 0;
    const totalBids = auction?.total_bids || 0;

    console.log('🔨 Ending bidding for item:', itemId, 'Total bids:', totalBids);

    try {
      setAuctionPhase('gavel_playing');
      stopCrowd(); // Stop crowd sound immediately

      // Play gavel sound - when it completes, check if there were bids
      await playGavel(async () => {
        console.log('✅ Gavel sound completed for item:', itemId);
        
        // Only play winner sound and mark as sold if there were actual bids
        if (totalBids > 0) {
          console.log('✅ Bids received - ending bidding first, then marking as sold');
          setAuctionPhase('winner_playing');

          // Step 1: End bidding first (sets status to 'ended' and broadcasts bidding_ended event)
          // This is required before marking as sold
          try {
            await auctionsAPI.endItemBidding(auctionId, itemId);
            console.log('✅ Bidding ended - winner modal should now be visible');
            // Winner modal will be shown via bidding_ended event handler (line 398-410)
            // bidding_ended event also adds item to winner's cart on viewer side
          } catch (error: any) {
            console.error('Error ending bidding:', error);
            Alert.alert('Error', error.message || 'Failed to end bidding');
            setAuctionPhase('idle');
            return;
          }

          // Step 2: Mark item as sold (requires status to be 'ended')
          // This broadcasts item_sold event and loads next item
          try {
            await auctionsAPI.markItemSold(auctionId, itemId);
            console.log('✅ Item marked as sold - next item should load automatically');
          } catch (error: any) {
            console.error('Error marking item as sold:', error);
            Alert.alert('Error', error.message || 'Failed to mark item as sold');
            setAuctionPhase('idle');
            return;
          }

          // Play winner sound based on bid amount (>100 = winner2, ≤100 = winner1)
          // Winner modal is already showing, sound plays in parallel
          playWinner(currentBid, async () => {
            console.log('✅ Winner sound completed');
            
            // Reset phase after winner sound completes
            setAuctionPhase('complete');
            
            // Reset to idle after a short delay - this prepares for next item
            // The item_sold event will also set phase to idle, ensuring smooth transition
            setTimeout(() => {
              setAuctionPhase('idle');
              // Backend should have already loaded next item and sent item_ready event
              // If item_ready hasn't arrived yet, itemBiddingStatus will remain 'sold' 
              // and cancel button will stay hidden
            }, 500);
          });
        } else {
          // No bids received - skip winner sound and just end the item
          console.log('⚠️ No bids received - skipping winner sound for item:', itemId);
          Alert.alert('No Bids', 'No bids were placed on this item. It will be marked as unsold.');
          
          // Mark item as passed/unsold
          try {
            await auctionsAPI.skipItem(auctionId, itemId);
          } catch (error: any) {
            console.error('Error skipping item:', error);
          }
          
          // Reset to idle
          setAuctionPhase('idle');
        }
      });
    } catch (error: any) {
      console.error('Error ending bidding:', error);
      setAuctionPhase('idle');
      Alert.alert('Error', error.message || 'Failed to end bidding');
    }
  };

  // Gavel button now uses the same unified function
  const handleGavel = () => {
    handleEndBiddingNow();
  };

  const handleMarkItemSold = async () => {
    if (!currentItem) return;

    try {
      await auctionsAPI.markItemSold(auctionId, currentItem.id);
      setShowWinnerModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to mark item as sold');
    }
  };

  // Handle skipping an item temporarily (before bidding starts) - keeps item in queue for later
  const handleSkipItem = async () => {
    if (!currentItem) return;

    // Confirm skip
    Alert.alert(
      'Skip Item',
      'Skip this item for now? You can bring it back later from the item queue.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Skip',
          onPress: async () => {
            try {
              // Just load the next item - this keeps current item in queue with 'waiting' status
              await auctionsAPI.loadNextItem(auctionId);
              
              // Reset phase and clear current item (will be reloaded via WebSocket or next item)
              setAuctionPhase('idle');
              setCurrentItem(null);
              setItemBiddingStatus('waiting');
            } catch (error: any) {
              console.error('Error skipping item:', error);
              Alert.alert('Error', error.message || 'Failed to skip item');
            }
          },
        },
      ]
    );
  };

  // Handle cancelling an item permanently (after bidding has started)
  const handleCancelItem = async () => {
    if (!currentItem) return;

    // Check if any bids have been placed
    const totalBids = auction?.total_bids || 0;
    
    if (totalBids > 0) {
      Alert.alert('Cannot Cancel', 'Cannot cancel an item that has received bids. You must complete the auction for this item.');
      return;
    }

    // Confirm cancellation
    Alert.alert(
      'Cancel Item',
      'Are you sure you want to cancel this item? It will be removed from the auction.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop crowd sound if playing
              if (auctionPhase === 'bidding_active') {
                stopCrowd();
              }
              
              // Cancel the item (permanently removes it)
              await auctionsAPI.skipItem(auctionId, currentItem.id);
              
              // Clear current item and reset state
              // Backend will emit item_ready event for next item, or we'll show SELECT ITEM buttons
              setCurrentItem(null);
              setItemBiddingStatus('waiting');
              setAuctionPhase('idle');
              setBiddingTimeLeft(null);
              setCountdownTimer(null);
              
              // Reload item queue to reflect changes
              await loadItemQueue();
              
              Alert.alert('Item Cancelled', 'The item has been cancelled and removed from the auction.');
            } catch (error: any) {
              console.error('Error cancelling item:', error);
              Alert.alert('Error', error.message || 'Failed to cancel item');
            }
          },
        },
      ]
    );
  };

  const handleEndAuction = () => {
    Alert.alert(
      'End Auction',
      'Are you sure you want to end this auction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: handleEndAuctionConfirmed,
        },
      ]
    );
  };

  const handleEndAuctionConfirmed = async () => {
    try {
      await cleanupStream();
      navigation.replace('AuctionDetails', { auctionId });
    } catch (error: any) {
      console.error('Error ending auction:', error);
      Alert.alert('Error', 'Failed to end auction: ' + error.message);
    }
  };

  // Add Item handlers
  const handleAddImage = async () => {
    if (newItemImages.length >= 10) {
      Alert.alert('Maximum Images', 'You can upload up to 10 images per item.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setNewItemImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setNewItemImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateItem = async () => {
    if (!newItemTitle.trim()) {
      Alert.alert('Validation Error', 'Title is required');
      return;
    }

    if (!newItemStartingPrice.trim() || parseFloat(newItemStartingPrice) <= 0) {
      Alert.alert('Validation Error', 'Starting price must be greater than 0');
      return;
    }

    try {
      setCreatingItem(true);

      const itemData = {
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || undefined,
        lot_number: newItemLotNumber.trim() || undefined,
        starting_price: parseFloat(newItemStartingPrice),
        reserve_price: newItemReservePrice.trim() ? parseFloat(newItemReservePrice) : undefined,
        bid_increment: newItemBidIncrement.trim() ? parseFloat(newItemBidIncrement) : undefined,
      };

      const newItem = await auctionsAPI.createAuctionItem(auctionId, itemData, newItemImages);

      // Reset form
      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemLotNumber('');
      setNewItemStartingPrice('');
      setNewItemReservePrice('');
      setNewItemBidIncrement('');
      setNewItemImages([]);
      setShowAddItemModal(false);

      // Reload item queue
      await loadItemQueue();

      Alert.alert('Success', 'Item added successfully! It will appear in the queue.');
      console.log('✅ New item created:', newItem.id);
    } catch (error: any) {
      console.error('Error creating item:', error);
      Alert.alert('Error', error.message || 'Failed to create item');
    } finally {
      setCreatingItem(false);
    }
  };

  const handleToggleMicrophone = async () => {
    if (!agoraEngine) return;

    try {
      const newMutedState = !isAudioMuted;
      await agoraEngine.muteLocalAudioStream(newMutedState);
      setIsAudioMuted(newMutedState);
      console.log(`🎤 Microphone ${newMutedState ? 'muted' : 'unmuted'}`);
    } catch (error: any) {
      console.error('❌ Error toggling microphone:', error);
      Alert.alert('Error', `Failed to ${isAudioMuted ? 'unmute' : 'mute'} microphone`);
    }
  };

  const handleFlipCamera = async () => {
    if (!agoraEngine) return;

    try {
      await agoraEngine.switchCamera();
      setIsFrontCamera(!isFrontCamera);
      console.log(`📷 Camera switched to ${!isFrontCamera ? 'front' : 'back'}`);
    } catch (error: any) {
      console.error('❌ Error flipping camera:', error);
      Alert.alert('Error', 'Failed to switch camera');
    }
  };

  const handleToggleVideo = async () => {
    if (!agoraEngine) return;

    try {
      const newMutedState = !isVideoMuted;
      await agoraEngine.muteLocalVideoStream(newMutedState);
      setIsVideoMuted(newMutedState);
      console.log(`📹 Video ${newMutedState ? 'disabled' : 'enabled'}`);
    } catch (error: any) {
      console.error('❌ Error toggling video:', error);
      Alert.alert('Error', `Failed to ${isVideoMuted ? 'enable' : 'disable'} video`);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'Ended';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const renderBidItem = ({ item }: { item: PublicBidHistoryItem }) => (
    <View style={styles.bidItem}>
      <View style={styles.bidItemLeft}>
        <Text style={styles.bidderId}>{item.bidder_display_id}</Text>
        <Text style={styles.bidTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
      </View>
      <Text style={[styles.bidAmount, item.is_winning && styles.winningBid]}>
        ₣{item.amount.toFixed(2)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Setting up auction stream...</Text>
      </View>
    );
  }

  if (!agoraConfig || !auction) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={60} color="#E74C3C" />
        <Text style={styles.errorText}>Failed to configure stream</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Full-screen Camera View */}
      {isPreviewStarted && agoraConfig ? (
        <RtcSurfaceView
          ref={rtcSurfaceViewRef}
          style={styles.fullScreenVideo}
          canvas={{
            uid: 0,
            renderMode: RenderModeType.RenderModeFit,
            mirrorMode: 1,
          }}
          zOrderMediaOverlay={true}
          onLayout={() => {
            if (!isVideoViewReady) {
              console.log('📹 Video view is now ready');
              setIsVideoViewReady(true);
            }
          }}
        />
      ) : (
        <View style={styles.cameraPlaceholder}>
          <ActivityIndicator size="large" color="#8E44AD" />
          <Text style={styles.cameraPlaceholderText}>
            {loading ? 'Initializing stream...' : 'Starting camera...'}
          </Text>
        </View>
      )}

      {/* Top Controls */}
      <View style={[styles.topControls, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.closeButton} onPress={handleEndAuction}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>

        <View style={styles.topRightContainer}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <View style={styles.viewerCount}>
            <Ionicons name="eye" size={16} color="white" />
            <Text style={styles.viewerText}>{viewerCount}</Text>
          </View>
        </View>

        {/* Reactions Display */}
        {reactions.length > 0 && (
          <View style={styles.reactionsContainer}>
            {reactions.slice(-5).map((reaction, index) => {
              const emoji = reaction.reaction_type === 'heart' ? '❤️' :
                           reaction.reaction_type === 'thumbs_up' ? '👍' :
                           reaction.reaction_type === 'applause' ? '👏' :
                           reaction.reaction_type === 'fire' ? '🔥' : '👍';
              return (
                <View key={reaction.id} style={[styles.reactionBubble, { bottom: 60 + (index * 50) }]}>
                  <Text style={styles.reactionBubbleEmoji}>{emoji}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Reaction Counts Summary */}
        {(reactionCounts.heart > 0 || reactionCounts.thumbs_up > 0 || reactionCounts.applause > 0 || reactionCounts.fire > 0) && (
          <View style={styles.reactionCountsContainer}>
            {reactionCounts.heart > 0 && (
              <View style={styles.reactionCountItem}>
                <Text style={styles.reactionCountEmoji}>❤️</Text>
                <Text style={styles.reactionCountText}>{reactionCounts.heart}</Text>
              </View>
            )}
            {reactionCounts.thumbs_up > 0 && (
              <View style={styles.reactionCountItem}>
                <Text style={styles.reactionCountEmoji}>👍</Text>
                <Text style={styles.reactionCountText}>{reactionCounts.thumbs_up}</Text>
              </View>
            )}
            {reactionCounts.applause > 0 && (
              <View style={styles.reactionCountItem}>
                <Text style={styles.reactionCountEmoji}>👏</Text>
                <Text style={styles.reactionCountText}>{reactionCounts.applause}</Text>
              </View>
            )}
            {reactionCounts.fire > 0 && (
              <View style={styles.reactionCountItem}>
                <Text style={styles.reactionCountEmoji}>🔥</Text>
                <Text style={styles.reactionCountText}>{reactionCounts.fire}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Auction Info Overlay */}
      <View style={styles.auctionInfoOverlay}>
        {currentItem ? (
          <>
            <View style={styles.itemHeaderRow}>
              <Text style={styles.itemNumber}>Item {currentItem.order_in_auction}{itemTotalCount > 0 && ` of ${itemTotalCount}`}</Text>
            </View>
            <Text style={styles.auctionTitle} numberOfLines={1}>{currentItem.title}</Text>
            <View style={styles.bidInfoRow}>
              <Text style={styles.currentBidLabel}>Current Bid:</Text>
              <Text style={styles.currentBidAmount}>₣{(currentItem.current_bid || currentItem.starting_price).toFixed(2)}</Text>
            </View>
            {biddingTimeLeft !== null && itemBiddingStatus === 'active' && (
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={14} color="#FFA500" />
                <Text style={styles.timeRemaining}>{formatTime(biddingTimeLeft)}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.auctionTitle} numberOfLines={1}>{auction.title}</Text>
            <View style={styles.bidInfoRow}>
              <Text style={styles.currentBidLabel}>Current Bid:</Text>
              <Text style={styles.currentBidAmount}>₣{auction.current_bid.toFixed(2)}</Text>
            </View>
            {timeRemaining && (
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={14} color="#FFA500" />
                <Text style={styles.timeRemaining}>{formatTime(timeRemaining)}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Countdown Display (3-2-1) */}
      {itemBiddingStatus === 'countdown' && countdownTimer !== null && countdownTimer > 0 && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdownTimer}</Text>
        </View>
      )}

      {/* Bid Dashboard Modal */}
      {showBidDashboard && (
        <Modal
          visible={showBidDashboard}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowBidDashboard(false)}
        >
          <View style={[styles.modalContainer, { paddingBottom: (insets.bottom || 0) + 12 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bid History</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowBidDashboard(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={bidHistory}
              renderItem={renderBidItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 16 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="pricetag-outline" size={60} color="#666" />
                  <Text style={styles.emptyText}>No bids yet</Text>
                </View>
              }
            />
          </View>
        </Modal>
      )}

      {/* Winner Modal */}
      {showWinnerModal && winnerData && (
        <Modal
          visible={showWinnerModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setShowWinnerModal(false);
            setAuctionPhase('idle'); // Reset to idle when modal closes
          }}
        >
          <View style={styles.winnerModalOverlay}>
            <View style={styles.winnerModalContent}>
              <Ionicons name="trophy" size={80} color="#FFD700" />
              <Text style={styles.winnerModalTitle}>SOLD!</Text>
              <Text style={styles.winnerText}>Winner: {winnerData.bidder_display_id}</Text>
              <Text style={styles.winnerBid}>₣{winnerData.winning_bid?.toFixed(2)}</Text>
              <TouchableOpacity
                style={styles.winnerModalButton}
                onPress={() => {
                  setShowWinnerModal(false);
                  setAuctionPhase('idle'); // Reset to idle, ready for next item
                }}
              >
                <Text style={styles.winnerModalButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <Modal
          visible={showAddItemModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddItemModal(false)}
        >
          <KeyboardAvoidingView 
            style={[styles.modalContainer, { paddingBottom: (insets.bottom || 0) + 12 }]} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Item</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAddItemModal(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.addItemForm} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={newItemTitle}
                  onChangeText={setNewItemTitle}
                  placeholder="Item title"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={newItemDescription}
                  onChangeText={setNewItemDescription}
                  placeholder="Item description (optional)"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Lot Number</Text>
                <TextInput
                  style={styles.input}
                  value={newItemLotNumber}
                  onChangeText={setNewItemLotNumber}
                  placeholder="Lot number (optional)"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Starting Price *</Text>
                <TextInput
                  style={styles.input}
                  value={newItemStartingPrice}
                  onChangeText={setNewItemStartingPrice}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Reserve Price</Text>
                <TextInput
                  style={styles.input}
                  value={newItemReservePrice}
                  onChangeText={setNewItemReservePrice}
                  placeholder="0.00 (optional)"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Bid Increment</Text>
                <TextInput
                  style={styles.input}
                  value={newItemBidIncrement}
                  onChangeText={setNewItemBidIncrement}
                  placeholder={`${auction?.bid_increment || 1.0} (optional)`}
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Images ({newItemImages.length}/10)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
                  {newItemImages.map((uri, index) => (
                    <View key={index} style={styles.imagePreview}>
                      <Image source={{ uri }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {newItemImages.length < 10 && (
                    <TouchableOpacity
                      style={styles.addImageButton}
                      onPress={handleAddImage}
                    >
                      <Ionicons name="camera" size={32} color="#3498DB" />
                      <Text style={styles.addImageText}>Add Image</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, creatingItem && styles.submitButtonDisabled]}
                onPress={handleCreateItem}
                disabled={creatingItem}
              >
                {creatingItem ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Item to Auction</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Bottom Controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
        {/* TikTok-style Sound Effect Buttons */}
        <View style={styles.soundButtonsContainer}>
          <TouchableOpacity 
            style={styles.soundButton} 
            onPress={playCheer}
            activeOpacity={0.7}
          >
            <Text style={styles.soundButtonEmoji}>🎉</Text>
            <Text style={styles.soundButtonLabel}>Cheer</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.soundButton} 
            onPress={playClap}
            activeOpacity={0.7}
          >
            <Ionicons name="hand-right" size={24} color="white" />
            <Text style={styles.soundButtonLabel}>Clap</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.soundButton} 
            onPress={playLaugh}
            activeOpacity={0.7}
          >
            <Ionicons name="happy" size={24} color="white" />
            <Text style={styles.soundButtonLabel}>Laugh</Text>
          </TouchableOpacity>
        </View>

        {/* Camera Controls */}
        <View style={styles.bottomButtonsContainer}>
          <TouchableOpacity style={styles.controlIconButton} onPress={handleToggleMicrophone}>
            <Ionicons 
              name={isAudioMuted ? "mic-off" : "mic"} 
              size={24} 
              color={isAudioMuted ? "#E74C3C" : "white"} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlIconButton} onPress={handleFlipCamera}>
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlIconButton} onPress={handleToggleVideo}>
            <Ionicons 
              name={isVideoMuted ? "videocam-off" : "videocam"} 
              size={24} 
              color={isVideoMuted ? "#E74C3C" : "white"} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.controlIconButton} 
            onPress={() => setShowBidDashboard(true)}
          >
            <Ionicons name="stats-chart" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.controlIconButton} 
            onPress={() => setShowAddItemModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="#3498DB" />
          </TouchableOpacity>
        </View>

        {/* Multi-Item Auction Controls */}
        {currentItem ? (
          <View style={styles.auctionControlsContainer}>
            {/* When item is waiting - Start Auction/Bid Button and Skip */}
            {itemBiddingStatus === 'waiting' && auctionPhase === 'idle' && (
              <View style={styles.idleControls}>
                <TouchableOpacity 
                  style={[styles.auctionButton, styles.startBiddingButton]} 
                  onPress={handleStartItemCountdown}
                  disabled={auctionPhase !== 'idle'}
                >
                  <Ionicons name="play" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.auctionButtonText}>START BID</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.auctionButton, styles.skipButton]} 
                  onPress={handleSkipItem}
                >
                  <Ionicons name="arrow-forward-circle" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.skipButtonText}>SKIP</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Gavel Button - Visible during bidding_active phase */}
            {auctionPhase === 'bidding_active' && (
              <TouchableOpacity 
                style={[styles.auctionButton, styles.gavelButton]} 
                onPress={handleGavel}
              >
                <Ionicons name="hammer" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.auctionButtonText}>GAVEL</Text>
              </TouchableOpacity>
            )}

            {/* Phase indicators (shows current phase) */}
            {auctionPhase === 'timer_playing' && (
              <View style={[styles.auctionButton, styles.phaseIndicator]}>
                <Text style={styles.auctionButtonText}>⏱️ Timer Playing...</Text>
              </View>
            )}
            
            {auctionPhase === 'gavel_playing' && (
              <View style={[styles.auctionButton, styles.phaseIndicator]}>
                <Text style={styles.auctionButtonText}>🔨 Gavel Playing...</Text>
              </View>
            )}

            {auctionPhase === 'winner_playing' && (
              <View style={[styles.auctionButton, styles.phaseIndicator]}>
                <Text style={styles.auctionButtonText}>🎉 Winner Playing...</Text>
              </View>
            )}

            {/* During active bidding (fallback - if item status is active but phase doesn't match) */}
            {itemBiddingStatus === 'active' && auctionPhase !== 'bidding_active' && auctionPhase !== 'gavel_playing' && auctionPhase !== 'winner_playing' && (
              <TouchableOpacity 
                style={[styles.auctionButton, styles.endBiddingButton]} 
                onPress={handleEndBiddingNow}
              >
                <Ionicons name="stop" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.auctionButtonText}>END BIDDING</Text>
              </TouchableOpacity>
            )}

            {/* After bidding ends - Only CANCEL button (but hide if gavel was used or next item is loading) */}
            {itemBiddingStatus === 'ended' && 
             auctionPhase !== 'gavel_playing' && 
             auctionPhase !== 'winner_playing' && 
             auctionPhase !== 'complete' && 
             auctionPhase !== 'idle' && (
              <TouchableOpacity 
                style={[styles.auctionButton, styles.skipButton]} 
                onPress={handleCancelItem}
              >
                <Ionicons name="close-circle" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.auctionButtonText}>CANCEL</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.auctionControlsContainer}>
            <TouchableOpacity 
              style={[styles.auctionButton, styles.selectItemButton]} 
              onPress={() => setShowItemQueue(true)}
            >
              <Ionicons name="list" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.auctionButtonText}>SELECT ITEM</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.auctionButton, styles.loadNextButton]} 
              onPress={async () => {
                try {
                  await auctionsAPI.loadNextItem(auctionId);
                  // Item should load via WebSocket event
                } catch (error: any) {
                  Alert.alert('Error', error.message || 'Failed to load item');
                }
              }}
            >
              <Ionicons name="arrow-forward" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.auctionButtonText}>LOAD NEXT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Item Queue Modal */}
      {showItemQueue && (
        <Modal
          visible={showItemQueue}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowItemQueue(false)}
        >
          <View style={[styles.modalContainer, { paddingBottom: (insets.bottom || 0) + 12 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Item to Auction</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowItemQueue(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {loadingItems ? (
              <ActivityIndicator size="large" color="#3498DB" style={{ marginTop: 40 }} />
            ) : itemQueue.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={60} color="#666" />
                <Text style={styles.emptyText}>No items in queue</Text>
                <Text style={styles.emptySubtext}>Add items using the + button</Text>
              </View>
            ) : (
              <FlatList
                data={itemQueue}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.queueItem,
                      item.id === currentItem?.id && styles.queueItemActive
                    ]}
                    onPress={() => handleSelectItem(item)}
                  >
                    {item.images && item.images.length > 0 && (
                      <Image source={{ uri: item.images[0] }} style={styles.queueItemImage} />
                    )}
                    <View style={styles.queueItemInfo}>
                      <View style={styles.queueItemHeader}>
                        <Text style={styles.queueItemTitle} numberOfLines={1}>{item.title}</Text>
                        {item.id === currentItem?.id && (
                          <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                        )}
                      </View>
                      <Text style={styles.queueItemPrice}>
                        Starting: ₣{item.starting_price.toFixed(2)}
                      </Text>
                      <View style={styles.queueItemMeta}>
                        <Text style={styles.queueItemOrder}>Item #{item.order_in_auction}</Text>
                        <View style={[styles.queueItemStatusBadge, { 
                          backgroundColor: item.bidding_status === 'waiting' ? '#3498DB' : 
                                          item.bidding_status === 'active' ? '#27AE60' :
                                          item.bidding_status === 'sold' ? '#27AE60' :
                                          '#999'
                        }]}>
                          <Text style={styles.queueItemStatusText}>
                            {item.bidding_status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 16 + (insets.bottom || 0) }}
              />
            )}
          </View>
        </Modal>
      )}
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
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
    marginTop: 16,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  cameraPlaceholderText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  topRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
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
    borderRadius: 20,
    gap: 6,
  },
  viewerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  reactionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    alignItems: 'flex-end',
  },
  reactionBubble: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  reactionBubbleEmoji: {
    fontSize: 24,
  },
  reactionCountsContainer: {
    position: 'absolute',
    left: 16,
    bottom: 200,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reactionCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionCountEmoji: {
    fontSize: 18,
  },
  reactionCountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  auctionInfoOverlay: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 16,
    zIndex: 10,
  },
  auctionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bidInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  currentBidLabel: {
    color: '#999',
    fontSize: 14,
  },
  currentBidAmount: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timeRemaining: {
    color: '#FFA500',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  soundButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  soundButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  soundButtonEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  soundButtonLabel: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  controlIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  auctionControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  auctionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.8)',
    alignItems: 'center',
  },
  auctionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  soldButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
  },
  soldButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startBiddingButton: {
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gavelButton: {
    backgroundColor: 'rgba(142, 68, 173, 0.9)', // Purple for gavel
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseIndicator: {
    backgroundColor: 'rgba(52, 152, 219, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBiddingButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: 'rgba(149, 165, 166, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  postBiddingControls: {
    flexDirection: 'row',
    flex: 1,
  },
  idleControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  countdownText: {
    color: 'white',
    fontSize: 120,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bidItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  bidItemLeft: {
    flex: 1,
  },
  bidderId: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bidTime: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  bidAmount: {
    color: '#3498DB',
    fontSize: 18,
    fontWeight: 'bold',
  },
  winningBid: {
    color: '#FFD700',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  winnerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '80%',
  },
  winnerModalTitle: {
    color: '#FFD700',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
  },
  winnerText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 8,
  },
  winnerBid: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  winnerModalButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  winnerModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addItemForm: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  imagesContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  imagePreview: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#3498DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    color: '#3498DB',
    fontSize: 10,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectItemButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadNextButton: {
    backgroundColor: 'rgba(142, 68, 173, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  queueItemActive: {
    borderColor: '#27AE60',
    borderWidth: 2,
  },
  queueItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  queueItemTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  queueItemPrice: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  queueItemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueItemOrder: {
    color: '#888',
    fontSize: 12,
  },
  queueItemStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  queueItemStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});

export default AuctionLiveBroadcastScreen;
