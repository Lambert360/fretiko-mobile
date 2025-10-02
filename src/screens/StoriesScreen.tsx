import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  PanGestureHandler,
  State,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { storiesAPI, Story, StoryComment } from '../services/storiesAPI';
import { storyNotificationAPI } from '../services/storyNotificationAPI';
import { useAuth } from '../contexts/AuthContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface StoriesScreenProps {
  stories: Story[];
  initialIndex: number;
  userInfo: {
    username: string;
    avatar_url?: string;
  };
  canAddMore?: boolean;
}

const StoriesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { stories = [], initialIndex = 0, userInfo, canAddMore = false } = route.params as StoriesScreenProps;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const progressTimer = useRef<NodeJS.Timeout>();
  const hideControlsTimer = useRef<NodeJS.Timeout>();

  const currentStory = stories[currentIndex];

  const player = useVideoPlayer(currentStory?.media_url || '', (player) => {
    if (currentStory?.media_type === 'video') {
      player.loop = false;
      player.play(); // Auto-start video playback
    }
  });

  useEffect(() => {
    if (currentStory) {
      setIsLiked(currentStory.is_liked || false);
      // Reset progress for new story
      setProgress(0);

      // Start video if it's a video story
      if (currentStory.media_type === 'video' && player) {
        player.replace(currentStory.media_url);
        player.play();
        setIsPlaying(true);
      }

      // Record view (non-blocking for analytics)
      if (currentStory.id) {
        handleViewStory(currentStory.id).catch((error) => {
          console.warn('⚠️ View tracking failed (non-critical):', error.message);
        });
      }

      // Start progress timer
      startProgressTimer();

      // Hide controls after 3 seconds
      resetHideControlsTimer();
    }

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [currentIndex]);

  const startProgressTimer = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);

    const duration = currentStory?.media_type === 'video'
      ? (currentStory.duration || 15) * 1000  // Video duration in ms
      : 5000; // 5 seconds for images

    const interval = 50; // Update every 50ms for smooth progress
    const increment = (interval / duration) * 100;

    progressTimer.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + increment;
      });
    }, interval);
  };

  const resetHideControlsTimer = () => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);

    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleViewStory = async (storyId: string) => {
    // View tracking is for analytics only - make it completely silent
    try {
      console.log('🎯 handleViewStory called with:', storyId, typeof storyId);
      if (!storyId || typeof storyId !== 'string' || storyId.trim() === '') {
        console.log('🎯 Skipping view tracking - invalid ID');
        return; // Skip view tracking for invalid IDs
      }

      await storiesAPI.viewStory(storyId);
    } catch (error) {
      // Silently ignore view tracking errors - they don't affect functionality
      console.warn('View tracking failed (non-critical):', storyId);
    }
  };

  const handleNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // All stories viewed, go back
      try {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          (navigation as any).navigate('KonnectScreen');
        }
      } catch (error) {
        console.error('Navigation error:', error);
        (navigation as any).navigate('KonnectScreen');
      }
    }
  };

  const handlePreviousStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const togglePlayPause = () => {
    if (currentStory?.media_type === 'video' && player) {
      if (isPlaying) {
        player.pause();
        if (progressTimer.current) clearInterval(progressTimer.current);
      } else {
        player.play();
        startProgressTimer();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleLike = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Optimistically update UI
      const newLikedState = !isLiked;
      setIsLiked(newLikedState);

      // Update like count optimistically
      const updatedStories = [...stories];
      updatedStories[currentIndex] = {
        ...updatedStories[currentIndex],
        is_liked: newLikedState,
        like_count: newLikedState
          ? currentStory.like_count + 1
          : currentStory.like_count - 1
      };

      // Call API to toggle like
      const result = await storiesAPI.toggleLike(currentStory.id);

      // Update state with server response if different from optimistic update
      if (result.liked !== newLikedState) {
        setIsLiked(result.liked);
        updatedStories[currentIndex].is_liked = result.liked;
        // Note: Server should return updated like_count, but we'll trust our optimistic update
      }

      console.log('✅ Like toggled successfully:', result.liked);
    } catch (error) {
      // Revert optimistic update on error
      setIsLiked(!isLiked);
      console.error('❌ Error liking story:', error);
      Alert.alert('Error', 'Failed to like story');
    }
  };

  const loadComments = async () => {
    try {
      console.log('📝 Loading comments for story:', currentStory.id);
      const storyComments = await storiesAPI.getStoryComments(currentStory.id);
      console.log('📝 Loaded', storyComments.length, 'comments');
      setComments(storyComments);
    } catch (error) {
      console.error('❌ Error loading comments:', error);
      // Don't show error alert, just fail silently for comments
      setComments([]);
    }
  };

  const handleShowComments = () => {
    setShowComments(true);
    loadComments();
  };

  const handleShare = () => {
    navigation.navigate('ShareStory', {
      storyId: currentStory.id,
      storyData: {
        id: currentStory.id,
        user_id: currentStory.user_id,
        media_url: currentStory.media_url,
        media_type: currentStory.media_type,
        thumbnail_url: currentStory.thumbnail_url,
        caption: currentStory.caption,
        user_profiles: currentStory.user_profiles,
      },
    });
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const commentText = newComment.trim();
    console.log('📝 Adding comment:', commentText);

    try {
      // Optimistically add comment to UI
      const optimisticComment = {
        id: `temp-${Date.now()}`,
        story_id: currentStory.id,
        user_id: user?.id || '',
        content: commentText,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_profiles: {
          username: user?.username || 'You',
          avatar_url: user?.avatar_url
        }
      };

      setComments([...comments, optimisticComment]);
      setNewComment('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Call API to add comment
      const comment = await storiesAPI.addComment(currentStory.id, commentText);
      console.log('✅ Comment added successfully:', comment.id);

      // Replace optimistic comment with real comment
      setComments(prevComments =>
        prevComments.map(c =>
          c.id === optimisticComment.id ? comment : c
        )
      );

      // Send notification to story poster (if not own story)
      if (currentStory.user_profiles?.id !== user?.id && user) {
        console.log('📨 Sending DM notification to:', currentStory.user_profiles?.username);
        await storyNotificationAPI.sendCommentNotification({
          storyId: currentStory.id,
          storyPosterId: currentStory.user_profiles.id,
          commenterId: user.id,
          commenterUsername: user.username,
          commenterAvatarUrl: user.avatar_url,
          commentText: commentText,
          storyThumbnail: currentStory.media_type === 'image' ? currentStory.media_url : currentStory.thumbnail_url,
          storyCaption: currentStory.caption,
        });
      }

    } catch (error) {
      console.error('❌ Error adding comment:', error);

      // Remove optimistic comment on error
      setComments(prevComments =>
        prevComments.filter(c => c.id !== optimisticComment.id)
      );

      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleScreenTap = (event: any) => {
    const { locationX } = event.nativeEvent;

    // Reset hide controls timer
    resetHideControlsTimer();

    // Determine if tap is on left or right side
    if (locationX < screenWidth / 3) {
      handlePreviousStory();
    } else if (locationX > (screenWidth * 2) / 3) {
      handleNextStory();
    } else {
      // Middle tap - toggle play/pause for videos
      if (currentStory?.media_type === 'video') {
        togglePlayPause();
      }
    }
  };

  const renderStoryContent = () => {
    if (!currentStory) return null;

    if (currentStory.media_type === 'video') {
      return (
        <VideoView
          style={styles.media}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          nativeControls={false}
          contentFit="cover"
        />
      );
    } else {
      return (
        <Image
          source={{ uri: currentStory.media_url }}
          style={styles.media}
          resizeMode="cover"
        />
      );
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {stories.map((_, index) => (
        <View key={index} style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${
                  index < currentIndex
                    ? 100
                    : index === currentIndex
                    ? progress
                    : 0
                }%`,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['rgba(0,0,0,0.6)', 'transparent']}
      style={styles.headerGradient}
    >
      <SafeAreaView>
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: userInfo.avatar_url || 'https://via.placeholder.com/40' }}
              style={styles.avatar}
            />
            <Text style={styles.username}>{userInfo.username}</Text>
            <Text style={styles.timeAgo}>
              {new Date(currentStory.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            {canAddMore && (
              <TouchableOpacity
                style={styles.addStoryButton}
                onPress={() => (navigation as any).navigate('StoryUpload')}
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                try {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    (navigation as any).navigate('KonnectScreen');
                  }
                } catch (error) {
                  console.error('Navigation error:', error);
                  (navigation as any).navigate('KonnectScreen');
                }
              }}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  const renderControls = () => {
    if (!showControls) return null;

    return (
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.controlsGradient}
      >
        <View style={styles.controls}>
          {currentStory?.caption && (
            <Text style={styles.caption}>{currentStory.caption}</Text>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={24}
                color={isLiked ? "#FF4458" : "white"}
              />
              <Text style={styles.actionButtonText}>{currentStory.like_count}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShowComments}>
              <Ionicons name="chatbubble-outline" size={24} color="white" />
              <Text style={styles.actionButtonText}>Comment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="paper-plane-outline" size={24} color="white" />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  };

  const renderComments = () => {
    if (!showComments) return null;

    return (
      <View style={styles.commentsOverlay}>
        <View style={styles.commentsContainer}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            style={styles.commentsList}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Image
                  source={{ uri: item.user_profiles.avatar_url || 'https://via.placeholder.com/30' }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContent}>
                  <Text style={styles.commentUsername}>
                    {item.user_profiles.username}
                  </Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                </View>
              </View>
            )}
          />

          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Add a comment..."
              placeholderTextColor="#999"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Ionicons
                name="send"
                size={20}
                color={newComment.trim() ? "#007AFF" : "#999"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!currentStory) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No stories available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={handleScreenTap}
      >
        {renderStoryContent()}
      </TouchableOpacity>

      {renderProgressBar()}
      {renderHeader()}
      {renderControls()}
      {renderComments()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  media: {
    width: screenWidth,
    height: screenHeight,
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  progressBarBackground: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
  },
  progressBarFill: {
    height: 2,
    backgroundColor: 'white',
    borderRadius: 1,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  timeAgo: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addStoryButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  closeButton: {
    padding: 8,
  },
  controlsGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 1,
  },
  controls: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  caption: {
    color: 'white',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 24,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
  },
  commentsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.6,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 3,
  },
  commentsContainer: {
    flex: 1,
    paddingTop: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  commentsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 18,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'white',
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    padding: 10,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
});

export default StoriesScreen;