import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerInput } from '../components/DatePickerInput';

const parseJwt = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const jsonPayload = (global as any).atob(base64 + padding);
    return JSON.parse(jsonPayload);
  } catch (e) {
    return {};
  }
};

const getTokenExpirySeconds = (token: string): number => {
  const parsed = parseJwt(token);
  return parsed.exp || 0;
};

const isTokenValid = (token: string): boolean => {
  const exp = getTokenExpirySeconds(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - now > 60; // more than 1 minute left
};

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const ROLE_OPTIONS = [
  { label: 'Citizen', value: 'citizen', icon: 'person' },
  { label: 'Vendor', value: 'vendor', icon: 'storefront' },
  { label: 'Rider', value: 'rider', icon: 'bicycle' },
];

interface SocialSignUpScreenProps {
  navigation: any;
  route: any;
}

export const SocialSignUpScreen: React.FC<SocialSignUpScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { socialSignIn } = useAuth();

  const { provider, idToken, code, redirectUri, email, firstName = '', lastName = '', avatarUrl, referralCode = '' } = route.params;

  const [formData, setFormData] = useState({
    firstName: firstName,
    lastName: lastName,
    dateOfBirth: '',
    gender: '',
    user_role: 'citizen' as 'citizen' | 'vendor' | 'rider',
    hasAcceptedTerms: false,
    referralCode: referralCode,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Auto-fill first/last name from the idToken claims if the screen params didn't provide them
  useEffect(() => {
    if (!idToken) return;
    const parsed = parseJwt(idToken);
    setFormData(prev => ({
      ...prev,
      firstName: prev.firstName || parsed.given_name || '',
      lastName: prev.lastName || parsed.family_name || '',
    }));
  }, [idToken]);

  const showSessionExpired = () => {
    Alert.alert(
      'Session expired',
      'Your social sign-in session has expired. Please sign in again.',
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
    );
  };

  useEffect(() => {
    if (idToken && !isTokenValid(idToken)) {
      showSessionExpired();
    }
  }, [idToken]);

  const updateFormData = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const validateForm = () => {
    if (!formData.hasAcceptedTerms) {
      Alert.alert('Terms Required', 'Please accept the Terms & Conditions and Privacy Policy to continue');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    if (idToken && !isTokenValid(idToken)) {
      showSessionExpired();
      return;
    }

    if (!idToken && !code) {
      Alert.alert('Sign Up Failed', 'No authorization token available. Please sign in again.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🧩 SocialSignUp payload:', { provider, hasIdToken: !!idToken, hasCode: !!code, redirectUri, referralCode: formData.referralCode });

      await socialSignIn({
        provider,
        ...(idToken ? { idToken } : { code, redirectUri }),
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        user_role: formData.user_role,
        is_seller: formData.user_role === 'vendor',
        is_rider: formData.user_role === 'rider',
        hasAcceptedTerms: true,
        referralCode: formData.referralCode,
      });
    } catch (error: any) {
      console.error('❌ Social sign up error:', error);
      Alert.alert('Sign Up Failed', error.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + (insets.bottom || 0) }}
        style={styles.scrollView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>Just a few details to finish signing up with {provider}</Text>
        </View>

        <View style={styles.card}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color="#666" />
            </View>
          )}
          <Text style={styles.email}>{email}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={[styles.inputGroup, styles.nameInput]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => updateFormData('firstName', value)}
                placeholder="First name"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputGroup, styles.nameInput]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => updateFormData('lastName', value)}
                placeholder="Last name"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />
            </View>
          </View>

          <DatePickerInput
            value={formData.dateOfBirth}
            onChange={(value) => updateFormData('dateOfBirth', value)}
            placeholder="Select your date of birth"
            label="Date of Birth (optional)"
            minimumAge={13}
            required={false}
          />

          <Text style={styles.sectionTitle}>Gender (optional)</Text>
          <View style={styles.genderContainer}>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderOption,
                  formData.gender === option.value && styles.genderOptionSelected,
                ]}
                onPress={() => updateFormData('gender', option.value)}
              >
                <Text style={[
                  styles.genderOptionText,
                  formData.gender === option.value && styles.genderOptionTextSelected,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Choose your role</Text>
          <View style={styles.roleContainer}>
            {ROLE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.roleOption,
                  formData.user_role === option.value && styles.roleOptionSelected,
                ]}
                onPress={() => updateFormData('user_role', option.value)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={20}
                  color={formData.user_role === option.value ? '#FFF' : '#3498DB'}
                />
                <Text style={[
                  styles.roleOptionText,
                  formData.user_role === option.value && styles.roleOptionTextSelected,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => updateFormData('hasAcceptedTerms', !formData.hasAcceptedTerms)}
          >
            <View style={[styles.checkbox, formData.hasAcceptedTerms && styles.checkboxChecked]}>
              {formData.hasAcceptedTerms && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the Terms & Conditions and Privacy Policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              (!formData.hasAcceptedTerms || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={!formData.hasAcceptedTerms || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollView: { paddingHorizontal: 20 },
  header: { marginTop: 40, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#999' },
  card: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  email: { color: '#FFF', fontSize: 16 },
  form: { gap: 16 },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameInput: { flex: 1 },
  inputGroup: { marginBottom: 16 },
  label: { color: '#FFF', marginBottom: 8, fontSize: 14 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: { color: '#FFF', fontSize: 16, marginBottom: 12, marginTop: 8 },
  genderContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  genderOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  genderOptionSelected: { backgroundColor: '#3498DB', borderColor: '#3498DB' },
  genderOptionText: { color: '#999', fontSize: 14 },
  genderOptionTextSelected: { color: '#FFF' },
  roleContainer: { gap: 12, marginBottom: 16 },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  roleOptionSelected: { backgroundColor: '#3498DB', borderColor: '#3498DB' },
  roleOptionText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  roleOptionTextSelected: { color: '#FFF', fontWeight: 'bold' },
  termsContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#3498DB' },
  termsText: { color: '#CCC', fontSize: 14, flex: 1 },
  button: {
    backgroundColor: '#3498DB',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
