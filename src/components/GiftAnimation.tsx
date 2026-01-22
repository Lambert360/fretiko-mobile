import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface GiftAnimationProps {
  emoji: string;
  quantity: number;
  onComplete?: () => void;
}

/**
 * Gift Animation Component
 * Displays floating emoji animations similar to TikTok/Instagram Live
 * Multiple emojis float upward and fade out
 */
const GiftAnimation: React.FC<GiftAnimationProps> = ({ emoji, quantity, onComplete }) => {
  const animations = useRef<Animated.Value[]>([]);
  const opacityAnims = useRef<Animated.Value[]>([]);
  const horizontalOffsets = useRef<number[]>([]); // Store horizontal offsets for consistency
  const [isReady, setIsReady] = useState(false); // Track when animations are set up
  
  // Create animations for each emoji instance
  useEffect(() => {
    console.log('🎁 GiftAnimation: Setting up animations for', emoji, 'x', quantity);
    const anims: Animated.Value[] = [];
    const opacities: Animated.Value[] = [];
    const offsets: number[] = [];
    
    // Create multiple instances for quantity (up to 5 visible at once)
    const instanceCount = Math.min(quantity, 5);
    
    for (let i = 0; i < instanceCount; i++) {
      anims.push(new Animated.Value(0));
      opacities.push(new Animated.Value(1));
      // Store random horizontal offset for each instance
      offsets.push((Math.random() - 0.5) * 100);
    }
    
    animations.current = anims;
    opacityAnims.current = opacities;
    horizontalOffsets.current = offsets;
    
    // Mark as ready so component re-renders
    setIsReady(true);
    
    // Start animations with slight delays for visual effect
    anims.forEach((anim, index) => {
      const startDelay = index * 100; // Stagger start times
      
      // Animation sequence: float up and fade out
      Animated.parallel([
        // Float upward animation
        Animated.timing(anim, {
          toValue: -300, // Move up 300 units
          duration: 2000 + (index * 200), // 2-3 seconds
          delay: startDelay,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Fade out animation
        Animated.sequence([
          Animated.delay(startDelay + 1500), // Stay visible for 1.5s
          Animated.timing(opacities[index], {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Call onComplete when all animations finish
        if (index === instanceCount - 1) {
          console.log('🎁 GiftAnimation: All animations completed');
          onComplete?.();
        }
      });
    });
    
    return () => {
      // Cleanup on unmount
      anims.forEach(anim => anim.stopAnimation());
      opacities.forEach(opacity => opacity.stopAnimation());
      setIsReady(false);
    };
  }, [emoji, quantity, onComplete]);

  if (!isReady || animations.current.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {animations.current.map((anim, index) => {
        const horizontalOffset = horizontalOffsets.current[index] || 0;
        
        return (
          <Animated.View
            key={index}
            style={[
              styles.emojiContainer,
              {
                transform: [
                  { translateY: anim },
                  { translateX: horizontalOffset },
                  // Add slight scale animation
                  {
                    scale: anim.interpolate({
                      inputRange: [-300, 0],
                      outputRange: [1.5, 1],
                    }),
                  },
                ],
                opacity: opacityAnims.current[index],
              },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            {quantity > 1 && index === 0 && (
              <Text style={styles.quantityText}>x{quantity}</Text>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 100, // Start from bottom area
    pointerEvents: 'none',
    zIndex: 9999, // Ensure it's above video
  },
  emojiContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  quantityText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: -10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default GiftAnimation;

