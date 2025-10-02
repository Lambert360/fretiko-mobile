import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Streaming Environment Detection Utility
 *
 * Detects the current environment and capabilities for video streaming:
 * - Development Build: Full Agora SDK support with real video streaming
 * - Expo Go: Mock video streaming with static content
 * - Production: Full Agora SDK support with optimized performance
 *
 * This utility helps the app provide appropriate streaming experiences
 * based on the runtime environment and device capabilities.
 */

export interface StreamingCapabilities {
  hasVideoStreaming: boolean;
  hasAudioStreaming: boolean;
  supportsRealTimeVideo: boolean;
  supportsMockVideo: boolean;
  canPublishStream: boolean;
  canViewStream: boolean;
  requiresMockFallback: boolean;
  streamingMode: 'production' | 'development' | 'mock';
  sdkVersion: string;
  platformCapabilities: {
    hasCamera: boolean;
    hasMicrophone: boolean;
    supportsWebRTC: boolean;
    networkOptimized: boolean;
  };
}

export interface StreamingEnvironment {
  isExpoGo: boolean;
  isDevelopmentBuild: boolean;
  isProductionBuild: boolean;
  isSimulator: boolean;
  isPhysicalDevice: boolean;
  platform: 'ios' | 'android' | 'web';
  capabilities: StreamingCapabilities;
}

/**
 * Detect if the app is running in Expo Go
 */
export const isRunningInExpoGo = (): boolean => {
  return Constants.executionEnvironment === 'expo';
};

/**
 * Detect if the app is running in a development build
 */
export const isRunningInDevelopmentBuild = (): boolean => {
  return Constants.executionEnvironment === 'development' && !isRunningInExpoGo();
};

/**
 * Detect if the app is running in production
 */
export const isRunningInProduction = (): boolean => {
  return Constants.executionEnvironment === 'production';
};

/**
 * Check if device has camera access
 */
export const hasCamera = async (): Promise<boolean> => {
  try {
    // This would be implemented with actual camera permission checks
    // For now, assume physical devices have cameras
    return Device.isDevice === true;
  } catch (error) {
    console.warn('Error checking camera availability:', error);
    return false;
  }
};

/**
 * Check if device has microphone access
 */
export const hasMicrophone = async (): Promise<boolean> => {
  try {
    // This would be implemented with actual microphone permission checks
    // For now, assume physical devices have microphones
    return Device.isDevice === true;
  } catch (error) {
    console.warn('Error checking microphone availability:', error);
    return false;
  }
};

/**
 * Check if device supports WebRTC
 */
export const supportsWebRTC = (): boolean => {
  // WebRTC support varies by platform and environment
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && 'RTCPeerConnection' in window;
  }

  // Native platforms generally support WebRTC through native modules
  return !isRunningInExpoGo();
};

/**
 * Get streaming capabilities based on environment
 */
export const getStreamingCapabilities = async (): Promise<StreamingCapabilities> => {
  const isExpoGo = isRunningInExpoGo();
  const isDev = isRunningInDevelopmentBuild();
  const isProd = isRunningInProduction();
  const isSimulator = !Device.isDevice;

  const hasCameraAccess = await hasCamera();
  const hasMicrophoneAccess = await hasMicrophone();
  const hasWebRTCSupport = supportsWebRTC();

  // Determine streaming mode
  let streamingMode: 'production' | 'development' | 'mock' = 'mock';
  if (isProd) {
    streamingMode = 'production';
  } else if (isDev && !isExpoGo) {
    streamingMode = 'development';
  }

  // Real video streaming is available in dev builds and production
  const supportsRealTimeVideo = (isDev || isProd) && !isExpoGo && hasWebRTCSupport;

  // Mock video is always available as fallback
  const supportsMockVideo = true;

  // Publishing requires real streaming capabilities
  const canPublishStream = supportsRealTimeVideo && hasCameraAccess && hasMicrophoneAccess;

  // Viewing can work with both real and mock video
  const canViewStream = supportsRealTimeVideo || supportsMockVideo;

  // Mock fallback is required in Expo Go or when real streaming isn't available
  const requiresMockFallback = isExpoGo || !supportsRealTimeVideo;

  return {
    hasVideoStreaming: supportsRealTimeVideo || supportsMockVideo,
    hasAudioStreaming: supportsRealTimeVideo && hasMicrophoneAccess,
    supportsRealTimeVideo,
    supportsMockVideo,
    canPublishStream,
    canViewStream,
    requiresMockFallback,
    streamingMode,
    sdkVersion: supportsRealTimeVideo ? 'agora-4.x' : 'mock-1.0',
    platformCapabilities: {
      hasCamera: hasCameraAccess,
      hasMicrophone: hasMicrophoneAccess,
      supportsWebRTC: hasWebRTCSupport,
      networkOptimized: !isSimulator && Device.isDevice === true,
    },
  };
};

/**
 * Get complete streaming environment information
 */
export const getStreamingEnvironment = async (): Promise<StreamingEnvironment> => {
  const isExpoGo = isRunningInExpoGo();
  const isDevelopmentBuild = isRunningInDevelopmentBuild();
  const isProductionBuild = isRunningInProduction();
  const isSimulator = !Device.isDevice;
  const isPhysicalDevice = Device.isDevice === true;

  let platform: 'ios' | 'android' | 'web' = 'android';
  if (Platform.OS === 'ios') platform = 'ios';
  else if (Platform.OS === 'web') platform = 'web';

  const capabilities = await getStreamingCapabilities();

  return {
    isExpoGo,
    isDevelopmentBuild,
    isProductionBuild,
    isSimulator,
    isPhysicalDevice,
    platform,
    capabilities,
  };
};

/**
 * Log streaming environment for debugging
 */
export const logStreamingEnvironment = async (): Promise<void> => {
  const environment = await getStreamingEnvironment();

  console.log('🎥 Streaming Environment Detection:');
  console.log('================================');
  console.log('Environment:', {
    isExpoGo: environment.isExpoGo,
    isDevelopmentBuild: environment.isDevelopmentBuild,
    isProductionBuild: environment.isProductionBuild,
    isSimulator: environment.isSimulator,
    platform: environment.platform,
  });
  console.log('Capabilities:', environment.capabilities);
  console.log('Recommended Mode:', environment.capabilities.streamingMode);

  if (environment.capabilities.requiresMockFallback) {
    console.log('⚠️  Mock video streaming will be used');
    console.log('📱 For real video streaming, use a development build or production build');
  } else {
    console.log('✅ Real video streaming is available');
  }
};

/**
 * Get streaming configuration based on environment
 */
export const getStreamingConfig = async () => {
  const environment = await getStreamingEnvironment();

  const baseConfig = {
    // Mock video URLs for fallback
    mockVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    mockThumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',

    // Streaming quality settings
    videoResolution: environment.capabilities.streamingMode === 'production' ?
      { width: 1280, height: 720 } : { width: 640, height: 480 },
    videoFrameRate: environment.capabilities.streamingMode === 'production' ? 30 : 15,
    videoBitrate: environment.capabilities.streamingMode === 'production' ? 1000 : 500,

    // Audio settings
    audioSampleRate: 44100,
    audioBitrate: 64,
    audioChannels: 1,

    // Network settings
    enableAdaptiveBitrate: environment.capabilities.platformCapabilities.networkOptimized,
    enableNetworkQualityReports: environment.capabilities.streamingMode !== 'mock',
  };

  if (environment.capabilities.requiresMockFallback) {
    return {
      ...baseConfig,
      streamingMode: 'mock',
      agoraAppId: null,
      useAgoraSDK: false,
      useMockVideo: true,
    };
  }

  return {
    ...baseConfig,
    streamingMode: environment.capabilities.streamingMode,
    agoraAppId: process.env.EXPO_PUBLIC_AGORA_APP_ID || 'your-agora-app-id',
    useAgoraSDK: true,
    useMockVideo: false,
  };
};

/**
 * Validate streaming permissions
 */
export const validateStreamingPermissions = async (): Promise<{
  camera: boolean;
  microphone: boolean;
  canStream: boolean;
  missingPermissions: string[];
}> => {
  const hasCameraPermission = await hasCamera();
  const hasMicrophonePermission = await hasMicrophone();

  const missingPermissions: string[] = [];
  if (!hasCameraPermission) missingPermissions.push('camera');
  if (!hasMicrophonePermission) missingPermissions.push('microphone');

  const canStream = hasCameraPermission && hasMicrophonePermission;

  return {
    camera: hasCameraPermission,
    microphone: hasMicrophonePermission,
    canStream,
    missingPermissions,
  };
};

/**
 * Display environment-appropriate streaming setup message
 */
export const getStreamingSetupMessage = async (): Promise<string> => {
  const environment = await getStreamingEnvironment();

  if (environment.isExpoGo) {
    return 'You are using Expo Go. Video streaming will use mock video for demonstration. For real video streaming, please use a development build or production app.';
  }

  if (environment.isDevelopmentBuild) {
    return 'Development build detected. Real video streaming is available with Agora SDK integration.';
  }

  if (environment.isProductionBuild) {
    return 'Production build detected. Full video streaming capabilities are available.';
  }

  return 'Streaming environment could not be determined. Mock video will be used as fallback.';
};

export default {
  isRunningInExpoGo,
  isRunningInDevelopmentBuild,
  isRunningInProduction,
  getStreamingEnvironment,
  getStreamingCapabilities,
  getStreamingConfig,
  validateStreamingPermissions,
  getStreamingSetupMessage,
  logStreamingEnvironment,
};