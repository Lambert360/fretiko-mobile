import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LineChartProps {
  data: number[];
  labels?: string[];
  width?: number;
  height?: number;
  color?: string;
  showGradient?: boolean;
  showDots?: boolean;
  showGrid?: boolean;
  strokeWidth?: number;
  animated?: boolean;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  labels = [],
  width = Dimensions.get('window').width - 64,
  height = 120,
  color = '#007AFF',
  showGradient = true,
  showDots = true,
  showGrid = true,
  strokeWidth = 2,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  // Calculate chart dimensions
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Find min and max values for scaling
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const valueRange = maxValue - minValue || 1; // Avoid division by zero

  // Calculate points for the line
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    return { x, y, value };
  });

  // Create SVG path for the line
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    
    // Smooth curve using quadratic bezier curves
    const prevPoint = points[index - 1];
    const controlX = (prevPoint.x + point.x) / 2;
    
    return `${path} Q ${controlX} ${prevPoint.y}, ${controlX} ${(prevPoint.y + point.y) / 2} Q ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  // Create gradient fill path
  const gradientPath = showGradient
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`
    : '';

  // Grid lines (horizontal)
  const gridLines = showGrid ? [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padding + chartHeight * ratio;
    return { y, value: maxValue - valueRange * ratio };
  }) : [];

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {showGrid && gridLines.map((line, index) => (
          <Line
            key={`grid-${index}`}
            x1={padding}
            y1={line.y}
            x2={width - padding}
            y2={line.y}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ))}

        {/* Gradient fill */}
        {showGradient && (
          <Path
            d={gradientPath}
            fill="url(#lineGradient)"
          />
        )}

        {/* Main line */}
        <Path
          d={linePath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots at data points */}
        {showDots && points.map((point, index) => (
          <React.Fragment key={`dot-${index}`}>
            {/* Outer glow */}
            <Circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill={color}
              opacity={0.2}
            />
            {/* Inner dot */}
            <Circle
              cx={point.x}
              cy={point.y}
              r={3}
              fill={color}
              stroke="#000"
              strokeWidth={1.5}
            />
          </React.Fragment>
        ))}
      </Svg>

      {/* Labels */}
      {labels.length > 0 && (
        <View style={styles.labelsContainer}>
          {labels.map((label, index) => (
            <Text key={`label-${index}`} style={styles.label}>
              {label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'visible',
  },
  noDataText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  label: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default LineChart;

