import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { ScheduleType } from './ScheduleMessageCard';

interface ScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  scheduleType: ScheduleType;
  title: string;
  suggestedDate?: string;
  onSchedule: (data: ScheduleActivityData) => void;
}

export interface ScheduleActivityData {
  type: ScheduleType;
  title: string;
  description: string;
  scheduledDate: string;
  scheduledTime?: string;
  notes?: string;
  recurrence?: 'once' | 'daily' | 'weekly' | 'monthly';
  reminderBefore?: number; // minutes before
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  visible,
  onClose,
  scheduleType,
  title: initialTitle,
  suggestedDate,
  onSchedule,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    suggestedDate || new Date().toISOString().split('T')[0]
  );
  const [activityTitle, setActivityTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [recurrence, setRecurrence] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once');
  const [reminderBefore, setReminderBefore] = useState(30); // 30 minutes default

  const handleSchedule = () => {
    if (!activityTitle.trim()) {
      Alert.alert('Required', 'Please enter a title for your activity');
      return;
    }

    if (!selectedDate) {
      Alert.alert('Required', 'Please select a date');
      return;
    }

    const scheduleData: ScheduleActivityData = {
      type: scheduleType,
      title: activityTitle.trim(),
      description: description.trim(),
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
      notes: notes.trim(),
      recurrence,
      reminderBefore,
    };

    onSchedule(scheduleData);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setActivityTitle('');
    setDescription('');
    setNotes('');
    setSelectedTime('09:00');
    setRecurrence('once');
    setReminderBefore(30);
  };

  const getTypeColor = (type: ScheduleType): string => {
    switch (type) {
      case 'meal_plan':
        return '#FF6B6B';
      case 'reminder':
        return '#4ECDC4';
      case 'purchase':
        return '#FFD93D';
      case 'event':
        return '#6C5CE7';
      case 'task':
        return '#00B894';
      default:
        return '#3498DB';
    }
  };

  const color = getTypeColor(scheduleType);

  const markedDates = {
    [selectedDate]: {
      selected: true,
      selectedColor: color,
      selectedTextColor: '#FFFFFF',
    },
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                <Ionicons
                  name={
                    scheduleType === 'meal_plan'
                      ? 'restaurant'
                      : scheduleType === 'reminder'
                      ? 'notifications'
                      : scheduleType === 'purchase'
                      ? 'cart'
                      : scheduleType === 'event'
                      ? 'calendar'
                      : 'checkmark-circle'
                  }
                  size={24}
                  color={color}
                />
              </View>
              <Text style={styles.headerTitle}>Schedule Activity</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Activity Title */}
            <View style={styles.section}>
              <Text style={styles.label}>Activity Title *</Text>
              <TextInput
                style={styles.input}
                value={activityTitle}
                onChangeText={setActivityTitle}
                placeholder="What would you like to schedule?"
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
              />
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add details about this activity..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Calendar */}
            <View style={styles.section}>
              <Text style={styles.label}>Select Date *</Text>
              <Calendar
                current={selectedDate}
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={markedDates}
                theme={{
                  backgroundColor: '#1a1a1a',
                  calendarBackground: '#1a1a1a',
                  textSectionTitleColor: '#FFF',
                  selectedDayBackgroundColor: color,
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: color,
                  dayTextColor: '#FFF',
                  textDisabledColor: '#666',
                  monthTextColor: '#FFF',
                  arrowColor: color,
                }}
                style={styles.calendar}
              />
            </View>

            {/* Time Picker */}
            <View style={styles.section}>
              <Text style={styles.label}>Time</Text>
              <View style={styles.timePickerContainer}>
                <Ionicons name="time-outline" size={20} color={color} />
                <TextInput
                  style={styles.timeInput}
                  value={selectedTime}
                  onChangeText={setSelectedTime}
                  placeholder="09:00"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                />
                <Text style={styles.timeHint}>24-hour format (HH:MM)</Text>
              </View>
            </View>

            {/* Recurrence */}
            <View style={styles.section}>
              <Text style={styles.label}>Repeat</Text>
              <View style={styles.recurrenceContainer}>
                {(['once', 'daily', 'weekly', 'monthly'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.recurrenceOption,
                      recurrence === option && {
                        backgroundColor: color + '30',
                        borderColor: color,
                      },
                    ]}
                    onPress={() => setRecurrence(option)}
                  >
                    <Text
                      style={[
                        styles.recurrenceText,
                        recurrence === option && { color },
                      ]}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reminder */}
            <View style={styles.section}>
              <Text style={styles.label}>Remind Me Before</Text>
              <View style={styles.reminderContainer}>
                {[15, 30, 60, 120, 1440].map((minutes) => (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.reminderOption,
                      reminderBefore === minutes && {
                        backgroundColor: color + '30',
                        borderColor: color,
                      },
                    ]}
                    onPress={() => setReminderBefore(minutes)}
                  >
                    <Text
                      style={[
                        styles.reminderText,
                        reminderBefore === minutes && { color },
                      ]}
                    >
                      {minutes < 60
                        ? `${minutes}m`
                        : minutes < 1440
                        ? `${minutes / 60}h`
                        : '1 day'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>Additional Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes or context..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.scheduleButton, { backgroundColor: color }]}
              onPress={handleSchedule}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.scheduleButtonText}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  calendar: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  timeInput: {
    color: '#FFF',
    fontSize: 15,
    flex: 1,
  },
  timeHint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  recurrenceContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  recurrenceOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  recurrenceText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  reminderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reminderText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleButton: {
    // backgroundColor set dynamically
  },
  scheduleButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ScheduleModal;

