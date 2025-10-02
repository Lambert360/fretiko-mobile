import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

export interface AnalyticsData {
  period: AnalyticsPeriod;
  date: string;
  ordersProcessed: number;
  transactionValue: number;
  transactionCount: number;
  revenue: number;
  activeCustomers: number;
  averageOrderValue: number;
  completionRate: number;
  customerSatisfaction: number;
  chartData: {
    labels: string[];
    values: number[];
  };
  reports: AnalyticsReport[];
  trends: {
    ordersChange: number;
    revenueChange: number;
    customersChange: number;
  };
}

export interface AnalyticsReport {
  id: string;
  title: string;
  subtitle: string;
  status: 'completed' | 'processing' | 'failed';
  createdAt: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  downloadUrl?: string;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageRating: number;
  topSellingProducts: Array<{
    id: string;
    name: string;
    quantitySold: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    type: 'order' | 'payment' | 'review';
    description: string;
    timestamp: string;
  }>;
}

export interface LiveStreamingAnalytics {
  period: AnalyticsPeriod;
  date: string;
  totalStreams: number;
  totalLiveRevenue: number;
  totalViewers: number;
  totalEngagements: number;
  totalGifts: number;
  averageViewerCount: number;
  totalStreamDuration: number;
  conversionRate: number;
  activeStreamsCount: number;
  currentActiveStreams: Array<{
    id: string;
    title: string;
    viewer_count: number;
    total_sales: number;
  }>;
  insights: string[];
  chartData: {
    labels: string[];
    viewers: number[];
    revenue: number[];
    engagement: number[];
  };
  trends: {
    viewersChange: number;
    revenueChange: number;
    engagementChange: number;
  };
}

export interface AuctionAnalytics {
  period: AnalyticsPeriod;
  date: string;
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  totalRevenue: number;
  totalBids: number;
  averageBidsPerAuction: number;
  averageFinalPrice: number;
  conversionRate: number; // % of auctions that sold
  totalCommission: number;
  uniqueBidders: number;
  topAuctions: Array<{
    id: string;
    title: string;
    final_bid: number;
    total_bids: number;
    winner_id: string;
  }>;
  categoryPerformance: Array<{
    category: string;
    auction_count: number;
    total_revenue: number;
    average_final_bid: number;
  }>;
  chartData: {
    labels: string[];
    auctions: number[];
    revenue: number[];
    bids: number[];
  };
  trends: {
    auctionsChange: number;
    revenueChange: number;
    bidsChange: number;
  };
  insights: string[];
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

class AnalyticsAPI {
  /**
   * Get analytics data for a specific period
   */
  async getAnalytics(period: AnalyticsPeriod, date?: Date): Promise<AnalyticsData> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      queryParams.append('period', period);
      if (date) {
        queryParams.append('date', date.toISOString().split('T')[0]);
      }

      const response = await fetch(`${API_BASE_URL}/analytics?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get analytics error:', error);
      throw error;
    }
  }

  /**
   * Get analytics summary dashboard
   */
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/summary`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch analytics summary: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get analytics summary error:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics with detailed breakdown
   */
  async getRevenueAnalytics(
    period: AnalyticsPeriod,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalRevenue: number;
    revenueByDay: Array<{ date: string; revenue: number }>;
    revenueByCategory: Array<{ category: string; revenue: number; percentage: number }>;
    revenueByProduct: Array<{ productId: string; productName: string; revenue: number; orders: number }>;
  }> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      queryParams.append('period', period);
      if (startDate) queryParams.append('startDate', startDate.toISOString().split('T')[0]);
      if (endDate) queryParams.append('endDate', endDate.toISOString().split('T')[0]);

      const response = await fetch(`${API_BASE_URL}/analytics/revenue?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch revenue analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get revenue analytics error:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(period: AnalyticsPeriod): Promise<{
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    customerRetentionRate: number;
    averageOrdersPerCustomer: number;
    topCustomers: Array<{
      customerId: string;
      customerName: string;
      totalOrders: number;
      totalSpent: number;
    }>;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/customers?period=${period}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch customer analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get customer analytics error:', error);
      throw error;
    }
  }

  /**
   * Get live streaming analytics
   */
  async getLiveStreamingAnalytics(period: AnalyticsPeriod, date?: Date): Promise<LiveStreamingAnalytics> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      queryParams.append('period', period);
      if (date) {
        queryParams.append('date', date.toISOString().split('T')[0]);
      }

      const response = await fetch(`${API_BASE_URL}/analytics/live-streaming?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch live streaming analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get live streaming analytics error:', error);
      throw error;
    }
  }

  /**
   * Get auction analytics
   */
  async getAuctionAnalytics(period: AnalyticsPeriod, date?: Date): Promise<AuctionAnalytics> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      queryParams.append('period', period);
      if (date) {
        queryParams.append('date', date.toISOString().split('T')[0]);
      }

      const response = await fetch(`${API_BASE_URL}/analytics/auctions?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch auction analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get auction analytics error:', error);
      throw error;
    }
  }

  /**
   * Get product performance analytics
   */
  async getProductAnalytics(period: AnalyticsPeriod): Promise<{
    totalProducts: number;
    totalSales: number;
    topSellingProducts: Array<{
      productId: string;
      productName: string;
      category: string;
      quantitySold: number;
      revenue: number;
      averageRating: number;
    }>;
    categoryPerformance: Array<{
      category: string;
      productsCount: number;
      totalSales: number;
      revenue: number;
    }>;
    lowStockProducts: Array<{
      productId: string;
      productName: string;
      currentStock: number;
      minimumStock: number;
    }>;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/products?period=${period}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch product analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get product analytics error:', error);
      throw error;
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    startDate?: Date,
    endDate?: Date,
    format: 'pdf' | 'excel' = 'pdf'
  ): Promise<{ reportId: string; downloadUrl: string }> {
    try {
      const headers = await getAuthHeaders();

      const requestBody: any = { type, format };
      if (startDate) requestBody.startDate = startDate.toISOString().split('T')[0];
      if (endDate) requestBody.endDate = endDate.toISOString().split('T')[0];

      const response = await fetch(`${API_BASE_URL}/analytics/reports/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to generate report: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Generate report error:', error);
      throw error;
    }
  }

  /**
   * Get list of generated reports
   */
  async getReports(): Promise<AnalyticsReport[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/reports`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch reports: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get reports error:', error);
      throw error;
    }
  }

  /**
   * Download a specific report
   */
  async downloadReport(reportId: string): Promise<string> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/reports/${reportId}/download`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to download report: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      return data.downloadUrl;
    } catch (error) {
      console.error('Download report error:', error);
      throw error;
    }
  }

  /**
   * Get real-time analytics (for live updates)
   */
  async getRealTimeAnalytics(): Promise<{
    activeOrders: number;
    todayRevenue: number;
    onlineCustomers: number;
    pendingOrders: number;
    completionRate: number;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/realtime`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch real-time analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get real-time analytics error:', error);
      throw error;
    }
  }

  /**
   * Get analytics comparison between periods
   */
  async getAnalyticsComparison(
    currentPeriod: AnalyticsPeriod,
    currentDate: Date,
    comparisonDate: Date
  ): Promise<{
    current: AnalyticsData;
    comparison: AnalyticsData;
    changes: {
      revenueChange: number;
      ordersChange: number;
      customersChange: number;
      completionRateChange: number;
    };
  }> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      queryParams.append('period', currentPeriod);
      queryParams.append('currentDate', currentDate.toISOString().split('T')[0]);
      queryParams.append('comparisonDate', comparisonDate.toISOString().split('T')[0]);

      const response = await fetch(`${API_BASE_URL}/analytics/comparison?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch analytics comparison: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get analytics comparison error:', error);
      throw error;
    }
  }

  /**
   * Get real-time analytics for a specific live stream
   */
  async getRealTimeLiveStreamAnalytics(streamId: string): Promise<{
    streamId: string;
    title: string;
    status: string;
    viewerCount: number;
    totalViewers: number;
    totalSales: number;
    engagementCount: number;
    giftCount: number;
    giftValue: number;
    conversionRate: number;
    streamDuration: number;
    averageWatchTime: number;
    peakViewers: number;
    commentCount: number;
    reactionCount: number;
    productsSold: number;
    engagementRate: number;
    recentActivity: Array<{
      type: 'purchase' | 'gift';
      amount: number;
      timestamp: string;
    }>;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/live-streaming/${streamId}/realtime`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch real-time live stream analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get real-time live stream analytics error:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics for vendor dashboard
   */
  async getVendorRealTimeMetrics(): Promise<{
    currentActiveStreams: number;
    currentTotalViewers: number;
    todayStreamsCount: number;
    todayTotalViewers: number;
    todayTotalRevenue: number;
    todayGiftRevenue: number;
    averageViewersPerStream: number;
    activeStreamsList: Array<{
      id: string;
      title: string;
      viewer_count: number;
      total_sales: number;
      created_at: string;
    }>;
    lastUpdated: string;
  }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/vendor/realtime`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch vendor real-time metrics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get vendor real-time metrics error:', error);
      throw error;
    }
  }

  /**
   * Record analytics event for real-time tracking
   */
  async recordAnalyticsEvent(eventData: {
    streamId?: string;
    eventType: 'stream_start' | 'stream_end' | 'viewer_join' | 'viewer_leave' |
               'comment' | 'reaction' | 'gift_sent' | 'product_purchased' | 'service_booked';
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to record analytics event: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Record analytics event error:', error);
      throw error;
    }
  }

  /**
   * Update live stream analytics in real-time
   */
  async updateLiveStreamAnalytics(streamId: string, analyticsData: {
    viewerJoin?: boolean;
    viewerLeave?: boolean;
    comment?: boolean;
    reaction?: boolean;
    gift?: { amount: number };
    purchase?: { amount: number };
    engagement?: string;
  }): Promise<any> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/analytics/live-streaming/${streamId}/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify(analyticsData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update live stream analytics: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update live stream analytics error:', error);
      throw error;
    }
  }
}

export const analyticsAPI = new AnalyticsAPI();