import { API_CONFIG } from '../config/api';
import * as SecureStore from 'expo-secure-store';

/**
 * Virtual Gift Types
 */
export interface VirtualGift {
  id: string;
  name: string;
  emoji: string;
  credit_value: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * User Gift Ownership
 */
export interface UserGift {
  id: string; // user_gifts.id
  gift_id: string;
  gift_name: string;
  emoji: string;
  quantity: number;
  total_value: number;
  source: 'purchased' | 'received_call' | 'received_stream' | 'received_auction';
  received_at: string;
}

/**
 * User Gifts Response
 */
export interface UserGiftsResponse {
  gifts: UserGift[];
  total_gifts: number;
  total_value: number;
}

/**
 * Gift Purchase Item
 */
export interface GiftPurchaseItem {
  gift_id: string;
  quantity: number;
}

/**
 * Purchase Gifts Response
 */
export interface PurchaseGiftsResponse {
  success: boolean;
  transaction_id: string;
  total_cost: number;
  gifts_added: Array<{
    gift_id: string;
    gift_name: string;
    quantity: number;
  }>;
  new_wallet_balance: number;
}

/**
 * Convert Gift Item (for request)
 */
export interface ConvertGiftItem {
  user_gift_id: string; // user_gifts.id
  quantity: number; // How many to convert
}

/**
 * Convert Gifts Response
 */
export interface ConvertGiftsResponse {
  success: boolean;
  transaction_id: string;
  total_value: number;
  user_credit: number; // 80% of total value
  platform_fee: number; // 20% of total value
  new_wallet_balance: number;
  gifts_converted: Array<{
    gift_id: string;
    gift_name: string;
    quantity: number;
  }>;
}

/**
 * Send Gift DTO
 */
export interface SendGiftDto {
  gift_id: string;
  quantity: number;
  recipient_id: string;
  session_type: 'call' | 'stream' | 'auction';
  session_id: string;
  message?: string;
}

class GiftAPI {
  private async getAuthHeaders(): Promise<HeadersInit> {
    // Use the same token key as the main auth/wallet flow (`accessToken`),
    // but fall back to `authToken` for compatibility if needed.
    let token = await SecureStore.getItemAsync('accessToken');
    if (!token) {
      token = await SecureStore.getItemAsync('authToken');
    }

    if (token) {
      console.log('🔑 Gift API token: Present', `(${token.substring(0, 20)}...)`);
    } else {
      console.log('🔑 Gift API token: Missing');
    }

    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Get all available virtual gifts
   */
  async getAvailableGifts(): Promise<VirtualGift[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/gifts`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch available gifts');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching available gifts:', error);
      throw error;
    }
  }

  /**
   * Get user's gift collection
   */
  async getUserGifts(): Promise<UserGiftsResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/gifts/my-gifts`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch user gifts');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching user gifts:', error);
      throw error;
    }
  }

  /**
   * Purchase gifts
   */
  async purchaseGifts(purchases: GiftPurchaseItem[]): Promise<PurchaseGiftsResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/gifts/purchase`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ purchases }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to purchase gifts');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error purchasing gifts:', error);
      throw error;
    }
  }

  /**
   * Convert gifts to credits
   */
  async convertGifts(gifts: ConvertGiftItem[]): Promise<ConvertGiftsResponse> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/gifts/convert`, {
        method: 'POST',
        headers,
        // Backend expects: { gifts: [{ user_gift_id, quantity }, ...] }
        body: JSON.stringify({ gifts }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to convert gifts');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error converting gifts:', error);
      throw error;
    }
  }

  /**
   * Send a gift (used by call/stream/auction systems)
   */
  async sendGift(dto: SendGiftDto): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/gifts/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send gift');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error sending gift:', error);
      throw error;
    }
  }
}

export const giftAPI = new GiftAPI();

