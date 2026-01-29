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
  Image,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { liveSalesAPI, LiveStreamProduct, LiveStreamService, LivePortfolioService, PortfolioImage, PortfolioAnalytics } from '../services/liveSalesAPI';
import { liveStreamSocket, LiveComment, LiveReaction, LiveGift } from '../services/liveStreamSocket';
import { productsAPI, Product } from '../services/productsAPI';
import { workspaceAPI, WorkspaceOrder } from '../services/workspaceAPI';
import { useAuctionSounds } from '../services/auctionSoundService';
import * as ImagePicker from 'expo-image-picker';
import GiftAnimation from '../components/GiftAnimation';

// Import basic Agora SDK
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, IRtcEngine, ChannelMediaOptions, RtcSurfaceView, RenderModeType, VideoCanvas } from 'react-native-agora';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Live Stream Broadcast Screen
 * 
 * Full-screen camera interface for vendor broadcasting using Agora UI Kit
 * - Simple Agora integration with pre-built UI
 * - Real-time comments overlay
 * - Viewer count display
 * - Live indicators
 * - End stream functionality
 */

const LiveStreamBroadcastScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { stream: initialStream } = route.params;
  const [stream, setStream] = useState(initialStream);

  // Sound effects
  const { playCheer, playClap, playLaugh } = useAuctionSounds();

  // Agora state - Industry Standard Implementation
  const [agoraConfig, setAgoraConfig] = useState<any>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [agoraEngine, setAgoraEngine] = useState<IRtcEngine | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPreviewStarted, setIsPreviewStarted] = useState(false);

  // Initialization guards - Prevent premature Agora initialization
  const [isAgoraInitialized, setIsAgoraInitialized] = useState(false);
  const [isVideoViewReady, setIsVideoViewReady] = useState(false);
  const agoraEngineRef = useRef<IRtcEngine | null>(null);

  // Stream state
  const [viewerCount, setViewerCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Audio/Video controls
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // Camera and microphone permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Comments
  const [comments, setComments] = useState<LiveComment[]>([]);
  const commentsListRef = useRef<FlatList>(null);

  // Reactions
  const [reactions, setReactions] = useState<LiveReaction[]>([]);

  // Gift animations
  const [activeGiftAnimations, setActiveGiftAnimations] = useState<Array<{
    id: string;
    emoji: string;
    quantity: number;
  }>>([]);

  // Product/Service showcase
  const [showcasedItem, setShowcasedItem] = useState<LiveStreamProduct | LiveStreamService | LivePortfolioService | null>(null);
  const [showShowcaseControls, setShowShowcaseControls] = useState(false);

  // Highlighted item (dynamic host card)
  const [highlightedItem, setHighlightedItem] = useState<LiveStreamProduct | LiveStreamService | LivePortfolioService | null>(null);

  // Portfolio services
  const [portfolioServices, setPortfolioServices] = useState<LivePortfolioService[]>([]);
  const [showPortfolioUploadModal, setShowPortfolioUploadModal] = useState(false);
  const [portfolioImages, setPortfolioImages] = useState<Array<{
    uri: string;
    caption: string;
    is_primary: boolean;
  }>>([]);
  const [portfolioUploadData, setPortfolioUploadData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'work_sample' as 'work_sample' | 'consultation' | 'service_package' | 'testimonial',
  });
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  // Product selection for product streams
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [showProductPickerModal, setShowProductPickerModal] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editLivePrice, setEditLivePrice] = useState('');
  const [editLiveStock, setEditLiveStock] = useState('');


  // Analytics modal
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [showOrders, setShowOrders] = useState(false);
  const [workspaceOrders, setWorkspaceOrders] = useState<WorkspaceOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState(false);
  const [orderPin, setOrderPin] = useState('');
  const [orderPinError, setOrderPinError] = useState<string | null>(null);

  // Video view reference for setupLocalVideo
  const rtcSurfaceViewRef = useRef<any>(null);

  // Analytics data
  const [analytics, setAnalytics] = useState({
    viewers: 0,
    totalViewers: 0,
    comments: 0,
    reactions: 0,
    gifts: 0,
    giftValue: 0,
    sales: 0,
    revenue: 0,
  });
  const [portfolioAnalytics, setPortfolioAnalytics] = useState<PortfolioAnalytics[]>([]);
  const [loadingPortfolioAnalytics, setLoadingPortfolioAnalytics] = useState(false);

  // Initialize Agora configuration
  useEffect(() => {
    initializeStream();
    return () => {
      // Cleanup on component unmount
      console.log('🏁 Component unmounting - cleaning up stream...');
      cleanupStream().catch((error: any) => {
        console.error('❌ Cleanup on unmount failed:', error);
      });

      // Reset initialization guards for potential re-mount
      setIsAgoraInitialized(false);
      setIsVideoViewReady(false);
      agoraEngineRef.current = null;
    };
  }, []);

  // Initialize Agora engine when config is ready
  useEffect(() => {
    if (!agoraEngine && agoraConfig && !loading && !isAgoraInitialized) {
      console.log('🔄 Triggering Agora initialization...');
      initializeAgoraEngine();
    }
  }, [agoraConfig, agoraEngine, loading, isAgoraInitialized]);

  // Update analytics when data changes
  useEffect(() => {
    setAnalytics(prev => ({
      ...prev,
      viewers: viewerCount,
      comments: comments.length,
    }));
  }, [viewerCount, comments]);


  const initializeStream = async () => {
    try {
      // Check if running in Expo Go
      if (Constants.appOwnership === 'expo') {
        Alert.alert(
          '📱 Expo Go Limitation',
          'Live streaming requires native Agora modules that are not available in Expo Go.\n\n' +
          'To broadcast live streams, please:\n' +
          '1. Build the app with EAS: npx eas build\n' +
          '2. Install the custom build on your device\n\n' +
          'Viewers can watch streams in Expo Go using HLS playback.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setLoading(true);

      // ✅ REQUEST CAMERA PERMISSION FIRST
      console.log('📷 Requesting camera permission...');
      const cameraResult = await requestCameraPermission();
      if (!cameraResult?.granted) {
        throw new Error('Camera permission is required for live streaming');
      }
      console.log('✅ Camera permission granted');

      // ✅ REQUEST MICROPHONE PERMISSION
      console.log('🎤 Requesting microphone permission...');
      const micResult = await requestMicPermission();
      if (!micResult?.granted) {
        throw new Error('Microphone permission is required for live streaming');
      }
      console.log('✅ Microphone permission granted');

      // Update stream status to LIVE before proceeding
      await liveSalesAPI.updateStreamStatus(stream.id, 'live');
      console.log('✅ Stream status updated to LIVE');

      // Get Agora token from backend
      const { token, channel, uid, appId } = await liveSalesAPI.generateAgoraToken(stream.id);

      console.log('🎥 Agora Config:', { appId, channel, uid });

      // Configure Agora UI Kit
      const connectionData = {
        appId: appId,
        channel: channel, // AgoraUIKit v5 expects 'channel', not 'channelName'
        token: token || null,
        uid: uid,
      };

      setAgoraConfig(connectionData);

      // Register event listeners BEFORE connecting to ensure they're ready
      // Register viewer_count_update listener early so it can receive updates immediately
      liveStreamSocket.on('viewer_count_update', (viewerData: any) => {
        console.log('📊 Host received viewer_count_update:', viewerData);
        const newCount = viewerData.count || viewerData.current_viewers || 0;
        console.log('📊 Setting viewer count to:', newCount);
        setViewerCount(newCount);
      });

      // Register event listener for joined_stream BEFORE connecting
      liveStreamSocket.on('joined_stream', (data: any) => {
        console.log('🔥 JOINED_STREAM EVENT RECEIVED:', data);
        if (data.success) {
          // Set initial viewer count from joined_stream response
          if (data.viewerCount !== undefined) {
            console.log('📊 Setting initial viewer count from joined_stream:', data.viewerCount);
            setViewerCount(data.viewerCount);
          }
          
          console.log('🚀 About to register event listeners and complete initialization');

          try {
            // Register remaining event listeners
            liveStreamSocket.on('comment', handleNewComment);
            liveStreamSocket.on('new_reaction', handleNewReaction);
            liveStreamSocket.on('new_gift', handleNewGift);
            liveStreamSocket.on('analytics_update', handleAnalyticsUpdate);
            // Note: Host doesn't need to listen for highlight_item - they're the ones sending it
            liveStreamSocket.on('stream_status_update', handleStreamStatusUpdate);

            console.log('📝 Event listeners registered');
            console.log('🎉 Stream initialization complete - setting loading to false');

            // THIS IS THE CRITICAL LINE - if this doesn't execute, loading stays true
            setLoading(false);
            console.log('✅ SUCCESS: Loading set to false - AgoraUIKit should now render!');

            console.log('🔥 Agora config for rendering:', agoraConfig);
          } catch (error: any) {
            console.error('❌ CRITICAL ERROR during final initialization:', error);
            console.error('❌ Error details:', error.message, error.stack);
            Alert.alert('Initialization Error', `Failed to complete setup: ${error.message}`);
          }
        } else {
          console.error('❌ Joined stream failed:', data);
          Alert.alert('Join Error', 'Failed to join the live stream');
        }
      });

      // Connect to WebSocket for comments (industry standard: waits for authentication)
      console.log('🔌 Connecting to LiveStream socket...');
      await liveStreamSocket.connect();
      console.log('✅ LiveStream socket authenticated');

      // Join the stream room so we receive joined_stream + viewer_count_update
      console.log('🚪 Joining stream room as vendor...');
      await liveStreamSocket.joinStream(stream.id, 'vendor');
    } catch (error) {
      console.error('❌ Error during local cleanup:', error);
      // Still try to clean up state even if something failed
      setAgoraEngine(null);
      setAgoraConfig(null); // Clear config even on error
      setIsJoined(false);
      setIsPreviewStarted(false);
      throw error; // Re-throw so caller knows cleanup had issues
    }
  };

  const cleanupStream = async () => {
    console.log('🧹 Starting local resource cleanup...');

    try {
      // Clear socket listeners and leave stream
      liveStreamSocket.clearListeners();
      liveStreamSocket.leaveStream();
      console.log('✅ Socket cleanup completed');
    } catch (error: any) {
      console.error('❌ Error during socket cleanup:', error);
    }

    // Cleanup Agora engine
    if (agoraEngine) {
      try {
        console.log('🎥 Cleaning up Agora engine...');

        // Remove all listeners
        agoraEngine.removeAllListeners();

        // Leave channel first, then release
        await agoraEngine.leaveChannel();
        await agoraEngine.release();

        console.log('✅ Agora engine cleaned up');
      } catch (cleanupError: any) {
        console.warn('⚠️ Agora cleanup warning:', cleanupError);
        // Don't throw here - we want to continue with state cleanup
      } finally {
        setAgoraEngine(null);
        agoraEngineRef.current = null; // Clear ref as well
        setIsJoined(false);
        setIsPreviewStarted(false);
        setIsAgoraInitialized(false); // Reset initialization flag
        setAgoraConfig(null); // Clear config to prevent re-initialization
      }
    }

    console.log('✅ Local cleanup completed successfully');
  };

  const formatDeliveryAddress = (address: any): string => {
    if (!address) return 'No address provided';
    if (typeof address === 'string') return address;

    const parts = [address.address, address.city, address.state, address.postalCode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address provided';
  };

  const loadActiveOrders = async () => {
    setOrdersLoading(true);
    setOrdersError(null);

    try {
      const orders = await workspaceAPI.getActiveOrders();
      setWorkspaceOrders(orders);
    } catch (e: any) {
      setOrdersError(e?.message || 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const openOrdersModal = async () => {
    setShowOrders(true);
    setSelectedOrderId(null);
    setSelectedOrderDetails(null);
    setOrderPin('');
    setOrderPinError(null);
    await loadActiveOrders();
  };

  const closeOrdersModal = () => {
    setShowOrders(false);
    setSelectedOrderId(null);
    setSelectedOrderDetails(null);
    setOrderPin('');
    setOrderPinError(null);
    setOrdersError(null);
  };

  const openOrderDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setSelectedOrderDetails(null);
    setOrderPin('');
    setOrderPinError(null);
    setOrderDetailsLoading(true);

    try {
      const details = await workspaceAPI.getOrderDetails(orderId);
      setSelectedOrderDetails(details);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load order details');
      setSelectedOrderId(null);
    } finally {
      setOrderDetailsLoading(false);
    }
  };

  const getQuickActionForOrder = (order: WorkspaceOrder | null) => {
    if (!order) return null;
    const isSelfPickup = order.deliveryType === 'pickup';

    switch (order.status) {
      case 'pending':
        return { type: 'pending' as const };
      case 'processing':
        if (isSelfPickup) return { type: 'single' as const, action: 'ready_pickup', label: 'Mark Ready for Pickup', requiresPin: false };
        return { type: 'single' as const, action: 'ready', label: 'Mark Ready', requiresPin: false };
      case 'ready_for_pickup':
        if (isSelfPickup) return { type: 'single' as const, action: 'confirm_pickup', label: 'Confirm Pickup', requiresPin: true };
        return { type: 'single' as const, action: 'pickup', label: 'Rider Pickup', requiresPin: true };
      case 'out_for_delivery':
        return { type: 'single' as const, action: 'delivered', label: 'Mark Delivered', requiresPin: true };
      default:
        return null;
    }
  };

  const runOrderAction = async (order: WorkspaceOrder | null, action: string) => {
    if (!order) return;

    setOrderActionLoading(true);
    setOrderPinError(null);

    try {
      if (action === 'accept') {
        await workspaceAPI.acceptOrder(order.id);
      } else if (action === 'decline') {
        await workspaceAPI.declineOrder(order.id, 'Vendor rejected order');
      } else if (action === 'ready') {
        await workspaceAPI.markOrderReady(order.id);
      } else if (action === 'ready_pickup') {
        await workspaceAPI.markOrderReadyForPickup(order.id);
      } else if (action === 'pickup') {
        if (!orderPin.trim()) throw new Error('PIN is required');
        await workspaceAPI.confirmPickupWithPin(order.id, orderPin.trim());
      } else if (action === 'confirm_pickup') {
        if (!orderPin.trim()) throw new Error('PIN is required');
        await workspaceAPI.confirmSelfPickupWithPin(order.id, orderPin.trim());
      } else if (action === 'delivered') {
        if (!orderPin.trim()) throw new Error('PIN is required');
        await workspaceAPI.markDelivered(order.id, orderPin.trim());
      }

      await loadActiveOrders();
      if (selectedOrderId) {
        await openOrderDetails(selectedOrderId);
      }
    } catch (e: any) {
      const message = e?.message || 'Failed to update order';
      setOrderPinError(message);
      Alert.alert('Error', message);
    } finally {
      setOrderActionLoading(false);
    }
  };

  const handleNewComment = (comment: LiveComment) => {
    // Prevent duplicate comments - check if comment ID already exists
    setComments(prev => {
      // Check if this comment already exists (by ID)
      const exists = prev.some(c => c.id === comment.id);
      if (exists) {
        console.log('⚠️ Duplicate comment ignored on host screen:', comment.id);
        return prev;
      }
      
      // If this is our own comment (isOwn: true), replace any optimistic comment
      if (comment.isOwn) {
        console.log('✅ Replacing optimistic comment with server response on host:', comment.id);
        // Remove temporary optimistic comment and add the real one
        return prev.filter(c => !c.id.startsWith('temp-')).concat(comment);
      }
      
      console.log('✅ Adding new comment from viewers on host:', comment.id);
      return [...prev, comment];
    });
    // Scroll to end (bottom) to show newest comments
    setTimeout(() => {
      commentsListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    // Update analytics
    setAnalytics(prev => ({
      ...prev,
      comments: prev.comments + 1,
    }));
  };

  const handleNewReaction = (reaction: LiveReaction) => {
    console.log('🎉 New reaction received on host screen:', reaction);
    setReactions(prev => [...prev, { ...reaction, id: Date.now() + Math.random() }]);
    // Update analytics
    setAnalytics(prev => ({
      ...prev,
      reactions: prev.reactions + 1,
    }));
    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.slice(1));
    }, 3000);
  };

  const handleNewGift = (giftData: LiveGift | any) => {
    console.log('🎁 Gift received on host screen:', giftData);

    const emoji = giftData?.giftEmoji || giftData?.emoji || '🎁';
    const quantity = giftData?.quantity || 1;
    const amount = giftData?.amount || giftData?.total_value || giftData?.total_amount || 0;

    const animationId = `gift-${Date.now()}-${Math.random()}`;
    setActiveGiftAnimations(prev => [...prev, { id: animationId, emoji, quantity }]);

    setTimeout(() => {
      setActiveGiftAnimations(prev => prev.filter(anim => anim.id !== animationId));
    }, 5000);

    setAnalytics(prev => ({
      ...prev,
      gifts: prev.gifts + 1,
      giftValue: prev.giftValue + (typeof amount === 'number' ? amount : 0),
      revenue: prev.revenue + (typeof amount === 'number' ? amount : 0),
    }));
  };

  const handleAnalyticsUpdate = (data: any) => {
    if (!data) return;

    setAnalytics(prev => {
      const sales = typeof data.totalSales === 'number' ? Math.max(prev.sales, data.totalSales) : prev.sales;
      const giftValue = typeof data.giftValue === 'number' ? Math.max(prev.giftValue, data.giftValue) : prev.giftValue;
      const revenue = (typeof sales === 'number' ? sales : 0) + (typeof giftValue === 'number' ? giftValue : 0);

      const comments = typeof data.commentCount === 'number' ? Math.max(prev.comments, data.commentCount) : prev.comments;
      const reactions = typeof data.reactionCount === 'number' ? Math.max(prev.reactions, data.reactionCount) : prev.reactions;
      const gifts = typeof data.giftCount === 'number' ? Math.max(prev.gifts, data.giftCount) : prev.gifts;

      return {
        ...prev,
        viewers: data.viewerCount ?? prev.viewers,
        totalViewers: data.totalViewers ?? prev.totalViewers,
        comments,
        reactions,
        gifts,
        giftValue,
        sales,
        revenue,
      };
    });
  };

  const handleStreamStatusUpdate = (statusUpdate: any) => {
    console.log('📡 Stream status update received:', statusUpdate);

    if (statusUpdate.streamId === stream.id) {
      if (statusUpdate.status === 'paused') {
        setIsPaused(true);
        console.log('⏸️ Stream paused');
      } else if (statusUpdate.status === 'live') {
        setIsPaused(false);
        console.log('▶️ Stream resumed');
      }
    }
  };

  // Handle showcase item - notify viewers to show the item
  const handleShowcaseAddToCart = (item: LiveStreamProduct | LiveStreamService | LivePortfolioService) => {
    // Send showcase event to all viewers
    liveStreamSocket.emitShowcaseItem({
      item: item,
      showcasedBy: user?.id,
    });

    // Also send a comment notification
    let itemName = '';
    let itemPrice = 0;
    
    if ('product' in item) {
      itemName = (item as LiveStreamProduct).product.name;
      itemPrice = (item as LiveStreamProduct).live_price;
    } else if ('service' in item) {
      itemName = (item as LiveStreamService).service?.name || '';
      itemPrice = (item as LiveStreamService).live_price;
    } else if ('title' in item) {
      itemName = (item as LivePortfolioService).title;
      itemPrice = (item as LivePortfolioService).price;
    }
    
    liveStreamSocket.sendComment(`🔥 Hot item: ${itemName} - ₣${itemPrice}! Add to cart now!`);

    console.log('🎯 Item showcased to viewers:', item);
  };

  // Portfolio upload handlers
  const handleAddPortfolioImage = async () => {
    if (portfolioImages.length >= 5) {
      Alert.alert('Maximum Images', 'You can upload up to 5 images per portfolio item.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPortfolioImages(prev => [...prev, {
        uri: result.assets[0].uri,
        caption: '',
        is_primary: prev.length === 0, // First image is primary
      }]);
    }
  };

  const handleRemovePortfolioImage = (index: number) => {
    setPortfolioImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // If we removed the primary image, make the first one primary
      if (updated.length > 0 && !updated.some(img => img.is_primary)) {
        updated[0].is_primary = true;
      }
      return updated;
    });
  };

  const handleSetPrimaryImage = (index: number) => {
    setPortfolioImages(prev =>
      prev.map((img, i) => ({
        ...img,
        is_primary: i === index,
      }))
    );
  };

  const handleUpdateImageCaption = (index: number, caption: string) => {
    setPortfolioImages(prev =>
      prev.map((img, i) => i === index ? { ...img, caption } : img)
    );
  };

  const handleUploadPortfolio = async () => {
    if (portfolioImages.length === 0 || !portfolioUploadData.title || !portfolioUploadData.price) {
      Alert.alert('Missing Information', 'Please add at least one image, title, and price.');
      return;
    }

    const price = parseFloat(portfolioUploadData.price);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than 0.');
      return;
    }

    setUploadingPortfolio(true);
    try {
      const newPortfolioService = await liveSalesAPI.uploadPortfolioService({
        stream_id: stream.id,
        images: portfolioImages,
        title: portfolioUploadData.title,
        description: portfolioUploadData.description,
        price: price,
        category: portfolioUploadData.category,
      });

      // Add to local state
      setPortfolioServices(prev => [...prev, newPortfolioService]);

      // Broadcast to viewers via WebSocket
      liveStreamSocket.emitShowcaseItem({
        item: newPortfolioService,
        showcasedBy: user?.id,
        type: 'portfolio',
      });

      // Reset form and close modal
      setPortfolioImages([]);
      setPortfolioUploadData({
        title: '',
        description: '',
        price: '',
        category: 'work_sample',
      });
      setShowPortfolioUploadModal(false);

      Alert.alert('Success', 'Portfolio item uploaded and showcased to viewers!');
    } catch (error) {
      console.error('Error uploading portfolio:', error);
      Alert.alert('Upload Failed', 'Failed to upload portfolio item. Please try again.');
    } finally {
      setUploadingPortfolio(false);
    }
  };

  // Load products from vendor's catalogue
  const loadVendorProducts = async () => {
    try {
      setLoadingProducts(true);
      const products = await productsAPI.getMyProducts();
      setAvailableProducts(products.filter(p => p.status === 'active'));
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load your products');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Handle product selection from catalogue
  const handleSelectProduct = (product: Product) => {
    // Check if product is already in stream
    if (stream.products?.some((p: any) => p.product_id === product.id)) {
      Alert.alert('Already Added', 'This product is already in your stream');
      return;
    }

    // Set up editing state with product defaults
    setEditingProduct(product);
    setEditLivePrice(product.price.toString());
    setEditLiveStock(product.quantity.toString());
  };


  // Handle highlighting an item (billboard feature)
  const handleHighlightItem = (item: LiveStreamProduct | LiveStreamService | LivePortfolioService) => {
    console.log('🌟 Host highlighting item:', item);
    // Set locally first so host sees it immediately
    setHighlightedItem(item);
    console.log('✅ Highlighted item set on host screen');
    // Broadcast to viewers via WebSocket
    liveStreamSocket.emitHighlightItem({
      item: item,
      highlightedBy: user?.id,
      type: 'product' in item ? 'product' : 'service' in item ? 'service' : 'portfolio',
    });
    console.log('📡 Highlight event emitted to backend');
  };

  // Handle dismissing highlight card
  const handleDismissHighlight = () => {
    console.log('❌ Host dismissing highlight');
    // Clear locally first
    setHighlightedItem(null);
    console.log('✅ Highlight cleared on host screen');
    // Broadcast dismissal to viewers
    liveStreamSocket.emitHighlightItem({
      item: null,
      highlightedBy: user?.id,
      type: 'dismiss',
    });
    console.log('📡 Dismissal event emitted to backend');
  };

  // Save product configuration and add to stream
  const handleSaveProductConfig = async () => {
    if (!editingProduct) return;

    const livePrice = parseFloat(editLivePrice);
    const liveStock = parseInt(editLiveStock);

    if (isNaN(livePrice) || livePrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid live price');
      return;
    }

    if (isNaN(liveStock) || liveStock <= 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity');
      return;
    }

    if (liveStock > editingProduct.quantity) {
      Alert.alert('Invalid Stock', 'Live stock cannot exceed available quantity');
      return;
    }

    try {
      console.log('➕ Adding product to stream:', {
        streamId: stream.id,
        productId: editingProduct.id,
        productName: editingProduct.name,
        livePrice,
        liveStock,
      });

      const newProduct = await liveSalesAPI.addProductToStream(stream.id, {
        product_id: editingProduct.id,
        live_price: livePrice,
        live_stock: liveStock,
        is_featured: false,
      });

      console.log('✅ Product added successfully:', {
        streamId: stream.id,
        liveStreamProductId: newProduct.id,
        productId: newProduct.product_id,
        productName: newProduct.product?.name,
      });

      // Reload stream to get updated product list
      const updatedStream = await liveSalesAPI.getStreamById(stream.id);
      console.log('📦 Stream products after reload:', {
        streamId: stream.id,
        productCount: updatedStream.products?.length || 0,
        productIds: (updatedStream.products || []).map((p: any) => ({
          id: p.id,
          product_id: p.product_id,
          name: p.product?.name,
        })),
      });
      setStream(updatedStream);

      // Broadcast to viewers via WebSocket
      liveStreamSocket.emitShowcaseItem({
        item: newProduct,
        showcasedBy: user?.id,
        type: 'product',
      });

      // Reset editing state and close modal
      setEditingProduct(null);
      setEditLivePrice('');
      setEditLiveStock('');
      setShowProductPickerModal(false);

      Alert.alert('Success', 'Product added to stream and showcased to viewers!');
    } catch (error: any) {
      console.error('❌ Error adding product to stream:', {
        streamId: stream.id,
        productId: editingProduct.id,
        error: error.message,
        fullError: error,
      });
      Alert.alert('Error', error.message || 'Failed to add product to stream');
    }
  };

  const handleJoinSuccess = async () => {
    console.log('🎉 Agora JoinChannelSuccess - camera should be active!');
    setIsInCall(true);

    try {
      // Mark as live (already done in initializeStream, but ensure it's set)
      setIsLive(true);
      console.log('✅ Agora channel joined successfully - live streaming active');
    } catch (error) {
      console.error('Error updating stream status:', error);
    }
  };

  const initializeAgoraEngine = async () => {
    // 🚀 GUARD: Prevent double initialization
    if (isAgoraInitialized || agoraEngineRef.current) {
      console.log('🔄 Agora engine already initialized, skipping');
      return;
    }

    // 🚀 GUARD: Only initialize when config is ready
    if (!agoraConfig) {
      console.log('⏳ Waiting for config before initializing Agora...');
      return;
    }

    try {
      console.log('🎥 Initializing Agora Engine - Industry Standard Implementation...');
      console.log('🎥 Agora config at init:', JSON.stringify(agoraConfig, null, 2));

      // 🚀 INDUSTRY STANDARD: Create and initialize engine properly
      const engine = createAgoraRtcEngine();
      agoraEngineRef.current = engine; // Store reference to prevent double init
      setAgoraEngine(engine); // Update state for UI
      setIsAgoraInitialized(true); // Mark as initialized
      console.log('✅ Agora Engine created');

      // 🚀 INDUSTRY STANDARD: Initialize with proper context
      const initResult = engine.initialize({
        appId: agoraConfig.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting
      });

      if (initResult !== 0) {
        throw new Error(`Engine initialization failed with code: ${initResult}`);
      }
      console.log('✅ Agora Engine initialized successfully');

      // 🚀 INDUSTRY STANDARD: Set broadcaster role BEFORE enabling media
      await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      console.log('✅ Client role set to Broadcaster');

      // 🚀 INDUSTRY STANDARD: Enable video BEFORE startPreview
      const enableVideoResult = await engine.enableVideo();
      console.log('✅ Video enabled, result:', enableVideoResult);

      const enableAudioResult = await engine.enableAudio();
      console.log('✅ Audio enabled, result:', enableAudioResult);

      // 🚀 CRITICAL FIX: Ensure video is NOT muted
      await engine.muteLocalVideoStream(false);
      console.log('✅ Local video stream unmuted');

      // 🚀 CRITICAL INDUSTRY STANDARD: Start preview BEFORE joining channel
      // This ensures camera is ready when joinChannel succeeds
      const previewResult = await engine.startPreview();
      setIsPreviewStarted(true);
      console.log('✅ Preview started - camera activated and ready, result:', previewResult);

      // Set up event listeners using addListener
      console.log('📝 Setting up Agora event handlers...');

      engine.addListener('onJoinChannelSuccess', (connection: any, elapsed: number) => {
        console.log('🎉 Agora onJoinChannelSuccess:', { connection, elapsed });
        setIsJoined(true);
        handleJoinSuccess();

        // Keep camera in BroadcastScreen - HostScreen will be modal for analytics
        // navigation.replace('LiveStreamHost', { ... });
      });

      engine.addListener('onUserJoined', (connection: any, remoteUid: number, elapsed: number) => {
        console.log('👤 Agora onUserJoined:', { remoteUid, elapsed });
      });

      engine.addListener('onUserOffline', (connection: any, remoteUid: number, reason: number) => {
        console.log('👋 Agora onUserOffline:', { remoteUid, reason });
      });

      engine.addListener('onError', (err: number, msg: string) => {
        console.error('💥 Agora onError:', { err, msg });

        // 🚀 INDUSTRY STANDARD: Handle specific error codes
        if (err === 110) {
          console.warn('⚠️ Error 110 (ERR_NO_BUFFER): Video view not ready yet - will retry');
          console.warn('💡 This is normal during initialization - video surface needs time to mount');
          // DON'T end stream for error 110 - it's just timing issue
          return; // Exit without ending stream
        } else if (err === 17) {
          console.warn('⚠️ Error 17 (ERR_JOIN_CHANNEL_REJECTED): UID conflict');
          console.warn('💡 Use uid: 0 for auto-assignment to avoid conflicts');
        } else {
          Alert.alert('Agora Error', `Engine error: ${err} - ${msg || 'Unknown error'}`);
        }
      });

      engine.addListener('onLeaveChannel', (connection: any, stats: any) => {
        console.log('👋 Agora onLeaveChannel:', { connection, stats });
        setIsJoined(false);
        setIsPreviewStarted(false);
        setAgoraEngine(null); // 🚀 Clean up engine reference
      });

      // 🚀 CRITICAL: Monitor local video statistics to confirm video is being sent
      engine.addListener('onLocalVideoStats', (connection: any, stats: any) => {
        console.log('📊 Local Video Stats:', {
          sentBitrate: stats.sentBitrate,
          sentFrameRate: stats.sentFrameRate,
          encoderOutputFrameRate: stats.encoderOutputFrameRate,
          captureFrameRate: stats.captureFrameRate,
          captureFrameWidth: stats.captureFrameWidth,
          captureFrameHeight: stats.captureFrameHeight,
        });
        
        if (stats.sentBitrate === 0) {
          console.warn('⚠️ WARNING: Video bitrate is 0 - video is NOT being sent!');
        } else {
          console.log('✅ Video is being sent successfully!');
        }
      });

      // 🚀 INDUSTRY STANDARD: Join channel with uid: 0 (auto-assignment)
      const mediaOptions = new ChannelMediaOptions();
      mediaOptions.publishCameraTrack = true;
      mediaOptions.publishMicrophoneTrack = true;
      mediaOptions.autoSubscribeVideo = true;
      mediaOptions.autoSubscribeAudio = true;
      mediaOptions.channelProfile = ChannelProfileType.ChannelProfileLiveBroadcasting;
      mediaOptions.clientRoleType = ClientRoleType.ClientRoleBroadcaster;

      console.log('🎯 Joining Agora channel with actual uid from token:', {
        token: agoraConfig.token ? 'present' : 'null',
        channel: agoraConfig.channel,
        uid: agoraConfig.uid, // Use the actual uid that matches the token
        publishVideo: mediaOptions.publishCameraTrack,
        publishAudio: mediaOptions.publishMicrophoneTrack,
      });

      const joinResult = await (engine as any).joinChannel(
        agoraConfig.token || '',
        agoraConfig.channel,
        agoraConfig.uid, // ✅ Use actual uid from token (not 0)
        mediaOptions
      );

      console.log('🔍 joinChannel result:', joinResult);

      if (joinResult === 0) {
        console.log('✅ joinChannel succeeded');

        // Verify media is publishing
        const connectionState = await engine.getConnectionState();
        console.log('📡 Agora connection state:', connectionState);
        
        // Agora engine is now fully initialized
        console.log('🚀 Agora Engine fully initialized and ready for video rendering');
        console.log('📹 Camera publishing:', mediaOptions.publishCameraTrack ? 'ENABLED' : 'DISABLED');
        console.log('🎤 Microphone publishing:', mediaOptions.publishMicrophoneTrack ? 'ENABLED' : 'DISABLED');
      } else {
        throw new Error(`joinChannel failed with error code: ${joinResult}`);
      }

    } catch (error: any) {
      console.error('❌ Failed to initialize Agora Engine:', error);
      console.error('❌ Error details:', error.message, error.stack);

      // 🚀 Clean up state on failure
      setIsPreviewStarted(false);
      setIsJoined(false);
      setIsLive(false);
      setAgoraEngine(null);

      Alert.alert('Agora Error', `Failed to start camera: ${error.message}`);
    }
  };

  const handleEndStream = () => {
    Alert.alert(
      'End Stream',
      'Are you sure you want to end this live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: handleEndStreamConfirmed,
        },
      ]
    );
  };

  const handlePauseResumeStream = async () => {
    const willPause = !isPaused;
    const action = willPause ? 'pause' : 'resume';
    const newStatus = willPause ? 'paused' : 'live';

    try {
      console.log(`⏸️ ${action.charAt(0).toUpperCase() + action.slice(1)}ing stream...`);

      // 1) Apply pause/resume LOCALLY first (so it works even if backend call fails)
      // Preserve the user's explicit mic/video toggle states when resuming.
      setIsPaused(willPause);

      if (agoraEngine) {
        try {
          const engineAny = agoraEngine as any;
          const canUpdateMediaOptions = typeof engineAny.updateChannelMediaOptions === 'function';

          if (canUpdateMediaOptions) {
            // Stop publishing tracks on pause. On resume, publish based on the current mute toggles.
            await engineAny.updateChannelMediaOptions({
              publishCameraTrack: !willPause && !isVideoMuted,
              publishMicrophoneTrack: !willPause && !isAudioMuted,
            });
          } else {
            // Fallback for older SDK surface
            await agoraEngine.muteLocalAudioStream(willPause || isAudioMuted);
            await agoraEngine.muteLocalVideoStream(willPause || isVideoMuted);
          }

          // Optional: stop local preview while paused (prevents host camera from "moving" locally)
          if (willPause && typeof engineAny.stopPreview === 'function') {
            await engineAny.stopPreview();
          }
          if (!willPause && typeof engineAny.startPreview === 'function') {
            await engineAny.startPreview();
          }

          console.log(`✅ Local stream ${action} applied`);
        } catch (localError: any) {
          console.error(`❌ Failed to ${action} locally:`, localError);
        }
      }

      // 2) Best-effort backend update (do not block pause/resume)
      try {
        await liveSalesAPI.updateStreamStatus(stream.id, newStatus);
        console.log(`✅ Stream ${action}d on backend`);
      } catch (backendError: any) {
        console.warn(`⚠️ Backend stream ${action} update failed (continuing locally):`, backendError?.message);
      }

    } catch (error: any) {
      console.error(`❌ Error ${action}ing stream:`, error);
      Alert.alert('Error', `Failed to ${action} stream: ${error.message}`);
    }
  };

  const handleToggleMicrophone = async () => {
    if (!agoraEngine) {
      console.warn('⚠️ Cannot toggle microphone: Agora engine not initialized');
      return;
    }

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
    if (!agoraEngine) {
      console.warn('⚠️ Cannot flip camera: Agora engine not initialized');
      return;
    }

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
    if (!agoraEngine) {
      console.warn('⚠️ Cannot toggle video: Agora engine not initialized');
      return;
    }

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

  const handleEndStreamConfirmed = async () => {
    try {
      console.log('🏁 Starting stream end process...');

      // Step 1: Update local UI state immediately for better UX
      setIsInCall(false);
      setIsLive(false);
      setIsPaused(false);
      setIsAudioMuted(false);
      setIsVideoMuted(false);

      // Step 2: End stream on backend FIRST (critical for viewer notifications)
      console.log('📡 Calling backend to end stream...');
      await liveSalesAPI.endStream(stream.id);
      console.log('✅ Backend stream end confirmed');

      // Step 3: Clean up local resources after backend success
      await cleanupStream();
      console.log('✅ Local cleanup completed');

      // Step 4: Replace navigation stack to prevent going back to dead stream
      navigation.replace('LiveSales');

    } catch (error: any) {
      console.error('❌ Error ending stream:', error);

      // Even if backend fails, we still need to clean up locally
      console.log('🧹 Performing local cleanup despite backend error...');
      try {
        await cleanupStream();
      } catch (cleanupError) {
        console.error('❌ Cleanup also failed:', cleanupError);
      }

      // Show error but still navigate away since local cleanup is done
      Alert.alert(
        'Stream End Warning',
        `Stream may not have ended properly on server: ${error.message}. Local cleanup completed.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.replace('LiveSales')
          }
        ]
      );
    }
  };


  const renderCommentItem = ({ item }: { item: LiveComment }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentUser}>{item.user.username}</Text>
      <Text style={styles.commentText}>: {item.message}</Text>
    </View>
  );

  if (loading) {
    console.log('⏳ Still loading...');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Setting up stream...</Text>
      </View>
    );
  }

  if (!agoraConfig) {
    console.log('❌ No agoraConfig - should not happen');
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
            uid: 0, // ✅ Local video ALWAYS uses UID 0 in Agora
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
          <ActivityIndicator size="large" color="#FF0050" />
          <Text style={styles.cameraPlaceholderText}>
            {loading ? 'Initializing stream...' : 'Starting camera...'}
          </Text>
          <Text style={styles.cameraPlaceholderSubText}>
            Setting up your live broadcast.{'\n'}This may take a moment.
          </Text>
        </View>
      )}

      {/* Top Controls - TikTok Style */}
      <View style={[styles.topControls, { paddingTop: insets.top + 10 }]}>
        {/* Close Button - Top Left */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleEndStream}
        >
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>

        {/* Live Indicator & Viewer Count - Top Right */}
        <View style={styles.topRightContainer}>
          {isLive && (
            <View style={[styles.liveIndicator, isPaused && styles.pausedIndicator]}>
              <View style={[styles.liveDot, isPaused && styles.pausedDot]} />
              <Text style={[styles.liveText, isPaused && styles.pausedText]}>
                {isPaused ? "PAUSED" : "LIVE"}
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.controlIconButton}
            onPress={handleToggleVideo}
          >
            <Ionicons 
              name={isVideoMuted ? "videocam-off" : "videocam"}
              size={20}
              color={isVideoMuted ? "#E74C3C" : "white"}
            />
          </TouchableOpacity>

          <View style={styles.viewerCount}>
            <Ionicons name="eye" size={16} color="white" />
            <Text style={styles.viewerText}>{viewerCount}</Text>
          </View>
        </View>
      </View>

      {/* Reactions Overlay */}
      {reactions.length > 0 && (
        <View style={styles.reactionsOverlay} pointerEvents="none">
          {reactions.map((reaction, index) => {
            const randomOffset = Math.random() * (screenWidth - 100);
            const emoji = reaction.reaction_type === 'heart' ? '❤️' : 
                         reaction.reaction_type === 'fire' ? '🔥' : '👍';
            return (
              <View
                key={`${reaction.timestamp}-${index}`}
                style={[
                  styles.reactionBubble,
                  { left: randomOffset, top: screenHeight * 0.3 + (index * 60) },
                ]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Gift Animations - Render above video */}
      {activeGiftAnimations.length > 0 && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, pointerEvents: 'none' }}>
          {activeGiftAnimations.map((animation) => (
            <GiftAnimation
              key={animation.id}
              emoji={animation.emoji}
              quantity={animation.quantity}
              onComplete={() => {
                setActiveGiftAnimations(prev => prev.filter(anim => anim.id !== animation.id));
              }}
            />
          ))}
        </View>
      )}

      {/* Stream Title Overlay */}
      <View style={styles.streamTitleOverlay}>
        <Text style={styles.streamTitle}>{stream.title}</Text>
      </View>

      {/* Dynamic Highlight Card - Always visible but transparent when not highlighted */}
      <View style={[
        styles.highlightCard,
        highlightedItem ? styles.highlightCardVisible : styles.highlightCardTransparent
      ]}>
        {highlightedItem && (
          <>
            <Image
              source={{
                uri: 'product' in highlightedItem
                  ? (highlightedItem as LiveStreamProduct).product.primary_image_url || 'https://via.placeholder.com/80'
                  : 'images' in highlightedItem
                  ? (highlightedItem as LivePortfolioService).images.find(img => img.is_primary)?.image_url || (highlightedItem as LivePortfolioService).images[0]?.image_url || 'https://via.placeholder.com/80'
                  : 'https://via.placeholder.com/80'
              }}
              style={styles.highlightCardImage}
            />
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
              style={styles.highlightCardCloseButton}
              onPress={handleDismissHighlight}
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Product/Service Showcase Overlay */}
      {showcasedItem && (
        <View style={styles.showcaseOverlay}>
          <View style={styles.showcaseCard}>
            {/* Image or Icon for Product/Service/Portfolio */}
            {'product' in showcasedItem ? (
              <Image
                source={{ 
                  uri: (showcasedItem as LiveStreamProduct).product.primary_image_url || 'https://via.placeholder.com/200x200?text=Product' 
                }}
                style={styles.showcaseImage}
              />
            ) : 'images' in showcasedItem ? (
              <Image
                source={{ 
                  uri: (showcasedItem as LivePortfolioService).images.find(img => img.is_primary)?.image_url || (showcasedItem as LivePortfolioService).images[0]?.image_url || 'https://via.placeholder.com/200x200'
                }}
                style={styles.showcaseImage}
              />
            ) : (
              <View style={[styles.showcaseImage, styles.showcaseServiceIcon]}>
                <Ionicons name="briefcase" size={60} color="#3498DB" />
              </View>
            )}
            
            <View style={styles.showcaseInfo}>
              <Text style={styles.showcaseTitle}>
                {'product' in showcasedItem 
                  ? (showcasedItem as LiveStreamProduct).product.name 
                  : 'title' in showcasedItem 
                    ? (showcasedItem as LivePortfolioService).title
                    : (showcasedItem as LiveStreamService).service?.name}
              </Text>
            <Text style={styles.showcasePrice}>
              ₣{'price' in showcasedItem ? (showcasedItem as LivePortfolioService).price : showcasedItem.live_price}
            </Text>
            {/* Remove Add to Cart button - only viewers should see this */}
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

      {/* Showcase Controls */}
      {showShowcaseControls && (
        <View style={styles.showcaseControls}>
          <View style={styles.showcaseControlsHeader}>
            <Text style={styles.controlsTitle}>Showcase Items</Text>
            {/* Conditionally show "List More Product" for product streams or "Add Portfolio" for service streams */}
            {stream.stream_type === 'products' ? (
              <TouchableOpacity
                style={styles.uploadPortfolioButton}
                onPress={() => {
                  setShowProductPickerModal(true);
                  loadVendorProducts();
                }}
              >
                <Ionicons name="add-circle" size={20} color="#3498DB" />
                <Text style={styles.uploadPortfolioText}>List More Product</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.uploadPortfolioButton}
                onPress={() => setShowPortfolioUploadModal(true)}
              >
                <Ionicons name="camera" size={20} color="#3498DB" />
                <Text style={styles.uploadPortfolioText}>Add Portfolio</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {/* Products */}
            {stream.products?.map((product: LiveStreamProduct) => (
              <View key={product.id} style={styles.controlItemWrapper}>
                <View
                  style={styles.controlItem}
                >
                  <Image
                    source={{ uri: product.product.primary_image_url || 'https://via.placeholder.com/60' }}
                    style={styles.controlItemImage}
                  />
                  <Text style={styles.controlItemText} numberOfLines={1}>
                    {product.product.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.highlightButton}
                  onPress={() => handleHighlightItem(product)}
                >
                  <Ionicons name="star" size={16} color="#FFD700" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Services */}
            {stream.services?.map((service: LiveStreamService) => (
              <View key={service.id} style={styles.controlItemWrapper}>
                <View
                  style={styles.controlItem}
                >
                  <View style={styles.serviceIcon}>
                    <Ionicons name="briefcase" size={24} color="#3498DB" />
                  </View>
                  <Text style={styles.controlItemText} numberOfLines={1}>
                    {service.service.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.highlightButton}
                  onPress={() => handleHighlightItem(service)}
                >
                  <Ionicons name="star" size={16} color="#FFD700" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Portfolio Services */}
            {portfolioServices.map((portfolio: LivePortfolioService) => (
              <View key={portfolio.id} style={styles.controlItemWrapper}>
                <View
                  style={styles.controlItem}
                >
                  <Image
                    source={{ uri: portfolio.images.find(img => img.is_primary)?.image_url || portfolio.images[0]?.image_url || 'https://via.placeholder.com/60' }}
                    style={styles.controlItemImage}
                  />
                  <View style={styles.portfolioBadge}>
                    <Ionicons name="star" size={10} color="#FFD700" />
                  </View>
                  <Text style={styles.controlItemText} numberOfLines={1}>
                    {portfolio.title}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.highlightButton}
                  onPress={() => handleHighlightItem(portfolio)}
                >
                  <Ionicons name="star" size={16} color="#FFD700" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeControlsButton}
            onPress={() => setShowShowcaseControls(false)}
          >
            <Text style={styles.closeControlsText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Comments Chat - Right Side */}
      {comments.length > 0 && (
        <View style={[styles.commentsChat, { bottom: 155 + insets.bottom }]}>
          <FlatList
            ref={commentsListRef}
            data={comments}
            renderItem={renderCommentItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            showsVerticalScrollIndicator={false}
            style={styles.commentsList}
            inverted={false}
          />
        </View>
      )}

      {/* Bottom Controls - TikTok Style */}
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

        <View style={styles.bottomButtonsContainer}>
          {/* Mute/Unmute Microphone Button */}
          <TouchableOpacity 
            style={styles.controlIconButton}
            onPress={handleToggleMicrophone}
          >
            <Ionicons 
              name={isAudioMuted ? "mic-off" : "mic"} 
              size={24} 
              color={isAudioMuted ? "#E74C3C" : "white"} 
            />
          </TouchableOpacity>

          {/* Camera Flip Button */}
          <TouchableOpacity 
            style={styles.controlIconButton}
            onPress={handleFlipCamera}
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>

          {/* Pause/Resume Stream Button */}
          <TouchableOpacity 
            style={styles.controlIconButton}
            onPress={handlePauseResumeStream}
          >
            <Ionicons 
              name={isPaused ? "play-circle" : "pause-circle"} 
              size={24} 
              color={isPaused ? "#FFA500" : "white"} 
            />
          </TouchableOpacity>

          {/* Analytics Button */}
          <TouchableOpacity
            style={styles.controlIconButton}
            onPress={async () => {
              setShowAnalytics(true);
              // Load portfolio analytics when opening
              if (portfolioServices.length > 0) {
                setLoadingPortfolioAnalytics(true);
                try {
                  const analytics = await liveSalesAPI.getPortfolioAnalytics(stream.id);
                  setPortfolioAnalytics(analytics);
                } catch (error) {
                  console.error('Error loading portfolio analytics:', error);
                } finally {
                  setLoadingPortfolioAnalytics(false);
                }
              }
            }}
          >
            <Ionicons name="stats-chart" size={24} color="white" />
          </TouchableOpacity>

          {/* Showcase Button */}
          <TouchableOpacity
            style={styles.controlIconButton}
            onPress={() => setShowShowcaseControls(!showShowcaseControls)}
          >
            <Ionicons name="bag-handle" size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlIconButton}
            onPress={openOrdersModal}
          >
            <Ionicons name="receipt" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showOrders}
        transparent={true}
        animationType="slide"
        onRequestClose={closeOrdersModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: 20 + (insets.bottom || 0) }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {selectedOrderId ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedOrderId(null);
                      setSelectedOrderDetails(null);
                      setOrderPin('');
                      setOrderPinError(null);
                    }}
                  >
                    <Ionicons name="chevron-back" size={24} color="white" />
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.modalTitle}>Orders</Text>
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeOrdersModal}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.analyticsContent}>
              {ordersLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3498DB" />
                  <Text style={styles.loadingText}>Loading orders...</Text>
                </View>
              ) : ordersError ? (
                <View style={styles.noComments}>
                  <Ionicons name="alert-circle" size={60} color="#E74C3C" />
                  <Text style={styles.noCommentsText}>{ordersError}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={loadActiveOrders}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : selectedOrderId ? (
                orderDetailsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3498DB" />
                    <Text style={styles.loadingText}>Loading order...</Text>
                  </View>
                ) : (
                  <ScrollView>
                    <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                        #{selectedOrderDetails?.orderNumber || selectedOrderDetails?.order_number || selectedOrderId}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>
                        {selectedOrderDetails?.customer?.name || selectedOrderDetails?.customerName || 'Customer'}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>
                        {formatDeliveryAddress(selectedOrderDetails?.deliveryDetails?.address || selectedOrderDetails?.deliveryAddress)}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 6, fontWeight: '600' }}>
                        ₣{selectedOrderDetails?.total ?? selectedOrderDetails?.total_amount ?? 0}
                      </Text>

                      {(() => {
                        const order = workspaceOrders.find(o => o.id === selectedOrderId) || null;
                        const quickAction = getQuickActionForOrder(order);
                        if (!quickAction) return null;

                        if (quickAction.type === 'pending') {
                          return (
                            <View style={{ marginTop: 16, flexDirection: 'row', gap: 10 }}>
                              <TouchableOpacity
                                style={[styles.uploadButton, { flex: 1, opacity: orderActionLoading ? 0.6 : 1 }]}
                                onPress={() => runOrderAction(order, 'accept')}
                                disabled={orderActionLoading}
                              >
                                {orderActionLoading ? <ActivityIndicator color="white" /> : <Text style={styles.uploadButtonText}>Accept</Text>}
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.uploadButton, { flex: 1, backgroundColor: '#E74C3C', opacity: orderActionLoading ? 0.6 : 1 }]}
                                onPress={() => {
                                  Alert.alert(
                                    'Reject Order',
                                    'Are you sure you want to reject this order? The buyer will be refunded from escrow.',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      { text: 'Reject', style: 'destructive', onPress: () => runOrderAction(order, 'decline') },
                                    ],
                                  );
                                }}
                                disabled={orderActionLoading}
                              >
                                {orderActionLoading ? <ActivityIndicator color="white" /> : <Text style={styles.uploadButtonText}>Reject</Text>}
                              </TouchableOpacity>
                            </View>
                          );
                        }

                        return (
                          <View style={{ marginTop: 16 }}>
                            {quickAction.requiresPin ? (
                              <View>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>PIN</Text>
                                <TextInput
                                  value={orderPin}
                                  onChangeText={(t) => {
                                    setOrderPin(t);
                                    setOrderPinError(null);
                                  }}
                                  placeholder="Enter PIN"
                                  placeholderTextColor="rgba(255,255,255,0.5)"
                                  style={[styles.input, { marginBottom: 8 }]}
                                  keyboardType="number-pad"
                                />
                                {orderPinError ? (
                                  <Text style={{ color: '#E74C3C', marginBottom: 8 }}>{orderPinError}</Text>
                                ) : null}
                              </View>
                            ) : null}

                            <TouchableOpacity
                              style={[styles.uploadButton, { opacity: orderActionLoading ? 0.6 : 1 }]}
                              onPress={() => runOrderAction(order, quickAction.action)}
                              disabled={orderActionLoading}
                            >
                              {orderActionLoading ? (
                                <ActivityIndicator color="white" />
                              ) : (
                                <Text style={styles.uploadButtonText}>{quickAction.label}</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  </ScrollView>
                )
              ) : (
                <FlatList
                  data={workspaceOrders}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}
                      onPress={() => openOrderDetails(item.id)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: 'white', fontWeight: '700' }}>#{item.orderNumber}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{item.status.replace('_', ' ')}</Text>
                      </View>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 6 }} numberOfLines={1}>
                        {item.customerName}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4 }} numberOfLines={1}>
                        {formatDeliveryAddress(item.deliveryAddress)}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 6, fontWeight: '600' }}>
                        ₣{item.total}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.noComments}>
                      <Ionicons name="receipt" size={60} color="#666" />
                      <Text style={styles.noCommentsText}>No active orders</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Analytics Modal */}
      <Modal
        visible={showAnalytics}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAnalytics(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: 20 + (insets.bottom || 0) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Live Analytics</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowAnalytics(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

          <View style={styles.analyticsContent}>
            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsCard}>
                <Ionicons name="eye" size={24} color="#FF0050" />
                <Text style={styles.analyticsValue}>{viewerCount}</Text>
                <Text style={styles.analyticsTitle}>Current Viewers</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Ionicons name="people" size={24} color="#00F2EA" />
                <Text style={styles.analyticsValue}>{analytics.totalViewers}</Text>
                <Text style={styles.analyticsTitle}>Total Viewers</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Ionicons name="chatbubble" size={24} color="#FFFC00" />
                <Text style={styles.analyticsValue}>{analytics.comments}</Text>
                <Text style={styles.analyticsTitle}>Comments</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Ionicons name="heart" size={24} color="#FF0050" />
                <Text style={styles.analyticsValue}>{analytics.reactions}</Text>
                <Text style={styles.analyticsTitle}>Reactions</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Ionicons name="gift" size={24} color="#FFD700" />
                <Text style={styles.analyticsValue}>{analytics.gifts}</Text>
                <Text style={styles.analyticsTitle}>Gifts</Text>
              </View>
              <View style={styles.analyticsCard}>
                <Ionicons name="flash" size={24} color="#FF0050" />
                <Text style={styles.analyticsValue}>₣{analytics.revenue}</Text>
                <Text style={styles.analyticsTitle}>Revenue</Text>
              </View>
            </View>

            {/* Portfolio Analytics Section */}
            {portfolioAnalytics.length > 0 && (
              <View style={styles.portfolioAnalyticsSection}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="star" size={20} color="#FFD700" /> Portfolio Performance
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {portfolioAnalytics.map((item) => (
                    <View key={item.portfolio_id} style={styles.portfolioAnalyticsCard}>
                      <Text style={styles.portfolioAnalyticsTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.portfolioAnalyticsRow}>
                        <View style={styles.portfolioAnalyticsMetric}>
                          <Ionicons name="eye-outline" size={16} color="#999" />
                          <Text style={styles.portfolioAnalyticsValue}>{item.impressions}</Text>
                          <Text style={styles.portfolioAnalyticsLabel}>Views</Text>
                        </View>
                        <View style={styles.portfolioAnalyticsMetric}>
                          <Ionicons name="cart-outline" size={16} color="#999" />
                          <Text style={styles.portfolioAnalyticsValue}>{item.add_to_cart_clicks}</Text>
                          <Text style={styles.portfolioAnalyticsLabel}>Adds</Text>
                        </View>
                      </View>
                      <View style={styles.portfolioAnalyticsRow}>
                        <View style={styles.portfolioAnalyticsMetric}>
                          <Ionicons name="calendar-outline" size={16} color="#999" />
                          <Text style={styles.portfolioAnalyticsValue}>{item.bookings}</Text>
                          <Text style={styles.portfolioAnalyticsLabel}>Bookings</Text>
                        </View>
                        <View style={styles.portfolioAnalyticsMetric}>
                          <Ionicons name="cash-outline" size={16} color="#27AE60" />
                          <Text style={[styles.portfolioAnalyticsValue, styles.revenueText]}>
                            ₣{item.revenue}
                          </Text>
                          <Text style={styles.portfolioAnalyticsLabel}>Revenue</Text>
                        </View>
                      </View>
                      <View style={styles.conversionRate}>
                        <Text style={styles.conversionRateText}>
                          {(item.conversion_rate * 100).toFixed(1)}% Conversion
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
          </View>
        </View>
      </Modal>

      {/* Portfolio Upload Modal */}
      <Modal
        visible={showPortfolioUploadModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPortfolioUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContainer, { paddingBottom: 20 + (insets.bottom || 0) }]}
          >
            <ScrollView style={styles.modalScrollContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Portfolio Item</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowPortfolioUploadModal(false)}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>

            {/* Multi-Image Gallery */}
            <Text style={styles.inputLabel}>Images * (Up to 5)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesGallery}>
              {portfolioImages.map((img, index) => (
                <View key={index} style={styles.imageGalleryItem}>
                  <Image source={{ uri: img.uri }} style={styles.galleryImage} />
                  {img.is_primary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                    </View>
                  )}
                  <View style={styles.imageActions}>
                    <TouchableOpacity
                      style={styles.imageActionButton}
                      onPress={() => handleSetPrimaryImage(index)}
                    >
                      <Ionicons name="star" size={16} color={img.is_primary ? "#FFD700" : "#999"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.imageActionButton}
                      onPress={() => handleRemovePortfolioImage(index)}
                    >
                      <Ionicons name="trash" size={16} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.imageCaptionInput}
                    placeholder="Add caption..."
                    placeholderTextColor="#666"
                    value={img.caption}
                    onChangeText={(text: string) => handleUpdateImageCaption(index, text)}
                  />
                </View>
              ))}
              {portfolioImages.length < 5 && (
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handleAddPortfolioImage}
                >
                  <Ionicons name="add-circle" size={40} color="#3498DB" />
                  <Text style={styles.addImageText}>Add Image</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Title Input */}
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Modern Kitchen Renovation"
              placeholderTextColor="#666"
              value={portfolioUploadData.title}
              onChangeText={(text) => setPortfolioUploadData(prev => ({ ...prev, title: text }))}
            />

            {/* Description Input */}
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your service offering..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={portfolioUploadData.description}
              onChangeText={(text: string) => setPortfolioUploadData(prev => ({ ...prev, description: text }))}
            />

            {/* Price Input */}
            <Text style={styles.inputLabel}>Price (₣) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={portfolioUploadData.price}
              onChangeText={(text: string) => setPortfolioUploadData(prev => ({ ...prev, price: text }))}
            />

            {/* Category Selector */}
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryContainer}>
              {(['work_sample', 'consultation', 'service_package', 'testimonial'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    portfolioUploadData.category === cat && styles.categoryButtonActive
                  ]}
                  onPress={() => setPortfolioUploadData(prev => ({ ...prev, category: cat }))}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    portfolioUploadData.category === cat && styles.categoryButtonTextActive
                  ]}>
                    {cat.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Upload Button */}
            <TouchableOpacity
              style={[styles.uploadButton, uploadingPortfolio && styles.uploadButtonDisabled]}
              onPress={handleUploadPortfolio}
              disabled={uploadingPortfolio}
            >
              {uploadingPortfolio ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="white" />
                  <Text style={styles.uploadButtonText}>Upload & Showcase</Text>
                </>
              )}
            </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>

      {/* Product Picker Modal */}
      <Modal
        visible={showProductPickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowProductPickerModal(false);
          setEditingProduct(null);
          setEditLivePrice('');
          setEditLiveStock('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: 20 + (insets.bottom || 0) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Configure Product' : 'Select Product'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowProductPickerModal(false);
                  setEditingProduct(null);
                  setEditLivePrice('');
                  setEditLiveStock('');
                }}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

          {editingProduct ? (
            // Product Configuration View
            <ScrollView style={styles.analyticsContent}>
              <View style={styles.productConfigContainer}>
                <Image
                  source={{ uri: editingProduct.primary_image_url || 'https://via.placeholder.com/200' }}
                  style={styles.productConfigImage}
                />
                <Text style={styles.productConfigName}>{editingProduct.name}</Text>
                <Text style={styles.productConfigPrice}>Original Price: ₣{editingProduct.price}</Text>
                <Text style={styles.productConfigStock}>Available Stock: {editingProduct.quantity}</Text>

                <Text style={styles.inputLabel}>Live Price (₣) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter live price"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  value={editLivePrice}
                  onChangeText={setEditLivePrice}
                />

                <Text style={styles.inputLabel}>Live Stock *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter stock quantity"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  value={editLiveStock}
                  onChangeText={setEditLiveStock}
                />

                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleSaveProductConfig}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.uploadButtonText}>Add to Stream</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadButton, { backgroundColor: '#666', marginTop: 12 }]}
                  onPress={() => {
                    setEditingProduct(null);
                    setEditLivePrice('');
                    setEditLiveStock('');
                  }}
                >
                  <Text style={styles.uploadButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            // Product List View
            <View style={styles.analyticsContent}>
              {loadingProducts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3498DB" />
                  <Text style={styles.loadingText}>Loading products...</Text>
                </View>
              ) : availableProducts.length === 0 ? (
                <View style={styles.noComments}>
                  <Ionicons name="cube-outline" size={60} color="#666" />
                  <Text style={styles.noCommentsText}>No products available</Text>
                </View>
              ) : (
                <FlatList
                  data={availableProducts}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isAlreadyAdded = stream.products?.some((p: any) => p.product_id === item.id);
                    return (
                      <TouchableOpacity
                        style={[styles.productPickerItem, isAlreadyAdded && styles.productPickerItemDisabled]}
                        onPress={() => !isAlreadyAdded && handleSelectProduct(item)}
                        disabled={isAlreadyAdded}
                      >
                        <Image
                          source={{ uri: item.primary_image_url || 'https://via.placeholder.com/80' }}
                          style={styles.productPickerImage}
                        />
                        <View style={styles.productPickerInfo}>
                          <Text style={styles.productPickerName} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={styles.productPickerPrice}>₣{item.price}</Text>
                          {isAlreadyAdded && (
                            <Text style={styles.alreadyAddedText}>Already in stream</Text>
                          )}
                        </View>
                        {!isAlreadyAdded && (
                          <Ionicons name="add-circle" size={24} color="#3498DB" />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          )}
          </View>
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
    padding: 30,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 15,
  },
  errorText: {
    color: '#FF0050',
    fontSize: 18,
    marginTop: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#FF0050',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  cameraPlaceholderText: {
    color: '#666',
    fontSize: 18,
    marginTop: 20,
  },
  cameraPlaceholderSubText: {
    color: '#444',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Top Controls - TikTok Style
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  topRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 80, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pausedIndicator: {
    backgroundColor: 'rgba(255, 252, 0, 0.9)',
  },
  pausedDot: {
    backgroundColor: '#FFFC00',
  },
  pausedText: {
    color: '#FFFC00',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 6,
  },
  viewerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Stream Title Overlay
  streamTitleOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    zIndex: 25,
  },
  streamTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Comments Chat - Right Side
  commentsChat: {
    position: 'absolute',
    right: 20,
    top: '62%',
    bottom: 200,
    width: 200,
    zIndex: 15,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  commentUser: {
    color: '#00F2EA',
    fontSize: 14,
    fontWeight: '600',
  },
  commentText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
  },
  // Bottom Controls - TikTok Style
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 15,
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
  goLiveButton: {
    backgroundColor: '#FF0050',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    alignSelf: 'center',
  },
  goLiveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlIconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endStreamButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF0050',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal styles
  analyticsModalContainer: {
    minHeight: '50%',
    maxHeight: '100%',
    backgroundColor: '#000',
  },
  analyticsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  analyticsModalTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  analyticsContent: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  analyticsCard: {
    width: screenWidth / 2 - 30,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  analyticsValue: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  analyticsTitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  modalCommentsSection: {
    flex: 1,
  },
  modalCommentsList: {
    maxHeight: 300,
  },
  noComments: {
    alignItems: 'center',
    padding: 40,
  },
  noCommentsText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },

  // Portfolio Analytics Styles
  portfolioAnalyticsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  portfolioAnalyticsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 280,
  },
  portfolioAnalyticsTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  portfolioAnalyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  portfolioAnalyticsMetric: {
    flex: 1,
    alignItems: 'center',
  },
  portfolioAnalyticsValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  revenueText: {
    color: '#27AE60',
  },
  portfolioAnalyticsLabel: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  conversionRate: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  conversionRateText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
  showcaseControls: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 16,
    padding: 16,
    zIndex: 20,
  },
  showcaseControlsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadPortfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  uploadPortfolioText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  portfolioBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderRadius: 8,
    padding: 2,
  },
  controlsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  controlItem: {
    alignItems: 'center',
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    minWidth: 80,
  },
  controlItemActive: {
    backgroundColor: '#FF0050',
  },
  controlItemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginBottom: 4,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  controlItemText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  closeControlsButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3498DB',
    borderRadius: 20,
    alignSelf: 'center',
  },
  closeControlsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '100%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollContent: {
    padding: 20,
  },
  // Portfolio Upload Modal Styles
  portfolioModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  portfolioModalContent: {
    flex: 1,
    padding: 20,
  },
  portfolioModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  portfolioModalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  portfolioModalClose: {
    padding: 8,
  },
  imagesGallery: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  imageGalleryItem: {
    width: 200,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  galleryImage: {
    width: '100%',
    height: 150,
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  imageActionButton: {
    padding: 4,
  },
  imageCaptionInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'white',
    padding: 8,
    fontSize: 12,
  },
  addImageButton: {
    width: 200,
    height: 150,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3498DB',
    borderStyle: 'dashed',
  },
  addImageText: {
    color: '#3498DB',
    fontSize: 12,
    marginTop: 8,
  },
  inputLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: '#666',
  },
  categoryButtonActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  categoryButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  uploadButtonDisabled: {
    backgroundColor: '#666',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Product Picker Styles
  productPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  productPickerItemDisabled: {
    opacity: 0.5,
  },
  productPickerImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productPickerInfo: {
    flex: 1,
  },
  productPickerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPickerPrice: {
    color: '#00F2EA',
    fontSize: 14,
    fontWeight: '600',
  },
  alreadyAddedText: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  productConfigContainer: {
    padding: 20,
  },
  productConfigImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  productConfigName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  productConfigPrice: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  productConfigStock: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
  },
  // Reactions overlay
  reactionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 5,
  },
  reactionBubble: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 8,
  },
  reactionEmoji: {
    fontSize: 32,
  },
  // Highlight Card Styles
  highlightCard: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
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
  highlightCardCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  controlItemWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  highlightButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    zIndex: 10,
  },
});

export default LiveStreamBroadcastScreen;
