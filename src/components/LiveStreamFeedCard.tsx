import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect } from 'react';
import {
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveStreamData } from '../services/postsAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LiveStreamFeedCardProps {
  liveStream: LiveStreamData;
  isActive?: boolean;
  onPress?: (streamId: string) => void;
  onVendorPress?: (userId: string) => void;
  tabBarHeight?: number;
  style?: ViewStyle;
}

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
};

export const LiveStreamFeedCard: React.FC<LiveStreamFeedCardProps> = ({
  liveStream,
  isActive = true,
  onPress,
  onVendorPress,
  tabBarHeight = 70,
  style,
}) => {
  const insets = useSafeAreaInsets();

  const hasPreviewVideo = Boolean(liveStream.previewVideoUrl);
  const player = useVideoPlayer(liveStream.previewVideoUrl || '', p => {
    p.muted = true;
    p.loop = true;
  });

  useEffect(() => {
    if (!hasPreviewVideo) return;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, hasPreviewVideo, player]);

  const backgroundUri =
    liveStream.thumbnailUrl ||
    liveStream.vendor?.avatarUrl ||
    'https://via.placeholder.com/600x900?text=Live+Stream';

  const streamTypeLabel =
    liveStream.streamType === 'products' ? 'Live Products' : 'Live Services';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onPress?.(liveStream.id)}
      style={[{ flex: 1, width: '100%', height: '100%' }, style]}
    >
      <View style={{ width: '100%', height: '100%' }}>
        {/* Background */}
        {hasPreviewVideo ? (
          <VideoView
            player={player}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            contentFit="cover"
          />
        ) : (
          <Image
            source={{ uri: backgroundUri }}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            resizeMode="cover"
          />
        )}

        {/* Gradient overlay for text legibility */}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.5, 1]}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />

        {/* Top badges */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 60,
            left: 16,
            right: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#E74C3C',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
            }}
          >
            <Ionicons name="radio" size={14} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>LIVE</Text>
          </View>

          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              alignItems: 'flex-end',
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>{streamTypeLabel}</Text>
            {liveStream.streamType === 'products' && typeof liveStream.price === 'number' ? (
              <Text style={{ color: '#8EE186', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                From ₣{liveStream.price.toFixed(2)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Bottom content */}
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + tabBarHeight + 84,
            left: 16,
            right: 16,
          }}
        >
          {/* Vendor row */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
            onPress={() => onVendorPress?.(liveStream.vendorId)}
          >
            <Image
              source={{
                uri:
                  liveStream.vendor?.avatarUrl ||
                  'https://via.placeholder.com/40x40',
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                marginRight: 10,
                borderWidth: 2,
                borderColor: 'white',
              }}
            />
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>
                  @{liveStream.vendor?.username || 'live_vendor'}
                </Text>
                {liveStream.vendor?.isVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color="#3498DB"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 }}>
                {streamTypeLabel}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Title */}
          <Text
            style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 6 }}
            numberOfLines={2}
          >
            {liveStream.title || 'Live Stream'}
          </Text>

          {/* Description */}
          {liveStream.description ? (
            <Text
              style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 14 }}
              numberOfLines={2}
            >
              {liveStream.description}
            </Text>
          ) : null}

          {/* Stats row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="eye" size={15} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: 'white', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                {formatNumber(liveStream.currentViewers || liveStream.viewerCount)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="heart" size={15} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: 'white', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                {formatNumber(liveStream.totalReactions)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="cash" size={15} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: 'white', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                {formatNumber(liveStream.totalSales)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="gift" size={15} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: 'white', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
                {formatNumber(liveStream.totalGifts)}
              </Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + tabBarHeight + 16,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.95)',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 28,
            }}
          >
            <Ionicons name="play" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>Watch Live</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};
