import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workspaceAPI, WorkspaceLiveStreamAnalytics } from '../services/workspaceAPI';
import LiveStreamLineChart from './LiveStreamLineChart';

const { width: screenWidth } = Dimensions.get('window');

interface WorkspaceLiveStreamAnalyticsProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Workspace Live Stream Analytics Component
 *
 * Features:
 * - Integration of live streaming analytics with workspace orders
 * - Order source breakdown (regular vs live stream vs auction vs service)
 * - Live streaming performance impact on overall business
 * - Real-time metrics integration
 * - Conversion analytics from live streams to orders
 */
const WorkspaceLiveStreamAnalyticsComponent: React.FC<WorkspaceLiveStreamAnalyticsProps> = ({
  isVisible,
  onClose,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [liveStreamAnalytics, setLiveStreamAnalytics] = useState<WorkspaceLiveStreamAnalytics | null>(null);
  const [sourceAnalytics, setSourceAnalytics] = useState<any>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadAnalyticsData();

      // Set up real-time updates
      const interval = setInterval(loadRealtimeMetrics, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isVisible, selectedPeriod]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [liveData, sourceData, realtimeData] = await Promise.all([
        workspaceAPI.getLiveStreamAnalytics(selectedPeriod),
        workspaceAPI.getOrdersAnalyticsBySource(selectedPeriod),
        workspaceAPI.getRealTimeWorkspaceMetrics(),
      ]);

      setLiveStreamAnalytics(liveData);
      setSourceAnalytics(sourceData);
      setRealtimeMetrics(realtimeData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadRealtimeMetrics = async () => {
    try {
      const realtimeData = await workspaceAPI.getRealTimeWorkspaceMetrics();
      setRealtimeMetrics(realtimeData);
    } catch (error) {
      console.error('Error loading realtime metrics:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `₣${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₣${(amount / 1000).toFixed(1)}K`;
    return `₣${amount.toFixed(0)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'regular': return '#007AFF';
      case 'live_stream': return '#FF2D92';
      case 'auction': return '#FF9500';
      case 'service_booking': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'regular': return 'storefront-outline';
      case 'live_stream': return 'videocam-outline';
      case 'auction': return 'hammer-outline';
      case 'service_booking': return 'construct-outline';
      default: return 'cube-outline';
    }
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {(['today', 'week', 'month'] as const).map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && styles.activePeriodButton,
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.activePeriodButtonText,
            ]}
          >
            {period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRealTimeMetrics = () => {
    if (!realtimeMetrics) return null;

    return (
      <View style={styles.realtimeSection}>
        <Text style={styles.sectionTitle}>🔴 Live Metrics</Text>

        <View style={styles.realtimeGrid}>
          <View style={styles.realtimeCard}>
            <Ionicons name="cube-outline" size={20} color="#007AFF" />
            <Text style={styles.realtimeValue}>{realtimeMetrics.activeOrders}</Text>
            <Text style={styles.realtimeLabel}>Active Orders</Text>
          </View>

          <View style={styles.realtimeCard}>
            <Ionicons name="videocam" size={20} color="#FF2D92" />
            <Text style={styles.realtimeValue}>{realtimeMetrics.activeLiveStreams}</Text>
            <Text style={styles.realtimeLabel}>Live Streams</Text>
          </View>

          <View style={styles.realtimeCard}>
            <Ionicons name="people" size={20} color="#34C759" />
            <Text style={styles.realtimeValue}>{formatNumber(realtimeMetrics.currentLiveViewers)}</Text>
            <Text style={styles.realtimeLabel}>Live Viewers</Text>
          </View>

          <View style={styles.realtimeCard}>
            <Ionicons name="cash" size={20} color="#FF9500" />
            <Text style={styles.realtimeValue}>{formatCurrency(realtimeMetrics.liveStreamRevenue)}</Text>
            <Text style={styles.realtimeLabel}>Live Revenue</Text>
          </View>
        </View>

        <Text style={styles.lastUpdated}>
          Last updated: {new Date(realtimeMetrics.lastUpdated).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  const renderSourceBreakdown = () => {
    if (!sourceAnalytics) return null;

    return (
      <View style={styles.sourceSection}>
        <Text style={styles.sectionTitle}>📊 Orders by Source</Text>

        <View style={styles.sourceOverview}>
          <View style={styles.sourceOverviewItem}>
            <Text style={styles.sourceOverviewValue}>{sourceAnalytics.totalOrders}</Text>
            <Text style={styles.sourceOverviewLabel}>Total Orders</Text>
          </View>
          <View style={styles.sourceOverviewItem}>
            <Text style={styles.sourceOverviewValue}>{formatCurrency(sourceAnalytics.totalRevenue)}</Text>
            <Text style={styles.sourceOverviewLabel}>Total Revenue</Text>
          </View>
        </View>

        <View style={styles.sourceBreakdown}>
          {sourceAnalytics.sourceBreakdown.map((item: any, index: number) => (
            <View key={index} style={styles.sourceItem}>
              <View style={styles.sourceHeader}>
                <View style={styles.sourceInfo}>
                  <Ionicons
                    name={getSourceIcon(item.source) as any}
                    size={16}
                    color={getSourceColor(item.source)}
                  />
                  <Text style={styles.sourceName}>
                    {item.source.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                </View>
                <Text style={styles.sourcePercentage}>{item.percentage.toFixed(1)}%</Text>
              </View>

              <View style={styles.sourceMetrics}>
                <View style={styles.sourceMetric}>
                  <Text style={styles.sourceMetricValue}>{item.orderCount}</Text>
                  <Text style={styles.sourceMetricLabel}>Orders</Text>
                </View>
                <View style={styles.sourceMetric}>
                  <Text style={styles.sourceMetricValue}>{formatCurrency(item.revenue)}</Text>
                  <Text style={styles.sourceMetricLabel}>Revenue</Text>
                </View>
                <View style={styles.sourceMetric}>
                  <Text style={styles.sourceMetricValue}>{formatCurrency(item.averageOrderValue)}</Text>
                  <Text style={styles.sourceMetricLabel}>Avg Order</Text>
                </View>
              </View>

              <View style={styles.sourceProgressBar}>
                <View
                  style={[
                    styles.sourceProgress,
                    {
                      width: `${item.percentage}%`,
                      backgroundColor: getSourceColor(item.source),
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderLiveStreamPerformance = () => {
    if (!liveStreamAnalytics) return null;

    return (
      <View style={styles.liveStreamSection}>
        <Text style={styles.sectionTitle}>🎥 Live Stream Performance</Text>

        <View style={styles.performanceGrid}>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{liveStreamAnalytics.totalLiveOrders}</Text>
            <Text style={styles.performanceLabel}>Live Orders</Text>
            <View style={styles.performanceTrend}>
              <Ionicons
                name={liveStreamAnalytics.liveOrdersGrowth > 0 ? "trending-up" : "trending-down"}
                size={12}
                color={liveStreamAnalytics.liveOrdersGrowth > 0 ? "#34C759" : "#FF3B30"}
              />
              <Text
                style={[
                  styles.performanceTrendText,
                  { color: liveStreamAnalytics.liveOrdersGrowth > 0 ? "#34C759" : "#FF3B30" }
                ]}
              >
                {liveStreamAnalytics.liveOrdersGrowth > 0 ? '+' : ''}{liveStreamAnalytics.liveOrdersGrowth.toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{formatCurrency(liveStreamAnalytics.totalLiveRevenue)}</Text>
            <Text style={styles.performanceLabel}>Live Revenue</Text>
            <View style={styles.performanceTrend}>
              <Ionicons
                name={liveStreamAnalytics.liveRevenueGrowth > 0 ? "trending-up" : "trending-down"}
                size={12}
                color={liveStreamAnalytics.liveRevenueGrowth > 0 ? "#34C759" : "#FF3B30"}
              />
              <Text
                style={[
                  styles.performanceTrendText,
                  { color: liveStreamAnalytics.liveRevenueGrowth > 0 ? "#34C759" : "#FF3B30" }
                ]}
              >
                {liveStreamAnalytics.liveRevenueGrowth > 0 ? '+' : ''}{liveStreamAnalytics.liveRevenueGrowth.toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{formatCurrency(liveStreamAnalytics.averageLiveOrderValue)}</Text>
            <Text style={styles.performanceLabel}>Avg Live Order</Text>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{liveStreamAnalytics.conversionMetrics.viewersToOrders.toFixed(1)}%</Text>
            <Text style={styles.performanceLabel}>Conversion Rate</Text>
          </View>
        </View>

        {/* Hourly Performance Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Hourly Performance</Text>
          <LiveStreamLineChart
            title="Orders"
            data={liveStreamAnalytics.hourlyPerformance.map(h => ({
              timestamp: h.hour,
              value: h.orderCount,
            }))}
            color="#FF2D92"
            height={80}
            showPoints={false}
            formatValue={(value) => value.toString()}
          />
        </View>

        {/* Top Performing Streams */}
        <View style={styles.topStreamsSection}>
          <Text style={styles.sectionTitle}>🏆 Top Performing Streams</Text>
          {liveStreamAnalytics.topPerformingStreams.slice(0, 3).map((stream, index) => (
            <View key={stream.streamId} style={styles.streamItem}>
              <View style={styles.streamRank}>
                <Text style={styles.streamRankText}>{index + 1}</Text>
              </View>
              <View style={styles.streamInfo}>
                <Text style={styles.streamTitle} numberOfLines={1}>{stream.streamTitle}</Text>
                <Text style={styles.streamDate}>{new Date(stream.date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.streamMetrics}>
                <Text style={styles.streamOrders}>{stream.orderCount} orders</Text>
                <Text style={styles.streamRevenue}>{formatCurrency(stream.revenue)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (!isVisible) return null;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Workspace Analytics</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Workspace Analytics</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalyticsData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workspace Analytics</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {renderPeriodSelector()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderRealTimeMetrics()}
        {renderSourceBreakdown()}
        {renderLiveStreamPerformance()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Period selector
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#111',
    margin: 20,
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activePeriodButton: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activePeriodButtonText: {
    color: 'white',
  },

  // Real-time metrics
  realtimeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  realtimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  realtimeCard: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  realtimeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginVertical: 8,
  },
  realtimeLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },

  // Source breakdown
  sourceSection: {
    marginBottom: 24,
  },
  sourceOverview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  sourceOverviewItem: {
    alignItems: 'center',
  },
  sourceOverviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  sourceOverviewLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sourceBreakdown: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  sourceItem: {
    marginBottom: 16,
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  sourcePercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  sourceMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sourceMetric: {
    alignItems: 'center',
  },
  sourceMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  sourceMetricLabel: {
    fontSize: 10,
    color: '#666',
  },
  sourceProgressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sourceProgress: {
    height: '100%',
  },

  // Live stream performance
  liveStreamSection: {
    marginBottom: 24,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  performanceCard: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  performanceTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  performanceTrendText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },

  // Chart section
  chartSection: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },

  // Top streams
  topStreamsSection: {
    marginBottom: 20,
  },
  streamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  streamRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  streamRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  streamInfo: {
    flex: 1,
  },
  streamTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  streamDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  streamMetrics: {
    alignItems: 'flex-end',
  },
  streamOrders: {
    fontSize: 12,
    color: '#007AFF',
  },
  streamRevenue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#34C759',
    marginTop: 2,
  },

  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default WorkspaceLiveStreamAnalyticsComponent;