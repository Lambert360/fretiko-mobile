import { Platform } from 'react-native';

/**
 * Agora SDK Configuration
 *
 * Configuration settings for Agora Real-Time Communication SDK
 * Supports both development and production environments with
 * proper token management and security considerations.
 */

export interface AgoraConfig {
  appId: string;
  appCertificate?: string;
  tokenServerUrl?: string;
  channelProfile: number;
  clientRole: number;
  audioProfile: number;
  audioScenario: number;
  videoEncoderConfig: {
    dimensions: {
      width: number;
      height: number;
    };
    frameRate: number;
    bitrate: number;
    orientationMode: number;
    degradationPreference: number;
  };
}

// Agora SDK Constants
export const ChannelProfile = {
  LiveBroadcasting: 1,
  Communication: 0,
} as const;

export const ClientRole = {
  Broadcaster: 1,
  Audience: 2,
} as const;

export const AudioProfile = {
  Default: 0,
  SpeechStandard: 1,
  MusicStandard: 2,
  MusicStandardStereo: 3,
  MusicHighQuality: 4,
  MusicHighQualityStereo: 5,
} as const;

export const AudioScenario = {
  Default: 0,
  ChatRoom: 1,
  Education: 2,
  GameStreaming: 3,
  ShowRoom: 4,
  ChatRoomEntertainment: 5,
  Education_Interactive: 6,
  GameStreaming_Individual: 7,
  GameStreaming_Chorus: 8,
  ChatRoom_Gaming: 9,
} as const;

export const VideoEncoderConfigurationPreset = {
  Preset120x120: {
    dimensions: { width: 120, height: 120 },
    frameRate: 15,
    bitrate: 65,
  },
  Preset160x120: {
    dimensions: { width: 160, height: 120 },
    frameRate: 15,
    bitrate: 100,
  },
  Preset320x240: {
    dimensions: { width: 320, height: 240 },
    frameRate: 15,
    bitrate: 200,
  },
  Preset640x480: {
    dimensions: { width: 640, height: 480 },
    frameRate: 15,
    bitrate: 500,
  },
  Preset960x720: {
    dimensions: { width: 960, height: 720 },
    frameRate: 15,
    bitrate: 1000,
  },
  Preset1280x720: {
    dimensions: { width: 1280, height: 720 },
    frameRate: 15,
    bitrate: 1500,
  },
} as const;

/**
 * Get Agora configuration based on environment
 */
export const getAgoraConfig = (quality: 'low' | 'medium' | 'high' = 'medium'): AgoraConfig => {
  // Get app ID from environment variables
  const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID || '';
  const appCertificate = process.env.EXPO_PUBLIC_AGORA_APP_CERTIFICATE || '';
  const tokenServerUrl = process.env.EXPO_PUBLIC_AGORA_TOKEN_SERVER_URL || '';

  if (!appId) {
    console.warn('⚠️  EXPO_PUBLIC_AGORA_APP_ID not found in environment variables');
  }

  // Select video configuration based on quality
  let videoConfig;
  switch (quality) {
    case 'low':
      videoConfig = VideoEncoderConfigurationPreset.Preset320x240;
      break;
    case 'high':
      videoConfig = VideoEncoderConfigurationPreset.Preset1280x720;
      break;
    default:
      videoConfig = VideoEncoderConfigurationPreset.Preset640x480;
  }

  return {
    appId,
    appCertificate,
    tokenServerUrl,
    channelProfile: ChannelProfile.LiveBroadcasting,
    clientRole: ClientRole.Broadcaster,
    audioProfile: AudioProfile.MusicHighQuality,
    audioScenario: AudioScenario.ShowRoom,
    videoEncoderConfig: {
      ...videoConfig,
      orientationMode: 0, // Adaptive
      degradationPreference: 0, // Maintain quality
    },
  };
};

/**
 * Validate Agora configuration
 */
export const validateAgoraConfig = (config: AgoraConfig): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config.appId || config.appId.length === 0) {
    errors.push('Agora App ID is required');
  }

  if (config.appId && config.appId.length !== 32) {
    errors.push('Agora App ID should be 32 characters long');
  }

  if (!config.videoEncoderConfig.dimensions.width || !config.videoEncoderConfig.dimensions.height) {
    errors.push('Video dimensions are required');
  }

  if (config.videoEncoderConfig.frameRate < 1 || config.videoEncoderConfig.frameRate > 60) {
    errors.push('Video frame rate should be between 1 and 60 fps');
  }

  if (config.videoEncoderConfig.bitrate < 1 || config.videoEncoderConfig.bitrate > 10000) {
    errors.push('Video bitrate should be between 1 and 10000 kbps');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Generate unique channel name for live streams
 */
export const generateChannelName = (streamId: string, vendorId: string): string => {
  // Create a unique channel name that's predictable for the same stream
  // but unique across different streams
  const cleanStreamId = streamId.replace(/[^a-zA-Z0-9]/g, '');
  const cleanVendorId = vendorId.replace(/[^a-zA-Z0-9]/g, '');
  return `live_${cleanVendorId}_${cleanStreamId}`.toLowerCase();
};

/**
 * Get recommended video quality based on device and network
 */
export const getRecommendedVideoQuality = async (): Promise<'low' | 'medium' | 'high'> => {
  try {
    // This would normally check device capabilities and network conditions
    // For now, provide a sensible default based on platform
    if (Platform.OS === 'ios') {
      return 'high'; // iOS devices generally have better performance
    } else if (Platform.OS === 'android') {
      return 'medium'; // Android varies, so use medium as safe default
    } else {
      return 'low'; // Web/other platforms use low quality
    }
  } catch (error) {
    console.warn('Error determining video quality:', error);
    return 'low'; // Fallback to low quality
  }
};

/**
 * Agora SDK feature flags based on environment
 */
export const getAgoraFeatureFlags = () => {
  const isDevelopment = __DEV__;

  return {
    enableStatistics: isDevelopment, // Enable detailed statistics in development
    enableDebugLogs: isDevelopment, // Enable debug logs in development
    enableEncryption: !isDevelopment, // Enable encryption in production
    enableCloudRecording: false, // Enable cloud recording (requires separate setup)
    enableBeautyFilter: false, // Enable beauty filter (requires additional plugin)
    enableVirtualBackground: false, // Enable virtual background (requires additional plugin)
    enableNoiseReduction: true, // Enable AI noise reduction
    enableEchoCancellation: true, // Enable echo cancellation
    enableAutoGainControl: true, // Enable automatic gain control
  };
};

/**
 * Default Agora error handling configuration
 */
export const getAgoraErrorConfig = () => ({
  maxRetryAttempts: 3,
  retryDelay: 2000, // 2 seconds
  timeoutDuration: 30000, // 30 seconds
  enableErrorReporting: true,
  logErrors: __DEV__,
});

/**
 * Environment-specific Agora settings
 */
export const getEnvironmentSettings = () => {
  const isDevelopment = __DEV__;

  return {
    // Development settings
    development: {
      logLevel: 5, // Verbose logging
      enableStatistics: true,
      statisticsInterval: 1000, // 1 second
      enableDebugMode: true,
    },

    // Production settings
    production: {
      logLevel: 2, // Error and warning only
      enableStatistics: false,
      statisticsInterval: 5000, // 5 seconds
      enableDebugMode: false,
    },

    // Current settings
    current: isDevelopment ? 'development' : 'production',
  };
};

export default {
  getAgoraConfig,
  validateAgoraConfig,
  generateChannelName,
  getRecommendedVideoQuality,
  getAgoraFeatureFlags,
  getAgoraErrorConfig,
  getEnvironmentSettings,
  ChannelProfile,
  ClientRole,
  AudioProfile,
  AudioScenario,
  VideoEncoderConfigurationPreset,
};