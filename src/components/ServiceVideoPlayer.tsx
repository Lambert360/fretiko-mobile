import React, { useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

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
      if (onLoad && status.status === 'loaded') {
        console.log(`🎥 Video loaded: ${videoUri}`, status);
        onLoad({
          duration: status.duration || 0
        });
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
      // Cleanup listeners
      statusSubscription?.remove();
      timeUpdateSubscription?.remove();
    };
  }, [player, onLoad, onPlaybackStatusUpdate, videoUri]);

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
      showsControls={false}
    />
  );
};

export default ServiceVideoPlayer;