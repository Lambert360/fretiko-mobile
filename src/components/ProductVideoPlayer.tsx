import React, { useEffect, useState } from 'react';
import { View, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

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

  // Create video player
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false; // Don't auto-replay
    player.muted = false;
    player.timeUpdateEventInterval = 0.1;
  });

  // Control playback
  useEffect(() => {
    if (shouldAutoPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldAutoPlay, player]);

  // Setup status listeners
  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', (status) => {
      if (status.status === 'loaded') {
        console.log(`🎥 Product video loaded: ${videoUri}`);

        // Get natural video dimensions if available
        const naturalWidth = status.width || containerWidth;
        const naturalHeight = status.height || (containerWidth * aspectRatio);
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

        if (onLoad) {
          onLoad({
            duration: status.duration || 0,
            width: naturalWidth,
            height: naturalHeight,
            aspectRatio: naturalAspectRatio
          });
        }
      }
    });

    const timeUpdateSubscription = player.addListener('timeUpdate', ({ currentTime, duration }) => {
      if (onPlaybackStatusUpdate && duration) {
        onPlaybackStatusUpdate({
          currentTime: currentTime || 0,
          duration: duration || 0,
          isLoaded: true
        });
      }
    });

    return () => {
      statusSubscription?.remove();
      timeUpdateSubscription?.remove();
    };
  }, [player, onLoad, onPlaybackStatusUpdate, videoUri, containerWidth, aspectRatio, maxHeight]);

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
        showsControls={false}
      />
    </View>
  );
};

export default ProductVideoPlayer;
