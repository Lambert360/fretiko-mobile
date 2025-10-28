import { api } from './api';

export interface RiderLocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  isOnline?: boolean;
  isAvailable?: boolean;
  batteryLevel?: number;
}

export interface RiderLocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  isOnline: boolean;
  isAvailable: boolean;
  lastPing: string;
  batteryLevel?: number;
  currentOrderId?: string;
}

class RiderLocationAPI {
  /**
   * Update rider's current GPS location
   * Called by riders to send their real-time location
   */
  async updateRiderLocation(locationData: RiderLocationUpdate): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post('/riders/location', locationData);
      return response.data;
    } catch (error) {
      console.error('Error updating rider location:', error);
      throw error;
    }
  }

  /**
   * Get rider's current location
   * Called by buyers to track their delivery
   */
  async getRiderLocation(riderId: string): Promise<RiderLocationData | null> {
    try {
      const response = await api.get(`/riders/${riderId}/location`);
      return response.data;
    } catch (error) {
      console.error('Error getting rider location:', error);
      throw error;
    }
  }

  /**
   * Toggle rider's online/available status
   * Called by riders to go online/offline or available/busy
   */
  async toggleRiderStatus(isOnline?: boolean, isAvailable?: boolean): Promise<{ success: boolean }> {
    try {
      const response = await api.put('/riders/status', { isOnline, isAvailable });
      return response.data;
    } catch (error) {
      console.error('Error toggling rider status:', error);
      throw error;
    }
  }

  /**
   * Set rider's active order
   * Called when rider starts/ends a delivery
   */
  async setRiderActiveOrder(riderId: string, orderId: string | null): Promise<{ success: boolean }> {
    try {
      const response = await api.put(`/riders/${riderId}/active-order`, { orderId });
      return response.data;
    } catch (error) {
      console.error('Error setting rider active order:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   * Returns distance in kilometers
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate ETA based on distance and vehicle type
   * Returns estimated time in minutes
   */
  calculateETA(distance: number, vehicleType: 'wheelbarrow' | 'bike' | 'car' = 'bike'): number {
    const speeds = {
      wheelbarrow: 5, // 5 km/h
      bike: 15, // 15 km/h
      car: 30, // 30 km/h
    };

    const speed = speeds[vehicleType];
    const timeInHours = distance / speed;
    const timeInMinutes = timeInHours * 60;

    return Math.max(3, Math.ceil(timeInMinutes)); // Minimum 3 minutes
  }

  /**
   * Format distance for display
   */
  formatDistance(distanceInKm: number): string {
    if (distanceInKm < 1) {
      return `${Math.round(distanceInKm * 1000)}m`;
    }
    return `${distanceInKm.toFixed(1)}km`;
  }

  /**
   * Format ETA for display
   */
  formatETA(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}

export const riderLocationAPI = new RiderLocationAPI();
