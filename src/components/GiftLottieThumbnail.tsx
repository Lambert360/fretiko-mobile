import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { getCachedAssetUri } from '../utils/giftAssetCache';

interface GiftLottieThumbnailProps {
  source: string | number | { uri: string };
  size?: number;
}

const GiftLottieThumbnail: React.FC<GiftLottieThumbnailProps> = ({ source, size = 60 }) => {
  const [cachedSource, setCachedSource] = useState<string | number | { uri: string }>(source);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const resolved = await getCachedAssetUri(source);
      if (isMounted && resolved !== undefined) {
        setCachedSource(resolved);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [source]);

  const lottieSource =
    typeof cachedSource === 'string' ? { uri: cachedSource } : cachedSource;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <LottieView
        source={lottieSource as any}
        autoPlay
        loop
        style={{ width: size, height: size }}
        renderMode="AUTOMATIC"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GiftLottieThumbnail;
