import { requireNativeModule } from 'expo-modules-core';

/**
 * SkiaVideoRecorder
 *
 * Native module that encodes a sequence of RGBA frames (captured from a Skia
 * canvas via `canvas.readPixels()`) into an MP4 video file using:
 * - iOS: AVAssetWriter + AVAssetWriterInput (pixel buffer adaptor)
 * - Android: MediaCodec encoder + MediaMuxer
 *
 * This enables recording filtered/beauty/AR video that matches the live preview,
 * since the frames are captured AFTER all Skia shader + AR processing.
 *
 * Audio is recorded simultaneously from the microphone via:
 * - iOS: AVAudioEngine
 * - Android: AudioRecord + MediaCodec AAC encoder
 */
interface SkiaVideoRecorderNativeModule {
  startRecording(
    width: number,
    height: number,
    fps: number,
    bitrate: number,
    enableAudio: boolean
  ): Promise<string>;
  pushFrame(pixels: ArrayBuffer, width: number, height: number): void;
  stopRecording(): Promise<string>;
  cancelRecording(): Promise<void>;
  isRecording(): boolean;
}

const NativeModule = requireNativeModule<SkiaVideoRecorderNativeModule>(
  'SkiaVideoRecorder'
);

export const SkiaVideoRecorder = {
  /**
   * Start recording. Returns the output file path.
   * @param width - Frame width in pixels
   * @param height - Frame height in pixels
   * @param fps - Target frames per second (default 30)
   * @param bitrate - Video bitrate in bits per second (default 4_000_000)
   * @param enableAudio - Whether to record audio from microphone
   */
  startRecording(
    width: number,
    height: number,
    fps: number = 30,
    bitrate: number = 4_000_000,
    enableAudio: boolean = true
  ): Promise<string> {
    return NativeModule.startRecording(width, height, fps, bitrate, enableAudio);
  },

  /**
   * Push a single RGBA frame to the encoder.
   * Call this from the camera frame callback after canvas.readPixels().
   * @param pixels - Raw RGBA pixel data (ArrayBuffer)
   * @param width - Frame width
   * @param height - Frame height
   */
  pushFrame(pixels: ArrayBuffer, width: number, height: number): void {
    NativeModule.pushFrame(pixels, width, height);
  },

  /**
   * Stop recording and finalize the video file.
   * Returns the file path of the completed video.
   */
  stopRecording(): Promise<string> {
    return NativeModule.stopRecording();
  },

  /**
   * Cancel recording and delete the partial video file.
   */
  cancelRecording(): Promise<void> {
    return NativeModule.cancelRecording();
  },

  /**
   * Check if recording is currently active.
   */
  isRecording(): boolean {
    return NativeModule.isRecording();
  },
};
