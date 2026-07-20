import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCallContext } from '../contexts/CallContext';

interface Props {
  navigationRef: React.RefObject<any>;
}

const MinimizedCallBar: React.FC<Props> = ({ navigationRef }) => {
  const {
    isCallMinimized,
    isInCall,
    callStatus,
    callType,
    callerName,
    callerAvatar,
    callDuration,
    restoreCall,
    endCall,
  } = useCallContext();

  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const visible = isCallMinimized && callStatus !== 'idle';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -100,
      useNativeDriver: true,
      tension: 75,
      friction: 12,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRestore = () => {
    restoreCall();
    navigationRef.current?.navigate('CallScreen');
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity style={styles.tapArea} activeOpacity={0.85} onPress={handleRestore}>
        <View style={styles.avatarWrapper}>
          {callerAvatar ? (
            <Image source={{ uri: callerAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
          )}
          <View style={styles.callTypeBadge}>
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={9} color="#fff" />
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.callerName} numberOfLines={1}>{callerName}</Text>
          <Text style={styles.subtitle}>
            {isInCall && callStatus === 'connected' ? formatDuration(callDuration) : 'Tap to return'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.endBtn} onPress={() => endCall('completed')} activeOpacity={0.85}>
        <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default MinimizedCallBar;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2e1e',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 9998,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  tapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2c3e50', justifyContent: 'center', alignItems: 'center' },
  callTypeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#27ae60',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a2e1e',
  },
  info: { flex: 1 },
  callerName: { color: '#ffffff', fontWeight: '700', fontSize: 13, letterSpacing: 0.1 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  endBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
