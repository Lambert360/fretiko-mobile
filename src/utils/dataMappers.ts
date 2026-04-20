import { ProductData } from '../components/cards/ProductCard';
import { ServiceData } from '../components/cards/ServiceCard';
import { PersonData } from '../components/cards/PersonCard';
import { ProviderData } from '../components/cards';

// Helper functions for data sanitization
const toNumber = (val: any, fallback = 0) => {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
};

const toStringSafe = (val: any, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  return String(val);
};

/**
 * Maps API product data to ProductCard format
 */
export const mapProductToCard = (apiProduct: any): ProductData => {
  // Determine the correct image URL
  const imageUrl = apiProduct.primary_image_url || apiProduct.images?.[0] || apiProduct.image;
  const videoUrl = apiProduct.primary_video_url || apiProduct.videos?.[0];
  const isVideo = apiProduct.media_type === 'video';

  const mappedProduct = {
    id: apiProduct.id || '',
    title: apiProduct.name || apiProduct.title || 'Untitled Product',
    image: imageUrl,
    mediaUrl: isVideo ? videoUrl : imageUrl,
    mediaType: (isVideo ? 'video' : 'image') as 'video' | 'image',
    price: (function() { const p = parseFloat(apiProduct.price); return isNaN(p) ? 0 : p; })(),
    originalPrice: apiProduct.original_price ? (function() { const op = parseFloat(apiProduct.original_price); return isNaN(op) ? undefined : op; })() : undefined,
    currency: '₣',
    discount: apiProduct.discount != null ? toNumber(apiProduct.discount) : undefined,
    vendor: {
      id: apiProduct.user_id || apiProduct.vendor_id || '',
      name: toStringSafe(apiProduct.vendor_username || apiProduct.vendor_name, 'Unknown Vendor'),
      avatar: apiProduct.vendor_avatar || apiProduct.vendor_avatar_url,
      verified: apiProduct.vendor_verified || false,
      rating: apiProduct.vendor_rating ? (function() { const vr = parseFloat(apiProduct.vendor_rating); return isNaN(vr) ? undefined : vr; })() : undefined,
    },
    category: (apiProduct.category_name || apiProduct.category) ? toStringSafe(apiProduct.category_name || apiProduct.category) : undefined,
    rating: apiProduct.average_rating ? (function() { const r = parseFloat(apiProduct.average_rating); return isNaN(r) ? undefined : r; })() : undefined,
    reviews: toNumber(apiProduct.review_count ?? apiProduct.reviews, 0),
    inStock: apiProduct.quantity > 0 && apiProduct.status === 'active',
    fastShipping: apiProduct.shipping_options?.shipping === true,
    location: apiProduct.location ? toStringSafe(apiProduct.location) : undefined,
    mediaAspectRatio: apiProduct.mediaAspectRatio || 'portrait',
    likes: toNumber(apiProduct.like_count ?? apiProduct.likes, 0),
    views: toNumber(apiProduct.view_count ?? apiProduct.views, 0),
    isLiked: apiProduct.isLiked || false,
    isBookmarked: apiProduct.isBookmarked || false,
    isNew: apiProduct.is_new || false,
    isFeatured: apiProduct.is_featured || false,
    isTrending: apiProduct.is_trending || false,
  };

  return mappedProduct;
};

/**
 * Maps API service data to ServiceCard format
 */
export const mapServiceToCard = (apiService: any): ServiceData => {
  const mappedService = {
    id: apiService.id || '',
    title: apiService.title || apiService.name || 'Untitled Service',
    description: apiService.description || '',
    image: apiService.primary_image_url || apiService.images?.[0] || apiService.image,
    mediaUrl: apiService.media_type === 'video' ? apiService.primary_video_url : (apiService.primary_image_url || apiService.images?.[0]),
    mediaType: (apiService.media_type === 'video' ? 'video' : 'image') as 'video' | 'image',
    price: toNumber(apiService.price || apiService.base_price),
    priceType: apiService.price_type || 'fixed',
    currency: '₣',
    provider: {
      id: apiService.user_id || apiService.provider_id || '',
      name: toStringSafe(apiService.provider_name || apiService.vendor_name || apiService.user_profiles?.username, 'Unknown Provider'),
      avatar: apiService.provider_avatar || apiService.vendor_avatar || apiService.user_profiles?.avatar_url,
      verified: apiService.provider_verified || apiService.user_profiles?.is_verified || false,
      rating: apiService.provider_rating ? (function() { const r = parseFloat(apiService.provider_rating); return isNaN(r) ? undefined : r; })() : undefined,
      completedJobs: toNumber(apiService.provider_completed_jobs, 0),
    },
    category: (apiService.category_name || apiService.category) ? toStringSafe(apiService.category_name || apiService.category) : undefined,
    rating: apiService.average_rating ? (function() { const r = parseFloat(apiService.average_rating); return isNaN(r) ? undefined : r; })() : undefined,
    reviews: toNumber(apiService.review_count ?? apiService.reviews, 0),
    isAvailable: apiService.availability === 'available' || apiService.status === 'active',
    responseTime: apiService.response_time || apiService.responseTime,
    location: apiService.location ? toStringSafe(apiService.location) : undefined,
    mediaAspectRatio: apiService.mediaAspectRatio || 'landscape',
    isInstant: apiService.is_instant || false,
    isRemote: apiService.is_remote || false,
    skills: apiService.skills || apiService.tags || [],
    likes: toNumber(apiService.like_count ?? apiService.likes, 0),
    views: toNumber(apiService.view_count ?? apiService.views, 0),
    bookings: toNumber(apiService.booking_count ?? apiService.bookings, 0),
    isTopRated: apiService.is_top_rated || false,
    actionType: 'book' as 'book' | 'cart' | 'both',
  };

  return mappedService;
};

/**
 * Maps API person data to PersonCard format
 */
export const mapPersonToCard = (apiPerson: any): PersonData => {
  return {
    id: apiPerson.id || '',
    username: toStringSafe(apiPerson.username, 'unknown'),
    firstName: toStringSafe(apiPerson.first_name || apiPerson.firstName, ''),
    lastName: toStringSafe(apiPerson.last_name || apiPerson.lastName, ''),
    avatar: apiPerson.avatar_url || apiPerson.avatarUrl || apiPerson.avatar,
    location: apiPerson.location ? toStringSafe(apiPerson.location) : undefined,
    trustScore: apiPerson.trust_score || apiPerson.trustScore,
    isOnline: apiPerson.is_online || apiPerson.isOnline || false,
    mutualConnections: toNumber(apiPerson.mutual_connections ?? apiPerson.mutualConnections, 0),
    specialty: apiPerson.specialty,
    followers: toNumber(apiPerson.followers_count ?? apiPerson.followers, 0),
    verified: apiPerson.is_verified || apiPerson.verified || false,
    recentActivity: apiPerson.recent_activity || apiPerson.recentActivity,
    mediaAspectRatio: apiPerson.mediaAspectRatio || 'portrait',
    mediaType: apiPerson.media_type || apiPerson.mediaType,
    engagementRate: apiPerson.engagement_rate || apiPerson.engagementRate,
  };
};

/**
 * Maps API provider data to ProviderCard format
 */
export const mapProviderToCard = (apiProvider: any): ProviderData => {
  return {
    id: apiProvider.id || '',
    name: toStringSafe(apiProvider.name || apiProvider.full_name, 'Unknown'),
    avatar: apiProvider.avatar_url || apiProvider.avatar,
    rating: apiProvider.rating ? (function() { const r = parseFloat(apiProvider.rating); return isNaN(r) ? 0 : r; })() : 0,
    vehicleType: apiProvider.vehicle_type || apiProvider.vehicleType || 'bike',
    totalDeliveries: toNumber(apiProvider.total_deliveries ?? apiProvider.totalDeliveries, 0),
    isOnline: apiProvider.is_online || apiProvider.isOnline || false,
    distance: apiProvider.distance != null ? toNumber(apiProvider.distance) : undefined,
    specialties: apiProvider.specialties || [],
    completionRate: apiProvider.completion_rate || apiProvider.completionRate,
    avgDeliveryTime: apiProvider.avg_delivery_time || apiProvider.avgDeliveryTime,
    verified: apiProvider.is_verified || apiProvider.verified || false,
    recentActivity: apiProvider.recent_activity || apiProvider.recentActivity,
    mediaAspectRatio: apiProvider.mediaAspectRatio || 'portrait',
    mediaType: apiProvider.media_type || apiProvider.mediaType,
    customerSatisfaction: apiProvider.customer_satisfaction || apiProvider.customerSatisfaction,
  };
};

/**
 * Maps arrays of API data to card format
 */
export const mapProductsArray = (products: any[]): ProductData[] => {
  return products.map(mapProductToCard);
};

export const mapServicesArray = (services: any[]): ServiceData[] => {
  return services.map(mapServiceToCard);
};

export const mapPeopleArray = (people: any[]): PersonData[] => {
  return people.map(mapPersonToCard);
};

export const mapProvidersArray = (providers: any[]): ProviderData[] => {
  return providers.map(mapProviderToCard);
};
