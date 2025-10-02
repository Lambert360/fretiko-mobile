import { api } from './api';
import * as SecureStore from 'expo-secure-store';

export interface RiderLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface OrderDetails {
  weight: number;
  itemCount: number;
  distance: number;
  category?: string;
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
  trustScore?: number;
  completionRate?: number;
}

export interface RiderAvailabilityRequest {
  pickupLocation: RiderLocation;
  deliveryLocation: RiderLocation;
  orderDetails: OrderDetails;
  maxDistance?: number; // Maximum distance from pickup location (default: 5km)
}

export interface RiderRecommendation {
  riderId: string;
  score: number;
  reasons: string[];
}

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('accessToken');
  return token ? { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  } : { 'Content-Type': 'application/json' };
};

export const riderAPI = {
  
  // Get available riders near pickup location
  getNearbyRiders: async (request: RiderAvailabilityRequest): Promise<Rider[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.post('/riders/nearby', request, { headers });
      console.log('🚴 Nearby riders loaded:', response.data?.length || 0, 'riders');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get nearby riders:', error.response?.data || error.message);
      
      // Return mock data for development
      return getMockRiders(request);
    }
  },

  // Get rider recommendations based on order details
  getRiderRecommendations: async (request: RiderAvailabilityRequest): Promise<RiderRecommendation[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.post('/riders/recommendations', request, { headers });
      console.log('⭐ Rider recommendations loaded:', response.data?.length || 0, 'recommendations');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get rider recommendations:', error.response?.data || error.message);
      return [];
    }
  },

  // Check rider availability for specific order
  checkRiderAvailability: async (riderId: string, orderDetails: OrderDetails): Promise<{
    available: boolean;
    reason?: string;
    estimatedArrival?: number;
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.post(`/riders/${riderId}/availability`, orderDetails, { headers });
      console.log(`✅ Rider ${riderId} availability:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to check rider ${riderId} availability:`, error.response?.data || error.message);
      return { available: false, reason: 'Failed to check availability' };
    }
  },

  // Get rider profile details
  getRiderProfile: async (riderId: string): Promise<Rider | null> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get(`/riders/${riderId}`, { headers });
      console.log(`👤 Rider profile loaded:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to get rider profile:`, error.response?.data || error.message);
      return null;
    }
  },

  // Select rider for order
  selectRiderForOrder: async (riderId: string, orderId: string): Promise<{
    success: boolean;
    estimatedPickup?: string;
    estimatedDelivery?: string;
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.post('/orders/assign-rider', {
        riderId,
        orderId,
      }, { headers });
      console.log('🎯 Rider assigned to order:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to assign rider:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to assign rider to order');
    }
  },

  // Get rider delivery history and stats
  getRiderStats: async (riderId: string): Promise<{
    totalDeliveries: number;
    avgRating: number;
    completionRate: number;
    avgDeliveryTime: number;
    specialties: string[];
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get(`/riders/${riderId}/stats`, { headers });
      console.log(`📊 Rider stats loaded:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Failed to get rider stats:`, error.response?.data || error.message);
      return {
        totalDeliveries: 0,
        avgRating: 0,
        completionRate: 0,
        avgDeliveryTime: 0,
        specialties: [],
      };
    }
  },
};

// Mock data for development
const getMockRiders = (request: RiderAvailabilityRequest): Rider[] => {
  const baseRiders: Rider[] = [
    {
      id: '1',
      name: 'John Adebayo',
      avatar: 'https://picsum.photos/100/100?random=1',
      rating: 4.8,
      totalDeliveries: 150,
      vehicleType: 'bike',
      price: 8.50,
      distanceFromPickup: 0.3,
      estimatedArrival: 5,
      isAvailable: true,
      specialties: ['Fragile items', 'Fast delivery'],
      isOnline: true,
      trustScore: 850,
      completionRate: 98,
    },
    {
      id: '2',
      name: 'Sarah Okafor',
      avatar: 'https://picsum.photos/100/100?random=2',
      rating: 4.9,
      totalDeliveries: 200,
      vehicleType: 'car',
      price: 15.00,
      distanceFromPickup: 0.8,
      estimatedArrival: 8,
      isAvailable: true,
      specialties: ['Bulk delivery', 'Long distance'],
      isOnline: true,
      trustScore: 920,
      completionRate: 99,
    },
    {
      id: '3',
      name: 'Ahmed Hassan',
      avatar: 'https://picsum.photos/100/100?random=3',
      rating: 4.7,
      totalDeliveries: 80,
      vehicleType: 'wheelbarrow',
      price: 3.00,
      distanceFromPickup: 0.2,
      estimatedArrival: 3,
      isAvailable: request.orderDetails.distance <= 1.0,
      unavailableReason: request.orderDetails.distance > 1.0 ? 'Distance too far for wheelbarrow delivery' : undefined,
      specialties: ['Eco-friendly', 'Local delivery', 'Fresh produce'],
      isOnline: true,
      trustScore: 780,
      completionRate: 95,
    },
    {
      id: '4',
      name: 'Grace Nwankwo',
      avatar: 'https://picsum.photos/100/100?random=4',
      rating: 4.6,
      totalDeliveries: 120,
      vehicleType: 'bike',
      price: 7.00,
      distanceFromPickup: 1.2,
      estimatedArrival: 12,
      isAvailable: request.orderDetails.weight <= 20,
      unavailableReason: request.orderDetails.weight > 20 ? 'Order too heavy for bike delivery' : undefined,
      specialties: ['Electronics', 'Same-day delivery'],
      isOnline: true,
      trustScore: 810,
      completionRate: 97,
    },
    {
      id: '5',
      name: 'Ibrahim Musa',
      avatar: 'https://picsum.photos/100/100?random=5',
      rating: 4.5,
      totalDeliveries: 300,
      vehicleType: 'car',
      price: 12.00,
      distanceFromPickup: 2.0,
      estimatedArrival: 15,
      isAvailable: true,
      specialties: ['Furniture', 'Appliances', 'Heavy items'],
      isOnline: false, // Offline rider example
      trustScore: 750,
      completionRate: 94,
    },
    {
      id: '6',
      name: 'Funmi Adeyemi',
      avatar: 'https://picsum.photos/100/100?random=6',
      rating: 4.9,
      totalDeliveries: 90,
      vehicleType: 'wheelbarrow',
      price: 2.50,
      distanceFromPickup: 0.4,
      estimatedArrival: 6,
      isAvailable: request.orderDetails.distance <= 1.0 && request.orderDetails.weight <= 15,
      unavailableReason: request.orderDetails.distance > 1.0 ? 'Distance too far' : 
                        request.orderDetails.weight > 15 ? 'Order too heavy' : undefined,
      specialties: ['Groceries', 'Market runs', 'Quick delivery'],
      isOnline: true,
      trustScore: 870,
      completionRate: 99,
    },
  ];

  // Filter by online status and sort by distance
  return baseRiders
    .filter(rider => rider.isOnline)
    .sort((a, b) => a.distanceFromPickup - b.distanceFromPickup);
};