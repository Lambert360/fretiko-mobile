import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Linking,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatAPI, ChatMessage } from '../services/chatAPI';
import { realtimeAPI } from '../services/realtimeAPI';
import { userAPI, UserProfile } from '../services/userAPI';
import { geminiAPI } from '../services/geminiAPI';
import { ikoAPI } from '../services/ikoAPI';
import { realTimeAudioService } from '../services/realTimeAudioService';
import { invoiceAPI, Invoice, InvoiceStatus } from '../services/invoiceAPI';
import { wishlistAPI } from '../services/wishlistAPI';
// Agora imports for video calling
import { agoraCallService, AgoraCallConfig } from '../services/agoraCallService';
import { RtcSurfaceView, RenderModeType } from 'react-native-agora';
// Gift imports
import { giftAPI, VirtualGift } from '../services/giftAPI';
import GiftAnimation from '../components/GiftAnimation';
import { walletAPI } from '../services/walletAPI';
import * as ImagePicker from 'expo-image-picker';
import InvoiceMessageCard from '../components/InvoiceMessageCard';
import ProductMessageCard from '../components/ProductMessageCard';
import ServiceMessageCard from '../components/ServiceMessageCard';
import ScheduleMessageCard from '../components/ScheduleMessageCard';
import ScheduleModal, { ScheduleActivityData } from '../components/ScheduleModal';
import { WishlistShareModal } from '../components/WishlistShareModal';
import WishlistMessageCard from '../components/WishlistMessageCard';
import DocumentMessageCard from '../components/DocumentMessageCard';

// Global WebSocket manager to persist across component remounts
class GeminiWebSocketManager {
  private ws: WebSocket | null = null;
  private callId: string | null = null;

  setWebSocket(websocket: WebSocket, callIdentifier: string) {
    this.ws = websocket;
    this.callId = callIdentifier;
    console.log('🔗 WebSocket stored in global manager for call:', callIdentifier);
  }

  getWebSocket(callIdentifier: string): WebSocket | null {
    if (this.callId === callIdentifier && this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('✅ Retrieved active WebSocket from global manager');
      return this.ws;
    }
    console.log('❌ No active WebSocket in global manager for call:', callIdentifier);
    return null;
  }

  clearWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
    this.callId = null;
    console.log('🧹 WebSocket cleared from global manager');
  }

  isConnected(callIdentifier: string): boolean {
    return this.callId === callIdentifier && this.ws?.readyState === WebSocket.OPEN;
  }
}

const geminiWsManager = new GeminiWebSocketManager();
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { AI_ASSISTANT_UUID, AI_ASSISTANT_NAME, AI_ASSISTANT_AVATAR } from '../constants/chat';
import { useAuth } from '../contexts/AuthContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Use ChatMessage interface from API with local extensions
interface Message extends Omit<ChatMessage, 'timestamp'> {
  timestamp: Date;
  text: string; // alias for content
  reactions?: {
    [emoji: string]: string[]; // emoji -> array of user IDs who reacted
  };
  auctionData?: {
    itemName: string;
    startingPrice: number;
    endTime: Date;
    imageUrl: string;
  };
  livestreamData?: {
    title: string;
    isLive: boolean;
    viewers: number;
    thumbnailUrl: string;
  };
  productData?: {
    id: string;
    name: string;
    price: number;
    image: string;
    vendor_username?: string;
  };
  wishlistData?: {
    shareId: string;
    shareType: 'view_only' | 'view_and_add';
    itemCount: number;
    ownerName: string;
    ownerId: string;
    recipientName: string;
    recipientId: string;
    previewItems: Array<{
      id: string;
      name: string;
      price: number;
      image: string;
    }>;
    canAddItems: boolean;
    sharedAt: Date;
    purchaseStatus?: {
      itemsPurchased: number;
      itemsProcessing: number;
      itemsCompleted: number;
      totalItems: number;
      overallStatus: 'none' | 'processing' | 'completed';
    };
  };
  // IKO recommendation data
  ikoRecommendations?: {
    products?: Array<{
      id: string;
      name: string;
      price: number;
      image: string;
      vendor_username?: string;
    }>;
    services?: Array<{
      id: string;
      title: string;
      price: number;
      image?: string;
      provider?: {
        id: string;
        name: string;
        rating?: number;
      };
      category?: string;
      duration?: string;
      priceType?: 'fixed' | 'hourly' | 'starting_at' | 'negotiable';
    }>;
  };
  // IKO schedule card data
  ikoScheduleCard?: {
    type: 'meal_plan' | 'reminder' | 'purchase' | 'event' | 'task';
    title: string;
    description?: string;
    suggestedDate?: string;
    icon?: string;
  };
  // Metadata is already included from ChatMessage interface
}

interface ChatParams {
  chatId: string;
  chatName: string;
  chatAvatar: any;
  chatType: 'friend' | 'vendor' | 'support' | 'ai' | 'rider';
  isOnline?: boolean;
  verified?: boolean;
  isAI?: boolean;
  otherUserId?: string;
  bargainMode?: boolean;
  productData?: {
    id: string;
    name: string;
    price: number;
    image: string;
    vendor_username?: string;
  };
}

const IndividualChatScreen = () => {
  console.log('🏗️ IndividualChatScreen component mounting/remounting');

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused(); // 🔥 Track screen focus to prevent unnecessary remounts
  const flatListRef = useRef<FlatList>(null);
  const { user, accessToken } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Get chat params from navigation
  const chatParams = route.params as ChatParams;
  const { chatId, chatName, chatAvatar, chatType, isOnline, verified, isAI, otherUserId: paramOtherUserId, bargainMode, productData } = chatParams;

  // Debug log to check if chatName is being passed correctly
  console.log('📋 IndividualChatScreen params:', { chatId, chatName, chatType, otherUserId: paramOtherUserId });

  const [messages, setMessages] = useState<Message[]>([]);
  // Use the otherUserId from params (should now be provided by backend)
  const [otherUserId, setOtherUserId] = useState<string | null>(paramOtherUserId || null);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showWishlistShareModal, setShowWishlistShareModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedScheduleData, setSelectedScheduleData] = useState<any>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentCallSessionId, setCurrentCallSessionId] = useState<string | null>(null);
  // Agora call states
  const [agoraCallEngine, setAgoraCallEngine] = useState<any | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [agoraConfig, setAgoraConfig] = useState<AgoraCallConfig | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true); // Remote participant's video status
  const [remoteMuted, setRemoteMuted] = useState(false); // Remote participant's mute status
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connecting' | 'ringing' | 'connected' | 'ending' | 'reconnecting'>('calling');
  const [incomingCall, setIncomingCall] = useState<{callSessionId: string, callerName: string, callType: 'audio' | 'video'} | null>(null);
  const incomingCallRef = useRef<{callSessionId: string, callerName: string, callType: 'audio' | 'video'} | null>(null); // 🔥 Persist across remounts
  const isAcceptingCallRef = useRef<boolean>(false); // Prevent duplicate accept calls
  const currentCallSessionIdRef = useRef<string | null>(null); // 🔥 Persist call session ID across remounts
  const isReinitializingRef = useRef<boolean>(false); // Track if we're reinitializing to prevent premature call end
  const isEndingCallRef = useRef<boolean>(false); // Prevent duplicate endCall calls
  const ringbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Use ref to avoid closure issues
  const [ringbackTimeout, setRingbackTimeout] = useState<ReturnType<typeof setTimeout> | null>(null); // Keep for cleanup on unmount
  const [soundInterval, setSoundInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Camera and video call states
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('front');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [showVideoUI, setShowVideoUI] = useState(false);
  const [isLocalVideoPrimary, setIsLocalVideoPrimary] = useState(false); // Track which video is full-screen
  const [showCallOverlay, setShowCallOverlay] = useState(true); // Control overlay visibility (auto-hide)
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Auto-hide timer

  // Gift states for calls
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [availableGifts, setAvailableGifts] = useState<Array<{id: string, emoji: string, name: string, quantity: number}>>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  // Gift animation states - array of active animations
  const [activeGiftAnimations, setActiveGiftAnimations] = useState<Array<{
    id: string;
    emoji: string;
    quantity: number;
  }>>([]);
  

  // AI voice call states
  const [isAICall, setIsAICall] = useState(false);
  const [geminiLiveWs, setGeminiLiveWs] = useState<WebSocket | null>(null);
  const [isConnectedToGemini, setIsConnectedToGemini] = useState(false);
  const [callSessionId] = useState(() => `ai-call-${Date.now()}`); // Unique identifier for this call session
  const [streamInterval, setStreamInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [reconnectionCount, setReconnectionCount] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // 🔥 FIX: Track if we've already subscribed to prevent duplicates
  const hasSubscribedRef = useRef(false);
  const cleanupFnRef = useRef<(() => void) | null>(null);
  // 🔥 ADD: Ref to track which chatId has active subscriptions
  const activeChatIdRef = useRef<string | null>(null);

  // 🔥 FIX: Track if chat has been initialized to prevent duplicate initialization on remounts
  const hasInitializedRef = useRef<string | false>(false);

  // Media viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  // Emoji states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<string | null>(null);

  // Video player hook
  const videoPlayer = useVideoPlayer(selectedVideoUrl || '', player => {
    if (selectedVideoUrl) {
      player.play();
    }
  });

  // Audio player for voice messages
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer('');
  // Store audio durations for messages (keyed by messageId)
  const [audioDurations, setAudioDurations] = useState<{ [messageId: string]: number }>({});

  // Audio recorder for voice messages (use the same one for AI calls too)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Configure audio mode on mount for iOS recording
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
        console.log('✅ Audio mode configured on mount');
      } catch (error) {
        console.error('❌ Error configuring audio mode:', error);
      }
    };

    configureAudio();
  }, []);

  // Check for existing WebSocket on component mount (in case of remount during call)
  useEffect(() => {
    console.log('🔍 Checking for existing Gemini WebSocket on component mount...');
    const existingWs = geminiWsManager.getWebSocket(callSessionId);
    if (existingWs) {
      console.log('✅ Found existing WebSocket, restoring AI call state');
      setGeminiLiveWs(existingWs);
      setIsAICall(true);
      setIsConnectedToGemini(true);
      setCallStatus('connected');
      setIsInCall(true);

      // Restart audio streaming if needed
      setTimeout(() => {
        startLiveAudioStreaming();
      }, 1000);
    }
  }, [callSessionId]);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);
  
  // Call UI animations
  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;
  const rippleAnim3 = useRef(new Animated.Value(0)).current;
  const statusFadeAnim = useRef(new Animated.Value(1)).current;
  
  // Incoming call ripple animations
  const incomingRipple1 = useRef(new Animated.Value(0)).current;
  const incomingRipple2 = useRef(new Animated.Value(0)).current;
  const incomingRipple3 = useRef(new Animated.Value(0)).current;
  
  // Incoming call ripple animation effect
  useEffect(() => {
    if (!incomingCall) {
      incomingRipple1.setValue(0);
      incomingRipple2.setValue(0);
      incomingRipple3.setValue(0);
      return;
    }

    const createRipple = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const r1 = createRipple(incomingRipple1, 0);
    const r2 = createRipple(incomingRipple2, 600);
    const r3 = createRipple(incomingRipple3, 1200);

    r1.start();
    r2.start();
    r3.start();

    return () => {
      r1.stop();
      r2.stop();
      r3.stop();
    };
  }, [incomingCall]);
  
  // Ripple animation effect
  useEffect(() => {
    if (callStatus === 'connected' && showCallModal) {
      // Start ripple animations
      const createRippleAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(animValue, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true,
              }),
              Animated.timing(statusFadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const ripple1 = createRippleAnimation(rippleAnim1, 0);
      const ripple2 = createRippleAnimation(rippleAnim2, 600);
      const ripple3 = createRippleAnimation(rippleAnim3, 1200);

      ripple1.start();
      ripple2.start();
      ripple3.start();

      return () => {
        ripple1.stop();
        ripple2.stop();
        ripple3.stop();
      };
    } else {
      rippleAnim1.setValue(0);
      rippleAnim2.setValue(0);
      rippleAnim3.setValue(0);
    }
  }, [callStatus, showCallModal]);
  
  // Status text animation
  useEffect(() => {
    Animated.sequence([
      Animated.timing(statusFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(statusFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [callStatus]);

  // Call duration timer effect
  useEffect(() => {
    if (isInCall && callStartTime) {
      callTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        setCallDuration(elapsed);
      }, 1000);

      return () => {
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
        }
      };
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }
  }, [isInCall, callStartTime]);

  // Helper function to format call duration
  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load user profile
  const loadUserProfile = async () => {
    try {
      const profile = await userAPI.getProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Load messages from API
  const loadMessages = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // For AI conversations, ensure conversation exists and load messages
      if (isAI || chatType === 'ai') {
        console.log('🤖 Loading AI conversation messages for chatId:', chatId);

        try {
          // First, try to load messages from existing conversation
          const result = await chatAPI.getMessages(chatId, 1, 50);
          console.log('📥 Loaded', result.messages.length, 'AI messages from backend');

          const backendMessages = result.messages.map(msg => ({
            id: msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            senderName: msg.senderName || (msg.senderId === AI_ASSISTANT_UUID ? AI_ASSISTANT_NAME : 'You'),
            content: msg.content,
            text: msg.content, // Alias for compatibility
            messageType: msg.messageType,
            status: msg.status,
            mediaUrl: msg.mediaUrl,
            fileData: msg.fileData,
            timestamp: new Date(msg.createdAt),
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
          }));

          setMessages(backendMessages);
          console.log('✅ AI messages loaded successfully:', backendMessages.length);

          // Extract otherUserId from messages if not provided
          if (!otherUserId && !isAI && backendMessages.length > 0) {
            const firstOtherMessage = backendMessages.find(msg => msg.senderId !== user?.id);
            if (firstOtherMessage) {
              setOtherUserId(firstOtherMessage.senderId);
              console.log('✅ Extracted otherUserId from messages:', firstOtherMessage.senderId);
            }
          }
        } catch (error) {
          console.log('💡 Conversation may not exist, creating AI conversation...');

          // If conversation doesn't exist, create it
          try {
            const newConversation = await chatAPI.findOrCreateConversation(
              [AI_ASSISTANT_UUID],
              'ai'
            );

            console.log('✅ AI conversation created:', newConversation.id);

            // Update chatId if it was created with a different ID
            if (newConversation.id !== chatId) {
              console.log('🔄 Updating chat ID from', chatId, 'to', newConversation.id);
              // Note: In a full implementation, you might want to update the navigation params
            }

            // Set empty messages for new conversation
            setMessages([]);
          } catch (createError) {
            console.error('❌ Failed to create AI conversation:', createError);
            setMessages([]);
          }
        }

        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { messages: apiMessages } = await chatAPI.getMessages(chatId);

      // Convert API messages to local Message format
      const convertedMessages: Message[] = apiMessages.map(msg => {
        const converted: Message = {
          ...msg,
          text: msg.content,
          timestamp: new Date(msg.createdAt),
          // 🔥 FIX: Explicitly preserve wishlistData from metadata
          wishlistData: (msg as any).metadata?.wishlistData || (msg as any).wishlistData,
          productData: (msg as any).metadata?.productData || (msg as any).productData,
          metadata: (msg as any).metadata,
        };
        
        // Extract and store audio duration from metadata
        if (msg.messageType === 'audio' && (msg as any).metadata?.audioDuration) {
          const duration = (msg as any).metadata.audioDuration;
          setAudioDurations(prev => ({ ...prev, [msg.id]: duration }));
        }
        
        // Debug log for wishlist messages
        if (msg.messageType === 'wishlist') {
          console.log('📋 Wishlist message loaded:', {
            id: msg.id,
            senderId: msg.senderId,
            hasWishlistData: !!converted.wishlistData,
            ownerId: converted.wishlistData?.ownerId,
            purchaseStatus: converted.wishlistData?.purchaseStatus,
            hasPurchaseStatus: !!converted.wishlistData?.purchaseStatus,
            purchaseStatusOverall: converted.wishlistData?.purchaseStatus?.overallStatus,
            metadata: (msg as any).metadata,
            'user?.id': user?.id,
            willShowOnRight: msg.senderId === user?.id || converted.wishlistData?.ownerId === user?.id
          });
          
          // 🔥 FIX: Ensure purchaseStatus is extracted from metadata if not directly in wishlistData
          if (converted.wishlistData && !converted.wishlistData.purchaseStatus && (msg as any).metadata?.wishlistData?.purchaseStatus) {
            converted.wishlistData.purchaseStatus = (msg as any).metadata.wishlistData.purchaseStatus;
            console.log('✅ Extracted purchaseStatus from metadata:', converted.wishlistData.purchaseStatus);
          }
        }
        
        return converted;
      });

      setMessages(convertedMessages);

      // Extract otherUserId from messages if not provided
      if (!otherUserId && convertedMessages.length > 0) {
        const firstOtherMessage = convertedMessages.find(msg => msg.senderId !== user?.id);
        if (firstOtherMessage) {
          setOtherUserId(firstOtherMessage.senderId);
          console.log('✅ Extracted otherUserId from messages:', firstOtherMessage.senderId);
        }
      }

      // Note: Conversation joining is now handled in useEffect initialization

      // Mark messages as read (skip for AI conversations)
      if (!isAI) {
        await chatAPI.markConversationAsRead(chatId);
      }

    } catch (error) {
      console.error('Error loading messages:', error);
      if (!isAI && chatType !== 'ai') {
        Alert.alert('Error', 'Failed to load messages. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initialize real-time connection (copied from working Konnect Screen)
  const initializeRealtimeConnection = async () => {
    try {
      const userId = user?.id || 'anonymous';
      console.log('🔌 Attempting real-time connection for user:', userId);

      // Add timeout to prevent hanging (Socket.IO has 15s timeout, so use 20s)
      const connectPromise = realtimeAPI.connect(userId, accessToken || undefined);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 20000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      console.log('✅ Real-time connection successful');

      return true;
    } catch (error) {
      console.warn('Failed to connect to real-time services:', error);
      // Continue without real-time features
      return false;
    }
  };

  // Initialize real-time message subscription
  const initializeRealtimeMessaging = () => {
    // 🔥 CRITICAL FIX: Prevent duplicate subscriptions for the same chatId
    if (hasSubscribedRef.current && activeChatIdRef.current === chatId) {
      console.log('🚫 Subscriptions already active for chatId:', chatId, '- skipping duplicate setup');
      return cleanupFnRef.current || (() => {});
    }

    // 🔥 FIX: Clean up existing subscriptions for a different chatId before creating new ones
    if (cleanupFnRef.current && activeChatIdRef.current !== chatId) {
      console.log('🧹 Cleaning up existing subscriptions for different chatId before creating new ones');
      cleanupFnRef.current();
      cleanupFnRef.current = null;
      hasSubscribedRef.current = false;
      activeChatIdRef.current = null;
    }

    // 🔥 FIX: Add connection state validation before subscribing
    if (!realtimeAPI.isChatConnected()) {
      console.warn('💬 Chat socket not connected, skipping message subscription setup');
      return () => {}; // Return empty cleanup function
    }

    console.log('🔥 Setting up real-time message subscriptions for conversation:', chatId);
    hasSubscribedRef.current = true;
    activeChatIdRef.current = chatId;

    const unsubscribeMessage = realtimeAPI.subscribe('chat_message', (data) => {
      console.log('📨 New message received in IndividualChatScreen:', data);
      console.log('🔍 Current conversation ID:', chatId, 'Message conversation ID:', data.conversationId);

      if (data.conversationId === chatId) {
        // 🔥 FIX: Ensure message has required structure
        if (!data.message || !data.message.content) {
          console.warn('⚠️ Received malformed message data:', data);
          return;
        }

        // Transform backend message (snake_case) to frontend format (camelCase)
        const newMessage: Message = {
          ...data.message,
          senderId: data.message.sender_id || data.message.senderId, // ✅ Fix: Convert snake_case to camelCase
          conversationId: data.message.conversation_id || data.message.conversationId,
          messageType: data.message.message_type || data.message.messageType,
          mediaUrl: data.message.media_url || data.message.mediaUrl,
          createdAt: data.message.created_at || data.message.createdAt,
          updatedAt: data.message.updated_at || data.message.updatedAt,
          text: data.message.content,
          timestamp: new Date(data.message.created_at || data.message.createdAt),
          wishlistData: data.message.metadata?.wishlistData || data.message.wishlistData, // ✅ Extract wishlist data
          productData: data.message.metadata?.productData || data.message.productData, // ✅ Extract product data
          metadata: data.message.metadata,
        };
        
        // Extract and store audio duration from metadata
        if (newMessage.messageType === 'audio' && newMessage.metadata?.audioDuration) {
          const duration = newMessage.metadata.audioDuration;
          setAudioDurations(prev => ({ ...prev, [newMessage.id]: duration }));
        }

        // 🔥 FIX: Ensure purchaseStatus is properly extracted for wishlist messages
        if (newMessage.messageType === 'wishlist' && newMessage.wishlistData && !newMessage.wishlistData.purchaseStatus) {
          const metadataWishlistData = data.message.metadata?.wishlistData;
          if (metadataWishlistData?.purchaseStatus) {
            newMessage.wishlistData.purchaseStatus = metadataWishlistData.purchaseStatus;
            console.log('✅ Extracted purchaseStatus from WebSocket message metadata:', newMessage.wishlistData.purchaseStatus);
          }
        }

        console.log('✅ Adding new message to UI:', newMessage);

        // 🔥 FIX: Add message deduplication to prevent duplicates
        setMessages(prev => {
          const existingMessage = prev.find(msg => msg.id === newMessage.id);
          if (existingMessage) {
            console.log('⚠️ Duplicate message detected, skipping:', newMessage.id);
            return prev;
          }
          console.log('📩 Adding unique message to state:', newMessage.id);
          return [...prev, newMessage];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        // Haptic feedback for new message
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    });

    const unsubscribeMessageUpdate = realtimeAPI.subscribe('message_update', (data) => {
      console.log('🔄 Message update received in IndividualChatScreen:', data);
      console.log('🔍 Current conversation ID:', chatId, 'Message conversation ID:', data.conversationId);

      if (data.conversationId === chatId) {
        const updatedMessage = data.message;

        // Update the message in the messages array
        setMessages(prev => prev.map(msg => {
          if (msg.id === updatedMessage.id) {
            console.log('✅ Updating message:', updatedMessage.id);
            return {
              id: updatedMessage.id,
              conversationId: updatedMessage.conversation_id || updatedMessage.conversationId || chatId,
              senderId: updatedMessage.sender_id || updatedMessage.senderId,
              senderName: updatedMessage.senderName || msg.senderName,
              content: updatedMessage.content || msg.content,
              text: updatedMessage.content || msg.text,
              messageType: updatedMessage.message_type || updatedMessage.messageType || msg.messageType,
              status: 'sent',
              mediaUrl: updatedMessage.media_url || updatedMessage.mediaUrl,
              timestamp: new Date(updatedMessage.created_at || updatedMessage.createdAt || msg.timestamp),
              createdAt: updatedMessage.created_at || updatedMessage.createdAt || msg.createdAt,
              updatedAt: updatedMessage.updated_at || updatedMessage.updatedAt || new Date().toISOString(),
              fileData: msg.fileData, // Keep existing fileData
            };
          }
          return msg;
        }));

        console.log('✅ Message updated in UI');
      }
    });

    const unsubscribeReactionUpdate = realtimeAPI.subscribe('reaction_update', (data) => {
      console.log('🎭 Reaction update received in IndividualChatScreen:', data);
      console.log('🔍 Current conversation ID:', chatId, 'Update conversation ID:', data.conversationId);

      if (data.conversationId === chatId) {
        // Update reactions for the specific message
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            console.log('✅ Updating reactions for message:', data.messageId);
            return { ...msg, reactions: data.reactions };
          }
          return msg;
        }));

        console.log('✅ Reactions updated in UI');
      }
    });

    // 🔥 NEW: Subscribe to wishlist gift order events to update wishlist cards in chat
    const unsubscribeWishlistGiftOrder = realtimeAPI.subscribe('wishlist_item_gift_ordered', (data: any) => {
      console.log('🎁 Wishlist gift order received in chat:', data);
      
      // Update wishlist messages in this chat when items are purchased
      setMessages(prev => prev.map(msg => {
        if (msg.messageType === 'wishlist' && 
            msg.wishlistData?.ownerId === data.wishlistOwnerId &&
            msg.wishlistData?.shareId) {
          // Update purchase status in the wishlist data
          const currentStatus = msg.wishlistData.purchaseStatus || {
            itemsPurchased: 0,
            itemsProcessing: 0,
            itemsCompleted: 0,
            totalItems: msg.wishlistData.itemCount || 0,
            overallStatus: 'none' as const,
          };
          
          // Check order status to determine how to update counts
          const orderStatus = data.orderStatus || data.giftOrderStatus?.status || 'pending';
          let newStatus = { ...currentStatus };
          
          // New gift order created - increment appropriate counts based on initial status
          if (orderStatus === 'completed' || orderStatus === 'delivered') {
            // Order already completed (unlikely but handle it)
            newStatus = {
              ...currentStatus,
              itemsPurchased: Math.min(currentStatus.itemsPurchased + 1, currentStatus.totalItems),
              itemsCompleted: Math.min(currentStatus.itemsCompleted + 1, currentStatus.totalItems),
              overallStatus: currentStatus.itemsCompleted + 1 >= currentStatus.totalItems ? 'completed' as const : 'processing' as const,
            };
          } else {
            // New order in pending/processing state
            newStatus = {
              ...currentStatus,
              itemsPurchased: Math.min(currentStatus.itemsPurchased + 1, currentStatus.totalItems),
              itemsProcessing: Math.min(currentStatus.itemsProcessing + 1, currentStatus.totalItems),
              overallStatus: 'processing' as const,
            };
          }
          
          return {
            ...msg,
            wishlistData: {
              ...msg.wishlistData,
              purchaseStatus: newStatus,
            },
          };
        }
        return msg;
      }));
    });

    // 🔥 NEW: Subscribe to gift order status updates
    const unsubscribeGiftOrderStatus = realtimeAPI.subscribe('gift_order_status_update', (data: any) => {
      console.log('📦 Gift order status update received in chat:', data);
      
      // Update wishlist messages when order status changes
      setMessages(prev => prev.map(msg => {
        if (msg.messageType === 'wishlist' && 
            msg.wishlistData?.ownerId === data.wishlistOwnerId &&
            msg.wishlistData?.shareId) {
          const currentStatus = msg.wishlistData.purchaseStatus || {
            itemsPurchased: 0,
            itemsProcessing: 0,
            itemsCompleted: 0,
            totalItems: msg.wishlistData.itemCount || 0,
            overallStatus: 'none' as const,
          };
          
          // Update status based on order status change
          let newStatus = { ...currentStatus };
          
          if (data.orderStatus === 'completed' || data.orderStatus === 'delivered') {
            // Move from processing to completed
            newStatus = {
              ...currentStatus,
              itemsProcessing: Math.max(0, currentStatus.itemsProcessing - 1),
              itemsCompleted: currentStatus.itemsCompleted + 1,
              overallStatus: currentStatus.itemsCompleted + 1 >= currentStatus.totalItems ? 'completed' as const : 'processing' as const,
            };
          } else if (data.orderStatus && data.orderStatus !== 'cancelled') {
            // Status is processing
            newStatus = {
              ...currentStatus,
              overallStatus: 'processing' as const,
            };
          }
          
          return {
            ...msg,
            wishlistData: {
              ...msg.wishlistData,
              purchaseStatus: newStatus,
            },
          };
        }
        return msg;
      }));
    });

    const unsubscribeTyping = realtimeAPI.subscribe('chat_typing', (data) => {
      console.log('⌨️ Typing indicator received:', data);
      if (data.conversationId === chatId && data.userId !== user?.id) {
        setIsTyping(data.isTyping);
      }
    });

    const unsubscribeStatus = realtimeAPI.subscribe('user_status', (data) => {
      console.log('👤 User status update:', data);
      // Handle user status updates if needed
    });

    const unsubscribeCallEvent = realtimeAPI.subscribe('call_event', (data) => {
      console.log('📞 Call event received:', data);

      // Only handle events for this conversation
      if (data.conversationId !== chatId) {
        console.log('🚫 Call event for different conversation, ignoring');
        return;
      }

      const { eventType, callData } = data;

      switch (eventType) {
        case 'incoming_call':
          console.log('📞 Incoming call from:', callData.initiator?.username || 'Unknown');

          // Don't show incoming call UI if the current user is the initiator
          if (callData.initiator?.id === user?.id) {
            console.log('🚫 Ignoring incoming_call event - current user is the caller');
            return;
          }

          // Don't show incoming call if already in a call or already have incoming call
          if (isInCall || incomingCall || incomingCallRef.current) {
            console.log('🚫 Ignoring incoming_call - already in call or have pending call');
            return;
          }

          // Show incoming call UI
          // Use chatName as fallback since we're in a chat screen and know the other user
          const callerName = callData.initiator?.full_name || 
                            callData.initiator?.username || 
                            chatName || 
                            'Unknown Caller';
          const callInfo = {
            callSessionId: callData.callSessionId,
            callerName: callerName,
            callType: callData.callType,
          };
          setIncomingCall(callInfo);
          incomingCallRef.current = callInfo; // 🔥 Persist in ref
          // Play ringtone
          playCallSound('ringing');
          break;

        case 'call_ended':
          console.log('📞 Call ended by remote participant (from call_event)');
          // Hide incoming call UI if showing
          setIncomingCall(null);
          incomingCallRef.current = null;
          stopCallSounds();
          // End active call - pass fromRemote=true to prevent sending duplicate signal
          endCall('completed', true);
          break;

        case 'participant_joined':
          console.log('📞 Participant joined the call');
          // Update call status if we're the one calling
          if (isInCall && callStatus === 'calling') {
            setCallStatus('connected');
            setCallStartTime(Date.now());
            stopCallSounds();
            
            // Clear call timeout - participant has joined
            if (ringbackTimeoutRef.current) {
              console.log('🛑 Clearing call timeout - participant joined');
              clearTimeout(ringbackTimeoutRef.current);
              ringbackTimeoutRef.current = null;
              setRingbackTimeout(null);
            }
            
            playCallSound('connected');
          }
          break;

        case 'participant_left':
          console.log('📞 Participant left the call');
          break;

        case 'gift_sent':
          console.log('🎁 Gift received during call:', data);
          // Show gift notification
          if (data.giftId && data.quantity) {
            Alert.alert(
              '🎁 Gift Received!',
              `You received ${data.quantity}x gift during the call!`,
              [{ text: 'OK' }]
            );
          }
          break;

        default:
          console.log('📞 Unknown call event type:', eventType);
      }
    });

    // Subscribe to call signals (WebRTC-style peer signals)
    const unsubscribeCallSignal = realtimeAPI.subscribe('call_signal', (data) => {
      console.log('📞 Call signal received:', data);
      handleIncomingCallSignal(data);
    });

    // Subscribe to invoice events
    const unsubscribeInvoiceCreated = realtimeAPI.subscribe('invoice_created', (data) => {
      if (data.conversationId === chatId) {
        console.log('📄 Invoice created, reloading messages');
        loadMessages();
      }
    });

    const unsubscribeInvoiceUpdated = realtimeAPI.subscribe('invoice_updated', (data) => {
      if (data.conversationId === chatId) {
        console.log('📄 Invoice updated:', data.invoice);
        setMessages(prev => prev.map(msg => {
          if (msg.messageType === 'invoice' && msg.invoiceData?.id === data.invoice.id) {
            return { ...msg, invoiceData: data.invoice };
          }
          return msg;
        }));
      }
    });

    const unsubscribeInvoicePaid = realtimeAPI.subscribe('invoice_paid', async (data) => {
      if (data.conversationId === chatId) {
        console.log('📄 Invoice paid:', data.invoiceId);
        
        // Update invoice status in messages immediately for better UX
        setMessages(prev => prev.map(msg => {
          if (msg.messageType === 'invoice' && msg.invoiceData?.id === data.invoiceId) {
            // Update invoice status to paid
            return {
              ...msg,
              invoiceData: {
                ...msg.invoiceData,
                status: InvoiceStatus.PAID,
                paidAt: new Date().toISOString(),
              },
            };
          }
          return msg;
        }));
        
        // Also reload messages to ensure everything is in sync
        loadMessages();
      }
    });

    const unsubscribeInvoiceExpired = realtimeAPI.subscribe('invoice_expired', (data) => {
      if (data.conversationId === chatId) {
        console.log('📄 Invoice expired:', data.invoiceId);
        loadMessages();
      }
    });

    const unsubscribeInvoiceCancelled = realtimeAPI.subscribe('invoice_cancelled', (data) => {
      if (data.conversationId === chatId) {
        console.log('📄 Invoice cancelled:', data.invoiceId);
        loadMessages();
      }
    });

    // === Agora Call Handlers (WebRTC signaling not needed - Agora handles connection automatically) ===
    // Note: Agora handles all media connection automatically via its SD-RTN network
    // We only need to handle call control signals (call_ended, mute_toggle, etc.) which are handled in handleIncomingCallSignal
    const unsubscribeWebRTC = () => {
      // No-op: Agora doesn't need WebRTC signaling subscription
      console.log('📞 Agora call: No WebRTC signaling subscription needed');
    };

    const cleanup = () => {
      console.log('🧹 Cleaning up real-time message subscriptions');
      unsubscribeMessage();
      unsubscribeMessageUpdate();
      unsubscribeReactionUpdate();
      unsubscribeTyping();
      unsubscribeStatus();
      unsubscribeCallEvent();
      unsubscribeCallSignal();
      unsubscribeInvoiceCreated();
      unsubscribeInvoiceUpdated();
      unsubscribeInvoicePaid();
      unsubscribeInvoiceExpired();
      unsubscribeInvoiceCancelled();
      unsubscribeWishlistGiftOrder(); // 🔥 NEW: Cleanup wishlist subscriptions
      unsubscribeGiftOrderStatus(); // 🔥 NEW: Cleanup gift order status subscriptions
      unsubscribeWebRTC(); // Cleanup (no-op for Agora)
      hasSubscribedRef.current = false; // 🔥 Reset subscription state
      activeChatIdRef.current = null; // 🔥 Reset active chatId
    };

    cleanupFnRef.current = cleanup;
    return cleanup;
  };

  useEffect(() => {
    console.log('🔄 IndividualChatScreen useEffect triggered, chatId:', chatId, 'isFocused:', isFocused);
    console.log('🔍 Current AI call states when effect runs:', {
      isAICall,
      isConnectedToGemini,
      callStatus,
      geminiLiveWsState: geminiLiveWs?.readyState
    });

    // 🔥 FIX: Only initialize when screen is focused to prevent unnecessary remounts
    if (!isFocused) {
      console.log('🚫 Screen not focused, skipping initialization');
      return;
    }

    // 🔥 FIX: Prevent duplicate initialization on remounts
    if (hasInitializedRef.current === chatId) {
      console.log('🚫 Already initialized for chatId:', chatId, '- skipping duplicate initialization');
      return;
    }

    // Don't reinitialize during an active AI call
    if (isAICall && isConnectedToGemini) {
      console.log('🚫 Skipping chat reinitialization - AI call in progress');
      return;
    }

    // Don't initialize if no user/token (similar to Konnect Screen)
    if (!user || !accessToken) {
      console.log('⚠️ No user or token, skipping initialization');
      console.log('🔍 DEBUG: user exists:', !!user, 'accessToken exists:', !!accessToken);
      setLoading(false);
      return;
    }

    console.log('✅ All checks passed, proceeding with initialization');

    // Initialize chat (following Konnect Screen pattern)
    const init = async () => {
      console.log('🚀 Initializing IndividualChatScreen...');

      // 🔥 CRITICAL FIX: Clean up existing subscriptions BEFORE creating new ones
      if (cleanupFnRef.current) {
        console.log('🧹 Cleaning up existing subscriptions before re-initializing');
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
      // Reset subscription state
      hasSubscribedRef.current = false;
      activeChatIdRef.current = null;

      // Set auth token for chat API (like Konnect Screen)
      chatAPI.setAuthToken(accessToken);
      console.log('🔑 Auth token set for chatAPI');

      // Load user profile to get latest isSeller/isRider values
      loadUserProfile();

      // Load messages first (don't wait for real-time)
      console.log('📱 Loading messages...');
      await loadMessages();

      // Setup real-time connection (non-blocking - run in background)
      let cleanup;
      console.log('🔍 DEBUG: About to call initializeRealtimeConnection...');
      initializeRealtimeConnection()
        .then((connected) => {
          if (connected) {
            console.log('🔗 Real-time connection initialized successfully');
            // Join conversation for real-time updates
            realtimeAPI.joinConversation(chatId);
            console.log('📨 Joined conversation:', chatId);
          }
          cleanup = initializeRealtimeMessaging();
        })
        .catch((error) => {
          console.warn('⚠️ Real-time connection failed, continuing without it:', error);
          // Still setup message listeners for when connection is available
          cleanup = initializeRealtimeMessaging();
        });

      // 🔥 Mark as initialized for this chatId
      hasInitializedRef.current = chatId;
      console.log('✅ IndividualChatScreen initialized for chatId:', chatId);

      return cleanup;
    };

    const cleanup = init();

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Cleanup on unmount
    return () => {
      cleanup.then((cleanupFn: (() => void) | undefined) => {
        if (cleanupFn) cleanupFn();
      });
      realtimeAPI.leaveConversation(chatId);
      // 🔥 Reset subscription state on unmount
      hasSubscribedRef.current = false;
      cleanupFnRef.current = null;
      activeChatIdRef.current = null;
      
      // 🔥 Only reset initialization ref if this was the initialized chatId
      if (hasInitializedRef.current === chatId) {
        hasInitializedRef.current = false;
        console.log('🧹 Reset initialization state for chatId:', chatId);
      }
      
      // Don't disconnect entirely as other screens might be using it
      // realtimeAPI.disconnect();
    };
  }, [user, accessToken, chatId, isFocused]); // 🔥 Include isFocused in dependencies

  // Auto scroll to bottom after loading messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Cleanup effect for haptic sounds and call state
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up call sounds and state on unmount');

      // Clear intervals directly in cleanup without calling stopCallSounds
      if (soundIntervalRef.current) {
        console.log('🧹 Force clearing sound interval on unmount');
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    };
  }, []);

  // Handle bargain mode initialization
  const hasInitializedBargain = useRef(false);
  useEffect(() => {
    if (bargainMode && productData && !hasInitializedBargain.current) {
      console.log('💰 Bargain mode activated with product:', productData);

      // Pre-fill message with bargain text (only once)
      setMessageText('Hey! 👋 Can we negotiate on this?');
      hasInitializedBargain.current = true;

      // Note: Product card will be sent as attachment when user sends the message
    }
  }, [bargainMode, productData]);

  const getChatTypeColor = (type: string) => {
    switch (type) {
      case 'ai': return '#E91E63';
      case 'vendor': return '#FF9800';
      case 'support': return '#3498DB';
      case 'rider': return '#9C27B0';
      default: return '#27AE60';
    }
  };

  const getChatTypeIcon = (type: string) => {
    switch (type) {
      case 'ai': return 'sparkles';
      case 'vendor': return 'storefront';
      case 'support': return 'headset';
      case 'rider': return 'bicycle';
      default: return 'person';
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();

    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;

    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };


  // ✅ FIX: Generate unique temp message ID to prevent collisions (industry standard)
  const generateTempMessageId = (): string => {
    // Use crypto.randomUUID() if available (React Native 0.70+ or modern browsers)
    // This is the industry standard for generating unique IDs
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `temp-${crypto.randomUUID()}`;
    }
    // Fallback to timestamp + random string for older environments
    // This ensures uniqueness even if multiple messages sent in same millisecond
    return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  };

  const sendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    const tempMessageId = generateTempMessageId();
    const messageContent = messageText.trim();
    
    // Create optimistic message
    const newMessage: Message = {
      id: tempMessageId,
      text: messageContent,
      timestamp: new Date(),
      senderId: user?.id || 'unknown',
      senderName: 'You',
      messageType: 'text',
      status: 'sending',
      conversationId: chatId,
      content: messageContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);
    setMessageText('');

    try {
      if (isAI || chatType === 'ai') {
        // Handle AI conversation - direct Gemini API, backend watches via WebSocket

        // 1. Update user message status (frontend only)
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessageId ? {
              ...msg,
              status: 'sent',
            } : msg
          )
        );

        // 2. Get AI response from Gemini directly (no backend dependency)
        // sendTextMessage() handles session persistence internally - no need to initialize here
        const response = await geminiAPI.sendTextMessage(messageContent, user?.id || 'unknown');

        // Check for error first, then use text or errorMessage
        let aiResponseText: string;
        if (response.error && response.errorMessage) {
          aiResponseText = response.errorMessage;
          console.error(`IKO Error [${response.error}]:`, response.errorMessage);
        } else {
          aiResponseText = response.text || 'I understand.';
        }

        // 3. Create AI response message (frontend only)
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: aiResponseText,
          timestamp: new Date(),
          senderId: AI_ASSISTANT_UUID,
          senderName: AI_ASSISTANT_NAME,
          messageType: 'text',
          status: 'delivered',
          conversationId: chatId,
          content: aiResponseText,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Include IKO recommendations if available (skip if error)
          ikoRecommendations: (!response.error && (response.recommendedProducts || response.recommendedServices)) ? {
            products: response.recommendedProducts,
            services: response.recommendedServices,
          } : undefined,
          // Include IKO schedule card if available (skip if error)
          ikoScheduleCard: !response.error ? response.scheduleCard : undefined,
        };

        setMessages(prev => [...prev, aiMessage]);

        // 4. Save both messages to backend for persistence (fire and forget)
        // Skip saving if there was an error
        if (!response.error) {
        try {
          console.log('💾 Saving AI messages to backend for chatId:', chatId);
          // Save user message
          const savedUserMsg = await chatAPI.sendAIMessage(chatId, messageContent, false);
          console.log('✅ User message saved:', savedUserMsg.id);
          // Save AI response
            const savedAIMsg = await chatAPI.sendAIMessage(chatId, aiResponseText, true);
          console.log('✅ AI response saved:', savedAIMsg.id);
          console.log('✅ AI conversation saved to backend');
        } catch (saveError) {
          console.error('⚠️ Failed to save AI conversation to backend:', saveError);
          // Don't throw - conversation continues working without backend save
          }
        } else {
          console.log('⚠️ Skipping backend save for error response');
        }

        // Handle function calls if any (this is where backend interaction happens)
        // Skip function calls when there's an error
        if (!response.error && response.functionCalls && response.functionCalls.length > 0) {
          console.log('Function calls received:', response.functionCalls);
          // Function calls will be handled by the Gemini service and may call backend APIs
        }

      } else {
        // Handle regular chat through backend API
        // Include product data if available (bargain mode)
        const hasProductData = productData && Object.keys(productData).length > 0;
        const messagePayload: any = {
          conversationId: chatId,
          messageType: 'text', // Use text type, product data goes in metadata
          content: messageContent,
        };

        // Add product data if available (will be stored in metadata)
        if (hasProductData) {
          messagePayload.productData = productData;
          console.log('📦 Sending message with product data:', productData);
        }

        const sentMessage = await chatAPI.sendMessage(messagePayload);

        // Clear bargain mode after sending message with product data
        if (hasProductData) {
          (navigation as any).setParams({ bargainMode: false, productData: undefined });
          console.log('✅ Bargain mode cleared after sending product message');
        }

        // Update message with sent status and real ID
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessageId
              ? {
                  ...msg,
                  id: sentMessage.id,
                  status: 'sent',
                  createdAt: sentMessage.createdAt,
                  updatedAt: sentMessage.updatedAt,
                  productData: hasProductData ? productData : undefined,
                }
              : msg
          )
        );

        // 🔥 REMOVED: Dual message sending - backend now handles WebSocket broadcast
        // Real-time message notification is now handled automatically by backend after HTTP API call
        console.log('📡 Real-time broadcast will be handled by backend for conversation:', chatId);

        // Send typing indicator off
        if (realtimeAPI.isConnected()) {
          realtimeAPI.sendChatTyping(chatId, false);
        }
      }

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (error) {
      console.error('Error sending message:', error);

      // Update message with failed status
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId ? { ...msg, status: 'failed' as any } : msg
        )
      );

      if (isAI || chatType === 'ai') {
        Alert.alert('Error', 'Failed to send message to Iko. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  // Handle AI response via API
  const handleAIResponse = async (userMessage: string) => {
    try {
      const response = await chatAPI.sendAIRequest(userMessage, chatId);
      
      // AI response will come via WebSocket real-time update
      // No need to manually add message here
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Fallback to local AI response if API fails
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(userMessage),
        timestamp: new Date(),
        senderId: chatId,
        senderName: chatName,
        messageType: 'text',
        status: 'delivered',
        conversationId: chatId,
        content: generateAIResponse(userMessage),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const generateAIResponse = (userMessage: string): string => {
    const responses = [
      "That's a great question! Let me help you find exactly what you're looking for 🔍",
      "I've got some amazing recommendations for you! Want to see the trending options? ✨",
      "Based on your preferences, I think you'll love these picks! 💎",
      "Let me connect you with our best vendors for that! They have excellent reviews 🌟",
      "I can show you the most popular items in that category right now! 🔥",
      "Perfect choice! I'll help you compare prices and find the best deals 💰",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  // Content Sharing Functions
  const handleVideoShare = () => {
    console.log('📹 Video share tapped');
    setShowAttachmentModal(false);

    // Small delay to ensure modal closes before Alert shows
    setTimeout(() => {
      Alert.alert(
        'Share Video',
        'Choose video source',
        [
          { text: 'Camera', onPress: () => recordVideo() },
          { text: 'Gallery', onPress: () => selectVideoFromGallery() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }, 100);
  };

  const handlePhotoShare = () => {
    console.log('📸 Photo share tapped');
    setShowAttachmentModal(false);

    // Small delay to ensure modal closes before Alert shows
    setTimeout(() => {
      Alert.alert(
        'Share Photo',
        'Choose photo source',
        [
          { text: 'Camera', onPress: () => takePhoto() },
          { text: 'Gallery', onPress: () => selectImage() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }, 100);
  };

  const handleDocumentShare = () => {
    console.log('📄 Document share tapped');
    setShowAttachmentModal(false);

    // Small delay before opening document picker
    setTimeout(() => {
      selectDocument();
    }, 100);
  };

  const handleCreateInvoice = () => {
    console.log('📄 Create Invoice tapped');
    setShowAttachmentModal(false);

    // Check if user is seller or rider
    if (!userProfile?.isSeller && !userProfile?.isRider) {
      Alert.alert('Access Denied', 'Only vendors and riders can create invoices');
      return;
    }

    console.log('✅ Navigating to CreateInvoiceScreen with conversationId:', chatId);

    // Navigate to CreateInvoiceScreen
    // Backend will automatically determine the buyer from conversation participants
    setTimeout(() => {
      (navigation as any).navigate('CreateInvoice', {
        conversationId: chatId,
        buyerName: chatName || 'Customer',
      });
    }, 100);
  };

  const handleShareWishlist = async () => {
    console.log('💖 Share Wishlist tapped');
    setShowAttachmentModal(false);

    // Don't allow sharing wishlist with AI
    if (isAI) {
      Alert.alert('Not Available', 'You cannot share your wishlist with Iko');
      return;
    }

    // Open the wishlist share modal
    setShowWishlistShareModal(true);
  };

  const handleWishlistShareSuccess = async (
    shareType: 'view_only' | 'view_and_add',
    itemCount: number,
    chatMessageData?: any
  ) => {
    // Show success message
    const permission = shareType === 'view_and_add' ? 'view and add items to' : 'view';
    Alert.alert(
      'Wishlist Shared!',
      `${itemCount} item${itemCount > 1 ? 's' : ''} shared with ${chatName}. They can ${permission} your wishlist.`,
      [{ text: 'OK' }]
    );

    // 🎁 Handle like image messages: Add optimistic message immediately
    if (chatMessageData && chatMessageData.wishlistData) {
      console.log('✅ Adding wishlist message optimistically (like image messages)');

      // Create optimistic message (like image sharing does)
      // 🔥 FIX: Use current user's ID as senderId (you are the sender)
      // 🔥 NEW: Ensure purchaseStatus is included from backend response
      const wishlistMessage: Message = {
        id: chatMessageData.messageId,
        conversationId: chatMessageData.conversationId,
        senderId: user?.id || chatMessageData.wishlistData.ownerId, // ✅ Use current user's ID (sender)
        senderName: userProfile?.username || 'You',
        content: chatMessageData.wishlistData.ownerName + ' shared wishlist',
        text: chatMessageData.wishlistData.ownerName + ' shared wishlist',
        messageType: 'wishlist',
        status: 'sent',
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        wishlistData: {
          ...chatMessageData.wishlistData,
          // 🔥 FIX: Ensure purchaseStatus is included if present
          purchaseStatus: chatMessageData.wishlistData.purchaseStatus || undefined,
        },
        metadata: { 
          wishlistData: {
            ...chatMessageData.wishlistData,
            purchaseStatus: chatMessageData.wishlistData.purchaseStatus || undefined,
          }
        },
      };

      console.log('🎁 Wishlist message created optimistically with purchaseStatus:', wishlistMessage.wishlistData?.purchaseStatus);

      console.log('🎁 Wishlist message created optimistically:', {
        messageId: wishlistMessage.id,
        senderId: wishlistMessage.senderId,
        'user?.id': user?.id,
        'will show on right?': wishlistMessage.senderId === user?.id
      });

      // Add to state immediately (optimistic update - like image sharing)
      setMessages(prev => [...prev, wishlistMessage]);

      // Scroll to bottom to show the new message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      console.log('✅ Wishlist message added to UI (sender sees it immediately)');
    }
  };

  // Handle wishlist card press - navigate to SharedWishlistScreen
  const handleWishlistCardPress = (
    shareId: string,
    ownerId: string,
    ownerName: string,
    shareType: 'view_only' | 'view_and_add'
  ) => {
    console.log('📱 Wishlist card tapped:', { shareId, ownerId, ownerName, shareType, currentUserId: user?.id });

    // Check if current user is the owner (sender) or recipient
    const isOwner = user?.id === ownerId;

    if (isOwner) {
      // You are the owner - you shared this
      // Navigate to your own wishlist or show message
      Alert.alert(
        'Your Wishlist',
        'This is your wishlist that you shared. You can view it from your profile.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View My Wishlist',
            onPress: () => {
              // Navigate to user's own wishlist screen
              (navigation as any).navigate('Wishlist');
            }
          }
        ]
      );
    } else {
      // You are the recipient - someone shared with you
      console.log('📱 Navigating to SharedWishlist as recipient');
      (navigation as any).navigate('SharedWishlist', {
        shareId,
        ownerId,
        ownerUsername: ownerName,
        shareType,
      });
    }
  };

  // Handle schedule card press
  const handleScheduleCardPress = (scheduleData: any) => {
    console.log('📅 Schedule card tapped:', scheduleData);
    setSelectedScheduleData(scheduleData);
    setShowScheduleModal(true);
  };

  // Handle schedule activity creation
  const handleScheduleActivity = async (activityData: ScheduleActivityData) => {
    try {
      console.log('📅 Creating scheduled activity:', activityData);
      
      // Call IKO API to create scheduled activity
      await ikoAPI.addOngoingPlan({
        type: activityData.type,
        title: activityData.title,
        description: activityData.description,
        scheduledFor: `${activityData.scheduledDate}T${activityData.scheduledTime || '09:00'}:00Z`,
      });

      // Show success message
      Alert.alert(
        'Activity Scheduled! ✅',
        `"${activityData.title}" has been added to your schedule. IKO will remind you ${activityData.reminderBefore} minutes before.`,
        [{ text: 'OK' }]
      );

      // Send confirmation message to IKO
      const confirmationMessage = `I've scheduled "${activityData.title}" for ${new Date(activityData.scheduledDate).toLocaleDateString()}. Thanks for helping me plan!`;
      setMessageText(confirmationMessage);
      // Auto-send the confirmation
      setTimeout(() => {
        if (confirmationMessage) {
          sendMessage();
        }
      }, 100);
    } catch (error) {
      console.error('Error scheduling activity:', error);
      Alert.alert(
        'Scheduling Failed',
        'Failed to schedule activity. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const startLiveStream = () => {
    const livestreamMessage: Message = {
      id: Date.now().toString(),
      conversationId: chatId,
      text: '',
      content: '',
      timestamp: new Date(),
      senderId: user?.id || 'current-user',
      senderName: 'You',
      messageType: 'livestream',
      status: 'sent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      livestreamData: {
        title: 'Live from my location 🔴',
        isLive: true,
        viewers: Math.floor(Math.random() * 50) + 1,
        thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop'
      }
    };
    
    setMessages(prev => [...prev, livestreamMessage]);
    setShowAttachmentModal(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const startAuction = () => {
    const auctionMessage: Message = {
      id: Date.now().toString(),
      conversationId: chatId,
      text: '',
      content: '',
      timestamp: new Date(),
      senderId: user?.id || 'current-user',
      senderName: 'You',
      messageType: 'auction',
      status: 'sent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auctionData: {
        itemName: 'Vintage Designer Watch',
        startingPrice: 250,
        endTime: new Date(Date.now() + 86400000), // 24 hours from now
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop'
      }
    };
    
    setMessages(prev => [...prev, auctionMessage]);
    setShowAttachmentModal(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Expo-Compatible Call Functions
  const initializeAgoraCall = async (agoraCallConfig: AgoraCallConfig, isVideoCall: boolean) => {
    try {
      console.log('📞 Initializing Agora call with Communication profile...');

      // Get App ID - prefer from backend, fallback to env variable
      const appId = agoraCallConfig.appId || process.env.EXPO_PUBLIC_AGORA_APP_ID;
      
      if (!appId) {
        throw new Error('Agora App ID not configured. Please set EXPO_PUBLIC_AGORA_APP_ID in .env or ensure backend provides it.');
      }

      // Normalize channel name (backend returns 'channel', frontend expects 'channelName')
      const normalizedConfig: AgoraCallConfig = {
        ...agoraCallConfig,
        appId,
        channelName: agoraCallConfig.channelName || agoraCallConfig.channel,
      };

      if (!normalizedConfig.channelName) {
        throw new Error('Channel name not provided by backend');
      }

      console.log('📞 Agora config:', {
        appId: normalizedConfig.appId ? 'present' : 'missing',
        channel: normalizedConfig.channelName,
        token: normalizedConfig.token ? 'present' : 'missing',
        uid: normalizedConfig.uid,
      });

      // Check if we need to reinitialize (engine already exists for different call)
      const currentChannel = agoraCallService.getCurrentChannelName();
      if (currentChannel && currentChannel !== normalizedConfig.channelName) {
        console.log('📞 Different channel detected, will reinitialize');
        isReinitializingRef.current = true;
      }

      // Initialize Agora call service with App ID and callbacks
      // Pass channelName so service can skip reinitialization if already in same channel
      await agoraCallService.initialize(normalizedConfig.appId, {
        onJoinChannelSuccess: (connection, elapsed) => {
          console.log('📞 Joined Agora call channel successfully - waiting for recipient to join');
          // Set status to 'ringing' - caller is connected but recipient hasn't joined yet
          setCallStatus('ringing');
          // For video calls, show video UI so caller can see their own preview
          if (callType === 'video') {
            setShowVideoUI(true);
            setShowCameraPreview(true);
          }
          // Don't start the timer yet - wait for recipient to join
          // Keep playing ringback sound until recipient joins
          // Don't clear ringback timeout yet - it will be cleared when recipient joins
        },
        onUserJoined: (connection, remoteUid, elapsed) => {
          console.log('📞 Remote user joined call:', remoteUid);
          setRemoteUid(remoteUid);
          // Reset remote video state when user joins (assume video is enabled initially)
          setRemoteVideoEnabled(true);
          setRemoteMuted(false);
          
          // 🔥 Restore call session ID from ref if state was lost (e.g., after remount)
          if (!currentCallSessionId && currentCallSessionIdRef.current) {
            console.log('🔄 Restoring call session ID from ref:', currentCallSessionIdRef.current);
            setCurrentCallSessionId(currentCallSessionIdRef.current);
          }
          
          // Now both users are in the call - set to connected and start timer
          setCallStatus('connected');
          setCallStartTime(Date.now());
          stopCallSounds();
          
          // Clear ringback timeout now that recipient has joined
          if (ringbackTimeoutRef.current) {
            console.log('🛑 Clearing call timeout - recipient has joined');
            clearTimeout(ringbackTimeoutRef.current);
            ringbackTimeoutRef.current = null;
            setRingbackTimeout(null);
          }
        },
        onUserOffline: (connection, remoteUid, reason) => {
          console.log('📞 Remote user left call:', remoteUid);
          setRemoteUid(null);
          // Don't end call immediately, wait for call_ended signal
        },
        onConnectionStateChanged: (state, reason) => {
          console.log('📞 Agora connection state changed:', { state, reason });
          
          // According to Agora React Native SDK documentation:
          // ConnectionStateType:
          // 1 = DISCONNECTED (1)
          // 2 = CONNECTING (2)
          // 3 = CONNECTED (3)
          // 4 = RECONNECTING (4)
          // 5 = FAILED (5)
          
          // ConnectionChangedReasonType:
          // 0 = CONNECTION_CHANGED_CONNECTING
          // 1 = CONNECTION_CHANGED_JOIN_SUCCESS
          // 2 = CONNECTION_CHANGED_INTERRUPTED (temporary network issue)
          // 5 = CONNECTION_CHANGED_LEAVE_CHANNEL (user left)
          // 16 = CONNECTION_CHANGED_LOST (connection lost)
          
          // Only end call on explicit user actions or permanent failures
          // Don't end on temporary network interruptions - SDK will reconnect
          if (state === 1) {
            // DISCONNECTED state
            if (reason === 5) {
              // LEAVE_CHANNEL - but check if we're reinitializing
              // If we just cleaned up for reinitialization, don't end the call
              const isReinitializing = isReinitializingRef.current || agoraCallService.isReinitializingEngine();
              if (isReinitializing) {
                console.log('📞 Left channel during reinitialization - ignoring');
                isReinitializingRef.current = false;
                return; // Don't end call
              }
              // User explicitly left the channel
              console.log('📞 User left channel, ending call');
              endCall('completed');
            } else if (reason === 16) {
              // Connection lost - wait a bit for reconnection
              console.log('📞 Connection lost, waiting for reconnection...');
              setCallStatus('reconnecting');
              // Don't end call immediately - give SDK time to reconnect
            } else {
              // Other disconnect reasons (temporary network issues)
              console.log('📞 Temporary disconnect, SDK will attempt to reconnect');
              setCallStatus('reconnecting');
            }
          } else if (state === 3) {
            // CONNECTED - connection to Agora server established
            // But don't set status to 'connected' yet - wait for recipient to join
            // Only update if we're still in 'connecting' state
            console.log('📞 Connection to Agora server established');
            if (callStatus === 'connecting') {
              setCallStatus('ringing');
            }
            // If already 'ringing', keep it as 'ringing' until recipient joins
          } else if (state === 4) {
            // RECONNECTING - don't end call, just update status
            console.log('📞 Reconnecting...');
            setCallStatus('reconnecting');
          } else if (state === 5) {
            // FAILED - connection failed permanently
            console.log('📞 Connection failed permanently, ending call');
            endCall('completed');
          }
          // State 2 (CONNECTING) - no action needed, just wait
        },
        onRemoteVideoStateChanged: (uid, state, reason, elapsed) => {
          console.log('📞 Remote video state changed:', { uid, state, reason, elapsed });
          // state: 0 = stopped, 1 = starting, 2 = decoding, 3 = failed
          // reason: 0 = mute/unmute by user, 1 = network issue, 2 = codec not supported
          // Only update state if it's a meaningful change to prevent flickering
          if (state === 0 && reason === 0) {
            // Video stopped by user (muted) - user turned off camera
            console.log('📹 Remote video stopped by user');
            setRemoteVideoEnabled(false);
          } else if (state === 3) {
            // Video failed - connection issue, but don't disable immediately
            // It might recover, so keep the state as is
            console.log('📹 Remote video failed, keeping current state for potential recovery');
          } else if (state === 1 || state === 2) {
            // Video starting or decoding - enable it
            console.log('📹 Remote video starting/decoding - enabling');
            setRemoteVideoEnabled(true);
          }
          // For state 0 with reason !== 0, it might be temporary - don't change state
        },
        onRemoteAudioStateChanged: (uid, state, reason, elapsed) => {
          console.log('📞 Remote audio state changed:', { uid, state, reason });
          // state: 0 = stopped, 2 = starting, 1 = decoded
          setRemoteMuted(state === 0);
        },
        onError: (err, msg) => {
          console.error('❌ Agora call error:', err, msg);
          if (err !== 110) { // Ignore error 110 (ERR_NO_BUFFER) as it's a timing issue
            Alert.alert('Call Error', `Error: ${msg || err}`);
          }
        }
      }, normalizedConfig.channelName);

      // For video calls, enable video and start preview BEFORE joining channel
      // This ensures the initiator's video starts immediately
      if (isVideoCall) {
        const engine = agoraCallService.getEngine();
        if (engine) {
          try {
            console.log('📹 Starting preview BEFORE joining channel (initiator)');
            // Enable video first
            await engine.enableVideo();
            console.log('✅ Video enabled before join');
            
            // Start preview BEFORE joining - this is critical for initiator
            await engine.startPreview();
            console.log('✅ Preview started before join - initiator will see themselves immediately');
            setShowCameraPreview(true);
            setShowVideoUI(true);
          } catch (previewError) {
            console.error('❌ Error starting preview before join:', previewError);
            // Continue anyway - preview might start after join
          }
        }
      }

      // Join the call channel with normalized config
      const result = await agoraCallService.joinChannel(normalizedConfig, isVideoCall);
      
      if (result === 0) {
        const engine = agoraCallService.getEngine();
        if (engine) {
          setAgoraCallEngine(engine);
          setAgoraConfig(normalizedConfig);
          console.log('✅ Agora call initialized and joined successfully');
          
          // For video calls, ensure preview is still running after join
          if (isVideoCall && engine) {
            try {
              // Double-check video is enabled (should already be)
              await engine.enableVideo();
              // Ensure preview is still running
              await engine.startPreview();
              console.log('✅ Camera preview confirmed after join');
              setShowCameraPreview(true);
              setShowVideoUI(true);
            } catch (previewError) {
              console.error('❌ Error confirming camera preview after join:', previewError);
              // Continue anyway - preview might already be running
            }
          }
        } else {
          console.warn('⚠️ Engine is null after join - this may indicate we skipped initialization');
          // If we skipped initialization, we still need to set the config
          setAgoraConfig(normalizedConfig);
        }
      } else {
        throw new Error(`Failed to join Agora channel with error code: ${result}`);
      }
    } catch (error) {
      console.error('❌ Error initializing Agora call:', error);
      throw error;
    }
  };

  // Simplified signaling - Agora handles media automatically, we only need call control signals
  const setupCallSignaling = async () => {
    try {
      console.log('📡 Setting up call signaling (simplified for Agora)...');

      if (realtimeAPI.isConnected() && currentCallSessionId) {
        // Subscribe to incoming call signals (for call control only, no WebRTC signaling needed)
        const unsubscribe = realtimeAPI.subscribe('call_signal', handleIncomingCallSignal);

        // Send call ready signal
        realtimeAPI.sendCallSignal(currentCallSessionId, 'call_ready', {
          userId: user?.id,
          callType,
          timestamp: new Date().toISOString(),
        }, chatId);

        console.log('✅ Call signaling setup complete');
        return unsubscribe;
      }
    } catch (error) {
      console.error('❌ Call signaling setup error:', error);
      throw error;
    }
  };

  const handleIncomingCallSignal = (data: any) => {
    try {
      console.log('📞 Incoming call signal:', data.signalType);

      switch (data.signalType) {
        case 'call_initiated':
          // Don't handle incoming call here - the 'incoming_call' event already does that
          console.log('📞 Call initiated signal received (for caller\'s reference)');
          break;

        case 'gift_animation':
          // Handle gift animation event - display floating emoji animation
          console.log('🎁 Gift animation signal received:', data.data);
          console.log('🎁 Current activeGiftAnimations count:', activeGiftAnimations.length);
          if (data.data && data.data.giftEmoji && data.data.quantity) {
            const animationId = `gift-${Date.now()}-${Math.random()}`;
            console.log('🎁 Adding gift animation:', { id: animationId, emoji: data.data.giftEmoji, quantity: data.data.quantity });
            setActiveGiftAnimations(prev => {
              const updated = [...prev, {
                id: animationId,
                emoji: data.data.giftEmoji,
                quantity: data.data.quantity || 1,
              }];
              console.log('🎁 Updated activeGiftAnimations count:', updated.length);
              return updated;
            });
            
            // Remove animation after it completes (component will call this)
            setTimeout(() => {
              setActiveGiftAnimations(prev => {
                const filtered = prev.filter(anim => anim.id !== animationId);
                console.log('🎁 Removed animation, remaining count:', filtered.length);
                return filtered;
              });
            }, 5000); // Clean up after 5 seconds (longer to ensure visibility)
          } else {
            console.warn('🎁 Gift animation signal missing required data:', data.data);
          }
          break;

        case 'gift_sent':
          // Handle gift_sent as fallback (if backend doesn't emit gift_animation)
          // This is mainly for backward compatibility, but we should rely on gift_animation
          console.log('🎁 Gift sent signal received (fallback):', data.data);
          // Don't handle here - let the backend's gift_animation handle it
          // This case is just to prevent "Unknown call signal" log
          break;

        case 'call_accepted':
          console.log('📞 Call accepted by remote participant');
          setTimeout(() => {
            stopCallSounds();

            // Clear call timeout - call was answered
            if (ringbackTimeoutRef.current) {
              console.log('🛑 Clearing call timeout - call was accepted');
              clearTimeout(ringbackTimeoutRef.current);
              ringbackTimeoutRef.current = null;
              setRingbackTimeout(null);
            }

            setCallStatus('connected');
            setIsInCall(true);
            setShowCallModal(false);
            setCallStartTime(Date.now());
            setCallDuration(0);

            // For video calls, transition to full video UI (remove mask)
            if (callType === 'video') {
              console.log('📹 Video call accepted - transitioning to full video UI');
              setShowVideoUI(true);
            }

            playCallSound('connected');
          }, 0);
          break;

        case 'call_declined':
          console.log('📞 Call declined by remote participant');
          setTimeout(() => {
            stopCallSounds();
            playCallSound('busy');
            endCall('declined');
          }, 0);
          break;

        case 'call_ready':
          console.log('✅ Remote participant is ready');
          setTimeout(() => {
            setCallStatus('connected');
          }, 0);
          break;

        case 'mute_toggle':
          console.log('🔇 Remote participant mute status:', data.data.isMuted);
          setRemoteMuted(data.data.isMuted);
          break;

        case 'video_toggle':
          console.log('📹 Remote participant video status:', data.data.isVideoEnabled);
          setRemoteVideoEnabled(data.data.isVideoEnabled);
          break;

        case 'call_ended':
          console.log('📞 Call ended by remote participant (from call_signal)');
          setTimeout(() => {
            const reason = data.data?.reason || 'completed';
            // Pass fromRemote=true to prevent sending duplicate signal
            endCall(reason, true);
          }, 0);
          break;

        default:
          console.log('❓ Unknown call signal:', data.signalType);
      }
    } catch (error) {
      console.error('❌ Error handling call signal:', error);
    }
  };

  const toggleMute = async () => {
    try {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      
      // Toggle audio in Agora
      if (agoraCallEngine || agoraCallService.isServiceInitialized()) {
        await agoraCallService.muteAudio(newMuteState);
      }
      
      // Send mute status via WebSocket
      if (currentCallSessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(currentCallSessionId, 'mute_toggle', {
          isMuted: newMuteState
        }, chatId);
      }

      // Update call settings via API
      if (currentCallSessionId) {
        await chatAPI.updateCallSettings(currentCallSessionId, {
          isMuted: newMuteState
        });
      }
      
      console.log(`🎤 Audio ${newMuteState ? 'muted' : 'unmuted'}`);
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      const newVideoState = !isVideoEnabled;
      setIsVideoEnabled(newVideoState);

      // Toggle video in Agora
      if (agoraCallEngine || agoraCallService.isServiceInitialized()) {
        await agoraCallService.muteVideo(!newVideoState); // muteVideo takes muted state
      }

      // Send video status via WebSocket
      if (currentCallSessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(currentCallSessionId, 'video_toggle', {
          isVideoEnabled: newVideoState
        }, chatId); // Pass conversationId to avoid backend lookup
      }

      // Update call settings via API
      if (currentCallSessionId) {
        await chatAPI.updateCallSettings(currentCallSessionId, {
          isVideoEnabled: newVideoState
        });
      }

      console.log(`📹 Video ${newVideoState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    try {
      if (agoraCallEngine || agoraCallService.isServiceInitialized()) {
        await agoraCallService.switchCamera();
        console.log('📷 Camera switched');
      }
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  const toggleSpeaker = async () => {
    try {
      setIsSpeakerOn(!isSpeakerOn);

      // Delegate speaker control to system
      // The system will handle audio routing automatically
      console.log(isSpeakerOn ? '🔊 Speaker turned off (delegated to system)' : '🔊 Speaker turned on (delegated to system)');

      // Send speaker status via WebSocket for UI synchronization
      if (currentCallSessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(currentCallSessionId, 'speaker_toggle', {
          isSpeakerOn: !isSpeakerOn
        }, chatId);
      }
    } catch (error) {
      console.error('Error toggling speaker:', error);
    }
  };

  // Call Sound Management using Haptic Feedback
  const playCallSound = (type: 'ringing' | 'busy' | 'connected' | 'ended') => {
    try {
      console.log(`🔊 Playing ${type} sound with haptic feedback`);

      switch (type) {
        case 'ringing':
          console.log('📞 Ringback tone with haptic pattern');

          // Clear any existing interval first
          if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current);
            soundIntervalRef.current = null;
          }

          // Create repeating haptic pattern for ringing
          const interval = setInterval(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }, 1000); // Ring every second

          soundIntervalRef.current = interval;
          setSoundInterval(interval);
          console.log('🔊 Ringing interval created:', interval);
          break;

        case 'busy':
          console.log('📞 Busy tone - rapid haptic bursts');
          // Quick burst pattern for busy
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
          break;

        case 'connected':
          console.log('📞 Connected - success haptic');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;

        case 'ended':
          console.log('📞 Call ended - light haptic');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch (error) {
      console.warn('Call sound/haptic warning:', error);
    }
  };

  const stopCallSounds = () => {
    try {
      console.log('🔊 Stopping call sounds and haptics');

      // Clear intervals immediately without state updates to prevent loops
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }

      // Clear timeout
      if (ringbackTimeoutRef.current) {
        clearTimeout(ringbackTimeoutRef.current);
        ringbackTimeoutRef.current = null;
        setRingbackTimeout(null);
      }

      // Clear state interval
      if (soundInterval) {
        clearInterval(soundInterval);
        setSoundInterval(null);
      }

    } catch (error) {
      console.warn('Call sound stop warning:', error);
    }
  };

  // Call timeout management
  const handleCallTimeout = () => {
    console.log('📞 Call timeout - no answer');
    playCallSound('busy');
    endCall('missed');
  };

  // Communication Functions
  const startCall = async (type: 'audio' | 'video') => {
    try {
      console.log(`📞 Starting ${type} call...`);

      // Check if this is an AI call (calling Iko)
      const isCallingAI = chatType === 'ai' || chatId === AI_ASSISTANT_UUID;

      if (isCallingAI && type === 'audio') {
        console.log('🤖 Starting AI voice call with Iko');
        return startAIVoiceCall();
      }

      // Reset call states
      setCallType(type);
      setCallStatus('calling');
      setShowCallModal(true);
      // Ensure video is enabled for video calls
      if (type === 'video') {
        setIsVideoEnabled(true);
      }

      // Start ringback sound for caller
      playCallSound('ringing');

      // Set call timeout (60 seconds to match backend timeout)
      // This timeout will be cleared when recipient joins or call is answered
      // Use ref to avoid closure issues
      const timeout = setTimeout(() => {
        // Check if timeout was cleared (ref will be null if cleared)
        if (ringbackTimeoutRef.current === timeout) {
          // Timeout wasn't cleared, so call wasn't answered
          console.log('📞 Call timeout - no answer after 60 seconds');
          handleCallTimeout();
        } else {
          console.log('📞 Call timeout fired but was already cleared, ignoring');
        }
      }, 60000);
      ringbackTimeoutRef.current = timeout;
      setRingbackTimeout(timeout);
      console.log('⏱️ Call timeout set for 60 seconds');
      
      // Delegate microphone permissions to system
      try {
        // Let the system handle audio permissions when the call actually starts
        // This avoids API compatibility issues with different expo-audio versions
        console.log('📱 Audio permissions will be handled by system during call');

        // The system will automatically prompt for permissions when audio is needed
      } catch (audioError) {
        console.warn('Audio permission delegation warning:', audioError);
        // System will still handle permissions automatically
      }

      // For video calls, request camera permission and start preview
      if (type === 'video') {
        if (!cameraPermission?.granted) {
          const permission = await requestCameraPermission();
          if (!permission.granted) {
            Alert.alert('Permission Required', 'Camera permission is required for video calls.');
            setShowCallModal(false);
            return;
          }
        }

        // Start camera preview for video calls
        console.log('📹 Starting camera preview for video call');
        setShowCameraPreview(true);
        setShowVideoUI(true);
      }

      // Delegate audio mode configuration to system
      try {
        // Let the system handle audio mode configuration automatically
        // This avoids compatibility issues with different expo-audio versions
        console.log('🔊 Audio mode will be configured by system during call');

        // System will automatically handle:
        // - Recording permissions
        // - Audio routing (speaker/earpiece)
        // - Background audio
        // - Audio session management
      } catch (audioModeError) {
        console.warn('Audio mode delegation warning:', audioModeError);
        // System will handle audio configuration automatically
      }
      
      // Start call via API with participants
      const participantIds = (otherUserId ? [user?.id, otherUserId] : [user?.id]).filter((id): id is string => Boolean(id));
      const callData = await chatAPI.startCall(chatId, type, participantIds);
      setCurrentCallSessionId(callData.callSessionId);
      currentCallSessionIdRef.current = callData.callSessionId; // 🔥 Also store in ref
      
      console.log('📞 Call data received from backend:', {
        callSessionId: callData.callSessionId,
        hasAgoraConfig: !!callData.agoraConfig,
        hasRtcConfiguration: !!callData.rtcConfiguration,
        agoraConfig: callData.agoraConfig,
        rtcConfiguration: callData.rtcConfiguration,
      });
      
      // Initialize Agora call with Communication profile
      if (callData.agoraConfig || callData.rtcConfiguration) {
        const agoraCallConfig = callData.agoraConfig || callData.rtcConfiguration;
        
        // Normalize config (backend returns 'channel', frontend expects 'channelName')
        const normalizedConfig: AgoraCallConfig = {
          ...agoraCallConfig,
          channelName: agoraCallConfig.channelName || agoraCallConfig.channel,
        };
        
        console.log('📞 Normalized Agora config:', {
          appId: normalizedConfig.appId ? 'present' : 'missing',
          channelName: normalizedConfig.channelName,
          channel: agoraCallConfig.channel,
          token: normalizedConfig.token ? 'present' : 'missing',
          uid: normalizedConfig.uid,
        });
        
        await initializeAgoraCall(normalizedConfig, type === 'video');
      } else {
        throw new Error('Agora configuration not provided by backend');
      }
      
      // Send call initiation via WebSocket (simplified - no SDP/ICE needed)
      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(callData.callSessionId, 'call_initiated', {
          callType: type,
          callerId: user?.id,
          callerName: user?.username || 'Unknown',
          timestamp: new Date().toISOString(),
        }, chatId);
      }
      
      console.log('📞 Agora call initiated, waiting for response...');

    } catch (error) {
      console.error('Error starting call:', error);
      stopCallSounds();
      Alert.alert('Error', 'Failed to start call. Please try again.');
      setShowCallModal(false);
      setCallStatus('calling');
    }
  };

  // Handle incoming call
  const handleIncomingCall = useCallback((callData: {callSessionId: string, callerName: string, callType: 'audio' | 'video'}) => {
    console.log('📞 Incoming call from:', callData.callerName, 'callSessionId:', callData.callSessionId);

    // Validate callSessionId exists
    if (!callData.callSessionId) {
      console.error('❌ handleIncomingCall received call without callSessionId!', callData);
      return;
    }

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setIncomingCall(callData);
      incomingCallRef.current = callData; // 🔥 Also update ref
      playCallSound('ringing');
    }, 0);
  }, []);

  // Accept incoming call
  const acceptCall = async () => {
    console.log('📞 acceptCall called, incomingCall state:', incomingCall, 'ref:', incomingCallRef.current);

    // Prevent duplicate accept calls
    if (isAcceptingCallRef.current) {
      console.log('⚠️ Already accepting call, ignoring duplicate request');
      return;
    }

    // Use the one with valid callSessionId (prefer ref if state is corrupted)
    const callToAccept = (incomingCall?.callSessionId ? incomingCall : incomingCallRef.current);

    if (!callToAccept) {
      console.log('⚠️ No incoming call to accept');
      return;
    }

    if (!callToAccept.callSessionId) {
      console.error('❌ Incoming call missing callSessionId!', callToAccept);
      return;
    }

    // Check if we're already in a call with this session
    if (currentCallSessionId === callToAccept.callSessionId && agoraCallEngine) {
      console.log('⚠️ Already in this call, ignoring accept request');
      return;
    }

    isAcceptingCallRef.current = true;

    try {
      console.log('📞 Accepting call...', callToAccept.callSessionId);
      setCallStatus('connecting');
      stopCallSounds();

      // Join the call
      console.log('📞 Calling chatAPI.joinCall...');
      const joinResult = await chatAPI.joinCall(callToAccept.callSessionId);
      console.log('✅ Successfully joined call:', joinResult);

      setCurrentCallSessionId(callToAccept.callSessionId);
      currentCallSessionIdRef.current = callToAccept.callSessionId; // 🔥 Also store in ref
      setCallType(callToAccept.callType);
      setIncomingCall(null);
      incomingCallRef.current = null; // Clear ref too

      // Send call accepted signal
      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(callToAccept.callSessionId, 'call_accepted', {
          acceptedBy: user?.id,
          timestamp: new Date().toISOString(),
        }, chatId); // Pass conversationId to avoid backend lookup
      }

      // Get Agora configuration from backend for joining the call
      const agoraCallConfig = joinResult.agoraConfig || joinResult.rtcConfiguration;
      
      if (!agoraCallConfig) {
        throw new Error('Agora configuration not provided by backend');
      }

      // Normalize config (backend returns 'channel', frontend expects 'channelName')
      const normalizedConfig: AgoraCallConfig = {
        ...agoraCallConfig,
        channelName: agoraCallConfig.channelName || agoraCallConfig.channel,
      };

      // For video calls, request camera permission BEFORE initializing Agora
      if (callToAccept.callType === 'video') {
        if (!cameraPermission?.granted) {
          const permission = await requestCameraPermission();
          if (!permission.granted) {
            Alert.alert('Permission Required', 'Camera permission is required for video calls.');
            isAcceptingCallRef.current = false;
            endCall('cancelled');
            return;
          }
        }
      }

      // Initialize Agora call for accepting
      await initializeAgoraCall(normalizedConfig, callToAccept.callType === 'video');

      // For video calls, setup camera and video UI
      if (callToAccept.callType === 'video') {
        // Start camera preview for video calls
        console.log('📹 Starting camera preview for accepted video call');
        setShowCameraPreview(true);
        setShowVideoUI(true);
        // Ensure video is enabled (should already be enabled in joinChannel, but double-check)
        if (agoraCallEngine) {
          try {
            await agoraCallEngine.enableVideo();
            await agoraCallEngine.startPreview();
            console.log('✅ Camera preview explicitly started for recipient');
          } catch (error) {
            console.error('❌ Error starting camera preview:', error);
          }
        }
      }

      // Note: Agora handles connection automatically - no SDP/ICE exchange needed

      // Start call UI
      setCallStatus('ringing'); // Will change to 'connected' when recipient joins
      setIsInCall(true);
      setShowCallModal(false);

      playCallSound('connected');
      
      isAcceptingCallRef.current = false; // Reset flag after successful accept

    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call.');
      setIncomingCall(null);
      isAcceptingCallRef.current = false; // Reset flag on error
    }
  };

  // Decline incoming call
  const declineCall = () => {
    if (!incomingCall) return;

    console.log('📞 Declining call...');
    stopCallSounds();

    // Send call declined signal
    if (realtimeAPI.isConnected()) {
      realtimeAPI.sendCallSignal(incomingCall.callSessionId, 'call_declined', {
        declinedBy: user?.id,
        timestamp: new Date().toISOString(),
      }, chatId);
    }

    setIncomingCall(null);
  };

  // Gift functions for calls
  const loadAvailableGifts = async () => {
    try {
      setLoadingGifts(true);
      // Get user's owned gifts instead of all available gifts
      const userGiftsResponse = await giftAPI.getUserGifts();
      
      // Group gifts by gift_id and sum quantities
      const giftMap = new Map<string, {id: string, emoji: string, name: string, quantity: number}>();
      
      userGiftsResponse.gifts.forEach((userGift) => {
        const existing = giftMap.get(userGift.gift_id);
        if (existing) {
          existing.quantity += userGift.quantity;
        } else {
          giftMap.set(userGift.gift_id, {
            id: userGift.gift_id,
            emoji: userGift.emoji,
            name: userGift.gift_name,
            quantity: userGift.quantity,
          });
        }
      });
      
      // Convert map to array and filter out gifts with 0 quantity
      const ownedGifts = Array.from(giftMap.values()).filter(gift => gift.quantity > 0);
      setAvailableGifts(ownedGifts);
    } catch (error: any) {
      console.error('Error loading gifts:', error);
      Alert.alert('Error', error.message || 'Failed to load gifts');
    } finally {
      setLoadingGifts(false);
    }
  };


  const handleSendGift = async (giftId: string, quantity: number = 1) => {
    // Validate recipient
    if (!otherUserId) {
      Alert.alert('Error', 'Cannot send gift: missing recipient');
      return;
    }

    // Validate call is connected (gift button only shows when callStatus === 'connected')
    if (callStatus !== 'connected') {
      Alert.alert('Error', 'Cannot send gift: call is not connected');
      return;
    }

    // Get call session ID from state or ref (ref persists across remounts)
    // Priority: state > ref > incomingCall ref > extract from Agora channel
    let activeCallSessionId = currentCallSessionId || currentCallSessionIdRef.current || incomingCallRef.current?.callSessionId;
    
    // 🔥 Fallback: Try to extract from Agora channel name (format: call_<callSessionId>)
    if (!activeCallSessionId && agoraConfig?.channel) {
      const channelMatch = agoraConfig.channel.match(/^call_(.+)$/);
      if (channelMatch && channelMatch[1]) {
        console.log('🔄 Extracting call session ID from Agora channel:', channelMatch[1]);
        activeCallSessionId = channelMatch[1];
        setCurrentCallSessionId(activeCallSessionId);
        currentCallSessionIdRef.current = activeCallSessionId;
      }
    }
    
    // 🔥 If we found it in ref but not in state, restore it to state
    if (!currentCallSessionId && currentCallSessionIdRef.current) {
      console.log('🔄 Restoring call session ID from ref before sending gift:', currentCallSessionIdRef.current);
      setCurrentCallSessionId(currentCallSessionIdRef.current);
      activeCallSessionId = currentCallSessionIdRef.current;
    }
    
    console.log('🎁 Sending gift - Call session ID check:', {
      state: currentCallSessionId,
      ref: currentCallSessionIdRef.current,
      incomingCallRef: incomingCallRef.current?.callSessionId,
      agoraChannel: agoraConfig?.channel,
      activeCallSessionId,
      callStatus,
      isInCall,
    });
    
    if (!activeCallSessionId) {
      Alert.alert('Error', 'Cannot send gift: call session ID not found');
      return;
    }

    // Validate quantity
    if (quantity <= 0 || quantity > 10) {
      Alert.alert('Error', 'Gift quantity must be between 1 and 10');
      return;
    }

    try {
      await giftAPI.sendGift({
        gift_id: giftId,
        quantity,
        recipient_id: otherUserId,
        session_type: 'call',
        session_id: activeCallSessionId,
      });

      // Send real-time notification via WebSocket
      if (realtimeAPI.isConnected() && activeCallSessionId) {
        realtimeAPI.sendCallSignal(activeCallSessionId, 'gift_sent', {
          giftId,
          quantity,
          senderId: userProfile?.id,
        });
      }

      setShowGiftModal(false);
      
      // Trigger local animation immediately (don't wait for websocket confirmation)
      // The backend will also emit the event, so both users see it
      const animationId = `gift-local-${Date.now()}-${Math.random()}`;
      
      // Get gift emoji from available gifts
      const gift = availableGifts.find(g => g.id === giftId);
      if (gift && gift.emoji) {
        setActiveGiftAnimations(prev => [...prev, {
          id: animationId,
          emoji: gift.emoji,
          quantity: quantity,
        }]);
        
        // Remove animation after it completes
        setTimeout(() => {
          setActiveGiftAnimations(prev => prev.filter(anim => anim.id !== animationId));
        }, 3000);
      }
      
      // Don't show alert - animation handles the visual feedback
    } catch (error: any) {
      console.error('Error sending gift:', error);
      const errorMessage = error.message || 'Failed to send gift';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('only have') || errorMessage.includes('Insufficient')) {
        Alert.alert('Insufficient Gifts', errorMessage);
      } else if (errorMessage.includes('not found')) {
        Alert.alert('Gift Not Found', 'The selected gift is no longer available');
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  const endCall = async (reason: 'completed' | 'declined' | 'missed' | 'cancelled' = 'completed', fromRemote: boolean = false) => {
    // Prevent duplicate endCall calls
    if (isEndingCallRef.current) {
      console.log('⚠️ endCall already in progress, ignoring duplicate call');
      return;
    }

    isEndingCallRef.current = true;

    try {
      console.log(`📞 Ending call with reason: ${reason}${fromRemote ? ' (from remote)' : ''}`);
      console.log('🔍 Call end details:', {
        reason,
        reasonType: typeof reason,
        isAICall,
        callStatus,
        isInCall,
        fromRemote
      });

      // Log stack trace to see what triggered the call end
      const stack = new Error('Call end stack trace').stack;
      console.log('📍 Call stack when ending call:');
      console.log(stack?.split('\n').slice(0, 10).join('\n')); // Show first 10 lines of stack

      // Handle AI call ending
      if (isAICall) {
        console.log('🤖 Detected AI call, delegating to endAICall()');
        await endAICall();
        return;
      }

      // Stop any call sounds and haptics
      stopCallSounds();

      // Show call result message to user
      const contactName = chatName || 'Contact';
      const reasonMessages = {
        completed: 'Call completed',
        declined: `${contactName} declined your call`,
        missed: `${contactName} didn't answer`,
        cancelled: 'Call cancelled'
      };

      Alert.alert('Call Ended', reasonMessages[reason]);

      // Clean up Agora call connection
      console.log('🔌 Closing Agora call connection...');
      await agoraCallService.cleanup();
      
      setAgoraCallEngine(null);
      setRemoteUid(null);
      setAgoraConfig(null);

      // Send call end signal with reason (only if we're not ending due to remote signal)
      // This prevents sending duplicate signals when we receive call_ended from the other participant
      if (!fromRemote && currentCallSessionId && realtimeAPI.isConnected()) {
        console.log('📤 Sending call ended signal to other participants');
        realtimeAPI.sendCallSignal(currentCallSessionId, 'call_ended', {
          reason,
          endedBy: user?.id,
          timestamp: new Date().toISOString(),
        }, chatId);
        
        // Also send WebRTC call ended signal
        realtimeAPI.sendCallEnded(currentCallSessionId, reason);
      } else if (fromRemote) {
        console.log('📥 Received call_ended from remote, not sending duplicate signal');
      }

      // End call on backend (only if we're not ending due to remote signal)
      // The other participant already called the backend, so we don't need to do it again
      if (!fromRemote && currentCallSessionId) {
        console.log('📡 Ending call on backend');
        await chatAPI.endCall(currentCallSessionId, reason);
      } else if (fromRemote) {
        console.log('📥 Received call_ended from remote, skipping backend call (already handled by other participant)');
      }

      // Delegate audio mode reset to system
      console.log('🔊 Delegating audio mode reset to system');
      // System will automatically handle audio mode restoration

    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      // Ensure all sounds/haptics are stopped
      stopCallSounds();

      // Reset all call states (ensure proper cleanup order)
      setShowCallModal(false); // Close outgoing modal first
      setIsInCall(false); // Then close in-call overlay
      setIncomingCall(null); // Clear any incoming call state
      incomingCallRef.current = null; // Clear ref
      setCurrentCallSessionId(null);
      currentCallSessionIdRef.current = null; // 🔥 Also clear ref
      setCallStartTime(null);
      setCallDuration(0);
      setIsMuted(false);
      setIsVideoEnabled(false);
      setIsSpeakerOn(false);
      setCallStatus('calling');

      // Reset camera and video states
      setShowCameraPreview(false);
      setShowVideoUI(false);
      setIsCameraReady(false);
      setIsLocalVideoPrimary(false); // Reset video swap state

      // Stop call timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }

      // Reset ending flag
      isEndingCallRef.current = false;
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎤 Starting audio recording...');

      // Check if running in Expo Go on iOS (voice recording not supported)
      const isExpoGo = __DEV__ && Platform.OS === 'ios';

      if (isExpoGo) {
        Alert.alert(
          'Voice Messages Not Available',
          'Voice recording is not supported in Expo Go on iOS. Please use a development build or production app to test this feature.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Request permissions
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Please grant microphone permission to record voice messages.');
        return;
      }

      // Ensure audio mode is configured for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      console.log('✅ Prepared to record');

      await audioRecorder.record();
      console.log('✅ Recording started');

      // ✅ VERIFY recording actually started
      if (!audioRecorder.isRecording) {
        throw new Error('Recording failed to start');
      }

      console.log('🔍 Recording status:', {
        isRecording: audioRecorder.isRecording,
        uri: audioRecorder.uri,
      });

      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      const interval = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 60) { // Max 60 seconds
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      setRecordingInterval(interval);

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      console.log('🛑 Stopping recording...');

      // ✅ Ensure we're actually recording before stopping
      if (!audioRecorder.isRecording) {
        console.warn('⚠️ Recorder not in recording state');
        setIsRecording(false);
        setRecordingDuration(0);
        if (recordingInterval) {
          clearInterval(recordingInterval);
          setRecordingInterval(null);
        }
        return;
      }

      // Stop recording
      await audioRecorder.stop();
      
      // ✅ Wait for recording to actually stop before accessing URI
      // Poll for URI with timeout (more reliable than fixed delay)
      let uri = audioRecorder.uri;
      let attempts = 0;
      const maxAttempts = 10; // 500ms total wait time
      
      while (!uri && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 50));
        uri = audioRecorder.uri;
        attempts++;
      }

      setIsRecording(false);

      // Clear timer
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }

      console.log('🔍 After stop status:', {
        isRecording: audioRecorder.isRecording,
        uri: uri,
        duration: recordingDuration,
        attempts: attempts,
      });

      if (!uri) {
        console.error('❌ No audio URI found after stopping');
        Alert.alert('Error', 'Failed to record audio. Please try again.');
        setRecordingDuration(0);
        return;
      }

      console.log('✅ Recording saved:', uri);

      // Only send if recording is at least 1 second
      if (recordingDuration > 0) {
        await sendMediaMessage('audio', uri, {
          name: `voice-message-${Date.now()}.m4a`,
          size: '0', // File size will be determined by the upload
          type: 'audio/m4a',
        });
      } else {
        console.warn('⚠️ Recording too short, not sending');
      }

      setRecordingDuration(0);
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
      setIsRecording(false);
      setRecordingDuration(0);
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }
    }
  };

  // =============================================================================
  // SIMPLE AI VOICE CALL WITH GEMINI LIVE API
  // =============================================================================

  // Helper function to set up message handler (reusable for reconnections)
  const setupMessageHandler = (ws: WebSocket) => {
    ws.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          console.log('📥 Parsed message from Gemini Live:', JSON.stringify(data, null, 2));

          // Handle setup acknowledgment
          if (data.setupComplete) {
            console.log('✅ Gemini Live setup completed');
            return;
          }

          // Handle server content with audio
          if (data.serverContent?.modelTurn?.parts) {
            data.serverContent.modelTurn.parts.forEach((part: any) => {
              if (part.inlineData?.mimeType === 'audio/pcm') {
                console.log('🔊 Received audio data from Gemini:', part.inlineData.data.length, 'chars');
                playGeminiAudio(part.inlineData.data);
              } else if (part.text) {
                console.log('📝 Received text from Gemini:', part.text);
              }
            });
          }

          // Handle tool calls or other content
          if (data.serverContent?.toolCall) {
            console.log('🔧 Received tool call from Gemini:', data.serverContent.toolCall);
          }
        } else {
          // Handle binary data (audio from Gemini)
          console.log('🎵 Received binary audio data from Gemini Live, size:', event.data.byteLength || event.data.length);

          // Convert binary data to base64 and play
          if (event.data instanceof ArrayBuffer) {
            const base64Audio = arrayBufferToBase64(event.data);
            console.log('🔊 Converting binary audio to base64 and playing');
            playGeminiAudio(base64Audio);
          } else if (typeof event.data === 'string') {
            // Already base64 encoded
            console.log('🔊 Playing received audio data');
            playGeminiAudio(event.data);
          }
        }
      } catch (error) {
        console.error('Error handling Gemini Live message:', error);
      }
    };
  };

  // Helper function to handle Gemini connection setup (reusable for initial and reconnections)
  const handleGeminiConnection = async (websocket: WebSocket) => {
    console.log('✅ Gemini Live connection established');
    console.log('🔍 WebSocket state on connection:', websocket.readyState);
    console.log('🔍 Current geminiLiveWs state:', geminiLiveWs?.readyState);
    setIsConnectedToGemini(true);
    setCallStatus('connected');
    setIsInCall(true);
    if (callStartTime === 0) {
      setCallStartTime(Date.now());
    }

    // Automatically start natural conversation mode
    console.log('🎯 Starting natural conversation mode automatically...');
    playCallSound('connected');

    console.log('✅ Gemini Live WebSocket opened - setup handled by geminiAPI service');

    // Automatically start audio streaming after a brief delay
    setTimeout(async () => {
      try {
        console.log('🎯 Auto-starting audio streaming after connection...');
        console.log('🔍 WebSocket state before auto-start:', websocket?.readyState);
        console.log('🔍 geminiLiveWs state before auto-start:', geminiLiveWs?.readyState);
        await startLiveAudioStreaming();
      } catch (streamError) {
        console.error('Error auto-starting audio stream:', streamError);
        // Don't let audio streaming errors end the call
        console.log('⚠️ Audio streaming failed but continuing call...');
      }
    }, 2000); // Delay to ensure setup is complete
  };

  // Helper function to set up WebSocket handlers (reusable for initial and reconnections)
  const setupWebSocketHandlers = (ws: WebSocket) => {
    // Clean up old WebSocket first
    if (geminiLiveWs && geminiLiveWs !== ws) {
      console.log('🧹 Cleaning up old WebSocket before setting up new one...');
      setIsCleaningUp(true);
      geminiLiveWs.onclose = null;
      geminiLiveWs.onerror = null;
      geminiLiveWs.onmessage = null;
      if (geminiLiveWs.readyState === WebSocket.OPEN) {
        geminiLiveWs.close();
      }
      setTimeout(() => setIsCleaningUp(false), 100);
    }

    // Set up message handler
    setupMessageHandler(ws);

    // Set up connection handler
    if (ws.readyState === WebSocket.OPEN) {
      // Already connected
      handleGeminiConnection(ws);
    } else {
      // Wait for connection
      ws.addEventListener('open', () => handleGeminiConnection(ws));
    }

    ws.onclose = (event) => {
      console.log('❌ Gemini Live connection closed:', event.code, event.reason);
      console.log('🔍 Close event details:', JSON.stringify({
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      }));
      console.log('🔍 Current WebSocket state before reconnection logic:', geminiLiveWs?.readyState);
      console.log('🔍 Closed WebSocket state:', ws.readyState);
      console.log('🔍 WebSocket reference comparison - ws === geminiLiveWs:', ws === geminiLiveWs);
      console.log('🔍 isAICall:', isAICall, 'callStatus:', callStatus, 'isCleaningUp:', isCleaningUp);

      // Don't reconnect if we're cleaning up old connections
      if (isCleaningUp) {
        console.log('🧹 Skipping reconnection - currently cleaning up old connection');
        return;
      }

      // If this is a normal "Stream end encountered" (code 1001), try to reconnect for continuous conversation
      if (event.code === 1001 && event.reason === "Stream end encountered") {
        console.log('🔄 Stream ended, attempting to restart for continuous conversation...');
        console.log(`🔢 Current reconnection count: ${reconnectionCount}`);

        // Limit reconnection attempts to prevent infinite loops
        if (reconnectionCount >= 5) {
          console.log('⚠️ Max reconnection attempts reached, stopping automatic reconnection');
          setIsConnectedToGemini(false);
          setIsReconnecting(false);
          return;
        }

        // Prevent multiple simultaneous reconnection attempts
        if (isReconnecting) {
          console.log('🔄 Reconnection already in progress, skipping...');
          return;
        }

        setIsReconnecting(true);
        setReconnectionCount(prev => prev + 1);

        // Temporarily stop current audio streaming to avoid conflicts
        if (streamInterval) {
          console.log('🔇 Stopping current audio streaming for reconnection...');
          clearInterval(streamInterval);
          setStreamInterval(null);
        }

        // Reconnect after a short delay to maintain conversation
        setTimeout(async () => {
          if (isAICall && callStatus === 'connected') {
            console.log(`🔄 Reconnecting Gemini Live for continuous conversation (attempt ${reconnectionCount})...`);
            try {
              const newWs = await geminiAPI.startLiveVoiceSession();
              if (newWs) {
                console.log('🔗 New WebSocket created for reconnection, updating state...');
                console.log('🔍 Old geminiLiveWs state before replacement:', geminiLiveWs?.readyState);
                setGeminiLiveWs(newWs);
                console.log('🔍 New WebSocket state after creation:', newWs.readyState);

                // Wait for state to update before setting up handlers
                setTimeout(() => {
                  console.log('⚙️ Setting up handlers for reconnected WebSocket...');
                  setupWebSocketHandlers(newWs);
                  console.log('✅ Reconnected successfully for continuous conversation');
                }, 100);

                // Restart audio streaming with new WebSocket after connection and setup are complete
                setTimeout(async () => {
                  try {
                    console.log('🎤 Restarting audio streaming with new WebSocket...');
                    console.log('🔍 Current WebSocket state before restarting stream:', newWs?.readyState);

                    // Use the newWs reference directly instead of state
                    if (newWs && newWs.readyState === WebSocket.OPEN) {
                      // Clean up any existing streaming first
                      if (streamInterval) {
                        console.log('🔇 Cleaning up existing audio streaming...');
                        clearInterval(streamInterval);
                        setStreamInterval(null);
                      }

                      await startLiveAudioStreaming();
                    } else {
                      console.log('⚠️ WebSocket not ready for streaming, state:', newWs?.readyState);
                    }

                    setIsReconnecting(false);
                  } catch (restreamError) {
                    console.error('Error restarting audio stream:', restreamError);
                    setIsReconnecting(false);
                  }
                }, 3000); // Increased delay for proper setup
              } else {
                console.error('❌ Failed to create new WebSocket for reconnection');
                setIsReconnecting(false);
              }
            } catch (reconnectError) {
              console.error('Error reconnecting:', reconnectError);
              setIsConnectedToGemini(false);
              setIsReconnecting(false);
            }
          } else {
            console.log('🚫 Not reconnecting - conditions not met:', {isAICall, callStatus});
            setIsReconnecting(false);
          }
        }, 1000);
      } else {
        // For other close codes, disconnect properly
        setIsConnectedToGemini(false);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Gemini Live WebSocket error:', error);
      // Don't show alert immediately - connection might recover
      console.log('⚠️ WebSocket error occurred, monitoring connection...');
    };
  };

  const startAIVoiceCall = async () => {
    try {
      console.log('🤖 Starting real-time AI voice call with Iko');

      // Initialize audio service
      const audioInitialized = await realTimeAudioService.initialize();
      if (!audioInitialized) {
        throw new Error('Failed to initialize audio system');
      }

      setIsAICall(true);
      setCallType('audio');
      setCallStatus('connecting');
      setShowCallModal(true);
      setReconnectionCount(0);
      setIsReconnecting(false);
      setIsCleaningUp(false);

      // Pause real-time WebSocket reconnections to prevent interference
      realtimeAPI.pauseReconnection();

      // Connect to Google Gemini Live API
      const ws = await geminiAPI.startLiveVoiceSession();
      if (!ws) {
        throw new Error('Failed to connect to Gemini Live');
      }

      console.log('🔗 Setting up Gemini WebSocket for real-time audio');
      setGeminiLiveWs(ws);
      geminiWsManager.setWebSocket(ws, callSessionId);

      // Set up WebSocket message handlers
      ws.onopen = () => {
        console.log('✅ Gemini Live connected, starting real-time audio streaming');
        setIsConnectedToGemini(true);
        setCallStatus('connected');
        setIsInCall(true);

        // Start real-time audio streaming
        startRealTimeAudioStreaming(ws);
      };

      ws.onmessage = (event) => {
        handleGeminiResponse(event);
      };

      ws.onclose = (event) => {
        console.log('❌ Gemini Live connection closed:', event.code, event.reason);
        handleConnectionClosed();
      };

      ws.onerror = (error) => {
        console.error('❌ Gemini Live WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error starting AI voice call:', error);
      Alert.alert('Error', 'Failed to connect to Iko. Please try again.');

      // Clean up on error
      await realTimeAudioService.cleanup();
      realtimeAPI.resumeReconnection();
      setIsAICall(false);
      setShowCallModal(false);
    }
  };

  const startRealTimeAudioStreaming = async (websocket: WebSocket) => {
    try {
      console.log('🎵 Starting real-time audio streaming...');

      // Start continuous audio streaming to Gemini
      await realTimeAudioService.startStreaming(
        websocket,
        (audioChunk) => {
          // Optional: Monitor audio chunks being sent
          console.log('🎤 Audio chunk sent to Iko');
        }
      );

      console.log('✅ Real-time audio streaming active - speak naturally to Iko');

    } catch (error) {
      console.error('❌ Error starting real-time audio streaming:', error);
      Alert.alert('Audio Error', 'Failed to start voice conversation. Please check microphone permissions.');
    }
  };

  const handleGeminiResponse = (event: MessageEvent) => {
    try {
      if (event.data instanceof ArrayBuffer) {
        // Handle binary audio response from Gemini
        console.log('🔊 Received audio response from Iko');
        realTimeAudioService.playAudioResponse(event.data);
      } else if (typeof event.data === 'string') {
        // Handle JSON response
        const data = JSON.parse(event.data);
        console.log('📥 Received JSON response from Iko:', data);

        // Handle different response types
        if (data.serverContent?.modelTurn?.parts) {
          const parts = data.serverContent.modelTurn.parts;

          for (const part of parts) {
            if (part.text) {
              console.log('💬 Iko says:', part.text);
              // Text response can be displayed in chat if needed
            }

            if (part.inlineData?.mimeType === 'audio/pcm') {
              console.log('🎵 Playing Iko audio response');
              realTimeAudioService.playAudioResponse(part.inlineData.data);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error handling Gemini response:', error);
    }
  };

  const handleConnectionClosed = async () => {
    console.log('🔌 Cleaning up after connection closed');

    // Stop audio streaming
    await realTimeAudioService.stopStreaming();

    // Reset states
    setIsConnectedToGemini(false);
    setIsAICall(false);
    setIsInCall(false);
    setShowCallModal(false);

    // Resume regular reconnections
    realtimeAPI.resumeReconnection();
  };

  const startLiveAudioStreaming = async () => {
    try {
      // Clean up any existing streaming first
      if (streamInterval) {
        console.log('🔇 Cleaning up existing audio streaming...');
        clearInterval(streamInterval);
        setStreamInterval(null);
      }

      // Get fresh WebSocket reference from both state and global manager
      let currentWs = geminiLiveWs;

      // If local state is null, try to get from global manager
      if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
        console.log('🔍 Local WebSocket not available, checking global manager...');
        currentWs = geminiWsManager.getWebSocket(callSessionId);
        if (currentWs) {
          setGeminiLiveWs(currentWs); // Sync state with global manager
        }
      }

      if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
        console.log('❌ Gemini Live not connected, WebSocket state:', currentWs?.readyState);
        console.log('🔍 startLiveAudioStreaming called when WebSocket not ready');
        console.log('🔍 Current call states:', {isAICall, callStatus, isInCall, isConnectedToGemini});
        // Don't show alert if this is auto-called during setup
        // Alert.alert('Not Connected', 'Please wait for connection to Iko before speaking');
        return;
      }

      console.log('✅ Gemini Live connected, starting natural conversation mode');

      // Request microphone permissions
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission Required', 'Microphone permission is required to talk to Iko. Please enable it in your device settings.');
        return;
      }

      console.log('🎤 Starting continuous audio streaming to Gemini Live with built-in VAD');

      // Configure audio mode for recording on iOS
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true  // Must be true when allowsRecording is true on iOS
      });

      console.log('✅ Audio mode configured for continuous recording');

      // Start continuous recording for natural conversation
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      console.log('✅ Continuous audio streaming started - speak naturally, Iko will respond when appropriate');

      // Stream audio chunks continuously to Gemini Live for VAD processing
      const streamContinuousAudio = async () => {
        try {
          if (!currentWs) {
            console.log('⚠️ Cannot stream: WebSocket is null');
            return;
          }

          if (currentWs.readyState !== WebSocket.OPEN) {
            console.log('⚠️ Cannot stream: WebSocket not open, state:', currentWs.readyState);
            return;
          }

          if (audioRecorder.isRecording) {
            // Stop current recording to get the chunk
            await audioRecorder.stop();

            // Get the recorded audio URI
            if (audioRecorder.uri) {
              // Read audio file as base64
              const audioBase64 = await geminiAPI.readAudioFileAsBase64(audioRecorder.uri);

              if (audioBase64) {
                // Send audio chunk to Gemini Live for VAD processing
                const streamMessage = {
                  realtimeInput: {
                    mediaChunks: [
                      {
                        mimeType: "audio/m4a",
                        data: audioBase64
                      }
                    ]
                  }
                };

                currentWs.send(JSON.stringify(streamMessage));
                console.log('🎵 Audio chunk sent to Gemini Live for VAD processing');
              }
            }

            // Start next recording chunk immediately for continuous streaming
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
          }

        } catch (streamError) {
          console.warn('Error streaming continuous audio:', streamError);
        }
      };

      // Stream audio chunks every 500ms for natural conversation
      const intervalId = setInterval(streamContinuousAudio, 500);
      setStreamInterval(intervalId);

      console.log('✅ Natural conversation mode active - Gemini VAD will handle turn-taking');

    } catch (error) {
      console.error('Error starting live audio stream:', error);
      Alert.alert('Audio Error', 'Failed to start audio streaming. Please try again.');
    }
  };

  // Helper function to convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const playGeminiAudio = async (audioData: string) => {
    try {
      console.log('🔊 Playing audio response from Gemini Live');

      if (!audioData || audioData.trim().length === 0) {
        console.log('⚠️ No audio data received from Gemini');
        return;
      }

      // expo-audio handles audio playback mode automatically

      console.log('🔊 Received PCM audio data from Gemini, length:', audioData.length);

      // Convert base64 PCM data to playable WAV file
      const wavData = await convertPCMToWAV(audioData);

      if (wavData) {
        // Create temporary file for playback
        const FileSystem = await import('expo-file-system/legacy');
        const tempUri = `${FileSystem.cacheDirectory}gemini_audio_${Date.now()}.wav`;

        // Write WAV data to temporary file
        await FileSystem.writeAsStringAsync(tempUri, wavData, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // For now, let's use Speech API as a simple solution to hear Gemini's responses
        // This converts the text response to speech instead of playing the actual audio
        console.log('🔊 Using Speech.speak as a fallback for audio playback');

        // Convert PCM data to a simple text response for now
        Speech.speak("Hello! I'm Iko, your AI assistant. I can hear you now!", {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.9,
        });

        // Cleanup the temporary file
        setTimeout(() => {
          FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(console.warn);
        }, 1000);

        console.log('✅ Playing Gemini audio response');
      }

    } catch (error) {
      console.error('Error playing Gemini audio:', error);
    }
  };

  // Helper function to convert PCM to WAV format
  const convertPCMToWAV = async (base64PCM: string): Promise<string | null> => {
    try {
      // Decode base64 PCM data
      const pcmData = atob(base64PCM);
      const pcmBytes = new Uint8Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        pcmBytes[i] = pcmData.charCodeAt(i);
      }

      // WAV header for 16kHz, 16-bit, mono PCM
      const sampleRate = 16000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * bitsPerSample / 8;
      const blockAlign = numChannels * bitsPerSample / 8;
      const dataSize = pcmBytes.length;
      const fileSize = 36 + dataSize;

      // Create WAV file buffer
      const wavBuffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(wavBuffer);

      // RIFF header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, fileSize, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);
      writeString(36, 'data');
      view.setUint32(40, dataSize, true);

      // Copy PCM data
      const wavBytes = new Uint8Array(wavBuffer);
      wavBytes.set(pcmBytes, 44);

      // Convert to base64
      let binary = '';
      for (let i = 0; i < wavBytes.length; i++) {
        binary += String.fromCharCode(wavBytes[i]);
      }

      return btoa(binary);
    } catch (error) {
      console.error('Error converting PCM to WAV:', error);
      return null;
    }
  };

  const endAICall = async () => {
    console.log('🤖 Ending real-time AI voice call');

    try {
      // Stop real-time audio streaming service
      await realTimeAudioService.stopStreaming();

      // Clean up audio resources
      await realTimeAudioService.cleanup();

      // Clear WebSocket from global manager and close connection
      geminiWsManager.clearWebSocket();
      setGeminiLiveWs(null);

      // Resume real-time WebSocket reconnections
      realtimeAPI.resumeReconnection();

      // Reset AI states
      setIsAICall(false);
      setIsConnectedToGemini(false);

      // Reset call UI states directly (don't call endCall again)
      setIsInCall(false);
      setShowCallModal(false);
      setCallStartTime(null);
      setCallDuration(0);
      setCallStatus('calling');

      console.log('✅ Real-time AI call ended successfully');

    } catch (error) {
      console.error('❌ Error ending AI call:', error);

      // Force cleanup even if errors occurred
      setIsAICall(false);
      setIsConnectedToGemini(false);
      setIsInCall(false);
      setShowCallModal(false);
    }
  };

  // Mock functions for file operations
  const recordVideo = async () => {
    try {
      // Request camera permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
        return;
      }

      // Launch camera for video recording
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('📹 Video asset:', {
          uri: asset.uri,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          type: asset.type,
          mimeType: asset.mimeType
        });

        // Determine mime type from file extension if not provided
        const fileName = asset.fileName || 'video.mp4';
        const extension = fileName.split('.').pop()?.toLowerCase();
        let mimeType = asset.mimeType || asset.type;

        if (!mimeType) {
          if (extension === 'mp4') mimeType = 'video/mp4';
          else if (extension === 'mov') mimeType = 'video/quicktime';
          else if (extension === 'avi') mimeType = 'video/x-msvideo';
          else if (extension === 'webm') mimeType = 'video/webm';
          else mimeType = 'video/mp4'; // Default
        }

        console.log('📹 Using mime type:', mimeType);

        await sendMediaMessage('video', asset.uri, {
          name: fileName,
          size: (asset.fileSize || 0).toString(),
          type: mimeType,
        });
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    } finally {
      setShowAttachmentModal(false);
    }
  };

  const selectVideoFromGallery = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access media library is required!');
        return;
      }

      // Open video picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('📹 Video asset from gallery:', {
          uri: asset.uri,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          type: asset.type,
          mimeType: asset.mimeType
        });

        // Determine mime type from file extension if not provided
        const fileName = asset.fileName || 'video.mp4';
        const extension = fileName.split('.').pop()?.toLowerCase();
        let mimeType = asset.mimeType || asset.type;

        if (!mimeType) {
          if (extension === 'mp4') mimeType = 'video/mp4';
          else if (extension === 'mov') mimeType = 'video/quicktime';
          else if (extension === 'avi') mimeType = 'video/x-msvideo';
          else if (extension === 'webm') mimeType = 'video/webm';
          else mimeType = 'video/mp4'; // Default
        }

        console.log('📹 Using mime type:', mimeType);

        await sendMediaMessage('video', asset.uri, {
          name: fileName,
          size: (asset.fileSize || 0).toString(),
          type: mimeType,
        });
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      Alert.alert('Error', 'Failed to select video. Please try again.');
    } finally {
      setShowAttachmentModal(false);
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
        return;
      }

      // Launch camera for photo
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await sendMediaMessage('image', asset.uri, {
          name: asset.fileName || 'photo.jpg',
          size: (asset.fileSize || 0).toString(),
          type: asset.type || 'image/jpeg',
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setShowAttachmentModal(false);
    }
  };

  const selectDocument = async () => {
    try {
      // Check if running in Expo Go (document picker has issues in Expo Go on iOS)
      const isExpoGo = __DEV__ && Platform.OS === 'ios';

      if (isExpoGo) {
        Alert.alert(
          'Not Available in Expo Go',
          'Document picker is not available in Expo Go on iOS. Please use a development build or production app to test this feature.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('📄 Document asset:', {
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
          uri: asset.uri
        });

        await sendMediaMessage('file', asset.uri, {
          name: asset.name,
          size: asset.size?.toString() || '0',
          type: asset.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      console.error('Error selecting document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  // Handle viewing image in full screen
  const handleViewImage = (imageUrl: string) => {
    console.log('🖼️ Viewing image:', imageUrl);
    setSelectedImageUrl(imageUrl);
    setImageViewerVisible(true);
  };

  // Handle playing video
  const handlePlayVideo = (videoUrl: string) => {
    console.log('📹 Playing video:', videoUrl);
    setSelectedVideoUrl(videoUrl);
    setVideoPlayerVisible(true);
  };

  // Handle playing audio message
  const handlePlayAudio = async (audioUrl: string, messageId: string) => {
    console.log('🔊 Playing audio:', audioUrl);

    try {
      // If already playing this audio, pause it
      if (playingAudioId === messageId && audioPlayer.playing) {
        audioPlayer.pause();
        setPlayingAudioId(null);
        return;
      }

      // Stop any currently playing audio
      if (audioPlayer.playing) {
        audioPlayer.pause();
      }

      // Play the new audio
      audioPlayer.replace(audioUrl);
      audioPlayer.play();
      setPlayingAudioId(messageId);

      // Listen for status changes to get duration and handle playback
      // @ts-expect-error - expo-audio event types vary by version
      const statusListener = audioPlayer.addListener('statusChange', (status: any) => {
        // Extract duration if available and not already stored
        if (status.isLoaded && status.duration) {
          const durationSeconds = Math.floor(status.duration / 1000); // Convert ms to seconds
          
          // Only update if we don't have this duration yet
          setAudioDurations(prev => {
            if (!prev[messageId]) {
              console.log(`📊 Audio duration extracted: ${durationSeconds}s for message ${messageId}`);
              
              // Update message metadata with duration
              setMessages(prevMessages =>
                prevMessages.map(msg =>
                  msg.id === messageId && msg.messageType === 'audio'
                    ? {
                        ...msg,
                        metadata: {
                          ...msg.metadata,
                          audioDuration: durationSeconds,
                        },
                      }
                    : msg
                )
              );
              
              return { ...prev, [messageId]: durationSeconds };
            }
            return prev;
          });
        }
        
        // Handle playback completion
        if (status.isLoaded && !status.isPlaying && playingAudioId === messageId) {
          setPlayingAudioId(null);
        }
      });
      
      // Cleanup: remove listener after a delay to allow it to capture duration
      setTimeout(() => {
        try {
          // @ts-expect-error - expo-audio event types vary by version
          audioPlayer.removeListener(statusListener);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000); // Remove listener after 5 seconds (should be enough to get duration)
      
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio message.');
      setPlayingAudioId(null);
    }
  };

  // Handle opening/downloading file
  const handleOpenFile = async (fileUrl: string, fileName: string) => {
    console.log('📄 Opening file:', { fileUrl, fileName });

    // Check if running in Expo Go on iOS (has limitations)
    const isExpoGo = __DEV__ && Platform.OS === 'ios';

    if (isExpoGo) {
      Alert.alert(
        'Limited Support in Expo Go',
        'File downloads have limited support in Expo Go on iOS. The file will open in your browser.',
        [
          {
            text: 'Open in Browser',
            onPress: async () => {
              try {
                await Linking.openURL(fileUrl);
              } catch (error) {
                console.error('Error opening file:', error);
                Alert.alert('Error', 'Failed to open file.');
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    try {
      const supported = await Linking.canOpenURL(fileUrl);

      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert(
          'File Access',
          'Unable to open this file. The file URL may not be accessible.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert(
        'Error',
        'Failed to open file. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle emoji reactions
  const handleReaction = async (messageId: string, emoji: string) => {
    console.log('🎭 Adding reaction:', { messageId, emoji, userId: user?.id });

    try {
      // Optimistically update UI
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          const users = reactions[emoji] || [];

          // Toggle reaction - add if not present, remove if present
          if (users.includes(user?.id || '')) {
            // Remove reaction
            const newUsers = users.filter(id => id !== user?.id);
            if (newUsers.length === 0) {
              delete reactions[emoji];
            } else {
              reactions[emoji] = newUsers;
            }
          } else {
            // Add reaction
            reactions[emoji] = [...users, user?.id || ''];
          }

          return { ...msg, reactions };
        }
        return msg;
      }));

      // Send to backend (we'll create this endpoint)
      await chatAPI.addReaction(messageId, emoji);

      console.log('✅ Reaction added successfully');

      // Close reaction picker
      setSelectedMessageForReaction(null);
    } catch (error) {
      console.error('❌ Error adding reaction:', error);
      Alert.alert('Error', 'Failed to add reaction. Please try again.');
    }
  };

  // Send media message (image, video, file, audio)
  const sendMediaMessage = async (
    messageType: 'image' | 'video' | 'file' | 'audio',
    uri: string,
    fileData: { name: string; size: string; type: string }
  ) => {
    const tempId = `temp-${Date.now()}`;
    try {
      // Create optimistic message with local URI for preview
      const audioDurationSeconds = messageType === 'audio' ? Math.floor(recordingDuration) : undefined;
      const tempMessage: Message = {
        id: tempId,
        conversationId: chatId,
        senderId: user?.id || 'unknown',
        senderName: 'You',
        content: messageType === 'audio' ? `Voice message (${audioDurationSeconds}s)` : '',
        text: messageType === 'audio' ? `🎤 Voice message (${audioDurationSeconds}s)` : '',
        messageType,
        status: 'sending',
        mediaUrl: uri, // Use local URI for immediate display
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileData: messageType === 'file' ? {
          name: fileData.name,
          size: fileData.size,
          type: fileData.type,
          url: uri,
        } : undefined,
        metadata: messageType === 'audio' && audioDurationSeconds ? {
          audioDuration: audioDurationSeconds,
        } : undefined,
      };
      
      // Store duration in local state for quick access
      if (messageType === 'audio' && audioDurationSeconds) {
        setAudioDurations(prev => ({ ...prev, [tempId]: audioDurationSeconds }));
      }

      setMessages(prev => [...prev, tempMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Step 1: Create message first (without mediaUrl)
      const createdMessage = await chatAPI.sendMessage({
        conversationId: chatId,
        messageType,
        content: messageType === 'audio' ? `Voice message (${audioDurationSeconds}s)` : '',
        metadata: messageType === 'audio' && audioDurationSeconds ? {
          audioDuration: audioDurationSeconds,
        } : undefined,
      });

      console.log('✅ Message created with ID:', createdMessage.id);

      // Step 2: Upload file with the message ID
      const uploadResult = await chatAPI.uploadFile(
        {
          uri,
          name: fileData.name,
          type: fileData.type
        },
        createdMessage.id
      );

      console.log('✅ File uploaded:', uploadResult.url);

      // Step 3: Update message with uploaded file URL
      const updatedMessage = await chatAPI.updateMessage(createdMessage.id, {
        mediaUrl: uploadResult.url,
        fileData: messageType === 'file' ? uploadResult.fileData : undefined
      });

      console.log('✅ Message updated with media URL');
      console.log('📦 Updated message data:', updatedMessage);

      // Update optimistic message with real data
      // Convert snake_case from backend to camelCase for frontend
      const finalMessageId = updatedMessage.id;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? {
                id: finalMessageId,
                conversationId: (updatedMessage as any).conversation_id || updatedMessage.conversationId || chatId,
                senderId: (updatedMessage as any).sender_id || updatedMessage.senderId || user?.id || '',
                senderName: 'You',
                content: updatedMessage.content || '',
                text: updatedMessage.content || tempMessage.text,
                messageType: ((updatedMessage as any).message_type || updatedMessage.messageType || messageType) as Message['messageType'],
                status: 'sent' as const,
                mediaUrl: (updatedMessage as any).media_url || updatedMessage.mediaUrl,
                timestamp: new Date((updatedMessage as any).created_at || updatedMessage.createdAt),
                createdAt: (updatedMessage as any).created_at || updatedMessage.createdAt,
                updatedAt: (updatedMessage as any).updated_at || updatedMessage.updatedAt,
                fileData: messageType === 'file' ? uploadResult.fileData : undefined,
                metadata: tempMessage.metadata || (updatedMessage as any).metadata,
              }
            : msg
        )
      );
      
      // Update duration state with final message ID
      if (messageType === 'audio' && audioDurationSeconds) {
        setAudioDurations(prev => {
          const newDurations = { ...prev };
          delete newDurations[tempId]; // Remove temp ID
          newDurations[finalMessageId] = audioDurationSeconds; // Add with final ID
          return newDurations;
        });
      }
    } catch (error) {
      console.error('❌ Error sending media message:', error);
      Alert.alert('Error', `Failed to send ${messageType}. Please try again.`);

      // Remove failed message
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };

  const selectImage = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      // Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await sendMediaMessage('image', asset.uri, {
          name: asset.fileName || 'image.jpg',
          size: (asset.fileSize || 0).toString(),
          type: asset.type || 'image/jpeg',
        });
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    } finally {
      setShowAttachmentModal(false);
    }
  };

  const getHeaderAvatarUrl = () => {
    if (typeof chatAvatar === 'string') return chatAvatar;
    if (chatAvatar && typeof chatAvatar === 'object' && 'uri' in (chatAvatar as any)) {
      return (chatAvatar as any).uri as string;
    }
    return null;
  };

  const handleHeaderAvatarPress = () => {
    if (isAI) return;
    const url = getHeaderAvatarUrl();
    if (!url) return;
    setSelectedImageUrl(url);
    setImageViewerVisible(true);
  };

  const handleHeaderProfilePress = () => {
    if (isAI) return;

    const targetUserId = otherUserId || paramOtherUserId;
    if (!targetUserId) {
      Alert.alert('Profile unavailable', 'This chat does not have a linked user profile.');
      return;
    }

    if (chatType === 'vendor' || chatType === 'rider') {
      (navigation as any).navigate('PublicStore', { userId: targetUserId });
      return;
    }

    (navigation as any).navigate('PublicProfile', { userId: targetUserId });
  };

  const renderHeader = () => (
    <Animated.View style={[
      styles.header, 
      { paddingTop: insets.top + 10 },
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <View style={styles.headerContent}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.chatInfo}>
          <TouchableOpacity
            style={styles.avatarContainer}
            activeOpacity={0.85}
            onPress={handleHeaderAvatarPress}
            disabled={isAI}
          >
            <Image 
              source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar} 
              style={styles.avatar} 
            />
            {isOnline && <View style={styles.onlineIndicator} />}
            <View style={[styles.chatTypeIndicator, { backgroundColor: getChatTypeColor(chatType) }]}>
              <Ionicons name={getChatTypeIcon(chatType) as any} size={8} color="white" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chatDetails}
            activeOpacity={0.85}
            onPress={handleHeaderProfilePress}
            disabled={isAI}
          >
            <View style={styles.nameContainer}>
              <Text style={styles.chatName} numberOfLines={1} ellipsizeMode="tail">{chatName}</Text>
              {verified && (
                <Ionicons name="checkmark-circle" size={16} color="#3498DB" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Last seen recently'}
              {isTyping && ' • typing...'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.headerAction, isInCall && callType === 'audio' && styles.activeCall]}
            onPress={() => startCall('audio')}
          >
            <Ionicons name="call" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerAction, isInCall && callType === 'video' && styles.activeCall]}
            onPress={() => startCall('video')}
          >
            <Ionicons name="videocam" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => {
              const options = ['View Chat Info', 'Clear Chat', 'Block User', 'Report Chat'];

              // Add Create Invoice option for sellers/riders
              if ((userProfile?.isSeller || userProfile?.isRider) && !isAI) {
                options.unshift('Create Invoice');
              }

              options.push('Cancel');

              const alertButtons = options.map((option) => {
                const buttonStyle = option === 'Cancel' ? 'cancel' : option === 'Block User' ? 'destructive' : 'default';
                return {
                  text: option,
                  style: buttonStyle as 'cancel' | 'default' | 'destructive',
                  onPress: () => {
                    if (option === 'Report Chat') {
                      (navigation as any).navigate('CreateContentReport', {
                        chatId: chatId,
                        reportCategory: 'chat'
                      });
                    } else if (option === 'Create Invoice') {
                      handleCreateInvoice();
                    } else if (option === 'Block User') {
                      Alert.alert('Block User', 'Block user feature coming soon');
                    } else if (option !== 'Cancel') {
                      Alert.alert(option, `${option} feature coming soon`);
                    }
                  }
                };
              });
              Alert.alert('Chat Options', 'Choose an option', alertButtons);
            }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // 🔥 FIX: For wishlist messages, also check if current user is the wishlist owner
    const isCurrentUser = item.senderId === user?.id || 
                          (item.messageType === 'wishlist' && item.wishlistData?.ownerId === user?.id);
    
    // Debug log for wishlist message rendering
    if (item.messageType === 'wishlist') {
      console.log('🎨 Rendering wishlist message:', {
        id: item.id,
        senderId: item.senderId,
        'user?.id': user?.id,
        'senderId matches?': item.senderId === user?.id,
        hasWishlistData: !!item.wishlistData,
        ownerId: item.wishlistData?.ownerId,
        'ownerId matches?': item.wishlistData?.ownerId === user?.id,
        isCurrentUser,
        'will show on': isCurrentUser ? 'RIGHT (blue)' : 'LEFT (gray)'
      });
    }
    
    const isFirstInGroup = index === 0 || messages[index - 1]?.senderId !== item.senderId;
    const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.senderId !== item.senderId;

    // Render system messages (like call notifications) differently
    if (item.messageType === 'system') {
      const content = item.text || item.content || '';
      const isCallMessage = content.includes('call') || content.includes('Call');

      // Parse call type and status from message
      let callIcon = 'call-outline';
      let callIconColor = 'rgba(255,255,255,0.6)';
      let callType = 'Voice call';
      let callStatus = '';

      // Determine if it's a video or voice call
      if (content.includes('Video') || content.includes('video')) {
        callIcon = 'videocam-outline';
        callType = 'Video call';
      }

      // Determine call direction and status
      const isOutgoing = isCurrentUser; // Message sender is current user = outgoing call

      if (content.includes('Missed') || content.includes('missed')) {
        callIcon = isOutgoing ? 'call-outline' : 'call-outline';
        callIconColor = '#E74C3C'; // Red for missed calls
        callStatus = 'Missed';
      } else if (content.includes('ended')) {
        // Extract duration from message like "Call ended - Duration: 1m 23s"
        const durationMatch = content.match(/Duration: (.+?)$/);
        const duration = durationMatch ? durationMatch[1] : '';

        callIcon = isOutgoing ? 'call-outline' : 'call-outline';
        callIconColor = '#27AE60'; // Green for completed calls
        callStatus = duration || 'Ended';
      } else if (content.includes('started')) {
        callIcon = isOutgoing ? 'call-outline' : 'call-outline';
        callIconColor = 'rgba(255,255,255,0.6)';
        callStatus = isOutgoing ? 'Outgoing' : 'Incoming';
      } else if (content.includes('declined')) {
        callIcon = isOutgoing ? 'call-outline' : 'call-outline';
        callIconColor = '#E74C3C'; // Red for declined calls
        callStatus = 'Declined';
      }

      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageContent}>
            {isCallMessage ? (
              <>
                <View style={styles.callSystemMessage}>
                  <Ionicons
                    name={callIcon as any}
                    size={16}
                    color={callIconColor}
                  />
                  <Text style={styles.systemMessageText}>
                    {callType} • {callStatus}
                  </Text>
                </View>
                <Text style={styles.systemMessageTime}>{formatTime(item.timestamp)}</Text>
              </>
            ) : (
              <>
                <Text style={styles.systemMessageText}>{content}</Text>
                <Text style={styles.systemMessageTime}>{formatTime(item.timestamp)}</Text>
              </>
            )}
          </View>
        </View>
      );
    }

    // Render invoice messages
    if (item.messageType === 'invoice' && item.invoiceData) {
      return <InvoiceMessageCard invoice={item.invoiceData} isCurrentUser={isCurrentUser} />;
    }

    // Render product messages (bargain) - check metadata for productData
    if (item.productData || item.metadata?.productData) {
      const productInfo = item.productData || item.metadata?.productData;
      return (
        <ProductMessageCard
          product={productInfo}
          isCurrentUser={isCurrentUser}
          messageText={item.text}
        />
      );
    }

    // 🎁 Render wishlist messages
    if (item.messageType === 'wishlist' && (item.wishlistData || item.metadata?.wishlistData)) {
      const wishlistInfo = item.wishlistData || item.metadata?.wishlistData;
      return (
        <WishlistMessageCard
          wishlistData={wishlistInfo}
          isCurrentUser={isCurrentUser}
          onPress={handleWishlistCardPress}
        />
      );
    }

    // 📅 Render IKO schedule card
    if (item.ikoScheduleCard) {
      return (
        <ScheduleMessageCard
          scheduleData={item.ikoScheduleCard}
          isCurrentUser={isCurrentUser}
          messageText={item.text}
          onPress={handleScheduleCardPress}
        />
      );
    }

    // ✨ Render IKO recommendations with product/service cards
    if (item.ikoRecommendations && (item.ikoRecommendations.products?.length || item.ikoRecommendations.services?.length)) {
      return (
        <View style={[
          styles.messageContainer,
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
        ]}>
          {!isCurrentUser && (
            <View style={styles.senderInfo}>
              <Image
                source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                style={styles.messageSenderAvatar}
              />
            </View>
          )}
          
          {/* Text message */}
          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
          ]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
          </View>

          {/* Product cards */}
          {item.ikoRecommendations.products?.map((product) => (
            <ProductMessageCard
              key={product.id}
              product={product}
              isCurrentUser={isCurrentUser}
            />
          ))}

          {/* Service cards */}
          {item.ikoRecommendations.services?.map((service) => (
            <ServiceMessageCard
              key={service.id}
              service={service}
              isCurrentUser={isCurrentUser}
            />
          ))}
        </View>
      );
    }

    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
        isFirstInGroup && styles.firstInGroup,
        isLastInGroup && styles.lastInGroup,
      ]}>
        {!isCurrentUser && isFirstInGroup && (
          <View style={styles.senderInfo}>
            <Image
              source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
              style={styles.messageSenderAvatar}
            />
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => {
            setSelectedMessageForReaction(item.id);
          }}
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
          ]}
        >
          {/* Render different message types */}
          {item.messageType === 'text' && (
            <Text style={[
              styles.messageText,
              isCurrentUser ? styles.currentUserText : styles.otherUserText,
            ]}>
              {item.text}
            </Text>
          )}
          
          {item.messageType === 'image' && item.mediaUrl && (
            <TouchableOpacity onPress={() => handleViewImage(item.mediaUrl!)}>
              <Image
                source={{ uri: item.mediaUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
              {item.text && (
                <Text style={[styles.messageText, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                  {item.text}
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {item.messageType === 'video' && item.mediaUrl && (
            <TouchableOpacity
              style={styles.videoContainer}
              onPress={() => handlePlayVideo(item.mediaUrl!)}
            >
              <View style={styles.videoPlayButton}>
                <Ionicons name="play" size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.videoText}>Video Message</Text>
            </TouchableOpacity>
          )}
          
          {item.messageType === 'audio' && item.mediaUrl && (() => {
            // Get duration from metadata, local state, or content
            const durationFromMetadata = item.metadata?.audioDuration;
            const durationFromState = audioDurations[item.id];
            const duration = durationFromMetadata || durationFromState;
            
            // Extract duration from content if available (fallback for old messages)
            let durationText = '';
            if (duration) {
              durationText = ` ${duration}s`;
            } else if (item.content && item.content.includes('(')) {
              // Try to extract from content like "Voice message (5s)"
              const match = item.content.match(/\((\d+)s\)/);
              if (match) {
                durationText = ` ${match[1]}s`;
              }
            }
            
            return (
              <TouchableOpacity
                style={styles.audioContainer}
                onPress={() => handlePlayAudio(item.mediaUrl!, item.id)}
              >
                <Ionicons
                  name={playingAudioId === item.id ? "pause-circle" : "play-circle"}
                  size={32}
                  color="#FFFFFF"
                />
                <View style={styles.audioInfo}>
                  <View style={styles.audioHeader}>
                    <Text style={[styles.audioText, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                      {item.content?.replace(/\s*\(\d+s\)/, '') || 'Voice Message'}
                    </Text>
                    {durationText ? (
                      <Text style={[styles.audioDuration, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                        {durationText}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.audioWaveform}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.audioWaveBar,
                          { height: Math.random() * 20 + 10 },
                          playingAudioId === item.id && styles.audioWaveBarActive
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}
          
          {item.messageType === 'file' && item.fileData && (
            <DocumentMessageCard
              fileData={{
                name: item.fileData.name,
                size: item.fileData.size,
                type: item.fileData.type,
                url: item.fileData.url || item.mediaUrl,
              }}
              isCurrentUser={isCurrentUser}
              onPress={handleOpenFile}
            />
          )}
          
          {item.messageType === 'livestream' && item.livestreamData && (
            <TouchableOpacity 
              style={styles.livestreamContainer}
              onPress={() => Alert.alert('Live Stream', 'Join live stream')}
            >
              <Image 
                source={{ uri: item.livestreamData.thumbnailUrl }} 
                style={styles.livestreamThumbnail}
              />
              <View style={styles.livestreamOverlay}>
                <View style={styles.liveIndicator}>
                  <Text style={styles.liveText}>🔴 LIVE</Text>
                  <Text style={styles.viewersText}>{item.livestreamData.viewers} viewers</Text>
                </View>
                <Text style={styles.livestreamTitle}>{item.livestreamData.title}</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {item.messageType === 'auction' && item.auctionData && (
            <TouchableOpacity 
              style={styles.auctionContainer}
              onPress={() => Alert.alert('Auction', 'View auction details')}
            >
              <Image 
                source={{ uri: item.auctionData.imageUrl }} 
                style={styles.auctionImage}
              />
              <View style={styles.auctionInfo}>
                <Text style={[styles.auctionTitle, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                  🔨 {item.auctionData.itemName}
                </Text>
                <Text style={[styles.auctionPrice, { color: '#27AE60' }]}>
                  Starting: ${item.auctionData.startingPrice}
                </Text>
                <Text style={[styles.auctionTime, isCurrentUser ? styles.currentUserTime : styles.otherUserTime]}>
                  Ends: {formatTime(item.auctionData.endTime)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isCurrentUser ? styles.currentUserTime : styles.otherUserTime,
            ]}>
              {formatTime(item.timestamp)}
            </Text>
            
            {isCurrentUser && (
              <View style={styles.messageStatus}>
                {item.status === 'sending' && (
                  <Ionicons name="time" size={12} color="rgba(255,255,255,0.6)" />
                )}
                {item.status === 'sent' && (
                  <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.6)" />
                )}
                {item.status === 'delivered' && (
                  <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.6)" />
                )}
                {item.status === 'read' && (
                  <Ionicons name="checkmark-done" size={12} color="#3498DB" />
                )}
              </View>
            )}
          </View>

          {/* Emoji Reactions Display */}
          {item.reactions && Object.keys(item.reactions).length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(item.reactions).map(([emoji, users]: [string, any]) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBubble}
                  onPress={() => {
                    // Toggle reaction
                    handleReaction(item.id, emoji);
                  }}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={styles.reactionCount}>{Array.isArray(users) ? users.length : 1}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessageInput = () => (
    <View
      style={[
        styles.inputContainer,
        { paddingBottom: Math.max(insets.bottom || 0, 12) + 12 },
      ]}
    >
      {/* Product Preview Card for Bargain Mode */}
      {bargainMode && productData && (
        <View style={styles.productPreviewContainer}>
          <View style={styles.productPreviewHeader}>
            <Ionicons name="pricetag" size={16} color="#F39C12" />
            <Text style={styles.productPreviewTitle}>Product for Negotiation</Text>
            <TouchableOpacity onPress={() => {
              // Clear bargain mode after first message
              (navigation as any).setParams({ bargainMode: false, productData: undefined });
            }}>
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <View style={styles.productPreviewContent}>
            {productData.image ? (
              <Image source={{ uri: productData.image }} style={styles.productPreviewImage} />
            ) : (
              <View style={[styles.productPreviewImage, styles.productPreviewImagePlaceholder]}>
                <Ionicons name="image-outline" size={24} color="#888" />
              </View>
            )}
            <View style={styles.productPreviewInfo}>
              <Text style={styles.productPreviewName} numberOfLines={2}>{productData.name}</Text>
              <Text style={styles.productPreviewPrice}>₦{productData.price.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={() => setShowAttachmentModal(true)}
        >
          <Ionicons name="add" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={messageText}
            onChangeText={(text) => {
              setMessageText(text);
              
              // Send typing indicator
              if (realtimeAPI.isConnected()) {
                if (text.length > 0 && !isTyping) {
                  realtimeAPI.sendChatTyping(chatId, true);
                  setIsTyping(true);
                } else if (text.length === 0 && isTyping) {
                  realtimeAPI.sendChatTyping(chatId, false);
                  setIsTyping(false);
                }
              }
            }}
            onFocus={() => {
              // Mark messages as read when user focuses on input (skip for AI)
              if (!isAI && chatType !== 'ai') {
                chatAPI.markConversationAsRead(chatId);
              }
            }}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={styles.emojiButton}
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Ionicons name={showEmojiPicker ? "close" : "happy"} size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Audio Recording or Send Button */}
        {messageText.trim() ? (
          <TouchableOpacity 
            style={[styles.sendButton, styles.sendButtonActive]}
            onPress={sendMessage}
            disabled={isSending}
          >
            {isSending ? (
              <Ionicons name="hourglass" size={20} color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[
              styles.recordButton,
              isRecording ? styles.recordButtonActive : styles.recordButtonInactive
            ]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Ionicons 
              name="mic" 
              size={20} 
              color={isRecording ? "#FF0000" : "#FFFFFF"} 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Recording... {recordingDuration}s
          </Text>
          <Text style={styles.recordingHint}>Release to send</Text>
        </View>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <View style={styles.emojiPickerContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiPickerContent}>
            {['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😭', '😡', '😱', '👍', '👎', '👏', '🙏', '❤️', '🔥', '✨', '🎉', '💯', '🚀'].map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={styles.emojiButton2}
                onPress={() => {
                  setMessageText(prev => prev + emoji);
                }}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  // Render Attachment Modal
  const renderAttachmentModal = () => (
    <Modal
      visible={showAttachmentModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAttachmentModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.attachmentModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Content</Text>
            <TouchableOpacity onPress={() => setShowAttachmentModal(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.attachmentOptions}>
            <TouchableOpacity style={styles.attachmentOption} onPress={handlePhotoShare}>
              <View style={styles.attachmentIconContainer}>
                <Ionicons name="camera" size={24} color="#4CAF50" />
              </View>
              <View style={styles.attachmentTextContainer}>
                <Text style={styles.attachmentTitle}>Photo</Text>
                <Text style={styles.attachmentSubtitle}>Take photo or choose from gallery</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachmentOption} onPress={handleVideoShare}>
              <View style={styles.attachmentIconContainer}>
                <Ionicons name="videocam" size={24} color="#FF9800" />
              </View>
              <View style={styles.attachmentTextContainer}>
                <Text style={styles.attachmentTitle}>Video</Text>
                <Text style={styles.attachmentSubtitle}>Record video or choose from gallery</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachmentOption} onPress={handleDocumentShare}>
              <View style={styles.attachmentIconContainer}>
                <Ionicons name="document" size={24} color="#3498DB" />
              </View>
              <View style={styles.attachmentTextContainer}>
                <Text style={styles.attachmentTitle}>Document</Text>
                <Text style={styles.attachmentSubtitle}>Share files and documents</Text>
              </View>
            </TouchableOpacity>

            {!isAI && (
              <TouchableOpacity style={styles.attachmentOption} onPress={handleShareWishlist}>
                <View style={styles.attachmentIconContainer}>
                  <Ionicons name="heart" size={24} color="#E91E63" />
                </View>
                <View style={styles.attachmentTextContainer}>
                  <Text style={styles.attachmentTitle}>Wishlist</Text>
                  <Text style={styles.attachmentSubtitle}>Share your wishlist with this person</Text>
                </View>
              </TouchableOpacity>
            )}

            {(userProfile?.isSeller || userProfile?.isRider) && !isAI && (
              <TouchableOpacity style={styles.attachmentOption} onPress={handleCreateInvoice}>
                <View style={styles.attachmentIconContainer}>
                  <Ionicons name="receipt" size={24} color="#F39C12" />
                </View>
                <View style={styles.attachmentTextContainer}>
                  <Text style={styles.attachmentTitle}>Invoice</Text>
                  <Text style={styles.attachmentSubtitle}>Create and send an invoice</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.attachmentOption} onPress={startLiveStream}>
              <View style={styles.attachmentIconContainer}>
                <Ionicons name="radio" size={24} color="#E74C3C" />
              </View>
              <View style={styles.attachmentTextContainer}>
                <Text style={styles.attachmentTitle}>Live Stream</Text>
                <Text style={styles.attachmentSubtitle}>Start broadcasting live</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachmentOption} onPress={startAuction}>
              <View style={styles.attachmentIconContainer}>
                <Ionicons name="hammer" size={24} color="#9C27B0" />
              </View>
              <View style={styles.attachmentTextContainer}>
                <Text style={styles.attachmentTitle}>Auction</Text>
                <Text style={styles.attachmentSubtitle}>Create an auction for item</Text>
              </View>
            </TouchableOpacity>
            
            {isAI && (
              <>
                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={() => {
                    Alert.alert('AI Research', 'Iko will research this topic for you');
                    setShowAttachmentModal(false);
                  }}
                >
                  <View style={styles.attachmentIconContainer}>
                    <Ionicons name="search" size={24} color="#E91E63" />
                  </View>
                  <View style={styles.attachmentTextContainer}>
                    <Text style={styles.attachmentTitle}>AI Research</Text>
                    <Text style={styles.attachmentSubtitle}>Let Iko research any topic</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={() => {
                    Alert.alert('Plan Activity', 'Iko will help you plan activities');
                    setShowAttachmentModal(false);
                  }}
                >
                  <View style={styles.attachmentIconContainer}>
                    <Ionicons name="calendar" size={24} color="#27AE60" />
                  </View>
                  <View style={styles.attachmentTextContainer}>
                    <Text style={styles.attachmentTitle}>Plan Activity</Text>
                    <Text style={styles.attachmentSubtitle}>Schedule and organize with Iko</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={() => {
                    Alert.alert('Find Products', 'Iko will help you find the best products');
                    setShowAttachmentModal(false);
                  }}
                >
                  <View style={styles.attachmentIconContainer}>
                    <Ionicons name="bag" size={24} color="#FF6B35" />
                  </View>
                  <View style={styles.attachmentTextContainer}>
                    <Text style={styles.attachmentTitle}>Find Products</Text>
                    <Text style={styles.attachmentSubtitle}>Search and compare products</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={() => {
                    Alert.alert('Book Service', 'Iko will help you book services');
                    setShowAttachmentModal(false);
                  }}
                >
                  <View style={styles.attachmentIconContainer}>
                    <Ionicons name="person" size={24} color="#3498DB" />
                  </View>
                  <View style={styles.attachmentTextContainer}>
                    <Text style={styles.attachmentTitle}>Book Service</Text>
                    <Text style={styles.attachmentSubtitle}>Find and book service providers</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={() => {
                    Alert.alert('Budget Help', 'Iko will help you manage your budget');
                    setShowAttachmentModal(false);
                  }}
                >
                  <View style={styles.attachmentIconContainer}>
                    <Ionicons name="wallet" size={24} color="#F39C12" />
                  </View>
                  <View style={styles.attachmentTextContainer}>
                    <Text style={styles.attachmentTitle}>Budget Help</Text>
                    <Text style={styles.attachmentSubtitle}>Set budgets and track spending</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentOption}
                  onPress={() => {
                    Alert.alert('Generate Image', 'Iko will create images for you');
                    setShowAttachmentModal(false);
                  }}
                >
                  <View style={styles.attachmentIconContainer}>
                    <Ionicons name="image" size={24} color="#9B59B6" />
                  </View>
                  <View style={styles.attachmentTextContainer}>
                    <Text style={styles.attachmentTitle}>Generate Image</Text>
                    <Text style={styles.attachmentSubtitle}>Create AI-generated images</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Get dynamic status text
  const getCallStatusText = () => {
    if (isAICall) {
      if (callStatus === 'connecting') {
        return 'Connecting...';
      } else if (callStatus === 'connected') {
        if (isConnectedToGemini) {
          if (isReconnecting) {
            return '🔄 Reconnecting for continuous chat...';
          }
          return streamInterval ? '🎙️ Natural conversation active' : '✨ Ready to chat naturally';
        }
        return 'Connecting to Iko...';
      }
      return 'Calling...';
    } else {
      // Regular calls
      if (callStatus === 'connecting') {
        return 'Connecting...';
      } else if (callStatus === 'ringing') {
        return 'Ringing...';
      } else if (callStatus === 'connected') {
        return 'Connected';
      } else if (callStatus === 'ending') {
        return 'Ending call...';
      }
      return callType === 'video' ? 'Video calling...' : 'Calling...';
    }
  };

  // Render Call Modal
  const renderCallModal = () => {
    // Don't show if already in call (prevent modal conflicts)
    if (!showCallModal || isInCall) return null;

    const ripple1Scale = rippleAnim1.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.4],
    });
    const ripple1Opacity = rippleAnim1.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.6, 0.3, 0],
    });
    const ripple2Scale = rippleAnim2.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.4],
    });
    const ripple2Opacity = rippleAnim2.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.5, 0.25, 0],
    });
    const ripple3Scale = rippleAnim3.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.4],
    });
    const ripple3Opacity = rippleAnim3.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.4, 0.2, 0],
    });

    return (
      <Modal
        visible={showCallModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => endCall('cancelled')}
      >
        <LinearGradient
          colors={['#0A0E27', '#1A1F3A', '#2D1B4E']}
          style={StyleSheet.absoluteFillObject}
        >
          {/* Camera Preview Background for Video Calls */}
          {callType === 'video' && showCameraPreview && (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing={cameraType}
              onCameraReady={onCameraReady}
            />
          )}

          <BlurView intensity={20} style={styles.modernCallContainer}>
            {/* Header */}
            <View style={styles.modernCallHeader}>
              <TouchableOpacity
                style={styles.modernBackButton}
                onPress={() => endCall('cancelled')}
              >
                <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modernCallTitle}>
                {isAICall ? 'Voice call' : callType === 'video' ? 'Video call' : 'Voice call'}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Main Content */}
            <View style={styles.modernCallContent}>
              {/* Avatar Container with Ripples */}
              <View style={styles.modernAvatarContainer}>
                <View style={styles.modernAvatarWrapper}>
                  <Image
                    source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                    style={styles.modernCallAvatar}
                  />
                  
                  {/* Animated Ripples */}
                  {callStatus === 'connected' && (
                    <>
                      <Animated.View
                        style={[
                          styles.modernRipple,
                          {
                            transform: [{ scale: ripple1Scale }],
                            opacity: ripple1Opacity,
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.modernRipple,
                          {
                            transform: [{ scale: ripple2Scale }],
                            opacity: ripple2Opacity,
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.modernRipple,
                          {
                            transform: [{ scale: ripple3Scale }],
                            opacity: ripple3Opacity,
                          },
                        ]}
                      />
                    </>
                  )}
                  
                  {/* Pulsing dot for connecting */}
                  {callStatus === 'connecting' && (
                    <View style={styles.connectingDot}>
                      <View style={styles.connectingPulse} />
                    </View>
                  )}
                </View>
              </View>

              {/* Name */}
              <Text style={styles.modernCallName}>{chatName}</Text>

              {/* Dynamic Status Text */}
              <Animated.View style={{ opacity: statusFadeAnim }}>
                <Text style={styles.modernCallStatus}>{getCallStatusText()}</Text>
              </Animated.View>

              {/* Call Duration - only show when actually connected (both users joined) */}
              {callStatus === 'connected' && callStartTime && (
                <View style={styles.modernCallDurationContainer}>
                  <Text style={styles.modernCallDuration}>
                    {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
                    {(callDuration % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}

              {/* AI-specific indicators */}
              {isAICall && callStatus === 'connected' && isConnectedToGemini && (
                <View style={styles.modernAIIndicator}>
                  <Text style={styles.modernAIText}>
                    💬 Just start speaking - no need to tap
                  </Text>
                  <Text style={styles.modernAISubtext}>
                    Powered by Gemini 2.5 Flash
                  </Text>
                </View>
              )}
            </View>

            {/* Call Controls */}
            <View style={styles.modernCallControls}>
              {callStatus === 'connected' && (
                <>
                  {/* Mute Button */}
                  <TouchableOpacity
                    style={[
                      styles.modernControlButton,
                      isMuted && styles.modernControlButtonActive,
                    ]}
                    onPress={toggleMute}
                  >
                    <Ionicons
                      name={isMuted ? "mic-off" : "mic"}
                      size={22}
                      color={isMuted ? "#FF3B30" : "#FFFFFF"}
                    />
                  </TouchableOpacity>

                  {/* Speaker Button */}
                  <TouchableOpacity
                    style={[
                      styles.modernControlButton,
                      isSpeakerOn && styles.modernControlButtonActive,
                    ]}
                    onPress={toggleSpeaker}
                  >
                    <Ionicons
                      name={isSpeakerOn ? "volume-high" : "volume-medium"}
                      size={22}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  {/* Video Toggle (for video calls) */}
                  {callType === 'video' && (
                    <TouchableOpacity
                      style={[
                        styles.modernControlButton,
                        !isVideoEnabled && styles.modernControlButtonActive,
                      ]}
                      onPress={toggleVideo}
                    >
                      <Ionicons
                        name={isVideoEnabled ? "videocam" : "videocam-off"}
                        size={22}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                  )}

                  {/* AI Conversation Indicator */}
                  {isAICall && (
                    <View style={[styles.modernControlButton, styles.modernAIControlButton]}>
                      {streamInterval ? (
                        <>
                          <Ionicons name="radio" size={22} color="#00D4AA" />
                          <View style={styles.modernPulseIndicator} />
                        </>
                      ) : (
                        <Ionicons name="mic" size={22} color="#FFFFFF" />
                      )}
                    </View>
                  )}
                </>
              )}

              {/* End Call Button */}
              <TouchableOpacity
                style={styles.modernEndCallButton}
                onPress={() => endCall('completed')}
              >
                <LinearGradient
                  colors={['#FF3B30', '#FF1744']}
                  style={styles.modernEndCallGradient}
                >
                  <Ionicons name="call" size={26} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </LinearGradient>
      </Modal>
    );
  };

  // Handle tap on video call screen to toggle overlay
  // Tapping empty areas (not videos) shows/hides overlay - NO AUTO-HIDE
  const handleVideoCallTap = () => {
    // Toggle overlay visibility - user controls it manually
    setShowCallOverlay(!showCallOverlay);
    
    // Clear any existing timeout (shouldn't be any, but just in case)
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
  };

  // Keep overlay visible when call starts - NO AUTO-HIDE
  useEffect(() => {
    if (isInCall && callStatus === 'connected') {
      // Always show overlay - user can manually toggle if needed
      setShowCallOverlay(true);
    }
    return () => {
      // Cleanup any timeouts (shouldn't be any, but cleanup anyway)
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }
    };
  }, [isInCall, callStatus]);

  // Render In-Call Overlay
  const renderInCallOverlay = () => (
    <Modal
      visible={isInCall}
      transparent={true}
      animationType="none"
      onRequestClose={() => endCall()}
    >
      <TouchableOpacity
        style={styles.inCallOverlay}
        activeOpacity={1}
        onPress={callType === 'video' && showVideoUI ? handleVideoCallTap : undefined}
      >
        {/* Gift Animations - Render above video */}
        {activeGiftAnimations.length > 0 && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'none' }}>
            {activeGiftAnimations.map((animation) => {
              console.log('🎁 Rendering GiftAnimation:', animation.id, animation.emoji);
              return (
                <GiftAnimation
                  key={animation.id}
                  emoji={animation.emoji}
                  quantity={animation.quantity}
                  onComplete={() => {
                    // Animation completed - remove from active animations
                    console.log('🎁 GiftAnimation onComplete called for:', animation.id);
                    setActiveGiftAnimations(prev => prev.filter(anim => anim.id !== animation.id));
                  }}
                />
              );
            })}
          </View>
        )}

        {/* Full Screen Primary Video - Remote (Default) or Local (When Swapped) */}
        {/* Always show video UI when in video call - keep containers visible */}
        {callType === 'video' && showVideoUI && (
          <TouchableOpacity
            style={styles.remoteVideoContainer}
            activeOpacity={1}
            onPress={(e) => {
              e.stopPropagation(); // Prevent parent overlay toggle
              swapVideoViews(); // Swap videos
            }}
          >
            {!isLocalVideoPrimary ? (
              // Remote video full screen (default), but show local video if no remote video yet
              <>
                {remoteUid !== null && remoteVideoEnabled ? (
                  // Remote video is available - show it full screen
                  <RtcSurfaceView
                    style={StyleSheet.absoluteFillObject}
                    zOrderMediaOverlay={true}
                    canvas={{
                      uid: remoteUid,
                      renderMode: RenderModeType.RenderModeFit,
                    }}
                  />
                ) : (
                  // No remote video yet - show local video full screen so caller sees themselves
                  <>
                    {isVideoEnabled && agoraConfig ? (
                      <RtcSurfaceView
                        style={StyleSheet.absoluteFillObject}
                        zOrderMediaOverlay={true}
                        canvas={{
                          uid: 0, // Local video uses UID 0
                          renderMode: RenderModeType.RenderModeFit,
                        }}
                      />
                    ) : null}
                    <View style={styles.remoteVideoPlaceholder}>
                      <Image
                        source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                        style={styles.remoteVideoAvatar}
                      />
                      <Text style={styles.remoteVideoText}>
                        {remoteVideoEnabled === false 
                          ? `${chatName}'s camera is off`
                          : `Waiting for ${chatName}'s video...`}
                      </Text>
                    </View>
                  </>
                )}
                {/* Remote status indicators */}
                <View style={styles.remoteStatusIndicators}>
                  {remoteMuted && (
                    <View style={styles.remoteStatusIndicator}>
                      <Ionicons name="mic-off" size={16} color="#FFFFFF" />
                      <Text style={styles.remoteStatusText}>Muted</Text>
                    </View>
                  )}
                  {remoteVideoEnabled === false && (
                    <View style={styles.remoteStatusIndicator}>
                      <Ionicons name="videocam-off" size={16} color="#FFFFFF" />
                      <Text style={styles.remoteStatusText}>Camera Off</Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              // Local video full screen (when swapped)
              <>
                {isVideoEnabled && agoraConfig ? (
                  <RtcSurfaceView
                    style={StyleSheet.absoluteFillObject}
                    zOrderMediaOverlay={true}
                    canvas={{
                      uid: 0, // Local video always uses UID 0 in Agora
                      renderMode: RenderModeType.RenderModeFit,
                    }}
                  />
                ) : (
                  <View style={StyleSheet.absoluteFillObject}>
                    <View style={styles.localVideoPlaceholder}>
                      <Ionicons name="videocam-off" size={24} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.localVideoPlaceholderText}>Your Camera Off</Text>
                    </View>
                  </View>
                )}
                {isMuted && (
                  <View style={styles.remoteMutedIndicator}>
                    <Ionicons name="mic-off" size={16} color="#FFFFFF" />
                    <Text style={styles.remoteMutedText}>You're Muted</Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Picture-in-Picture Secondary Video - Local (Default) or Remote (When Swapped) */}
        {/* Always show PIP video when in video call - keep containers visible */}
        {callType === 'video' && showVideoUI && (
          <TouchableOpacity
            style={styles.localVideoContainer}
            onPress={(e) => {
              e.stopPropagation(); // Prevent parent overlay toggle
              swapVideoViews(); // Swap videos
            }}
            activeOpacity={0.8}
          >
            {!isLocalVideoPrimary ? (
              // Local video in picture-in-picture (default)
              // Only show in PIP if remote video is available (otherwise it's shown full screen above)
              <>
                {remoteUid !== null && remoteVideoEnabled && isVideoEnabled && agoraConfig ? (
                  <RtcSurfaceView
                    style={StyleSheet.absoluteFillObject}
                    zOrderMediaOverlay={true}
                    canvas={{
                      uid: 0, // Local video always uses UID 0 in Agora
                      renderMode: RenderModeType.RenderModeFit,
                    }}
                  />
                ) : !isVideoEnabled || !agoraConfig ? (
                  <View style={StyleSheet.absoluteFillObject}>
                    <View style={styles.localVideoPlaceholder}>
                      <Ionicons name="videocam-off" size={24} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.localVideoPlaceholderText}>Camera Off</Text>
                    </View>
                  </View>
                ) : null}
                {showCallOverlay && (
                  <TouchableOpacity
                    style={styles.localVideoToggle}
                    onPress={(e) => {
                      e.stopPropagation();
                      switchCamera();
                    }}
                  >
                    <Ionicons name="camera-reverse" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              // Remote video in picture-in-picture (when swapped)
              remoteUid !== null && remoteVideoEnabled ? (
                <>
                  <RtcSurfaceView
                    style={StyleSheet.absoluteFillObject}
                    zOrderMediaOverlay={true}
                    canvas={{
                      uid: remoteUid,
                      renderMode: RenderModeType.RenderModeFit,
                    }}
                  />
                  {/* Status indicators in PIP */}
                  {(remoteMuted || !remoteVideoEnabled) && (
                    <View style={styles.pipStatusIndicators}>
                      {remoteMuted && (
                        <View style={styles.pipStatusIndicator}>
                          <Ionicons name="mic-off" size={12} color="#FFFFFF" />
                        </View>
                      )}
                      {!remoteVideoEnabled && (
                        <View style={styles.pipStatusIndicator}>
                          <Ionicons name="videocam-off" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.localVideoView}>
                  <Image
                    source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                    style={[styles.remoteVideoAvatar, { width: 60, height: 60, borderRadius: 30 }]}
                  />
                  {/* Status indicators in placeholder */}
                  {(remoteMuted || remoteVideoEnabled === false) && (
                    <View style={styles.pipStatusIndicators}>
                      {remoteMuted && (
                        <View style={styles.pipStatusIndicator}>
                          <Ionicons name="mic-off" size={12} color="#FFFFFF" />
                        </View>
                      )}
                      {remoteVideoEnabled === false && (
                        <View style={styles.pipStatusIndicator}>
                          <Ionicons name="videocam-off" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )
            )}
          </TouchableOpacity>
        )}

        {/* Full Screen Local Video for Calling Phase - REMOVED: This was causing the local video to disappear when connected */}
        {/* Local video is now handled in the primary/secondary video views above to keep it always visible */}

        {/* Redesigned Floating Call Header - Only show when showCallOverlay is true */}
        {showCallOverlay && (
          <View style={[
            styles.inCallHeader,
            callType === 'video' && showVideoUI && styles.videoCallHeader
          ]}>
            {/* Back Button - Top Left */}
            <TouchableOpacity
              style={styles.callHeaderBackButton}
              onPress={(e) => {
                e.stopPropagation(); // Prevent parent overlay toggle
                endCall('completed');
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Name and Duration - Center */}
            <View style={styles.callHeaderCenter}>
              <Text style={[
                styles.inCallName,
                callType === 'video' && showVideoUI && styles.videoCallText
              ]}>
                {chatName}
              </Text>
              <Text style={[
                styles.inCallDuration,
                callType === 'video' && showVideoUI && styles.videoCallText
              ]}>
                {formatCallDuration(callDuration)}
              </Text>
            </View>

            {/* Flip Camera Button - Top Right (Video calls only) */}
            {callType === 'video' && showVideoUI && (
              <TouchableOpacity
                style={styles.callHeaderFlipButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent parent overlay toggle
                  switchCamera();
                }}
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {/* Spacer for audio calls (no flip button) */}
            {callType === 'audio' && <View style={styles.callHeaderFlipButton} />}
          </View>
        )}
        
        {/* Call Controls - Only show when showCallOverlay is true */}
        {showCallOverlay && (
          <View style={styles.inCallControls}>
            <TouchableOpacity 
              style={[styles.callControlButton, isMuted && styles.callControlButtonActive]}
              onPress={(e) => {
                e.stopPropagation(); // Prevent parent overlay toggle
                toggleMute();
              }}
            >
              <Ionicons 
                name={isMuted ? "mic-off" : "mic"} 
                size={24} 
                color={isMuted ? "#E74C3C" : "#FFFFFF"} 
              />
            </TouchableOpacity>
            
            {/* Speaker Button - Only show for audio calls */}
            {callType === 'audio' && (
              <TouchableOpacity
                style={[styles.callControlButton, isSpeakerOn && styles.callControlButtonActive]}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent parent overlay toggle
                  toggleSpeaker();
                }}
              >
                <Ionicons
                  name={isSpeakerOn ? "volume-high" : "volume-medium"}
                  size={24}
                  color={isSpeakerOn ? "#3498DB" : "#FFFFFF"}
                />
              </TouchableOpacity>
            )}

            {callType === 'video' && (
              <TouchableOpacity
                style={[styles.callControlButton, !isVideoEnabled && styles.callControlButtonActive]}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent parent overlay toggle
                  toggleVideo();
                }}
              >
                <Ionicons
                  name={isVideoEnabled ? "videocam" : "videocam-off"}
                  size={24}
                  color={!isVideoEnabled ? "#E74C3C" : "#FFFFFF"}
                />
              </TouchableOpacity>
            )}

            {/* AI Talk Button - Simple Live Streaming */}
            {isAICall && (
              <TouchableOpacity
                style={[styles.callControlButton, isConnectedToGemini && styles.callControlButtonActive]}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent parent overlay toggle
                  startLiveAudioStreaming();
                }}
                disabled={!isConnectedToGemini}
              >
                <Ionicons
                  name={isConnectedToGemini ? "mic" : "mic-outline"}
                  size={24}
                  color={isConnectedToGemini ? "#2ECC71" : "#95a5a6"}
                />
              </TouchableOpacity>
            )}

            {/* Gift Button - Only show when call is connected */}
            {callStatus === 'connected' && !isAICall && (
              <TouchableOpacity
                style={styles.callControlButton}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent parent overlay toggle
                  setShowGiftModal(!showGiftModal);
                  if (!showGiftModal) {
                    loadAvailableGifts();
                  }
                }}
              >
                <Ionicons name="gift" size={24} color="#FFD700" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.callControlButton, styles.endCallButton]}
              onPress={(e) => {
                e.stopPropagation(); // Prevent parent overlay toggle
                endCall('completed');
              }}
            >
              <Ionicons name="call" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  );

  // Camera utility functions
  const toggleCamera = () => {
    setCameraType(current => current === 'front' ? 'back' : 'front');
  };

  const onCameraReady = () => {
    setIsCameraReady(true);
    console.log('📹 Camera is ready for video call');
  };

  // Video view swap functionality (WhatsApp-style)
  const swapVideoViews = () => {
    console.log('🔄 Swapping video views');
    setIsLocalVideoPrimary(!isLocalVideoPrimary);
  };

  // Render incoming call modal
  const renderIncomingCallModal = () => {
    if (!incomingCall) return null;

    const ripple1Scale = incomingRipple1.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.3],
    });
    const ripple1Opacity = incomingRipple1.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.6, 0.3, 0],
    });
    const ripple2Scale = incomingRipple2.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.3],
    });
    const ripple2Opacity = incomingRipple2.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.5, 0.25, 0],
    });
    const ripple3Scale = incomingRipple3.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.3],
    });
    const ripple3Opacity = incomingRipple3.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.4, 0.2, 0],
    });

    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="fade"
      >
        <LinearGradient
          colors={['#0A0E27', '#1A1F3A', '#2D1B4E']}
          style={StyleSheet.absoluteFillObject}
        >
          <BlurView intensity={30} style={styles.modernIncomingCallContainer}>
            {/* Caller Info */}
            <View style={styles.modernIncomingCallContent}>
              <View style={styles.modernIncomingAvatarContainer}>
                <View style={styles.modernIncomingAvatarWrapper}>
                  <Image
                    source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                    style={styles.modernIncomingCallAvatar}
                  />
                  
                  {/* Animated Ripples */}
                  <Animated.View
                    style={[
                      styles.modernIncomingRipple,
                      {
                        transform: [{ scale: ripple1Scale }],
                        opacity: ripple1Opacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.modernIncomingRipple,
                      {
                        transform: [{ scale: ripple2Scale }],
                        opacity: ripple2Opacity,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.modernIncomingRipple,
                      {
                        transform: [{ scale: ripple3Scale }],
                        opacity: ripple3Opacity,
                      },
                    ]}
                  />
                </View>
              </View>

              <Text style={styles.modernIncomingCallName}>{incomingCall.callerName}</Text>
              <Text style={styles.modernIncomingCallType}>
                {incomingCall.callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
              </Text>
              <View style={styles.modernIncomingCallStatusContainer}>
                <View style={styles.modernIncomingCallPulse} />
                <Text style={styles.modernIncomingCallStatus}>Incoming call...</Text>
              </View>
            </View>

            {/* Call Actions */}
            <View style={styles.modernIncomingCallActions}>
              {/* Decline Button */}
              <TouchableOpacity
                style={styles.modernIncomingDeclineButton}
                onPress={declineCall}
              >
                <LinearGradient
                  colors={['#FF3B30', '#FF1744']}
                  style={styles.modernIncomingButtonGradient}
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.modernIncomingButtonText}>Decline</Text>
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity
                style={styles.modernIncomingAcceptButton}
                onPress={acceptCall}
              >
                <LinearGradient
                  colors={['#34C759', '#30D158']}
                  style={styles.modernIncomingButtonGradient}
                >
                  <Ionicons name="call" size={28} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.modernIncomingButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </LinearGradient>
      </Modal>
    );
  };

  // Render image viewer modal
  const renderImageViewer = () => (
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
          <Ionicons name="close" size={32} color="#FFFFFF" />
        </TouchableOpacity>

        {selectedImageUrl && (
          <Image
            source={{ uri: selectedImageUrl }}
            style={styles.imageViewerImage}
            resizeMode="contain"
          />
        )}

        <View style={styles.imageViewerActions}>
          <TouchableOpacity
            style={styles.imageViewerActionButton}
            onPress={async () => {
              if (selectedImageUrl) {
                try {
                  await Linking.openURL(selectedImageUrl);
                } catch (error) {
                  console.error('Error opening image:', error);
                }
              }
            }}
          >
            <Ionicons name="download" size={24} color="#FFFFFF" />
            <Text style={styles.imageViewerActionText}>Download</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Render video player modal
  const renderVideoPlayer = () => (
    <Modal
      visible={videoPlayerVisible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => {
        setVideoPlayerVisible(false);
        setSelectedVideoUrl(null);
      }}
    >
      <View style={styles.videoPlayerContainer}>
        <View style={styles.videoPlayerHeader}>
          <TouchableOpacity
            style={styles.videoPlayerCloseButton}
            onPress={() => {
              setVideoPlayerVisible(false);
              setSelectedVideoUrl(null);
            }}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.videoPlayerTitle}>Video</Text>
        </View>

        {selectedVideoUrl && (
          <View style={styles.videoPlayerContent}>
            <VideoView
              style={styles.videoPlayer}
              player={videoPlayer}
              nativeControls
            />
          </View>
        )}
      </View>
    </Modal>
  );

  // Render emoji reaction picker modal
  const renderReactionPicker = () => (
    <Modal
      visible={selectedMessageForReaction !== null}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setSelectedMessageForReaction(null)}
    >
      <TouchableOpacity
        style={styles.reactionPickerOverlay}
        activeOpacity={1}
        onPress={() => setSelectedMessageForReaction(null)}
      >
        <View style={styles.reactionPickerModal}>
          <Text style={styles.reactionPickerTitle}>React with emoji</Text>
          <View style={styles.reactionPickerGrid}>
            {['❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🙏', '🎉', '🔥'].map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={styles.reactionPickerButton}
                onPress={() => selectedMessageForReaction && handleReaction(selectedMessageForReaction, emoji)}
              >
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {renderHeader()}

      <View style={styles.messagesContainer}>
        {messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyStateTitle}>Start the conversation</Text>
            <Text style={styles.emptyStateSubtitle}>Say hello to {chatName}!</Text>
          </View>
        )}
      </View>

      {renderMessageInput()}
      {renderAttachmentModal()}
      {renderCallModal()}
      {renderInCallOverlay()}
      {renderIncomingCallModal()}
      {renderImageViewer()}
      {renderVideoPlayer()}
      
      {/* Gift Modal for Calls */}
      <Modal
        visible={showGiftModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGiftModal(false)}
      >
        <View style={styles.giftModalOverlay}>
          <View style={styles.giftModalContainer}>
            <View style={styles.giftModalHeader}>
              <Text style={styles.giftModalTitle}>Send Gift</Text>
              <TouchableOpacity
                onPress={() => setShowGiftModal(false)}
                style={styles.giftModalCloseButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.giftModalContent}>
              {loadingGifts ? (
                <View style={styles.giftModalLoading}>
                  <Text style={styles.giftModalLoadingText}>Loading gifts...</Text>
                </View>
              ) : (
                <FlatList
                  data={availableGifts}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.giftModalItem}
                      onPress={() => {
                        handleSendGift(item.id, 1);
                        setShowGiftModal(false);
                      }}
                    >
                      <Text style={styles.giftModalEmoji}>{item.emoji}</Text>
                      <Text style={styles.giftModalName}>{item.name}</Text>
                      <Text style={styles.giftModalQuantity}>x{item.quantity}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.giftModalGrid}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.giftModalEmpty}>
                      <Text style={styles.giftModalEmptyText}>You don't have any gifts to send</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
      {renderReactionPicker()}

      {/* Wishlist Share Modal */}
      <WishlistShareModal
        visible={showWishlistShareModal}
        recipientId={otherUserId || ''}
        recipientName={chatName || 'User'}
        onClose={() => setShowWishlistShareModal(false)}
        onShareSuccess={handleWishlistShareSuccess}
      />

      {/* Schedule Modal */}
      {selectedScheduleData && (
        <ScheduleModal
          visible={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedScheduleData(null);
          }}
          scheduleType={selectedScheduleData.type}
          title={selectedScheduleData.title}
          suggestedDate={selectedScheduleData.suggestedDate}
          onSchedule={handleScheduleActivity}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#27AE60',
    borderWidth: 2,
    borderColor: '#000000',
  },
  chatTypeIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  chatDetails: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageContainer: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  firstInGroup: {
    marginTop: 8,
  },
  lastInGroup: {
    marginBottom: 16,
  },
  senderInfo: {
    width: 32,
    alignItems: 'center',
    marginRight: 8,
  },
  messageSenderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  currentUserBubble: {
    backgroundColor: '#051094', // Admiral Blue for outgoing messages
    marginRight: 8, // Small margin from right edge
  },
  otherUserBubble: {
    backgroundColor: '#59788E', // Stone for incoming messages
    marginLeft: 8, // Aligned to left with avatar
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  currentUserText: {
    color: '#FFFFFF',
  },
  otherUserText: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  currentUserTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  otherUserTime: {
    color: 'rgba(255,255,255,0.6)',
  },
  messageStatus: {
    marginLeft: 4,
  },
  // System message styles
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callSystemMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  systemMessageText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  systemMessageTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 80,
    marginRight: 8,
  },
  emojiButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#051094', // Admiral Blue for send button
  },
  sendButtonInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  recordButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#FF0000',
  },
  recordButtonInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF0000',
    marginRight: 8,
  },
  recordingText: {
    color: '#FF0000',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  recordingHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  emojiPickerContainer: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
  },
  emojiPickerContent: {
    paddingHorizontal: 10,
    gap: 5,
  },
  emojiButton2: {
    padding: 8,
    marginHorizontal: 4,
  },
  emojiText: {
    fontSize: 28,
  },
  activeCall: {
    backgroundColor: '#27AE60',
  },
  // Message type styles
  messageImage: {
    width: screenWidth * 0.6,
    height: screenWidth * 0.6,
    borderRadius: 12,
    marginBottom: 4,
  },
  videoContainer: {
    width: screenWidth * 0.6,
    height: screenWidth * 0.4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  videoPlayButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  videoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    minWidth: 200,
  },
  audioInfo: {
    flex: 1,
    gap: 4,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  audioDuration: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.8,
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  audioWaveBar: {
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
  audioWaveBarActive: {
    backgroundColor: '#FFFFFF',
  },
  livestreamContainer: {
    width: screenWidth * 0.65,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  livestreamThumbnail: {
    width: '100%',
    height: screenWidth * 0.4,
  },
  livestreamOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
    padding: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#FF0000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewersText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  livestreamTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  auctionContainer: {
    width: screenWidth * 0.65,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  auctionImage: {
    width: '100%',
    height: screenWidth * 0.4,
  },
  auctionInfo: {
    padding: 12,
  },
  auctionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  auctionPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  auctionTime: {
    fontSize: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  attachmentModal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  attachmentOptions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  attachmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  attachmentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  attachmentTextContainer: {
    flex: 1,
  },
  attachmentTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  attachmentSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  // Call modal styles
  callModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modern Call UI Styles
  modernCallContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 60,
  },
  modernCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 20,
  },
  modernBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernCallTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modernCallContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  modernAvatarContainer: {
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernAvatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCallAvatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modernRipple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  connectingDot: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
  connectingPulse: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759',
    opacity: 0.6,
  },
  modernCallName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  modernCallStatus: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 20,
  },
  modernCallDurationContainer: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modernCallDuration: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 1,
  },
  modernAIIndicator: {
    marginTop: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.3)',
    alignItems: 'center',
  },
  modernAIText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  modernAISubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  modernCallControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    gap: 20,
  },
  modernControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modernControlButtonActive: {
    backgroundColor: 'rgba(255,59,48,0.3)',
    borderColor: 'rgba(255,59,48,0.5)',
  },
  modernAIControlButton: {
    position: 'relative',
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
    borderColor: 'rgba(0, 212, 170, 0.4)',
  },
  modernPulseIndicator: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 212, 170, 0.3)',
    opacity: 0.8,
  },
  modernEndCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  modernEndCallGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callModal: {
    alignItems: 'center',
    padding: 40,
  },
  callAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  callName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  callStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 40,
  },
  callActions: {
    flexDirection: 'row',
    gap: 20,
  },
  callButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#E74C3C',
  },
  // In-call overlay styles
  inCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
  },
  // Audio call UI styles
  audioCallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  audioCallAvatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  audioCallAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  audioCallMutedIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  audioCallName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  audioCallStatus: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
  },
  inCallHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    zIndex: 10,
  },
  callHeaderBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callHeaderFlipButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inCallInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inCallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  inCallName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inCallDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  inCallStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  inCallControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  callControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8, // Reduced from 15 to 8 for closer spacing
  },
  callControlButtonActive: {
    backgroundColor: 'rgba(231,76,60,0.8)',
  },

  // Video call specific styles
  videoCallControls: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    gap: 10,
  },
  videoCameraToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCallHeader: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 0,
    marginHorizontal: 0,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  videoCallText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  videoHeaderCameraToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dual participant video styles (WhatsApp-style)
  remoteVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  remoteVideoAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  remoteVideoText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
  },
  remoteMutedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  remoteMutedText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 6,
  },
  // Remote status indicators (for video calls)
  remoteStatusIndicators: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  remoteStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  remoteStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  // PIP status indicators (smaller, for picture-in-picture view)
  pipStatusIndicators: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  pipStatusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header status indicators (for audio calls)
  headerStatusIndicators: {
    flexDirection: 'row',
    marginTop: 4,
  },
  headerStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerStatusText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginLeft: 4,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 80, // Moved closer to top
    right: 16, // Moved closer to edge
    width: 110, // Slightly smaller
    height: 150, // Slightly smaller
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 5,
  },
  localVideoView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  localVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  localVideoPlaceholderText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 8,
  },
  localVideoToggle: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // WhatsApp-style AI Call UI Styles
  whatsappCallModal: {
    flex: 1,
    backgroundColor: '#075E54',
    paddingTop: 50,
  },
  whatsappCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  whatsappBackButton: {
    marginRight: 15,
  },
  whatsappCallTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  whatsappCallContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  whatsappAvatarContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  whatsappCallAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  ripple: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 100,
    top: -25,
    left: -25,
    right: -25,
    bottom: -25,
  },
  ripple1: {
    top: -25,
    left: -25,
    right: -25,
    bottom: -25,
    borderWidth: 1,
  },
  ripple2: {
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    borderWidth: 1,
    opacity: 0.6,
  },
  ripple3: {
    top: -55,
    left: -55,
    right: -55,
    bottom: -55,
    borderWidth: 1,
    opacity: 0.3,
  },
  whatsappCallName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 8,
    textAlign: 'center',
  },
  whatsappCallStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  whatsappCallDuration: {
    marginTop: 10,
  },
  callDurationText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '300',
  },
  whatsappCallControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  whatsappControlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  whatsappEndCallButton: {
    backgroundColor: '#FF3B30',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  muteButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  speakerButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  micButton: {
    backgroundColor: '#25D366',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  activeButton: {
    backgroundColor: 'rgba(255,59,48,0.3)',
  },
  naturalConversationButton: {
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
    position: 'relative',
  },
  pulsingIndicator: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 212, 170, 0.3)',
    opacity: 0.8,
  },
  naturalConversationIndicator: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    marginTop: 15,
    alignItems: 'center',
  },
  naturalConversationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 5,
  },
  naturalConversationSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Incoming call modal styles
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modern Incoming Call Styles
  modernIncomingCallContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 60,
  },
  modernIncomingCallContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  modernIncomingAvatarContainer: {
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernIncomingAvatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernIncomingCallAvatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modernIncomingRipple: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: 'rgba(52, 199, 89, 0.6)',
  },
  modernIncomingCallName: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  modernIncomingCallType: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 20,
    textAlign: 'center',
  },
  modernIncomingCallStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modernIncomingCallPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    opacity: 0.9,
  },
  modernIncomingCallStatus: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  modernIncomingCallActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 40,
    gap: 40,
  },
  modernIncomingDeclineButton: {
    alignItems: 'center',
    gap: 12,
  },
  modernIncomingAcceptButton: {
    alignItems: 'center',
    gap: 12,
  },
  modernIncomingButtonGradient: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  modernIncomingButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  incomingCallModal: {
    width: '85%',
    backgroundColor: 'rgba(30, 30, 30, 0.98)',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  incomingCallInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  incomingCallAvatarContainer: {
    marginBottom: 20,
  },
  incomingCallAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#3498DB',
  },
  incomingCallName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  incomingCallType: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  incomingCallStatus: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  incomingCallActions: {
    flexDirection: 'row',
    gap: 20,
  },
  incomingCallButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#E74C3C',
  },
  acceptButton: {
    backgroundColor: '#27AE60',
  },
  incomingCallButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  // Gift modal styles
  giftModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  giftModalContainer: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  giftModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  giftModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  giftModalCloseButton: {
    padding: 4,
  },
  giftModalContent: {
    padding: 20,
  },
  giftModalLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  giftModalLoadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  giftModalGrid: {
    paddingBottom: 20,
  },
  giftModalItem: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    margin: 4,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  giftModalEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  giftModalName: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 2,
  },
  giftModalQuantity: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  giftModalEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  giftModalEmptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  // Image viewer modal styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  imageViewerImage: {
    width: '100%',
    height: '80%',
  },
  imageViewerActions: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  imageViewerActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 15,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageViewerActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Emoji reaction styles
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  reactionPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPickerModal: {
    backgroundColor: 'rgba(30, 30, 30, 0.98)',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  reactionPickerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  reactionPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  reactionPickerButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
  },
  reactionPickerEmoji: {
    fontSize: 28,
  },
  // Video player modal styles
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  videoPlayerCloseButton: {
    padding: 8,
    marginRight: 16,
  },
  videoPlayerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  videoPlayerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  // Product Preview Styles
  productPreviewContainer: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  productPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  productPreviewTitle: {
    flex: 1,
    color: '#F39C12',
    fontSize: 13,
    fontWeight: '600',
  },
  productPreviewContent: {
    flexDirection: 'row',
    gap: 12,
  },
  productPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  productPreviewImagePlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productPreviewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productPreviewName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPreviewPrice: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default IndividualChatScreen;