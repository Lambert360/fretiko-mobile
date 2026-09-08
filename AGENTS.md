# Fretiko Mobile — Project Guide

## Overview
React Native (Expo) app for the Fretiko marketplace with live streaming, auctions,
video calls, posts/stories, and real-time AR filters.

## Tech Stack
- **Framework:** Expo SDK 54, React Native 0.81.5, React 19
- **Navigation:** @react-navigation/stack + bottom-tabs
- **Real-time:** react-native-agora (live streams, auctions, video calls)
- **Camera/Filters:** react-native-vision-camera V5 + @shopify/react-native-skia
- **Face Detection:** vision-camera-face-detection (ML Kit, Nitro Modules)
- **Animations:** react-native-reanimated 4.3, react-native-worklets 0.8 (SWM), react-native-worklets-core 1.6 (legacy, used by face-detection)
- **Video Encoding:** modules/skia-video-recorder/ (native Expo module: AVAssetWriter iOS, MediaCodec Android)
- **Backend:** NestJS + Supabase (separate repo: fretiko-backend)

## Architecture
- **New Architecture:** Enabled (`newArchEnabled: true`)
- **Camera pipeline:** SkiaCamera (V5) with GPU-accelerated Skia shaders for real-time filters
- **Filter system:** `src/filters/` — filter catalog, shader code, face AR assets
- **Video recording:** `modules/skia-video-recorder/` — native encoder for filtered video capture
- **Agora frame pushing:** Pure JS via `AgoraFramePusher` — reads composited pixels from Skia canvas via `canvas.readPixels()` and pushes to Agora via `pushVideoFrame()`

## Build Commands
```bash
# Install dependencies (use --legacy-peer-deps for nitro-modules peer conflicts)
npm install --legacy-peer-deps

# Start dev server
npm start

# Build for iOS (requires New Architecture)
npx expo run:ios

# Build for Android (requires New Architecture)
npx expo run:android

# Regenerate native directories
npx expo prebuild --clean

# iOS pods (New Architecture)
# CocoaPods may not be in PATH — use Homebrew's portable Ruby if needed:
#   export PATH="/Users/isaacmark/.gem/ruby/4.0.0/bin:/usr/local/Homebrew/Library/Homebrew/vendor/portable-ruby/4.0.6/bin:$PATH"
#   export LANG=en_US.UTF-8
cd ios && RCT_NEW_ARCH_ENABLED=1 pod install
```

## Important Notes
- **patch-package:** `react-native-callkeep` has a patch in `patches/` for New Architecture
  compatibility (removes duplicate `@ReactMethod` annotations on Android).
- **VisionCamera V5:** Requires New Architecture. Uses Nitro Modules (not JSI).
- **Worklets:** Two worklets packages coexist — `react-native-worklets` (SWM, v0.8, for
  VisionCamera-Skia + Reanimated 4.3) and `react-native-worklets-core` (v1.6, legacy, for
  vision-camera-face-detection). Both are needed; do NOT remove either.
  Reanimated 4.3 + Worklets 0.8 are the latest versions compatible with RN 0.81.
  Do NOT upgrade to Reanimated 4.4+ or Worklets 0.9+ without upgrading RN to 0.83+ first.
- **SkiaCamera:** `takeSnapshot()` captures the filtered preview as an SkImage.
  This is how filters get "baked" into captured photos. AR overlays are also baked in
  since they're drawn on the Skia canvas before the snapshot.
- **Agora frame pushing:** `AgoraFramePusher` reads composited pixels from the Skia canvas
  via `canvas.readPixels()` (NOT the raw camera texture) and pushes via `pushRawFrame()`.
  This ensures livestream/auction viewers see the same filters/beauty/AR as the host.
- **Video recording:** `modules/skia-video-recorder/` is a native Expo module that encodes
  Skia-rendered frames into MP4 via AVAssetWriter (iOS) / MediaCodec (Android).
  Frames are pushed from the worklet via `runOnJS(pushRecordingFrame)()`.
  The module requires `package.json`, `expo-module.config.json`, and a `.podspec` file
  in the `ios/` subdirectory for Expo autolinking to discover it.
- **iOS deployment target:** 15.5 (required by ML Kit face detection via vision-camera-face-detection)

## Filter System Architecture
```
src/filters/
  types.ts              — Filter type definitions (ColorFilterParams, FaceAnchorPoint, etc.)
  filterCatalog.ts      — 18 color filter definitions
  FilterEngine.ts       — Core engine, shader compilation (4 shaders)
  AgoraFramePusher.ts   — Pure JS Agora frame pushing: pushRawFrame() + pushFrame()
  shaders/
    colorFilterShader.ts — 4 GLSL shaders: color, skin segment, beauty bilateral, face warp
  faceAR/
    faceARAssets.ts     — 10 SVG-based AR assets (dog ears, cat ears, crown, glasses, etc.)
    BeautyFilter.ts     — 12 beauty params + 6 presets (Natural, Smooth, Glam, Doll, Porcelain)
    FaceMeshRenderer.ts — SVG AR renderer (preloaded at module level, drawn in onFrame worklet)

modules/skia-video-recorder/  — Native Expo module for filtered video encoding
  src/SkiaVideoRecorder.ts    — JS API: startRecording, pushFrame, stopRecording
  ios/SkiaVideoRecorderModule.swift   — AVAssetWriter + pixel buffer adaptor
  android/.../SkiaVideoRecorderModule.kt — MediaCodec + MediaMuxer

src/components/
  FilterCameraView.tsx  — SkiaCamera with full pipeline: face warp → skin → beauty → color → AR
                          + Agora frame pushing (composited) + video recording (composited)
  FilterCarousel.tsx    — 3-mode selector: Color / Beauty / AR with long-press before/after
  FilterIntensitySlider.tsx — Filter strength adjustment
  BeautyFilterPanel.tsx — Bottom sheet with 12 PanResponder sliders (3 categories) + preset chips
  FaceAROverlay.tsx     — Maps ML Kit face landmarks (UPPER_CASE) to anchor points
  AvatarUpload.tsx      — Profile photo with "Camera with Filters" option
  BackgroundUpload.tsx  — Profile background with "Camera with Filters" option

src/contexts/
  FilterContext.tsx     — Global filter + beauty + AR state with AsyncStorage persistence

src/screens/
  FilterCameraScreen.tsx — Full-screen filter camera for posts/stories/profile/chat (photo + video)
  FilterEditorScreen.tsx — Apply filters to gallery images
  LiveStreamBroadcastScreen.tsx — Filter camera + Agora composited frame pushing
  AuctionLiveBroadcastScreen.tsx — Filter camera + Agora composited frame pushing
  CallScreen.tsx — Filter camera for local preview (filtered frames to Agora: future)
```

## Beauty Filter Pipeline
The real-time beauty pipeline runs on every camera frame in this order:
1. **Face detection** (ML Kit via `vision-camera-face-detection`) — detects face bounds + landmarks
   - Landmarks are UPPER_CASE: `face.landmarks.LEFT_EYE`, `.RIGHT_EYE`, `.NOSE_BASE`, `.MOUTH_BOTTOM`
   - Bounds are flat: `face.bounds.{x, y, width, height}`
   - Classifications: `smilingProbability`, `leftEyeOpenProbability`, `rightEyeOpenProbability`
   - Roll angle: `face.rollAngle` (used for AR asset rotation)
2. **Face warp** (GPU shader) — geometric reshape: slim face, enlarge eyes, slim nose, contour jaw
3. **Skin segmentation** (GPU shader) — YCbCr-based skin mask (industry-standard, not luminance)
4. **Beauty bilateral** (GPU shader) — edge-preserving smoothing + tone evening + glow + teeth whiten + lip color + cheek blush + under-eye brighten + detail sharpening
5. **Color filter** (GPU shader) — brightness, contrast, saturation, warmth, tint, vignette, grain, fade
6. **Face AR overlay** (Skia canvas) — SVG assets drawn at landmark positions via `canvas.drawSvg()`
   - SVGs are preloaded at module level via `Skia.SVG.MakeFromString()` (10 assets)
   - Anchor points: topHead, betweenEyes, nose, mouth, leftEye, rightEye
   - Scale/rotation computed from face bounds + roll angle

### Agora Frame Pushing (Pure JS — No Native Module)
- `AgoraFramePusher` reads composited RGBA pixels from the Skia canvas via `canvas.readPixels()`
  (AFTER all shader + AR processing, NOT the raw camera texture)
- Pushes to Agora via `engine.getMediaEngine().pushVideoFrame(ExternalVideoFrame)`
- Must call `setExternalVideoSource(true)` BEFORE `joinChannel()`
- Live streams & auctions: viewers see the same filters/beauty/AR as the host
- Video calls: filtered preview shown locally (remote sees normal camera — future update)

### Video Recording (Native Expo Module)
- `modules/skia-video-recorder/` encodes composited Skia frames into MP4
- iOS: AVAssetWriter + AVAssetWriterInputPixelBufferAdaptor (RGBA→BGRA conversion)
- Android: MediaCodec (H.264) + MediaMuxer
- Frames pushed from worklet via `runOnJS(pushRecordingFrame)()` at 30fps (every other frame at 60fps camera)
- Audio recorded via AVAudioEngine (iOS) — Android audio is a follow-up
- `FilterCameraViewRef.startRecording()` / `stopRecording()` / `cancelRecording()`

### Beauty Parameters (12 total)
- **Skin**: Smoothing (bilateral), Even Tone, Glow, Under-Eye Brighten
- **Reshape**: Slim Face, Big Eyes, Slim Nose, Jaw Line
- **Enhance**: Teeth Whiten, Lip Color, Cheek Blush, Sharpen

### Beauty Presets (6)
- None, Natural, Smooth, Glam, Doll, Porcelain

### Face AR Assets (10 SVG-based)
- Dog Ears, Cat Ears, Bunny Ears, Sunglasses, Heart Glasses, Crown, Flower Crown, Clown Nose, Mustache, Sparkles
- All rendered via `Skia.SVG.MakeFromString()` + `canvas.drawSvg()` — no PNG files needed

### State Persistence
Filter + beauty + AR preferences are saved to AsyncStorage via `FilterContext`.
Users set their preferences once and they persist across posts, stories, live streams, and calls.

### Filter Availability Across App
- Posts & Stories: FilterCameraScreen with full 3-mode carousel (photo + video recording)
- Profile avatar: "Camera with Filters" option in AvatarUpload
- Profile background: "Camera with Filters" option in BackgroundUpload
- Post creation modal: "Camera" (photo) + "Record" (video) options in CreatePostScreen
- Story upload: "Camera (Filters)" (photo) + "Record Video (Filters)" (video) options
- Live streams: Filter camera + Agora composited frame pushing (viewers see filters)
- Auctions: Filter camera + Agora composited frame pushing (viewers see filters)
- Video calls: Filter camera for local preview (remote sees normal camera — future)

## Verification
- After any change to native modules: `npx expo prebuild --clean` then rebuild
- After adding `modules/skia-video-recorder/`: must run `npx expo prebuild --clean` to link the new Expo module
- After filter shader changes: test on both iOS and Android (GPU behavior differs)
- After callkeep updates: verify the patch still applies (`npx patch-package`)
- TypeScript check: `npx tsc --noEmit --skipLibCheck`
- After AR overlay changes: verify SVGs render on face landmarks (front + back camera)
- After Agora push changes: verify viewers see filtered video (not raw) on a second device
- After video recording changes: verify recorded MP4 contains filters/beauty/AR baked in
