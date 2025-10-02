import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface RiderData {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  // For riders: vehicleType, for vendors: businessType
  serviceType?: 'bike' | 'car' | 'wheelbarrow' | 'restaurant' | 'store' | 'service';
  vehicleType?: 'bike' | 'car' | 'wheelbarrow'; // Backward compatibility
  businessType?: 'restaurant' | 'store' | 'service' | 'electronics' | 'fashion' | 'food';
  totalDeliveries?: number; // For riders
  totalOrders?: number; // For vendors
  isOnline: boolean;
  verified?: boolean;
  distance?: number;
  specialties?: string[];
  completionRate?: number;
  avgDeliveryTime?: number; // For riders
  avgProcessingTime?: number; // For vendors
  recentActivity?: string;
  // Media content
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaAspectRatio?: 'landscape' | 'portrait' | 'square';
  // Performance metrics
  earnings?: number;
  hoursActive?: number;
  customerSatisfaction?: number;
  // Vendor-specific
  products?: number;
  followers?: string | number;
}

interface RiderCardProps {
  rider: RiderData;
  variant?: 'featured' | 'compact' | 'selection';
  onPress?: (rider: RiderData) => void;
  onSelect?: (rider: RiderData) => void;
}

export const RiderCard: React.FC<RiderCardProps> = ({
  rider,
  variant = 'featured',
  onPress,
  onSelect,
}) => {
  // Safety check for undefined rider
  if (!rider) {
    return null;
  }
  const getServiceColor = () => {
    const serviceType = rider.serviceType || rider.vehicleType || rider.businessType;
    switch (serviceType) {
      case 'car': return '#2196F3';
      case 'bike': return '#FF9800';
      case 'wheelbarrow': return '#4CAF50';
      case 'restaurant': return '#E91E63';
      case 'store': return '#9C27B0';
      case 'service': return '#00BCD4';
      case 'electronics': return '#607D8B';
      case 'fashion': return '#E91E63';
      case 'food': return '#FF5722';
      default: return '#9E9E9E';
    }
  };

  const getServiceIcon = () => {
    const serviceType = rider.serviceType || rider.vehicleType || rider.businessType;
    switch (serviceType) {
      case 'car': return 'car';
      case 'bike': return 'bicycle';
      case 'wheelbarrow': return 'leaf';
      case 'restaurant': return 'restaurant';
      case 'store': return 'storefront';
      case 'service': return 'build';
      case 'electronics': return 'phone-portrait';
      case 'fashion': return 'shirt';
      case 'food': return 'fast-food';
      default: return 'business';
    }
  };

  const getMediaHeight = () => {
    if (!rider.mediaUrl) return 200;
    
    switch (rider.mediaAspectRatio) {
      case 'portrait': return 240;
      case 'landscape': return 160;
      case 'square': return 200;
      default: return 200;
    }
  };

  const renderMedia = () => {
    if (!rider.mediaUrl) {
      return (
        <Image 
          source={{ 
            uri: rider?.avatar || `https://picsum.photos/400/400?random=${rider?.id}` 
          }} 
          style={[styles.mediaContent, { height: getMediaHeight() }]} 
        />
      );
    }

    return (
      <View style={[styles.mediaContainer, { height: getMediaHeight() }]}>
        <Image 
          source={{ uri: rider.mediaUrl }} 
          style={styles.mediaContent}
          resizeMode={rider.mediaAspectRatio === 'landscape' ? 'cover' : 'cover'}
        />
        {rider.mediaType === 'video' && (
          <View style={styles.videoOverlay}>
            <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </View>
    );
  };

  const renderFeaturedCard = () => (
    <TouchableOpacity style={styles.featuredCard} onPress={() => onPress?.(rider)}>
      <View style={styles.mediaWrapper}>
        {renderMedia()}
        
        {/* Overlay badges */}
        {rider.isOnline && <View style={styles.onlineIndicator} />}
        {rider.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        )}
        
        {/* Vehicle badge */}
        <View style={[styles.vehicleBadge, { backgroundColor: getServiceColor() }]}>
          <Ionicons name={getServiceIcon() as any} size={14} color="#FFFFFF" />
        </View>
        
        {/* Performance overlay */}
        {rider.customerSatisfaction && (
          <View style={styles.performanceOverlay}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.performanceText}>{rider.customerSatisfaction}%</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.riderName}>{rider.name}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.ratingText}>{rider.rating.toFixed(1)}</Text>
          </View>
        </View>
        
        {rider.distance && (
          <Text style={styles.distance}>{rider.distance.toFixed(1)}km away</Text>
        )}
        
        <Text style={styles.deliveries}>{rider.totalDeliveries} deliveries</Text>

        {rider.specialties && rider.specialties.length > 0 && (
          <View style={styles.specialtiesContainer}>
            {rider.specialties.slice(0, 2).map((specialty, index) => (
              <Text key={index} style={styles.specialtyTag}>{specialty}</Text>
            ))}
          </View>
        )}

        {rider.completionRate && (
          <Text style={styles.completionRate}>{rider.completionRate}% completion rate</Text>
        )}

        {rider.recentActivity && (
          <Text style={styles.activity}>{rider.recentActivity}</Text>
        )}

        {onSelect && (
          <TouchableOpacity 
            style={styles.selectButton} 
            onPress={() => onSelect(rider)}
          >
            <Text style={styles.selectButtonText}>Select Rider</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCompactCard = () => (
    <TouchableOpacity style={styles.compactCard} onPress={() => onPress?.(rider)}>
      <View style={styles.compactAvatarContainer}>
        <Image 
          source={{ 
            uri: rider?.avatar || `https://picsum.photos/50/50?random=${rider?.id}` 
          }} 
          style={styles.compactAvatar} 
        />
        {rider.isOnline && <View style={styles.onlineIndicatorSmall} />}
        <View style={[styles.vehicleBadgeSmall, { backgroundColor: getServiceColor() }]}>
          <Ionicons name={getServiceIcon() as any} size={10} color="#FFFFFF" />
        </View>
      </View>
      
      <View style={styles.compactContent}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactName}>{rider.name}</Text>
          <View style={styles.compactRating}>
            <Ionicons name="star" size={10} color="#FFD700" />
            <Text style={styles.compactRatingText}>{rider.rating.toFixed(1)}</Text>
          </View>
        </View>
        
        <Text style={styles.compactDeliveries}>{rider.totalDeliveries} deliveries</Text>
        
        {rider.distance && (
          <Text style={styles.compactDistance}>{rider.distance.toFixed(1)}km away</Text>
        )}
      </View>
      
      {onSelect && (
        <TouchableOpacity 
          style={styles.compactSelectButton} 
          onPress={() => onSelect(rider)}
        >
          <Text style={styles.compactSelectText}>Select</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderSelectionCard = () => (
    <TouchableOpacity style={styles.selectionCard} onPress={() => onPress?.(rider)}>
      <Image 
        source={{ 
          uri: rider?.avatar || `https://picsum.photos/60/60?random=${rider?.id}` 
        }} 
        style={styles.selectionAvatar} 
      />
      
      <View style={styles.selectionContent}>
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionName}>{rider.name}</Text>
          <View style={styles.selectionBadges}>
            {rider.isOnline && <View style={styles.onlineIndicatorSmall} />}
            <View style={[styles.vehicleBadgeSmall, { backgroundColor: getServiceColor() }]}>
              <Ionicons name={getServiceIcon() as any} size={10} color="#FFFFFF" />
            </View>
          </View>
        </View>
        
        <View style={styles.selectionStats}>
          <View style={styles.selectionRating}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.selectionRatingText}>{rider.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.selectionDeliveries}>{rider.totalDeliveries} orders</Text>
          {rider.distance && (
            <Text style={styles.selectionDistance}>{rider.distance.toFixed(1)}km</Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.selectionButton, { borderColor: getServiceColor() }]} 
        onPress={() => onSelect?.(rider)}
      >
        <Text style={[styles.selectionButtonText, { color: getServiceColor() }]}>
          Select
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  switch (variant) {
    case 'compact': return renderCompactCard();
    case 'selection': return renderSelectionCard();
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
  mediaWrapper: {
    position: 'relative',
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
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  onlineIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#27AE60',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  performanceOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  performanceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  riderName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  distance: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  deliveries: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  specialtyTag: {
    color: '#1DA1F2',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  completionRate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 4,
  },
  activity: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  selectButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Compact card styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  compactAvatarContainer: {
    position: 'relative',
  },
  compactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  onlineIndicatorSmall: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27AE60',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  vehicleBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  compactContent: {
    flex: 1,
    marginLeft: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  compactName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  compactRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactRatingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  compactDeliveries: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 2,
  },
  compactDistance: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  compactSelectButton: {
    backgroundColor: 'rgba(29, 161, 242, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1DA1F2',
  },
  compactSelectText: {
    color: '#1DA1F2',
    fontSize: 12,
    fontWeight: '600',
  },

  // Selection card styles
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectionAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectionContent: {
    flex: 1,
    marginLeft: 12,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectionName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  selectionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectionRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionRatingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  selectionDeliveries: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  selectionDistance: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  selectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  selectionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});