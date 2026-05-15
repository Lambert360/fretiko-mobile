import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Post, PostMedia } from '../services/postsAPI';
import ReactionButton, { GiftButton } from './ReactionButton';
import SafeImage from './SafeImage';
import PostCommentsModal from './PostCommentsModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  isActive: boolean;
  tabBarHeight?: number;
  headerHeight?: number;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onGift: (postId: string) => void;
  onBookmark: (postId: string) => void;
  onShare: (postId: string) => void;
  onUserPress: (userId: string) => void;
  hasUserGifted?: boolean; // New: true if current user sent a gift
  onGiftPress?: () => void; // New: opens gift selector modal
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  isActive,
  tabBarHeight = 70,
  headerHeight = 0,
  onLike,
  onComment,
  onGift,
  onBookmark,
  onShare,
  onUserPress,
  hasUserGifted = false,
  onGiftPress,
}) => {
  const insets = useSafeAreaInsets();
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [isPlaying, setIsPlaying] = useState(isActive);
  
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<number | null>(null);

  // Video player for video posts
  const videoPlayer = useVideoPlayer(
    post.mediaUrls[0] || '',
    (player) => {
      player.loop = true;
      if (isActive && isPlaying) {
        player.play();
      } else {
        player.pause();
      }
    }
  );

  // Handle video playback based on active state
  useEffect(() => {
    if (isActive && isPlaying) {
      videoPlayer?.play();
    } else {
      videoPlayer?.pause();
    }
  }, [isActive, isPlaying, videoPlayer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Auto-hide UI timer
  const startHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => hideUI(), 4000);
  };

  const showUI = () => {
    setIsUIVisible(true);
    Animated.timing(uiOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    startHideTimer();
  };

  const hideUI = () => {
    setIsUIVisible(false);
    Animated.timing(uiOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleScreenTap = () => {
    if (isUIVisible) {
      hideUI();
    } else {
      showUI();
    }
  };

  const handleVideoTouch = () => {
    setIsPlaying(!isPlaying);
    showUI();
  };

  // Format time for display
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  // Render media based on type
  const renderMedia = () => {
    if (post.mediaType === 'text') {
      return null;
    }

    if (post.mediaType === 'video' && post.mediaUrls.length > 0) {
      return (
        <View style={styles.videoContainer}>
          <VideoView
            style={styles.video}
            player={videoPlayer}
            allowsFullscreen
            allowsPictureInPicture
          />
        </View>
      );
    }

    if (post.mediaType === 'image' && post.mediaUrls.length > 0) {
      if (post.mediaUrls.length === 1) {
        return (
          <Image
            source={{ uri: post.mediaUrls[0] }}
            style={styles.singleImage}
            resizeMode="cover"
          />
        );
      }

      // Multiple images - grid layout
      return (
        <View style={styles.imageGrid}>
          {post.mediaUrls.slice(0, 4).map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={[
                styles.gridImage,
                post.mediaUrls.length === 2 && styles.gridImageTwo,
                post.mediaUrls.length >= 3 && styles.gridImageMulti,
              ]}
              resizeMode="cover"
            />
          ))}
          {post.mediaUrls.length > 4 && (
            <View style={styles.moreImagesOverlay}>
              <Text style={styles.moreImagesText}>
                +{post.mediaUrls.length - 4}
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (post.mediaType === 'mixed') {
      // For mixed content, show first item prominently
      return (
        <View style={styles.mixedContainer}>
          {post.mediaUrls[0]?.includes('.mp4') || post.mediaUrls[0]?.includes('.mov') ? (
            <VideoView
              style={styles.video}
              player={videoPlayer}
              allowsFullscreen
            />
          ) : (
            <Image
              source={{ uri: post.mediaUrls[0] }}
              style={styles.singleImage}
              resizeMode="cover"
            />
          )}
          {post.mediaUrls.length > 1 && (
            <View style={styles.mediaIndicator}>
              <Ionicons name="images" size={16} color="white" />
              <Text style={styles.mediaCountText}>{post.mediaUrls.length}</Text>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  // Check if this is a text-only post
  const isTextOnly = post.mediaType === 'text' || !post.mediaUrls || post.mediaUrls.length === 0;

  // Max characters for text-only posts (280 like Twitter, or 500 for more content)
  const MAX_CHARS = 500;
  const displayContent = post.content 
    ? post.content.length > MAX_CHARS 
      ? post.content.substring(0, MAX_CHARS) + '...'
      : post.content
    : '';

  return (
    <TouchableWithoutFeedback onPress={handleScreenTap}>
      <View style={styles.container}>
        {/* Media Content - Only show if not text-only */}
        {!isTextOnly && (
          <View style={styles.mediaContainer}>
            {renderMedia()}
          </View>
        )}

        {/* Text-Only Post Layout - Centered, Left-Aligned */}
        {isTextOnly ? (
          <Animated.View
            style={[
              styles.textOnlyContainer,
              { opacity: uiOpacity }
            ]}
          >
            {/* User Info Row */}
            <TouchableOpacity
              style={styles.userInfo}
              onPress={() => onUserPress(post.userId)}
            >
              <SafeImage
                source={{ uri: post.user?.avatarUrl || 'https://via.placeholder.com/50' }}
                style={styles.userAvatar}
              />
              <View style={styles.userTextContainer}>
                <View style={styles.usernameRow}>
                  <Text style={styles.username}>@{post.user?.username || 'Unknown'}</Text>
                  {post.user?.isVerified && (
                    <Ionicons name="checkmark-circle" size={14} color="#3498DB" style={styles.verifiedBadge} />
                  )}
                </View>
                <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
              </View>
            </TouchableOpacity>

            {/* Post Content - Large, Readable, Left-Aligned */}
            {displayContent && (
              <View style={styles.textOnlyContent}>
                <Text style={styles.textOnlyPostText}>
                  {displayContent}
                </Text>
              </View>
            )}
          </Animated.View>
        ) : (
          /* Media Post Layout - Bottom Left Overlay */
          <Animated.View
            style={[
              styles.contentOverlay,
              { opacity: uiOpacity }
            ]}
          >
            {/* User Info Row */}
            <TouchableOpacity
              style={styles.userInfo}
              onPress={() => onUserPress(post.userId)}
            >
              <SafeImage
                source={{ uri: post.user?.avatarUrl || 'https://via.placeholder.com/50' }}
                style={styles.userAvatar}
              />
              <View style={styles.userTextContainer}>
                <View style={styles.usernameRow}>
                  <Text style={styles.username}>@{post.user?.username || 'Unknown'}</Text>
                  {post.user?.isVerified && (
                    <Ionicons name="checkmark-circle" size={14} color="#3498DB" style={styles.verifiedBadge} />
                  )}
                </View>
                <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
              </View>
            </TouchableOpacity>

            {/* Post Content Text */}
            {post.content && (
              <View style={styles.textContent}>
                <Text style={styles.postText} numberOfLines={3}>
                  {post.content}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Reaction Buttons - Right Side */}
        <Animated.View
          style={[
            styles.reactionsContainer,
            {
              bottom: tabBarHeight + insets.bottom + 10,
              opacity: uiOpacity,
            },
          ]}
        >
          {/* Like */}
          <ReactionButton
            icon="heart"
            count={post.likesCount}
            isActive={post.isLiked}
            activeColor="#FF4757"
            onPress={() => onLike(post.id)}
          />

          {/* Comment */}
          <ReactionButton
            icon="chatbubble"
            count={post.commentsCount}
            onPress={() => setShowComments(true)}
          />

          {/* Gift */}
          <GiftButton
            count={post.giftsCount}
            onPress={onGiftPress || (() => onGift(post.id))}
            isActive={hasUserGifted}
          />

          {/* Bookmark */}
          <ReactionButton
            icon="bookmark"
            count={0}
            isActive={post.isBookmarked}
            activeColor="#FFD700"
            onPress={() => onBookmark(post.id)}
            showCount={false}
          />

          {/* Share */}
          <ReactionButton
            icon="share"
            count={post.sharesCount}
            onPress={() => onShare(post.id)}
          />
        </Animated.View>

        {/* Comments Modal */}
        <PostCommentsModal
          visible={showComments}
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => {
            // Increment comment count locally
            post.commentsCount = (post.commentsCount || 0) + 1;
          }}
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: '#000',
    position: 'relative',
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  singleImage: {
    width: screenWidth,
    height: screenHeight,
  },
  imageGrid: {
    width: screenWidth,
    height: screenHeight,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridImage: {
    width: screenWidth,
    height: screenHeight,
  },
  gridImageTwo: {
    width: screenWidth / 2,
    height: screenHeight,
  },
  gridImageMulti: {
    width: screenWidth / 2,
    height: screenHeight / 2,
  },
  moreImagesOverlay: {
    position: 'absolute',
    right: 0,
    bottom: screenHeight / 2,
    width: screenWidth / 2,
    height: screenHeight / 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mixedContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mediaIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mediaCountText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 100, // Leave space for right action buttons
    paddingHorizontal: 16,
    paddingBottom: 100, // Space for reaction buttons
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  userTextContainer: {
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  postTime: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  textContent: {
    marginTop: 8,
  },
  postText: {
    color: 'white',
    fontSize: 16,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Text-Only Post Styles
  textOnlyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingRight: 100, // Leave space for reaction buttons on right
    paddingVertical: 40,
    backgroundColor: '#000',
  },
  textOnlyContent: {
    width: '100%',
    marginTop: 20,
  },
  textOnlyPostText: {
    color: 'white',
    fontSize: 24,
    lineHeight: 36,
    fontWeight: '500',
    textAlign: 'left',
  },
  reactionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 100, // Align with content overlay
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

export default PostCard;
