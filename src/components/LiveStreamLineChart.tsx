import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

interface LineChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

interface LiveStreamLineChartProps {
  title: string;
  data: LineChartDataPoint[];
  color?: string;
  height?: number;
  maxDataPoints?: number;
  showPoints?: boolean;
  animated?: boolean;
  formatValue?: (value: number) => string;
  suffix?: string;
}

/**
 * Real-time Line Chart Component for Live Stream Analytics
 *
 * Features:
 * - Smooth line animations
 * - Real-time data updates
 * - Customizable styling
 * - Value formatting
 * - Interactive points
 */
const LiveStreamLineChart: React.FC<LiveStreamLineChartProps> = ({
  title,
  data,
  color = '#007AFF',
  height = 100,
  maxDataPoints = 20,
  showPoints = true,
  animated = true,
  formatValue,
  suffix = '',
}) => {
  const [chartData, setChartData] = useState<LineChartDataPoint[]>(data);
  const [animatedValue] = useState(new Animated.Value(0));

  const chartWidth = screenWidth - 80;
  const chartHeight = height - 20;
  const padding = 20;

  // Update chart data and animate
  useEffect(() => {
    const limitedData = data.slice(-maxDataPoints);
    setChartData(limitedData);

    if (animated) {
      animatedValue.setValue(0);
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [data]);

  // Calculate chart scaling
  const getMinMaxValues = () => {
    if (chartData.length === 0) return { min: 0, max: 1 };

    const values = chartData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Add some padding to the range
    const range = max - min;
    const paddedMin = min - range * 0.1;
    const paddedMax = max + range * 0.1;

    return {
      min: Math.max(0, paddedMin),
      max: paddedMax || 1,
    };
  };

  const { min: minValue, max: maxValue } = getMinMaxValues();

  // Convert data value to chart coordinate
  const getYCoordinate = (value: number) => {
    const ratio = (value - minValue) / (maxValue - minValue);
    return chartHeight - (ratio * chartHeight) + padding;
  };

  const getXCoordinate = (index: number) => {
    if (chartData.length <= 1) return padding;
    return padding + (index / (chartData.length - 1)) * (chartWidth - padding * 2);
  };

  // Generate SVG path for line
  const generatePath = () => {
    if (chartData.length === 0) return '';

    let path = '';

    chartData.forEach((point, index) => {
      const x = getXCoordinate(index);
      const y = getYCoordinate(point.value);

      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        // Create smooth curves using quadratic bezier
        const prevX = getXCoordinate(index - 1);
        const prevY = getYCoordinate(chartData[index - 1].value);

        const controlX = (prevX + x) / 2;
        const controlY = (prevY + y) / 2;

        path += ` Q ${controlX} ${prevY} ${x} ${y}`;
      }
    });

    return path;
  };

  // Generate area fill path
  const generateAreaPath = () => {
    if (chartData.length === 0) return '';

    let path = generatePath();

    if (chartData.length > 0) {
      const lastX = getXCoordinate(chartData.length - 1);
      const firstX = getXCoordinate(0);
      const bottomY = chartHeight + padding;

      path += ` L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    }

    return path;
  };

  // Format display value
  const displayValue = (value: number) => {
    if (formatValue) return formatValue(value);

    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M${suffix}`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K${suffix}`;
    }
    return `${value}${suffix}`;
  };

  // Get current value
  const getCurrentValue = () => {
    if (chartData.length === 0) return 0;
    return chartData[chartData.length - 1].value;
  };

  // Get trend information
  const getTrend = () => {
    if (chartData.length < 2) return { direction: 'neutral', change: 0 };

    const current = chartData[chartData.length - 1].value;
    const previous = chartData[chartData.length - 2].value;
    const change = current - previous;
    const percentChange = previous > 0 ? (change / previous) * 100 : 0;

    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      change: percentChange,
    };
  };

  const trend = getTrend();

  if (chartData.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>--</Text>
        </View>
        <View style={[styles.chart, { height }]}>
          <Text style={styles.noDataText}>No data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{displayValue(getCurrentValue())}</Text>
          <View style={[
            styles.trendContainer,
            { backgroundColor: trend.direction === 'up' ? '#34C759' :
                              trend.direction === 'down' ? '#FF3B30' : '#999' }
          ]}>
            <Text style={styles.trendText}>
              {trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'}
              {Math.abs(trend.change).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.chart, { height }]}>
        <Svg width={chartWidth} height={height}>
          {/* Area fill */}
          <Path
            d={generateAreaPath()}
            fill={`${color}20`}
            stroke="none"
          />

          {/* Main line */}
          <Path
            d={generatePath()}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {showPoints && chartData.map((point, index) => (
            <Circle
              key={index}
              cx={getXCoordinate(index)}
              cy={getYCoordinate(point.value)}
              r={3}
              fill={color}
              stroke="white"
              strokeWidth={1}
            />
          ))}

          {/* Value labels for key points */}
          {chartData.length > 0 && (
            <>
              {/* First point */}
              <SvgText
                x={getXCoordinate(0)}
                y={getYCoordinate(chartData[0].value) - 10}
                fontSize={10}
                fill="#999"
                textAnchor="middle"
              >
                {displayValue(chartData[0].value)}
              </SvgText>

              {/* Last point */}
              <SvgText
                x={getXCoordinate(chartData.length - 1)}
                y={getYCoordinate(chartData[chartData.length - 1].value) - 10}
                fontSize={10}
                fill="#999"
                textAnchor="middle"
              >
                {displayValue(chartData[chartData.length - 1].value)}
              </SvgText>
            </>
          )}
        </Svg>

        {/* Time indicators */}
        <View style={styles.timeLabels}>
          <Text style={styles.timeLabel}>
            {chartData.length > 0 ? `${chartData.length} points` : '--'}
          </Text>
          <Text style={styles.timeLabel}>Now</Text>
        </View>
      </View>

      {/* Summary stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>{displayValue(minValue)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>{displayValue(maxValue)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg</Text>
          <Text style={styles.statValue}>
            {displayValue(chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length)}
          </Text>
        </View>
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
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 8,
  },
  trendContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  chart: {
    position: 'relative',
  },
  noDataText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    marginTop: 40,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  timeLabel: {
    fontSize: 10,
    color: '#666',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
});

export default LiveStreamLineChart;