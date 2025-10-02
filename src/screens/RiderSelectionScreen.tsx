import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { walletAPI } from '../services/walletAPI';
import { riderAPI, RiderAvailabilityRequest } from '../services/riderAPI';

const { width: screenWidth } = Dimensions.get('window');

interface RiderSelectionScreenProps {
  navigation: any;
  route: {
    params: {
      pickupLocation: {
        latitude: number;
        longitude: number;
        address: string;
      };
      orderDetails: {
        weight: number;
        itemCount: number;
        distance: number;
      };
      onRiderSelected: (rider: Rider) => void;
    };
  };
}

export interface Rider {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalDeliveries: number;
  vehicleType: 'wheelbarrow' | 'bike' | 'car';
  price: number;
  distanceFromPickup: number;
  estimatedArrival: number;
  isAvailable: boolean;
  unavailableReason?: string;
  specialties: string[];
  isOnline: boolean;
}

const RiderSelectionScreen: React.FC<RiderSelectionScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { pickupLocation, orderDetails, onRiderSelected } = route.params;
  
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const categories = [
    { id: 'recommended', name: 'Recommended', icon: 'star' },
    { id: 'cars', name: 'Cars', icon: 'car' },
    { id: 'bikes', name: 'Bikes', icon: 'bicycle' },
    { id: 'wheelbarrows', name: 'Wheelbarrows', icon: 'build' },
  ];

  useEffect(() => {
    loadNearbyRiders();
  }, []);

  const loadNearbyRiders = async () => {
    try {
      setLoading(true);
      
      // Prepare API request
      const request: RiderAvailabilityRequest = {
        pickupLocation,
        deliveryLocation: {
          latitude: 6.5244, // Mock delivery location
          longitude: 3.3792,
          address: 'Delivery Address'
        },
        orderDetails,
        maxDistance: 5, // 5km radius
      };

      // Fetch nearby riders
      const nearbyRiders = await riderAPI.getNearbyRiders(request);
      setRiders(nearbyRiders);
      
    } catch (error) {
      console.error('Error loading riders:', error);
      Alert.alert('Error', 'Failed to load nearby riders');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRiders = (categoryId: string): Rider[] => {
    switch (categoryId) {
      case 'recommended':
        return riders
          .filter(rider => rider.isAvailable)
          .sort((a, b) => {
            // Sort by: availability > rating > distance
            if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
            if (Math.abs(a.rating - b.rating) > 0.1) return b.rating - a.rating;
            return a.distanceFromPickup - b.distanceFromPickup;
          });
      case 'cars':
        return riders.filter(rider => rider.vehicleType === 'car');
      case 'bikes':
        return riders.filter(rider => rider.vehicleType === 'bike');
      case 'wheelbarrows':
        return riders.filter(rider => rider.vehicleType === 'wheelbarrow');
      default:
        return riders;
    }
  };

  const handleRiderSelect = (rider: Rider) => {
    if (!rider.isAvailable) {
      Alert.alert('Rider Unavailable', rider.unavailableReason || 'This rider is not available for your order');
      return;
    }

    Alert.alert(
      'Confirm Rider Selection',
      `Select ${rider.name} for ${walletAPI.formatFreti(rider.price)} delivery?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select Rider',
          onPress: () => {
            onRiderSelected(rider);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleAutoSelect = () => {
    const availableRiders = riders.filter(rider => rider.isAvailable);
    if (availableRiders.length === 0) {
      Alert.alert('No Riders Available', 'No riders are currently available for your location');
      return;
    }

    // Auto-select best rider based on rating and distance
    const bestRider = availableRiders.sort((a, b) => {
      const scoreA = a.rating * 0.7 + (5 - a.distanceFromPickup) * 0.3;
      const scoreB = b.rating * 0.7 + (5 - b.distanceFromPickup) * 0.3;
      return scoreB - scoreA;
    })[0];

    onRiderSelected(bestRider);
    navigation.goBack();
  };

  const getVehicleIcon = (vehicleType: string) => {
    switch (vehicleType) {
      case 'car': return 'car';
      case 'bike': return 'bicycle';
      case 'wheelbarrow': return 'build';
      default: return 'help-circle';
    }
  };

  const renderRiderCard = (rider: Rider) => (
    <TouchableOpacity
      key={rider.id}
      style={[
        styles.riderCard,
        !rider.isAvailable && styles.riderCardUnavailable,
      ]}
      onPress={() => handleRiderSelect(rider)}
    >
      <View style={styles.riderHeader}>
        <Image source={{ uri: rider.avatar }} style={styles.riderAvatar} />
        <View style={styles.riderInfo}>
          <Text style={styles.riderName}>{rider.name}</Text>
          <View style={styles.riderStats}>
            <Ionicons name="star" size={14} color="#F39C12" />
            <Text style={styles.riderRating}>{rider.rating}</Text>
            <Text style={styles.riderDeliveries}>• {rider.totalDeliveries} deliveries</Text>
          </View>
          <View style={styles.vehicleContainer}>
            <Ionicons 
              name={getVehicleIcon(rider.vehicleType) as any} 
              size={16} 
              color="#3498DB" 
            />
            <Text style={styles.vehicleType}>
              {rider.vehicleType.charAt(0).toUpperCase() + rider.vehicleType.slice(1)}
            </Text>
            {rider.isOnline && (
              <View style={styles.onlineIndicator}>
                <Text style={styles.onlineText}>Online</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.riderPricing}>
          <Text style={styles.riderPrice}>{walletAPI.formatFreti(rider.price)}</Text>
          <Text style={styles.riderDistance}>
            {rider.distanceFromPickup.toFixed(1)}km away
          </Text>
          <Text style={styles.riderEta}>
            {rider.estimatedArrival} min arrival
          </Text>
        </View>
      </View>

      {rider.specialties.length > 0 && (
        <View style={styles.specialtiesContainer}>
          {rider.specialties.map((specialty, index) => (
            <View key={index} style={styles.specialtyBadge}>
              <Text style={styles.specialtyText}>{specialty}</Text>
            </View>
          ))}
        </View>
      )}

      {!rider.isAvailable && (
        <View style={styles.unavailableOverlay}>
          <Text style={styles.unavailableText}>
            {rider.unavailableReason || 'Not available'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderCategorySection = (categoryId: string) => {
    const filteredRiders = getFilteredRiders(categoryId);
    
    return (
      <View style={styles.categorySection}>
        {filteredRiders.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>No riders available in this category</Text>
          </View>
        ) : (
          filteredRiders.map(renderRiderCard)
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Finding nearby riders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Rider</Text>
        <TouchableOpacity style={styles.autoSelectButton} onPress={handleAutoSelect}>
          <Text style={styles.autoSelectText}>Auto</Text>
        </TouchableOpacity>
      </View>

      {/* Order Info */}
      <View style={styles.orderInfo}>
        <Text style={styles.orderInfoText}>
          {orderDetails.itemCount} item(s) • {orderDetails.distance.toFixed(1)}km delivery
        </Text>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryTabs}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabsContainer}
        >
          {categories.map((category, index) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryTab,
                selectedCategory === index && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(index)}
            >
              <Ionicons 
                name={category.icon as any} 
                size={20} 
                color={selectedCategory === index ? '#FFF' : '#666'} 
              />
              <Text style={[
                styles.categoryTabText,
                selectedCategory === index && styles.categoryTabTextActive,
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Riders List */}
      <ScrollView style={styles.ridersContainer} showsVerticalScrollIndicator={false}>
        {renderCategorySection(categories[selectedCategory].id)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  autoSelectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3498DB',
    borderRadius: 20,
  },
  autoSelectText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  orderInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  orderInfoText: {
    color: '#CCC',
    fontSize: 14,
    textAlign: 'center',
  },
  categoryTabs: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  categoryTabsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  categoryTabActive: {
    backgroundColor: '#3498DB',
  },
  categoryTabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#FFF',
  },
  ridersContainer: {
    flex: 1,
    padding: 16,
  },
  categorySection: {
    gap: 16,
  },
  riderCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  riderCardUnavailable: {
    opacity: 0.6,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  riderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  riderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  riderRating: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  riderDeliveries: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  vehicleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleType: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '500',
  },
  onlineIndicator: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  onlineText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  riderPricing: {
    alignItems: 'flex-end',
  },
  riderPrice: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  riderDistance: {
    color: '#999',
    fontSize: 12,
    marginBottom: 1,
  },
  riderEta: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '500',
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyBadge: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  specialtyText: {
    color: '#3498DB',
    fontSize: 10,
    fontWeight: '500',
  },
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  emptySection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
  },
});

export default RiderSelectionScreen;