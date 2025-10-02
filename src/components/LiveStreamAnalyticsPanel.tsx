import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LiveStreamRealtimeChart from './LiveStreamRealtimeChart';
import LiveStreamLineChart from './LiveStreamLineChart';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LiveStreamAnalyticsData {
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
}

interface AnalyticsChartData {
  labels: string[];
  viewers: number[];
  sales: number[];
  engagement: number[];
}

interface LiveStreamAnalyticsPanelProps {
  streamId: string;
  analyticsData: LiveStreamAnalyticsData;
  chartData: AnalyticsChartData;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Live Stream Analytics Panel
 *
 * Comprehensive analytics dashboard for vendors during live streams with:
 * - Real-time performance metrics
 * - Revenue and engagement tracking
 * - Conversion analytics
 * - Historical trend visualization
 * - Performance insights and recommendations
 */
const LiveStreamAnalyticsPanel: React.FC<LiveStreamAnalyticsPanelProps> = ({
  streamId,
  analyticsData,
  chartData,
  isVisible,
  onClose,
}) => {
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [realtimeChartData, setRealtimeChartData] = useState<Array<{
    timestamp: number;
    viewers: number;
    revenue: number;
    engagement: number;
  }>>([]);
  const [lineChartData, setLineChartData] = useState<{
    viewers: Array<{ timestamp: number; value: number }>;
    revenue: Array<{ timestamp: number; value: number }>;
    engagement: Array<{ timestamp: number; value: number }>;
  }>({
    viewers: [],
    revenue: [],
    engagement: [],
  });

  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  // Update chart data when analytics data changes
  useEffect(() => {
    const timestamp = Date.now();

    // Update realtime chart data
    const newRealtimeData = {
      timestamp,
      viewers: analyticsData.viewerCount,
      revenue: analyticsData.totalSales,
      engagement: analyticsData.engagementCount,
    };

    setRealtimeChartData(prev => {
      const updated = [...prev, newRealtimeData];
      return updated.slice(-20); // Keep last 20 data points
    });

    // Update line chart data
    setLineChartData(prev => ({
      viewers: [...prev.viewers, { timestamp, value: analyticsData.viewerCount }].slice(-20),
      revenue: [...prev.revenue, { timestamp, value: analyticsData.totalSales }].slice(-20),
      engagement: [...prev.engagement, { timestamp, value: analyticsData.engagementCount }].slice(-20),
    }));
  }, [analyticsData]);

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

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Render metric card
  const renderMetricCard = (
    title: string,
    value: string | number,
    subtitle: string,
    icon: string,
    color: string,
    trend?: number
  ) => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={16} color={color} />
        </View>
        <Text style={styles.metricTitle}>{title}</Text>
        {trend !== undefined && (
          <View style={styles.trendIndicator}>
            <Ionicons
              name={trend > 0 ? "trending-up" : trend < 0 ? "trending-down" : "remove"}
              size={12}
              color={trend > 0 ? "#34C759" : trend < 0 ? "#FF3B30" : "#999"}
            />
            <Text style={[styles.trendText, {
              color: trend > 0 ? "#34C759" : trend < 0 ? "#FF3B30" : "#999"
            }]}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );

  // Render simple chart
  const renderChart = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Performance Overview</Text>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
          <Text style={styles.legendText}>Viewers</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
          <Text style={styles.legendText}>Sales</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
          <Text style={styles.legendText}>Engagement</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {chartData.labels.map((label, index) => (
          <View key={index} style={styles.chartColumn}>
            <View style={styles.chartBars}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: (chartData.viewers[index] / Math.max(...chartData.viewers)) * 60,
                    backgroundColor: '#007AFF',
                  },
                ]}
              />
              <View
                style={[
                  styles.chartBar,
                  {
                    height: (chartData.sales[index] / Math.max(...chartData.sales)) * 60,
                    backgroundColor: '#34C759',
                  },
                ]}
              />
              <View
                style={[
                  styles.chartBar,
                  {
                    height: (chartData.engagement[index] / Math.max(...chartData.engagement)) * 60,
                    backgroundColor: '#FF9500',
                  },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Render insights
  const renderInsights = () => {
    const insights = [];

    if (analyticsData.conversionRate > 5) {
      insights.push({
        type: 'success',
        message: `Excellent conversion rate of ${analyticsData.conversionRate.toFixed(1)}%! Your audience is highly engaged.`,
      });
    } else if (analyticsData.conversionRate < 1) {
      insights.push({
        type: 'warning',
        message: 'Consider adding more product showcases or special offers to boost conversions.',
      });
    }

    if (analyticsData.peakViewers > analyticsData.viewerCount * 1.5) {
      insights.push({
        type: 'info',
        message: 'You had a strong peak audience. Try to identify what content drove that engagement.',
      });
    }

    if (analyticsData.giftValue > analyticsData.totalSales * 0.1) {
      insights.push({
        type: 'success',
        message: 'Great gift engagement! Your audience appreciates your content.',
      });
    }

    return (
      <View style={styles.insightsContainer}>
        <Text style={styles.sectionTitle}>💡 Performance Insights</Text>
        {insights.map((insight, index) => (
          <View key={index} style={[styles.insightCard, {
            borderLeftColor: insight.type === 'success' ? '#34C759' :
                             insight.type === 'warning' ? '#FF9500' : '#007AFF'
          }]}>
            <Ionicons
              name={
                insight.type === 'success' ? 'checkmark-circle' :
                insight.type === 'warning' ? 'warning' : 'information-circle'
              }
              size={16}
              color={
                insight.type === 'success' ? '#34C759' :
                insight.type === 'warning' ? '#FF9500' : '#007AFF'
              }
            />
            <Text style={styles.insightText}>{insight.message}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Live Analytics</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            {renderMetricCard(
              'Current Viewers',
              formatNumber(analyticsData.viewerCount),
              'watching now',
              'eye',
              '#007AFF',
              12.5
            )}
            {renderMetricCard(
              'Total Sales',
              formatCurrency(analyticsData.totalSales),
              'revenue earned',
              'cash',
              '#34C759',
              8.3
            )}
          </View>

          <View style={styles.metricsRow}>
            {renderMetricCard(
              'Conversion Rate',
              `${analyticsData.conversionRate.toFixed(1)}%`,
              'viewers to buyers',
              'trending-up',
              '#FF9500',
              5.2
            )}
            {renderMetricCard(
              'Engagement',
              formatNumber(analyticsData.engagementCount),
              'total interactions',
              'heart',
              '#FF3B30',
              15.7
            )}
          </View>

          <View style={styles.metricsRow}>
            {renderMetricCard(
              'Stream Duration',
              formatDuration(analyticsData.streamDuration),
              'time streaming',
              'time',
              '#AF52DE'
            )}
            {renderMetricCard(
              'Peak Viewers',
              formatNumber(analyticsData.peakViewers),
              'highest audience',
              'trending-up',
              '#007AFF'
            )}
          </View>
        </View>

        {/* Real-time Charts */}
        <View style={styles.chartsSection}>
          <Text style={styles.sectionTitle}>📊 Real-time Performance</Text>

          {/* Combined metrics chart */}
          <LiveStreamRealtimeChart
            title="Live Metrics Overview"
            data={realtimeChartData}
            primaryMetric="viewers"
            height={140}
            showLegend={true}
          />

          {/* Individual line charts */}
          <View style={styles.lineChartsGrid}>
            <View style={styles.lineChartContainer}>
              <LiveStreamLineChart
                title="Viewers"
                data={lineChartData.viewers}
                color="#007AFF"
                height={80}
                formatValue={(value) => formatNumber(value)}
                showPoints={false}
              />
            </View>

            <View style={styles.lineChartContainer}>
              <LiveStreamLineChart
                title="Revenue"
                data={lineChartData.revenue}
                color="#34C759"
                height={80}
                formatValue={(value) => formatCurrency(value)}
                showPoints={false}
              />
            </View>

            <View style={styles.lineChartContainer}>
              <LiveStreamLineChart
                title="Engagement"
                data={lineChartData.engagement}
                color="#FF9500"
                height={80}
                formatValue={(value) => formatNumber(value)}
                showPoints={false}
              />
            </View>
          </View>
        </View>

        {/* Performance Chart */}
        {renderChart()}

        {/* Detailed Metrics */}
        <View style={styles.detailedMetrics}>
          <Text style={styles.sectionTitle}>📈 Detailed Metrics</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailValue}>{formatNumber(analyticsData.totalViewers)}</Text>
              <Text style={styles.detailLabel}>Total Unique Viewers</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailValue}>{formatDuration(analyticsData.averageWatchTime)}</Text>
              <Text style={styles.detailLabel}>Avg Watch Time</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailValue}>{analyticsData.commentCount}</Text>
              <Text style={styles.detailLabel}>Comments</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailValue}>{analyticsData.reactionCount}</Text>
              <Text style={styles.detailLabel}>Reactions</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailValue}>{analyticsData.giftCount}</Text>
              <Text style={styles.detailLabel}>Gifts Received</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailValue}>{formatCurrency(analyticsData.giftValue)}</Text>
              <Text style={styles.detailLabel}>Gift Value</Text>
            </View>
          </View>
        </View>

        {/* Insights */}
        {renderInsights()}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.8,
    backgroundColor: '#000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 2000,
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

  // Metrics grid
  metricsGrid: {
    marginVertical: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    borderLeftWidth: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  metricTitle: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 11,
    color: '#666',
  },

  // Chart styles
  chartContainer: {
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
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#999',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    marginBottom: 8,
  },
  chartBar: {
    width: 4,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  chartLabel: {
    fontSize: 10,
    color: '#666',
  },

  // Detailed metrics
  detailedMetrics: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Insights
  insightsContainer: {
    marginBottom: 20,
  },
  insightCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
  },
  insightText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },

  // Charts section
  chartsSection: {
    marginBottom: 20,
  },
  lineChartsGrid: {
    marginTop: 8,
  },
  lineChartContainer: {
    marginBottom: 8,
  },
});

export default LiveStreamAnalyticsPanel;