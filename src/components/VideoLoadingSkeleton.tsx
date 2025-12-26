import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoLoadingSkeletonProps {
  width?: number;
  height?: number;
  showIcon?: boolean;
  variant?: 'product' | 'service';
}

/**
 * Loading skeleton component for videos
 */
export const VideoLoadingSkeleton: React.FC<VideoLoadingSkeletonProps> = ({
  width = screenWidth,
  height = screenHeight,
  showIcon = true,
  variant = 'service',
}) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Animated background */}
      <Animated.View
        style={[
          styles.background,
          {
            opacity: pulseAnim,
            backgroundColor: variant === 'service' ? '#1a1a1a' : '#0a0a0a',
          },
        ]}
      />

      {/* Loading icon */}
      {showIcon && (
        <View style={styles.iconContainer}>
          <Ionicons name="videocam" size={48} color="#888" />
          <Animated.Text
            style={[
              styles.loadingText,
              {
                opacity: pulseAnim,
              },
            ]}
          >
            Loading video...
          </Animated.Text>
        </View>
      )}

      {/* Shimmer effect */}
      <Animated.View
        style={[
          styles.shimmer,
          {
            opacity: pulseAnim,
          },
        ]}
      />
    </View>
  );
};

/**
 * Compact loading skeleton for product video cards
 */
export const ProductVideoLoadingSkeleton: React.FC<{ width?: number; height?: number }> = ({
  width = screenWidth * 0.4,
  height = 200,
}) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.productContainer, { width, height }]}>
      <Animated.View
        style={[
          styles.productBackground,
          {
            opacity: pulseAnim,
          },
        ]}
      />
      <View style={styles.productIconContainer}>
        <Ionicons name="play-circle" size={32} color="#888" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  iconContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: -100,
    width: 100,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ skewX: '-20deg' }],
  },
  productContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: 6,
  },
  productBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
  },
  productIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    zIndex: 1,
  },
});

