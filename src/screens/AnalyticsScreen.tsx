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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { analyticsAPI, AnalyticsData, AnalyticsPeriod, LiveStreamingAnalytics, AuctionAnalytics } from '../services/analyticsAPI';
import { walletAPI, SalesAnalytics } from '../services/walletAPI';
import LineChart from '../components/LineChart';

const { width: screenWidth } = Dimensions.get('window');

const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<'overview' | 'livestream' | 'auctions' | 'sales'>('overview');
  const [activePeriod, setActivePeriod] = useState<AnalyticsPeriod>('daily');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [liveStreamingData, setLiveStreamingData] = useState<LiveStreamingAnalytics | null>(null);
  const [auctionData, setAuctionData] = useState<AuctionAnalytics | null>(null);
  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
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
      } else if (activeTab === 'livestream') {
        const liveData = await analyticsAPI.getLiveStreamingAnalytics(activePeriod, currentDate);
        setLiveStreamingData(liveData);
      } else if (activeTab === 'auctions') {
        const auctionDataResult = await analyticsAPI.getAuctionAnalytics(activePeriod, currentDate);
        setAuctionData(auctionDataResult);
      } else if (activeTab === 'sales') {
        const salesDataResult = await walletAPI.getSalesAnalytics({ period: activePeriod });
        setSalesData(salesDataResult);
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalyticsData(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
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

  const renderMetricCard = (
    title: string,
    value: string | number,
    subtitle: string,
    icon: string,
    color: string,
    showChart?: boolean
  ) => (
    <View style={[styles.metricCard, { borderLeftColor: color }]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <Text style={styles.metricTitle}>{title}</Text>
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

  const renderReportItem = (report: any, index: number) => (
    <TouchableOpacity key={index} style={styles.reportItem}>
      <View style={styles.reportIcon}>
        <Ionicons name="document-text-outline" size={16} color="#666" />
      </View>
      <View style={styles.reportInfo}>
        <Text style={styles.reportTitle}>{report.title}</Text>
        <Text style={styles.reportSubtitle}>{report.subtitle}</Text>
      </View>
      <View style={styles.reportStatus}>
        <View style={[styles.statusDot, { backgroundColor: report.status === 'completed' ? '#34C759' : '#FF9500' }]} />
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
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons
            name="analytics-outline"
            size={16}
            color={activeTab === 'overview' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'livestream' && styles.activeTab]}
          onPress={() => setActiveTab('livestream')}
        >
          <Ionicons
            name="videocam-outline"
            size={16}
            color={activeTab === 'livestream' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'livestream' && styles.activeTabText]}>
            Live Streams
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'auctions' && styles.activeTab]}
          onPress={() => setActiveTab('auctions')}
        >
          <Ionicons
            name="hammer-outline"
            size={16}
            color={activeTab === 'auctions' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'auctions' && styles.activeTabText]}>
            Auctions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'sales' && styles.activeTab]}
          onPress={() => setActiveTab('sales')}
        >
          <Ionicons
            name="cash-outline"
            size={16}
            color={activeTab === 'sales' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'sales' && styles.activeTabText]}>
            Sales
          </Text>
        </TouchableOpacity>
      </View>

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
          // Overview tab content (existing)
          analyticsData && (
            <React.Fragment>
              {/* Metrics Grid */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricsRow}>
              {renderMetricCard(
                'Orders processed',
                analyticsData.ordersProcessed,
                'orders',
                'bag-outline',
                '#007AFF'
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
                '#34C759'
              )}
            </View>

            <View style={styles.metricsRow}>
              {renderMetricCard(
                'Active customers',
                analyticsData.activeCustomers,
                'customers served',
                'people-outline',
                '#34C759'
              )}
              {renderMetricCard(
                'Avg. order value',
                formatCurrency(analyticsData.averageOrderValue),
                'per order',
                'calculator-outline',
                '#FF9500'
              )}
            </View>
          </View>

        {/* Reports Section */}
        <View style={styles.reportsSection}>
          <Text style={styles.reportsTitle}>
            Report list ({analyticsData?.reports?.length || 0})
          </Text>

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
            {analyticsData?.reports?.map((report, index) => renderReportItem(report, index))}
          </View>
        </View>
            </React.Fragment>
          )
        ) : activeTab === 'livestream' ? (
          // Live Streaming tab content
          liveStreamingData && (
            <React.Fragment>
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
                    <View key={stream.id} style={styles.activeStreamCard}>
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
                    </View>
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
        ) : null}
      </ScrollView>
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
    marginBottom: 16,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
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
});

export default AnalyticsScreen;