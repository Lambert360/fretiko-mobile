import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import ProductVideoPlayer from './ProductVideoPlayer';
import { Product } from '../services/productsAPI';

// A single "gallery item" shown in a multi-item video card: either the main
// advert video/image, or one of the product's variants.
interface VideoCardGalleryItem {
  id: string;
  name: string;
  price: number;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  variantId?: string; // undefined for the main advert item
}

const VideoProductCard: React.FC<{
  item: Product;
  isVisible: boolean;
  screenWidth: number;
  onLayout: (event: any) => void;
  onPress: () => void;
  onBargainPress: () => void;
  onCartPress: (variant?: { id: string; name: string; price: number }) => void;
}> = React.memo(({ item, isVisible, screenWidth, onLayout, onPress, onBargainPress, onCartPress }) => {
  const isMultiItem = !!item.is_multi_item && !!item.variants && item.variants.length > 0;

  const galleryItems: VideoCardGalleryItem[] = useMemo(() => {
    if (!isMultiItem) return [];
    const mainMediaUrl = item.processed_videos?.[0] || item.primary_video_url || item.primary_image_url || item.images?.[0] || '';
    const mainItem: VideoCardGalleryItem = {
      id: 'main',
      name: item.name,
      price: item.price,
      mediaUrl: mainMediaUrl,
      mediaType: item.primary_video_url ? 'video' : 'image',
    };
    const variantItems: VideoCardGalleryItem[] = (item.variants || []).map(v => ({
      id: v.id,
      name: v.name,
      price: v.price,
      mediaUrl: v.media_url,
      mediaType: v.media_type,
      variantId: v.id,
    }));
    return [mainItem, ...variantItems];
  }, [item, isMultiItem]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = isMultiItem ? galleryItems[selectedIndex] : null;

  const displayName = selected ? selected.name : item.name;
  const displayPrice = selected ? selected.price : item.price;
  const displayMediaUrl = selected ? selected.mediaUrl : (item.processed_videos?.[0] || item.primary_video_url);
  const displayMediaType = selected ? selected.mediaType : 'video';

  const handleCartPress = () => {
    if (selected && selected.variantId) {
      onCartPress({ id: selected.variantId, name: selected.name, price: selected.price });
    } else {
      onCartPress();
    }
  };

  return (
    <View
      onLayout={onLayout}
      style={{ width: '100%', marginBottom: 16 }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={{
          width: '100%',
          backgroundColor: '#1a1a1a',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {displayMediaUrl && displayMediaType === 'video' ? (
          <ProductVideoPlayer
            videoUri={displayMediaUrl}
            shouldAutoPlay={isVisible}
            containerWidth={screenWidth - 24}
          />
        ) : (
          <Image
            source={{ uri: displayMediaUrl || 'https://via.placeholder.com/400x250?text=Product' }}
            style={{ width: '100%', height: screenWidth * 0.56 }}
            resizeMode="cover"
          />
        )}

        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 12,
        }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold' }}>
              ₣{displayPrice.toFixed(2)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onBargainPress();
                }}
                style={{
                  backgroundColor: '#F39C12',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={14} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleCartPress();
                }}
                style={{
                  backgroundColor: '#3498DB',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                <Ionicons name="cart-outline" size={14} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {item.media_type === 'video' && (
          <View style={{
            position: 'absolute',
            top: 12,
            left: 12,
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Ionicons name="videocam" size={12} color="#FF4757" />
            <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold', marginLeft: 4 }}>
              VIDEO
            </Text>
          </View>
        )}

        {isMultiItem && (
          <View style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(155,89,182,0.9)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
          }}>
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
              {galleryItems.length} ITEMS
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {isMultiItem && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ width: '100%', marginTop: 8 }}
          contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 2 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {galleryItems.map((gItem, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <TouchableOpacity
                key={gItem.id}
                onPress={() => setSelectedIndex(idx)}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  overflow: 'hidden',
                  marginRight: 8,
                  borderWidth: isSelected ? 2 : 0,
                  borderColor: '#F39C12',
                  backgroundColor: '#000',
                }}
              >
                {gItem.mediaType === 'video' ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="play-circle" size={22} color="rgba(255,255,255,0.85)" />
                  </View>
                ) : (
                  <Image source={{ uri: gItem.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});

export default VideoProductCard;
