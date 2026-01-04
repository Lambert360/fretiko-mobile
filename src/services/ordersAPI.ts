import { api } from './api';

export interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  total: number;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  itemCount: number;
  orderDate: string;
  estimatedDelivery?: string;
  deliveryAddress?: DeliveryAddress;
  items: OrderItem[];
  source?: 'regular' | 'live_stream' | 'auction' | 'service_booking';
  metadata?: {
    auction_id?: string;
    subtotal?: number;
    tax_amount?: number;
    escrow_fee?: number;
    [key: string]: any;
  };
}

export interface OrderDetails extends Order {
  // Additional fields for detailed view
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  trackingNumber?: string;
  notes?: string;
}

export interface OrderItem {
  id: string;
  productId?: string;
  serviceId?: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  sellerId: string;
  sellerName: string;
  category: string;
  isService: boolean;
  serviceDate?: string;
  serviceTime?: string;
}

export interface DeliveryAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  timestamp: string;
  location?: string;
  isCompleted: boolean;
}

export interface OrderFilters {
  status?: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  minAmount?: number;
  maxAmount?: number;
}

class OrdersAPI {
  // Get user's orders with optional filtering
  async getMyOrders(filters?: OrderFilters): Promise<Order[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.status?.length) {
        params.append('status', filters.status.join(','));
      }
      if (filters?.dateRange) {
        params.append('startDate', filters.dateRange.startDate);
        params.append('endDate', filters.dateRange.endDate);
      }
      if (filters?.minAmount) {
        params.append('minAmount', filters.minAmount.toString());
      }
      if (filters?.maxAmount) {
        params.append('maxAmount', filters.maxAmount.toString());
      }

      const response = await api.get(`/orders?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  // Get detailed information for a specific order
  async getOrderDetails(orderId: string): Promise<OrderDetails> {
    try {
      const response = await api.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  // Get basic order information (alias for getOrderDetails for compatibility)
  async getOrder(orderId: string): Promise<OrderDetails> {
    return this.getOrderDetails(orderId);
  }

  // Get tracking information for an order
  async getOrderTracking(orderId: string): Promise<TrackingEvent[]> {
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      return response.data;
    } catch (error) {
      console.error('Error fetching order tracking:', error);
      throw error;
    }
  }

  // Cancel an order (if allowed)
  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    try {
      await api.post(`/orders/${orderId}/cancel`, { reason });
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // Request order refund
  async requestRefund(orderId: string, reason: string): Promise<void> {
    try {
      await api.post(`/orders/${orderId}/refund`, { reason });
    } catch (error) {
      console.error('Error requesting refund:', error);
      throw error;
    }
  }

  // Rate an order item
  async rateOrderItem(orderId: string, itemId: string, rating: number, review?: string): Promise<void> {
    try {
      await api.post(`/orders/${orderId}/items/${itemId}/rate`, { rating, review });
    } catch (error) {
      console.error('Error rating order item:', error);
      throw error;
    }
  }

  // Get order statistics
  async getOrderStats(): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    totalSpent: number;
  }> {
    try {
      const response = await api.get('/orders/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching order stats:', error);
      throw error;
    }
  }

  // Search orders
  async searchOrders(query: string): Promise<Order[]> {
    try {
      const response = await api.get(`/orders/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching orders:', error);
      throw error;
    }
  }

  // Get order invoice/receipt
  async getOrderInvoice(orderId: string): Promise<{
    invoiceUrl: string;
    invoiceNumber: string;
  }> {
    try {
      const response = await api.get(`/orders/${orderId}/invoice`);
      return response.data;
    } catch (error) {
      console.error('Error fetching order invoice:', error);
      throw error;
    }
  }

  // Get order tracking data (real-time location, rider info, etc.)
  async getOrderTrackingData(orderId: string): Promise<any> {
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      return response.data;
    } catch (error) {
      console.error('Error fetching order tracking data:', error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  // Confirm order received (buyer action)
  async confirmOrderReceived(orderId: string): Promise<void> {
    try {
      await api.post(`/orders/${orderId}/confirm-received`);
    } catch (error) {
      console.error('Error confirming order received:', error);
      throw error;
    }
  }

  // Auto-release escrow (system action)
  async autoReleaseEscrow(orderId: string): Promise<void> {
    try {
      await api.post(`/orders/${orderId}/auto-release-escrow`);
    } catch (error) {
      console.error('Error auto-releasing escrow:', error);
      throw error;
    }
  }

  // ✅ Buyer confirms and releases funds immediately (no 24-hour wait)
  async confirmAndReleaseFunds(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/orders/${orderId}/release-funds`);
      return response.data;
    } catch (error) {
      console.error('Error releasing funds:', error);
      throw error;
    }
  }

  // ✅ Buyer reports issue with order (stops escrow, gets refund minus rider fee)
  async reportIssue(orderId: string, reason: string, description?: string): Promise<{ success: boolean; message: string; refundAmount: number }> {
    try {
      const response = await api.post(`/orders/${orderId}/report-issue`, {
        reason,
        description,
      });
      return response.data;
    } catch (error) {
      console.error('Error reporting issue:', error);
      throw error;
    }
  }

  // Report order issue (legacy method - keeping for backwards compatibility)
  async reportOrderIssue(orderId: string, issue: {
    type: 'delivery' | 'quality' | 'missing_items' | 'damaged' | 'other';
    description: string;
    images?: string[];
  }): Promise<void> {
    try {
      await api.post(`/orders/${orderId}/report`, issue);
    } catch (error) {
      console.error('Error reporting order issue:', error);
      throw error;
    }
  }

  // Reorder items from previous order
  async reorderItems(orderId: string, itemIds?: string[]): Promise<{
    cartId: string;
    addedItems: number;
    failedItems: string[];
  }> {
    try {
      const response = await api.post(`/orders/${orderId}/reorder`, { itemIds });
      return response.data;
    } catch (error) {
      console.error('Error reordering items:', error);
      throw error;
    }
  }


  // ========== MULTI-VENDOR ORDER GROUP METHODS ==========

  // Get order group details
  async getOrderGroup(orderGroupId: string): Promise<{
    group: any;
    orders: any[];
  }> {
    try {
      const response = await api.get(`/orders/group/${orderGroupId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching order group:', error);
      throw error;
    }
  }

  // Confirm multiple orders (bulk)
  async confirmMultipleOrders(orderIds: string[]): Promise<{ success: boolean; confirmed: number }> {
    try {
      const response = await api.post('/orders/confirm-multiple', { orderIds });
      return response.data;
    } catch (error) {
      console.error('Error confirming multiple orders:', error);
      throw error;
    }
  }
}

export const ordersAPI = new OrdersAPI();