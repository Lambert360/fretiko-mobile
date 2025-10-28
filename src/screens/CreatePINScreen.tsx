/**
 * FRETIKO MOBILE - CREATE PIN SCREEN
 * First-time PIN setup for wallet security
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pinAPI } from '../services/pinAPI';

interface CreatePINScreenProps {
  navigation: any;
  route: any;
}

const CreatePINScreen = ({ navigation, route }: CreatePINScreenProps) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const currentPin = step === 'create' ? pin : confirmPin;
  const setCurrentPin = step === 'create' ? setPin : setConfirmPin;

  const handlePinChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newPin = [...currentPin];
    newPin[index] = value;
    setCurrentPin(newPin);
    setError('');

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value) {
      if (step === 'create') {
        // Move to confirm step
        setTimeout(() => {
          setStep('confirm');
          inputRefs.current[0]?.focus();
        }, 300);
      } else {
        // Verify and create PIN
        handleCreatePin(newPin.join(''));
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !currentPin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCreatePin = async (confirmedPin: string) => {
    const originalPin = pin.join('');

    if (originalPin !== confirmedPin) {
      setError('PINs do not match. Please try again.');
      setStep('create');
      setPin(['', '', '', '', '', '']);
      setConfirmPin(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return;
    }

    setLoading(true);
    try {
      await pinAPI.createPin(originalPin);
      
      Alert.alert(
        'PIN Created Successfully',
        'Your 6-digit PIN has been set. You will need this PIN for withdrawals and other sensitive operations.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to the screen that requested PIN
              if (route.params?.returnScreen) {
                navigation.navigate(route.params.returnScreen);
              } else {
                navigation.goBack();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating PIN:', error);
      setError(error.message || 'Failed to create PIN. Please try again.');
      setStep('create');
      setPin(['', '', '', '', '', '']);
      setConfirmPin(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('create');
      setConfirmPin(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={48} color="#F39C12" />
          </View>
        </View>

        {/* Title & Description */}
        <Text style={styles.title}>
          {step === 'create' ? 'Create Your 6-Digit PIN' : 'Confirm Your PIN'}
        </Text>
        <Text style={styles.description}>
          {step === 'create'
            ? 'This PIN will be used to authorize withdrawals and other sensitive operations.'
            : 'Please enter your PIN again to confirm.'}
        </Text>

        {/* PIN Input */}
        <View style={styles.pinContainer}>
          {currentPin.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.pinInput,
                digit && styles.pinInputFilled,
                error && styles.pinInputError,
              ]}
              value={digit}
              onChangeText={(value) => handlePinChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              secureTextEntry
              selectTextOnFocus
              editable={!loading}
            />
          ))}
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F39C12" />
            <Text style={styles.loadingText}>Creating your PIN...</Text>
          </View>
        )}

        {/* Security Tips */}
        <View style={styles.tipsCard}>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.tipText}>Use a unique PIN you can remember</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.tipText}>Don't use obvious numbers like 123456</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.tipText}>Keep your PIN private and secure</Text>
          </View>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 'create' && styles.stepDotActive]} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  pinContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  pinInput: {
    width: 50,
    height: 60,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2A2A2A',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pinInputFilled: {
    borderColor: '#F39C12',
    backgroundColor: 'rgba(243, 156, 18, 0.05)',
  },
  pinInputError: {
    borderColor: '#E74C3C',
    backgroundColor: 'rgba(231, 76, 60, 0.05)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    marginLeft: 8,
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#999999',
    marginTop: 12,
  },
  tipsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    width: '100%',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginLeft: 12,
    flex: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A2A',
  },
  stepDotActive: {
    backgroundColor: '#F39C12',
    width: 24,
  },
});

export default CreatePINScreen;

