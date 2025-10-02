import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { analyticsAPI } from '../services/analyticsAPI';
import LiveStreamLineChart from './LiveStreamLineChart';
import LiveStreamRealtimeChart from './LiveStreamRealtimeChart';

const { width: screenWidth } = Dimensions.get('window');

interface PlatformAnalytics {
  totalVendors: number;
  activeStreamers: number;
  totalStreams: number;
  totalLiveRevenue: number;
  totalLiveOrders: number;
  averageStreamDuration: number;
  platformCommission: number;
  topPerformingVendors: Array<{
    vendorId: string;
    vendorName: string;
    totalRevenue: number;
    totalStreams: number;
    averageRating: number;
    conversionRate: number;
  }>;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    streams: number;
    orders: number;
  }>;
  categoryPerformance: Array<{
    category: string;
    revenue: number;
    streams: number;
    conversionRate: number;
  }>;
  geographicData: Array<{
    region: string;
    revenue: number;
    viewers: number;
    streams: number;
  }>;
  streamingTrends: {
    peakHours: Array<{ hour: number; streams: number; revenue: number }>;
    deviceTypes: Array<{ device: string; count: number; percentage: number }>;
    averageViewerEngagement: number;
    streamRetentionRate: number;
  };
}

interface AdminLiveStreamAnalyticsProps {
  onExportData?: (data: any) => void;
  onVendorDetails?: (vendorId: string) => void;
}

/**
 * Platform Admin Live Streaming Analytics
 *
 * Comprehensive analytics dashboard for platform administrators to monitor
 * and analyze live streaming performance across the entire platform.
 * Features:
 * - Platform-wide performance metrics
 * - Vendor performance rankings
 * - Revenue and commission tracking
 * - Geographic and demographic insights
 * - Trend analysis and forecasting
 * - Real-time monitoring capabilities
 * - Data export functionality
 */
const AdminLiveStreamAnalytics: React.FC<AdminLiveStreamAnalyticsProps> = ({
  onExportData,
  onVendorDetails,
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'quarter'>('week');
  const [viewMode, setViewMode] = useState<'overview' | 'vendors' | 'geographic' | 'trends'>('overview');
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Load platform analytics data
  const loadPlatformAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);

      // This would be a new admin-specific API endpoint
      const response = await fetch(`/api/admin/analytics/live-streaming?period=${period}&category=${selectedCategory}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch platform analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading platform analytics:', error);
      Alert.alert('Error', 'Failed to load platform analytics');

      // Mock data for development
      setAnalytics(getMockPlatformData());
    } finally {
      setIsLoading(false);
    }
  }, [period, selectedCategory]);

  // Get auth token helper
  const getAuthToken = async () => {
    // Implementation would get token from secure storage
    return 'mock-admin-token';
  };

  // Mock data for development
  const getMockPlatformData = (): PlatformAnalytics => ({
    totalVendors: 1250,
    activeStreamers: 320,
    totalStreams: 4500,
    totalLiveRevenue: 125000,
    totalLiveOrders: 8900,
    averageStreamDuration: 45,
    platformCommission: 12500,
    topPerformingVendors: [
      {
        vendorId: '1',
        vendorName: 'Fashion Hub',
        totalRevenue: 15000,
        totalStreams: 45,
        averageRating: 4.8,
        conversionRate: 8.5,
      },
      {
        vendorId: '2',
        vendorName: 'Tech Gadgets',
        totalRevenue: 12500,
        totalStreams: 38,
        averageRating: 4.6,
        conversionRate: 7.2,
      },
      {
        vendorId: '3',
        vendorName: 'Beauty Corner',
        totalRevenue: 11200,
        totalStreams: 52,
        averageRating: 4.9,
        conversionRate: 9.1,
      },
    ],
    revenueByDay: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revenue: Math.floor(Math.random() * 20000) + 10000,
      streams: Math.floor(Math.random() * 100) + 50,
      orders: Math.floor(Math.random() * 500) + 200,
    })),
    categoryPerformance: [
      { category: 'Fashion', revenue: 45000, streams: 1200, conversionRate: 8.2 },
      { category: 'Electronics', revenue: 38000, streams: 800, conversionRate: 6.5 },
      { category: 'Beauty', revenue: 25000, streams: 900, conversionRate: 9.1 },
      { category: 'Home & Garden', revenue: 17000, streams: 600, conversionRate: 5.8 },
    ],
    geographicData: [
      { region: 'Lagos', revenue: 35000, viewers: 12500, streams: 850 },
      { region: 'Abuja', revenue: 28000, viewers: 9800, streams: 720 },
      { region: 'Kano', revenue: 22000, viewers: 8200, streams: 650 },
      { region: 'Port Harcourt', revenue: 18000, viewers: 6900, streams: 520 },
    ],
    streamingTrends: {
      peakHours: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        streams: Math.floor(Math.random() * 50) + 10,
        revenue: Math.floor(Math.random() * 5000) + 1000,
      })),
      deviceTypes: [
        { device: 'Mobile', count: 7500, percentage: 75 },
        { device: 'Desktop', count: 2000, percentage: 20 },
        { device: 'Tablet', count: 500, percentage: 5 },
      ],
      averageViewerEngagement: 72.5,
      streamRetentionRate: 68.3,
    },
  });

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadPlatformAnalytics();
    setIsRefreshing(false);
  }, [loadPlatformAnalytics]);

  // Load data on mount and dependencies change
  useEffect(() => {
    loadPlatformAnalytics();
  }, [loadPlatformAnalytics]);

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `₣${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₣${(amount / 1000).toFixed(1)}K`;
    return `₣${amount.toFixed(0)}`;
  };

  // Format number
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Export data handler
  const handleExportData = () => {
    const exportData = {
      period,
      analytics,
      exportedAt: new Date().toISOString(),
    };
    onExportData?.(exportData);
  };

  // Filter vendors based on search
  const filteredVendors = analytics?.topPerformingVendors.filter(vendor =>
    vendor.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Render view mode selector
  const renderViewModeSelector = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewModeSelector}>
      {(['overview', 'vendors', 'geographic', 'trends'] as const).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.viewModeButton, viewMode === mode && styles.viewModeButtonActive]}
          onPress={() => setViewMode(mode)}
        >
          <Text style={[styles.viewModeButtonText, viewMode === mode && styles.viewModeButtonTextActive]}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // Render period selector
  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {(['today', 'week', 'month', 'quarter'] as const).map((p) => (
        <TouchableOpacity
          key={p}
          style={[styles.periodButton, period === p && styles.periodButtonActive]}
          onPress={() => setPeriod(p)}
        >
          <Text style={[styles.periodButtonText, period === p && styles.periodButtonTextActive]}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render overview metrics
  const renderOverviewMetrics = () => {
    if (!analytics) return null;

    return (
      <View style={styles.metricsGrid}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.metricCard}>
          <Ionicons name="cash" size={24} color="white" />
          <Text style={styles.metricValue}>{formatCurrency(analytics.totalLiveRevenue)}</Text>
          <Text style={styles.metricLabel}>Total Revenue</Text>
          <Text style={styles.metricSubtext}>Platform Commission: {formatCurrency(analytics.platformCommission)}</Text>
        </LinearGradient>

        <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.metricCard}>
          <Ionicons name="people" size={24} color="white" />
          <Text style={styles.metricValue}>{formatNumber(analytics.activeStreamers)}</Text>
          <Text style={styles.metricLabel}>Active Streamers</Text>
          <Text style={styles.metricSubtext}>of {formatNumber(analytics.totalVendors)} vendors</Text>
        </LinearGradient>

        <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.metricCard}>
          <Ionicons name="videocam" size={24} color="white" />
          <Text style={styles.metricValue}>{formatNumber(analytics.totalStreams)}</Text>
          <Text style={styles.metricLabel}>Total Streams</Text>
          <Text style={styles.metricSubtext}>Avg {analytics.averageStreamDuration}min</Text>
        </LinearGradient>

        <LinearGradient colors={['#43e97b', '#38f9d7']} style={styles.metricCard}>
          <Ionicons name="bag" size={24} color="white" />
          <Text style={styles.metricValue}>{formatNumber(analytics.totalLiveOrders)}</Text>
          <Text style={styles.metricLabel}>Live Orders</Text>
          <Text style={styles.metricSubtext}>
            Avg ₣{(analytics.totalLiveRevenue / analytics.totalLiveOrders).toFixed(0)}
          </Text>
        </LinearGradient>
      </View>
    );
  };

  // Render revenue chart
  const renderRevenueChart = () => {
    if (!analytics?.revenueByDay) return null;

    const chartData = analytics.revenueByDay.map(day => ({
      timestamp: new Date(day.date).getTime(),
      value: day.revenue,
    }));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Revenue Trend</Text>
        <LiveStreamLineChart
          title=""
          data={chartData}
          color="#667eea"
          height={200}
          formatValue={formatCurrency}
          showPoints={true}
        />
      </View>
    );
  };

  // Render vendor rankings
  const renderVendorRankings = () => (
    <View style={styles.vendorRankingsContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vendors..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredVendors.map((vendor, index) => (
        <TouchableOpacity
          key={vendor.vendorId}
          style={styles.vendorItem}
          onPress={() => onVendorDetails?.(vendor.vendorId)}
        >
          <View style={styles.vendorRank}>
            <Text style={styles.vendorRankText}>{index + 1}</Text>
          </View>
          <View style={styles.vendorInfo}>
            <Text style={styles.vendorName}>{vendor.vendorName}</Text>
            <Text style={styles.vendorStats}>
              {vendor.totalStreams} streams • {vendor.conversionRate}% conversion
            </Text>
            <View style={styles.vendorRating}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.vendorRatingText}>{vendor.averageRating}</Text>
            </View>
          </View>
          <View style={styles.vendorMetrics}>
            <Text style={styles.vendorRevenue}>{formatCurrency(vendor.totalRevenue)}</Text>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render geographic analytics
  const renderGeographicAnalytics = () => {
    if (!analytics?.geographicData) return null;

    return (
      <View style={styles.geographicContainer}>
        <Text style={styles.sectionTitle}>Revenue by Region</Text>
        {analytics.geographicData.map((region, index) => (
          <View key={region.region} style={styles.regionItem}>
            <View style={styles.regionInfo}>
              <Text style={styles.regionName}>{region.region}</Text>
              <Text style={styles.regionStats}>
                {formatNumber(region.viewers)} viewers • {region.streams} streams
              </Text>
            </View>
            <Text style={styles.regionRevenue}>{formatCurrency(region.revenue)}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Render category performance
  const renderCategoryPerformance = () => {
    if (!analytics?.categoryPerformance) return null;

    return (
      <View style={styles.categoryContainer}>
        <Text style={styles.sectionTitle}>Category Performance</Text>
        {analytics.categoryPerformance.map((category) => (
          <View key={category.category} style={styles.categoryItem}>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.category}</Text>
              <Text style={styles.categoryStats}>
                {category.streams} streams • {category.conversionRate}% conversion
              </Text>
            </View>
            <Text style={styles.categoryRevenue}>{formatCurrency(category.revenue)}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Render trends analytics
  const renderTrendsAnalytics = () => {
    if (!analytics?.streamingTrends) return null;

    const peakHourData = analytics.streamingTrends.peakHours.map(hour => ({
      timestamp: hour.hour,
      value: hour.streams,
    }));

    return (
      <View style={styles.trendsContainer}>
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Peak Streaming Hours</Text>
          <LiveStreamLineChart
            title=""
            data={peakHourData}
            color="#f093fb"
            height={180}
            formatValue={(value) => `${value} streams`}
            showPoints={true}
          />
        </View>

        <View style={styles.engagementMetrics}>
          <View style={styles.engagementMetric}>
            <Text style={styles.engagementValue}>
              {analytics.streamingTrends.averageViewerEngagement.toFixed(1)}%
            </Text>
            <Text style={styles.engagementLabel}>Avg Engagement</Text>
          </View>
          <View style={styles.engagementMetric}>
            <Text style={styles.engagementValue}>
              {analytics.streamingTrends.streamRetentionRate.toFixed(1)}%
            </Text>
            <Text style={styles.engagementLabel}>Retention Rate</Text>
          </View>
        </View>

        <View style={styles.deviceTypesContainer}>
          <Text style={styles.sectionTitle}>Device Usage</Text>
          {analytics.streamingTrends.deviceTypes.map((device) => (
            <View key={device.device} style={styles.deviceTypeItem}>
              <Text style={styles.deviceTypeName}>{device.device}</Text>
              <View style={styles.deviceTypeBar}>
                <View
                  style={[
                    styles.deviceTypeBarFill,
                    { width: `${device.percentage}%` }
                  ]}
                />
              </View>
              <Text style={styles.deviceTypePercentage}>{device.percentage}%</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render content based on view mode
  const renderContent = () => {
    switch (viewMode) {
      case 'overview':
        return (
          <>
            {renderOverviewMetrics()}
            {renderRevenueChart()}
            {renderCategoryPerformance()}
          </>
        );
      case 'vendors':
        return renderVendorRankings();
      case 'geographic':
        return renderGeographicAnalytics();
      case 'trends':
        return renderTrendsAnalytics();
      default:
        return renderOverviewMetrics();
    }
  };

  if (isLoading && !analytics) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading platform analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Analytics</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportData}>
          <Ionicons name="download" size={20} color="#667eea" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {renderViewModeSelector()}
      {renderPeriodSelector()}
      {renderContent()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 4,
  },

  // View mode selector styles
  viewModeSelector: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  viewModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  viewModeButtonActive: {
    backgroundColor: '#667eea',
  },
  viewModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  viewModeButtonTextActive: {
    color: 'white',
  },

  // Period selector styles
  periodSelector: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#667eea',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: 'white',
  },

  // Metrics grid styles
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  metricCard: {
    width: (screenWidth - 60) / 2,
    margin: 5,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  metricSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },

  // Chart styles
  chartContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },

  // Section styles
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },

  // Vendor rankings styles
  vendorRankingsContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1a1a1a',
  },
  vendorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vendorRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vendorRankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  vendorStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  vendorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  vendorRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 4,
  },
  vendorMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginRight: 8,
  },

  // Geographic styles
  geographicContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  regionInfo: {
    flex: 1,
  },
  regionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  regionStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  regionRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },

  // Category styles
  categoryContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  categoryStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoryRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },

  // Trends styles
  trendsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  engagementMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  engagementMetric: {
    alignItems: 'center',
  },
  engagementValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  engagementLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deviceTypesContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
  },
  deviceTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    width: 80,
  },
  deviceTypeBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  deviceTypeBarFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  deviceTypePercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 40,
    textAlign: 'right',
  },
});

export default AdminLiveStreamAnalytics;