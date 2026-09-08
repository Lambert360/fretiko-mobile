/**
 * AgoraFramePusher
 *
 * Pushes filtered Skia camera frames to Agora for live streaming and video calls.
 * This is a pure JS solution — NO native module needed.
 *
 * Flow:
 * 1. Call `start()` before joining the Agora channel
 * 2. Agora engine: `setExternalVideoSource(true, false, ExternalVideoSourceType.VideoFrame)`
 * 3. On each camera frame, the FilterCameraView calls `pushFrame(skImage, width, height)`
 * 4. This reads raw RGBA pixels from the SkImage and pushes them to Agora
 *
 * Key APIs used:
 * - SkImage.readPixels() → Uint8Array (raw RGBA pixels)
 * - SkImage.makeNonTextureImage() → CPU-accessible copy if GPU-backed
 * - engine.getMediaEngine().pushVideoFrame(ExternalVideoFrame) → sends to Agora
 *
 * Performance note: readPixels() copies GPU→CPU, which has overhead.
 * For production, consider using texture-based pushing (VideoBufferTexture)
 * which avoids the GPU→CPU copy. This requires EGL context sharing which
 * is more complex to set up. The RGBA approach works and is the standard
 * pattern used in react-native-agora examples.
 */

import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import type { IRtcEngine } from 'react-native-agora';

// Agora enums — imported dynamically to avoid circular deps
let VideoBufferType: any;
let VideoPixelFormat: any;
let ExternalVideoSourceType: any;

async function loadAgoraEnums() {
  if (VideoBufferType) return;
  const agora = await import('react-native-agora');
  VideoBufferType = agora.VideoBufferType;
  VideoPixelFormat = agora.VideoPixelFormat;
  ExternalVideoSourceType = agora.ExternalVideoSourceType;
}

export class AgoraFramePusher {
  private engine: IRtcEngine | null = null;
  private isActive = false;
  private customVideoTrackId: number | null = null;
  private lastPushTime = 0;
  private targetFps = 30;
  private frameInterval = 1000 / 30; // ms between frames

  /**
   * Initialize and start pushing frames to Agora.
   * Must be called BEFORE joinChannel().
   *
   * @param engine - The Agora RTC engine instance
   * @param useCustomTrack - Whether to create a custom video track (for multiple tracks)
   * @returns true if successful
   */
  async start(engine: IRtcEngine, useCustomTrack = false): Promise<boolean> {
    try {
      await loadAgoraEnums();

      this.engine = engine;

      // Create custom video track if needed
      if (useCustomTrack) {
        this.customVideoTrackId = engine.createCustomVideoTrack();
      }

      // Enable external video source — must be called before joinChannel
      const mediaEngine = engine.getMediaEngine();
      mediaEngine.setExternalVideoSource(
        true,
        false, // useTexture = false (we're sending raw RGBA, not textures)
        ExternalVideoSourceType.VideoFrame,
      );

      this.isActive = true;
      console.log('✅ AgoraFramePusher started — external video source enabled');
      return true;
    } catch (error) {
      console.error('❌ AgoraFramePusher start failed:', error);
      return false;
    }
  }

  /**
   * Push raw RGBA pixels (already read from a Skia canvas) to Agora.
   * This is the preferred method — it avoids the intermediate SkImage
   * creation and GPU→CPU copy that pushFrame() requires, since the
   * pixels are already on the CPU.
   *
   * @param pixels - Raw RGBA pixel data (Uint8Array)
   * @param width - Frame width in pixels
   * @param height - Frame height in pixels
   * @returns true if frame was pushed, false if skipped (fps throttling)
   */
  pushRawFrame(pixels: Uint8Array, width: number, height: number): boolean {
    if (!this.isActive || !this.engine) return false;

    // FPS throttling — don't push faster than target
    const now = Date.now();
    if (now - this.lastPushTime < this.frameInterval) {
      return false;
    }
    this.lastPushTime = now;

    try {
      // Build the ExternalVideoFrame
      const frame = {
        type: VideoBufferType.VideoBufferRawData,
        format: VideoPixelFormat.VideoPixelRgba,
        buffer: pixels,
        stride: width,
        height,
        rotation: 0,
        timestamp: now,
      };

      // Push to Agora
      const mediaEngine = this.engine.getMediaEngine();
      mediaEngine.pushVideoFrame(frame, this.customVideoTrackId ?? undefined);

      return true;
    } catch (error) {
      // Don't log every frame error — too noisy
      return false;
    }
  }

  /**
   * Push a filtered Skia frame to Agora.
   * Reads raw RGBA pixels from the SkImage and pushes them.
   *
   * @param skImage - The rendered SkImage (filtered frame)
   * @returns true if frame was pushed, false if skipped (fps throttling)
   */
  pushFrame(skImage: SkImage): boolean {
    if (!this.isActive || !this.engine) return false;

    // FPS throttling — don't push faster than target
    const now = Date.now();
    if (now - this.lastPushTime < this.frameInterval) {
      return false;
    }
    this.lastPushTime = now;

    try {
      const width = skImage.width();
      const height = skImage.height();

      // If GPU-backed, make a CPU-accessible copy first
      const cpuImage = skImage.makeNonTextureImage();
      if (!cpuImage) {
        console.warn('⚠️ Failed to create CPU image from SkImage');
        return false;
      }

      // Read raw RGBA pixels
      const imageInfo = {
        width,
        height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Premul,
      };

      const pixels = cpuImage.readPixels(0, 0, imageInfo);
      if (!pixels) {
        console.warn('⚠️ readPixels returned null');
        return false;
      }

      // Convert to Uint8Array if needed (readPixels may return Float32Array)
      let buffer: Uint8Array;
      if (pixels instanceof Uint8Array) {
        buffer = pixels;
      } else {
        // Float32Array → Uint8Array conversion
        buffer = new Uint8Array(pixels.length);
        for (let i = 0; i < pixels.length; i++) {
          buffer[i] = Math.round(pixels[i] * 255);
        }
      }

      // Build the ExternalVideoFrame
      const frame = {
        type: VideoBufferType.VideoBufferRawData,
        format: VideoPixelFormat.VideoPixelRgba,
        buffer,
        stride: width,
        height,
        rotation: 0,
        timestamp: now,
      };

      // Push to Agora
      const mediaEngine = this.engine.getMediaEngine();
      mediaEngine.pushVideoFrame(frame, this.customVideoTrackId ?? undefined);

      return true;
    } catch (error) {
      // Don't log every frame error — too noisy
      return false;
    }
  }

  /**
   * Get the custom video track ID (for use in joinChannel options)
   */
  getCustomVideoTrackId(): number | null {
    return this.customVideoTrackId;
  }

  /**
   * Set target FPS for frame pushing
   */
  setTargetFps(fps: number): void {
    this.targetFps = fps;
    this.frameInterval = 1000 / fps;
  }

  /**
   * Check if the pusher is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Stop pushing frames and disable external video source.
   * Call this when leaving the channel.
   */
  stop(): void {
    if (!this.engine || !this.isActive) return;

    try {
      const mediaEngine = this.engine.getMediaEngine();
      mediaEngine.setExternalVideoSource(false, false);

      if (this.customVideoTrackId !== null) {
        this.engine.destroyCustomVideoTrack(this.customVideoTrackId);
        this.customVideoTrackId = null;
      }
    } catch (error) {
      console.error('❌ AgoraFramePusher stop failed:', error);
    }

    this.isActive = false;
    this.engine = null;
    console.log('✅ AgoraFramePusher stopped');
  }
}

/**
 * Singleton instance — shared across all surfaces
 */
export const agoraFramePusher = new AgoraFramePusher();
