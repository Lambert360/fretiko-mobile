/**
 * FilterCameraView
 *
 * State-of-the-art real-time camera filter pipeline:
 * 1. Face detection (ML Kit via vision-camera-face-detection)
 * 2. Face warp (geometric reshape: slim, eye enlarge, nose, jaw)
 * 3. Skin segmentation (YCbCr-based skin mask)
 * 4. Beauty bilateral (smoothing, tone, glow, teeth, lips, blush, under-eye)
 * 5. Color filter (brightness, contrast, saturation, warmth, etc.)
 *
 * Uses VisionCamera V5's SkiaCamera with GPU shaders via Skia.
 * All processing happens on the GPU render thread for 60fps performance.
 *
 * Can optionally push filtered frames to Agora for live streaming/calls
 * via the AgoraFramePusher (pure JS, no native module needed).
 *
 * Used across all surfaces:
 * - Posts & Stories (capture filtered photos/videos)
 * - Live streams & Auctions (host preview + Agora frame pushing)
 * - Video calls (local preview + Agora frame pushing)
 * - Profile photos, chat camera, product uploads
 */

import React, { useRef, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import { SkiaCamera, SkiaCameraRef } from 'react-native-vision-camera-skia';
import {
  Skia,
  TileMode,
  FilterMode,
  MipmapMode,
  ImageFormat,
  ColorType,
  AlphaType,
} from '@shopify/react-native-skia';

// On Android with broken GPU/EGL (Mediatek), RuntimeEffect shaders crash
// (SIGTRAP in makeNonTextureImage). Use ColorFilter API instead.
const _useColorFilter = Platform.OS === 'android';
import type { SkImage } from '@shopify/react-native-skia';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useFaceScannerOutput } from 'vision-camera-face-detection';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import {
  COLOR_FILTER_SHADER,
  SKIN_SEGMENT_SHADER,
  BEAUTY_BILATERAL_SHADER,
  FACE_WARP_SHADER,
} from '../filters/shaders/colorFilterShader';
import { getFilterById } from '../filters/filterCatalog';
import { DEFAULT_COLOR_PARAMS, ColorFilterParams } from '../filters/types';
import {
  BeautyParams,
  DEFAULT_BEAUTY_PARAMS,
  isBeautyActive,
} from '../filters/faceAR/BeautyFilter';
import { agoraFramePusher } from '../filters/AgoraFramePusher';
import type { IRtcEngine } from 'react-native-agora';
import { SVG_FACE_AR_ASSETS, SVGAsset, AR_FIT } from '../filters/faceAR/faceARAssets';
import { computeARPlacement, sanitizeFaceGeom, sortEyes } from '../filters/faceAR/arPlacement';
import { SkiaVideoRecorder } from '../../modules/skia-video-recorder';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Compile all shaders once at module level (JS thread)
const colorFilterEffect = Skia.RuntimeEffect.Make(COLOR_FILTER_SHADER);
const skinSegmentEffect = Skia.RuntimeEffect.Make(SKIN_SEGMENT_SHADER);
const beautyBilateralEffect = Skia.RuntimeEffect.Make(BEAUTY_BILATERAL_SHADER);
const faceWarpEffect = Skia.RuntimeEffect.Make(FACE_WARP_SHADER);

if (!colorFilterEffect) console.error('❌ Color filter shader failed to compile');
if (!skinSegmentEffect) console.error('❌ Skin segment shader failed to compile');
if (!beautyBilateralEffect) console.error('❌ Beauty bilateral shader failed to compile');
if (!faceWarpEffect) console.error('❌ Face warp shader failed to compile');

// JS-thread error logger for worklet render errors
let _lastRenderError = 0;
function logRenderError(msg: string) {
  const now = Date.now();
  // Throttle: only log once per 5 seconds to avoid spam
  if (now - _lastRenderError > 5000) {
    _lastRenderError = now;
    console.error('❌ Render error:', msg);
  }
}

// Preload all SVG-based face AR assets at module level (JS thread).
// Skia SVG objects are native HybridObjects that are safe to reference
// from worklet threads, just like the RuntimeEffect shaders above.
type SkSVG = NonNullable<ReturnType<typeof Skia.SVG.MakeFromString>>;
const PRELOADED_SVGS: Record<string, SkSVG> = {};
const SVG_ASSET_MAP: Record<string, SVGAsset> = {};
for (const asset of SVG_FACE_AR_ASSETS) {
  const svg = Skia.SVG.MakeFromString(asset.svg);
  if (svg) {
    PRELOADED_SVGS[asset.id] = svg;
    SVG_ASSET_MAP[asset.id] = asset;
  } else {
    console.error(`❌ Failed to preload SVG asset: ${asset.id}`);
  }
}

export interface FilterCameraViewRef {
  takeSnapshot: () => string | null;
  getCamera: () => SkiaCameraRef | null;
  setFilter: (filterId: string, intensity?: number) => void;
  setIntensity: (intensity: number) => void;
  setBeautyParams: (params: BeautyParams) => void;
  setBeautyPreset: (presetId: string, params: BeautyParams) => void;
  resetBeauty: () => void;
  setARAsset: (assetId: string | null) => void;
  startRecording: (options?: RecordingOptions) => Promise<string>;
  stopRecording: () => Promise<string>;
  cancelRecording: () => Promise<void>;
  isRecording: () => boolean;
  startAgoraPushing: (engine: IRtcEngine, useCustomTrack?: boolean) => Promise<boolean>;
  stopAgoraPushing: () => void;
}

export interface RecordingOptions {
  fps?: number;
  bitrate?: number;
  enableAudio?: boolean;
}

export interface FilterCameraViewProps {
  device?: 'front' | 'back';
  isActive?: boolean;
  initialFilterId?: string;
  initialIntensity?: number;
  initialBeautyParams?: BeautyParams;
  initialARAssetId?: string | null;
  agoraEngine?: IRtcEngine | null;
  enableAgoraPushing?: boolean;
  style?: any;
}

const FilterCameraView = forwardRef<FilterCameraViewRef, FilterCameraViewProps>(
  (
    {
      device: deviceProp = 'front',
      isActive = true,
      initialFilterId = 'none',
      initialIntensity = 100,
      initialBeautyParams,
      initialARAssetId = null,
      agoraEngine = null,
      enableAgoraPushing = false,
      style,
    },
    ref
  ) => {
    const cameraRef = useRef<SkiaCameraRef>(null);
    const { hasPermission, requestPermission } = useCameraPermission();
    const cameraDevice = useCameraDevice(deviceProp);

    // === Color filter shared values (worklet thread) ===
    const filterId = useSharedValue(initialFilterId);
    const intensity = useSharedValue(initialIntensity / 100);
    const sBrightness = useSharedValue(0);
    const sContrast = useSharedValue(0);
    const sSaturation = useSharedValue(0);
    const sWarmth = useSharedValue(0);
    const sTint = useSharedValue(0);
    const sVignette = useSharedValue(0);
    const sGrain = useSharedValue(0);
    const sFade = useSharedValue(0);

    // === Beauty shared values (worklet thread) ===
    const bSkinSmoothing = useSharedValue(initialBeautyParams?.skinSmoothing ?? 0);
    const bSkinTone = useSharedValue(initialBeautyParams?.skinTone ?? 0);
    const bGlow = useSharedValue(initialBeautyParams?.glow ?? 0);
    const bUnderEye = useSharedValue(initialBeautyParams?.underEyeBrighten ?? 0);
    const bFaceSlim = useSharedValue(initialBeautyParams?.faceSlimming ?? 0);
    const bEyeEnlarge = useSharedValue(initialBeautyParams?.eyeEnlargement ?? 0);
    const bNoseSlim = useSharedValue(initialBeautyParams?.noseSlimming ?? 0);
    const bJawSharpen = useSharedValue(initialBeautyParams?.jawSharpening ?? 0);
    const bTeethWhiten = useSharedValue(initialBeautyParams?.teethWhitening ?? 0);
    const bLipColor = useSharedValue(initialBeautyParams?.lipColor ?? 0);
    const bCheekBlush = useSharedValue(initialBeautyParams?.cheekBlush ?? 0);
    const bSharpening = useSharedValue(initialBeautyParams?.sharpening ?? 0);

    // === Face detection shared values ===
    // ML Kit landmark positions (updated by face detection callback)
    // These use the ACTUAL ML Kit field names: LEFT_EYE, RIGHT_EYE, NOSE_BASE, etc.
    const faceLeftEyeX = useSharedValue(0);
    const faceLeftEyeY = useSharedValue(0);
    const faceRightEyeX = useSharedValue(0);
    const faceRightEyeY = useSharedValue(0);
    const faceNoseX = useSharedValue(0);
    const faceNoseY = useSharedValue(0);
    const faceMouthX = useSharedValue(0);
    const faceMouthY = useSharedValue(0);
    const faceCenterX = useSharedValue(0);
    const faceCenterY = useSharedValue(0);
    const faceW = useSharedValue(0);
    const faceH = useSharedValue(0);
    const hasFace = useSharedValue(false);

    // === Face AR shared values ===
    const arAssetId = useSharedValue(initialARAssetId);
    const faceRollAngle = useSharedValue(0);

    // === Coordinate scale (ML Kit window space → upright canvas space) ===
    // autoMode=true returns face coords in window units (screenWidth x screenHeight).
    // The camera preview is drawn cover-fit into the view, so the frame is cropped
    // to fill the screen. We compute the cover-fit scale + crop offset so face
    // coords map exactly onto the rendered canvas.
    const faceInvScale = useSharedValue(1);
    const faceCropX = useSharedValue(0);
    const faceCropY = useSharedValue(0);

    // Debug: throttle face logs so logcat isn't flooded
    const faceLogCounter = useSharedValue(0);

    // === Video recording shared values ===
    const isRecording = useSharedValue(false);
    const recordFrameSkip = useSharedValue(0); // for fps throttling

    // Agora pushing state
    const agoraEnabled = useSharedValue(enableAgoraPushing);

    // Request permission on mount
    useEffect(() => {
      if (!hasPermission) {
        requestPermission();
      }
    }, [hasPermission, requestPermission]);

    // Start Agora pushing if engine is provided
    useEffect(() => {
      if (enableAgoraPushing && agoraEngine) {
        agoraFramePusher.start(agoraEngine).then((ok) => {
          agoraEnabled.value = ok;
        });
      }
      return () => {
        if (enableAgoraPushing) {
          agoraFramePusher.stop();
          agoraEnabled.value = false;
        }
      };
    }, [enableAgoraPushing, agoraEngine]);

    // Update color filter params when filter changes
    const updateFilterParams = useCallback(
      (id: string) => {
        const filterDef = getFilterById(id);
        if (!filterDef) return;

        const params: ColorFilterParams = {
          ...DEFAULT_COLOR_PARAMS,
          ...filterDef.params,
        };

        sBrightness.value = params.brightness;
        sContrast.value = params.contrast;
        sSaturation.value = params.saturation;
        sWarmth.value = params.warmth;
        sTint.value = params.tint;
        sVignette.value = params.vignette;
        sGrain.value = params.grain;
        sFade.value = params.fade;
      },
      [sBrightness, sContrast, sSaturation, sWarmth, sTint, sVignette, sGrain, sFade]
    );

    // Set initial filter — keep shared values in sync when the prop changes
    // (e.g. persisted state loading from AsyncStorage after mount)
    useEffect(() => {
      filterId.value = initialFilterId;
      intensity.value = initialIntensity / 100;
      updateFilterParams(initialFilterId);
    }, [initialFilterId, initialIntensity, filterId, intensity, updateFilterParams]);

    // Sync AR asset when prop changes
    useEffect(() => {
      arAssetId.value = initialARAssetId;
    }, [initialARAssetId, arAssetId]);

    const setFilter = useCallback(
      (id: string, newIntensity?: number) => {
        filterId.value = id;
        if (newIntensity !== undefined) {
          intensity.value = newIntensity / 100;
        }
        updateFilterParams(id);
      },
      [filterId, intensity, updateFilterParams]
    );

    const setIntensityValue = useCallback(
      (value: number) => {
        intensity.value = Math.max(0, Math.min(100, value)) / 100;
      },
      [intensity]
    );

    const setBeautyParamsValues = useCallback(
      (params: BeautyParams) => {
        bSkinSmoothing.value = params.skinSmoothing;
        bSkinTone.value = params.skinTone;
        bGlow.value = params.glow;
        bUnderEye.value = params.underEyeBrighten;
        bFaceSlim.value = params.faceSlimming;
        bEyeEnlarge.value = params.eyeEnlargement;
        bNoseSlim.value = params.noseSlimming;
        bJawSharpen.value = params.jawSharpening;
        bTeethWhiten.value = params.teethWhitening;
        bLipColor.value = params.lipColor;
        bCheekBlush.value = params.cheekBlush;
        bSharpening.value = params.sharpening;
      },
      [
        bSkinSmoothing, bSkinTone, bGlow, bUnderEye,
        bFaceSlim, bEyeEnlarge, bNoseSlim, bJawSharpen,
        bTeethWhiten, bLipColor, bCheekBlush, bSharpening,
      ]
    );

    const resetBeautyValues = useCallback(() => {
      bSkinSmoothing.value = 0;
      bSkinTone.value = 0;
      bGlow.value = 0;
      bUnderEye.value = 0;
      bFaceSlim.value = 0;
      bEyeEnlarge.value = 0;
      bNoseSlim.value = 0;
      bJawSharpen.value = 0;
      bTeethWhiten.value = 0;
      bLipColor.value = 0;
      bCheekBlush.value = 0;
      bSharpening.value = 0;
    }, [
      bSkinSmoothing, bSkinTone, bGlow, bUnderEye,
      bFaceSlim, bEyeEnlarge, bNoseSlim, bJawSharpen,
      bTeethWhiten, bLipColor, bCheekBlush, bSharpening,
    ]);

    // takeSnapshot is SYNCHRONOUS — returns SkImage | undefined
    // We encode to base64 for easy use in the app
    const takeSnapshot = useCallback((): string | null => {
      if (!cameraRef.current) return null;
      try {
        const snapshot = cameraRef.current.takeSnapshot();
        if (!snapshot) return null;

        const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 90);
        return `data:image/jpeg;base64,${base64}`;
      } catch (error) {
        console.error('❌ Error taking filtered snapshot:', error);
        return null;
      }
    }, []);

    const startAgoraPushing = useCallback(
      async (engine: IRtcEngine, useCustomTrack = false): Promise<boolean> => {
        const ok = await agoraFramePusher.start(engine, useCustomTrack);
        agoraEnabled.value = ok;
        return ok;
      },
      [agoraEnabled]
    );

    const stopAgoraPushing = useCallback(() => {
      agoraFramePusher.stop();
      agoraEnabled.value = false;
    }, [agoraEnabled]);

    const setARAssetValue = useCallback(
      (assetId: string | null) => {
        arAssetId.value = assetId;
      },
      [arAssetId]
    );

    // === Video recording ===
    // JS-thread function that pushes a frame to the native encoder.
    // Called from the worklet via runOnJS.
    const pushRecordingFrame = useCallback(
      (pixels: Uint8Array, width: number, height: number) => {
        try {
          // Convert Uint8Array to ArrayBuffer for the native module
          const buffer = pixels.buffer.slice(
            pixels.byteOffset,
            pixels.byteOffset + pixels.byteLength
          ) as ArrayBuffer;
          SkiaVideoRecorder.pushFrame(buffer, width, height);
        } catch (error) {
          console.error('❌ Error pushing recording frame:', error);
        }
      },
      []
    );

    const startRecordingFn = useCallback(
      async (options?: RecordingOptions): Promise<string> => {
        if (isRecording.value) {
          throw new Error('Already recording');
        }
        const fps = options?.fps ?? 30;
        const bitrate = options?.bitrate ?? 4_000_000;
        const enableAudio = options?.enableAudio ?? true;

        // Use the camera frame dimensions for recording
        // We'll get actual dimensions from the first frame
        const width = screenWidth;
        const height = screenHeight;

        const path = await SkiaVideoRecorder.startRecording(
          Math.round(width),
          Math.round(height),
          fps,
          bitrate,
          enableAudio
        );
        isRecording.value = true;
        recordFrameSkip.value = 0;
        return path;
      },
      [isRecording, recordFrameSkip]
    );

    const stopRecordingFn = useCallback(async (): Promise<string> => {
      if (!isRecording.value) {
        throw new Error('Not recording');
      }
      isRecording.value = false;
      const path = await SkiaVideoRecorder.stopRecording();
      return path;
    }, [isRecording]);

    const cancelRecordingFn = useCallback(async (): Promise<void> => {
      isRecording.value = false;
      await SkiaVideoRecorder.cancelRecording();
    }, [isRecording]);

    const isRecordingFn = useCallback((): boolean => {
      return isRecording.value;
    }, [isRecording]);

    useImperativeHandle(ref, () => ({
      takeSnapshot,
      getCamera: () => cameraRef.current,
      setFilter,
      setIntensity: setIntensityValue,
      setBeautyParams: setBeautyParamsValues,
      setBeautyPreset: (_presetId: string, params: BeautyParams) => setBeautyParamsValues(params),
      resetBeauty: resetBeautyValues,
      setARAsset: setARAssetValue,
      startRecording: startRecordingFn,
      stopRecording: stopRecordingFn,
      cancelRecording: cancelRecordingFn,
      isRecording: isRecordingFn,
      startAgoraPushing,
      stopAgoraPushing,
    }));

    // Face detection via ML Kit — always enable (needed for beauty warp + AR)
    // MUST be called before any conditional early return to avoid hooks violation
    const faceScannerOutput = useFaceScannerOutput({
      performanceMode: 'fast',
      runLandmarks: true,
      runContours: false,
      runClassifications: true,
      minFaceSize: 0.15,
      trackingEnabled: true,
      cameraFacing: deviceProp,
      outputResolution: 'preview',
      // autoMode: ML Kit transforms coordinates to screen space (handles rotation + mirror)
      autoMode: true,
      windowWidth: screenWidth,
      windowHeight: screenHeight,
      onFaceScanned: (faces: any[]) => {
        'worklet';
        if (faces && faces.length > 0) {
          const f = faces[0];
          hasFace.value = true;

          // autoMode returns coords in window space. Convert to canvas space
          // by undoing the cover-fit crop: canvasCoord = (windowCoord + crop) / fitScale
          const invScale = faceInvScale.value;
          const cropX = faceCropX.value;
          const cropY = faceCropY.value;

          // Temporal smoothing — exponential lerp keeps AR glued to the face
          // instead of jittering per-detection (standard AR practice).
          const ALPHA = 0.45;
          const lerp = (sv: { value: number }, target: number) => {
            sv.value = sv.value + (target - sv.value) * ALPHA;
          };

          // Bounds — flat structure: { x, y, width, height }
          const bounds = f.bounds;
          lerp(faceW, bounds.width * invScale);
          lerp(faceH, bounds.height * invScale);
          lerp(faceCenterX, (bounds.x + bounds.width / 2 + cropX) * invScale);
          lerp(faceCenterY, (bounds.y + bounds.height / 2 + cropY) * invScale);

          // Roll angle for AR asset rotation
          lerp(faceRollAngle, f.rollAngle || 0);

          // Landmarks — UPPER_CASE field names, each is { x, y }
          const lm = f.landmarks;
          if (lm) {
            if (lm.LEFT_EYE) {
              lerp(faceLeftEyeX, (lm.LEFT_EYE.x + cropX) * invScale);
              lerp(faceLeftEyeY, (lm.LEFT_EYE.y + cropY) * invScale);
            }
            if (lm.RIGHT_EYE) {
              lerp(faceRightEyeX, (lm.RIGHT_EYE.x + cropX) * invScale);
              lerp(faceRightEyeY, (lm.RIGHT_EYE.y + cropY) * invScale);
            }
            if (lm.NOSE_BASE) {
              lerp(faceNoseX, (lm.NOSE_BASE.x + cropX) * invScale);
              lerp(faceNoseY, (lm.NOSE_BASE.y + cropY) * invScale);
            }
            if (lm.MOUTH_BOTTOM) {
              lerp(faceMouthX, (lm.MOUTH_BOTTOM.x + cropX) * invScale);
              lerp(faceMouthY, (lm.MOUTH_BOTTOM.y + cropY) * invScale);
            } else if (lm.MOUTH_LEFT) {
              lerp(faceMouthX, (lm.MOUTH_LEFT.x + cropX) * invScale);
              lerp(faceMouthY, (lm.MOUTH_LEFT.y + cropY) * invScale);
            }
          }

          // Debug: log first detected face coords every ~90 scans (~3s)
          faceLogCounter.value += 1;
          if (faceLogCounter.value % 90 === 1) {
            console.log(
              `FACE@${faceLogCounter.value}: bounds=(${bounds.x.toFixed(0)},${bounds.y.toFixed(0)},${bounds.width.toFixed(0)}x${bounds.height.toFixed(0)}) ` +
              `canvas=(${faceCenterX.value.toFixed(0)},${faceCenterY.value.toFixed(0)}) ` +
              `roll=${faceRollAngle.value.toFixed(1)} lm=${lm ? 'Y' : 'N'}`
            );
          }
        } else {
          hasFace.value = false;
        }
      },
      onError: (error: Error) => {
        console.error('Face scanner error:', error);
      },
    });

    if (!hasPermission || !cameraDevice) {
      return <View style={[styles.container, style]} />;
    }

    return (
      <View style={[styles.container, style]}>
        <SkiaCamera
          ref={cameraRef}
          style={styles.camera}
          device={cameraDevice}
          isActive={isActive}
          pixelFormat="rgb"
          outputs={[faceScannerOutput]}
          onError={(error: Error) => {
            console.error('📷 SkiaCamera onError:', error);
          }}
          onFrame={(frame, render) => {
            'worklet';

            const w = frame.width;
            const h = frame.height;

            // ML Kit autoMode returns coords in window space (screenW x screenH).
            // The canvas is canvasW x canvasH (frame dims), displayed cover-fit:
            //   fitScale = max(screenW/canvasW, screenH/canvasH)
            //   displayedSize = canvasW*fitScale x canvasH*fitScale (>= screen)
            //   crop = (displayedSize - screen) / 2  (in window units)
            // canvasCoord = (windowCoord + crop) / fitScale
            const isLandscape = frame.orientation === 'left' || frame.orientation === 'right';
            const canvasW = isLandscape ? h : w;
            const canvasH = isLandscape ? w : h;
            const fitScale = Math.max(screenWidth / canvasW, screenHeight / canvasH);
            faceInvScale.value = 1 / fitScale;
            faceCropX.value = (canvasW * fitScale - screenWidth) / 2;
            faceCropY.value = (canvasH * fitScale - screenHeight) / 2;

            try {
            render(({ canvas, frameTexture }) => {
              // Check what's active
              const colorActive = filterId.value !== 'none' && intensity.value > 0;
              const beautyActiveNow =
                bSkinSmoothing.value > 0 || bSkinTone.value > 0 || bGlow.value > 0 ||
                bUnderEye.value > 0 || bTeethWhiten.value > 0 || bLipColor.value > 0 ||
                bCheekBlush.value > 0 || bSharpening.value > 0;
              const warpActiveNow =
                bFaceSlim.value > 0 || bEyeEnlarge.value > 0 || bNoseSlim.value > 0 || bJawSharpen.value > 0;
              const arActiveNow =
                arAssetId.value !== null && arAssetId.value !== 'none' &&
                hasFace.value && faceW.value > 0;

              // If nothing is active, render as-is
              if (!colorActive && !beautyActiveNow && !warpActiveNow && !arActiveNow) {
                canvas.drawImage(frameTexture, 0, 0);

                // Push composited frame to Agora and/or recorder if enabled
                const needsPixelsEarly = agoraEnabled.value || isRecording.value;
                if (needsPixelsEarly) {
                  const pixels = canvas.readPixels(0, 0, {
                    width: w,
                    height: h,
                    colorType: ColorType.RGBA_8888,
                    alphaType: AlphaType.Premul,
                  });
                  if (pixels) {
                    const buf = pixels instanceof Uint8Array
                      ? pixels
                      : new Uint8Array(pixels.length).map((_, i) => Math.round(pixels[i] * 255));
                    if (agoraEnabled.value) {
                      agoraFramePusher.pushRawFrame(buf, w, h);
                    }
                    if (isRecording.value) {
                      recordFrameSkip.value = (recordFrameSkip.value + 1) % 2;
                      if (recordFrameSkip.value === 0) {
                        runOnJS(pushRecordingFrame)(buf, w, h);
                      }
                    }
                  }
                }
                return;
              }

              if (_useColorFilter) {
                // === ANDROID CPU PATH: Use ColorFilter (no RuntimeEffect shaders) ===
                // Beauty/warp shaders require GPU and crash on broken EGL devices.
                // Apply color filters + beauty via Skia ColorFilter API (CPU-safe).
                if (colorActive || beautyActiveNow) {
                  // Color filter params
                  const i = colorActive ? intensity.value : 0;
                  const b = sBrightness.value * i;
                  const c = sContrast.value * i;
                  const s = sSaturation.value * i;
                  const wWarm = sWarmth.value * i * 0.15;
                  const t = sTint.value * i * 0.1;
                  const f = sFade.value * i;

                  // Beauty params (ColorMatrix approximation)
                  // Skin smoothing can't be done with ColorMatrix, but we can do:
                  // - Skin tone evening (reduce redness, even out)
                  // - Glow (brightness lift)
                  // - Sharpening (contrast boost)
                  const bSkin = bSkinSmoothing.value;
                  const bTone = bSkinTone.value;
                  const bGlowVal = bGlow.value;
                  const bSharpen = bSharpening.value;

                  // Combined adjustments
                  const totalBright = b + bGlowVal * 0.1 + bSkin * 0.05;
                  const totalContrast = c + bSharpen * 0.3;
                  const totalSat = s - bTone * 0.15; // tone evening reduces saturation slightly
                  const skinWarm = wWarm + bTone * 0.05;

                  // Saturation matrix needs an absolute factor where 1 = identity,
                  // 0 = grayscale. totalSat is a delta (0 = neutral) → satM = 1 + totalSat.
                  const satM = Math.max(0, 1 + totalSat);
                  const rDiag = 0.299 + 0.701 * satM;
                  const gOff = 0.587 * (1 - satM);
                  const bOff = 0.114 * (1 - satM);
                  const rOff = 0.299 * (1 - satM);
                  const gDiag = 0.587 + 0.413 * satM;
                  const bDiag = 0.114 + 0.886 * satM;
                  // Contrast: scale around 0.5
                  const cf = 1 + totalContrast;
                  // Fade: reduce contrast, lift blacks
                  const ff = 1 - 0.15 * f;
                  const ft = 0.15 * f;

                  const matrix = [
                    rDiag * cf * ff, gOff * cf * ff,  bOff * cf * ff, 0, (totalBright + skinWarm + t * 0.5 - 0.5 * totalContrast) * ff + ft,
                    rOff * cf * ff,  gDiag * cf * ff, bOff * cf * ff, 0, (totalBright - t - 0.5 * totalContrast) * ff + ft,
                    rOff * cf * ff,  gOff * cf * ff,  bDiag * cf * ff, 0, (totalBright - skinWarm + t * 0.5 - 0.5 * totalContrast) * ff + ft,
                    0,              0,               0,               1, 0,
                  ];

                  const paint = Skia.Paint();
                  try {
                    const cfVal = Skia.ColorFilter.MakeMatrix(matrix);
                    if (cfVal) {
                      paint.setColorFilter(cfVal);
                      canvas.drawImage(frameTexture, 0, 0, paint);
                    } else {
                      canvas.drawImage(frameTexture, 0, 0);
                    }
                  } catch {
                    canvas.drawImage(frameTexture, 0, 0);
                  }
                } else {
                  canvas.drawImage(frameTexture, 0, 0);
                }
              } else {
                // === iOS GPU PATH: Use RuntimeEffect shaders ===
                // Create the base image shader from camera frame texture
                const imageShader = frameTexture.makeShaderOptions(
                  TileMode.Clamp,
                  TileMode.Clamp,
                  FilterMode.Linear,
                  MipmapMode.None
                );

                // Pipeline: start with the original frame shader
                let currentShader = imageShader;

                // === STEP 1: FACE WARP (geometric reshape) ===
                if (warpActiveNow && faceWarpEffect && hasFace.value && faceW.value > 0) {
                  const warpShader = faceWarpEffect.makeShaderWithChildren(
                    [
                      faceLeftEyeX.value, faceLeftEyeY.value,
                      faceRightEyeX.value, faceRightEyeY.value,
                      faceNoseX.value, faceNoseY.value,
                      faceMouthX.value, faceMouthY.value,
                      faceCenterX.value, faceCenterY.value,
                      faceW.value, faceH.value,
                      bFaceSlim.value,
                      bEyeEnlarge.value,
                      bNoseSlim.value,
                      bJawSharpen.value,
                      w, h,
                    ],
                    [currentShader]
                  );
                  if (warpShader) {
                    currentShader = warpShader;
                  }
                }

                // === STEP 2: SKIN SEGMENTATION ===
                let skinMaskShader: any = null;
                if (beautyActiveNow && skinSegmentEffect) {
                  skinMaskShader = skinSegmentEffect.makeShaderWithChildren(
                    [0.5],
                    [currentShader]
                  );
                }

                // === STEP 3: BEAUTY BILATERAL (smoothing, tone, glow, etc.) ===
                if (beautyActiveNow && beautyBilateralEffect && skinMaskShader) {
                  const beautyShader = beautyBilateralEffect.makeShaderWithChildren(
                    [
                      bSkinSmoothing.value,
                      bSharpening.value,
                      bSkinTone.value,
                      bGlow.value,
                      bTeethWhiten.value,
                      bLipColor.value,
                      bCheekBlush.value,
                      bUnderEye.value,
                      w, h,
                    ],
                    [currentShader, skinMaskShader]
                  );
                  if (beautyShader) {
                    currentShader = beautyShader;
                  }
                }

                // === STEP 4: COLOR FILTER ===
                if (colorActive && colorFilterEffect) {
                  const filterShaderResult = colorFilterEffect.makeShaderWithChildren(
                    [
                      intensity.value,
                      sBrightness.value,
                      sContrast.value,
                      sSaturation.value,
                      sWarmth.value,
                      sTint.value,
                      sVignette.value,
                      sGrain.value,
                      sFade.value,
                      w, h,
                    ],
                    [currentShader]
                  );
                  if (filterShaderResult) {
                    currentShader = filterShaderResult;
                  }
                }

                // === RENDER (shaders) ===
                if (colorActive || beautyActiveNow || warpActiveNow) {
                  const paint = Skia.Paint();
                  paint.setShader(currentShader);
                  canvas.drawImage(frameTexture, 0, 0, paint);
                } else {
                  canvas.drawImage(frameTexture, 0, 0);
                }
              }

              // === STEP 5: FACE AR OVERLAY (SVG assets on top) ===
              if (arActiveNow) {
                const arId = arAssetId.value as string;
                const svg = PRELOADED_SVGS[arId];
                const asset = SVG_ASSET_MAP[arId];
                const fit = AR_FIT[arId];
                if (svg && asset && fit) {
                  // Similarity registration: map the SVG's reference points
                  // onto the detected face geometry (eyes / head-top / landmark).
                  const { leftEye, rightEye } = sortEyes(
                    { x: faceLeftEyeX.value, y: faceLeftEyeY.value },
                    { x: faceRightEyeX.value, y: faceRightEyeY.value }
                  );
                  const geom = sanitizeFaceGeom(
                    {
                      leftEye,
                      rightEye,
                      nose:
                        faceNoseX.value > 0
                          ? { x: faceNoseX.value, y: faceNoseY.value }
                          : undefined,
                      mouth:
                        faceMouthX.value > 0
                          ? { x: faceMouthX.value, y: faceMouthY.value }
                          : undefined,
                      faceCenter: { x: faceCenterX.value, y: faceCenterY.value },
                    },
                    {
                      x: faceCenterX.value - faceW.value / 2,
                      y: faceCenterY.value - faceH.value / 2,
                      width: faceW.value,
                      height: faceH.value,
                    }
                  );
                  const placement = computeARPlacement(fit, geom, svg.width());
                  if (placement) {
                    // The canvas already carries the frame-orientation transform
                    // (rotate + mirror) applied by renderToTexture. Our coords are
                    // in upright display space, so invert that transform first —
                    // otherwise AR is double-rotated/mirrored off-canvas.
                    const rotDeg =
                      frame.orientation === 'right' ? 90 :
                      frame.orientation === 'down' ? 180 :
                      frame.orientation === 'left' ? 270 : 0;
                    const c2x = isLandscape ? canvasH / 2 : canvasW / 2;
                    const c2y = isLandscape ? canvasW / 2 : canvasH / 2;
                    // CTM = T1·M·R·T2 → undo with T2⁻¹·R⁻¹·M⁻¹·T1⁻¹
                    canvas.save();
                    canvas.translate(c2x, c2y);
                    canvas.rotate(rotDeg);
                    if (frame.isMirrored) canvas.scale(-1, 1);
                    canvas.translate(-canvasW / 2, -canvasH / 2);

                    // Now draw in upright canvas space: place refMid on (cx,cy),
                    // rotate by the eye-line angle, scale by the registered ratio.
                    const svgWidth = svg.width();
                    const svgHeight = svg.height();
                    canvas.translate(placement.cx, placement.cy);
                    canvas.rotate(placement.rotationDeg, 0, 0);
                    canvas.scale(placement.scale, placement.scale);
                    canvas.translate(-placement.refMidX, -placement.refMidY);
                    canvas.drawSvg(svg, svgWidth, svgHeight);
                    canvas.restore();
                  }
                }
              }

              // === PUSH COMPOSITED FRAME TO AGORA AND/OR RECORDER ===
              // Read the fully composited pixels (filters + beauty + AR) from the canvas
              // once and reuse for both Agora pushing and video recording.
              const needsPixels = agoraEnabled.value || isRecording.value;
              if (needsPixels) {
                const pixels = canvas.readPixels(0, 0, {
                  width: w,
                  height: h,
                  colorType: ColorType.RGBA_8888,
                  alphaType: AlphaType.Premul,
                });
                if (pixels) {
                  const buf = pixels instanceof Uint8Array
                    ? pixels
                    : new Uint8Array(pixels.length).map((_, i) => Math.round(pixels[i] * 255));

                  // Push to Agora (livestream/auction viewers)
                  if (agoraEnabled.value) {
                    agoraFramePusher.pushRawFrame(buf, w, h);
                  }

                  // Push to video recorder (filtered video capture)
                  if (isRecording.value) {
                    // Throttle to target recording fps (every other frame at 60fps camera → 30fps video)
                    recordFrameSkip.value = (recordFrameSkip.value + 1) % 2;
                    if (recordFrameSkip.value === 0) {
                      runOnJS(pushRecordingFrame)(buf, w, h);
                    }
                  }
                }
              }
            });

            frame.dispose();
            } catch (e: any) {
              // Log the error so we can diagnose shader/render failures
              // instead of silently swallowing them
              runOnJS(logRenderError)((e && e.message) ? e.message : String(e));
            }
          }}
        />
      </View>
    );
  }
);

FilterCameraView.displayName = 'FilterCameraView';

export default FilterCameraView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
