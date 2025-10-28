/**
 * FRETIKO MOBILE - BANK ACCOUNT API SERVICE
 * Handles all API calls related to bank account management
 */

import { API_CONFIG } from '../config/api';
import * as SecureStore from 'expo-secure-store';

export interface BankAccount {
  id: string;
  userId: string;
  accountName: string;
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountType: 'savings' | 'checking' | 'current';
  currency: string;
  isVerified: boolean;
  verificationMethod?: string;
  verifiedAt?: string;
  isDefault: boolean;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  branchName?: string;
  branchCode?: string;
  isActive: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountDto {
  accountName: string;
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountType?: 'savings' | 'checking' | 'current';
  currency?: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  branchName?: string;
  branchCode?: string;
  isDefault?: boolean;
}

export interface UpdateBankAccountDto {
  accountName?: string;
  bankName?: string;
  bankCode?: string;
  accountType?: 'savings' | 'checking' | 'current';
  branchName?: string;
  branchCode?: string;
  isDefault?: boolean;
}

class BankAccountAPIService {
  private baseURL = `${API_CONFIG.BASE_URL}/wallet/bank-accounts`;

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
   * Get all user's bank accounts
   */
  async getBankAccounts(): Promise<BankAccount[]> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bank accounts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      throw error;
    }
  }

  /**
   * Get default bank account
   */
  async getDefaultBankAccount(): Promise<BankAccount | null> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/default`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch default bank account: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching default bank account:', error);
      return null;
    }
  }

  /**
   * Get specific bank account
   */
  async getBankAccount(id: string): Promise<BankAccount> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bank account: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching bank account:', error);
      throw error;
    }
  }

  /**
   * Create new bank account
   */
  async createBankAccount(dto: CreateBankAccountDto): Promise<BankAccount> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create bank account');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating bank account:', error);
      throw error;
    }
  }

  /**
   * Update bank account
   */
  async updateBankAccount(id: string, dto: UpdateBankAccountDto): Promise<BankAccount> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update bank account');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating bank account:', error);
      throw error;
    }
  }

  /**
   * Set default bank account
   */
  async setDefaultBankAccount(id: string): Promise<BankAccount> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/${id}/set-default`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set default bank account');
      }

      return await response.json();
    } catch (error) {
      console.error('Error setting default bank account:', error);
      throw error;
    }
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete bank account');
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting bank account:', error);
      throw error;
    }
  }

  /**
   * Verify bank account
   */
  async verifyBankAccount(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseURL}/${id}/verify`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify bank account');
      }

      return await response.json();
    } catch (error) {
      console.error('Error verifying bank account:', error);
      throw error;
    }
  }
}

export const bankAccountAPI = new BankAccountAPIService();

