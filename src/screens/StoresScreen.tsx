import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import ProductCard from '../components/ProductCard';
import { productsAPI, Product, ProductCategory } from '../services/productsAPI';
import { storesAPI, VerifiedStore } from '../services/storesAPI';
import { wishlistAPI } from '../services/wishlistAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Category icon mapping
const categoryIconMap: Record<string, string> = {
  'electronics': 'tv-outline',
  'fashion': 'shirt-outline',
  'home': 'home-outline',
  'home & garden': 'home-outline',
  'beauty': 'flower-outline',
  'sports': 'fitness-outline',
  'books': 'library-outline',
  'foods': 'restaurant-outline',
  'automotive': 'car-outline',
  'health': 'medical-outline',
};

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
  const { addToCart } = useCart();

  // State
  const [verifiedStores, setVerifiedStores] = useState<VerifiedStore[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination state
  const [storesOffset, setStoresOffset] = useState(0);
  const [hasMoreStores, setHasMoreStores] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalStoresCount, setTotalStoresCount] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VerifiedStore[]>([]);
  const [showSearchInput, setShowSearchInput] = useState(false);
  
  // Search debounce ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Category loading state (smooth transition)
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Favorite products tracking
  const [favoriteProducts, setFavoriteProducts] = useState<Set<string>>(new Set());

  // Load verified stores with pagination
  const loadVerifiedStores = async (append: boolean = false) => {
    try {
      const offset = append ? storesOffset : 0;
      const response = await storesAPI.getVerifiedStores(20, offset);
      
      if (append) {
        setVerifiedStores(prev => [...prev, ...response.stores]);
      } else {
        setVerifiedStores(response.stores);
      }
      
      // Update pagination state
      setTotalStoresCount(response.pagination.total);
      setStoresOffset(offset + response.stores.length);
      setHasMoreStores(offset + response.stores.length < response.pagination.total);
    } catch (error) {
      console.error('Error loading verified stores:', error);
      if (!append) {
        Alert.alert('Error', 'Failed to load verified stores. Please check your connection.');
      }
    }
  };

  // Load more stores (infinite scroll)
  const loadMoreStores = async () => {
    if (loadingMore || !hasMoreStores || selectedCategory !== 'all') return;
    
    setLoadingMore(true);
    try {
      await loadVerifiedStores(true);
    } catch (error) {
      console.error('Error loading more stores:', error);
    } finally {
      setLoadingMore(false);
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

  // Load categories
  const loadCategories = async () => {
    try {
      const categoriesData = await productsAPI.getCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Fallback to empty array
      setCategories([]);
    }
  };

  // Handle search with debouncing
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Debounce search - wait 500ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await storesAPI.searchVerifiedStores(query.trim(), 20, 0);
        setSearchResults(response.stores);
      } catch (error) {
        console.error('Error searching stores:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle category selection with smooth loading
  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCategoryLoading(true);

    try {
      // Reset pagination when changing category
      setStoresOffset(0);
      setHasMoreStores(true);
      
      // Fetch stores and products based on category
      if (categoryId === 'all') {
        await Promise.all([loadVerifiedStores(false), loadProducts()]);
      } else {
        // Find category name
        const category = categories.find(cat => cat.id === categoryId);
        const categoryName = category?.name || categoryId;

        // Fetch filtered data
        const [storesResponse, productsData] = await Promise.all([
          storesAPI.getStoresByCategory(categoryName, 20, 0),
          productsAPI.getProducts({ category: categoryName, limit: 20 })
        ]);

        setVerifiedStores(storesResponse.stores);
        setProducts(productsData);
        // Disable infinite scroll for category filters (only works for "all")
        setHasMoreStores(false);
      }
    } catch (error) {
      console.error('Error filtering by category:', error);
      Alert.alert('Error', 'Failed to filter by category');
    } finally {
      setCategoryLoading(false);
    }
  };

  // Initial data load
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Reset pagination on fresh load
      setStoresOffset(0);
      setHasMoreStores(true);
      
      await Promise.all([
        loadVerifiedStores(false),
        loadProducts(),
        loadCategories(),
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
    setStoresOffset(0);
    setHasMoreStores(true);
    loadData(false);
  };

  // Handle store press
  const handleStorePress = (store: VerifiedStore) => {
    navigation.navigate('PublicProfile', { userId: store.id });
  };

  // Handle product press
  const handleProductPress = (product: Product) => {
    navigation.navigate('ProductDetails', { productId: product.id });
  };

  // Handle add to cart
  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.primary_image_url || '',
        quantity: 1,
        sellerId: product.user_id,
        type: 'product'
      });
      Alert.alert('Success', `${product.name} added to cart!`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart');
    }
  };

  // Handle toggle favorite
  const handleToggleFavorite = async (productId: string) => {
    try {
      const isFavorite = favoriteProducts.has(productId);
      
      if (isFavorite) {
        // Remove from wishlist
        await wishlistAPI.removeFromWishlist(productId);
        setFavoriteProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
      } else {
        // Add to wishlist
        const product = products.find(p => p.id === productId);
        if (product) {
          await wishlistAPI.addToWishlist({
            productId: product.id,
            productName: product.name,
            productImage: product.primary_image_url || '',
            price: product.price,
          });
          setFavoriteProducts(prev => new Set(prev).add(productId));
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update wishlist');
    }
  };

  // Initialize
  useEffect(() => {
    loadData();
  }, []);

  // Render category chips
  const renderCategoryChips = () => {
    const hasAllCategory = categories.some(cat => cat.id === 'all');
    const allCategories = [
      ...(hasAllCategory ? [] : [{ id: 'all', name: 'All', icon_name: 'apps-outline' }]),
      ...categories.map(cat => ({
        ...cat,
        icon_name: cat.icon_name || categoryIconMap[cat.name.toLowerCase()] || 'cube-outline'
      }))
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: '#000' }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
        scrollEnabled={true}
        decelerationRate={Platform.OS === 'android' ? 0.85 : 'normal'}
        scrollEventThrottle={16}
      >
        {allCategories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={{
              backgroundColor: selectedCategory === category.id ? '#3498DB' : '#1a1a1a',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              marginRight: 8,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: selectedCategory === category.id ? 0 : 1,
              borderColor: '#333',
            }}
            onPress={() => handleCategorySelect(category.id)}
          >
            <Ionicons
              name={category.icon_name as any}
              size={14}
              color={selectedCategory === category.id ? 'white' : '#888'}
            />
            <Text style={{
              color: selectedCategory === category.id ? 'white' : '#888',
              fontWeight: selectedCategory === category.id ? '600' : '400',
              fontSize: 13,
              marginLeft: 4
            }}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

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
        {/* Store Background Image with caching */}
        <View style={styles.storeImageContainer}>
          <Image
            source={{ 
              uri: store.background_image_url || store.avatar_url || 'https://via.placeholder.com/150x150',
              cache: 'force-cache' // Enable image caching
            }}
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

          {/* Store Stats Row */}
          <View style={styles.storeStatsRow}>
            {/* Rating */}
            {store.store_rating && (
              <View style={styles.statBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.statText}>{store.store_rating.toFixed(1)}</Text>
              </View>
            )}

            {/* Item Count */}
            <View style={styles.statBadge}>
              <Ionicons name="cube-outline" size={12} color="#888" />
              <Text style={styles.statText}>
                {store.product_count || store.service_count || 0}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render search overlay (shown while typing)
  const renderSearchOverlay = () => {
    if (!isSearching || searchQuery.trim().length === 0) return null;

    return (
      <View style={styles.searchOverlay}>
        <ScrollView style={styles.searchResultsList}>
          {searchResults.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Ionicons name="search-outline" size={48} color="#666" />
              <Text style={styles.noResultsText}>No verified stores found</Text>
            </View>
          ) : (
            searchResults.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={styles.searchResultItem}
                onPress={() => {
                  handleStorePress(store);
                  setShowSearchInput(false);
                  setSearchQuery('');
                  setIsSearching(false);
                }}
              >
                <Image
                  source={{ uri: store.avatar_url || 'https://via.placeholder.com/50x50' }}
                  style={styles.searchResultAvatar}
                />
                <View style={styles.searchResultInfo}>
                  <View style={styles.searchResultNameRow}>
                    <Text style={styles.searchResultName}>{store.username}</Text>
                    {store.is_verified && (
                      <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                    )}
                  </View>
                  {store.bio && (
                    <Text style={styles.searchResultBio} numberOfLines={1}>
                      {store.bio}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
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
                onAddToCart={() => handleAddToCart(product)}
                isFavorite={favoriteProducts.has(product.id)}
                onToggleFavorite={() => handleToggleFavorite(product.id)}
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
        {!showSearchInput ? (
          <>
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

            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => setShowSearchInput(true)}
            >
              <Ionicons name="search" size={24} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchInputContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowSearchInput(false);
                setSearchQuery('');
                setIsSearching(false);
                setSearchResults([]);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search verified stores..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setIsSearching(false);
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Category Chips - Only show when not searching */}
      {!showSearchInput && renderCategoryChips()}

      {/* Search Overlay */}
      {renderSearchOverlay()}

      {/* Main Content or Search Results */}
      {showSearchInput && searchQuery.trim().length > 0 && searchResults.length > 0 && !isSearching ? (
        // Search Results Screen (replaces content after search is complete)
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.searchResultsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <Text style={styles.sectionSubtitle}>
                {searchResults.length} verified store{searchResults.length !== 1 ? 's' : ''} found
              </Text>
            </View>

            <View style={styles.storesGrid}>
              {searchResults.map((store, index) => renderStoreCard(store, index))}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        // Normal Content
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
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const paddingToBottom = 20;
            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
            
            if (isCloseToBottom) {
              loadMoreStores();
            }
          }}
          scrollEventThrottle={400}
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

            {/* Loading More Indicator */}
            {loadingMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#3498DB" />
                <Text style={styles.loadingMoreText}>Loading more stores...</Text>
              </View>
            )}

            {/* Category Loading Overlay */}
            {categoryLoading && (
              <View style={styles.categoryLoadingOverlay}>
                <ActivityIndicator size="large" color="#3498DB" />
                <Text style={styles.categoryLoadingText}>Filtering by category...</Text>
              </View>
            )}
          </View>

          {/* Products Section */}
          {renderProductsSection()}

          {/* Bottom Spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingVertical: 10,
  },
  clearButton: {
    padding: 4,
  },

  // Search overlay (dropdown while typing)
  searchOverlay: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  searchResultsList: {
    flex: 1,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  noResultsText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchResultName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultBio: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },

  // Search results section
  searchResultsSection: {
    paddingVertical: 20,
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
    marginBottom: 6,
    lineHeight: 14,
  },
  storeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  statText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
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
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingMoreText: {
    color: '#888',
    fontSize: 14,
  },
  categoryLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  categoryLoadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 12,
  },
});

export default StoresScreen;