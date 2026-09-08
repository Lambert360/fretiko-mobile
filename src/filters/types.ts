/**
 * Filter System Types
 * Core type definitions for the AR/filter engine
 */

export type FilterCategory = 'color' | 'face_ar' | 'beauty' | 'none';

export interface ColorFilterParams {
  brightness: number; // -1.0 to 1.0
  contrast: number; // -1.0 to 1.0
  saturation: number; // -1.0 to 1.0
  warmth: number; // -1.0 to 1.0 (temperature shift)
  tint: number; // -1.0 to 1.0 (green-magenta)
  vignette: number; // 0.0 to 1.0
  grain: number; // 0.0 to 1.0
  fade: number; // 0.0 to 1.0 (lifts blacks)
}

export interface FaceARAsset {
  id: string;
  name: string;
  category: 'mask' | 'sticker' | 'glasses' | 'hat' | 'ears' | 'effect';
  assetPath: string; // path to PNG/SVG asset
  anchorPoint: FaceAnchorPoint;
  scale: number;
  rotationOffset: number;
  positionOffset?: { x: number; y: number };
  animated?: boolean;
}

export type FaceAnchorPoint =
  | 'nose'
  | 'forehead'
  | 'leftEye'
  | 'rightEye'
  | 'betweenEyes'
  | 'mouth'
  | 'chin'
  | 'leftEar'
  | 'rightEar'
  | 'leftCheek'
  | 'rightCheek'
  | 'topHead';

export interface FilterDefinition {
  id: string;
  name: string;
  category: FilterCategory;
  thumbnailColor: string; // for carousel preview (hex color)
  params?: Partial<ColorFilterParams>;
  shaderId?: string; // reference to a shader in the shader catalog
  faceARAssets?: string[]; // asset IDs for face AR
  intensityDefault?: number; // 0-100, default 100
}

export interface ActiveFilterState {
  filterId: string;
  intensity: number; // 0-100
  beautyParams?: import('./faceAR/BeautyFilter').BeautyParams;
  beautyPresetId?: string;
}

export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface DetectedFace {
  landmarks: Record<FaceAnchorPoint, FaceLandmark>;
  bounds: { left: number; top: number; right: number; bottom: number };
  rotation: number;
  smilingProbability?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
}

export const DEFAULT_COLOR_PARAMS: ColorFilterParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  tint: 0,
  vignette: 0,
  grain: 0,
  fade: 0,
};
