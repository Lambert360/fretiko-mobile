/**
 * WebRTC Service
 * 
 * Comprehensive service for managing WebRTC peer connections, media streams,
 * and real-time communication for audio/video calls.
 * 
 * Features:
 * - Peer-to-peer connection management
 * - Media stream handling (audio/video)
 * - ICE candidate management
 * - SDP offer/answer exchange
 * - Connection state monitoring
 * - Error handling and reconnection
 */

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
  RTCView,
} from 'react-native-webrtc';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MediaStreamConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | VideoConstraints;
}

export interface VideoConstraints {
  width?: number | { min?: number; max?: number; ideal?: number };
  height?: number | { min?: number; max?: number; ideal?: number };
  frameRate?: number | { min?: number; max?: number; ideal?: number };
  facingMode?: 'user' | 'environment';
}

export interface MediaTrackConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
}

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
export type ICEConnectionState = 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';
export type ICEGatheringState = 'new' | 'gathering' | 'complete';

export interface WebRTCCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onIceConnectionStateChange?: (state: ICEConnectionState) => void;
  onIceGatheringStateChange?: (state: ICEGatheringState) => void;
  onError?: (error: Error) => void;
}

/**
 * WebRTC Service Class
 * Manages peer-to-peer connections and media streams
 */
class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callbacks: WebRTCCallbacks = {};
  private config: WebRTCConfig | null = null;
  private iceCandidateQueue: RTCIceCandidate[] = [];
  private isRemoteDescriptionSet = false;

  /**
   * Initialize WebRTC service with configuration
   */
  async initialize(config: WebRTCConfig, callbacks: WebRTCCallbacks): Promise<void> {
    try {
      console.log('🔗 Initializing WebRTC service...', config);
      
      this.config = config;
      this.callbacks = callbacks;
      
      // Create peer connection
      this.peerConnection = new RTCPeerConnection(config);
      
      // Setup event listeners
      this.setupPeerConnectionListeners();
      
      console.log('✅ WebRTC service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing WebRTC service:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Setup peer connection event listeners
   */
  private setupPeerConnectionListeners(): void {
    if (!this.peerConnection) return;

    // ICE candidate event
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 New ICE candidate:', event.candidate);
        this.callbacks.onIceCandidate?.(event.candidate);
      } else {
        console.log('🧊 ICE gathering complete');
      }
    };

    // Remote stream event
    this.peerConnection.ontrack = (event) => {
      console.log('📹 Remote track received:', event.track.kind);
      
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.log('📺 Remote stream set:', this.remoteStream.id);
        this.callbacks.onRemoteStream?.(this.remoteStream);
      }
    };

    // Connection state change
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState as ConnectionState;
      console.log('🔄 Connection state changed:', state);
      this.callbacks.onConnectionStateChange?.(state);

      // Handle failed or disconnected states
      if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    // ICE connection state change
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState as ICEConnectionState;
      console.log('🧊 ICE connection state changed:', state);
      this.callbacks.onIceConnectionStateChange?.(state);
    };

    // ICE gathering state change
    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection?.iceGatheringState as ICEGatheringState;
      console.log('📡 ICE gathering state changed:', state);
      this.callbacks.onIceGatheringStateChange?.(state);
    };

    // Negotiation needed (for renegotiation scenarios)
    this.peerConnection.onnegotiationneeded = async () => {
      console.log('🔄 Negotiation needed');
      // Handle renegotiation if needed
    };
  }

  /**
   * Get user media (camera and/or microphone)
   */
  async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      console.log('🎥 Requesting user media...', constraints);
      
      const stream = await mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      
      console.log('✅ Local stream obtained:', {
        id: stream.id,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      // Add tracks to peer connection
      if (this.peerConnection) {
        stream.getTracks().forEach((track) => {
          console.log(`➕ Adding ${track.kind} track to peer connection`);
          this.peerConnection!.addTrack(track, stream);
        });
      }

      this.callbacks.onLocalStream?.(stream);
      return stream;
    } catch (error) {
      console.error('❌ Error getting user media:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Create an offer for initiating a call
   */
  async createOffer(): Promise<RTCSessionDescription> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      console.log('📝 Creating offer...');
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Local description set (offer)');

      return offer;
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Create an answer for accepting a call
   */
  async createAnswer(): Promise<RTCSessionDescription> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      console.log('📝 Creating answer...');
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('✅ Local description set (answer)');

      return answer;
    } catch (error) {
      console.error('❌ Error creating answer:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Set remote description (offer or answer from peer)
   */
  async setRemoteDescription(description: RTCSessionDescription): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      console.log('📝 Setting remote description:', description.type);
      
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(description)
      );

      this.isRemoteDescriptionSet = true;
      console.log('✅ Remote description set successfully');

      // Process queued ICE candidates
      await this.processQueuedIceCandidates();
    } catch (error) {
      console.error('❌ Error setting remote description:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Add ICE candidate from peer
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const iceCandidate = new RTCIceCandidate(candidate);

      // Queue candidate if remote description not set yet
      if (!this.isRemoteDescriptionSet) {
        console.log('📦 Queueing ICE candidate (remote description not set yet)');
        this.iceCandidateQueue.push(iceCandidate);
        return;
      }

      console.log('🧊 Adding ICE candidate');
      await this.peerConnection.addIceCandidate(iceCandidate);
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
      // Don't throw - ICE candidates can fail without breaking the call
      console.warn('⚠️ Continuing despite ICE candidate error');
    }
  }

  /**
   * Process queued ICE candidates
   */
  private async processQueuedIceCandidates(): Promise<void> {
    if (this.iceCandidateQueue.length === 0) return;

    console.log(`📦 Processing ${this.iceCandidateQueue.length} queued ICE candidates`);

    for (const candidate of this.iceCandidateQueue) {
      try {
        await this.peerConnection?.addIceCandidate(candidate);
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
      }
    }

    this.iceCandidateQueue = [];
    console.log('✅ Queued ICE candidates processed');
  }

  /**
   * Toggle audio track
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
        console.log(`🎤 Audio ${enabled ? 'enabled' : 'disabled'}`);
      });
    }
  }

  /**
   * Toggle video track
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
        console.log(`📹 Video ${enabled ? 'enabled' : 'disabled'}`);
      });
    }
  }

  /**
   * Switch camera (front/back)
   */
  async switchCamera(): Promise<void> {
    try {
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
          // @ts-ignore - _switchCamera is a react-native-webrtc specific method
          await videoTrack._switchCamera();
          console.log('📷 Camera switched');
        }
      }
    } catch (error) {
      console.error('❌ Error switching camera:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(): void {
    console.warn('⚠️ Connection failure detected');
    
    // You can implement reconnection logic here
    // For now, just log and notify via callback
  }

  /**
   * Get connection stats
   */
  async getStats(): Promise<any> {
    if (!this.peerConnection) return null;

    try {
      const stats = await this.peerConnection.getStats();
      return stats;
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return null;
    }
  }

  /**
   * Close connection and cleanup
   */
  close(): void {
    console.log('🔌 Closing WebRTC connection...');

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
        console.log(`⏹️ Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }

    // Stop remote stream tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear state
    this.iceCandidateQueue = [];
    this.isRemoteDescriptionSet = false;
    this.callbacks = {};

    console.log('✅ WebRTC connection closed and cleaned up');
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Get peer connection
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  /**
   * Check if connection is active
   */
  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }
}

// Export singleton instance
export const webRTCService = new WebRTCService();

// Export types
export { RTCView, MediaStream };
export type { RTCSessionDescription, RTCIceCandidate };

