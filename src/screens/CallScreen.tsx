import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RtcSurfaceView, RenderModeType } from 'react-native-agora';
import { useCallContext } from '../contexts/CallContext';
import GiftAnimation from '../components/GiftAnimation';
import AdaptiveText from '../components/AdaptiveText';

interface CallScreenParams {
  chatId: string;
  otherUserId?: string | null;
  callerName: string;
  callerAvatar?: string | null;
  callType: 'audio' | 'video';
  pendingIncomingCall?: {
    callSessionId: string;
    callerName: string;
    callType: 'audio' | 'video';
  };
}

const CallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params || {}) as Partial<CallScreenParams>;

  const {
    callStatus,
    callType,
    isInCall,
    chatId,
    callerName,
    callerAvatar,
    remoteUid,
    isMuted,
    isVideoEnabled,
    remoteVideoEnabled,
    remoteMuted,
    isSpeakerOn,
    callDuration,
    callStartTime,
    agoraConfig,
    showCameraPreview,
    showVideoUI,
    isLocalVideoPrimary,
    showCallOverlay,
    showGiftModal,
    availableGifts,
    activeGiftAnimations,
    incomingCallForBanner,
    declineIncomingCall,
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
    setShowGiftModal,
    loadAvailableGifts,
    sendGift,
    removeGiftAnimation,
    getCallStatusText,
  } = useCallContext();

  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;
  const rippleAnim3 = useRef(new Animated.Value(0)).current;
  const statusFadeAnim = useRef(new Animated.Value(1)).current;

  // If a fresh call was requested via navigation params (outgoing call) and no
  // call is currently active in context yet, kick it off.
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (hasStartedRef.current || callStatus !== 'idle') return;

    if (params.pendingIncomingCall && params.chatId) {
      hasStartedRef.current = true;
      acceptIncomingCall({
        callSessionId: params.pendingIncomingCall.callSessionId,
        callerName: params.pendingIncomingCall.callerName,
        callType: params.pendingIncomingCall.callType,
        conversationId: params.chatId,
      });
      return;
    }

    if (params.chatId) {
      hasStartedRef.current = true;
      startCall({
        chatId: params.chatId,
        otherUserId: params.otherUserId,
        callerName: params.callerName || 'Unknown',
        callerAvatar: params.callerAvatar,
        callType: params.callType || 'audio',
      });
    }
  }, [params.chatId]);

  // Auto-close this screen once the call fully ends (but never on the very
  // first render — callStatus starts as 'idle' until startCall()/acceptIncomingCall()
  // finishes updating context state, so closing on that initial idle value would
  // pop this screen immediately after opening it).
  const hasBeenActiveRef = useRef(false);
  useEffect(() => {
    if (callStatus !== 'idle') {
      hasBeenActiveRef.current = true;
      return;
    }
    if (hasBeenActiveRef.current && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [callStatus]);

  // Ripple animation while ringing/calling/incoming
  useEffect(() => {
    if (!isInCall && callStatus !== 'idle') {
      const createRippleAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, { toValue: 1, duration: 2000, useNativeDriver: true }),
          ])
        );
      };
      const r1 = createRippleAnimation(rippleAnim1, 0);
      const r2 = createRippleAnimation(rippleAnim2, 600);
      const r3 = createRippleAnimation(rippleAnim3, 1200);
      r1.start();
      r2.start();
      r3.start();
      return () => {
        r1.stop();
        r2.stop();
        r3.stop();
      };
    } else {
      rippleAnim1.setValue(0);
      rippleAnim2.setValue(0);
      rippleAnim3.setValue(0);
    }
  }, [callStatus, isInCall]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(statusFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(statusFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [callStatus]);

  const handleMinimize = () => {
    minimizeCall();
    navigation.goBack();
  };

  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const avatarSource = typeof callerAvatar === 'string' && callerAvatar
    ? { uri: callerAvatar }
    : require('../../assets/icon.png');

  // === Incoming call UI (full-screen, WhatsApp/FaceTime style) ===
  const renderIncomingCallUI = () => {
    const ripple1Scale = rippleAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
    const ripple1Opacity = rippleAnim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] });
    const ripple2Scale = rippleAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
    const ripple2Opacity = rippleAnim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.25, 0] });
    const ripple3Scale = rippleAnim3.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
    const ripple3Opacity = rippleAnim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.2, 0] });

    const handleAccept = () => {
      const info = incomingCallForBanner;
      if (!info) return;
      acceptIncomingCall(info);
    };

    return (
      <LinearGradient colors={['#0A0E27', '#1A1F3A', '#2D1B4E']} style={StyleSheet.absoluteFillObject}>
        <View style={styles.incomingCallContainer}>
          <View style={styles.incomingCallHeader}>
            <Text style={styles.incomingCallTitle}>
              {callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
            </Text>
          </View>

          <View style={styles.incomingCallContent}>
            <View style={styles.incomingAvatarWrapper}>
              <Image source={avatarSource} style={styles.incomingCallAvatar} />
              <Animated.View style={[styles.modernRipple, { transform: [{ scale: ripple1Scale }], opacity: ripple1Opacity }]} />
              <Animated.View style={[styles.modernRipple, { transform: [{ scale: ripple2Scale }], opacity: ripple2Opacity }]} />
              <Animated.View style={[styles.modernRipple, { transform: [{ scale: ripple3Scale }], opacity: ripple3Opacity }]} />
            </View>

            <AdaptiveText style={styles.incomingCallName} baseFontSize={24} minFontSize={16} maxChars={22} numberOfLines={1}>{callerName}</AdaptiveText>
            <Text style={styles.incomingCallStatus}>Tap to answer</Text>
          </View>

          <View style={styles.incomingCallActions}>
            <View style={styles.incomingCallActionColumn}>
              <TouchableOpacity
                style={styles.incomingDeclineButton}
                onPress={declineIncomingCall}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#FF3B30', '#FF1744']} style={styles.incomingActionButton}>
                  <Ionicons name="call" size={28} color="#FFFFFF" style={styles.endCallIcon} />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.incomingActionLabel}>Decline</Text>
            </View>

            <View style={styles.incomingCallActionColumn}>
              <TouchableOpacity
                style={styles.incomingAcceptButton}
                onPress={handleAccept}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#27AE60', '#2ECC71']} style={styles.incomingActionButton}>
                  <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={28} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.incomingActionLabel}>Accept</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  };

  // === Outgoing / ringing UI ===
  const renderCallingUI = () => {
    const ripple1Scale = rippleAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
    const ripple1Opacity = rippleAnim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] });
    const ripple2Scale = rippleAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
    const ripple2Opacity = rippleAnim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.25, 0] });
    const ripple3Scale = rippleAnim3.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
    const ripple3Opacity = rippleAnim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.2, 0] });

    return (
      <LinearGradient colors={['#0A0E27', '#1A1F3A', '#2D1B4E']} style={StyleSheet.absoluteFillObject}>
        {callType === 'video' && showCameraPreview && isVideoEnabled && agoraConfig && (
          <RtcSurfaceView
            style={StyleSheet.absoluteFillObject}
            zOrderMediaOverlay={true}
            canvas={{ uid: 0, renderMode: RenderModeType.RenderModeFit }}
          />
        )}

        <BlurView intensity={20} style={styles.modernCallContainer}>
          <View style={styles.modernCallHeader}>
            <TouchableOpacity style={styles.modernBackButton} onPress={handleMinimize}>
              <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modernCallTitle}>{callType === 'video' ? 'Video call' : 'Voice call'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.modernCallContent}>
            <View style={styles.modernAvatarContainer}>
              <View style={styles.modernAvatarWrapper}>
                <Image source={avatarSource} style={styles.modernCallAvatar} />
                {callStatus === 'connected' && (
                  <>
                    <Animated.View style={[styles.modernRipple, { transform: [{ scale: ripple1Scale }], opacity: ripple1Opacity }]} />
                    <Animated.View style={[styles.modernRipple, { transform: [{ scale: ripple2Scale }], opacity: ripple2Opacity }]} />
                    <Animated.View style={[styles.modernRipple, { transform: [{ scale: ripple3Scale }], opacity: ripple3Opacity }]} />
                  </>
                )}
                {callStatus === 'connecting' && (
                  <View style={styles.connectingDot}>
                    <View style={styles.connectingPulse} />
                  </View>
                )}
              </View>
            </View>

            <AdaptiveText style={styles.modernCallName} baseFontSize={32} minFontSize={20} maxChars={22} numberOfLines={1}>{callerName}</AdaptiveText>

            <Animated.View style={{ opacity: statusFadeAnim }}>
              <Text style={styles.modernCallStatus}>{getCallStatusText()}</Text>
            </Animated.View>

            {callStatus === 'connected' && callStartTime && (
              <View style={styles.modernCallDurationContainer}>
                <Text style={styles.modernCallDuration}>{formatCallDuration(callDuration)}</Text>
              </View>
            )}
          </View>

          <View style={styles.modernCallControls}>
            {callStatus === 'connected' && (
              <>
                <TouchableOpacity
                  style={[styles.modernControlButton, isMuted && styles.modernControlButtonActive]}
                  onPress={toggleMute}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={isMuted ? '#FF3B30' : '#FFFFFF'} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modernControlButton, isSpeakerOn && styles.modernControlButtonActive]}
                  onPress={toggleSpeaker}
                >
                  <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-medium'} size={22} color="#FFFFFF" />
                </TouchableOpacity>

                {callType === 'video' && (
                  <TouchableOpacity
                    style={[styles.modernControlButton, !isVideoEnabled && styles.modernControlButtonActive]}
                    onPress={toggleVideo}
                  >
                    <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity style={styles.modernEndCallButton} onPress={() => endCall('completed')}>
              <LinearGradient colors={['#FF3B30', '#FF1744']} style={styles.modernEndCallGradient}>
                <Ionicons name="call" size={26} color="#FFFFFF" style={styles.endCallIcon} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </LinearGradient>
    );
  };

  // === Connected / in-call UI ===
  const renderInCallUI = () => (
    <View style={styles.inCallOverlay}>
      {activeGiftAnimations.length > 0 && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {activeGiftAnimations.map((animation) => (
            <GiftAnimation
              key={animation.id}
              emoji={animation.emoji}
              quantity={animation.quantity}
              onComplete={() => removeGiftAnimation(animation.id)}
            />
          ))}
        </View>
      )}

      {callType === 'video' && showVideoUI && (
        <TouchableOpacity
          style={styles.remoteVideoContainer}
          activeOpacity={1}
          onPress={(e) => {
            e.stopPropagation();
            swapVideoViews();
          }}
        >
          {!isLocalVideoPrimary ? (
            <>
              {remoteUid !== null && remoteVideoEnabled ? (
                <RtcSurfaceView
                  style={StyleSheet.absoluteFillObject}
                  zOrderMediaOverlay={true}
                  canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeFit }}
                />
              ) : (
                <>
                  {isVideoEnabled && agoraConfig ? (
                    <RtcSurfaceView
                      style={StyleSheet.absoluteFillObject}
                      zOrderMediaOverlay={true}
                      canvas={{ uid: 0, renderMode: RenderModeType.RenderModeFit }}
                    />
                  ) : null}
                  <View style={styles.remoteVideoPlaceholder}>
                    <Image source={avatarSource} style={styles.remoteVideoAvatar} />
                    <Text style={styles.remoteVideoText}>
                      {remoteVideoEnabled === false ? `${callerName}'s camera is off` : `Waiting for ${callerName}'s video...`}
                    </Text>
                  </View>
                </>
              )}
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
            <>
              {isVideoEnabled && agoraConfig ? (
                <RtcSurfaceView
                  style={StyleSheet.absoluteFillObject}
                  zOrderMediaOverlay={true}
                  canvas={{ uid: 0, renderMode: RenderModeType.RenderModeFit }}
                />
              ) : (
                <View style={styles.localVideoPlaceholder}>
                  <Ionicons name="videocam-off" size={24} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.localVideoPlaceholderText}>Your Camera Off</Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
      )}

      {callType === 'video' && showVideoUI && (
        <TouchableOpacity
          style={styles.localVideoContainer}
          onPress={(e) => {
            e.stopPropagation();
            swapVideoViews();
          }}
          activeOpacity={0.8}
        >
          {!isLocalVideoPrimary ? (
            <>
              {remoteUid !== null && remoteVideoEnabled && isVideoEnabled && agoraConfig ? (
                <RtcSurfaceView
                  style={StyleSheet.absoluteFillObject}
                  zOrderMediaOverlay={true}
                  canvas={{ uid: 0, renderMode: RenderModeType.RenderModeFit }}
                />
              ) : !isVideoEnabled || !agoraConfig ? (
                <View style={styles.localVideoPlaceholder}>
                  <Ionicons name="videocam-off" size={24} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.localVideoPlaceholderText}>Camera Off</Text>
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
          ) : remoteUid !== null && remoteVideoEnabled ? (
            <RtcSurfaceView
              style={StyleSheet.absoluteFillObject}
              zOrderMediaOverlay={true}
              canvas={{ uid: remoteUid, renderMode: RenderModeType.RenderModeFit }}
            />
          ) : (
            <View style={styles.localVideoView}>
              <Image source={avatarSource} style={[styles.remoteVideoAvatar, { width: 60, height: 60, borderRadius: 30 }]} />
            </View>
          )}
        </TouchableOpacity>
      )}

      {showCallOverlay && (
        <View style={[styles.inCallHeader, callType === 'video' && showVideoUI && styles.videoCallHeader]}>
          <TouchableOpacity
            style={styles.callHeaderBackButton}
            onPress={(e) => {
              e.stopPropagation();
              handleMinimize();
            }}
          >
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.callHeaderCenter}>
            <AdaptiveText style={[styles.inCallName, callType === 'video' && showVideoUI && styles.videoCallText]} baseFontSize={16} maxChars={22} numberOfLines={1}>
              {callerName}
            </AdaptiveText>
            <Text style={[styles.inCallDuration, callType === 'video' && showVideoUI && styles.videoCallText]}>
              {formatCallDuration(callDuration)}
            </Text>
          </View>

          {callType === 'video' && showVideoUI ? (
            <TouchableOpacity
              style={styles.callHeaderFlipButton}
              onPress={(e) => {
                e.stopPropagation();
                switchCamera();
              }}
            >
              <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.callHeaderFlipButton} />
          )}
        </View>
      )}

      {showCallOverlay && (
        <View style={styles.inCallControls}>
          <TouchableOpacity
            style={[styles.callControlButton, isMuted && styles.callControlButtonActive]}
            onPress={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
          >
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#E74C3C' : '#FFFFFF'} />
          </TouchableOpacity>

          {callType === 'audio' && (
            <TouchableOpacity
              style={[styles.callControlButton, isSpeakerOn && styles.callControlButtonActive]}
              onPress={(e) => {
                e.stopPropagation();
                toggleSpeaker();
              }}
            >
              <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-medium'} size={24} color={isSpeakerOn ? '#3498DB' : '#FFFFFF'} />
            </TouchableOpacity>
          )}

          {callType === 'video' && (
            <TouchableOpacity
              style={[styles.callControlButton, !isVideoEnabled && styles.callControlButtonActive]}
              onPress={(e) => {
                e.stopPropagation();
                toggleVideo();
              }}
            >
              <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} color={!isVideoEnabled ? '#E74C3C' : '#FFFFFF'} />
            </TouchableOpacity>
          )}

          {callStatus === 'connected' && (
            <TouchableOpacity
              style={styles.callControlButton}
              onPress={(e) => {
                e.stopPropagation();
                setShowGiftModal(!showGiftModal);
                if (!showGiftModal) loadAvailableGifts();
              }}
            >
              <Ionicons name="gift" size={24} color="#FFD700" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.callControlButton, styles.endCallButtonRed]}
            onPress={(e) => {
              e.stopPropagation();
              endCall('completed');
            }}
          >
            <Ionicons name="call" size={24} color="#FFFFFF" style={styles.endCallIcon} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={isInCall ? toggleCallOverlay : undefined}
      >
        {callStatus === 'incoming'
          ? renderIncomingCallUI()
          : isInCall ? renderInCallUI() : renderCallingUI()}
      </TouchableOpacity>
    </View>
  );
};

export default CallScreen;

const styles = StyleSheet.create({
  modernCallContainer: { flex: 1, justifyContent: 'space-between', paddingTop: 50, paddingBottom: 60 },
  modernCallHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, marginBottom: 20 },
  modernBackButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  modernCallTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', letterSpacing: 0.5 },
  modernCallContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  modernAvatarContainer: { marginBottom: 30, alignItems: 'center', justifyContent: 'center' },
  modernAvatarWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  modernCallAvatar: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  modernRipple: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  connectingDot: { position: 'absolute', bottom: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#000000' },
  connectingPulse: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#34C759', opacity: 0.6 },
  modernCallName: { color: '#FFFFFF', fontSize: 32, fontWeight: '300', marginBottom: 12, letterSpacing: 0.5, textAlign: 'center' },
  modernCallStatus: { color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: '400', textAlign: 'center', marginBottom: 20 },
  modernCallDurationContainer: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  modernCallDuration: { color: 'rgba(255,255,255,0.95)', fontSize: 20, fontWeight: '300', letterSpacing: 1 },
  modernCallControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, gap: 20 },
  modernControlButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  modernControlButtonActive: { backgroundColor: 'rgba(255,59,48,0.3)', borderColor: 'rgba(255,59,48,0.5)' },
  modernEndCallButton: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
  modernEndCallGradient: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  endCallIcon: { transform: [{ rotate: '135deg' }] },
  inCallOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: 'rgba(39, 174, 96, 0.9)' },
  inCallHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16, zIndex: 10 },
  callHeaderBackButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  callHeaderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  callHeaderFlipButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  inCallName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  inCallDuration: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  inCallControls: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  callControlButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  callControlButtonActive: { backgroundColor: 'rgba(231,76,60,0.8)' },
  endCallButtonRed: { backgroundColor: '#E74C3C' },
  videoCallHeader: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 0, marginHorizontal: 0, marginTop: 0, paddingHorizontal: 16, paddingVertical: 16 },
  videoCallText: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  remoteVideoContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
  remoteVideoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  remoteVideoAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 16 },
  remoteVideoText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center' },
  remoteStatusIndicators: { position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  remoteStatusIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  remoteStatusText: { color: '#FFFFFF', fontSize: 14, marginLeft: 6, fontWeight: '500' },
  localVideoContainer: { position: 'absolute', top: 80, right: 16, width: 110, height: 150, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', zIndex: 5 },
  localVideoView: { flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  localVideoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  localVideoPlaceholderText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 },
  localVideoToggle: { position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  incomingCallContainer: { flex: 1, justifyContent: 'space-between', paddingTop: 60, paddingBottom: 80 },
  incomingCallHeader: { alignItems: 'center' },
  incomingCallTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '500', letterSpacing: 0.5 },
  incomingCallContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  incomingAvatarWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  incomingCallAvatar: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  incomingCallName: { color: '#FFFFFF', fontSize: 32, fontWeight: '300', marginBottom: 8, letterSpacing: 0.5, textAlign: 'center' },
  incomingCallStatus: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '400', textAlign: 'center' },
  incomingCallActions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 40 },
  incomingCallActionColumn: { alignItems: 'center' },
  incomingDeclineButton: { marginBottom: 12 },
  incomingAcceptButton: { marginBottom: 12 },
  incomingActionButton: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  incomingActionLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '500', marginTop: 8 },
});
