import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { postsAPI, PostInteraction } from '../services/postsAPI';
import { giftAPI, UserGift } from '../services/giftAPI';
import CommentReactionBar from './CommentReactionBar';
import GiftSelectorModal from './GiftSelectorModal';
import * as Haptics from 'expo-haptics';

const { height: screenHeight } = Dimensions.get('window');

interface PostCommentsModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
  onCommentAdded?: () => void;
}

const PostCommentsModal: React.FC<PostCommentsModalProps> = ({
  visible,
  postId,
  onClose,
  onCommentAdded,
}) => {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<PostInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<PostInteraction | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'newest'>('popular');
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedCommentForGift, setSelectedCommentForGift] = useState<PostInteraction | null>(null);
  const [userGifts, setUserGifts] = useState<UserGift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);

  // Organize comments into threaded structure
  const getThreadedComments = useCallback(() => {
    const topLevel: PostInteraction[] = [];
    const replies = new Map<string, PostInteraction[]>();

    comments.forEach(comment => {
      if (comment.parentCommentId) {
        // This is a reply
        const parentReplies = replies.get(comment.parentCommentId) || [];
        parentReplies.push(comment);
        replies.set(comment.parentCommentId, parentReplies);
      } else {
        // This is a top-level comment
        topLevel.push(comment);
      }
    });

    return { topLevel, replies };
  }, [comments]);

  // Load comments when modal opens
  useEffect(() => {
    if (visible && postId) {
      loadComments();
    }
  }, [visible, postId]);

  const loadComments = async () => {
    if (!postId) return;
    
    try {
      setLoading(true);
      const data = await postsAPI.getComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!postId || !commentText.trim()) return;

    try {
      setSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Pass parentCommentId if replying to a comment
      const parentCommentId = replyingTo?.id;
      const newComment = await postsAPI.addComment(
        postId, 
        commentText.trim(),
        parentCommentId
      );
      
      // Add new comment to list
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      setReplyingTo(null); // Clear reply state
      
      // Notify parent
      onCommentAdded?.();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sending comment:', error);
    } finally {
      setSending(false);
    }
  };

  const handleReplyPress = (comment: PostInteraction) => {
    setReplyingTo(comment);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  // Calculate comment score for ranking
  const calculateScore = (comment: PostInteraction) => {
    const likes = comment.likesCount || 0;
    const gifts = comment.giftsCount || 0;
    const hoursSincePost = (Date.now() - new Date(comment.createdAt).getTime()) / (1000 * 60 * 60);
    return (likes * 1.0) + (gifts * 5.0) - (hoursSincePost * 0.1);
  };

  // Sort comments by selected method
  const getSortedComments = useCallback(() => {
    const sorted = [...comments];
    if (sortBy === 'popular') {
      sorted.sort((a, b) => calculateScore(b) - calculateScore(a));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }, [comments, sortBy]);

  // Handle like on comment
  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await postsAPI.unlikeComment(commentId);
      } else {
        await postsAPI.likeComment(commentId);
      }
      
      // Update local state
      setComments(prev => prev.map(comment => 
        comment.id === commentId ? {
          ...comment,
          isLiked: !isLiked,
          likesCount: isLiked 
            ? (comment.likesCount || 0) - 1 
            : (comment.likesCount || 0) + 1
        } : comment
      ));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  // Open gift modal for comment
  const openCommentGiftModal = async (comment: PostInteraction) => {
    setSelectedCommentForGift(comment);
    setShowGiftModal(true);
    
    try {
      setLoadingGifts(true);
      const response = await giftAPI.getUserGifts();
      setUserGifts(response.gifts);
    } catch (error) {
      console.error('Error loading user gifts:', error);
    } finally {
      setLoadingGifts(false);
    }
  };

  // Send gift to comment
  const sendCommentGift = async (giftId: string) => {
    if (!selectedCommentForGift) return;
    
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      await postsAPI.sendGiftToComment(selectedCommentForGift.id, giftId);
      
      // Update local state
      setComments(prev => prev.map(comment => 
        comment.id === selectedCommentForGift.id ? {
          ...comment,
          isGifted: true,
          giftsCount: (comment.giftsCount || 0) + 1
        } : comment
      ));
      
      setShowGiftModal(false);
      setSelectedCommentForGift(null);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sending gift to comment:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderCommentItem = ({ 
    item, 
    isReply = false,
    replyCount = 0 
  }: { 
    item: PostInteraction; 
    isReply?: boolean;
    replyCount?: number;
  }) => (
    <View style={[styles.commentItem, isReply && styles.replyItem]}>
      <View style={styles.commentAvatar}>
        {item.user?.avatar_url ? (
          <Image
            source={{ uri: item.user.avatar_url }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarText}>
            {item.user?.username?.[0]?.toUpperCase() || '?'}
          </Text>
        )}
      </View>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.username}>@{item.user?.username || 'Unknown'}</Text>
          <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>

        {/* Reaction Bar - Heart + Gift */}
        <CommentReactionBar
          likesCount={item.likesCount || 0}
          giftsCount={item.giftsCount || 0}
          isLiked={item.isLiked || false}
          hasGifted={item.isGifted || false}
          onLike={() => handleLikeComment(item.id, item.isLiked || false)}
          onGift={() => openCommentGiftModal(item)}
        />

        {/* Reply button */}
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() => handleReplyPress(item)}
        >
          <Ionicons name="return-down-back" size={14} color="#888" />
          <Text style={styles.replyButtonText}>
            {replyCount > 0 ? `${replyCount} replies` : 'Reply'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Loading comments...</Text>
        </View>
      );
    }

    if (comments.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubble-outline" size={50} color="#666" />
          <Text style={styles.emptyTitle}>No comments yet</Text>
          <Text style={styles.emptySubtitle}>
            Be the first to comment on this post
          </Text>
        </View>
      );
    }

    // Get sorted comments then organize into threads
    const sortedComments = getSortedComments();
    const topLevel: PostInteraction[] = [];
    const replies = new Map<string, PostInteraction[]>();

    sortedComments.forEach(comment => {
      if (comment.parentCommentId) {
        const parentReplies = replies.get(comment.parentCommentId) || [];
        parentReplies.push(comment);
        replies.set(comment.parentCommentId, parentReplies);
      } else {
        topLevel.push(comment);
      }
    });

    return (
      <FlatList
        data={topLevel}
        renderItem={({ item }) => {
          const commentReplies = replies.get(item.id) || [];
          return (
            <View>
              {renderCommentItem({ item, replyCount: commentReplies.length })}
              {/* Render replies under parent comment */}
              {commentReplies.map(reply => (
                <View key={reply.id}>
                  {renderCommentItem({ item: reply, isReply: true })}
                </View>
              ))}
            </View>
          );
        }}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.commentsList}
        inverted={false}
      />
    );
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          {/* Backdrop */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />
          
          {/* Modal Content */}
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom || 20 }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                Comments ({comments.length})
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Sort Options */}
            <View style={styles.sortContainer}>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'popular' && styles.sortButtonActive]}
                onPress={() => setSortBy('popular')}
              >
                <Ionicons 
                  name={sortBy === 'popular' ? "flame" : "flame-outline"} 
                  size={16} 
                  color={sortBy === 'popular' ? "#FFF" : "#888"} 
                />
                <Text style={[styles.sortText, sortBy === 'popular' && styles.sortTextActive]}>
                  Popular
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
                onPress={() => setSortBy('newest')}
              >
                <Ionicons 
                  name={sortBy === 'newest' ? "time" : "time-outline"} 
                  size={16} 
                  color={sortBy === 'newest' ? "#FFF" : "#888"} 
                />
                <Text style={[styles.sortText, sortBy === 'newest' && styles.sortTextActive]}>
                  Newest
                </Text>
              </TouchableOpacity>
            </View>

            {/* Comments List */}
            <View style={styles.commentsContainer}>
              {renderContent()}
            </View>

            {/* Reply Context */}
            {replyingTo && (
              <View style={styles.replyContext}>
                <View style={styles.replyContextContent}>
                  <Ionicons name="return-down-back" size={16} color="#3498DB" />
                  <Text style={styles.replyContextText} numberOfLines={1}>
                    Replying to @{replyingTo.user?.username}
                  </Text>
                </View>
                <TouchableOpacity onPress={cancelReply}>
                  <Ionicons name="close" size={18} color="#888" />
                </TouchableOpacity>
              </View>
            )}

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                placeholderTextColor="#888"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                autoFocus={!!replyingTo}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!commentText.trim() || sending) && styles.sendButtonDisabled
                ]}
                onPress={handleSendComment}
                disabled={!commentText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Gift Selector Modal for Comments */}
    <GiftSelectorModal
      visible={showGiftModal}
      onClose={() => {
        setShowGiftModal(false);
        setSelectedCommentForGift(null);
      }}
      gifts={userGifts}
      loading={loadingGifts}
      onSendGift={sendCommentGift}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.75,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sortButtonActive: {
    backgroundColor: '#3498DB',
  },
  sortText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  sortTextActive: {
    color: '#FFF',
  },
  commentsContainer: {
    maxHeight: screenHeight * 0.5,
    minHeight: 200,
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
  },
  commentText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
    minHeight: 200,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    maxHeight: 80,
    marginRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#555',
  },
  replyItem: {
    paddingLeft: 56, // Indent replies
    opacity: 0.9,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 4,
  },
  replyButtonText: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  replyContext: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2A2A2A',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  replyContextContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  replyContextText: {
    color: '#3498DB',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
});

export default PostCommentsModal;
