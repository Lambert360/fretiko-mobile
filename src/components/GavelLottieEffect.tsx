import React from 'react';
import LottieGiftEffect from './LottieGiftEffect';

// Bundled gavel animation — same asset the GiftLottiePreviewScreen previews.
const GAVEL_LOTTIE_MODULE = require('../../assets/lottie/gavel.lottie');

// Gift-shaped config consumed by LottieGiftEffect. No sound_url: the host
// already plays the gavel sound via expo-audio and viewers hear it through
// the live stream — this effect is visual only.
const GAVEL_GIFT = {
  id: 'auction-gavel',
  name: 'Gavel',
  emoji: '🔨',
  quantity: 1,
  lottie_config: { lottieUrl: GAVEL_LOTTIE_MODULE },
  animation_type: 'lottie_single' as const,
};

interface GavelLottieEffectProps {
  onComplete?: () => void;
}

const GavelLottieEffect: React.FC<GavelLottieEffectProps> = ({ onComplete }) => (
  <LottieGiftEffect gift={GAVEL_GIFT} onComplete={onComplete} />
);

export default GavelLottieEffect;
