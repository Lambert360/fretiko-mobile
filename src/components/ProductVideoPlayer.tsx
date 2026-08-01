import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, Dimensions, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { ProductVideoLoadingSkeleton } from './VideoLoadingSkeleton';
import { handleError } from '../utils/errorHandler';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

interface ProductVideoPlayerProps {
  videoUri: string;
  shouldAutoPlay: boolean;
  aspectRatio?: number; // width / height (e.g., 16/9, 9/16, 1)
  containerWidth?: number;
  maxHeight?: number;
  onLoad?: (status: any) => void;
  onPlaybackStatusUpdate?: (status: any) => void;
}

export const ProductVideoPlayer: React.FC<ProductVideoPlayerProps> = ({
  videoUri,
  shouldAutoPlay,
  aspectRatio = 9 / 16, // Default to vertical video
  containerWidth = screenWidth,
  maxHeight,
  onLoad,
  onPlaybackStatusUpdate
}) => {
  // Start with a reasonable default height, will be updated when video loads
  const [videoDimensions, setVideoDimensions] = useState({ width: containerWidth, height: containerWidth });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Resize the container to the video's natural aspect ratio
  const updateDimensions = useCallback((naturalWidth: number, naturalHeight: number, duration = 0) => {
    if (!isMountedRef.current) return;
    if (naturalWidth <= 0 || naturalHeight <= 0) return;

    const naturalAspectRatio = naturalWidth / naturalHeight;
    const displayWidth = containerWidth;
    let displayHeight = containerWidth / naturalAspectRatio;

    if (maxHeight && displayHeight > maxHeight) {
      displayHeight = maxHeight;
    }

    console.log(`📐 Video dimensions:`, {
      naturalWidth,
      naturalHeight,
      naturalAspectRatio,
      orientation: naturalAspectRatio > 1 ? 'landscape' : 'portrait'
    });

    console.log(`📐 Display dimensions:`, { displayWidth, displayHeight });

    setVideoDimensions({ width: displayWidth, height: displayHeight });

    if (onLoad) {
      onLoad({
        duration: duration || 0,
        width: naturalWidth,
        height: naturalHeight,
        aspectRatio: naturalAspectRatio
      });
    }
  }, [containerWidth, maxHeight, onLoad]);

  // Memoize video URI to prevent unnecessary re-creations
  const memoizedVideoUri = useMemo(() => videoUri, [videoUri]);
  
  // Create video player for this specific video
  const player = useVideoPlayer(memoizedVideoUri, (player) => {
    if (!isMountedRef.current) return;
    
    player.loop = false; // Don't auto-replay
    player.muted = false;
    player.timeUpdateEventInterval = 0.5; // Reduced frequency for better performance
  });

  // Control playback based on props - SAME AS SERVICE TAB
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (shouldAutoPlay) {
      console.log(`🎥 Starting product video playback for ${memoizedVideoUri}`);
      player.play();
      // Add haptic feedback for video start
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      player.pause();
    }
  }, [shouldAutoPlay, player, memoizedVideoUri]);

  // Setup status listeners with correct expo-video events
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Check if player is already loaded
    const currentStatus = player.status as any;
    if (currentStatus === 'ready') {
      console.log(`🎥 Product video already loaded: ${memoizedVideoUri}`);
      setIsLoading(false);
      setHasError(false);
      setErrorMessage(null);

      const videoSize = player.videoTrack?.size;
      if (videoSize?.width && videoSize?.height) {
        updateDimensions(videoSize.width, videoSize.height, player.duration || 0);
      } else {
        updateDimensions(containerWidth, containerWidth / aspectRatio, player.duration || 0);
      }
    }
    
    const statusSubscription = player.addListener('statusChange', (status: any) => {
      if (!isMountedRef.current) return;
      
      if (status === 'ready') {
        console.log(`🎥 Product video loaded: ${memoizedVideoUri}`);
        setIsLoading(false);
        setHasError(false);
        setErrorMessage(null);

        const videoSize = player.videoTrack?.size;
        if (videoSize?.width && videoSize?.height) {
          updateDimensions(videoSize.width, videoSize.height, player.duration || 0);
        } else {
          updateDimensions(containerWidth, containerWidth / aspectRatio, player.duration || 0);
        }
      } else if (status === 'error') {
        if (!isMountedRef.current) return;
        console.error(`❌ Product video error: ${memoizedVideoUri}`, status);
        setIsLoading(false);
        setHasError(true);
        const errorInfo = handleError(status || new Error('Failed to load video'));
        setErrorMessage(errorInfo.userMessage);
      } else if (status === 'loading') {
        if (!isMountedRef.current) return;
        setIsLoading(true);
        setHasError(false);
      }
    });

    const videoTrackChangeSubscription = player.addListener('videoTrackChange', (event: any) => {
      if (!isMountedRef.current) return;
      const size = event?.videoTrack?.size;
      if (size?.width && size?.height) {
        updateDimensions(size.width, size.height);
      }
    });

    const timeUpdateSubscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (!isMountedRef.current) return;
      
      if (onPlaybackStatusUpdate) {
        onPlaybackStatusUpdate({
          currentTime: currentTime || 0,
          duration: player.duration || 0,
          isLoaded: true
        });
      }
    });

    return () => {
      statusSubscription?.remove();
      videoTrackChangeSubscription?.remove();
      timeUpdateSubscription?.remove();
    };
  }, [player, onLoad, onPlaybackStatusUpdate, memoizedVideoUri, containerWidth, aspectRatio, maxHeight, updateDimensions]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <View style={{
      width: videoDimensions.width,
      height: videoDimensions.height,
      alignSelf: 'center',
      backgroundColor: '#000'
    }}>
      <VideoView
        player={player}
        style={{
          width: '100%',
          height: '100%'
        }}
        contentFit="contain"
        fullscreenOptions={{
          enable: false,
        }}
        allowsPictureInPicture={false}
      />
    </View>
  );
};

export default ProductVideoPlayer;
