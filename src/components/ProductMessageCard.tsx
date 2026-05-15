import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface ProductData {
  id: string;
  name: string;
  price: number;
  image: string;
  vendor_username?: string;
}

interface ProductMessageCardProps {
  product: ProductData;
  isCurrentUser: boolean;
  messageText?: string;
}

const ProductMessageCard: React.FC<ProductMessageCardProps> = ({ product, isCurrentUser, messageText }) => {
  const navigation = useNavigation<any>();

  const handleViewProduct = () => {
    navigation.navigate('ProductDetails', { productId: product.id });
  };

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      {/* Product Reference Card - Tappable */}
      <TouchableOpacity
        style={styles.productReferenceCard}
        onPress={handleViewProduct}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="pricetag" size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.productLabel}>Product</Text>
          </View>
          <View style={styles.bargainBadge}>
            <Ionicons name="chatbubbles" size={10} color="#F39C12" />
            <Text style={styles.bargainText}>Bargain</Text>
          </View>
        </View>

        {/* Product Content - Compact */}
        <View style={styles.productContent}>
          {/* Product Image */}
          {product.image ? (
            <Image source={{ uri: product.image }} style={styles.productImage} />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="image-outline" size={24} color="#888" />
            </View>
          )}

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>

            {product.vendor_username && (
              <View style={styles.vendorRow}>
                <Ionicons name="person-outline" size={10} color="rgba(255, 255, 255, 0.5)" />
                <Text style={styles.vendorName}>{product.vendor_username}</Text>
              </View>
            )}

            {/* Price */}
            <Text style={styles.priceValue}>₣{product.price.toLocaleString()}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Message Text Below Product Card */}
      {messageText && (
        <View style={styles.messageTextContainer}>
          <Text style={styles.messageText}>{messageText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '85%',
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sentContainer: {
    alignSelf: 'flex-end',
    marginRight: 8,
    backgroundColor: '#051094',
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    backgroundColor: '#59788E',
  },
  productReferenceCard: {
    borderRadius: 12,
    padding: 8,
    margin: 8,
    marginBottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#F39C12',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  productLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  bargainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
  },
  bargainText: {
    color: '#F39C12',
    fontSize: 9,
    fontWeight: '600',
  },
  productContent: {
    flexDirection: 'row',
    gap: 8,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 4,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  vendorName: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
  },
  priceValue: {
    color: '#27AE60',
    fontSize: 13,
    fontWeight: 'bold',
  },
  messageTextContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageText: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 20,
  },
});

export default ProductMessageCard;
