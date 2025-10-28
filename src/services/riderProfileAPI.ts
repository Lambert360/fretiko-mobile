import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export enum VehicleType {
  WHEELBARROW = 'wheelbarrow',
  BIKE = 'bike',
  CAR = 'car',
  VAN = 'van',
  TRUCK = 'truck',
}

export enum VehicleCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
}

export enum ProfileStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export interface ServiceCategoryPricing {
  enabled: boolean;
  base_price?: number;
  per_km_rate?: number;
  custom_price?: number | null;
}

export interface ServicePricing {
  intracity?: ServiceCategoryPricing;
  intercity?: ServiceCategoryPricing;
  interstate?: ServiceCategoryPricing;
  express?: ServiceCategoryPricing;
  cargo?: ServiceCategoryPricing;
  shipping?: ServiceCategoryPricing;
  food?: ServiceCategoryPricing;
  grocery?: ServiceCategoryPricing;
}

export interface DaySchedule {
  start: string; // HH:MM format
  end: string; // HH:MM format
}

export interface OperatingHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface RiderProfile {
  id: string;
  user_id: string;
  vehicle_type: VehicleType;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  license_plate?: string;
  vehicle_capacity_weight?: number;
  vehicle_capacity_volume?: number;
  vehicle_photos: string[];
  vehicle_condition: VehicleCondition;
  service_pricing: ServicePricing;
  promised_delivery_time?: number;
  delivery_promise_message?: string;
  is_online: boolean;
  is_available: boolean;
  max_delivery_distance: number;
  operating_hours: OperatingHours;
  profile_status: ProfileStatus;
  profile_completion: number;
  created_at: string;
  updated_at: string;
}

export interface RiderProfileWithStats extends RiderProfile {
  stats: {
    total_deliveries: number;
    rating: number;
    total_earnings: number;
    trust_score: number;
  };
}

export interface CreateRiderProfileData {
  vehicle_type: VehicleType;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  license_plate?: string;
  vehicle_capacity_weight?: number;
  vehicle_capacity_volume?: number;
  vehicle_condition?: VehicleCondition;
  vehicle_photos?: string[];
  service_pricing?: ServicePricing;
  promised_delivery_time?: number;
  delivery_promise_message?: string;
  max_delivery_distance?: number;
  operating_hours?: OperatingHours;
}

export interface UpdateRiderProfileData {
  vehicle_type?: VehicleType;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  license_plate?: string;
  vehicle_capacity_weight?: number;
  vehicle_capacity_volume?: number;
  vehicle_condition?: VehicleCondition;
  vehicle_photos?: string[];
  service_pricing?: ServicePricing;
  promised_delivery_time?: number;
  delivery_promise_message?: string;
  is_available?: boolean;
  max_delivery_distance?: number;
  operating_hours?: OperatingHours;
  profile_status?: ProfileStatus;
}

export const riderProfileAPI = {
  /**
   * Get current rider's profile
   */
  getRiderProfile: async (): Promise<RiderProfile | null> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.get('/riders/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.profile;
    } catch (error: any) {
      console.error('Error fetching rider profile:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get rider profile with stats
   */
  getRiderProfileWithStats: async (): Promise<RiderProfileWithStats> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.get('/riders/profile/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.profile;
    } catch (error: any) {
      console.error('Error fetching rider profile with stats:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Create rider profile
   */
  createRiderProfile: async (data: CreateRiderProfileData): Promise<RiderProfile> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.post('/riders/profile', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.profile;
    } catch (error: any) {
      console.error('Error creating rider profile:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Update rider profile
   */
  updateRiderProfile: async (data: UpdateRiderProfileData): Promise<RiderProfile> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.patch('/riders/profile', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.profile;
    } catch (error: any) {
      console.error('Error updating rider profile:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Update vehicle information
   */
  updateVehicleInfo: async (data: Partial<CreateRiderProfileData>): Promise<RiderProfile> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.patch('/riders/profile/vehicle', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.profile;
    } catch (error: any) {
      console.error('Error updating vehicle info:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Update service pricing
   */
  updateServicePricing: async (pricing: ServicePricing): Promise<RiderProfile> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.patch('/riders/profile/pricing', pricing, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.profile;
    } catch (error: any) {
      console.error('Error updating service pricing:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Toggle online/offline status
   */
  toggleOnlineStatus: async (isOnline: boolean): Promise<RiderProfile> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.post(
        '/riders/profile/toggle-online',
        { is_online: isOnline },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.data.profile;
    } catch (error: any) {
      console.error('Error toggling online status:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Upload vehicle photos
   */
  uploadVehiclePhotos: async (photos: string[]): Promise<RiderProfile> => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const response = await api.post(
        '/riders/profile/upload-photos',
        { photos },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.data.profile;
    } catch (error: any) {
      console.error('Error uploading vehicle photos:', error.response?.data || error.message);
      throw error;
    }
  },
};

