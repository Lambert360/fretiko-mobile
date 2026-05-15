import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CommentReactionBarProps {
  likesCount: number;
  giftsCount?: number;
  isLiked: boolean;
  hasGifted?: boolean;
  onLike: () => void;
  onGift: () => void;
}

const CommentReactionBar: React.FC<CommentReactionBarProps> = ({
  likesCount,
  giftsCount = 0,
  isLiked,
  hasGifted = false,
  onLike,
  onGift,
}) => {
  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike();
  };

  const handleGift = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onGift();
  };

  const formatCount = (count: number) => {
    if (count === 0) return '';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <View style={styles.container}>
      {/* Like Button */}
      <TouchableOpacity
        style={styles.reactionButton}
        onPress={handleLike}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          isLiked && styles.iconContainerActive
        ]}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={18}
            color={isLiked ? "#FF4757" : "#888"}
          />
        </View>
        {likesCount > 0 && (
          <Text style={[
            styles.countText,
            isLiked && styles.countTextActive
          ]}>
            {formatCount(likesCount)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Gift Button */}
      <TouchableOpacity
        style={styles.reactionButton}
        onPress={handleGift}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer,
          hasGifted && styles.iconContainerGifted
        ]}>
          <Ionicons
            name={hasGifted ? "gift" : "gift-outline"}
            size={18}
            color={hasGifted ? "#FFD700" : "#888"}
          />
        </View>
        {giftsCount > 0 && (
          <Text style={[
            styles.countText,
            hasGifted && styles.countTextGifted
          ]}>
            {formatCount(giftsCount)}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(255,71,87,0.2)',
  },
  iconContainerGifted: {
    backgroundColor: 'rgba(255,215,0,0.2)',
  },
  countText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  countTextActive: {
    color: '#FF4757',
  },
  countTextGifted: {
    color: '#FFD700',
  },
});

export default CommentReactionBar;
