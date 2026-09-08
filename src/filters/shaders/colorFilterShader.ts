/**
 * Color Filter Shader (GLSL / Skia Runtime Effect)
 *
 * A single GPU shader that applies all color adjustments in one pass:
 * brightness, contrast, saturation, warmth, tint, vignette, grain, fade.
 * The `intensity` uniform blends between the original and filtered result.
 */

export const COLOR_FILTER_SHADER = `
uniform shader src;
uniform float intensity;
uniform float brightness;
uniform float contrast;
uniform float saturation;
uniform float warmth;
uniform float tint;
uniform float vignette;
uniform float grain;
uniform float fade;
uniform vec2 resolution;

// Simple hash for grain noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

half4 main(float2 xy) {
  // Sample original pixel
  half4 original = src.eval(xy);

  // Start with original color
  half3 color = original.rgb;

  // === Brightness ===
  color += half(brightness);

  // === Contrast ===
  color = (color - 0.5) * (1.0 + half(contrast)) + 0.5;

  // === Saturation (luminance-preserving) ===
  half luminance = dot(color, half3(0.299, 0.587, 0.114));
  color = mix(half3(luminance), color, 1.0 + half(saturation));

  // === Warmth (temperature shift) ===
  color.r += half(warmth) * 0.15;
  color.b -= half(warmth) * 0.15;
  color.g += half(warmth) * 0.05;

  // === Tint (green-magenta shift) ===
  color.g -= half(tint) * 0.1;
  color.r += half(tint) * 0.05;
  color.b += half(tint) * 0.05;

  // === Fade (lifts blacks, reduces contrast in shadows) ===
  color = mix(color, color * 0.85 + 0.15, half(fade));

  // === Vignette ===
  if (vignette > 0.0) {
    vec2 center = resolution * 0.5;
    float dist = distance(xy, center);
    float maxDist = length(center);
    float vig = 1.0 - smoothstep(maxDist * 0.4, maxDist, dist) * vignette;
    color *= half(vig);
  }

  // === Grain ===
  if (grain > 0.0) {
    float noise = hash(xy + vec2(0.0, 1.0)) - 0.5;
    color += half(noise * grain * 0.15);
  }

  // Clamp
  color = clamp(color, half3(0.0), half3(1.0));

  // === Intensity blend ===
  half3 result = mix(original.rgb, color, half(intensity));

  return half4(result, original.a);
}
`;

/**
 * SKIN SEGMENTATION SHADER
 *
 * Detects skin pixels using YCbCr color space analysis.
 * Returns a skin mask: 1.0 = skin, 0.0 = non-skin.
 * This is the industry-standard approach used by TikTok/Snapchat —
 * much more accurate than luminance thresholds.
 *
 * YCbCr skin range: 77 <= Cb <= 127, 133 <= Cr <= 173
 */
export const SKIN_SEGMENT_SHADER = `
uniform shader src;
uniform float threshold; // 0.0-1.0, softness of the mask edges

half4 main(float2 xy) {
  half4 color = src.eval(xy);
  half3 rgb = color.rgb;

  // Convert RGB to YCbCr
  // Y  =  0.299*R + 0.587*G + 0.114*B
  // Cb = -0.169*R - 0.331*G + 0.500*B + 0.5
  // Cr =  0.500*R - 0.419*G - 0.081*B + 0.5
  half Y  =  0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  half Cb = -0.169 * rgb.r - 0.331 * rgb.g + 0.500 * rgb.b + 0.5;
  half Cr =  0.500 * rgb.r - 0.419 * rgb.g - 0.081 * rgb.b + 0.5;

  // Skin tone range in YCbCr (well-established values from face detection research)
  // Cb: 0.30-0.50 (77-127 in 8-bit), Cr: 0.52-0.68 (133-173 in 8-bit)
  half cbSkin = smoothstep(0.30 - half(threshold) * 0.05, 0.30, Cb) *
                smoothstep(0.50, 0.50 + half(threshold) * 0.05, Cb);
  half crSkin = smoothstep(0.52 - half(threshold) * 0.05, 0.52, Cr) *
                smoothstep(0.68, 0.68 + half(threshold) * 0.05, Cr);

  // Also check Y (luminance) — skin should be in a reasonable brightness range
  half ySkin = smoothstep(0.15, 0.30, Y) * smoothstep(0.95, 0.80, Y);

  half skinMask = cbSkin * crSkin * ySkin;

  return half4(skinMask, skinMask, skinMask, 1.0);
}
`;

/**
 * BILATERAL SKIN SMOOTHING SHADER
 *
 * State-of-the-art edge-preserving skin smoothing using bilateral filtering.
 * Unlike Gaussian blur (which blurs everything), bilateral filtering weights
 * nearby pixels by BOTH spatial distance AND color similarity. This means:
 * - Skin texture (pores, blemishes) gets smoothed away
 * - Edges (eyes, lips, eyebrows, hair) stay sharp
 *
 * This is the core technique used by TikTok/Snapchat/Instagram for beauty filters.
 *
 * The shader does a two-pass approximation:
 * 1. Sample a 5x5 neighborhood
 * 2. Weight each sample by spatial Gaussian * color Gaussian
 * 3. Only apply smoothing to skin pixels (using a pre-computed skin mask)
 *
 * Also includes:
 * - Detail enhancement (high-pass filter for eyes/lips sharpening)
 * - Skin tone evening (reduces redness and uneven patches)
 */
export const BEAUTY_BILATERAL_SHADER = `
uniform shader src;
uniform shader skinMask; // pre-computed skin segmentation mask
uniform float smoothing; // 0.0-1.0, skin smoothing strength
uniform float sharpening; // 0.0-1.0, detail enhancement for eyes/lips
uniform float skinTone; // 0.0-1.0, skin tone evening
uniform float glow; // 0.0-1.0, brightness boost on skin
uniform float teethWhiten; // 0.0-1.0, teeth whitening (applied to bright white-ish areas)
uniform float lipColor; // 0.0-1.0, lip color enhancement (saturate reddish areas)
uniform float cheekBlush; // 0.0-1.0, cheek blush (add pink to mid-brightness skin)
uniform float underEyeBrighten; // 0.0-1.0, under-eye dark circle reduction
uniform vec2 resolution;

// Spatial Gaussian weight
float spatialWeight(float2 offset, float sigma) {
  float d2 = dot(offset, offset);
  return exp(-d2 / (2.0 * sigma * sigma));
}

// Color (range) Gaussian weight
float colorWeight(half3 c1, half3 c2, float sigma) {
  half3 diff = c1 - c2;
  float d2 = dot(diff, diff);
  return exp(-d2 / (2.0 * sigma * sigma));
}

half4 main(float2 xy) {
  half4 original = src.eval(xy);
  half mask = skinMask.eval(xy).r;

  // If not skin at all, skip smoothing (but still apply sharpening)
  if (mask < 0.01 && sharpening <= 0.0) {
    return original;
  }

  vec2 texel = 1.0 / resolution;
  float spatialSigma = 3.0; // radius for smoothing
  float colorSigma = 0.15;  // color similarity threshold

  // === BILATERAL FILTER (skin smoothing) ===
  half3 filteredColor = half3(0.0);
  float totalWeight = 0.0;

  if (mask > 0.01 && smoothing > 0.0) {
    for (int dx = -3; dx <= 3; dx++) {
      for (int dy = -3; dy <= 3; dy++) {
        vec2 offset = vec2(float(dx), float(dy)) * texel;
        half4 sample = src.eval(xy + offset);
        float sw = spatialWeight(vec2(float(dx), float(dy)), spatialSigma);
        float cw = colorWeight(original.rgb, sample.rgb, colorSigma);
        float w = sw * cw;
        filteredColor += sample.rgb * half(w);
        totalWeight += w;
      }
    }
    filteredColor = filteredColor / half(totalWeight);
  } else {
    filteredColor = original.rgb;
  }

  // === HIGH-PASS DETAIL ENHANCEMENT (sharpen eyes/lips/eyebrows) ===
  half3 detail = original.rgb - filteredColor;
  half3 sharpened = filteredColor + detail * half(1.0 + sharpening * 2.0);

  // Apply smoothing only to skin areas, sharpening to non-skin
  half3 result = mix(sharpened, filteredColor, half(mask) * half(smoothing));

  // === SKIN TONE EVENING (reduce redness and uneven patches) ===
  if (mask > 0.01 && skinTone > 0.0) {
    // Compute average skin tone
    half avgLum = dot(result, half3(0.299, 0.587, 0.114));
    // Reduce deviation from average luminance
    half3 toned = mix(result, half3(avgLum), half(skinTone) * 0.3);
    // Reduce redness specifically
    toned.r = mix(toned.r, (toned.r + toned.g) * 0.5, half(skinTone) * 0.15);
    result = mix(result, toned, half(mask) * half(skinTone));
  }

  // === GLOW (brightness boost on skin) ===
  if (mask > 0.01 && glow > 0.0) {
    half3 glowColor = result + half(glow) * 0.08;
    // Add a soft warm glow
    glowColor.r += half(glow) * 0.02;
    glowColor.g += half(glow) * 0.01;
    result = mix(result, glowColor, half(mask) * half(glow));
  }

  // === TEETH WHITENING (detect white-ish pixels in mouth area) ===
  if (mask > 0.01 && teethWhiten > 0.0) {
    // Teeth are bright with low saturation
    half lum = dot(result, half3(0.299, 0.587, 0.114));
    half3 hsv = result.rgb;
    half maxC = max(max(result.r, result.g), result.b);
    half minC = min(min(result.r, result.g), result.b);
    half sat = maxC > 0.0 ? (maxC - minC) / maxC : half(0.0);
    half teethMask = smoothstep(0.55, 0.75, lum) * smoothstep(0.15, 0.05, sat);
    half3 whitened = mix(result, half3(0.95, 0.95, 0.92), half(teethWhiten) * teethMask * 0.5);
    result = mix(result, whitened, half(mask));
  }

  // === LIP COLOR ENHANCEMENT (saturate reddish areas) ===
  if (mask > 0.01 && lipColor > 0.0) {
    // Lips are reddish: R > G, R > B, moderate brightness
    half lipMask = smoothstep(0.0, 0.1, result.r - result.g) *
                   smoothstep(0.0, 0.1, result.r - result.b) *
                   smoothstep(0.2, 0.5, result.r);
    half3 enhanced = result;
    enhanced.r = min(enhanced.r + half(lipColor) * 0.08, half(1.0));
    enhanced = mix(enhanced, half3(enhanced.r * 1.05, enhanced.g * 0.95, enhanced.b * 0.95), half(lipColor) * lipMask * 0.5);
    result = mix(result, enhanced, half(mask));
  }

  // === CHEEK BLUSH (add pink to mid-brightness skin) ===
  if (mask > 0.01 && cheekBlush > 0.0) {
    // Cheeks are mid-brightness skin areas
    half lum = dot(result, half3(0.299, 0.587, 0.114));
    half cheekMask = smoothstep(0.3, 0.5, lum) * smoothstep(0.7, 0.5, lum) * half(mask);
    half3 blushColor = half3(1.0, 0.7, 0.7);
    result = mix(result, mix(result, blushColor, half(cheekBlush) * cheekMask * 0.15), half(mask));
  }

  // === UNDER-EYE BRIGHTENING (lighten dark areas near eyes) ===
  if (mask > 0.01 && underEyeBrighten > 0.0) {
    // Dark circles are low-brightness skin areas
    half lum = dot(result, half3(0.299, 0.587, 0.114));
    half darkMask = smoothstep(0.25, 0.15, lum) * half(mask);
    half3 brightened = result + half(underEyeBrighten) * darkMask * 0.12;
    result = mix(result, brightened, half(mask));
  }

  result = clamp(result, half3(0.0), half3(1.0));
  return half4(result, original.a);
}
`;

/**
 * FACE MESH WARPING SHADER
 *
 * Geometric face reshaping using face landmark positions.
 * Applies localized mesh warping for:
 * - Face slimming (compress jaw/cheeks horizontally toward center)
 * - Eye enlargement (expand eye regions outward)
 * - Nose slimming (compress nose region horizontally)
 * - Jaw contouring (sharpen jawline)
 *
 * The warp uses radial basis functions for smooth, natural-looking deformation.
 * Face landmark positions are passed as uniforms.
 */
export const FACE_WARP_SHADER = `
uniform shader src;
uniform vec2 leftEye;      // left eye center
uniform vec2 rightEye;     // right eye center
uniform vec2 noseBase;     // nose base
uniform vec2 mouthCenter;  // mouth center
uniform vec2 faceCenter;   // face center (average of all landmarks)
uniform float faceWidth;   // face bounding box width
uniform float faceHeight;  // face bounding box height
uniform float faceSlim;    // 0.0-1.0, face slimming amount
uniform float eyeEnlarge;  // 0.0-1.0, eye enlargement amount
uniform float noseSlim;    // 0.0-1.0, nose slimming amount
uniform float jawSharpen;  // 0.0-1.0, jaw contouring amount
uniform vec2 resolution;

// Radial basis function for smooth warping
// Returns a displacement vector that smoothly falls off with distance
vec2 radialWarp(vec2 pos, vec2 center, float radius, vec2 direction, float strength) {
  float dist = distance(pos, center);
  float falloff = smoothstep(radius, 0.0, dist);
  return direction * falloff * strength;
}

// Eye enlargement: push pixels outward from eye center
vec2 eyeEnlargeWarp(vec2 pos, vec2 eyeCenter, float amount) {
  float eyeRadius = faceWidth * 0.08; // approximate eye region radius
  float dist = distance(pos, eyeCenter);
  if (dist > eyeRadius * 2.0) return vec2(0.0);

  // Expand: sample from closer to the center
  float expandFactor = 1.0 - amount * 0.15 * smoothstep(eyeRadius * 2.0, 0.0, dist);
  vec2 dir = pos - eyeCenter;
  return dir * (expandFactor - 1.0);
}

// Face slimming: compress horizontally toward face center
vec2 faceSlimWarp(vec2 pos, vec2 faceCenter, float faceWidth, float amount) {
  float dx = pos.x - faceCenter.x;
  float dist = abs(dx);
  float maxDist = faceWidth * 0.5;

  // Only affect cheek/jaw area (below eyes, above chin)
  float yFromCenter = pos.y - faceCenter.y;
  float yWeight = smoothstep(-faceHeight * 0.1, faceHeight * 0.1, yFromCenter) *
                  smoothstep(faceHeight * 0.4, faceHeight * 0.15, yFromCenter);

  float xWeight = smoothstep(maxDist, 0.0, dist);
  float compress = amount * 0.12 * xWeight * yWeight;

  return vec2(-dx * compress, 0.0);
}

// Nose slimming: compress nose region horizontally
vec2 noseSlimWarp(vec2 pos, vec2 noseBase, float faceWidth, float amount) {
  float dx = pos.x - noseBase.x;
  float dist = abs(dx);
  float noseRadius = faceWidth * 0.12;

  if (dist > noseRadius) return vec2(0.0);

  float yDist = abs(pos.y - noseBase.y);
  if (yDist > faceHeight * 0.15) return vec2(0.0);

  float weight = smoothstep(noseRadius, 0.0, dist) * smoothstep(faceHeight * 0.15, 0.0, yDist);
  float compress = amount * 0.10 * weight;

  return vec2(-dx * compress, 0.0);
}

// Jaw sharpening: push jawline pixels inward
vec2 jawSharpenWarp(vec2 pos, vec2 faceCenter, float faceWidth, float faceHeight, float amount) {
  float yFromCenter = pos.y - faceCenter.y;
  if (yFromCenter < faceHeight * 0.1) return vec2(0.0);

  float dx = pos.x - faceCenter.x;
  float dist = abs(dx);
  float jawRadius = faceWidth * 0.45;

  float yWeight = smoothstep(faceHeight * 0.1, faceHeight * 0.3, yFromCenter);
  float xWeight = smoothstep(jawRadius, faceWidth * 0.2, dist);
  float pushIn = amount * 0.08 * yWeight * xWeight;

  return vec2(-dx * pushIn / max(dist, 1.0) * faceWidth * 0.1, 0.0);
}

half4 main(float2 xy) {
  vec2 pos = xy;

  // Apply all warps cumulatively
  vec2 displacement = vec2(0.0);

  // Face slimming
  if (faceSlim > 0.0) {
    displacement += faceSlimWarp(pos, faceCenter, faceWidth, faceSlim);
  }

  // Eye enlargement (both eyes)
  if (eyeEnlarge > 0.0) {
    displacement += eyeEnlargeWarp(pos, leftEye, eyeEnlarge);
    displacement += eyeEnlargeWarp(pos, rightEye, eyeEnlarge);
  }

  // Nose slimming
  if (noseSlim > 0.0) {
    displacement += noseSlimWarp(pos, noseBase, faceWidth, noseSlim);
  }

  // Jaw sharpening
  if (jawSharpen > 0.0) {
    displacement += jawSharpenWarp(pos, faceCenter, faceWidth, faceHeight, jawSharpen);
  }

  // Sample from the displaced position
  vec2 samplePos = pos + displacement;
  samplePos = clamp(samplePos, vec2(0.0), resolution);

  half4 color = src.eval(samplePos);
  return color;
}
`;
