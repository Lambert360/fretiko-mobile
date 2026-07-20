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
import AdaptiveText from './AdaptiveText';
import PostCommentsModal from './PostCommentsModal';
import RichText from './RichText';

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
  onDoubleTap?: (post: Post) => void; // New: navigate to post details on double-tap
  onLikesPress?: (postId: string) => void;
  onGiftersPress?: (postId: string) => void;
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
  onDoubleTap,
  onLikesPress,
  onGiftersPress,
}) => {
  const insets = useSafeAreaInsets();
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [isPlaying, setIsPlaying] = useState(isActive);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number | null>(null);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefer processed H.264 URLs when available
  const effectiveMediaUrls = post.processedMediaUrls?.length
    ? post.processedMediaUrls
    : post.mediaUrls;

  // Video player for video posts
  const videoPlayer = useVideoPlayer(
    effectiveMediaUrls[0] || '',
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

  // Auto-play when card becomes active, pause when it is no longer active
  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isActive]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
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

  // Handle single vs double tap on the whole card
  const handleCardTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 250;

    if (lastTapTimeRef.current && now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      // Detected a double tap: cancel pending single-tap action
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = null;

      if (onDoubleTap) {
        onDoubleTap(post);
      }
      return;
    }

    // First tap: schedule single-tap behavior
    lastTapTimeRef.current = now;
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
    }

    singleTapTimeoutRef.current = setTimeout(() => {
      handleScreenTap();
      singleTapTimeoutRef.current = null;
      lastTapTimeRef.current = null;
    }, DOUBLE_TAP_DELAY);
  };

  const handlePlayPausePress = (event?: any) => {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    setIsPlaying(prev => !prev);
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

    if (post.mediaType === 'video' && effectiveMediaUrls.length > 0) {
      return (
        <View style={styles.videoContainer}>
          <VideoView
            style={styles.video}
            player={videoPlayer}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls={false}
            pointerEvents="none"
            contentFit="contain"
          />
        </View>
      );
    }

    if (post.mediaType === 'image' && effectiveMediaUrls.length > 0) {
      if (effectiveMediaUrls.length === 1) {
        return (
          <Image
            source={{ uri: effectiveMediaUrls[0] }}
            style={styles.singleImage}
            resizeMode="contain"
          />
        );
      }

      // Multiple images - grid layout
      return (
        <View style={styles.imageGrid}>
          {effectiveMediaUrls.slice(0, 4).map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={[
                styles.gridImage,
                effectiveMediaUrls.length === 2 && styles.gridImageTwo,
                effectiveMediaUrls.length >= 3 && styles.gridImageMulti,
              ]}
              resizeMode="contain"
            />
          ))}
          {effectiveMediaUrls.length > 4 && (
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
          {effectiveMediaUrls[0]?.includes('.mp4') || effectiveMediaUrls[0]?.includes('.mov') ? (
            <VideoView
              style={styles.video}
              player={videoPlayer}
              allowsFullscreen
              nativeControls={false}
              pointerEvents="none"
            />
          ) : (
            <Image
              source={{ uri: effectiveMediaUrls[0] }}
              style={styles.singleImage}
              resizeMode="contain"
            />
          )}
          {effectiveMediaUrls.length > 1 && (
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

  // For media posts, consider caption "long" and show See more if over this length
  const hasLongCaption = !!post.content && post.content.length > 120;

  return (
    <TouchableWithoutFeedback onPress={handleCardTap}>
      <View style={styles.container}>
        {/* Media Content - Only show if not text-only */}
        {!isTextOnly && (
          <View style={styles.mediaContainer}>
            {renderMedia()}
          </View>
        )}

        {!isTextOnly && (post.mediaType === 'video' || post.mediaType === 'mixed') && (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.playPauseContainer,
              { opacity: uiOpacity },
            ]}
          >
            <TouchableOpacity
              style={styles.playPauseButton}
              activeOpacity={0.8}
              onPress={handlePlayPausePress}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Text-Only Post Layout - Centered, Left-Aligned */}
        {isTextOnly && (
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
                  <AdaptiveText style={styles.username} baseFontSize={16} maxChars={15} numberOfLines={1}>@{post.user?.username || 'Unknown'}</AdaptiveText>
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
        )}

        {/* Bottom Cluster — single absolute anchor for left content + right reactions */}
        <Animated.View
          style={[
            styles.bottomCluster,
            {
              // Anchor above the bottom tab bar + safe area, mirroring VideoCard
              bottom: tabBarHeight + insets.bottom - 10,
              opacity: uiOpacity,
            },
          ]}
        >
          {/* Left column: user info + caption (media posts only) */}
          {!isTextOnly && (
            <View style={styles.leftColumnContainer}>
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
                    <AdaptiveText style={styles.username} baseFontSize={16} maxChars={15} numberOfLines={1}>@{post.user?.username || 'Unknown'}</AdaptiveText>
                    {post.user?.isVerified && (
                      <Ionicons name="checkmark-circle" size={14} color="#3498DB" style={styles.verifiedBadge} />
                    )}
                  </View>
                  <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
                </View>
              </TouchableOpacity>

              {post.content && (
                <View style={styles.descriptionBox}>
                  <RichText
                    style={styles.postText as any}
                    numberOfLines={isDescriptionExpanded ? undefined : 3}
                  >
                    {post.content || ''}
                  </RichText>

                  {hasLongCaption && !isDescriptionExpanded && (
                    <TouchableOpacity
                      onPress={() => setIsDescriptionExpanded(true)}
                      style={styles.seeMoreButton}
                    >
                      <Text style={styles.seeMoreText}>See more</Text>
                    </TouchableOpacity>
                  )}

                  {hasLongCaption && isDescriptionExpanded && (
                    <TouchableOpacity
                      onPress={() => setIsDescriptionExpanded(false)}
                      style={styles.seeMoreButton}
                    >
                      <Text style={styles.seeMoreText}>See less</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Spacer for text-only posts so reactions stay on the right */}
          {isTextOnly && <View style={{ flex: 1 }} />}

          {/* Right column: reaction buttons */}
          <View style={styles.reactionsContainer}>
            <ReactionButton
              icon="heart"
              count={post.likesCount}
              isActive={post.isLiked}
              activeColor="#FF4757"
              onPress={() => onLike(post.id)}
              onCountPress={post.likesCount > 0 ? () => onLikesPress?.(post.id) : undefined}
            />

            <ReactionButton
              icon="chatbubble"
              count={post.commentsCount}
              onPress={() => setShowComments(true)}
            />

            <GiftButton
              count={post.giftsCount}
              onPress={onGiftPress || (() => onGift(post.id))}
              isActive={hasUserGifted}
              onCountPress={post.giftsCount > 0 ? () => onGiftersPress?.(post.id) : undefined}
            />

            <ReactionButton
              icon="bookmark"
              count={0}
              isActive={post.isBookmarked}
              activeColor="#FFD700"
              onPress={() => onBookmark(post.id)}
              showCount={false}
            />

            <ReactionButton
              icon="share"
              count={post.sharesCount}
              onPress={() => onShare(post.id)}
            />
          </View>
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
  playPauseContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 60,
    marginTop: -30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomCluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  leftColumnContainer: {
    flex: 1,
    flexDirection: 'column',
    marginRight: 12,
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
  descriptionBox: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  seeMoreButton: {
    marginTop: 4,
  },
  seeMoreText: {
    color: '#9ECFFF',
    fontSize: 12,
    fontWeight: '500',
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
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
});

export default PostCard;
