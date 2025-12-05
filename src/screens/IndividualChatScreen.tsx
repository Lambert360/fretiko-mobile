import { Ionicons } from '@expo/vector-icons';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatAPI, ChatMessage } from '../services/chatAPI';
import { realtimeAPI } from '../services/realtimeAPI';
import { userAPI, UserProfile } from '../services/userAPI';
import { geminiAPI } from '../services/geminiAPI';
import { ikoAPI } from '../services/ikoAPI';
import { realTimeAudioService } from '../services/realTimeAudioService';
import { invoiceAPI, Invoice } from '../services/invoiceAPI';
import { wishlistAPI } from '../services/wishlistAPI';
import * as ImagePicker from 'expo-image-picker';
import InvoiceMessageCard from '../components/InvoiceMessageCard';
import ProductMessageCard from '../components/ProductMessageCard';
import ServiceMessageCard from '../components/ServiceMessageCard';
import ScheduleMessageCard from '../components/ScheduleMessageCard';
import ScheduleModal, { ScheduleActivityData } from '../components/ScheduleModal';
import { WishlistShareModal } from '../components/WishlistShareModal';
import WishlistMessageCard from '../components/WishlistMessageCard';

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
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
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
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true); // Remote participant's video status
  const [remoteMuted, setRemoteMuted] = useState(false); // Remote participant's mute status
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connecting' | 'connected' | 'ending'>('calling');
  const [incomingCall, setIncomingCall] = useState<{callSessionId: string, callerName: string, callType: 'audio' | 'video'} | null>(null);
  const incomingCallRef = useRef<{callSessionId: string, callerName: string, callType: 'audio' | 'video'} | null>(null); // 🔥 Persist across remounts
  const [ringbackTimeout, setRingbackTimeout] = useState<NodeJS.Timeout | null>(null);
  const [soundInterval, setSoundInterval] = useState<NodeJS.Timeout | null>(null);

  // Camera and video call states
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('front');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [showVideoUI, setShowVideoUI] = useState(false);

  // AI voice call states
  const [isAICall, setIsAICall] = useState(false);
  const [geminiLiveWs, setGeminiLiveWs] = useState<WebSocket | null>(null);
  const [isConnectedToGemini, setIsConnectedToGemini] = useState(false);
  const [callSessionId] = useState(() => `ai-call-${Date.now()}`); // Unique identifier for this call session
  const [streamInterval, setStreamInterval] = useState<NodeJS.Timeout | null>(null);
  const [reconnectionCount, setReconnectionCount] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // 🔥 FIX: Track if we've already subscribed to prevent duplicates
  const hasSubscribedRef = useRef(false);
  const cleanupFnRef = useRef<(() => void) | null>(null);

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

  // Audio recorder for voice messages (use the same one for AI calls too)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Configure audio mode on mount for iOS recording
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
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
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<CameraView>(null);

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
        const converted = {
          ...msg,
          text: msg.content,
          timestamp: new Date(msg.createdAt),
          // 🔥 FIX: Explicitly preserve wishlistData from metadata
          wishlistData: msg.metadata?.wishlistData || msg.wishlistData,
          productData: msg.metadata?.productData || msg.productData,
        };
        
        // Debug log for wishlist messages
        if (msg.messageType === 'wishlist') {
          console.log('📋 Wishlist message loaded:', {
            id: msg.id,
            senderId: msg.senderId,
            hasWishlistData: !!converted.wishlistData,
            ownerId: converted.wishlistData?.ownerId,
            'user?.id': user?.id,
            willShowOnRight: msg.senderId === user?.id || converted.wishlistData?.ownerId === user?.id
          });
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
      if (!isAI && chatType !== 'ai') {
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
      const connectPromise = realtimeAPI.connect(userId, accessToken);
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
    // 🔥 FIX: Prevent duplicate subscriptions
    if (hasSubscribedRef.current) {
      console.warn('⚠️ Already subscribed to real-time messaging, skipping duplicate setup');
      return cleanupFnRef.current || (() => {});
    }

    // 🔥 FIX: Add connection state validation before subscribing
    if (!realtimeAPI.isChatConnected()) {
      console.warn('💬 Chat socket not connected, skipping message subscription setup');
      return () => {}; // Return empty cleanup function
    }

    console.log('🔥 Setting up real-time message subscriptions for conversation:', chatId);
    hasSubscribedRef.current = true;

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
        };
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
          const callInfo = {
            callSessionId: callData.callSessionId,
            callerName: callData.initiator?.full_name || callData.initiator?.username || 'Unknown',
            callType: callData.callType,
          };
          setIncomingCall(callInfo);
          incomingCallRef.current = callInfo; // 🔥 Persist in ref
          // Play ringtone
          playCallSound('incoming');
          break;

        case 'call_ended':
          console.log('📞 Call ended by remote participant');
          // Hide incoming call UI if showing
          setIncomingCall(null);
          incomingCallRef.current = null;
          stopCallSounds();
          // End active call (don't check isInCall - just end it)
          endCall('completed');
          break;

        case 'participant_joined':
          console.log('📞 Participant joined the call');
          // Update call status if we're the one calling
          if (isInCall && callStatus === 'calling') {
            setCallStatus('connected');
            setCallStartTime(Date.now());
            stopCallSounds();
            playCallSound('connected');
          }
          break;

        case 'participant_left':
          console.log('📞 Participant left the call');
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

    const unsubscribeInvoicePaid = realtimeAPI.subscribe('invoice_paid', (data) => {
      if (data.conversationId === chatId) {
        console.log('📄 Invoice paid:', data.invoiceId);
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
      hasSubscribedRef.current = false; // 🔥 Reset subscription state
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
      cleanup.then(cleanupFn => {
        if (cleanupFn) cleanupFn();
      });
      realtimeAPI.leaveConversation(chatId);
      // 🔥 Reset subscription state on unmount
      hasSubscribedRef.current = false;
      cleanupFnRef.current = null;
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


  const sendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    const tempMessageId = Date.now().toString();
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
        await geminiAPI.initializeChatSession(user?.id || 'unknown');
        const response = await geminiAPI.sendTextMessage(messageContent, user?.id || 'unknown');

        // 3. Create AI response message (frontend only)
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: response.text || 'I understand.',
          timestamp: new Date(),
          senderId: AI_ASSISTANT_UUID,
          senderName: AI_ASSISTANT_NAME,
          messageType: 'text',
          status: 'delivered',
          conversationId: chatId,
          content: response.text || 'I understand.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Include IKO recommendations if available
          ikoRecommendations: (response.recommendedProducts || response.recommendedServices) ? {
            products: response.recommendedProducts,
            services: response.recommendedServices,
          } : undefined,
          // Include IKO schedule card if available
          ikoScheduleCard: response.scheduleCard,
        };

        setMessages(prev => [...prev, aiMessage]);

        // 4. Save both messages to backend for persistence (fire and forget)
        try {
          console.log('💾 Saving AI messages to backend for chatId:', chatId);
          // Save user message
          const savedUserMsg = await chatAPI.sendAIMessage(chatId, messageContent, false);
          console.log('✅ User message saved:', savedUserMsg.id);
          // Save AI response
          const savedAIMsg = await chatAPI.sendAIMessage(chatId, response.text || 'I understand.', true);
          console.log('✅ AI response saved:', savedAIMsg.id);
          console.log('✅ AI conversation saved to backend');
        } catch (saveError) {
          console.error('⚠️ Failed to save AI conversation to backend:', saveError);
          // Don't throw - conversation continues working without backend save
        }

        // Handle function calls if any (this is where backend interaction happens)
        if (response.functionCalls && response.functionCalls.length > 0) {
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
          navigation.setParams({ bargainMode: false, productData: undefined });
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
      navigation.navigate('CreateInvoice', {
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
        wishlistData: chatMessageData.wishlistData,
        metadata: { wishlistData: chatMessageData.wishlistData },
      };

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
              navigation.navigate('Wishlist');
            }
          }
        ]
      );
    } else {
      // You are the recipient - someone shared with you
      console.log('📱 Navigating to SharedWishlist as recipient');
      navigation.navigate('SharedWishlist', {
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
      text: '',
      timestamp: new Date(),
      senderId: 'current-user',
      senderName: 'You',
      messageType: 'livestream',
      status: 'sent',
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
      text: '',
      timestamp: new Date(),
      senderId: 'current-user',
      senderName: 'You',
      messageType: 'auction',
      status: 'sent',
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
  const initializeWebRTC = async (rtcConfiguration: any) => {
    try {
      console.log('🔗 Initializing Expo call system...');

      // For Expo, we use expo-av and expo-camera for media
      // This provides a simplified but functional call experience

      // 1. Set up audio for calls
      await setupAudioForCall();

      // 2. For video calls, prepare camera (if needed)
      if (callType === 'video') {
        await setupVideoForCall();
      }

      // 3. Set up real-time signaling via WebSocket
      await setupCallSignaling();

      console.log('✅ Expo call system initialized');
    } catch (error) {
      console.error('❌ Error initializing call system:', error);
      throw error;
    }
  };

  const setupAudioForCall = async () => {
    try {
      console.log('🎤 Delegating audio setup to system...');

      // Delegate audio configuration to system
      // System will automatically configure audio for calls
      console.log('📱 Audio configuration delegated to system - iOS/Android will handle call audio automatically');

      // Create mock audio stream for UI purposes
      const audioStream = {
        id: 'audio-stream',
        type: 'audio',
        recording: null, // System-managed
        isActive: true,
      };

      setLocalStream(audioStream);
      console.log('✅ Audio delegation complete');
    } catch (error) {
      console.warn('⚠️ Audio delegation warning:', error);
      // System will still handle audio automatically
    }
  };

  const setupVideoForCall = async () => {
    try {
      console.log('📹 Setting up video for call...');

      // For video calls in Expo, we would use expo-camera
      // This is a simplified setup - in production you'd show camera preview

      // Simulate video stream setup
      const videoStream = {
        id: 'video-stream',
        type: 'video',
        isActive: isVideoEnabled,
        resolution: '720p',
      };

      console.log('✅ Video setup complete');
      return videoStream;
    } catch (error) {
      console.error('❌ Video setup error:', error);
      throw error;
    }
  };

  const setupCallSignaling = async () => {
    try {
      console.log('📡 Setting up call signaling...');

      if (realtimeAPI.isConnected() && currentCallSessionId) {
        // Subscribe to incoming call signals
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

        case 'call_accepted':
          console.log('📞 Call accepted by remote participant');
          setTimeout(() => {
            stopCallSounds();

            // Clear call timeout - call was answered
            if (ringbackTimeout) {
              clearTimeout(ringbackTimeout);
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
          console.log('📞 Call ended by remote participant');
          setTimeout(() => {
            const reason = data.data.reason || 'completed';
            endCall(reason);
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
      setIsMuted(!isMuted);
      
      // Send mute status via WebSocket
      if (currentCallSessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(currentCallSessionId, 'mute_toggle', {
          isMuted: !isMuted
        }, chatId);
      }

      // Update call settings via API
      if (currentCallSessionId) {
        await chatAPI.updateCallSettings(currentCallSessionId, {
          isMuted: !isMuted
        });
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const toggleVideo = async () => {
    try {
      setIsVideoEnabled(!isVideoEnabled);

      // Send video status via WebSocket
      if (currentCallSessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(currentCallSessionId, 'video_toggle', {
          isVideoEnabled: !isVideoEnabled
        }, chatId); // Pass conversationId to avoid backend lookup
      }

      // Update call settings via API
      if (currentCallSessionId) {
        await chatAPI.updateCallSettings(currentCallSessionId, {
          isVideoEnabled: !isVideoEnabled
        });
      }
    } catch (error) {
      console.error('Error toggling video:', error);
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
      if (ringbackTimeout) {
        clearTimeout(ringbackTimeout);
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

      setCallType(type);
      setCallStatus('calling');
      setShowCallModal(true);

      // Start ringback sound for caller
      playCallSound('ringing');

      // Set call timeout (30 seconds)
      const timeout = setTimeout(handleCallTimeout, 30000);
      setRingbackTimeout(timeout);
      
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
      const participantIds = otherUserId ? [user?.id, otherUserId].filter(Boolean) : [user?.id].filter(Boolean);
      const callData = await chatAPI.startCall(chatId, type, participantIds);
      setCurrentCallSessionId(callData.callSessionId);
      
      // Initialize WebRTC connection
      await initializeWebRTC(callData.rtcConfiguration);
      
      // Send call initiation via WebSocket
      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(callData.callSessionId, 'call_initiated', {
          callType: type,
          callerId: user?.id,
          callerName: user?.username || 'Unknown',
          timestamp: new Date().toISOString(),
        }, chatId);
      }
      
      console.log('📞 Call initiated, waiting for response...');

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

    try {
      console.log('📞 Accepting call...', callToAccept.callSessionId);
      setCallStatus('connecting');
      stopCallSounds();

      // Join the call
      console.log('📞 Calling chatAPI.joinCall...');
      const joinResult = await chatAPI.joinCall(callToAccept.callSessionId);
      console.log('✅ Successfully joined call:', joinResult);

      setCurrentCallSessionId(callToAccept.callSessionId);
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

      // For video calls, setup camera
      if (callToAccept.callType === 'video') {
        if (!cameraPermission?.granted) {
          const permission = await requestCameraPermission();
          if (!permission.granted) {
            Alert.alert('Permission Required', 'Camera permission is required for video calls.');
            endCall('cancelled');
            return;
          }
        }

        // Start camera preview for video calls
        console.log('📹 Starting camera preview for accepted video call');
        setShowCameraPreview(true);
        setShowVideoUI(true);
      }

      // Start call
      setCallStatus('connected');
      setIsInCall(true);
      setShowCallModal(false);
      setCallStartTime(Date.now());
      setCallDuration(0);

      playCallSound('connected');

    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call.');
      setIncomingCall(null);
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

  const endCall = async (reason: 'completed' | 'declined' | 'missed' | 'cancelled' = 'completed') => {
    try {
      console.log(`📞 Ending call with reason: ${reason}`);
      console.log('🔍 Call end details:', {
        reason,
        reasonType: typeof reason,
        isAICall,
        callStatus,
        isInCall
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

      // Clean up system-delegated streams
      if (localStream) {
        console.log('🔊 Delegating stream cleanup to system');
        // System will handle stream cleanup automatically
        setLocalStream(null);
      }
      if (remoteStream) {
        setRemoteStream(null);
      }

      // Send call end signal with reason
      if (currentCallSessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(currentCallSessionId, 'call_ended', {
          reason,
          endedBy: user?.id,
          timestamp: new Date().toISOString(),
        }, chatId);
      }

      // End call on backend
      if (currentCallSessionId) {
        await chatAPI.endCall(currentCallSessionId, reason);
      }

      // Delegate audio mode reset to system
      console.log('🔊 Delegating audio mode reset to system');
      // System will automatically handle audio mode restoration

    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      // Ensure all sounds/haptics are stopped
      stopCallSounds();

      // Reset all call states
      setIsInCall(false);
      setShowCallModal(false);
      setCurrentCallSessionId(null);
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

      // Stop call timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
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

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      console.log('✅ Prepared to record');

      await audioRecorder.record();
      console.log('✅ Recording started');

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
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      console.log('🛑 Stopping recording...');

      // Stop recording
      await audioRecorder.stop();

      setIsRecording(false);

      // Clear timer
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }

      // Get the recorded audio URI
      const uri = audioRecorder.uri;

      if (!uri) {
        console.error('❌ No audio URI found');
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
            data.serverContent.modelTurn.parts.forEach(part => {
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
      const streamInterval = setInterval(streamContinuousAudio, 500);
      setStreamInterval(streamInterval);

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

      // Listen for when audio finishes
      audioPlayer.addListener('playingStatusDidSet', (status) => {
        if (!status.isPlaying && playingAudioId === messageId) {
          setPlayingAudioId(null);
        }
      });
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
          const reactions = { ...msg.reactions } || {};
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
      const tempMessage: Message = {
        id: tempId,
        conversationId: chatId,
        senderId: user?.id || 'unknown',
        senderName: 'You',
        content: messageType === 'audio' ? `Voice message (${Math.floor(recordingDuration)}s)` : '',
        text: messageType === 'audio' ? `🎤 Voice message (${Math.floor(recordingDuration)}s)` : '',
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
        } : undefined
      };

      setMessages(prev => [...prev, tempMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Step 1: Create message first (without mediaUrl)
      const createdMessage = await chatAPI.sendMessage({
        conversationId: chatId,
        messageType,
        content: messageType === 'audio' ? `Voice message (${Math.floor(recordingDuration)}s)` : '',
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
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? {
                id: updatedMessage.id,
                conversationId: updatedMessage.conversation_id || updatedMessage.conversationId || chatId,
                senderId: updatedMessage.sender_id || updatedMessage.senderId || user?.id,
                senderName: 'You',
                content: updatedMessage.content || '',
                text: updatedMessage.content || tempMessage.text,
                messageType: updatedMessage.message_type || updatedMessage.messageType || messageType,
                status: 'sent',
                mediaUrl: updatedMessage.media_url || updatedMessage.mediaUrl,
                timestamp: new Date(updatedMessage.created_at || updatedMessage.createdAt),
                createdAt: updatedMessage.created_at || updatedMessage.createdAt,
                updatedAt: updatedMessage.updated_at || updatedMessage.updatedAt,
                fileData: messageType === 'file' ? uploadResult.fileData : undefined
              }
            : msg
        )
      );
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
          <View style={styles.avatarContainer}>
            <Image 
              source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar} 
              style={styles.avatar} 
            />
            {isOnline && <View style={styles.onlineIndicator} />}
            <View style={[styles.chatTypeIndicator, { backgroundColor: getChatTypeColor(chatType) }]}>
              <Ionicons name={getChatTypeIcon(chatType) as any} size={8} color="white" />
            </View>
          </View>

          <View style={styles.chatDetails}>
            <View style={styles.nameContainer}>
              <Text style={styles.chatName}>{chatName}</Text>
              {verified && (
                <Ionicons name="checkmark-circle" size={16} color="#3498DB" style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Last seen recently'}
              {isTyping && ' • typing...'}
            </Text>
          </View>
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

              Alert.alert('Chat Options', 'Choose an option', [
                ...options.map((option, index) => ({
                  text: option,
                  onPress: () => {
                    if (option === 'Report Chat') {
                      navigation.navigate('CreateContentReport', {
                        chatId: chatId,
                        reportCategory: 'chat'
                      });
                    } else if (option === 'Create Invoice') {
                      handleCreateInvoice();
                    } else if (option === 'Block User') {
                      // TODO: Implement block user
                      Alert.alert('Block User', 'Block user feature coming soon');
                    } else if (option !== 'Cancel') {
                      Alert.alert(option, `${option} feature coming soon`);
                    }
                  },
                  style: option === 'Cancel' ? 'cancel' : option === 'Block User' ? 'destructive' : 'default',
                })),
              ]);
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
          
          {item.messageType === 'audio' && item.mediaUrl && (
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
                <Text style={[styles.audioText, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                  {item.content || 'Voice Message'}
                </Text>
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
          )}
          
          {item.messageType === 'file' && item.fileData && (
            <TouchableOpacity
              style={styles.fileContainer}
              onPress={() => handleOpenFile(item.fileData?.url || item.mediaUrl || '', item.fileData?.name || 'file')}
            >
              <View style={styles.fileIcon}>
                <Ionicons name="document" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, isCurrentUser ? styles.currentUserText : styles.otherUserText]}>
                  {item.fileData.name}
                </Text>
                <Text style={[styles.fileSize, isCurrentUser ? styles.currentUserTime : styles.otherUserTime]}>
                  {item.fileData.size}
                </Text>
              </View>
              <Ionicons name="download" size={20} color="#FFFFFF" />
            </TouchableOpacity>
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
    <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
      {/* Product Preview Card for Bargain Mode */}
      {bargainMode && productData && (
        <View style={styles.productPreviewContainer}>
          <View style={styles.productPreviewHeader}>
            <Ionicons name="pricetag" size={16} color="#F39C12" />
            <Text style={styles.productPreviewTitle}>Product for Negotiation</Text>
            <TouchableOpacity onPress={() => {
              // Clear bargain mode after first message
              navigation.setParams({ bargainMode: false, productData: undefined });
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

  // Render Call Modal
  const renderCallModal = () => (
    <Modal
      visible={showCallModal}
      transparent={true}
      animationType="fade"
      onRequestClose={endCall}
    >
      <View style={styles.callModalOverlay}>
        {/* Camera Preview Background for Video Calls */}
        {callType === 'video' && showCameraPreview && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={cameraType}
            onCameraReady={onCameraReady}
          />
        )}

        {/* WhatsApp-Style AI Call UI */}
        {isAICall ? (
          <View style={styles.whatsappCallModal}>
            {/* Header */}
            <View style={styles.whatsappCallHeader}>
              <TouchableOpacity
                style={styles.whatsappBackButton}
                onPress={() => endCall('cancelled')}
              >
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.whatsappCallTitle}>Voice call</Text>
            </View>

            {/* Avatar and Status */}
            <View style={styles.whatsappCallContent}>
              <View style={styles.whatsappAvatarContainer}>
                <Image
                  source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                  style={styles.whatsappCallAvatar}
                />
                {/* Ripple animation for active call */}
                {callStatus === 'connected' && (
                  <>
                    <View style={[styles.ripple, styles.ripple1]} />
                    <View style={[styles.ripple, styles.ripple2]} />
                    <View style={[styles.ripple, styles.ripple3]} />
                  </>
                )}
              </View>

              <Text style={styles.whatsappCallName}>{chatName}</Text>
              <Text style={styles.whatsappCallStatus}>
                {callStatus === 'connecting'
                  ? 'Connecting...'
                  : callStatus === 'connected'
                    ? (isConnectedToGemini
                        ? (isReconnecting
                            ? '🔄 Reconnecting for continuous chat...'
                            : (streamInterval ? '🎙️ Natural conversation active' : '✨ Ready to chat naturally'))
                        : 'Connecting to Iko...'
                      )
                    : 'Calling...'
                }
              </Text>

              {/* Natural Conversation Indicator */}
              {callStatus === 'connected' && isConnectedToGemini && (
                <View style={styles.naturalConversationIndicator}>
                  <Text style={styles.naturalConversationText}>
                    💬 Just start speaking - no need to tap
                  </Text>
                  <Text style={styles.naturalConversationSubtext}>
                    Powered by Gemini 2.5 Flash with Voice Activity Detection
                  </Text>
                </View>
              )}

              {callStatus === 'connected' && (
                <View style={styles.whatsappCallDuration}>
                  <Text style={styles.callDurationText}>
                    {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
                    {(callDuration % 60).toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
            </View>

            {/* Call Controls */}
            <View style={styles.whatsappCallControls}>
              {callStatus === 'connected' && (
                <>
                  <TouchableOpacity
                    style={[styles.whatsappControlButton, styles.muteButton, isMuted && styles.activeButton]}
                    onPress={toggleMute}
                  >
                    <Ionicons
                      name={isMuted ? "mic-off" : "mic"}
                      size={24}
                      color={isMuted ? "#FF3B30" : "#FFFFFF"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.whatsappControlButton, styles.speakerButton, isSpeakerOn && styles.activeButton]}
                    onPress={toggleSpeaker}
                  >
                    <Ionicons
                      name={isSpeakerOn ? "volume-high" : "volume-medium"}
                      size={24}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  {/* Natural Conversation Status Indicator */}
                  <View style={[styles.whatsappControlButton, styles.naturalConversationButton]}>
                    {streamInterval ? (
                      <>
                        <Ionicons name="radio" size={24} color="#00D4AA" />
                        <View style={styles.pulsingIndicator} />
                      </>
                    ) : (
                      <Ionicons name="mic" size={24} color="#FFFFFF" opacity={0.6} />
                    )}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.whatsappControlButton, styles.whatsappEndCallButton]}
                onPress={() => endCall('completed')}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Original Call UI for regular calls */
          <View style={styles.callModal}>
            {/* Only show avatar for audio calls or when camera is not ready */}
            {(callType === 'audio' || !showCameraPreview) && (
              <Image
                source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                style={styles.callAvatar}
              />
            )}

            <Text style={styles.callName}>{chatName}</Text>
            <Text style={styles.callStatus}>
              {callType === 'video' ? 'Video calling...' : 'Calling...'}
            </Text>

            {/* Video Call Controls */}
            {callType === 'video' && showCameraPreview && (
              <View style={styles.videoCallControls}>
                <TouchableOpacity
                  style={styles.videoCameraToggle}
                  onPress={toggleCamera}
                >
                  <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.callActions}>
              <TouchableOpacity
                style={[styles.callButton, styles.endCallButton]}
                onPress={() => endCall('completed')}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );

  // Render In-Call Overlay
  const renderInCallOverlay = () => (
    <Modal
      visible={isInCall}
      transparent={true}
      animationType="none"
      onRequestClose={endCall}
    >
      <View style={styles.inCallOverlay}>
        {/* Remote Participant Video (Full Screen Background) */}
        {callType === 'video' && showVideoUI && callStatus === 'connected' && (
          <View style={styles.remoteVideoContainer}>
            {/* Placeholder for remote participant's video stream */}
            <View style={styles.remoteVideoPlaceholder}>
              <Image
                source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                style={styles.remoteVideoAvatar}
              />
              <Text style={styles.remoteVideoText}>
                {chatName}'s camera is {remoteVideoEnabled ? 'on' : 'off'}
              </Text>
              {remoteMuted && (
                <View style={styles.remoteMutedIndicator}>
                  <Ionicons name="mic-off" size={16} color="#FFFFFF" />
                  <Text style={styles.remoteMutedText}>Muted</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Local Camera (Picture-in-Picture) */}
        {callType === 'video' && showVideoUI && isVideoEnabled && callStatus === 'connected' && (
          <TouchableOpacity
            style={styles.localVideoContainer}
            onPress={swapVideoViews}
            activeOpacity={0.8}
          >
            <CameraView
              ref={cameraRef}
              style={styles.localVideoView}
              facing={cameraType}
              onCameraReady={onCameraReady}
            />
            <TouchableOpacity
              style={styles.localVideoToggle}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Full Screen Camera for Calling Phase */}
        {callType === 'video' && showVideoUI && isVideoEnabled && callStatus !== 'connected' && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={cameraType}
            onCameraReady={onCameraReady}
          />
        )}

        {/* Floating Call Header for Video Calls */}
        <View style={[
          styles.inCallHeader,
          callType === 'video' && showVideoUI && styles.videoCallHeader
        ]}>
          <View style={styles.inCallInfo}>
            {/* Only show avatar for audio calls or when video is off */}
            {(callType === 'audio' || !showVideoUI || !isVideoEnabled) && (
              <Image
                source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                style={styles.inCallAvatar}
              />
            )}
            <View>
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
                {isAICall
                  ? '🤖 AI Voice Chat'
                  : (callType === 'video' ? '📹 Video call' : '🎤 Voice call')
                } • {formatCallDuration(callDuration)}
              </Text>
              <Text style={[
                styles.inCallStatus,
                callType === 'video' && showVideoUI && styles.videoCallText
              ]}>
                {isAICall
                  ? (isConnectedToGemini
                      ? '💬 Tap to speak with Iko'
                      : '🔄 Connecting...')
                  : (isMuted ? '🔇 Muted' : '🎤 Live')
                } {!isAICall && callType === 'video' && (!isVideoEnabled ? ' • 📹 Camera Off' : ' • 📹 Camera On')}
              </Text>
            </View>
          </View>

          {/* Camera Toggle for Video Calls */}
          {callType === 'video' && showVideoUI && (
            <TouchableOpacity
              style={styles.videoHeaderCameraToggle}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Call Controls */}
        <View style={styles.inCallControls}>
          <TouchableOpacity 
            style={[styles.callControlButton, isMuted && styles.callControlButtonActive]}
            onPress={toggleMute}
          >
            <Ionicons 
              name={isMuted ? "mic-off" : "mic"} 
              size={24} 
              color={isMuted ? "#E74C3C" : "#FFFFFF"} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.callControlButton, isSpeakerOn && styles.callControlButtonActive]}
            onPress={toggleSpeaker}
          >
            <Ionicons
              name={isSpeakerOn ? "volume-high" : "volume-medium"}
              size={24}
              color={isSpeakerOn ? "#3498DB" : "#FFFFFF"}
            />
          </TouchableOpacity>

          {callType === 'video' && (
            <TouchableOpacity
              style={[styles.callControlButton, !isVideoEnabled && styles.callControlButtonActive]}
              onPress={toggleVideo}
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
              onPress={startLiveAudioStreaming}
              disabled={!isConnectedToGemini}
            >
              <Ionicons
                name={isConnectedToGemini ? "mic" : "mic-outline"}
                size={24}
                color={isConnectedToGemini ? "#2ECC71" : "#95a5a6"}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.callControlButton, styles.endCallButton]}
            onPress={() => endCall('completed')}
          >
            <Ionicons name="call" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
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
    // In a real implementation, this would swap the local and remote video streams
    // For now, we'll add visual feedback
  };

  // Render incoming call modal
  const renderIncomingCallModal = () => {
    if (!incomingCall) return null;

    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.incomingCallOverlay}>
          <View style={styles.incomingCallModal}>
            {/* Caller Info */}
            <View style={styles.incomingCallInfo}>
              <View style={styles.incomingCallAvatarContainer}>
                <Image
                  source={typeof chatAvatar === 'string' ? { uri: chatAvatar } : chatAvatar}
                  style={styles.incomingCallAvatar}
                />
              </View>
              <Text style={styles.incomingCallName}>{incomingCall.callerName}</Text>
              <Text style={styles.incomingCallType}>
                {incomingCall.callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
              </Text>
              <Text style={styles.incomingCallStatus}>Incoming call...</Text>
            </View>

            {/* Call Actions */}
            <View style={styles.incomingCallActions}>
              <TouchableOpacity
                style={[styles.incomingCallButton, styles.declineButton]}
                onPress={declineCall}
              >
                <Ionicons name="close" size={32} color="#FFFFFF" />
                <Text style={styles.incomingCallButtonText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.incomingCallButton, styles.acceptButton]}
                onPress={acceptCall}
              >
                <Ionicons name="call" size={32} color="#FFFFFF" />
                <Text style={styles.incomingCallButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
              allowsFullscreen
              allowsPictureInPicture
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
  audioText: {
    fontSize: 12,
    fontWeight: '500',
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
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    minWidth: 200,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
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
  inCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
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
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  callControlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
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
  localVideoContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localVideoView: {
    flex: 1,
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