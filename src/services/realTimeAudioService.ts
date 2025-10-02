import { Alert, Platform } from 'react-native';

// Conditionally import audio studio only when available
let AudioRecording: any = null;
let AudioPlayer: any = null;

try {
  // Only import if running in development build (not Expo Go)
  if (Platform.OS !== 'web' && global.__DEV__ !== false) {
    const audioStudio = require('@siteed/expo-audio-studio');
    AudioRecording = audioStudio.AudioRecording;
    AudioPlayer = audioStudio.AudioPlayer;
  }
} catch (error) {
  console.log('💡 Audio studio not available - running in Expo Go mode');
}

/**
 * Real-time audio streaming service for Iko voice calls
 * Handles continuous PCM audio streaming to Gemini Live API
 */
export class RealTimeAudioService {
  private recording: AudioRecording | null = null;
  private player: AudioPlayer | null = null;
  private isStreaming = false;
  private streamingInterval: NodeJS.Timeout | null = null;
  private webSocket: WebSocket | null = null;
  private onAudioChunkCallback: ((chunk: string) => void) | null = null;

  /**
   * Initialize real-time audio streaming
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🎤 Initializing real-time audio service...');

      // Check if native modules are available (not in Expo Go)
      if (!AudioRecording || !AudioPlayer) {
        console.log('⚠️ Real-time audio not available in Expo Go');
        Alert.alert(
          'Voice Calls Unavailable',
          'Voice calls with Iko require the development build. Text chat still works!'
        );
        return false;
      }

      // Initialize recording with PCM format optimized for Gemini Live
      this.recording = new AudioRecording({
        sampleRate: 16000,     // Gemini requirement
        numberOfChannels: 1,   // Mono
        bitDepth: 16,          // 16-bit PCM
        format: 'pcm',         // Raw PCM format
      });

      // Initialize player for AI responses
      this.player = new AudioPlayer({
        sampleRate: 16000,
        numberOfChannels: 1,
        bitDepth: 16,
      });

      console.log('✅ Real-time audio service initialized');
      return true;

    } catch (error) {
      console.error('❌ Error initializing audio service:', error);
      Alert.alert('Audio Error', 'Failed to initialize audio system. Please check microphone permissions.');
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
      if (!this.recording) {
        throw new Error('Audio recording not initialized');
      }

      if (webSocket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      console.log('🎵 Starting continuous audio streaming...');

      this.webSocket = webSocket;
      this.onAudioChunkCallback = onAudioChunk || null;
      this.isStreaming = true;

      // Request microphone permissions
      const hasPermission = await this.recording.requestPermissionsAsync();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      // Start continuous recording
      await this.recording.startAsync();

      // Set up streaming interval for real-time chunks
      this.streamingInterval = setInterval(async () => {
        if (!this.isStreaming || !this.recording || !this.webSocket) {
          return;
        }

        try {
          // Get latest audio chunk (100ms worth of audio)
          const audioChunk = await this.recording.getLatestAudioDataAsync();

          if (audioChunk && audioChunk.length > 0) {
            // Convert to base64 for WebSocket transmission
            const base64Chunk = this.arrayBufferToBase64(audioChunk);

            // Send directly as binary WebSocket frame (optimal for Gemini)
            if (this.webSocket.readyState === WebSocket.OPEN) {
              // Send as binary data for better performance
              this.webSocket.send(audioChunk);

              console.log('🎵 Sent PCM audio chunk:', audioChunk.byteLength, 'bytes');

              // Callback for debugging/monitoring
              if (this.onAudioChunkCallback) {
                this.onAudioChunkCallback(base64Chunk);
              }
            }
          }
        } catch (streamError) {
          console.warn('⚠️ Audio streaming error:', streamError);
        }
      }, 100); // 100ms intervals for real-time feel

      console.log('✅ Continuous audio streaming started');

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

      // Clear streaming interval
      if (this.streamingInterval) {
        clearInterval(this.streamingInterval);
        this.streamingInterval = null;
      }

      // Stop recording
      if (this.recording) {
        await this.recording.stopAsync();
      }

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
      if (!this.player) {
        console.warn('⚠️ Audio player not initialized');
        return;
      }

      console.log('🔊 Playing Gemini audio response...');

      // Convert base64 to ArrayBuffer if needed
      let audioBuffer: ArrayBuffer;
      if (typeof audioData === 'string') {
        audioBuffer = this.base64ToArrayBuffer(audioData);
      } else {
        audioBuffer = audioData;
      }

      // Play the audio
      await this.player.loadAsync(audioBuffer);
      await this.player.playAsync();

      console.log('✅ Audio response played successfully');

    } catch (error) {
      console.error('❌ Error playing audio response:', error);
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
      isRecording: this.recording?.isRecording ?? false,
      webSocketConnected: this.webSocket?.readyState === WebSocket.OPEN,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up audio service...');

    await this.stopStreaming();

    // Release audio resources
    if (this.recording) {
      await this.recording.unloadAsync();
      this.recording = null;
    }

    if (this.player) {
      await this.player.unloadAsync();
      this.player = null;
    }

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