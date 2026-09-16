/**
 * Face AR Assets — SVG-based
 *
 * All face AR assets are defined as SVG strings that Skia can render
 * directly via Skia.SVG.Make(). This avoids needing PNG files and
 * allows infinite scaling without quality loss.
 *
 * Assets are drawn at face landmark positions calculated from ML Kit
 * face detection results.
 */

import { ARFit } from './arPlacement';

export interface SVGAsset {
  id: string;
  name: string;
  category: 'ears' | 'glasses' | 'hat' | 'sticker' | 'effect';
  svg: string;
  anchorPoint: 'topHead' | 'betweenEyes' | 'nose' | 'mouth' | 'leftEye' | 'rightEye';
  scale: number;
  positionOffset: { x: number; y: number };
}

/**
 * Per-asset registration data: which points inside the SVG map onto which
 * face features. refL/refR are in the SVG's own viewBox units.
 *   - glasses: ref = the two lens centers → land on the detected eyes
 *   - ears/hats: ref = the two side/base points → land at ±spread*eyeDist,
 *     lift*eyeDist above the eye line
 *   - point assets: refMid lands on a landmark; scale from widthFactor*eyeDist
 */
export const AR_FIT: Record<string, ARFit> = {
  dog_ears:      { refL: { x: 50, y: 105 }, refR: { x: 150, y: 105 }, mode: 'topHead', spread: 0.78, lift: 0.85 },
  cat_ears:      { refL: { x: 42, y: 88 },  refR: { x: 158, y: 88 },  mode: 'topHead', spread: 0.78, lift: 0.85 },
  bunny_ears:    { refL: { x: 55, y: 155 }, refR: { x: 105, y: 155 }, mode: 'topHead', spread: 0.34, lift: 0.95 },
  sunglasses:    { refL: { x: 55, y: 40 },  refR: { x: 165, y: 40 },  mode: 'eyes', dy: 0.06 },
  heart_glasses: { refL: { x: 55, y: 45 },  refR: { x: 165, y: 45 },  mode: 'eyes', dy: 0.04 },
  crown:         { refL: { x: 30, y: 62 },  refR: { x: 170, y: 62 },  mode: 'topHead', spread: 0.8,  lift: 0.95 },
  flower_crown:  { refL: { x: 30, y: 70 },  refR: { x: 190, y: 70 },  mode: 'topHead', spread: 0.85, lift: 1.0 },
  clown_nose:    { refL: { x: 40, y: 40 },  refR: { x: 40, y: 40 },   mode: 'point', landmark: 'nose', widthFactor: 0.55, dy: 0.12 },
  mustache:      { refL: { x: 80, y: 32 },  refR: { x: 80, y: 32 },   mode: 'point', landmark: 'betweenNoseMouth', widthFactor: 1.15, dy: 0.08 },
  sparkles:      { refL: { x: 150, y: 150 },refR: { x: 150, y: 150 }, mode: 'point', landmark: 'faceCenter', widthFactor: 4.0 },
};

/**
 * Dog ears — drawn at top of head
 */
const DOG_EARS_SVG = `
<svg width="200" height="120" viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
  <!-- Left ear -->
  <ellipse cx="50" cy="60" rx="35" ry="55" fill="#8B5E3C" transform="rotate(-15 50 60)"/>
  <ellipse cx="50" cy="65" rx="22" ry="38" fill="#D4A574" transform="rotate(-15 50 65)"/>
  <!-- Right ear -->
  <ellipse cx="150" cy="60" rx="35" ry="55" fill="#8B5E3C" transform="rotate(15 150 60)"/>
  <ellipse cx="150" cy="65" rx="22" ry="38" fill="#D4A574" transform="rotate(15 150 65)"/>
</svg>
`;

/**
 * Cat ears — drawn at top of head
 */
const CAT_EARS_SVG = `
<svg width="200" height="100" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Left ear -->
  <polygon points="40,90 20,20 75,60" fill="#5C5C5C"/>
  <polygon points="45,80 30,35 68,60" fill="#FFB6C1"/>
  <!-- Right ear -->
  <polygon points="160,90 180,20 125,60" fill="#5C5C5C"/>
  <polygon points="155,80 170,35 132,60" fill="#FFB6C1"/>
</svg>
`;

/**
 * Bunny ears — long and upright
 */
const BUNNY_EARS_SVG = `
<svg width="160" height="200" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Left ear -->
  <ellipse cx="55" cy="80" rx="22" ry="75" fill="#F5F5DC" transform="rotate(-10 55 80)"/>
  <ellipse cx="55" cy="85" rx="14" ry="55" fill="#FFB6C1" transform="rotate(-10 55 85)"/>
  <!-- Right ear -->
  <ellipse cx="105" cy="80" rx="22" ry="75" fill="#F5F5DC" transform="rotate(10 105 80)"/>
  <ellipse cx="105" cy="85" rx="14" ry="55" fill="#FFB6C1" transform="rotate(10 105 85)"/>
</svg>
`;

/**
 * Sunglasses — drawn between eyes
 */
const SUNGLASSES_SVG = `
<svg width="220" height="80" viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
  <!-- Left lens -->
  <circle cx="55" cy="40" r="35" fill="#1a1a1a" stroke="#333" stroke-width="3"/>
  <circle cx="48" cy="33" r="8" fill="#444" opacity="0.6"/>
  <!-- Right lens -->
  <circle cx="165" cy="40" r="35" fill="#1a1a1a" stroke="#333" stroke-width="3"/>
  <circle cx="158" cy="33" r="8" fill="#444" opacity="0.6"/>
  <!-- Bridge -->
  <rect x="88" y="35" width="44" height="5" rx="2" fill="#333"/>
  <!-- Arms -->
  <rect x="20" y="38" width="10" height="4" fill="#333"/>
  <rect x="190" y="38" width="10" height="4" fill="#333"/>
</svg>
`;

/**
 * Heart glasses — pink hearts
 */
const HEART_GLASSES_SVG = `
<svg width="220" height="90" viewBox="0 0 220 90" xmlns="http://www.w3.org/2000/svg">
  <!-- Left heart -->
  <path d="M55,70 C30,50 30,20 55,25 C80,20 80,50 55,70 Z" fill="#FF1493" stroke="#FF69B4" stroke-width="2" opacity="0.85"/>
  <!-- Right heart -->
  <path d="M165,70 C140,50 140,20 165,25 C190,20 190,50 165,70 Z" fill="#FF1493" stroke="#FF69B4" stroke-width="2" opacity="0.85"/>
  <!-- Bridge -->
  <rect x="88" y="38" width="44" height="4" rx="2" fill="#FF69B4"/>
</svg>
`;

/**
 * Crown — golden, drawn at top of head
 */
const CROWN_SVG = `
<svg width="200" height="100" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Crown base -->
  <rect x="30" y="60" width="140" height="30" rx="4" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
  <!-- Crown points -->
  <polygon points="30,60 50,20 70,60" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
  <polygon points="70,60 100,10 130,60" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
  <polygon points="130,60 150,20 170,60" fill="#FFD700" stroke="#DAA520" stroke-width="2"/>
  <!-- Gems -->
  <circle cx="50" cy="25" r="5" fill="#FF1744"/>
  <circle cx="100" cy="15" r="6" fill="#00E5FF"/>
  <circle cx="150" cy="25" r="5" fill="#76FF03"/>
  <!-- Base gems -->
  <circle cx="60" cy="75" r="4" fill="#FF1744"/>
  <circle cx="100" cy="75" r="5" fill="#00E5FF"/>
  <circle cx="140" cy="75" r="4" fill="#76FF03"/>
</svg>
`;

/**
 * Flower crown — flowers around top of head
 */
const FLOWER_CROWN_SVG = `
<svg width="220" height="80" viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
  <!-- Flowers along an arc -->
  <g transform="translate(110,70)">
    <g transform="translate(-80,-10)">
      <circle cx="0" cy="0" r="12" fill="#FF69B4"/>
      <circle cx="-8" cy="-5" r="8" fill="#FFB6C1"/>
      <circle cx="8" cy="-5" r="8" fill="#FFB6C1"/>
      <circle cx="-5" cy="8" r="8" fill="#FFB6C1"/>
      <circle cx="5" cy="8" r="8" fill="#FFB6C1"/>
      <circle cx="0" cy="0" r="5" fill="#FFD700"/>
    </g>
    <g transform="translate(-40,-30)">
      <circle cx="0" cy="0" r="12" fill="#E91E63"/>
      <circle cx="-8" cy="-5" r="8" fill="#F8BBD0"/>
      <circle cx="8" cy="-5" r="8" fill="#F8BBD0"/>
      <circle cx="-5" cy="8" r="8" fill="#F8BBD0"/>
      <circle cx="5" cy="8" r="8" fill="#F8BBD0"/>
      <circle cx="0" cy="0" r="5" fill="#FFD700"/>
    </g>
    <g transform="translate(0,-40)">
      <circle cx="0" cy="0" r="14" fill="#9C27B0"/>
      <circle cx="-9" cy="-6" r="9" fill="#CE93D8"/>
      <circle cx="9" cy="-6" r="9" fill="#CE93D8"/>
      <circle cx="-6" cy="9" r="9" fill="#CE93D8"/>
      <circle cx="6" cy="9" r="9" fill="#CE93D8"/>
      <circle cx="0" cy="0" r="6" fill="#FFD700"/>
    </g>
    <g transform="translate(40,-30)">
      <circle cx="0" cy="0" r="12" fill="#FF69B4"/>
      <circle cx="-8" cy="-5" r="8" fill="#FFB6C1"/>
      <circle cx="8" cy="-5" r="8" fill="#FFB6C1"/>
      <circle cx="-5" cy="8" r="8" fill="#FFB6C1"/>
      <circle cx="5" cy="8" r="8" fill="#FFB6C1"/>
      <circle cx="0" cy="0" r="5" fill="#FFD700"/>
    </g>
    <g transform="translate(80,-10)">
      <circle cx="0" cy="0" r="12" fill="#E91E63"/>
      <circle cx="-8" cy="-5" r="8" fill="#F8BBD0"/>
      <circle cx="8" cy="-5" r="8" fill="#F8BBD0"/>
      <circle cx="-5" cy="8" r="8" fill="#F8BBD0"/>
      <circle cx="5" cy="8" r="8" fill="#F8BBD0"/>
      <circle cx="0" cy="0" r="5" fill="#FFD700"/>
    </g>
  </g>
  <!-- Leaves -->
  <ellipse cx="70" cy="55" rx="8" ry="4" fill="#4CAF50" transform="rotate(-30 70 55)"/>
  <ellipse cx="150" cy="55" rx="8" ry="4" fill="#4CAF50" transform="rotate(30 150 55)"/>
</svg>
`;

/**
 * Clown nose — red circle on nose
 */
const CLOWN_NOSE_SVG = `
<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <circle cx="40" cy="40" r="30" fill="#FF0000" stroke="#CC0000" stroke-width="3"/>
  <circle cx="32" cy="32" r="8" fill="#FF6666" opacity="0.6"/>
</svg>
`;

/**
 * Mustache — drawn below nose
 */
const MUSTACHE_SVG = `
<svg width="160" height="60" viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg">
  <path d="M80,30 Q60,10 40,20 Q20,30 10,50 Q30,35 50,35 Q70,35 80,30 Z" fill="#3E2723"/>
  <path d="M80,30 Q100,10 120,20 Q140,30 150,50 Q130,35 110,35 Q90,35 80,30 Z" fill="#3E2723"/>
</svg>
`;

/**
 * Sparkles effect — drawn around face
 */
const SPARKLES_SVG = `
<svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <g opacity="0.8">
    <!-- Large sparkle top -->
    <polygon points="150,50 155,80 165,85 155,90 150,120 145,90 135,85 145,80" fill="#FFD700"/>
    <!-- Small sparkle left -->
    <polygon points="60,120 63,135 70,138 63,141 60,156 57,141 50,138 57,135" fill="#FFD700"/>
    <!-- Small sparkle right -->
    <polygon points="240,130 243,145 250,148 243,151 240,166 237,151 230,148 237,145" fill="#FFD700"/>
    <!-- Medium sparkle bottom left -->
    <polygon points="80,220 84,235 92,238 84,241 80,256 76,241 68,238 76,235" fill="#FFD700"/>
    <!-- Medium sparkle bottom right -->
    <polygon points="220,210 224,225 232,228 224,231 220,246 216,231 208,228 216,225" fill="#FFD700"/>
    <!-- Tiny sparkles -->
    <circle cx="120" cy="180" r="3" fill="#FFD700" opacity="0.6"/>
    <circle cx="180" cy="170" r="2" fill="#FFD700" opacity="0.6"/>
    <circle cx="200" cy="240" r="3" fill="#FFD700" opacity="0.6"/>
    <circle cx="100" cy="250" r="2" fill="#FFD700" opacity="0.6"/>
  </g>
</svg>
`;

/**
 * All face AR assets
 */
export const SVG_FACE_AR_ASSETS: SVGAsset[] = [
  {
    id: 'dog_ears',
    name: 'Dog Ears',
    category: 'ears',
    svg: DOG_EARS_SVG,
    anchorPoint: 'topHead',
    scale: 1.2,
    positionOffset: { x: 0, y: -20 },
  },
  {
    id: 'cat_ears',
    name: 'Cat Ears',
    category: 'ears',
    svg: CAT_EARS_SVG,
    anchorPoint: 'topHead',
    scale: 1.1,
    positionOffset: { x: 0, y: -15 },
  },
  {
    id: 'bunny_ears',
    name: 'Bunny Ears',
    category: 'ears',
    svg: BUNNY_EARS_SVG,
    anchorPoint: 'topHead',
    scale: 1.5,
    positionOffset: { x: 0, y: -40 },
  },
  {
    id: 'sunglasses',
    name: 'Sunglasses',
    category: 'glasses',
    svg: SUNGLASSES_SVG,
    anchorPoint: 'betweenEyes',
    scale: 1.0,
    positionOffset: { x: 0, y: 0 },
  },
  {
    id: 'heart_glasses',
    name: 'Heart Glasses',
    category: 'glasses',
    svg: HEART_GLASSES_SVG,
    anchorPoint: 'betweenEyes',
    scale: 1.0,
    positionOffset: { x: 0, y: 0 },
  },
  {
    id: 'crown',
    name: 'Crown',
    category: 'hat',
    svg: CROWN_SVG,
    anchorPoint: 'topHead',
    scale: 1.3,
    positionOffset: { x: 0, y: -30 },
  },
  {
    id: 'flower_crown',
    name: 'Flower Crown',
    category: 'hat',
    svg: FLOWER_CROWN_SVG,
    anchorPoint: 'topHead',
    scale: 1.2,
    positionOffset: { x: 0, y: -25 },
  },
  {
    id: 'clown_nose',
    name: 'Clown Nose',
    category: 'sticker',
    svg: CLOWN_NOSE_SVG,
    anchorPoint: 'nose',
    scale: 0.5,
    positionOffset: { x: 0, y: 0 },
  },
  {
    id: 'mustache',
    name: 'Mustache',
    category: 'sticker',
    svg: MUSTACHE_SVG,
    anchorPoint: 'nose',
    scale: 0.8,
    positionOffset: { x: 0, y: 15 },
  },
  {
    id: 'sparkles',
    name: 'Sparkles',
    category: 'effect',
    svg: SPARKLES_SVG,
    anchorPoint: 'betweenEyes',
    scale: 2.0,
    positionOffset: { x: 0, y: -50 },
  },
];

/**
 * Get an SVG asset by ID
 */
export function getSVGAssetById(id: string): SVGAsset | undefined {
  return SVG_FACE_AR_ASSETS.find((a) => a.id === id);
}

/**
 * Get SVG assets by category
 */
export function getSVGAssetsByCategory(category: string): SVGAsset[] {
  return SVG_FACE_AR_ASSETS.filter((a) => a.category === category);
}
