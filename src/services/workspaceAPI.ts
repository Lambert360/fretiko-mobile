import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

export interface WorkspaceOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'cancelled';
  customerName: string;
  customerId: string;
  customerPhone?: string;
  itemCount: number;
  total: number;
  deliveryAddress: string;
  deliveryFee: number;
  deliveryType?: 'pickup' | 'delivery'; // ✅ Add deliveryType
  deliveryInstructions?: string; // Optional buyer instructions (when provided)
  riderId?: string | null; // ✅ Add riderId
  createdAt: string;
  updatedAt: string;
  estimatedPreparationTime?: number; // in minutes
  items: WorkspaceOrderItem[];
  notes?: string;
  source?: 'regular' | 'live_stream' | 'auction' | 'service_booking'; // Order source
  metadata?: {
    [key: string]: any;
    serviceBooking?: {
      serviceId?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      notes?: string;
    };
  };
}

export interface WorkspaceOrderItem {
  id: string;
  productId?: string;
  serviceId?: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  category: string;
  isService: boolean;
  notes?: string;
  // Service booking fields (for service_booking orders)
  serviceDate?: string;
  serviceTime?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

export interface WorkspaceStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  processingOrders: number;
  readyForPickupOrders: number;
  completedToday: number;
  averagePreparationTime: number; // in minutes
  customerRating: number;
  // Live streaming analytics integration
  liveStreamStats: {
    todayLiveOrders: number;
    todayLiveRevenue: number;
    liveOrdersPercentage: number;
    averageLiveOrderValue: number;
    activeLiveStreams: number;
    totalLiveStreamTime: number; // in minutes
  };
  ordersBySource: {
    regular: number;
    live_stream: number;
    auction: number;
    service_booking: number;
  };
  revenueBySource: {
    regular: number;
    live_stream: number;
    auction: number;
    service_booking: number;
  };
  // Escrow metrics (pending earnings)
  escrowMetrics?: {
    totalInEscrow: number; // Total funds held in escrow (vendor)
    riderInEscrow: number; // Total delivery fees held in escrow (rider)
    pendingRelease: number; // Funds releasing within 24 hours
    releasedToday: number; // Funds released today
    escrowCount: number; // Number of active escrows
  };
}

export interface WorkspaceLiveStreamAnalytics {
  period: 'today' | 'week' | 'month';
  totalLiveOrders: number;
  totalLiveRevenue: number;
  averageLiveOrderValue: number;
  liveOrdersGrowth: number;
  liveRevenueGrowth: number;
  topPerformingStreams: Array<{
    streamId: string;
    streamTitle: string;
    orderCount: number;
    revenue: number;
    date: string;
  }>;
  hourlyPerformance: Array<{
    hour: number;
    orderCount: number;
    revenue: number;
  }>;
  conversionMetrics: {
    viewersToOrders: number;
    averageOrdersPerStream: number;
    repeatCustomerRate: number;
  };
}

// Get authentication headers
const getAuthHeaders = async () => {
  try {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) {
      throw new Error('User not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw new Error('User not authenticated');
  }
};

class WorkspaceAPI {
  /**
   * Get active orders for vendor/rider workspace
   */
  async getActiveOrders(): Promise<WorkspaceOrder[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/active`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch active orders: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get active orders error:', error);
      throw error;
    }
  }

  /**
   * Get completed orders for vendor/rider workspace
   */
  async getCompletedOrders(limit = 50, offset = 0): Promise<WorkspaceOrder[]> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', offset.toString());

      const response = await fetch(`${API_BASE_URL}/workspace/orders/completed?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch completed orders: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get completed orders error:', error);
      throw error;
    }
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(): Promise<WorkspaceStats> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/stats`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch workspace stats: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get workspace stats error:', error);
      throw error;
    }
  }

  /**
   * Accept an order (vendor action)
   */
  async acceptOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/accept`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to accept order: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Accept order error:', error);
      throw error;
    }
  }

  /**
   * Decline an order (vendor action)
   */
  async declineOrder(orderId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/decline`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to decline order: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Decline order error:', error);
      throw error;
    }
  }

  /**
   * Mark order as ready for pickup (vendor action - rider delivery)
   */
  async markOrderReady(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/ready`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to mark order ready: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking order ready:', error);
      throw error;
    }
  }

  /**
   * Mark self-pickup order as ready (vendor action - no rider)
   */
  async markOrderReadyForPickup(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/ready-for-pickup`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to mark order ready for pickup: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking order ready for pickup:', error);
      throw error;
    }
  }

  async confirmPickupWithPin(orderId: string, pickupPin: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/confirm-pickup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pickupPin }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to confirm pickup: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Mark order ready error:', error);
      throw error;
    }
  }

  async confirmSelfPickupWithPin(orderId: string, deliveryPin: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/confirm-self-pickup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deliveryPin }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to confirm self-pickup: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Confirm self-pickup error:', error);
      throw error;
    }
  }

  /**
   * Confirm order pickup (rider action)
   */
  async confirmPickup(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/pickup`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to confirm pickup: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Confirm pickup error:', error);
      throw error;
    }
  }

  /**
   * Mark order as delivered (rider action)
   */
  async markDelivered(orderId: string, deliveryPin: string): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/delivered`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deliveryPin }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to mark delivered: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Mark delivered error:', error);
      throw error;
    }
  }

  /**
   * Get detailed order information for vendor/rider
   */
  async getOrderDetails(orderId: string): Promise<WorkspaceOrder & {
    customer: {
      id: string;
      name: string;
      phone: string;
      email?: string;
      avatar?: string;
    };
    deliveryDetails: {
      address: string;
      coordinates?: { latitude: number; longitude: number };
      instructions?: string;
    };
    vendorLocation?: {
      address: string;
      coordinates?: { latitude: number; longitude: number };
    };
    vendorInfo?: {
      id: string;
      name: string;
      phone?: string | null;
      avatar?: string | null;
    };
    riderInfo?: {
      id: string;
      name: string;
      phone?: string | null;
      avatar?: string | null;
    };
    riderLocation?: {
      latitude: number;
      longitude: number;
      timestamp: string;
    };
    timeline: Array<{
      status: string;
      timestamp: string;
      note?: string;
    }>;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch order details: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get order details error:', error);
      throw error;
    }
  }

  /**
   * Update order preparation time estimate
   */
  async updatePreparationTime(orderId: string, estimatedMinutes: number): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/prep-time`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ estimatedMinutes }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update preparation time: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update preparation time error:', error);
      throw error;
    }
  }

  /**
   * Add notes to an order
   */
  async addOrderNotes(orderId: string, notes: string): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to add order notes: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Add order notes error:', error);
      throw error;
    }
  }

  /**
   * Get orders by status (for filtering)
   */
  async getOrdersByStatus(status: string): Promise<WorkspaceOrder[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/status/${status}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch orders by status: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get orders by status error:', error);
      throw error;
    }
  }

  /**
   * Get orders by source (regular, live_stream, auction, service_booking)
   */
  async getOrdersBySource(source: 'regular' | 'live_stream' | 'auction' | 'service_booking'): Promise<WorkspaceOrder[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/source/${source}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch orders by source: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get orders by source error:', error);
      throw error;
    }
  }

  /**
   * Get live streaming analytics for workspace
   */
  async getLiveStreamAnalytics(period: 'today' | 'week' | 'month' = 'today'): Promise<WorkspaceLiveStreamAnalytics> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/analytics/live-streaming?period=${period}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch live stream analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get live stream analytics error:', error);
      throw error;
    }
  }

  /**
   * Get orders analytics comparison by source
   */
  async getOrdersAnalyticsBySource(period: 'today' | 'week' | 'month' = 'today'): Promise<{
    period: string;
    totalOrders: number;
    totalRevenue: number;
    sourceBreakdown: Array<{
      source: string;
      orderCount: number;
      revenue: number;
      percentage: number;
      averageOrderValue: number;
    }>;
    trends: {
      regularGrowth: number;
      liveStreamGrowth: number;
      auctionGrowth: number;
      serviceGrowth: number;
    };
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/analytics/orders-by-source?period=${period}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch orders analytics by source: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get orders analytics by source error:', error);
      throw error;
    }
  }

  /**
   * Get real-time workspace metrics (includes live streaming)
   */
  async getRealTimeWorkspaceMetrics(): Promise<{
    activeOrders: number;
    processingOrders: number;
    readyForPickup: number;
    outForDelivery: number;
    todayRevenue: number;
    activeLiveStreams: number;
    currentLiveViewers: number;
    liveStreamRevenue: number;
    lastUpdated: string;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/metrics/realtime`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch real-time workspace metrics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get real-time workspace metrics error:', error);
      throw error;
    }
  }

  /**
   * Request manual escrow release for an order (vendor action)
   */
  async requestEscrowRelease(orderId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    hoursRemaining?: number;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/workspace/orders/${orderId}/release-escrow`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: reason || 'Manual release requested by vendor' }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to request escrow release: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Request escrow release error:', error);
      throw error;
    }
  }
}

export const workspaceAPI = new WorkspaceAPI();