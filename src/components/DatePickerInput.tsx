import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerInputProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  label?: string;
  minimumAge?: number;
  required?: boolean;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  label = 'Date of Birth',
  minimumAge = 18,
  required = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode] = useState<'date' | 'time'>('date');

  // Calculate maximum date (18 years ago) and minimum date (much earlier)
  const today = new Date();
  const maxDate = new Date();
  maxDate.setFullYear(today.getFullYear() - minimumAge); // Max date is 18 years ago
  const minDate = new Date();
  minDate.setFullYear(today.getFullYear() - 120); // Allow very old dates (120 years ago)

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const validateAge = (date: Date): boolean => {
    // Check if date is in the future
    if (date > today) {
      Alert.alert('Invalid Date', 'Date of birth cannot be in the future.');
      return false;
    }

    // Check if user is at least minimumAge years old
    const ageInMs = today.getTime() - date.getTime();
    const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);
    
    if (ageInYears < minimumAge) {
      Alert.alert('Age Restriction', `You must be at least ${minimumAge} years old to sign up.`);
      return false;
    }

    return true;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // Android: event.type is 'set' when user confirms, 'dismissed' when cancelled
    // iOS: event.type is not present, selectedDate is always provided
    
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowPicker(false);
        return;
      }
      
      if (event.type === 'set' && selectedDate) {
        if (validateAge(selectedDate)) {
          onChange(formatDate(selectedDate));
          setShowPicker(false);
        }
        // If validation fails, keep picker open for Android too
      }
    } else {
      // iOS: always get selectedDate, handle validation
      if (selectedDate) {
        if (validateAge(selectedDate)) {
          onChange(formatDate(selectedDate));
        }
        setShowPicker(false); // Always close on iOS
      } else {
        setShowPicker(false);
      }
    }
  };

  const showDatePicker = () => {
    setShowPicker(true);
  };

  const getDisplayDate = (): string => {
    if (!value) return placeholder;
    
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return placeholder;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return placeholder;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredAsterisk}> *</Text>}
      </Text>
      <TouchableOpacity
        style={styles.dateInput}
        onPress={showDatePicker}
        activeOpacity={0.7}
      >
        <Text style={[styles.dateText, !value && styles.placeholderText]}>
          {getDisplayDate()}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#666" />
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : maxDate}
          mode={mode}
          display="default"
          onChange={handleDateChange}
          maximumDate={maxDate}
          minimumDate={minDate}
          style={styles.picker}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '500',
  },
  requiredAsterisk: {
    color: '#FF3B30', // Red color for required indicator
    fontSize: 16,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#444',
    justifyContent: 'space-between',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  placeholderText: {
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  cancelButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  doneButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  doneButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    backgroundColor: '#1E1E1E',
  },
});
