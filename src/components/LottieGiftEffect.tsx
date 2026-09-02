import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import LottieView from 'lottie-react-native';
import { useAudioPlayer } from 'expo-audio';
import GiftAnimation from './GiftAnimation';
import { getCachedAssetUri } from '../utils/giftAssetCache';

interface LottieStep {
  lottieUrl: string;
  label?: string;
  delayMs?: number;
}

interface LottieGiftEffectProps {
  gift: {
    id: string;
    name: string;
    emoji: string;
    quantity: number;
    display_lottie_url?: string;
    lottie_config?: any;
    sound_url?: string;
    animation_type?: 'lottie_single' | 'lottie_combo' | 'lottie_overlap' | string;
    senderName?: string;
  };
  onComplete?: () => void;
}

interface LottieConfig {
  lottieUrl?: string;
  steps?: LottieStep[];
}

const LottieGiftEffect: React.FC<LottieGiftEffectProps> = ({ gift, onComplete }) => {
  const [visible, setVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const rawLottieConfig: LottieConfig | null = gift.lottie_config
    ? gift.lottie_config
    : gift.display_lottie_url
    ? { lottieUrl: gift.display_lottie_url }
    : null;

  const hasLottie = !!rawLottieConfig && (!!rawLottieConfig.lottieUrl || !!rawLottieConfig.steps);

  const [cachedLottieConfig, setCachedLottieConfig] = useState<LottieConfig | null>(null);
  const [cachedSoundUrl, setCachedSoundUrl] = useState<string | number | undefined>(gift.sound_url);

  const player = useAudioPlayer(cachedSoundUrl || null);

  const [lottieDone, setLottieDone] = useState(false);
  const [soundDone, setSoundDone] = useState(!gift.sound_url);
  const [activeSteps, setActiveSteps] = useState<boolean[]>([]);
  const [doneSteps, setDoneSteps] = useState<boolean[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const soundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCombo = gift.animation_type === 'lottie_combo';
  const isOverlap = gift.animation_type === 'lottie_overlap';

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (rawLottieConfig?.lottieUrl) {
        const local = await getCachedAssetUri(rawLottieConfig.lottieUrl);
        if (isMounted) {
          setCachedLottieConfig({ lottieUrl: (local as string) || rawLottieConfig.lottieUrl });
        }
      } else if (rawLottieConfig?.steps) {
        const steps = await Promise.all(
          rawLottieConfig.steps.map(async (s) => ({
            ...s,
            lottieUrl: ((await getCachedAssetUri(s.lottieUrl)) as string) || s.lottieUrl,
          }))
        );
        if (isMounted) {
          setCachedLottieConfig({ steps });
        }
      }
      const localSound = await getCachedAssetUri(gift.sound_url);
      if (isMounted) {
        setCachedSoundUrl((localSound as string | number | undefined) || gift.sound_url);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [rawLottieConfig, gift.sound_url]);

  const workingConfig = cachedLottieConfig || rawLottieConfig;

  useEffect(() => {
    if (!hasLottie || !workingConfig) return;

    const steps = workingConfig?.steps || [{ lottieUrl: workingConfig?.lottieUrl || '', delayMs: 0 }];
    const initialActive = new Array(steps.length).fill(false);
    initialActive[0] = true;
    setActiveSteps(initialActive);
    setDoneSteps(new Array(steps.length).fill(false));

    if (isCombo) {
      // Combo mode: start step 0, then each step triggers the next on completion
      return () => {
        timers.current.forEach(clearTimeout);
      };
    }

    // Overlap / single mode: schedule steps by delayMs
    steps.forEach((step, index) => {
      const delay = step.delayMs || 0;
      const timer = setTimeout(() => {
        setActiveSteps((prev) => {
          const next = [...prev];
          next[index] = true;
          return next;
        });
      }, delay);
      timers.current.push(timer);
    });

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, [hasLottie, workingConfig, isCombo, isOverlap]);

  // Combo: advance to the next step as soon as the previous one finishes
  useEffect(() => {
    if (!isCombo) return;
    const nextIndex = doneSteps.findIndex((done, i) => done && i + 1 < doneSteps.length && !activeSteps[i + 1]);
    if (nextIndex === -1) return;
    setActiveSteps((prev) => {
      const next = [...prev];
      next[nextIndex] = false;
      next[nextIndex + 1] = true;
      return next;
    });
  }, [doneSteps, isCombo, activeSteps]);

  useEffect(() => {
    if (cachedSoundUrl && player) {
      try {
        player.seekTo(0);
        player.play();
        const durationMs = player.duration && player.duration > 0 ? player.duration * 1000 : 2500;
        soundTimer.current = setTimeout(() => setSoundDone(true), durationMs);
      } catch (error) {
        console.warn('LottieGiftEffect: failed to play sound', error);
        setSoundDone(true);
      }
    }
    return () => {
      if (soundTimer.current) clearTimeout(soundTimer.current);
    };
  }, [cachedSoundUrl, player]);

  useEffect(() => {
    if (lottieDone && soundDone) {
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
          onComplete?.();
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [lottieDone, soundDone, fadeAnim, onComplete]);

  const handleStepFinish = (index: number) => {
    setDoneSteps((prev) => {
      const next = [...prev];
      next[index] = true;
      if (next.every(Boolean)) {
        setLottieDone(true);
      }
      return next;
    });
  };

  if (!hasLottie) {
    return <GiftAnimation emoji={gift.emoji} quantity={gift.quantity} onComplete={onComplete} />;
  }

  if (!visible) return null;

  const steps = workingConfig?.steps || [{ lottieUrl: workingConfig?.lottieUrl || '', delayMs: 0 }];

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      pointerEvents="none"
    >
      <View style={styles.stage}>
        {steps.map((step, index) =>
          activeSteps[index] ? (
            <LottieView
              key={`${gift.id}-${index}`}
              source={{ uri: step.lottieUrl }}
              autoPlay
              loop={false}
              style={isOverlap ? styles.lottieOverlap : styles.lottie}
              resizeMode="contain"
              onAnimationFinish={() => handleStepFinish(index)}
            />
          ) : null
        )}
        {gift.quantity > 1 && (
          <View style={styles.quantityBadge}>
            <Animated.Text style={styles.quantityText}>x{gift.quantity}</Animated.Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    width: '100%',
    height: '70%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lottie: {
    width: 280,
    height: 280,
  },
  lottieOverlap: {
    ...StyleSheet.absoluteFillObject,
  },
  quantityBadge: {
    position: 'absolute',
    bottom: '35%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quantityText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LottieGiftEffect;
