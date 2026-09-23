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
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface MFAVerificationScreenProps {
  navigation: any;
}

export const MFAVerificationScreen: React.FC<MFAVerificationScreenProps> = ({ navigation }) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { verifyMFA, clearMFAState, mfaRequired } = useAuth();
  const codeInputRef = useRef<TextInput>(null);

  const handleVerifyMFA = async () => {
    if (!code.trim() || code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit code');
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Invalid Code', 'Code must contain only numbers');
      return;
    }

    setIsLoading(true);
    try {
      await verifyMFA(code);
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Invalid or expired code');
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    clearMFAState();
    navigation.replace('Login');
  };

  if (!mfaRequired) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleCancel}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={64} color="#007AFF" />
            <Text style={styles.title}>Two-Factor Authentication</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code from your authenticator app
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              ref={codeInputRef}
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!isLoading}
              autoFocus
              textAlign="center"
            />

            <TouchableOpacity
              style={[styles.verifyButton, isLoading && styles.buttonDisabled]}
              onPress={handleVerifyMFA}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have your authenticator app? You can use backup codes if you saved them.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginBottom: 40,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 8,
    marginBottom: 24,
    color: '#000',
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
