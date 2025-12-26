import React, { useEffect, useState } from 'react';
import { View, Dimensions, TouchableOpacity, Text, StyleSheet } from 'react-native';
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

export const ServiceVideoPlayer: React.FC<ServiceVideoPlayerProps> = ({
  videoUri,
  isCurrentVideo,
  shouldAutoPlay,
  onLoad,
  onPlaybackStatusUpdate
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create video player for this specific video
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = true;
    player.muted = false;
    // Set time update interval for progress tracking
    player.timeUpdateEventInterval = 0.1; // Update every 100ms for smooth progress
  });

  // Control playback based on props
  useEffect(() => {
    if (isCurrentVideo && shouldAutoPlay) {
      console.log(`🎥 Starting video playback for ${videoUri}`);
      player.play();
    } else {
      console.log(`🎥 Pausing video for ${videoUri}`);
      player.pause();
    }
  }, [isCurrentVideo, shouldAutoPlay, player]);

  // Setup status listeners with correct expo-video events
  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', (status) => {
      if (status.status === 'loaded') {
        console.log(`🎥 Video loaded: ${videoUri}`, status);
        setIsLoading(false);
        setHasError(false);
        setErrorMessage(null);
        if (onLoad) {
          onLoad({
            duration: status.duration || 0
          });
        }
      } else if (status.status === 'error') {
        console.error(`❌ Service video error: ${videoUri}`, status);
        setIsLoading(false);
        setHasError(true);
        const errorInfo = handleError(status.error || new Error('Failed to load video'));
        setErrorMessage(errorInfo.userMessage);
      } else if (status.status === 'loading') {
        setIsLoading(true);
        setHasError(false);
      }
    });

    const timeUpdateSubscription = player.addListener('timeUpdate', ({ currentTime, duration }) => {
      if (onPlaybackStatusUpdate && duration) {
        // Temporarily log to verify updates are being sent
        // console.log(`📊 Progress: ${currentTime?.toFixed(1)}s / ${duration?.toFixed(1)}s`);
        onPlaybackStatusUpdate({
          currentTime: currentTime || 0,
          duration: duration || 0,
          isLoaded: true
        });
      }
    });

    return () => {
      // Cleanup listeners
      statusSubscription?.remove();
      timeUpdateSubscription?.remove();
    };
  }, [player, onLoad, onPlaybackStatusUpdate, videoUri]);

  // Show loading skeleton
  if (isLoading && !hasError) {
    return (
      <VideoLoadingSkeleton
        width={screenWidth}
        height={screenHeight}
        variant="service"
      />
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
};

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
});

export default ServiceVideoPlayer;