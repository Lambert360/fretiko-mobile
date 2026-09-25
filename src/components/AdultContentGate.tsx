import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export const ADULT_CONTENT_ERROR_CODE = 'ADULT_CONTENT_RESTRICTED';

export const isAdultContentError = (error: any): boolean => {
  const data = error?.response?.data;
  return error?.response?.status === 403 && data?.code === ADULT_CONTENT_ERROR_CODE;
};

const getAge = (dateOfBirth?: string): number | null => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

interface AdultContentGateProps {
  navigation: any;
  contentLabel?: string;
}

export const AdultContentGate: React.FC<AdultContentGateProps> = ({
  navigation,
  contentLabel = 'listing',
}) => {
  const { user } = useAuth();

  const age = useMemo(() => getAge(user?.dateOfBirth), [user?.dateOfBirth]);
  const missingDob = !user || age === null;
  const underage = !missingDob && age !== null && age < 18;

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed" size={40} color="#FF9500" />
      </View>
      <Text style={styles.title}>18+ Content</Text>
      <Text style={styles.message}>
        {underage
          ? `This ${contentLabel} is restricted to adults. You must be 18 or older to view it.`
          : `This ${contentLabel} is marked as adult content and is only visible to verified users aged 18 or older.`}
      </Text>

      {missingDob && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('EditProfile', { profile: user })}
        >
          <Ionicons name="calendar-outline" size={18} color="#000" />
          <Text style={styles.primaryButtonText}>
            {user ? 'Add Date of Birth' : 'Sign In to Continue'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
