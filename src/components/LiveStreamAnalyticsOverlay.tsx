import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LiveStreamLineChart from './LiveStreamLineChart';

const { width: screenWidth } = Dimensions.get('window');

interface LiveStreamAnalyticsData {
  viewerCount: number;
  totalSales: number;
  engagementCount: number;
  giftCount: number;
  conversionRate: number;
  streamDuration: number;
}

interface LiveStreamAnalyticsOverlayProps {
  streamId: string;
  isVendor: boolean;
  analyticsData: LiveStreamAnalyticsData;
  onToggleDetails?: () => void;
}

/**
 * Live Stream Analytics Overlay
 *
 * Real-time analytics display overlay for live streams with:
 * - Key performance metrics for vendors
 * - Compact viewer-friendly display
 * - Expandable detailed view
 * - Real-time updates via WebSocket
 * - Performance insights and trends
 */
const LiveStreamAnalyticsOverlay: React.FC<LiveStreamAnalyticsOverlayProps> = ({
  streamId,
  isVendor,
  analyticsData,
  onToggleDetails,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedHeight] = useState(new Animated.Value(0));
  const [chartData, setChartData] = useState<Array<{ timestamp: number; value: number }>>([]);

  // Update chart data when analytics change
  useEffect(() => {
    const timestamp = Date.now();
    const newDataPoint = {
      timestamp,
      value: analyticsData.viewerCount,
    };

    setChartData(prev => {
      const updated = [...prev, newDataPoint];
      return updated.slice(-15); // Keep last 15 data points for compact display
    });
  }, [analyticsData.viewerCount]);

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
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Toggle expanded view
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);

    Animated.timing(animatedHeight, {
      toValue: !isExpanded ? 120 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    onToggleDetails?.();
  };

  // Render compact metrics for vendors
  const renderVendorMetrics = () => (
    <View style={styles.vendorMetrics}>
      <View style={styles.metricItem}>
        <Ionicons name="eye" size={12} color="#34C759" />
        <Text style={styles.metricText}>{formatNumber(analyticsData.viewerCount)}</Text>
      </View>

      <View style={styles.metricItem}>
        <Ionicons name="cash" size={12} color="#FFD700" />
        <Text style={styles.metricText}>{formatCurrency(analyticsData.totalSales)}</Text>
      </View>

      <View style={styles.metricItem}>
        <Ionicons name="heart" size={12} color="#FF3B30" />
        <Text style={styles.metricText}>{formatNumber(analyticsData.engagementCount)}</Text>
      </View>

      <View style={styles.metricItem}>
        <Ionicons name="gift" size={12} color="#AF52DE" />
        <Text style={styles.metricText}>{analyticsData.giftCount}</Text>
      </View>

      <TouchableOpacity onPress={toggleExpanded} style={styles.expandButton}>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={14}
          color="white"
        />
      </TouchableOpacity>
    </View>
  );

  // Render expanded analytics
  const renderExpandedAnalytics = () => (
    <Animated.View style={[styles.expandedAnalytics, { height: animatedHeight }]}>
      <View style={styles.expandedMetricsGrid}>
        <View style={styles.expandedMetric}>
          <Text style={styles.expandedMetricValue}>{analyticsData.conversionRate.toFixed(1)}%</Text>
          <Text style={styles.expandedMetricLabel}>Conversion Rate</Text>
        </View>

        <View style={styles.expandedMetric}>
          <Text style={styles.expandedMetricValue}>{formatDuration(analyticsData.streamDuration)}</Text>
          <Text style={styles.expandedMetricLabel}>Stream Duration</Text>
        </View>

        <View style={styles.expandedMetric}>
          <Text style={styles.expandedMetricValue}>
            {analyticsData.totalSales > 0 ?
              formatCurrency(analyticsData.totalSales / analyticsData.viewerCount) : '₣0'}
          </Text>
          <Text style={styles.expandedMetricLabel}>Revenue per Viewer</Text>
        </View>

        <View style={styles.expandedMetric}>
          <Text style={styles.expandedMetricValue}>
            {analyticsData.viewerCount > 0 ?
              (analyticsData.engagementCount / analyticsData.viewerCount).toFixed(1) : '0'}
          </Text>
          <Text style={styles.expandedMetricLabel}>Engagement Rate</Text>
        </View>
      </View>

      <View style={styles.performanceIndicator}>
        <View style={styles.performanceBar}>
          <View
            style={[
              styles.performanceBarFill,
              {
                width: `${Math.min(analyticsData.conversionRate * 20, 100)}%`,
                backgroundColor: analyticsData.conversionRate > 3 ? '#34C759' :
                                analyticsData.conversionRate > 1 ? '#FF9500' : '#FF3B30'
              }
            ]}
          />
        </View>
        <Text style={styles.performanceText}>
          {analyticsData.conversionRate > 3 ? 'Excellent Performance' :
           analyticsData.conversionRate > 1 ? 'Good Performance' : 'Needs Improvement'}
        </Text>
      </View>

      {/* Mini Viewer Trend Chart */}
      <View style={styles.miniChartContainer}>
        <LiveStreamLineChart
          title="Viewer Trend"
          data={chartData}
          color="#34C759"
          height={50}
          showPoints={false}
          animated={false}
          formatValue={(value) => formatNumber(value)}
        />
      </View>
    </Animated.View>
  );

  // Render viewer-only display (minimal)
  const renderViewerDisplay = () => (
    <View style={styles.viewerDisplay}>
      <View style={styles.viewerMetric}>
        <Ionicons name="eye" size={12} color="#34C759" />
        <Text style={styles.viewerMetricText}>{formatNumber(analyticsData.viewerCount)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isVendor ? (
        <>
          {renderVendorMetrics()}
          {isExpanded && renderExpandedAnalytics()}
        </>
      ) : (
        renderViewerDisplay()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backdropFilter: 'blur(10px)',
    zIndex: 1000,
  },

  // Vendor metrics styles
  vendorMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
  expandButton: {
    padding: 4,
  },

  // Expanded analytics styles
  expandedAnalytics: {
    marginTop: 12,
    overflow: 'hidden',
  },
  expandedMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  expandedMetric: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 8,
  },
  expandedMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  expandedMetricLabel: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },

  // Performance indicator styles
  performanceIndicator: {
    alignItems: 'center',
  },
  performanceBar: {
    width: 100,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  performanceBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  performanceText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },

  // Mini chart styles
  miniChartContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },

  // Viewer display styles
  viewerDisplay: {
    alignItems: 'center',
  },
  viewerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerMetricText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
  },
});

export default LiveStreamAnalyticsOverlay;