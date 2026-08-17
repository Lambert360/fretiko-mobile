import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

export interface ScheduledOrder {
  id: string;
  orderNumber: string;
  serviceId: string | null;
  serviceName: string;
  scheduledDate: string | null; // YYYY-MM-DD
  scheduledTime: string | null; // HH:MM
  status: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  location: string | null;
  createdAt: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface MonthSummary {
  [date: string]: number; // YYYY-MM-DD -> order count
}

// Get authentication headers
const getAuthHeaders = async () => {
  try {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) {
      throw new Error('User not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw new Error('User not authenticated');
  }
};

class ScheduleAPI {
  /**
   * Get orders for a specific date or month
   * @param date - Optional specific date (YYYY-MM-DD)
   * @param month - Optional month (YYYY-MM)
   */
  async getOrdersByDate(date?: string, month?: string): Promise<ScheduledOrder[]> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      if (date) queryParams.append('date', date);
      if (month) queryParams.append('month', month);

      const response = await fetch(
        `${API_BASE_URL}/workspace/schedule/orders-by-date?${queryParams.toString()}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch orders by date: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get orders by date error:', error);
      throw error;
    }
  }

  /**
   * Get month summary for calendar indicators
   * @param month - Month in YYYY-MM format
   */
  async getMonthSummary(month: string): Promise<MonthSummary> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${API_BASE_URL}/workspace/schedule/month-summary?month=${month}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch month summary: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get month summary error:', error);
      throw error;
    }
  }

  /**
   * Get orders for today
   */
  async getTodayOrders(): Promise<ScheduledOrder[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getOrdersByDate(today);
  }

  /**
   * Get orders for current month
   */
  async getCurrentMonthOrders(): Promise<ScheduledOrder[]> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.getOrdersByDate(undefined, month);
  }
}

export const scheduleAPI = new ScheduleAPI();
