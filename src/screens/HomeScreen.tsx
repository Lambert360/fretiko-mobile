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
import { handleError, handleErrorWithRetry, ErrorInfo } from '../utils/errorHandler';
import { useFilters } from '../contexts/FilterContext';
import {
  getTrendingProducts,
  getHotPicks,
  getSeasonalRave,
  getCombodeals,
  getFlashSales,
  getForYou,
  useMemoizedSections,
} from '../utils/mixedContentHelpers';
import { auctionsAPI, AuctionWithDetails } from '../services/auctionsAPI';
import AuctionCard from '../components/AuctionCard';
import { getActiveAuctions, getUpcomingAuctions } from '../utils/auctionMappers';
import { liveSalesAPI, LiveStream, LiveStreamProduct, LiveStreamService } from '../services/liveSalesAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ========== MOCK DATA FOR TESTING ==========
const createMockProduct = (overrides: Partial<Product>): Product => ({
  id: '',
  user_id: '',
  category_id: '',
  name: '',
  description: '',
  price: 0,
  quantity: 0,
  condition: 'new',
  images: [],
  shipping_options: { pickup: true, delivery: true, shipping: true },
  tags: [],
  status: 'active',
  is_featured: false,
  view_count: 0,
  like_count: 0,
  save_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const MOCK_PRODUCTS: Product[] = [
  // Trending products (created recently with high engagement)
  createMockProduct({ id: '1', name: 'Premium Wireless Headphones', description: 'High-quality wireless headphones with noise cancellation', price: 299.99, category_id: 'electronics', user_id: 'user1', vendor_username: 'TechStore', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Headphones', images: ['https://via.placeholder.com/400x400?text=Headphones'], quantity: 50, condition: 'new', location: 'Lagos, Nigeria', average_rating: 4.8, view_count: 1200, like_count: 150, media_type: 'image', is_featured: true, tags: ['trending', 'electronics', 'audio'], created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }), // 24 hours ago
  createMockProduct({ id: '2', name: 'Designer Leather Jacket', description: 'Premium leather jacket with modern design', price: 450.00, category_id: 'fashion', user_id: 'user2', vendor_username: 'FashionHub', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Jacket', images: ['https://via.placeholder.com/400x400?text=Jacket'], quantity: 25, condition: 'new', location: 'Abuja, Nigeria', average_rating: 4.6, view_count: 850, like_count: 95, media_type: 'image', is_featured: true, tags: ['trending', 'fashion', 'winter'], created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() }), // 12 hours ago
  createMockProduct({ id: '3', name: 'Smart Home Security System', description: 'Complete home security with cameras and sensors', price: 599.99, category_id: 'electronics', user_id: 'user3', vendor_username: 'SmartHome', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Security', images: ['https://via.placeholder.com/400x400?text=Security'], quantity: 30, condition: 'new', location: 'Port Harcourt, Nigeria', average_rating: 4.9, view_count: 2100, like_count: 280, media_type: 'image', is_featured: false, tags: ['trending', 'smart', 'security'], created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() }), // 36 hours ago
  
  // Hot Picks (featured products)
  createMockProduct({ id: '4', name: 'Vintage Watch Collection', description: 'Rare vintage watches from the 1970s', price: 1200.00, category_id: 'fashion', user_id: 'user4', vendor_username: 'TimePiece', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Watch', images: ['https://via.placeholder.com/400x400?text=Watch'], quantity: 10, condition: 'used', location: 'Lagos, Nigeria', average_rating: 4.7, view_count: 1500, like_count: 120, media_type: 'image', is_featured: true, tags: ['vintage', 'luxury'] }),
  createMockProduct({ id: '7', name: 'Gaming Laptop', description: 'High-performance gaming laptop with RTX graphics', price: 1299.99, category_id: 'electronics', user_id: 'user7', vendor_username: 'GameZone', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Laptop', images: ['https://via.placeholder.com/400x400?text=Laptop'], quantity: 15, condition: 'new', location: 'Abuja, Nigeria', average_rating: 4.9, view_count: 3200, like_count: 400, media_type: 'image', is_featured: true, tags: ['gaming', 'tech'] }),
  createMockProduct({ id: '9', name: 'iPhone 15 Pro Max Review', description: 'Detailed review of the latest iPhone', price: 1299.99, category_id: 'electronics', user_id: 'user9', vendor_username: 'TechReview', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x600?text=iPhone', primary_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', images: ['https://via.placeholder.com/400x600?text=iPhone'], videos: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'], quantity: 20, condition: 'new', location: 'Lagos, Nigeria', average_rating: 4.8, view_count: 5000, like_count: 600, media_type: 'video', is_featured: true, tags: ['review', 'tech'] }),
  createMockProduct({ id: '12', name: 'Cooking Tutorial', description: 'Learn to cook amazing dishes', price: 0, category_id: 'foods', user_id: 'user12', vendor_username: 'ChefMaster', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x600?text=Cooking', primary_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', images: ['https://via.placeholder.com/400x600?text=Cooking'], videos: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'], quantity: 0, condition: 'new', location: 'Lagos, Nigeria', average_rating: 4.6, view_count: 1800, like_count: 200, media_type: 'video', is_featured: true, tags: ['tutorial', 'food'] }),
  
  // Seasonal Rave products
  createMockProduct({ id: '5', name: 'Organic Coffee Beans', description: 'Premium organic coffee beans from Ethiopia', price: 35.99, category_id: 'foods', user_id: 'user5', vendor_username: 'CoffeeLovers', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Coffee', images: ['https://via.placeholder.com/400x400?text=Coffee'], quantity: 100, condition: 'new', location: 'Ibadan, Nigeria', average_rating: 4.5, view_count: 600, like_count: 50, media_type: 'image', is_featured: false, tags: ['seasonal', 'winter', 'holiday'] }),
  createMockProduct({ id: '6', name: 'Yoga Mat Premium', description: 'Non-slip premium yoga mat', price: 45.00, category_id: 'sports', user_id: 'user6', vendor_username: 'FitLife', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=YogaMat', images: ['https://via.placeholder.com/400x400?text=YogaMat'], quantity: 75, condition: 'new', location: 'Lagos, Nigeria', average_rating: 4.4, view_count: 400, like_count: 30, media_type: 'image', is_featured: false, tags: ['seasonal', 'summer', 'fitness'] }),
  createMockProduct({ id: '11', name: 'Home Decor Tour', description: 'Beautiful home decoration ideas', price: 0, category_id: 'home', user_id: 'user11', vendor_username: 'HomeDesign', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x600?text=Home', primary_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', images: ['https://via.placeholder.com/400x600?text=Home'], videos: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'], quantity: 0, condition: 'new', location: 'Port Harcourt, Nigeria', average_rating: 4.5, view_count: 1200, like_count: 100, media_type: 'video', is_featured: false, tags: ['seasonal', 'christmas', 'holiday'] }),
  
  // Combo Deals
  createMockProduct({ id: '8', name: 'Skincare Set', description: 'Complete skincare routine set', price: 89.99, category_id: 'beauty', user_id: 'user8', vendor_username: 'BeautyBox', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Skincare', images: ['https://via.placeholder.com/400x400?text=Skincare'], quantity: 60, condition: 'new', location: 'Lagos, Nigeria', average_rating: 4.6, view_count: 950, like_count: 80, media_type: 'image', is_featured: false, tags: ['combo', 'bundle', 'set'] }),
  createMockProduct({ id: '14', name: 'Tech Bundle Package', description: 'Phone, charger, and case combo', price: 399.99, category_id: 'electronics', user_id: 'user14', vendor_username: 'TechBundle', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Bundle', images: ['https://via.placeholder.com/400x400?text=Bundle'], quantity: 40, condition: 'new', location: 'Abuja, Nigeria', average_rating: 4.7, view_count: 1100, like_count: 130, media_type: 'image', is_featured: false, tags: ['combo', 'package', 'bundle'] }),
  createMockProduct({ id: '15', name: 'Fitness Equipment Set', description: 'Complete home gym package', price: 599.99, category_id: 'sports', user_id: 'user15', vendor_username: 'FitPackage', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=FitnessSet', images: ['https://via.placeholder.com/400x400?text=FitnessSet'], quantity: 20, condition: 'new', location: 'Lagos, Nigeria', average_rating: 4.8, view_count: 800, like_count: 90, media_type: 'image', is_featured: false, tags: ['combo', 'set', 'package'] }),
  
  // Flash Sales
  createMockProduct({ id: '16', name: 'Flash Sale: Designer Shoes', description: 'Limited time offer on designer shoes', price: 199.99, category_id: 'fashion', user_id: 'user16', vendor_username: 'ShoeDeal', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Shoes', images: ['https://via.placeholder.com/400x400?text=Shoes'], quantity: 30, condition: 'new', location: 'Lagos, Nigeria', average_rating: 4.5, view_count: 700, like_count: 60, media_type: 'image', is_featured: false, tags: ['flash', 'sale', 'deal'] }),
  createMockProduct({ id: '17', name: 'Flash Sale: Smart Watch', description: 'Limited time discount on smart watch', price: 249.99, category_id: 'electronics', user_id: 'user17', vendor_username: 'WatchDeal', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=SmartWatch', images: ['https://via.placeholder.com/400x400?text=SmartWatch'], quantity: 25, condition: 'new', location: 'Abuja, Nigeria', average_rating: 4.6, view_count: 900, like_count: 75, media_type: 'image', is_featured: false, tags: ['flash', 'sale', 'discount'] }),
  createMockProduct({ id: '18', name: 'Flash Deal: Beauty Products', description: 'Limited time beauty product sale', price: 49.99, category_id: 'beauty', user_id: 'user18', vendor_username: 'BeautyDeal', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x400?text=Beauty', images: ['https://via.placeholder.com/400x400?text=Beauty'], quantity: 50, condition: 'new', location: 'Port Harcourt, Nigeria', average_rating: 4.4, view_count: 550, like_count: 45, media_type: 'image', is_featured: false, tags: ['flash', 'deal', 'sale'] }),
  
  // Regular products for For You section
  createMockProduct({ id: '10', name: 'Fashion Haul Video', description: 'Latest fashion trends and styles', price: 0, category_id: 'fashion', user_id: 'user10', vendor_username: 'StyleVlog', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x600?text=Fashion', primary_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', images: ['https://via.placeholder.com/400x600?text=Fashion'], videos: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'], quantity: 0, condition: 'new', location: 'Abuja, Nigeria', average_rating: 4.7, view_count: 2800, like_count: 250, media_type: 'video', is_featured: false, tags: ['fashion', 'vlog'] }),
  createMockProduct({ id: '13', name: 'Fitness Workout', description: 'Intense workout session', price: 0, category_id: 'sports', user_id: 'user13', vendor_username: 'FitCoach', vendor_avatar: 'https://via.placeholder.com/50', primary_image_url: 'https://via.placeholder.com/400x600?text=Fitness', primary_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', images: ['https://via.placeholder.com/400x600?text=Fitness'], videos: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'], quantity: 0, condition: 'new', location: 'Ibadan, Nigeria', average_rating: 4.4, view_count: 900, like_count: 70, media_type: 'video', is_featured: false, tags: ['fitness', 'workout'] }),
];

const MOCK_CATEGORIES: ProductCategory[] = [
  { id: 'electronics', name: 'Electronics', icon_name: 'tv-outline', sort_order: 1, is_active: true },
  { id: 'fashion', name: 'Fashion', icon_name: 'shirt-outline', sort_order: 2, is_active: true },
  { id: 'home', name: 'Home & Garden', icon_name: 'home-outline', sort_order: 3, is_active: true },
  { id: 'beauty', name: 'Beauty', icon_name: 'flower-outline', sort_order: 4, is_active: true },
  { id: 'sports', name: 'Sports', icon_name: 'fitness-outline', sort_order: 5, is_active: true },
  { id: 'foods', name: 'Foods', icon_name: 'restaurant-outline', sort_order: 6, is_active: true },
];

const MOCK_ACTIVE_AUCTIONS: any[] = [
  { id: 'auction1', title: 'Vintage Rolex Watch', description: 'Rare 1970s Rolex', starting_price: 5000, current_bid: 7500, end_time: new Date(Date.now() + 86400000).toISOString(), status: 'active', category_id: 'fashion', images: ['https://via.placeholder.com/400x400?text=Rolex'], created_at: new Date().toISOString(), bids_count: 12, highest_bidder: 'bidder1', seller_id: 'seller1', seller_username: 'WatchCollector', seller: { id: 'seller1', username: 'WatchCollector', is_verified: true }, category: { id: 'fashion', name: 'Fashion', icon_name: 'shirt-outline', color: '#3498DB', slug: 'fashion' }, current_winning_bid: { id: 'bid1', bidder_display_id: 'bidder1', amount: 7500, created_at: new Date().toISOString() } },
  { id: 'auction2', title: 'Antique Painting', description: '19th Century Artwork', starting_price: 2000, current_bid: 3200, end_time: new Date(Date.now() + 172800000).toISOString(), status: 'active', category_id: 'home', images: ['https://via.placeholder.com/400x400?text=Painting'], created_at: new Date().toISOString(), bids_count: 8, highest_bidder: 'bidder2', seller_id: 'seller2', seller_username: 'ArtGallery', seller: { id: 'seller2', username: 'ArtGallery', is_verified: true }, category: { id: 'home', name: 'Home & Garden', icon_name: 'home-outline', color: '#27AE60', slug: 'home' }, current_winning_bid: { id: 'bid2', bidder_display_id: 'bidder2', amount: 3200, created_at: new Date().toISOString() } },
  { id: 'auction3', title: 'Classic Car', description: '1965 Mustang', starting_price: 15000, current_bid: 22000, end_time: new Date(Date.now() + 259200000).toISOString(), status: 'active', category_id: 'automotive', images: ['https://via.placeholder.com/400x400?text=Car'], created_at: new Date().toISOString(), bids_count: 25, highest_bidder: 'bidder3', seller_id: 'seller3', seller_username: 'CarDealer', seller: { id: 'seller3', username: 'CarDealer', is_verified: true }, category: { id: 'automotive', name: 'Automotive', icon_name: 'car-outline', color: '#E67E22', slug: 'automotive' }, current_winning_bid: { id: 'bid3', bidder_display_id: 'bidder3', amount: 22000, created_at: new Date().toISOString() } },
];

const MOCK_UPCOMING_AUCTIONS: any[] = [
  { id: 'auction4', title: 'Diamond Ring', description: '2 Carat Diamond', starting_price: 8000, current_bid: 8000, end_time: new Date(Date.now() + 604800000).toISOString(), status: 'scheduled', category_id: 'fashion', images: ['https://via.placeholder.com/400x400?text=Diamond'], created_at: new Date().toISOString(), bids_count: 0, highest_bidder: null, seller_id: 'seller4', seller_username: 'JewelryStore', seller: { id: 'seller4', username: 'JewelryStore', is_verified: true }, category: { id: 'fashion', name: 'Fashion', icon_name: 'shirt-outline', color: '#3498DB', slug: 'fashion' } },
  { id: 'auction5', title: 'Rare Book Collection', description: 'First Edition Books', starting_price: 3000, current_bid: 3000, end_time: new Date(Date.now() + 518400000).toISOString(), status: 'scheduled', category_id: 'books', images: ['https://via.placeholder.com/400x400?text=Books'], created_at: new Date().toISOString(), bids_count: 0, highest_bidder: null, seller_id: 'seller5', seller_username: 'BookStore', seller: { id: 'seller5', username: 'BookStore', is_verified: true }, category: { id: 'books', name: 'Books', icon_name: 'library-outline', color: '#9B59B6', slug: 'books' } },
];

const MOCK_LIVE_PRODUCTS = [
  { streamId: 'live1', productId: 'prod1', title: 'Live: iPhone 15 Unboxing', price: 1299.99, image: 'https://via.placeholder.com/400x250?text=Live+iPhone' },
  { streamId: 'live2', productId: 'prod2', title: 'Live: Fashion Show', price: 299.99, image: 'https://via.placeholder.com/400x250?text=Live+Fashion' },
  { streamId: 'live3', productId: 'prod3', title: 'Live: Tech Review', price: 599.99, image: 'https://via.placeholder.com/400x250?text=Live+Tech' },
];

const MOCK_LIVE_SERVICES = [
  { streamId: 'live-svc1', serviceId: 'svc1', title: 'Live: Personal Training Session', price: 50.00, description: 'Join our live fitness training' },
  { streamId: 'live-svc2', serviceId: 'svc2', title: 'Live: Cooking Class', price: 35.00, description: 'Learn to cook amazing dishes' },
  { streamId: 'live-svc3', serviceId: 'svc3', title: 'Live: Beauty Consultation', price: 25.00, description: 'Get expert beauty advice' },
];

const MOCK_VIDEO_FEED: VideoFeedItem[] = [
  { id: 'video1', title: 'Professional Photography Service', description: 'High-quality photos for your events', videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnail: 'https://via.placeholder.com/600x900?text=Photography', userId: 'user1', username: 'PhotoPro', userAvatar: 'https://via.placeholder.com/40x40', price: 150.00, rating: 4.9, likes: '1250', comments: '89', shares: '45', location: 'Lagos, Nigeria', serviceProvider: 'PhotoPro', completedJobs: '250', isLiked: false, isBookmarked: false },
  { id: 'video2', title: 'Graphic Design Services', description: 'Logo design and branding', videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnail: 'https://via.placeholder.com/600x900?text=Design', userId: 'user2', username: 'DesignStudio', userAvatar: 'https://via.placeholder.com/40x40', price: 200.00, rating: 4.8, likes: '980', comments: '67', shares: '32', location: 'Abuja, Nigeria', serviceProvider: 'DesignStudio', completedJobs: '180', isLiked: false, isBookmarked: false },
  { id: 'video3', title: 'Music Production', description: 'Professional music mixing and mastering', videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', thumbnail: 'https://via.placeholder.com/600x900?text=Music', userId: 'user3', username: 'MusicLab', userAvatar: 'https://via.placeholder.com/40x40', price: 300.00, rating: 4.7, likes: '750', comments: '54', shares: '28', location: 'Port Harcourt, Nigeria', serviceProvider: 'MusicLab', completedJobs: '120', isLiked: false, isBookmarked: false },
  { id: 'video4', title: 'Video Editing Service', description: 'Professional video editing for your content', videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', thumbnail: 'https://via.placeholder.com/600x900?text=Editing', userId: 'user4', username: 'EditMaster', userAvatar: 'https://via.placeholder.com/40x40', price: 180.00, rating: 4.6, likes: '620', comments: '43', shares: '21', location: 'Lagos, Nigeria', serviceProvider: 'EditMaster', completedJobs: '95', isLiked: false, isBookmarked: false },
  { id: 'video5', title: 'Web Development', description: 'Custom websites and web apps', videoUri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', thumbnail: 'https://via.placeholder.com/600x900?text=WebDev', userId: 'user5', username: 'WebDevPro', userAvatar: 'https://via.placeholder.com/40x40', price: 500.00, rating: 4.9, likes: '1100', comments: '78', shares: '38', location: 'Ibadan, Nigeria', serviceProvider: 'WebDevPro', completedJobs: '200', isLiked: false, isBookmarked: false },
];
// ========== END MOCK DATA ==========

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
  const { 
    productFilters, 
    serviceFilters, 
    setProductFilters, 
    setServiceFilters, 
    resetProductFilters, 
    resetServiceFilters 
  } = useFilters();
  const tabBarHeightFromContext = React.useContext(BottomTabBarHeightContext) || TAB_BAR_HEIGHT;

  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [focusedVideoId, setFocusedVideoId] = useState<string | null>(null);
  const [activeAuctions, setActiveAuctions] = useState<AuctionWithDetails[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionWithDetails[]>([]);
  const [liveProducts, setLiveProducts] = useState<Array<{
    streamId: string;
    productId: string;
    title: string;
    price: number;
    image?: string;
  }>>([]);
  const [liveServices, setLiveServices] = useState<Array<{
    streamId: string;
    serviceId: string;
    title: string;
    price: number;
    description?: string;
  }>>([]);
  const [heroIndex, setHeroIndex] = useState(0);

  // Track visible video products in viewport (max 2 at a time)
  const [visibleVideoProducts, setVisibleVideoProducts] = useState<Set<string>>(new Set());
  
  // Track video product card absolute positions in ScrollView content
  const videoProductPositions = useRef<Map<string, { absoluteY: number; height: number }>>(new Map());
  const forYouScrollViewRef = useRef<ScrollView>(null);
  const currentScrollY = useRef(0);
  const contentStartY = useRef(0); // Track where content starts in ScrollView
  
  // Modal states
  const [isLocationSelectorVisible, setLocationSelectorVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('Lagos, Nigeria');
  const [bookingService, setBookingService] = useState<VideoFeedItem | null>(null);
  const [commentsServiceId, setCommentsServiceId] = useState<string | null>(null);
  const [likedServices, setLikedServices] = useState<Set<string>>(new Set());
  const [isFilterVisible, setFilterVisible] = useState(false);
  
  // Use filters from context (persisted)
  const filters = activeTab === 'products' ? productFilters : serviceFilters;
  
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

  // Error state for displaying error messages
  const [errorState, setErrorState] = useState<ErrorInfo | null>(null);

  // Data loading functions - USING REAL API DATA with enhanced error handling
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setErrorState(null);

    try {
      // Load real data from API and user profile for role checking with retry logic
      await handleErrorWithRetry(
        async () => {
          const promises: [Promise<Product[]>, Promise<ProductCategory[]>, Promise<any>?] = [
            productsAPI.getProducts(),
            productsAPI.getCategories()
          ];

          // Only load profile if user is authenticated
          let profileData: any = null;
          if (user?.id) {
            profileData = await userAPI.getProfile();
          }

          const [productsData, categoriesData] = await Promise.all([
            promises[0],
            promises[1]
          ]);

          // Debug: Check for video products
          const videoProducts = productsData.filter((p: any) => p.media_type === 'video');

          // For testing: Always use mock data (merge with API data if available)
          // In production, remove MOCK_PRODUCTS and use only productsData
          const finalProducts = MOCK_PRODUCTS.length > 0 ? MOCK_PRODUCTS : (productsData || []);
          const finalCategories = MOCK_CATEGORIES.length > 0 ? MOCK_CATEGORIES : (categoriesData || []);
          
          setProducts(finalProducts);
          setCategories(finalCategories);

          // Set profile data if available
          if (profileData) {
            setUserProfile(profileData);
          }
        },
        3, // maxRetries
        1000, // baseDelay
        (errorInfo, attempt) => {
          // Log retry attempts
          if (attempt >= 3) {
            // Final attempt failed, show error
            setErrorState(errorInfo);
            handleError(errorInfo, () => loadData(showLoading), () => setErrorState(null));
          }
        }
      );
      
      // Load video data from API (non-blocking, doesn't fail entire load)
      try {
        const videoData = await servicesAPI.getVideoFeed({ limit: 10 });

        // For testing: Always use mock data (merge with API data if available)
        const finalVideoData = MOCK_VIDEO_FEED.length > 0 ? MOCK_VIDEO_FEED : (videoData || []);
        setVideoFeedData(finalVideoData);
      } catch (videoError) {
        // Video feed errors are non-critical, log but don't block
        const videoErrorInfo = handleError(videoError, () => {
          // Retry video feed load
          servicesAPI.getVideoFeed({ limit: 10 })
            .then(setVideoFeedData)
            .catch(() => setVideoFeedData(MOCK_VIDEO_FEED));
        });
        console.warn('🔴 Error loading video data, using mock data:', videoErrorInfo);
        setVideoFeedData(MOCK_VIDEO_FEED);
      }

      // Load auctions (small batches for MVP)
      try {
        const [activeResp, upcomingResp] = await Promise.all([
          auctionsAPI.getAuctions({ status: 'active', limit: 5, time_filter: 'ending_soon' }),
          auctionsAPI.getAuctions({ status: 'scheduled', limit: 5 }),
        ]);
        const active = activeResp.auctions || [];
        const upcoming = upcomingResp.auctions || [];
        // For testing: Always use mock data (merge with API data if available)
        const finalActive = MOCK_ACTIVE_AUCTIONS.length > 0 ? MOCK_ACTIVE_AUCTIONS : active;
        const finalUpcoming = MOCK_UPCOMING_AUCTIONS.length > 0 ? MOCK_UPCOMING_AUCTIONS : upcoming;
        setActiveAuctions(finalActive);
        setUpcomingAuctions(finalUpcoming);
      } catch (auctionError) {
        console.warn('🔴 Error loading auctions, using mock data:', auctionError);
        setActiveAuctions(MOCK_ACTIVE_AUCTIONS);
        setUpcomingAuctions(MOCK_UPCOMING_AUCTIONS);
      }

      // Load live sales streams (small batches)
      try {
        const liveStreams = await liveSalesAPI.getActiveStreams(10, 0, true);

        const liveProductItems =
          liveStreams
            ?.filter(stream => stream.status === 'live' && stream.stream_type === 'products' && stream.products?.length)
            .slice(0, 5)
            .flatMap(stream =>
              (stream.products || []).slice(0, 1).map((p: LiveStreamProduct) => ({
                streamId: stream.id,
                productId: p.product_id,
                title: p.product?.name || stream.title,
                price: p.live_price,
                image: stream.thumbnail_url || p.product?.primary_image_url,
              }))
            ) || [];

        const liveServiceItems =
          liveStreams
            ?.filter(stream => stream.status === 'live' && stream.stream_type === 'services' && stream.services?.length)
            .slice(0, 5)
            .flatMap(stream =>
              (stream.services || []).slice(0, 1).map((s: LiveStreamService) => ({
                streamId: stream.id,
                serviceId: s.service_id,
                title: s.service?.name || stream.title,
                price: s.live_price,
                description: s.service?.description,
              }))
            ) || [];

        // For testing: Always use mock data (merge with API data if available)
        const finalLiveProducts = MOCK_LIVE_PRODUCTS.length > 0 ? MOCK_LIVE_PRODUCTS : liveProductItems;
        const finalLiveServices = MOCK_LIVE_SERVICES.length > 0 ? MOCK_LIVE_SERVICES : liveServiceItems;
        setLiveProducts(finalLiveProducts);
        setLiveServices(finalLiveServices);
      } catch (liveError) {
        console.warn('🔴 Error loading live sales, using mock data:', liveError);
        setLiveProducts(MOCK_LIVE_PRODUCTS);
        setLiveServices(MOCK_LIVE_SERVICES);
      }

    } catch (error) {
      // This catch handles non-retryable errors or final failures
      const errorInfo = handleError(error, () => loadData(showLoading), () => setErrorState(null));
      setErrorState(errorInfo);
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
    }
  }, [products]);

  // Debug: Track isPlaying state changes
  useEffect(() => {
  }, [isPlaying, activeTab]);

  // Ensure video starts playing when switching to services tab
  useEffect(() => {
    if (activeTab === 'services' && videoFeedData.length > 0) {
      setIsPlaying(true);
    } else if (activeTab === 'products') {
      setIsPlaying(false);
    }
  }, [activeTab, videoFeedData.length]);

  // Auto-play for services tab - ONLY when screen is focused
  useEffect(() => {
    if (!isScreenFocused) {
      return; // Don't auto-play if screen not focused
    }

    if (activeTab === 'services' && !isPlaying && videoFeedData.length > 0) {
      setIsPlaying(true);
    }
  }, [activeTab, isPlaying, videoFeedData.length, isScreenFocused]);

  // Handle screen focus changes for video playback and cleanup
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused
      setIsScreenFocused(true);

      // Resume playing if on services tab
      if (activeTab === 'services' && videoFeedData.length > 0) {
        setIsPlaying(true);
      }

      // Restore visible video products when screen refocuses (for products tab)
      if (activeTab === 'products' && products.length > 0) {
        const videoProducts = products.filter(p => p.media_type === 'video' && p.primary_video_url);
        const firstTwo = videoProducts.slice(0, 2).map(p => p.id);
        setVisibleVideoProducts(new Set(firstTwo));
      }

      return () => {
        // Screen is unfocused - CRITICAL CLEANUP
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
      };
    }, [activeTab, products]) // Added products to dependencies
  );

  // Countdown timer effect - ONLY runs when screen is focused
  useEffect(() => {
    if (!isScreenFocused) {
      return; // Don't start timer if screen not focused
    }

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

        // Update with actual count from backend
        setVideoFeedData(prev => prev.map(video =>
          video.id === itemId
            ? {
                ...video,
                shares: result.shareCount.toString()
              }
            : video
        ));
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
          return product.location?.includes(filterLoc) || (product.location && filterLoc.includes(product.location));
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

  // Map live services into video-like items for the services tab
  const liveServiceVideos = useMemo(() => {
    return (liveServices || []).map((item): VideoFeedItem => {
      // Ensure all string fields are properly converted and never undefined
      const safeItem: VideoFeedItem = {
        id: `live-service-${String(item.serviceId || 'unknown')}`,
        videoUri: undefined, // no video; will fall back to thumbnail
        thumbnail: 'https://via.placeholder.com/600x900.png?text=Live+Service',
        title: String(item.title || 'Live Service'),
        description: String(item.description || 'Live service session'),
        username: String((item as any).serviceProvider || 'Live Service'),
        userId: String((item as any).userId || ''),
        userAvatar: String((item as any).userAvatar || 'https://via.placeholder.com/40x40'),
        price: typeof item.price === 'number' ? item.price : 0,
        rating: typeof (item as any).rating === 'number' ? (item as any).rating : 0,
        likes: '0',
        comments: '0',
        shares: '0',
        isLiked: false,
        isBookmarked: false,
        location: (item as any).location || '',
        serviceProvider: String((item as any).serviceProvider || 'Live Service'),
        completedJobs: String((item as any).completedJobs || '0'),
        // Add liveStreamId for navigation
        liveStreamId: String(item.streamId || ''),
      } as VideoFeedItem & { liveStreamId?: string };
      return safeItem;
    });
  }, [liveServices]);

  // Memoize filtered and sorted services including live service videos
  const filteredServices = useMemo(() => {
    if (!isScreenFocused) {
      return [];
    }
    
    // Prepend live services to the feed
    let merged = [...liveServiceVideos, ...videoFeedData];
    
    let filtered = merged.filter(service => {
      // Price range (if price exists)
      if (filters.priceRange && typeof service.price === 'number') {
        const priceMatch = service.price >= filters.priceRange.min && service.price <= filters.priceRange.max;
        if (!priceMatch) return false;
      }
      
      // Location filter not applied (live services may not have location)
      // Rating filter skipped for live services
      
      return true;
    });
    
    // Sorting
    switch (filters.sortBy) {
      case 'price_asc':
        filtered.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_desc':
        filtered.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
        break;
      case 'rating':
        filtered.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'popular':
        // Sort by likes count if present
        filtered.sort((a: any, b: any) => {
          const aLikes = parseInt(a.likes) || 0;
          const bLikes = parseInt(b.likes) || 0;
          return bLikes - aLikes;
        });
        break;
      case 'newest':
      default:
        // Services don't have created_at in VideoFeedItem consistently; keep order
        break;
    }
    
    return filtered;
  }, [videoFeedData, isScreenFocused, filters, liveServiceVideos]);
  // Filter auctions (MVP: apply category filter only)
  const filteredActiveAuctions = useMemo(() => {
    if (selectedCategory === 'all') return activeAuctions;
    return activeAuctions.filter(a => a.category_id === selectedCategory);
  }, [activeAuctions, selectedCategory]);

  const filteredUpcomingAuctions = useMemo(() => {
    if (selectedCategory === 'all') return upcomingAuctions;
    return upcomingAuctions.filter(a => a.category_id === selectedCategory);
  }, [upcomingAuctions, selectedCategory]);

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
    if (activeTab === 'products') {
      setProductFilters(newFilters);
    } else {
      setServiceFilters(newFilters);
    }
  };

  const handleApplyFilters = () => {
    setFilterVisible(false);
    if (isSidebarVisible) {
      toggleSidebar(); // Close sidebar when applying filters
    }
    
    // Debug logging
  };

  const handleResetFilters = () => {
    if (activeTab === 'products') {
      resetProductFilters();
    } else {
      resetServiceFilters();
    }
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
    const scrollY = event.nativeEvent.contentOffset.y;
    const delta = scrollY - lastScrollY.current;
    const isDown = delta > 0;
    if (Math.abs(delta) > 5) {
      const targetOpacity = isDown && scrollY > 30 ? 0 : 1;
      
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
    lastScrollY.current = scrollY;
    
    // Update video visibility tracking
    currentScrollY.current = scrollY;
    checkVideoVisibility();
  };

  // Handler for add to cart button press
  const handleCartPress = useCallback(async (productId: string) => {
    try {
      await addToCart(productId, 1);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  }, [addToCart]);

  // Handler for bargain/negotiation button press
  const handleBargainPress = useCallback(async (productId: string) => {
    try {

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

      // Navigate to chat with product context
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: product.vendor_username || 'Vendor',
        chatAvatar: product.vendor_avatar || 'https://via.placeholder.com/50',
        chatType: chatType,
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
  }, [products, user, navigation]);

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
            onLike={() => {}}
            onBookmark={() => {}}
            onVendorPress={(vendorId) => {
              navigation.navigate('PublicProfile', { userId: vendorId });
            }}
            onCartPress={(product) => handleCartPress(product.id)}
            onBargainPress={(product) => handleBargainPress(product.id)}
          />
        </View>
      );
    } catch (error) {
      console.error('Error in renderEnhancedProductCard:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return <FallbackCard error={`Render error: ${errorMessage}`} />;
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
          snapToInterval={screenWidth * 0.45 + 12}
          snapToAlignment="start"
        >
          {featuredProducts.map((item) => (
            <View key={item.id} style={{ width: screenWidth * 0.45, marginRight: 12 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
              >
                {renderEnhancedProductCard(item, false)}
              </TouchableOpacity>
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
          snapToInterval={screenWidth * 0.45 + 12}
          snapToAlignment="start"
        >
          {highRatedProducts.map((item) => (
            <View key={item.id} style={{ width: screenWidth * 0.45, marginRight: 12 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
              >
                {renderEnhancedProductCard(item, false)}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Auction strip (horizontal) for MVP
  const renderAuctionStrip = (title: string, auctions: AuctionWithDetails[]) => {
    if (!auctions || auctions.length === 0) return null;
    // Show only on "All" to reduce noise
    if (selectedCategory !== 'all') return null;

    return (
      <View style={{ marginVertical: 12 }}>
        <View style={{ paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="hammer" size={16} color="#888" style={{ marginRight: 4 }} />
            <Text style={{ color: '#888', fontSize: 12 }}>{auctions.length} shown</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {auctions.map(auction => (
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

  // Live products strip
  const renderLiveProductsStrip = () => {
    if (activeTab !== 'products') return null;
    if (!liveProducts || liveProducts.length === 0) return null;
    // For MVP, only show in "All"
    if (selectedCategory !== 'all') return null;

    return (
      <View style={{ marginVertical: 12 }}>
        <View style={{ paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Live Sales (Products)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="radio" size={16} color="#E74C3C" style={{ marginRight: 4 }} />
            <Text style={{ color: '#888', fontSize: 12 }}>{liveProducts.length} live</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {liveProducts.map(item => (
            <TouchableOpacity
              key={`${item.streamId}-${item.productId}`}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('LiveStreamViewer', { streamId: item.streamId })}
              style={{
                width: 200,
                backgroundColor: '#0d0d0d',
                borderRadius: 12,
                overflow: 'hidden',
                marginRight: 12,
                borderWidth: 1,
                borderColor: '#1f1f1f',
              }}
            >
              <View style={{ width: '100%', height: 120, backgroundColor: '#111' }}>
                <Image
                  source={{ uri: item.image || 'https://via.placeholder.com/200' }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#E74C3C', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="radio" size={12} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>LIVE</Text>
                </View>
              </View>
              <View style={{ padding: 10, gap: 6 }}>
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }} numberOfLines={2}>{String(item.title || '')}</Text>
                <Text style={{ color: '#8EE186', fontSize: 13, fontWeight: '700' }}>₣{(item.price || 0).toFixed(2)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#888', fontSize: 12 }}>Watch live</Text>
                  <Ionicons name="arrow-forward" size={14} color="#888" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Live services strip
  const renderLiveServicesStrip = () => {
    if (activeTab !== 'services') return null;
    if (!liveServices || liveServices.length === 0) return null;

    return (
      <View style={{ paddingHorizontal: 12, paddingTop: insets.top + 10, paddingBottom: 8, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Live Sales (Services)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="radio" size={16} color="#E74C3C" style={{ marginRight: 4 }} />
            <Text style={{ color: '#888', fontSize: 12 }}>{liveServices.length} live</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {liveServices.map((item, idx) => (
            <TouchableOpacity
              key={`live-service-${item.streamId || 'unknown'}-${item.serviceId || 'unknown'}-${idx}`}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('LiveStreamViewer', { streamId: item.streamId || '' })}
              style={{
                width: 220,
                marginRight: 12,
                backgroundColor: '#0d0d0d',
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: '#1f1f1f',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ backgroundColor: '#E74C3C', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="radio" size={12} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>LIVE</Text>
                </View>
              </View>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }} numberOfLines={2}>{String(item.title || '')}</Text>
              {item.description ? (
                <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }} numberOfLines={2}>{String(item.description)}</Text>
              ) : null}
              <Text style={{ color: '#8EE186', fontSize: 13, fontWeight: '700', marginTop: 6 }}>₣{(item.price || 0).toFixed(2)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ color: '#888', fontSize: 12 }}>Watch / Book</Text>
                <Ionicons name="arrow-forward" size={14} color="#888" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Horizontal product section renderer (for curated sections)
  const renderHorizontalProductSection = (title: string, subtitle: string, items: Product[]) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={{ marginVertical: 12 }}>
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {items.map((item) => (
            <View key={item.id} style={{ width: screenWidth * 0.45, marginRight: 12 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
              >
                {renderEnhancedProductCard(item, false)}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Build For You items (products, video products, live products, auctions)
  type ForYouItem = { kind: 'product' | 'video' | 'auction' | 'live'; data: any };
  const forYouItems = useMemo<ForYouItem[]>(() => {
    const items: ForYouItem[] = [];

    products.forEach(p => {
      if (p.media_type === 'video' && p.primary_video_url) {
        items.push({ kind: 'video', data: p });
      } else {
        items.push({ kind: 'product', data: p });
      }
    });

    // Live products as video-style cards
    liveProducts.forEach(lp => items.push({ kind: 'live', data: lp }));

    // Auctions (active + upcoming)
    const auctionsCombined = [...filteredActiveAuctions, ...filteredUpcomingAuctions];
    auctionsCombined.forEach(a => items.push({ kind: 'auction', data: a }));

    // Simple shuffle for recommendation feel
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
  }, [products, liveProducts, filteredActiveAuctions, filteredUpcomingAuctions]);

  // Render For You list (vertical, endless with periodic banners)
  const renderForYouList = () => {
    if (!forYouItems || forYouItems.length === 0) return null;

    let bannerCycle = heroIndex;

    const renderForYouCard = (item: ForYouItem, index: number) => {
      switch (item.kind) {
        case 'auction':
          return (
            <View key={`for-you-auction-${index}`} style={{ width: '100%', marginBottom: 16 }}>
              <AuctionCard
                auction={item.data}
                variant="horizontal"
                onPress={(a) => navigation.navigate('AuctionDetails', { auctionId: a.id })}
              />
            </View>
          );
        case 'live':
          return (
            <TouchableOpacity
              key={`for-you-live-${index}`}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('LiveStreamViewer', { streamId: item.data.streamId })}
              style={{
                width: '100%',
                backgroundColor: '#0d0d0d',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#1f1f1f',
              }}
            >
              <View style={{ width: '100%', height: 200, backgroundColor: '#111' }}>
                <Image
                  source={{ uri: item.data.image || 'https://via.placeholder.com/400x250?text=Live+Product' }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#E74C3C', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="radio" size={14} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>LIVE</Text>
                </View>
              </View>
              <View style={{ padding: 12, gap: 6 }}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{item.data.title}</Text>
                <Text style={{ color: '#8EE186', fontSize: 14, fontWeight: '700' }}>₣{(item.data.price || 0).toFixed(2)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#888', fontSize: 12 }}>Watch live</Text>
                  <Ionicons name="arrow-forward" size={14} color="#888" />
                </View>
              </View>
            </TouchableOpacity>
          );
        case 'video':
          return (
            <View key={`for-you-video-${index}`} style={{ width: '100%', marginBottom: 16 }}>
              {renderVideoProductCard(item.data)}
            </View>
          );
        case 'product':
        default:
          return (
            <View key={`for-you-product-${index}`} style={{ width: '100%', marginBottom: 16 }}>
              {renderEnhancedProductCard(item.data, false)}
            </View>
          );
      }
    };

    const renderedItems: React.ReactNode[] = [];
    forYouItems.forEach((item, idx) => {
      renderedItems.push(renderForYouCard(item, idx));
      if ((idx + 1) % 10 === 0 && heroImages.length > 0) {
        renderedItems.push(
          <View key={`for-you-banner-${idx}`} style={{ marginBottom: 16 }}>
            {renderPeriodicHero(heroImages[bannerCycle % heroImages.length], bannerCycle)}
          </View>
        );
        bannerCycle += 1;
      }
    });

    setHeroIndex(bannerCycle % Math.max(heroImages.length, 1));

    return (
      <View style={{ marginTop: 12, paddingHorizontal: 12 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>For You 🎯</Text>
        {renderedItems}
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
          snapToInterval={screenWidth * 0.45 + 12}
          snapToAlignment="start"
        >
          {randomProducts.map((item) => (
            <View key={item.id} style={{ width: screenWidth * 0.45, marginRight: 12 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
              >
                {renderEnhancedProductCard(item, false)}
              </TouchableOpacity>
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

  // Use memoized sections helper for better performance
  const memoizedSections = useMemoizedSections(products);

  // Memoize mixed content generation - OPTIMIZED with pre-computed sections
  const mixedContent = useMemo(() => {
    // Don't generate content when screen is unfocused
    if (!isScreenFocused) {
      return [];
    }

    // Generate mixed content with periodic heroes and banners
    const generateContent = () => {
      const mixedContent: any[] = [];
      
      // 1. ALWAYS start with a banner
      mixedContent.push({ type: 'hero', data: heroImages[heroIndex % heroImages.length] });
      
      // 2. Add all curated sections as horizontal strips (BEFORE For You)
      if (memoizedSections.trending.length > 0) {
        mixedContent.push({ 
          type: 'section', 
          data: { 
            title: 'Trending Now 🔥', 
            subtitle: 'Hot products everyone\'s talking about',
            products: memoizedSections.trending 
          } 
        });
      }
      
      if (memoizedSections.hotPicks.length > 0) {
        mixedContent.push({ 
          type: 'section', 
          data: { 
            title: 'Hot Picks ⭐', 
            subtitle: 'Featured products you\'ll love',
            products: memoizedSections.hotPicks 
          } 
        });
      }
      
      if (memoizedSections.seasonalRave.length > 0) {
        mixedContent.push({ 
          type: 'section', 
          data: { 
            title: 'Seasonal Rave 🎄', 
            subtitle: 'Perfect for the season',
            products: memoizedSections.seasonalRave 
          } 
        });
      }
      
      if (memoizedSections.combodeals.length > 0) {
        mixedContent.push({ 
          type: 'section', 
          data: { 
            title: 'Combo Deals 💰', 
            subtitle: 'Bundle and save',
            products: memoizedSections.combodeals 
          } 
        });
      }
      
      if (memoizedSections.flashSales.length > 0) {
        mixedContent.push({ 
          type: 'section', 
          data: { 
            title: 'Flash Sales ⚡', 
            subtitle: 'Limited time offers',
            products: memoizedSections.flashSales 
          } 
        });
      }
      
      // 3. For You section comes LAST (endless list with mixed content)
      // Build mixed items: products, video products, auctions, live sales
      const forYouItems: ForYouItem[] = [];
      
      // Add regular products from forYou
      memoizedSections.forYou.forEach(product => {
        if (product.media_type === 'video' && product.primary_video_url) {
          forYouItems.push({ kind: 'video', data: product });
        } else {
          forYouItems.push({ kind: 'product', data: product });
        }
      });
      
      // Add video products
      const videoProducts = products.filter(p => p.media_type === 'video' && p.primary_video_url);
      videoProducts.slice(0, 5).forEach(product => {
        if (!forYouItems.find(item => item.kind === 'video' && item.data.id === product.id)) {
          forYouItems.push({ kind: 'video', data: product });
        }
      });
      
      // Auctions will be shown in separate periodic sections, not mixed in
      
      // Add live product sales (rendered like video products)
      liveProducts.slice(0, 3).forEach(liveProduct => {
        forYouItems.push({ kind: 'live', data: liveProduct });
      });
      
      // Shuffle for better mix
      const shuffled = forYouItems.sort(() => 0.5 - Math.random());
      
      if (shuffled.length > 0) {
        mixedContent.push({ 
          type: 'for-you', 
          data: { 
            title: 'For You 🎯', 
            subtitle: 'Personalized recommendations',
            items: shuffled 
          } 
        });
      }

      return mixedContent;
    };

    return generateContent();
  }, [memoizedSections, heroImages, isScreenFocused, filteredActiveAuctions, filteredUpcomingAuctions, liveProducts, products]);

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
            flexDirection: 'row',
            alignItems: 'center',
            zIndex: 1000,
            elevation: 5,
          }}>
            <Ionicons name="alert-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                {errorState.userMessage}
              </Text>
              {errorState.retryable && (
                <TouchableOpacity
                  onPress={() => loadData(true)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 4,
                    alignSelf: 'flex-start',
                    marginTop: 4,
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => setErrorState(null)}>
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

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
                  // Render curated sections as horizontal strips
                  return renderHorizontalProductSection(item.data.title, item.data.subtitle, item.data.products);
                case 'banner':
                  return renderPeriodicBanner(item.data.title, item.data.subtitle, index);
                case 'for-you':
                  // For You section with mixed content (products, videos, auctions, live sales)
                  return renderForYouSection(item.data.title, item.data.subtitle, item.data.items, index);
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
              <View key={item.id} style={{ width: screenWidth * 0.45, marginRight: 12 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                >
                  {renderEnhancedProductCard(item, false)}
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

  // Render periodic auction section (horizontal scroll)
  const renderAuctionSection = () => {
    const allAuctions = [...filteredActiveAuctions, ...filteredUpcomingAuctions];
    if (allAuctions.length === 0) return null;

    return (
      <View style={{ marginVertical: 16, width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 }}>
          <View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Auctions 🔨</Text>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Bid on exclusive items</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => navigation.navigate('AuctionDiscovery')}>
            <Text style={{ color: '#3498DB', fontSize: 12, fontWeight: '600' }}>See All</Text>
          </TouchableOpacity>
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
              onPress={() => navigation.navigate('AuctionDetails', { auctionId: auction.id })}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderForYouSection = (title: string, subtitle: string, items: ForYouItem[] | Product[], index: number) => {
    // Handle both old format (Product[]) and new format (ForYouItem[])
    const forYouItems: ForYouItem[] = Array.isArray(items) && items.length > 0 && 'kind' in items[0]
      ? items as ForYouItem[]
      : (items as Product[]).map(p => ({
          kind: (p.media_type === 'video' && p.primary_video_url) ? 'video' : 'product',
          data: p
        })) as ForYouItem[];

    // Filter out auctions from items (they'll be shown in separate sections)
    const itemsWithoutAuctions = forYouItems.filter(item => item.kind !== 'auction');

    if (itemsWithoutAuctions.length === 0) return null;

    // Separate items by type and sort chronologically (newest first)
    const sortByDate = (a: ForYouItem, b: ForYouItem) => {
      const dateA = new Date(a.data.created_at || 0).getTime();
      const dateB = new Date(b.data.created_at || 0).getTime();
      return dateB - dateA; // Newest first
    };

    const regularProducts = itemsWithoutAuctions
      .filter(item => item.kind === 'product')
      .sort(sortByDate);
    
    const videoProducts = itemsWithoutAuctions
      .filter(item => item.kind === 'video')
      .sort(sortByDate);
    
    const liveSales = itemsWithoutAuctions
      .filter(item => item.kind === 'live')
      .sort(sortByDate);

    // Systematic pattern-based row building
    type RowType = 
      | { type: 'grid'; items: ForYouItem[] }
      | { type: 'full-width'; item: ForYouItem }
      | { type: 'banner'; bannerIndex: number }
      | { type: 'auction-section' };

    const buildSystematicRows = (): RowType[] => {
      const rows: RowType[] = [];
      let regIdx = 0;
      let vidIdx = 0;
      let liveIdx = 0;
    let bannerCycle = heroIndex;
      
      // Pattern cycle:
      // 1. 4-6 regular products (2-3 grid rows)
      // 2. 1 video product
      // 3. 1 live sale
      // 4. 4-6 regular products (2-3 grid rows)
      // 5. 1 banner
      // 6. 1 auction section
      // 7. 1 video product
      // Repeat...

      while (regIdx < regularProducts.length || vidIdx < videoProducts.length || liveIdx < liveSales.length) {
        // Step 1: Add 4-6 regular products (2-3 grid rows)
        const firstBatchCount = Math.min(3, Math.ceil((regularProducts.length - regIdx) / 2));
        for (let i = 0; i < firstBatchCount; i++) {
          const rowItems = regularProducts.slice(regIdx, regIdx + 2);
          if (rowItems.length > 0) {
            rows.push({ type: 'grid', items: rowItems });
            regIdx += rowItems.length;
          }
        }

        // Step 2: Add 1 video product (if available)
        if (vidIdx < videoProducts.length) {
          rows.push({ type: 'full-width', item: videoProducts[vidIdx] });
          vidIdx++;
        }

        // Step 3: Add 1 live sale (if available)
        if (liveIdx < liveSales.length) {
          rows.push({ type: 'full-width', item: liveSales[liveIdx] });
          liveIdx++;
        }

        // Step 4: Add 4-6 regular products (2-3 grid rows)
        const secondBatchCount = Math.min(3, Math.ceil((regularProducts.length - regIdx) / 2));
        for (let i = 0; i < secondBatchCount; i++) {
          const rowItems = regularProducts.slice(regIdx, regIdx + 2);
          if (rowItems.length > 0) {
            rows.push({ type: 'grid', items: rowItems });
            regIdx += rowItems.length;
          }
        }

        // Step 5: Add banner (if available)
        if (heroImages.length > 0) {
          rows.push({ type: 'banner', bannerIndex: bannerCycle });
          bannerCycle++;
        }

        // Step 6: Add auction section (if available)
        if (filteredActiveAuctions.length > 0 || filteredUpcomingAuctions.length > 0) {
          rows.push({ type: 'auction-section' });
        }

        // Step 7: Add 1 video product (if available)
        if (vidIdx < videoProducts.length) {
          rows.push({ type: 'full-width', item: videoProducts[vidIdx] });
          vidIdx++;
        }

        // Safety check: if no items were added in this cycle, break to avoid infinite loop
        const currentTotal = regIdx + vidIdx + liveIdx;
        if (currentTotal >= regularProducts.length + videoProducts.length + liveSales.length) {
          break;
        }
      }

      return rows;
    };

    const rows = buildSystematicRows();

    // Render each row based on its type
    const renderRow = (row: RowType, rowIndex: number) => {
      switch (row.type) {
        case 'grid':
          // Render a 2-column grid row
          return (
            <View key={`grid-${rowIndex}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              {row.items.map((item, itemIdx) => (
                <View key={`grid-item-${rowIndex}-${itemIdx}`} style={{ width: '48%' }}>
                    <TouchableOpacity
                    onPress={() => navigation.navigate('ProductDetails', { productId: item.data.id })}
                  >
                    {renderEnhancedProductCard(item.data, false)}
                  </TouchableOpacity>
                </View>
              ))}
              {/* Fill empty space if only 1 item in row */}
              {row.items.length === 1 && <View style={{ width: '48%' }} />}
            </View>
          );

        case 'full-width':
          // Render full-width item (video or live)
          if (row.item.kind === 'live') {
            return (
              <TouchableOpacity
                key={`live-${rowIndex}`}
                      activeOpacity={0.9}
                onPress={() => navigation.navigate('LiveStreamViewer', { streamId: row.item.data.streamId })}
                      style={{
                        width: '100%',
                        backgroundColor: '#0d0d0d',
                        borderRadius: 12,
                        overflow: 'hidden',
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: '#1f1f1f',
                      }}
                    >
                <View style={{ width: '100%', backgroundColor: '#111' }}>
                        <Image
                    source={{ uri: row.item.data.image || 'https://via.placeholder.com/400x250?text=Live+Product' }}
                    style={{ 
                      width: '100%', 
                      height: undefined,
                      aspectRatio: 16/9, // Default to landscape, will adjust on load
                      maxHeight: 300,
                    }}
                    resizeMode="contain"
                    onLoad={(event) => {
                      // Image loaded successfully with proper aspect ratio
                      console.log(`📸 Live thumbnail loaded for stream: ${row.item.data.streamId}`);
                    }}
                        />
                        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#E74C3C', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="radio" size={14} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>LIVE</Text>
                        </View>
                      </View>
                      <View style={{ padding: 12, gap: 6 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{String(row.item.data.title || '')}</Text>
                  <Text style={{ color: '#8EE186', fontSize: 14, fontWeight: '700' }}>₣{(row.item.data.price || 0).toFixed(2)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ color: '#888', fontSize: 12 }}>Watch live</Text>
                          <Ionicons name="arrow-forward" size={14} color="#888" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
          } else if (row.item.kind === 'video') {
            return (
              <View key={`video-${rowIndex}`} style={{ width: '100%', marginBottom: 16 }}>
                {renderVideoProductCard(row.item.data)}
              </View>
            );
          }
          return null;

        case 'banner':
          // Render banner
          return (
            <View key={`banner-${rowIndex}`} style={{ marginBottom: 16 }}>
              {renderPeriodicHero(heroImages[row.bannerIndex % heroImages.length], row.bannerIndex)}
                    </View>
                  );

        case 'auction-section':
          // Render auction section
          return (
            <View key={`auction-${rowIndex}`} style={{ marginBottom: 16 }}>
              {renderAuctionSection()}
                    </View>
                  );

        default:
          return null;
      }
    };

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

        {/* Display items in systematic pattern */}
        <View style={{ paddingHorizontal: 12 }}>
          {rows.map((row, idx) => renderRow(row, idx))}
        </View>
      </View>
    );
  };

  // Check which video products are currently in viewport
  const checkVideoVisibility = useCallback(() => {
    const scrollY = currentScrollY.current;
    const screenHeight = Dimensions.get('window').height;
    const screenCenter = screenHeight / 2;
    const visibleThreshold = 0.5; // Video must be 50% visible to be considered
    
    let mostCenteredVideo: { id: string; distance: number; percentage: number } | null = null;
    
    videoProductPositions.current.forEach((position, productId) => {
      const { absoluteY, height } = position;
      
      // Calculate where the video appears on screen
      const videoTop = absoluteY - scrollY;
      const videoBottom = videoTop + height;
      
      // Check if video intersects with screen viewport
      const isTopVisible = videoTop >= 0 && videoTop < screenHeight;
      const isBottomVisible = videoBottom > 0 && videoBottom <= screenHeight;
      const coversScreen = videoTop < 0 && videoBottom > screenHeight;
      
      if (isTopVisible || isBottomVisible || coversScreen) {
        // Calculate visible height
        const visibleTop = Math.max(0, videoTop);
        const visibleBottom = Math.min(screenHeight, videoBottom);
        const visibleHeight = visibleBottom - visibleTop;
        const visiblePercentage = visibleHeight / height;
        
        // Only consider videos that meet the visibility threshold
        if (visiblePercentage >= visibleThreshold) {
          // Calculate distance from screen center
          const videoCenter = videoTop + (height / 2);
          const distanceFromCenter = Math.abs(videoCenter - screenCenter);
          
          console.log(`🎬 Video ${productId}: visible=${(visiblePercentage * 100).toFixed(0)}%, distanceFromCenter=${distanceFromCenter.toFixed(0)}px`);
          
          // Track the most centered video
          if (!mostCenteredVideo || distanceFromCenter < mostCenteredVideo.distance) {
            mostCenteredVideo = { 
              id: productId, 
              distance: distanceFromCenter,
              percentage: visiblePercentage 
            };
          }
        }
      }
    });
    
    // Create a set with only the most centered video (if any)
    const newVisibleVideos = new Set<string>();
    if (mostCenteredVideo) {
      newVisibleVideos.add(mostCenteredVideo.id);
    }
    
    // Only update if there's a change to avoid unnecessary re-renders
    setVisibleVideoProducts(prev => {
      const prevArray = Array.from(prev).sort();
      const newArray = Array.from(newVisibleVideos).sort();
      
      if (prevArray.length !== newArray.length || 
          !prevArray.every((val, idx) => val === newArray[idx])) {
        console.log('✅ Playing most centered video:', newArray[0] || 'none', 
                    mostCenteredVideo ? `(${(mostCenteredVideo.percentage * 100).toFixed(0)}% visible, ${mostCenteredVideo.distance.toFixed(0)}px from center)` : '');
        return newVisibleVideos;
      }
      return prev;
    });
  }, []);

  // Handle scroll events to update video visibility
  const handleForYouScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    currentScrollY.current = event.nativeEvent.contentOffset.y;
    checkVideoVisibility();
  }, [checkVideoVisibility]);

  // Render video product card (full width) with lazy loading
  const renderVideoProductCard = useCallback((item: Product) => {
    // Check if this video is in viewport (visible)
    const isInViewport = visibleVideoProducts.has(item.id);
    // Only play if: activeTab is products, video is in viewport, AND screen is focused
    // SAME PATTERN AS SERVICE TAB: activeTab === 'services' && isPlaying && isCurrentVideo
    const shouldPlayVideo = activeTab === 'products' && isInViewport && isScreenFocused;
    
    let viewRef: View | null = null;

    return (
      <View
        ref={(ref) => { viewRef = ref; }}
        onLayout={(event) => {
          // Use measureInWindow to get absolute position
          if (viewRef) {
            viewRef.measureInWindow((x, pageY, width, height) => {
              // pageY is distance from top of screen
              // We need to add scrollY to get position in ScrollView content
              const absoluteY = pageY + currentScrollY.current;
              
              videoProductPositions.current.set(item.id, { absoluteY, height });
              
              console.log(`📍 Video ${item.id}: pageY=${pageY.toFixed(0)}, scrollY=${currentScrollY.current.toFixed(0)}, absoluteY=${absoluteY.toFixed(0)}, height=${height}`);
              
              // Check visibility immediately
              checkVideoVisibility();
            });
          }
        }}
      >
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
          {/* Always render video player (don't unmount) - SAME AS SERVICE TAB */}
        {item.primary_video_url ? (
            <ProductVideoPlayer
              videoUri={item.primary_video_url}
              shouldAutoPlay={shouldPlayVideo}
              containerWidth={screenWidth}
            />
          ) : (
            // Show thumbnail when no video URL
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
                  ₣{(item.price || 0).toFixed(2)}
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
    </View>
    );
  }, [isScreenFocused, visibleVideoProducts, activeTab, navigation]);

  // Handler for vendor profile navigation
  const handleVendorPress = (userId: string) => {
    (navigation as any).navigate('PublicProfile', { userId });
  };

  // Handler for chat button on services (directly opens chat)
  const handleChatWithServiceProvider = async (serviceItem: VideoFeedItem) => {
    try {

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

      // Navigate to IndividualChatScreen with proper parameters
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: serviceItem.serviceProvider || serviceItem.username || 'Service Provider',
        chatAvatar: serviceItem.userAvatar || 'https://via.placeholder.com/50',
        chatType: chatType,
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
            setCurrentVideoIndex(newIndex);
            setFocusedVideoId(videoFeedData[newIndex]?.id);

            // Reset progress bar for new video
            setVideoProgress(0);
            setVideoPosition(0);
            setVideoDuration(0);

            // Ensure video is playing when switching
            if (activeTab === 'services') {
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
                <TouchableWithoutFeedback onPress={() => {
                  // If it's a live service, navigate to LiveStreamViewer
                  if (item.id.startsWith('live-service-') && (item as any).liveStreamId) {
                    navigation.navigate('LiveStreamViewer', { streamId: (item as any).liveStreamId });
                  } else {
                    handleVideoTap();
                  }
                }}>
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
                    
                    {/* LIVE indicator for live services */}
                    {item.id.startsWith('live-service-') && (
                      <View style={{
                        position: 'absolute',
                        top: insets.top + 60,
                        left: 16,
                        backgroundColor: '#E74C3C',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        zIndex: 1000
                      }}>
                        <Ionicons name="radio" size={14} color="#FFF" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>LIVE</Text>
                      </View>
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
                        @{String(item.username || '')}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={{ color: 'white', fontSize: 12, marginLeft: 4 }}>
                          {(item.rating || 0).toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {item.description && String(item.description).trim() ? (
                    <Text style={{ color: 'white', fontSize: 14, marginBottom: 12 }}>
                      {String(item.description)}
                    </Text>
                  ) : null}

                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                    ₣{(item.price || 0).toFixed(2)}
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
                      {String(item.likes || '0')}
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
                      {String(item.comments || '0')}
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
                      {String(item.shares || '0')}
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
          if (newTab !== activeTab) {
            setActiveTab(newTab);
            if (newTab === 'services') {
              // Clear visible product videos when switching to services
              setVisibleVideoProducts(new Set());
              setIsPlaying(true);
              // Reset to first video when switching to services
              setCurrentVideoIndex(0);
              setFocusedVideoId(videoFeedData[0]?.id);
            } else {
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
