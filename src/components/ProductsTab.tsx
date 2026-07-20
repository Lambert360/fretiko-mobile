import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard as ModernProductCard } from './cards/ProductCard';
import ProductVideoPlayer from './ProductVideoPlayer';
import AuctionCard from './AuctionCard';
import { Product, ProductCategory, productsAPI } from '../services/productsAPI';
import { AuctionWithDetails } from '../services/auctionsAPI';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useFilters } from '../contexts/FilterContext';
import { mapProductToCard } from '../utils/dataMappers';
import { useMemoizedSections } from '../utils/mixedContentHelpers';
import { chatAPI } from '../services/chatAPI';

const { width: screenWidth } = Dimensions.get('window');

// Header dimensions
const HEADER_FULL_HEIGHT = 60;
const SUB_HEADER_HEIGHT = 44;
const TAB_BAR_HEIGHT = 70;
const PRODUCTS_PAGE_SIZE = 40;

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

// Fallback card for errors
const FallbackCard = ({ error }: { error?: string }) => (
  <View style={{ padding: 20, backgroundColor: '#1a1a1a', borderRadius: 8, margin: 6 }}>
    <Text style={{ color: 'red', fontSize: 12, marginBottom: 4 }}>ProductCard Error</Text>
    {error && <Text style={{ color: '#888', fontSize: 10 }}>{error}</Text>}
  </View>
);

interface ProductsTabProps {
  isScreenFocused: boolean;
  headerOpacity: Animated.Value;
  subHeaderOpacity: Animated.Value;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  reloadKey?: number;
}

const ProductsTab: React.FC<ProductsTabProps> = ({
  isScreenFocused,
  headerOpacity,
  subHeaderOpacity,
  onScroll,
  reloadKey,
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { productFilters, resetProductFilters } = useFilters();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<AuctionWithDetails[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionWithDetails[]>([]);
  const [heroImages, setHeroImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [seasonalProducts, setSeasonalProducts] = useState<Product[]>([]);
  const [productsOffset, setProductsOffset] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);

  // Video visibility tracking - FIXED: proper cleanup
  const [visibleVideoId, setVisibleVideoId] = useState<string | null>(null);
  const videoPositions = useRef<Map<string, number>>(new Map());
  const scrollYRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Load hero images
  useEffect(() => {
    const loadHeroImages = async () => {
      try {
        const { heroImagesAPI } = await import('../services/heroImagesAPI');
        const images = await heroImagesAPI.getHeroImages();
        setHeroImages(images);
      } catch {
        setHeroImages([
          { id: '1', url: require('../../assets/images/hero1.jpeg'), title: 'Discover Amazing Deals! 🛍️', subtitle: 'Shop the latest trends' },
          { id: '2', url: require('../../assets/images/hero2.jpeg'), title: 'Join the Fretiko Community! 🎉', subtitle: 'Connect, buy, sell, repeat' },
          { id: '3', url: require('../../assets/images/hero3.jpeg'), title: 'Power of Music Meets Shopping! 🎵', subtitle: 'Discover, share, connect' },
          { id: '4', url: require('../../assets/images/hero4.jpeg'), title: 'Shop Smart, Save More! 💰', subtitle: 'Best deals, best prices' }
        ]);
      }
    };
    loadHeroImages();
  }, []);

  // Load data
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setErrorState(null);

    try {
      const [{ auctionsAPI }] = await Promise.all([
        import('../services/auctionsAPI')
      ]);

      const [productsData, categoriesData, trendingData, seasonalData] = await Promise.all([
        productsAPI.getProducts({ limit: PRODUCTS_PAGE_SIZE, offset: 0 }),
        productsAPI.getCategories(),
        productsAPI.getTrending({ limit: 12 }),
        productsAPI.getSeasonal({ limit: 12 }),
      ]);

      const initialProducts = productsData || [];
      setProducts(initialProducts);
      setCategories(categoriesData || []);
      setTrendingProducts(trendingData || []);
      setSeasonalProducts(seasonalData || []);
      setProductsOffset(initialProducts.length);
      setHasMoreProducts(initialProducts.length >= PRODUCTS_PAGE_SIZE);
      setLoadingMoreProducts(false);

      // Load auctions
      try {
        const [activeResp, upcomingResp] = await Promise.all([
          auctionsAPI.getAuctions({ status: 'active', limit: 5 }),
          auctionsAPI.getAuctions({ status: 'scheduled', limit: 5 }),
        ]);
        setActiveAuctions(activeResp.auctions || []);
        setUpcomingAuctions(upcomingResp.auctions || []);
      } catch {
        setActiveAuctions([]);
        setUpcomingAuctions([]);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setErrorState('Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isScreenFocused) {
      loadData();
    }
  }, [isScreenFocused, loadData]);

  // Refresh handler
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    setProductsOffset(0);
    setHasMoreProducts(true);
    await loadData(false);
  }, [loadData]);

  // Reload when parent bumps the key (Home tab re-tap)
  useEffect(() => {
    if (reloadKey && isScreenFocused) {
      refreshData();
    }
  }, [reloadKey, isScreenFocused, refreshData]);

  // Clear video positions when products change - FIXED: prevent stale data
  useEffect(() => {
    videoPositions.current.clear();
    setVisibleVideoId(null);
  }, [products.length]);

  // Memoized sections
  const memoizedSections = useMemoizedSections(products);

  // Filtered products - FIXED: stable dependencies
  const filteredProducts = useMemo(() => {
    if (!isScreenFocused) return [];

    let filtered = products.filter(product => {
      // Category filter
      if (selectedCategory !== 'all' && product.category_id !== selectedCategory) {
        return false;
      }

      // Advanced filters
      if (productFilters.priceRange) {
        if (product.price < productFilters.priceRange.min || product.price > productFilters.priceRange.max) {
          return false;
        }
      }

      if (productFilters.condition?.length > 0) {
        if (!productFilters.condition.includes(product.condition)) return false;
      }

      if (productFilters.rating > 0) {
        if ((product.average_rating || 0) < productFilters.rating) return false;
      }

      return true;
    });

    // Sorting
    switch (productFilters.sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return filtered;
  }, [products, selectedCategory, productFilters, isScreenFocused]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (productFilters.priceRange?.min > 0 || productFilters.priceRange?.max < 999999999) count++;
    if (productFilters.condition?.length > 0) count++;
    if (productFilters.rating > 0) count++;
    if (productFilters.sortBy && productFilters.sortBy !== 'newest') count++;
    return count;
  }, [productFilters]);

  const loadMoreProducts = useCallback(async () => {
    if (loadingMoreProducts || !hasMoreProducts) return;

    try {
      setLoadingMoreProducts(true);
      const moreProducts = await productsAPI.getProducts({
        limit: PRODUCTS_PAGE_SIZE,
        offset: productsOffset,
      });

      const newItems = moreProducts || [];
      if (newItems.length > 0) {
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const deduped = newItems.filter(p => !existingIds.has(p.id));
          return [...prev, ...deduped];
        });
        setProductsOffset(prevOffset => prevOffset + newItems.length);
        if (newItems.length < PRODUCTS_PAGE_SIZE) {
          setHasMoreProducts(false);
        }
      } else {
        setHasMoreProducts(false);
      }
    } catch (error) {
      console.error('Error loading more products:', error);
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [loadingMoreProducts, hasMoreProducts, productsOffset]);

  // Scroll handler - FIXED: stable callback
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    scrollYRef.current = scrollY;

    // Update header opacity
    const delta = scrollY - lastScrollYRef.current;
    if (Math.abs(delta) > 5) {
      const targetOpacity = delta > 0 && scrollY > 30 ? 0 : 1;
      Animated.timing(headerOpacity, {
        toValue: targetOpacity,
        duration: 200,
        useNativeDriver: false
      }).start();
      Animated.timing(subHeaderOpacity, {
        toValue: targetOpacity,
        duration: 200,
        useNativeDriver: false
      }).start();
    }
    lastScrollYRef.current = scrollY;

    // Check video visibility - throttled
    checkVideoVisibilityThrottled();

    // Infinite scroll trigger - load more products when near bottom
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    if (distanceFromBottom < 400) {
      loadMoreProducts();
    }

    // Call parent scroll handler
    onScroll?.(event);
  }, [headerOpacity, subHeaderOpacity, onScroll, loadMoreProducts]);

  // Throttled video visibility check - FIXED: no state updates during layout
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkVideoVisibilityThrottled = useCallback(() => {
    if (visibilityTimeoutRef.current) return;

    visibilityTimeoutRef.current = setTimeout(() => {
      visibilityTimeoutRef.current = null;

      const scrollY = scrollYRef.current;
      const screenHeight = Dimensions.get('window').height;
      const centerY = scrollY + screenHeight / 2;

      let closestVideo: { id: string; distance: number } | null = null;

      videoPositions.current.forEach((absoluteY, id) => {
        const videoCenter = absoluteY + 150; // Approximate center
        const distance = Math.abs(videoCenter - centerY);

        if (distance < screenHeight / 2) {
          if (!closestVideo || distance < closestVideo.distance) {
            closestVideo = { id, distance };
          }
        }
      });

      setVisibleVideoId(prev => {
        const newId = closestVideo?.id || null;
        return prev === newId ? prev : newId; // Prevent unnecessary updates
      });
    }, 100);
  }, []);

  // Video position tracking - FIXED: no state updates in layout
  const trackVideoPosition = useCallback((id: string, y: number) => {
    videoPositions.current.set(id, y);
  }, []);

  // Handlers
  const handleProductPress = useCallback((productId: string) => {
    navigation.navigate('ProductDetails', { productId });
  }, [navigation]);

  const handleCartPress = useCallback(async (productId: string) => {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await addToCart(productId, 1);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  }, [addToCart]);

  const handleBargainPress = useCallback(async (product: Product) => {
    try {
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      if (!product.user_id) {
        return;
      }

      let chatType: 'friend' | 'vendor' | 'rider' = 'vendor';
      if (user?.is_rider) chatType = 'rider';

      const conversation = await chatAPI.findOrCreateConversation([product.user_id], chatType);

      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: product.vendor_username || 'Vendor',
        chatAvatar: product.vendor_avatar || 'https://via.placeholder.com/50',
        chatType,
        isOnline: true,
        verified: false,
        isAI: false,
        otherUserId: product.user_id,
        bargainMode: true,
        productData: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.primary_image_url || product.images?.[0] || '',
          vendor_username: product.vendor_username,
        },
      });
    } catch (error) {
      console.error('Error initiating bargain:', error);
    }
  }, [navigation, user]);

  // Render components
  const renderCategoryChips = () => {
    const allCategories = [
      { id: 'all', name: 'All', icon_name: 'apps-outline' },
      ...categories.map(cat => ({
        ...cat,
        icon_name: cat.icon_name || categoryIconMap[cat.name.toLowerCase()] || 'cube-outline'
      }))
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}
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
            onPress={() => setSelectedCategory(category.id)}
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

  const renderProductCard = (item: Product) => {
    try {
      const productData = mapProductToCard(item);

      if (!productData.title || !productData.price) {
        return <FallbackCard error="Missing product data" />;
      }

      return (
        <ModernProductCard
          product={productData}
          variant="featured"
          onPress={() => handleProductPress(productData.id)}
          onLike={() => {}}
          onBookmark={() => {}}
          onVendorPress={(vendorId) => navigation.navigate('PublicProfile', { userId: vendorId })}
          onCartPress={() => handleCartPress(item.id)}
          onBargainPress={() => handleBargainPress(item)}
        />
      );
    } catch (error) {
      return <FallbackCard error={String(error)} />;
    }
  };

  const renderVideoProductCard = (item: Product, index: number) => {
    const isVisible = visibleVideoId === item.id && isScreenFocused;

    return (
      <View
        key={item.id}
        onLayout={(event) => {
          const layout = event.nativeEvent.layout;
          const absoluteY = scrollYRef.current + layout.y;
          trackVideoPosition(item.id, absoluteY);
        }}
        style={{ width: '100%', marginBottom: 16 }}
      >
        <TouchableOpacity
          onPress={() => handleProductPress(item.id)}
          style={{
            width: '100%',
            backgroundColor: '#1a1a1a',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {item.primary_video_url ? (
            <ProductVideoPlayer
              videoUri={item.processed_videos?.[0] || item.primary_video_url}
              shouldAutoPlay={isVisible}
              containerWidth={screenWidth - 24}
            />
          ) : (
            <Image
              source={{ uri: item.primary_image_url || item.images?.[0] }}
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
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold' }}>
                ₣{item.price.toFixed(2)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleBargainPress(item);
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
                    handleCartPress(item.id);
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
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeroBanner = (hero: any, index: number) => {
    if (!hero) return null;

    return (
      <View style={{ marginHorizontal: 16, marginVertical: 12 }}>
        <TouchableOpacity
          style={{
            height: 180,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <Image
            source={typeof hero.url === 'string' ? { uri: hero.url } : hero.url}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: 16,
          }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
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

  const renderHorizontalSection = (title: string, subtitle: string, items: Product[]) => {
    if (!items || items.length === 0) return null;

    return (
      <View style={{ marginVertical: 12 }}>
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: '#888', fontSize: 12 }}>{subtitle}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {items.map((item) => (
            <View key={item.id} style={{ width: screenWidth * 0.45, marginRight: 12 }}>
              <TouchableOpacity onPress={() => handleProductPress(item.id)}>
                {renderProductCard(item)}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderAuctionSection = () => {
    const allAuctions = [...activeAuctions, ...upcomingAuctions].filter(
      auction => auction.time_status === 'active' || auction.time_status === 'upcoming'
    );
    if (allAuctions.length === 0) return null;

    return (
      <View style={{ marginVertical: 16 }}>
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Auctions 🔨</Text>
          <Text style={{ color: '#888', fontSize: 12 }}>Bid on exclusive items</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {allAuctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              variant="horizontal"
              onPress={(a) => navigation.navigate('AuctionDetails', { auctionId: a.id })}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderForYouSection = () => {
    const forYouProducts = memoizedSections.forYou;
    if (forYouProducts.length === 0) return null;

    // Separate video and regular products
    const videoProducts = forYouProducts.filter(
      p => p.media_type === 'video' && (p.processed_videos?.[0] || p.primary_video_url)
    );
    const regularProducts = forYouProducts.filter(
      p => !(p.media_type === 'video' && (p.processed_videos?.[0] || p.primary_video_url))
    );

    // Local mutable pools so products are not reused across blocks
    let remainingVideos = [...videoProducts];
    let remainingRegular = [...regularProducts];

    // Helpers for sorting
    const sortByRatingDesc = (a: Product, b: Product) => {
      const ratingA = a.average_rating || 0;
      const ratingB = b.average_rating || 0;
      return ratingB - ratingA;
    };

    const sortByNewestDesc = (a: Product, b: Product) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    };

    const blocks: React.ReactNode[] = [];
    let round = 0; // 0 = rating, 1 = newest, then repeat
    let bannerIndex = 0;

    while (remainingRegular.length > 0 || remainingVideos.length > 0) {
      const useRating = round % 2 === 0;

      // Pick up to 4 regular products for this round
      let roundRegular: Product[] = [];
      if (remainingRegular.length > 0) {
        const sortedRegular = [...remainingRegular].sort(useRating ? sortByRatingDesc : sortByNewestDesc);
        roundRegular = sortedRegular.slice(0, 4);
        const usedIds = new Set(roundRegular.map(p => p.id));
        remainingRegular = remainingRegular.filter(p => !usedIds.has(p.id));
      }

      // Pick up to 1 video product for this round
      let roundVideo: Product | null = null;
      if (remainingVideos.length > 0) {
        const sortedVideos = [...remainingVideos].sort(useRating ? sortByRatingDesc : sortByNewestDesc);
        roundVideo = sortedVideos[0];
        remainingVideos = remainingVideos.filter(p => p.id !== roundVideo!.id);
      }

      // If nothing to show in this round, stop
      if (roundRegular.length === 0 && !roundVideo) {
        break;
      }

      const heroForBlock = heroImages.length > 0
        ? heroImages[(bannerIndex + round) % heroImages.length]
        : null;

      blocks.push(
        <View key={`for-you-block-${round}`} style={{ marginTop: round === 0 ? 0 : 16 }}>
          {/* Regular products - grid */}
          {roundRegular.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {roundRegular.map((item) => (
                <View key={item.id} style={{ width: '48%', marginBottom: 16 }}>
                  <TouchableOpacity onPress={() => handleProductPress(item.id)}>
                    {renderProductCard(item)}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Video products - full width */}
          {roundVideo && renderVideoProductCard(roundVideo, round)}

          {heroForBlock && renderHeroBanner(heroForBlock, round)}
        </View>
      );

      bannerIndex++;
      round++;
    }

    return (
      <View style={{ paddingHorizontal: 12, marginTop: 12 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
          For You 🎯
        </Text>
        {blocks}
      </View>
    );
  };

  const renderLoadingSkeleton = () => (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ padding: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: 80, height: 32, backgroundColor: '#1a1a1a', borderRadius: 16, marginRight: 8 }} />
          ))}
        </ScrollView>
      </View>
      <View style={{ padding: 12 }}>
        <View style={{ width: 150, height: 24, backgroundColor: '#333', borderRadius: 4, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[1, 2].map((i) => (
            <View key={i} style={{ flex: 1, height: 200, backgroundColor: '#1a1a1a', borderRadius: 12 }} />
          ))}
        </View>
      </View>
    </View>
  );

  // Main render
  if (!isScreenFocused) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#888' }}>Screen not focused</Text>
      </View>
    );
  }

  if (loading) {
    return renderLoadingSkeleton();
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Error Banner */}
      {errorState && (
        <View style={{
          position: 'absolute',
          top: insets.top + HEADER_FULL_HEIGHT + SUB_HEADER_HEIGHT + 8,
          left: 12,
          right: 12,
          backgroundColor: '#FF4757',
          borderRadius: 8,
          padding: 12,
          zIndex: 1000,
        }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>{errorState}</Text>
          <TouchableOpacity onPress={() => loadData(true)}>
            <Text style={{ color: '#FFF', marginTop: 8 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshData} colors={['#3498DB']} />
        }
        contentContainerStyle={{
          paddingTop: HEADER_FULL_HEIGHT + SUB_HEADER_HEIGHT + insets.top + 16,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
        }}
      >
        {/* Category Chips */}
        {renderCategoryChips()}

        {/* Active Filters Banner */}
        {activeFilterCount > 0 && (
          <View style={{
            margin: 12,
            backgroundColor: '#1a1a1a',
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderLeftWidth: 3,
            borderLeftColor: '#3498DB',
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#3498DB', fontWeight: '600' }}>
                {activeFilterCount} Filter{activeFilterCount > 1 ? 's' : ''} Active
              </Text>
              <Text style={{ color: '#888', fontSize: 11 }}>
                {filteredProducts.length} of {products.length} products
              </Text>
            </View>
            <TouchableOpacity
              onPress={resetProductFilters}
              style={{ backgroundColor: '#3498DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
            >
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedCategory === 'all' ? (
          // Mixed content for "All" category
          <>
            {renderHeroBanner(heroImages[heroIndex % Math.max(heroImages.length, 1)], 0)}
            {renderHorizontalSection(
              'Trending Now 🔥',
              'Hot products everyone\'s buying right now',
              trendingProducts.length > 0 ? trendingProducts : memoizedSections.trending
            )}
            {renderHorizontalSection('Hot Picks ⭐', 'Featured products you\'ll love', memoizedSections.hotPicks)}
            {renderHorizontalSection(
              'Seasonal Rave 🎄',
              'Perfect for the current season & holidays',
              seasonalProducts.length > 0 ? seasonalProducts : memoizedSections.seasonalRave
            )}
            {renderHorizontalSection('Combo Deals 💰', 'Bundle and save', memoizedSections.combodeals)}
            {renderHorizontalSection('Flash Sales ⚡', 'Limited time offers', memoizedSections.flashSales)}
            {renderAuctionSection()}
            {renderForYouSection()}
            {loadingMoreProducts && (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color="#3498DB" />
              </View>
            )}
          </>
        ) : (
          // Category-specific grid
          <>
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FFF' }}>
                {categories.find(c => c.id === selectedCategory)?.name || selectedCategory} Products
              </Text>
              <Text style={{ color: '#888' }}>{filteredProducts.length} products found</Text>
            </View>
            <View style={{ paddingHorizontal: 12 }}>
              {filteredProducts.map((item) => (
                item.media_type === 'video' && (item.processed_videos?.[0] || item.primary_video_url) ? (
                  renderVideoProductCard(item, 0)
                ) : (
                  <View key={item.id} style={{ width: '48%', marginBottom: 16 }}>
                    <TouchableOpacity onPress={() => handleProductPress(item.id)}>
                      {renderProductCard(item)}
                    </TouchableOpacity>
                  </View>
                )
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default ProductsTab;