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
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);

  const { signin, migrate } = useAuth();

  const handleLogin = async () => {
    // Basic validation
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await signin(email.trim().toLowerCase(), password);
      // Navigation will be handled by the auth state change
    } catch (error: any) {
      if (error.message === 'LEGACY_USER_MIGRATION_NEEDED') {
        setNeedsMigration(true);
        setIsLoading(false);
        Alert.alert(
          'Account Migration Required',
          'Your account needs to be migrated to our new system. Please set a new password to continue.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Login Failed', error.message || 'Something went wrong');
        setIsLoading(false);
      }
    }
  };

  const handleMigration = async () => {
    // Basic validation
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
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
        <View style={styles.content}>
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
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#666"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            )}

            {needsMigration && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter a new password (min 6 characters)"
                  placeholderTextColor="#666"
                  secureTextEntry
                  autoCapitalize="none"
                />
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Dark theme background
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
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
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333',
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
});