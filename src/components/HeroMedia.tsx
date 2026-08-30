import React, { useEffect, useState } from 'react';
import { Image, Text, View, TouchableOpacity, Dimensions, StyleSheet, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HeroImage } from '../services/heroImagesAPI';

const { width: screenWidth } = Dimensions.get('window');

interface HeroMediaProps {
  hero: HeroImage;
  onPress?: () => void;
  height?: number;
}

const HeroVideo: React.FC<{ uri: string; paused?: boolean }> = ({ uri, paused }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [paused, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
    />
  );
};

const CountdownOverlay: React.FC<{ target: string }> = ({ target }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const targetTime = new Date(target).getTime();
  const diff = targetTime - now;

  if (diff <= 0) {
    return (
      <View
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }]}
        pointerEvents="none"
      >
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>Live now!</Text>
      </View>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const TimeUnit: React.FC<{ value: number; label: string }> = ({ value, label }) => (
    <View
      style={{
        alignItems: 'center',
        marginHorizontal: 4,
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.65)',
      }}
    >
      <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
        {value.toString().padStart(2, '0')}
      </Text>
      <Text style={{ color: '#E0E0E0', fontSize: 10 }}>{label}</Text>
    </View>
  );

  return (
    <View
      style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }]}
      pointerEvents="none"
    >
      <View style={{ flexDirection: 'row' }}>
        {days > 0 && <TimeUnit value={days} label="DAYS" />}
        <TimeUnit value={hours} label="HRS" />
        <TimeUnit value={minutes} label="MINS" />
        <TimeUnit value={seconds} label="SECS" />
      </View>
    </View>
  );
};

export const HeroMedia: React.FC<HeroMediaProps> = ({ hero, onPress, height = 180 }) => {
  const navigation = useNavigation<any>();
  const heroSource = typeof hero.url === 'string' ? { uri: hero.url } : hero.url;

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (hero.action_url) {
      Linking.openURL(hero.action_url).catch((err) =>
        console.warn('Failed to open hero action_url', err)
      );
      return;
    }

    if (hero.screen_target) {
      const normalized = hero.screen_target.trim().toLowerCase().replace(/\s+/g, ' ');

      const aliasMap: Record<string, string> = {
        home: 'Home',
        all: 'Home',
        products: 'products',
        services: 'services',
        livesales: 'LiveSales',
        'live sales': 'LiveSales',
        live_sales: 'LiveSales',
        live: 'LiveSales',
        auctions: 'AuctionDiscovery',
        auction: 'AuctionDiscovery',
        cart: 'Cart',
        wallet: 'Wallet',
        orders: 'Orders',
        ordertracking: 'OrderTracking',
        stores: 'Stores',
        profile: 'Profile',
        search: 'Search',
        konnect: 'Konnect',
        notifications: 'Notifications',
      };

      const target = aliasMap[normalized] ?? hero.screen_target;

      if (target === 'products' || target === 'services') {
        navigation.navigate('Home', { initialTab: target });
      } else {
        navigation.navigate(target);
      }
    }
  };

  return (
    <View style={{ marginHorizontal: 16, marginVertical: 12 }}>
      <TouchableOpacity
        style={{
          height,
          borderRadius: 16,
          overflow: 'hidden',
          position: 'relative',
        }}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {hero.media_type === 'video' ? (
          <HeroVideo uri={typeof hero.url === 'string' ? hero.url : ''} />
        ) : (
          <Image
            source={heroSource}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        )}

        {hero.countdown_enabled && hero.countdown_target && (
          <CountdownOverlay target={hero.countdown_target} />
        )}

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 16,
          }}
        >
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
            {hero.title || 'Discover Deals! 🛍️'}
          </Text>
          <Text style={{ color: '#E0E0E0', fontSize: 14 }}>
            {hero.subtitle || 'Amazing products await you'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};
