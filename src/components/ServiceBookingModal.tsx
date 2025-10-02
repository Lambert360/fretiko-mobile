import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoFeedItem } from '../services/servicesAPI';
import { walletAPI } from '../services/walletAPI';

const { width } = Dimensions.get('window');

interface ServiceBookingModalProps {
  visible: boolean;
  service: VideoFeedItem | null;
  onClose: () => void;
  onBook: (serviceId: string, date: Date, time: string, notes?: string) => Promise<void>;
}

const ServiceBookingModal: React.FC<ServiceBookingModalProps> = ({
  visible,
  service,
  onClose,
  onBook,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Generate available dates (next 30 days)
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 8; // 8 AM
    const endHour = 18; // 6 PM
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    
    return slots;
  };

  const handleBookService = async () => {
    if (!service || !selectedTime) return;
    
    try {
      setLoading(true);
      await onBook(service.id, selectedDate, selectedTime, notes.trim() || undefined);
      onClose();
      
      // Reset form
      setSelectedDate(new Date());
      setSelectedTime('');
      setNotes('');
    } catch (error) {
      console.error('Error booking service:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  if (!service) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Book Service</Text>
          
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Service Info */}
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle}>{service.title}</Text>
            <Text style={styles.serviceProvider}>by @{service.username}</Text>
            <Text style={styles.servicePrice}>{walletAPI.formatFreti(service.price)}</Text>
            
            <View style={styles.serviceDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.detailText}>{service.rating.toFixed(1)} rating</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                <Text style={styles.detailText}>{service.completedJobs} completed jobs</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color="#888" />
                <Text style={styles.detailText}>{service.location}</Text>
              </View>
            </View>
          </View>

          {/* Date Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateScroll}
            >
              {generateDates().map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dateOption,
                    selectedDate.toDateString() === date.toDateString() && styles.selectedDate
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[
                    styles.dateText,
                    selectedDate.toDateString() === date.toDateString() && styles.selectedDateText
                  ]}>
                    {formatDate(date)}
                  </Text>
                  <Text style={[
                    styles.dayText,
                    selectedDate.toDateString() === date.toDateString() && styles.selectedDayText
                  ]}>
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Time Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time</Text>
            <View style={styles.timeGrid}>
              {generateTimeSlots().map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    selectedTime === time && styles.selectedTime
                  ]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text style={[
                    styles.timeText,
                    selectedTime === time && styles.selectedTimeText
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special requirements or notes..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Book Button */}
        <View style={[styles.bookingContainer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity 
            style={[
              styles.bookButton,
              (!selectedTime || loading) && styles.bookButtonDisabled
            ]}
            onPress={handleBookService}
            disabled={!selectedTime || loading}
          >
            {loading ? (
              <Text style={styles.bookButtonText}>Booking...</Text>
            ) : (
              <>
                <Text style={styles.bookButtonText}>
                  Book for {walletAPI.formatFreti(service.price)}
                </Text>
                <Ionicons name="calendar" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
          
          {selectedDate && selectedTime && (
            <Text style={styles.bookingSummary}>
              📅 {formatDate(selectedDate)} at {selectedTime}
            </Text>
          )}
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  serviceInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  serviceTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  serviceProvider: {
    color: '#3498DB',
    fontSize: 16,
    marginBottom: 8,
  },
  servicePrice: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  serviceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 8,
  },
  detailText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 6,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  dateScroll: {
    paddingRight: 20,
  },
  dateOption: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    minWidth: 80,
  },
  selectedDate: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  dateText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  selectedDateText: {
    color: 'white',
  },
  dayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedDayText: {
    color: 'white',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timeOption: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    width: '30%',
    alignItems: 'center',
  },
  selectedTime: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  timeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedTimeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  notesInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 100,
  },
  bookingContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  bookButton: {
    backgroundColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  bookButtonDisabled: {
    backgroundColor: '#666',
  },
  bookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  bookingSummary: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ServiceBookingModal;