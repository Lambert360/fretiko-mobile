import React, { useState, useEffect, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRegistration } from '../contexts/RegistrationContext';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';
import * as Device from 'expo-device';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const { registrationData, updateRegistrationData } = useRegistration();
  const { signin } = useAuth();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes for token expiration
  const [resendCountdown, setResendCountdown] = useState(0); // Start at 0, enable immediately

  // Check if user navigated here with token from email
  useEffect(() => {
    if (route.params?.token && route.params?.email) {
      setToken(route.params.token);
      // Auto-verify if token provided
      handleVerifyToken();
    } else if (registrationData?.email) {
      // User came from registration, show token input
      setVerificationStatus('pending');
      // Start resend countdown after 60 seconds
      setResendCountdown(60);
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

  // Countdown timer for resend button (1 minute)
  useEffect(() => {
    if (verificationStatus === 'pending' && resendCountdown > 0) {
      const timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [verificationStatus, resendCountdown]);

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
      // Collect device information for terms acceptance tracking
      const deviceInfo = {
        ipAddress: 'mobile_app', // Will be enhanced with real IP later
        userAgent: `${Platform.OS} ${Platform.Version} - ${Device.deviceName || Device.modelName || 'Unknown Device'} - ${Device.brand || 'Unknown Brand'} ${Device.modelName || 'Unknown Model'}`,
      };

      console.log('📱 Device info for email verification:', deviceInfo);
      console.log('🌐 Using API_BASE_URL:', API_CONFIG.BASE_URL);

      const requestBody = {
        token: token.trim(),
        email: registrationData.email,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
      };

      console.log('🚀 Email verification request body:', requestBody);

      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/verify-email-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Verification response status:', response.status);
      console.log('📡 Verification response OK:', response.ok);

      const result = await response.json();
      
      console.log('📡 Verification response data:', result);

      if (result.success) {
        setVerificationStatus('success');
        
        // Auto-navigate to role selection after 2 seconds
        setTimeout(() => {
          navigation.navigate('RoleSelection');
        }, 2000);
      } else {
        console.error('❌ Verification failed:', result);
        setErrorMessage(result.message || 'Verification failed');
        setVerificationStatus('error');
      }
    } catch (error: any) {
      console.error('❌ Network error during verification:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      console.error('❌ Full error object:', error);
      setErrorMessage(error.message || 'Verification failed - network request failed');
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
      console.log('🌐 Using API_BASE_URL for resend:', API_CONFIG.BASE_URL);
      console.log('📧 Resending token to email:', registrationData.email);

      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/resend-verification-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: registrationData.email,
        }),
      });

      console.log('📡 Resend response status:', response.status);
      console.log('📡 Resend response OK:', response.ok);

      const result = await response.json();
      
      console.log('📡 Resend response data:', result);

      if (result.success) {
        Alert.alert(
          'Success',
          result.message || 'Verification code has been resent to your email',
          [{ text: 'OK', style: 'default' }]
        );
        // Reset timer for new token
        setTimeLeft(15 * 60);
        setVerificationStatus('pending');
        setToken('');
        setErrorMessage('');
        setResendCountdown(60); // Reset resend countdown to 1 minute
      } else {
        console.error('❌ Resend failed:', result);
        Alert.alert('Error', result.message || 'Failed to resend verification code');
      }
    } catch (error: any) {
      console.error('❌ Network error during resend:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      console.error('❌ Full resend error object:', error);
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
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderVerificationStatus = () => {
    switch (verificationStatus) {
      case 'pending':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.emailIcon}>
              <Ionicons name="mail" size={48} color="#3498DB" />
            </View>
            <Text style={styles.emailText}>{registrationData?.email || 'your email'}</Text>
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>
                1. Check your email for the verification code
              </Text>
              <Text style={styles.instructionText}>
                2. Enter the 6-digit code above
              </Text>
              <Text style={styles.instructionText}>
                3. Code expires in {formatTime(timeLeft)}
              </Text>
              <Text style={styles.instructionText}>
                4. Check your spam/junk folder if you don't see the email
              </Text>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.openEmailButton} onPress={handleOpenEmailApp}>
                <Ionicons name="mail-open" size={20} color="#FFFFFF" />
                <Text style={styles.openEmailButtonText}>Open Email App</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.resendButton, resendCountdown > 0 && styles.resendButtonDisabled]} 
                onPress={handleResendToken} 
                disabled={isLoading || resendCountdown > 0}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : resendCountdown > 0 ? (
                  <Text style={styles.resendButtonText}>Resend in {resendCountdown}s</Text>
                ) : (
                  <Text style={styles.resendButtonText}>Resend Code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      
      case 'verifying':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#3498DB" />
            <Text style={styles.pendingTitle}>Verifying your email...</Text>
            <Text style={styles.pendingSubtitle}>Please wait while we verify your code</Text>
          </View>
        );
      
      case 'success':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Email Verified!</Text>
            <Text style={styles.successSubtitle}>Your account has been successfully verified</Text>
            <Text style={styles.redirectText}>Redirecting to app...</Text>
          </View>
        );
      
      case 'error':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.errorIcon}>
              <Ionicons name="close-circle" size={64} color="#FF3B30" />
            </View>
            <Text style={styles.errorTitle}>Verification Failed</Text>
            <Text style={styles.errorSubtitle}>{errorMessage}</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.retryButton} onPress={() => {
                setVerificationStatus('pending');
                setToken('');
                setErrorMessage('');
              }}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      
      default:
        return null;
    }
  };

  const emailText = registrationData?.email 
    ? registrationData.email.replace(/(.{2}).*(@.*)/, '$1***$2')
    : 'your email';

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ImageBackground
          source={require('../../assets/images/sign-up-welcome-pic.jpeg')}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
        >
        </ImageBackground>
        <View style={styles.fullOverlay} />
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Email Verification</Text>
              <Text style={styles.subtitle}>
                {verificationStatus === 'pending' 
                  ? `Enter 6-digit code sent to ${registrationData?.email || 'your email'}`
                  : verificationStatus === 'success'
                  ? 'Email verified successfully!'
                  : 'Verification failed'
                }
              </Text>
            </View>
            {verificationStatus === 'pending' && (
              <View style={styles.inputContainer}>
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
                
                <TouchableOpacity
                  style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
                  onPress={handleVerifyToken}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Status Content */}
            <View style={styles.statusContent}>
              {renderVerificationStatus()}
            </View>
          </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.35,
  },
  backgroundImageStyle: {
    opacity: 0.7,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
    zIndex: 2, // Ensure scroll view is above overlay
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 24,
  },
  inputContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  tokenInput: {
    width: '100%',
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#3498DB',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  verifyButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#3498DB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: 'rgba(52, 152, 219, 0.5)',
  },
  verifyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  statusContainer: {
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
  emailText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3498DB',
    textAlign: 'center',
    marginBottom: 24,
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
  },
  actionButtons: {
    width: '100%',
    gap: 12,
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
  resendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    color: '#4CAF50',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 16,
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
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    width: 200,
    height: 50,
    backgroundColor: '#FF3B30',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498DB',
    marginBottom: 12,
  },
  pendingSubtitle: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
  },
});

export default EmailVerificationScreen;
