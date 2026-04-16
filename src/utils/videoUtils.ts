import { Platform } from 'react-native';

export interface VideoFormat {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  isCompatible: boolean;
}

export class VideoValidator {
  
  /**
   * Check if video format is compatible with the current device
   */
  static isVideoCompatible(format: Partial<VideoFormat>): boolean {
    const { codec, width, height } = format;
    
    // HEVC (H.265) has limited support on Android devices
    if (Platform.OS === 'android' && codec === 'hevc') {
      // Only allow HEVC on newer Android versions with specific conditions
      const androidVersion = Platform.Version as number;
      
      // HEVC support is limited on Android
      // Most devices don't support hardware decoding for HEVC
      return false;
    }
    
    // Check resolution limits
    if (width && height) {
      const totalPixels = width * height;
      const maxPixels = Platform.OS === 'android' ? 1920 * 1080 : 3840 * 2160;
      
      if (totalPixels > maxPixels) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get recommended video settings for the current platform
   */
  static getRecommendedVideoSettings() {
    if (Platform.OS === 'android') {
      return {
        codec: 'h264', // H.264 is universally supported
        maxResolution: '1920x1080', // Full HD
        maxBitrate: 5000000, // 5 Mbps
        container: 'mp4',
        audioCodec: 'aac'
      };
    } else {
      // iOS has better codec support
      return {
        codec: 'h264', // Still recommend H.264 for compatibility
        maxResolution: '3840x2160', // 4K
        maxBitrate: 10000000, // 10 Mbps
        container: 'mp4',
        audioCodec: 'aac'
      };
    }
  }
  
  /**
   * Generate a user-friendly error message for video playback issues
   */
  static getErrorMessage(error: any): string {
    if (error?.error?.message?.includes('MediaCodecVideoRenderer')) {
      return 'This video format is not supported on your device. The video needs to be converted to a compatible format.';
    }
    
    if (error?.error?.message?.includes('NO_EXCEEDS_CAPABILITIES')) {
      return 'This video is too high quality for your device. Please try a lower resolution version.';
    }
    
    if (error?.error?.message?.includes('Decoder init failed')) {
      return 'Video decoder failed to initialize. This video format may not be supported.';
    }
    
    return 'Unable to play this video. Please try again later.';
  }
  
  /**
   * Check if we should show a fallback for video playback
   */
  static shouldShowFallback(error: any): boolean {
    const errorMessage = error?.error?.message || '';
    
    return (
      errorMessage.includes('MediaCodecVideoRenderer') ||
      errorMessage.includes('NO_EXCEEDS_CAPABILITIES') ||
      errorMessage.includes('Decoder init failed') ||
      errorMessage.includes('hevc')
    );
  }
}
