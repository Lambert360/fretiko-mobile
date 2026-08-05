import React, { useState } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SocialAuthButtons } from '../components/SocialAuthButtons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const parseJwt = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const jsonPayload = (global as any).atob(base64 + padding);
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT:', e);
    return {};
  }
};

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const insets = useSafeAreaInsets();

  const { signin, migrate, socialSignIn } = useAuth();

  // Google Sign-In is configured globally in App.tsx

  const handleGoogleSignIn = async () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      Alert.alert('Missing config', 'Add Google client IDs to your .env file first.');
      return;
    }

    let googleUser: any = {};
    let idToken: string | undefined;

    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      googleUser = (userInfo as any).data?.user || (userInfo as any).user || {};
      idToken = (userInfo as any).data?.idToken || (userInfo as any).idToken;

      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      try {
        await socialSignIn({ provider: 'google', idToken, hasAcceptedTerms: false });
      } catch (error: any) {
        if (error.requiresProfile) {
          const profileUser = error.user || {};
          Alert.alert(
            'Complete your profile',
            'Please accept the terms and conditions to finish signing up.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                onPress: () => navigation.navigate('SocialSignUp', {
                  provider: 'google',
                  idToken,
                  email: profileUser.email || googleUser.email || '',
                  firstName: profileUser.firstName || googleUser.givenName || '',
                  lastName: profileUser.lastName || googleUser.familyName || '',
                  avatarUrl: profileUser.avatar_url || googleUser.photo || '',
                }),
              },
            ]
          );
          return;
        }
        throw error;
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      console.error('❌ Google sign in error:', error);
      Alert.alert(
        'No account found?',
        error?.message || 'We could not sign you in with Google. If you don\'t have an account, complete your profile to sign up.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Up',
            onPress: () => navigation.navigate('SocialSignUp', {
              provider: 'google',
              idToken,
              email: googleUser.email || '',
              firstName: googleUser.givenName || '',
              lastName: googleUser.familyName || '',
              avatarUrl: googleUser.photo || '',
            }),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not available', 'Apple Sign In is only available on iOS.');
      return;
    }

    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Not available', 'Apple Sign In is not available on this device.');
      return;
    }

    let idToken: string | undefined;
    let email = '';
    let firstName = '';
    let lastName = '';
    let avatarUrl = '';

    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      idToken = credential.identityToken || undefined;
      if (!idToken) {
        throw new Error('No identity token received from Apple');
      }

      const parsed = parseJwt(idToken);
      email = credential.email || parsed.email || '';
      firstName = credential.fullName?.givenName || '';
      lastName = credential.fullName?.familyName || '';
      avatarUrl = '';

      try {
        await socialSignIn({ provider: 'apple', idToken, hasAcceptedTerms: false });
      } catch (error: any) {
        if (error.requiresProfile) {
          Alert.alert(
            'Complete your profile',
            'Please accept the terms and conditions to finish signing up.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                onPress: () => navigation.navigate('SocialSignUp', {
                  provider: 'apple',
                  idToken,
                  email,
                  firstName,
                  lastName,
                  avatarUrl,
                }),
              },
            ]
          );
          return;
        }
        throw error;
      }
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED' || error.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      Alert.alert(
        'No account found?',
        error?.message || 'We could not sign you in with Apple. If you don\'t have an account, complete your profile to sign up.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Up',
            onPress: () => navigation.navigate('SocialSignUp', {
              provider: 'apple',
              idToken,
              email,
              firstName,
              lastName,
              avatarUrl,
            }),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    // Enhanced validation
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    // Password complexity validation
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      Alert.alert('Error', 'Password must contain uppercase, lowercase, and numbers');
      return;
    }

    setIsLoading(true);

    try {
      await signin(email.trim().toLowerCase(), password);
      // Navigation will be handled by the auth state change
      // If suspended/deleted, AuthContext will set isSuspended/isDeleted and App.tsx will navigate
    } catch (error: any) {
      // Don't show alert for suspension/deletion - handled by AuthContext and App.tsx navigation
      if (error.message && (error.message.includes('suspended') || error.message.includes('deleted'))) {
        return; // Let App.tsx handle navigation to SuspensionScreen
      }
      
      if (error.message === 'LEGACY_USER_MIGRATION_NEEDED') {
        setNeedsMigration(true);
        Alert.alert(
          'Account Migration Required',
          'Your account needs to be migrated to our new system. Please set a new password to continue.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Login Failed', error.message || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigration = async () => {
    // Enhanced validation
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    // Password complexity validation
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      Alert.alert('Error', 'Password must contain uppercase, lowercase, and numbers');
      return;
    }

    setIsLoading(true);

    try {
      await migrate(email.trim().toLowerCase(), newPassword);
      Alert.alert('Success', 'Account migrated successfully! You are now logged in.');
      // Navigation will be handled by the auth state change
    } catch (error: any) {
      Alert.alert('Migration Failed', error.message || 'Something went wrong');
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
        {/* Background Image */}
        <ImageBackground
          source={require('../../assets/images/login-pic.jpeg')}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
        >
          <View style={styles.overlay} />
        </ImageBackground>

        <View style={[styles.content, { paddingBottom: 40 + (insets.bottom || 0) }]}>
          {/* Logo/Title */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {needsMigration ? 'Account Migration' : 'Welcome Back'}
            </Text>
            <Text style={styles.subtitle}>
              {needsMigration ? 'Set a new password for your account' : 'Sign in to Fretiko'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, needsMigration && styles.inputDisabled]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!needsMigration}
              />
            </View>

            {!needsMigration && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(prev => !prev)}
                  >
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {needsMigration && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter a new password (min 6 characters)"
                    placeholderTextColor="#666"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(prev => !prev)}
                  >
                    <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={needsMigration ? handleMigration : handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {needsMigration ? 'Migrate Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password Link */}
            {!needsMigration && (
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {needsMigration && (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary, { marginTop: 12 }]}
                onPress={() => {
                  setNeedsMigration(false);
                  setNewPassword('');
                }}
              >
                <Text style={styles.buttonSecondaryText}>Back to Login</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Navigation to Signup */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.linkText}>Sign up here</Text>
            </TouchableOpacity>
          </View>

          <SocialAuthButtons
            onGoogleSignIn={handleGoogleSignIn}
            onAppleSignIn={handleAppleSignIn}
          />
        </View>
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
    height: SCREEN_HEIGHT * 0.45,
  },
  backgroundImageStyle: {
    opacity: 0.8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
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
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  input: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#444',
  },
  inputDisabled: {
    backgroundColor: '#2A2A2A',
    color: '#666',
    borderColor: '#444',
  },
  button: {
    backgroundColor: '#007AFF', // iOS blue
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  buttonSecondaryText: {
    color: '#B0B0B0',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    color: '#3498DB',
    fontSize: 15,
    fontWeight: '500',
  },
});