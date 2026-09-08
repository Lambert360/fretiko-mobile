/**
 * BeautyFilter
 *
 * State-of-the-art beauty filter system matching TikTok/Snapchat quality.
 *
 * Categories:
 * 1. SKIN: smoothing, tone evening, glow, under-eye brightening
 * 2. RESHAPE: face slim, eye enlarge, nose slim, jaw sharpen
 * 3. ENHANCE: teeth whiten, lip color, cheek blush, sharpening
 *
 * All parameters are 0.0-1.0 and applied via GPU shaders in real-time.
 */

export interface BeautyParams {
  // === SKIN ===
  skinSmoothing: number;      // 0-1, bilateral edge-preserving smoothing
  skinTone: number;           // 0-1, even out skin tone, reduce redness
  glow: number;               // 0-1, brightness boost on skin (dewy look)
  underEyeBrighten: number;   // 0-1, reduce dark circles

  // === RESHAPE (face mesh warping) ===
  faceSlimming: number;       // 0-1, compress face horizontally
  eyeEnlargement: number;     // 0-1, enlarge eye regions
  noseSlimming: number;       // 0-1, slim nose bridge
  jawSharpening: number;      // 0-1, contour jawline

  // === ENHANCE ===
  teethWhitening: number;     // 0-1, whiten teeth
  lipColor: number;           // 0-1, enhance/saturate lip color
  cheekBlush: number;         // 0-1, add pink blush to cheeks
  sharpening: number;         // 0-1, sharpen eyes/lips/eyebrows (detail enhance)
}

export const DEFAULT_BEAUTY_PARAMS: BeautyParams = {
  skinSmoothing: 0,
  skinTone: 0,
  glow: 0,
  underEyeBrighten: 0,
  faceSlimming: 0,
  eyeEnlargement: 0,
  noseSlimming: 0,
  jawSharpening: 0,
  teethWhitening: 0,
  lipColor: 0,
  cheekBlush: 0,
  sharpening: 0,
};

/**
 * Check if any beauty params are active
 */
export function isBeautyActive(params: BeautyParams): boolean {
  return (
    params.skinSmoothing > 0 ||
    params.skinTone > 0 ||
    params.glow > 0 ||
    params.underEyeBrighten > 0 ||
    params.faceSlimming > 0 ||
    params.eyeEnlargement > 0 ||
    params.noseSlimming > 0 ||
    params.jawSharpening > 0 ||
    params.teethWhitening > 0 ||
    params.lipColor > 0 ||
    params.cheekBlush > 0 ||
    params.sharpening > 0
  );
}

/**
 * Beauty filter presets — carefully tuned for natural-looking results.
 * These match the look that TikTok/Snapchat/Instagram offer.
 */
export interface BeautyPreset {
  id: string;
  name: string;
  emoji: string;
  params: BeautyParams;
}

export const BEAUTY_PRESETS: BeautyPreset[] = [
  {
    id: 'none',
    name: 'None',
    emoji: '✕',
    params: { ...DEFAULT_BEAUTY_PARAMS },
  },
  {
    id: 'natural',
    name: 'Natural',
    emoji: '🌿',
    params: {
      skinSmoothing: 0.25,
      skinTone: 0.15,
      glow: 0.08,
      underEyeBrighten: 0.15,
      faceSlimming: 0,
      eyeEnlargement: 0,
      noseSlimming: 0,
      jawSharpening: 0,
      teethWhitening: 0.1,
      lipColor: 0.1,
      cheekBlush: 0.08,
      sharpening: 0.1,
    },
  },
  {
    id: 'smooth',
    name: 'Smooth',
    emoji: '✨',
    params: {
      skinSmoothing: 0.5,
      skinTone: 0.25,
      glow: 0.12,
      underEyeBrighten: 0.25,
      faceSlimming: 0,
      eyeEnlargement: 0,
      noseSlimming: 0,
      jawSharpening: 0,
      teethWhitening: 0.15,
      lipColor: 0.15,
      cheekBlush: 0.12,
      sharpening: 0.15,
    },
  },
  {
    id: 'glam',
    name: 'Glam',
    emoji: '💋',
    params: {
      skinSmoothing: 0.65,
      skinTone: 0.35,
      glow: 0.2,
      underEyeBrighten: 0.35,
      faceSlimming: 0.2,
      eyeEnlargement: 0.15,
      noseSlimming: 0.1,
      jawSharpening: 0.1,
      teethWhitening: 0.2,
      lipColor: 0.25,
      cheekBlush: 0.18,
      sharpening: 0.2,
    },
  },
  {
    id: 'doll',
    name: 'Doll',
    emoji: '🎀',
    params: {
      skinSmoothing: 0.75,
      skinTone: 0.4,
      glow: 0.25,
      underEyeBrighten: 0.4,
      faceSlimming: 0.35,
      eyeEnlargement: 0.3,
      noseSlimming: 0.2,
      jawSharpening: 0.15,
      teethWhitening: 0.25,
      lipColor: 0.35,
      cheekBlush: 0.25,
      sharpening: 0.25,
    },
  },
  {
    id: 'porcelain',
    name: 'Porcelain',
    emoji: '🤍',
    params: {
      skinSmoothing: 0.85,
      skinTone: 0.5,
      glow: 0.3,
      underEyeBrighten: 0.45,
      faceSlimming: 0.25,
      eyeEnlargement: 0.2,
      noseSlimming: 0.15,
      jawSharpening: 0.12,
      teethWhitening: 0.3,
      lipColor: 0.2,
      cheekBlush: 0.15,
      sharpening: 0.3,
    },
  },
];

/**
 * Get a beauty preset by ID
 */
export function getBeautyPresetById(id: string): BeautyPreset | undefined {
  return BEAUTY_PRESETS.find((p) => p.id === id);
}

/**
 * Beauty parameter metadata for UI rendering.
 * Each param has a label, category, and slider range.
 */
export interface BeautyParamMeta {
  key: keyof BeautyParams;
  label: string;
  category: 'skin' | 'reshape' | 'enhance';
  icon: string; // Ionicons name (kept as string for flexibility)
  max: number;
}

export const BEAUTY_PARAM_META: BeautyParamMeta[] = [
  // SKIN
  { key: 'skinSmoothing', label: 'Smooth', category: 'skin', icon: 'water-outline', max: 1 },
  { key: 'skinTone', label: 'Even Tone', category: 'skin', icon: 'color-palette-outline', max: 1 },
  { key: 'glow', label: 'Glow', category: 'skin', icon: 'sunny-outline', max: 1 },
  { key: 'underEyeBrighten', label: 'Under-Eye', category: 'skin', icon: 'eye-outline', max: 1 },

  // RESHAPE
  { key: 'faceSlimming', label: 'Slim Face', category: 'reshape', icon: 'resize-outline', max: 1 },
  { key: 'eyeEnlargement', label: 'Big Eyes', category: 'reshape', icon: 'eye-outline', max: 1 },
  { key: 'noseSlimming', label: 'Slim Nose', category: 'reshape', icon: 'triangle-outline', max: 1 },
  { key: 'jawSharpening', label: 'Jaw Line', category: 'reshape', icon: 'cube-outline', max: 1 },

  // ENHANCE
  { key: 'teethWhitening', label: 'Teeth', category: 'enhance', icon: 'sparkles-outline', max: 1 },
  { key: 'lipColor', label: 'Lips', category: 'enhance', icon: 'heart-outline', max: 1 },
  { key: 'cheekBlush', label: 'Blush', category: 'enhance', icon: 'flower-outline', max: 1 },
  { key: 'sharpening', label: 'Sharpen', category: 'enhance', icon: 'contrast-outline', max: 1 },
];

/**
 * Get params by category
 */
export function getParamsByCategory(category: 'skin' | 'reshape' | 'enhance'): BeautyParamMeta[] {
  return BEAUTY_PARAM_META.filter((m) => m.category === category);
}

/**
 * Calculate the mesh warp transform for face slimming.
 * This compresses the face horizontally toward the center.
 */
export function calculateFaceSlimWarp(
  faceBounds: { left: number; top: number; right: number; bottom: number },
  intensity: number
): { centerX: number; compressAmount: number; radius: number } {
  const centerX = (faceBounds.left + faceBounds.right) / 2;
  const faceWidth = faceBounds.right - faceBounds.left;
  const radius = faceWidth / 2;
  const compressAmount = intensity * 0.15 * faceWidth;
  return { centerX, compressAmount, radius };
}

/**
 * Calculate the mesh warp transform for eye enlargement.
 */
export function calculateEyeEnlargeWarp(
  eyePosition: { x: number; y: number },
  intensity: number
): { centerX: number; centerY: number; expandAmount: number; radius: number } {
  const radius = 30;
  const expandAmount = intensity * 0.2;
  return { centerX: eyePosition.x, centerY: eyePosition.y, expandAmount, radius };
}

/**
 * Expression-triggered effect definitions.
 */
export interface ExpressionEffect {
  id: string;
  name: string;
  triggerExpression: 'smile' | 'blink' | 'surprise';
  triggerThreshold: number;
  assetId?: string;
  effectType: 'sparkles' | 'hearts' | 'stars' | 'fire';
}

export const EXPRESSION_EFFECTS: ExpressionEffect[] = [
  {
    id: 'smile_hearts',
    name: 'Hearts on Smile',
    triggerExpression: 'smile',
    triggerThreshold: 0.7,
    effectType: 'hearts',
  },
  {
    id: 'blink_stars',
    name: 'Stars on Blink',
    triggerExpression: 'blink',
    triggerThreshold: 0.3,
    effectType: 'stars',
  },
  {
    id: 'surprise_fire',
    name: 'Fire on Surprise',
    triggerExpression: 'surprise',
    triggerThreshold: 0.5,
    effectType: 'fire',
  },
];
