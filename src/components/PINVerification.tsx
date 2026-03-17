/**
 * FRETIKO MOBILE - PIN VERIFICATION COMPONENT
 * 
 * Reusable component for PIN verification before sensitive operations
 * Used for: Withdrawals, account changes, large purchases
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';
import { pinAPI } from '../services/pinAPI';
import { useNavigation } from '@react-navigation/native';

interface PINVerificationProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
}

export const PINVerification: React.FC<PINVerificationProps> = ({
  visible,
  onClose,
  onSuccess,
  title = 'Enter your PIN',
  subtitle = 'Verify your identity to continue',
}) => {
  const { user, accessToken } = useAuth();
  const navigation = useNavigation();
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Get API URL from app.json
  const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.3:3000';

  const handlePinChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value) {
      verifyPin(newPin.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyPin = async (pinValue: string) => {
    if (pinValue.length !== 6) {
      Alert.alert('Error', 'Please enter a complete 6-digit PIN');
      return;
    }

    setLoading(true);
    try {
      // Call real backend API
      const result = await pinAPI.verifyPin(pinValue, 'withdrawal');
      
      if (result.success) {
        console.log('✅ PIN verified successfully');
        onSuccess();
        handleClose();
      } else {
        throw new Error(result.message || 'Invalid PIN');
      }
    } catch (error: any) {
      console.error('❌ PIN verification failed:', error);
      Alert.alert('Verification Failed', error.message || 'Invalid PIN. Please try again.');
      setPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPin(['', '', '', '', '', '']);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={32} color="#F39C12" />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* PIN Input */}
          <View style={styles.pinContainer}>
            {pin.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  if (ref) {
                    inputRefs.current[index] = ref;
                  }
                }}
                style={[
                  styles.pinInput,
                  digit && styles.pinInputFilled,
                ]}
                value={digit}
                onChangeText={value => handlePinChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="numeric"
                maxLength={1}
                secureTextEntry
                selectTextOnFocus
                autoFocus={index === 0}
                editable={!loading}
              />
            ))}
          </View>


          {/* Loading */}
          {loading && (
            <ActivityIndicator size="small" color="#F39C12" style={styles.loader} />
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot PIN */}
          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => {
              // Navigate to PIN reset flow
              onClose(); // Close current modal first
              
              // Check if user is authenticated
              if (!accessToken) {
                Alert.alert(
                  'Authentication Error',
                  'Please log in again to reset your PIN.',
                  [{ text: 'OK' }]
                );
                return;
              }

              Alert.alert(
                'PIN Reset',
                'A 6-digit reset code will be sent to your email. Check your inbox after requesting.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Send Reset Code', 
                    onPress: async () => {
                      try {
                        console.log('🔍 Sending PIN reset request...');
                        console.log('- User ID:', user?.id);
                        console.log('- API URL:', API_URL);
                        console.log('- Access Token:', accessToken?.substring(0, 20) + '...');
                        
                        const response = await fetch(`${API_URL}/wallet/pin/reset-request`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({}), // Add empty body for proper POST request
                        });

                        console.log('📧 PIN Reset Response Status:', response.status);
                        console.log('📧 Response OK:', response.ok);

                        const result = await response.json();
                        console.log('📧 Response Data:', result);

                        if (response.ok && result.success) {
                          Alert.alert(
                            'Reset Code Sent',
                            'Check your email for the 6-digit reset code.',
                            [
                              { 
                                text: 'OK', 
                                onPress: () => {
                                  // Navigate to PIN reset token screen
                                  navigation.navigate('PINResetTokenScreen' as never);
                                }
                              }
                            ]
                          );
                        } else {
                          console.error('❌ PIN Reset Error:', result);
                          Alert.alert(
                            'Error',
                            result.message || 'Failed to send reset code. Please try again.',
                            [{ text: 'OK' }]
                          );
                        }
                      } catch (error) {
                        console.error('❌ Network Error:', error);
                        Alert.alert(
                          'Network Error',
                          'Failed to connect to server. Please check your internet connection and try again.',
                          [{ text: 'OK' }]
                        );
                      }
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.forgotButtonText}>Forgot PIN?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1C1F26',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.2)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pinInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pinInputFilled: {
    borderColor: '#F39C12',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  noticeText: {
    fontSize: 12,
    color: '#F39C12',
    marginLeft: 8,
    flex: 1,
  },
  loader: {
    marginVertical: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotButtonText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '600',
  },
});

