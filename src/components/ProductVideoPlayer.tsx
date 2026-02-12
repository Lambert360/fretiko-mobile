import React, { useEffect, useState, useRef, useMemo } from 'react';
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
      console.log(`🎥 Pausing product video for ${memoizedVideoUri}`);
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
      
      const naturalWidth = containerWidth;
      const naturalHeight = containerWidth * aspectRatio;
      const naturalAspectRatio = naturalWidth / naturalHeight;
      
      const displayWidth = containerWidth;
      let displayHeight = containerWidth / naturalAspectRatio;
      if (maxHeight && displayHeight > maxHeight) {
        displayHeight = maxHeight;
      }
      
      setVideoDimensions({ width: displayWidth, height: displayHeight });
      
      if (onLoad && isMountedRef.current) {
        onLoad({
          duration: player.duration || 0,
          width: naturalWidth,
          height: naturalHeight,
          aspectRatio: naturalAspectRatio
        });
      }
    }
    
    const statusSubscription = player.addListener('statusChange', (status: any) => {
      if (!isMountedRef.current) return;
      
      if (status === 'ready') {
        console.log(`🎥 Product video loaded: ${memoizedVideoUri}`);
        setIsLoading(false);
        setHasError(false);
        setErrorMessage(null);

        // Get natural video dimensions - use defaults for now since expo-video doesn't expose dimensions easily
        const naturalWidth = containerWidth;
        const naturalHeight = containerWidth * aspectRatio;
        const naturalAspectRatio = naturalWidth / naturalHeight;

        console.log(`📐 Video dimensions:`, {
          naturalWidth,
          naturalHeight,
          naturalAspectRatio,
          orientation: naturalAspectRatio > 1 ? 'landscape' : 'portrait'
        });

        // Always fit screen width, calculate height based on aspect ratio
        const displayWidth = containerWidth;
        let displayHeight = containerWidth / naturalAspectRatio;

        // Apply max height if specified
        if (maxHeight && displayHeight > maxHeight) {
          displayHeight = maxHeight;
        }

        console.log(`📐 Display dimensions:`, { displayWidth, displayHeight });

        setVideoDimensions({ width: displayWidth, height: displayHeight });

        if (onLoad && isMountedRef.current) {
          onLoad({
            duration: player.duration || 0,
            width: naturalWidth,
            height: naturalHeight,
            aspectRatio: naturalAspectRatio
          });
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
      timeUpdateSubscription?.remove();
    };
  }, [player, onLoad, onPlaybackStatusUpdate, memoizedVideoUri, containerWidth, aspectRatio, maxHeight]);
  
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
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
};

export default ProductVideoPlayer;
