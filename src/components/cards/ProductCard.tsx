import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ProductData {
  id: string;
  title: string;
  image?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  discount?: number;
  vendor: {
    id: string;
    name: string;
    avatar?: string;
    verified?: boolean;
    rating?: number;
  };
  category?: string;
  rating?: number;
  reviews?: number;
  inStock?: boolean;
  fastShipping?: boolean;
  location?: string;
  // Media content
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaAspectRatio?: 'landscape' | 'portrait' | 'square';
  // Engagement
  likes?: number;
  views?: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  // Special badges
  isNew?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
}

interface ProductCardProps {
  product: ProductData;
  variant?: 'featured' | 'grid' | 'list';
  onPress?: (product: ProductData) => void;
  onLike?: (product: ProductData) => void;
  onBookmark?: (product: ProductData) => void;
  onVendorPress?: (vendorId: string) => void;
  onCartPress?: (product: ProductData) => void;
  onBargainPress?: (product: ProductData) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  variant = 'featured',
  onPress,
  onLike,
  onBookmark,
  onVendorPress,
  onCartPress,
  onBargainPress,
}) => {
  const getMediaHeight = () => {
    if (variant === 'grid') return 140;
    if (variant === 'list') return 80;
    
    switch (product.mediaAspectRatio) {
      case 'portrait': return 240;
      case 'landscape': return 160;
      case 'square': return 200;
      default: return 200;
    }
  };

  const renderMedia = () => {
    // For video products, use the image if available, otherwise use placeholder
    // Never try to render video URL as an image
    const isVideo = product.mediaType === 'video';
    let imageUri: string;

    if (isVideo) {
      // Video product: use image thumbnail or placeholder
      imageUri = product.image || `https://picsum.photos/400/400?random=${product.id}`;
    } else {
      // Image product: use image, mediaUrl, or placeholder (prioritize image field)
      imageUri = product.image || product.mediaUrl || `https://picsum.photos/400/400?random=${product.id}`;
    }

    return (
      <View style={[styles.mediaContainer, { height: getMediaHeight(), backgroundColor: '#1a1a1a' }]}>
        <Image
          source={{ uri: imageUri }}
          style={styles.mediaContent}
          resizeMode="cover"
          onError={(error) => {
            console.error('❌ Image load error:', imageUri, error.nativeEvent);
          }}
        />

        {isVideo && (
          <View style={styles.videoOverlay}>
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
          </View>
        )}

        {/* Badges */}
        <View style={styles.badgeContainer}>
          {product.isNew && (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.badgeText}>NEW</Text>
            </View>
          )}
          {product.isTrending && (
            <View style={[styles.badge, styles.trendingBadge]}>
              <Text style={styles.badgeText}>🔥</Text>
            </View>
          )}
          {product.discount && product.discount > 0 && (
            <View style={[styles.badge, styles.discountBadge]}>
              <Text style={styles.badgeText}>-{product.discount}%</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {onBookmark && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onBookmark(product)}
            >
              <Ionicons 
                name={product.isBookmarked ? "bookmark" : "bookmark-outline"} 
                size={16} 
                color={product.isBookmarked ? "#FFD700" : "rgba(255,255,255,0.8)"} 
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Stock status */}
        {!product.inStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFeaturedCard = () => (
    <TouchableOpacity style={styles.featuredCard} onPress={() => onPress?.(product)}>
      {renderMedia()}
      
      <View style={styles.cardContent}>
        {/* Vendor info */}
        <TouchableOpacity 
          style={styles.vendorInfo}
          onPress={() => onVendorPress?.(product.vendor?.id)}
        >
          <Image 
            source={{ 
              uri: product.vendor?.avatar || `https://picsum.photos/30/30?random=${product.vendor?.id || 'default'}` 
            }} 
            style={styles.vendorAvatar} 
          />
          <View style={styles.vendorDetails}>
            <Text style={styles.vendorName}>{product.vendor?.name || 'Unknown Vendor'}</Text>
            {product.vendor?.verified && (
              <Ionicons name="checkmark-circle" size={12} color="#1DA1F2" />
            )}
          </View>
        </TouchableOpacity>

        {/* Product details */}
        <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
        
        {product.category && (
          <Text style={styles.category}>{product.category}</Text>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {product.currency || '₦'}{product.price.toLocaleString()}
          </Text>
          {product.originalPrice && product.originalPrice > product.price && (
            <Text style={styles.originalPrice}>
              {product.currency || '₦'}{product.originalPrice.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Rating and reviews */}
        {product.rating && (
          <View style={styles.ratingRow}>
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
            </View>
            {product.reviews && (
              <Text style={styles.reviewsText}>({product.reviews} reviews)</Text>
            )}
          </View>
        )}

        {/* Features */}
        <View style={styles.features}>
          {product.fastShipping && (
            <View style={styles.feature}>
              <Ionicons name="flash" size={10} color="#FF9800" />
              <Text style={styles.featureText}>Fast Shipping</Text>
            </View>
          )}
          {product.location && (
            <View style={styles.feature}>
              <Ionicons name="location" size={10} color="#9E9E9E" />
              <Text style={styles.featureText}>{product.location}</Text>
            </View>
          )}
        </View>

        {/* Engagement */}
        <View style={styles.engagementRow}>
          {onLike && (
            <TouchableOpacity
              style={styles.engagementButton}
              onPress={() => onLike(product)}
            >
              <Ionicons
                name={product.isLiked ? "heart" : "heart-outline"}
                size={14}
                color={product.isLiked ? "#E91E63" : "rgba(255,255,255,0.6)"}
              />
              {product.likes && <Text style={styles.engagementText}>{product.likes}</Text>}
            </TouchableOpacity>
          )}

          {product.views && (
            <View style={styles.engagementButton}>
              <Ionicons name="eye" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.engagementText}>{product.views}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {(onCartPress || onBargainPress) && (
          <View style={styles.actionButtonsRow}>
            {onCartPress && (
              <TouchableOpacity
                style={styles.cartButton}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onCartPress(product);
                }}
              >
                <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                <Text style={styles.cartButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            )}

            {onBargainPress && (
              <TouchableOpacity
                style={styles.bargainButton}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onBargainPress(product);
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
                <Text style={styles.bargainButtonText}>Bargain</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderGridCard = () => (
    <TouchableOpacity style={styles.gridCard} onPress={() => onPress?.(product)}>
      {renderMedia()}
      <View style={styles.gridContent}>
        <Text style={styles.gridTitle} numberOfLines={2}>{product.title}</Text>
        <Text style={styles.gridPrice}>
          {product.currency || '₦'}{product.price.toLocaleString()}
        </Text>
        {product.rating && (
          <View style={styles.gridRating}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.gridRatingText}>{product.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderListCard = () => (
    <TouchableOpacity style={styles.listCard} onPress={() => onPress?.(product)}>
      {renderMedia()}
      <View style={styles.listContent}>
        <Text style={styles.listTitle} numberOfLines={1}>{product.title}</Text>
        <Text style={styles.listVendor}>{product.vendor?.name || 'Unknown Vendor'}</Text>
        <Text style={styles.listPrice}>
          {product.currency || '₦'}{product.price.toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  switch (variant) {
    case 'grid': return renderGridCard();
    case 'list': return renderListCard();
    default: return renderFeaturedCard();
  }
};

const styles = StyleSheet.create({
  // Featured card styles
  featuredCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mediaContainer: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  mediaContent: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'column',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newBadge: {
    backgroundColor: '#4CAF50',
  },
  trendingBadge: {
    backgroundColor: 'rgba(255,87,34,0.9)',
  },
  discountBadge: {
    backgroundColor: '#E74C3C',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  vendorDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vendorName: {
    color: '#1DA1F2',
    fontSize: 12,
    fontWeight: '600',
  },
  productTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  category: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  price: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '700',
  },
  originalPrice: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewsText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  features: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cartButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  bargainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  bargainButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Grid card styles
  gridCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gridContent: {
    padding: 12,
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  gridPrice: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  gridRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gridRatingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },

  // List card styles
  listCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  listContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  listVendor: {
    color: '#1DA1F2',
    fontSize: 12,
    marginBottom: 4,
  },
  listPrice: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '700',
  },
});