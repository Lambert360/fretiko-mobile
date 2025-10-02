import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface WinnerAnnouncementProps {
  isVisible: boolean;
  winnerName: string;
  bidAmount: number;
  itemName: string;
  onAnimationEnd?: () => void;
}

/**
 * Winner Announcement Animation
 * Shows a celebratory animation when an auction item is sold
 */
/**
 * Confetti Piece Component
 * Simple confetti effect without external dependencies
 */
const ConfettiPiece: React.FC<{ delay: number; index: number }> = ({ delay, index }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * screenWidth;
    const randomRotation = Math.random() * 720; // 2 full rotations

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 3000 + Math.random() * 1000,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: randomX,
        duration: 3000 + Math.random() * 1000,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: randomRotation,
        duration: 3000,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 3000,
        delay: delay + 2000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  const color = colors[index % colors.length];
  const size = 8 + Math.random() * 6;

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          width: size,
          height: size,
          backgroundColor: color,
          opacity,
          transform: [
            { translateY },
            { translateX },
            { rotate: rotate.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              })
            },
          ],
        },
      ]}
    />
  );
};

export const WinnerAnnouncementAnimation: React.FC<WinnerAnnouncementProps> = ({
  isVisible,
  winnerName,
  bidAmount,
  itemName,
  onAnimationEnd,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (isVisible) {
      // Entrance animation sequence
      Animated.sequence([
        // Fade in and scale up
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        // Slide down details
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          delay: 200,
          useNativeDriver: true,
        }),
        // Hold for 3 seconds
        Animated.delay(3000),
        // Fade out
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset animations
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.3);
        slideAnim.setValue(50);

        if (onAnimationEnd) {
          onAnimationEnd();
        }
      });
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      {/* Custom Confetti Animation */}
      {Array.from({ length: 50 }).map((_, i) => (
        <ConfettiPiece key={i} delay={i * 20} index={i} />
      ))}

      {/* Winner Announcement Card */}
      <Animated.View
        style={[
          styles.announcementCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Trophy Icon */}
        <View style={styles.trophyContainer}>
          <Ionicons name="trophy" size={80} color="#FFD700" />
        </View>

        {/* SOLD! Text */}
        <Text style={styles.soldText}>SOLD!</Text>

        {/* Winner Details */}
        <Animated.View
          style={[
            styles.detailsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.detailRow}>
            <Ionicons name="person" size={24} color="#8E44AD" />
            <Text style={styles.detailLabel}>Winner:</Text>
            <Text style={styles.detailValue}>{winnerName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="pricetag" size={24} color="#4CAF50" />
            <Text style={styles.detailLabel}>Item:</Text>
            <Text style={styles.detailValue}>{itemName}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="cash" size={24} color="#FF9800" />
            <Text style={styles.detailLabel}>Final Bid:</Text>
            <Text style={styles.priceValue}>₣{bidAmount.toLocaleString()}</Text>
          </View>
        </Animated.View>

        {/* Congratulations Banner */}
        <View style={styles.congratsBanner}>
          <Text style={styles.congratsText}>🎉 Congratulations! 🎉</Text>
        </View>
      </Animated.View>

      {/* Sparkle Effects */}
      <View style={styles.sparklesContainer}>
        {[...Array(8)].map((_, i) => (
          <SparkleEffect key={i} delay={i * 100} />
        ))}
      </View>
    </View>
  );
};

/**
 * Individual Sparkle Effect
 */
const SparkleEffect: React.FC<{ delay: number }> = ({ delay }) => {
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(sparkleOpacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(sparkleOpacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ])
    ).start();
  }, [delay]);

  const randomX = Math.random() * screenWidth;
  const randomY = Math.random() * screenHeight * 0.6;

  return (
    <Animated.View
      style={[
        styles.sparkle,
        {
          left: randomX,
          top: randomY,
          opacity: sparkleOpacity,
          transform: [
            {
              scale: sparkleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1.5],
              }),
            },
          ],
        },
      ]}
    >
      <Ionicons name="star" size={20} color="#FFD700" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    left: screenWidth / 2,
    borderRadius: 4,
  },
  announcementCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 32,
    width: screenWidth * 0.85,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  trophyContainer: {
    marginBottom: 16,
  },
  soldText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#8E44AD',
    marginBottom: 24,
    textShadowColor: 'rgba(142, 68, 173, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  detailsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    flex: 1,
  },
  priceValue: {
    fontSize: 20,
    color: '#FF9800',
    fontWeight: 'bold',
    flex: 1,
  },
  congratsBanner: {
    backgroundColor: '#8E44AD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 8,
  },
  congratsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sparklesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  sparkle: {
    position: 'absolute',
  },
});
