import { api } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface Product {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  condition: string;
  images: string[];
  primary_image_url?: string;
  videos?: string[];
  primary_video_url?: string;
  media_type?: 'image' | 'video';
  location?: string;
  shipping_options: {
    pickup: boolean;
    delivery: boolean;
    shipping: boolean;
  };
  tags: string[];
  status: string;
  is_featured: boolean;
  view_count: number;
  like_count: number;
  save_count: number;
  average_rating?: number;
  review_count?: number;
  created_at: string;
  updated_at: string;
  vendor_username?: string;
  vendor_avatar?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  icon_name?: string;
  color_hex?: string;
  sort_order: number;
  is_active: boolean;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  quantity: number;
  condition: string;
  category_id: string;
  images: string[];
  location?: string;
  shipping_options: {
    pickup: boolean;
    delivery: boolean;
    shipping: boolean;
  };
  tags: string[];
}

export interface ProductReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
  helpful: number;
}

export interface CreateReviewRequest {
  productId: string;
  rating: number;
  comment: string;
}


export interface AddToCartRequest {
  productId: string;
  quantity: number;
  price: number;
}

export interface AddToWishlistRequest {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
}

class ProductsAPI {
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private cache = new Map<string, { data: any; timestamp: number }>();

  // Cache management
  private async cacheGet(key: string): Promise<any> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    // Try AsyncStorage for persistent cache
    try {
      const stored = await AsyncStorage.getItem(`api_cache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < this.cacheTimeout) {
          this.cache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
    
    return null;
  }

  private async cacheSet(key: string, data: any): Promise<void> {
    const cacheItem = { data, timestamp: Date.now() };
    this.cache.set(key, cacheItem);
    
    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem(`api_cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }

  // Enhanced error handling
  private handleError(error: any, fallbackMessage: string, showAlert: boolean = false): never {
    let errorMessage = fallbackMessage;
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error(fallbackMessage, error);
    
    if (showAlert) {
      Alert.alert('Error', errorMessage);
    }
    
    throw new Error(errorMessage);
  }

  // Get all product categories with caching and fallback
  async getCategories(): Promise<ProductCategory[]> {
    const cacheKey = 'product_categories';
    
    try {
      // Check cache first
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        console.log('📦 Using cached product categories');
        return cached;
      }

      console.log('🌐 Fetching product categories from API');
      let response;
      
      // Try different possible endpoints
      try {
        response = await api.get('/products/categories', { timeout: 8000 });
      } catch (firstError) {
        console.log('🔄 Trying alternative endpoint /api/products/categories');
        try {
          response = await api.get('/api/products/categories', { timeout: 8000 });
        } catch (secondError) {
          console.log('🔄 Trying alternative endpoint /categories/products');
          response = await api.get('/categories/products', { timeout: 8000 });
        }
      }
      
      await this.cacheSet(cacheKey, response.data);
      return response.data;
    } catch (error) {
      // Try to return cached data as fallback
      const fallbackData = await this.cacheGet(cacheKey);
      if (fallbackData) {
        console.log('🔄 Using stale cache as fallback for product categories');
        return fallbackData;
      }
      
      // No fallback to mock data - throw error for real database requirement
      throw new Error('Unable to fetch product categories from database');
    }
  }


  // Create a new product
  async createProduct(productData: CreateProductRequest): Promise<Product> {
    try {
      const response = await api.post('/products', productData);
      return response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Get products by user
  async getMyProducts(): Promise<Product[]> {
    try {
      const response = await api.get('/products/my-products');
      return response.data;
    } catch (error) {
      console.error('Error fetching my products:', error);
      throw error;
    }
  }

  // Get public products by user ID (for viewing other users' products)
  async getUserProducts(userId: string): Promise<Product[]> {
    try {
      const response = await api.get(`/products/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user products:', error);
      throw error;
    }
  }

  // Get all active products (for browsing) with caching and fallback
  async getProducts(params?: {
    category_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Product[]> {
    const cacheKey = `products_${JSON.stringify(params || {})}`;
    
    try {
      // Check cache first
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        console.log('📦 Using cached products');
        return cached;
      }

      console.log('🛍️ Fetching products from API');
      let response;
      
      // Try different possible endpoints
      try {
        response = await api.get('/products', { params, timeout: 8000 });
      } catch (firstError) {
        console.log('🔄 Trying alternative endpoint /api/products');
        try {
          response = await api.get('/api/products', { params, timeout: 8000 });
        } catch (secondError) {
          console.log('🔄 Trying alternative endpoint /products/all');
          response = await api.get('/products/all', { params, timeout: 8000 });
        }
      }
      
      await this.cacheSet(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.warn('All product API endpoints failed, trying cache...', error.message);
      
      // Try cache as fallback
      const cached = await this.cacheGet(cacheKey);
      if (cached) {
        console.log('📦 Using cached products');
        return cached;
      }
      
      // No fallback to mock data - throw error for real database requirement
      throw new Error('Unable to fetch products from database');
    }
  }


  // Get single product
  async getProduct(id: string): Promise<Product> {
    try {
      const response = await api.get(`/products/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  // Update product
  async updateProduct(id: string, productData: Partial<CreateProductRequest>): Promise<Product> {
    try {
      const response = await api.put(`/products/${id}`, productData);
      return response.data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    try {
      await api.delete(`/products/${id}`);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Get product reviews
  async getProductReviews(productId: string): Promise<ProductReview[]> {
    try {
      const response = await api.get(`/products/${productId}/reviews`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product reviews:', error);
      throw error;
    }
  }

  // Add product review
  async addProductReview(reviewData: CreateReviewRequest): Promise<ProductReview> {
    try {
      const response = await api.post(`/products/${reviewData.productId}/reviews`, {
        rating: reviewData.rating,
        comment: reviewData.comment,
      });
      return response.data;
    } catch (error) {
      console.error('Error adding product review:', error);
      throw error;
    }
  }

  // Add to cart
  async addToCart(cartData: AddToCartRequest): Promise<void> {
    try {
      await api.post('/cart', cartData);
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

}

export const productsAPI = new ProductsAPI();