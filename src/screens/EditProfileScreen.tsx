import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userAPI, UpdateProfileData } from '../services/userAPI';
import { AvatarUpload } from '../components/AvatarUpload';
import { BackgroundUpload } from '../components/BackgroundUpload';
import { DatePickerInput } from '../components/DatePickerInput';

interface EditProfileScreenProps {
  navigation: any;
  route: {
    params: {
      profile: any;
      focusAvatar?: boolean;
      becomeSeller?: boolean;
    };
  };
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const { profile: initialProfile, focusAvatar, becomeSeller } = route.params;
  
  const [formData, setFormData] = useState({
    username: initialProfile?.username || '',
    bio: initialProfile?.bio || '',
    location: initialProfile?.location || '',
    phone: initialProfile?.phone || '',
    dateOfBirth: initialProfile?.dateOfBirth || '',
    gender: initialProfile?.gender || '',
    isSeller: becomeSeller || initialProfile?.isSeller || false,
    isRider: initialProfile?.isRider || false,
  });
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  
  const [loading, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [backgroundUrl, setBackgroundUrl] = useState<string | undefined>(initialProfile?.bgPicUrl);

  const genderOptions = [
    { label: 'Male', value: 'male', icon: 'male' },
    { label: 'Female', value: 'female', icon: 'female' },
    { label: 'Other', value: 'other', icon: 'male-female' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say', icon: 'help-circle' },
  ];

  useEffect(() => {
    // Auto-focus on becoming seller if that's the intent
    if (becomeSeller) {
      Alert.alert(
        '🏪 Become a Seller',
        'Enable seller mode to start selling products and services on Fretiko!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => setFormData(prev => ({ ...prev, isSeller: true }))
          }
        ]
      );
    }
  }, [becomeSeller]);

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 50) {
      newErrors.username = 'Username must be 50 characters or less';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Bio validation
    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = 'Bio must be 500 characters or less';
    }

    // Location validation
    if (formData.location && formData.location.length > 100) {
      newErrors.location = 'Location must be 100 characters or less';
    }

    // Phone validation (basic)
    if (formData.phone && !/^[+]?[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Date of birth validation
    if (formData.dateOfBirth) {
      const date = new Date(formData.dateOfBirth);
      const now = new Date();
      if (date > now) {
        newErrors.dateOfBirth = 'Date of birth cannot be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    setSaving(true);

    try {
      const updateData: UpdateProfileData = {
        username: formData.username.trim(),
        bio: formData.bio.trim() || undefined,
        location: formData.location.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
        isSeller: formData.isSeller,
        isRider: formData.isRider,
      };

      await userAPI.updateProfile(updateData);
      
      // Determine success message based on role changes
      let successMessage = 'Your profile has been updated successfully!';
      if (formData.isSeller && !initialProfile?.isSeller) {
        successMessage = '🎉 Welcome to Fretiko sellers! Your profile has been updated.';
      } else if (formData.isRider && !initialProfile?.isRider) {
        successMessage = '🏍️ Welcome to Fretiko riders! Your profile has been updated.';
      } else if (formData.isSeller && formData.isRider && !initialProfile?.isSeller && !initialProfile?.isRider) {
        successMessage = '🎉 Welcome to Fretiko sellers and riders! Your profile has been updated.';
      }

      Alert.alert(
        'Success',
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Update Failed',
        error.message || 'Could not update your profile. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Check if there are unsaved changes
    const hasChanges =
      formData.username !== (initialProfile?.username || '') ||
      formData.bio !== (initialProfile?.bio || '') ||
      formData.location !== (initialProfile?.location || '') ||
      formData.phone !== (initialProfile?.phone || '') ||
      formData.dateOfBirth !== (initialProfile?.dateOfBirth || '') ||
      formData.gender !== (initialProfile?.gender || '') ||
      formData.isSeller !== (initialProfile?.isSeller || false) ||
      formData.isRider !== (initialProfile?.isRider || false);

    if (hasChanges) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.headerButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={loading}
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Avatar Upload */}
          <View style={styles.avatarSection}>
            <Text style={styles.sectionTitle}>Profile Picture</Text>
            <AvatarUpload
              currentAvatarUrl={initialProfile?.avatarUrl}
              onUploadSuccess={(avatarUrl) => {
                // Avatar upload is handled directly by the component
                // The profile will be refreshed when the user goes back to profile screen
              }}
              size={100}
            />
          </View>

          {/* Background Upload */}
          <View style={styles.backgroundSection}>
            <Text style={styles.sectionTitle}>Background Image</Text>
            <View style={styles.backgroundContainer}>
              <BackgroundUpload
                currentBackgroundUrl={backgroundUrl}
                onUploadSuccess={(newBackgroundUrl) => {
                  setBackgroundUrl(newBackgroundUrl);
                }}
                width={320}
                height={180}
              />
            </View>
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              value={formData.username}
              onChangeText={(value) => updateFormData('username', value)}
              placeholder="Enter your username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
          </View>

          {/* Bio */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.bio && styles.inputError]}
              value={formData.bio}
              onChangeText={(value) => updateFormData('bio', value)}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{formData.bio.length}/500</Text>
            {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              value={formData.location}
              onChangeText={(value) => updateFormData('location', value)}
              placeholder="City, Country"
              placeholderTextColor="#666"
              autoCapitalize="words"
            />
            {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>

          {/* Date of Birth */}
          <View style={styles.inputGroup}>
            <DatePickerInput
              value={formData.dateOfBirth}
              onChange={(value) => updateFormData('dateOfBirth', value)}
              placeholder="Select your date of birth"
              label="Date of Birth"
              minimumAge={18}
              required={false}
            />
          </View>

          {/* Gender */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
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

          {/* Seller Toggle */}
          <View style={styles.inputGroup}>
            <View style={styles.switchContainer}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>🏪 Seller Account</Text>
                <Text style={styles.switchDescription}>
                  Enable to sell products and services
                </Text>
              </View>
              <Switch
                value={formData.isSeller}
                onValueChange={(value) => {
                  if (value && formData.isRider) {
                    Alert.alert(
                      'Choose One Role',
                      'You can only be a Seller or a Rider, not both. Do you want to switch to Seller?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Switch to Seller',
                          onPress: () => {
                            setFormData(prev => ({ ...prev, isSeller: true, isRider: false }));
                          }
                        }
                      ]
                    );
                  } else {
                    updateFormData('isSeller', value);
                  }
                }}
                trackColor={{ false: '#333', true: '#007AFF' }}
                thumbColor={formData.isSeller ? '#FFFFFF' : '#BBBBBB'}
              />
            </View>
          </View>

          {/* Rider Toggle */}
          <View style={styles.inputGroup}>
            <View style={styles.switchContainer}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>🏍️ Rider Account</Text>
                <Text style={styles.switchDescription}>
                  Enable to deliver orders and earn money
                </Text>
              </View>
              <Switch
                value={formData.isRider}
                onValueChange={(value) => {
                  if (value && formData.isSeller) {
                    Alert.alert(
                      'Choose One Role',
                      'You can only be a Seller or a Rider, not both. Do you want to switch to Rider?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Switch to Rider',
                          onPress: () => {
                            setFormData(prev => ({ ...prev, isRider: true, isSeller: false }));
                          }
                        }
                      ]
                    );
                  } else {
                    updateFormData('isRider', value);
                  }
                }}
                trackColor={{ false: '#333', true: '#FF9500' }}
                thumbColor={formData.isRider ? '#FFFFFF' : '#BBBBBB'}
              />
            </View>
          </View>

          {/* Seller Benefits (if becoming seller) */}
          {formData.isSeller && !initialProfile?.isSeller && (
            <View style={styles.sellerBenefits}>
              <Text style={styles.benefitsTitle}>🎉 Seller Benefits:</Text>
              <Text style={styles.benefitItem}>• List and sell products</Text>
              <Text style={styles.benefitItem}>• Offer services and bookings</Text>
              <Text style={styles.benefitItem}>• Accept payments through Fretiko</Text>
              <Text style={styles.benefitItem}>• Access seller analytics</Text>
              <Text style={styles.benefitItem}>• Join the seller community</Text>
            </View>
          )}

          {/* Rider Benefits (if becoming rider) */}
          {formData.isRider && !initialProfile?.isRider && (
            <View style={styles.riderBenefits}>
              <Text style={styles.benefitsTitle}>🏍️ Rider Benefits:</Text>
              <Text style={styles.benefitItem}>• Earn money from deliveries</Text>
              <Text style={styles.benefitItem}>• Flexible working hours</Text>
              <Text style={styles.benefitItem}>• Track earnings and trips</Text>
              <Text style={styles.benefitItem}>• Build customer relationships</Text>
              <Text style={styles.benefitItem}>• Be part of the delivery network</Text>
            </View>
          )}
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  backgroundSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  backgroundContainer: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
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
  inputError: {
    borderColor: '#FF3B30',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
  },
  switchLabel: {
    flex: 1,
  },
  switchDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 2,
  },
  sellerBenefits: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  genderSelector: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
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
  riderBenefits: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
});