/**
 * FaceMeshRenderer
 *
 * Maps ML Kit face detection results to AR asset positions and draws them
 * on the Skia canvas. This runs inside the SkiaCamera onFrame worklet.
 *
 * Now uses SVG-based assets rendered via Skia.SVG.Make() — no PNG files needed.
 * SVGs scale infinitely and are rendered natively by Skia.
 *
 * The renderer:
 * 1. Receives detected faces from ML Kit (via vision-camera-face-detection)
 * 2. Maps face landmarks (UPPER_CASE: LEFT_EYE, RIGHT_EYE, NOSE_BASE, etc.) to anchor points
 * 3. Calculates position, scale, and rotation for each AR asset
 * 4. Draws SVG assets on the Skia canvas
 */

import { Skia } from '@shopify/react-native-skia';
import { DetectedFace } from '../types';
import { calculateAssetTransform, isSmiling, isBlinking } from '../../components/FaceAROverlay';
import { SVG_FACE_AR_ASSETS, SVGAsset } from './faceARAssets';

type SkCanvas = any; // Skia canvas from the render callback
type SkSVG = ReturnType<typeof Skia.SVG.MakeFromString>;

export class FaceMeshRenderer {
  private loadedSVGs: Map<string, SkSVG> = new Map();
  private activeAssetIds: string[] = [];

  /**
   * Set which face AR assets are active
   */
  setActiveAssets(assetIds: string[]): void {
    this.activeAssetIds = assetIds;
    // Preload any SVGs that aren't loaded yet
    for (const id of assetIds) {
      if (!this.loadedSVGs.has(id)) {
        const asset = SVG_FACE_AR_ASSETS.find((a) => a.id === id);
        if (asset) {
          this.preloadSVG(asset);
        }
      }
    }
  }

  /**
   * Preload an SVG asset
   */
  preloadSVG(asset: SVGAsset): void {
    try {
      const svg = Skia.SVG.MakeFromString(asset.svg);
      if (svg) {
        this.loadedSVGs.set(asset.id, svg);
      }
    } catch (error) {
      console.error(`Failed to preload SVG asset ${asset.id}:`, error);
    }
  }

  /**
   * Render face AR on the Skia canvas.
   * Called from the SkiaCamera onFrame worklet.
   *
   * @param canvas - Skia canvas from render callback
   * @param faces - Detected faces (already mapped to our DetectedFace structure)
   * @param frameWidth - Frame width in pixels
   * @param frameHeight - Frame height in pixels
   */
  render(
    canvas: SkCanvas,
    faces: DetectedFace[],
    frameWidth: number,
    frameHeight: number,
  ): void {
    if (!faces || faces.length === 0) return;

    for (const face of faces) {
      // Draw each active AR asset
      for (const assetId of this.activeAssetIds) {
        const asset = SVG_FACE_AR_ASSETS.find((a) => a.id === assetId);
        if (!asset) continue;

        const svg = this.loadedSVGs.get(assetId);
        if (!svg) continue;

        // Calculate transform
        const transform = calculateAssetTransform(
          face,
          asset.anchorPoint,
          asset.scale,
          0, // rotation offset
          asset.positionOffset,
        );

        // Save canvas state
        canvas.save();

        // Translate to the anchor point
        canvas.translate(transform.x, transform.y);

        // Rotate to face rotation
        canvas.rotate(transform.rotation);

        // Scale the SVG
        canvas.scale(transform.scale, transform.scale);

        // Draw the SVG centered on the anchor point
        // drawSvg renders at the given width/height from the current origin
        const svgWidth = svg.width();
        const svgHeight = svg.height();
        // Offset by -w/2, -h/2 to center, then draw at full size
        canvas.translate(-svgWidth / 2, -svgHeight / 2);
        canvas.drawSvg(svg, svgWidth, svgHeight);

        // Restore canvas state
        canvas.restore();
      }

      // Expression-triggered effects
      if (isSmiling(face, 0.7)) {
        this.drawEffect(canvas, face, 'hearts', frameWidth, frameHeight);
      }
      if (isBlinking(face, 0.3)) {
        this.drawEffect(canvas, face, 'stars', frameWidth, frameHeight);
      }
    }
  }

  /**
   * Draw an expression-triggered effect (hearts, stars)
   */
  private drawEffect(
    canvas: SkCanvas,
    face: DetectedFace,
    effectType: string,
    _frameWidth: number,
    _frameHeight: number,
  ): void {
    const centerX = (face.bounds.left + face.bounds.right) / 2;
    const centerY = face.bounds.top;

    canvas.save();

    const paint = Skia.Paint();
    paint.setAntiAlias(true);

    switch (effectType) {
      case 'hearts':
        paint.setColor(Skia.Color('#FF6B9D'));
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * 60;
          const y = centerY + Math.sin(angle) * 30 - 20;
          canvas.drawCircle(x, y, 6, paint);
        }
        break;
      case 'stars':
        paint.setColor(Skia.Color('#FFD700'));
        const leftEye = face.landmarks.leftEye;
        const rightEye = face.landmarks.rightEye;
        if (leftEye) {
          canvas.drawCircle(leftEye.x - 20, leftEye.y - 20, 5, paint);
        }
        if (rightEye) {
          canvas.drawCircle(rightEye.x + 20, rightEye.y - 20, 5, paint);
        }
        break;
    }

    canvas.restore();
  }

  /**
   * Cleanup loaded assets
   */
  dispose(): void {
    this.loadedSVGs.clear();
    this.activeAssetIds = [];
  }
}

/**
 * Singleton instance
 */
export const faceMeshRenderer = new FaceMeshRenderer();
