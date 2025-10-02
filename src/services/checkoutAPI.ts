import { api } from './api';

export interface DeliveryAddress {
  id?: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
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

export interface OrderSummary {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    sellerId: string;
    requiresEscrow: boolean;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  escrowFee: number;
  total: number;
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
  async getCheckoutSummary(): Promise<OrderSummary> {
    try {
      const response = await api.get('/checkout/summary');
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
    scheduledDate: string;
    scheduledTime: string;
    notes?: string;
  }): Promise<void> {
    try {
      await api.post('/cart/service', bookingData);
    } catch (error) {
      console.error('Error adding service booking:', error);
      throw error;
    }
  }
}

export const checkoutAPI = new CheckoutAPI();