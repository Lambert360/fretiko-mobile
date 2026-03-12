import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ResetPasswordScreenProps {
  navigation: any;
  route: any;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ navigation, route }) => {
  const [tokenInputs, setTokenInputs] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTokenVerified, setIsTokenVerified] = useState(false);
  const [email, setEmail] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Get email from route params or use a default
  React.useEffect(() => {
    if (route.params?.email) {
      setEmail(route.params.email);
    }
  }, [route.params]);

  // Auto-focus next input or verify when all are filled
  const handleTokenChange = (value: string, index: number) => {
    const newInputs = [...tokenInputs];
    newInputs[index] = value.toUpperCase();
    setTokenInputs(newInputs);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all inputs are filled
    if (newInputs.every(input => input.length > 0) && index === 5) {
      const fullToken = newInputs.join('');
      handleVerifyToken(fullToken);
    }
  };

  // Handle backspace for auto-focus previous input
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !tokenInputs[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validatePassword = (password: string): boolean => {
    // Password must be at least 8 characters with uppercase, lowercase, and number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  };

  const handleVerifyToken = async (tokenToVerify?: string) => {
    const token = tokenToVerify || tokenInputs.join('');
    
    if (!token) {
      Alert.alert('Error', 'Please enter the verification token');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.verifyResetToken(email.trim().toLowerCase(), token);
      
      if (response.valid) {
        setIsTokenVerified(true);
        Alert.alert('Success', 'Token verified! Please enter your new password.');
      } else {
        Alert.alert('Error', response.message || 'Invalid or expired token');
        // Clear inputs on error
        setTokenInputs(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error('Token verification error:', error);
      Alert.alert('Error', error.message || 'Failed to verify token');
      // Clear inputs on error
      setTokenInputs(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    // Validate inputs
    const token = tokenInputs.join('');
    
    if (!token) {
      Alert.alert('Error', 'Please enter the verification token');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!validatePassword(newPassword)) {
      Alert.alert(
        'Password Requirements',
        'Password must be at least 8 characters long and contain:\n• One uppercase letter\n• One lowercase letter\n• One number'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.confirmResetPassword(
        email.trim().toLowerCase(),
        token,
        newPassword
      );

      if (response.success) {
        Alert.alert(
          'Success!',
          'Your password has been reset successfully. You can now sign in with your new password.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to reset password');
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      Alert.alert('Error', error.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header with Back Button */}
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons 
                name={isTokenVerified ? "checkmark-circle-outline" : "key-outline"} 
                size={48} 
                color={isTokenVerified ? "#27AE60" : "#3498DB"} 
              />
            </View>
          </View>

          {/* Title & Description */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isTokenVerified ? 'Set New Password' : 'Enter Verification Code'}
            </Text>
            <Text style={styles.subtitle}>
              {isTokenVerified 
                ? 'Enter your new password below to complete the reset.'
                : `Enter the 6-character code sent to ${email || 'your email'}`
              }
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Token Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Verification Code</Text>
              <View style={styles.tokenInputContainer}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.tokenInput,
                      isTokenVerified && styles.tokenInputVerified
                    ]}
                    value={tokenInputs[index]}
                    onChangeText={(value) => handleTokenChange(value, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    placeholder="-"
                    placeholderTextColor="#666"
                    maxLength={1}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    textAlign="center"
                    editable={!isTokenVerified && !isLoading}
                    keyboardType="default"
                  />
                ))}
              </View>
            </View>

            {/* Verify Token Button */}
            {!isTokenVerified && (
              <TouchableOpacity
                style={[styles.button, (tokenInputs.some(input => !input) || isLoading) && styles.buttonDisabled]}
                onPress={() => handleVerifyToken()}
                disabled={tokenInputs.some(input => !input) || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Verify Code</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Password Inputs - Show after token is verified */}
            {isTokenVerified && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor="#666"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor="#666"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                        size={20}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonPrimary,
                    (!newPassword.trim() || !confirmPassword.trim() || isLoading) && styles.buttonDisabled
                  ]}
                  onPress={handleResetPassword}
                  disabled={!newPassword.trim() || !confirmPassword.trim() || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Help Section */}
          <View style={styles.footer}>
            {!isTokenVerified ? (
              <>
                <Text style={styles.footerText}>Didn't receive the code? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.linkText}>Request a new one</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.linkText}>← Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  keyboardView: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: '#2A2A2A',
    color: '#666',
  },
  passwordInput: {
    paddingRight: 44,
  },
  inputIcon: {
    paddingHorizontal: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonPrimary: {
    backgroundColor: '#27AE60',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#B0B0B0',
    fontSize: 16,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  tokenInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  tokenInput: {
    width: 45,
    height: 55,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  tokenInputVerified: {
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderColor: '#27AE60',
    color: '#27AE60',
  },
});
