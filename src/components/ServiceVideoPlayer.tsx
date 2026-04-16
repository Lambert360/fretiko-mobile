import React, { useEffect, useState } from 'react';
import { View, Dimensions, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { VideoLoadingSkeleton } from './VideoLoadingSkeleton';
import { handleError } from '../utils/errorHandler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ServiceVideoPlayerProps {
  videoUri: string;
  isCurrentVideo: boolean;
  shouldAutoPlay: boolean;
  onLoad?: (status: any) => void;
  onPlaybackStatusUpdate?: (status: any) => void;
}

const ServiceVideoPlayer: React.FC<ServiceVideoPlayerProps> = React.memo(({
  videoUri,
  isCurrentVideo,
  shouldAutoPlay,
  onLoad,
  onPlaybackStatusUpdate
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rotation animation for buffering indicator - only run when needed
  const rotationAnim = React.useRef(new Animated.Value(0)).current;
  const [isBuffering, setIsBuffering] = useState(false);

  React.useEffect(() => {
    if (isBuffering) {
      const rotation = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 360,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      rotation.start();
      return () => rotation.stop();
    }
  }, [rotationAnim, isBuffering]);

  // Create video player for this specific video
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = true;
    player.muted = false;
    // Reduce time update interval for better performance
    player.timeUpdateEventInterval = 0.25; // Update every 250ms (was 100ms)
  });

  // Control playback based on props
  useEffect(() => {
    if (isCurrentVideo && shouldAutoPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [isCurrentVideo, shouldAutoPlay, player]);

  // Setup status listeners with correct expo-video events
  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', (status) => {
      // Use type assertion to access status properties
      const statusAny = status as any;
      
      if (statusAny.status === 'loaded' || statusAny.isLoaded) {
        setIsLoading(false);
        setHasError(false);
        setErrorMessage(null);
        if (onLoad) {
          onLoad({
            duration: statusAny.duration || statusAny.durationMillis || 0
          });
        }
      } else if (statusAny.error) {
        setIsLoading(false);
        setHasError(true);
        const errorInfo = handleError(statusAny.error || new Error('Failed to load video'));
        setErrorMessage(errorInfo.userMessage);
      } else if (statusAny.status === 'loading' || statusAny.isLoading) {
        setIsLoading(true);
        setIsBuffering(true);
        setHasError(false);
      } else if (statusAny.status === 'playing' || statusAny.isPlaying || statusAny.status === 'readyToPlay' || statusAny.isReadyToPlay) {
        // Video is playing, ensure loading state is cleared
        setIsLoading(false);
        setIsBuffering(false);
        setHasError(false);
      }
    });

    const timeUpdateSubscription = player.addListener('timeUpdate', (timeUpdate) => {
      const timeUpdateAny = timeUpdate as any;
      if (onPlaybackStatusUpdate && (timeUpdateAny.duration || timeUpdateAny.durationMillis)) {
        // If we're getting time updates, video is definitely playing
        if (isLoading) {
          setIsLoading(false);
          setIsBuffering(false);
        }
        onPlaybackStatusUpdate({
          currentTime: timeUpdateAny.currentTime || timeUpdateAny.currentTimeMillis || 0,
          duration: timeUpdateAny.duration || timeUpdateAny.durationMillis || 0,
          isLoaded: true
        });
      }
    });

    return () => {
      // Cleanup listeners
      statusSubscription?.remove();
      timeUpdateSubscription?.remove();
    };
  }, [player, onLoad, onPlaybackStatusUpdate, videoUri, isLoading]);

  // Show buffering overlay (not full screen loading)
  if (isLoading && !hasError) {
    return (
      <>
        <VideoView
          player={player}
          style={{
            width: screenWidth,
            height: screenHeight,
            position: 'absolute',
            top: 0,
            left: 0
          }}
          contentFit="contain"
        />
        {/* Subtle buffering indicator overlay */}
        <View style={styles.bufferingOverlay}>
          <View style={styles.bufferingIndicator}>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: rotationAnim.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    })
                  }
                ]
              }}
            >
              <Ionicons name="refresh" size={24} color="#FFF" />
            </Animated.View>
          </View>
        </View>
      </>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF4757" />
        <Text style={styles.errorText}>{errorMessage || 'Failed to load video'}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setHasError(false);
            setIsLoading(true);
            player.replace(videoUri);
          }}
        >
          <Ionicons name="refresh" size={20} color="#FFF" style={styles.retryIcon} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={{
        width: screenWidth,
        height: screenHeight,
        position: 'absolute',
        top: 0,
        left: 0
      }}
      contentFit="contain"
    />
  );
});

const styles = StyleSheet.create({
  errorContainer: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  errorText: {
    color: '#888',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bufferingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  bufferingIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ServiceVideoPlayer;