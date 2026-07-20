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
  // Pending escrow balances (locked until release)
  pendingVendorEarnings?: number;
  pendingRiderEarnings?: number;
  totalPendingEarnings?: number;
  // Sales tracking (cumulative revenue)
  totalVendorSales?: number;
  totalRiderEarnings?: number;
  lifetimeRevenue?: number;
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
                   'escrow_release_to_platform' | 'escrow_refund' | 'admin_adjustment' | 
                   'fee_deduction' | 'reward_credit';
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
  paymentLink?: string; // Flutterwave payment link
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawRequest {
  fretiAmount: number;
  bankAccountId: string; // Required: bank account to withdraw to
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
// SALES TRACKING INTERFACES
// ================================

export interface SaleTransaction {
  id: string;
  transactionType: 'vendor_sale' | 'rider_delivery';
  amount: number;
  orderId?: string;
  orderNumber?: string;
  vendorSalesAfter: number;
  riderEarningsAfter: number;
  lifetimeRevenueAfter: number;
  description?: string;
  createdAt: string;
}

export interface SalesHistoryResponse {
  sales: SaleTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface SalesAnalytics {
  summary: {
    totalVendorSales: number;
    totalRiderEarnings: number;
    totalRevenue: number;
    totalTransactions: number;
    averagePerTransaction: number;
    period: string;
    startDate: string;
    endDate: string;
  };
  chartData: Array<{
    period: string;
    vendorSales: number;
    riderEarnings: number;
    totalRevenue: number;
    transactionCount: number;
  }>;
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

  // ✅ NEW: Get pending escrow balances
  getPendingEscrows: async (): Promise<{ vendorAmount: number; riderAmount: number; totalPending: number }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/pending-escrows', { headers });
      console.log('🔒 Pending escrows loaded:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get pending escrows:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get pending escrows');
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

  /**
   * Get real-time exchange rate for deposit
   * Shows users exactly what they'll receive before depositing
   */
  getDepositRate: async (
    localAmount: number,
    localCurrency: string
  ): Promise<{
    localAmount: number;
    localCurrency: string;
    exchangeRate: number;
    usdAmount: number;
    fretiAmount: number;
    message: string;
    usingFallback?: boolean;
    warning?: string | null;
    rateInfo: {
      source: { currency: string; amount: number };
      destination: { currency: string; amount: number };
    };
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/deposit/rate', {
        headers,
        params: {
          localAmount: localAmount.toString(),
          localCurrency: localCurrency,
        },
      });
      console.log('💱 Deposit rate fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get deposit rate:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get exchange rate');
    }
  },

  // ================================
  // WITHDRAWALS
  // ================================

  /**
   * Get real-time exchange rate for withdrawal
   * Shows users exactly what they'll receive in local currency when withdrawing FRETI
   */
  getWithdrawalRate: async (
    fretiAmount: number,
    localCurrency: string
  ): Promise<{
    fretiAmount: number;
    localCurrency: string;
    exchangeRate: number;
    localAmount: number;
    usdAmount: number;
    message: string;
    rateInfo: {
      source: { currency: string; amount: number };
      destination: { currency: string; amount: number };
    };
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/withdraw/rate', {
        headers,
        params: {
          fretiAmount: fretiAmount.toString(),
          localCurrency: localCurrency,
        },
      });
      console.log('💱 Withdrawal rate fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get withdrawal rate:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get withdrawal exchange rate');
    }
  },

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

  getProcessingTime: async (
    currency: string,
    bankCountry?: string
  ): Promise<{
    currency: string;
    bankCountry?: string;
    minDays: number;
    maxDays: number;
    displayText: string;
    message: string;
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/wallet/withdraw/processing-time', {
        headers,
        params: {
          currency,
          bankCountry,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get processing time:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get processing time');
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

  formatFreti: (amount: number | null | undefined): string => {
    // Handle null/undefined values
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₣0.00';
    }
    // Format with commas using toLocaleString
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
    return `₣${formatted}`;
  },

  formatCurrency: (amount: number, currency: string): string => {
    const currencySymbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      NGN: '₦',
      FRETI: '₣',
      CAD: 'C$',
      AUD: 'A$'
    };
    
    const symbol = currencySymbols[currency.toUpperCase()] || currency;
    const decimals = currency.toUpperCase() === 'NGN' ? 0 : 2;
    
    // Format with commas using toLocaleString
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${symbol}${formatted}`;
  },

  getTransactionTypeDisplay: (type: string): { label: string; icon: string; color: string } => {
    const types: Record<string, { label: string; icon: string; color: string }> = {
      'deposit_mint': { label: 'Deposit', icon: 'add-circle', color: '#27AE60' },
      'withdrawal_burn': { label: 'Withdrawal', icon: 'remove-circle', color: '#E74C3C' },
      'purchase_hold': { label: 'Purchase', icon: 'bag', color: '#3498DB' },
      'escrow_release': { label: 'Escrow Released', icon: 'checkmark-circle', color: '#27AE60' },
      'escrow_release_to_platform': { label: 'Dispute Resolved', icon: 'shield-checkmark', color: '#9B59B6' },
      'escrow_refund': { label: 'Refund', icon: 'return-up-back', color: '#F39C12' },
      'admin_adjustment': { label: 'Adjustment', icon: 'construct', color: '#9B59B6' },
      'fee_deduction': { label: 'Fee', icon: 'card', color: '#E67E22' },
      'reward_credit': { label: 'Reward', icon: 'gift', color: '#1ABC9C' }
    };
    
    return types[type] || { label: type, icon: 'help-circle', color: '#95A5A6' };
  },

  // ================================
  // SALES TRACKING
  // ================================

  getSalesHistory: async (params?: {
    type?: 'vendor_sale' | 'rider_delivery';
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<SalesHistoryResponse> => {
    try {
      const headers = await getAuthHeaders();
      const queryParams = new URLSearchParams();
      
      if (params?.type) queryParams.append('type', params.type);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const url = `/wallet/sales-history${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url, { headers });
      
      console.log('💰 Sales history loaded:', response.data?.sales?.length || 0, 'sales');
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get sales history:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get sales history');
    }
  },

  getSalesAnalytics: async (params?: {
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    startDate?: string;
    endDate?: string;
  }): Promise<SalesAnalytics> => {
    try {
      const headers = await getAuthHeaders();
      const queryParams = new URLSearchParams();
      
      if (params?.period) queryParams.append('period', params.period);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const url = `/wallet/sales-analytics${queryParams.toString() ? `?${queryParams}` : ''}`;
      const response = await api.get(url, { headers });
      
      console.log('📊 Sales analytics loaded:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to get sales analytics:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to get sales analytics');
    }
  },

  getSalesTypeDisplay: (type: 'vendor_sale' | 'rider_delivery'): { label: string; icon: string; color: string } => {
    const types = {
      'vendor_sale': { label: 'Vendor Sale', icon: 'storefront', color: '#27AE60' },
      'rider_delivery': { label: 'Delivery Fee', icon: 'bicycle', color: '#3498DB' }
    };
    
    return types[type] || { label: type, icon: 'cash', color: '#95A5A6' };
  },

  // ================================
  // OFFLINE TRANSACTION CACHING
  // ================================

  // Cache pending transaction for offline scenarios
  cachePendingTransaction: async (transaction: {
    id: string;
    type: 'deposit' | 'withdrawal' | 'purchase' | 'sale';
    amount: number;
    currency: string;
    timestamp: string;
    status: 'pending';
    data: any;
  }): Promise<void> => {
    try {
      const cacheKey = `pending_transaction_${transaction.id}`;
      const cacheData = {
        ...transaction,
        cachedAt: new Date().toISOString(),
        syncAttempts: 0
      };
      
      await SecureStore.setItemAsync(cacheKey, JSON.stringify(cacheData));
      console.log(`💾 Transaction cached for offline: ${transaction.id}`);
    } catch (error) {
      console.error('❌ Failed to cache transaction:', error);
    }
  },

  // Get all cached pending transactions
  getCachedTransactions: async (): Promise<any[]> => {
    try {
      const cachedTransactions = [];
      
      // Get all SecureStore keys (limited to transaction keys)
      // Note: SecureStore doesn't have a way to list all keys, so we'll try common patterns
      const patterns = ['pending_transaction_', 'deposit_', 'withdrawal_', 'purchase_', 'sale_'];
      
      for (const pattern of patterns) {
        try {
          // This is a simplified approach - in production, you might want to maintain a key index
          const keys = await SecureStore.getItemAsync('cached_transaction_keys');
          if (keys) {
            const keyList = JSON.parse(keys);
            for (const key of keyList) {
              if (key.startsWith(pattern)) {
                const cached = await SecureStore.getItemAsync(key);
                if (cached) {
                  cachedTransactions.push(JSON.parse(cached));
                }
              }
            }
          }
        } catch (error) {
          // Continue if no keys found
        }
      }
      
      return cachedTransactions;
    } catch (error) {
      console.error('❌ Failed to get cached transactions:', error);
      return [];
    }
  },

  // Sync cached transactions when online
  syncCachedTransactions: async (): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> => {
    const result = { synced: 0, failed: 0, errors: [] as string[] };
    
    try {
      const cachedTransactions = await walletAPI.getCachedTransactions();
      
      for (const transaction of cachedTransactions) {
        try {
          // Check if transaction already exists on server
          const headers = await getAuthHeaders();
          
          if (transaction.type === 'deposit') {
            // Try to complete the deposit
            await api.post('/wallet/complete-deposit', transaction.data, { headers });
          } else if (transaction.type === 'withdrawal') {
            // Try to complete the withdrawal
            await api.post('/wallet/complete-withdrawal', transaction.data, { headers });
          }
          
          // Remove from cache after successful sync
          await SecureStore.deleteItemAsync(`pending_transaction_${transaction.id}`);
          result.synced++;
          
          console.log(`✅ Synced cached transaction: ${transaction.id}`);
        } catch (error: any) {
          result.failed++;
          result.errors.push(`${transaction.id}: ${error.message}`);
          
          // Update sync attempts
          transaction.syncAttempts = (transaction.syncAttempts || 0) + 1;
          
          // Remove from cache if too many failed attempts
          if (transaction.syncAttempts >= 3) {
            await SecureStore.deleteItemAsync(`pending_transaction_${transaction.id}`);
            console.log(`🗑️ Removed failed transaction after 3 attempts: ${transaction.id}`);
          } else {
            // Update cache with new attempt count
            await SecureStore.setItemAsync(
              `pending_transaction_${transaction.id}`, 
              JSON.stringify(transaction)
            );
          }
        }
      }
      
      console.log(`🔄 Sync completed: ${result.synced} synced, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error('❌ Failed to sync cached transactions:', error);
      result.errors.push('Sync process failed');
      return result;
    }
  },

  // Check network connectivity
  isOnline: (): boolean => {
    // Simple connectivity check - in production, use NetInfo or similar
    return navigator.onLine;
  },

  // Auto-sync when coming back online
  autoSyncWhenOnline: async (): Promise<void> => {
    try {
      if (walletAPI.isOnline()) {
        console.log('🌐 Back online - syncing cached transactions...');
        await walletAPI.syncCachedTransactions();
      }
    } catch (error) {
      console.error('❌ Auto-sync failed:', error);
    }
  },

  // Enhanced deposit with offline caching
  createDepositRequestOffline: async (depositData: any): Promise<any> => {
    try {
      // Try online first
      const headers = await getAuthHeaders();
      const response = await api.post('/wallet/deposit', depositData, { headers });
      
      // Cache the deposit for offline tracking
      await walletAPI.cachePendingTransaction({
        id: response.data.depositId || `temp_${Date.now()}`,
        type: 'deposit',
        amount: depositData.fretiAmount || depositData.amount,
        currency: depositData.currency || 'USD',
        timestamp: new Date().toISOString(),
        status: 'pending',
        data: depositData
      });
      
      return response.data;
    } catch (error: any) {
      // If offline, cache for later sync
      if (!walletAPI.isOnline() || error.code === 'NETWORK_ERROR') {
        const tempId = `offline_deposit_${Date.now()}`;
        
        await walletAPI.cachePendingTransaction({
          id: tempId,
          type: 'deposit',
          amount: depositData.fretiAmount || depositData.amount,
          currency: depositData.currency || 'USD',
          timestamp: new Date().toISOString(),
          status: 'pending',
          data: depositData
        });
        
        console.log(`📴 Deposit cached for offline sync: ${tempId}`);
        
        return {
          success: true,
          cached: true,
          message: 'Deposit cached - will sync when online',
          tempId
        };
      }
      
      throw error;
    }
  },

  // Enhanced withdrawal with offline caching
  createWithdrawRequestOffline: async (withdrawData: any): Promise<any> => {
    try {
      // Try online first
      const headers = await getAuthHeaders();
      const response = await api.post('/wallet/withdraw', withdrawData, { headers });
      
      // Cache the withdrawal for offline tracking
      await walletAPI.cachePendingTransaction({
        id: response.data.payoutId || `temp_${Date.now()}`,
        type: 'withdrawal',
        amount: withdrawData.fretiAmount || withdrawData.amount,
        currency: withdrawData.currency || 'USD',
        timestamp: new Date().toISOString(),
        status: 'pending',
        data: withdrawData
      });
      
      return response.data;
    } catch (error: any) {
      // If offline, cache for later sync
      if (!walletAPI.isOnline() || error.code === 'NETWORK_ERROR') {
        const tempId = `offline_withdraw_${Date.now()}`;
        
        await walletAPI.cachePendingTransaction({
          id: tempId,
          type: 'withdrawal',
          amount: withdrawData.fretiAmount || withdrawData.amount,
          currency: withdrawData.currency || 'USD',
          timestamp: new Date().toISOString(),
          status: 'pending',
          data: withdrawData
        });
        
        console.log(`📴 Withdrawal cached for offline sync: ${tempId}`);
        
        return {
          success: true,
          cached: true,
          message: 'Withdrawal cached - will sync when online',
          tempId
        };
      }
      
      throw error;
    }
  }
};