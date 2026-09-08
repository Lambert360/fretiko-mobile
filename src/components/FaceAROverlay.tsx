/**
 * FaceAROverlay
 *
 * Renders face AR assets (masks, stickers, glasses, ears) positioned on
 * detected face landmarks. Uses ML Kit face detection results from
 * vision-camera-face-detection.
 *
 * ML Kit Face structure (verified from actual type definitions):
 * - face.bounds: { x, y, width, height } (flat, NOT origin/size)
 * - face.landmarks: { LEFT_EYE, RIGHT_EYE, NOSE_BASE, MOUTH_BOTTOM, ... }
 *   each landmark is { x, y } (Point)
 * - face.smilingProbability, face.leftEyeOpenProbability, face.rightEyeOpenProbability
 * - face.rollAngle, face.yawAngle, face.pitchAngle
 *
 * In the SkiaCamera pipeline, face AR is drawn directly on the Skia canvas
 * inside the onFrame worklet. This module provides the mapping logic.
 */

import { FaceAnchorPoint, FaceLandmark, DetectedFace } from '../filters/types';

/**
 * Map ML Kit face to our DetectedFace structure.
 * Uses the ACTUAL ML Kit field names from vision-camera-face-detection v3.x.
 */
export function mapFaceLandmarks(mlKitFace: any): DetectedFace | null {
  if (!mlKitFace) return null;

  const lm = mlKitFace.landmarks;
  const landmarks: Partial<Record<FaceAnchorPoint, FaceLandmark>> = {};

  // ML Kit landmarks are UPPER_CASE, each is { x, y }
  if (lm?.LEFT_EYE) landmarks.leftEye = { x: lm.LEFT_EYE.x, y: lm.LEFT_EYE.y, z: 0 };
  if (lm?.RIGHT_EYE) landmarks.rightEye = { x: lm.RIGHT_EYE.x, y: lm.RIGHT_EYE.y, z: 0 };
  if (lm?.NOSE_BASE) landmarks.nose = { x: lm.NOSE_BASE.x, y: lm.NOSE_BASE.y, z: 0 };
  if (lm?.MOUTH_BOTTOM) landmarks.mouth = { x: lm.MOUTH_BOTTOM.x, y: lm.MOUTH_BOTTOM.y, z: 0 };
  else if (lm?.MOUTH_LEFT) landmarks.mouth = { x: lm.MOUTH_LEFT.x, y: lm.MOUTH_LEFT.y, z: 0 };
  if (lm?.LEFT_EAR) landmarks.leftEar = { x: lm.LEFT_EAR.x, y: lm.LEFT_EAR.y, z: 0 };
  if (lm?.RIGHT_EAR) landmarks.rightEar = { x: lm.RIGHT_EAR.x, y: lm.RIGHT_EAR.y, z: 0 };
  if (lm?.LEFT_CHEEK) landmarks.leftCheek = { x: lm.LEFT_CHEEK.x, y: lm.LEFT_CHEEK.y, z: 0 };
  if (lm?.RIGHT_CHEEK) landmarks.rightCheek = { x: lm.RIGHT_CHEEK.x, y: lm.RIGHT_CHEEK.y, z: 0 };

  // Derive betweenEyes from eye centers
  const leftEye = landmarks.leftEye;
  const rightEye = landmarks.rightEye;
  if (leftEye && rightEye) {
    landmarks.betweenEyes = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
      z: 0,
    };
  }

  // Derive forehead and topHead from other landmarks
  const nose = landmarks.nose;
  if (nose && leftEye && rightEye) {
    const eyeCenter = landmarks.betweenEyes!;
    const eyeToNoseDist = Math.abs(nose.y - eyeCenter.y);
    landmarks.forehead = {
      x: eyeCenter.x,
      y: eyeCenter.y - eyeToNoseDist * 0.8,
      z: 0,
    };
    landmarks.topHead = {
      x: eyeCenter.x,
      y: eyeCenter.y - eyeToNoseDist * 2.5,
      z: 0,
    };
  }

  // Derive chin from nose/mouth
  if (nose) {
    const mouth = landmarks.mouth;
    const refY = mouth ? mouth.y : nose.y;
    const dist = Math.abs(refY - nose.y);
    landmarks.chin = {
      x: nose.x,
      y: refY + dist * 1.5,
      z: 0,
    };
  }

  // Bounds — flat structure: { x, y, width, height }
  const b = mlKitFace.bounds || { x: 0, y: 0, width: 0, height: 0 };

  return {
    landmarks: landmarks as Record<FaceAnchorPoint, FaceLandmark>,
    bounds: {
      left: b.x,
      top: b.y,
      right: b.x + b.width,
      bottom: b.y + b.height,
    },
    rotation: mlKitFace.rollAngle || 0,
    smilingProbability: mlKitFace.smilingProbability,
    leftEyeOpenProbability: mlKitFace.leftEyeOpenProbability,
    rightEyeOpenProbability: mlKitFace.rightEyeOpenProbability,
  };
}

/**
 * Calculate the position and scale for a face AR asset
 * based on the detected face landmarks and the asset's anchor point.
 */
export function calculateAssetTransform(
  face: DetectedFace,
  anchorPoint: FaceAnchorPoint,
  baseScale: number,
  rotationOffset: number = 0,
  positionOffset?: { x: number; y: number }
): { x: number; y: number; scale: number; rotation: number } {
  const landmark = face.landmarks[anchorPoint];
  if (!landmark) {
    const cx = (face.bounds.left + face.bounds.right) / 2;
    const cy = (face.bounds.top + face.bounds.bottom) / 2;
    return { x: cx, y: cy, scale: baseScale, rotation: face.rotation + rotationOffset };
  }

  const faceWidth = face.bounds.right - face.bounds.left;
  const faceHeight = face.bounds.bottom - face.bounds.top;
  const faceSize = Math.max(faceWidth, faceHeight);
  const scale = baseScale * (faceSize / 200);

  let x = landmark.x;
  let y = landmark.y;

  if (positionOffset) {
    x += positionOffset.x * scale;
    y += positionOffset.y * scale;
  }

  return { x, y, scale, rotation: face.rotation + rotationOffset };
}

/**
 * Check if the user is smiling (for expression-triggered effects)
 */
export function isSmiling(face: DetectedFace, threshold: number = 0.7): boolean {
  return (face.smilingProbability ?? 0) > threshold;
}

/**
 * Check if either eye is closed (for blink-triggered effects)
 */
export function isBlinking(face: DetectedFace, threshold: number = 0.3): boolean {
  const leftClosed = (face.leftEyeOpenProbability ?? 1) < threshold;
  const rightClosed = (face.rightEyeOpenProbability ?? 1) < threshold;
  return leftClosed || rightClosed;
}
