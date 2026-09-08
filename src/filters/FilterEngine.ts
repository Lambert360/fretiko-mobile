/**
 * FilterEngine
 * Core engine that manages filter state, shader compilation, and rendering.
 * Works with SkiaCamera's onFrame worklet to apply filters in real-time.
 *
 * Pipeline order (per frame):
 * 1. Face warp (geometric reshape: slim, eye enlarge, nose, jaw)
 * 2. Skin segmentation (YCbCr-based skin mask)
 * 3. Beauty bilateral (smoothing, tone, glow, teeth, lips, blush, under-eye)
 * 4. Color filter (brightness, contrast, saturation, warmth, etc.)
 * 5. Face AR overlay (masks, glasses, ears — drawn on top)
 */

import { Skia } from '@shopify/react-native-skia';
import {
  COLOR_FILTER_SHADER,
  SKIN_SEGMENT_SHADER,
  BEAUTY_BILATERAL_SHADER,
  FACE_WARP_SHADER,
} from './shaders/colorFilterShader';
import {
  FilterDefinition,
  ColorFilterParams,
  ActiveFilterState,
  DEFAULT_COLOR_PARAMS,
  DetectedFace,
} from './types';
import { getFilterById } from './filterCatalog';
import {
  BeautyParams,
  DEFAULT_BEAUTY_PARAMS,
  isBeautyActive,
} from './faceAR/BeautyFilter';

type SkRuntimeEffect = NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>;
type SkPaint = ReturnType<typeof Skia.Paint>;
type SkShader = ReturnType<SkRuntimeEffect['makeShaderWithChildren']>;

export interface FaceWarpUniforms {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseBase: { x: number; y: number };
  mouthCenter: { x: number; y: number };
  faceCenter: { x: number; y: number };
  faceWidth: number;
  faceHeight: number;
}

export class FilterEngine {
  private colorFilterEffect: SkRuntimeEffect | null = null;
  private skinSegmentEffect: SkRuntimeEffect | null = null;
  private beautyBilateralEffect: SkRuntimeEffect | null = null;
  private faceWarpEffect: SkRuntimeEffect | null = null;

  private activeFilter: ActiveFilterState = {
    filterId: 'none',
    intensity: 100,
    beautyParams: { ...DEFAULT_BEAUTY_PARAMS },
    beautyPresetId: 'none',
  };
  private currentFilterDef: FilterDefinition | null = null;
  private isInitialized = false;

  /**
   * Initialize the engine by compiling all shaders.
   * Call once at app startup or before first camera use.
   */
  initialize(): void {
    if (this.isInitialized) return;

    this.colorFilterEffect = Skia.RuntimeEffect.Make(COLOR_FILTER_SHADER);
    if (!this.colorFilterEffect) {
      console.error('❌ Failed to compile color filter shader');
    }

    this.skinSegmentEffect = Skia.RuntimeEffect.Make(SKIN_SEGMENT_SHADER);
    if (!this.skinSegmentEffect) {
      console.error('❌ Failed to compile skin segment shader');
    }

    this.beautyBilateralEffect = Skia.RuntimeEffect.Make(BEAUTY_BILATERAL_SHADER);
    if (!this.beautyBilateralEffect) {
      console.error('❌ Failed to compile beauty bilateral shader');
    }

    this.faceWarpEffect = Skia.RuntimeEffect.Make(FACE_WARP_SHADER);
    if (!this.faceWarpEffect) {
      console.error('❌ Failed to compile face warp shader');
    }

    this.isInitialized = true;
    console.log('✅ FilterEngine initialized (color + skin + beauty + warp)');
  }

  /**
   * Set the active color filter by ID
   */
  setFilter(filterId: string, intensity?: number): void {
    const filterDef = getFilterById(filterId);
    if (!filterDef) {
      console.warn(`⚠️ Filter not found: ${filterId}`);
      return;
    }

    this.activeFilter = {
      ...this.activeFilter,
      filterId,
      intensity: intensity ?? filterDef.intensityDefault ?? 100,
    };
    this.currentFilterDef = filterDef;
  }

  /**
   * Set filter intensity (0-100)
   */
  setIntensity(intensity: number): void {
    this.activeFilter.intensity = Math.max(0, Math.min(100, intensity));
  }

  /**
   * Set beauty params (for fine-grained control)
   */
  setBeautyParams(params: Partial<BeautyParams>): void {
    this.activeFilter.beautyParams = {
      ...this.activeFilter.beautyParams!,
      ...params,
    } as BeautyParams;
  }

  /**
   * Set beauty preset by ID
   */
  setBeautyPreset(presetId: string, params: BeautyParams): void {
    this.activeFilter.beautyPresetId = presetId;
    this.activeFilter.beautyParams = { ...params };
  }

  /**
   * Reset all beauty params to zero
   */
  resetBeauty(): void {
    this.activeFilter.beautyParams = { ...DEFAULT_BEAUTY_PARAMS };
    this.activeFilter.beautyPresetId = 'none';
  }

  /**
   * Get the active filter state
   */
  getActiveFilter(): ActiveFilterState {
    return { ...this.activeFilter };
  }

  /**
   * Get the current beauty params
   */
  getBeautyParams(): BeautyParams {
    return { ...this.activeFilter.beautyParams! };
  }

  /**
   * Get the current filter definition
   */
  getCurrentFilterDef(): FilterDefinition | null {
    return this.currentFilterDef;
  }

  /**
   * Whether any color filter is currently active
   */
  isFilterActive(): boolean {
    return this.activeFilter.filterId !== 'none' && this.activeFilter.intensity > 0;
  }

  /**
   * Whether any beauty filter is active
   */
  isBeautyActive(): boolean {
    return isBeautyActive(this.activeFilter.beautyParams!);
  }

  /**
   * Whether face warping is needed (any reshape param > 0)
   */
  isFaceWarpActive(): boolean {
    const p = this.activeFilter.beautyParams!;
    return p.faceSlimming > 0 || p.eyeEnlargement > 0 || p.noseSlimming > 0 || p.jawSharpening > 0;
  }

  /**
   * Build a Skia paint object with the color filter shader applied.
   */
  buildFilterPaint(
    srcShader: SkShader,
    resolution: { width: number; height: number }
  ): SkPaint | null {
    if (!this.isInitialized) this.initialize();

    if (!this.isFilterActive() || !this.colorFilterEffect || !this.currentFilterDef) {
      return null;
    }

    const params: ColorFilterParams = {
      ...DEFAULT_COLOR_PARAMS,
      ...this.currentFilterDef.params,
    };

    const intensityNorm = this.activeFilter.intensity / 100;

    const filterShader = this.colorFilterEffect.makeShaderWithChildren(
      [
        intensityNorm,
        params.brightness,
        params.contrast,
        params.saturation,
        params.warmth,
        params.tint,
        params.vignette,
        params.grain,
        params.fade,
        resolution.width,
        resolution.height,
      ],
      [srcShader]
    );

    if (!filterShader) {
      console.error('❌ Failed to create color filter shader');
      return null;
    }

    const paint = Skia.Paint();
    paint.setShader(filterShader);
    return paint;
  }

  /**
   * Build the skin segmentation shader.
   * Returns a shader that outputs a grayscale skin mask.
   */
  buildSkinMaskShader(srcShader: SkShader): SkShader | null {
    if (!this.skinSegmentEffect) return null;

    // threshold 0.5 = moderate softness for skin mask edges
    return this.skinSegmentEffect.makeShaderWithChildren([0.5], [srcShader]);
  }

  /**
   * Build the beauty bilateral shader with all beauty params.
   * Requires a pre-computed skin mask shader as a child.
   */
  buildBeautyPaint(
    srcShader: SkShader,
    skinMaskShader: SkShader,
    resolution: { width: number; height: number }
  ): SkPaint | null {
    if (!this.beautyBilateralEffect) return null;

    const p = this.activeFilter.beautyParams!;

    const beautyShader = this.beautyBilateralEffect.makeShaderWithChildren(
      [
        p.skinSmoothing,
        p.sharpening,
        p.skinTone,
        p.glow,
        p.teethWhitening,
        p.lipColor,
        p.cheekBlush,
        p.underEyeBrighten,
        resolution.width,
        resolution.height,
      ],
      [srcShader, skinMaskShader]
    );

    if (!beautyShader) return null;

    const paint = Skia.Paint();
    paint.setShader(beautyShader);
    return paint;
  }

  /**
   * Build the face warp shader for geometric face reshaping.
   * Requires face landmark positions from ML Kit.
   */
  buildFaceWarpPaint(
    srcShader: SkShader,
    face: DetectedFace,
    resolution: { width: number; height: number }
  ): SkPaint | null {
    if (!this.faceWarpEffect || !face) return null;

    const p = this.activeFilter.beautyParams!;

    // Extract landmark positions
    const leftEye = face.landmarks.leftEye;
    const rightEye = face.landmarks.rightEye;
    const noseBase = face.landmarks.nose;
    const mouthCenter = face.landmarks.mouth;
    const faceCenter = {
      x: (face.bounds.left + face.bounds.right) / 2,
      y: (face.bounds.top + face.bounds.bottom) / 2,
    };
    const faceWidth = face.bounds.right - face.bounds.left;
    const faceHeight = face.bounds.bottom - face.bounds.top;

    const warpShader = this.faceWarpEffect.makeShaderWithChildren(
      [
        leftEye.x, leftEye.y,
        rightEye.x, rightEye.y,
        noseBase.x, noseBase.y,
        mouthCenter.x, mouthCenter.y,
        faceCenter.x, faceCenter.y,
        faceWidth,
        faceHeight,
        p.faceSlimming,
        p.eyeEnlargement,
        p.noseSlimming,
        p.jawSharpening,
        resolution.width,
        resolution.height,
      ],
      [srcShader]
    );

    if (!warpShader) return null;

    const paint = Skia.Paint();
    paint.setShader(warpShader);
    return paint;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.colorFilterEffect = null;
    this.skinSegmentEffect = null;
    this.beautyBilateralEffect = null;
    this.faceWarpEffect = null;
    this.isInitialized = false;
  }
}

/**
 * Singleton instance
 */
export const filterEngine = new FilterEngine();
