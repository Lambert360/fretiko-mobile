import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface GiftCardDesign {
  id: string;
  name: string;
  design_url: string;
  preview_url: string;
  is_active: boolean;
  sort_order: number;
}

export interface SuggestedAmount {
  id: string;
  amount: number;
  display_name: string;
  is_popular: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface GiftCard {
  id: string;
  card_number: string;
  pin: string; // Added PIN field
  initial_balance: number;
  current_balance: number;
  status: 'active' | 'claimed' | 'redeemed' | 'expired' | 'blocked';
  design: GiftCardDesign;
  delivery_method: 'none' | 'email' | 'chat' | 'both';
  purchased_at: string;
  expires_at: string;
  claimed_at?: string;
  last_used_at?: string;
  recipient_username?: string; // Added recipient fields
  recipient_email?: string;
  email_sent_at?: string; // Added delivery tracking
  chat_sent_at?: string;
  // Admin creation tracking
  created_by?: string;
  source: 'user_purchase' | 'admin_created';
  creation_reason?: string;
  is_commercial: boolean;
}

export interface PurchaseGiftCardData {
  designId: string;
  amount: number;
  recipientUsername?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  personalMessage?: string;
  deliveryPreference?: 'email' | 'chat' | 'both';
}

export interface RedeemGiftCardData {
  cardNumber: string;
  pin: string;
  orderTotal: number;
}

export interface CheckBalanceData {
  cardNumber: string;
  pin: string;
}

export const giftCardAPI = {
  /**
   * Purchase a gift card
   */
  async purchaseGiftCard(token: string, data: PurchaseGiftCardData) {
    try {
      const response = await fetch(`${API_URL}/gift-cards/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to purchase gift card');
      }

      return await response.json();
    } catch (error) {
      console.error('Gift card purchase error:', error);
      throw error;
    }
  },

  /**
   * Claim a gift card using claim code
   */
  async claimGiftCard(token: string, claimCode: string) {
    try {
      const response = await fetch(`${API_URL}/gift-cards/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ claimCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim gift card');
      }

      return await response.json();
    } catch (error) {
      console.error('Gift card claim error:', error);
      throw error;
    }
  },

  /**
   * Redeem gift card during checkout
   */
  async redeemGiftCard(token: string, data: RedeemGiftCardData) {
    try {
      const response = await fetch(`${API_URL}/gift-cards/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to redeem gift card');
      }

      return await response.json();
    } catch (error) {
      console.error('Gift card redemption error:', error);
      throw error;
    }
  },

  /**
   * Check gift card balance
   */
  async checkBalance(data: CheckBalanceData) {
    try {
      const response = await fetch(`${API_URL}/gift-cards/check-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to check balance');
      }

      return await response.json();
    } catch (error) {
      console.error('Gift card balance check error:', error);
      throw error;
    }
  },

  /**
   * Get user's gift cards
   */
  async getMyGiftCards(token: string): Promise<GiftCard[]> {
    try {
      const response = await fetch(`${API_URL}/gift-cards/my-cards`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch gift cards');
      }

      return await response.json();
    } catch (error) {
      console.error('Get gift cards error:', error);
      throw error;
    }
  },

  /**
   * Get gift card designs from Supabase
   */
  async getGiftCardDesigns(token?: string): Promise<GiftCardDesign[]> {
    try {
      const { data, error } = await supabase
        .from('gift_card_designs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Get gift card designs error:', error);
      throw error;
    }
  },

  /**
   * Get suggested amounts from Supabase
   */
  async getSuggestedAmounts(token?: string): Promise<SuggestedAmount[]> {
    try {
      const { data, error } = await supabase
        .from('gift_card_suggested_amounts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Get suggested amounts error:', error);
      throw error;
    }
  },

  /**
   * Get gift card by claim code (for validation before claiming)
   */
  async getGiftCardByClaimCode(claimCode: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select(`
          *,
          design:gift_card_designs (
            name,
            design_url,
            preview_url
          )
        `)
        .eq('claim_code', claimCode)
        .eq('status', 'active')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Get gift card by claim code error:', error);
      throw error;
    }
  },
};

export default giftCardAPI;
