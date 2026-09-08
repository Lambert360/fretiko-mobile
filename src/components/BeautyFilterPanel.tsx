/**
 * BeautyFilterPanel
 *
 * TikTok/Snapchat-style beauty control panel with:
 * - Quick-select preset chips (None, Natural, Smooth, Glam, Doll, Porcelain)
 * - Expandable category sections (Skin, Reshape, Enhance)
 * - Smooth drag sliders with PanResponder for precise control
 * - Live value display
 * - Reset and close buttons
 * - Gradient background with rounded top corners
 *
 * The panel slides up from the bottom as a modal.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  PanResponder,
  LayoutChangeEvent,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  BeautyParams,
  BEAUTY_PRESETS,
  BEAUTY_PARAM_META,
  getParamsByCategory,
  BeautyPreset,
} from '../filters/faceAR/BeautyFilter';

const { width: screenWidth } = Dimensions.get('window');

interface BeautyFilterPanelProps {
  visible: boolean;
  params: BeautyParams;
  activePresetId: string;
  onParamsChange: (params: BeautyParams) => void;
  onPresetSelect: (preset: BeautyPreset) => void;
  onClose: () => void;
  onReset: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  skin: 'Skin',
  reshape: 'Reshape',
  enhance: 'Enhance',
};

const CATEGORY_ICONS: Record<string, string> = {
  skin: 'water',
  reshape: 'resize',
  enhance: 'sparkles',
};

export default function BeautyFilterPanel({
  visible,
  params,
  activePresetId,
  onParamsChange,
  onPresetSelect,
  onClose,
  onReset,
}: BeautyFilterPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('skin');

  const handleParamChange = useCallback(
    (key: keyof BeautyParams, value: number) => {
      onParamsChange({
        ...params,
        [key]: value,
      });
    },
    [params, onParamsChange]
  );

  const toggleCategory = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCategory((prev) => (prev === category ? null : category));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <LinearGradient
          colors={['rgba(20,20,30,0.98)', 'rgba(10,10,20,0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.panel}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="color-wand" size={22} color="#FF0050" />
              <Text style={styles.headerTitle}>Beauty</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={onReset} style={styles.resetButton}>
                <Ionicons name="refresh-outline" size={16} color="#999" />
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="chevron-down" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Preset chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.presetScroll}
            contentContainerStyle={styles.presetScrollContent}
          >
            {BEAUTY_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetChip,
                  activePresetId === preset.id && styles.presetChipActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onPresetSelect(preset);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                <Text
                  style={[
                    styles.presetName,
                    activePresetId === preset.id && styles.presetNameActive,
                  ]}
                >
                  {preset.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Category sections */}
          <ScrollView style={styles.paramsScroll} showsVerticalScrollIndicator={false}>
            {['skin', 'reshape', 'enhance'].map((category) => {
              const catParams = getParamsByCategory(category as any);
              const isExpanded = expandedCategory === category;

              return (
                <View key={category} style={styles.categorySection}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(category)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.categoryHeaderLeft}>
                      <View style={styles.categoryIconBg}>
                        <Ionicons
                          name={CATEGORY_ICONS[category] as any}
                          size={15}
                          color="#FF0050"
                        />
                      </View>
                      <Text style={styles.categoryTitle}>
                        {CATEGORY_LABELS[category]}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#666"
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.paramsList}>
                      {catParams.map((meta) => (
                        <BeautySlider
                          key={meta.key}
                          label={meta.label}
                          icon={meta.icon as any}
                          value={params[meta.key]}
                          max={meta.max}
                          onChange={(v) => handleParamChange(meta.key, v)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 30 }} />
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

/**
 * Individual beauty parameter slider with smooth PanResponder drag
 */
function BeautySlider({
  label,
  icon,
  value,
  max = 1,
  onChange,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const lastHapticValue = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const newValue = Math.max(0, Math.min(max, (x / trackWidth) * max));
        onChange(newValue);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const newValue = Math.max(0, Math.min(max, (x / trackWidth) * max));
        onChange(newValue);

        // Haptic feedback at 10% intervals
        const currentStep = Math.round(newValue * 10);
        const lastStep = Math.round(lastHapticValue.current * 10);
        if (currentStep !== lastStep) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          lastHapticValue.current = newValue;
        }
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const percent = (value / max) * 100;

  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderLabel}>
        <Ionicons name={icon as any} size={15} color="#CCC" />
        <Text style={styles.sliderLabelText}>{label}</Text>
      </View>

      <View
        style={styles.sliderTrackContainer}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              { width: `${percent}%` },
            ]}
          />
        </View>

        {/* Thumb */}
        <View
          style={[
            styles.sliderThumb,
            { left: `${percent}%` },
          ]}
        />
      </View>

      <Text style={styles.sliderValue}>{Math.round(value * 100)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    maxHeight: '78%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  resetText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  presetScroll: {
    maxHeight: 60,
  },
  presetScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetChipActive: {
    backgroundColor: 'rgba(255,0,80,0.15)',
    borderColor: '#FF0050',
  },
  presetEmoji: {
    fontSize: 16,
  },
  presetName: {
    color: '#CCC',
    fontSize: 13,
    fontWeight: '600',
  },
  presetNameActive: {
    color: '#FF0050',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    marginVertical: 4,
  },
  paramsScroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  categorySection: {
    marginBottom: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,0,80,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  paramsList: {
    gap: 2,
    paddingBottom: 8,
    paddingLeft: 36,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  sliderLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  sliderLabelText: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '500',
  },
  sliderTrackContainer: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#FF0050',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -9,
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderValue: {
    color: '#999',
    fontSize: 11,
    fontWeight: '600',
    width: 28,
    textAlign: 'right',
  },
});
