import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { walletAPI } from '../services/walletAPI';

const { width } = Dimensions.get('window');
const cardWidth = (width - 24) / 2; // Account for padding

interface ProductCardProps {
  title: string;
  price: number;
  originalPrice?: number;
  image: any;
  rating: number;
  sellerName: string;
  sellerLogo?: string; // URL for vendor logo
  onPress?: () => void;
  onCartPress?: () => void;
  onBargainPress?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  title, 
  price, 
  originalPrice,
  image, 
  rating,
  sellerName,
  sellerLogo,
  onPress,
  onCartPress,
  onBargainPress
}) => {
  // Error boundary
  try {
    console.log('Rendering ProductCard with image:', image); // Debug log

    // Generate star rating display
    const renderStars = () => {
      const stars = [];
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 !== 0;
      
      for (let i = 0; i < fullStars; i++) {
        stars.push(<Text key={i} style={styles.star}>★</Text>);
      }
      
      if (hasHalfStar) {
        stars.push(<Text key="half" style={styles.star}>☆</Text>);
      }
      
      while (stars.length < 5) {
        stars.push(<Text key={`empty-${stars.length}`} style={styles.emptyStar}>☆</Text>);
      }
      
      return stars;
    };

    const hasDiscount = originalPrice && originalPrice > price;

    const renderVendorSection = () => (
      <View style={styles.vendorContainer}>
        {sellerLogo ? (
          <Image
            source={{ uri: sellerLogo }}
            style={styles.vendorLogo}
            resizeMode="cover"
            onError={(e) => console.log('Vendor logo error:', e.nativeEvent.error)}
          />
        ) : (
          <View style={[styles.vendorLogo, styles.defaultLogo]}>
            <Text style={styles.defaultLogoText}>
              {(sellerName && sellerName.charAt) ? sellerName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <Text style={styles.sellerName} numberOfLines={1}>{sellerName || 'Unknown Seller'}</Text>
      </View>
    );
    
    return (
      <TouchableOpacity 
        style={[styles.container, { width: cardWidth }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Image Container */}
        <View style={styles.imageContainer}>
          <Image 
            source={image} 
            style={styles.image} 
            resizeMode="cover"
            onError={(e) => console.log('Product image error:', e.nativeEvent.error)}
          />
          
          {/* Discount Badge */}
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>
                -{Math.round(((originalPrice! - price) / originalPrice!) * 100) || 0}%
              </Text>
            </View>
          )}
          
          {/* Heart Icon */}
          <TouchableOpacity style={styles.heartIcon}>
            <Ionicons name="heart-outline" size={16} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Content Section - Better Spacing */}
        <View style={styles.contentContainer}>
          {/* Vendor Section */}
          {renderVendorSection()}
          
          {/* Product Title */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          
          {/* Star Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
            <Text style={styles.ratingText}>({rating?.toFixed(1) || '0.0'})</Text>
          </View>
          
          {/* Price Section */}
          <View style={styles.priceContainer}>
            {hasDiscount ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>{walletAPI.formatFreti(originalPrice || 0)}</Text>
                <Text style={styles.salePrice}>{walletAPI.formatFreti(price || 0)}</Text>
              </View>
            ) : (
              <Text style={styles.price}>{walletAPI.formatFreti(price || 0)}</Text>
            )}
          </View>
          
          {/* Action Buttons - Better Spacing */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={(e) => {
                e.stopPropagation();
                onCartPress?.();
              }}
            >
              <Ionicons name="cart-outline" size={16} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.bargainButton} 
              onPress={(e) => {
                e.stopPropagation();
                onBargainPress?.();
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  } catch (error) {
    console.error('Error rendering ProductCard:', error);
    return <Text>Error rendering ProductCard!</Text>; // Fallback render
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
    // Remove fixed height to allow content wrapping
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 160, // Consistent image height
    overflow: 'hidden', // Prevent image overflow
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 6,
    borderRadius: 16,
  },
  contentContainer: {
    padding: 16, // Increased padding for better spacing
  },
  vendorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Increased margin
  },
  vendorLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  defaultLogo: {
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultLogoText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sellerName: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 10, // Increased margin
    minHeight: 40, // Ensure consistent space for 2 lines
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10, // Increased margin
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 6,
  },
  star: {
    color: '#FFD700',
    fontSize: 12,
    marginRight: 1,
  },
  emptyStar: {
    color: '#555',
    fontSize: 12,
    marginRight: 1,
  },
  ratingText: {
    fontSize: 11,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  priceContainer: {
    marginBottom: 14, // Increased margin
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalPrice: {
    fontSize: 12,
    color: '#888',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  salePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10, // Increased gap between buttons
  },
  actionButton: {
    backgroundColor: '#3498DB',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, // Increased button height
    borderRadius: 20,
  },
  bargainButton: {
    backgroundColor: '#E67E22',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12, // Increased button height
    borderRadius: 20,
  },
});

export default ProductCard;