import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

interface ChartDataPoint {
  timestamp: number;
  viewers: number;
  revenue: number;
  engagement: number;
}

interface LiveStreamRealtimeChartProps {
  title: string;
  data: ChartDataPoint[];
  maxDataPoints?: number;
  height?: number;
  showLegend?: boolean;
  primaryMetric: 'viewers' | 'revenue' | 'engagement';
  onDataUpdate?: (data: ChartDataPoint[]) => void;
}

/**
 * Real-time Chart Component for Live Stream Analytics
 *
 * Features:
 * - Real-time data visualization
 * - Smooth animations for data updates
 * - Multiple metrics display (viewers, revenue, engagement)
 * - Responsive design
 * - Configurable chart appearance
 */
const LiveStreamRealtimeChart: React.FC<LiveStreamRealtimeChartProps> = ({
  title,
  data,
  maxDataPoints = 20,
  height = 120,
  showLegend = true,
  primaryMetric,
  onDataUpdate,
}) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>(data);
  const [animatedValues, setAnimatedValues] = useState<Animated.Value[]>([]);
  const chartWidth = screenWidth - 60;

  // Initialize animated values
  useEffect(() => {
    const values = chartData.map(() => new Animated.Value(0));
    setAnimatedValues(values);

    // Animate in
    Animated.staggered(
      50,
      values.map((value) =>
        Animated.spring(value, {
          toValue: 1,
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        })
      )
    ).start();
  }, []);

  // Update chart data with animation
  useEffect(() => {
    if (data.length !== chartData.length) {
      // Limit data points
      const limitedData = data.slice(-maxDataPoints);
      setChartData(limitedData);

      // Create new animated values for new data points
      const newValues = limitedData.map((_, index) => {
        const existingValue = animatedValues[index];
        if (existingValue) {
          return existingValue;
        }
        const newValue = new Animated.Value(0);
        Animated.spring(newValue, {
          toValue: 1,
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }).start();
        return newValue;
      });

      setAnimatedValues(newValues);
      onDataUpdate?.(limitedData);
    }
  }, [data]);

  // Calculate chart dimensions and scaling
  const getMaxValue = (metric: keyof ChartDataPoint) => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => d[metric] as number)) || 1;
  };

  const maxViewers = getMaxValue('viewers');
  const maxRevenue = getMaxValue('revenue');
  const maxEngagement = getMaxValue('engagement');

  const getScaledHeight = (value: number, maxValue: number) => {
    return (value / maxValue) * (height - 40);
  };

  const getMetricColor = (metric: string) => {
    switch (metric) {
      case 'viewers': return '#007AFF';
      case 'revenue': return '#34C759';
      case 'engagement': return '#FF9500';
      default: return '#999';
    }
  };

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'viewers':
        return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString();
      case 'revenue':
        return value >= 1000 ? `₣${(value / 1000).toFixed(1)}K` : `₣${value}`;
      case 'engagement':
        return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString();
      default:
        return value.toString();
    }
  };

  // Render chart bars
  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Ionicons name="analytics-outline" size={24} color="#666" />
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      );
    }

    const barWidth = Math.max(2, (chartWidth - (chartData.length * 2)) / chartData.length);

    return (
      <View style={[styles.chart, { height }]}>
        <View style={styles.chartContent}>
          {chartData.map((dataPoint, index) => {
            const animatedValue = animatedValues[index] || new Animated.Value(1);

            return (
              <View key={index} style={styles.barContainer}>
                {/* Viewers Bar */}
                <Animated.View
                  style={[
                    styles.chartBar,
                    {
                      width: barWidth,
                      height: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, getScaledHeight(dataPoint.viewers, maxViewers)],
                      }),
                      backgroundColor: getMetricColor('viewers'),
                      opacity: primaryMetric === 'viewers' ? 1 : 0.6,
                    },
                  ]}
                />

                {/* Revenue Bar */}
                <Animated.View
                  style={[
                    styles.chartBar,
                    {
                      width: barWidth,
                      height: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, getScaledHeight(dataPoint.revenue, maxRevenue)],
                      }),
                      backgroundColor: getMetricColor('revenue'),
                      opacity: primaryMetric === 'revenue' ? 1 : 0.6,
                      marginLeft: 1,
                    },
                  ]}
                />

                {/* Engagement Bar */}
                <Animated.View
                  style={[
                    styles.chartBar,
                    {
                      width: barWidth,
                      height: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, getScaledHeight(dataPoint.engagement, maxEngagement)],
                      }),
                      backgroundColor: getMetricColor('engagement'),
                      opacity: primaryMetric === 'engagement' ? 1 : 0.6,
                      marginLeft: 1,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={styles.axisLabel}>
            {formatValue(primaryMetric === 'viewers' ? maxViewers :
                        primaryMetric === 'revenue' ? maxRevenue : maxEngagement, primaryMetric)}
          </Text>
          <Text style={styles.axisLabel}>0</Text>
        </View>
      </View>
    );
  };

  // Render legend
  const renderLegend = () => {
    if (!showLegend) return null;

    const currentData = chartData[chartData.length - 1];
    if (!currentData) return null;

    return (
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: getMetricColor('viewers') }]} />
          <Text style={styles.legendText}>
            Viewers: {formatValue(currentData.viewers, 'viewers')}
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: getMetricColor('revenue') }]} />
          <Text style={styles.legendText}>
            Revenue: {formatValue(currentData.revenue, 'revenue')}
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: getMetricColor('engagement') }]} />
          <Text style={styles.legendText}>
            Engagement: {formatValue(currentData.engagement, 'engagement')}
          </Text>
        </View>
      </View>
    );
  };

  // Render trend indicator
  const renderTrendIndicator = () => {
    if (chartData.length < 2) return null;

    const current = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];

    const currentValue = current[primaryMetric] as number;
    const previousValue = previous[primaryMetric] as number;

    const change = currentValue - previousValue;
    const percentChange = previousValue > 0 ? (change / previousValue) * 100 : 0;

    const isPositive = change > 0;
    const isNeutral = change === 0;

    return (
      <View style={styles.trendIndicator}>
        <Ionicons
          name={isNeutral ? "remove" : isPositive ? "trending-up" : "trending-down"}
          size={12}
          color={isNeutral ? "#999" : isPositive ? "#34C759" : "#FF3B30"}
        />
        <Text style={[
          styles.trendText,
          { color: isNeutral ? "#999" : isPositive ? "#34C759" : "#FF3B30" }
        ]}>
          {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {renderTrendIndicator()}
      </View>

      {renderChart()}
      {renderLegend()}

      <View style={styles.timeIndicator}>
        <Text style={styles.timeText}>Last {chartData.length} updates</Text>
        <View style={styles.liveDot}>
          <Animated.View
            style={[
              styles.liveDotInner,
              {
                opacity: new Animated.Value(1).interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  chart: {
    position: 'relative',
    marginBottom: 12,
  },
  chartContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingLeft: 20,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartBar: {
    borderRadius: 1,
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  axisLabel: {
    fontSize: 10,
    color: '#666',
  },
  emptyChart: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#999',
  },
  timeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  timeText: {
    fontSize: 10,
    color: '#666',
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
    marginRight: 4,
  },
  liveDotInner: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FF3B30',
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
});

export default LiveStreamRealtimeChart;