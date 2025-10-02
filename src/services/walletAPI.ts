import { api } from './api';
import { API_CONFIG } from '../config/api';
import * as SecureStore from 'expo-secure-store';

// ================================
// WALLET INTERFACES
// ================================

export interface Wallet {
  id: string;
  userId: string;
  availableBalance: number;
  escrowBalance: number;
  pendingWithdrawal: number;
  preferredCurrency: string;
  kycStatus: 'pending' | 'approved' | 'rejected';
  dailyDepositLimit: number;
  dailyWithdrawalLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletStats {
  totalBalance: number;
  availableBalance: number;
  escrowBalance: number;
  pendingWithdrawal: number;
  localCurrencyEquivalent: {
    currency: string;
    available: number;
    total: number;
    escrow: number;
    pending: number;
  };
  recentTransactionCount: number;
  monthlySpending: number;
  monthlyDeposits: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  transactionType: 'deposit_mint' | 'withdrawal_burn' | 'purchase_hold' | 'escrow_release' | 
                   'escrow_refund' | 'admin_adjustment' | 'fee_deduction' | 'reward_credit';
  availableDelta: number;
  escrowDelta: number;
  pendingWithdrawalDelta: number;
  availableBalanceAfter: number;
  escrowBalanceAfter: number;
  pendingWithdrawalAfter: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: any;
  createdAt: string;
}

export interface DepositRequest {
  fretiAmount: number;
  localAmount?: number;
  localCurrency?: string;
  idempotencyKey?: string;
}

export interface DepositResponse {
  id: string;
  userId: string;
  fretiAmount: number;
  localAmount: number;
  localCurrency: string;
  exchangeRate?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  externalPaymentId?: string;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawRequest {
  fretiAmount: number;
  localCurrency?: string;
  idempotencyKey?: string;
}

export interface WithdrawResponse {
  id: string;
  userId: string;
  fretiAmount: number;
  estimatedLocalAmount?: number;
  localCurrency: string;
  status: 'requested' | 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  externalPayoutId?: string;
  requestedAt: string;
  processedAt?: string;
  paidAt?: string;
  failureReason?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EscrowBypassCheck {
  vendorId: string;
  riderId?: string;
  orderAmount: number;
  category?: string;
}

export interface EscrowBypassResponse {
  canBypass: boolean;
  reason: string;
  vendorTrusted: boolean;
  riderTrusted: boolean;
  buyerEligible: boolean;
  riskFlags: string[];
}

export interface CurrencyConversion {
  originalAmount: number;
  convertedAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
}

export interface WalletLimits {
  dailyDepositLimit: number;
  dailyWithdrawalLimit: number;
  remainingDepositLimit: number;
  remainingWithdrawalLimit: number;
  kycStatus: string;
}

// ================================
// AUTH HELPER
// ================================

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('accessToken');
  console.log('🔑 Wallet API token:', token ? `Present (${token.substring(0, 20)}...)` : 'Missing');
  
  return token ? { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  } : { 'Content-Type': 'application/json' };
};

// ================================
// WALLET API SERVICE
// ================================

export const walletAPI = {
  
  // ================================
  // WALLET INFO
  // ================================
  
  getWallet: async (): Promise<Wallet> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet', { headers });
      console.log('💰 Wallet info loaded:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get wallet:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get wallet information');
    }
  },

  getWalletStats: async (): Promise<WalletStats> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/stats', { headers });
      console.log('📊 Wallet stats loaded:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get wallet stats:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get wallet statistics');
    }
  },

  getBalance: async (): Promise<{
    availableBalance: number;
    escrowBalance: number;
    pendingWithdrawal: number;
    totalBalance: number;
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/balance', { headers });
      console.log('💎 Balance loaded:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get balance:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get wallet balance');
    }
  },

  // ================================
  // DEPOSITS
  // ================================

  createDeposit: async (depositRequest: DepositRequest): Promise<DepositResponse> => {
    try {
      const headers = await getAuthHeaders();
      console.log('💰 Creating deposit:', depositRequest);
      
      const response = await api.post('/wallet/deposit', depositRequest, { headers });
      console.log('✅ Deposit created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to create deposit:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create deposit');
    }
  },

  getDeposits: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<DepositResponse[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/deposits', { headers, params });
      console.log('📥 Deposits loaded:', response.data?.length || 0, 'items');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get deposits:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get deposit history');
    }
  },

  // ================================
  // WITHDRAWALS
  // ================================

  createWithdrawal: async (withdrawRequest: WithdrawRequest): Promise<WithdrawResponse> => {
    try {
      const headers = await getAuthHeaders();
      console.log('💸 Creating withdrawal:', withdrawRequest);
      
      const response = await api.post('/wallet/withdraw', withdrawRequest, { headers });
      console.log('✅ Withdrawal created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to create withdrawal:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create withdrawal');
    }
  },

  getWithdrawals: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<WithdrawResponse[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/withdrawals', { headers, params });
      console.log('📤 Withdrawals loaded:', response.data?.length || 0, 'items');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get withdrawals:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get withdrawal history');
    }
  },

  // ================================
  // TRANSACTION HISTORY
  // ================================

  getTransactionHistory: async (params?: {
    type?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<WalletTransaction[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/transactions', { headers, params });
      console.log('📋 Transaction history loaded:', response.data?.length || 0, 'transactions');
      return response.data || [];
    } catch (error: any) {
      console.error('❌ Failed to get transaction history:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get transaction history');
    }
  },

  getTransactionSummary: async (): Promise<{
    totalTransactions: number;
    monthlyDeposits: number;
    monthlyWithdrawals: number;
    monthlySpending: number;
    lastTransactionDate: string;
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/transactions/summary', { headers });
      console.log('📊 Transaction summary loaded:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get transaction summary:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get transaction summary');
    }
  },

  // ================================
  // ESCROW & TRUST
  // ================================

  checkEscrowBypass: async (check: EscrowBypassCheck): Promise<EscrowBypassResponse> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.post('/wallet/escrow/check-bypass', check, { headers });
      console.log('🔒 Escrow bypass check:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to check escrow bypass:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to check escrow bypass eligibility');
    }
  },

  // ================================
  // UTILITIES
  // ================================

  convertCurrency: async (
    amount: number, 
    fromCurrency: string, 
    toCurrency: string
  ): Promise<CurrencyConversion> => {
    try {
      const response = await api.get(`/wallet/convert/${amount}/${fromCurrency}/${toCurrency}`);
      console.log('💱 Currency conversion:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to convert currency:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to convert currency');
    }
  },

  getWalletLimits: async (): Promise<WalletLimits> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/limits', { headers });
      console.log('🎯 Wallet limits loaded:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get wallet limits:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get wallet limits');
    }
  },

  // ================================
  // HELPER FUNCTIONS
  // ================================

  formatFreti: (amount: number): string => {
    return `₣${amount.toFixed(6).replace(/\.?0+$/, '')}`;
  },

  formatCurrency: (amount: number, currency: string): string => {
    const currencySymbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      NGN: '₦',
      FRETI: '₣'
    };
    
    const symbol = currencySymbols[currency.toUpperCase()] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  },

  getTransactionTypeDisplay: (type: string): { label: string; icon: string; color: string } => {
    const types: Record<string, { label: string; icon: string; color: string }> = {
      'deposit_mint': { label: 'Deposit', icon: 'add-circle', color: '#27AE60' },
      'withdrawal_burn': { label: 'Withdrawal', icon: 'remove-circle', color: '#E74C3C' },
      'purchase_hold': { label: 'Purchase', icon: 'bag', color: '#3498DB' },
      'escrow_release': { label: 'Escrow Released', icon: 'checkmark-circle', color: '#27AE60' },
      'escrow_refund': { label: 'Refund', icon: 'return-up-back', color: '#F39C12' },
      'admin_adjustment': { label: 'Adjustment', icon: 'construct', color: '#9B59B6' },
      'fee_deduction': { label: 'Fee', icon: 'card', color: '#E67E22' },
      'reward_credit': { label: 'Reward', icon: 'gift', color: '#1ABC9C' }
    };
    
    return types[type] || { label: type, icon: 'help-circle', color: '#95A5A6' };
  }
};