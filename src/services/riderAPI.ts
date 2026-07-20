import { api } from './api';
import * as SecureStore from 'expo-secure-store';
import { Country, State } from 'country-state-city';

export interface RiderLocation {
  latitude: number;
  longitude: number;
  address: string;
  state?: string;   // e.g. "Lagos" — used by backend for rider & partner eligibility filtering
  country?: string; // e.g. "Nigeria"
  city?: string;    // e.g. "Ikeja"
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
  // Item types in the order ('product' | 'service'). When 'service' is present,
  // only motorized riders (car/van/truck) are eligible — never bikes/wheelbarrows.
  itemTypes?: string[];
}

export interface RiderRecommendation {
  riderId: string;
  score: number;
  reasons: string[];
}

export interface InterstateCompanyOption {
  companyId: string;
  companyName: string;
  logoUrl?: string;
  basePrice: number;
  perKmRate: number;
  estimatedDeliveryDaysMin: number;
  estimatedDeliveryDaysMax: number;
  isInternational: boolean;
}

const normalizeLocation = <T extends { state?: string; country?: string }>(location: T): T => {
  if (!location) return location;
  const rawCountry = (location.country || '').trim();
  const rawState = (location.state || '').trim();

  if (!rawCountry) {
    return { ...location, state: rawState, country: rawCountry } as T;
  }

  const country = Country.getAllCountries().find(
    c =>
      c.name.toLowerCase() === rawCountry.toLowerCase() ||
      c.isoCode.toLowerCase() === rawCountry.toLowerCase()
  );

  const countryCode = country?.isoCode;
  if (!countryCode) {
    return { ...location, state: rawState, country: rawCountry } as T;
  }

  const state = State.getStatesOfCountry(countryCode).find(
    s =>
      s.name.toLowerCase() === rawState.toLowerCase() ||
      s.isoCode.toLowerCase() === rawState.toLowerCase()
  );

  return {
    ...location,
    country: countryCode,
    state: state?.isoCode || rawState,
  } as T;
};

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
      const normalizedRequest = { ...request, pickupLocation: normalizeLocation(request.pickupLocation) };
      const response = await api.post('/riders/nearby', normalizedRequest, { headers });
      console.log('🚴 Nearby riders loaded:', response.data?.length || 0, 'riders');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get nearby riders:', error.response?.data || error.message);
      return [];
    }
  },

  // Get rider recommendations based on order details
  getRiderRecommendations: async (request: RiderAvailabilityRequest): Promise<RiderRecommendation[]> => {
    try {
      const headers = await getAuthHeaders();
      const normalizedRequest = { ...request, pickupLocation: normalizeLocation(request.pickupLocation) };
      const response = await api.post('/riders/recommendations', normalizedRequest, { headers });
      console.log('⭐ Rider recommendations loaded:', response.data?.length || 0, 'recommendations');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get rider recommendations:', error.response?.data || error.message);
      return [];
    }
  },

  // Get logistics companies eligible for interstate/international delivery
  getInterstateOptions: async (request: {
    pickupLocation: { state?: string; country?: string };
    deliveryLocation: { state?: string; country?: string };
  }): Promise<InterstateCompanyOption[]> => {
    try {
      const normalizedRequest = {
        pickupLocation: normalizeLocation(request.pickupLocation),
        deliveryLocation: normalizeLocation(request.deliveryLocation),
      };
      const headers = await getAuthHeaders();
      const response = await api.post('/riders/interstate-options', normalizedRequest, { headers });
      console.log('🚛 Interstate delivery options loaded:', response.data?.length || 0, 'companies');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get interstate options:', error.response?.data || error.message);
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

