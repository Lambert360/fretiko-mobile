import ExpoModulesCore
import AVFoundation
import Accelerate

/**
 * SkiaVideoRecorderModule
 *
 * Encodes a sequence of RGBA frames into an MP4 video file using AVAssetWriter.
 * Optionally records audio from the microphone via AVAudioEngine.
 *
 * Frames are pushed from JS via `pushFrame(pixels, width, height)` where
 * `pixels` is an ArrayBuffer of raw RGBA data (4 bytes per pixel).
 */
public class SkiaVideoRecorderModule: Module {
  private var writer: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var audioInput: AVAssetWriterInput?
  private var audioEngine: AVAudioEngine?
  private var audioConverter: AVAudioConverter?
  private var audioFile: AVAudioFile?
  private var isRecordingFlag = false
  private var outputURL: URL?
  private var videoSize = CGSize.zero
  private var targetFps: Int32 = 30
  private var frameCount: Int64 = 0
  private var recordingQueue = DispatchQueue(label: "skia.video.recorder", qos: .userInitiated)
  private var lastFrameTime: CMTime = .invalid
  private var sessionStartTime: CMTime = .invalid

  public func definition() -> ModuleDefinition {
    Name("SkiaVideoRecorder")

    AsyncFunction("startRecording") { (width: Int, height: Int, fps: Int, bitrate: Int, enableAudio: Bool) -> String in
      try self.startRecording(width: width, height: height, fps: fps, bitrate: bitrate, enableAudio: enableAudio)
    }

    Function("pushFrame") { (pixels: ArrayBuffer, width: Int, height: Int) in
      self.pushFrame(pixels: pixels, width: width, height: height)
    }

    AsyncFunction("stopRecording") { () -> String in
      try await self.stopRecording()
    }

    AsyncFunction("cancelRecording") { () -> Void in
      await self.cancelRecording()
    }

    Function("isRecording") { () -> Bool in
      return self.isRecordingFlag
    }
  }

  private func startRecording(width: Int, height: Int, fps: Int, bitrate: Int, enableAudio: Bool) throws -> String {
    if isRecordingFlag {
      throw Exception(name: "ALREADY_RECORDING", description: "Recording is already in progress")
    }

    let tempDir = FileManager.default.temporaryDirectory
    let fileName = "skia_video_\(Int(Date().timeIntervalSince1970)).mp4"
    let url = tempDir.appendingPathComponent(fileName)
    outputURL = url
    videoSize = CGSize(width: width, height: height)
    targetFps = Int32(fps)
    frameCount = 0

    // Remove existing file if any
    if FileManager.default.fileExists(atPath: url.path) {
      try FileManager.default.removeItem(at: url)
    }

    writer = try AVAssetWriter(outputURL: url, fileType: .mp4)

    // Video input settings
    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitrate,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoMaxKeyFrameIntervalKey: fps * 2,
      ]
    ]

    videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    videoInput!.expectsMediaDataInRealTime = true
    writer?.add(videoInput!)

    // Pixel buffer adaptor — use BGRA (most efficient for AVAssetWriter)
    let pixelBufferAttrs: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
      kCVPixelBufferIOSurfacePropertiesKey as String: [:] as [String: Any],
    ]
    pixelBufferAdaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: videoInput!,
      sourcePixelBufferAttributes: pixelBufferAttrs
    )

    // Audio input (optional)
    if enableAudio {
      let audioSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 44100,
        AVNumberOfChannelsKey: 2,
        AVEncoderBitRateKey: 128000,
      ]
      audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
      audioInput!.expectsMediaDataInRealTime = true
      writer?.add(audioInput!)
      startAudioCapture()
    }

    guard writer!.startWriting() else {
      throw Exception(name: "WRITER_START_FAILED", description: "Failed to start AVAssetWriter: \(writer!.error?.localizedDescription ?? "unknown")")
    }

    sessionStartTime = CMTime.zero
    writer!.startSession(atSourceTime: sessionStartTime)
    isRecordingFlag = true

    return url.path
  }

  private func pushFrame(pixels: ArrayBuffer, width: Int, height: Int) {
    guard isRecordingFlag, let videoInput = videoInput, let adaptor = pixelBufferAdaptor else { return }

    // Drop frame if encoder isn't ready
    if !videoInput.isReadyForMoreMediaData {
      return
    }

    recordingQueue.async {
      // Create a CVPixelBuffer from the RGBA data
      var pixelBuffer: CVPixelBuffer?
      let attrs: [String: Any] = [
        kCVPixelBufferIOSurfacePropertiesKey as String: [:] as [String: Any]
      ]
      let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        attrs as CFDictionary,
        &pixelBuffer
      )
      guard status == kCVReturnSuccess, let pb = pixelBuffer else { return }

      // Copy RGBA → BGRA (swap R and B channels) and write to pixel buffer
      CVPixelBufferLockBaseAddress(pb, [])
      defer { CVPixelBufferUnlockBaseAddress(pb, []) }

      guard let destBase = CVPixelBufferGetBaseAddress(pb) else { return }
      let destBytesPerRow = CVPixelBufferGetBytesPerRow(pb)
      let srcBytes = pixels.getBytes()
      let srcLength = srcBytes.count

      // RGBA → BGRA conversion (swap R and B for each pixel)
      let srcBytesPerRow = width * 4
      let heightInt = height
      srcBytes.withUnsafeBufferPointer { srcPtr in
        let srcBase = srcPtr.baseAddress!
        for row in 0..<heightInt {
          let srcRow = srcBase.advanced(by: row * srcBytesPerRow)
          let destRow = destBase.advanced(by: row * destBytesPerRow).assumingMemoryBound(to: UInt8.self)
          for col in 0..<width {
            let si = col * 4
            let di = col * 4
            // RGBA → BGRA
            destRow[di] = srcRow[si + 2]     // B = R
            destRow[di + 1] = srcRow[si + 1] // G = G
            destRow[di + 2] = srcRow[si]     // R = B
            destRow[di + 3] = srcRow[si + 3] // A = A
          }
        }
      }

      // Calculate timestamp
      let frameDuration = CMTime(value: 1, timescale: self.targetFps)
      let presentationTime = CMTime(value: self.frameCount, timescale: self.targetFps)
      self.frameCount += 1

      // Append the pixel buffer
      adaptor.append(pb, withPresentationTime: presentationTime)
    }
  }

  private func startAudioCapture() {
    #if !targetEnvironment(simulator)
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .default, options: [.allowBluetooth])
      try session.setActive(true)

      audioEngine = AVAudioEngine()
      let inputNode = audioEngine!.inputNode
      let recordingFormat = inputNode.outputFormat(forBus: 0)

      inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, time in
        guard let self = self, let audioInput = self.audioInput, audioInput.isReadyForMoreMediaData else { return }
        // Append audio buffer directly — AVAssetWriterInput accepts CMSampleBuffers
        if let sampleBuffer = self.createSampleBuffer(from: buffer, time: time) {
          audioInput.append(sampleBuffer)
        }
      }

      try audioEngine?.start()
    } catch {
      print("⚠️ SkiaVideoRecorder: Failed to start audio capture: \(error)")
    }
    #endif
  }

  private func createSampleBuffer(from buffer: AVAudioPCMBuffer, time: AVAudioTime) -> CMSampleBuffer? {
    var sampleBuffer: CMSampleBuffer?
    var formatDescription: CMAudioFormatDescription?

    CMAudioFormatDescriptionCreate(
      kCFAllocatorDefault,
      buffer.format.streamDescription,
      0, nil, 0, nil, nil,
      &formatDescription
    )

    var sampleBufferCreateError: OSStatus = noErr
    let numSamples = CMItemCount(buffer.frameLength)

    sampleBufferCreateError = CMSampleBufferCreate(
      kCFAllocatorDefault,
      buffer.mutableAudioBufferList.unsafePointer,
      false,
      nil,
      nil,
      formatDescription,
      numSamples,
      0,
      nil,
      0, nil,
      &sampleBuffer
    )

    if sampleBufferCreateError == noErr {
      if let sb = sampleBuffer {
        var timingInfo = CMSampleTimingInfo(
          duration: CMTime(value: 1, timescale: Int32(buffer.format.sampleRate)),
          presentationTimeStamp: time.sampleTime,
          decodeTimeStamp: .invalid
        )
        CMSampleBufferSetSampleTimings(sb, [timingInfo])
      }
    }

    return sampleBuffer
  }

  private func stopRecording() async throws -> String {
    guard isRecordingFlag else {
      throw Exception(name: "NOT_RECORDING", description: "No recording in progress")
    }

    isRecordingFlag = false

    // Stop audio
    audioEngine?.stop()
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine = nil

    // Finalize video
    return try await withCheckedThrowingContinuation { continuation in
      recordingQueue.async {
        self.videoInput?.markAsFinished()
        self.audioInput?.markAsFinished()
        self.writer?.finishWriting { [weak self] in
          guard let self = self else {
            continuation.resume(throwing: Exception(name: "FINISH_FAILED", description: "Self deallocated"))
            return
          }
          if let error = self.writer?.error {
            continuation.resume(throwing: Exception(name: "WRITE_ERROR", description: error.localizedDescription))
            return
          }
          let path = self.outputURL?.path ?? ""
          self.cleanup()
          continuation.resume(returning: path)
        }
      }
    }
  }

  private func cancelRecording() async {
    isRecordingFlag = false
    audioEngine?.stop()
    audioEngine?.inputNode.removeTap(onBus: 0)
    audioEngine = nil
    writer?.cancelWriting()
    if let url = outputURL, FileManager.default.fileExists(atPath: url.path) {
      try? FileManager.default.removeItem(at: url)
    }
    cleanup()
  }

  private func cleanup() {
    writer = nil
    videoInput = nil
    pixelBufferAdaptor = nil
    audioInput = nil
    outputURL = nil
    frameCount = 0
  }
}
