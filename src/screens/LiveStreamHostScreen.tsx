import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI, LiveStream, Comment } from '../services/liveSalesAPI';
import { auctionSounds } from '../utils/auctionSounds';
import { WinnerAnnouncementAnimation } from '../components/WinnerAnnouncementAnimation';
import { auctionsAPI, auctionSocket } from '../services/auctionsAPI';
import { createAgoraRtcEngine, ChannelProfileType, ClientRoleType, IRtcEngine, ChannelMediaOptions, RtcSurfaceView, RenderModeType } from 'react-native-agora';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Host analytics card
const AnalyticsCard = ({
  title,
  value,
  icon,
  color = '#3498DB'
}: {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}) => (
  <View style={[styles.analyticsCard, { borderColor: color }]}>
    <View style={[styles.analyticsIcon, { backgroundColor: color }]}>
      <Ionicons name={icon as any} size={20} color="white" />
    </View>
    <View style={styles.analyticsContent}>
      <Text style={styles.analyticsValue}>{value}</Text>
      <Text style={styles.analyticsTitle}>{title}</Text>
    </View>
  </View>
);

// Live comment item for host view
const HostCommentItem = ({ comment }: { comment: Comment }) => (
  <View style={styles.hostCommentItem}>
    <Image
      source={{ uri: comment.user.avatar_url || 'https://via.placeholder.com/32x32' }}
      style={styles.hostCommentAvatar}
    />
    <View style={styles.hostCommentContent}>
      <Text style={styles.hostCommentUsername}>{comment.user.username}</Text>
      <Text style={styles.hostCommentMessage}>{comment.message}</Text>
    </View>
    <TouchableOpacity style={styles.pinButton}>
      <Ionicons name="pin-outline" size={16} color="#888" />
    </TouchableOpacity>
  </View>
);

// Auction Control Panel for host
const AuctionControlPanel = ({
  auction,
  onGoingOnce,
  onGoingTwice,
  onSold,
  onNoSale,
}: {
  auction: any;
  onGoingOnce: () => void;
  onGoingTwice: () => void;
  onSold: () => void;
  onNoSale: () => void;
}) => {
  if (!auction) return null;

  return (
    <View style={styles.auctionControlPanel}>
      <View style={styles.auctionControlHeader}>
        <Ionicons name="hammer" size={24} color="#8E44AD" />
        <Text style={styles.auctionControlTitle}>Auction Controls</Text>
      </View>

      <View style={styles.auctionStats}>
        <View style={styles.auctionStatItem}>
          <Text style={styles.auctionStatLabel}>Current Bid</Text>
          <Text style={styles.auctionStatValue}>₣{auction.current_bid}</Text>
        </View>
        <View style={styles.auctionStatItem}>
          <Text style={styles.auctionStatLabel}>Total Bids</Text>
          <Text style={styles.auctionStatValue}>{auction.total_bids || 0}</Text>
        </View>
        <View style={styles.auctionStatItem}>
          <Text style={styles.auctionStatLabel}>Time Left</Text>
          <Text style={styles.auctionStatValue}>{auction.time_remaining || '0:00'}</Text>
        </View>
      </View>

      <View style={styles.auctionControlButtons}>
        <TouchableOpacity
          style={[styles.auctionControlButton, styles.goingOnceButton]}
          onPress={onGoingOnce}
        >
          <Ionicons name="timer-outline" size={20} color="white" />
          <Text style={styles.auctionControlButtonText}>Going Once</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.auctionControlButton, styles.goingTwiceButton]}
          onPress={onGoingTwice}
        >
          <Ionicons name="time-outline" size={20} color="white" />
          <Text style={styles.auctionControlButtonText}>Going Twice</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.auctionControlButtons}>
        <TouchableOpacity
          style={[styles.auctionControlButton, styles.soldButton]}
          onPress={onSold}
        >
          <Ionicons name="checkmark-circle" size={20} color="white" />
          <Text style={styles.auctionControlButtonText}>SOLD!</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.auctionControlButton, styles.noSaleButton]}
          onPress={onNoSale}
        >
          <Ionicons name="close-circle" size={20} color="white" />
          <Text style={styles.auctionControlButtonText}>No Sale</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Auctioneer message suggester
const AuctioneerMessageSuggester = ({
  onSelectMessage,
}: {
  onSelectMessage: (message: string) => void;
}) => {
  const suggestedMessages = [
    "We have a new bid! Do I hear more?",
    "This is a fantastic piece, don't miss out!",
    "Going once at the current bid...",
    "Last chance to bid on this amazing item!",
    "What a great price for this quality!",
    "We're closing in on the final moments!",
  ];

  return (
    <View style={styles.messageSuggester}>
      <Text style={styles.messageSuggesterTitle}>Quick Messages</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {suggestedMessages.map((message, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestedMessageButton}
            onPress={() => onSelectMessage(message)}
          >
            <Text style={styles.suggestedMessageText}>{message}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Live Stream Host Screen
 *
 * This screen is for vendors/sellers who are hosting their own live stream.
 * Features:
 * - Real-time analytics dashboard
 * - Stream controls (start/pause/end)
 * - Live comments management
 * - Product inventory management
 * - Viewer engagement tools
 */
const LiveStreamHostScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Stream data from navigation params
  const { streamId, stream: initialStream, agoraConfig: initialAgoraConfig } = route.params || {};

  // State management
  const [stream, setStream] = useState<LiveStream | null>(initialStream);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [analytics, setAnalytics] = useState({
    viewers: 0,
    totalViewers: 0,
    comments: 0,
    reactions: 0,
    sales: 0,
    revenue: 0,
  });

  // Auction state (for live auction streams)
  const [isAuctionStream, setIsAuctionStream] = useState(false);
  const [currentAuction, setCurrentAuction] = useState<any>(null);
  const [showAuctionControls, setShowAuctionControls] = useState(true);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [winnerData, setWinnerData] = useState<any>(null);

  // Agora state
  const [agoraConfig, setAgoraConfig] = useState<any>(initialAgoraConfig);
  const [agoraEngine, setAgoraEngine] = useState<IRtcEngine | null>(null);
  const agoraEngineRef = useRef<IRtcEngine | null>(null);
  const [isAgoraInitialized, setIsAgoraInitialized] = useState(false);
  const [isPreviewStarted, setIsPreviewStarted] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  // Initialize auction sounds and WebSocket when entering auction stream
  useEffect(() => {
    if (isAuctionStream && currentAuction) {
      auctionSounds.initialize();
      auctionSounds.startAmbience(0.2);

      // Connect to auction WebSocket
      auctionSocket.joinAuction(currentAuction.id, user?.id);

      // Setup WebSocket event listeners
      const handleBidPlaced = (data: any) => {
        console.log('[HOST] Bid placed event:', data);
        // Update auction state with new bid
        setCurrentAuction((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            current_bid: data.amount,
            total_bids: (prev.total_bids || 0) + 1,
          };
        });
        // Play excited crowd sound
        auctionSounds.playExcitedCrowd(0.5);
      };

      auctionSocket.on('bid_placed', handleBidPlaced);

      return () => {
        auctionSounds.stopAmbience();
        auctionSounds.cleanup();
        auctionSocket.off('bid_placed', handleBidPlaced);
        auctionSocket.leaveAuction(currentAuction.id);
      };
    }
  }, [isAuctionStream, currentAuction?.id]);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load stream data
  const loadStreamData = async () => {
    if (!streamId) return;

    try {
      setLoading(true);
      const streamData = await liveSalesAPI.getStreamById(streamId);
      setStream(streamData);
      // If we have agoraConfig, we're already broadcasting, so force isLive to true
      setIsLive(streamData.status === 'live' || !!agoraConfig);

      // Load comments
      const commentsData = await liveSalesAPI.getStreamComments(streamId);
      setComments(commentsData);

      // Update analytics
      setAnalytics({
        viewers: streamData.viewer_count || 0,
        totalViewers: streamData.total_viewers || 0,
        comments: commentsData.length,
        reactions: 0, // TODO: Get from API
        sales: 0, // TODO: Get from API
        revenue: streamData.total_sales || 0,
      });
    } catch (error) {
      console.error('Error loading stream data:', error);
      Alert.alert('Error', 'Failed to load stream data');
    } finally {
      setLoading(false);
    }
  };

  const initializeAgoraEngine = useCallback(async () => {
    if (isAgoraInitialized || agoraEngineRef.current || !agoraConfig) {
      return;
    }

    try {
      const engine = createAgoraRtcEngine();
      agoraEngineRef.current = engine;
      setAgoraEngine(engine);

      const initResult = engine.initialize({
        appId: agoraConfig.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      if (initResult !== 0) {
        throw new Error(`Engine initialization failed with code: ${initResult}`);
      }

      setIsAgoraInitialized(true);

      await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      await engine.enableVideo();
      await engine.enableAudio();

      await engine.startPreview();
      setIsPreviewStarted(true);

      engine.addListener('onJoinChannelSuccess', () => {
        setIsJoined(true);
      });

      engine.addListener('onLeaveChannel', () => {
        setIsJoined(false);
        setIsPreviewStarted(false);
      });

      engine.addListener('onError', (err: number, msg: string) => {
        console.error('Agora error in LiveStreamHostScreen:', { err, msg });
      });

      const mediaOptions = new ChannelMediaOptions();
      mediaOptions.publishCameraTrack = true;
      mediaOptions.publishMicrophoneTrack = true;

      const joinResult = await (engine as any).joinChannel(
        agoraConfig.token || '',
        agoraConfig.channel,
        agoraConfig.uid ?? 0,
        mediaOptions
      );

      if (joinResult !== 0) {
        throw new Error(`joinChannel failed with error code: ${joinResult}`);
      }
    } catch (error: any) {
      console.error('Failed to initialize Agora engine in LiveStreamHostScreen:', error);
      setIsPreviewStarted(false);
      setIsJoined(false);
      Alert.alert('Stream Error', 'Failed to start camera. Please try again.');
    }
  }, [agoraConfig, isAgoraInitialized]);

  const cleanupAgoraEngine = useCallback(async () => {
    const engine = agoraEngineRef.current;

    if (engine) {
      try {
        engine.removeAllListeners();
        await engine.leaveChannel();
        await engine.release();
      } catch (error) {
        console.warn('Agora cleanup warning in LiveStreamHostScreen:', error);
      } finally {
        agoraEngineRef.current = null;
        setAgoraEngine(null);
        setIsJoined(false);
        setIsPreviewStarted(false);
        setIsAgoraInitialized(false);
      }
    }

    setAgoraConfig(null);
  }, []);

  useEffect(() => {
    if (agoraConfig) {
      initializeAgoraEngine();
    }
  }, [agoraConfig, initializeAgoraEngine]);

  useEffect(() => {
    return () => {
      cleanupAgoraEngine().catch((error) => {
        console.error('Error during Agora cleanup on unmount in LiveStreamHostScreen:', error);
      });
    };
  }, [cleanupAgoraEngine]);

  // Pulse animation for live indicator
  useEffect(() => {
    if (isLive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLive]);

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadStreamData();
    }, [streamId])
  );

  // Handle going live
  const handleGoLive = async () => {
    try {
      await liveSalesAPI.updateStreamStatus(
        streamId,
        'live',
        `rtmp://live.example.com/stream/${streamId}` // TODO: Use actual streaming URL
      );
      setIsLive(true);
      Alert.alert('Success', 'You are now live!');
      await loadStreamData();
    } catch (error) {
      console.error('Error going live:', error);
      Alert.alert('Error', 'Failed to start live stream');
    }
  };

  // Handle ending stream
  // Auction control handlers
  const handleGoingOnce = async () => {
    try {
      if (!currentAuction) return;

      // Play going once sound sequence
      auctionSounds.playGoingOnce();

      const message = `Going once at ₣${currentAuction.current_bid}...`;

      // Send auctioneer event via WebSocket
      auctionSocket.sendAuctioneerEvent(currentAuction.id, 'going_once', message);

      // Also post to comments for persistence
      await liveSalesAPI.postComment(streamId, `📢 ${message}`);

      Alert.alert('Auctioneer', message);
    } catch (error) {
      console.error('Error triggering going once:', error);
      Alert.alert('Error', 'Failed to send auctioneer message');
    }
  };

  const handleGoingTwice = async () => {
    try {
      if (!currentAuction) return;

      // Play going twice sound sequence
      auctionSounds.playGoingTwice();

      const message = `Going twice at ₣${currentAuction.current_bid}... Last chance!`;

      // Send auctioneer event via WebSocket
      auctionSocket.sendAuctioneerEvent(currentAuction.id, 'going_twice', message);

      // Also post to comments for persistence
      await liveSalesAPI.postComment(streamId, `📢 ${message}`);

      Alert.alert('Auctioneer', message);
    } catch (error) {
      console.error('Error triggering going twice:', error);
      Alert.alert('Error', 'Failed to send auctioneer message');
    }
  };

  const handleSold = async () => {
    try {
      if (!currentAuction) return;

      // Play sold sound sequence (hammer + cheer)
      auctionSounds.playSold();

      const message = `SOLD for ₣${currentAuction.current_bid}! Congratulations to the winner! 🎉`;

      // Send auctioneer event via WebSocket
      auctionSocket.sendAuctioneerEvent(currentAuction.id, 'sold', message);

      // Post to comments for persistence
      await liveSalesAPI.postComment(streamId, `📢 ${message}`);

      // Complete the auction sale via API
      try {
        await auctionsAPI.completeSale(currentAuction.id);
      } catch (apiError) {
        console.error('Error completing auction sale via API:', apiError);
        // Continue showing animation even if API call fails
      }

      // Show winner announcement animation
      setWinnerData({
        winnerName: 'Highest Bidder', // TODO: Get actual winner name from auction data
        bidAmount: currentAuction.current_bid,
        itemName: currentAuction.item_name || currentAuction.title || 'Auction Item',
      });
      setShowWinnerAnimation(true);

      // Update auction state
      setCurrentAuction({ ...currentAuction, status: 'sold' });
    } catch (error) {
      console.error('Error marking as sold:', error);
      Alert.alert('Error', 'Failed to mark auction as sold');
    }
  };

  const handleNoSale = async () => {
    try {
      if (!currentAuction) return;

      const message = 'No sale. Reserve price was not met. Thank you for your bids!';

      // Send auctioneer event via WebSocket
      auctionSocket.sendAuctioneerEvent(currentAuction.id, 'no_sale', message);

      // Post to comments for persistence
      await liveSalesAPI.postComment(streamId, `📢 ${message}`);

      Alert.alert('No Sale', message);

      // Update auction state
      setCurrentAuction({ ...currentAuction, status: 'no_sale' });
    } catch (error) {
      console.error('Error marking as no sale:', error);
      Alert.alert('Error', 'Failed to mark auction as no sale');
    }
  };

  const handleSelectSuggestedMessage = (message: string) => {
    setNewMessage(message);
  };

  const handleEndStream = () => {
    Alert.alert(
      'End Stream',
      'Are you sure you want to end your live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: async () => {
            try {
              await cleanupAgoraEngine();
              await liveSalesAPI.endStream(streamId);
              navigation.goBack();
            } catch (error) {
              console.error('Error ending stream:', error);
              Alert.alert('Error', 'Failed to end stream');
            }
          },
        },
      ]
    );
  };

  // Send host message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = `📢 ${newMessage.trim()}`;

    // Validate message length
    if (messageText.length > 500) {
      Alert.alert('Error', 'Message is too long. Please keep it under 500 characters.');
      return;
    }

    // Validate stream ID
    if (!streamId) {
      Alert.alert('Error', 'Stream ID is missing.');
      return;
    }

    console.log('💬 Sending comment:', {
      stream_id: streamId,
      message: messageText,
      messageLength: messageText.length
    });

    try {
      await liveSalesAPI.postComment(streamId, messageText);
      setNewMessage('');
      await loadStreamData(); // Refresh comments
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  if (!stream) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{stream.title}</Text>
          <View style={styles.statusContainer}>
            {isLive ? (
              <Animated.View
                style={[
                  styles.liveIndicator,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </Animated.View>
            ) : (
              <View style={styles.setupIndicator}>
                <Text style={styles.setupText}>SETUP</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {/* TODO: Open stream settings */}}
        >
          <Ionicons name="settings" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stream Preview / Agora Video UI */}
        <View style={styles.previewContainer}>
          {isPreviewStarted && agoraConfig ? (
            <RtcSurfaceView
              style={styles.videoView}
              canvas={{
                uid: 0,
                renderMode: RenderModeType.RenderModeFit,
                mirrorMode: 1,
              }}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Ionicons name="videocam" size={60} color="#666" />
              <Text style={styles.previewText}>
                {isLive ? 'Your live stream' : 'Stream preview'}
              </Text>
            </View>
          )}

          {/* Stream Controls */}
          <View style={styles.streamControls}>
            {isLive ? (
              <TouchableOpacity
                style={styles.endStreamButton}
                onPress={handleEndStream}
              >
                <Ionicons name="stop" size={24} color="white" />
                <Text style={styles.endStreamText}>End Stream</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Analytics Dashboard */}
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>Live Analytics</Text>
          <View style={styles.analyticsGrid}>
            <AnalyticsCard
              title="Current Viewers"
              value={analytics.viewers}
              icon="eye"
              color="#3498DB"
            />
            <AnalyticsCard
              title="Total Viewers"
              value={analytics.totalViewers}
              icon="people"
              color="#27AE60"
            />
            <AnalyticsCard
              title="Comments"
              value={analytics.comments}
              icon="chatbubble"
              color="#F39C12"
            />
            <AnalyticsCard
              title="Revenue"
              value={`₣${analytics.revenue}`}
              icon="flash"
              color="#E74C3C"
            />
          </View>
        </View>

        {/* Auction Control Panel - for live auction streams */}
        {isAuctionStream && currentAuction && showAuctionControls && (
          <AuctionControlPanel
            auction={currentAuction}
            onGoingOnce={handleGoingOnce}
            onGoingTwice={handleGoingTwice}
            onSold={handleSold}
            onNoSale={handleNoSale}
          />
        )}

        {/* Auctioneer Message Suggester - for auction streams */}
        {isAuctionStream && (
          <AuctioneerMessageSuggester onSelectMessage={handleSelectSuggestedMessage} />
        )}

        {/* Winner Announcement Animation */}
        {showWinnerAnimation && winnerData && (
          <WinnerAnnouncementAnimation
            isVisible={showWinnerAnimation}
            winnerName={winnerData.winnerName}
            bidAmount={winnerData.bidAmount}
            itemName={winnerData.itemName}
            onAnimationEnd={() => {
              setShowWinnerAnimation(false);
              setWinnerData(null);
            }}
          />
        )}

        {/* Host Messages */}
        <View style={styles.hostMessageSection}>
          <Text style={styles.sectionTitle}>Send Message to Viewers</Text>
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message to your viewers..."
              placeholderTextColor="#888"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendMessage}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Live Comments</Text>
          {comments.length > 0 ? (
            <FlatList
              data={comments}
              renderItem={({ item }) => <HostCommentItem comment={item} />}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.commentsList}
            />
          ) : (
            <View style={styles.noComments}>
              <Ionicons name="chatbubble-outline" size={40} color="#666" />
              <Text style={styles.noCommentsText}>No comments yet</Text>
              <Text style={styles.noCommentsSubtext}>
                Comments from viewers will appear here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusContainer: {
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  setupIndicator: {
    backgroundColor: '#666',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  setupText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 8,
  },

  // Auction styles
  auctionControlPanel: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#8E44AD',
  },
  auctionControlHeader: {
    marginBottom: 12,
  },
  auctionControlTitle: {
    color: '#8E44AD',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  auctionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(142, 68, 173, 0.3)',
  },
  auctionStatItem: {
    alignItems: 'center',
  },
  auctionStatLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  auctionStatValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  auctionControlButtons: {
    gap: 10,
  },
  auctionControlButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  auctionControlButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  goingOnceButton: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderColor: '#FFC107',
  },
  goingTwiceButton: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderColor: '#FF9800',
  },
  soldButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  noSaleButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#F44336',
  },
  messageSuggester: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  messageSuggesterTitle: {
    color: '#8E44AD',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 4,
  },
  suggestedMessageButton: {
    backgroundColor: 'rgba(142, 68, 173, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#8E44AD',
  },
  suggestedMessageText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },

  // Content
  content: {
    flex: 1,
  },

  // Stream Preview
  previewContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  previewPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  videoView: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  previewText: {
    color: '#666',
    fontSize: 16,
    marginTop: 8,
  },
  streamControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  goLiveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  endStreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  endStreamText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Analytics
  analyticsSection: {
    margin: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticsCard: {
    width: screenWidth / 2 - 24,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyticsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  analyticsContent: {
    flex: 1,
  },
  analyticsValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  analyticsTitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },

  // Host Messages
  hostMessageSection: {
    margin: 16,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
  },
  messageInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    maxHeight: 80,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#3498DB',
    padding: 8,
    borderRadius: 20,
  },

  // Comments
  commentsSection: {
    margin: 16,
    marginBottom: 32,
  },
  commentsList: {
    maxHeight: 300,
  },
  hostCommentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  hostCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  hostCommentContent: {
    flex: 1,
  },
  hostCommentUsername: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  hostCommentMessage: {
    color: 'white',
    fontSize: 14,
    lineHeight: 18,
  },
  pinButton: {
    padding: 4,
  },
  noComments: {
    alignItems: 'center',
    padding: 32,
  },
  noCommentsText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  noCommentsSubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  // Loading
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
});

export default LiveStreamHostScreen;