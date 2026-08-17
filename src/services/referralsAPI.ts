import { api } from './api';

export interface ReferralStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_clicks: number;
  total_rewards: number;
}

export interface ReferralData {
  code: string;
  url: string;
  stats: ReferralStats;
}

export interface ReferralHistoryItem {
  id: string;
  referrer_id: string;
  referred_user_id: string | null;
  referral_code: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  click_count: number;
  signup_attempts: number;
  reward_amount: number;
  reward_paid: boolean;
  created_at: string;
  completed_at: string | null;
  first_click_at: string | null;
  metadata: Record<string, any>;
  referred_user?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

const referralsAPI = {
  /**
   * Get current user's referral data (code, URL, stats)
   */
  getMyReferralData: async (): Promise<ReferralData> => {
    const response = await api.get('/referrals/me');
    return response.data;
  },

  /**
   * Validate a referral code (for signup flow)
   */
  validateReferralCode: async (code: string): Promise<{ valid: boolean; referrerId?: string }> => {
    const response = await api.post('/referrals/validate', { code });
    return response.data;
  },

  /**
   * Track a referral click
   */
  trackReferralClick: async (code: string): Promise<{ success: boolean; referrerId?: string }> => {
    const response = await api.post('/referrals/track-click', { code });
    return response.data;
  },

  /**
   * Complete referral when user signs up
   */
  completeReferral: async (referralCode: string): Promise<{ success: boolean }> => {
    const response = await api.post('/referrals/complete', { referralCode });
    return response.data;
  },

  /**
   * Get referral history for current user
   */
  getReferralHistory: async (): Promise<ReferralHistoryItem[]> => {
    const response = await api.get('/referrals/history');
    return response.data;
  },
};

export default referralsAPI;
