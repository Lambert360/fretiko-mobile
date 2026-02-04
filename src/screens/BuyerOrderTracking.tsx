import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  time: string;
  icon: string;
  color: string;
  active?: boolean;
  completed?: boolean;
}

interface ReplacementStage {
  stage: 'none' | 'vendor_selection' | 'fastest_finger' | 'completed' | 'failed';
  deadline?: string;
  availableRiders?: any[];
  message: string;
  startTime?: string;
  endTime?: string;
}

interface OrderTrackingProps {
  orderId: string;
  orderNumber: string;
  vendorId: string;
  buyerId: string;
  initialStatus?: ReplacementStage;
}

const BuyerOrderTracking: React.FC<OrderTrackingProps> = ({
  orderId,
  orderNumber,
  vendorId,
  buyerId,
  initialStatus,
}) => {
  const [status, setStatus] = useState<ReplacementStage>(initialStatus || { stage: 'none', message: 'No replacement in progress' });
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    fetchReplacementStatus();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchReplacementStatus, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update time remaining if there's a deadline
    if (status.deadline) {
      const interval = setInterval(() => {
        const now = new Date();
        const deadline = new Date(status.deadline!);
        const remaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
        setTimeRemaining(remaining);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status.deadline]);

  const fetchReplacementStatus = async () => {
    try {
      setLoading(true);
      
      // Mock API call - replace with actual API
      const mockStatus: ReplacementStage = {
        stage: 'vendor_selection',
        deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes from now
        message: 'Vendor is selecting a replacement rider',
        startTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // Started 2 minutes ago
        availableRiders: [
          {
            riderId: 'rider-1',
            riderName: 'John Adebayo',
            rating: 4.8,
            distance: 0.3,
            vehicleType: 'bike',
            score: 95,
            price: 8.50,
          },
          {
            riderId: 'rider-2',
            riderName: 'Sarah Okafor',
            rating: 4.9,
            distance: 0.8,
            vehicleType: 'car',
            score: 92,
            price: 15.00,
          },
        ],
      };

      setStatus(mockStatus);
      generateTimeline(mockStatus);
      
    } catch (error) {
      console.error('Error fetching replacement status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateTimeline = (currentStatus: ReplacementStage) => {
    const events: TimelineEvent[] = [
      {
        id: '1',
        type: 'start',
        title: 'Replacement Started',
        description: 'System initiated replacement workflow',
        time: currentStatus.startTime || new Date().toISOString(),
        icon: 'refresh-circle-outline',
        color: '#007AFF',
      },
    ];

    if (currentStatus.stage === 'vendor_selection') {
      events.push({
        id: '2',
        type: 'vendor_selection',
        title: 'Vendor Selection',
        description: currentStatus.message,
        time: currentStatus.startTime || new Date().toISOString(),
        icon: 'person-outline',
        color: '#FF9800',
        active: true,
      });
    }

    if (currentStatus.stage === 'fastest_finger') {
      events.push({
        id: '2',
        type: 'vendor_selection',
        title: 'Vendor Selection',
        description: 'Vendor selection period ended',
        time: currentStatus.startTime || new Date().toISOString(),
        icon: 'person-outline',
        color: '#666',
        completed: true,
      });

      events.push({
        id: '3',
        type: 'fastest_finger',
        title: 'Fastest Finger Broadcast',
        description: 'Broadcasting to all available riders',
        time: new Date().toISOString(),
        icon: 'radio-outline',
        color: '#4CAF50',
        active: true,
      });
    }

    if (currentStatus.stage === 'completed') {
      events.push({
        id: '2',
        type: 'vendor_selection',
        title: 'Vendor Selection',
        description: 'Vendor selected replacement rider',
        time: currentStatus.startTime || new Date().toISOString(),
        icon: 'person-outline',
        color: '#666',
        completed: true,
      });

      events.push({
        id: '3',
        type: 'completed',
        title: 'Replacement Complete',
        description: 'New rider assigned successfully',
        time: currentStatus.endTime || new Date().toISOString(),
        icon: 'checkmark-circle-outline',
        color: '#4CAF50',
        completed: true,
      });
    }

    if (currentStatus.stage === 'failed') {
      events.push({
        id: '2',
        type: 'failed',
        title: 'Replacement Failed',
        description: 'No riders available',
        time: currentStatus.endTime || new Date().toISOString(),
        icon: 'close-circle-outline',
        color: '#FF5252',
        completed: true,
      });
    }

    setTimeline(events);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'vendor_selection': return '#FF9800';
      case 'fastest_finger': return '#4CAF50';
      case 'completed': return '#4CAF50';
      case 'failed': return '#FF5252';
      default: return '#666';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'vendor_selection': return 'person-outline';
      case 'fastest_finger': return 'radio-outline';
      case 'completed': return 'checkmark-circle-outline';
      case 'failed': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTimelineItem = (item: any, index: number) => (
    <View key={item.id} style={styles.timelineItem}>
      <View style={styles.timelineIconContainer}>
        <View style={[
          styles.timelineIcon,
          { backgroundColor: item.completed ? '#E0E0E0' : item.color },
          item.active && styles.activeTimelineIcon,
        ]}>
          <Ionicons
            name={item.icon}
            size={20}
            color={item.completed ? '#999' : '#FFF'}
          />
        </View>
        {index < timeline.length - 1 && <View style={styles.timelineLine} />}
      </View>
      
      <View style={styles.timelineContent}>
        <Text style={[
          styles.timelineTitle,
          item.completed && styles.completedTimelineTitle,
        ]}>
          {item.title}
        </Text>
        <Text style={styles.timelineDescription}>{item.description}</Text>
        <Text style={styles.timelineTime}>{formatTime(item.time)}</Text>
      </View>
    </View>
  );

  const renderRiderOptions = () => {
    if (!status.availableRiders || status.availableRiders.length === 0) {
      return null;
    }

    return (
      <View style={styles.riderOptionsContainer}>
        <Text style={styles.sectionTitle}>Available Riders</Text>
        {status.availableRiders.map((rider, index) => (
          <View key={rider.riderId} style={styles.riderOption}>
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{rider.riderName}</Text>
              <View style={styles.riderMeta}>
                <Text style={styles.riderRating}>⭐ {rider.rating}</Text>
                <Text style={styles.riderDistance}>{rider.distance} km</Text>
                <Text style={styles.riderVehicle}>{rider.vehicleType}</Text>
              </View>
            </View>
            <View style={styles.riderStats}>
              <Text style={styles.riderScore}>Score: {rider.score}/100</Text>
              <Text style={styles.riderPrice}>₣{rider.price}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderActiveStage = () => {
    if (status.stage === 'none') {
      return (
        <View style={styles.noActiveStage}>
          <Ionicons name="information-circle-outline" style={styles.noStageIcon} size={48} color="#999" />
          <Text style={styles.noStageTitle}>No Replacement in Progress</Text>
          <Text style={styles.noStageDescription}>
            If the current rider rejects or times out, a replacement process will start automatically.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.activeStageContainer}>
        <LinearGradient
          colors={[getStageColor(status.stage), getStageColor(status.stage) + 'CC']}
          style={styles.stageHeader}
        >
          <View style={styles.stageHeaderContent}>
            <Ionicons
              name={getStageIcon(status.stage)}
              size={24}
              color="#FFF"
              style={styles.stageIcon}
            />
            <Text style={styles.stageTitle}>{status.message}</Text>
          </View>
        </LinearGradient>

        {timeRemaining > 0 && (
          <View style={styles.countdownContainer}>
            <Ionicons name="time-outline" style={styles.countdownIcon} size={20} color={getStageColor(status.stage)} />
            <Text style={[styles.countdownText, { color: getStageColor(status.stage) }]}>
              {formatTimeRemaining(timeRemaining)} remaining
            </Text>
          </View>
        )}

        {renderRiderOptions()}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchReplacementStatus} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.orderNumber}>Order #{orderNumber.slice(-6)}</Text>
        <Text style={styles.headerSubtitle}>Replacement Tracking</Text>
      </View>

      {/* Active Stage */}
      {renderActiveStage()}

      {/* Timeline */}
      <View style={styles.timelineContainer}>
        <Text style={styles.sectionTitle}>Replacement Timeline</Text>
        {timeline.map((item, index) => renderTimelineItem(item, index))}
      </View>

      {/* Help Section */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpTitle}>How Replacement Works</Text>
        <View style={styles.helpSteps}>
          <View style={styles.helpStep}>
            <Ionicons name="time-outline" style={styles.helpIcon} size={16} color="#007AFF" />
            <Text style={styles.helpText}>Vendor gets 5 minutes to select a replacement rider</Text>
          </View>
          <View style={styles.helpStep}>
            <Ionicons name="radio-outline" style={styles.helpIcon} size={16} color="#FF9800" />
            <Text style={styles.helpText}>If no selection, system broadcasts to all riders</Text>
          </View>
          <View style={styles.helpStep}>
            <Ionicons name="flash-outline" style={styles.helpIcon} size={16} color="#4CAF50" />
            <Text style={styles.helpText}>First rider to accept gets the assignment</Text>
          </View>
        </View>
      </View>

      {/* Contact Support */}
      <View style={styles.supportContainer}>
        <Text style={styles.supportTitle}>Need Help?</Text>
        <TouchableOpacity style={styles.supportButton}>
          <Ionicons name="call-outline" style={styles.supportIcon} size={20} color="#007AFF" />
          <Text style={styles.supportButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  activeStageContainer: {
    margin: 16,
    marginBottom: 8,
  },
  stageHeader: {
    padding: 16,
    borderRadius: 12,
  },
  stageHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stageIcon: {
    fontSize: 24,
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  countdownIcon: {
    fontSize: 20,
  },
  countdownText: {
    fontSize: 16,
    fontWeight: '600',
  },
  riderOptionsContainer: {
    marginTop: 16,
  },
  riderOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  riderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  riderRating: {
    fontSize: 12,
    color: '#666',
  },
  riderDistance: {
    fontSize: 12,
    color: '#666',
  },
  riderVehicle: {
    fontSize: 12,
    color: '#666',
  },
  riderStats: {
    alignItems: 'flex-end',
  },
  riderScore: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  riderPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  noActiveStage: {
    alignItems: 'center',
    padding: 40,
    margin: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  noStageIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noStageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  noStageDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  timelineContainer: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTimelineIcon: {
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    elevation: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 8,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  completedTimelineTitle: {
    color: '#666',
  },
  timelineDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 12,
    color: '#999',
  },
  helpContainer: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  helpSteps: {
    gap: 8,
  },
  helpStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpIcon: {
    fontSize: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  supportContainer: {
    margin: 16,
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  supportIcon: {
    fontSize: 20,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default BuyerOrderTracking;
