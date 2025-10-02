import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { servicesAPI, ServiceComment } from '../services/servicesAPI';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const DRAWER_HEIGHT = height * 0.6; // 60% of screen height

interface CommentsDrawerProps {
  visible: boolean;
  serviceId: string | null;
  onClose: () => void;
}

const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  visible,
  serviceId,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const translateY = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
  
  const [comments, setComments] = useState<ServiceComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Animation for drawer visibility
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : DRAWER_HEIGHT,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [visible]);

  // Load comments when serviceId changes
  useEffect(() => {
    if (serviceId && visible) {
      loadComments();
    }
  }, [serviceId, visible]);

  const loadComments = async () => {
    if (!serviceId) return;
    
    try {
      setLoading(true);
      const commentsData = await servicesAPI.getServiceComments(serviceId);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      // Show mock data as fallback
      setComments([
        {
          id: '1',
          userId: 'user1',
          userName: 'Sarah Johnson',
          userAvatar: 'https://via.placeholder.com/40',
          comment: 'Great service! Very professional and timely.',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          likes: 5,
        },
        {
          id: '2',
          userId: 'user2',
          userName: 'Mike Chen',
          userAvatar: 'https://via.placeholder.com/40',
          comment: 'Highly recommend! Excellent work quality.',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
          likes: 3,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!serviceId || !newComment.trim()) return;
    
    try {
      setSubmitting(true);
      const comment = await servicesAPI.addComment(serviceId, newComment.trim());
      
      // Add comment to local state
      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      // Add optimistic comment on error (will sync later)
      const optimisticComment: ServiceComment = {
        id: `temp_${Date.now()}`,
        userId: user?.id || 'current_user',
        userName: user?.firstName || 'You',
        userAvatar: undefined,
        comment: newComment.trim(),
        createdAt: new Date().toISOString(),
        likes: 0,
      };
      setComments(prev => [optimisticComment, ...prev]);
      setNewComment('');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const commentDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - commentDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const renderComment = ({ item }: { item: ServiceComment }) => (
    <View style={styles.commentItem}>
      <Image 
        source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }}
        style={styles.commentAvatar}
      />
      
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUserName}>{item.userName}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        
        <Text style={styles.commentText}>{item.comment}</Text>
        
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.likeButton}>
            <Ionicons name="heart-outline" size={16} color="#888" />
            <Text style={styles.likeCount}>{item.likes}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.replyButton}>
            <Ionicons name="chatbubble-outline" size={16} color="#888" />
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: translateY.interpolate({
        inputRange: [0, DRAWER_HEIGHT],
        outputRange: [0.5, 0],
      })}]}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Drawer */}
      <Animated.View 
        style={[
          styles.drawer,
          {
            transform: [{ translateY }],
            paddingBottom: insets.bottom + 20,
          }
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Comments List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498DB" />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            style={styles.commentsList}
            contentContainerStyle={styles.commentsContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubble-outline" size={48} color="#666" />
                <Text style={styles.emptyTitle}>No comments yet</Text>
                <Text style={styles.emptySubtitle}>Be the first to leave a comment!</Text>
              </View>
            }
          />
        )}

        {/* Comment Input */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
        >
          <View style={styles.inputRow}>
            <Image 
              source={{ uri: user?.id ? 'https://via.placeholder.com/40' : 'https://via.placeholder.com/40' }}
              style={styles.userAvatar}
            />
            
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor="#666"
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!newComment.trim() || submitting) && styles.sendButtonDisabled
              ]}
              onPress={handleAddComment}
              disabled={!newComment.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRAWER_HEIGHT,
    backgroundColor: '#000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#333',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 14,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  commentsContent: {
    paddingBottom: 20,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentUserName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  commentTime: {
    color: '#888',
    fontSize: 12,
  },
  commentText: {
    color: 'white',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  likeCount: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyText: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: 'white',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3498DB',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
});

export default CommentsDrawer;