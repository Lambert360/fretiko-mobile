import { ProductData } from '../components/cards/ProductCard';
import { ServiceData } from '../components/cards/ServiceCard';
import { PersonData } from '../components/cards/PersonCard';
import { ProviderData } from '../components/cards';

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
    mediaType: isVideo ? 'video' : 'image',
    price: parseFloat(apiProduct.price) || 0,
    originalPrice: apiProduct.original_price ? parseFloat(apiProduct.original_price) : undefined,
    currency: '₣', // Freti currency symbol
    discount: apiProduct.discount || undefined,
    vendor: {
      id: apiProduct.user_id || apiProduct.vendor_id || '',
      name: apiProduct.vendor_username || apiProduct.vendor_name || 'Unknown Vendor',
      avatar: apiProduct.vendor_avatar || apiProduct.vendor_avatar_url,
      verified: apiProduct.vendor_verified || false,
      rating: apiProduct.vendor_rating ? parseFloat(apiProduct.vendor_rating) : undefined,
    },
    category: apiProduct.category_name || apiProduct.category,
    rating: apiProduct.average_rating ? parseFloat(apiProduct.average_rating) : undefined,
    reviews: apiProduct.review_count || apiProduct.reviews,
    inStock: apiProduct.quantity > 0 && apiProduct.status === 'active',
    fastShipping: apiProduct.shipping_options?.shipping === true,
    location: apiProduct.location,
    mediaAspectRatio: apiProduct.mediaAspectRatio || 'portrait',
    likes: apiProduct.like_count || apiProduct.likes || 0,
    views: apiProduct.view_count || apiProduct.views || 0,
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
    mediaType: apiService.media_type === 'video' ? 'video' : 'image',
    price: parseFloat(apiService.price || apiService.base_price) || 0,
    priceType: apiService.price_type || 'fixed',
    currency: '₣', // Freti currency symbol
    provider: {
      id: apiService.user_id || apiService.provider_id || '',
      name: apiService.provider_name || apiService.vendor_name || apiService.user_profiles?.username || 'Unknown Provider',
      avatar: apiService.provider_avatar || apiService.vendor_avatar || apiService.user_profiles?.avatar_url,
      verified: apiService.provider_verified || apiService.user_profiles?.is_verified || false,
      rating: apiService.provider_rating ? parseFloat(apiService.provider_rating) : undefined,
      completedJobs: apiService.provider_completed_jobs || 0,
    },
    category: apiService.category_name || apiService.category,
    rating: apiService.average_rating ? parseFloat(apiService.average_rating) : undefined,
    reviews: apiService.review_count || apiService.reviews,
    isAvailable: apiService.availability === 'available' || apiService.status === 'active',
    responseTime: apiService.response_time || apiService.responseTime,
    location: apiService.location,
    mediaAspectRatio: apiService.mediaAspectRatio || 'landscape',
    isInstant: apiService.is_instant || false,
    isRemote: apiService.is_remote || false,
    skills: apiService.skills || apiService.tags || [],
    likes: apiService.like_count || apiService.likes || 0,
    views: apiService.view_count || apiService.views || 0,
    bookings: apiService.booking_count || apiService.bookings || 0,
    isTopRated: apiService.is_top_rated || false,
    actionType: 'book',
  };

  return mappedService;
};

/**
 * Maps API person data to PersonCard format
 */
export const mapPersonToCard = (apiPerson: any): PersonData => {
  return {
    id: apiPerson.id || '',
    username: apiPerson.username || 'unknown',
    firstName: apiPerson.first_name || apiPerson.firstName || '',
    lastName: apiPerson.last_name || apiPerson.lastName || '',
    avatar: apiPerson.avatar_url || apiPerson.avatarUrl || apiPerson.avatar,
    location: apiPerson.location,
    trustScore: apiPerson.trust_score || apiPerson.trustScore,
    isOnline: apiPerson.is_online || apiPerson.isOnline || false,
    mutualConnections: apiPerson.mutual_connections || apiPerson.mutualConnections || 0,
    specialty: apiPerson.specialty,
    followers: apiPerson.followers_count || apiPerson.followers,
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
    name: apiProvider.name || apiProvider.full_name || 'Unknown',
    avatar: apiProvider.avatar_url || apiProvider.avatar,
    rating: apiProvider.rating ? parseFloat(apiProvider.rating) : 0,
    vehicleType: apiProvider.vehicle_type || apiProvider.vehicleType || 'bike',
    totalDeliveries: apiProvider.total_deliveries || apiProvider.totalDeliveries || 0,
    isOnline: apiProvider.is_online || apiProvider.isOnline || false,
    distance: apiProvider.distance,
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
