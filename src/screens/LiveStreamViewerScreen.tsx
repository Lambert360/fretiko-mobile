import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { liveSalesAPI, LiveStream } from '../services/liveSalesAPI';
import { liveStreamSocket, LiveComment, LiveReaction, LiveGift, ViewerCountUpdate } from '../services/liveStreamSocket';
import { useAuth } from '../contexts/AuthContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Live Stream Viewer Screen
 * 
 * Full-screen viewer interface for watching live streams:
 * - HLS video playback (expo-video compatible)
 * - Real-time comments via Socket.IO
 * - Reactions and gifts
 * - Live purchases
 * - Viewer count
 * - Auto-cleanup on unfocus
 */

const LiveStreamViewerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const { streamId, stream: initialStream } = route.params;

  // Stream state
  const [stream, setStream] = useState<LiveStream | null>(initialStream || null);
  const [viewerCount, setViewerCount] = useState(initialStream?.viewer_count || 0);

  // Comments
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(true);
  const commentsListRef = useRef<FlatList>(null);

  // Reactions
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(!initialStream);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Screen focus tracking
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Load stream details
  useEffect(() => {
    if (!initialStream) {
      loadStreamDetails();
    }
  }, []);

  const loadStreamDetails = async () => {
    try {
      setLoading(true);
      const streamData = await liveSalesAPI.getStreamById(streamId);
      setStream(streamData);
      setViewerCount(streamData.viewer_count);
    } catch (error) {
      console.error('Error loading stream:', error);
      Alert.alert('Error', 'Failed to load stream details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Connect to WebSocket and join stream
  useEffect(() => {
    if (!stream) return;

    const setupSocket = async () => {
      try {
        await liveStreamSocket.connect();
        await liveStreamSocket.joinStream(streamId, 'viewer');
        await liveSalesAPI.joinStream(streamId);

        // Register event listeners
        liveStreamSocket.on('comment', handleNewComment);
        liveStreamSocket.on('reaction', handleNewReaction);
        liveStreamSocket.on('gift', handleNewGift);
        liveStreamSocket.on('viewer_count', handleViewerCountUpdate);
        liveStreamSocket.on('stream_status', handleStreamStatusUpdate);

        console.log('✅ Connected to live stream socket');
    } catch (error) {
        console.error('Error connecting to stream:', error);
      }
    };

    setupSocket();

    return () => {
      liveStreamSocket.clearListeners();
      liveStreamSocket.leaveStream();
      liveSalesAPI.leaveStream(streamId).catch(console.error);
    };
  }, [stream]);

  // Screen focus/unfocus handling
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);

      return () => {
        setIsScreenFocused(false);
        // Don't disconnect socket, just pause video
      };
    }, [])
  );

  // Socket event handlers
  const handleNewComment = (comment: LiveComment) => {
    setComments(prev => [...prev, comment]);
    setTimeout(() => {
      commentsListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleNewReaction = (reaction: LiveReaction) => {
    setReactions(prev => [...prev, { ...reaction, id: Date.now() + Math.random() }]);
    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.slice(1));
    }, 3000);
  };

  const handleNewGift = (gift: LiveGift) => {
    // Show gift notification
        Alert.alert(
      '🎁 Gift Sent!',
      `${gift.sender.username} sent ${gift.quantity}x ${gift.gift_type}!`,
      [{ text: 'Nice!', style: 'cancel' }],
      { cancelable: true }
    );
  };

  const handleViewerCountUpdate = (data: ViewerCountUpdate) => {
    setViewerCount(data.current_viewers);
  };

  const handleStreamStatusUpdate = (data: any) => {
    if (data.status === 'ended') {
      Alert.alert(
        'Stream Ended',
        'This live stream has ended. Thank you for watching!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  // Send comment
  const handleSendComment = () => {
    if (!commentText.trim()) return;

    liveStreamSocket.sendComment(commentText.trim());
    setCommentText('');
  };

  // Send reaction
  const handleSendReaction = (reactionType: string) => {
    liveStreamSocket.sendReaction(reactionType);
    // Optimistically add reaction
    handleNewReaction({
      user: { id: user?.id || '', username: user?.username || 'You' },
      reaction_type: reactionType,
      timestamp: Date.now(),
    });
  };

  // Toggle controls visibility
  const toggleControls = () => {
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }

    if (showControls) {
      // Hide controls
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    } else {
      // Show controls
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 3 seconds
      controlsTimer.current = setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 3000);
    }
  };

  // Render comment item
  const renderCommentItem = ({ item }: { item: LiveComment }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentUser}>{item.user.username}: </Text>
      <Text style={styles.commentText}>{item.message}</Text>
    </View>
  );

  // Render reaction animation
  const renderReaction = (reaction: any, index: number) => {
    const randomOffset = Math.random() * (screenWidth - 100);
    return (
      <Animated.View
        key={`${reaction.timestamp}-${index}`}
        style={[
          styles.reactionBubble,
          {
            left: randomOffset,
            transform: [
              {
                translateY: new Animated.Value(0).interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight, -100],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.reactionEmoji}>
          {reaction.reaction_type === 'heart' ? '❤️' : reaction.reaction_type === 'fire' ? '🔥' : '👍'}
        </Text>
      </Animated.View>
    );
  };

  if (loading || !stream) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1}
        onPress={toggleControls}
      >
        {stream.stream_url && isScreenFocused ? (
          <VideoView
            style={styles.video}
            player={{
              uri: stream.stream_url,
              autoplay: true,
              loop: false,
              muted: isMuted,
            }}
            nativeControls={false}
            contentFit="cover"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam-off" size={60} color="#666" />
            <Text style={styles.videoPlaceholderText}>Stream paused</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Reactions Overlay */}
      <View style={styles.reactionsOverlay} pointerEvents="none">
        {reactions.map((reaction, index) => renderReaction(reaction, index))}
      </View>

      {/* Top Controls */}
      {showControls && (
        <Animated.View style={[styles.topControls, { paddingTop: insets.top + 10, opacity: controlsOpacity }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="white" />
            </TouchableOpacity>
            
          <View style={styles.topInfo}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            <View style={styles.viewerCount}>
              <Ionicons name="eye" size={14} color="white" />
              <Text style={styles.viewerText}>{viewerCount}</Text>
            </View>
            </View>

          <TouchableOpacity style={styles.muteButton} onPress={() => setIsMuted(!isMuted)}>
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="white" />
            </TouchableOpacity>
        </Animated.View>
      )}

      {/* Stream Info Overlay */}
      <View style={styles.streamInfoOverlay}>
                <Text style={styles.vendorName}>@{stream.vendor.username}</Text>
        <Text style={styles.streamTitle}>{stream.title}</Text>
        {stream.description && (
          <Text style={styles.streamDescription} numberOfLines={2}>
            {stream.description}
          </Text>
        )}
            </View>

      {/* Comments Section */}
      {showComments && (
        <View style={[styles.commentsSection, { paddingBottom: insets.bottom + 70 }]}>
          <FlatList
            ref={commentsListRef}
            data={comments}
            renderItem={renderCommentItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            showsVerticalScrollIndicator={false}
            style={styles.commentsList}
          />
          </View>
        )}

      {/* Bottom Controls */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.bottomControls, { paddingBottom: insets.bottom + 10 }]}
      >
        {/* Reaction Buttons */}
        <View style={styles.reactionButtons}>
          <TouchableOpacity style={styles.reactionButton} onPress={() => handleSendReaction('heart')}>
            <Text style={styles.reactionButtonEmoji}>❤️</Text>
              </TouchableOpacity>
          <TouchableOpacity style={styles.reactionButton} onPress={() => handleSendReaction('fire')}>
            <Text style={styles.reactionButtonEmoji}>🔥</Text>
              </TouchableOpacity>
          <TouchableOpacity style={styles.reactionButton} onPress={() => handleSendReaction('thumbs_up')}>
            <Text style={styles.reactionButtonEmoji}>👍</Text>
              </TouchableOpacity>
                  </View>

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
              <TouchableOpacity
            style={styles.toggleCommentsButton}
            onPress={() => setShowComments(!showComments)}
              >
            <Ionicons name={showComments ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color="white" />
              </TouchableOpacity>

          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#666"
            value={commentText}
            onChangeText={setCommentText}
            onSubmitEditing={handleSendComment}
            returnKeyType="send"
          />

          <TouchableOpacity 
            style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendComment}
            disabled={!commentText.trim()}
          >
            <Ionicons name="send" size={20} color={commentText.trim() ? '#3498DB' : '#444'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoPlaceholderText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  reactionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  reactionBubble: {
    position: 'absolute',
    bottom: 0,
  },
  reactionEmoji: {
    fontSize: 40,
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
  },
  backButton: {
    padding: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  topInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    gap: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    gap: 5,
  },
  viewerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  muteButton: {
    padding: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  streamInfoOverlay: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 150,
  },
  vendorName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  streamTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  streamDescription: {
    color: 'white',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  commentsSection: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 0,
    maxHeight: 300,
  },
  commentsList: {
    flexGrow: 0,
  },
  commentItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    maxWidth: '80%',
  },
  commentUser: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  commentText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  reactionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 10,
  },
  reactionButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  reactionButtonEmoji: {
    fontSize: 24,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  toggleCommentsButton: {
    padding: 5,
  },
  commentInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    paddingVertical: 5,
  },
  sendButton: {
    padding: 5,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});

export default LiveStreamViewerScreen;
