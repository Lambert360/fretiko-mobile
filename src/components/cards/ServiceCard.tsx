import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ServiceData {
  id: string;
  title: string;
  description?: string;
  image?: string;
  price?: number;
  priceType?: 'fixed' | 'hourly' | 'starting_at' | 'negotiable';
  currency?: string;
  provider: {
    id: string;
    name: string;
    avatar?: string;
    verified?: boolean;
    rating?: number;
    completedJobs?: number;
  };
  category?: string;
  rating?: number;
  reviews?: number;
  isAvailable?: boolean;
  responseTime?: string; // e.g., "Usually responds in 1 hour"
  location?: string;
  // Service action type
  actionType?: 'book' | 'cart' | 'both'; // book = appointment/consultation, cart = purchasable service
  serviceType?: 'appointment' | 'consultation' | 'digital_product' | 'course' | 'subscription' | 'physical_service';
  // Media content
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaAspectRatio?: 'landscape' | 'portrait' | 'square';
  // Service features
  isInstant?: boolean;
  isRemote?: boolean;
  isUrgent?: boolean;
  isDigital?: boolean;
  skills?: string[];
  // Engagement
  likes?: number;
  views?: number;
  bookings?: number;
  purchases?: number; // For cart-type services
  isLiked?: boolean;
  isBookmarked?: boolean;
  // Special badges
  isFeatured?: boolean;
  isTopRated?: boolean;
}

interface ServiceCardProps {
  service: ServiceData;
  variant?: 'featured' | 'grid' | 'list';
  onPress?: (service: ServiceData) => void;
  onLike?: (service: ServiceData) => void;
  onBookmark?: (service: ServiceData) => void;
  onProviderPress?: (providerId: string) => void;
  onBookNow?: (service: ServiceData) => void;
  onAddToCart?: (service: ServiceData) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  variant = 'featured',
  onPress,
  onLike,
  onBookmark,
  onProviderPress,
  onBookNow,
  onAddToCart,
}) => {
  const getMediaHeight = () => {
    if (variant === 'grid') return 140;
    if (variant === 'list') return 80;
    
    switch (service.mediaAspectRatio) {
      case 'portrait': return 240;
      case 'landscape': return 160;
      case 'square': return 200;
      default: return 200;
    }
  };

  const getPriceDisplay = () => {
    if (!service.price) return 'Price on request';
    
    const price = `${service.currency || '₦'}${service.price.toLocaleString()}`;
    
    switch (service.priceType) {
      case 'hourly': return `${price}/hour`;
      case 'starting_at': return `From ${price}`;
      case 'negotiable': return `${price} (Negotiable)`;
      default: return price;
    }
  };

  const renderMedia = () => {
    const imageUri = service.mediaUrl || service.image || `https://picsum.photos/400/400?random=${service.id}`;
    
    return (
      <View style={[styles.mediaContainer, { height: getMediaHeight() }]}>
        <Image 
          source={{ uri: imageUri }} 
          style={styles.mediaContent}
          resizeMode="cover"
        />
        
        {service.mediaType === 'video' && (
          <View style={styles.videoOverlay}>
            <Ionicons name="play-circle" size={24} color="rgba(255,255,255,0.9)" />
          </View>
        )}

        {/* Badges */}
        <View style={styles.badgeContainer}>
          {service.isInstant && (
            <View style={[styles.badge, styles.instantBadge]}>
              <Ionicons name="flash" size={10} color="#FFFFFF" />
              <Text style={styles.badgeText}>INSTANT</Text>
            </View>
          )}
          {service.isTopRated && (
            <View style={[styles.badge, styles.topRatedBadge]}>
              <Ionicons name="star" size={10} color="#FFFFFF" />
              <Text style={styles.badgeText}>TOP RATED</Text>
            </View>
          )}
          {service.isRemote && (
            <View style={[styles.badge, styles.remoteBadge]}>
              <Ionicons name="wifi" size={10} color="#FFFFFF" />
              <Text style={styles.badgeText}>REMOTE</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {onBookmark && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onBookmark(service)}
            >
              <Ionicons 
                name={service.isBookmarked ? "bookmark" : "bookmark-outline"} 
                size={16} 
                color={service.isBookmarked ? "#FFD700" : "rgba(255,255,255,0.8)"} 
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Availability status */}
        {!service.isAvailable && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>Currently Unavailable</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFeaturedCard = () => (
    <TouchableOpacity style={styles.featuredCard} onPress={() => onPress?.(service)}>
      {renderMedia()}
      
      <View style={styles.cardContent}>
        {/* Provider info */}
        <TouchableOpacity 
          style={styles.providerInfo}
          onPress={() => onProviderPress?.(service.provider?.id)}
        >
          <Image 
            source={{ 
              uri: service.provider?.avatar || `https://picsum.photos/30/30?random=${service.provider?.id || 'default'}` 
            }} 
            style={styles.providerAvatar} 
          />
          <View style={styles.providerDetails}>
            <Text style={styles.providerName}>{service.provider?.name || 'Unknown Provider'}</Text>
            {service.provider?.verified && (
              <Ionicons name="checkmark-circle" size={12} color="#1DA1F2" />
            )}
          </View>
          {service.provider?.completedJobs && (
            <Text style={styles.completedJobs}>{service.provider?.completedJobs} jobs</Text>
          )}
        </TouchableOpacity>

        {/* Service details */}
        <Text style={styles.serviceTitle} numberOfLines={2}>{service.title}</Text>
        
        {service.description && (
          <Text style={styles.description} numberOfLines={2}>{service.description}</Text>
        )}

        {service.category && (
          <Text style={styles.category}>{service.category}</Text>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{getPriceDisplay()}</Text>
          {service.isUrgent && (
            <View style={styles.urgentBadge}>
              <Ionicons name="time" size={12} color="#FF5722" />
              <Text style={styles.urgentText}>Urgent</Text>
            </View>
          )}
        </View>

        {/* Rating and reviews */}
        {service.rating && (
          <View style={styles.ratingRow}>
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingText}>{service.rating.toFixed(1)}</Text>
            </View>
            {service.reviews && (
              <Text style={styles.reviewsText}>({service.reviews} reviews)</Text>
            )}
            {service.responseTime && (
              <Text style={styles.responseTime}>{service.responseTime}</Text>
            )}
          </View>
        )}

        {/* Skills */}
        {service.skills && service.skills.length > 0 && (
          <View style={styles.skillsContainer}>
            {service.skills.slice(0, 3).map((skill, index) => (
              <View key={index} style={styles.skillTag}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Engagement and action */}
        <View style={styles.bottomRow}>
          <View style={styles.engagementRow}>
            {onLike && (
              <TouchableOpacity 
                style={styles.engagementButton}
                onPress={() => onLike(service)}
              >
                <Ionicons 
                  name={service.isLiked ? "heart" : "heart-outline"} 
                  size={14} 
                  color={service.isLiked ? "#E91E63" : "rgba(255,255,255,0.6)"} 
                />
                {service.likes && <Text style={styles.engagementText}>{service.likes}</Text>}
              </TouchableOpacity>
            )}
            
            {service.views && (
              <View style={styles.engagementButton}>
                <Ionicons name="eye" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.engagementText}>{service.views}</Text>
              </View>
            )}
            
            {service.bookings && (
              <View style={styles.engagementButton}>
                <Ionicons name="calendar" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.engagementText}>{service.bookings}</Text>
              </View>
            )}
            
            {service.purchases && (
              <View style={styles.engagementButton}>
                <Ionicons name="bag" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.engagementText}>{service.purchases}</Text>
              </View>
            )}
          </View>

          {service.isAvailable && (
            <View style={styles.actionButtonsContainer}>
              {(service.actionType === 'book' || service.actionType === 'both' || !service.actionType) && onBookNow && (
                <TouchableOpacity 
                  style={[styles.actionButton, service.actionType === 'both' ? styles.halfButton : styles.fullButton]}
                  onPress={() => onBookNow(service)}
                >
                  <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Book</Text>
                </TouchableOpacity>
              )}
              
              {(service.actionType === 'cart' || service.actionType === 'both') && onAddToCart && (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.cartButton, service.actionType === 'both' ? styles.halfButton : styles.fullButton]}
                  onPress={() => onAddToCart(service)}
                >
                  <Ionicons name="cart-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Add to Cart</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderGridCard = () => (
    <TouchableOpacity style={styles.gridCard} onPress={() => onPress?.(service)}>
      {renderMedia()}
      <View style={styles.gridContent}>
        <Text style={styles.gridTitle} numberOfLines={2}>{service.title}</Text>
        <Text style={styles.gridProvider}>{service.provider?.name || 'Unknown Provider'}</Text>
        <Text style={styles.gridPrice}>{getPriceDisplay()}</Text>
        {service.rating && (
          <View style={styles.gridRating}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.gridRatingText}>{service.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderListCard = () => (
    <TouchableOpacity style={styles.listCard} onPress={() => onPress?.(service)}>
      {renderMedia()}
      <View style={styles.listContent}>
        <Text style={styles.listTitle} numberOfLines={1}>{service.title}</Text>
        <Text style={styles.listProvider}>{service.provider?.name || 'Unknown Provider'}</Text>
        <Text style={styles.listPrice}>{getPriceDisplay()}</Text>
        {service.rating && (
          <View style={styles.listRating}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.listRatingText}>{service.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  switch (variant) {
    case 'grid': return renderGridCard();
    case 'list': return renderListCard();
    default: return renderFeaturedCard();
  }
};

const styles = StyleSheet.create({
  // Featured card styles
  featuredCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mediaContainer: {
    position: 'relative',
  },
  mediaContent: {
    width: '100%',
    resizeMode: 'cover',
  },
  videoOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'column',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  instantBadge: {
    backgroundColor: '#FF5722',
  },
  topRatedBadge: {
    backgroundColor: '#FFD700',
  },
  remoteBadge: {
    backgroundColor: '#00BCD4',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  actionButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  unavailableText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  providerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  providerName: {
    color: '#1DA1F2',
    fontSize: 12,
    fontWeight: '600',
  },
  completedJobs: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  serviceTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  category: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  price: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '700',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,87,34,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  urgentText: {
    color: '#FF5722',
    fontSize: 11,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewsText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  responseTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginLeft: 'auto',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  skillTag: {
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  skillText: {
    color: '#1DA1F2',
    fontSize: 11,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
    backgroundColor: '#1DA1F2',
  },
  cartButton: {
    backgroundColor: '#4CAF50',
  },
  fullButton: {
    paddingHorizontal: 16,
  },
  halfButton: {
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Legacy support
  bookButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Grid card styles
  gridCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gridContent: {
    padding: 12,
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  gridProvider: {
    color: '#1DA1F2',
    fontSize: 12,
    marginBottom: 4,
  },
  gridPrice: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  gridRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gridRatingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },

  // List card styles
  listCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  listContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  listProvider: {
    color: '#1DA1F2',
    fontSize: 12,
    marginBottom: 4,
  },
  listPrice: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  listRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listRatingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },
});