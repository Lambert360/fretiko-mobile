import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  console.log('Agora components not available, using fallback video');
}

interface LiveStreamViewerProps {
  streamId: string;
  channelName: string;
  vendorId: string;
  streamUrl?: string; // Fallback stream URL
  thumbnailUrl?: string;
  onError?: (error: string) => void;
  onViewerJoin?: () => void;
  onViewerLeave?: () => void;
  showAnalytics?: boolean;
  style?: any;
}

interface ViewerStats {
  isConnected: boolean;
  networkQuality: number;
  viewerCount: number;
  streamDuration: number;
}

/**
 * Live Stream Viewer Component
 *
 * Comprehensive live streaming viewer that:
 * - Handles both real Agora SDK and mock/fallback video
 * - Integrates with live sales analytics
 * - Provides seamless viewing experience
 * - Falls back gracefully to traditional video streaming
 * - Manages connection states and error handling
 */
const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({
  streamId,
  channelName,
  vendorId,
  streamUrl,
  thumbnailUrl,
  onError,
  onViewerJoin,
  onViewerLeave,
  showAnalytics = true,
  style,
}) => {
  const insets = useSafeAreaInsets();

  // State management
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [useMockStreaming, setUseMockStreaming] = useState(false);
  const [useVideoFallback, setUseVideoFallback] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [viewerStats, setViewerStats] = useState<ViewerStats>({
    isConnected: false,
    networkQuality: 0,
    viewerCount: 0,
    streamDuration: 0,
  });
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]);

  // Refs
  const streamStartTime = useRef<Date | null>(null);
  const durationTimer = useRef<NodeJS.Timeout | null>(null);

  // Real-time analytics
  const { analyticsData, isConnected: analyticsConnected } = useRealtimeAnalytics({
    streamId,
    enabled: true,
  });

  // Initialize streaming environment
  useEffect(() => {
    initializeViewer();
    return () => {
      cleanup();
    };
  }, []);

  // Update analytics data
  useEffect(() => {
    if (analyticsData) {
      setViewerStats(prev => ({
        ...prev,
        viewerCount: analyticsData.viewerCount,
        streamDuration: analyticsData.streamDuration,
      }));
    }
  }, [analyticsData]);

  // Duration timer for fallback video
  useEffect(() => {
    if (isConnected && !useMockStreaming && streamStartTime.current) {
      durationTimer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - streamStartTime.current!.getTime()) / 1000);
        setViewerStats(prev => ({ ...prev, streamDuration: elapsed }));
      }, 1000);

      return () => {
        if (durationTimer.current) {
          clearInterval(durationTimer.current);
        }
      };
    }
  }, [isConnected, useMockStreaming]);

  // Initialize viewer
  const initializeViewer = async () => {
    try {
      const environment = await getStreamingEnvironment();
      setUseMockStreaming(environment.capabilities.requiresMockFallback);

      // If we don't have mock streaming and no Agora, fall back to traditional video
      if (!environment.capabilities.requiresMockFallback && !AgoraRtcEngine && streamUrl) {
        setUseVideoFallback(true);
        return;
      }

      await streamingService.initialize();

      // Set up event handlers
      streamingService.setEventHandlers({
        onJoinChannelSuccess: (channel, uid) => {
          console.log(`✅ Viewer joined channel: ${channel} with UID: ${uid}`);
          setIsConnected(true);
          setIsConnecting(false);
          streamStartTime.current = new Date();
          setViewerStats(prev => ({ ...prev, isConnected: true }));
          onViewerJoin?.();
        },
        onUserJoined: (uid) => {
          console.log(`👤 Publisher joined: ${uid}`);
          setRemoteUsers(prev => [...prev, uid]);
        },
        onUserLeft: (uid) => {
          console.log(`👤 Publisher left: ${uid}`);
          setRemoteUsers(prev => prev.filter(id => id !== uid));
        },
        onError: (error) => {
          console.error('Viewer error:', error);
          setIsConnecting(false);
          onError?.(error);

          // Fall back to video if available
          if (streamUrl) {
            setUseVideoFallback(true);
          }
        },
        onNetworkQualityChanged: (quality) => {
          setViewerStats(prev => ({ ...prev, networkQuality: quality }));
        },
      });

    } catch (error) {
      console.error('Error initializing viewer:', error);
      setIsConnecting(false);

      // Fall back to video if available
      if (streamUrl) {
        setUseVideoFallback(true);
      } else {
        onError?.('Failed to initialize video viewer');
      }
    }
  };

  // Join stream
  const joinStream = async () => {
    if (useVideoFallback) {
      // For fallback video, just set connected state
      setIsConnected(true);
      streamStartTime.current = new Date();
      onViewerJoin?.();
      return;
    }

    try {
      setIsConnecting(true);

      const streamConfig = {
        channelName,
        streamId,
        vendorId,
        isPublisher: false,
        videoQuality: 'medium' as const,
        audioEnabled: !isMuted,
        videoEnabled: true,
      };

      await streamingService.startViewing(streamConfig);

    } catch (error) {
      console.error('Error joining stream:', error);
      setIsConnecting(false);

      // Fall back to video if available
      if (streamUrl) {
        setUseVideoFallback(true);
        setIsConnected(true);
        onViewerJoin?.();
      } else {
        onError?.('Failed to join stream');
      }
    }
  };

  // Leave stream
  const leaveStream = async () => {
    try {
      if (!useVideoFallback) {
        await streamingService.stopViewing();
      }

      setIsConnected(false);
      setIsConnecting(false);
      setRemoteUsers([]);
      setViewerStats(prev => ({ ...prev, isConnected: false }));
      streamStartTime.current = null;

      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }

      onViewerLeave?.();
    } catch (error) {
      console.error('Error leaving stream:', error);
    }
  };

  // Toggle mute
  const toggleMute = async () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (!useVideoFallback && !useMockStreaming) {
      try {
        await streamingService.toggleAudio(!newMutedState);
      } catch (error) {
        console.error('Error toggling audio:', error);
      }
    }
  };

  // Cleanup
  const cleanup = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
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

  // Render video content
  const renderVideoContent = () => {
    // Mock streaming mode
    if (useMockStreaming) {
      const mockData = streamingService.getMockStreamData();
      if (!mockData) return renderPlaceholder();

      return (
        <MockVideoStream
          streamData={{
            ...mockData,
            title: 'Live Stream',
            isLive: true,
          }}
          isPublisher={false}
          isViewing={isConnected}
          showControls={false}
          style={styles.videoContainer}
        />
      );
    }

    // Video fallback mode
    if (useVideoFallback && streamUrl) {
      return renderVideoFallback();
    }

    // Real Agora streaming mode
    if (AgoraSurfaceView && isConnected && remoteUsers.length > 0) {
      return (
        <AgoraSurfaceView
          style={styles.videoContainer}
          canvas={{ uid: remoteUsers[0] }}
          zOrderMediaOverlay={false}
        />
      );
    }

    // Default placeholder
    return renderPlaceholder();
  };

  // Render video fallback (traditional streaming)
  const renderVideoFallback = () => {
    const { VideoView, ResizeMode } = require('expo-video');

    return (
      <VideoView
        source={{ uri: streamUrl! }}
        style={styles.videoContainer}
        shouldPlay={isConnected}
        isLooping={true}
        isMuted={isMuted}
        resizeMode={ResizeMode.COVER}
        onPlaybackStatusUpdate={(status: any) => {
          if (status.isLoaded && !streamStartTime.current) {
            streamStartTime.current = new Date();
          }
        }}
        onError={(error: any) => {
          console.error('Video playback error:', error);
          onError?.('Video playback failed');
        }}
      />
    );
  };

  // Render placeholder
  const renderPlaceholder = () => (
    <View style={styles.placeholderContainer}>
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.videoContainer}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderContent}>
          <Ionicons name="videocam-off" size={64} color="#666" />
          <Text style={styles.placeholderText}>
            {isConnecting ? 'Connecting...' : 'Stream Unavailable'}
          </Text>
        </View>
      )}
    </View>
  );

  // Render connection overlay
  const renderConnectionOverlay = () => {
    if (!isConnecting && isConnected) return null;

    return (
      <View style={styles.connectionOverlay}>
        {isConnecting && (
          <View style={styles.connectingContainer}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.connectingText}>Connecting to stream...</Text>
          </View>
        )}

        {!isConnected && !isConnecting && (
          <TouchableOpacity style={styles.joinButton} onPress={joinStream}>
            <Ionicons name="play-circle" size={64} color="white" />
            <Text style={styles.joinButtonText}>Join Stream</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render viewer controls
  const renderViewerControls = () => {
    if (!isConnected) return null;

    return (
      <View style={styles.viewerControls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={20}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={leaveStream}
        >
          <Ionicons name="exit" size={20} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render stream info
  const renderStreamInfo = () => {
    if (!isConnected) return null;

    return (
      <View style={styles.streamInfo}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        <Text style={styles.durationText}>
          {formatDuration(viewerStats.streamDuration)}
        </Text>

        {viewerStats.networkQuality > 0 && (
          <View style={styles.networkIndicator}>
            <Ionicons
              name="wifi"
              size={14}
              color={viewerStats.networkQuality > 3 ? '#34C759' : '#FF9500'}
            />
            <Text style={styles.networkText}>
              {viewerStats.networkQuality}/6
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {renderVideoContent()}
      {renderConnectionOverlay()}

      {/* Analytics Overlay */}
      {showAnalytics && isConnected && analyticsData && (
        <LiveStreamAnalyticsOverlay
          streamId={streamId}
          isVendor={false}
          analyticsData={analyticsData}
        />
      )}

      {/* Stream Info */}
      {renderStreamInfo()}

      {/* Viewer Controls */}
      {renderViewerControls()}

      {/* Environment indicator */}
      {(useMockStreaming || useVideoFallback) && (
        <View style={styles.modeIndicator}>
          <Text style={styles.modeIndicatorText}>
            {useMockStreaming ? '📱 Demo Mode' : '📹 Video Mode'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Placeholder styles
  placeholderContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },

  // Connection overlay styles
  connectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  connectingContainer: {
    alignItems: 'center',
  },
  connectingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  joinButton: {
    alignItems: 'center',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },

  // Stream info styles
  streamInfo: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  networkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  networkText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },

  // Controls styles
  viewerControls: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,68,68,0.8)',
  },

  // Mode indicator styles
  modeIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modeIndicatorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default LiveStreamViewer;