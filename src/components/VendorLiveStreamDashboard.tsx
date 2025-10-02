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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { analyticsAPI, LiveStreamingAnalytics } from '../services/analyticsAPI';
import { workspaceAPI, WorkspaceLiveStreamAnalytics } from '../services/workspaceAPI';
import LiveStreamLineChart from './LiveStreamLineChart';
import LiveStreamRealtimeChart from './LiveStreamRealtimeChart';
import { useRealtimeAnalytics } from '../hooks/useRealtimeAnalytics';

const { width: screenWidth } = Dimensions.get('window');

interface PerformanceInsight {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface VendorLiveStreamDashboardProps {
  vendorId: string;
  onStartStream?: () => void;
  onViewDetailedAnalytics?: () => void;
}

/**
 * Vendor Live Streaming Performance Dashboard
 *
 * Comprehensive dashboard for vendors to track and optimize their live streaming performance.
 * Features:
 * - Real-time performance metrics
 * - Historical performance trends
 * - AI-powered insights and recommendations
 * - Quick action buttons for optimization
 * - Revenue tracking and conversion analytics
 * - Audience engagement analysis
 */
const VendorLiveStreamDashboard: React.FC<VendorLiveStreamDashboardProps> = ({
  vendorId,
  onStartStream,
  onViewDetailedAnalytics,
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [analytics, setAnalytics] = useState<WorkspaceLiveStreamAnalytics | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time analytics hook
  const { analyticsData: liveAnalytics, isConnected } = useRealtimeAnalytics({
    enabled: true,
  });

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load analytics data in parallel
      const [analyticsData, metricsData] = await Promise.all([
        workspaceAPI.getLiveStreamAnalytics(period),
        workspaceAPI.getRealTimeWorkspaceMetrics(),
      ]);

      setAnalytics(analyticsData);
      setRealtimeMetrics(metricsData);

      // Generate insights based on data
      generateInsights(analyticsData, metricsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  // Generate performance insights
  const generateInsights = (
    analyticsData: WorkspaceLiveStreamAnalytics,
    metricsData: any
  ) => {
    const newInsights: PerformanceInsight[] = [];

    // Revenue growth insight
    if (analyticsData.liveRevenueGrowth > 20) {
      newInsights.push({
        id: 'revenue-growth',
        type: 'success',
        title: 'Excellent Revenue Growth! 📈',
        description: `Your live streaming revenue has grown by ${analyticsData.liveRevenueGrowth.toFixed(1)}% this ${period}`,
        action: {
          label: 'Start Another Stream',
          onPress: () => onStartStream?.(),
        },
      });
    } else if (analyticsData.liveRevenueGrowth < -10) {
      newInsights.push({
        id: 'revenue-decline',
        type: 'warning',
        title: 'Revenue Decline Detected ⚠️',
        description: `Revenue is down ${Math.abs(analyticsData.liveRevenueGrowth).toFixed(1)}%. Consider adjusting your streaming strategy.`,
        action: {
          label: 'View Tips',
          onPress: () => showOptimizationTips(),
        },
      });
    }

    // Conversion rate insight
    if (analyticsData.conversionMetrics.viewersToOrders > 5) {
      newInsights.push({
        id: 'high-conversion',
        type: 'success',
        title: 'High Conversion Rate! 🎯',
        description: `${analyticsData.conversionMetrics.viewersToOrders.toFixed(1)}% of viewers are making purchases`,
      });
    } else if (analyticsData.conversionMetrics.viewersToOrders < 2) {
      newInsights.push({
        id: 'low-conversion',
        type: 'warning',
        title: 'Low Conversion Rate',
        description: 'Consider showcasing products more actively during streams',
        action: {
          label: 'Learn More',
          onPress: () => showConversionTips(),
        },
      });
    }

    // Peak performance time insight
    const bestHour = analyticsData.hourlyPerformance.reduce((best, current) =>
      current.revenue > best.revenue ? current : best
    );

    if (bestHour) {
      newInsights.push({
        id: 'peak-time',
        type: 'info',
        title: `Peak Performance at ${bestHour.hour}:00`,
        description: `You earn most at ${bestHour.hour}:00. Consider streaming more at this time.`,
      });
    }

    // Active streams insight
    if (metricsData.activeLiveStreams === 0) {
      newInsights.push({
        id: 'no-active-streams',
        type: 'info',
        title: 'No Active Streams 📺',
        description: 'Start a live stream to connect with customers and boost sales',
        action: {
          label: 'Start Streaming',
          onPress: () => onStartStream?.(),
        },
      });
    }

    setInsights(newInsights);
  };

  // Show optimization tips
  const showOptimizationTips = () => {
    Alert.alert(
      'Optimization Tips',
      '• Engage with viewers through comments\n• Showcase products actively\n• Use compelling product descriptions\n• Stream during peak hours\n• Offer exclusive stream deals'
    );
  };

  // Show conversion tips
  const showConversionTips = () => {
    Alert.alert(
      'Boost Conversions',
      '• Create urgency with limited offers\n• Demonstrate product benefits\n• Respond to viewer questions\n• Use clear call-to-actions\n• Offer special stream pricing'
    );
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  }, [loadDashboardData]);

  // Load data on mount and period change
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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

  // Render period selector
  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {(['today', 'week', 'month'] as const).map((p) => (
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

  // Render key metrics
  const renderKeyMetrics = () => {
    if (!analytics) return null;

    return (
      <View style={styles.metricsGrid}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.metricCard}>
          <Ionicons name="cash" size={24} color="white" />
          <Text style={styles.metricValue}>{formatCurrency(analytics.totalLiveRevenue)}</Text>
          <Text style={styles.metricLabel}>Live Revenue</Text>
          <Text style={[styles.metricChange, analytics.liveRevenueGrowth >= 0 ? styles.positive : styles.negative]}>
            {analytics.liveRevenueGrowth >= 0 ? '+' : ''}{analytics.liveRevenueGrowth.toFixed(1)}%
          </Text>
        </LinearGradient>

        <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.metricCard}>
          <Ionicons name="bag" size={24} color="white" />
          <Text style={styles.metricValue}>{formatNumber(analytics.totalLiveOrders)}</Text>
          <Text style={styles.metricLabel}>Live Orders</Text>
          <Text style={[styles.metricChange, analytics.liveOrdersGrowth >= 0 ? styles.positive : styles.negative]}>
            {analytics.liveOrdersGrowth >= 0 ? '+' : ''}{analytics.liveOrdersGrowth.toFixed(1)}%
          </Text>
        </LinearGradient>

        <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.metricCard}>
          <Ionicons name="trending-up" size={24} color="white" />
          <Text style={styles.metricValue}>{formatCurrency(analytics.averageLiveOrderValue)}</Text>
          <Text style={styles.metricLabel}>Avg Order Value</Text>
        </LinearGradient>

        <LinearGradient colors={['#43e97b', '#38f9d7']} style={styles.metricCard}>
          <Ionicons name="people" size={24} color="white" />
          <Text style={styles.metricValue}>{analytics.conversionMetrics.viewersToOrders.toFixed(1)}%</Text>
          <Text style={styles.metricLabel}>Conversion Rate</Text>
        </LinearGradient>
      </View>
    );
  };

  // Render performance chart
  const renderPerformanceChart = () => {
    if (!analytics?.hourlyPerformance) return null;

    const chartData = analytics.hourlyPerformance.map(hour => ({
      timestamp: hour.hour,
      value: hour.revenue,
    }));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Revenue by Hour</Text>
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

  // Render top streams
  const renderTopStreams = () => {
    if (!analytics?.topPerformingStreams?.length) return null;

    return (
      <View style={styles.topStreamsContainer}>
        <Text style={styles.sectionTitle}>Top Performing Streams</Text>
        {analytics.topPerformingStreams.slice(0, 3).map((stream, index) => (
          <View key={stream.streamId} style={styles.streamItem}>
            <View style={styles.streamRank}>
              <Text style={styles.streamRankText}>{index + 1}</Text>
            </View>
            <View style={styles.streamInfo}>
              <Text style={styles.streamTitle} numberOfLines={1}>
                {stream.streamTitle}
              </Text>
              <Text style={styles.streamStats}>
                {stream.orderCount} orders • {formatCurrency(stream.revenue)}
              </Text>
            </View>
            <View style={styles.streamMetrics}>
              <Text style={styles.streamMetricValue}>{formatCurrency(stream.revenue)}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Render insights
  const renderInsights = () => {
    if (!insights.length) return null;

    return (
      <View style={styles.insightsContainer}>
        <Text style={styles.sectionTitle}>Performance Insights</Text>
        {insights.map((insight) => (
          <View key={insight.id} style={[styles.insightCard, styles[`insight${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}`]]}>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDescription}>{insight.description}</Text>
            </View>
            {insight.action && (
              <TouchableOpacity style={styles.insightAction} onPress={insight.action.onPress}>
                <Text style={styles.insightActionText}>{insight.action.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render quick actions
  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={onStartStream}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.actionButtonGradient}>
            <Ionicons name="videocam" size={24} color="white" />
            <Text style={styles.actionButtonText}>Start Stream</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onViewDetailedAnalytics}>
          <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.actionButtonGradient}>
            <Ionicons name="analytics" size={24} color="white" />
            <Text style={styles.actionButtonText}>Detailed Analytics</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && !analytics) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Streaming Performance</Text>
        <View style={styles.connectionStatus}>
          <View style={[styles.connectionDot, { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }]} />
          <Text style={styles.connectionText}>{isConnected ? 'Live' : 'Offline'}</Text>
        </View>
      </View>

      {renderPeriodSelector()}
      {renderKeyMetrics()}
      {renderPerformanceChart()}
      {renderTopStreams()}
      {renderInsights()}
      {renderQuickActions()}
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
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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
  metricChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  positive: {
    color: '#34C759',
  },
  negative: {
    color: '#FF3B30',
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

  // Top streams styles
  topStreamsContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  streamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  streamRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  streamRankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  streamInfo: {
    flex: 1,
  },
  streamTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  streamStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  streamMetrics: {
    alignItems: 'flex-end',
  },
  streamMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#667eea',
  },

  // Insights styles
  insightsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  insightSuccess: {
    borderLeftColor: '#34C759',
  },
  insightWarning: {
    borderLeftColor: '#FF9500',
  },
  insightInfo: {
    borderLeftColor: '#007AFF',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  insightDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  insightAction: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  insightActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },

  // Quick actions styles
  quickActionsContainer: {
    marginHorizontal: 20,
    marginBottom: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  actionButtonGradient: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
});

export default VendorLiveStreamDashboard;