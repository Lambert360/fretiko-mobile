import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface ReactionButtonProps {
  icon: string;
  count: number;
  isActive?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  onPress: () => void;
  size?: number;
  showCount?: boolean;
  style?: any;
}

const ReactionButton: React.FC<ReactionButtonProps> = ({
  icon,
  count,
  isActive = false,
  activeColor = '#FF4757',
  inactiveColor = 'white',
  onPress,
  size = 28,
  showCount = true,
  style,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = (event: GestureResponderEvent) => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animate scale
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  // Determine icon name based on active state
  const getIconName = () => {
    if (icon === 'heart' && isActive) return 'heart';
    if (icon === 'heart' && !isActive) return 'heart-outline';
    if (icon === 'bookmark' && isActive) return 'bookmark';
    if (icon === 'bookmark' && !isActive) return 'bookmark-outline';
    return icon;
  };

  const iconColor = isActive ? activeColor : inactiveColor;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.iconBackground,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Ionicons
          name={getIconName() as any}
          size={size}
          color={iconColor}
        />
      </Animated.View>
      {showCount && (
        <Text style={styles.countText}>
          {formatCount(count)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Gift button with special styling
export interface GiftButtonProps {
  count: number;
  onPress: () => void;
  size?: number;
  showCount?: boolean;
  style?: any;
  isActive?: boolean; // New prop: true when user has sent a gift
}

export const GiftButton: React.FC<GiftButtonProps> = ({
  count,
  onPress,
  size = 28,
  showCount = true,
  style,
  isActive = false, // Default: white (not gifted)
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  // White by default, gold when user has sent a gift
  const iconColor = isActive ? '#FFD700' : '#FFFFFF';
  const backgroundColor = isActive ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
  const countColor = isActive ? '#FFD700' : '#FFFFFF';

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.giftIconBackground,
          { 
            transform: [{ scale: scaleAnim }],
            backgroundColor
          }
        ]}
      >
        <Ionicons
          name="gift"
          size={size}
          color={iconColor}
        />
      </Animated.View>
      {showCount && (
        <Text style={[styles.countText, { color: countColor }]}>
          {formatCount(count)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// Format count display (1.2K, 1M, etc.)
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K';
  }
  return count.toString();
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  giftIconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  countText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  giftCountText: {
    color: '#F39C12',
  },
});

export default ReactionButton;
