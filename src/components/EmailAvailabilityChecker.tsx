import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import { API_CONFIG } from '../config/api';

interface EmailAvailabilityCheckerProps {
  email: string;
  onAvailabilityChange: (isAvailable: boolean | null) => void;
  disabled?: boolean;
}

export const EmailAvailabilityChecker: React.FC<EmailAvailabilityCheckerProps> = ({
  email,
  onAvailabilityChange,
  disabled = false,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [lastCheckedEmail, setLastCheckedEmail] = useState('');

  const checkEmailAvailability = useCallback(
    debounce(async (emailToCheck: string) => {
      if (!emailToCheck || emailToCheck.length < 3) {
        setAvailability(null);
        onAvailabilityChange(null);
        return;
      }

      setIsChecking(true);
      setAvailability(null);
      onAvailabilityChange(null);

      try {
        console.log('🔍 Checking email availability for:', emailToCheck);
        console.log('🌐 Using API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
        
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/auth/check-email-availability?email=${encodeURIComponent(emailToCheck)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await response.json();

        if (data.success) {
          setAvailability(data.available);
          onAvailabilityChange(data.available);
          setLastCheckedEmail(emailToCheck);
        }
      } catch (error) {
        console.error('Error checking email availability:', error);
        setAvailability(null);
        onAvailabilityChange(null);
      } finally {
        setIsChecking(false);
      }
    }, 300), // 300ms debounce
    []
  );

  useEffect(() => {
    if (email !== lastCheckedEmail && !disabled) {
      checkEmailAvailability(email);
    }
  }, [email, lastCheckedEmail, disabled, checkEmailAvailability]);

  const getStatusIcon = () => {
    if (isChecking) {
      return 'time'; // Loading icon
    }
    if (availability === true) {
      return 'checkmark-circle'; // Available
    }
    if (availability === false) {
      return 'close-circle'; // Not available
    }
    return null;
  };

  const getStatusColor = () => {
    if (isChecking) {
      return '#666'; // Gray
    }
    if (availability === true) {
      return '#34C759'; // Green
    }
    if (availability === false) {
      return '#FF4757'; // Red
    }
    return '#666'; // Gray
  };

  const getStatusText = () => {
    if (isChecking) {
      return 'Checking...';
    }
    if (availability === true) {
      return 'Available';
    }
    if (availability === false) {
      return 'Already registered';
    }
    return '';
  };

  const icon = getStatusIcon();
  const color = getStatusColor();
  const text = getStatusText();

  if (!email || email.length < 3) {
    return null;
  }

  return (
    <View style={styles.container}>
      {isChecking && (
        <Text style={styles.statusText}>Checking availability...</Text>
      )}
      
      {availability !== null && !isChecking && (
        <View style={styles.statusContainer}>
          <Ionicons 
            name={icon as any} 
            size={16} 
            color={color} 
          />
          <Text style={[styles.statusText, { color }]}>
            {text}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    minHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
