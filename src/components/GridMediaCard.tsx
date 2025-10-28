import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * GridMediaCard Component
 *
 * Purpose: Display product images or service video thumbnails in a compact 3-column grid
 *
 * What it does:
 * - Shows only the media (image or video thumbnail) in a square card
 * - Adapts to screen size for perfect 3-column grid layout
 * - Tappable - navigates to details screen
 * - Long-press - shows action options (view, delete)
 * - Displays a play icon for video content
 *
 * What's needed to use it:
 * - imageUrl: URL of the product image or service video thumbnail
 * - onPress: Function to navigate to details screen
 * - onLongPress: Function to show action options
 * - isVideo: (optional) Boolean to show play icon overlay for videos
 */

interface GridMediaCardProps {
  imageUrl: string;
  onPress: () => void;
  onLongPress: () => void;
  isVideo?: boolean;
}

export const GridMediaCard: React.FC<GridMediaCardProps> = ({
  imageUrl,
  onPress,
  onLongPress,
  isVideo = false,
}) => {
  // Calculate card size: screen width minus horizontal padding (40px) and gaps between cards (20px for 2 gaps)
  // Divided by 3 for 3 columns
  const cardSize = (SCREEN_WIDTH - 40 - 20) / 3;

  return (
    <TouchableOpacity
      style={[styles.container, { width: cardSize, height: cardSize }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Media Image */}
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Play Icon Overlay for Videos */}
      {isVideo && (
        <View style={styles.playIconContainer}>
          <View style={styles.playIconBackground}>
            <Ionicons name="play" size={24} color="#FFFFFF" />
          </View>
        </View>
      )}

      {/* Subtle Border/Shadow Effect */}
      <View style={styles.cardOverlay} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    marginBottom: 10,
    position: 'relative',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // Elevation for Android
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  playIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    pointerEvents: 'none',
  },
});
