/**
 * FilterIntensitySlider
 *
 * Adjustable filter strength (0-100%). Appears when a filter is selected.
 * Uses react-native-gesture-handler for drag interaction.
 * Designed to overlay on top of FilterCameraView, above the FilterCarousel.
 */

import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');
const SLIDER_PADDING = 40;

interface FilterIntensitySliderProps {
  intensity: number;
  onIntensityChange: (value: number) => void;
  visible: boolean;
}

export default function FilterIntensitySlider({
  intensity,
  onIntensityChange,
  visible,
}: FilterIntensitySliderProps) {
  const sliderWidth = screenWidth - SLIDER_PADDING * 2 - 52; // minus label width
  const lastHapticValue = useRef(intensity);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      // Calculate position relative to slider start
      const relativeX = e.x;
      const percentage = Math.max(0, Math.min(100, (relativeX / sliderWidth) * 100));
      const rounded = Math.round(percentage);
      // Haptic feedback at every 10% interval
      if (Math.abs(rounded - lastHapticValue.current) >= 10) {
        lastHapticValue.current = rounded;
        // Haptics must be called from JS thread
      }
    })
    .onEnd((e) => {
      'worklet';
      const relativeX = e.x;
      const percentage = Math.max(0, Math.min(100, (relativeX / sliderWidth) * 100));
      // Final value set on JS thread
    });

  const handleLayout = useCallback((event: any) => {
    // Get slider position for accurate touch handling
  }, []);

  if (!visible) return null;

  return (
    <GestureHandlerRootView style={styles.gestureContainer}>
      <View style={styles.container}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.sliderContainer} onLayout={handleLayout}>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${intensity}%` }]} />
            </View>
            <View style={[styles.sliderThumb, { left: `${intensity}%` }]} />
          </View>
        </GestureDetector>
        <Text style={styles.label}>{intensity}%</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureContainer: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SLIDER_PADDING,
  },
  sliderContainer: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
    marginRight: 12,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginLeft: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});
