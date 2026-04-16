/**
 * FRETIKO MOBILE - PIN RESET NEW PIN SCREEN
 * 
 * Screen where users create their new 6-digit PIN after token verification
 * Part of the forgot PIN flow
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';

interface PINResetNewPinScreenProps {
  navigation: any;
  route: any;
}

const PINResetNewPinScreen: React.FC<PINResetNewPinScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const [newPin, setNewPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const newPinRefs = useRef<(TextInput | null)[]>([]);
  const confirmPinRefs = useRef<(TextInput | null)[]>([]);

  console.log('🌐 Using API_CONFIG.BASE_URL for PIN reset confirmation:', API_CONFIG.BASE_URL);

  const handlePinChange = (index: number, value: string, isNewPin: boolean = true) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    if (isNewPin) {
      const newPinArray = [...newPin];
      newPinArray[index] = value;
      setNewPin(newPinArray);

      // Auto-focus next input
      if (value && index < 5) {
        newPinRefs.current[index + 1]?.focus();
      }
    } else {
      const confirmPinArray = [...confirmPin];
      confirmPinArray[index] = value;
      setConfirmPin(confirmPinArray);

      // Auto-focus next input
      if (value && index < 5) {
        confirmPinRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (index: number, key: string, isNewPin: boolean = true) => {
    if (key === 'Backspace') {
      if (isNewPin) {
        if (!newPin[index] && index > 0) {
          newPinRefs.current[index - 1]?.focus();
        }
      } else {
        if (!confirmPin[index] && index > 0) {
          confirmPinRefs.current[index - 1]?.focus();
        }
      }
    }
  };

  const validatePins = () => {
    const newPinString = newPin.join('');
    const confirmPinString = confirmPin.join('');

    if (newPinString.length !== 6) {
      Alert.alert('Invalid PIN', 'Please enter all 6 digits for your new PIN.');
      return false;
    }

    if (confirmPinString.length !== 6) {
      Alert.alert('Invalid PIN', 'Please enter all 6 digits to confirm your PIN.');
      return false;
    }

    if (newPinString !== confirmPinString) {
      Alert.alert('PIN Mismatch', 'The PINs you entered do not match. Please try again.');
      return false;
    }

    // Check for weak PINs (sequential, repeating)
    const isWeak = /^(123456|234567|345678|456789|567890|678901|789012|890123|901234|012345|111111|222222|333333|444444|555555|666666|777777|888888|999999|000000)$/.test(newPinString);
    
    if (isWeak) {
      Alert.alert('Weak PIN', 'Please choose a stronger PIN. Avoid sequential or repeating numbers.');
      return false;
    }

    return true;
  };

  const resetPin = async () => {
    if (!validatePins()) return;

    const newPinString = newPin.join('');
    const receivedToken = route.params?.token || '';
    
    console.log('🔍 Confirming PIN reset...');
    console.log('- User ID:', user?.id);
    console.log('- New PIN:', newPinString);
    console.log('- Token from route:', receivedToken);
    console.log('- Route params:', route.params);
    console.log('- API URL:', API_CONFIG.BASE_URL);
    console.log('- Access Token:', accessToken?.substring(0, 20) + '...');
    
    if (!receivedToken) {
      Alert.alert('Error', 'Reset token not found. Please start the PIN reset process again.');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/wallet/pin/confirm-reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: receivedToken,
          newPin: newPinString,
        }),
      });

      console.log('📧 Confirm Response Status:', response.status);
      console.log('📧 Response OK:', response.ok);

      const result = await response.json();
      console.log('📧 Response Data:', result);

      if (result.success) {
        // Navigate to success screen
        navigation.replace('PINResetSuccessScreen');
      } else {
        Alert.alert('Error', result.message || 'Failed to reset PIN. Please try again.');
      }
    } catch (error) {
      console.error('❌ Network Error:', error);
      Alert.alert('Error', 'Failed to reset PIN. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPinStrength = (pin: string[]) => {
    const pinString = pin.join('');
    if (pinString.length < 6) return { text: '', color: '#666' };
    
    // Check for weak patterns
    const isWeak = /^(123456|234567|345678|456789|567890|678901|789012|890123|901234|012345|111111|222222|333333|444444|555555|666666|777777|888888|999999|000000)$/.test(pinString);
    
    if (isWeak) {
      return { text: 'Weak', color: '#e74c3c' };
    }
    
    // Check for sequential
    let isSequential = true;
    for (let i = 1; i < pinString.length; i++) {
      if (parseInt(pinString[i]) !== parseInt(pinString[i-1]) + 1) {
        isSequential = false;
        break;
      }
    }
    
    if (isSequential) {
      return { text: 'Weak', color: '#e74c3c' };
    }
    
    // Check for repeating
    const isRepeating = pinString.split('').every(char => char === pinString[0]);
    if (isRepeating) {
      return { text: 'Weak', color: '#e74c3c' };
    }
    
    return { text: 'Strong', color: '#27ae60' };
  };

  const currentStrength = getPinStrength(newPin);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Create New PIN</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color="#F39C12" />
          </View>
          <Text style={styles.instructionText}>
            Create your new 6-digit withdrawal PIN
          </Text>
          <Text style={styles.subInstructionText}>
            Choose a secure PIN that you can easily remember
          </Text>
        </View>

        {/* New PIN Input */}
        <View style={styles.pinSection}>
          <View style={styles.pinHeader}>
            <Text style={styles.pinLabel}>New PIN</Text>
            {currentStrength.text && (
              <Text style={[styles.pinStrength, { color: currentStrength.color }]}>
                {currentStrength.text}
              </Text>
            )}
          </View>
          <View style={styles.pinContainer}>
            {newPin.map((digit, index) => (
              <View key={index} style={styles.pinInputWrapper}>
                <TextInput
                  ref={(ref) => {
                    if (ref) {
                      newPinRefs.current[index] = ref;
                    }
                  }}
                  style={[
                    styles.pinInput,
                    digit ? styles.pinInputFilled : styles.pinInputEmpty
                  ]}
                  value={digit}
                  onChangeText={(value) => handlePinChange(index, value, true)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key, true)}
                  keyboardType="numeric"
                  maxLength={1}
                  secureTextEntry={!showPassword}
                  selectTextOnFocus
                  autoFocus={index === 0}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="rgba(255, 255, 255, 0.5)" 
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Confirm PIN Input */}
        <View style={styles.pinSection}>
          <View style={styles.pinHeader}>
            <Text style={styles.pinLabel}>Confirm PIN</Text>
          </View>
          <View style={styles.pinContainer}>
            {confirmPin.map((digit, index) => (
              <View key={index} style={styles.pinInputWrapper}>
                <TextInput
                  ref={(ref) => {
                    if (ref) {
                      confirmPinRefs.current[index] = ref;
                    }
                  }}
                  style={[
                    styles.pinInput,
                    digit ? styles.pinInputFilled : styles.pinInputEmpty
                  ]}
                  value={digit}
                  onChangeText={(value) => handlePinChange(index, value, false)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key, false)}
                  keyboardType="numeric"
                  maxLength={1}
                  secureTextEntry={!showConfirmPassword}
                  selectTextOnFocus
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="rgba(255, 255, 255, 0.5)" 
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Security Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Security Tips:</Text>
          <View style={styles.tipsList}>
            <Text style={styles.tipItem}>• Avoid sequential numbers (123456)</Text>
            <Text style={styles.tipItem}>• Avoid repeating numbers (111111)</Text>
            <Text style={styles.tipItem}>• Use memorable but not obvious numbers</Text>
            <Text style={styles.tipItem}>• Don't use personal information</Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={resetPin}
            disabled={loading || newPin.join('').length !== 6 || confirmPin.join('').length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Reset PIN</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <TouchableOpacity
            style={styles.helpLink}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.helpLinkText}>Cancel and Back to Wallet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  instructionContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subInstructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  pinSection: {
    marginBottom: 30,
  },
  pinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pinLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pinStrength: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pinInputWrapper: {
    position: 'relative',
  },
  pinInput: {
    width: 45,
    height: 55,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pinInputFilled: {
    borderColor: '#F39C12',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  pinInputEmpty: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  visibilityToggle: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -10,
  },
  tipsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  resetButton: {
    backgroundColor: '#F39C12',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  helpContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  helpLink: {
    padding: 8,
  },
  helpLinkText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PINResetNewPinScreen;
