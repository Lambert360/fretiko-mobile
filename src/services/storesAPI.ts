import { API_BASE_URL } from '../config/api';

export interface VerifiedStore {
  id: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  is_verified: boolean;
  is_seller: boolean;
  store_rating?: number;
  product_count?: number;
  service_count?: number;
  created_at: string;
}

export interface StoreStats {
  total_products: number;
  total_services: number;
  average_rating: number;
  total_sales: number;
}

export interface StorePaginationResponse {
  stores: VerifiedStore[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface StoreSearchResponse {
  stores: VerifiedStore[];
  query: string;
  pagination: {
    limit: number;
    offset: number;
  };
}

export interface StoreCategoryResponse {
  stores: VerifiedStore[];
  category: string;
  pagination: {
    limit: number;
    offset: number;
  };
}

class StoresAPI {
  private getAuthHeaders(): Record<string, string> {
    // TODO: Implement auth token retrieval
    // For now returning empty headers - will be implemented when auth context is integrated
    return {};
  }

  /**
   * Get all verified stores with pagination
   */
  async getVerifiedStores(
    limit: number = 50,
    offset: number = 0
  ): Promise<StorePaginationResponse> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/stores/verified?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching verified stores:', error);
      throw error;
    }
  }

  /**
   * Get a specific store by ID
   */
  async getStoreById(storeId: string): Promise<VerifiedStore | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/stores/${storeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching store by ID:', error);
      throw error;
    }
  }

  /**
   * Search verified stores by name or bio
   */
  async searchVerifiedStores(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<StoreSearchResponse> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `${API_BASE_URL}/stores/search?q=${encodedQuery}&limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching verified stores:', error);
      throw error;
    }
  }

  /**
   * Get stores by category
   */
  async getStoresByCategory(
    categoryName: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<StoreCategoryResponse> {
    try {
      const encodedCategory = encodeURIComponent(categoryName);
      const response = await fetch(
        `${API_BASE_URL}/stores/category/${encodedCategory}?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching stores by category:', error);
      throw error;
    }
  }

  /**
   * Get store statistics
   */
  async getStoreStats(storeId: string): Promise<StoreStats & { store_id: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/stores/${storeId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching store stats:', error);
      throw error;
    }
  }

  /**
   * Get verified stores count
   */
  async getVerifiedStoresCount(): Promise<{ count: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/stores/verified/count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching verified stores count:', error);
      throw error;
    }
  }
}

export const storesAPI = new StoresAPI();