import { Ionicons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { memo, useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  Share,
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
import ProductVideoPlayer from '../components/ProductVideoPlayer';
import { productsAPI, Product, ProductCategory } from '../services/productsAPI';

import { servicesAPI, VideoFeedItem } from '../services/servicesAPI';
import { userAPI } from '../services/userAPI';
import { chatAPI } from '../services/chatAPI';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { mapProductToCard } from '../utils/dataMappers';
import { ProductCard as ModernProductCard } from '../components/cards/ProductCard';

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
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [focusedVideoId, setFocusedVideoId] = useState<string | null>(null);

  // Track visible video products in viewport (max 2 at a time)
  const [visibleVideoProducts, setVisibleVideoProducts] = useState<Set<string>>(new Set());
  
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

      // Debug: Check for video products
      const videoProducts = productsData.filter((p: any) => p.media_type === 'video');
      console.log('📹 Total products loaded:', productsData.length);
      console.log('📹 Video products found:', videoProducts.length);
      if (videoProducts.length > 0) {
        console.log('📹 First video product:', JSON.stringify(videoProducts[0], null, 2));
      }

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
        console.log('🎥 Video feed data received:', videoData?.length || 0, 'services');
        if (videoData && videoData.length > 0) {
          console.log('🎥 First video item:', JSON.stringify(videoData[0], null, 2));
          console.log('🎥 Video has URI?', !!videoData[0]?.videoUri);
          console.log('🎥 Video URI:', videoData[0]?.videoUri);
        }

        setVideoFeedData(videoData || []);
        console.log(`✅ Loaded real data: ${productsData.length} products, ${categoriesData.length} categories, ${videoData?.length || 0} services`);
        console.log('✅ VideoFeedData state updated with', videoData?.length || 0, 'items');
      } catch (videoError) {
        console.warn('🔴 Error loading video data:', videoError);
        console.error('🔴 Full error:', videoError);
        // Set empty array if API fails - no mock data fallback
        setVideoFeedData([]);
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


  // Load data when component mounts - only once
  useEffect(() => {
    loadData();
  }, []);

  // Load data only when screen regains focus (not on every focus)
  useFocusEffect(
    React.useCallback(() => {
      // Only reload data if we don't have any data yet
      if (products.length === 0 && videoFeedData.length === 0) {
        console.log('🔄 Loading data on first focus');
        loadData(false);
      }
    }, []) // Empty dependency array - only run once
  );

  // Initialize visible video products (first 2) when products load
  useEffect(() => {
    if (products.length > 0) {
      const videoProducts = products.filter(p => p.media_type === 'video' && p.primary_video_url);
      const firstTwo = videoProducts.slice(0, 2).map(p => p.id);
      setVisibleVideoProducts(new Set(firstTwo));
      console.log('🎬 Initialized visible video products:', firstTwo);
    }
  }, [products]);

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

  // Auto-play for services tab - ONLY when screen is focused
  useEffect(() => {
    if (!isScreenFocused) {
      console.log('⏸️ Auto-play paused - screen unfocused');
      return; // Don't auto-play if screen not focused
    }

    if (activeTab === 'services' && !isPlaying && videoFeedData.length > 0) {
      console.log('🎬 Auto-play: Setting isPlaying to true on services tab');
      setIsPlaying(true);
    }
  }, [activeTab, isPlaying, videoFeedData.length, isScreenFocused]);

  // Handle screen focus changes for video playback and cleanup
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused
      console.log('✅ HomeScreen FOCUSED');
      setIsScreenFocused(true);

      // Resume playing if on services tab
      if (activeTab === 'services' && videoFeedData.length > 0) {
        console.log('🎬 Screen focused - resuming video playback');
        setIsPlaying(true);
      }

      // Restore visible video products when screen refocuses (for products tab)
      if (activeTab === 'products' && products.length > 0) {
        const videoProducts = products.filter(p => p.media_type === 'video' && p.primary_video_url);
        const firstTwo = videoProducts.slice(0, 2).map(p => p.id);
        setVisibleVideoProducts(new Set(firstTwo));
        console.log('🎬 Screen focused - restored visible video products:', firstTwo);
      }

      return () => {
        // Screen is unfocused - CRITICAL CLEANUP
        console.log('❌ HomeScreen UNFOCUSED - Running cleanup');
        setIsScreenFocused(false);

        // Stop ALL videos immediately
        setIsPlaying(false);

        // Clear visible video products to stop rendering them
        setVisibleVideoProducts(new Set());

        // Clear services UI timer
        if (servicesUITimer.current) {
          clearTimeout(servicesUITimer.current);
          servicesUITimer.current = null;
        }

        console.log('✅ Cleanup complete - videos stopped, timers cleared');
      };
    }, [activeTab, products]) // Added products to dependencies
  );

  // Countdown timer effect - ONLY runs when screen is focused
  useEffect(() => {
    if (!isScreenFocused) {
      console.log('⏸️ Countdown timer paused - screen unfocused');
      return; // Don't start timer if screen not focused
    }

    console.log('▶️ Countdown timer started - screen focused');
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

    return () => {
      console.log('🛑 Countdown timer cleared');
      clearInterval(timer);
    };
  }, [isScreenFocused]);

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

      // Optimistic UI update
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

      // Call API and get actual response
      const response = await servicesAPI.toggleLike(itemId);
      console.log('✅ Like API response:', response);

      // Update with ACTUAL values from backend to ensure persistence
      setVideoFeedData(prev => prev.map(video =>
        video.id === itemId
          ? {
              ...video,
              isLiked: response.liked,
              likes: response.likeCount.toString()
            }
          : video
      ));

      console.log('✅ Updated videoFeedData with backend response - liked:', response.liked, 'count:', response.likeCount);
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

      // Revert UI update on error
      setVideoFeedData(prev => prev.map(video =>
        video.id === itemId
          ? {
              ...video,
              isLiked: !video.isLiked,
              likes: video.isLiked
                ? (parseInt(video.likes) + 1).toString()
                : (parseInt(video.likes) - 1).toString()
            }
          : video
      ));
    }
  };

  const handleComment = (itemId: string) => {
    setCommentsServiceId(itemId);
  };

  const handleCommentAdded = (serviceId: string) => {
    // When a comment is added, increment the comment count in videoFeedData
    setVideoFeedData(prev => prev.map(video =>
      video.id === serviceId
        ? {
            ...video,
            comments: (parseInt(video.comments) + 1).toString()
          }
        : video
    ));
    console.log('✅ Comment count incremented for service:', serviceId);
  };

  const handleBookmark = async (itemId: string) => {
    try {
      // Optimistic update
      setVideoFeedData(prev => prev.map(video =>
        video.id === itemId
          ? {
              ...video,
              isBookmarked: !video.isBookmarked
            }
          : video
      ));

      // Call bookmark API
      const result = await servicesAPI.toggleBookmark(itemId);
      console.log('✅ Bookmark toggled:', result.bookmarked ? 'Added' : 'Removed');

      // Update with actual state from backend
      setVideoFeedData(prev => prev.map(video =>
        video.id === itemId
          ? {
              ...video,
              isBookmarked: result.bookmarked
            }
          : video
      ));
    } catch (error) {
      console.error('Error bookmarking service:', error);
      // Revert optimistic update on error
      setVideoFeedData(prev => prev.map(video =>
        video.id === itemId
          ? { ...video, isBookmarked: !video.isBookmarked }
          : video
      ));
    }
  };

  const handleShare = async (itemId: string) => {
    try {
      // Get service details for sharing
      const service = videoFeedData.find(s => s.id === itemId);
      if (!service) {
        console.error('Service not found for sharing');
        return;
      }

      // Prepare share content
      const shareMessage = `Check out this service: ${service.title}\n\nPrice: ₣${service.price}\nProvider: @${service.username}\n\nView on Fretiko: https://fretiko.app/service/${itemId}`;

      // Open native share sheet
      const shareResult = await Share.share({
        message: shareMessage,
        title: service.title,
        url: `https://fretiko.app/service/${itemId}`, // Deep link URL
      });

      // If user completed share (not dismissed)
      if (shareResult.action === Share.sharedAction) {
        console.log('✅ User shared the service');

        // Optimistic update - increment share count
        setVideoFeedData(prev => prev.map(video =>
          video.id === itemId
            ? {
                ...video,
                shares: (parseInt(video.shares) + 1).toString()
              }
            : video
        ));

        // Call share API to update backend count
        const result = await servicesAPI.shareService(itemId);
        console.log('✅ Share count updated in backend:', result.shareCount);

        // Update with actual count from backend
        setVideoFeedData(prev => prev.map(video =>
          video.id === itemId
            ? {
                ...video,
                shares: result.shareCount.toString()
              }
            : video
        ));
      } else if (shareResult.action === Share.dismissedAction) {
        console.log('User dismissed share sheet');
      }
    } catch (error: any) {
      console.error('Error sharing service:', error);
      if (error.message !== 'User dismissed share sheet') {
        Alert.alert('Error', 'Failed to share service. Please try again.');
      }
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

  // Memoize filtered and sorted products
  const filteredProducts = useMemo(() => {
    if (!isScreenFocused) {
      return []; // Don't process when unfocused
    }
    
    let filtered = products.filter(product => {
      // Category filter (from horizontal chips)
      const categoryMatch = selectedCategory === 'all' ||
      product.category_id === selectedCategory ||
        categories.find(cat => cat.id === product.category_id)?.name.toLowerCase() === selectedCategory;
      
      if (!categoryMatch) return false;
      
      // Advanced filters
      // Price range
      const priceMatch = product.price >= filters.priceRange.min && product.price <= filters.priceRange.max;
      if (!priceMatch) return false;
      
      // Condition (only if filters applied)
      if (filters.condition.length > 0) {
        const conditionMatch = filters.condition.includes(product.condition);
        if (!conditionMatch) return false;
      }
      
      // Location (only if filters applied)
      if (filters.location.length > 0 && product.location) {
        // Check if product location matches any selected filter locations
        const locationMatch = filters.location.some(filterLoc => {
          // Handle both "City, Country" and "City" formats
          return product.location?.includes(filterLoc) || filterLoc.includes(product.location);
        });
        if (!locationMatch) return false;
      }
      
      // Rating (only if rating filter > 0)
      if (filters.rating > 0) {
        const ratingMatch = (product.average_rating || 0) >= filters.rating;
        if (!ratingMatch) return false;
      }
      
      // Category (from advanced filters, only if filters applied)
      if (filters.category.length > 0) {
        const categoryFilterMatch = filters.category.includes(product.category_id);
        if (!categoryFilterMatch) return false;
      }
      
      // Availability (shipping options)
      if (filters.availability.length > 0 && product.shipping_options) {
        const availabilityMatch = filters.availability.some(avail => {
          if (avail === 'In Stock') return product.quantity > 0;
          if (avail === 'Free Shipping') return product.shipping_options?.shipping === true;
          if (avail === 'Same Day Delivery') return product.shipping_options?.delivery === true;
          return false;
        });
        if (!availabilityMatch) return false;
      }
      
      return true;
    });
    
    // Sorting
    switch (filters.sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
        break;
      case 'rating':
        filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    
    return filtered;
  }, [products, selectedCategory, categories, isScreenFocused, filters]);

  // Memoize filtered and sorted services
  const filteredServices = useMemo(() => {
    if (!isScreenFocused) {
      return [];
    }
    
    let filtered = videoFeedData.filter(service => {
      // Price range
      const priceMatch = service.price >= filters.priceRange.min && service.price <= filters.priceRange.max;
      if (!priceMatch) return false;
      
      // Location (only if filters applied)
      if (filters.location.length > 0 && service.location) {
        const locationMatch = filters.location.some(filterLoc => {
          return service.location?.includes(filterLoc) || filterLoc.includes(service.location);
        });
        if (!locationMatch) return false;
      }
      
      // Rating (only if rating filter > 0)
      if (filters.rating > 0) {
        const ratingMatch = service.rating >= filters.rating;
        if (!ratingMatch) return false;
      }
      
      // Availability (service-specific: weekdays, weekends, evenings, emergency)
      // Note: This would need availability data in VideoFeedItem interface
      // For now, we'll skip this check as the data structure doesn't include it
      
      return true;
    });
    
    // Sorting
    switch (filters.sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        // Sort by likes count
        filtered.sort((a, b) => {
          const aLikes = parseInt(a.likes) || 0;
          const bLikes = parseInt(b.likes) || 0;
          return bLikes - aLikes;
        });
        break;
      case 'newest':
      default:
        // Services don't have created_at in VideoFeedItem, keep original order
        break;
    }
    
    return filtered;
  }, [videoFeedData, isScreenFocused, filters]);

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
    if (isSidebarVisible) {
      toggleSidebar(); // Close sidebar when applying filters
    }
    
    // Debug logging
    console.log('✅ Filters applied:', {
      priceRange: filters.priceRange,
      condition: filters.condition,
      location: filters.location,
      rating: filters.rating,
      category: filters.category,
      sortBy: filters.sortBy,
      availability: filters.availability,
      activeCount: activeFilterCount
    });
    console.log(`📊 Total products: ${products.length}`);
    console.log(`📊 Filtered products: ${filteredProducts.length}`);
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

  // Calculate active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceRange.min > 0 || filters.priceRange.max < 999999999) count++;
    if (filters.condition.length > 0) count++;
    if (filters.location.length > 0) count++;
    if (filters.rating > 0) count++;
    if (filters.category.length > 0) count++;
    if (filters.sortBy !== 'newest') count++;
    if (filters.availability.length > 0) count++;
    return count;
  }, [filters]);

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

  // Enhanced ProductCard with centralized data mapper
  const renderEnhancedProductCard = useCallback((item: any, isHorizontal = false) => {
    // Don't render when screen is unfocused
    if (!isScreenFocused) {
      return null;
    }

    const cardStyle = isHorizontal ? { width: screenWidth * 0.4, marginHorizontal: 6 } : {};

    try {
      // Use centralized mapper to ensure consistent data transformation
      const productData = mapProductToCard(item);

      // Comprehensive validation
      if (!productData.title || !productData.price) {
        console.warn('ProductCard: Missing required data', productData);
        return <FallbackCard error="Missing product data" />;
      }

      return (
        <View style={[cardStyle, { width: isHorizontal ? screenWidth * 0.4 : '100%' }]}>
          <ModernProductCard
            product={productData}
            variant={isHorizontal ? 'grid' : 'featured'}
            onPress={() => handleProductPress(productData.id)}
            onLike={() => console.log('Like product:', productData.id)}
            onBookmark={() => console.log('Bookmark product:', productData.id)}
            onVendorPress={(vendorId) => {
              console.log('Navigate to vendor:', vendorId);
              navigation.navigate('PublicProfile', { userId: vendorId });
            }}
            onCartPress={(product) => handleCartPress(product.id)}
            onBargainPress={(product) => handleBargainPress(product.id)}
          />
        </View>
      );
    } catch (error) {
      console.error('Error in renderEnhancedProductCard:', error);
      return <FallbackCard error={`Render error: ${error.message}`} />;
    }
  }, [isScreenFocused, navigation, handleCartPress, handleBargainPress]);

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
            <View style={{ width: 36, height: 36, backgroundColor: '#E67E22', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="funnel-outline" size={18} color="white" />
              {activeFilterCount > 0 && (
                <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#E74C3C', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{activeFilterCount}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Filters</Text>
              <Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>
                {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : 'Advanced search options'}
              </Text>
            </View>
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

  // Memoize mixed content generation - EXPENSIVE OPERATION
  const mixedContent = useMemo(() => {
    // Don't generate content when screen is unfocused
    if (!isScreenFocused) {
      return [];
    }

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
    const generateContent = () => {
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

    return generateContent();
  }, [products, heroImages, isScreenFocused]);

  // Alibaba-style Products View
  const renderProductsTab = () => {
    // Don't render content when screen is unfocused to prevent background processing
    if (!isScreenFocused) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 16 }}>Screen not focused</Text>
        </View>
      );
    }

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

          {/* Active Filters Banner */}
          {activeFilterCount > 0 && (
            <View style={{
              marginHorizontal: 12,
              marginTop: 8,
              marginBottom: 8,
              backgroundColor: '#1a1a1a',
              borderRadius: 12,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderLeftWidth: 3,
              borderLeftColor: '#3498DB',
            }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="funnel" size={14} color="#3498DB" />
                  <Text style={{ color: '#3498DB', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                    {activeFilterCount} Filter{activeFilterCount > 1 ? 's' : ''} Active
                  </Text>
                </View>
                <Text style={{ color: '#888', fontSize: 11 }}>
                  {filteredProducts.length} of {products.length} products shown
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleResetFilters}
                style={{
                  backgroundColor: '#3498DB',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedCategory === 'all' ? (
            // Show dynamic mixed content for "All" - using memoized content
            mixedContent.map((item, index) => {
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
                  {filteredProducts.map((item) => {
                    // Check if this is a video product
                    const isVideoProduct = item.media_type === 'video' && item.primary_video_url;

                    if (isVideoProduct) {
                      // Render full-width video card
                      return (
                        <View key={item.id} style={{ width: '100%', marginBottom: 16 }}>
                          {renderVideoProductCard(item)}
                        </View>
                      );
                    } else {
                      // Render normal grid product card
                      return (
                        <View key={item.id} style={{ width: '48%', marginBottom: 16 }}>
                          <TouchableOpacity
                            onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                          >
                            {renderEnhancedProductCard(item, false)}
                          </TouchableOpacity>
                        </View>
                      );
                    }
                  })}
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

    // Separate video products from image products
    const videoProducts = products.filter(p => p.media_type === 'video' && p.primary_video_url);
    const imageProducts = products.filter(p => !(p.media_type === 'video' && p.primary_video_url));

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

        {/* Render video products as full-width cards first */}
        {videoProducts.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            {videoProducts.map((item) => (
              <View key={item.id} style={{ marginBottom: 12 }}>
                {renderVideoProductCard(item)}
              </View>
            ))}
          </View>
        )}

        {/* Render image products as horizontal scroll */}
        {imageProducts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
          >
            {imageProducts.map((item) => (
              <View key={item.id} style={{ width: screenWidth * 0.4, marginRight: 8 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                >
                  {renderEnhancedProductCard(item, true)}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
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

        {/* Display in twos - 2 columns grid, with video products spanning full width */}
        <View style={{ paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {products.map((item) => {
              // Check if this is a video product
              const isVideoProduct = item.media_type === 'video' && item.primary_video_url;

              if (isVideoProduct) {
                // Render full-width video card
                return (
                  <View key={item.id} style={{ width: '100%', marginBottom: 16 }}>
                    {renderVideoProductCard(item)}
                  </View>
                );
              } else {
                // Render normal grid product card
                return (
                  <View key={item.id} style={{ width: '48%', marginBottom: 16 }}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                    >
                      {renderEnhancedProductCard(item, false)}
                    </TouchableOpacity>
                  </View>
                );
              }
            })}
          </View>
        </View>
      </View>
    );
  };

  // Render video product card (full width) with lazy loading
  const renderVideoProductCard = useCallback((item: Product) => {
    // Don't render video products when screen is unfocused
    if (!isScreenFocused) {
      return null;
    }

    // Check if this video is in viewport (visible)
    const isInViewport = visibleVideoProducts.has(item.id);
    const shouldPlayVideo = activeTab === 'products' && isInViewport && isScreenFocused;

    console.log('📹 Video product card:', {
      id: item.id,
      name: item.name,
      isInViewport,
      shouldPlayVideo,
      visibleCount: visibleVideoProducts.size
    });

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
        style={{
          width: '100%',
          backgroundColor: '#1a1a1a',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Only render video player if in viewport */}
        {item.primary_video_url ? (
          isInViewport ? (
            <ProductVideoPlayer
              videoUri={item.primary_video_url}
              shouldAutoPlay={shouldPlayVideo}
              containerWidth={screenWidth}
            />
          ) : (
            // Show thumbnail when not in viewport
            <Image
              source={{ uri: item.primary_image_url || item.images?.[0] || 'https://via.placeholder.com/400x600' }}
              style={{ width: '100%', height: screenWidth * (9/16) }}
              resizeMode="cover"
            />
          )
        ) : (
          <Image
            source={{ uri: item.primary_image_url || item.images?.[0] || 'https://via.placeholder.com/400x600' }}
            style={{ width: '100%', height: screenWidth * (9/16) }}
            resizeMode="cover"
          />
        )}

        {/* Product info overlay at bottom - Original layout */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 }} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold', marginRight: 8 }}>
                  ₣{item.price.toFixed(2)}
                </Text>
                {item.vendor_username && (
                  <Text style={{ color: '#888', fontSize: 12 }}>
                    by @{item.vendor_username}
                  </Text>
                )}
              </View>
            </View>

            {/* Action buttons on the right */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleBargainPress(item.id);
                }}
                style={{
                  backgroundColor: '#F39C12',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="white" />
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>
                  Bargain
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleCartPress(item.id);
                }}
                style={{
                  backgroundColor: '#3498DB',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="cart-outline" size={16} color="white" />
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Video badge */}
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
      </TouchableOpacity>
    );
  }, [isScreenFocused, visibleVideoProducts, activeTab, navigation]);

  // Handler for vendor profile navigation
  const handleVendorPress = (userId: string) => {
    console.log('🔍 handleVendorPress called with userId:', userId);
    console.log('🔍 userId type:', typeof userId);
    (navigation as any).navigate('PublicProfile', { userId });
  };

  // Handler for chat button on services (directly opens chat)
  const handleChatWithServiceProvider = async (serviceItem: VideoFeedItem) => {
    try {
      console.log('🔍 Starting chat with service provider:', serviceItem.userId);

      // Determine chat type based on current user's role
      // Service provider is assumed to be vendor
      // Priority: rider > vendor > friend
      let chatType: 'friend' | 'vendor' | 'rider' = 'vendor';

      // Check if current user is a rider (highest priority)
      if (user?.is_rider) {
        chatType = 'rider';
      }
      // If current user is seller, keep it as vendor
      else if (user?.is_seller) {
        chatType = 'vendor';
      }
      // Service provider is vendor, so default stays 'vendor'

      // Find existing conversation or create a new one with the service provider
      const conversation = await chatAPI.findOrCreateConversation(
        [serviceItem.userId], // The service provider's user ID
        chatType
      );

      console.log('✅ Conversation found/created:', conversation.id);

      // Navigate to IndividualChatScreen with proper parameters
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: serviceItem.serviceProvider || serviceItem.username || 'Service Provider',
        chatAvatar: serviceItem.userAvatar || 'https://via.placeholder.com/50',
        chatType: chatType as const,
        isOnline: true,
        verified: false,
        isAI: false,
        otherUserId: serviceItem.userId,
      });
    } catch (error) {
      console.error('Error creating conversation with service provider:', error);
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
    }
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
  const handleBargainPress = async (productId: string) => {
    try {
      console.log('Bargain pressed for product:', productId);

      // Find the product in our products list
      const product = products.find(p => p.id === productId);

      if (!product) {
        Alert.alert('Error', 'Product not found');
        return;
      }

      if (!product.user_id) {
        Alert.alert('Error', 'Vendor information not available');
        return;
      }

      console.log('🔍 Finding conversation with vendor:', product.user_id);
      console.log('🔍 Current user:', user?.id);

      // Determine chat type based on current user's role
      // Product owner is a vendor, so default is 'vendor'
      // Priority: rider > vendor > friend
      let chatType: 'friend' | 'vendor' | 'rider' = 'vendor';

      // Check if current user is a rider (highest priority)
      if (user?.is_rider) {
        chatType = 'rider';
      }
      // If current user is seller, keep it as vendor
      else if (user?.is_seller) {
        chatType = 'vendor';
      }
      // Product owner is vendor, so default stays 'vendor'

      // Find or create conversation with the vendor
      const conversation = await chatAPI.findOrCreateConversation(
        [product.user_id],
        chatType
      );

      console.log('✅ Conversation found/created:', conversation.id);

      // Navigate to chat with product context
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: product.vendor_username || 'Vendor',
        chatAvatar: product.vendor_avatar || 'https://via.placeholder.com/50',
        chatType: chatType as const,
        isOnline: true,
        verified: false,
        isAI: false,
        otherUserId: product.user_id,
        // Bargain context
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
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
    }
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
    // Don't render content when screen is unfocused to prevent background processing
    if (!isScreenFocused) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 16 }}>Screen not focused</Text>
        </View>
      );
    }

    if (filteredServices.length === 0) {
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
        {/* Active Filters Banner for Services */}
        {activeFilterCount > 0 && (
          <View style={{
            position: 'absolute',
            top: insets.top + 60,
            left: 12,
            right: 12,
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderLeftWidth: 3,
            borderLeftColor: '#3498DB',
            zIndex: 100,
          }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="funnel" size={14} color="#3498DB" />
                <Text style={{ color: '#3498DB', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                  {activeFilterCount} Filter{activeFilterCount > 1 ? 's' : ''} Active
                </Text>
              </View>
              <Text style={{ color: '#888', fontSize: 11 }}>
                {filteredServices.length} of {videoFeedData.length} services shown
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleResetFilters}
              style={{
                backgroundColor: '#3498DB',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
        
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

            // Reset progress bar for new video
            setVideoProgress(0);
            setVideoPosition(0);
            setVideoDuration(0);

            // Ensure video is playing when switching
            if (activeTab === 'services') {
              console.log('🎥 Ensuring video plays after switching');
              setIsPlaying(true);
            }

            showServicesUI(); // Show UI when switching videos
          }}
        >
          {filteredServices.map((item, index) => {
            // Only render videos within range of current index (±1)
            const shouldRenderVideo = Math.abs(index - currentVideoIndex) <= 1;
            const isCurrentVideo = index === currentVideoIndex;
            const shouldPlay = activeTab === 'services' && isPlaying && isCurrentVideo;

            return (
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
                    {/* Only render video player if within range */}
                    {shouldRenderVideo && item.videoUri ? (
                      <ServiceVideoPlayer
                        videoUri={item.videoUri}
                        isCurrentVideo={isCurrentVideo}
                        shouldAutoPlay={shouldPlay}
                        onLoad={(status) => {
                          if (isCurrentVideo) {
                            setVideoDuration(status.duration || 0);
                            setVideoProgress(0);
                            setVideoPosition(0);
                          }
                        }}
                        onPlaybackStatusUpdate={(status) => {
                          if (isCurrentVideo && status.duration) {
                            // Only update if we have valid duration and position
                            const currentPos = status.currentTime || 0;
                            const duration = status.duration;
                            const progress = duration > 0 ? currentPos / duration : 0;

                            // Update progress more frequently for smoother progress bar (0.005 = 0.5%)
                            if (Math.abs(progress - videoProgress) > 0.005 || progress === 0) {
                              console.log(`📊 Updating progress: ${(progress * 100).toFixed(1)}% (${currentPos.toFixed(1)}s / ${duration.toFixed(1)}s)`);
                              setVideoProgress(progress);
                              setVideoPosition(currentPos * 1000); // Convert to milliseconds for consistency
                              setVideoDuration(duration * 1000); // Convert to milliseconds for consistency
                            }
                          }
                        }}
                      />
                    ) : (
                      // Show thumbnail for videos out of range or if no video URI
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
                      onPress={() => handleChatWithServiceProvider(item)}
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
            );
          })}
        </PagerView>
      </View>
    );
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header Container with Safe Area Background */}
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top + HEADER_FULL_HEIGHT + SUB_HEADER_HEIGHT,
        backgroundColor: '#000000',
        zIndex: 1000,
        opacity: activeTab === 'services' ? 0 : headerOpacity,
        elevation: 10, // Android shadow for better layering
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}>
        {/* Main Header Content */}
        <View style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          height: HEADER_FULL_HEIGHT,
        }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
            <TouchableOpacity onPress={toggleSidebar} style={{ marginRight: 12, padding: 8 }}>
              <Ionicons name="menu-outline" size={20} color="white" />
            </TouchableOpacity>

            <View style={{ marginRight: 12, alignItems: 'center' }}>
              <Image source={require('../../assets/images/logo.png')} style={{ width: 90, height: 22 }} resizeMode="contain" />
            </View>

            {/* Spacer to push items to the right */}
            <View style={{ flex: 1 }} />

            <TouchableOpacity onPress={handleLocationPress} style={{ marginRight: 12, padding: 8, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={16} color="white" />
              <Text style={{ color: 'white', fontSize: 12, marginLeft: 4, maxWidth: 80 }} numberOfLines={1}>
                {selectedLocation.split(',')[0]}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#888" style={{ marginLeft: 2 }} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleCartIconPress} style={{ padding: 8, position: 'relative' }}>
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
        </View>

        {/* Sub Header - now inside the main header container */}
        <View style={{
          position: 'absolute',
          top: insets.top + HEADER_FULL_HEIGHT,
          left: 0,
          right: 0,
          height: SUB_HEADER_HEIGHT,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: '#333',
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
        </View>
      </Animated.View>

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
              console.log('🎬 Switching to services - clearing product videos and enabling service video');
              // Clear visible product videos when switching to services
              setVisibleVideoProducts(new Set());
              setIsPlaying(true);
              // Reset to first video when switching to services
              setCurrentVideoIndex(0);
              setFocusedVideoId(videoFeedData[0]?.id);
            } else {
              console.log('🎬 Switching to products - stopping service videos and re-initializing product videos');
              setIsPlaying(false);
              // Re-initialize visible video products (first 2)
              const videoProducts = products.filter(p => p.media_type === 'video' && p.primary_video_url);
              const firstTwo = videoProducts.slice(0, 2).map(p => p.id);
              setVisibleVideoProducts(new Set(firstTwo));
            }
          }
        }}
      >
        <View key="products" style={{ flex: 1 }}>
          {activeTab === 'products' ? (
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
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000' }} />
          )}
        </View>
        
        <View key="services" style={{ flex: 1 }}>
          {activeTab === 'services' ? (
            <>
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
            </>
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000' }} />
          )}
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
        onCommentAdded={handleCommentAdded}
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
        categories={categories}
        activeTab={activeTab}
      />
    </View>
  );
};

export default HomeScreen;
