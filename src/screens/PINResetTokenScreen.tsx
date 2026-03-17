/**
 * FRETIKO MOBILE - PIN RESET TOKEN SCREEN
 * 
 * Screen where users enter the 6-digit code sent to their email
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
import Constants from 'expo-constants';
import { useAuth } from '../contexts/AuthContext';

interface PINResetTokenScreenProps {
  navigation: any;
  route: any;
}

const PINResetTokenScreen: React.FC<PINResetTokenScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const [token, setToken] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Get API URL from app.json
  const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.3:3000';

  // Countdown timer for resend button
  React.useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleTokenChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newToken = [...token];
    newToken[index] = value;
    setToken(newToken);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !token[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyToken = async () => {
    const tokenString = token.join('');
    
    if (tokenString.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter all 6 digits of the reset code.');
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Verifying PIN reset token...');
      console.log('- User ID:', user?.id);
      console.log('- Token:', tokenString);
      console.log('- API URL:', API_URL);
      console.log('- Access Token:', accessToken?.substring(0, 20) + '...');
      
      const response = await fetch(`${API_URL}/wallet/pin/verify-reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenString,
        }),
      });

      console.log('📧 Verify Response Status:', response.status);
      console.log('📧 Response OK:', response.ok);

      const result = await response.json();
      console.log('📧 Response Data:', result);

      if (result.valid) {
        // Navigate to new PIN screen with the verified token
        navigation.navigate('PINResetNewPinScreen', { 
          token: tokenString 
        });
      } else {
        Alert.alert('Invalid Code', result.message || 'The reset code you entered is invalid or has expired.');
      }
    } catch (error) {
      console.error('❌ Network Error:', error);
      Alert.alert('Error', 'Failed to verify reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    try {
      console.log('🔍 Resending PIN reset code...');
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

      console.log('📧 Resend Response Status:', response.status);
      console.log('📧 Response OK:', response.ok);

      const result = await response.json();
      console.log('📧 Response Data:', result);

      if (result.success) {
        Alert.alert(
          'Code Resent',
          'A new 6-digit reset code has been sent to your email.',
          [{ text: 'OK' }]
        );
        setTimeLeft(60); // Reset countdown
        // Clear token inputs
        setToken(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert('Error', result.message || 'Failed to resend reset code.');
      }
    } catch (error) {
      console.error('❌ Network Error:', error);
      Alert.alert('Error', 'Failed to resend reset code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          <Text style={styles.title}>Verify Reset Code</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Instructions */}
        <View style={styles.instructionContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail" size={48} color="#F39C12" />
          </View>
          <Text style={styles.instructionText}>
            Enter the 6-digit code sent to your email address
          </Text>
          <Text style={styles.subInstructionText}>
            Check your inbox and enter the code below
          </Text>
        </View>

        {/* Token Input */}
        <View style={styles.tokenContainer}>
          {token.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                if (ref) {
                  inputRefs.current[index] = ref;
                }
              }}
              style={[
                styles.tokenInput,
                digit ? styles.tokenInputFilled : styles.tokenInputEmpty
              ]}
              value={digit}
              onChangeText={(value) => handleTokenChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="numeric"
              maxLength={1}
              secureTextEntry={false}
              selectTextOnFocus
              autoFocus={index === 0}
              editable={!loading}
            />
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.verifyButton]}
            onPress={verifyToken}
            disabled={loading || token.join('').length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Verify Code</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button, 
              styles.resendButton,
              timeLeft > 0 ? styles.resendButtonDisabled : {}
            ]}
            onPress={resendCode}
            disabled={resending || timeLeft > 0}
          >
            {resending ? (
              <ActivityIndicator color="#F39C12" size="small" />
            ) : (
              <Text style={[
                styles.buttonText,
                styles.resendButtonText
              ]}>
                {timeLeft > 0 
                  ? `Resend in ${formatTime(timeLeft)}`
                  : 'Resend Code'
                }
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            Didn't receive the code? Check your spam folder or resend the code.
          </Text>
          <TouchableOpacity
            style={styles.helpLink}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.helpLinkText}>Back to Wallet</Text>
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
    marginBottom: 40,
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
  tokenContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  tokenInput: {
    width: 50,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tokenInputFilled: {
    borderColor: '#F39C12',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  tokenInputEmpty: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyButton: {
    backgroundColor: '#F39C12',
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#F39C12',
  },
  resendButtonDisabled: {
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resendButtonText: {
    color: '#F39C12',
  },
  helpContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  helpText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 16,
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

export default PINResetTokenScreen;
