/**
 * Agora Call Service
 * 
 * Service for managing 1-on-1 video and audio calls using Agora Communication profile.
 * This service handles peer-to-peer calls separate from live streaming functionality.
 */

import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  ChannelMediaOptions,
  RenderModeType,
  ConnectionStateType,
  ConnectionChangedReasonType,
} from 'react-native-agora';
import { getAgoraConfig } from '../config/agora';

export interface AgoraCallConfig {
  appId: string;
  channelName?: string; // Frontend preferred name
  channel?: string; // Backend returns this
  token: string;
  uid: number;
}

export interface AgoraCallCallbacks {
  onJoinChannelSuccess?: (connection: any, elapsed: number) => void;
  onUserJoined?: (connection: any, remoteUid: number, elapsed: number) => void;
  onUserOffline?: (connection: any, remoteUid: number, reason: number) => void;
  onLeaveChannel?: (connection: any, stats: any) => void;
  onError?: (err: number, msg: string) => void;
  onConnectionStateChanged?: (state: number, reason: number) => void;
  onRemoteVideoStateChanged?: (uid: number, state: number, reason: number, elapsed: number) => void;
  onRemoteAudioStateChanged?: (uid: number, state: number, reason: number, elapsed: number) => void;
}

class AgoraCallService {
  private engine: IRtcEngine | null = null;
  private callbacks: AgoraCallCallbacks = {};
  private currentChannelName: string | null = null;
  private currentUid: number | null = null;
  private isInitialized: boolean = false;
  private isReinitializing: boolean = false; // Track reinitialization state

  /**
   * Initialize Agora engine for 1-on-1 calls
   * @param appId - Agora App ID (from backend response)
   * @param callbacks - Event callbacks
   */
  async initialize(appId: string, callbacks: AgoraCallCallbacks, channelName?: string | null): Promise<void> {
    try {
      console.log('📞 Initializing Agora Call Service for 1-on-1 calls...');

      // If already initialized and in the same channel, just update callbacks
      if (this.isInitialized && this.engine && this.currentChannelName && channelName) {
        if (this.currentChannelName === channelName) {
          console.log('📞 Already initialized and in the same channel, updating callbacks only');
          this.callbacks = callbacks;
          return; // Skip reinitialization
        }
      }

      if (this.isInitialized && this.engine) {
        console.log('⚠️ Engine already initialized, cleaning up first...');
        // Mark that we're reinitializing so connection state handlers know to ignore LEAVE_CHANNEL
        this.isReinitializing = true;
        const wasInChannel = !!this.currentChannelName;
        await this.cleanup();
        // If we were in a channel, this was a reinitialization - don't treat it as leaving
        if (wasInChannel) {
          console.log('📞 Reinitializing engine (was in channel) - this is expected');
        }
        // Reset flag after a short delay to allow connection state events to be processed
        setTimeout(() => {
          this.isReinitializing = false;
        }, 1000);
      }

      if (!appId) {
        throw new Error('Agora App ID is required');
      }

      this.callbacks = callbacks;

      // Create engine
      this.engine = createAgoraRtcEngine();
      
      // Initialize with Communication profile for 1-on-1 calls
      const initResult = this.engine.initialize({
        appId: appId, // Use App ID from backend
        channelProfile: ChannelProfileType.ChannelProfileCommunication, // Critical: Communication for 1-on-1
      });

      if (initResult !== 0) {
        throw new Error(`Engine initialization failed with code: ${initResult}`);
      }

      console.log('✅ Agora engine initialized with Communication profile');

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('✅ Agora Call Service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Agora Call Service:', error);
      this.callbacks.onError?.(0, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.engine) return;

    this.engine.addListener('onJoinChannelSuccess', (connection: any, elapsed: number) => {
      console.log('📞 Joined call channel successfully:', { connection, elapsed });
      this.callbacks.onJoinChannelSuccess?.(connection, elapsed);
    });

    this.engine.addListener('onUserJoined', (connection: any, remoteUid: number, elapsed: number) => {
      console.log('📞 Remote user joined call:', { remoteUid, elapsed });
      this.callbacks.onUserJoined?.(connection, remoteUid, elapsed);
    });

    this.engine.addListener('onUserOffline', (connection: any, remoteUid: number, reason: number) => {
      console.log('📞 Remote user left call:', { remoteUid, reason });
      this.callbacks.onUserOffline?.(connection, remoteUid, reason);
    });

    this.engine.addListener('onLeaveChannel', (connection: any, stats: any) => {
      console.log('📞 Left call channel:', { connection, stats });
      this.callbacks.onLeaveChannel?.(connection, stats);
    });

    this.engine.addListener('onError', (err: number, msg: string) => {
      console.error('❌ Agora call error:', { err, msg });
      this.callbacks.onError?.(err, msg);
    });

    this.engine.addListener('onConnectionStateChanged', (connection: any, state: number, reason: number) => {
      console.log('📞 Connection state changed:', { state, reason });
      this.callbacks.onConnectionStateChanged?.(state, reason);
    });

    this.engine.addListener('onRemoteVideoStateChanged', (connection: any, remoteUid: number, state: number, reason: number, elapsed: number) => {
      console.log('📞 Remote video state changed:', { remoteUid, state, reason, elapsed });
      this.callbacks.onRemoteVideoStateChanged?.(remoteUid, state, reason, elapsed);
    });

    this.engine.addListener('onRemoteAudioStateChanged', (connection: any, remoteUid: number, state: number, reason: number, elapsed: number) => {
      console.log('📞 Remote audio state changed:', { remoteUid, state, reason, elapsed });
      this.callbacks.onRemoteAudioStateChanged?.(remoteUid, state, reason, elapsed);
    });
  }

  /**
   * Join a call channel
   */
  async joinChannel(config: AgoraCallConfig, isVideoCall: boolean = true): Promise<number> {
    try {
      if (!this.engine || !this.isInitialized) {
        throw new Error('Engine not initialized. Call initialize() first.');
      }

      // Get channel name (support both channelName and channel for compatibility)
      const channelName = config.channelName || config.channel;
      
      if (!channelName) {
        throw new Error('Channel name is required in AgoraCallConfig');
      }

      // If already in the same channel, skip joining but ensure preview is started for video calls
      if (this.currentChannelName === channelName && this.currentUid === config.uid) {
        console.log('📞 Already in the same channel, skipping join');
        
        // Ensure preview is started for video calls (in case it wasn't started before)
        if (isVideoCall && this.engine) {
          try {
            await this.engine.enableVideo();
            await this.engine.startPreview();
            console.log('✅ Video preview started (already in channel)');
          } catch (previewError) {
            console.warn('⚠️ Error starting preview (may already be running):', previewError);
          }
        }
        
        return 0; // Return success
      }

      console.log('📞 Joining call channel:', {
        channel: channelName,
        uid: config.uid,
        isVideoCall,
        token: config.token ? 'present' : 'missing',
      });

      // Enable audio
      await this.engine.enableAudio();
      console.log('✅ Audio enabled');

      // Enable video and start preview BEFORE joining for video calls
      // This ensures the initiator's video starts immediately
      if (isVideoCall) {
        try {
          await this.engine.enableVideo();
          console.log('✅ Video enabled before join');
          
          // CRITICAL: Start preview BEFORE joining channel
          // This is essential for the initiator to see their video immediately
          const previewResult = await this.engine.startPreview();
          console.log('✅ Video preview started BEFORE join (initiator optimization), result:', previewResult);
        } catch (previewError) {
          console.error('❌ Error starting preview before join:', previewError);
          // Continue anyway - preview might work after join
        }
      }

      // Configure channel media options
      const mediaOptions = new ChannelMediaOptions();
      mediaOptions.publishMicrophoneTrack = true;
      mediaOptions.publishCameraTrack = isVideoCall;
      mediaOptions.autoSubscribeAudio = true;
      mediaOptions.autoSubscribeVideo = isVideoCall;
      // For Communication profile, clientRoleType is not needed (all users are broadcasters)

      // Join channel (channelName already extracted above)
      const result = await this.engine.joinChannel(
        config.token,
        channelName,
        config.uid,
        mediaOptions
      );

      if (result === 0) {
        this.currentChannelName = channelName;
        this.currentUid = config.uid;
        console.log('✅ Successfully joined call channel');
        
        // Ensure preview is still running after join (in case it wasn't started before)
        if (isVideoCall) {
          try {
            // Double-check video is enabled
            await this.engine.enableVideo();
            console.log('✅ Video confirmed enabled after join');
            
            // Ensure preview is running (might already be running from before join)
            await this.engine.startPreview();
            console.log('✅ Video preview confirmed after join');
          } catch (previewError) {
            console.warn('⚠️ Error confirming preview after join (may already be running):', previewError);
            // Don't throw - preview might already be running
          }
        }
      } else {
        // Agora error codes: -2 = ERR_INVALID_ARGUMENT, -7 = ERR_NOT_INITIALIZED, etc.
        const errorMessages: { [key: number]: string } = {
          [-2]: 'Invalid argument (check channel name, token, or UID)',
          [-7]: 'Engine not initialized',
          [-17]: 'Join channel rejected',
          [-101]: 'Invalid App ID',
          [-102]: 'Invalid channel name',
          [-110]: 'Invalid token',
        };
        const errorMsg = errorMessages[result] || `Unknown error (code: ${result})`;
        console.error(`❌ Failed to join channel: ${errorMsg}`, {
          errorCode: result,
          channel: channelName,
          uid: config.uid,
          hasToken: !!config.token,
          tokenLength: config.token?.length || 0,
        });
        throw new Error(`Failed to join channel: ${errorMsg} (code: ${result})`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error joining call channel:', error);
      throw error;
    }
  }

  /**
   * Leave the call channel
   */
  async leaveChannel(): Promise<void> {
    try {
      if (!this.engine) {
        console.warn('⚠️ Engine not initialized, nothing to leave');
        return;
      }

      console.log('📞 Leaving call channel...');
      
      await this.engine.leaveChannel();
      
      this.currentChannelName = null;
      this.currentUid = null;
      
      console.log('✅ Left call channel');
    } catch (error) {
      console.error('❌ Error leaving channel:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute local audio
   */
  async muteAudio(muted: boolean): Promise<number> {
    try {
      if (!this.engine) {
        throw new Error('Engine not initialized');
      }
      const result = await this.engine.muteLocalAudioStream(muted);
      console.log(`🎤 Audio ${muted ? 'muted' : 'unmuted'}`);
      return result;
    } catch (error) {
      console.error('❌ Error muting audio:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute local video
   */
  async muteVideo(muted: boolean): Promise<number> {
    try {
      if (!this.engine) {
        throw new Error('Engine not initialized');
      }
      const result = await this.engine.muteLocalVideoStream(muted);
      console.log(`📹 Video ${muted ? 'muted' : 'unmuted'}`);
      return result;
    } catch (error) {
      console.error('❌ Error muting video:', error);
      throw error;
    }
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(): Promise<number> {
    try {
      if (!this.engine) {
        throw new Error('Engine not initialized');
      }
      const result = await this.engine.switchCamera();
      console.log('📷 Camera switched');
      return result;
    } catch (error) {
      console.error('❌ Error switching camera:', error);
      throw error;
    }
  }

  /**
   * Get engine instance
   */
  getEngine(): IRtcEngine | null {
    return this.engine;
  }

  /**
   * Get current channel name
   */
  getCurrentChannelName(): string | null {
    return this.currentChannelName;
  }

  /**
   * Check if we're currently reinitializing
   */
  isReinitializingEngine(): boolean {
    return this.isReinitializing;
  }

  /**
   * Get current UID
   */
  getCurrentUid(): number | null {
    return this.currentUid;
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized && this.engine !== null;
  }

  /**
   * Cleanup and release engine
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Agora Call Service...');

      if (this.engine) {
        // Remove all listeners
        this.engine.removeAllListeners();
        
        // Leave channel if in one
        if (this.currentChannelName) {
          await this.leaveChannel();
        }
        
        // Release engine
        await this.engine.release();
        this.engine = null;
      }

      this.currentChannelName = null;
      this.currentUid = null;
      this.isInitialized = false;
      this.callbacks = {};

      console.log('✅ Agora Call Service cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up Agora Call Service:', error);
      // Continue cleanup even if there's an error
      this.engine = null;
      this.currentChannelName = null;
      this.currentUid = null;
      this.isInitialized = false;
      this.callbacks = {};
    }
  }
}

// Export singleton instance
export const agoraCallService = new AgoraCallService();

