import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI, LiveStreamService } from '../services/liveSalesAPI';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Using LiveStreamService from liveSalesAPI

interface LiveServiceBookingModalProps {
  visible: boolean;
  service: LiveStreamService | null;
  streamId: string;
  onClose: () => void;
  onBookingSuccess: () => void;
}

const LiveServiceBookingModal: React.FC<LiveServiceBookingModalProps> = ({
  visible,
  service,
  streamId,
  onClose,
  onBookingSuccess,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  // Booking state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [displayImages, setDisplayImages] = useState<string[]>([]);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Load available dates for current month
  const loadAvailableDates = () => {
    if (!service) return;
    
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + service.max_advance_days);
    
    const dates: string[] = [];
    const currentDate = new Date(today);
    
    while (currentDate <= maxDate && currentDate.getMonth() === currentMonth.getMonth()) {
      // Skip past dates
      if (currentDate >= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    setAvailableDates(dates);
  };

  // Load available times for selected date
  const loadAvailableTimes = (date: string) => {
    if (!service) return;
    
    // Mock available times - in real implementation, this would come from the service's availability
    const mockTimes = [
      '09:00', '10:00', '11:00', '12:00', 
      '13:00', '14:00', '15:00', '16:00', '17:00'
    ];
    
    // Filter out unavailable slots
    const availableSlots = service.available_slots?.filter(slot => 
      slot.date === date && slot.available
    ) || [];
    
    const times = availableSlots.length > 0 
      ? availableSlots.map(slot => slot.time)
      : mockTimes;
    
    setAvailableTimes(times);
  };

  // Load wallet balance
  const loadWalletBalance = async () => {
    try {
      // TODO: Implement actual wallet API call
      setWalletBalance(250.00); // Mock balance
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  };

  // Load service display images
  const loadServiceImages = () => {
    if (!service) return;

    // In real implementation, this would come from service.service.display_images
    // For now, using mock images based on service type
    const mockImages = [
      service.service.primary_image_url || 'https://via.placeholder.com/400x300/3498DB/white?text=Service+Image+1',
      'https://via.placeholder.com/400x300/27AE60/white?text=Service+Image+2',
      'https://via.placeholder.com/400x300/E74C3C/white?text=Service+Image+3',
    ].filter(Boolean); // Remove any null/undefined images

    setDisplayImages(mockImages);
    setSelectedImageIndex(0);
  };

  // Handle date selection
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
    loadAvailableTimes(date);
  };

  // Handle time selection
  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  // Add to cart instead of direct booking
  const addToCart = () => {
    // This would need to communicate with the viewer's cart
    // For now, we'll just close the modal and let the viewer add to cart manually
    onClose();
    console.log('🛒 Add to cart requested for service:', service);
  };

  // Process booking
  const processBooking = async (continueWatching: boolean) => {
    if (!service || !selectedDate || !selectedTime) return;
    
    setLoading(true);
    try {
      const bookingData = {
        stream_id: streamId,
        service_id: service.service_id,
        date: selectedDate,
        time: selectedTime,
        notes: notes || undefined,
        meeting_location: meetingLocation || undefined,
        continue_watching: continueWatching,
      };

      await liveSalesAPI.bookService(bookingData);
      
      Alert.alert(
        'Booking Confirmed!',
        continueWatching 
          ? 'Service booked! Continue enjoying the stream.'
          : 'Service booked! You\'ll receive confirmation details shortly.',
        [{ text: 'OK', onPress: onBookingSuccess }]
      );
      
      onClose();
    } catch (error) {
      console.error('Error booking service:', error);
      Alert.alert('Error', 'Failed to book service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle continue watching booking (instant wallet debit)
  const handleContinueWatching = async () => {
    if (!service) return;
    
    if (service.live_price > walletBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₣${(service.live_price - walletBalance).toFixed(2)} more in your wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => {/* Navigate to wallet */} }
        ]
      );
      return;
    }

    Alert.alert(
      'Confirm Booking',
      `Book ${service.service.name} for ₣${service.live_price.toFixed(2)} and continue watching?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => processBooking(true) }
      ]
    );
  };

  // Handle checkout flow
  const handleCheckout = () => {
    if (!service || !selectedDate || !selectedTime) return;
    
    const checkoutItem = {
      type: 'service',
      id: service.service_id,
      name: service.service.name,
      price: service.live_price,
      date: selectedDate,
      time: selectedTime,
      notes: notes || undefined,
    };
    
    onClose();
    navigation.navigate('LiveMiniCheckout', {
      streamId,
      item: checkoutItem,
      returnToStream: true,
    });
  };

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === month;
      const isAvailable = availableDates.includes(dateStr);
      const isSelected = dateStr === selectedDate;
      const isPast = currentDate < new Date();
      
      // Enhanced day info with better categorization
      const isToday = currentDate.toDateString() === new Date().toDateString();
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

      days.push({
        date: currentDate.getDate(),
        dateStr,
        isCurrentMonth,
        isAvailable,
        isSelected,
        isPast,
        isToday,
        isWeekend,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  // Initialize
  useEffect(() => {
    if (visible && service) {
      loadWalletBalance();
      loadAvailableDates();
      loadServiceImages();
      setSelectedDate('');
      setSelectedTime('');
      setNotes('');
      setMeetingLocation('');
    }
  }, [visible, service]);

  useEffect(() => {
    if (service) {
      loadAvailableDates();
    }
  }, [currentMonth, service]);

  if (!visible || !service) {
    return null;
  }

  const calendarDays = generateCalendarDays();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Service</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Service Info */}
          <View style={styles.serviceSection}>
            {/* Service Images Gallery */}
            {displayImages.length > 0 && (
              <View style={styles.imageGallery}>
                <Image
                  source={{ uri: displayImages[selectedImageIndex] }}
                  style={styles.mainServiceImage}
                  resizeMode="cover"
                />

                {/* Image Indicators */}
                {displayImages.length > 1 && (
                  <View style={styles.imageIndicators}>
                    {displayImages.map((_, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.indicator,
                          selectedImageIndex === index && styles.indicatorActive
                        ]}
                        onPress={() => setSelectedImageIndex(index)}
                      />
                    ))}
                  </View>
                )}

                {/* Image Navigation */}
                {displayImages.length > 1 && (
                  <>
                    <TouchableOpacity
                      style={[styles.imageNavButton, styles.imageNavLeft]}
                      onPress={() => setSelectedImageIndex(
                        selectedImageIndex === 0 ? displayImages.length - 1 : selectedImageIndex - 1
                      )}
                    >
                      <Ionicons name="chevron-back" size={20} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.imageNavButton, styles.imageNavRight]}
                      onPress={() => setSelectedImageIndex(
                        selectedImageIndex === displayImages.length - 1 ? 0 : selectedImageIndex + 1
                      )}
                    >
                      <Ionicons name="chevron-forward" size={20} color="white" />
                    </TouchableOpacity>
                  </>
                )}

                {/* Image Counter */}
                {displayImages.length > 1 && (
                  <View style={styles.imageCounter}>
                    <Text style={styles.imageCounterText}>
                      {selectedImageIndex + 1} of {displayImages.length}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.serviceDetails}>
              <Text style={styles.serviceName}>{service.service.name}</Text>
              {service.service.description && (
                <Text style={styles.serviceDescription} numberOfLines={3}>
                  {service.service.description}
                </Text>
              )}
              <Text style={styles.serviceCategory}>{service.service.category_name}</Text>
              <View style={styles.serviceMetadata}>
                <View style={styles.metadataItem}>
                  <Ionicons name="time" size={14} color="#3498DB" />
                  <Text style={styles.metadataText}>
                    {service.service.duration_minutes} min
                  </Text>
                </View>
                <View style={styles.metadataItem}>
                  <Ionicons
                    name={service.service.location_type === 'online' ? 'videocam' :
                         service.service.location_type === 'in_person' ? 'location' : 'git-branch'}
                    size={14}
                    color="#3498DB"
                  />
                  <Text style={styles.metadataText}>
                    {service.service.location_type.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.servicePrice}>₣{service.live_price.toFixed(2)}</Text>
            </View>
          </View>

          {/* Calendar */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            
            {/* Month Navigation */}
            <View style={styles.monthHeader}>
              <TouchableOpacity 
                style={styles.monthButton}
                onPress={() => {
                  const prevMonth = new Date(currentMonth);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setCurrentMonth(prevMonth);
                }}
              >
                <Ionicons name="chevron-back" size={20} color="white" />
              </TouchableOpacity>
              
              <Text style={styles.monthTitle}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              
              <TouchableOpacity 
                style={styles.monthButton}
                onPress={() => {
                  const nextMonth = new Date(currentMonth);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setCurrentMonth(nextMonth);
                }}
              >
                <Ionicons name="chevron-forward" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Days of Week */}
            <View style={styles.daysHeader}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Text key={day} style={styles.dayHeaderText}>{day}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendar}>
              {calendarDays.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    !day.isCurrentMonth && styles.dayButtonInactive,
                    day.isToday && styles.dayButtonToday,
                    day.isSelected && styles.dayButtonSelected,
                    day.isAvailable && !day.isPast && day.isCurrentMonth && styles.dayButtonAvailable,
                    (!day.isAvailable || day.isPast) && day.isCurrentMonth && styles.dayButtonDisabled,
                    day.isWeekend && day.isCurrentMonth && styles.dayButtonWeekend,
                  ]}
                  onPress={() => day.isAvailable && !day.isPast ? handleDateSelect(day.dateStr) : null}
                  disabled={!day.isAvailable || day.isPast}
                >
                  <Text style={[
                    styles.dayText,
                    !day.isCurrentMonth && styles.dayTextInactive,
                    day.isToday && styles.dayTextToday,
                    day.isSelected && styles.dayTextSelected,
                    day.isAvailable && !day.isPast && day.isCurrentMonth && styles.dayTextAvailable,
                    (!day.isAvailable || day.isPast) && day.isCurrentMonth && styles.dayTextDisabled,
                  ]}>
                    {day.date}
                  </Text>

                  {/* Availability indicators */}
                  {day.isCurrentMonth && (
                    <View style={[
                      styles.dayIndicator,
                      day.isAvailable && !day.isPast && styles.dayIndicatorAvailable,
                      (!day.isAvailable || day.isPast) && styles.dayIndicatorUnavailable,
                      day.isSelected && styles.dayIndicatorSelected,
                    ]} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Time Selection */}
          {selectedDate && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Time</Text>
              <View style={styles.timeGrid}>
                {availableTimes.map((time, index) => {
                  // Mock unavailable times (every 3rd time slot)
                  const isTimeUnavailable = index % 3 === 2;
                  const isTimeSelected = selectedTime === time;

                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeButton,
                        isTimeSelected && styles.timeButtonSelected,
                        isTimeUnavailable && styles.timeButtonUnavailable,
                      ]}
                      onPress={() => !isTimeUnavailable ? handleTimeSelect(time) : null}
                      disabled={isTimeUnavailable}
                    >
                      <Text style={[
                        styles.timeText,
                        isTimeSelected && styles.timeTextSelected,
                        isTimeUnavailable && styles.timeTextUnavailable,
                      ]}>
                        {time}
                      </Text>

                      {/* Unavailable overlay */}
                      {isTimeUnavailable && (
                        <View style={styles.timeUnavailableOverlay}>
                          <Ionicons name="close" size={12} color="#E74C3C" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Meeting Location (if in-person or hybrid) */}
          {selectedDate && selectedTime && service.service.location_type !== 'online' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Meeting Location</Text>
              <TextInput
                style={styles.locationInput}
                value={meetingLocation}
                onChangeText={setMeetingLocation}
                placeholder="Enter meeting location..."
                placeholderTextColor="#888"
                multiline
              />
            </View>
          )}

          {/* Special Notes */}
          {selectedDate && selectedTime && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Special Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any special requests or notes..."
                placeholderTextColor="#888"
                multiline
                maxLength={200}
              />
            </View>
          )}

          {/* Booking Summary */}
          {selectedDate && selectedTime && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Booking Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service</Text>
                  <Text style={styles.summaryValue}>{service.service.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date</Text>
                  <Text style={styles.summaryValue}>
                    {new Date(selectedDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Time</Text>
                  <Text style={styles.summaryValue}>{selectedTime}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Duration</Text>
                  <Text style={styles.summaryValue}>{service.service.duration_minutes} min</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₣{service.live_price.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Wallet Balance */}
          {selectedDate && selectedTime && (
            <View style={styles.walletSection}>
              <View style={styles.walletRow}>
                <Ionicons name="wallet" size={20} color="#FFD700" />
                <Text style={styles.walletText}>
                  Wallet Balance: ₣{walletBalance.toFixed(2)}
                </Text>
              </View>
              {service.live_price > walletBalance && (
                <Text style={styles.insufficientText}>
                  Insufficient balance. Add ₣{(service.live_price - walletBalance).toFixed(2)} to wallet.
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        {selectedDate && selectedTime && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.addToCartButton]}
              onPress={addToCart}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="bag-add" size={20} color="white" />
                  <Text style={styles.addToCartButtonText}>Add to Cart</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Service section
  serviceSection: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginVertical: 16,
  },
  serviceDetails: {
    flex: 1,
  },
  serviceName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  serviceCategory: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  serviceDuration: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  serviceLocation: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 8,
  },
  servicePrice: {
    color: '#FF4757',
    fontSize: 20,
    fontWeight: 'bold',
  },
  serviceDescription: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  serviceMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    color: '#CCC',
    fontSize: 12,
    textTransform: 'capitalize',
  },

  // Image gallery
  imageGallery: {
    position: 'relative',
    marginBottom: 16,
  },
  mainServiceImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  indicatorActive: {
    backgroundColor: 'white',
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageNavLeft: {
    left: 12,
  },
  imageNavRight: {
    right: 12,
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginVertical: 12,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  // Calendar
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  monthButton: {
    padding: 8,
  },
  monthTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  daysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderText: {
    flex: 1,
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayButtonInactive: {
    opacity: 0.2,
  },
  dayButtonToday: {
    borderColor: '#3498DB',
    borderWidth: 2,
  },
  dayButtonAvailable: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  dayButtonSelected: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
    borderWidth: 2,
  },
  dayButtonDisabled: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: 'rgba(231, 76, 60, 0.2)',
  },
  dayButtonWeekend: {
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
    borderColor: 'rgba(142, 68, 173, 0.2)',
  },
  dayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dayTextInactive: {
    color: '#444',
  },
  dayTextToday: {
    color: '#3498DB',
    fontWeight: 'bold',
  },
  dayTextAvailable: {
    color: '#3498DB',
  },
  dayTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  dayTextDisabled: {
    color: '#E74C3C',
  },

  // Day availability indicators
  dayIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayIndicatorAvailable: {
    backgroundColor: '#27AE60',
  },
  dayIndicatorUnavailable: {
    backgroundColor: '#E74C3C',
  },
  dayIndicatorSelected: {
    backgroundColor: 'white',
  },

  // Time selection
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
    position: 'relative',
    minWidth: 80,
    alignItems: 'center',
  },
  timeButtonSelected: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  timeButtonUnavailable: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: 'rgba(231, 76, 60, 0.3)',
    opacity: 0.6,
  },
  timeText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  timeTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  timeTextUnavailable: {
    color: '#E74C3C',
    textDecorationLine: 'line-through',
  },
  timeUnavailableOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inputs
  locationInput: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  notesInput: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Summary
  summaryCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#CCC',
    fontSize: 14,
  },
  summaryValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 8,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Wallet
  walletSection: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  insufficientText: {
    color: '#FF4757',
    fontSize: 12,
    marginTop: 8,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  checkoutButton: {
    backgroundColor: '#3498DB',
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  continueButton: {
    backgroundColor: '#FF4757',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  continueSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  addToCartButton: {
    backgroundColor: '#FF0050',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addToCartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LiveServiceBookingModal;