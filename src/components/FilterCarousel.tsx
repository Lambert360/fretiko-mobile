/**
 * FilterCarousel
 *
 * State-of-the-art filter selector with 3 modes:
 * - Color filters (Original, Vivid, Warm, Cool, Vintage, etc.)
 * - Beauty presets (Natural, Smooth, Glam, Doll, Porcelain)
 * - Face AR (Dog Ears, Cat Ears, Crown, Glasses, etc.)
 *
 * Features:
 * - TikTok/SnapChat-style horizontal scroll with snap-to-item
 * - Active item scales up with white ring + glow
 * - Mode toggle pills at top (Filters / Beauty / AR)
 * - Fine-tune button opens BeautyFilterPanel
 * - Haptic feedback on selection
 * - Auto-scroll to active item
 * - Long-press for before/after comparison (releases filter temporarily)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ViewStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FILTER_CATALOG } from '../filters/filterCatalog';
import { FilterDefinition } from '../filters/types';
import { BEAUTY_PRESETS, BeautyPreset } from '../filters/faceAR/BeautyFilter';
import { SVG_FACE_AR_ASSETS } from '../filters/faceAR/faceARAssets';

const { width: screenWidth } = Dimensions.get('window');

const THUMB_SIZE = 60;
const THUMB_SPACING = 10;
const ACTIVE_SCALE = 1.15;

type CarouselMode = 'color' | 'beauty' | 'ar';

interface FilterCarouselProps {
  activeFilterId: string;
  activeBeautyPresetId?: string;
  activeARAssetId?: string;
  onFilterSelect: (filter: FilterDefinition) => void;
  onBeautyPresetSelect?: (preset: BeautyPreset) => void;
  onARAssetSelect?: (assetId: string | null) => void;
  onOpenBeautyPanel?: () => void;
  onBeforeAfterToggle?: (showingOriginal: boolean) => void;
  style?: ViewStyle;
}

export default function FilterCarousel({
  activeFilterId,
  activeBeautyPresetId = 'none',
  activeARAssetId,
  onFilterSelect,
  onBeautyPresetSelect,
  onARAssetSelect,
  onOpenBeautyPanel,
  onBeforeAfterToggle,
  style,
}: FilterCarouselProps) {
  const [mode, setMode] = useState<CarouselMode>('color');
  const [showingOriginal, setShowingOriginal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const modeAnim = useRef(new Animated.Value(0)).current;

  const colorItems = FILTER_CATALOG;
  const beautyItems = BEAUTY_PRESETS;
  const arItems = SVG_FACE_AR_ASSETS;

  const activeIndex =
    mode === 'color'
      ? colorItems.findIndex((f) => f.id === activeFilterId)
      : mode === 'beauty'
      ? beautyItems.findIndex((p) => p.id === activeBeautyPresetId)
      : activeARAssetId
      ? arItems.findIndex((a) => a.id === activeARAssetId) + 1 // +1 for "None"
      : 0;

  // Auto-scroll to active item
  useEffect(() => {
    if (activeIndex >= 0 && scrollViewRef.current) {
      const offset =
        activeIndex * (THUMB_SIZE + THUMB_SPACING) - screenWidth / 2 + THUMB_SIZE / 2;
      scrollViewRef.current.scrollTo({
        x: Math.max(0, offset),
        animated: true,
      });
    }
  }, [activeIndex, mode]);

  const handleSelect = (filter: FilterDefinition) => {
    if (filter.id !== activeFilterId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFilterSelect(filter);
    }
  };

  const handleBeautySelect = (preset: BeautyPreset) => {
    if (preset.id !== activeBeautyPresetId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onBeautyPresetSelect?.(preset);
    }
  };

  const handleARSelect = (assetId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onARAssetSelect?.(assetId);
  };

  const switchMode = (newMode: CarouselMode) => {
    if (newMode !== mode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMode(newMode);
      Animated.spring(modeAnim, {
        toValue: newMode === 'color' ? 0 : newMode === 'beauty' ? 1 : 2,
        useNativeDriver: false,
        tension: 300,
        friction: 20,
      }).start();
    }
  };

  const handleLongPress = () => {
    if (!showingOriginal) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowingOriginal(true);
      onBeforeAfterToggle?.(true);
    }
  };

  const handleLongPressOut = () => {
    if (showingOriginal) {
      setShowingOriginal(false);
      onBeforeAfterToggle?.(false);
    }
  };

  const modeIndicatorLeft = modeAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0%', '33.33%', '66.66%'],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Mode toggle pills */}
      <View style={styles.modeToggleContainer}>
        <View style={styles.modeToggleBg}>
          <Animated.View
            style={[
              styles.modeIndicator,
              { left: modeIndicatorLeft },
            ]}
          />
          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => switchMode('color')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="color-filter"
              size={13}
              color={mode === 'color' ? '#FF0050' : '#999'}
            />
            <Text style={[styles.modeText, mode === 'color' && styles.modeTextActive]}>
              Filters
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => switchMode('beauty')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="color-wand"
              size={13}
              color={mode === 'beauty' ? '#FF0050' : '#999'}
            />
            <Text style={[styles.modeText, mode === 'beauty' && styles.modeTextActive]}>
              Beauty
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => switchMode('ar')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="happy"
              size={13}
              color={mode === 'ar' ? '#FF0050' : '#999'}
            />
            <Text style={[styles.modeText, mode === 'ar' && styles.modeTextActive]}>
              AR
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fine-tune button — only in beauty mode */}
        {mode === 'beauty' && onOpenBeautyPanel && (
          <TouchableOpacity
            style={styles.fineTuneButton}
            onPress={onOpenBeautyPanel}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={15} color="#FFF" />
            <Text style={styles.fineTuneText}>Tune</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={THUMB_SIZE + THUMB_SPACING}
        decelerationRate="fast"
      >
        {mode === 'color' &&
          colorItems.map((filter) => {
            const isActive = filter.id === activeFilterId;
            return (
              <TouchableOpacity
                key={filter.id}
                style={styles.thumbContainer}
                onPress={() => handleSelect(filter)}
                onLongPress={handleLongPress}
                onPressOut={handleLongPressOut}
                delayLongPress={300}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.thumbnail,
                    { backgroundColor: filter.thumbnailColor },
                    isActive && styles.thumbnailActive,
                  ]}
                >
                  {filter.category === 'none' && (
                    <Ionicons name="close" size={22} color="#333" />
                  )}
                  {filter.category === 'face_ar' && (
                    <Ionicons name="happy-outline" size={26} color="#FFF" />
                  )}
                  {filter.category === 'beauty' && (
                    <Ionicons name="sparkles" size={26} color="#FFF" />
                  )}
                  {filter.category === 'color' && filter.id !== 'none' && (
                    <View style={styles.colorPreview} />
                  )}
                </View>
                <Text
                  style={[styles.label, isActive && styles.labelActive]}
                  numberOfLines={1}
                >
                  {filter.name}
                </Text>
                {isActive && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}

        {mode === 'beauty' &&
          beautyItems.map((preset) => {
            const isActive = preset.id === activeBeautyPresetId;
            return (
              <TouchableOpacity
                key={preset.id}
                style={styles.thumbContainer}
                onPress={() => handleBeautySelect(preset)}
                onLongPress={handleLongPress}
                onPressOut={handleLongPressOut}
                delayLongPress={300}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.thumbnail,
                    { backgroundColor: getBeautyColor(preset.id) },
                    isActive && styles.thumbnailActive,
                  ]}
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                </View>
                <Text
                  style={[styles.label, isActive && styles.labelActive]}
                  numberOfLines={1}
                >
                  {preset.name}
                </Text>
                {isActive && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}

        {mode === 'ar' && (
          <>
            {/* None option */}
            <TouchableOpacity
              style={styles.thumbContainer}
              onPress={() => handleARSelect(null)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.thumbnail,
                  { backgroundColor: '#333' },
                  !activeARAssetId && styles.thumbnailActive,
                ]}
              >
                <Ionicons name="close" size={22} color="#FFF" />
              </View>
              <Text
                style={[styles.label, !activeARAssetId && styles.labelActive]}
                numberOfLines={1}
              >
                None
              </Text>
              {!activeARAssetId && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {arItems.map((asset) => {
              const isActive = activeARAssetId === asset.id;
              return (
                <TouchableOpacity
                  key={asset.id}
                  style={styles.thumbContainer}
                  onPress={() => handleARSelect(asset.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.thumbnail,
                      { backgroundColor: getARColor(asset.category) },
                      isActive && styles.thumbnailActive,
                    ]}
                  >
                    <Text style={styles.arEmoji}>{getAREmoji(asset.id)}</Text>
                  </View>
                  <Text
                    style={[styles.label, isActive && styles.labelActive]}
                    numberOfLines={1}
                  >
                    {asset.name}
                  </Text>
                  {isActive && <View style={styles.activeDot} />}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Before/after hint */}
      {showingOriginal && (
        <View style={styles.beforeAfterHint}>
          <Ionicons name="eye-outline" size={14} color="#FFF" />
          <Text style={styles.beforeAfterText}>Original</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Get background color for beauty preset thumbnails
 */
function getBeautyColor(presetId: string): string {
  switch (presetId) {
    case 'none': return '#333';
    case 'natural': return '#7BC47F';
    case 'smooth': return '#9B8EC4';
    case 'glam': return '#E84393';
    case 'doll': return '#FD79A8';
    case 'porcelain': return '#DFE6E9';
    default: return '#666';
  }
}

/**
 * Get background color for AR asset thumbnails by category
 */
function getARColor(category: string): string {
  switch (category) {
    case 'ears': return '#8B5E3C';
    case 'glasses': return '#2D3436';
    case 'hat': return '#FFD700';
    case 'sticker': return '#FF6B6B';
    case 'effect': return '#6C5CE7';
    default: return '#666';
  }
}

/**
 * Get emoji for AR asset thumbnails
 */
function getAREmoji(assetId: string): string {
  switch (assetId) {
    case 'dog_ears': return '🐶';
    case 'cat_ears': return '🐱';
    case 'bunny_ears': return '🐰';
    case 'sunglasses': return '🕶️';
    case 'heart_glasses': return '😍';
    case 'crown': return '👑';
    case 'flower_crown': return '🌸';
    case 'clown_nose': return '🤡';
    case 'mustache': return '👨';
    case 'sparkles': return '✨';
    default: return '🎭';
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  modeToggleBg: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 3,
    position: 'relative',
  },
  modeIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '33.33%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 17,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 17,
    zIndex: 1,
  },
  modeText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FF0050',
  },
  fineTuneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginLeft: 6,
  },
  fineTuneText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: screenWidth / 2 - THUMB_SIZE / 2,
    alignItems: 'flex-start',
  },
  thumbContainer: {
    alignItems: 'center',
    marginRight: THUMB_SPACING,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  thumbnailActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: ACTIVE_SCALE }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  presetEmoji: {
    fontSize: 24,
  },
  arEmoji: {
    fontSize: 24,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginTop: 3,
  },
  beforeAfterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  beforeAfterText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
  },
});
