import { Alert, Platform } from 'react-native';

/**
 * Real-time audio streaming service for Iko voice calls
 * Basic implementation - will work in Expo Go and can be enhanced later
 */
export class RealTimeAudioService {
  private isStreaming = false;
  private webSocket: WebSocket | null = null;
  private onAudioChunkCallback: ((chunk: string) => void) | null = null;

  /**
   * Initialize real-time audio streaming
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🎤 Initializing real-time audio service...');

      // For now, just check if we're not in web environment
      if (Platform.OS === 'web') {
        console.log('⚠️ Real-time audio not available on web');
        Alert.alert(
          'Voice Calls Unavailable',
          'Voice calls with Iko require a mobile app. Text chat still works!'
        );
        return false;
      }

      console.log('✅ Real-time audio service initialized (basic mode)');
      return true;

    } catch (error) {
      console.error('❌ Error initializing audio service:', error);
      Alert.alert('Audio Error', 'Failed to initialize audio system.');
      return false;
    }
  }

  /**
   * Start continuous audio streaming to WebSocket
   */
  async startStreaming(
    webSocket: WebSocket,
    onAudioChunk?: (chunk: string) => void
  ): Promise<void> {
    try {
      if (webSocket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      console.log('🎵 Starting basic audio streaming...');

      this.webSocket = webSocket;
      this.onAudioChunkCallback = onAudioChunk || null;
      this.isStreaming = true;

      // Set up basic streaming interval with placeholder audio
      const streamingInterval = setInterval(() => {
        if (!this.isStreaming || !this.webSocket) {
          return;
        }

        try {
          // Create a simple test audio chunk (silence)
          // This is a placeholder until we implement proper audio recording
          const silenceChunk = new Uint8Array(1600); // 100ms of 16kHz mono 16-bit audio
          silenceChunk.fill(0); // Fill with silence

            if (this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(silenceChunk.buffer);

            console.log('🎵 Sent test audio chunk:', silenceChunk.length, 'bytes');

              // Callback for debugging/monitoring
              if (this.onAudioChunkCallback) {
              this.onAudioChunkCallback(this.arrayBufferToBase64(silenceChunk.buffer));
            }
          }
        } catch (streamError) {
          console.warn('⚠️ Audio streaming error:', streamError);
        }
      }, 100); // 100ms intervals

      console.log('✅ Basic audio streaming started (placeholder implementation)');

    } catch (error) {
      console.error('❌ Error starting audio streaming:', error);
      this.stopStreaming();
      throw error;
    }
  }

  /**
   * Stop audio streaming
   */
  async stopStreaming(): Promise<void> {
    try {
      console.log('🛑 Stopping audio streaming...');

      this.isStreaming = false;

      // Clear WebSocket reference
      this.webSocket = null;
      this.onAudioChunkCallback = null;

      console.log('✅ Audio streaming stopped');

    } catch (error) {
      console.error('❌ Error stopping audio streaming:', error);
    }
  }

  /**
   * Play audio response from Gemini
   */
  async playAudioResponse(audioData: ArrayBuffer | string): Promise<void> {
    try {
      console.log('🔊 Audio playback not yet implemented - received response:', typeof audioData);

      // For now, just log that we received audio data
      // TODO: Implement proper audio playback
      console.log('✅ Audio response received successfully (playback not implemented)');

    } catch (error) {
      console.error('❌ Error handling audio response:', error);
    }
  }

  /**
   * Get current streaming status
   */
  getStreamingStatus(): {
    isStreaming: boolean;
    isRecording: boolean;
    webSocketConnected: boolean;
  } {
    return {
      isStreaming: this.isStreaming,
      isRecording: false, // Placeholder - not implemented yet
      webSocketConnected: this.webSocket?.readyState === WebSocket.OPEN,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up audio service...');
    await this.stopStreaming();
    console.log('✅ Audio service cleanup complete');
  }


  // Utility functions
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const buffer = new ArrayBuffer(binaryString.length);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < binaryString.length; i++) {
      view[i] = binaryString.charCodeAt(i);
    }

    return buffer;
  }
}

// Export singleton instance
export const realTimeAudioService = new RealTimeAudioService();