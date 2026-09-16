/**
 * FilterEditorScreen
 *
 * Applies filters, beauty, and AR to gallery images.
 * Uses static face detection (ML Kit) for AR overlay positioning.
 * Uses ColorMatrix for color + beauty on Android (CPU-safe).
 * Uses RuntimeEffect shaders on iOS (GPU).
 *
 * Usage:
 *   navigation.navigate('FilterEditor', {
 *     imageUri: 'file:///path/to/image.jpg',
 *     onExport: (filteredUri: string) => { ... }
 *   })
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Image as RNImage,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Canvas,
  Image as SkiaImage,
  ImageSVG,
  useImage,
  useCanvasRef,
  Skia,
  ImageFormat,
  Group,
  Rect as SkiaRect,
} from '@shopify/react-native-skia';
import FilterCarousel from '../components/FilterCarousel';
import FilterIntensitySlider from '../components/FilterIntensitySlider';
import { COLOR_FILTER_SHADER } from '../filters/shaders/colorFilterShader';
import { getFilterById } from '../filters/filterCatalog';
import { DEFAULT_COLOR_PARAMS, FilterDefinition, ColorFilterParams } from '../filters/types';
import { BEAUTY_PRESETS, BeautyPreset, DEFAULT_BEAUTY_PARAMS } from '../filters/faceAR/BeautyFilter';
import { SVG_FACE_AR_ASSETS, SVGAsset, AR_FIT } from '../filters/faceAR/faceARAssets';
import { computeARPlacement, sortEyes, ARPlacement } from '../filters/faceAR/arPlacement';
import { detectFaces, DetectedFace } from '../../modules/static-face-detection/src/StaticFaceDetection';
import * as FileSystem from 'expo-file-system/legacy';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Compile shader once (used on iOS)
const colorFilterEffect = Skia.RuntimeEffect.Make(COLOR_FILTER_SHADER);

type FilterEditorRouteProp = RouteProp<
  {
    FilterEditor: {
      imageUri: string;
      onExport?: (filteredUri: string) => void;
    };
  },
  'FilterEditor'
>;

export default function FilterEditorScreen() {
  const navigation = useNavigation();
  const route = useRoute<FilterEditorRouteProp>();
  const insets = useSafeAreaInsets();
  const canvasRef = useCanvasRef();

  // Editor always starts fresh and stays local — a new image is a new edit
  // session. Global camera preferences are not touched here.
  const [activeFilterId, setActiveFilterId] = useState('none');
  const [intensity, setIntensity] = useState(100);
  const [showSlider, setShowSlider] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [activeBeautyPreset, setActiveBeautyPreset] = useState('none');
  const [activeARAsset, setActiveARAsset] = useState<string | null>(null);
  const [detectedFace, setDetectedFace] = useState<DetectedFace | null>(null);
  const [faceImageDims, setFaceImageDims] = useState({ width: 0, height: 0 });

  const imageUri = route.params?.imageUri;
  const image = useImage(imageUri);

  // Get image dimensions
  useEffect(() => {
    if (imageUri) {
      RNImage.getSize(
        imageUri,
        (w, h) => setImageDimensions({ width: w, height: h }),
        (error) => console.error('Failed to get image size:', error)
      );
    }
  }, [imageUri]);

  // Run face detection on the static image
  useEffect(() => {
    if (!imageUri) return;
    detectFaces(imageUri).then((result) => {
      console.log(`🔍 Static face detection: ${result.faces.length} face(s), img ${result.imageWidth}x${result.imageHeight}`);
      if (result.faces.length > 0) {
        // Pick the LARGEST face — closest/most prominent subject in the frame
        const largest = result.faces.reduce((a, b) =>
          b.bounds.width * b.bounds.height > a.bounds.width * a.bounds.height ? b : a
        );
        setDetectedFace(largest);
        setFaceImageDims({ width: result.imageWidth, height: result.imageHeight });
      }
    }).catch((e) => {
      console.error('❌ Static face detection failed:', e);
    });
  }, [imageUri]);

  const currentFilter = getFilterById(activeFilterId);
  const params: ColorFilterParams = {
    ...DEFAULT_COLOR_PARAMS,
    ...currentFilter?.params,
  };
  const intensityNorm = intensity / 100;

  const currentBeautyPreset = BEAUTY_PRESETS.find((p) => p.id === activeBeautyPreset);
  const beautyParams = currentBeautyPreset?.params || DEFAULT_BEAUTY_PARAMS;

  const handleFilterSelect = useCallback((filter: FilterDefinition) => {
    setActiveFilterId(filter.id);
    setShowSlider(filter.id !== 'none');
    setIntensity(filter.intensityDefault ?? 100);
  }, []);

  const handleIntensityChange = useCallback((value: number) => {
    setIntensity(value);
  }, []);

  const handleBeautyPresetSelect = useCallback((preset: BeautyPreset) => {
    setActiveBeautyPreset(preset.id);
  }, []);

  const handleARAssetSelect = useCallback((assetId: string | null) => {
    setActiveARAsset(assetId);
  }, []);

  const handleExport = useCallback(async () => {
    if (isExporting || !canvasRef.current) return;
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const snapshot = canvasRef.current.makeImageSnapshot();
      if (!snapshot) {
        console.error('❌ Failed to create snapshot');
        return;
      }

      const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 90);
      const fileName = `filtered_${Date.now()}.jpg`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (route.params?.onExport) {
        route.params.onExport(filePath);
      }
      navigation.goBack();
    } catch (error) {
      console.error('❌ Export error:', error);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, canvasRef, navigation, route.params]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, []);

  if (!image) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading image...</Text>
      </View>
    );
  }

  // Calculate display dimensions to fit image on screen
  const maxDisplayWidth = screenWidth;
  const maxDisplayHeight = screenHeight * 0.6;
  const aspectRatio = imageDimensions.width / imageDimensions.height || 1;
  const displayWidth = Math.min(maxDisplayWidth, maxDisplayHeight * aspectRatio);
  const displayHeight = displayWidth / aspectRatio;

  // === Build combined color matrix for color filter + beauty (Android CPU-safe) ===
  const hasColorFilter = activeFilterId !== 'none' && intensityNorm > 0;
  const hasBeauty = activeBeautyPreset !== 'none';
  const hasAR = activeARAsset !== null && activeARAsset !== 'none' && detectedFace !== null;

  // Color filter params
  const i = intensityNorm;
  const b = hasColorFilter ? params.brightness * i : 0;
  const c = hasColorFilter ? params.contrast * i : 0;
  const s = hasColorFilter ? params.saturation * i : 0;
  const wWarm = hasColorFilter ? params.warmth * i * 0.15 : 0;
  const t = hasColorFilter ? params.tint * i * 0.1 : 0;
  const f = hasColorFilter ? params.fade * i : 0;

  // Beauty params (ColorMatrix approximation)
  const bSkin = hasBeauty ? beautyParams.skinSmoothing : 0;
  const bTone = hasBeauty ? beautyParams.skinTone : 0;
  const bGlowVal = hasBeauty ? beautyParams.glow : 0;
  const bSharpen = hasBeauty ? beautyParams.sharpening || 0 : 0;

  // Combined adjustments
  const totalBright = b + bGlowVal * 0.1 + bSkin * 0.05;
  const totalContrast = c + bSharpen * 0.3;
  const totalSat = s - bTone * 0.15;
  const skinWarm = wWarm + bTone * 0.05;

  // Saturation matrix needs an absolute factor where 1 = identity, 0 = grayscale.
  // totalSat is a delta (0 = neutral) → satM = 1 + totalSat.
  const satM = Math.max(0, 1 + totalSat);
  const rDiag = 0.299 + 0.701 * satM;
  const gOff = 0.587 * (1 - satM);
  const bOff = 0.114 * (1 - satM);
  const rOff = 0.299 * (1 - satM);
  const gDiag = 0.587 + 0.413 * satM;
  const bDiag = 0.114 + 0.886 * satM;
  const cf = 1 + totalContrast;
  const ff = 1 - 0.15 * f;
  const ft = 0.15 * f;

  const colorMatrix = [
    rDiag * cf * ff, gOff * cf * ff,  bOff * cf * ff, 0, (totalBright + skinWarm + t * 0.5 - 0.5 * totalContrast) * ff + ft,
    rOff * cf * ff,  gDiag * cf * ff, bOff * cf * ff, 0, (totalBright - t - 0.5 * totalContrast) * ff + ft,
    rOff * cf * ff,  gOff * cf * ff,  bDiag * cf * ff, 0, (totalBright - skinWarm + t * 0.5 - 0.5 * totalContrast) * ff + ft,
    0,              0,               0,               1, 0,
  ];

  const hasFilter = (hasColorFilter || hasBeauty);

  // Create paint with color filter
  let filterPaint: any = null;
  if (hasFilter && Platform.OS === 'android') {
    try {
      const paint = Skia.Paint();
      const cfVal = Skia.ColorFilter.MakeMatrix(colorMatrix);
      if (cfVal) {
        paint.setColorFilter(cfVal);
        filterPaint = paint;
      }
    } catch (e) {
      console.error('ColorFilter.MakeMatrix failed:', e);
    }
  }

  // === AR overlay positioning ===
  // The image is drawn with fit="contain" (letterboxed, centered).
  // Map face coords from image space to display space:
  //   fitScale = min(displayW/imgW, displayH/imgH)
  //   displayed = imgW*fitScale x imgH*fitScale, centered in the canvas
  //   displayCoord = imgCoord*fitScale + centerOffset
  const arFitScale = Math.min(
    displayWidth / (faceImageDims.width || 1),
    displayHeight / (faceImageDims.height || 1)
  );
  const arOffsetX = (displayWidth - faceImageDims.width * arFitScale) / 2;
  const arOffsetY = (displayHeight - faceImageDims.height * arFitScale) / 2;

  let arElements: React.ReactNode[] = [];
  if (hasAR && detectedFace && detectedFace.landmarks) {
    const lm = detectedFace.landmarks;
    const eyeA = lm.LEFT_EYE;
    const eyeB = lm.RIGHT_EYE;
    const nose = lm.NOSE_BASE;
    const mouth = lm.MOUTH_BOTTOM || lm.MOUTH_LEFT;

    if (eyeA && eyeB) {
      const toDisplay = (p: { x: number; y: number }) => ({
        x: p.x * arFitScale + arOffsetX,
        y: p.y * arFitScale + arOffsetY,
      });
      const { leftEye, rightEye } = sortEyes(toDisplay(eyeA), toDisplay(eyeB));

      const asset = SVG_FACE_AR_ASSETS.find((a) => a.id === activeARAsset);
      const fit = asset ? AR_FIT[asset.id] : undefined;
      if (asset && fit) {
        const svg = Skia.SVG.MakeFromString(asset.svg);
        const svgW = svg?.width() || 200;
        const placement = computeARPlacement(
          fit,
          {
            leftEye,
            rightEye,
            nose: nose ? toDisplay(nose) : undefined,
            mouth: mouth ? toDisplay(mouth) : undefined,
            faceCenter: {
              x: (detectedFace.bounds.x + detectedFace.bounds.width / 2) * arFitScale + arOffsetX,
              y: (detectedFace.bounds.y + detectedFace.bounds.height / 2) * arFitScale + arOffsetY,
            },
          },
          svgW
        );
        if (placement) {
          arElements.push(
            <ARAssetView
              key={asset.id}
              asset={asset}
              placement={placement}
            />
          );
        }
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Image with filter preview */}
      <View style={styles.imageContainer}>
        <Canvas ref={canvasRef} style={{ width: displayWidth, height: displayHeight }}>
          {hasFilter && filterPaint ? (
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={displayWidth}
              height={displayHeight}
              fit="contain"
              paint={filterPaint}
            />
          ) : hasFilter && colorFilterEffect ? (
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={displayWidth}
              height={displayHeight}
              fit="contain"
            />
          ) : (
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={displayWidth}
              height={displayHeight}
              fit="contain"
            />
          )}
          {arElements}
        </Canvas>
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit</Text>
        <View style={styles.closeButton} />
      </View>

      {/* Intensity slider */}
      <FilterIntensitySlider
        intensity={intensity}
        onIntensityChange={handleIntensityChange}
        visible={showSlider}
      />

      {/* Filter carousel with all 3 modes */}
      <FilterCarousel
        activeFilterId={activeFilterId}
        activeBeautyPresetId={activeBeautyPreset}
        activeARAssetId={activeARAsset || undefined}
        onFilterSelect={handleFilterSelect}
        onBeautyPresetSelect={handleBeautyPresetSelect}
        onARAssetSelect={handleARAssetSelect}
        onOpenBeautyPanel={() => {}}
        onBeforeAfterToggle={() => {}}
      />

      {/* Bottom export bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={handleExport}
          disabled={isExporting}
          style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
          activeOpacity={0.8}
        >
          <Text style={styles.exportButtonText}>
            {isExporting ? 'Saving...' : 'Done'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// === AR Asset View Component ===
// Renders an SVG asset using a similarity placement: the SVG's reference
// midpoint lands on (cx, cy), scaled + rotated to match the face's geometry.
function ARAssetView({
  asset,
  placement,
}: {
  asset: SVGAsset;
  placement: ARPlacement;
}) {
  // asset.svg is an inline SVG string — useSVG() would treat it as a URI and
  // fail to load. Parse it directly with MakeFromString instead.
  const svg = React.useMemo(() => {
    try {
      return Skia.SVG.MakeFromString(asset.svg);
    } catch {
      return null;
    }
  }, [asset.svg]);

  if (!svg) return null;

  const svgWidth = svg.width();
  const svgHeight = svg.height();
  const renderWidth = svgWidth * placement.scale;
  const renderHeight = svgHeight * placement.scale;
  // position so the ref midpoint lands exactly on (cx, cy)
  const offsetX =
    placement.cx - placement.refMidX * placement.scale;
  const offsetY =
    placement.cy - placement.refMidY * placement.scale;

  return (
    <Group
      transform={[{ rotate: (placement.rotationDeg * Math.PI) / 180 }]}
      origin={{ x: placement.cx, y: placement.cy }}
    >
      <ImageSVG
        svg={svg}
        x={offsetX}
        y={offsetY}
        width={renderWidth}
        height={renderHeight}
      />
    </Group>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  exportButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 28,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
