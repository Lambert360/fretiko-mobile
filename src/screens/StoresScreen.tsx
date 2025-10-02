import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import ProductCard from '../components/ProductCard';
import { productsAPI, Product } from '../services/productsAPI';
import { storesAPI, VerifiedStore } from '../services/storesAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Stores Screen
 * 
 * Premium curated marketplace for verified stores with:
 * - 2-column grid of verified stores (premium section)
 * - Individual product listings after verified stores
 * - Navigation to store pages and product details
 */
const StoresScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // State
  const [verifiedStores, setVerifiedStores] = useState<VerifiedStore[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load verified stores
  const loadVerifiedStores = async () => {
    try {
      const response = await storesAPI.getVerifiedStores(20, 0);
      setVerifiedStores(response.stores);
    } catch (error) {
      console.error('Error loading verified stores:', error);
      Alert.alert('Error', 'Failed to load verified stores');
      
      // Fallback to mock data if API fails
      const mockStores: VerifiedStore[] = [
        {
          id: '1',
          username: 'chanel_official',
          bio: 'Luxury Fashion & Beauty',
          avatar_url: 'https://via.placeholder.com/150x150?text=CHANEL',
          is_verified: true,
          is_seller: true,
          store_rating: 5.0,
          product_count: 145,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          username: 'lacoste_store',
          bio: 'Premium Sportswear',
          avatar_url: 'https://via.placeholder.com/150x150?text=LACOSTE',
          is_verified: true,
          is_seller: true,
          store_rating: 4.8,
          product_count: 89,
          created_at: new Date().toISOString(),
        },
      ];
      setVerifiedStores(mockStores);
    }
  };

  // Load products for the products section
  const loadProducts = async () => {
    try {
      const productsData = await productsAPI.getProducts({ limit: 20 });
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // Initial data load
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      await Promise.all([
        loadVerifiedStores(),
        loadProducts(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // Handle store press
  const handleStorePress = (store: VerifiedStore) => {
    navigation.navigate('PublicStore', { userId: store.id });
  };

  // Handle product press
  const handleProductPress = (product: Product) => {
    navigation.navigate('ProductDetails', { productId: product.id });
  };

  // Initialize
  useEffect(() => {
    loadData();
  }, []);

  // Render verified store card
  const renderStoreCard = (store: VerifiedStore, index: number) => {
    const isLeft = index % 2 === 0;
    
    return (
      <TouchableOpacity
        key={store.id}
        style={[
          styles.storeCard,
          { marginRight: isLeft ? 8 : 0, marginLeft: isLeft ? 0 : 8 }
        ]}
        onPress={() => handleStorePress(store)}
        activeOpacity={0.8}
      >
        {/* Store Logo Background */}
        <View style={styles.storeImageContainer}>
          <Image
            source={{ uri: store.avatar_url || 'https://via.placeholder.com/150x150' }}
            style={styles.storeImage}
            resizeMode="cover"
          />
          <View style={styles.storeImageOverlay} />
        </View>

        {/* Store Info Overlay */}
        <View style={styles.storeInfo}>
          {/* Verification Badge */}
          <View style={styles.verificationBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
          </View>

          {/* Store Name */}
          <Text style={styles.storeName} numberOfLines={1}>
            {store.username}
          </Text>

          {/* Store Bio */}
          {store.bio && (
            <Text style={styles.storeBio} numberOfLines={2}>
              {store.bio}
            </Text>
          )}

          {/* Rating */}
          {store.store_rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{store.store_rating}</Text>
            </View>
          )}

          {/* Item Count */}
          <Text style={styles.itemCount}>
            {store.product_count 
              ? `${store.product_count} products` 
              : store.service_count 
                ? `${store.service_count} services`
                : 'Store items'
            }
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render products section
  const renderProductsSection = () => {
    if (products.length === 0) return null;

    return (
      <View style={styles.productsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <Text style={styles.sectionSubtitle}>
            Discover products from various stores
          </Text>
        </View>

        <View style={styles.productsGrid}>
          {products.map((product, index) => (
            <View key={product.id} style={styles.productCardContainer}>
              <ProductCard
                id={product.id}
                title={product.name}
                price={product.price}
                image={{ uri: product.primary_image_url || 'https://via.placeholder.com/200x200' }}
                seller={product.user?.username || 'Unknown Seller'}
                location={product.location}
                onPress={() => handleProductPress(product)}
                onAddToCart={() => {/* Handle add to cart */}}
                isFavorite={false}
                onToggleFavorite={() => {/* Handle favorite toggle */}}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading stores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Stores</Text>
          <Text style={styles.headerSubtitle}>Premium verified stores</Text>
        </View>
        
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3498DB']}
            tintColor="#3498DB"
          />
        }
      >
        {/* Verified Stores Section */}
        <View style={styles.verifiedStoresSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Verified Stores</Text>
            <Text style={styles.sectionSubtitle}>
              Premium brands verified by Fretiko
            </Text>
          </View>

          <View style={styles.storesGrid}>
            {verifiedStores.map((store, index) => renderStoreCard(store, index))}
          </View>
        </View>

        {/* Products Section */}
        {renderProductsSection()}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  searchButton: {
    padding: 8,
  },

  // Content
  content: {
    flex: 1,
  },

  // Section styling
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
  },

  // Verified stores section
  verifiedStoresSection: {
    paddingVertical: 20,
  },
  storesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  storeCard: {
    width: (screenWidth - 32) / 2,
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  storeImageContainer: {
    flex: 1,
    position: 'relative',
  },
  storeImage: {
    width: '100%',
    height: '100%',
  },
  storeImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  storeInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  verificationBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 4,
  },
  storeName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  storeBio: {
    color: '#CCC',
    fontSize: 11,
    marginBottom: 4,
    lineHeight: 14,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  itemCount: {
    color: '#888',
    fontSize: 10,
    fontWeight: '500',
  },

  // Products section
  productsSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  productCardContainer: {
    width: (screenWidth - 32) / 2,
    paddingHorizontal: 8,
    marginBottom: 16,
  },

  // Loading state
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
});

export default StoresScreen;