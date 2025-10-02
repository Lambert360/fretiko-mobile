import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI, LiveStream } from '../services/liveSalesAPI';

// Import our enhanced streaming components
import LiveStreamViewer from '../components/LiveStreamViewer';
import LiveStreamPublisher from '../components/LiveStreamPublisher';
import StreamQualityControls from '../components/StreamQualityControls';
import CameraAudioControls from '../components/CameraAudioControls';
import { streamingService } from '../services/streamingService';
import { getStreamingEnvironment } from '../utils/streamingEnvironment';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface EnhancedLiveStream extends LiveStream {
  has_video_stream: boolean;
  channel_name?: string;
  stream_quality: 'low' | 'medium' | 'high' | 'auto';
  video_enabled: boolean;
  audio_enabled: boolean;
}

/**
 * Enhanced Live Sales Screen
 *
 * Integrates video streaming with live sales workflow:
 * - Traditional live sales with video overlay
 * - Real-time video streaming for vendors
 * - Video viewing for customers
 * - Quality controls and camera management
 * - Seamless fallback to original experience
 * - Live sales features (products, gifts, services) integrated with video
 */
const EnhancedLiveSalesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();

  // State management
  const [streams, setStreams] = useState<EnhancedLiveStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStream, setSelectedStream] = useState<EnhancedLiveStream | null>(null);
  const [isVideoStreamingAvailable, setIsVideoStreamingAvailable] = useState(false);

  // Video streaming states
  const [showQualityControls, setShowQualityControls] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<'low' | 'medium' | 'high' | 'auto'>('medium');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // Check streaming capabilities on mount
  useEffect(() => {
    checkStreamingCapabilities();
  }, []);

  // Load streams when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadStreams();
    }, [])
  );

  // Check streaming capabilities
  const checkStreamingCapabilities = async () => {
    try {
      const environment = await getStreamingEnvironment();
      setIsVideoStreamingAvailable(environment.capabilities.hasVideoStreaming);
      await streamingService.initialize();
    } catch (error) {
      console.error('Error checking streaming capabilities:', error);
      setIsVideoStreamingAvailable(false);
    }
  };

  // Load live streams
  const loadStreams = async () => {
    try {
      setIsLoading(true);
      const data = await liveSalesAPI.getActiveStreams();

      // Enhance streams with video streaming capabilities
      const enhancedStreams: EnhancedLiveStream[] = data.map(stream => ({
        ...stream,
        has_video_stream: isVideoStreamingAvailable && stream.status === 'active',
        channel_name: `live_${stream.vendor_id}_${stream.id}`,
        stream_quality: 'medium' as const,
        video_enabled: true,
        audio_enabled: true,
      }));

      setStreams(enhancedStreams);
    } catch (error) {
      console.error('Error loading streams:', error);
      Alert.alert('Error', 'Failed to load live streams');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStreams();
    setIsRefreshing(false);
  }, []);

  // Handle stream selection
  const handleStreamPress = (stream: EnhancedLiveStream) => {
    setSelectedStream(stream);

    if (stream.has_video_stream) {
      // Navigate to enhanced video streaming experience
      navigation.navigate('LiveStreamViewer', {
        streamId: stream.id,
        channelName: stream.channel_name,
        vendorId: stream.vendor_id,
        fallbackUrl: stream.stream_url,
        thumbnailUrl: stream.thumbnail_url,
        hasVideoStreaming: true,
      });
    } else {
      // Navigate to traditional live sales experience
      navigation.navigate('LiveStreamViewer', {
        streamId: stream.id,
        streamUrl: stream.stream_url,
        thumbnailUrl: stream.thumbnail_url,
        hasVideoStreaming: false,
      });
    }
  };

  // Handle start streaming for vendors
  const handleStartStreaming = async () => {
    if (!user) return;

    try {
      Alert.alert(
        'Start Live Stream',
        'Choose your streaming mode:',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Video Stream',
            onPress: () => startVideoStream(),
            style: 'default',
          },
          {
            text: 'Traditional Stream',
            onPress: () => startTraditionalStream(),
            style: 'default',
          },
        ]
      );
    } catch (error) {
      console.error('Error starting stream:', error);
    }
  };

  // Start video streaming
  const startVideoStream = async () => {
    try {
      // Create stream in backend
      const streamData = {
        title: 'Live Video Stream',
        description: 'Live streaming with video',
        category: 'general',
        tags: ['live', 'video'],
      };

      const response = await fetch('/api/streaming/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify(streamData),
      });

      const { stream } = await response.json();

      // Navigate to video publisher
      navigation.navigate('LiveStreamPublisher', {
        streamId: stream.id,
        channelName: stream.channel_name,
        vendorId: user.id,
        streamConfig: streamData,
      });

    } catch (error) {
      console.error('Error starting video stream:', error);
      Alert.alert('Error', 'Failed to start video stream');
    }
  };

  // Start traditional streaming
  const startTraditionalStream = () => {
    navigation.navigate('StartLiveStream');
  };

  // Handle quality change
  const handleQualityChange = async (quality: 'low' | 'medium' | 'high' | 'auto') => {
    setCurrentQuality(quality);

    if (selectedStream) {
      try {
        // Update stream quality via API
        await fetch(`/api/streaming/${selectedStream.id}/update-quality`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}`,
          },
          body: JSON.stringify({
            resolution: quality === 'high' ? '1280x720' : quality === 'medium' ? '640x480' : '480x360',
            frameRate: quality === 'high' ? 30 : 24,
            bitrate: quality === 'high' ? 1500 : quality === 'medium' ? 800 : 400,
          }),
        });
      } catch (error) {
        console.error('Error updating quality:', error);
      }
    }
  };

  // Camera/Audio control handlers
  const handleToggleVideo = async (enabled: boolean) => {
    setIsVideoEnabled(enabled);
    await streamingService.toggleVideo(enabled);
  };

  const handleToggleAudio = async (enabled: boolean) => {
    setIsAudioEnabled(enabled);
    await streamingService.toggleAudio(enabled);
  };

  const handleSwitchCamera = async () => {
    setIsFrontCamera(!isFrontCamera);
    await streamingService.switchCamera();
  };

  // Render enhanced stream card
  const renderEnhancedStreamCard = ({ item: stream }: { item: EnhancedLiveStream }) => {
    const formatViewerCount = (count: number) => {
      if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
      return count.toString();
    };

    return (
      <TouchableOpacity
        style={styles.streamCard}
        onPress={() => handleStreamPress(stream)}
        activeOpacity={0.9}
      >
        {/* Video preview container */}
        <View style={styles.videoContainer}>
          {stream.has_video_stream ? (
            // Enhanced video preview with streaming indicator
            <View style={styles.enhancedVideoPreview}>
              <LiveStreamViewer
                streamId={stream.id}
                channelName={stream.channel_name!}
                vendorId={stream.vendor_id}
                streamUrl={stream.stream_url}
                thumbnailUrl={stream.thumbnail_url}
                showAnalytics={false}
                style={styles.previewVideo}
              />

              {/* Video streaming indicator */}
              <View style={styles.videoStreamIndicator}>
                <Ionicons name="videocam" size={12} color="white" />
                <Text style={styles.videoStreamText}>HD</Text>
              </View>
            </View>
          ) : (
            // Traditional video preview
            <Image
              source={{ uri: stream.thumbnail_url || 'https://via.placeholder.com/400x600' }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          )}

          {/* Stream overlay info */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.streamOverlay}
          >
            <View style={styles.streamInfo}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>

              <View style={styles.viewerCount}>
                <Ionicons name="eye" size={12} color="white" />
                <Text style={styles.viewerCountText}>
                  {formatViewerCount(stream.viewer_count)}
                </Text>
              </View>
            </View>

            {/* Vendor info */}
            <View style={styles.vendorInfo}>
              <Image
                source={{ uri: stream.vendor_avatar || 'https://via.placeholder.com/32x32' }}
                style={styles.vendorAvatar}
              />
              <View style={styles.vendorDetails}>
                <Text style={styles.vendorName} numberOfLines={1}>
                  {stream.vendor_name}
                </Text>
                <Text style={styles.streamTitle} numberOfLines={2}>
                  {stream.title}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Stream actions */}
        <View style={styles.streamActions}>
          {stream.has_video_stream && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowQualityControls(true)}
            >
              <Ionicons name="settings" size={16} color="#667eea" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="videocam-off" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Live Streams</Text>
      <Text style={styles.emptyDescription}>
        Be the first to start a live stream!
      </Text>

      {user?.account_type === 'vendor' && (
        <TouchableOpacity
          style={styles.startStreamButton}
          onPress={handleStartStreaming}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.startStreamGradient}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.startStreamText}>Start Streaming</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render header
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.headerTitle}>Live Sales</Text>

      <View style={styles.headerActions}>
        {isVideoStreamingAvailable && (
          <View style={styles.streamingBadge}>
            <Ionicons name="videocam" size={12} color="#34C759" />
            <Text style={styles.streamingBadgeText}>HD</Text>
          </View>
        )}

        {user?.account_type === 'vendor' && (
          <TouchableOpacity
            style={styles.addStreamButton}
            onPress={handleStartStreaming}
          >
            <Ionicons name="add" size={24} color="#667eea" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading live streams...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {renderHeader()}

      <FlatList
        data={streams}
        renderItem={renderEnhancedStreamCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.streamsList}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Quality Controls Modal */}
      <StreamQualityControls
        isVisible={showQualityControls}
        onClose={() => setShowQualityControls(false)}
        currentQuality={currentQuality}
        onQualityChange={handleQualityChange}
        isPublisher={false}
      />

      {/* Camera/Audio Controls Modal */}
      <CameraAudioControls
        isVisible={showCameraControls}
        onClose={() => setShowCameraControls(false)}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isFrontCamera={isFrontCamera}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onSwitchCamera={handleSwitchCamera}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streamingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fff4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  streamingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#34C759',
    marginLeft: 4,
  },
  addStreamButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#667eea',
  },

  // Stream list styles
  streamsList: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },

  // Stream card styles
  streamCard: {
    width: (screenWidth - 48) / 2,
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  videoContainer: {
    aspectRatio: 9 / 16,
    position: 'relative',
  },
  enhancedVideoPreview: {
    flex: 1,
    position: 'relative',
  },
  previewVideo: {
    flex: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  videoStreamIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoStreamText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 2,
  },

  // Stream overlay styles
  streamOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  streamInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'white',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  viewerCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },

  // Vendor info styles
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  vendorDetails: {
    flex: 1,
  },
  vendorName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  streamTitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Stream actions styles
  streamActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  startStreamButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  startStreamGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  startStreamText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
});

export default EnhancedLiveSalesScreen;