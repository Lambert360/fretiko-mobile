import React, { useEffect, useRef, useState } from 'react';
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
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';

interface MFAEnrollmentScreenProps {
  navigation: any;
}

export const MFAEnrollmentScreen: React.FC<MFAEnrollmentScreenProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const sessionRef = useRef<{ supabaseAccessToken: string; supabaseRefreshToken: string } | null>(null);

  useEffect(() => {
    startEnrollment();
  }, []);

  const startEnrollment = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await authAPI.mfaSession();
      sessionRef.current = session;

      const result = await authAPI.mfaEnroll(session.supabaseAccessToken, session.supabaseRefreshToken);
      setFactorId(result.factorId);
      setUri(result.uri);
      setSecret(result.secret);
    } catch (err: any) {
      setError(err.message || 'Could not start MFA enrollment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code from your authenticator app');
      return;
    }
    if (!factorId || !sessionRef.current) {
      Alert.alert('Error', 'Enrollment session expired. Please try again.');
      return;
    }

    setIsVerifying(true);
    try {
      await authAPI.mfaVerifyEnrollment(
        sessionRef.current.supabaseAccessToken,
        sessionRef.current.supabaseRefreshToken,
        factorId,
        code,
      );
      const backupResult = await authAPI.mfaBackupCodes();
      setBackupCodes(backupResult.codes);
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid or expired code');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={64} color="#007AFF" />
            <Text style={styles.title}>Set Up Two-Factor Authentication</Text>
            <Text style={styles.subtitle}>
              Scan this QR code with Google Authenticator, Authy, or another authenticator app.
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={startEnrollment}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {uri && (
                <View style={styles.qrContainer}>
                  <QRCode value={uri} size={200} />
                </View>
              )}

              {secret && (
                <View style={styles.secretContainer}>
                  <Text style={styles.secretLabel}>Can't scan? Enter this key manually:</Text>
                  <Text selectable style={styles.secretValue}>{secret}</Text>
                </View>
              )}

              <View style={styles.form}>
                <Text style={styles.formLabel}>Enter the 6-digit code from your app</Text>
                <TextInput
                  style={styles.codeInput}
                  placeholder="000000"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                  editable={!isVerifying}
                  textAlign="center"
                />

                <TouchableOpacity
                  style={[styles.verifyButton, isVerifying && styles.buttonDisabled]}
                  onPress={handleVerify}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Enable 2FA</Text>
                  )}
                </TouchableOpacity>
              </View>

              {backupCodes && (
                <View style={styles.backupBox}>
                  <Text style={styles.backupTitle}>Two-Factor Authentication Enabled</Text>
                  <Text style={styles.backupWarning}>
                    Save these backup codes somewhere safe. Each can only be used once, and they will not be shown again.
                  </Text>
                  {backupCodes.map((c) => (
                    <Text key={c} selectable style={styles.backupCode}>{c}</Text>
                  ))}
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={styles.doneButtonText}>I've Saved Them</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboardView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingVertical: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '600', marginTop: 16, marginBottom: 8, color: '#000', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  loader: { marginVertical: 40 },
  errorBox: { alignItems: 'center', marginVertical: 40 },
  errorText: { color: '#FF3B30', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#007AFF', borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  qrContainer: { alignItems: 'center', marginVertical: 24 },
  secretContainer: { alignItems: 'center', marginBottom: 24, paddingHorizontal: 20 },
  secretLabel: { fontSize: 12, color: '#666', marginBottom: 6 },
  secretValue: { fontSize: 14, fontWeight: '600', color: '#000', letterSpacing: 1 },
  form: { marginTop: 8 },
  formLabel: { fontSize: 14, color: '#333', marginBottom: 12, textAlign: 'center' },
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
  verifyButton: { backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  backupBox: { marginTop: 24, backgroundColor: '#F8F8F8', borderRadius: 10, padding: 16 },
  backupTitle: { fontSize: 16, fontWeight: '700', color: '#34C759', textAlign: 'center', marginBottom: 8 },
  backupWarning: { fontSize: 12, color: '#FF9500', fontWeight: '600', marginBottom: 12, lineHeight: 17, textAlign: 'center' },
  backupCode: { fontSize: 15, fontWeight: '600', color: '#000', letterSpacing: 1.5, marginBottom: 6, textAlign: 'center' },
  doneButton: { marginTop: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#007AFF', alignItems: 'center' },
  doneButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
