import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ScheduleType = 'meal_plan' | 'reminder' | 'purchase' | 'event' | 'task';

interface ScheduleCardData {
  type: ScheduleType;
  title: string;
  description?: string;
  suggestedDate?: string;
  icon?: string;
}

interface ScheduleMessageCardProps {
  scheduleData: ScheduleCardData;
  isCurrentUser: boolean;
  messageText?: string;
  onPress: (scheduleData: ScheduleCardData) => void;
}

const ScheduleMessageCard: React.FC<ScheduleMessageCardProps> = ({
  scheduleData,
  isCurrentUser,
  messageText,
  onPress,
}) => {
  const getScheduleIcon = (type: ScheduleType): string => {
    switch (type) {
      case 'meal_plan':
        return 'restaurant';
      case 'reminder':
        return 'notifications';
      case 'purchase':
        return 'cart';
      case 'event':
        return 'calendar';
      case 'task':
        return 'checkmark-circle';
      default:
        return 'calendar';
    }
  };

  const getScheduleColor = (type: ScheduleType): string => {
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

  const getScheduleLabel = (type: ScheduleType): string => {
    switch (type) {
      case 'meal_plan':
        return 'Meal Plan';
      case 'reminder':
        return 'Reminder';
      case 'purchase':
        return 'Purchase Plan';
      case 'event':
        return 'Event';
      case 'task':
        return 'Task';
      default:
        return 'Schedule';
    }
  };

  const iconName = scheduleData.icon || getScheduleIcon(scheduleData.type);
  const color = getScheduleColor(scheduleData.type);
  const label = getScheduleLabel(scheduleData.type);

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      {/* Schedule Card - Tappable */}
      <TouchableOpacity
        style={[styles.scheduleCard, { borderLeftColor: color }]}
        onPress={() => onPress(scheduleData)}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
              <Ionicons name={iconName as any} size={20} color={color} />
            </View>
            <Text style={styles.scheduleLabel}>{label}</Text>
          </View>
          <View style={styles.ikoBadge}>
            <Ionicons name="sparkles" size={10} color="#3498DB" />
            <Text style={styles.ikoText}>IKO</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{scheduleData.title}</Text>
          {scheduleData.description && (
            <Text style={styles.description} numberOfLines={2}>
              {scheduleData.description}
            </Text>
          )}
        </View>

        {/* Suggested Date */}
        {scheduleData.suggestedDate && (
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={14} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.dateText}>
              Suggested: {new Date(scheduleData.suggestedDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        )}

        {/* Action Button */}
        <View style={[styles.actionButton, { backgroundColor: color + '30' }]}>
          <Ionicons name="calendar-outline" size={16} color={color} />
          <Text style={[styles.actionText, { color }]}>Tap to Schedule</Text>
          <Ionicons name="chevron-forward" size={16} color={color} />
        </View>
      </TouchableOpacity>

      {/* Message Text Below Card */}
      {messageText && (
        <View style={styles.messageTextContainer}>
          <Text style={styles.messageText}>{messageText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '85%',
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sentContainer: {
    alignSelf: 'flex-end',
    marginRight: 8,
    backgroundColor: '#051094',
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    backgroundColor: '#59788E',
  },
  scheduleCard: {
    borderRadius: 12,
    padding: 12,
    margin: 8,
    marginBottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  ikoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
  },
  ikoText: {
    color: '#3498DB',
    fontSize: 9,
    fontWeight: '600',
  },
  content: {
    marginBottom: 12,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageTextContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageText: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 20,
  },
});

export default ScheduleMessageCard;

