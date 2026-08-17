import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { scheduleAPI, ScheduledOrder, MonthSummary } from '../services/scheduleAPI';

interface ScheduleCalendarScreenProps {
  navigation: any;
}

const ScheduleCalendarScreen: React.FC<ScheduleCalendarScreenProps> = ({ navigation }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [monthSummary, setMonthSummary] = useState<MonthSummary>({});
  const [selectedDateOrders, setSelectedDateOrders] = useState<ScheduledOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch month summary for calendar indicators
  const fetchMonthSummary = async (month: string) => {
    try {
      const summary = await scheduleAPI.getMonthSummary(month);
      setMonthSummary(summary);
    } catch (error) {
      console.error('Error fetching month summary:', error);
    }
  };

  // Fetch orders for selected date
  const fetchOrdersForDate = async (date: string) => {
    try {
      setLoading(true);
      const orders = await scheduleAPI.getOrdersByDate(date);
      setSelectedDateOrders(orders);
    } catch (error) {
      console.error('Error fetching orders for date:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchMonthSummary(currentMonth),
      fetchOrdersForDate(selectedDate),
    ]);
    setRefreshing(false);
  };

  // Handle date selection
  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    fetchOrdersForDate(day.dateString);
  };

  // Handle month change
  const onMonthChange = (month: { year: number; month: number }) => {
    const monthStr = `${month.year}-${String(month.month).padStart(2, '0')}`;
    setCurrentMonth(monthStr);
    fetchMonthSummary(monthStr);
  };

  // Format marked dates with indicators
  const getMarkedDates = () => {
    const marked: { [key: string]: any } = {};
    
    Object.entries(monthSummary).forEach(([date, count]) => {
      if (count > 0) {
        marked[date] = {
          marked: true,
          dotColor: '#0066FF',
          selected: date === selectedDate,
          selectedColor: date === selectedDate ? '#0066FF' : undefined,
        };
      }
    });

    // Mark selected date
    if (selectedDate && !marked[selectedDate]) {
      marked[selectedDate] = {
        selected: true,
        selectedColor: '#0066FF',
      };
    }

    return marked;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#FFA500',
      processing: '#0066FF',
      ready_for_pickup: '#00CC66',
      out_for_delivery: '#9333EA',
      delivered: '#00CC66',
      completed: '#00CC66',
      cancelled: '#FF3B30',
    };
    return colors[status] || '#888';
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      pending: 'Pending',
      processing: 'In Progress',
      ready_for_pickup: 'Ready',
      out_for_delivery: 'In Transit',
      delivered: 'Delivered',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  // Render order item
  const renderOrderItem = (order: ScheduledOrder) => (
    <TouchableOpacity
      key={order.id}
      style={styles.orderItem}
      onPress={() => navigation.navigate('VendorOrderDetails', { orderId: order.id })}
    >
      <View style={styles.orderItemHeader}>
        <Text style={styles.orderServiceName}>{order.serviceName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
        </View>
      </View>
      
      <View style={styles.orderItemDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#888" />
          <Text style={styles.detailText}>
            {order.scheduledTime || 'Time not set'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color="#888" />
          <Text style={styles.detailText}>{order.customerName}</Text>
        </View>
        
        {order.location && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#888" />
            <Text style={styles.detailText} numberOfLines={1}>
              {typeof order.location === 'string' ? order.location : order.location.address || 'Location'}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.orderItemFooter}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <Text style={styles.orderTotal}>
          ₦{order.total.toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchMonthSummary(currentMonth),
        fetchOrdersForDate(selectedDate),
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.calendarContainer}>
          <Calendar
            current={currentMonth}
            onDayPress={onDayPress}
            onMonthChange={onMonthChange}
            markedDates={getMarkedDates()}
            theme={{
              backgroundColor: '#000',
              calendarBackground: '#111',
              textSectionTitleColor: '#888',
              selectedDayBackgroundColor: '#0066FF',
              selectedDayTextColor: '#fff',
              todayTextColor: '#0066FF',
              dayTextColor: '#fff',
              textDisabledColor: '#444',
              arrowColor: '#0066FF',
              monthTextColor: '#fff',
              indicatorColor: '#0066FF',
              textDayFontWeight: '400',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: 'bold',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 14,
            }}
          />
        </View>

        <View style={styles.ordersSection}>
          <Text style={styles.sectionTitle}>
            Orders for {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066FF" />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : selectedDateOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#444" />
              <Text style={styles.emptyText}>No orders scheduled for this day</Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {selectedDateOrders.map(renderOrderItem)}
            </View>
          )}
        </View>
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  calendarContainer: {
    backgroundColor: '#111',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  ordersSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  ordersList: {
    gap: 12,
  },
  orderItem: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderServiceName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  orderItemDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#888',
    flex: 1,
  },
  orderItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  orderNumber: {
    fontSize: 12,
    color: '#666',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00CC66',
  },
});

export default ScheduleCalendarScreen;
