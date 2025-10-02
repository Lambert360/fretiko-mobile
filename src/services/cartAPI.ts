import { api } from './api';

export interface CartItem {
  id: string;
  productId?: string;
  serviceId?: string;
  productName: string;
  productImage: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  maxQuantity: number;
  sellerId: string;
  sellerName: string;
  category: string;
  discount?: number;
  serviceDate?: string;
  serviceTime?: string;
  serviceNotes?: string;
  createdAt: string;
}

export interface CartSummary {
  itemsCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface AddToCartRequest {
  productId: string;
  quantity: number;
  price: number;
}

class CartAPI {
  // Get cart items for the current user
  async getCartItems(): Promise<CartItem[]> {
    try {
      const response = await api.get('/cart');
      return response.data;
    } catch (error) {
      console.error('Error fetching cart items:', error);
      throw error;
    }
  }

  // Get cart summary (totals, counts, etc.)
  async getCartSummary(): Promise<CartSummary> {
    try {
      const response = await api.get('/cart/summary');
      return response.data;
    } catch (error) {
      console.error('Error fetching cart summary:', error);
      throw error;
    }
  }

  // Add item to cart
  async addToCart(cartData: AddToCartRequest): Promise<void> {
    try {
      await api.post('/cart', cartData);
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  }

  // Update item quantity in cart
  async updateQuantity(itemId: string, quantity: number): Promise<void> {
    try {
      await api.put(`/cart/${itemId}`, { quantity });
    } catch (error) {
      console.error('Error updating cart quantity:', error);
      throw error;
    }
  }

  // Remove item from cart
  async removeItem(itemId: string): Promise<void> {
    try {
      await api.delete(`/cart/${itemId}`);
    } catch (error) {
      console.error('Error removing cart item:', error);
      throw error;
    }
  }

  // Alias for removeItem (used by CartContext)
  async removeFromCart(itemId: string): Promise<void> {
    return this.removeItem(itemId);
  }

  // Update cart item (used by CartContext)
  async updateCartItem(itemId: string, updates: { quantity: number }): Promise<void> {
    return this.updateQuantity(itemId, updates.quantity);
  }

  // Clear entire cart
  async clearCart(): Promise<void> {
    try {
      await api.delete('/cart');
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  // Get cart items count (for badges)
  async getCartCount(): Promise<number> {
    try {
      const response = await api.get('/cart/count');
      return response.data.count;
    } catch (error) {
      console.error('Error fetching cart count:', error);
      return 0;
    }
  }

  // Validate cart before checkout
  async validateCart(): Promise<{
    valid: boolean;
    errors: string[];
    unavailableItems: string[];
  }> {
    try {
      const response = await api.post('/cart/validate');
      return response.data;
    } catch (error) {
      console.error('Error validating cart:', error);
      throw error;
    }
  }
}

export const cartAPI = new CartAPI();