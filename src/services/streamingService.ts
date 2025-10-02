import { Platform } from 'react-native';
import { getStreamingEnvironment, getStreamingConfig } from '../utils/streamingEnvironment';
import { getAgoraConfig, generateChannelName, ClientRole, ChannelProfile } from '../config/agora';

// Conditional import of Agora SDK (only available in development/production builds)
let RtcEngine: any = null;
let AgoraRTC: any = null;

try {
  if (Platform.OS !== 'web') {
    // Native platforms
    const { RtcEngine: NativeRtcEngine } = require('react-native-agora');
    RtcEngine = NativeRtcEngine;
  } else {
    // Web platform would use Agora Web SDK
    // const AgoraRTCSDK = require('agora-rtc-sdk-ng');
    // AgoraRTC = AgoraRTCSDK;
  }
} catch (error) {
  console.log('Agora SDK not available, using mock streaming');
}

/**
 * Streaming Service
 *
 * Universal streaming service that provides:
 * - Real video streaming with Agora SDK (development/production builds)
 * - Mock video streaming fallback (Expo Go)
 * - Unified API regardless of underlying implementation
 * - Automatic environment detection and adaptation
 * - Error handling and graceful degradation
 */

export interface StreamingEventHandler {
  onJoinChannelSuccess?: (channel: string, uid: number) => void;
  onUserJoined?: (uid: number) => void;
  onUserLeft?: (uid: number, reason: number) => void;
  onError?: (error: string) => void;
  onConnectionStateChanged?: (state: string) => void;
  onStreamingStats?: (stats: StreamingStats) => void;
  onNetworkQualityChanged?: (quality: number) => void;
}

export interface StreamingStats {
  totalDuration: number; // in seconds
  viewerCount: number;
  bitrate: number;
  frameRate: number;
  resolution: string;
  networkQuality: number; // 1-6 (1 = excellent, 6 = poor)
}

export interface StreamConfig {
  channelName: string;
  streamId: string;
  vendorId: string;
  isPublisher: boolean;
  videoQuality: 'low' | 'medium' | 'high';
  audioEnabled: boolean;
  videoEnabled: boolean;
  userId?: number;
}

export interface MockStreamData {
  videoUrl: string;
  thumbnail: string;
  duration: number;
  title: string;
  isLive: boolean;
}

class StreamingService {
  private rtcEngine: any = null;
  private isInitialized = false;
  private currentChannel: string | null = null;
  private isPublishing = false;
  private isViewing = false;
  private eventHandlers: StreamingEventHandler = {};
  private streamingStats: StreamingStats = {
    totalDuration: 0,
    viewerCount: 0,
    bitrate: 0,
    frameRate: 0,
    resolution: '0x0',
    networkQuality: 0,
  };
  private useMockStreaming = false;
  private mockStreamData: MockStreamData | null = null;
  private mockStreamTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the streaming service
   */
  async initialize(): Promise<void> {
    try {
      const environment = await getStreamingEnvironment();
      const config = await getStreamingConfig();

      this.useMockStreaming = config.useMockVideo;

      if (this.useMockStreaming) {
        await this.initializeMockStreaming();
      } else {
        await this.initializeAgoraStreaming();
      }

      this.isInitialized = true;
      console.log(`✅ Streaming service initialized in ${this.useMockStreaming ? 'mock' : 'real'} mode`);
    } catch (error) {
      console.error('Error initializing streaming service:', error);
      // Fallback to mock streaming if real streaming fails
      if (!this.useMockStreaming) {
        console.log('Falling back to mock streaming...');
        this.useMockStreaming = true;
        await this.initializeMockStreaming();
        this.isInitialized = true;
      }
      throw error;
    }
  }

  /**
   * Initialize Agora real-time streaming
   */
  private async initializeAgoraStreaming(): Promise<void> {
    if (!RtcEngine) {
      throw new Error('Agora SDK not available');
    }

    const agoraConfig = getAgoraConfig();

    if (!agoraConfig.appId) {
      throw new Error('Agora App ID not configured');
    }

    // Create RTC engine
    this.rtcEngine = await RtcEngine.createWithConfig({
      appId: agoraConfig.appId,
      channelProfile: agoraConfig.channelProfile,
      audioScenario: agoraConfig.audioScenario,
    });

    // Set up event handlers
    this.setupAgoraEventHandlers();

    // Configure audio and video
    await this.rtcEngine.setAudioProfile(agoraConfig.audioProfile);
    await this.rtcEngine.setVideoEncoderConfiguration(agoraConfig.videoEncoderConfig);

    // Enable video
    await this.rtcEngine.enableVideo();
    await this.rtcEngine.enableAudio();

    console.log('✅ Agora streaming initialized');
  }

  /**
   * Initialize mock streaming for Expo Go
   */
  private async initializeMockStreaming(): Promise<void> {
    const config = await getStreamingConfig();

    this.mockStreamData = {
      videoUrl: config.mockVideoUrl,
      thumbnail: config.mockThumbnail,
      duration: 3600, // 1 hour mock duration
      title: 'Live Stream Demo',
      isLive: false,
    };

    console.log('✅ Mock streaming initialized');
  }

  /**
   * Set up Agora event handlers
   */
  private setupAgoraEventHandlers(): void {
    if (!this.rtcEngine) return;

    this.rtcEngine.addListener('JoinChannelSuccess', (channel: string, uid: number) => {
      console.log(`✅ Joined channel: ${channel} with UID: ${uid}`);
      this.currentChannel = channel;
      this.eventHandlers.onJoinChannelSuccess?.(channel, uid);
    });

    this.rtcEngine.addListener('UserJoined', (uid: number) => {
      console.log(`👤 User joined: ${uid}`);
      this.streamingStats.viewerCount += 1;
      this.eventHandlers.onUserJoined?.(uid);
    });

    this.rtcEngine.addListener('UserOffline', (uid: number, reason: number) => {
      console.log(`👤 User left: ${uid}, reason: ${reason}`);
      this.streamingStats.viewerCount = Math.max(0, this.streamingStats.viewerCount - 1);
      this.eventHandlers.onUserLeft?.(uid, reason);
    });

    this.rtcEngine.addListener('Error', (errorCode: number) => {
      console.error(`❌ Agora error: ${errorCode}`);
      this.eventHandlers.onError?.(`Agora error: ${errorCode}`);
    });

    this.rtcEngine.addListener('RtcStats', (stats: any) => {
      this.streamingStats = {
        ...this.streamingStats,
        totalDuration: stats.totalDuration || 0,
        bitrate: stats.txKBitRate || 0,
      };
      this.eventHandlers.onStreamingStats?.(this.streamingStats);
    });

    this.rtcEngine.addListener('NetworkQuality', (uid: number, txQuality: number, rxQuality: number) => {
      this.streamingStats.networkQuality = Math.max(txQuality, rxQuality);
      this.eventHandlers.onNetworkQualityChanged?.(this.streamingStats.networkQuality);
    });
  }

  /**
   * Start publishing a live stream
   */
  async startPublishing(config: StreamConfig): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Streaming service not initialized');
    }

    try {
      if (this.useMockStreaming) {
        await this.startMockPublishing(config);
      } else {
        await this.startAgoraPublishing(config);
      }

      this.isPublishing = true;
      console.log(`🔴 Started publishing stream: ${config.streamId}`);
    } catch (error) {
      console.error('Error starting publishing:', error);
      throw error;
    }
  }

  /**
   * Start viewing a live stream
   */
  async startViewing(config: StreamConfig): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Streaming service not initialized');
    }

    try {
      if (this.useMockStreaming) {
        await this.startMockViewing(config);
      } else {
        await this.startAgoraViewing(config);
      }

      this.isViewing = true;
      console.log(`👀 Started viewing stream: ${config.streamId}`);
    } catch (error) {
      console.error('Error starting viewing:', error);
      throw error;
    }
  }

  /**
   * Stop publishing
   */
  async stopPublishing(): Promise<void> {
    try {
      if (this.useMockStreaming) {
        await this.stopMockPublishing();
      } else {
        await this.stopAgoraPublishing();
      }

      this.isPublishing = false;
      console.log('⏹️ Stopped publishing');
    } catch (error) {
      console.error('Error stopping publishing:', error);
      throw error;
    }
  }

  /**
   * Stop viewing
   */
  async stopViewing(): Promise<void> {
    try {
      if (this.useMockStreaming) {
        await this.stopMockViewing();
      } else {
        await this.stopAgoraViewing();
      }

      this.isViewing = false;
      console.log('⏹️ Stopped viewing');
    } catch (error) {
      console.error('Error stopping viewing:', error);
      throw error;
    }
  }

  /**
   * Agora-specific methods
   */
  private async startAgoraPublishing(config: StreamConfig): Promise<void> {
    if (!this.rtcEngine) throw new Error('RTC Engine not initialized');

    const channelName = generateChannelName(config.streamId, config.vendorId);

    // Set client role as broadcaster
    await this.rtcEngine.setClientRole(ClientRole.Broadcaster);

    // Join channel
    await this.rtcEngine.joinChannel(null, channelName, config.userId || 0);

    // Start local preview
    await this.rtcEngine.startPreview();
  }

  private async startAgoraViewing(config: StreamConfig): Promise<void> {
    if (!this.rtcEngine) throw new Error('RTC Engine not initialized');

    const channelName = generateChannelName(config.streamId, config.vendorId);

    // Set client role as audience
    await this.rtcEngine.setClientRole(ClientRole.Audience);

    // Join channel
    await this.rtcEngine.joinChannel(null, channelName, config.userId || 0);
  }

  private async stopAgoraPublishing(): Promise<void> {
    if (!this.rtcEngine) return;

    await this.rtcEngine.stopPreview();
    await this.rtcEngine.leaveChannel();
    this.currentChannel = null;
  }

  private async stopAgoraViewing(): Promise<void> {
    if (!this.rtcEngine) return;

    await this.rtcEngine.leaveChannel();
    this.currentChannel = null;
  }

  /**
   * Mock streaming methods
   */
  private async startMockPublishing(config: StreamConfig): Promise<void> {
    console.log('🎭 Starting mock publishing...');

    // Simulate joining channel
    setTimeout(() => {
      this.eventHandlers.onJoinChannelSuccess?.(config.streamId, 12345);
    }, 1000);

    // Simulate viewers joining
    this.simulateMockViewers();

    // Start mock stats timer
    this.startMockStatsTimer();
  }

  private async startMockViewing(config: StreamConfig): Promise<void> {
    console.log('🎭 Starting mock viewing...');

    // Simulate joining as viewer
    setTimeout(() => {
      this.eventHandlers.onJoinChannelSuccess?.(config.streamId, 67890);
    }, 500);
  }

  private async stopMockPublishing(): Promise<void> {
    console.log('🎭 Stopping mock publishing...');
    this.stopMockStatsTimer();
  }

  private async stopMockViewing(): Promise<void> {
    console.log('🎭 Stopping mock viewing...');
  }

  /**
   * Mock simulation helpers
   */
  private simulateMockViewers(): void {
    // Simulate viewers joining over time
    const viewerIntervals = [2000, 5000, 8000, 12000, 15000];
    viewerIntervals.forEach((delay, index) => {
      setTimeout(() => {
        const mockUid = 100000 + index;
        this.streamingStats.viewerCount += 1;
        this.eventHandlers.onUserJoined?.(mockUid);
      }, delay);
    });

    // Simulate occasional viewer leaving
    setTimeout(() => {
      if (this.streamingStats.viewerCount > 0) {
        this.streamingStats.viewerCount -= 1;
        this.eventHandlers.onUserLeft?.(100001, 1);
      }
    }, 20000);
  }

  private startMockStatsTimer(): void {
    this.mockStreamTimer = setInterval(() => {
      this.streamingStats = {
        ...this.streamingStats,
        totalDuration: this.streamingStats.totalDuration + 1,
        bitrate: 800 + Math.random() * 200, // 800-1000 kbps
        frameRate: 28 + Math.random() * 4, // 28-32 fps
        resolution: '1280x720',
        networkQuality: Math.floor(Math.random() * 2) + 1, // 1-2 (good quality)
      };

      this.eventHandlers.onStreamingStats?.(this.streamingStats);
    }, 1000);
  }

  private stopMockStatsTimer(): void {
    if (this.mockStreamTimer) {
      clearInterval(this.mockStreamTimer);
      this.mockStreamTimer = null;
    }
  }

  /**
   * Public utility methods
   */

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: StreamingEventHandler): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Get current streaming stats
   */
  getStreamingStats(): StreamingStats {
    return { ...this.streamingStats };
  }

  /**
   * Check if service is using mock streaming
   */
  isUsingMockStreaming(): boolean {
    return this.useMockStreaming;
  }

  /**
   * Get mock stream data (for UI display)
   */
  getMockStreamData(): MockStreamData | null {
    return this.mockStreamData;
  }

  /**
   * Toggle audio/video during streaming
   */
  async toggleAudio(enabled: boolean): Promise<void> {
    if (this.useMockStreaming) {
      console.log(`🎭 Mock: Audio ${enabled ? 'enabled' : 'disabled'}`);
      return;
    }

    if (this.rtcEngine) {
      if (enabled) {
        await this.rtcEngine.enableAudio();
      } else {
        await this.rtcEngine.disableAudio();
      }
    }
  }

  async toggleVideo(enabled: boolean): Promise<void> {
    if (this.useMockStreaming) {
      console.log(`🎭 Mock: Video ${enabled ? 'enabled' : 'disabled'}`);
      return;
    }

    if (this.rtcEngine) {
      if (enabled) {
        await this.rtcEngine.enableVideo();
      } else {
        await this.rtcEngine.disableVideo();
      }
    }
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(): Promise<void> {
    if (this.useMockStreaming) {
      console.log('🎭 Mock: Camera switched');
      return;
    }

    if (this.rtcEngine && Platform.OS !== 'web') {
      await this.rtcEngine.switchCamera();
    }
  }

  /**
   * Cleanup and destroy service
   */
  async destroy(): Promise<void> {
    try {
      if (this.isPublishing) {
        await this.stopPublishing();
      }

      if (this.isViewing) {
        await this.stopViewing();
      }

      this.stopMockStatsTimer();

      if (this.rtcEngine && !this.useMockStreaming) {
        await this.rtcEngine.destroy();
        this.rtcEngine = null;
      }

      this.isInitialized = false;
      console.log('🗑️ Streaming service destroyed');
    } catch (error) {
      console.error('Error destroying streaming service:', error);
    }
  }
}

// Export singleton instance
export const streamingService = new StreamingService();

export default streamingService;