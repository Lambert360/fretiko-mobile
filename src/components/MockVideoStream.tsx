import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ImageBackground,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MockVideoStreamProps {
  streamData: {
    videoUrl: string;
    thumbnail: string;
    title: string;
    isLive: boolean;
  };
  isPublisher?: boolean;
  isViewing?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  showControls?: boolean;
  style?: any;
}

/**
 * Mock Video Stream Component
 *
 * Provides a mock video streaming experience for Expo Go that:
 * - Displays a video player with live streaming UI
 * - Simulates live streaming indicators and controls
 * - Shows publisher vs viewer interfaces appropriately
 * - Provides realistic streaming experience for development
 * - Falls back gracefully when video fails to load
 */
const MockVideoStream: React.FC<MockVideoStreamProps> = ({
  streamData,
  isPublisher = false,
  isViewing = false,
  onPlay,
  onPause,
  onStop,
  showControls = true,
  style,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<any>(null);

  // Simulate live indicator pulse animation
  useEffect(() => {
    if (streamData.isLive && isPlaying) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    }
  }, [streamData.isLive, isPlaying, pulseAnim]);

  // Handle video play
  const handlePlay = () => {
    setIsPlaying(true);
    setShowThumbnail(false);
    onPlay?.();
  };

  // Handle video pause
  const handlePause = () => {
    setIsPlaying(false);
    onPause?.();
  };

  // Handle video stop
  const handleStop = () => {
    setIsPlaying(false);
    setShowThumbnail(true);
    setCurrentTime(0);
    onStop?.();
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render live indicator
  const renderLiveIndicator = () => {
    if (!streamData.isLive) return null;

    return (
      <Animated.View
        style={[
          styles.liveIndicator,
          { transform: [{ scale: pulseAnim }] }
        ]}
      >
        <LinearGradient
          colors={['#FF4444', '#CC0000']}
          style={styles.liveIndicatorGradient}
        >
          <Text style={styles.liveIndicatorText}>LIVE</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  // Render video controls
  const renderVideoControls = () => {
    if (!showControls) return null;

    return (
      <View style={styles.controlsContainer}>
        <View style={styles.controlsTop}>
          {renderLiveIndicator()}

          {isPublisher && (
            <View style={styles.publisherControls}>
              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="camera-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="mic-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="camera-reverse-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.controlsCenter}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={isPlaying ? handlePause : handlePlay}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
              style={styles.playButtonGradient}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={40}
                color="#333"
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.controlsBottom}>
          <View style={styles.progressContainer}>
            {streamData.isLive ? (
              <View style={styles.liveProgress}>
                <View style={styles.liveProgressDot} />
                <Text style={styles.liveProgressText}>LIVE</Text>
              </View>
            ) : (
              <>
                <Text style={styles.timeText}>
                  {formatTime(currentTime)}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                      }
                    ]}
                  />
                </View>
                <Text style={styles.timeText}>
                  {formatTime(duration)}
                </Text>
              </>
            )}
          </View>

          {isPublisher && (
            <TouchableOpacity
              style={styles.stopButton}
              onPress={handleStop}
            >
              <Ionicons name="stop" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render error state
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={64} color="#666" />
      <Text style={styles.errorTitle}>Video Unavailable</Text>
      <Text style={styles.errorMessage}>
        Unable to load mock video. Check your internet connection.
      </Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => {
          setHasError(false);
          setIsLoading(true);
        }}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Render loading state
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ImageBackground
        source={{ uri: streamData.thumbnail }}
        style={styles.thumbnailBackground}
        resizeMode="cover"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingSpinner}>
            <Ionicons name="refresh" size={32} color="white" />
          </View>
          <Text style={styles.loadingText}>Loading stream...</Text>
        </View>
      </ImageBackground>
    </View>
  );

  // Render thumbnail state
  const renderThumbnail = () => (
    <ImageBackground
      source={{ uri: streamData.thumbnail }}
      style={styles.thumbnailBackground}
      resizeMode="cover"
    >
      <View style={styles.thumbnailOverlay}>
        <TouchableOpacity
          style={styles.thumbnailPlayButton}
          onPress={handlePlay}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
            style={styles.thumbnailPlayButtonGradient}
          >
            <Ionicons name="play" size={48} color="#333" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.thumbnailInfo}>
          <Text style={styles.thumbnailTitle}>{streamData.title}</Text>
          <View style={styles.thumbnailMeta}>
            {streamData.isLive ? (
              <View style={styles.thumbnailLive}>
                <View style={styles.thumbnailLiveDot} />
                <Text style={styles.thumbnailLiveText}>LIVE</Text>
              </View>
            ) : (
              <Text style={styles.thumbnailDuration}>Demo Video</Text>
            )}
          </View>
        </View>
      </View>
    </ImageBackground>
  );

  // Main render
  if (hasError) {
    return (
      <View style={[styles.container, style]}>
        {renderError()}
      </View>
    );
  }

  if (isLoading && !isPlaying) {
    return (
      <View style={[styles.container, style]}>
        {renderLoading()}
      </View>
    );
  }

  if (showThumbnail && !isPlaying) {
    return (
      <View style={[styles.container, style]}>
        {renderThumbnail()}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={{ uri: streamData.videoUrl }}
        style={styles.video}
        isLooping={streamData.isLive}
        shouldPlay={isPlaying}
        resizeMode={ResizeMode.COVER}
        onLoad={(status) => {
          setIsLoading(false);
          setDuration(status.durationMillis / 1000);
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            setCurrentTime(status.positionMillis / 1000);
          }
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />

      {renderVideoControls()}

      {/* Mock streaming overlay for publishers */}
      {isPublisher && isPlaying && (
        <View style={styles.publisherOverlay}>
          <View style={styles.publisherStatus}>
            <View style={styles.recordingIndicator} />
            <Text style={styles.publisherStatusText}>Recording</Text>
          </View>
        </View>
      )}

      {/* Expo Go watermark */}
      <View style={styles.watermark}>
        <Text style={styles.watermarkText}>📱 Expo Go Demo</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },

  // Error state styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Loading state styles
  loadingContainer: {
    flex: 1,
  },
  thumbnailBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: '100%',
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },

  // Thumbnail styles
  thumbnailOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: '100%',
    position: 'relative',
  },
  thumbnailPlayButton: {
    marginBottom: 32,
  },
  thumbnailPlayButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailInfo: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  thumbnailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  thumbnailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  thumbnailLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 6,
  },
  thumbnailLiveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  thumbnailDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },

  // Controls styles
  controlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  controlsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  controlsCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },

  // Live indicator styles
  liveIndicator: {
    alignSelf: 'flex-start',
  },
  liveIndicatorGradient: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Publisher controls styles
  publisherControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },

  // Play button styles
  playButton: {
    marginBottom: 20,
  },
  playButtonGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },

  // Progress styles
  progressContainer: {
    flex: 1,
    marginRight: 12,
  },
  liveProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveProgressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  liveProgressText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    marginHorizontal: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 1.5,
  },
  timeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },

  // Stop button styles
  stopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,68,68,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Publisher overlay styles
  publisherOverlay: {
    position: 'absolute',
    top: 60,
    right: 16,
  },
  publisherStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recordingIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4444',
    marginRight: 6,
  },
  publisherStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },

  // Watermark styles
  watermark: {
    position: 'absolute',
    bottom: 60,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  watermarkText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default MockVideoStream;