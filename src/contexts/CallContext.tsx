import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useCameraPermissions, CameraType } from 'expo-camera';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useAuth } from './AuthContext';
import { realtimeAPI } from '../services/realtimeAPI';
import { chatAPI } from '../services/chatAPI';
import { callkeepService } from '../services/callkeepService';
import { agoraCallService, AgoraCallConfig } from '../services/agoraCallService';
import { giftAPI } from '../services/giftAPI';

export interface IncomingCallInfo {
  callSessionId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  conversationId: string;
  initiatorId?: string;
}

export type CallStatus = 'idle' | 'incoming' | 'calling' | 'connecting' | 'ringing' | 'connected' | 'reconnecting';

export interface GiftAnimationItem {
  id: string;
  emoji: string;
  quantity: number;
}

interface CallContextValue {
  incomingCallForBanner: IncomingCallInfo | null;
  registerActiveChatId: (chatId: string) => void;
  unregisterActiveChatId: () => void;
  declineCallFromBanner: () => void;
  clearBannerCall: () => void;

  // Active call state (Agora-based calls only — Iko AI voice calls are handled separately)
  callStatus: CallStatus;
  callType: 'audio' | 'video';
  isInCall: boolean;
  isCallMinimized: boolean;
  chatId: string | null;
  otherUserId: string | null;
  callerName: string;
  callerAvatar: string | null;
  currentCallSessionId: string | null;
  agoraConfig: AgoraCallConfig | null;
  remoteUid: number | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  remoteVideoEnabled: boolean;
  remoteMuted: boolean;
  isSpeakerOn: boolean;
  callDuration: number;
  callStartTime: number | null;
  showCameraPreview: boolean;
  cameraType: CameraType;
  showVideoUI: boolean;
  isLocalVideoPrimary: boolean;
  showCallOverlay: boolean;
  showGiftModal: boolean;
  availableGifts: Array<{ id: string; emoji: string; name: string; quantity: number }>;
  loadingGifts: boolean;
  activeGiftAnimations: GiftAnimationItem[];

  showIncomingCall: (info: IncomingCallInfo) => void;
  declineIncomingCall: () => void;
  startCall: (params: {
    chatId: string;
    otherUserId?: string | null;
    callerName: string;
    callerAvatar?: string | null;
    callType: 'audio' | 'video';
  }) => Promise<void>;
  acceptIncomingCall: (info: IncomingCallInfo) => Promise<void>;
  endCall: (reason?: 'completed' | 'declined' | 'missed' | 'cancelled', fromRemote?: boolean) => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  swapVideoViews: () => void;
  toggleCallOverlay: () => void;
  minimizeCall: () => void;
  restoreCall: () => void;
  setShowGiftModal: (show: boolean) => void;
  loadAvailableGifts: () => Promise<void>;
  sendGift: (giftId: string, quantity?: number) => Promise<void>;
  removeGiftAnimation: (id: string) => void;
  getCallStatusText: () => string;
}

const CallContext = createContext<CallContextValue>({} as CallContextValue);

export const useCallContext = () => useContext(CallContext);

export const CallProvider: React.FC<{
  children: React.ReactNode;
  navigationRef?: React.RefObject<any>;
}> = ({ children, navigationRef }) => {
  const { user } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [incomingCallForBanner, setIncomingCallForBanner] = useState<IncomingCallInfo | null>(null);

  // === Active call state ===
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [isInCall, setIsInCall] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [callerName, setCallerName] = useState('');
  const [callerAvatar, setCallerAvatar] = useState<string | null>(null);
  const [currentCallSessionId, setCurrentCallSessionId] = useState<string | null>(null);
  const [agoraConfig, setAgoraConfig] = useState<AgoraCallConfig | null>(null);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('front');
  const [showVideoUI, setShowVideoUI] = useState(false);
  const [isLocalVideoPrimary, setIsLocalVideoPrimary] = useState(false);
  const [showCallOverlay, setShowCallOverlay] = useState(true);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [availableGifts, setAvailableGifts] = useState<Array<{ id: string; emoji: string; name: string; quantity: number }>>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [activeGiftAnimations, setActiveGiftAnimations] = useState<GiftAnimationItem[]>([]);

  // Use refs so the subscribe callback / Agora callbacks never go stale
  const activeChatIdRef = useRef<string | null>(null);
  const incomingCallRef = useRef<IncomingCallInfo | null>(null);
  const userIdRef = useRef<string | undefined>(user?.id);
  const chatIdRef = useRef<string | null>(null);
  const otherUserIdRef = useRef<string | null>(null);
  const currentCallSessionIdRef = useRef<string | null>(null);
  const isEndingCallRef = useRef(false);
  const isAcceptingCallRef = useRef(false);
  const isReinitializingRef = useRef(false);
  const ringbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    otherUserIdRef.current = otherUserId;
  }, [otherUserId]);

  const registerActiveChatId = useCallback((id: string) => {
    activeChatIdRef.current = id;
  }, []);

  const unregisterActiveChatId = useCallback(() => {
    activeChatIdRef.current = null;
  }, []);

  const clearBannerCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (call) {
      callkeepService.endCallkeepCall(call.callSessionId);
    }
    incomingCallRef.current = null;
    setIncomingCallForBanner(null);
  }, []);

  const declineCallFromBanner = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;

    if (realtimeAPI.isConnected()) {
      realtimeAPI.sendCallSignal(
        call.callSessionId,
        'call_declined',
        { declinedBy: userIdRef.current, timestamp: new Date().toISOString() },
        call.conversationId,
      );
    }
    chatAPI.endCall(call.callSessionId, 'declined');
    callkeepService.endCallkeepCall(call.callSessionId);

    incomingCallRef.current = null;
    setIncomingCallForBanner(null);
    setCallStatus('idle');
    setChatId(null);
    setOtherUserId(null);
    setCallerName('');
    setCallerAvatar(null);
  }, []);

  // === Show incoming call (full-screen UI) ===
  const showIncomingCall = useCallback((info: IncomingCallInfo) => {
    if (incomingCallRef.current) return; // Already showing an incoming call

    setChatId(info.conversationId);
    chatIdRef.current = info.conversationId;
    setOtherUserId(info.initiatorId || null);
    otherUserIdRef.current = info.initiatorId || null;
    setCallerName(info.callerName);
    setCallerAvatar(info.callerAvatar || null);
    setCallType(info.callType);
    setCallStatus('incoming');
    setIsInCall(false);
    setIsCallMinimized(false);

    incomingCallRef.current = info;
    setIncomingCallForBanner(info);

    callkeepService.displayIncomingCall({
      uuid: info.callSessionId,
      callerName: info.callerName,
      callType: info.callType,
      conversationId: info.conversationId,
      callSessionId: info.callSessionId,
    });

    navigationRef?.current?.navigate('CallScreen');
  }, []);

  // === Decline incoming call (from full-screen UI) ===
  const declineIncomingCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;

    if (realtimeAPI.isConnected()) {
      realtimeAPI.sendCallSignal(
        call.callSessionId,
        'call_declined',
        { declinedBy: userIdRef.current, timestamp: new Date().toISOString() },
        call.conversationId,
      );
    }
    chatAPI.endCall(call.callSessionId, 'declined');
    callkeepService.endCallkeepCall(call.callSessionId);

    incomingCallRef.current = null;
    setIncomingCallForBanner(null);
    setCallStatus('idle');
    setChatId(null);
    setOtherUserId(null);
    setCallerName('');
    setCallerAvatar(null);
  }, []);

  // === Haptic-based call sounds ===
  const stopCallSounds = useCallback(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    if (ringbackTimeoutRef.current) {
      clearTimeout(ringbackTimeoutRef.current);
      ringbackTimeoutRef.current = null;
    }
  }, []);

  const playCallSound = useCallback((type: 'ringing' | 'busy' | 'connected' | 'ended') => {
    try {
      switch (type) {
        case 'ringing':
          if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current);
          }
          soundIntervalRef.current = setInterval(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }, 1000);
          break;
        case 'busy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
          break;
        case 'connected':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'ended':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    } catch (error) {
      console.warn('Call sound/haptic warning:', error);
    }
  }, []);

  // === Call duration timer ===
  useEffect(() => {
    if (isInCall && callStartTime) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
      return () => {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
      };
    } else if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, [isInCall, callStartTime]);

  const getCallStatusText = useCallback((): string => {
    if (callStatus === 'incoming') return 'Incoming call';
    if (callStatus === 'connecting') return 'Connecting...';
    if (callStatus === 'ringing') return 'Ringing...';
    if (callStatus === 'connected') return 'Connected';
    return callType === 'video' ? 'Video calling...' : 'Calling...';
  }, [callStatus, callType]);

  // === Agora call initialization ===
  const initializeAgoraCall = useCallback(async (config: AgoraCallConfig, isVideoCall: boolean) => {
    const appId = config.appId || process.env.EXPO_PUBLIC_AGORA_APP_ID;
    if (!appId) {
      throw new Error('Agora App ID not configured. Please set EXPO_PUBLIC_AGORA_APP_ID in .env or ensure backend provides it.');
    }

    const normalizedConfig: AgoraCallConfig = {
      ...config,
      appId,
      channelName: config.channelName || config.channel,
    };

    if (!normalizedConfig.channelName) {
      throw new Error('Agora channel name not provided');
    }

    await agoraCallService.initialize(appId, {
      onJoinChannelSuccess: () => {
        console.log('📞 Joined Agora channel successfully');
      },
      onUserJoined: (connection: any, joinedUid: number) => {
        setRemoteUid(joinedUid);
        setRemoteVideoEnabled(true);
        setRemoteMuted(false);
        setCallStatus('connected');
        setCallStartTime(Date.now());
        stopCallSounds();
      },
      onUserOffline: () => {
        setRemoteUid(null);
      },
      onConnectionStateChanged: (state: number, reason: number) => {
        if (state === 1) {
          if (reason === 5) {
            const isReinitializing = isReinitializingRef.current || agoraCallService.isReinitializingEngine();
            if (isReinitializing) {
              isReinitializingRef.current = false;
              return;
            }
            endCallRef.current('completed');
          } else if (reason === 16) {
            setCallStatus('reconnecting');
          } else {
            setCallStatus('reconnecting');
          }
        } else if (state === 3) {
          setCallStatus((current) => (current === 'connecting' ? 'ringing' : current));
        } else if (state === 4) {
          setCallStatus('reconnecting');
        } else if (state === 5) {
          endCallRef.current('completed');
        }
      },
      onRemoteVideoStateChanged: (uid: number, state: number, reason: number) => {
        if (state === 0 && reason === 0) {
          setRemoteVideoEnabled(false);
        } else if (state === 1 || state === 2) {
          setRemoteVideoEnabled(true);
        }
      },
      onRemoteAudioStateChanged: (uid: number, state: number, reason: number) => {
        if (state === 0 && reason === 0) {
          setRemoteMuted(true);
        } else if (state !== 0) {
          setRemoteMuted(false);
        }
      },
      onError: (err: number, msg: string) => {
        console.error('❌ Agora call error:', err, msg);
        if (err !== 110) {
          Alert.alert('Call Error', `Error: ${msg || err}`);
        }
      },
    }, normalizedConfig.channelName);

    if (isVideoCall) {
      const engine = agoraCallService.getEngine();
      if (engine) {
        try {
          await engine.enableVideo();
          await engine.startPreview();
          setShowCameraPreview(true);
          setShowVideoUI(true);
        } catch (previewError) {
          console.error('❌ Error starting preview before join:', previewError);
        }
      }
    }

    const result = await agoraCallService.joinChannel(normalizedConfig, isVideoCall);
    if (result !== 0) {
      throw new Error(`Failed to join Agora channel with error code: ${result}`);
    }

    setAgoraConfig(normalizedConfig);

    if (isVideoCall) {
      const engine = agoraCallService.getEngine();
      if (engine) {
        try {
          await engine.enableVideo();
          await engine.startPreview();
          setShowCameraPreview(true);
          setShowVideoUI(true);
        } catch (previewError) {
          console.error('❌ Error confirming camera preview after join:', previewError);
        }
      }
    }
  }, [stopCallSounds]);

  // === End call ===
  const endCall = useCallback(async (
    reason: 'completed' | 'declined' | 'missed' | 'cancelled' = 'completed',
    fromRemote: boolean = false,
  ) => {
    if (isEndingCallRef.current) return;
    isEndingCallRef.current = true;

    try {
      stopCallSounds();

      const activeCallSessionId = currentCallSessionIdRef.current;

      await agoraCallService.cleanup();
      setRemoteUid(null);
      setAgoraConfig(null);

      if (!fromRemote && activeCallSessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(activeCallSessionId, 'call_ended', {
          reason,
          endedBy: userIdRef.current,
          timestamp: new Date().toISOString(),
        }, chatIdRef.current || undefined);
        realtimeAPI.sendCallEnded(activeCallSessionId, reason);
      }

      if (!fromRemote && activeCallSessionId) {
        await chatAPI.endCall(activeCallSessionId, reason);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      stopCallSounds();
      setCallStatus('idle');
      setIsInCall(false);
      setIsCallMinimized(false);
      setCurrentCallSessionId(null);
      currentCallSessionIdRef.current = null;
      setCallStartTime(null);
      setCallDuration(0);
      setIsMuted(false);
      setIsVideoEnabled(true);
      setIsSpeakerOn(false);
      setShowCameraPreview(false);
      setShowVideoUI(false);
      setIsLocalVideoPrimary(false);
      setShowGiftModal(false);
      setActiveGiftAnimations([]);
      setChatId(null);
      setOtherUserId(null);
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      isEndingCallRef.current = false;
    }
  }, [stopCallSounds]);

  // Ref indirection so Agora callbacks (captured once per call) always call the latest endCall
  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const handleCallTimeout = useCallback(() => {
    playCallSound('busy');
    endCallRef.current('missed');
  }, [playCallSound]);

  // === Start an outgoing call ===
  const startCall = useCallback(async (params: {
    chatId: string;
    otherUserId?: string | null;
    callerName: string;
    callerAvatar?: string | null;
    callType: 'audio' | 'video';
  }) => {
    try {
      setChatId(params.chatId);
      chatIdRef.current = params.chatId;
      setOtherUserId(params.otherUserId || null);
      otherUserIdRef.current = params.otherUserId || null;
      setCallerName(params.callerName);
      setCallerAvatar(params.callerAvatar || null);
      setCallType(params.callType);
      setCallStatus('calling');
      setIsInCall(false);
      setIsCallMinimized(false);
      if (params.callType === 'video') {
        setIsVideoEnabled(true);
      }

      playCallSound('ringing');

      const timeout = setTimeout(() => {
        if (ringbackTimeoutRef.current === timeout) {
          handleCallTimeout();
        }
      }, 60000);
      ringbackTimeoutRef.current = timeout;

      const { granted: micGranted } = await requestRecordingPermissionsAsync();
      if (!micGranted) {
        Alert.alert('Permission Required', 'Microphone permission is required to make calls.');
        stopCallSounds();
        setCallStatus('idle');
        return;
      }

      if (params.callType === 'video') {
        if (!cameraPermission?.granted) {
          const permission = await requestCameraPermission();
          if (!permission.granted) {
            Alert.alert('Permission Required', 'Camera permission is required for video calls.');
            setCallStatus('idle');
            return;
          }
        }
        setShowCameraPreview(true);
        setShowVideoUI(true);
      }

      const participantIds = (params.otherUserId ? [userIdRef.current, params.otherUserId] : [userIdRef.current])
        .filter((id): id is string => Boolean(id));
      const callData = await chatAPI.startCall(params.chatId, params.callType, participantIds);
      setCurrentCallSessionId(callData.callSessionId);
      currentCallSessionIdRef.current = callData.callSessionId;

      const rawConfig = callData.agoraConfig || callData.rtcConfiguration;
      if (!rawConfig) {
        throw new Error('Agora configuration not provided by backend');
      }

      await initializeAgoraCall(rawConfig, params.callType === 'video');

      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(callData.callSessionId, 'call_initiated', {
          callType: params.callType,
          callerId: userIdRef.current,
          timestamp: new Date().toISOString(),
        }, params.chatId);
      }
    } catch (error) {
      console.error('Error starting call:', error);
      stopCallSounds();
      Alert.alert('Error', 'Failed to start call. Please try again.');
      setCallStatus('idle');
    }
  }, [cameraPermission, requestCameraPermission, initializeAgoraCall, playCallSound, stopCallSounds, handleCallTimeout]);

  // === Accept an incoming call (from banner or native CallKeep answer) ===
  const acceptIncomingCall = useCallback(async (info: IncomingCallInfo) => {
    if (isAcceptingCallRef.current) return;
    isAcceptingCallRef.current = true;

    try {
      incomingCallRef.current = null;
      setIncomingCallForBanner(null);

      setChatId(info.conversationId);
      chatIdRef.current = info.conversationId;
      setOtherUserId(info.initiatorId || null);
      otherUserIdRef.current = info.initiatorId || null;
      setCallerName(info.callerName);
      setCallerAvatar(info.callerAvatar || null);
      setCallType(info.callType);
      setCallStatus('connecting');
      stopCallSounds();

      const joinResult = await chatAPI.joinCall(info.callSessionId);
      setCurrentCallSessionId(info.callSessionId);
      currentCallSessionIdRef.current = info.callSessionId;

      const rawConfig = joinResult.agoraConfig || joinResult.rtcConfiguration;
      if (!rawConfig) {
        throw new Error('Agora configuration not provided by backend');
      }

      if (info.callType === 'video' && !cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Camera permission is required for video calls.');
          isAcceptingCallRef.current = false;
          endCall('cancelled');
          return;
        }
      }

      await initializeAgoraCall(rawConfig, info.callType === 'video');

      if (info.callType === 'video') {
        setShowCameraPreview(true);
        setShowVideoUI(true);
      }

      setCallStatus('connecting');
      setIsInCall(true);

      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(info.callSessionId, 'call_accepted', {
          acceptedBy: userIdRef.current,
          timestamp: new Date().toISOString(),
        }, info.conversationId);
      }

      playCallSound('connected');
      isAcceptingCallRef.current = false;
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call.');
      isAcceptingCallRef.current = false;
    }
  }, [cameraPermission, requestCameraPermission, initializeAgoraCall, playCallSound, stopCallSounds, endCall]);

  // === Call control signals from the other participant ===
  const handleIncomingCallSignal = useCallback((data: any) => {
    try {
      switch (data.signalType) {
        case 'gift_animation':
          if (data.data && data.data.giftEmoji && data.data.quantity) {
            const animationId = `gift-${Date.now()}-${Math.random()}`;
            setActiveGiftAnimations((prev) => [...prev, {
              id: animationId,
              emoji: data.data.giftEmoji,
              quantity: data.data.quantity || 1,
            }]);
            setTimeout(() => {
              setActiveGiftAnimations((prev) => prev.filter((anim) => anim.id !== animationId));
            }, 5000);
          }
          break;

        case 'call_accepted':
          setTimeout(() => {
            stopCallSounds();
            setCallStatus('connecting');
            setIsInCall(true);
            playCallSound('connected');
          }, 0);
          break;

        case 'call_declined':
          setTimeout(() => {
            stopCallSounds();
            playCallSound('busy');
            endCallRef.current('declined');
          }, 0);
          break;

        case 'call_ready':
          setTimeout(() => setCallStatus('connected'), 0);
          break;

        case 'mute_toggle':
          setRemoteMuted(data.data.isMuted);
          break;

        case 'video_toggle':
          setRemoteVideoEnabled(data.data.isVideoEnabled);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('❌ Error handling call signal:', error);
    }
  }, [playCallSound, stopCallSounds]);

  // === Controls ===
  const toggleMute = useCallback(async () => {
    try {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      if (agoraCallService.isServiceInitialized()) {
        await agoraCallService.muteAudio(newMuteState);
      }
      const sessionId = currentCallSessionIdRef.current;
      if (sessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(sessionId, 'mute_toggle', { isMuted: newMuteState }, chatIdRef.current || undefined);
      }
      if (sessionId) {
        await chatAPI.updateCallSettings(sessionId, { isMuted: newMuteState });
      }
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }, [isMuted]);

  const toggleVideo = useCallback(async () => {
    try {
      const newVideoState = !isVideoEnabled;
      setIsVideoEnabled(newVideoState);
      if (agoraCallService.isServiceInitialized()) {
        await agoraCallService.muteVideo(!newVideoState);
      }
      const sessionId = currentCallSessionIdRef.current;
      if (sessionId && realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(sessionId, 'video_toggle', { isVideoEnabled: newVideoState }, chatIdRef.current || undefined);
      }
      if (sessionId) {
        await chatAPI.updateCallSettings(sessionId, { isVideoEnabled: newVideoState });
      }
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  }, [isVideoEnabled]);

  const switchCamera = useCallback(async () => {
    try {
      if (agoraCallService.isServiceInitialized()) {
        await agoraCallService.switchCamera();
      }
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  }, []);

  const toggleSpeaker = useCallback(async () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      setIsSpeakerOn(newSpeakerState);
      if (agoraCallService.isServiceInitialized()) {
        await agoraCallService.setSpeakerphone(newSpeakerState);
      }
    } catch (error) {
      console.error('Error toggling speaker:', error);
    }
  }, [isSpeakerOn]);

  const swapVideoViews = useCallback(() => {
    setIsLocalVideoPrimary((prev) => !prev);
  }, []);

  const toggleCallOverlay = useCallback(() => {
    setShowCallOverlay((prev) => !prev);
  }, []);

  const minimizeCall = useCallback(() => {
    setIsCallMinimized(true);
  }, []);

  const restoreCall = useCallback(() => {
    setIsCallMinimized(false);
  }, []);

  // === Gifts during calls ===
  const loadAvailableGifts = useCallback(async () => {
    try {
      setLoadingGifts(true);
      const userGiftsResponse = await giftAPI.getUserGifts();
      const giftMap = new Map<string, { id: string; emoji: string; name: string; quantity: number }>();
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
      setAvailableGifts(Array.from(giftMap.values()).filter((g) => g.quantity > 0));
    } catch (error: any) {
      console.error('Error loading gifts:', error);
      Alert.alert('Error', error.message || 'Failed to load gifts');
    } finally {
      setLoadingGifts(false);
    }
  }, []);

  const removeGiftAnimation = useCallback((id: string) => {
    setActiveGiftAnimations((prev) => prev.filter((anim) => anim.id !== id));
  }, []);

  const sendGift = useCallback(async (giftId: string, quantity: number = 1) => {
    if (!otherUserIdRef.current) {
      Alert.alert('Error', 'Cannot send gift: missing recipient');
      return;
    }
    if (callStatus !== 'connected') {
      Alert.alert('Error', 'Cannot send gift: call is not connected');
      return;
    }
    const activeCallSessionId = currentCallSessionIdRef.current;
    if (!activeCallSessionId) {
      Alert.alert('Error', 'Cannot send gift: call session ID not found');
      return;
    }
    if (quantity <= 0 || quantity > 10) {
      Alert.alert('Error', 'Gift quantity must be between 1 and 10');
      return;
    }

    try {
      await giftAPI.sendGift({
        gift_id: giftId,
        quantity,
        recipient_id: otherUserIdRef.current,
        session_type: 'call',
        session_id: activeCallSessionId,
      });

      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(activeCallSessionId, 'gift_sent', {
          giftId,
          quantity,
          senderId: userIdRef.current,
        });
      }

      setShowGiftModal(false);

      const animationId = `gift-local-${Date.now()}-${Math.random()}`;
      const gift = availableGifts.find((g) => g.id === giftId);
      if (gift && gift.emoji) {
        setActiveGiftAnimations((prev) => [...prev, { id: animationId, emoji: gift.emoji, quantity }]);
        setTimeout(() => {
          setActiveGiftAnimations((prev) => prev.filter((anim) => anim.id !== animationId));
        }, 3000);
      }
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
  }, [callStatus, availableGifts]);

  // Initialise CallKeep once and register system-UI handlers
  useEffect(() => {
    callkeepService.onAnswerCall((callUUID) => {
      const fallbackInfo = callkeepService.getCallInfo(callUUID);
      const info = incomingCallRef.current || (fallbackInfo ? {
        callSessionId: fallbackInfo.callSessionId,
        callerName: fallbackInfo.callerName,
        callType: fallbackInfo.callType,
        conversationId: fallbackInfo.conversationId,
      } as IncomingCallInfo : null);
      if (!info) return;

      incomingCallRef.current = null;
      setIncomingCallForBanner(null);

      acceptIncomingCall(info);
      navigationRef?.current?.navigate('CallScreen');
    });

    callkeepService.onEndCall((callUUID) => {
      const info = callkeepService.getCallInfo(callUUID);
      if (!info) return;

      if (realtimeAPI.isConnected()) {
        realtimeAPI.sendCallSignal(
          info.callSessionId,
          'call_declined',
          { declinedBy: userIdRef.current, timestamp: new Date().toISOString() },
          info.conversationId,
        );
      }
      chatAPI.endCall(info.callSessionId, 'declined');

      incomingCallRef.current = null;
      setIncomingCallForBanner(null);
      setCallStatus('idle');
      setChatId(null);
      setOtherUserId(null);
      setCallerName('');
      setCallerAvatar(null);
    });

    return () => {
      callkeepService.teardown();
    };
  }, [acceptIncomingCall]);

  useEffect(() => {
    const unsubscribe = realtimeAPI.subscribe('call_event', (data) => {
      const { eventType, callData, conversationId } = data;

      if (eventType === 'incoming_call') {
        if (callData?.initiator?.id === userIdRef.current) return;
        if (incomingCallRef.current) return;

        const callConvId = conversationId || callData?.conversationId;

        const info: IncomingCallInfo = {
          callSessionId: callData.callSessionId,
          callerName:
            callData.initiator?.full_name ||
            callData.initiator?.username ||
            'Unknown Caller',
          callerAvatar: callData.initiator?.avatar_url || callData.initiator?.profile_picture,
          callType: callData.callType,
          conversationId: callConvId,
          initiatorId: callData.initiator?.id,
        };

        // Use the new full-screen incoming call flow instead of the banner
        showIncomingCall(info);

      } else if (eventType === 'call_ended') {
        if (incomingCallRef.current) {
          callkeepService.endCallkeepCall(incomingCallRef.current.callSessionId);
          incomingCallRef.current = null;
          setIncomingCallForBanner(null);
          setCallStatus('idle');
          setChatId(null);
          setOtherUserId(null);
          setCallerName('');
          setCallerAvatar(null);
        }

        const endedSessionId = callData?.callSessionId;
        if (
          currentCallSessionIdRef.current &&
          (endedSessionId === currentCallSessionIdRef.current || conversationId === chatIdRef.current)
        ) {
          const serverReason = callData?.reason as string | undefined;
          const mappedReason: 'completed' | 'declined' | 'missed' | 'cancelled' =
            serverReason === 'declined' || serverReason === 'missed' || serverReason === 'cancelled'
              ? serverReason
              : 'completed';
          endCallRef.current(mappedReason, true);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Global subscription for in-call control signals (mute/video/gift/accept/decline)
  useEffect(() => {
    const unsubscribe = realtimeAPI.subscribe('call_signal', (data) => {
      handleIncomingCallSignal(data);
    });
    return () => {
      unsubscribe();
    };
  }, [handleIncomingCallSignal]);

  const contextValue = useMemo(() => ({
    incomingCallForBanner,
    registerActiveChatId,
    unregisterActiveChatId,
    declineCallFromBanner,
    clearBannerCall,
    showIncomingCall,
    declineIncomingCall,

    callStatus,
    callType,
    isInCall,
    isCallMinimized,
    chatId,
    otherUserId,
    callerName,
    callerAvatar,
    currentCallSessionId,
    agoraConfig,
    remoteUid,
    isMuted,
    isVideoEnabled,
    remoteVideoEnabled,
    remoteMuted,
    isSpeakerOn,
    callDuration,
    callStartTime,
    showCameraPreview,
    cameraType,
    showVideoUI,
    isLocalVideoPrimary,
    showCallOverlay,
    showGiftModal,
    availableGifts,
    loadingGifts,
    activeGiftAnimations,

    startCall,
    acceptIncomingCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleSpeaker,
    swapVideoViews,
    toggleCallOverlay,
    minimizeCall,
    restoreCall,
    setShowGiftModal,
    loadAvailableGifts,
    sendGift,
    removeGiftAnimation,
    getCallStatusText,
  }), [
    incomingCallForBanner,
    callStatus,
    callType,
    isInCall,
    isCallMinimized,
    chatId,
    otherUserId,
    callerName,
    callerAvatar,
    currentCallSessionId,
    agoraConfig,
    remoteUid,
    isMuted,
    isVideoEnabled,
    remoteVideoEnabled,
    remoteMuted,
    isSpeakerOn,
    callDuration,
    callStartTime,
    showCameraPreview,
    cameraType,
    showVideoUI,
    isLocalVideoPrimary,
    showCallOverlay,
    showGiftModal,
    availableGifts,
    loadingGifts,
    activeGiftAnimations,
    startCall,
    acceptIncomingCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleSpeaker,
    swapVideoViews,
    toggleCallOverlay,
    minimizeCall,
    restoreCall,
    loadAvailableGifts,
    sendGift,
    removeGiftAnimation,
    getCallStatusText,
  ]);

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};
