/**
 * FilterCameraScreen
 *
 * Full-screen camera with real-time filters, beauty controls, face AR,
 * filter carousel (3 modes: Color/Beauty/AR), intensity slider,
 * capture button, camera switch, and long-press before/after.
 *
 * Integrates FilterContext for persistent filter + beauty state.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FilterCameraView, { FilterCameraViewRef } from '../components/FilterCameraView';
import FilterCarousel from '../components/FilterCarousel';
import FilterIntensitySlider from '../components/FilterIntensitySlider';
import BeautyFilterPanel from '../components/BeautyFilterPanel';
import { FilterDefinition } from '../filters/types';
import { useCameraFilterContext as useFilterContext } from '../contexts/CameraFilterContext';
import { BeautyPreset, BeautyParams } from '../filters/faceAR/BeautyFilter';

const { width: screenWidth } = Dimensions.get('window');

type FilterCameraRouteProp = RouteProp<
  {
    FilterCamera: {
      mode?: 'photo' | 'video';
      onCapture?: (dataUri: string) => void;
      initialFilterId?: string;
    };
    FilterEditor: {
      imageUri: string;
      onExport?: (filteredUri: string) => void;
    };
  },
  'FilterCamera'
>;

export default function FilterCameraScreen() {
  const navigation = useNavigation();
  const route = useRoute<FilterCameraRouteProp>();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<FilterCameraViewRef>(null);

  const {
    filterId,
    filterIntensity,
    setFilter,
    beautyParams,
    beautyPresetId,
    setBeautyParams,
    setBeautyPreset,
    resetBeauty,
    arAssetId,
    setARAsset,
  } = useFilterContext();

  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [showBeautyPanel, setShowBeautyPanel] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [flashMode, setFlashMode] = useState(false);

  const mode = route.params?.mode || 'photo';

  // Cancel recording on unmount
  useEffect(() => {
    return () => {
      if (cameraRef.current?.isRecording()) {
        cameraRef.current?.cancelRecording();
      }
    };
  }, []);

  const handleFilterSelect = useCallback(
    (filter: FilterDefinition) => {
      setFilter(filter.id, filter.intensityDefault ?? 100);
      setShowSlider(filter.id !== 'none');
      cameraRef.current?.setFilter(filter.id, filter.intensityDefault ?? 100);
    },
    [setFilter]
  );

  const handleBeautyPresetSelect = useCallback(
    (preset: BeautyPreset) => {
      setBeautyPreset(preset);
      cameraRef.current?.setBeautyParams(preset.params);
    },
    [setBeautyPreset]
  );

  const handleARAssetSelect = useCallback(
    (assetId: string | null) => {
      setARAsset(assetId);
      cameraRef.current?.setARAsset(assetId);
    },
    [setARAsset]
  );

  const handleBeautyParamsChange = useCallback(
    (params: BeautyParams) => {
      setBeautyParams(params);
      cameraRef.current?.setBeautyParams(params);
    },
    [setBeautyParams]
  );

  const handleResetBeauty = useCallback(() => {
    resetBeauty();
    cameraRef.current?.resetBeauty();
  }, [resetBeauty]);

  const handleIntensityChange = useCallback(
    (value: number) => {
      setFilter(filterId, value);
      cameraRef.current?.setIntensity(value);
    },
    [filterId, setFilter]
  );

  const handleCapture = useCallback(async () => {
    if (mode === 'video') {
      // Video mode: toggle recording
      if (isRecording) {
        // Stop recording
        try {
          const videoPath = await cameraRef.current?.stopRecording();
          if (videoPath) {
            if (route.params?.onCapture) {
              route.params.onCapture(videoPath);
            }
            navigation.goBack();
          }
        } catch (error) {
          console.error('❌ Stop recording error:', error);
        } finally {
          setIsRecording(false);
        }
      } else {
        // Start recording
        try {
          setIsCapturing(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await cameraRef.current?.startRecording({ fps: 30, enableAudio: true });
          setIsRecording(true);
        } catch (error) {
          console.error('❌ Start recording error:', error);
        } finally {
          setIsCapturing(false);
        }
      }
      return;
    }

    // Photo mode: take snapshot
    if (isCapturing) return;
    setIsCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const dataUri = cameraRef.current?.takeSnapshot();
      if (dataUri) {
        if (route.params?.onCapture) {
          route.params.onCapture(dataUri);
        }
        navigation.goBack();
      }
    } catch (error) {
      console.error('❌ Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, isRecording, mode, navigation, route.params]);

  const handleSwitchCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }, []);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, []);

  const handleGallery = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const uri = result.assets[0].uri;
      // Navigate to FilterEditorScreen to apply filters/beauty/AR before posting
      (navigation as any).navigate('FilterEditor', {
        imageUri: uri,
        onExport: (filteredUri: string) => {
          if (route.params?.onCapture) {
            route.params.onCapture(filteredUri);
          }
          navigation.goBack();
        },
      });
    }
  }, [navigation, route.params]);

  const handleFlashToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlashMode((prev) => !prev);
  }, []);

  const handleBeforeAfterToggle = useCallback(
    (showing: boolean) => {
      setShowingOriginal(showing);
      if (showing) {
        // Temporarily disable all filters
        cameraRef.current?.setFilter('none', 0);
      } else {
        // Restore filters
        cameraRef.current?.setFilter(filterId, filterIntensity);
      }
    },
    [filterId, filterIntensity]
  );

  return (
    <View style={styles.container}>
      {/* Camera with live filter + beauty + AR preview */}
      <FilterCameraView
        ref={cameraRef}
        device={facing}
        isActive={true}
        initialFilterId={filterId}
        initialIntensity={filterIntensity}
        initialBeautyParams={beautyParams}
        initialARAssetId={arAssetId}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.topCenter}>
          <Text style={styles.modeLabel}>
            {mode === 'video' ? 'Video' : 'Photo'}
          </Text>
          {showingOriginal && (
            <View style={styles.originalBadge}>
              <Ionicons name="eye-outline" size={12} color="#FFF" />
              <Text style={styles.originalBadgeText}>Original</Text>
            </View>
          )}
        </View>

        <View style={styles.topRight}>
          <TouchableOpacity onPress={handleFlashToggle} style={styles.iconButtonSmall}>
            <Ionicons
              name={flashMode ? 'flash' : 'flash-off'}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSwitchCamera} style={styles.iconButtonSmall}>
            <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Intensity slider (shown when a color filter is active) */}
      <FilterIntensitySlider
        intensity={filterIntensity}
        onIntensityChange={handleIntensityChange}
        visible={showSlider && !showingOriginal}
      />

      {/* Filter carousel with color/beauty/AR modes */}
      <FilterCarousel
        activeFilterId={filterId}
        activeBeautyPresetId={beautyPresetId}
        activeARAssetId={arAssetId ?? undefined}
        onFilterSelect={handleFilterSelect}
        onBeautyPresetSelect={handleBeautyPresetSelect}
        onARAssetSelect={handleARAssetSelect}
        onOpenBeautyPanel={() => setShowBeautyPanel(true)}
        onBeforeAfterToggle={handleBeforeAfterToggle}
      />

      {/* Bottom capture bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        {/* Gallery shortcut */}
        <TouchableOpacity style={styles.galleryButton} onPress={handleGallery}>
          <Ionicons name="images-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Capture button */}
        <TouchableOpacity
          onPress={handleCapture}
          disabled={isCapturing && !isRecording}
          style={[
            styles.captureButton,
            isCapturing && !isRecording && styles.captureButtonDisabled,
            isRecording && styles.captureButtonRecording,
          ]}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.captureButtonInner,
              isRecording && styles.captureButtonInnerRecording,
            ]}
          />
        </TouchableOpacity>

        {/* Beauty panel shortcut */}
        <TouchableOpacity
          style={styles.beautyButton}
          onPress={() => setShowBeautyPanel(true)}
        >
          <Ionicons name="color-wand" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Beauty filter panel (modal) */}
      <BeautyFilterPanel
        visible={showBeautyPanel}
        params={beautyParams}
        activePresetId={beautyPresetId}
        onParamsChange={handleBeautyParamsChange}
        onPresetSelect={handleBeautyPresetSelect}
        onClose={() => setShowBeautyPanel(false)}
        onReset={handleResetBeauty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  topCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  originalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  originalBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
    zIndex: 20,
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonRecording: {
    borderColor: '#FF3B30',
  },
  captureButtonInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  beautyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
