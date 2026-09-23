import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';

interface MFAManagementScreenProps {
  navigation: any;
}

interface MfaFactor {
  id: string;
  status: string;
  createdAt: string;
}

export const MFAManagementScreen: React.FC<MFAManagementScreenProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isDisabling, setIsDisabling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [factors, setFactors] = useState<MfaFactor[]>([]);

  const loadFactors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await authAPI.mfaSession();
      const result = await authAPI.mfaListFactors(session.supabaseAccessToken, session.supabaseRefreshToken);
      setFactors(result.totp || []);
    } catch (err: any) {
      setError(err.message || 'Could not load MFA status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const handleDisable = (factorId: string) => {
    Alert.alert(
      'Disable Two-Factor Authentication',
      'Are you sure? This will make your account less secure.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            setIsDisabling(factorId);
            try {
              const session = await authAPI.mfaSession();
              await authAPI.mfaUnenroll(session.supabaseAccessToken, session.supabaseRefreshToken, factorId);
              await loadFactors();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not disable MFA');
            } finally {
              setIsDisabling(null);
            }
          },
        },
      ],
    );
  };

  const verifiedFactors = factors.filter((f) => f.status === 'verified');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={64} color="#007AFF" />
          <Text style={styles.title}>Two-Factor Authentication</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadFactors}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : verifiedFactors.length > 0 ? (
          <>
            <Text style={styles.statusText}>
              Two-factor authentication is <Text style={styles.statusEnabled}>enabled</Text> on your account.
            </Text>
            {verifiedFactors.map((factor) => (
              <View key={factor.id} style={styles.factorRow}>
                <View style={styles.factorInfo}>
                  <Ionicons name="phone-portrait-outline" size={20} color="#007AFF" />
                  <Text style={styles.factorLabel}>Authenticator App</Text>
                </View>
                <TouchableOpacity
                  style={[styles.disableButton, isDisabling === factor.id && styles.buttonDisabled]}
                  onPress={() => handleDisable(factor.id)}
                  disabled={isDisabling === factor.id}
                >
                  {isDisabling === factor.id ? (
                    <ActivityIndicator color="#FF3B30" size="small" />
                  ) : (
                    <Text style={styles.disableButtonText}>Disable</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.statusText}>
              Two-factor authentication is <Text style={styles.statusDisabled}>not enabled</Text> on your account.
            </Text>
            <TouchableOpacity
              style={styles.enableButton}
              onPress={() => navigation.navigate('MFAEnrollment')}
            >
              <Text style={styles.enableButtonText}>Enable 2FA</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingVertical: 20 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '600', marginTop: 16, color: '#000', textAlign: 'center' },
  loader: { marginVertical: 40 },
  errorBox: { alignItems: 'center', marginVertical: 40 },
  errorText: { color: '#FF3B30', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#007AFF', borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  statusText: { fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  statusEnabled: { color: '#34C759', fontWeight: '700' },
  statusDisabled: { color: '#999', fontWeight: '700' },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    marginBottom: 12,
  },
  factorInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factorLabel: { fontSize: 15, color: '#000', marginLeft: 10 },
  disableButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B30' },
  disableButtonText: { color: '#FF3B30', fontWeight: '600', fontSize: 13 },
  buttonDisabled: { opacity: 0.6 },
  enableButton: { backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  enableButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
