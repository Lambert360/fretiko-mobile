import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Dimensions,
  TextInput,
  Linking,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { analyticsAPI, AnalyticsData, AnalyticsPeriod, LiveStreamingAnalytics, AuctionAnalytics, AnalyticsSummary, CustomerAnalytics, ProductAnalytics, RealtimeAnalytics, AnalyticsComparison, StreamRealTimeAnalytics, VendorRealTimeMetrics, AnalyticsReport } from '../services/analyticsAPI';
import { walletAPI, SalesAnalytics } from '../services/walletAPI';
import LineChart from '../components/LineChart';

const { width: screenWidth } = Dimensions.get('window');

const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<'overview' | 'livestream' | 'auctions' | 'sales' | 'products' | 'customers'>('overview');
  const [activePeriod, setActivePeriod] = useState<AnalyticsPeriod>('daily');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [liveStreamingData, setLiveStreamingData] = useState<LiveStreamingAnalytics | null>(null);
  const [auctionData, setAuctionData] = useState<AuctionAnalytics | null>(null);
  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
  const [productData, setProductData] = useState<ProductAnalytics | null>(null);
  const [customerData, setCustomerData] = useState<CustomerAnalytics | null>(null);
  const [realtimeData, setRealtimeData] = useState<RealtimeAnalytics | null>(null);
  const [summaryData, setSummaryData] = useState<AnalyticsSummary | null>(null);
  const [comparisonData, setComparisonData] = useState<AnalyticsComparison | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [vendorRealtime, setVendorRealtime] = useState<VendorRealTimeMetrics | null>(null);
  const [streamDrilldown, setStreamDrilldown] = useState<StreamRealTimeAnalytics | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [reportsList, setReportsList] = useState<AnalyticsReport[]>([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [reportSource, setReportSource] = useState<'all' | 'regular' | 'live_stream' | 'auctions' | 'invoice' | 'wishlist'>('all');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAnalyticsData();
  }, [activePeriod, currentDate, activeTab]);

  const loadAnalyticsData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      if (activeTab === 'overview') {
        const data = await analyticsAPI.getAnalytics(activePeriod, currentDate);
        setAnalyticsData(data);
        // Supporting panels load in parallel — non-blocking failures are fine
        const [rt, summary, reports] = await Promise.allSettled([
          analyticsAPI.getRealTimeAnalytics(),
          analyticsAPI.getAnalyticsSummary(),
          analyticsAPI.getReports(),
        ]);
        if (rt.status === 'fulfilled') setRealtimeData(rt.value);
        if (summary.status === 'fulfilled') setSummaryData(summary.value);
        if (reports.status === 'fulfilled') setReportsList(reports.value);
        if (compareMode) loadComparison();
      } else if (activeTab === 'livestream') {
        const liveData = await analyticsAPI.getLiveStreamingAnalytics(activePeriod, currentDate);
        setLiveStreamingData(liveData);
        const vendorRt = await analyticsAPI.getVendorRealTimeMetrics().catch(() => null);
        if (vendorRt) setVendorRealtime(vendorRt);
      } else if (activeTab === 'auctions') {
        const auctionDataResult = await analyticsAPI.getAuctionAnalytics(activePeriod, currentDate);
        setAuctionData(auctionDataResult);
      } else if (activeTab === 'sales') {
        const salesDataResult = await walletAPI.getSalesAnalytics({ period: activePeriod });
        setSalesData(salesDataResult);
      } else if (activeTab === 'products') {
        const productDataResult = await analyticsAPI.getProductAnalytics(activePeriod);
        setProductData(productDataResult);
      } else if (activeTab === 'customers') {
        const customerDataResult = await analyticsAPI.getCustomerAnalytics(activePeriod);
        setCustomerData(customerDataResult);
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadComparison = async () => {
    try {
      // Compare current period against the previous same-length period
      const prev = new Date(currentDate);
      if (activePeriod === 'daily') prev.setDate(prev.getDate() - 1);
      else if (activePeriod === 'weekly') prev.setDate(prev.getDate() - 7);
      else prev.setMonth(prev.getMonth() - 1);
      const result = await analyticsAPI.getAnalyticsComparison(activePeriod, currentDate, prev);
      setComparisonData(result);
    } catch (error) {
      console.error('Error loading comparison:', error);
      setComparisonData(null);
    }
  };

  const openStreamDrilldown = async (streamId: string) => {
    setDrilldownLoading(true);
    try {
      const data = await analyticsAPI.getRealTimeLiveStreamAnalytics(streamId);
      setStreamDrilldown(data);
    } catch (error) {
      console.error('Error loading stream drilldown:', error);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportGenerating(true);
    try {
      await analyticsAPI.generateReport(
        reportType,
        currentDate,
        undefined,
        reportFormat,
        reportSource
      );
      setReportModalVisible(false);
      const reports = await analyticsAPI.getReports().catch(() => []);
      setReportsList(reports);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setReportGenerating(false);
    }
  };

  const handleDownloadReport = async (report: AnalyticsReport) => {
    try {
      const { downloadUrl, format } = await analyticsAPI.downloadReport(report.id);
      if (!downloadUrl) {
        Alert.alert('Report not ready', 'This report has no download link yet. Try again in a moment.');
        return;
      }

      // Download to device cache, then open the share sheet so the user can
      // save to Files / Drive / open in a viewer — instead of dumping them
      // into a browser tab pointed at the storage URL.
      const ext = format === 'excel' ? 'xlsx'
        : ['pdf', 'csv', 'json', 'xlsx'].includes(format || '')
          ? format
          : downloadUrl.split('.').pop()?.split('?')[0] || 'pdf';
      const mimeType = ext === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ext === 'csv' ? 'text/csv'
        : ext === 'json' ? 'application/json'
        : 'application/pdf';

      const safeTitle = (report.title || 'analytics-report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'analytics-report';
      const fileName = `fretiko-${safeTitle}.${ext}`;
      const localUri = `${FileSystem.cacheDirectory}${fileName}`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri);

      if (await Sharing.isAvailableAsync().catch(() => false)) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType,
          dialogTitle: report.title || 'Fretiko Report',
        });
      } else {
        await Linking.openURL(downloadUrl);
      }
    } catch (error: any) {
      console.error('Error downloading report:', error);
      const msg = String(error?.message || '');
      if (msg.includes('REPORT_NOT_READY') || msg.includes('202')) {
        Alert.alert('Report not ready', 'The report is still being generated. Please try again shortly.');
      } else {
        Alert.alert('Download failed', 'Could not download the report. Please try again.');
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalyticsData(false);
  };

  const formatCurrency = (amount: number) => walletAPI.formatFreti(amount);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getChannelInfo = (source: string) => {
    switch (source) {
      case 'regular': return { label: 'Store', icon: 'storefront-outline', color: '#007AFF' };
      case 'live_stream': return { label: 'Live', icon: 'videocam-outline', color: '#FF2D92' };
      case 'auction': return { label: 'Auction', icon: 'hammer-outline', color: '#FF9500' };
      case 'service_booking': return { label: 'Service', icon: 'construct-outline', color: '#34C759' };
      case 'invoice': return { label: 'Chat', icon: 'chatbubble-ellipses-outline', color: '#5856D6' };
      case 'wishlist': return { label: 'Gift', icon: 'gift-outline', color: '#FF2D55' };
      default: return { label: source, icon: 'cube-outline', color: '#8E8E93' };
    }
  };

  const getPeriodText = () => {
    const options: Intl.DateTimeFormatOptions = activePeriod === 'daily'
      ? { weekday: 'short', day: '2-digit', month: 'short' }
      : activePeriod === 'weekly'
      ? { day: '2-digit', month: 'short', year: 'numeric' }
      : { month: 'long', year: 'numeric' };

    return currentDate.toLocaleDateString('en-US', options);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    if (activePeriod === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (activePeriod === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }

    setCurrentDate(newDate);
  };

  const renderTrendChip = (change: number | undefined | null) => {
    if (change === undefined || change === null) return null;
    const positive = change >= 0;
    return (
      <View style={[styles.trendChip, { backgroundColor: positive ? '#34C75920' : '#FF3B3020' }]}>
        <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={10} color={positive ? '#34C759' : '#FF3B30'} />
        <Text style={[styles.trendChipText, { color: positive ? '#34C759' : '#FF3B30' }]}>
          {Math.abs(change).toFixed(1)}%
        </Text>
      </View>
    );
  };

  const renderMetricCard = (
    title: string,
    value: string | number,
    subtitle: string,
    icon: string,
    color: string,
    showChart?: boolean,
    trend?: number | null
  ) => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <Text style={styles.metricTitle}>{title}</Text>
        {renderTrendChip(trend)}
      </View>

      <Text style={styles.metricValue}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </Text>

      <Text style={styles.metricSubtitle}>{subtitle}</Text>

      {showChart && analyticsData?.chartData && (
        <View style={styles.miniChart}>
          <LineChart
            data={analyticsData.chartData.values.slice(-7)}
            width={140}
            height={50}
            color={color}
            showGradient={true}
            showDots={false}
            showGrid={false}
            strokeWidth={2}
          />
        </View>
      )}
    </View>
  );

  const renderReportItem = (report: AnalyticsReport, index: number) => (
    <TouchableOpacity
      key={report.id || index}
      style={styles.reportItem}
      onPress={() => report.status === 'completed' && handleDownloadReport(report)}
      disabled={report.status !== 'completed'}
    >
      <View style={styles.reportIcon}>
        <Ionicons name="document-text-outline" size={16} color="#666" />
      </View>
      <View style={styles.reportInfo}>
        <Text style={styles.reportTitle}>{report.title}</Text>
        <Text style={styles.reportSubtitle}>{report.subtitle}</Text>
      </View>
      <View style={styles.reportStatus}>
        {report.status === 'completed' ? (
          <Ionicons name="download-outline" size={16} color="#34C759" />
        ) : (
          <View style={[styles.statusDot, { backgroundColor: report.status === 'processing' ? '#FF9500' : '#FF3B30' }]} />
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance reports</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContainer}
      >
        {([
          { key: 'overview', label: 'Overview', icon: 'analytics-outline' },
          { key: 'livestream', label: 'Live Streams', icon: 'videocam-outline' },
          { key: 'auctions', label: 'Auctions', icon: 'hammer-outline' },
          { key: 'sales', label: 'Sales', icon: 'cash-outline' },
          { key: 'products', label: 'Products', icon: 'cube-outline' },
          { key: 'customers', label: 'Customers', icon: 'people-outline' },
        ] as const).map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.activeTab]}
            onPress={() => setActiveTab(key)}
          >
            <Ionicons
              name={icon}
              size={16}
              color={activeTab === key ? '#007AFF' : '#666'}
            />
            <Text
              style={[styles.tabText, activeTab === key && styles.activeTabText]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="white"
            colors={['#007AFF']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Analytics Header */}
        <View style={styles.analyticsHeader}>
          <Text style={styles.analyticsSubtitle}>Unified analytics across all sales channels</Text>
          <View style={styles.channelTags}>
            <View style={[styles.channelTag, { backgroundColor: '#007AFF' }]}>
              <Ionicons name="storefront-outline" size={12} color="white" />
              <Text style={styles.channelTagText}>Store</Text>
            </View>
            <View style={[styles.channelTag, { backgroundColor: '#FF2D92' }]}>
              <Ionicons name="videocam-outline" size={12} color="white" />
              <Text style={styles.channelTagText}>Live</Text>
            </View>
            <View style={[styles.channelTag, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="hammer-outline" size={12} color="white" />
              <Text style={styles.channelTagText}>Auction</Text>
            </View>
            <View style={[styles.channelTag, { backgroundColor: '#34C759' }]}>
              <Ionicons name="construct-outline" size={12} color="white" />
              <Text style={styles.channelTagText}>Service</Text>
            </View>
            <View style={[styles.channelTag, { backgroundColor: '#5856D6' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={12} color="white" />
              <Text style={styles.channelTagText}>Chat</Text>
            </View>
            <View style={[styles.channelTag, { backgroundColor: '#FF2D55' }]}>
              <Ionicons name="gift-outline" size={12} color="white" />
              <Text style={styles.channelTagText}>Gift</Text>
            </View>
          </View>
        </View>

        {/* Period Tabs */}
        <View style={styles.periodTabs}>
          {(['daily', 'weekly', 'monthly'] as AnalyticsPeriod[]).map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.periodTab, activePeriod === period && styles.activePeriodTab]}
              onPress={() => setActivePeriod(period)}
            >
              <Text style={[styles.periodTabText, activePeriod === period && styles.activePeriodTabText]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date Navigation */}
        <View style={styles.dateNavigation}>
          <Text style={styles.todayLabel}>Today</Text>
          <View style={styles.dateControls}>
            <TouchableOpacity onPress={() => navigateDate('prev')} style={styles.dateButton}>
              <Ionicons name="chevron-back" size={20} color="white" />
            </TouchableOpacity>
            <Text style={styles.currentDate}>{getPeriodText()}</Text>
            <TouchableOpacity onPress={() => navigateDate('next')} style={styles.dateButton}>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content based on active tab */}
        {activeTab === 'overview' ? (
          analyticsData && (
            <React.Fragment>
              {/* Today / realtime strip */}
              {realtimeData && (
                <View style={styles.realtimeStrip}>
                  <View style={styles.realtimeItem}>
                    <Ionicons name="flash" size={14} color="#FFD700" />
                    <Text style={styles.realtimeValue}>{formatCurrency(realtimeData.todayRevenue)}</Text>
                    <Text style={styles.realtimeLabel}>Today</Text>
                  </View>
                  <View style={styles.realtimeItem}>
                    <Ionicons name="bag-handle" size={14} color="#007AFF" />
                    <Text style={styles.realtimeValue}>{realtimeData.activeOrders}</Text>
                    <Text style={styles.realtimeLabel}>Active</Text>
                  </View>
                  <View style={styles.realtimeItem}>
                    <Ionicons name="time" size={14} color="#FF9500" />
                    <Text style={styles.realtimeValue}>{realtimeData.pendingOrders}</Text>
                    <Text style={styles.realtimeLabel}>Pending</Text>
                  </View>
                  <View style={styles.realtimeItem}>
                    <Ionicons name="people" size={14} color="#34C759" />
                    <Text style={styles.realtimeValue}>{realtimeData.onlineCustomers}</Text>
                    <Text style={styles.realtimeLabel}>Customers</Text>
                  </View>
                </View>
              )}

              {/* Compare toggle */}
              <TouchableOpacity
                style={[styles.compareToggle, compareMode && styles.compareToggleActive]}
                onPress={() => {
                  const next = !compareMode;
                  setCompareMode(next);
                  if (next && !comparisonData) loadComparison();
                }}
              >
                <Ionicons name="git-compare-outline" size={14} color={compareMode ? '#fff' : '#007AFF'} />
                <Text style={[styles.compareToggleText, compareMode && { color: '#fff' }]}>
                  {compareMode ? 'Comparing to previous period' : 'Compare with previous period'}
                </Text>
              </TouchableOpacity>

              {/* Comparison results */}
              {compareMode && comparisonData && (
                <View style={styles.comparisonCard}>
                  <Text style={styles.sectionTitle}>vs. previous {activePeriod === 'daily' ? 'day' : activePeriod === 'weekly' ? 'week' : 'month'}</Text>
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonLabel}>Revenue</Text>
                    <Text style={styles.comparisonValue}>{formatCurrency(comparisonData.comparison.revenue)}</Text>
                    {renderTrendChip(comparisonData.changes.revenueChange)}
                  </View>
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonLabel}>Orders</Text>
                    <Text style={styles.comparisonValue}>{comparisonData.comparison.ordersProcessed}</Text>
                    {renderTrendChip(comparisonData.changes.ordersChange)}
                  </View>
                  <View style={styles.comparisonRow}>
                    <Text style={styles.comparisonLabel}>Customers</Text>
                    <Text style={styles.comparisonValue}>{comparisonData.comparison.activeCustomers}</Text>
                    {renderTrendChip(comparisonData.changes.customersChange)}
                  </View>
                </View>
              )}

              {/* Metrics Grid */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricsRow}>
              {renderMetricCard(
                'Orders processed',
                analyticsData.ordersProcessed,
                'orders',
                'bag-outline',
                '#007AFF',
                false,
                analyticsData.trends?.ordersChange
              )}
              {renderMetricCard(
                'Transaction value',
                formatCurrency(analyticsData.transactionValue),
                'in value',
                'trending-up-outline',
                '#FF9500',
                true
              )}
            </View>

            <View style={styles.metricsRow}>
              {renderMetricCard(
                'Transaction count',
                analyticsData.transactionCount,
                'transactions',
                'swap-horizontal-outline',
                '#007AFF'
              )}
              {renderMetricCard(
                'Revenue',
                formatCurrency(analyticsData.revenue),
                'in value',
                'cash-outline',
                '#34C759',
                false,
                analyticsData.trends?.revenueChange
              )}
            </View>

            <View style={styles.metricsRow}>
              {renderMetricCard(
                'Active customers',
                analyticsData.activeCustomers,
                'customers served',
                'people-outline',
                '#34C759',
                false,
                analyticsData.trends?.customersChange
              )}
              {renderMetricCard(
                'Avg. order value',
                formatCurrency(analyticsData.averageOrderValue),
                'per order',
                'calculator-outline',
                '#FF9500'
              )}
            </View>

            <View style={styles.metricsRow}>
              {renderMetricCard(
                'Completion rate',
                `${(analyticsData.completionRate || 0).toFixed(1)}%`,
                'orders delivered',
                'checkmark-circle-outline',
                '#007AFF'
              )}
              {renderMetricCard(
                'Satisfaction',
                analyticsData.customerSatisfaction > 0
                  ? `${analyticsData.customerSatisfaction.toFixed(1)} ★`
                  : 'N/A',
                'average rating',
                'star-outline',
                '#FFD700'
              )}
            </View>
          </View>

        {/* Sales by Channel */}
        {analyticsData.sourceBreakdown && Object.keys(analyticsData.sourceBreakdown).length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Sales by Channel</Text>
            {Object.entries(analyticsData.sourceBreakdown)
              .sort(([, a], [, b]) => b.revenue - a.revenue)
              .map(([source, data]) => {
                const info = getChannelInfo(source);
                return (
                  <View key={source} style={styles.channelRow}>
                    <View style={styles.channelRowLeft}>
                      <Ionicons name={info.icon as any} size={16} color={info.color} />
                      <Text style={styles.channelRowLabel}>{info.label}</Text>
                    </View>
                    <View style={styles.channelRowRight}>
                      <Text style={styles.channelRowOrders}>{data.orders} orders</Text>
                      <Text style={styles.channelRowRevenue}>{formatCurrency(data.revenue)}</Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {/* All-time summary */}
        {summaryData && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>All Time</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatCurrency(summaryData.totalRevenue)}</Text>
                <Text style={styles.summaryLabel}>Lifetime revenue</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatNumber(summaryData.totalOrders)}</Text>
                <Text style={styles.summaryLabel}>Lifetime orders</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatNumber(summaryData.totalCustomers)}</Text>
                <Text style={styles.summaryLabel}>Customers</Text>
              </View>
            </View>
            {summaryData.topSellingProducts?.length > 0 && (
              <View style={styles.topSellingList}>
                <Text style={styles.subsectionTitle}>Top Selling Products</Text>
                {summaryData.topSellingProducts.slice(0, 5).map((p, i) => (
                  <View key={p.id || i} style={styles.channelRow}>
                    <View style={styles.channelRowLeft}>
                      <Text style={styles.rankBadge}>#{i + 1}</Text>
                      <Text style={styles.channelRowLabel} numberOfLines={1}>{p.name}</Text>
                    </View>
                    <View style={styles.channelRowRight}>
                      <Text style={styles.channelRowOrders}>{p.quantitySold} sold</Text>
                      <Text style={styles.channelRowRevenue}>{formatCurrency(p.revenue)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Reports Section — real generated reports */}
        <View style={styles.reportsSection}>
          <View style={styles.reportsHeaderRow}>
            <Text style={styles.reportsTitle}>
              Reports ({reportsList.length})
            </Text>
            <TouchableOpacity
              style={styles.generateButton}
              onPress={() => setReportModalVisible(true)}
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.generateButtonText}>Generate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search reports"
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.reportsList}>
            {reportsList
              .filter(r => !searchQuery || (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((report, index) => renderReportItem(report, index))}
            {reportsList.length === 0 && (
              <Text style={styles.emptyReportsText}>No reports yet — tap Generate to create one.</Text>
            )}
          </View>
        </View>
            </React.Fragment>
          )
        ) : activeTab === 'livestream' ? (
          // Live Streaming tab content
          liveStreamingData && (
            <React.Fragment>
              {/* Vendor "live now" card */}
              {vendorRealtime && vendorRealtime.currentActiveStreams > 0 && (
                <View style={styles.liveNowCard}>
                  <View style={styles.liveNowHeader}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveNowTitle}>
                      {vendorRealtime.currentActiveStreams} stream{vendorRealtime.currentActiveStreams > 1 ? 's' : ''} live now
                    </Text>
                  </View>
                  <View style={styles.liveNowStats}>
                    <Text style={styles.liveNowStat}>
                      {formatNumber(vendorRealtime.currentTotalViewers)} watching
                    </Text>
                    <Text style={styles.liveNowStat}>
                      {formatCurrency(vendorRealtime.todayTotalRevenue)} today
                    </Text>
                    <Text style={styles.liveNowStat}>
                      {formatCurrency(vendorRealtime.todayGiftRevenue)} gifts
                    </Text>
                  </View>
                </View>
              )}

              {/* Live Streaming Metrics Grid */}
              <View style={styles.metricsContainer}>
                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Total Streams',
                    liveStreamingData.totalStreams,
                    'streams completed',
                    'videocam-outline',
                    '#FF2D92'
                  )}
                  {renderMetricCard(
                    'Live Revenue',
                    formatCurrency(liveStreamingData.totalLiveRevenue),
                    'from streaming',
                    'cash-outline',
                    '#34C759',
                    true
                  )}
                </View>

                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Total Viewers',
                    formatNumber(liveStreamingData.totalViewers),
                    'unique viewers',
                    'people-outline',
                    '#007AFF'
                  )}
                  {renderMetricCard(
                    'Conversion Rate',
                    `${liveStreamingData.conversionRate.toFixed(1)}%`,
                    'viewer to buyer',
                    'trending-up-outline',
                    '#FF9500'
                  )}
                </View>

                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Engagement',
                    formatNumber(liveStreamingData.totalEngagements),
                    'comments & reactions',
                    'heart-outline',
                    '#FF3B30'
                  )}
                  {renderMetricCard(
                    'Gifts Received',
                    formatCurrency(liveStreamingData.totalGifts),
                    'gift value',
                    'gift-outline',
                    '#AF52DE'
                  )}
                </View>
              </View>

              {/* Active Streams Section */}
              {liveStreamingData.activeStreamsCount > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>🔴 Currently Live ({liveStreamingData.activeStreamsCount})</Text>
                  {liveStreamingData.currentActiveStreams.map((stream, index) => (
                    <TouchableOpacity
                      key={stream.id}
                      style={styles.activeStreamCard}
                      onPress={() => openStreamDrilldown(stream.id)}
                    >
                      <View style={styles.activeStreamInfo}>
                        <Text style={styles.activeStreamTitle}>{stream.title}</Text>
                        <View style={styles.activeStreamStats}>
                          <View style={styles.activeStreamStat}>
                            <Ionicons name="eye" size={12} color="#34C759" />
                            <Text style={styles.activeStreamStatText}>{stream.viewer_count} viewers</Text>
                          </View>
                          <View style={styles.activeStreamStat}>
                            <Ionicons name="cash" size={12} color="#FFD700" />
                            <Text style={styles.activeStreamStatText}>₣{stream.total_sales}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Performance Insights */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>📊 Performance Insights</Text>
                {liveStreamingData.insights.map((insight, index) => (
                  <View key={index} style={styles.insightCard}>
                    <Ionicons name="bulb-outline" size={16} color="#FFD700" />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>

              {/* Streaming Trends */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>📈 Streaming Trends</Text>
                <View style={styles.trendsContainer}>
                  <View style={styles.trendCard}>
                    <Text style={styles.trendTitle}>Viewers</Text>
                    <Text style={[styles.trendValue, { color: liveStreamingData.trends.viewersChange > 0 ? '#34C759' : '#FF3B30' }]}>
                      {liveStreamingData.trends.viewersChange > 0 ? '+' : ''}{liveStreamingData.trends.viewersChange.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.trendCard}>
                    <Text style={styles.trendTitle}>Revenue</Text>
                    <Text style={[styles.trendValue, { color: liveStreamingData.trends.revenueChange > 0 ? '#34C759' : '#FF3B30' }]}>
                      {liveStreamingData.trends.revenueChange > 0 ? '+' : ''}{liveStreamingData.trends.revenueChange.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.trendCard}>
                    <Text style={styles.trendTitle}>Engagement</Text>
                    <Text style={[styles.trendValue, { color: liveStreamingData.trends.engagementChange > 0 ? '#34C759' : '#FF3B30' }]}>
                      {liveStreamingData.trends.engagementChange > 0 ? '+' : ''}{liveStreamingData.trends.engagementChange.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* Average Performance */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>⏱️ Average Performance</Text>
                <View style={styles.performanceGrid}>
                  <View style={styles.performanceCard}>
                    <Text style={styles.performanceValue}>{Math.round(liveStreamingData.averageViewerCount)}</Text>
                    <Text style={styles.performanceLabel}>Avg Viewers per Stream</Text>
                  </View>
                  <View style={styles.performanceCard}>
                    <Text style={styles.performanceValue}>{Math.round(liveStreamingData.totalStreamDuration / liveStreamingData.totalStreams || 0)}m</Text>
                    <Text style={styles.performanceLabel}>Avg Stream Duration</Text>
                  </View>
                </View>
              </View>
            </React.Fragment>
          )
        ) : activeTab === 'auctions' ? (
          // Auctions tab content
          auctionData && (
            <React.Fragment>
              {/* Auction Metrics Grid */}
              <View style={styles.metricsContainer}>
                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Total Auctions',
                    auctionData.totalAuctions,
                    `${auctionData.activeAuctions} active`,
                    'hammer-outline',
                    '#8E44AD'
                  )}
                  {renderMetricCard(
                    'Auction Revenue',
                    formatCurrency(auctionData.totalRevenue),
                    'total sales',
                    'cash-outline',
                    '#34C759',
                    true
                  )}
                </View>

                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Total Bids',
                    formatNumber(auctionData.totalBids),
                    `${auctionData.averageBidsPerAuction.toFixed(1)} avg per auction`,
                    'trending-up-outline',
                    '#007AFF'
                  )}
                  {renderMetricCard(
                    'Conversion Rate',
                    `${auctionData.conversionRate.toFixed(1)}%`,
                    'auctions sold',
                    'checkmark-circle-outline',
                    '#FF9500'
                  )}
                </View>

                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Unique Bidders',
                    formatNumber(auctionData.uniqueBidders),
                    'active participants',
                    'people-outline',
                    '#34C759'
                  )}
                  {renderMetricCard(
                    'Avg Final Price',
                    formatCurrency(auctionData.averageFinalPrice),
                    'per auction',
                    'calculator-outline',
                    '#8E44AD'
                  )}
                </View>
              </View>

              {/* Top Auctions Section */}
              {auctionData.topAuctions && auctionData.topAuctions.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>🏆 Top Performing Auctions</Text>
                  {auctionData.topAuctions.map((auction, index) => (
                    <View key={auction.id} style={styles.activeStreamCard}>
                      <View style={styles.activeStreamInfo}>
                        <Text style={styles.activeStreamTitle}>
                          #{index + 1} {auction.title}
                        </Text>
                        <View style={styles.activeStreamStats}>
                          <View style={styles.activeStreamStat}>
                            <Ionicons name="hammer" size={12} color="#8E44AD" />
                            <Text style={styles.activeStreamStatText}>{auction.total_bids} bids</Text>
                          </View>
                          <View style={styles.activeStreamStat}>
                            <Ionicons name="cash" size={12} color="#34C759" />
                            <Text style={styles.activeStreamStatText}>₣{auction.final_bid.toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.liveBadge, { backgroundColor: '#8E44AD' }]}>
                        <Text style={styles.liveText}>SOLD</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Category Performance */}
              {auctionData.categoryPerformance && auctionData.categoryPerformance.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>📊 Category Performance</Text>
                  {auctionData.categoryPerformance.map((category, index) => (
                    <View key={index} style={styles.categoryCard}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName}>{category.category}</Text>
                        <Text style={styles.categoryCount}>{category.auction_count} auctions</Text>
                      </View>
                      <View style={styles.categoryStats}>
                        <View style={styles.categoryStat}>
                          <Text style={styles.categoryStatLabel}>Total Revenue</Text>
                          <Text style={styles.categoryStatValue}>₣{category.total_revenue.toFixed(2)}</Text>
                        </View>
                        <View style={styles.categoryStat}>
                          <Text style={styles.categoryStatLabel}>Avg Final Bid</Text>
                          <Text style={styles.categoryStatValue}>₣{category.average_final_bid.toFixed(2)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Performance Insights */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>💡 Auction Insights</Text>
                {auctionData.insights.map((insight, index) => (
                  <View key={index} style={styles.insightCard}>
                    <Ionicons name="bulb-outline" size={16} color="#8E44AD" />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>

              {/* Auction Trends */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>📈 Auction Trends</Text>
                <View style={styles.trendsContainer}>
                  <View style={styles.trendCard}>
                    <Text style={styles.trendTitle}>Auctions</Text>
                    <Text style={[styles.trendValue, { color: auctionData.trends.auctionsChange > 0 ? '#34C759' : '#FF3B30' }]}>
                      {auctionData.trends.auctionsChange > 0 ? '+' : ''}{auctionData.trends.auctionsChange.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.trendCard}>
                    <Text style={styles.trendTitle}>Revenue</Text>
                    <Text style={[styles.trendValue, { color: auctionData.trends.revenueChange > 0 ? '#34C759' : '#FF3B30' }]}>
                      {auctionData.trends.revenueChange > 0 ? '+' : ''}{auctionData.trends.revenueChange.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.trendCard}>
                    <Text style={styles.trendTitle}>Bids</Text>
                    <Text style={[styles.trendValue, { color: auctionData.trends.bidsChange > 0 ? '#34C759' : '#FF3B30' }]}>
                      {auctionData.trends.bidsChange > 0 ? '+' : ''}{auctionData.trends.bidsChange.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* Commission Summary */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>💰 Commission Summary</Text>
                <View style={styles.performanceGrid}>
                  <View style={styles.performanceCard}>
                    <Text style={styles.performanceValue}>₣{auctionData.totalCommission.toFixed(2)}</Text>
                    <Text style={styles.performanceLabel}>Total Commission Earned</Text>
                  </View>
                  <View style={styles.performanceCard}>
                    <Text style={styles.performanceValue}>{auctionData.completedAuctions}</Text>
                    <Text style={styles.performanceLabel}>Completed Auctions</Text>
                  </View>
                </View>
              </View>
            </React.Fragment>
          )
        ) : activeTab === 'sales' ? (
          // Sales tab content
          salesData && (
            <React.Fragment>
              {/* Sales Summary Metrics */}
              <View style={styles.metricsContainer}>
                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Total Revenue',
                    formatCurrency(salesData.summary.totalRevenue),
                    `${salesData.summary.period}`,
                    'cash-outline',
                    '#34C759',
                    true
                  )}
                  {renderMetricCard(
                    'Transactions',
                    salesData.summary.totalTransactions,
                    'completed sales',
                    'swap-horizontal-outline',
                    '#007AFF'
                  )}
                </View>

                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Vendor Sales',
                    formatCurrency(salesData.summary.totalVendorSales),
                    'from products',
                    'storefront-outline',
                    '#FF9500'
                  )}
                  {renderMetricCard(
                    'Rider Earnings',
                    formatCurrency(salesData.summary.totalRiderEarnings),
                    'from deliveries',
                    'bicycle-outline',
                    '#3498DB'
                  )}
                </View>

                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Avg Transaction',
                    formatCurrency(salesData.summary.averagePerTransaction),
                    'per sale',
                    'calculator-outline',
                    '#AF52DE'
                  )}
                  {renderMetricCard(
                    'Period',
                    salesData.summary.period.toUpperCase(),
                    `${new Date(salesData.summary.startDate).toLocaleDateString()} - ${new Date(salesData.summary.endDate).toLocaleDateString()}`,
                    'calendar-outline',
                    '#FF3B30'
                  )}
                </View>
              </View>

              {/* Sales Chart */}
              {salesData.chartData && salesData.chartData.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>📊 Sales Trend</Text>
                  <View style={styles.lineChartWrapper}>
                    <LineChart
                      data={salesData.chartData.map(d => d.totalRevenue)}
                      labels={salesData.chartData.map(d => d.period)}
                      width={screenWidth - 48}
                      height={180}
                      color="#34C759"
                      showGradient={true}
                      showDots={true}
                      showGrid={true}
                      strokeWidth={3}
                    />
                    {/* Value indicators */}
                    <View style={styles.chartValuesContainer}>
                      {salesData.chartData.map((data, index) => (
                        <View key={index} style={styles.chartValueItem}>
                          <Text style={styles.chartValueText}>₣{data.totalRevenue.toFixed(0)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Revenue Breakdown */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>💰 Revenue Breakdown</Text>
                <View style={styles.breakdownCard}>
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLabel}>
                      <View style={[styles.breakdownDot, { backgroundColor: '#FF9500' }]} />
                      <Text style={styles.breakdownText}>Vendor Sales</Text>
                    </View>
                    <Text style={styles.breakdownValue}>
                      ₣{salesData.summary.totalVendorSales.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLabel}>
                      <View style={[styles.breakdownDot, { backgroundColor: '#3498DB' }]} />
                      <Text style={styles.breakdownText}>Rider Earnings</Text>
                    </View>
                    <Text style={styles.breakdownValue}>
                      ₣{salesData.summary.totalRiderEarnings.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 12, marginTop: 8 }]}>
                    <View style={styles.breakdownLabel}>
                      <View style={[styles.breakdownDot, { backgroundColor: '#34C759' }]} />
                      <Text style={[styles.breakdownText, { fontWeight: 'bold' }]}>Total Revenue</Text>
                    </View>
                    <Text style={[styles.breakdownValue, { fontWeight: 'bold', color: '#34C759' }]}>
                      ₣{salesData.summary.totalRevenue.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Performance Insights */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>💡 Sales Insights</Text>
                <View style={styles.insightCard}>
                  <Ionicons name="bulb-outline" size={16} color="#FFD700" />
                  <Text style={styles.insightText}>
                    You've completed {salesData.summary.totalTransactions} transactions with an average value of ₣{salesData.summary.averagePerTransaction.toFixed(2)} per sale.
                  </Text>
                </View>
                {salesData.summary.totalVendorSales > salesData.summary.totalRiderEarnings && (
                  <View style={styles.insightCard}>
                    <Ionicons name="trending-up-outline" size={16} color="#34C759" />
                    <Text style={styles.insightText}>
                      Your vendor sales (₣{salesData.summary.totalVendorSales.toFixed(2)}) are higher than rider earnings, indicating strong product performance.
                    </Text>
                  </View>
                )}
                {salesData.summary.totalTransactions > 10 && (
                  <View style={styles.insightCard}>
                    <Ionicons name="star-outline" size={16} color="#FFD700" />
                    <Text style={styles.insightText}>
                      Great job! You've completed {salesData.summary.totalTransactions} transactions this period. Keep up the momentum!
                    </Text>
                  </View>
                )}
              </View>
            </React.Fragment>
          )
        ) : activeTab === 'products' ? (
          // Products tab content
          productData && (
            <React.Fragment>
              <View style={styles.metricsContainer}>
                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Products',
                    productData.totalProducts,
                    'in catalog',
                    'cube-outline',
                    '#007AFF'
                  )}
                  {renderMetricCard(
                    'Units sold',
                    productData.totalSales,
                    'this period',
                    'bag-handle-outline',
                    '#34C759'
                  )}
                </View>
              </View>

              {/* Top selling products */}
              {productData.topSellingProducts?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Top Selling</Text>
                  {productData.topSellingProducts.map((p, i) => (
                    <View key={p.productId || i} style={styles.channelRow}>
                      <View style={styles.channelRowLeft}>
                        <Text style={styles.rankBadge}>#{i + 1}</Text>
                        <View>
                          <Text style={styles.channelRowLabel} numberOfLines={1}>{p.productName}</Text>
                          <Text style={styles.channelSubtext}>{p.category}</Text>
                        </View>
                      </View>
                      <View style={styles.channelRowRight}>
                        <Text style={styles.channelRowOrders}>
                          {p.quantitySold} sold{p.averageRating > 0 ? ` · ${p.averageRating.toFixed(1)}★` : ''}
                        </Text>
                        <Text style={styles.channelRowRevenue}>{formatCurrency(p.revenue)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Category performance */}
              {productData.categoryPerformance?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Category Performance</Text>
                  {productData.categoryPerformance.map((c, i) => (
                    <View key={c.category || i} style={styles.channelRow}>
                      <View style={styles.channelRowLeft}>
                        <Ionicons name="pricetag-outline" size={16} color="#FF9500" />
                        <Text style={styles.channelRowLabel}>{c.category}</Text>
                      </View>
                      <View style={styles.channelRowRight}>
                        <Text style={styles.channelRowOrders}>{c.totalSales} sold</Text>
                        <Text style={styles.channelRowRevenue}>{formatCurrency(c.revenue)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Low stock warnings */}
              {productData.lowStockProducts?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Low Stock</Text>
                  {productData.lowStockProducts.map((p, i) => (
                    <View key={p.productId || i} style={styles.channelRow}>
                      <View style={styles.channelRowLeft}>
                        <Ionicons name="warning-outline" size={16} color="#FF3B30" />
                        <Text style={styles.channelRowLabel} numberOfLines={1}>{p.productName}</Text>
                      </View>
                      <Text style={styles.lowStockText}>{p.currentStock} left</Text>
                    </View>
                  ))}
                </View>
              )}
            </React.Fragment>
          )
        ) : activeTab === 'customers' ? (
          // Customers tab content
          customerData && (
            <React.Fragment>
              <View style={styles.metricsContainer}>
                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Total customers',
                    customerData.totalCustomers,
                    'all time',
                    'people-outline',
                    '#007AFF'
                  )}
                  {renderMetricCard(
                    'Retention rate',
                    `${(customerData.customerRetentionRate || 0).toFixed(1)}%`,
                    'returning buyers',
                    'repeat-outline',
                    '#34C759'
                  )}
                </View>
                <View style={styles.metricsRow}>
                  {renderMetricCard(
                    'Avg orders',
                    (customerData.averageOrdersPerCustomer || 0).toFixed(1),
                    'per customer',
                    'receipt-outline',
                    '#FF9500'
                  )}
                  {renderMetricCard(
                    'New vs returning',
                    `${customerData.newCustomers} / ${customerData.returningCustomers}`,
                    'this period',
                    'git-compare-outline',
                    '#5856D6'
                  )}
                </View>
              </View>

              {/* New/returning ratio bar */}
              {(customerData.newCustomers + customerData.returningCustomers) > 0 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.ratioBar}>
                    <View style={[styles.ratioSegment, {
                      flex: customerData.newCustomers,
                      backgroundColor: '#007AFF',
                    }]} />
                    <View style={[styles.ratioSegment, {
                      flex: customerData.returningCustomers,
                      backgroundColor: '#34C759',
                    }]} />
                  </View>
                  <View style={styles.ratioLegend}>
                    <View style={styles.ratioLegendItem}>
                      <View style={[styles.ratioDot, { backgroundColor: '#007AFF' }]} />
                      <Text style={styles.ratioLegendText}>New ({customerData.newCustomers})</Text>
                    </View>
                    <View style={styles.ratioLegendItem}>
                      <View style={[styles.ratioDot, { backgroundColor: '#34C759' }]} />
                      <Text style={styles.ratioLegendText}>Returning ({customerData.returningCustomers})</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Top customers */}
              {customerData.topCustomers?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Top Customers</Text>
                  {customerData.topCustomers.map((c, i) => (
                    <View key={c.customerId || i} style={styles.channelRow}>
                      <View style={styles.channelRowLeft}>
                        <Text style={styles.rankBadge}>#{i + 1}</Text>
                        <Text style={styles.channelRowLabel} numberOfLines={1}>{c.customerName}</Text>
                      </View>
                      <View style={styles.channelRowRight}>
                        <Text style={styles.channelRowOrders}>{c.totalOrders} orders</Text>
                        <Text style={styles.channelRowRevenue}>{formatCurrency(c.totalSpent)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </React.Fragment>
          )
        ) : null}
      </ScrollView>

      {/* Report generation modal */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate Report</Text>

            <Text style={styles.modalLabel}>Period</Text>
            <View style={styles.modalOptionRow}>
              {(['daily', 'weekly', 'monthly'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.modalOption, reportType === t && styles.modalOptionActive]}
                  onPress={() => setReportType(t)}
                >
                  <Text style={[styles.modalOptionText, reportType === t && styles.modalOptionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Channel</Text>
            <View style={styles.modalOptionRow}>
              {([
                { key: 'all', label: 'All' },
                { key: 'regular', label: 'Store' },
                { key: 'live_stream', label: 'Live' },
                { key: 'auctions', label: 'Auctions' },
                { key: 'invoice', label: 'Chat' },
                { key: 'wishlist', label: 'Gift' },
              ] as const).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.modalOption, reportSource === key && styles.modalOptionActive]}
                  onPress={() => setReportSource(key)}
                >
                  <Text style={[styles.modalOptionText, reportSource === key && styles.modalOptionTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Format</Text>
            <View style={styles.modalOptionRow}>
              {(['pdf', 'excel'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.modalOption, reportFormat === f && styles.modalOptionActive]}
                  onPress={() => setReportFormat(f)}
                >
                  <Text style={[styles.modalOptionText, reportFormat === f && styles.modalOptionTextActive]}>{f.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setReportModalVisible(false)}
                disabled={reportGenerating}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, reportGenerating && { opacity: 0.6 }]}
                onPress={handleGenerateReport}
                disabled={reportGenerating}
              >
                {reportGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Per-stream drilldown modal */}
      <Modal
        visible={!!streamDrilldown || drilldownLoading}
        transparent
        animationType="slide"
        onRequestClose={() => setStreamDrilldown(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {drilldownLoading ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : streamDrilldown && (
              <React.Fragment>
                <View style={styles.drilldownHeader}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{streamDrilldown.title}</Text>
                  <TouchableOpacity onPress={() => setStreamDrilldown(null)}>
                    <Ionicons name="close" size={22} color="#666" />
                  </TouchableOpacity>
                </View>
                <View style={styles.drilldownGrid}>
                  <View style={styles.drilldownItem}>
                    <Text style={styles.drilldownValue}>{streamDrilldown.viewerCount}</Text>
                    <Text style={styles.drilldownLabel}>Watching</Text>
                  </View>
                  <View style={styles.drilldownItem}>
                    <Text style={styles.drilldownValue}>{streamDrilldown.peakViewers}</Text>
                    <Text style={styles.drilldownLabel}>Peak</Text>
                  </View>
                  <View style={styles.drilldownItem}>
                    <Text style={styles.drilldownValue}>{formatCurrency(streamDrilldown.totalSales)}</Text>
                    <Text style={styles.drilldownLabel}>Sales</Text>
                  </View>
                  <View style={styles.drilldownItem}>
                    <Text style={styles.drilldownValue}>{formatCurrency(streamDrilldown.giftValue)}</Text>
                    <Text style={styles.drilldownLabel}>Gifts</Text>
                  </View>
                  <View style={styles.drilldownItem}>
                    <Text style={styles.drilldownValue}>{(streamDrilldown.engagementRate || 0).toFixed(1)}%</Text>
                    <Text style={styles.drilldownLabel}>Engagement</Text>
                  </View>
                  <View style={styles.drilldownItem}>
                    <Text style={styles.drilldownValue}>{(streamDrilldown.conversionRate || 0).toFixed(1)}%</Text>
                    <Text style={styles.drilldownLabel}>Conversion</Text>
                  </View>
                </View>
                {streamDrilldown.recentActivity?.length > 0 && (
                  <View style={styles.drilldownActivity}>
                    <Text style={styles.modalLabel}>Recent activity</Text>
                    {streamDrilldown.recentActivity.slice(0, 8).map((a, i) => (
                      <View key={i} style={styles.drilldownActivityRow}>
                        <Ionicons
                          name={a.type === 'gift' ? 'gift-outline' : 'bag-outline'}
                          size={14}
                          color={a.type === 'gift' ? '#FF2D55' : '#34C759'}
                        />
                        <Text style={styles.drilldownActivityText}>
                          {a.type === 'gift' ? 'Gift' : 'Purchase'} · {formatCurrency(a.amount)}
                        </Text>
                        <Text style={styles.drilldownActivityTime}>
                          {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </React.Fragment>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#111',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activePeriodTab: {
    backgroundColor: '#007AFF',
  },
  periodTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activePeriodTabText: {
    color: 'white',
  },
  dateNavigation: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  todayLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButton: {
    padding: 8,
  },
  currentDate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  metricsContainer: {
    paddingHorizontal: 16,
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
    marginBottom: 12,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  metricTitle: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  miniChart: {
    marginTop: 12,
    alignItems: 'center',
    overflow: 'visible',
  },
  reportsSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  reportsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: 'white',
  },
  reportsList: {
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  reportIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#222',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  reportStatus: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  analyticsHeader: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  analyticsSubtitle: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  channelTags: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  channelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  channelTagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Tab styles
  tabScroll: {
    flexGrow: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 5,
  },
  activeTabText: {
    color: 'white',
  },

  // Live streaming specific styles
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  channelRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  channelRowRight: {
    alignItems: 'flex-end',
  },
  channelRowOrders: {
    fontSize: 12,
    color: '#8E8E93',
  },
  channelRowRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
    marginTop: 2,
  },
  activeStreamCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeStreamInfo: {
    flex: 1,
  },
  activeStreamTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  activeStreamStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeStreamStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  activeStreamStatText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  insightCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  trendsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  trendTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  trendValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  // Category performance styles
  categoryCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  categoryCount: {
    fontSize: 12,
    color: '#666',
  },
  categoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryStat: {
    flex: 1,
  },
  categoryStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  categoryStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8E44AD',
  },
  // Sales-specific styles
  lineChartWrapper: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    paddingTop: 24,
    overflow: 'visible',
  },
  chartValuesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  chartValueItem: {
    flex: 1,
    alignItems: 'center',
  },
  chartValueText: {
    fontSize: 11,
    color: '#34C759',
    fontWeight: 'bold',
  },
  breakdownCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  breakdownText: {
    fontSize: 14,
    color: '#CCC',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  // Realtime strip
  realtimeStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  realtimeItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  realtimeValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  realtimeLabel: {
    fontSize: 10,
    color: '#666',
  },
  // Compare mode
  compareToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginBottom: 16,
  },
  compareToggleActive: {
    backgroundColor: '#007AFF',
  },
  compareToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  comparisonCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  comparisonLabel: {
    flex: 1,
    fontSize: 14,
    color: '#999',
  },
  comparisonValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  // Trend chip on metric cards
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  trendChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Summary / shared list bits
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCC',
    marginTop: 12,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  topSellingList: {
    marginTop: 8,
  },
  rankBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    width: 26,
  },
  channelSubtext: {
    fontSize: 11,
    color: '#666',
  },
  lowStockText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
  },
  // Ratio bar (customers)
  ratioBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  ratioSegment: {
    height: '100%',
  },
  ratioLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  ratioLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ratioLegendText: {
    fontSize: 12,
    color: '#999',
  },
  // Reports header + generate button
  reportsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  generateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  emptyReportsText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    flex: 1,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  modalOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  modalOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  modalOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'capitalize',
  },
  modalOptionTextActive: {
    color: 'white',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 14,
    color: '#999',
  },
  modalConfirm: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  // Stream drilldown
  drilldownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drilldownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  drilldownItem: {
    width: '33%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  drilldownValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  drilldownLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  drilldownActivity: {
    marginTop: 8,
  },
  drilldownActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  drilldownActivityText: {
    flex: 1,
    fontSize: 13,
    color: '#CCC',
  },
  drilldownActivityTime: {
    fontSize: 11,
    color: '#666',
  },
  // Live-now vendor card
  liveNowCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  liveNowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  liveNowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  liveNowStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveNowStat: {
    fontSize: 12,
    color: '#999',
  },
});

export default AnalyticsScreen;