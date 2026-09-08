package expo.modules.skiavideorecorder

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

/**
 * SkiaVideoRecorderModule
 *
 * Encodes a sequence of RGBA frames into an MP4 video file using MediaCodec + MediaMuxer.
 * Frames are pushed from JS via pushFrame(pixels, width, height).
 *
 * Audio recording support is deferred to a follow-up — the current implementation
 * focuses on video-only encoding. Audio can be added via AudioRecord + AAC MediaCodec.
 */
class SkiaVideoRecorderModule : Module() {
  private val TAG = "SkiaVideoRecorder"

  private var mediaCodec: MediaCodec? = null
  private var mediaMuxer: MediaMuxer? = null
  private var videoTrackIndex: Int = -1
  private var isRecordingFlag = AtomicBoolean(false)
  private var outputFile: File? = null
  private var frameWidth: Int = 0
  private var frameHeight: Int = 0
  private var targetFps: Int = 30
  private var frameCount: Long = 0
  private var muxerStarted: Boolean = false
  private var bufferInfo = MediaCodec.BufferInfo()

  override fun definition() = ModuleDefinition {
    Name("SkiaVideoRecorder")

    AsyncFunction("startRecording") { width: Int, height: Int, fps: Int, bitrate: Int, enableAudio: Boolean ->
      startRecording(width, height, fps, bitrate, enableAudio)
    }

    Function("pushFrame") { pixels: ByteArray, width: Int, height: Int ->
      pushFrame(pixels, width, height)
    }

    AsyncFunction("stopRecording") {
      stopRecording()
    }

    AsyncFunction("cancelRecording") {
      cancelRecording()
    }

    Function("isRecording") {
      isRecordingFlag.get()
    }
  }

  private fun startRecording(width: Int, height: Int, fps: Int, bitrate: Int, enableAudio: Boolean): String {
    if (isRecordingFlag.get()) {
      throw Exception("ALREADY_RECORDING: Recording is already in progress")
    }

    frameWidth = width
    frameHeight = height
    targetFps = fps
    frameCount = 0
    muxerStarted = false

    // Create output file
    val ctx = appContext.reactContext ?: throw Exception("START_FAILED: No context available")
    val tempDir = File(ctx.cacheDir, "skia_videos")
    if (!tempDir.exists()) tempDir.mkdirs()
    outputFile = File(tempDir, "skia_video_${System.currentTimeMillis()}.mp4")

    // Configure video encoder
    // COLOR_Format32bitABGR8888 is the same value as the old COLOR_FormatRGBA8888 (0x21)
    // The old name was removed in API 33+, so we use the new name for all API levels
    val colorFormat = MediaCodecInfo.CodecCapabilities.COLOR_Format32bitABGR8888
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height)
    format.setInteger(MediaFormat.KEY_COLOR_FORMAT, colorFormat)
    format.setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
    format.setInteger(MediaFormat.KEY_FRAME_RATE, fps)
    format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)

    try {
      mediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
      mediaCodec!!.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      mediaCodec!!.start()

      // Create muxer
      mediaMuxer = MediaMuxer(outputFile!!.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      videoTrackIndex = -1 // Will be set when format is available

      isRecordingFlag.set(true)
      Log.i(TAG, "Recording started: ${outputFile!!.absolutePath}")
      return outputFile!!.absolutePath
    } catch (e: Exception) {
      Log.e(TAG, "Failed to start recording", e)
      cleanup()
      throw Exception("START_FAILED: ${e.message}")
    }
  }

  private fun pushFrame(pixels: ByteArray, width: Int, height: Int) {
    if (!isRecordingFlag.get()) return
    val codec = mediaCodec ?: return

    try {
      val inputBufferIndex = codec.dequeueInputBuffer(10000) // 10ms timeout
      if (inputBufferIndex >= 0) {
        val inputBuffer = codec.getInputBuffer(inputBufferIndex)
        if (inputBuffer != null) {
          inputBuffer.clear()
          // Ensure we don't overflow the buffer
          val maxBytes = inputBuffer.capacity()
          val bytesToWrite = minOf(pixels.size, maxBytes)
          inputBuffer.put(pixels, 0, bytesToWrite)

          val presentationTimeUs = frameCount * 1_000_000L / targetFps
          frameCount++

          codec.queueInputBuffer(
            inputBufferIndex,
            0,
            bytesToWrite,
            presentationTimeUs,
            0
          )
        }
      }

      // Drain encoded output
      drainEncoder()
    } catch (e: Exception) {
      Log.e(TAG, "Error pushing frame", e)
    }
  }

  private fun drainEncoder() {
    val codec = mediaCodec ?: return
    val muxer = mediaMuxer ?: return

    while (true) {
      val outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, 0)
      when {
        outputBufferIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> return
        outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          if (muxerStarted) {
            Log.e(TAG, "Format changed after muxer started")
            return
          }
          val newFormat = codec.outputFormat
          videoTrackIndex = muxer.addTrack(newFormat)
          muxer.start()
          muxerStarted = true
        }
        outputBufferIndex >= 0 -> {
          val encodedBuffer = codec.getOutputBuffer(outputBufferIndex)
          if (encodedBuffer != null && muxerStarted && videoTrackIndex >= 0) {
            encodedBuffer.position(bufferInfo.offset)
            encodedBuffer.limit(bufferInfo.offset + bufferInfo.size)
            muxer.writeSampleData(videoTrackIndex, encodedBuffer, bufferInfo)
          }
          codec.releaseOutputBuffer(outputBufferIndex, false)
        }
        else -> return
      }
    }
  }

  private fun stopRecording(): String {
    if (!isRecordingFlag.get()) {
      throw Exception("NOT_RECORDING: No recording in progress")
    }

    // Send end-of-stream signal
    try {
      val inputBufferIndex = mediaCodec?.dequeueInputBuffer(10000) ?: -1
      if (inputBufferIndex >= 0) {
        mediaCodec?.queueInputBuffer(
          inputBufferIndex,
          0, 0,
          frameCount * 1_000_000L / targetFps,
          MediaCodec.BUFFER_FLAG_END_OF_STREAM
        )
      }

      // Drain remaining frames
      while (true) {
        val outputBufferIndex = mediaCodec?.dequeueOutputBuffer(bufferInfo, 10000) ?: -1
        if (outputBufferIndex == MediaCodec.INFO_TRY_AGAIN_LATER) break
        if (outputBufferIndex >= 0) {
          val encodedBuffer = mediaCodec?.getOutputBuffer(outputBufferIndex)
          if (encodedBuffer != null && muxerStarted && videoTrackIndex >= 0) {
            encodedBuffer.position(bufferInfo.offset)
            encodedBuffer.limit(bufferInfo.offset + bufferInfo.size)
            mediaMuxer?.writeSampleData(videoTrackIndex, encodedBuffer, bufferInfo)
          }
          mediaCodec?.releaseOutputBuffer(outputBufferIndex, false)
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error during stop", e)
    }

    val path = outputFile?.absolutePath ?: ""
    cleanup()
    Log.i(TAG, "Recording finished: $path")
    return path
  }

  private fun cancelRecording() {
    cleanup()
    outputFile?.let { if (it.exists()) it.delete() }
  }

  private fun cleanup() {
    isRecordingFlag.set(false)
    try {
      mediaCodec?.stop()
    } catch (e: Exception) { /* ignore */ }
    try {
      mediaCodec?.release()
    } catch (e: Exception) { /* ignore */ }
    try {
      if (muxerStarted) mediaMuxer?.stop()
    } catch (e: Exception) { /* ignore */ }
    try {
      mediaMuxer?.release()
    } catch (e: Exception) { /* ignore */ }
    mediaCodec = null
    mediaMuxer = null
    muxerStarted = false
    videoTrackIndex = -1
    frameCount = 0
  }
}
