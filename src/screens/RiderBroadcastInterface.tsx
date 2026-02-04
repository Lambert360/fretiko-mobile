import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  Dimensions,
  Vibration,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface BroadcastAssignment {
  orderId: string;
  orderNumber: string;
  deliveryFee: number;
  pickupAddress: string;
  deliveryAddress: string;
  broadcastId: string;
  expiresAt: string;
  estimatedEarnings: number;
  distance: number;
  estimatedArrival: string;
}

interface RiderBroadcastInterfaceProps {
  assignment: BroadcastAssignment;
  onAccept: (broadcastId: string) => void;
  onReject: (broadcastId: string) => void;
  onTimeout: (broadcastId: string) => void;
  visible: boolean;
  onClose: () => void;
}

const RiderBroadcastInterface: React.FC<RiderBroadcastInterfaceProps> = ({
  assignment,
  onAccept,
  onReject,
  onTimeout,
  visible,
  onClose,
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 minutes in seconds
  const [accepting, setAccepting] = useState<boolean>(false);
  const [rejecting, setRejecting] = useState<boolean>(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(Dimensions.get('window').height));
  const [otherRidersCount, setOtherRidersCount] = useState<number>(0);

  useEffect(() => {
    if (visible) {
      // Animate modal in
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Start pulse animation
      startPulseAnimation();

      Vibration.vibrate([0, 200, 100, 200]);

      // Simulate other riders viewing
      simulateOtherRiders();
    }
  }, [visible]);

  useEffect(() => {
    // Update time remaining every second
    const interval = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(assignment.expiresAt);
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        onTimeout(assignment.broadcastId);
        closeModal();
      }

      // Urgent notifications in last 30 seconds
      if (remaining === 30) {
        Vibration.vibrate([0, 500, 200, 500]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [assignment.expiresAt, onTimeout]);

  // Note: audio notifications removed due to unavailable expo-av dependency

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const simulateOtherRiders = () => {
    // Simulate other riders viewing the assignment
    const intervals = [5000, 8000, 12000, 15000, 20000]; // Random intervals
    
    intervals.forEach((delay, index) => {
      setTimeout(() => {
        setOtherRidersCount(prev => prev + 1);
        
        // Vibrate to show competition
        Vibration.vibrate(100);
      }, delay);
    });
  };

  const handleAccept = async () => {
    setAccepting(true);
    
    try {
      // Show confirmation dialog
      Alert.alert(
        'Accept Assignment',
        `Are you sure you want to accept this assignment?\n\nDelivery Fee: ₣${assignment.deliveryFee}\nEstimated Earnings: ₣${assignment.estimatedEarnings.toFixed(2)}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setAccepting(false) },
          { text: 'Accept', style: 'default', onPress: () => confirmAccept() },
        ]
      );
    } catch (error) {
      console.error('Error accepting assignment:', error);
      setAccepting(false);
    }
  };

  const confirmAccept = async () => {
    try {
      await onAccept(assignment.broadcastId);
      closeModal();
    } catch (error) {
      console.error('Error confirming accept:', error);
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    
    try {
      await onReject(assignment.broadcastId);
      closeModal();
    } catch (error) {
      console.error('Error rejecting assignment:', error);
      setRejecting(false);
    }
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      onClose();
    });
  };

  const getTimeColor = () => {
    if (timeRemaining > 120) return '#10B981'; // Green
    if (timeRemaining > 60) return '#FF9800'; // Orange
    if (timeRemaining > 30) return '#FFC107'; // Yellow
    return '#FF5252'; // Red
  };

  const getTimeText = () => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.modalContainer, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header with urgency indicator */}
          <LinearGradient
            colors={timeRemaining < 30 ? ['#FF5252', '#FF1744'] : ['#007AFF', '#0056B3']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.urgencyIndicator}>
                <Animated.View style={[styles.pulseContainer, { transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name="flash" style={styles.urgencyIcon} size={24} color="#FFF" />
                </Animated.View>
                <Text style={styles.urgencyText}>
                  {timeRemaining < 30 ? 'URGENT!' : 'NEW ASSIGNMENT'}
                </Text>
              </View>
              
              <View style={styles.timerContainer}>
                <Text style={[styles.timerText, { color: '#FFF' }]}>
                  {getTimeText()}
                </Text>
                <Text style={styles.timerLabel}>Time Remaining</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Competition indicator */}
          <View style={styles.competitionBar}>
            <View style={styles.competitionContent}>
              <Ionicons name="people" style={styles.competitionIcon} size={16} color="#FF9800" />
              <Text style={styles.competitionText}>
                {otherRidersCount} other rider{otherRidersCount !== 1 ? 's' : ''} viewing
              </Text>
            </View>
            <Text style={styles.firstToAcceptText}>
              First to accept gets the assignment!
            </Text>
          </View>

          {/* Order details */}
          <ScrollView style={styles.content}>
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>Order #{assignment.orderNumber.slice(-6)}</Text>
                <View style={styles.earningsBadge}>
                  <Text style={styles.earningsText}>₣{assignment.deliveryFee}</Text>
                </View>
              </View>
              
              <View style={styles.orderDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="location" style={styles.detailIcon} size={16} color="#666" />
                  <Text style={styles.detailText}>{assignment.pickupAddress}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="navigate" style={styles.detailIcon} size={16} color="#666" />
                  <Text style={styles.detailText}>{assignment.deliveryAddress}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time" style={styles.detailIcon} size={16} color="#666" />
                  <Text style={styles.detailText}>Est. arrival: {assignment.estimatedArrival}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="car" style={styles.detailIcon} size={16} color="#666" />
                  <Text style={styles.detailText}>{assignment.distance} km away</Text>
                </View>
              </View>
            </View>

            {/* Earnings highlight */}
            <View style={styles.earningsCard}>
              <LinearGradient
                colors={['#4CAF50', '#45A049']}
                style={styles.earningsGradient}
              >
                <View style={styles.earningsContent}>
                  <Text style={styles.earningsTitle}>Your Estimated Earnings</Text>
                  <Text style={styles.earningsAmount}>₣{assignment.estimatedEarnings.toFixed(2)}</Text>
                  <Text style={styles.earningsNote}>Includes delivery fee + tip</Text>
                </View>
                <Ionicons name="trending-up" style={styles.earningsIcon} size={32} color="#FFF" />
              </LinearGradient>
            </View>

            {/* Action buttons */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAccept}
                disabled={accepting || rejecting}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" style={styles.actionIcon} size={20} color="#FFF" />
                    <Text style={styles.actionButtonText}>Accept Assignment</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={handleReject}
                disabled={accepting || rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="#666" />
                ) : (
                  <>
                    <Ionicons name="close-circle" style={styles.actionIcon} size={20} color="#666" />
                    <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Warning for low time */}
            {timeRemaining < 30 && (
              <View style={styles.warningCard}>
                <Ionicons name="warning" style={styles.warningIcon} size={20} color="#FF5252" />
                <Text style={styles.warningText}>
                  Only {timeRemaining} seconds left! Accept now or this assignment will be given to someone else.
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgencyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgencyIcon: {
    fontSize: 20,
  },
  urgencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  timerContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 20,
    fontWeight: '700',
  },
  timerLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  competitionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  competitionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  competitionIcon: {
    fontSize: 16,
  },
  competitionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#856404',
  },
  firstToAcceptText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#856404',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  earningsBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  earningsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  orderDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailIcon: {
    fontSize: 16,
    color: '#666',
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  earningsCard: {
    marginBottom: 16,
  },
  earningsGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  earningsContent: {
    flex: 1,
  },
  earningsTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  earningsNote: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  earningsIcon: {
    fontSize: 32,
    color: '#FFF',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionIcon: {
    fontSize: 20,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  rejectButtonText: {
    color: '#666',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF5252',
  },
  warningIcon: {
    fontSize: 20,
  },
  warningText: {
    fontSize: 12,
    color: '#D32F2F',
    flex: 1,
    fontWeight: '500',
  },
});

export default RiderBroadcastInterface;
