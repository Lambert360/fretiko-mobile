/**
 * FRETIKO MOBILE - PIN API SERVICE
 * Handles all API calls related to PIN verification
 */

import { API_CONFIG } from '../config/api';
import * as SecureStore from 'expo-secure-store';

export interface PinStatus {
  hasPin: boolean;
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
}

class PinAPIService {
  private baseURL = `${API_CONFIG.BASE_URL}/wallet/pin`;

  /**
   * Get auth headers
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await SecureStore.getItemAsync('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Get PIN status
   */
  async getPinStatus(): Promise<PinStatus> {
    try {
      const headers = await this.getHeaders();
      console.log('🔐 Fetching PIN status from:', `${this.baseURL}/status`);
      
      const response = await fetch(`${this.baseURL}/status`, {
        method: 'GET',
        headers,
      });

      console.log('📡 PIN status response:', response.status, response.statusText);

      if (!response.ok) {
        // Handle 404 as "no PIN" rather than an error
        if (response.status === 404) {
          console.log('⚠️ PIN not found - user has no PIN set');
          return {
            hasPin: false,
            isLocked: false,
            failedAttempts: 0,
            lockedUntil: null,
          };
        }
        
        let errorMessage = `Failed to get PIN status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // Ignore JSON parse errors
        }
        
        const error: any = new Error(errorMessage);
        error.response = {
          status: response.status,
          data: await response.json().catch(() => ({ message: errorMessage })),
        };
        throw error;
      }

      const data = await response.json();
      console.log('✅ PIN status fetched successfully:', data);
      return data;
    } catch (error: any) {
      console.error('❌ Error getting PIN status:', error);
      
      // If it's a network error or 404, return default "no PIN" status
      if (error.message?.includes('404') || !error.response) {
        console.log('⚠️ Returning default PIN status (no PIN set)');
        return {
          hasPin: false,
          isLocked: false,
          failedAttempts: 0,
          lockedUntil: null,
        };
      }
      
      throw error;
    }
  }

  /**
   * Create PIN
   */
  async createPin(pin: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create PIN');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating PIN:', error);
      throw error;
    }
  }

  /**
   * Verify PIN
   */
  async verifyPin(
    pin: string,
    actionType?: string,
    referenceId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin, actionType, referenceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid PIN');
      }

      return await response.json();
    } catch (error) {
      console.error('Error verifying PIN:', error);
      throw error;
    }
  }

  /**
   * Change PIN
   */
  async changePin(oldPin: string, newPin: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/change`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ oldPin, newPin }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change PIN');
      }

      return await response.json();
    } catch (error) {
      console.error('Error changing PIN:', error);
      throw error;
    }
  }

  /**
   * Request PIN reset
   */
  async requestPinReset(): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/reset-request`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to request PIN reset');
      }

      return await response.json();
    } catch (error) {
      console.error('Error requesting PIN reset:', error);
      throw error;
    }
  }
}

export const pinAPI = new PinAPIService();

