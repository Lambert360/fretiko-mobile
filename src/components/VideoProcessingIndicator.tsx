import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { backgroundVideoService, VideoProcessingJob } from '../services/backgroundVideoService';

interface VideoProcessingIndicatorProps {
  videoUrl: string;
  serviceId?: string;
  onProcessingComplete?: (processedVideoUrl: string) => void;
}

export const VideoProcessingIndicator: React.FC<VideoProcessingIndicatorProps> = ({
  videoUrl,
  serviceId,
  onProcessingComplete
}) => {
  const [jobStatus, setJobStatus] = useState<VideoProcessingJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fadeOut] = useState(new Animated.Value(1));

  useEffect(() => {
    startVideoProcessing();
  }, [videoUrl]);

  const startVideoProcessing = async () => {
    try {
      setIsProcessing(true);
      
      // Add video to processing queue
      const result = await backgroundVideoService.addVideoToQueue(videoUrl, {
        platform: 'android',
        priority: 'medium'
      });

      if (result.success && result.jobId) {
        // Monitor processing progress
        monitorProgress(result.jobId);
      } else {
        console.log('Video processing not available, using original');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Failed to start video processing:', error);
      setIsProcessing(false);
    }
  };

  const monitorProgress = async (jobId: string) => {
    const result = await backgroundVideoService.waitForJobCompletion(jobId, {
      maxWaitTime: 300000, // 5 minutes
      pollInterval: 3000, // 3 seconds
      onProgress: (status) => {
        setJobStatus(status);
      }
    });

    if (result.success && result.job?.result?.processedVideoUrl) {
      // Processing completed successfully
      setJobStatus(result.job);
      
      // Notify parent component
      if (onProcessingComplete) {
        onProcessingComplete(result.job.result.processedVideoUrl);
      }
      
      // Fade out indicator after 2 seconds
      setTimeout(() => {
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        }).start(() => {
          setIsProcessing(false);
        });
      }, 2000);
      
    } else {
      // Processing failed or timed out
      setJobStatus(result.job || null);
      setIsProcessing(false);
    }
  };

  if (!isProcessing || !jobStatus) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <View style={styles.indicator}>
        <Ionicons 
          name={getStatusIcon(jobStatus.status)} 
          size={16} 
          color={getStatusColor(jobStatus.status)} 
        />
        <Text style={[styles.text, { color: getStatusColor(jobStatus.status) }]}>
          {getStatusText(jobStatus.status)}
        </Text>
      </View>
    </Animated.View>
  );
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'time-outline';
    case 'processing':
      return 'sync-outline';
    case 'completed':
      return 'checkmark-circle';
    case 'failed':
      return 'alert-circle';
    default:
      return 'help-circle';
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':
      return '#FFA500';
    case 'processing':
      return '#3498DB';
    case 'completed':
      return '#27AE60';
    case 'failed':
      return '#E74C3C';
    default:
      return '#95A5A6';
  }
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'Video queued for optimization...';
    case 'processing':
      return 'Optimizing video for all devices...';
    case 'completed':
      return 'Video optimized successfully!';
    case 'failed':
      return 'Video optimization failed';
    default:
      return 'Processing video...';
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
});

export default VideoProcessingIndicator;
