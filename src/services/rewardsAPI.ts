/**
 * FRETIKO MOBILE - REWARDS API SERVICE
 * Handles all API calls related to rewards system
 */

import { API_CONFIG } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ============================================
// TYPES - Match backend responses
// ============================================

export interface RewardsBalance {
  user_id: string;
  available_rewards: number;
  pending_rewards: number;
  lifetime_earned: number;
  lifetime_spent: number;
  last_calculation_period?: string;
  display_available: string;
  display_pending: string;
}

export interface RewardsSummary {
  user_id: string;
  available_rewards: number;
  pending_rewards: number;
  lifetime_earned: number;
  lifetime_spent: number;
  current_month_transactions: number;
  current_month_rewards: number;
  rewards_rate: number;
  rewards_enabled: boolean;
  display_available: string;
  display_pending: string;
  display_current_month_rewards: string;
}

export interface WalletDisplayRewards {
  available_rewards: number;
  pending_rewards: number;
  display_available: string;
  display_pending: string;
  next_credit_date: string;
  has_pending: boolean;
  rewards_enabled: boolean;
  current_month_progress: {
    transaction_amount: number;
    estimated_rewards: number;
    display_estimated: string;
    period: string;
  };
}

export interface CheckoutDisplayRewards {
  available_rewards: number;
  display_available: string;
  can_redeem: boolean;
  max_redeemable: number;
}

export interface RedemptionResult {
  success: boolean;
  transaction_id?: string;
  redeemed_amount: number;
  display_redeemed: string;
}

export interface RewardsTransaction {
  id: string;
  transactionType: 'monthly_credit' | 'purchase_redemption' | 'refund_reversal' | 'admin_adjustment' | 'expired_deduction';
  availableDelta: number;
  pendingDelta: number;
  availableBalanceAfter: number;
  pendingBalanceAfter: number;
  calculationPeriod?: string;
  referenceType?: string;
  referenceId?: string;
  description: string;
  metadata?: any;
  createdAt: string;
}

export interface RewardsHistoryResponse {
  transactions: RewardsTransaction[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================
// REWARDS API SERVICE CLASS
// ============================================

class RewardsAPIService {
  private baseURL = `${API_CONFIG.BASE_URL}/rewards`;

  /**
   * Get common headers for API requests with automatic token retrieval
   */
  private async getHeaders(): Promise<Record<string, string>> {
    try {
      // Use the same token retrieval logic as other APIs
      let accessToken = null;

      try {
        // Expo SDK 54 compatibility: Check if SecureStore is available
        if (SecureStore.isAvailableAsync && !(await SecureStore.isAvailableAsync())) {
          console.log('⚠️ SecureStore not available in rewardsAPI');
        } else {
          accessToken = await SecureStore.getItemAsync('accessToken');
        }
      } catch (secureStoreError) {
        console.log('⚠️ SecureStore error in rewardsAPI:', secureStoreError.message);

        // Fallback to AsyncStorage
        const fallbackToken = await AsyncStorage.getItem('accessToken_fallback');
        if (fallbackToken) {
          console.log('📦 Using fallback token in rewardsAPI');
          accessToken = fallbackToken;
        }
      }

      return {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      };
    } catch (error) {
      console.error('Error getting auth headers in rewardsAPI:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  }

  // ============================================
  // BALANCE & SUMMARY METHODS
  // ============================================

  /**
   * Get user's rewards balance
   */
  async getRewardsBalance(): Promise<RewardsBalance> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/balance`, {
        method: 'GET',
        headers: headers,
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get rewards balance: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting rewards balance:', error);
      throw error;
    }
  }

  /**
   * Get detailed rewards summary with current month progress
   */
  async getRewardsSummary(): Promise<RewardsSummary> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/summary`, {
        method: 'GET',
        headers: headers,
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get rewards summary: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting rewards summary:', error);
      throw error;
    }
  }

  /**
   * Get rewards data formatted for wallet display
   */
  async getWalletDisplayRewards(): Promise<WalletDisplayRewards> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/wallet-display`, {
        method: 'GET',
        headers: headers,
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get wallet display rewards: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting wallet display rewards:', error);
      throw error;
    }
  }

  /**
   * Get rewards data formatted for checkout display
   */
  async getCheckoutDisplayRewards(): Promise<CheckoutDisplayRewards> {
    try {
      const response = await fetch(`${this.baseURL}/checkout-display`, {
        method: 'GET',
        headers: await this.getHeaders(),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get checkout display rewards: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting checkout display rewards:', error);
      throw error;
    }
  }

  // ============================================
  // REDEMPTION METHODS
  // ============================================

  /**
   * Redeem rewards for a purchase
   */
  async redeemRewards(
    rewardsAmount: number,
    orderId?: string
  ): Promise<RedemptionResult> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/redeem`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          rewards_amount: rewardsAmount,
          order_id: orderId,
        }),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to redeem rewards: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error redeeming rewards:', error);
      throw error;
    }
  }

  /**
   * Reverse rewards redemption (for cancelled orders)
   */
  async reverseRedemption(
    rewardsAmount: number,
    orderId?: string
  ): Promise<{ success: boolean; reversed_amount: number; display_reversed: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/reverse`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          rewards_amount: rewardsAmount,
          order_id: orderId,
        }),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to reverse redemption: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error reversing redemption:', error);
      throw error;
    }
  }

  // ============================================
  // TRANSACTION HISTORY METHODS
  // ============================================

  /**
   * Get rewards transaction history
   */
  async getRewardsHistory(params?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<RewardsHistoryResponse> {
    try {
      const headers = await this.getHeaders();
      const queryParams = new URLSearchParams();
      
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.type) queryParams.append('type', params.type);

      const response = await fetch(
        `${this.baseURL}/history?${queryParams.toString()}`,
        { 
          method: 'GET',
          headers: headers,
          timeout: API_CONFIG.TIMEOUT,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch rewards history: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching rewards history:', error);
      throw error;
    }
  }

  /**
   * Get display info for rewards transaction type
   */
  getRewardsTransactionTypeDisplay(type: string): { label: string; icon: string; color: string } {
    const types: Record<string, { label: string; icon: string; color: string }> = {
      'monthly_credit': { label: 'Monthly Rewards', icon: 'calendar', color: '#27AE60' },
      'purchase_redemption': { label: 'Redeemed', icon: 'bag', color: '#E74C3C' },
      'refund_reversal': { label: 'Refund', icon: 'return-up-back', color: '#F39C12' },
      'admin_adjustment': { label: 'Adjustment', icon: 'construct', color: '#9B59B6' },
      'expired_deduction': { label: 'Expired', icon: 'time', color: '#95A5A6' }
    };
    
    return types[type] || { label: type, icon: 'help-circle', color: '#95A5A6' };
  }

  // ============================================
  // HELPER METHODS FOR UI
  // ============================================

  /**
   * Format rewards amount for display
   */
  formatRewardsForDisplay(amount: number): string {
    return `⭐ ${Math.floor(amount)}`;
  }

  /**
   * Check if user has sufficient rewards for redemption
   */
  canRedeemAmount(availableRewards: number, requestedAmount: number): boolean {
    return availableRewards >= requestedAmount && requestedAmount > 0;
  }

  /**
   * Calculate maximum redeemable amount for a purchase
   */
  getMaxRedeemableForPurchase(availableRewards: number, purchaseAmount: number): number {
    // Rewards can't exceed the purchase amount (you can't get "change" in rewards)
    return Math.min(availableRewards, purchaseAmount);
  }

  /**
   * Get rewards progress percentage for current month
   */
  getMonthlyProgressPercentage(currentTransactions: number): number {
    // Simple progress indicator - could be based on user's average or targets
    const monthlyTarget = 1000; // Example: ₣1000 monthly transactions for good rewards
    return Math.min(100, (currentTransactions / monthlyTarget) * 100);
  }

  /**
   * Get next rewards credit date (1st of next month)
   */
  getNextCreditDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /**
   * Format next credit date for display
   */
  formatNextCreditDate(): string {
    const nextDate = this.getNextCreditDate();
    return nextDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric' 
    });
  }

  /**
   * Check if it's close to month end (show pending rewards prominently)
   */
  isNearMonthEnd(): boolean {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysUntilMonthEnd = lastDayOfMonth - now.getDate();
    return daysUntilMonthEnd <= 5; // Show prominently in last 5 days
  }

  // ============================================
  // CALCULATION METHODS (for testing/admin)
  // ============================================

  /**
   * Calculate rewards for specific period (testing/admin)
   */
  async calculatePeriodRewards(period: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/calculate/${period}`, {
        method: 'GET',
        headers: headers,
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to calculate period rewards: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calculating period rewards:', error);
      throw error;
    }
  }

  /**
   * Credit calculated rewards to balance (testing/admin)
   */
  async creditPeriodRewards(period: string): Promise<any> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/credit/${period}`, {
        method: 'POST',
        headers: headers,
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to credit period rewards: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error crediting period rewards:', error);
      throw error;
    }
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================
export const rewardsAPI = new RewardsAPIService();
export default rewardsAPI;