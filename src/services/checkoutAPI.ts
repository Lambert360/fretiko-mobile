import { api } from './api';

export interface DeliveryAddress {
  id?: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'wallet';
  name: string;
  description: string;
  icon: string;
  balance?: number;
}

export interface SellerLocation {
  state?: string;
  country?: string;
  city?: string;
}

export interface OrderSummary {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    sellerId: string;
    requiresEscrow: boolean;
    sellerLocation?: SellerLocation | null;
    itemType?: string;
    isOutOfState?: boolean;
    isOutOfCountry?: boolean;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  escrowFee: number;
  total: number;
  hasOutOfStateItems?: boolean;
  hasOutOfCountryItems?: boolean;
}

export interface InterstateCompanyOption {
  companyId: string;
  companyName: string;
  logoUrl?: string;
  basePrice: number;
  perKmRate: number;
  estimatedDeliveryDaysMin: number;
  estimatedDeliveryDaysMax: number;
  isInternational: boolean;
}

export interface CreateOrderRequest {
  deliveryAddress: DeliveryAddress;
  paymentMethodId: string;
  useEscrow: boolean;
  deliveryInstructions?: string;
  directCheckout?: {
    productId: string;
    quantity: number;
  };
  auctionCheckout?: {
    auctionId: string;
  };
  serviceBooking?: {
    serviceId: string;
    scheduledDate: string;
    scheduledTime: string;
    notes?: string;
  };
  selectedRider?: {
    riderId: string;
    riderName: string;
    vehicleType: 'wheelbarrow' | 'bike' | 'car' | 'pickup';
    deliveryPrice: number;
    estimatedArrival: number;
  };
  // Interstate/international delivery via a logistics partner company
  interstateCompany?: {
    companyId: string;
    companyName: string;
    deliveryPrice: number;
    estimatedDeliveryDays: number;
  };
  // NEW: Multi-vendor fields
  riderAssignments?: any[];
  totalRiderFee?: number;
  useRewards?: boolean;
  rewardsAmount?: number;
  // NEW: Selective checkout - product/service IDs to include
  selectedItemIds?: string[];
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  estimatedDelivery: string;
}

class CheckoutAPI {
  // Get checkout summary for cart items
  async getCheckoutSummary(selectedItemIds?: string[]): Promise<OrderSummary> {
    try {
      const params = selectedItemIds && selectedItemIds.length > 0 
        ? { selectedItemIds: selectedItemIds.join(',') } 
        : {};
      const response = await api.get('/checkout/summary', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching checkout summary:', error);
      throw error;
    }
  }

  // Get checkout summary for direct purchase
  async getDirectCheckoutSummary(productId: string, quantity: number): Promise<OrderSummary> {
    try {
      const response = await api.get(`/checkout/summary/direct`, {
        params: { productId, quantity }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching direct checkout summary:', error);
      throw error;
    }
  }

  // Get checkout summary for auction winner
  async getAuctionCheckoutSummary(auctionId: string): Promise<OrderSummary> {
    try {
      const response = await api.get(`/checkout/summary/auction`, {
        params: { auctionId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching auction checkout summary:', error);
      throw error;
    }
  }

  // Get checkout summary for wishlist items
  async getWishlistCheckoutSummary(wishlistItemIds: string[]): Promise<OrderSummary> {
    try {
      const response = await api.get(`/checkout/wishlist-summary`, {
        params: { itemIds: wishlistItemIds.join(',') }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching wishlist checkout summary:', error);
      throw error;
    }
  }

  // Get available payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const response = await api.get('/checkout/payment-methods');
      return response.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      // Return Freti wallet only payment method
      return [
        {
          id: 'wallet',
          type: 'wallet',
          name: 'Freti Wallet',
          description: 'Pay with your Freti wallet balance',
          icon: 'wallet-outline',
          balance: 0,
        },
      ];
    }
  }

  // Get default delivery address
  async getDefaultAddress(): Promise<DeliveryAddress | null> {
    try {
      const response = await api.get('/checkout/address/default');
      return response.data;
    } catch (error) {
      console.error('Error fetching default address:', error);
      return null;
    }
  }

  // Get all delivery addresses
  async getAllAddresses(): Promise<DeliveryAddress[]> {
    try {
      const response = await api.get('/checkout/addresses');
      return response.data;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      throw error;
    }
  }

  // Save delivery address
  async saveAddress(address: DeliveryAddress): Promise<DeliveryAddress> {
    try {
      const response = await api.post('/checkout/address', address);
      return response.data;
    } catch (error) {
      console.error('Error saving address:', error);
      throw error;
    }
  }

  // Update delivery address
  async updateAddress(addressId: string, address: DeliveryAddress): Promise<DeliveryAddress> {
    try {
      const response = await api.put(`/checkout/address/${addressId}`, address);
      return response.data;
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  }

  // Delete delivery address
  async deleteAddress(addressId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/checkout/address/${addressId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  }

  // Set default address
  async setDefaultAddress(addressId: string): Promise<DeliveryAddress> {
    try {
      const response = await api.post(`/checkout/address/${addressId}/set-default`);
      return response.data;
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  }

  // Create order
  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    try {
      const response = await api.post('/checkout/order', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Validate checkout before order creation
  async validateCheckout(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const response = await api.post('/checkout/validate');
      return response.data;
    } catch (error) {
      console.error('Error validating checkout:', error);
      throw error;
    }
  }

  // Calculate escrow fee
  async calculateEscrowFee(amount: number): Promise<number> {
    try {
      const response = await api.get('/checkout/escrow-fee', {
        params: { amount }
      });
      return response.data.fee;
    } catch (error) {
      console.error('Error calculating escrow fee:', error);
      // Default escrow fee calculation (2.5% of order total)
      return Math.max(1, amount * 0.025); // Minimum ₣1.00 or 2.5%
    }
  }

  // Get delivery options and costs
  async getDeliveryOptions(address: Partial<DeliveryAddress>): Promise<Array<{
    id: string;
    name: string;
    description: string;
    cost: number;
    estimatedDays: number;
  }>> {
    try {
      const response = await api.post('/checkout/delivery-options', { address });
      return response.data;
    } catch (error) {
      console.error('Error fetching delivery options:', error);
      // Return default delivery options
      return [
        {
          id: 'standard',
          name: 'Standard Delivery',
          description: '3-5 business days',
          cost: 0,
          estimatedDays: 4,
        },
        {
          id: 'express',
          name: 'Express Delivery',
          description: '1-2 business days',
          cost: 5,
          estimatedDays: 1,
        },
      ];
    }
  }

  // Add service booking to cart (for service scheduling)
  async addServiceBooking(bookingData: {
    serviceId: string;
    scheduledDate?: string;
    scheduledTime?: string;
    notes?: string;
  }): Promise<void> {
    try {
      await api.post('/cart/service', bookingData);
    } catch (error) {
      console.error('Error adding service booking:', error);
      throw error;
    }
  }

  // ========== MULTI-VENDOR CHECKOUT METHODS ==========

  // Preview rider assignments for multi-vendor checkout
  async previewRiderAssignments(previewData: {
    buyerLocation: {
      address: string;
      city: string;
      state: string;
    };
    orderDetails: {
      weight: number;
      itemCount: number;
    };
  }): Promise<any> {
    try {
      const response = await api.post('/checkout/preview-riders', previewData);
      return response.data;
    } catch (error) {
      console.error('Error previewing rider assignments:', error);
      throw error;
    }
  }

  // Create grouped order
  async createGroupedOrder(orderData: CreateOrderRequest): Promise<any> {
    try {
      const response = await api.post('/checkout/grouped-order', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating grouped order:', error);
      throw error;
    }
  }
}

export const checkoutAPI = new CheckoutAPI();