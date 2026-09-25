import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

interface GiftEffectStageProps {
  children: React.ReactNode;
}

/**
 * Bottom 45% overlay used to position full-screen gift Lottie effects
 * in the same area as the GiftLottiePreviewScreen stage.
 */
const GiftEffectStage: React.FC<GiftEffectStageProps> = ({ children }) => {
  return (
    <View style={styles.overlay} pointerEvents="none">
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    height: screenHeight * 0.45,
    zIndex: 9999,
    pointerEvents: 'none',
  },
});

export default GiftEffectStage;
