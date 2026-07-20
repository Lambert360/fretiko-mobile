import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallContext } from '../contexts/CallContext';

interface Props {
  navigationRef: React.RefObject<any>;
}

const GlobalIncomingCallBanner: React.FC<Props> = ({ navigationRef }) => {
  const { incomingCallForBanner, declineCallFromBanner, clearBannerCall, acceptIncomingCall } =
    useCallContext();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-140)).current;

  // Slide banner in/out whenever incomingCallForBanner changes
  useEffect(() => {
    if (incomingCallForBanner) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 75,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -140,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [incomingCallForBanner]);

  const handleAccept = () => {
    if (!incomingCallForBanner) return;

    const info = incomingCallForBanner;

    // Dismiss the banner immediately
    clearBannerCall();

    // Accept the call and jump straight into the full-screen CallScreen —
    // no intermediate confirmation step needed since this button already is one.
    acceptIncomingCall(info);
    navigationRef.current?.navigate('CallScreen');
  };

  // Do not render the component at all when there is no incoming call
  if (!incomingCallForBanner) return null;

  const { callerName, callerAvatar, callType } = incomingCallForBanner;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Caller avatar */}
      <View style={styles.avatarWrapper}>
        {callerAvatar ? (
          <Image source={{ uri: callerAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
        )}
        <View style={styles.callTypeBadge}>
          <Ionicons
            name={callType === 'video' ? 'videocam' : 'call'}
            size={10}
            color="#fff"
          />
        </View>
      </View>

      {/* Caller info */}
      <View style={styles.info}>
        <Text style={styles.callerName} numberOfLines={1}>
          {callerName}
        </Text>
        <Text style={styles.subtitle}>
          Incoming {callType === 'video' ? 'video' : 'voice'} call
        </Text>
      </View>

      {/* Decline */}
      <TouchableOpacity
        style={[styles.btn, styles.decline]}
        onPress={declineCallFromBanner}
        activeOpacity={0.85}
      >
        <Ionicons
          name="call"
          size={16}
          color="#fff"
          style={{ transform: [{ rotate: '135deg' }] }}
        />
      </TouchableOpacity>

      {/* Accept */}
      <TouchableOpacity
        style={[styles.btn, styles.accept]}
        onPress={handleAccept}
        activeOpacity={0.85}
      >
        <Ionicons
          name={callType === 'video' ? 'videocam' : 'call'}
          size={16}
          color="#fff"
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default GlobalIncomingCallBanner;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2c3e50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callTypeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a1a2e',
  },
  info: {
    flex: 1,
  },
  callerName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decline: {
    backgroundColor: '#e74c3c',
  },
  accept: {
    backgroundColor: '#27ae60',
  },
});
