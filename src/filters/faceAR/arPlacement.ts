/**
 * AR Placement — similarity registration of SVG assets onto face landmarks.
 *
 * Instead of scaling assets by face size heuristics, we register two reference
 * points inside the SVG (e.g. the two lens centers of a glasses SVG) onto two
 * corresponding face points (e.g. the two detected eye positions). The scale,
 * rotation, and translation all fall out of that point-pair geometry — this is
 * the standard 2D similarity transform used by AR face SDKs (Snapchat/Spark AR
 * do the same with a denser landmark mesh).
 *
 * Face frame:
 *   eyeMid   = midpoint of the two detected eye landmarks
 *   ux       = unit vector from the screen-left eye to the screen-right eye
 *   eyeDist  = distance between the eyes
 *   uy       = ux rotated +90° in image space → points "down" the face (mouth)
 *   eyeAngle = atan2 of the eye line → the face's visual roll (more responsive
 *              and accurate than ML Kit's smoothed headEulerAngleZ)
 *
 * Placement modes:
 *   'eyes'     — refL/refR land exactly on the detected eyes (glasses)
 *   'topHead'  — refL/refR land at symmetric points ±spread*eyeDist from the
 *                face axis, lift*eyeDist above the eye line (ears, crowns)
 *   'point'    — refMid lands on a single landmark; scale = widthFactor*eyeDist
 */

export type ARPoint = { x: number; y: number };

export type ARFitMode = 'eyes' | 'topHead' | 'point';

export type ARPointLandmark =
  | 'nose'
  | 'mouth'
  | 'betweenNoseMouth'
  | 'faceCenter'
  | 'betweenEyes';

export interface ARFit {
  /** SVG-space reference points that register onto the face (pair modes).
   *  For 'point' mode only their midpoint matters. */
  refL: ARPoint;
  refR: ARPoint;
  mode: ARFitMode;
  /** topHead: half-spread of the two target points, in eyeDist units. */
  spread?: number;
  /** topHead: height above the eye line, in eyeDist units. */
  lift?: number;
  /** point: which face landmark to anchor to. */
  landmark?: ARPointLandmark;
  /** point: target render width in eyeDist units. */
  widthFactor?: number;
  /** extra offset along the face's down-axis (uy), in eyeDist units. */
  dy?: number;
}

export interface ARFaceGeom {
  /** screen-left eye (smaller x) */
  leftEye: ARPoint;
  /** screen-right eye */
  rightEye: ARPoint;
  nose?: ARPoint;
  mouth?: ARPoint;
  faceCenter?: ARPoint;
}

export interface ARPlacement {
  /** draw-space point where the SVG reference midpoint should land */
  cx: number;
  cy: number;
  /** uniform scale for the SVG */
  scale: number;
  /** rotation in DEGREES around (cx, cy) */
  rotationDeg: number;
  /** SVG-space point that lands on (cx, cy) — draw with translate(-refMid) */
  refMidX: number;
  refMidY: number;
}

/**
 * Compute the similarity placement for an asset on a detected face.
 * All coordinates are in the same space (canvas/display px).
 * svgW is only needed for 'point' mode width scaling.
 */
export function computeARPlacement(
  fit: ARFit,
  face: ARFaceGeom,
  svgW: number,
): ARPlacement | null {
  'worklet';
  const { leftEye, rightEye } = face;
  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const eyeDist = Math.sqrt(eyeDx * eyeDx + eyeDy * eyeDy);
  if (eyeDist < 1) return null;

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const ux = eyeDx / eyeDist;
  const uyy = eyeDy / eyeDist;
  // perpendicular pointing "down" the face (toward mouth/chin) in y-down space
  const dxx = -uyy;
  const dyy = ux;
  const eyeAngleDeg = (Math.atan2(eyeDy, eyeDx) * 180) / Math.PI;

  const refMidX = (fit.refL.x + fit.refR.x) / 2;
  const refMidY = (fit.refL.y + fit.refR.y) / 2;
  const dyOffset = (fit.dy || 0) * eyeDist;

  if (fit.mode === 'point') {
    // Anchor the reference midpoint to a single landmark; scale by widthFactor.
    let px = eyeMidX;
    let py = eyeMidY;
    switch (fit.landmark) {
      case 'nose':
        if (!face.nose) return null;
        px = face.nose.x;
        py = face.nose.y;
        break;
      case 'mouth':
        if (!face.mouth) return null;
        px = face.mouth.x;
        py = face.mouth.y;
        break;
      case 'betweenNoseMouth':
        if (!face.nose || !face.mouth) return null;
        // ~60% of the way from nose base to mouth — upper lip area
        px = face.nose.x + (face.mouth.x - face.nose.x) * 0.6;
        py = face.nose.y + (face.mouth.y - face.nose.y) * 0.6;
        break;
      case 'faceCenter':
        if (!face.faceCenter) return null;
        px = face.faceCenter.x;
        py = face.faceCenter.y;
        break;
      case 'betweenEyes':
      default:
        break;
    }
    const widthFactor = fit.widthFactor || 1;
    return {
      cx: px + dxx * dyOffset,
      cy: py + dyy * dyOffset,
      scale: (widthFactor * eyeDist) / svgW,
      rotationDeg: eyeAngleDeg,
      refMidX,
      refMidY,
    };
  }

  // Pair modes: two face points that the two SVG ref points register onto.
  let faceLX: number, faceLY: number, faceRX: number, faceRY: number;
  if (fit.mode === 'eyes') {
    faceLX = leftEye.x;
    faceLY = leftEye.y;
    faceRX = rightEye.x;
    faceRY = rightEye.y;
  } else {
    // topHead — symmetric points around the face axis, lifted above the eyes
    const spread = (fit.spread || 0.75) * eyeDist;
    const lift = (fit.lift || 1.0) * eyeDist;
    faceLX = eyeMidX - ux * spread - dxx * lift;
    faceLY = eyeMidY - uyy * spread - dyy * lift;
    faceRX = eyeMidX + ux * spread - dxx * lift;
    faceRY = eyeMidY + uyy * spread - dyy * lift;
  }

  const faceDx = faceRX - faceLX;
  const faceDy = faceRY - faceLY;
  const facePairDist = Math.sqrt(faceDx * faceDx + faceDy * faceDy);
  const refDx = fit.refR.x - fit.refL.x;
  const refDy = fit.refR.y - fit.refL.y;
  const refPairDist = Math.sqrt(refDx * refDx + refDy * refDy);
  if (refPairDist < 0.001) return null;

  const scale = facePairDist / refPairDist;
  const rotationDeg =
    (Math.atan2(faceDy, faceDx) - Math.atan2(refDy, refDx)) * (180 / Math.PI);

  return {
    cx: (faceLX + faceRX) / 2 + dxx * dyOffset,
    cy: (faceLY + faceRY) / 2 + dyy * dyOffset,
    scale,
    rotationDeg,
    refMidX,
    refMidY,
  };
}

/**
 * Order two eye landmarks geometrically — returns {leftEye, rightEye} where
 * "left" is the eye with the smaller x coordinate in the given space. Using
 * geometry rather than ML Kit's anatomical labels keeps it correct under
 * front-camera mirroring (a mirrored preview swaps which eye is on the left).
 */
export function sortEyes(a: ARPoint, b: ARPoint): { leftEye: ARPoint; rightEye: ARPoint } {
  'worklet';
  return a.x <= b.x ? { leftEye: a, rightEye: b } : { leftEye: b, rightEye: a };
}
