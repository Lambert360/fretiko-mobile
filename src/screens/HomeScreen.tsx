import { Ionicons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProductCard from '../components/ProductCard';
import VideoCard from '../components/VideoCard';
import CartModal from '../components/CartModal';
import ServiceBookingModal from '../components/ServiceBookingModal';
import CommentsDrawer from '../components/CommentsDrawer';
import LocationSelector from '../components/LocationSelector';
import FilterDropdown, { FilterOptions } from '../components/FilterDropdown';
import ServiceVideoPlayer from '../components/ServiceVideoPlayer';
import { productsAPI, Product, ProductCategory } from '../services/productsAPI';

import { servicesAPI, VideoFeedItem } from '../services/servicesAPI';
import { userAPI } from '../services/userAPI';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Compact header dimensions - Twitter-style (REMOVED TABS FROM MAIN HEADER)
const HEADER_FULL_HEIGHT = 60; // Increased to ensure content fits
const HEADER_MIN_HEIGHT = 50; // Minimum height
const SUB_HEADER_HEIGHT = 44; // New sub-header for Products/Services
const TAB_BAR_HEIGHT = 70;

// Category icon mapping - connects backend categories to UI icons
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

// Choice Day Categories
const choiceDayCategories = [
  { id: 'clearance', name: 'Clearance', icon: 'pricetag-outline', color: '#FF6B6B' },
  { id: 'store-day', name: 'Store of\nthe Day', icon: 'storefront-outline', color: '#4ECDC4' },
  { id: 'trials', name: '$0.01\nTrials', icon: 'cash-outline', color: '#45B7D1' },
  { id: 'top-stores', name: 'Top stores', icon: 'trophy-outline', color: '#96CEB4' },
  { id: 'categories', name: 'Categories', icon: 'grid-outline', color: '#FFEAA7' },
];

// Memoized ProductCard with better error handling
const StableProductCard = memo(ProductCard, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.title === nextProps.title &&
    prevProps.price === nextProps.price &&
    prevProps.image?.uri === nextProps.image?.uri
  );
});

// Enhanced fallback component with more debugging info
const FallbackCard = ({ error }: { error?: string }) => (
  <View style={{ padding: 20, backgroundColor: '#1a1a1a', borderRadius: 8, margin: 6 }}>
    <Text style={{ color: 'red', fontSize: 12, marginBottom: 4 }}>ProductCard Error</Text>
    {error && <Text style={{ color: '#888', fontSize: 10 }}>{error}</Text>}
  </View>
);

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { itemCount = 0, isVisible: isCartVisible, showCart, hideCart, addToCart, addServiceToCart } = useCart();
  const tabBarHeightFromContext = React.useContext(BottomTabBarHeightContext) || TAB_BAR_HEIGHT;

  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [focusedVideoId, setFocusedVideoId] = useState<string | null>(null);
  
  // Modal states
  const [isLocationSelectorVisible, setLocationSelectorVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('Lagos, Nigeria');
  const [bookingService, setBookingService] = useState<VideoFeedItem | null>(null);
  const [commentsServiceId, setCommentsServiceId] = useState<string | null>(null);
  const [likedServices, setLikedServices] = useState<Set<string>>(new Set());
  const [isFilterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    priceRange: { min: 0, max: 999999999 },
    condition: [],
    location: [],
    rating: 0,
    category: [],
    sortBy: 'newest',
    availability: [],
  });
  
  // Real data state management
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [videoFeedData, setVideoFeedData] = useState<VideoFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // User profile state for role checking
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    hours: 22,
    minutes: 14,
    seconds: 32
  });
  
  const mainPagerRef = useRef<PagerView>(null);
  const headerHeight = useRef(new Animated.Value(HEADER_FULL_HEIGHT)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current; // Added opacity animation
  const subHeaderOpacity = useRef(new Animated.Value(1)).current; // Added for sub-header fade
  const sidebarTranslateX = useRef(new Animated.Value(-screenWidth * 0.75)).current;
  const lastScrollY = useRef(0);

  // Data loading functions - USING REAL API DATA
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      // Load real data from API and user profile for role checking
      const promises = [
        productsAPI.getProducts(),
        productsAPI.getCategories()
      ];

      // Only load profile if user is authenticated
      if (user?.id) {
        promises.push(userAPI.getProfile());
      }

      const results = await Promise.all(promises);
      const [productsData, categoriesData, profileData] = results;
      
      setProducts(productsData);
      setCategories(categoriesData);

      // Set profile data if available
      if (profileData) {
        setUserProfile(profileData);
        console.log('✅ User profile loaded:', { isSeller: profileData.isSeller, isRider: profileData.isRider });
      }
      
      // Load video data from API
      try {
        const videoData = await servicesAPI.getVideoFeed({ limit: 10 });
        console.log('🎥 Video feed data received:', videoData);
        console.log('🎥 First video item:', videoData[0]);

        // If no video data from API, use mock data for testing
        if (!videoData || videoData.length === 0) {
          console.log('🎥 No video data from API, using mock data for testing');
          const mockVideoData = [
            {
              id: 'mock-1',
              title: 'Home Cleaning Service',
              thumbnail: 'https://via.placeholder.com/400x600',
              videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
              userId: 'user-1',
              username: 'cleaner_pro',
              userAvatar: 'https://via.placeholder.com/40x40',
              description: 'Professional home cleaning services at affordable rates. Book now!',
              likes: '125',
              comments: '23',
              shares: '8',
              price: 45.00,
              location: 'Lagos, Nigeria',
              serviceProvider: 'CleanPro Services',
              rating: 4.8,
              completedJobs: '150',
              isLiked: false,
              isBookmarked: false
            },
            {
              id: 'mock-2',
              title: 'Hair Styling',
              thumbnail: 'https://via.placeholder.com/400x600',
              videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
              userId: 'user-2',
              username: 'hair_stylist',
              userAvatar: 'https://via.placeholder.com/40x40',
              description: 'Transform your look with our professional hair styling services',
              likes: '89',
              comments: '15',
              shares: '5',
              price: 35.00,
              location: 'Lagos, Nigeria',
              serviceProvider: 'Style Studio',
              rating: 4.5,
              completedJobs: '95',
              isLiked: false,
              isBookmarked: false
            }
          ];
          setVideoFeedData(mockVideoData);
          console.log(`✅ Loaded mock data: ${productsData.length} products, ${categoriesData.length} categories, ${mockVideoData.length} videos`);
        } else {
          setVideoFeedData(videoData);
          console.log(`✅ Loaded real data: ${productsData.length} products, ${categoriesData.length} categories, ${videoData.length} videos`);
        }
      } catch (videoError) {
        console.warn('🔴 Error loading video data:', videoError);

        // Fallback to mock data if API fails
        console.log('🎥 API failed, using mock data for testing');
        const mockVideoData = [
          {
            id: 'mock-1',
            title: 'Home Cleaning Service',
            thumbnail: 'https://via.placeholder.com/400x600',
            videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            userId: 'user-1',
            username: 'cleaner_pro',
            userAvatar: 'https://via.placeholder.com/40x40',
            description: 'Professional home cleaning services at affordable rates. Book now!',
            likes: '125',
            comments: '23',
            shares: '8',
            price: 45.00,
            location: 'Lagos, Nigeria',
            serviceProvider: 'CleanPro Services',
            rating: 4.8,
            completedJobs: '150',
            isLiked: false,
            isBookmarked: false
          },
          {
            id: 'mock-2',
            title: 'Hair Styling',
            thumbnail: 'https://via.placeholder.com/400x600',
            videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            userId: 'user-2',
            username: 'hair_stylist',
            userAvatar: 'https://via.placeholder.com/40x40',
            description: 'Transform your look with our professional hair styling services',
            likes: '89',
            comments: '15',
            shares: '5',
            price: 35.00,
            location: 'Lagos, Nigeria',
            serviceProvider: 'Style Studio',
            rating: 4.5,
            completedJobs: '95',
            isLiked: false,
            isBookmarked: false
          }
        ];
        setVideoFeedData(mockVideoData);
        console.log(`✅ Loaded mock data: ${productsData.length} products, ${categoriesData.length} categories, ${mockVideoData.length} videos`);
      }
    } catch (error) {
      console.error('🔴 Error loading data:', error);
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData(false);
  };




  // Function to shuffle array for random display
  const getRandomProducts = (products: Product[], count = 4) => {
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };


  // Load data when component mounts
  useEffect(() => {
    loadData();
  }, []);

  // Debug: Track isPlaying state changes
  useEffect(() => {
    console.log(`🎵 isPlaying state changed: ${isPlaying} (activeTab: ${activeTab})`);
  }, [isPlaying, activeTab]);

  // Ensure video starts playing when switching to services tab
  useEffect(() => {
    console.log(`🎬 Active tab changed to: ${activeTab}, isPlaying: ${isPlaying}, videoCount: ${videoFeedData.length}`);
    if (activeTab === 'services' && videoFeedData.length > 0) {
      console.log('🎬 Setting isPlaying to true for services tab');
      setIsPlaying(true);
    } else if (activeTab === 'products') {
      console.log('🎬 Setting isPlaying to false for products tab');
      setIsPlaying(false);
    }
  }, [activeTab, videoFeedData.length]);

  // AGGRESSIVE FIX: Continuously ensure isPlaying is true when on services tab
  useEffect(() => {
    if (activeTab === 'services' && !isPlaying && videoFeedData.length > 0) {
      console.log('🚨 AGGRESSIVE FIX: Forcing isPlaying to true on services tab');
      setIsPlaying(true);
    }
  }, [activeTab, isPlaying, videoFeedData.length]);

  // Handle screen focus changes for video playback
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused - resume playing if on services tab
      console.log(`🎬 Screen focused - activeTab: ${activeTab}, videoCount: ${videoFeedData.length}`);
      if (activeTab === 'services' && videoFeedData.length > 0) {
        console.log('🎬 Screen focused - setting isPlaying to true for services tab');
        setIsPlaying(true);
      }

      return () => {
        // Screen is unfocused - pause video
        console.log('🎬 Screen unfocused - setting isPlaying to false');
        setIsPlaying(false);
      };
    }, [activeTab, videoFeedData.length])
  );

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime.seconds > 0) {
          return { ...prevTime, seconds: prevTime.seconds - 1 };
        } else if (prevTime.minutes > 0) {
          return { ...prevTime, minutes: prevTime.minutes - 1, seconds: 59 };
        } else if (prevTime.hours > 0) {
          return { hours: prevTime.hours - 1, minutes: 59, seconds: 59 };
        }
        return prevTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Video interaction handlers for VideoCard
  const handleVideoTouch = () => {
    // VideoCard handles its own UI state now
  };

  const handleLike = async (itemId: string) => {
    try {
      // Optimistic update
      setLikedServices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });

      // Update video data
      setVideoFeedData(prev => prev.map(video => 
        video.id === itemId 
          ? { 
              ...video, 
              isLiked: !video.isLiked,
              likes: video.isLiked 
                ? (parseInt(video.likes) - 1).toString()
                : (parseInt(video.likes) + 1).toString()
            }
          : video
      ));

      // Call API
      await servicesAPI.toggleLike(itemId);
    } catch (error) {
      console.error('Error liking service:', error);
      // Revert optimistic update on error
      setLikedServices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    }
  };

  const handleComment = (itemId: string) => {
    setCommentsServiceId(itemId);
  };

  const handleBookmark = async (itemId: string) => {
    try {
      // Optimistic update
      setVideoFeedData(prev => prev.map(video => 
        video.id === itemId 
          ? { ...video, isBookmarked: !video.isBookmarked }
          : video
      ));
      
      // TODO: Call bookmark API when available
      console.log('Bookmark service:', itemId);
    } catch (error) {
      console.error('Error bookmarking service:', error);
    }
  };

  const handleShare = async (itemId: string) => {
    try {
      const result = await servicesAPI.shareService(itemId);
      console.log('Share URL:', result.shareUrl);
      // TODO: Open native share sheet
    } catch (error) {
      console.error('Error sharing service:', error);
    }
  };

  const handleBook = (itemId: string) => {
    const service = videoFeedData.find(s => s.id === itemId);
    if (service) {
      setBookingService(service);
    }
  };

  const handleServiceBooking = async (serviceId: string, date: Date, time: string, notes?: string) => {
    try {
      await addServiceToCart(serviceId, date, time, notes);
      setBookingService(null);
    } catch (error) {
      console.error('Error booking service:', error);
    }
  };

  const filteredProducts = products.filter(product => 
    selectedCategory === 'all' || 
    product.category_id === selectedCategory ||
    categories.find(cat => cat.id === product.category_id)?.name.toLowerCase() === selectedCategory
  );

  const handleTabPress = (tab: 'products' | 'services') => {
    const targetPage = tab === 'products' ? 0 : 1;
    mainPagerRef.current?.setPage(targetPage);
  };

  const toggleSidebar = () => {
    const toValue = isSidebarVisible ? -screenWidth * 0.75 : 0;
    setSidebarVisible(!isSidebarVisible);
    Animated.timing(sidebarTranslateX, { toValue, duration: 300, useNativeDriver: true }).start();
  };

  const handleLocationPress = () => setLocationSelectorVisible(true);
  const handleCartIconPress = () => navigation.navigate('Cart');

  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location);
    setLocationSelectorVisible(false);
  };

  const handleFilterPress = () => {
    setFilterVisible(true);
  };

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    setFilterVisible(false);
    // TODO: Apply filters to product list
    console.log('Applying filters:', filters);
  };

  const handleResetFilters = () => {
    setFilters({
      priceRange: { min: 0, max: 999999999 },
      condition: [],
      location: [],
      rating: 0,
      category: [],
      sortBy: 'newest',
      availability: [],
    });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const delta = currentScrollY - lastScrollY.current;
    const isDown = delta > 0;
    if (Math.abs(delta) > 5) {
      const targetOpacity = isDown && currentScrollY > 30 ? 0 : 1;
      
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
    lastScrollY.current = currentScrollY;
  };

  // Enhanced ProductCard with real backend data transformation
  const renderEnhancedProductCard = (item: any, isHorizontal = false) => {
    const cardStyle = isHorizontal ? { width: screenWidth * 0.4, marginHorizontal: 6 } : {};
    
    // Handle both mock data and real Product data structures
    const productData = {
      id: item.id || 'unknown',
      title: item.name || item.title || 'Unknown Product',
      price: Number(item.price) || 0,
      originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
      image: item.primary_image_url || item.images?.[0] || item.image || 'https://via.placeholder.com/300x300',
      rating: Number(item.average_rating || item.rating) || 4.0,
      sellerName: item.sellerName || 'Vendor',
      sellerLogo: item.sellerLogo,
      soldCount: item.soldCount || (item.view_count ? String(Math.floor(Number(item.view_count) / 10)) : '0'),
      isTopSelling: Boolean(item.isTopSelling || item.is_featured),
      isTrending: Boolean(item.isTrending || (item.like_count && Number(item.like_count) > 20)),
      isChoice: Boolean(item.isChoice),
      discount: item.discount ? Number(item.discount) : undefined,
    };
    
    // Comprehensive validation
    if (!productData.title || !productData.price) {
      console.warn('ProductCard: Missing required data', productData);
      return <FallbackCard error="Missing product data" />;
    }

    // Check if ProductCard component is available
    if (!ProductCard || typeof ProductCard !== 'function') {
      console.error('ProductCard component is not available');
      return <FallbackCard error="Component not available" />;
    }
    
    try {
      return (
        <View style={[cardStyle, { position: 'relative' }]}>
          {/* Social proof badges */}
          <View style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, flexDirection: 'column' }}>
            {productData.isChoice && (
              <View style={{ backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 }}>
                <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>Choice</Text>
              </View>
            )}
            {productData.isTopSelling && (
              <View style={{ backgroundColor: '#FF4757', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>Featured</Text>
              </View>
            )}
            {productData.isTrending && (
              <View style={{ backgroundColor: '#2ED573', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>Trending</Text>
              </View>
            )}
            {productData.discount && (
              <View style={{ backgroundColor: '#FF4757', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>{String(productData.discount)}% off</Text>
              </View>
            )}
          </View>
          
          {/* View count badge */}
          {productData.soldCount && String(productData.soldCount) && (
            <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ color: 'white', fontSize: 9, fontWeight: '600' }}>{String(productData.soldCount)} views</Text>
            </View>
          )}
          
          {/* Render the actual ProductCard */}
          <StableProductCard
            title={productData.title}
            price={productData.price}
            originalPrice={productData.originalPrice}
            image={{ uri: productData.image }}
            rating={productData.rating}
            sellerName={productData.sellerName}
            sellerLogo={productData.sellerLogo}
            onPress={() => handleProductPress(productData.id)}
            onCartPress={() => handleCartPress(productData.id)}
            onBargainPress={() => handleBargainPress(productData.id)}
          />
        </View>
      );
    } catch (error) {
      console.error('Error in renderEnhancedProductCard:', error);
      return <FallbackCard error={`Render error: ${error.message}`} />;
    }
  };

  const renderCategoryChips = () => {
    // Create combined categories with "All" at the beginning (if not already present)
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
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}
        scrollEnabled={true}
        decelerationRate={Platform.OS === 'android' ? 0.85 : 'normal'}
        overScrollMode={Platform.OS === 'android' ? 'always' : 'auto'}
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

  // NEW: Choice Day Banner
  const renderChoiceDayBanner = () => (
    <View style={{ marginHorizontal: 12, marginVertical: 8 }}>
      <View style={{ 
        backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        borderRadius: 12, 
        padding: 16, 
        flexDirection: 'row', 
        alignItems: 'center',
        backgroundColor: '#667eea'
      }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginRight: 8 }}>Choice Day</Text>
        <Ionicons name="diamond-outline" size={20} color="white" />
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={18} color="white" />
      </View>
    </View>
  );

  // NEW: Choice Day Categories
  const renderChoiceDayCategories = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 20 }}
      contentContainerStyle={{ paddingHorizontal: 12 }}
    >
      {choiceDayCategories.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={{
            backgroundColor: category.color,
            width: 70,
            height: 70,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name={category.icon as any} size={24} color="white" />
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // Bulk Deals Section - using real featured products
  const renderBulkDealsSection = () => {
    const featuredProducts = products.filter(p => p.is_featured).slice(0, 6);
    
    if (featuredProducts.length === 0) return null;
    
    return (
      <View style={{ marginVertical: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12 }}>
          <View>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              <Text style={{ color: '#3498DB' }}>Featured</Text> Products
            </Text>
            <Text style={{ color: '#888', fontSize: 14 }}>Handpicked by our team</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ color: '#888', fontSize: 12, marginRight: 4 }}>Ends:</Text>
            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
              {String(timeLeft.hours).padStart(2, '0')}:
            </Text>
            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
              {String(timeLeft.minutes).padStart(2, '0')}:
            </Text>
            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
              {String(timeLeft.seconds).padStart(2, '0')}
            </Text>
          </View>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          decelerationRate="fast"
          snapToInterval={screenWidth * 0.4 + 12}
          snapToAlignment="start"
        >
          {featuredProducts.map((item) => (
            <View key={item.id}>
              {renderEnhancedProductCard(item, true)}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Choice Day Products Section - using high-rated products
  const renderChoiceDayProductsSection = () => {
    const highRatedProducts = products
      .filter(p => (p.average_rating || 0) > 4.5)
      .slice(0, 6);
    
    if (highRatedProducts.length === 0) return null;
    
    return (
      <View style={{ marginVertical: 20 }}>
        {renderChoiceDayBanner()}
        {renderChoiceDayCategories()}
        
        <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>Top Rated</Text>
          <Text style={{ color: '#888', fontSize: 14 }}>Highly rated products you'll love</Text>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          decelerationRate="fast"
          snapToInterval={screenWidth * 0.4 + 12}
          snapToAlignment="start"
        >
          {highRatedProducts.map((item) => (
            <View key={item.id}>
              {renderEnhancedProductCard(item, true)}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // More for You Section - random products from all
  const renderMoreForYouSection = () => {
    const randomProducts = getRandomProducts(products, 6);
    
    if (randomProducts.length === 0) return null;
    
    return (
      <View style={{ marginVertical: 20 }}>
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>More for you ✨</Text>
          <Text style={{ color: '#888', fontSize: 14 }}>Handpicked recommendations</Text>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          decelerationRate="fast"
          snapToInterval={screenWidth * 0.4 + 12}
          snapToAlignment="start"
        >
          {randomProducts.map((item) => (
            <View key={item.id}>
              {renderEnhancedProductCard(item, true)}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };


  // NEW: Sub-header component for Products/Services tabs with fade animation
  const renderSubHeader = () => (
    <Animated.View style={{ 
      position: 'absolute',
      top: insets.top + HEADER_FULL_HEIGHT,
      left: 0,
      right: 0,
      backgroundColor: '#000000', 
      height: SUB_HEADER_HEIGHT,
      flexDirection: 'row', 
      justifyContent: 'center', 
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#333',
      zIndex: 999,
      opacity: activeTab === 'services' ? 0 : subHeaderOpacity // Hide for services tab
    }}>
      <TouchableOpacity
        style={{ 
          marginRight: 24, 
          paddingHorizontal: 16, 
          paddingVertical: 8, 
          borderBottomWidth: activeTab === 'products' ? 3 : 0, 
          borderBottomColor: '#fff' 
        }}
        onPress={() => handleTabPress('products')}
      >
        <Text style={{ 
          color: activeTab === 'products' ? '#fff' : '#888', 
          fontSize: 15, 
          fontWeight: activeTab === 'products' ? '700' : '500' 
        }}>
          Products
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{ 
          paddingHorizontal: 16, 
          paddingVertical: 8, 
          borderBottomWidth: activeTab === 'services' ? 3 : 0, 
          borderBottomColor: '#fff' 
        }}
        onPress={() => handleTabPress('services')}
      >
        <Text style={{ 
          color: activeTab === 'services' ? '#fff' : '#888', 
          fontSize: 15, 
          fontWeight: activeTab === 'services' ? '700' : '500' 
        }}>
          Services
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSidebar = () => (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: screenWidth * 0.75, backgroundColor: '#111111', zIndex: 3000, transform: [{ translateX: sidebarTranslateX }], paddingTop: insets.top + 50 }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333' }}>
          <Image source={require('../../assets/images/logo.png')} style={{ width: 90, height: 22, borderRadius: 4 }} resizeMode="contain" />
          <TouchableOpacity onPress={toggleSidebar}><Ionicons name="close" size={22} color="white" /></TouchableOpacity>
        </View>
        <View style={{ paddingVertical: 24 }}>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', paddingHorizontal: 20, marginBottom: 16 }}>LIVE SHOPPING</Text>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 10, marginBottom: 12 }}
            onPress={() => {
              toggleSidebar();
              navigation.navigate('LiveSales');
            }}
          >
            <View style={{ width: 36, height: 36, backgroundColor: '#FF4757', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="tv-outline" size={18} color="white" /></View>
            <View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Live Sales</Text><Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>Watch and shop live streams</Text></View>
            <View style={{ backgroundColor: '#FF4757', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}><Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>LIVE</Text></View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 10, marginBottom: 12 }}
            onPress={() => {
              toggleSidebar();
              navigation.navigate('Stores');
            }}
          >
            <View style={{ width: 36, height: 36, backgroundColor: '#3498DB', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="storefront-outline" size={18} color="white" /></View>
            <View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Stores</Text><Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>Browse verified premium stores</Text></View>
            <Ionicons name="chevron-forward" size={14} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 10, marginBottom: 12 }}
            onPress={() => {
              toggleSidebar();
              navigation.navigate('Orders');
            }}
          >
            <View style={{ width: 36, height: 36, backgroundColor: '#27AE60', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="bag-outline" size={18} color="white" /></View>
            <View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Orders</Text><Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>Track your purchases</Text></View>
            <Ionicons name="chevron-forward" size={14} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 10, marginBottom: 12 }}
            onPress={() => {
              toggleSidebar();
              handleFilterPress();
            }}
          >
            <View style={{ width: 36, height: 36, backgroundColor: '#E67E22', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="funnel-outline" size={18} color="white" /></View>
            <View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Filters</Text><Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>Advanced search options</Text></View>
            <Ionicons name="chevron-forward" size={14} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 10, marginBottom: 12 }}
            onPress={() => {
              toggleSidebar();
              navigation.navigate('AuctionDiscovery');
            }}
          >
            <View style={{ width: 36, height: 36, backgroundColor: '#3498DB', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="hammer-outline" size={18} color="white" /></View>
            <View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Auctions</Text><Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>Bid on exclusive items</Text></View>
            <Ionicons name="chevron-forward" size={14} color="#888" />
          </TouchableOpacity>
          {(userProfile?.isSeller || userProfile?.isRider) && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#1a1a1a', marginHorizontal: 20, borderRadius: 10 }}
              onPress={() => {
                toggleSidebar();
                navigation.navigate('Workspace');
              }}
            >
              <View style={{ width: 36, height: 36, backgroundColor: '#9B59B6', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="bar-chart-outline" size={18} color="white" /></View>
              <View style={{ flex: 1 }}><Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Workspace</Text><Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>Manage orders & analytics</Text></View>
              <Ionicons name="chevron-forward" size={14} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Animated.View>
  );

  // Load hero images from Supabase with local fallback
  const [heroImages, setHeroImages] = useState<any[]>([]);
  
  useEffect(() => {
    const loadHeroImages = async () => {
      try {
        const { heroImagesAPI } = await import('../services/heroImagesAPI');
        const images = await heroImagesAPI.getHeroImages();
        setHeroImages(images);
      } catch (error) {
        console.warn('Failed to load hero images, using local fallback');
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

  // Alibaba-style Products View
  const renderProductsTab = () => {
    // Algorithm-based sections using existing database fields
    const getTrendingProducts = () => products
      .filter(p => {
        const createdAt = new Date(p.created_at);
        const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceCreated <= 48 && (p.view_count > 5 || p.like_count > 2);
      })
      .sort((a, b) => (b.view_count + b.like_count * 3) - (a.view_count + a.like_count * 3))
      .slice(0, 8);

    const getHotPicks = () => products.filter(p => p.is_featured).slice(0, 8);
    const getSeasonalRave = () => products.filter(p => 
      p.tags?.some(tag => 
        ['seasonal', 'summer', 'winter', 'spring', 'fall', 'holiday', 'christmas', 'valentine'].includes(tag.toLowerCase())
      )
    ).slice(0, 8);
    const getCombodeals = () => products.filter(p => 
      p.tags?.some(tag => ['combo', 'bundle', 'set', 'package'].includes(tag.toLowerCase()))
    ).slice(0, 8);
    const getFlashSales = () => products.filter(p => 
      p.tags?.some(tag => ['sale', 'flash', 'deal', 'discount'].includes(tag.toLowerCase()))
    ).slice(0, 8);
    const getForYou = () => products.slice(0, 20); // TODO: Base on user history

    // Generate mixed content with periodic heroes and banners
    const generateMixedContent = () => {
      const mixedContent: any[] = [];
      let cardCount = 0;
      let heroIndex = 0;

      // Initial hero right after category chips
      mixedContent.push({ type: 'hero', data: heroImages[heroIndex % heroImages.length] });
      heroIndex++;

      // Dynamic sections
      const sections = [
        { type: 'section', data: { title: 'Trending 🔥', subtitle: 'High engagement in last 48h', products: getTrendingProducts() } },
        { type: 'section', data: { title: 'Hot Picks ⭐', subtitle: 'Admin selected favorites', products: getHotPicks() } },
        { type: 'section', data: { title: 'Seasonal Rave 🌟', subtitle: 'Perfect for this season', products: getSeasonalRave() } },
        { type: 'section', data: { title: 'Combo Deals 💰', subtitle: 'Better together bundles', products: getCombodeals() } },
        { type: 'section', data: { title: 'Flash Sales ⚡', subtitle: 'Time-limited offers', products: getFlashSales() } }
      ];

      sections.forEach((section, sectionIndex) => {
        if (section.data.products.length > 0) {
          mixedContent.push(section);
          cardCount += section.data.products.length;

          // Add banner every 10-15 cards
          if (cardCount >= 10 + (Math.random() * 5)) {
            mixedContent.push({ type: 'banner', data: { title: 'Advertise Here', subtitle: 'Get your products seen by more buyers' } });
            cardCount = 0;
          }

          // Add hero every 20-30 cards  
          if (sectionIndex > 0 && sectionIndex % 2 === 0) {
            mixedContent.push({ type: 'hero', data: heroImages[heroIndex % heroImages.length] });
            heroIndex++;
          }
        }
      });

      // For You section in twos
      const forYouProducts = getForYou();
      if (forYouProducts.length > 0) {
        mixedContent.push({ 
          type: 'for-you', 
          data: { 
            title: 'For You 🎯', 
            subtitle: 'Personalized recommendations', 
            products: forYouProducts 
          } 
        });
      }

      return mixedContent;
    };

    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshData}
              colors={['#3498DB']}
              tintColor="#3498DB"
              title="Pull to refresh"
              titleColor="#888"
            />
          }
          contentContainerStyle={{
            paddingTop: HEADER_FULL_HEIGHT + SUB_HEADER_HEIGHT + insets.top + 16,
            paddingBottom: tabBarHeightFromContext + insets.bottom + 20,
          }}
        >
          {/* Category Chips */}
          {renderCategoryChips()}

          {selectedCategory === 'all' ? (
            // Show dynamic mixed content for "All"
            generateMixedContent().map((item, index) => {
              switch (item.type) {
                case 'hero':
                  return renderPeriodicHero(item.data, index);
                case 'section':
                  return renderDynamicSection(item.data.title, item.data.subtitle, item.data.products, index);
                case 'banner':
                  return renderPeriodicBanner(item.data.title, item.data.subtitle, index);
                case 'for-you':
                  return renderForYouSection(item.data.title, item.data.subtitle, item.data.products, index);
                default:
                  return null;
              }
            })
          ) : (
            // Show category-specific grid
            <>
              <View style={{ paddingHorizontal: 16, marginBottom: 16, marginTop: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 2 }}>
                  {categories.find(c => c.id === selectedCategory)?.name || 
                    selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Products
                </Text>
                <Text style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
                  {filteredProducts.length} products found
                </Text>
              </View>
              <View style={{ paddingHorizontal: 12, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {filteredProducts.map((item) => (
                    <View key={item.id} style={{ width: '48%', marginBottom: 16 }}>
                      <TouchableOpacity 
                        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      >
                        {renderEnhancedProductCard(item, false)}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  };


  // Alibaba-style Component Functions
  const renderPeriodicHero = (hero: any, index: number) => {
    if (!hero) return null;
    
    return (
      <View key={`hero-${index}`} style={{ marginHorizontal: 16, marginVertical: 20 }}>
        <TouchableOpacity
          style={{
            height: 180,
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
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

  const renderDynamicSection = (title: string, subtitle: string, products: Product[], index: number) => {
    if (products.length === 0) return null;
    
    return (
      <View key={`section-${index}`} style={{ marginVertical: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 }}>
          <View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{title}</Text>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity>
            <Text style={{ color: '#3498DB', fontSize: 12, fontWeight: '600' }}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
        >
          {products.map((item) => (
            <View key={item.id} style={{ width: screenWidth * 0.4, marginRight: 8 }}>
              <TouchableOpacity 
                onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
              >
                {renderEnhancedProductCard(item, true)}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPeriodicBanner = (title: string, subtitle: string, index: number) => {
    return (
      <View key={`banner-${index}`} style={{ marginVertical: 16, paddingHorizontal: 16 }}>
        <TouchableOpacity
          style={{
            height: 120,
            backgroundColor: '#1a1a1a',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: '#333',
            borderStyle: 'dashed',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
          onPress={() => {
            // TODO: Navigate to advertise signup
            console.log('Navigate to advertise signup');
          }}
        >
          <Ionicons name="megaphone-outline" size={32} color="#888" style={{ marginBottom: 8 }} />
          <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
            {title}
          </Text>
          <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            {subtitle}
          </Text>
          <Text style={{ color: '#3498DB', fontSize: 12, fontWeight: '600', marginTop: 8 }}>
            Get Started →
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderForYouSection = (title: string, subtitle: string, products: Product[], index: number) => {
    if (products.length === 0) return null;
    
    return (
      <View key={`for-you-${index}`} style={{ marginVertical: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 }}>
          <View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>{title}</Text>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity>
            <Text style={{ color: '#3498DB', fontSize: 12, fontWeight: '600' }}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {/* Display in twos - 2 columns grid */}
        <View style={{ paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {products.map((item) => (
              <View key={item.id} style={{ width: '48%', marginBottom: 16 }}>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                >
                  {renderEnhancedProductCard(item, false)}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Handler for vendor profile navigation
  const handleVendorPress = (userId: string) => {
    console.log('🔍 handleVendorPress called with userId:', userId);
    console.log('🔍 userId type:', typeof userId);
    (navigation as any).navigate('PublicProfile', { userId });
  };

  // Handler for product press (navigation to product details)
  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetails', { productId });
  };

  // Handler for add to cart button press
  const handleCartPress = async (productId: string) => {
    try {
      await addToCart(productId, 1);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  // Handler for bargain/negotiation button press
  const handleBargainPress = (productId: string) => {
    // TODO: Implement bargain/negotiation functionality
    console.log('Bargain pressed for product:', productId);
    // For now, just show an alert
    Alert.alert(
      'Coming Soon', 
      'Bargaining feature will be available soon!',
      [{ text: 'OK', style: 'default' }]
    );
  };

  // Video item renderer using VideoCard component
  const renderVideoItem = ({ item, index }: { item: VideoFeedItem; index: number }) => (
    <VideoCard
      item={item}
      isActive={activeTab === 'services' && index === currentVideoIndex}
      isPlaying={isPlaying}
      tabBarHeight={tabBarHeightFromContext}
      headerHeight={activeTab === 'services' ? 0 : HEADER_FULL_HEIGHT + SUB_HEADER_HEIGHT}
      onVideoTouch={handleVideoTouch}
      onLike={handleLike}
      onComment={handleComment}
      onBookmark={handleBookmark}
      onShare={handleShare}
      onBook={handleBook}
      onVendorPress={handleVendorPress}
    />
  );

  // Services tab UI fade state
  const [servicesUIVisible, setServicesUIVisible] = useState(true);
  const servicesUIOpacity = useRef(new Animated.Value(1)).current;
  const servicesUITimer = useRef<NodeJS.Timeout | null>(null);
  
  // Video progress tracking
  const [videoProgress, setVideoProgress] = useState(0); // 0 to 1
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Video players for expo-video (managed by ServiceVideoPlayer components)
  // Removed videoRefs since expo-video doesn't use refs for playback control

  // Auto-hide UI for services tab
  const startServicesUIHideTimer = () => {
    if (servicesUITimer.current) clearTimeout(servicesUITimer.current);
    servicesUITimer.current = setTimeout(() => hideServicesUI(), 3000); // Industry standard 3 seconds
  };

  const showServicesUI = () => {
    setServicesUIVisible(true);
    Animated.timing(servicesUIOpacity, {
      toValue: 1,
      duration: 200, // Fast show
      useNativeDriver: false
    }).start();
    startServicesUIHideTimer();
  };

  const hideServicesUI = () => {
    setServicesUIVisible(false);
    Animated.timing(servicesUIOpacity, {
      toValue: 0,
      duration: 800, // Slow, natural fade
      useNativeDriver: false
    }).start();
    if (servicesUITimer.current) {
      clearTimeout(servicesUITimer.current);
      servicesUITimer.current = null;
    }
  };

  const handleVideoTap = () => {
    if (servicesUIVisible) {
      hideServicesUI();
    } else {
      showServicesUI();
    }
  };

  const handlePlayPausePress = (e: any) => {
    e?.stopPropagation();
    setIsPlaying(!isPlaying);
    showServicesUI(); // Show UI when play/pause is pressed
  };

  // TODO: Implement progress bar seeking for expo-video
  const handleProgressBarPress = async (e: any, itemId: string) => {
    console.log('Progress bar press - seeking not yet implemented for expo-video');
    // Progress bar seeking will be implemented when we add player refs to ServiceVideoPlayer
    showServicesUI();
    return;
  };

  const renderServicesTab = () => {
    if (videoFeedData.length === 0) {
      return (
        <View style={{ 
          flex: 1, 
          backgroundColor: '#000', 
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <Ionicons name="videocam-outline" size={60} color="#888" />
          <Text style={{ color: '#888', fontSize: 18, fontWeight: 'bold', marginTop: 16 }}>
            No Services Available
          </Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <PagerView
          style={{ flex: 1 }}
          orientation="vertical"
          initialPage={0}
          scrollEnabled={true}
          onPageSelected={(e) => {
            const newIndex = e.nativeEvent.position;
            console.log(`🎥 Video switched to index: ${newIndex}, videoId: ${videoFeedData[newIndex]?.id}`);
            setCurrentVideoIndex(newIndex);
            setFocusedVideoId(videoFeedData[newIndex]?.id);

            // Ensure video is playing when switching
            if (activeTab === 'services') {
              console.log('🎥 Ensuring video plays after switching');
              setIsPlaying(true);
            }

            showServicesUI(); // Show UI when switching videos
          }}
        >
          {videoFeedData.map((item, index) => (
            <View key={`video-${item.id}-${index}`} style={{
              width: screenWidth,
              height: screenHeight,
              backgroundColor: '#000',
              position: 'relative'
            }}>
              {/* Video container */}
              <TouchableWithoutFeedback onPress={handleVideoTap}>
                <View style={{
                  width: screenWidth,
                  height: screenHeight,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {/* Full screen video */}
                  {item.videoUri ? (
                    <ServiceVideoPlayer
                      videoUri={item.videoUri}
                      isCurrentVideo={activeTab === 'services' && index === currentVideoIndex}
                      shouldAutoPlay={activeTab === 'services' && isPlaying}
                      onLoad={(status) => {
                        if (index === currentVideoIndex) {
                          setVideoDuration(status.duration || 0);
                          setVideoProgress(0);
                          setVideoPosition(0);
                        }
                      }}
                      onPlaybackStatusUpdate={(status) => {
                        if (index === currentVideoIndex && status.duration) {
                          // Only update if we have valid duration and position
                          const currentPos = status.currentTime || 0;
                          const duration = status.duration;
                          const progress = duration > 0 ? currentPos / duration : 0;

                          // Prevent unnecessary updates if values haven't changed much
                          if (Math.abs(progress - videoProgress) > 0.01) {
                            setVideoProgress(progress);
                            setVideoPosition(currentPos * 1000); // Convert to milliseconds for consistency
                            setVideoDuration(duration * 1000); // Convert to milliseconds for consistency
                          }
                        }
                      }}
                    />
                  ) : (
                    <Image 
                      source={{ uri: item.thumbnail || 'https://via.placeholder.com/400x600' }} 
                      style={{ 
                        width: screenWidth, 
                        height: screenHeight,
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>

              {/* Play Button - Simple and always visible when paused */}
              {!isPlaying && index === currentVideoIndex && (
                <View style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: -40,
                  marginLeft: -40,
                  width: 80,
                  height: 80,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 9999,
                }}>
                  <TouchableOpacity
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 3,
                      borderColor: '#000',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 10,
                    }}
                    onPress={handlePlayPausePress}
                  >
                    <Ionicons 
                      name="play" 
                      size={36} 
                      color="#000" 
                      style={{ marginLeft: 4 }} 
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Progress Bar with Scrubbing */}
              <Animated.View style={{
                  position: 'absolute',
                  bottom: tabBarHeightFromContext + insets.bottom - 4,
                  left: 0,
                  right: 0,
                  height: 6,
                  opacity: servicesUIOpacity
                }}>
                  <TouchableOpacity
                    style={{
                      height: 20,
                      width: '100%',
                      justifyContent: 'center',
                      paddingVertical: 8
                    }}
                    onPress={(e) => handleProgressBarPress(e, item.id)}
                    activeOpacity={1}
                  >
                    <View style={{
                      height: 2,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      borderRadius: 1
                    }}>
                      <View style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, videoProgress * 100))}%`,
                        backgroundColor: 'white',
                        borderRadius: 1
                      }} />
                    </View>
                    {/* Progress indicator dot */}
                    <View style={{
                      position: 'absolute',
                      left: `${Math.max(0, Math.min(95, videoProgress * 100))}%`,
                      top: 6,
                      width: 8,
                      height: 8,
                      backgroundColor: 'white',
                      borderRadius: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.3,
                      shadowRadius: 2,
                    }} />
                  </TouchableOpacity>
              </Animated.View>
                
              {/* Services Header */}
              <Animated.View style={{
                  position: 'absolute',
                  top: insets.top + 10,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  opacity: servicesUIOpacity
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{
                      color: 'white',
                      fontSize: 24,
                      fontWeight: 'bold'
                    }}>
                      fretiko
                    </Text>
                    {/* Debug play button */}
                    <TouchableOpacity
                      onPress={() => {
                        console.log('🎮 Manual play button pressed');
                        setIsPlaying(true);
                      }}
                      style={{
                        marginLeft: 12,
                        backgroundColor: isPlaying ? '#4CAF50' : '#FF4757',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 4
                      }}
                    >
                      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                        {isPlaying ? 'PLAYING' : 'PAUSED'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => showCart()}>
                    <View style={{ position: 'relative' }}>
                      <Ionicons name="bag-outline" size={28} color="white" />
                      {itemCount && itemCount > 0 && (
                        <View style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          backgroundColor: '#FF4757',
                          borderRadius: 10,
                          width: 20,
                          height: 20,
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}>
                          <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                            {itemCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
              </Animated.View>
                
              {/* Bottom left info with action buttons */}
              <Animated.View style={{
                  position: 'absolute',
                  bottom: tabBarHeightFromContext + insets.bottom + 20,
                  left: 16,
                  right: 80,
                  opacity: servicesUIOpacity
                }}>
                  {/* User info */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                    onPress={() => {
                      console.log('🎥 Video item data:', JSON.stringify(item, null, 2));
                      console.log('🎥 item.userId specifically:', item.userId);
                      handleVendorPress(item.userId);
                    }}
                  >
                    <Image
                      source={{ uri: item.userAvatar || 'https://via.placeholder.com/40x40' }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        marginRight: 12,
                        borderWidth: 2,
                        borderColor: 'white'
                      }}
                    />
                    <View>
                      <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
                        @{item.username}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={{ color: 'white', fontSize: 12, marginLeft: 4 }}>
                          {item.rating.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <Text style={{ color: 'white', fontSize: 14, marginBottom: 12 }}>
                    {item.description}
                  </Text>

                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                    ₣{item.price.toFixed(2)}
                  </Text>

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#25D366',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
                        marginRight: 12
                      }}
                      onPress={() => {
                        console.log('🎥 Chat button - Video item userId:', item.userId);
                        handleVendorPress(item.userId);
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color="white" />
                      <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold', marginLeft: 6 }}>
                        Chat
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#3498DB',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20
                      }}
                      onPress={() => handleBook(item.id)}
                    >
                      <Ionicons name="calendar-outline" size={16} color="white" />
                      <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold', marginLeft: 6 }}>
                        Book
                      </Text>
                    </TouchableOpacity>
                  </View>
              </Animated.View>
                
              {/* Right side actions */}
              <Animated.View style={{
                  position: 'absolute',
                  right: 16,
                  bottom: tabBarHeightFromContext + insets.bottom + 60,
                  opacity: servicesUIOpacity
                }}>
                  <TouchableOpacity 
                    style={{ marginBottom: 24, alignItems: 'center' }}
                    onPress={() => handleLike(item.id)}
                  >
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 4
                    }}>
                      <Ionicons 
                        name={item.isLiked ? 'heart' : 'heart-outline'} 
                        size={28} 
                        color={item.isLiked ? '#FF4757' : 'white'} 
                      />
                    </View>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                      {item.likes}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{ marginBottom: 24, alignItems: 'center' }}
                    onPress={() => handleComment(item.id)}
                  >
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 4
                    }}>
                      <Ionicons name="chatbubble-outline" size={28} color="white" />
                    </View>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                      {item.comments}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ marginBottom: 24, alignItems: 'center' }}
                    onPress={() => handleBookmark(item.id)}
                  >
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 4
                    }}>
                      <Ionicons 
                        name={item.isBookmarked ? 'bookmark' : 'bookmark-outline'} 
                        size={28} 
                        color={item.isBookmarked ? '#FFD700' : 'white'} 
                      />
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{ alignItems: 'center' }}
                    onPress={() => handleShare(item.id)}
                  >
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: 4
                    }}>
                      <Ionicons name="share-outline" size={28} color="white" />
                    </View>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                      {item.shares}
                    </Text>
                  </TouchableOpacity>
              </Animated.View>
            </View>
          ))}
        </PagerView>
      </View>
    );
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <Animated.View style={{ 
        position: 'absolute', 
        top: insets.top, 
        left: 0, 
        right: 0, 
        height: HEADER_FULL_HEIGHT, 
        backgroundColor: '#000000', 
        zIndex: 1000, 
        opacity: activeTab === 'services' ? 0 : headerOpacity 
      }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <TouchableOpacity onPress={toggleSidebar} style={{ marginRight: 12, padding: 8 }}>
            <Ionicons name="menu-outline" size={20} color="white" />
          </TouchableOpacity>
          
          <View style={{ marginRight: 12, alignItems: 'center' }}>
            <Image source={require('../../assets/images/logo.png')} style={{ width: 90, height: 22 }} resizeMode="contain" />
          </View>
          
          <TouchableOpacity onPress={handleLocationPress} style={{ marginRight: 12, padding: 8, flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="location-outline" size={16} color="white" />
            <Text style={{ color: 'white', fontSize: 12, marginLeft: 4, maxWidth: 80 }} numberOfLines={1}>
              {selectedLocation.split(',')[0]}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#888" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleCartIconPress} style={{ marginLeft: 4, padding: 8, position: 'relative' }}>
            <Ionicons name="bag-outline" size={20} color="white" />
            {itemCount > 0 && (
              <View style={{
                position: 'absolute',
                top: 4,
                right: 4,
                backgroundColor: '#FF4757',
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                  {itemCount > 99 ? '99+' : itemCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Sub Header */}
      {renderSubHeader()}

      {/* Main Content with Swipe */}
      <PagerView
        ref={mainPagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        overdrag={true}
        onPageSelected={(e) => {
          const newTab = e.nativeEvent.position === 0 ? 'products' : 'services';
          console.log(`🎬 Main tab changed to: ${newTab}, position: ${e.nativeEvent.position}`);
          if (newTab !== activeTab) {
            setActiveTab(newTab);
            if (newTab === 'services') {
              console.log('🎬 Switching to services - setting isPlaying to true');
              setIsPlaying(true);
              // Reset to first video when switching to services
              setCurrentVideoIndex(0);
              setFocusedVideoId(videoFeedData[0]?.id);
            } else {
              console.log('🎬 Switching to products - setting isPlaying to false');
              setIsPlaying(false);
            }
          }
        }}
      >
        <View key="products" style={{ flex: 1 }}>
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ flexGrow: 1 }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={refreshData}
                colors={['#3498DB']}
                tintColor="#3498DB"
                title="Pull to refresh"
              />
            }
          >
            {renderProductsTab()}
          </ScrollView>
        </View>
        
        <View key="services" style={{ flex: 1 }}>
          {/* Add invisible swipe area on left edge to go back to products */}
          <View style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 50,
            zIndex: 3000,
          }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => mainPagerRef.current?.setPage(0)}
            >
            </TouchableOpacity>
          </View>
          {renderServicesTab()}
        </View>
      </PagerView>

      {/* Sidebar */}
      {renderSidebar()}

      {/* Overlay for closing sidebar */}
      {isSidebarVisible && (
        <TouchableOpacity 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}
          onPress={toggleSidebar}
        />
      )}

      {/* Modals */}
      <CartModal
        visible={isCartVisible}
        onClose={() => hideCart()}
        onCheckout={() => navigation.navigate('Checkout')}
      />

      <ServiceBookingModal
        visible={bookingService !== null}
        service={bookingService}
        onClose={() => setBookingService(null)}
        onBook={handleServiceBooking}
      />

      <CommentsDrawer
        visible={commentsServiceId !== null}
        serviceId={commentsServiceId}
        onClose={() => setCommentsServiceId(null)}
      />

      <LocationSelector
        visible={isLocationSelectorVisible}
        selectedLocation={selectedLocation}
        onLocationSelect={handleLocationSelect}
        onClose={() => setLocationSelectorVisible(false)}
      />

      <FilterDropdown
        visible={isFilterVisible}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClose={() => setFilterVisible(false)}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </View>
  );
};

export default HomeScreen;
