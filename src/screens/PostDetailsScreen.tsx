import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Modal,
  Share as RNShare,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { postsAPI, Post, PostInteraction } from '../services/postsAPI';
import { contentReportsAPI, ReportCategory } from '../services/contentReportsAPI';
import { giftAPI, UserGift } from '../services/giftAPI';
import { userAPI } from '../services/userAPI';
import GiftSelectorModal from '../components/GiftSelectorModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const COMMENTS_PAGE_SIZE = 20;

interface PostDetailsScreenProps {
  navigation?: any;
  route?: any;
}

const PostDetailsScreen: React.FC<PostDetailsScreenProps> = ({ navigation, route }) => {
  const navigationHook = useNavigation();
  const routeHook = useRoute();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();

  const nav = navigation || navigationHook;
  const params = (route?.params || routeHook?.params) as { postId: string };

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostInteraction[]>([]);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedCommentForGift, setSelectedCommentForGift] = useState<PostInteraction | null>(null);
  const [giftingToPost, setGiftingToPost] = useState(false);
  const [replyingTo, setReplyingTo] = useState<PostInteraction | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [userGifts, setUserGifts] = useState<UserGift[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted' | 'blocked'>('none');
  const [connectionId, setConnectionId] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const postId = params.postId;
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  const videoPlayer = useVideoPlayer(currentVideoUrl || '', (player) => {
    player.loop = true;
  });

  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!post || !showMediaViewer) {
      setCurrentVideoUrl(null);
      videoPlayer.pause();
      return;
    }

    const urls = post.processedMediaUrls?.length ? post.processedMediaUrls : post.mediaUrls;
    if (!urls || urls.length === 0) {
      setCurrentVideoUrl(null);
      videoPlayer.pause();
      return;
    }

    const mediaUrl = urls[selectedMediaIndex] || urls[0];
    const lowerUrl = mediaUrl?.toLowerCase() || '';
    const isVideo =
      post.mediaType === 'video' ||
      (post.mediaType === 'mixed' &&
        (lowerUrl.endsWith('.mp4') ||
          lowerUrl.endsWith('.mov') ||
          lowerUrl.endsWith('.m4v') ||
          lowerUrl.endsWith('.webm')));

    if (isVideo && mediaUrl) {
      setCurrentVideoUrl(mediaUrl);
      videoPlayer.play();
    } else {
      setCurrentVideoUrl(null);
      videoPlayer.pause();
    }
  }, [post, showMediaViewer, selectedMediaIndex, videoPlayer]);

  useEffect(() => {
    loadPostDetails();
    loadComments(true);
    loadRelatedPosts();
  }, [postId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardShowSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    const keyboardHideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      keyboardShowSub.remove();
      keyboardHideSub.remove();
    };
  }, [keyboardOffset]);

  const loadUserGifts = async () => {
    try {
      setGiftsLoading(true);
      const response = await giftAPI.getUserGifts();
      setUserGifts(response.gifts);
    } catch (error) {
      console.error('Error loading user gifts:', error);
      setUserGifts([]);
    } finally {
      setGiftsLoading(false);
    }
  };

  const loadConnectionStatus = async (targetUserId: string) => {
    try {
      const status = await userAPI.getConnectionStatus(targetUserId);
      setConnectionStatus(status.status as 'none' | 'pending' | 'accepted' | 'blocked');
      setConnectionId(status.connectionId);
    } catch (error) {
      console.error('Error loading connection status:', error);
    }
  };

  const handleConnect = async () => {
    if (!post) return;
    try {
      if (connectionStatus === 'none') {
        const newConnection = await userAPI.sendConnectionRequest(post.userId);
        setConnectionStatus('pending');
        setConnectionId(newConnection.id);
      } else if (connectionStatus === 'pending') {
        if (connectionId) {
          await userAPI.deleteConnection(connectionId);
          setConnectionStatus('none');
          setConnectionId(undefined);
        }
      } else if (connectionStatus === 'accepted') {
        if (connectionId) {
          Alert.alert(
            'Unplug',
            `Unplug from @${post.user?.username}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unplug',
                style: 'destructive',
                onPress: async () => {
                  await userAPI.deleteConnection(connectionId);
                  setConnectionStatus('none');
                  setConnectionId(undefined);
                },
              },
            ]
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update connection');
    }
  };

  const loadPostDetails = async (showGlobalLoader: boolean = true) => {
    try {
      if (showGlobalLoader) {
        setLoading(true);
      }
      const postData = await postsAPI.getPostById(postId);
      setPost(postData);
      setIsLiked(postData.isLiked || false);
      setIsBookmarked(postData.isBookmarked || false);
      if (postData.userId && postData.userId !== user?.id) {
        loadConnectionStatus(postData.userId);
      }
    } catch (error) {
      console.error('Error loading post details:', error);
      Alert.alert('Error', 'Failed to load post details');
    } finally {
      if (showGlobalLoader) {
        setLoading(false);
      }
    }
  };

  const loadComments = async (reset: boolean = false) => {
    try {
      if (reset) {
        setCommentsLoading(true);
        setComments([]);
        setCommentsOffset(0);
        setHasMoreComments(true);
      } else {
        if (!hasMoreComments || commentsLoading || loadingMoreComments) {
          return;
        }
        setLoadingMoreComments(true);
      }

      const offset = reset ? 0 : commentsOffset;
      const commentsData = await postsAPI.getComments(postId, { limit: COMMENTS_PAGE_SIZE, offset });

      if (reset) {
        setComments(commentsData);
      } else {
        setComments((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          commentsData.forEach((c) => {
            if (!existingIds.has(c.id)) {
              merged.push(c);
            }
          });
          return merged;
        });
      }

      const newOffset = offset + commentsData.length;
      setCommentsOffset(newOffset);
      if (commentsData.length < COMMENTS_PAGE_SIZE) {
        setHasMoreComments(false);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      if (reset) {
        setCommentsLoading(false);
      } else {
        setLoadingMoreComments(false);
      }
    }
  };

  const loadRelatedPosts = async () => {
    try {
      setRelatedLoading(true);
      const relatedData = await postsAPI.getRelatedPosts(postId, 10);
      setRelatedPosts(relatedData);
    } catch (error) {
      console.error('Error loading related posts:', error);
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadPostDetails(false),
        loadComments(true),
        loadRelatedPosts(),
      ]);
    } catch (error) {
      console.error('Error refreshing post details:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLike = async () => {
    if (!post) return;

    try {
      if (isLiked) {
        await postsAPI.unlikePost(post.id);
        setIsLiked(false);
        setPost(prev => prev ? { ...prev, likesCount: Math.max(0, prev.likesCount - 1) } : null);
      } else {
        await postsAPI.likePost(post.id);
        setIsLiked(true);
        setPost(prev => prev ? { ...prev, likesCount: prev.likesCount + 1 } : null);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleBookmark = async () => {
    if (!post) return;

    try {
      const bookmarked = await postsAPI.toggleBookmark(post.id);
      setIsBookmarked(bookmarked);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleShare = async () => {
    if (!post) return;

    try {
      await RNShare.share({
        message: `Check out this post on Fretiko!`,
        url: `fretiko://post/${post.id}`,
      });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleReport = () => {
    setShowMoreOptions(false);
    nav.navigate('CreateContentReport', {
      postId: post?.id,
      reportCategory: 'post' as ReportCategory,
    });
  };

  const handleEditPost = () => {
    if (!post) return;
    setShowMoreOptions(false);
    nav.navigate('CreatePost', {
      postId: post.id,
      initialContent: post.content || '',
      initialPrivacy: post.privacyLevel,
    });
  };

  const handleDeletePost = () => {
    if (!post) return;
    setShowMoreOptions(false);

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await postsAPI.deletePost(post.id);
              nav.goBack();
              setTimeout(() => Alert.alert('Deleted', 'Your post has been deleted.'), 100);
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !post) return;

    try {
      const newComment = await postsAPI.addComment(post.id, commentText.trim());
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      setPost(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null);
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment');
    }
  };

  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await postsAPI.unlikeComment(commentId);
      } else {
        await postsAPI.likeComment(commentId);
      }
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            isLiked: !isLiked,
            likesCount: isLiked ? (comment.likesCount || 0) - 1 : (comment.likesCount || 0) + 1,
          };
        }
        return comment;
      }));
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleGiftToComment = async (comment: PostInteraction) => {
    setSelectedCommentForGift(comment);
    setGiftingToPost(false);
    setShowGiftModal(true);
    await loadUserGifts();
  };

  const handleGiftToPost = async () => {
    setSelectedCommentForGift(null);
    setGiftingToPost(true);
    setShowGiftModal(true);
    await loadUserGifts();
  };

  const handleSendGift = async (giftId: string, quantity: number) => {
    if (!post) return;

    if (giftingToPost) {
      await postsAPI.sendGift({
        postId: post.id,
        giftId,
        message: '',
      });
      setPost(prev => prev ? { ...prev, giftsCount: (prev.giftsCount || 0) + quantity } : null);
    } else if (selectedCommentForGift) {
      await postsAPI.sendGiftToComment(selectedCommentForGift.id, giftId);
      setComments(prev => prev.map(comment => {
        if (comment.id === selectedCommentForGift.id) {
          return {
            ...comment,
            giftsCount: (comment.giftsCount || 0) + quantity,
            isGifted: true,
          };
        }
        return comment;
      }));
    }
    setSelectedCommentForGift(null);
    setGiftingToPost(false);
  };

  const handleReplyToComment = (comment: PostInteraction) => {
    setReplyingTo(comment);
    setReplyText('');
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !replyingTo || !post) return;

    try {
      const newReply = await postsAPI.addComment(post.id, replyText.trim(), replyingTo.id);
      setComments(prev => [...prev, newReply]);
      setReplyText('');
      setReplyingTo(null);
      setPost(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null);
    } catch (error) {
      console.error('Error sending reply:', error);
      Alert.alert('Error', 'Failed to send reply');
    }
  };

  const toggleCommentExpansion = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <TouchableOpacity onPress={() => nav.goBack()} style={styles.headerButton}>
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Post</Text>
      <TouchableOpacity onPress={() => setShowMoreOptions(true)} style={styles.headerButton}>
        <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderUserInfo = () => {
    if (!post?.user) return null;

    return (
      <View style={styles.userInfoContainer}>
        <TouchableOpacity style={styles.userAvatarContainer}>
          <Image
            source={{ uri: post.user.avatarUrl || 'https://via.placeholder.com/50' }}
            style={styles.userAvatar}
          />
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{post.user.username}</Text>
            {post.user.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#007AFF" style={styles.verifiedBadge} />
            )}
          </View>
          <Text style={styles.postTime}>{postsAPI.formatPostTime(post.createdAt)}</Text>
        </View>
        {post?.userId !== user?.id && (
          <TouchableOpacity
            style={[
              styles.followButton,
              connectionStatus === 'accepted' && styles.pluggedButton,
              connectionStatus === 'pending' && styles.pendingPlugButton,
              connectionStatus === 'blocked' && styles.blockedPlugButton,
            ]}
            onPress={handleConnect}
            disabled={connectionStatus === 'blocked'}
          >
            <Text style={[
              styles.followButtonText,
              connectionStatus === 'accepted' && styles.pluggedButtonText,
            ]}>
              {connectionStatus === 'accepted' ? 'Plugged' :
               connectionStatus === 'pending' ? 'Pending' :
               connectionStatus === 'blocked' ? 'Blocked' : 'Plug'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMedia = () => {
    if (!post || post.mediaUrls.length === 0) return null;
    const effectiveMediaUrls = post.processedMediaUrls?.length
      ? post.processedMediaUrls
      : post.mediaUrls;

    return (
      <View style={styles.mediaContainer}>
        {effectiveMediaUrls.map((url, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.9}
            onPress={() => {
              setSelectedMediaIndex(index);
              setShowMediaViewer(true);
            }}
          >
            <Image source={{ uri: url }} style={styles.mediaImage} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderCaption = () => {
    if (!post?.content) return null;

    return (
      <View style={styles.captionContainer}>
        <Text style={styles.caption}>{post.content}</Text>
      </View>
    );
  };

  const renderEngagementBar = () => {
    if (!post) return null;

    return (
      <View style={styles.engagementBar}>
        <TouchableOpacity onPress={handleLike} style={styles.engagementButton}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? '#E74C3C' : '#666'}
          />
          <Text style={styles.engagementCount}>{postsAPI.formatCount(post.likesCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.engagementButton} onPress={handleGiftToPost}>
          <Ionicons name="gift-outline" size={24} color="#666" />
          <Text style={styles.engagementCount}>{postsAPI.formatCount(post.giftsCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleShare} style={styles.engagementButton}>
          <Ionicons name="share-outline" size={24} color="#666" />
          <Text style={styles.engagementCount}>{postsAPI.formatCount(post.sharesCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleBookmark} style={styles.engagementButton}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={isBookmarked ? '#007AFF' : '#666'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderComment = ({ item }: { item: PostInteraction }) => {
    const isExpanded = expandedComments.has(item.id);
    const replies = comments.filter(c => c.parentCommentId === item.id);
    const hasReplies = replies.length > 0;

    return (
      <View key={item.id} style={styles.commentItem}>
        <View style={styles.commentAvatarContainer}>
          <Image
            source={{ uri: item.user?.avatarUrl || 'https://via.placeholder.com/40' }}
            style={styles.commentAvatar}
          />
        </View>
        <View style={styles.commentContent}>
          <Text style={styles.commentUsername}>{item.user?.username}</Text>
          <Text style={styles.commentText}>{item.content}</Text>
          <View style={styles.commentActions}>
            <Text style={styles.commentTime}>{postsAPI.formatPostTime(item.createdAt)}</Text>
            <TouchableOpacity
              style={styles.commentActionButton}
              onPress={() => handleLikeComment(item.id, item.isLiked || false)}
            >
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={16}
                color={item.isLiked ? '#E74C3C' : '#666'}
              />
              <Text style={styles.commentActionText}>
                {item.likesCount ? postsAPI.formatCount(item.likesCount) : 'Like'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commentActionButton}
              onPress={() => handleGiftToComment(item)}
            >
              <Ionicons name="gift-outline" size={16} color="#666" />
              <Text style={styles.commentActionText}>
                {item.giftsCount ? postsAPI.formatCount(item.giftsCount) : 'Gift'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commentActionButton}
              onPress={() => handleReplyToComment(item)}
            >
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
            {hasReplies && (
              <TouchableOpacity
                style={styles.commentActionButton}
                onPress={() => toggleCommentExpansion(item.id)}
              >
                <Text style={styles.commentActionText}>
                  {isExpanded ? 'Hide' : `${replies.length} replies`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {replyingTo?.id === item.id && (
            <View style={styles.replyInputContainer}>
              <TextInput
                style={styles.replyInput}
                placeholder={`Reply to ${item.user?.username}...`}
                placeholderTextColor="#999"
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />
              <TouchableOpacity
                onPress={handleSendReply}
                style={[styles.sendReplyButton, !replyText.trim() && styles.sendReplyButtonDisabled]}
                disabled={!replyText.trim()}
              >
                <Ionicons name="send" size={18} color={replyText.trim() ? '#007AFF' : '#ccc'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.cancelReplyButton}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {isExpanded && hasReplies && (
          <View style={styles.repliesContainer}>
            {replies.map(reply => (
              <View key={reply.id} style={styles.replyItem}>
                <View style={styles.replyAvatarContainer}>
                  <Image
                    source={{ uri: reply.user?.avatarUrl || 'https://via.placeholder.com/32' }}
                    style={styles.replyAvatar}
                  />
                </View>
                <View style={styles.replyContent}>
                  <Text style={styles.replyUsername}>{reply.user?.username}</Text>
                  <Text style={styles.replyText}>{reply.content}</Text>
                  <View style={styles.replyActions}>
                    <Text style={styles.replyTime}>{postsAPI.formatPostTime(reply.createdAt)}</Text>
                    <TouchableOpacity
                      style={styles.replyActionButton}
                      onPress={() => handleLikeComment(reply.id, reply.isLiked || false)}
                    >
                      <Ionicons
                        name={reply.isLiked ? 'heart' : 'heart-outline'}
                        size={14}
                        color={reply.isLiked ? '#E74C3C' : '#666'}
                      />
                      <Text style={styles.replyActionText}>
                        {reply.likesCount ? postsAPI.formatCount(reply.likesCount) : 'Like'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.replyActionButton}
                      onPress={() => handleGiftToComment(reply)}
                    >
                      <Ionicons name="gift-outline" size={14} color="#666" />
                      <Text style={styles.replyActionText}>
                        {reply.giftsCount ? postsAPI.formatCount(reply.giftsCount) : 'Gift'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderRelatedPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={styles.relatedPostItem}
      onPress={() => nav.navigate('PostDetails', { postId: item.id })}
    >
      <Image
        source={{ uri: item.processedMediaUrls?.[0] || item.mediaUrls[0] || 'https://via.placeholder.com/100' }}
        style={styles.relatedPostImage}
      />
      <Text style={styles.relatedPostUsername}>{item.user?.username}</Text>
    </TouchableOpacity>
  );

  const renderRelatedSection = (title: string, posts: Post[]) => {
    if (posts.length === 0) return null;

    return (
      <View style={styles.relatedSection}>
        <Text style={styles.relatedSectionTitle}>{title}</Text>
        <FlatList
          horizontal
          data={posts}
          renderItem={renderRelatedPost}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          style={styles.relatedCarousel}
        />
      </View>
    );
  };

  const renderMediaViewerContent = () => {
    if (!post || !post.mediaUrls || post.mediaUrls.length === 0) return null;

    const urls = post.processedMediaUrls?.length ? post.processedMediaUrls : post.mediaUrls;

    return (
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: selectedMediaIndex * screenWidth, y: 0 }}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
          if (!Number.isNaN(index)) {
            setSelectedMediaIndex(index);
          }
        }}
      >
        {urls.map((url, index) => {
          const lowerUrl = url?.toLowerCase() || '';
          const isVideo =
            post.mediaType === 'video' ||
            (post.mediaType === 'mixed' &&
              (lowerUrl.endsWith('.mp4') ||
                lowerUrl.endsWith('.mov') ||
                lowerUrl.endsWith('.m4v') ||
                lowerUrl.endsWith('.webm')));

          const isActive = index === selectedMediaIndex;

          return (
            <View key={index} style={styles.mediaViewerPage}>
              {isVideo && isActive && currentVideoUrl ? (
                <VideoView
                  style={styles.mediaViewerImage}
                  player={videoPlayer}
                  allowsFullscreen
                  allowsPictureInPicture
                />
              ) : (
                <Image
                  source={{ uri: url }}
                  style={styles.mediaViewerImage}
                  resizeMode="contain"
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderFloatingCommentInput = () => (
    <View style={[styles.floatingInputContainer, { paddingBottom: insets.bottom }]}> 
      <TouchableOpacity style={styles.giftButton} onPress={handleGiftToPost}>
        <Ionicons name="gift-outline" size={24} color="#007AFF" />
      </TouchableOpacity>
      <TextInput
        style={styles.commentInput}
        placeholder="Write a comment..."
        placeholderTextColor="#999"
        value={commentText}
        onChangeText={setCommentText}
        multiline
      />
      <TouchableOpacity
        onPress={handleSendComment}
        style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
        disabled={!commentText.trim()}
      >
        <Ionicons name="send" size={20} color={commentText.trim() ? '#007AFF' : '#ccc'} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
        >
          {renderUserInfo()}
          {renderMedia()}
          {renderCaption()}
          {renderEngagementBar()}

          <View style={styles.commentsSection}>
            <Text style={styles.commentsHeader}>Comments ({post?.commentsCount || 0})</Text>
            {commentsLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={styles.commentsLoading} />
            ) : (
              <>
                <FlatList
                  data={comments}
                  renderItem={renderComment}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
                {hasMoreComments && (
                  loadingMoreComments ? (
                    <ActivityIndicator
                      size="small"
                      color="#007AFF"
                      style={styles.loadMoreSpinner}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={() => loadComments(false)}
                    >
                      <Text style={styles.loadMoreText}>Load more comments</Text>
                    </TouchableOpacity>
                  )
                )}
              </>
            )}
          </View>

          {renderRelatedSection('More from ' + post?.user?.username, relatedPosts)}
        </ScrollView>

        {renderFloatingCommentInput()}
        <Animated.View style={{ height: keyboardOffset }} />
      </View>

      <Modal
        visible={showMoreOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMoreOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreOptions(false)}
        >
          <View style={[styles.optionsContainer, { paddingBottom: insets.bottom }]}>
            <TouchableOpacity style={styles.optionButton} onPress={handleReport}>
              <Ionicons name="flag-outline" size={24} color="#E74C3C" />
              <Text style={styles.optionText}>Report Post</Text>
            </TouchableOpacity>
            {post?.userId === user?.id && (
              <>
                <TouchableOpacity style={styles.optionButton} onPress={handleEditPost}>
                  <Ionicons name="create-outline" size={24} color="#2ECC71" />
                  <Text style={styles.optionText}>Edit Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionButton} onPress={handleDeletePost}>
                  <Ionicons name="trash-outline" size={24} color="#E74C3C" />
                  <Text style={[styles.optionText, { color: '#E74C3C' }]}>Delete Post</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.optionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#007AFF" />
              <Text style={styles.optionText}>Share Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={handleBookmark}>
              <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={24} color="#007AFF" />
              <Text style={styles.optionText}>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Post'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={() => setShowMoreOptions(false)}>
              <Ionicons name="close-outline" size={24} color="#666" />
              <Text style={styles.optionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <GiftSelectorModal
        visible={showGiftModal}
        onClose={() => {
          setShowGiftModal(false);
          setSelectedCommentForGift(null);
          setGiftingToPost(false);
        }}
        gifts={userGifts}
        loading={giftsLoading}
        onSendGift={handleSendGift}
        title={
          giftingToPost
            ? 'Gift the Post'
            : selectedCommentForGift?.parentCommentId
            ? 'Gift a Reply'
            : 'Gift a Comment'
        }
        subtitle={
          giftingToPost
            ? `Send a gift to @${post?.user?.username || 'the author'}`
            : `Send a gift to @${selectedCommentForGift?.user?.username || 'the commenter'}`
        }
      />

      <Modal
        visible={showMediaViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMediaViewer(false)}
      >
        <TouchableOpacity
          style={styles.mediaViewerOverlay}
          activeOpacity={1}
          onPress={() => setShowMediaViewer(false)}
        >
          <View style={styles.mediaViewerContainer}>
            <TouchableOpacity
              style={styles.closeMediaViewer}
              onPress={() => setShowMediaViewer(false)}
            >
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            {renderMediaViewerContent()}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0a0a0a',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  userAvatarContainer: {
    marginRight: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  postTime: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  pluggedButton: {
    backgroundColor: '#1E3A1E',
    borderWidth: 1,
    borderColor: '#27AE60',
  },
  pendingPlugButton: {
    backgroundColor: '#3A2E00',
    borderWidth: 1,
    borderColor: '#FFA500',
  },
  blockedPlugButton: {
    backgroundColor: '#2A2A2A',
    opacity: 0.5,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pluggedButtonText: {
    color: '#27AE60',
  },
  mediaContainer: {
    width: screenWidth,
    aspectRatio: 1,
    backgroundColor: '#1a1a1a',
  },
  mediaImage: {
    width: screenWidth,
    height: '100%',
    resizeMode: 'cover',
  },
  captionContainer: {
    padding: 16,
  },
  caption: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  engagementCount: {
    marginLeft: 6,
    fontSize: 14,
    color: '#888',
  },
  commentsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  commentsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  commentsLoading: {
    padding: 20,
  },
  loadMoreButton: {
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 13,
    color: '#4DA3FF',
  },
  loadMoreSpinner: {
    marginTop: 8,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatarContainer: {
    marginRight: 12,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
    marginRight: 16,
  },
  commentActionButton: {
    marginRight: 16,
  },
  commentActionText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    maxHeight: 60,
  },
  sendReplyButton: {
    padding: 6,
    marginLeft: 8,
  },
  sendReplyButtonDisabled: {
    opacity: 0.5,
  },
  cancelReplyButton: {
    padding: 6,
    marginLeft: 4,
  },
  repliesContainer: {
    marginTop: 12,
    marginLeft: 52,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.1)',
  },
  replyItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  replyAvatarContainer: {
    marginRight: 8,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  replyContent: {
    flex: 1,
  },
  replyUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 6,
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyTime: {
    fontSize: 11,
    color: '#999',
    marginRight: 12,
  },
  replyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  replyActionText: {
    fontSize: 11,
    color: '#888',
    marginLeft: 4,
  },
  relatedSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  relatedSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  relatedCarousel: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  relatedPostItem: {
    marginRight: 12,
    width: 120,
  },
  relatedPostImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  relatedPostUsername: {
    fontSize: 12,
    color: '#888',
  },
  floatingInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0a0a0a',
  },
  giftButton: {
    padding: 8,
    marginRight: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  optionText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  mediaViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeMediaViewer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  mediaViewerImage: {
    width: screenWidth,
    height: screenHeight,
  },
  mediaViewerPage: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PostDetailsScreen;
