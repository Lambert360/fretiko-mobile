import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Conditional imports based on environment
import { getStreamingEnvironment } from '../utils/streamingEnvironment';
import { streamingService } from '../services/streamingService';
import MockVideoStream from './MockVideoStream';
import LiveStreamAnalyticsOverlay from './LiveStreamAnalyticsOverlay';
import { useRealtimeAnalytics } from '../hooks/useRealtimeAnalytics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Try to import Agora components (only available in dev/prod builds)
let AgoraRtcEngine: any = null;
let AgoraSurfaceView: any = null;

try {
  if (Platform.OS !== 'web') {
    const AgoraModule = require('react-native-agora');
    AgoraRtcEngine = AgoraModule.RtcEngine;
    AgoraSurfaceView = AgoraModule.AgoraSurfaceView;
  }
} catch (error) {
  console.log('Agora components not available, using mock streaming');
}

interface LiveStreamPublisherProps {
  streamId: string;
  channelName: string;
  vendorId: string;
  onStreamEnd?: () => void;
  onError?: (error: string) => void;
  onViewerCountChange?: (count: number) => void;
  streamConfig?: {
    title: string;
    description?: string;
    category: string;
  };
}

interface StreamingStats {
  isLive: boolean;
  duration: number;
  viewerCount: number;
  totalRevenue: number;
  networkQuality: number;
}

/**
 * Live Stream Publisher Component
 *
 * Comprehensive live streaming publisher that:
 * - Handles both real Agora SDK and mock streaming
 * - Provides professional streaming controls
 * - Integrates with live sales analytics
 * - Manages camera, audio, and quality settings
 * - Supports real-time viewer interaction
 */
const LiveStreamPublisher: React.FC<LiveStreamPublisherProps> = ({
  streamId,
  channelName,
  vendorId,
  onStreamEnd,
  onError,
  onViewerCountChange,
  streamConfig,
}) => {
  const insets = useSafeAreaInsets();

  // State management
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [streamingStats, setStreamingStats] = useState<StreamingStats>({
    isLive: false,
    duration: 0,
    viewerCount: 0,
    totalRevenue: 0,
    networkQuality: 0,
  });
  const [currentQuality, setCurrentQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [showControls, setShowControls] = useState(true);
  const [useMockStreaming, setUseMockStreaming] = useState(false);

  // Refs
  const streamStartTime = useRef<Date | null>(null);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Real-time analytics
  const { analyticsData, isConnected } = useRealtimeAnalytics({
    streamId,
    enabled: isStreaming,
  });

  // Initialize streaming environment
  useEffect(() => {
    initializeStreaming();
    return () => {
      cleanup();
    };
  }, []);

  // Update analytics data
  useEffect(() => {
    if (analyticsData) {
      setStreamingStats(prev => ({
        ...prev,
        viewerCount: analyticsData.viewerCount,
        totalRevenue: analyticsData.totalSales + analyticsData.giftValue,
      }));
      onViewerCountChange?.(analyticsData.viewerCount);
    }
  }, [analyticsData, onViewerCountChange]);

  // Duration timer
  useEffect(() => {
    if (isStreaming && streamStartTime.current) {
      durationTimer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - streamStartTime.current!.getTime()) / 1000);
        setStreamingStats(prev => ({ ...prev, duration: elapsed }));
      }, 1000);

      return () => {
        if (durationTimer.current) {
          clearInterval(durationTimer.current);
        }
      };
    }
  }, [isStreaming]);

  // Initialize streaming
  const initializeStreaming = async () => {
    try {
      const environment = await getStreamingEnvironment();
      setUseMockStreaming(environment.capabilities.requiresMockFallback);

      await streamingService.initialize();

      // Set up event handlers
      streamingService.setEventHandlers({
        onJoinChannelSuccess: (channel, uid) => {
          console.log(`✅ Publisher joined channel: ${channel} with UID: ${uid}`);
          setIsStreaming(true);
          streamStartTime.current = new Date();
          setStreamingStats(prev => ({ ...prev, isLive: true }));
        },
        onUserJoined: (uid) => {
          console.log(`👤 Viewer joined: ${uid}`);
          setStreamingStats(prev => ({
            ...prev,
            viewerCount: prev.viewerCount + 1
          }));
        },
        onUserLeft: (uid) => {
          console.log(`👤 Viewer left: ${uid}`);
          setStreamingStats(prev => ({
            ...prev,
            viewerCount: Math.max(0, prev.viewerCount - 1)
          }));
        },
        onError: (error) => {
          console.error('Streaming error:', error);
          onError?.(error);
          handleStreamError(error);
        },
        onNetworkQualityChanged: (quality) => {
          setStreamingStats(prev => ({ ...prev, networkQuality: quality }));
        },
      });

    } catch (error) {
      console.error('Error initializing streaming:', error);
      onError?.('Failed to initialize streaming');
    }
  };

  // Start streaming
  const startStreaming = async () => {
    try {
      setIsPreparing(true);

      const streamConfig = {
        channelName,
        streamId,
        vendorId,
        isPublisher: true,
        videoQuality: currentQuality,
        audioEnabled: isAudioEnabled,
        videoEnabled: isVideoEnabled,
      };

      await streamingService.startPublishing(streamConfig);

      setIsPreparing(false);
    } catch (error) {
      console.error('Error starting stream:', error);
      setIsPreparing(false);
      Alert.alert('Streaming Error', 'Failed to start stream. Please try again.');
    }
  };

  // Stop streaming
  const stopStreaming = async () => {
    try {
      await streamingService.stopPublishing();

      setIsStreaming(false);
      setStreamingStats(prev => ({ ...prev, isLive: false }));
      streamStartTime.current = null;

      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }

      onStreamEnd?.();
    } catch (error) {
      console.error('Error stopping stream:', error);
      Alert.alert('Error', 'Failed to stop stream properly');
    }
  };

  // Toggle audio
  const toggleAudio = async () => {
    try {
      const newState = !isAudioEnabled;
      await streamingService.toggleAudio(newState);
      setIsAudioEnabled(newState);
    } catch (error) {
      console.error('Error toggling audio:', error);
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    try {
      const newState = !isVideoEnabled;
      await streamingService.toggleVideo(newState);
      setIsVideoEnabled(newState);
    } catch (error) {
      console.error('Error toggling video:', error);
    }
  };

  // Switch camera
  const switchCamera = async () => {
    try {
      await streamingService.switchCamera();
      setIsFrontCamera(!isFrontCamera);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  };

  // Handle stream error
  const handleStreamError = (error: string) => {
    Alert.alert(
      'Streaming Error',
      error,
      [
        { text: 'End Stream', onPress: stopStreaming },
        { text: 'Retry', onPress: startStreaming },
      ]
    );
  };

  // Auto-hide controls
  const handleScreenTouch = () => {
    setShowControls(true);

    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }

    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  };

  // Cleanup
  const cleanup = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
    }
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Render video preview/stream
  const renderVideoContent = () => {
    if (useMockStreaming) {
      const mockData = streamingService.getMockStreamData();
      if (!mockData) return null;

      return (
        <MockVideoStream
          streamData={{
            ...mockData,
            title: streamConfig?.title || mockData.title,
            isLive: isStreaming,
          }}
          isPublisher={true}
          isViewing={isStreaming}
          showControls={false}
          style={styles.videoContainer}
        />
      );
    }

    // Real Agora video view
    if (AgoraSurfaceView && isVideoEnabled) {
      return (
        <AgoraSurfaceView
          style={styles.videoContainer}
          zOrderMediaOverlay={true}
          canvas={{ uid: 0 }}
        />
      );
    }

    // Fallback when video is disabled
    return (
      <View style={styles.videoDisabledContainer}>
        <Ionicons name="videocam-off" size={64} color="#666" />
        <Text style={styles.videoDisabledText}>Video Disabled</Text>
      </View>
    );
  };

  // Render top controls
  const renderTopControls = () => (
    <View style={[styles.topControls, { paddingTop: insets.top + 10 }]}>
      <View style={styles.streamInfo}>
        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, { opacity: isStreaming ? 1 : 0.5 }]} />
          <Text style={styles.liveText}>
            {isStreaming ? 'LIVE' : isPreparing ? 'STARTING...' : 'READY'}
          </Text>
        </View>
        {isStreaming && (
          <Text style={styles.durationText}>
            {formatDuration(streamingStats.duration)}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.closeButton}
        onPress={isStreaming ? stopStreaming : onStreamEnd}
      >
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );

  // Render bottom controls
  const renderBottomControls = () => (
    <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="eye" size={16} color="white" />
          <Text style={styles.statText}>{streamingStats.viewerCount}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="cash" size={16} color="#FFD700" />
          <Text style={styles.statText}>₣{streamingStats.totalRevenue.toFixed(0)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons
            name="wifi"
            size={16}
            color={streamingStats.networkQuality > 3 ? '#34C759' : '#FF9500'}
          />
          <Text style={styles.statText}>
            {streamingStats.networkQuality > 0 ? `${streamingStats.networkQuality}/6` : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.controlButtons}>
        <TouchableOpacity
          style={[styles.controlButton, !isAudioEnabled && styles.controlButtonDisabled]}
          onPress={toggleAudio}
        >
          <Ionicons
            name={isAudioEnabled ? "mic" : "mic-off"}
            size={24}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonDisabled]}
          onPress={toggleVideo}
        >
          <Ionicons
            name={isVideoEnabled ? "videocam" : "videocam-off"}
            size={24}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={switchCamera}
          disabled={!isVideoEnabled}
        >
          <Ionicons
            name="camera-reverse"
            size={24}
            color={isVideoEnabled ? "white" : "#666"}
          />
        </TouchableOpacity>

        {!isStreaming ? (
          <TouchableOpacity
            style={styles.startButton}
            onPress={startStreaming}
            disabled={isPreparing}
          >
            <LinearGradient
              colors={['#FF4444', '#CC0000']}
              style={styles.startButtonGradient}
            >
              <Ionicons name="play" size={24} color="white" />
              <Text style={styles.startButtonText}>
                {isPreparing ? 'Starting...' : 'Go Live'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopStreaming}
          >
            <LinearGradient
              colors={['#666', '#333']}
              style={styles.stopButtonGradient}
            >
              <Ionicons name="stop" size={20} color="white" />
              <Text style={styles.stopButtonText}>End</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <TouchableOpacity
        style={styles.videoWrapper}
        activeOpacity={1}
        onPress={handleScreenTouch}
      >
        {renderVideoContent()}
      </TouchableOpacity>

      {/* Analytics Overlay */}
      {isStreaming && analyticsData && (
        <LiveStreamAnalyticsOverlay
          streamId={streamId}
          isVendor={true}
          analyticsData={analyticsData}
        />
      )}

      {/* Controls */}
      {showControls && (
        <>
          {renderTopControls()}
          {renderBottomControls()}
        </>
      )}

      {/* Environment indicator */}
      {useMockStreaming && (
        <View style={styles.mockIndicator}>
          <Text style={styles.mockIndicatorText}>📱 Demo Mode</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoWrapper: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoDisabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  videoDisabledText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },

  // Top controls
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  streamInfo: {
    alignItems: 'flex-start',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  durationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  controlButtonDisabled: {
    backgroundColor: 'rgba(255,68,68,0.3)',
  },
  startButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  stopButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  stopButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Mock indicator
  mockIndicator: {
    position: 'absolute',
    top: 100,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  mockIndicatorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default LiveStreamPublisher;