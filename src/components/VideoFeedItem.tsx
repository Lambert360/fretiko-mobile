import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Modal,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { VideoFeedItem as VideoFeedItemType } from '../services/servicesAPI';
import { useRealtimeInteractions } from '../hooks/useRealtimeInteractions';
import { walletAPI } from '../services/walletAPI';

const { width, height } = Dimensions.get('window');

interface VideoFeedItemProps {
  item: VideoFeedItemType;
  onViewProvider: (providerId: string) => void;
  onBookService: (serviceId: string) => void;
  onAddToCart: (serviceId: string) => void;
  onChatBargain: (serviceId: string) => void;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  scaleAnim: Animated.Value;
}

export const VideoFeedItemComponent: React.FC<VideoFeedItemProps> = ({
  item,
  onViewProvider,
  onBookService,
  onAddToCart,
  onChatBargain,
  fadeAnim,
  slideAnim,
  scaleAnim,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [typingTimer, setTypingTimer] = useState<NodeJS.Timeout | null>(null);

  // Use real-time interactions
  const {
    stats,
    comments,
    isConnected,
    like,
    unlike,
    addComment,
    share,
    toggleCommentLike,
    sendTyping,
  } = useRealtimeInteractions(item.id);

  const handleLike = async () => {
    try {
      if (stats?.isLiked) {
        await unlike();
      } else {
        await like();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleComment = () => {
    setShowComments(true);
  };

  const handleShare = async () => {
    try {
      await share();
      Alert.alert('Shared!', 'Service has been shared successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to share service');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await addComment(newComment.trim());
      setNewComment('');
      sendTyping(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleCommentTextChange = (text: string) => {
    setNewComment(text);
    
    // Send typing indicator
    if (text.trim()) {
      sendTyping(true);
      
      // Clear previous timer
      if (typingTimer) {
        clearTimeout(typingTimer);
      }
      
      // Set new timer to stop typing indicator
      const timer = setTimeout(() => {
        sendTyping(false);
      }, 2000);
      setTypingTimer(timer);
    } else {
      sendTyping(false);
      if (typingTimer) {
        clearTimeout(typingTimer);
        setTypingTimer(null);
      }
    }
  };

  const handleCommentLike = async (commentId: string) => {
    try {
      await toggleCommentLike(commentId);
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  // Cleanup typing timer
  useEffect(() => {
    return () => {
      if (typingTimer) {
        clearTimeout(typingTimer);
      }
    };
  }, [typingTimer]);

  const renderComment = ({ item: comment }: { item: any }) => (
    <Animated.View 
      style={[
        styles.commentItem,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Image 
        source={{ uri: comment.userAvatar || 'https://via.placeholder.com/40' }} 
        style={styles.commentAvatar} 
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{comment.userName}</Text>
          <Text style={styles.commentTime}>
            {new Date(comment.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={styles.commentText}>{comment.comment}</Text>
        <TouchableOpacity 
          style={styles.commentLikeButton}
          onPress={() => handleCommentLike(comment.id)}
        >
          <Ionicons 
            name={comment.isLiked ? "heart" : "heart-outline"} 
            size={16} 
            color={comment.isLiked ? "#FF3B30" : "#B0B0B0"} 
          />
          <Text style={styles.commentLikeText}>{comment.likes}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <>
      <Animated.View 
        style={[
          styles.videoContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'rgba(52,152,219,0.1)', 'rgba(0,0,0,0.9)']}
          style={styles.videoGradient}
        >
          {/* Video/Image Content */}
          <View style={styles.videoContent}>
            {item.thumbnail && (
              <Image source={{ uri: item.thumbnail }} style={styles.videoThumbnail} />
            )}
            <View style={styles.videoOverlay}>
              <Ionicons name="play-circle" size={60} color="rgba(255,255,255,0.8)" />
            </View>
            
            {/* Real-time connection indicator */}
            {isConnected && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          {/* Glassmorphism Info Panel */}
          <BlurView intensity={80} style={styles.infoPanel}>
            <TouchableOpacity 
              style={styles.providerInfo}
              onPress={() => onViewProvider(item.id)}
            >
              <Image 
                source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }} 
                style={styles.avatar} 
              />
              <View style={styles.providerDetails}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.location}>{item.location}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.rating}>{item.rating}</Text>
                  <Text style={styles.completedJobs}>({item.completedJobs} jobs)</Text>
                </View>
              </View>
              <View style={styles.viewProfileIndicator}>
                <Ionicons name="chevron-forward" size={16} color="#3498DB" />
              </View>
            </TouchableOpacity>
            
            <Text style={styles.serviceTitle}>{item.title}</Text>
            <Text style={styles.serviceDescription} numberOfLines={2}>{item.description}</Text>
            
            <View style={styles.priceContainer}>
              <Text style={styles.currentPrice}>{walletAPI.formatFreti(item.price)}</Text>
              {item.originalPrice && (
                <Text style={styles.originalPrice}>{walletAPI.formatFreti(item.originalPrice)}</Text>
              )}
            </View>
          </BlurView>

          {/* Real-time Interaction Buttons */}
          <View style={styles.interactionContainer}>
            <TouchableOpacity 
              style={[styles.interactionButton, stats?.isLiked && styles.likedButton]}
              onPress={handleLike}
            >
              <Ionicons 
                name={stats?.isLiked ? "heart" : "heart-outline"} 
                size={28} 
                color={stats?.isLiked ? "#FF3B30" : "#FFFFFF"} 
              />
              <Text style={styles.interactionText}>{stats?.likes || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.interactionButton}
              onPress={handleComment}
            >
              <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
              <Text style={styles.interactionText}>{stats?.comments || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.interactionButton}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={28} color="#FFFFFF" />
              <Text style={styles.interactionText}>{stats?.shares || 0}</Text>
            </TouchableOpacity>

            {/* Action Buttons - Book/Cart + Chat */}
            <View style={styles.actionButtonsContainer}>
              {/* Primary Action - Book Now OR Add to Cart based on service type */}
              <TouchableOpacity 
                style={styles.primaryActionButton}
                onPress={() => {
                  // Services that require scheduling use "Book Now"
                  // Services that can be purchased immediately use "Add to Cart"
                  if (item.serviceProvider && item.serviceProvider.toLowerCase().includes('service')) {
                    onBookService(item.id);
                  } else {
                    onAddToCart(item.id);
                  }
                }}
              >
                <LinearGradient
                  colors={['#3498DB', '#007AFF']}
                  style={styles.actionGradient}
                >
                  <Text style={styles.actionButtonText}>
                    {item.serviceProvider && item.serviceProvider.toLowerCase().includes('service') ? 'Book Now' : 'Add to Cart'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Chat/Bargain Button */}
              <TouchableOpacity 
                style={styles.chatButton}
                onPress={() => onChatBargain(item.id)}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)']}
                  style={styles.chatGradient}
                >
                  <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.chatButtonText}>Chat</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* View count indicator */}
          <View style={styles.viewsIndicator}>
            <Ionicons name="eye-outline" size={16} color="#B0B0B0" />
            <Text style={styles.viewsText}>{stats?.views || 0} views</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Real-time Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        transparent={true}
      >
        <BlurView intensity={80} style={styles.modalContainer}>
          <View style={styles.commentsContainer}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>
                Comments ({stats?.comments || 0})
                {isConnected && <Text style={styles.liveTag}> • LIVE</Text>}
              </Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={comments}
              keyExtractor={(comment) => comment.id}
              renderItem={renderComment}
              style={styles.commentsList}
              showsVerticalScrollIndicator={false}
              inverted={false}
            />

            {/* Add Comment with real-time typing */}
            <BlurView intensity={60} style={styles.addCommentContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#B0B0B0"
                value={newComment}
                onChangeText={handleCommentTextChange}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                onPress={handleAddComment}
                style={styles.sendButton}
                disabled={!newComment.trim()}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={newComment.trim() ? "#3498DB" : "#666666"} 
                />
              </TouchableOpacity>
            </BlurView>
          </View>
        </BlurView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    height: height,
    width: width,
    position: 'relative',
  },
  videoGradient: {
    flex: 1,
    position: 'relative',
  },
  videoContent: {
    flex: 1,
    position: 'relative',
    marginTop: 100, // Account for header height
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 0, // Full screen, no border radius
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Live indicator
  liveIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Views indicator
  viewsIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewsText: {
    color: '#B0B0B0',
    fontSize: 12,
    marginLeft: 4,
  },

  // Info Panel
  infoPanel: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 100,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  providerDetails: {
    flex: 1,
  },
  viewProfileIndicator: {
    marginLeft: 8,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  location: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  completedJobs: {
    color: '#B0B0B0',
    fontSize: 12,
    marginLeft: 8,
  },
  serviceTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  serviceDescription: {
    color: '#B0B0B0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    color: '#3498DB',
    fontSize: 20,
    fontWeight: 'bold',
  },
  originalPrice: {
    color: '#B0B0B0',
    fontSize: 16,
    textDecorationLine: 'line-through',
    marginLeft: 10,
  },

  // Interaction Buttons
  interactionContainer: {
    position: 'absolute',
    right: 15,
    bottom: 120,
    alignItems: 'center',
  },
  interactionButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    padding: 12,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 50,
  },
  likedButton: {
    backgroundColor: 'rgba(255,59,48,0.3)',
    borderColor: '#FF3B30',
  },
  interactionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Action Buttons (Book/Cart + Chat)
  actionButtonsContainer: {
    marginTop: 10,
    gap: 8,
  },
  primaryActionButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  actionGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chatButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  chatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Comments Modal
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  commentsContainer: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: height * 0.7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 15,
  },
  commentsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveTag: {
    color: '#FF3B30',
    fontSize: 14,
  },
  commentsList: {
    flex: 1,
    marginBottom: 15,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 15,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    marginRight: 12,
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
  commentUsername: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    color: '#666666',
    fontSize: 12,
  },
  commentText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentLikeText: {
    color: '#B0B0B0',
    fontSize: 12,
    marginLeft: 4,
  },

  // Add Comment
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  commentInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    padding: 8,
    marginLeft: 10,
  },
});