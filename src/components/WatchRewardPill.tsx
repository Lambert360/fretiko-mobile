import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { liveSalesAPI, GamificationConfig, ViewerRewardProgress } from '../services/liveSalesAPI';

interface WatchRewardPillProps {
  streamId: string;
  mode?: 'pill' | 'inline';
}

const WatchRewardPill: React.FC<WatchRewardPillProps> = ({ streamId, mode = 'pill' }) => {
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [progress, setProgress] = useState<ViewerRewardProgress | null>(null);
  const [earnedAmount, setEarnedAmount] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchData = useCallback(async () => {
    try {
      const cfg = await liveSalesAPI.getGamificationConfig();
      setConfig(cfg);
      if (cfg?.watch_rewards_enabled) {
        const p = await liveSalesAPI.getWatchRewardProgress(streamId);
        setProgress(p);
      } else {
        setProgress(null);
      }
    } catch (error) {
      console.error('WatchRewardPill error:', error);
    }
  }, [streamId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setNow(Date.now());
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (progress && progress.total_credited_freti > 0 && progress.total_credited_freti !== (earnedAmount || 0)) {
      setEarnedAmount(progress.total_credited_freti);
    }
  }, [progress?.total_credited_freti]);

  useEffect(() => {
    if (earnedAmount !== null) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ]).start(() => {
        setTimeout(() => setEarnedAmount(null), 3000);
      });
    }
  }, [earnedAmount, pulseAnim]);

  if (!config || !config.watch_rewards_enabled) return null;

  const sessionStart = progress?.session_start
    ? new Date(progress.session_start).getTime()
    : now;
  const lastCredited = progress?.session_start
    ? sessionStart + progress.minutes_accrued * 60 * 1000
    : sessionStart;

  const secondsSinceCredit = Math.floor((now - lastCredited) / 1000);
  const targetSeconds = config.watch_time_minutes * 60;
  const remaining = Math.max(0, targetSeconds - secondsSinceCredit);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (earnedAmount !== null) {
    const earnedContent = (
      <Text style={[styles.earnedText, mode === 'inline' && styles.earnedTextInline]}>
        You earned ⭐{earnedAmount} freti
      </Text>
    );

    if (mode === 'inline') {
      return (
        <View style={[styles.inlineContainer, styles.earnedBackground]}>
          {earnedContent}
        </View>
      );
    }

    return (
      <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
        {earnedContent}
      </Animated.View>
    );
  }

  const countdownContent = (
    <Text style={[styles.text, mode === 'inline' && styles.textInline]}>
      ⭐{config.freti_per_reward} in {minutes}:{seconds.toString().padStart(2, '0')}
    </Text>
  );

  if (mode === 'inline') {
    return <View style={styles.inlineContainer}>{countdownContent}</View>;
  }

  return <View style={styles.container}>{countdownContent}</View>;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 100,
  },
  inlineContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginVertical: 8,
  },
  earnedBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  textInline: {
    fontSize: 14,
  },
  earnedText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
  earnedTextInline: {
    fontSize: 15,
  },
});

export default WatchRewardPill;
