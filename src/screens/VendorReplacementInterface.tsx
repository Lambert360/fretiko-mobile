import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Button,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

interface RiderOption {
  riderId: string;
  riderName: string;
  rating: number;
  distance: number;
  vehicleType: string;
  specialties: string[];
  score: number;
  estimatedArrival: number;
  isAvailable: boolean;
  price: number;
  acceptanceLikelihood: 'high' | 'medium' | 'low';
  priceCompatibility: 'perfect' | 'acceptable' | 'below_range' | 'above_range';
}

interface VendorReplacementProps {
  orderId: string;
  onRiderSelected: (riderId: string) => void;
  onTimeout: () => void;
  onAutoAssign: () => void;
  onClose: () => void;
}

const VendorReplacementInterface: React.FC<VendorReplacementProps> = ({
  orderId,
  onRiderSelected,
  onTimeout,
  onAutoAssign,
  onClose,
}) => {
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [deadline, setDeadline] = useState<Date>(new Date());
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 minutes in seconds
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [autoAssignCountdown, setAutoAssignCountdown] = useState<number>(0);

  // Mock data for demonstration
  const mockRiders: RiderOption[] = [
    {
      riderId: 'rider-1',
      riderName: 'John Adebayo',
      rating: 4.8,
      distance: 0.3,
      vehicleType: 'bike',
      specialties: ['Fast delivery', 'Electronics'],
      score: 95,
      estimatedArrival: 5,
      isAvailable: true,
      price: 8.50,
      acceptanceLikelihood: 'high',
      priceCompatibility: 'perfect',
    },
    {
      riderId: 'rider-2',
      riderName: 'Sarah Okafor',
      rating: 4.9,
      distance: 0.8,
      vehicleType: 'car',
      specialties: ['Bulk delivery', 'Long distance'],
      score: 92,
      estimatedArrival: 8,
      isAvailable: true,
      price: 15.00,
      acceptanceLikelihood: 'high',
      priceCompatibility: 'perfect',
    },
    {
      riderId: 'rider-3',
      riderName: 'Ahmed Hassan',
      rating: 4.7,
      distance: 1.2,
      vehicleType: 'wheelbarrow',
      specialties: ['Eco-friendly', 'Local delivery'],
      score: 88,
      estimatedArrival: 12,
      isAvailable: true,
      price: 3.00,
      acceptanceLikelihood: 'medium',
      priceCompatibility: 'below_range',
    },
    {
      riderId: 'rider-4',
      riderName: 'Maria Silva',
      rating: 4.6,
      distance: 2.1,
      vehicleType: 'bike',
      specialties: ['Same-day delivery'],
      score: 85,
      estimatedArrival: 15,
      isAvailable: false,
      price: 7.50,
      acceptanceLikelihood: 'low',
      priceCompatibility: 'acceptable',
    },
    {
      riderId: 'rider-5',
      riderName: 'David Chen',
      rating: 4.5,
      distance: 3.5,
      vehicleType: 'car',
      specialties: ['Heavy items'],
      score: 82,
      estimatedArrival: 20,
      isAvailable: true,
      price: 20.00,
      acceptanceLikelihood: 'low',
      priceCompatibility: 'above_range',
    },
  ];

  useEffect(() => {
    // Simulate loading riders
    setLoading(true);
    setTimeout(() => {
      setRiders(mockRiders);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    // Set deadline to 5 minutes from now
    const deadlineTime = new Date(Date.now() + 5 * 60 * 1000);
    setDeadline(deadlineTime);
  }, []);

  useEffect(() => {
    // Update time remaining every second
    const interval = setInterval(() => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);
      
      // Start auto-assign countdown when vendor doesn't select
      if (remaining <= 60 && autoAssignCountdown === 0) {
        setAutoAssignCountdown(60); // Start 1-minute countdown
      }
      
      if (autoAssignCountdown > 0) {
        setAutoAssignCountdown(prev => prev - 1);
        if (autoAssignCountdown === 1) {
          onAutoAssign(); // Trigger auto-assignment when hitting 0 next tick
        }
      }
      
      if (remaining === 0) {
        onTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, autoAssignCountdown, onTimeout, onAutoAssign]);

  const handleRiderSelect = (riderId: string) => {
    setSelectedRider(riderId);
    onRiderSelected(riderId);
  };

  const handleAutoAssign = () => {
    // Select the highest scoring available rider
    const availableRiders = riders.filter(rider => rider.isAvailable);
    if (availableRiders.length > 0) {
      const bestRider = availableRiders[0];
      handleRiderSelect(bestRider.riderId);
    }
  };

  const getPriceCompatibilityColor = (compatibility: string) => {
    switch (compatibility) {
      case 'perfect': return '#10B981'; // Green
      case 'acceptable': return '#FF9800'; // Orange
      case 'below_range': return '#FFC107'; // Yellow
      case 'above_range': return '#F44336'; // Red
      default: return '#9E9E9E'; // Gray
    }
  };

  const getAcceptanceLikelihoodColor = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return '#10B981'; // Green
      case 'medium': return '#FF9800'; // Orange
      case 'low': return '#FFC107'; // Yellow
      default: return '#9E9E9E'; // Gray
    }
  };

  const getAcceptanceLikelihoodText = (likelihood: string) => {
    switch (likelihood) {
      case 'high': return 'Very Likely to Accept';
      case 'medium': return 'Likely to Accept';
      case 'low': return 'Unlikely to Accept';
      default: return 'Unknown';
    }
  };

  const getPriceCompatibilityText = (compatibility: string) => {
    switch (compatibility) {
      case 'perfect': return 'Perfect Match';
      case 'acceptable': return 'Acceptable';
      case 'below_range': return 'Below Rider Range';
      case 'above_range': return 'Above Rider Range';
      default: return 'Unknown';
    }
  };

  const renderRiderCard = (rider: RiderOption) => (
    <TouchableOpacity
      key={rider.riderId}
      style={[
        styles.riderCard,
        selectedRider === rider.riderId && styles.selectedRiderCard,
        !rider.isAvailable && styles.unavailableRiderCard,
      ]}
      onPress={() => rider.isAvailable && handleRiderSelect(rider.riderId)}
      disabled={!rider.isAvailable}
    >
      <View style={styles.riderHeader}>
        <View style={styles.riderInfo}>
          <Text style={styles.riderName}>{rider.riderName}</Text>
          <View style={styles.riderMeta}>
            <Text style={styles.rating}>⭐ {rider.rating}</Text>
            <Text style={styles.distance}>{rider.distance} km away</Text>
          </View>
        </View>
        <View style={styles.riderPricing}>
          <Text style={styles.price}>₣{rider.price}</Text>
          <View style={[styles.compatibilityIndicator, { backgroundColor: getPriceCompatibilityColor(rider.priceCompatibility) }]}>
            <Text style={styles.compatibilityText}>{getPriceCompatibilityText(rider.priceCompatibility)}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.riderDetails}>
        <View style={styles.riderStats}>
          <Text style={styles.statItem}>
            <Ionicons name="car" style={styles.statIcon} size={16} color="#666" />
            <Text style={styles.statText}>{rider.vehicleType}</Text>
          </Text>
          <Text style={styles.statItem}>
            <Ionicons name="time" style={styles.statIcon} size={16} color="#666" />
            <Text style={styles.statText}>{rider.estimatedArrival} min</Text>
          </Text>
        </View>
        
        <View style={styles.riderSpecialties}>
          {rider.specialties.map((specialty, index) => (
            <View key={index} style={styles.specialtyTag}>
              <Text style={styles.specialtyText}>{specialty}</Text>
            </View>
          ))}
        </View>
      </View>
      
      <View style={styles.riderFooter}>
        <View style={styles.acceptanceIndicator}>
          <Text style={[styles.acceptanceText, { color: getAcceptanceLikelihoodColor(rider.acceptanceLikelihood) }]}>
            {getAcceptanceLikelihoodText(rider.acceptanceLikelihood)}
          </Text>
          <Text style={styles.acceptanceScore}>
            Score: {rider.score}/100
          </Text>
        </View>
        <View style={styles.riderActions}>
          <Text style={styles.actionText}>
            {selectedRider === rider.riderId ? 'Selected' : 'Select Rider'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAutoAssignCountdown = () => {
    if (autoAssignCountdown > 0 && autoAssignCountdown <= 60) {
      return (
        <View style={styles.autoAssignCountdown}>
          <Ionicons name="time" style={styles.countdownIcon} size={20} color="#FF9800" />
          <Text style={styles.countdownText}>
            Auto-assign in {autoAssignCountdown}s
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Select Replacement Rider</Text>
          <Text style={styles.subtitle}>
            Order #{orderId.slice(-6)} • Choose a rider or wait for auto-assignment
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" style={styles.closeIcon} size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Finding available riders...</Text>
        </View>
      ) : (
        <ScrollView style={styles.ridersList}>
          {riders.map(renderRiderCard)}
        </ScrollView>
      )}

      {renderAutoAssignCountdown()}

      <View style={styles.footerActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.autoAssignButton]}
          onPress={handleAutoAssign}
        >
          <Ionicons name="flash" style={styles.actionIcon} size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Auto-Assign Best Rider</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={onClose}
        >
          <Ionicons name="close-circle" style={styles.actionIcon} size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Cancel Replacement</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.deadlineIndicator}>
        <Ionicons name="time" style={styles.deadlineIcon} size={16} color="#FF9800" />
        <Text style={styles.deadlineText}>
          {timeRemaining > 0 ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')} left` : 'Time expired!'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  ridersList: {
    flex: 1,
    padding: 16,
  },
  riderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 3,
  },
  selectedRiderCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    elevation: 5,
  },
  unavailableRiderCard: {
    opacity: 0.6,
  },
  riderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  riderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rating: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  distance: {
    fontSize: 12,
    color: '#666',
  },
  riderPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  compatibilityIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  compatibilityText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFF',
  },
  riderDetails: {
    padding: 16,
    paddingTop: 8,
  },
  riderStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 14,
    color: '#666',
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  riderSpecialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  specialtyTag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specialtyText: {
    fontSize: 10,
    color: '#333',
    fontWeight: '500',
  },
  riderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  acceptanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptanceText: {
    fontSize: 10,
    fontWeight: '500',
  },
  acceptanceScore: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  riderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  footerActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  autoAssignButton: {
    backgroundColor: '#28A745',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  actionIcon: {
    fontSize: 20,
    color: '#FFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  deadlineIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    marginTop: 8,
  },
  deadlineIcon: {
    fontSize: 16,
    color: '#FF9800',
  },
  deadlineText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  autoAssignCountdown: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
    marginTop: 8,
  },
  countdownIcon: {
    fontSize: 20,
    color: '#FF9800',
  },
  countdownText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
});

export default VendorReplacementInterface;
