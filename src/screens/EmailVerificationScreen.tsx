import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../contexts/RegistrationContext';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface EmailVerificationScreenProps {
  navigation: any;
  route: {
    params?: {
      token?: string;
      email?: string;
    };
  };
}

type VerificationStatus = 'pending' | 'verifying' | 'success' | 'error';

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { registrationData } = useRegistration();
  const { signin } = useAuth();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(24 * 60); // 24 hours in seconds

  // Check if user navigated here with token from email
  useEffect(() => {
    if (route.params?.token && route.params?.email) {
      setToken(route.params.token);
      // Auto-verify if token provided
      handleVerifyToken();
    } else if (registrationData?.email) {
      // User came from registration, show token input
      setVerificationStatus('pending');
    }
  }, [route.params, registrationData]);

  // Countdown timer for token expiration
  useEffect(() => {
    if (verificationStatus === 'pending' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [verificationStatus, timeLeft]);

  const handleVerifyToken = async () => {
    if (!token.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (!registrationData?.email) {
      Alert.alert('Error', 'Email not found. Please start registration over.');
      navigation.navigate('Signup');
      return;
    }

    setIsLoading(true);
    setVerificationStatus('verifying');
    setErrorMessage('');

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://172.20.25.10:3000'}/auth/verify-email-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token.trim(),
          email: registrationData.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setVerificationStatus('success');
        // Auto-navigate to welcome after 2 seconds
        setTimeout(() => {
          navigation.navigate('Welcome');
        }, 2000);
      } else {
        setErrorMessage(result.message || 'Verification failed');
        setVerificationStatus('error');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Verification failed');
      setVerificationStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendToken = async () => {
    if (!registrationData?.email) {
      Alert.alert('Error', 'Email not found. Please start registration over.');
      navigation.navigate('Signup');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://172.20.25.10:3000'}/auth/resend-verification-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: registrationData.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          'Success',
          result.message || 'Verification code has been resent to your email',
          [{ text: 'OK', style: 'default' }]
        );
        // Reset timer for new token
        setTimeLeft(24 * 60);
      } else {
        Alert.alert('Error', result.message || 'Failed to resend verification code');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEmailApp = () => {
    const emailUrl = `mailto:${registrationData?.email}`;
    Linking.openURL(emailUrl).catch(() => {
      Alert.alert('Error', 'Could not open email app');
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const emailText = registrationData?.email 
    ? registrationData.email.replace(/(.{2})@/, '$1***@$2')
    : 'your email';

  return (
    <ImageBackground
      source={require('../../assets/images/sign-up-welcome-pic.jpeg')}
      style={styles.backgroundImage}
      imageStyle={styles.backgroundImageStyle}
    >
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Title */}
            <Text style={styles.title}>Email Verification</Text>
            <Text style={styles.subtitle}>
              {verificationStatus === 'pending' 
                ? `Enter the 6-digit code sent to ${emailText}`
                : verificationStatus === 'success'
                ? 'Email verified successfully!'
                : 'Verification failed'
              }
            </Text>

            {/* Timer Display */}
            {verificationStatus === 'pending' && timeLeft > 0 && (
              <Text style={styles.timer}>
                Code expires in: {formatTime(timeLeft)}
              </Text>
            )}

            {/* Token Input */}
            {verificationStatus === 'pending' && (
              <TextInput
                style={styles.tokenInput}
                placeholder="Enter 6-digit code"
                value={token}
                onChangeText={setToken}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus={true}
                editable={!isLoading}
                selectTextOnFocus={true}
              />
            )}

            {/* Verify Button */}
            {verificationStatus === 'pending' && (
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleVerifyToken}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Verify Code</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={handleCreateAccount}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#3498DB" />
              ) : (
                <Text style={styles.createAccountButtonText}>Create Account Now</Text>
              )}
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Image */}
      <ImageBackground
        source={require('../../assets/images/sign-up-welcome-pic.jpeg')}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        <View style={styles.overlay} />
      </ImageBackground>

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Email Verification</Text>
          <Text style={styles.subtitle}>
            {verificationStatus === 'pending' 
              ? 'Verify your email to complete registration'
              : verificationStatus === 'success'
              ? 'Account verified successfully'
              : 'Verification failed'
            }
          </Text>
        </View>

        {/* Status Content */}
        <View style={styles.statusContent}>
          {renderVerificationStatus()}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  backgroundImageStyle: {
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    padding: 20,
  },
  pendingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emailIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pendingTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pendingSubtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emailText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3498DB',
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  instructionContainer: {
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 32,
  },
  instructionText: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  openEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  openEmailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3498DB',
  },
  createAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498DB',
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  redirectText: {
    fontSize: 14,
    color: '#3498DB',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusText: {
    fontSize: 18,
    color: '#E0E0E0',
    textAlign: 'center',
    marginTop: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
