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
  ScrollView,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SignupScreenProps {
  navigation: any;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    gender: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const insets = useSafeAreaInsets();

  const { signup } = useAuth();

  const genderOptions = [
    { label: 'Male', value: 'male', icon: 'male' },
    { label: 'Female', value: 'female', icon: 'female' },
    { label: 'Other', value: 'other', icon: 'male-female' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say', icon: 'help-circle' },
  ];

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { firstName, lastName, email, password, confirmPassword, dateOfBirth, gender } = formData;

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    // Date of birth validation (optional but recommended format check)
    if (dateOfBirth && !isValidDate(dateOfBirth)) {
      Alert.alert('Error', 'Please enter a valid date of birth (YYYY-MM-DD)');
      return false;
    }

    return true;
  };

  const isValidDate = (dateString: string) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      await signup(
        formData.email.trim().toLowerCase(),
        formData.password,
        formData.firstName.trim(),
        formData.lastName.trim(),
        formData.dateOfBirth || undefined,
        formData.gender || undefined
      );
      // Navigation will be handled by the auth state change
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'Something went wrong');
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
          source={require('../../assets/images/sign up-pic.jpeg')}
          style={styles.backgroundImage}
          imageStyle={styles.backgroundImageStyle}
        >
          <View style={styles.overlay} />
        </ImageBackground>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + (insets.bottom || 0) }]}
        >
          <View style={styles.content}>
            {/* Logo/Title */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join Fretiko today</Text>
            </View>

            {/* Form */}
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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(value) => updateFormData('email', value)}
                  placeholder="Enter your email"
                  placeholderTextColor="#666"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={formData.password}
                    onChangeText={(value) => updateFormData('password', value)}
                    placeholder="Create a password"
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

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={formData.confirmPassword}
                    onChangeText={(value) => updateFormData('confirmPassword', value)}
                    placeholder="Confirm your password"
                    placeholderTextColor="#666"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(prev => !prev)}
                  >
                    <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of Birth (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.dateOfBirth}
                  onChangeText={(value) => updateFormData('dateOfBirth', value)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#666"
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Gender (Optional)</Text>
                <TouchableOpacity
                  style={styles.genderSelector}
                  onPress={() => setShowGenderPicker(!showGenderPicker)}
                >
                  <Text style={[styles.genderText, !formData.gender && styles.genderPlaceholder]}>
                    {formData.gender
                      ? genderOptions.find(g => g.value === formData.gender)?.label
                      : 'Select your gender'}
                  </Text>
                  <Ionicons
                    name={showGenderPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>

                {showGenderPicker && (
                  <View style={styles.genderOptions}>
                    {genderOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.genderOption,
                          formData.gender === option.value && styles.genderOptionSelected,
                        ]}
                        onPress={() => {
                          updateFormData('gender', option.value);
                          setShowGenderPicker(false);
                        }}
                      >
                        <Ionicons
                          name={option.icon as any}
                          size={20}
                          color={formData.gender === option.value ? '#007AFF' : '#666'}
                        />
                        <Text
                          style={[
                            styles.genderOptionText,
                            formData.gender === option.value && styles.genderOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {formData.gender === option.value && (
                          <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Navigation to Login */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Sign in here</Text>
              </TouchableOpacity>
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: SCREEN_HEIGHT * 0.25,
  },
  content: {
    flex: 1,
    padding: 20,
    minHeight: '100%',
  },
  header: {
    marginBottom: 30,
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
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameInput: {
    flex: 1,
    marginHorizontal: 5,
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
    right: 6,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderSelector: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  genderText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  genderPlaceholder: {
    color: '#666',
  },
  genderOptions: {
    marginTop: 8,
    backgroundColor: 'rgba(30, 30, 30, 0.98)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#444',
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  genderOptionSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  genderOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  genderOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
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