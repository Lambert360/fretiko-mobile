import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  ImageStyle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoFeedItem } from '../services/servicesAPI';
import SafeImage from './SafeImage';
import AdaptiveText from './AdaptiveText';
import RichText from './RichText';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;

interface VideoCardProps {
  item: VideoFeedItem;
  isActive: boolean;
  isPlaying: boolean;
  tabBarHeight?: number;
  headerHeight?: number;
  onVideoTouch?: () => void;
  onTogglePlay?: (itemId: string) => void;
  onLike?: (itemId: string) => void;
  onLikesPress?: (itemId: string) => void;
  onComment?: (itemId: string) => void;
  onBookmark?: (itemId: string) => void;
  onShare?: (itemId: string) => void;
  onBook?: (itemId: string) => void;
  onVendorPress?: (userId: string) => void;
  onSwipePastEnd?: () => void;
  onDoubleTap?: (item: VideoFeedItem) => void;
}

const VideoCardVideoPlayer: React.FC<{ uri: string; isPlaying: boolean; style: any }> = ({ uri, isPlaying, style }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  });

  useEffect(() => {
    if (isPlaying) {
      player?.play();
    } else {
      player?.pause();
    }
  }, [isPlaying, player]);

  return (
    <VideoView
      style={style}
      player={player}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
};

const VideoCard: React.FC<VideoCardProps> = ({
  item,
  isActive,
  isPlaying,
  tabBarHeight = TAB_BAR_HEIGHT,
  headerHeight = 0,
  onVideoTouch,
  onTogglePlay,
  onLike,
  onLikesPress,
  onComment,
  onBookmark,
  onShare,
  onBook,
  onVendorPress,
  onSwipePastEnd,
  onDoubleTap,
}) => {
  console.log(' VideoCard rendering for:', item.title, 'ID:', item.id);
  const insets = useSafeAreaInsets();
  
  // UI State Management
  const [isUIVisible, setIsUIVisible] = useState(true);
  const [isPlayButtonVisible, setIsPlayButtonVisible] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  // Animation References
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const playButtonOpacity = useRef(new Animated.Value(0)).current;
  
  // Timers
  const hideTimer = useRef<number | null>(null);
  const playButtonTimer = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number | null>(null);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (playButtonTimer.current) clearTimeout(playButtonTimer.current);
      if (endPromptTimerRef.current) clearTimeout(endPromptTimerRef.current);
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
    };
  }, []);

  // Debug video playback state
  useEffect(() => {
    const shouldPlayVideo = isActive && isPlaying;
    if (shouldPlayVideo) {
      console.log(` Starting video playback for ${item.videoUri}`);
    } else {
      console.log(` Pausing video for ${item.videoUri}`);
    }
  }, [isActive, isPlaying, item.videoUri]);

  // Auto-hide UI timer with more natural timing
  const startHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => hideUI(), 4000); // More natural 4 seconds
  };

  const showUI = () => {
    setIsUIVisible(true);
    Animated.timing(uiOpacity, { 
      toValue: 1, 
      duration: 300, // Faster show animation
      useNativeDriver: true 
    }).start();
    startHideTimer();
  };

  const hideUI = () => {
    setIsUIVisible(false);
    Animated.timing(uiOpacity, { 
      toValue: 0, 
      duration: 800, // Slower, more natural fade out
      useNativeDriver: true 
    }).start();
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const runSingleTapActions = () => {
    if (isUIVisible) {
      hideUI();
    } else {
      showUI();
    }

    // Show play button temporarily with more natural animation
    setIsPlayButtonVisible(true);
    Animated.spring(playButtonOpacity, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    // Hide play button after 2.5 seconds (more natural timing)
    if (playButtonTimer.current) {
      clearTimeout(playButtonTimer.current);
    }
    playButtonTimer.current = setTimeout(() => {
      setIsPlayButtonVisible(false);
      Animated.timing(playButtonOpacity, {
        toValue: 0,
        duration: 500, // Smoother fade out
        useNativeDriver: true,
      }).start();
    }, 2500);

    onVideoTouch?.();
  };

  const handleVideoTouch = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 250;

    if (lastTapTimeRef.current && now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = null;
      onDoubleTap?.(item);
      return;
    }

    lastTapTimeRef.current = now;
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
    }
    singleTapTimeoutRef.current = setTimeout(() => {
      runSingleTapActions();
      singleTapTimeoutRef.current = null;
      lastTapTimeRef.current = null;
    }, DOUBLE_TAP_DELAY);
  };

  const isVideoUrl = (url: string) =>
    /^.*\.(mp4|mov|m4v|3gp|avi|mkv)(\?.*)?$/i.test(url);

  const getVideoStyle = (): ViewStyle => {
    // Use parent container dimensions - the Reels wrapper sets the exact height
    const containerHeight = screenHeight - tabBarHeight - insets.bottom;
    return {
      width: screenWidth,
      height: containerHeight,
    };
  };

  // Prefer processed H.264 URLs when available
  const effectiveMediaUrls = item.processedMediaUrls?.length
    ? item.processedMediaUrls
    : item.mediaUrls?.length
    ? item.mediaUrls
    : item.videoUri
    ? [item.videoUri]
    : [];

  // Multi-media pagination
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showEndPrompt, setShowEndPrompt] = useState(false);

  const endPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endPromptVisibleRef = useRef(false);
  const endDragHandledRef = useRef(false);

  useEffect(() => {
    setCurrentMediaIndex(0);
    setShowEndPrompt(false);
    endPromptVisibleRef.current = false;
    endDragHandledRef.current = false;
    if (endPromptTimerRef.current) {
      clearTimeout(endPromptTimerRef.current);
      endPromptTimerRef.current = null;
    }
  }, [item.id]);

  const handleMediaScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / screenWidth);
    setCurrentMediaIndex(newIndex);
    if (newIndex !== effectiveMediaUrls.length - 1) {
      endPromptVisibleRef.current = false;
      setShowEndPrompt(false);
      if (endPromptTimerRef.current) {
        clearTimeout(endPromptTimerRef.current);
        endPromptTimerRef.current = null;
      }
    }
  };

  const handleScrollBeginDrag = () => {
    endDragHandledRef.current = false;
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (effectiveMediaUrls.length <= 1) return;
    if (currentMediaIndex !== effectiveMediaUrls.length - 1) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    const lastOffset = (effectiveMediaUrls.length - 1) * screenWidth;
    const overscroll = offsetX - lastOffset;
    const threshold = screenWidth * 0.12;

    if (overscroll > threshold) {
      if (!endDragHandledRef.current) {
        if (endPromptVisibleRef.current) {
          onSwipePastEnd?.();
        } else {
          endPromptVisibleRef.current = true;
          setShowEndPrompt(true);
          if (endPromptTimerRef.current) {
            clearTimeout(endPromptTimerRef.current);
          }
          endPromptTimerRef.current = setTimeout(() => {
            endPromptVisibleRef.current = false;
            setShowEndPrompt(false);
          }, 2500);
        }
        endDragHandledRef.current = true;
      }
    }
  };

  const togglePlayPause = (e: any) => {
    e.stopPropagation();
    
    // Notify parent to toggle play state (dedicated callback for playback control)
    onTogglePlay?.(item.id);
    
    // Keep UI visible while user interacts with controls
    if (!isUIVisible) {
      showUI();
    } else {
      startHideTimer(); // Reset hide timer
    }
    
    // Keep play button visible for a bit longer after interaction
    if (playButtonTimer.current) {
      clearTimeout(playButtonTimer.current);
    }
    playButtonTimer.current = setTimeout(() => {
      setIsPlayButtonVisible(false);
      Animated.timing(playButtonOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 3000);
  };

  const handleLike = () => {
    onLike?.(item.id);
  };

  const handleComment = () => {
    onComment?.(item.id);
  };

  const handleBookmark = () => {
    onBookmark?.(item.id);
  };

  const handleShare = () => {
    onShare?.(item.id);
  };

  const handleBook = () => {
    onBook?.(item.id);
  };

  const renderMedia = () => {
    if (effectiveMediaUrls.length === 0) {
      return (
        <View style={styles.videoContainer}>
          <SafeImage
            source={item.thumbnail ? { uri: item.thumbnail } : undefined}
            fallbackText="No preview"
            style={getVideoStyle() as ImageStyle}
          />
        </View>
      );
    }

    if (effectiveMediaUrls.length === 1) {
      const url = effectiveMediaUrls[0];
      return (
        <TouchableWithoutFeedback onPress={handleVideoTouch}>
          <View style={styles.videoContainer}>
            {isVideoUrl(url) ? (
              <VideoCardVideoPlayer uri={url} isPlaying={isActive && isPlaying} style={getVideoStyle()} />
            ) : (
              <SafeImage source={{ uri: url }} fallbackText="No preview" style={getVideoStyle() as ImageStyle} />
            )}
          </View>
        </TouchableWithoutFeedback>
      );
    }

    return (
      <>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMediaScroll}
          style={styles.mediaPager}
          contentContainerStyle={{ flexDirection: 'row' }}
        >
          {effectiveMediaUrls.map((url, index) => (
            <TouchableWithoutFeedback key={`${item.id}-media-${index}`} onPress={handleVideoTouch}>
              <View style={styles.mediaPage}>
                {isVideoUrl(url) ? (
                  index === currentMediaIndex ? (
                    <VideoCardVideoPlayer uri={url} isPlaying={isActive && isPlaying} style={getVideoStyle()} />
                  ) : (
                    <View style={[getVideoStyle() as any, styles.videoPlaceholder]}>
                      {item.thumbnail ? (
                        <>
                          <SafeImage
                            source={{ uri: item.thumbnail }}
                            fallbackText="No preview"
                            style={getVideoStyle() as ImageStyle}
                          />
                          <View style={styles.playIconOverlay}>
                            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
                          </View>
                        </>
                      ) : (
                        <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
                      )}
                    </View>
                  )
                ) : (
                  <SafeImage source={{ uri: url }} fallbackText="No preview" style={getVideoStyle() as ImageStyle} />
                )}
              </View>
            </TouchableWithoutFeedback>
          ))}
        </ScrollView>

        <View style={[styles.pageIndicator, { top: insets.top + 80 }]}>
          <Ionicons name="images" size={14} color="white" />
          <Text style={styles.pageIndicatorText}>
            {currentMediaIndex + 1} / {effectiveMediaUrls.length}
          </Text>
        </View>

        {showEndPrompt && (
          <View style={styles.endPrompt}>
            <Ionicons name="arrow-forward" size={20} color="white" />
            <Text style={styles.endPromptText}>Swipe again to switch to Product tab</Text>
          </View>
        )}
      </>
    );
  };

  // Auto-hide UI when video is active
  useEffect(() => {
    if (isActive && isUIVisible) {
      startHideTimer();
    } else if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, [isActive, isUIVisible]);

  const hasLongDescription = String(item.description || '').length > 120;

  return (
    <View style={styles.container}>
        {renderMedia()}
        
        {/* Play/Pause Button Overlay */}
        {isPlayButtonVisible && effectiveMediaUrls.length > 0 && isVideoUrl(effectiveMediaUrls[currentMediaIndex]) && (
          <Animated.View style={[styles.playButtonContainer, { opacity: playButtonOpacity }]}>
            <TouchableOpacity
              onPress={togglePlayPause}
              style={styles.playButton}
            >
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={30} 
                color="white" 
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* 2, 3 & 4. Bottom UI Cluster — single absolute anchor for both columns */}
        <Animated.View
          pointerEvents="box-none"
          style={[
          styles.bottomCluster,
          {
            bottom: tabBarHeight + insets.bottom + 10,
            opacity: uiOpacity
          }
        ]}>
          {/* Gradient shade so content stays readable on any background */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
          {/* Left Column: User Info + Description + Actions */}
          <View style={styles.leftColumnContainer}>
            {/* User Info */}
            <TouchableOpacity 
              style={styles.userInfo}
              onPress={() => onVendorPress?.(item.userId)}
            >
              <SafeImage
                source={{ uri: item.userAvatar }}
                fallbackText=""
                showFallbackIcon={false}
                style={styles.userAvatar}
              />
              <View style={styles.userDetails}>
                <AdaptiveText style={styles.username} baseFontSize={16} maxChars={15} numberOfLines={1}>@{item.username || 'user'}</AdaptiveText>
                <View style={styles.userBadgeContainer}>
                  <View style={styles.proBadge}>
                    <Text style={styles.proText}>Pro</Text>
                  </View>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : '0.0'}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Description */}
            <View
              style={[
                styles.descriptionBox,
                isDescriptionExpanded && styles.descriptionBoxExpanded,
              ]}
            >
              {isDescriptionExpanded ? (
                <ScrollView
                  style={styles.descriptionScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  <RichText style={styles.description}>
                    {String(item.description || '')}
                  </RichText>
                </ScrollView>
              ) : (
                <RichText style={styles.description} numberOfLines={3}>
                  {String(item.description || '')}
                </RichText>
              )}

              {hasLongDescription && !isDescriptionExpanded && (
                <TouchableOpacity
                  onPress={() => setIsDescriptionExpanded(true)}
                  style={styles.seeMoreButton}
                >
                  <Text style={styles.seeMoreText}>See more</Text>
                </TouchableOpacity>
              )}

              {hasLongDescription && isDescriptionExpanded && (
                <TouchableOpacity
                  onPress={() => setIsDescriptionExpanded(false)}
                  style={styles.seeMoreButton}
                >
                  <Text style={styles.seeMoreText}>See less</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Service Details */}
            <View style={styles.serviceTagsContainer}>
              <View style={styles.serviceTag}>
                <Ionicons name="location-outline" size={14} color="#B0B0B0" />
                <Text style={styles.serviceTagText}>{String(item.location || 'Unknown')}</Text>
              </View>
            </View>

            {/* Price and Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <View style={styles.priceContainer}>
                {item.originalPrice && Number(item.originalPrice) > Number(item.price) ? (
                  <>
                    <Text style={styles.originalPrice}>₣{Number(item.originalPrice).toFixed(2)}</Text>
                    <Text style={styles.currentPrice}>₣{Number(item.price || 0).toFixed(2)}</Text>
                  </>
                ) : (
                  <Text style={styles.currentPrice}>₣{Number(item.price || 0).toFixed(2)}</Text>
                )}
              </View>

              <TouchableOpacity 
                style={styles.chatButton}
                onPress={() => onVendorPress?.(item.userId)}
              >
                <Ionicons name="chatbubble-outline" size={16} color="white" />
                <Text style={styles.chatButtonText}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.bookButton}
                onPress={handleBook}
              >
                <Ionicons name="calendar-outline" size={16} color="white" />
                <Text style={styles.bookButtonText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Column: Reaction Icons */}
          <View style={styles.rightActionsContainer}>
            {/* Like Button */}
            <View style={styles.rightActionButton}>
              <TouchableOpacity onPress={handleLike}>
                <View style={styles.iconBackground}>
                  <Ionicons 
                    name={item.isLiked ? 'heart' : 'heart-outline'} 
                    size={28} 
                    color={item.isLiked ? '#FF4757' : 'white'} 
                  />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Number(item.likes) > 0 ? onLikesPress?.(item.id) : undefined}>
                <Text style={styles.rightActionText}>{String(item.likes || 0)}</Text>
              </TouchableOpacity>
            </View>

            {/* Comment Button */}
            <TouchableOpacity 
              style={styles.rightActionButton} 
              onPress={handleComment}
            >
              <View style={styles.iconBackground}>
                <Ionicons name="chatbubble-outline" size={28} color="white" />
              </View>
              <Text style={styles.rightActionText}>{String(item.comments || 0)}</Text>
            </TouchableOpacity>

            {/* Bookmark Button */}
            <TouchableOpacity 
              style={styles.rightActionButton} 
              onPress={handleBookmark}
            >
              <View style={styles.iconBackground}>
                <Ionicons 
                  name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'} 
                  size={28} 
                  color={item.isBookmarked ? '#FFD700' : 'white'} 
                />
              </View>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity 
              style={styles.rightActionButton} 
              onPress={handleShare}
            >
              <View style={styles.iconBackground}>
                <Ionicons name="share-outline" size={28} color="white" />
              </View>
              <Text style={styles.rightActionText}>{String(item.shares || 0)}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: screenWidth,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  mediaPager: {
    width: '100%',
    height: '100%',
  },
  mediaPage: {
    width: screenWidth,
    height: '100%',
  },
  videoPlaceholder: {
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageIndicator: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 20,
    elevation: 20,
  },
  pageIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  endPrompt: {
    position: 'absolute',
    bottom: 140,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    zIndex: 3,
  },
  endPromptText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  playButtonContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
    pointerEvents: 'box-none',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uiElementsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  serviceInfoSection: {
    flex: 1,
    marginRight: 12,
  },
  actionButtonsContainer: {
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'white',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  proBadge: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  description: {
    color: 'white',
    fontSize: 15,
    lineHeight: 20,
  },
  descriptionBox: {
    marginBottom: 8,
    maxWidth: '100%',
  },
  descriptionBoxExpanded: {
    maxHeight: 180,
  },
  descriptionScroll: {
    maxHeight: 150,
  },
  seeMoreButton: {
    marginTop: 4,
  },
  seeMoreText: {
    color: '#9ECFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  locationText: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalPrice: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  currentPrice: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  chatButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomCluster: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  leftColumnContainer: {
    flex: 1,
    flexDirection: 'column',
    marginRight: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userDetails: {
    flex: 1,
  },
  userBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  descriptionContainer: {
    maxWidth: '100%',
  },
  serviceTagsContainer: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceTagText: {
    color: '#B0B0B0',
    fontSize: 12,
    marginLeft: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  rightActionsContainer: {
    alignItems: 'center',
  },
  rightActionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  rightActionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default VideoCard;