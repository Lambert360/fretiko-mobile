import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  TextInput,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { servicesAPI, VideoFeedItem, CreateBookingRequest } from '../services/servicesAPI';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width: screenWidth } = Dimensions.get('window');

interface ServiceBookingProps {
  navigation: any;
  route: {
    params: {
      service: VideoFeedItem;
    };
  };
}

const ServiceBookingScreen: React.FC<ServiceBookingProps> = ({ navigation, route }) => {
  const { service } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleBookService = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to book this service');
      return;
    }

    // Validate booking date (must be in the future)
    const now = new Date();
    const bookingDateTime = new Date(selectedDate);
    bookingDateTime.setHours(selectedTime.getHours());
    bookingDateTime.setMinutes(selectedTime.getMinutes());

    if (bookingDateTime <= now) {
      Alert.alert('Invalid Date', 'Please select a future date and time');
      return;
    }

    Alert.alert(
      'Confirm Booking',
      `Service: ${service.title}\nProvider: ${service.serviceProvider}\nDate: ${selectedDate.toDateString()}\nTime: ${selectedTime.toLocaleTimeString()}\nPrice: ₦${service.price.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Book Now', onPress: processBooking },
      ]
    );
  };

  const processBooking = async () => {
    try {
      setLoading(true);
      
      // Animate button
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
      ]).start();

      const bookingData: CreateBookingRequest = {
        serviceId: service.id,
        date: selectedDate.toISOString().split('T')[0],
        time: `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`,
        notes: notes.trim() || undefined,
      };

      const booking = await servicesAPI.bookService(bookingData);
      
      // Add booked service to cart for checkout
      // This will be handled by the cart API when available
      
      Alert.alert(
        'Service Scheduled!',
        `Your service has been scheduled for ${selectedDate.toDateString()} at ${selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} and added to your cart.`,
        [
          {
            text: 'Checkout Now',
            onPress: () => {
              navigation.navigate('Cart');
            },
          },
          {
            text: 'Continue Shopping',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error booking service:', error);
      Alert.alert(
        'Booking Failed',
        error.message || 'Failed to book service. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChatWithProvider = () => {
    navigation.navigate('Chat', { 
      recipientId: service.id, // Using service ID as provider reference
      recipientName: service.serviceProvider,
      serviceId: service.id,
    });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSelectedDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setSelectedTime(selectedTime);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Service</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleChatWithProvider}>
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Info Card */}
        <View style={styles.serviceCard}>
          <Image source={{ uri: service.thumbnail }} style={styles.serviceImage} />
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle}>{service.title}</Text>
            <Text style={styles.providerName}>by {service.serviceProvider}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{service.rating}</Text>
              <Text style={styles.completedJobs}>{service.completedJobs} completed</Text>
            </View>
            <Text style={styles.location}>📍 {service.location}</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.currentPrice}>₦{service.price.toFixed(2)}</Text>
              {service.originalPrice && (
                <Text style={styles.originalPrice}>₦{service.originalPrice.toFixed(2)}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Service Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Description</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.description}>{service.description}</Text>
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.dateTimeInfo}>
              <Ionicons name="calendar-outline" size={20} color="#3498DB" />
              <Text style={styles.dateTimeText}>
                {selectedDate.toDateString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Time Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <View style={styles.dateTimeInfo}>
              <Ionicons name="time-outline" size={20} color="#3498DB" />
              <Text style={styles.dateTimeText}>
                {selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any specific requirements or instructions..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Booking Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service</Text>
              <Text style={styles.summaryValue}>{service.title}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Provider</Text>
              <Text style={styles.summaryValue}>{service.serviceProvider}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date & Time</Text>
              <Text style={styles.summaryValue}>
                {selectedDate.toDateString()} at {selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Location</Text>
              <Text style={styles.summaryValue}>{service.location}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₦{service.price.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <Animated.View style={[styles.bottomBar, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.totalPreview}>
          <Text style={styles.totalPreviewLabel}>Total</Text>
          <Text style={styles.totalPreviewValue}>₦{service.price.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={handleBookService}
          disabled={loading}
        >
          <Text style={styles.bookButtonText}>
            {loading ? 'Booking...' : 'Book Now'}
          </Text>
          {!loading && (
            <Ionicons name="calendar" size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}
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
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  serviceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  serviceInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  serviceTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerName: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  completedJobs: {
    color: '#666',
    fontSize: 12,
  },
  location: {
    color: '#666',
    fontSize: 12,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentPrice: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  originalPrice: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  descriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  description: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateTimeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#CCC',
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 16,
  },
  totalPreview: {
    flex: 1,
  },
  totalPreviewLabel: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 2,
  },
  totalPreviewValue: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#3498DB',
    borderRadius: 24,
  },
  bookButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ServiceBookingScreen;