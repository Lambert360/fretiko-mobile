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
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { riderVerificationAPI } from '../services/riderVerificationAPI';
import * as ImagePicker from 'expo-image-picker';

interface RiderVerificationData {
  fullName: string;
  country: string;
  state: string;
  city: string;
  vehicleType: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  licensePlate?: string;
  worksForCompany: boolean;
  companyId?: string;
  companyName?: string;
  driverLicenseUrl?: string;
  vehicleRegistrationUrl?: string;
  insuranceDocumentUrl?: string;
  profilePhotoUrl?: string;
  yearsExperience?: string;
  previousCompanies?: string[];
}

const VEHICLE_TYPES = [
  { value: 'wheelbarrow', label: 'Wheelbarrow' },
  { value: 'bike', label: 'Bicycle' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' }
];

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun',
  'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara'
];

export const RiderVerificationScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<RiderVerificationData>({
    fullName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
    country: 'Nigeria',
    state: '',
    city: '',
    vehicleType: '',
    worksForCompany: false,
    previousCompanies: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const companiesData = await riderVerificationAPI.getCompanies();
      setCompanies(companiesData);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const pickImage = async (type: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uploadResponse = await riderVerificationAPI.uploadDocument(result.assets[0], type);
        handleInputChange(`${type}Url`, uploadResponse.url);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.vehicleType) newErrors.vehicleType = 'Vehicle type is required';
    if (formData.worksForCompany && !formData.companyId) {
      newErrors.companyId = 'Please select a company';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submissionData = {
        ...formData,
        yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : undefined,
        vehicleYear: formData.vehicleYear ? parseInt(formData.vehicleYear) : undefined,
        previousCompanies: formData.previousCompanies || []
      };

      await riderVerificationAPI.submitVerification(submissionData);
      
      Alert.alert(
        'Application Submitted',
        'Your rider verification application has been submitted successfully. You will receive an email once your application is reviewed.',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentUpload = (title: string, type: string, url?: string) => (
    <View style={styles.documentSection}>
      <Text style={styles.documentTitle}>{title}</Text>
      {url ? (
        <View style={styles.uploadedDocument}>
          <Image source={{ uri: url }} style={styles.documentPreview} />
          <TouchableOpacity
            style={styles.changeDocumentBtn}
            onPress={() => pickImage(type)}
          >
            <Ionicons name="camera" size={20} color="white" />
            <Text style={styles.changeDocumentText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={() => pickImage(type)}
        >
          <Ionicons name="cloud-upload" size={24} color="#10B981" />
          <Text style={styles.uploadBtnText}>Upload {title}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rider Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={formData.fullName}
              onChangeText={(value) => handleInputChange('fullName', value)}
              placeholder="Enter your full name"
            />
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>State *</Text>
              <View style={styles.pickerContainer}>
                <TextInput
                  style={[styles.input, errors.state && styles.inputError]}
                  value={formData.state}
                  onChangeText={(value) => handleInputChange('state', value)}
                  placeholder="Select state"
                />
              </View>
              {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                value={formData.city}
                onChangeText={(value) => handleInputChange('city', value)}
                placeholder="Enter city"
              />
              {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
            </View>
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vehicle Type *</Text>
            <View style={styles.vehicleTypes}>
              {VEHICLE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.vehicleTypeBtn,
                    formData.vehicleType === type.value && styles.vehicleTypeBtnSelected
                  ]}
                  onPress={() => handleInputChange('vehicleType', type.value)}
                >
                  <Text style={[
                    styles.vehicleTypeText,
                    formData.vehicleType === type.value && styles.vehicleTypeTextSelected
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.vehicleType && <Text style={styles.errorText}>{errors.vehicleType}</Text>}
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Make</Text>
              <TextInput
                style={styles.input}
                value={formData.vehicleMake || ''}
                onChangeText={(value) => handleInputChange('vehicleMake', value)}
                placeholder="e.g., Toyota"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>Model</Text>
              <TextInput
                style={styles.input}
                value={formData.vehicleModel || ''}
                onChangeText={(value) => handleInputChange('vehicleModel', value)}
                placeholder="e.g., Camry"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                value={formData.vehicleYear || ''}
                onChangeText={(value) => handleInputChange('vehicleYear', value)}
                placeholder="e.g., 2020"
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>License Plate</Text>
              <TextInput
                style={styles.input}
                value={formData.licensePlate || ''}
                onChangeText={(value) => handleInputChange('licensePlate', value)}
                placeholder="e.g., ABC-123-DE"
              />
            </View>
          </View>
        </View>

        {/* Company Affiliation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Affiliation</Text>
          
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => handleInputChange('worksForCompany', !formData.worksForCompany)}
          >
            <View style={[styles.checkbox, formData.worksForCompany && styles.checkboxChecked]}>
              {formData.worksForCompany && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <Text style={styles.checkboxLabel}>I work for a logistics partner company</Text>
          </TouchableOpacity>

          {formData.worksForCompany && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Select Company *</Text>
              <View style={styles.pickerContainer}>
                {companies.map((company) => (
                  <TouchableOpacity
                    key={company.id}
                    style={[
                      styles.companyOption,
                      formData.companyId === company.id && styles.companyOptionSelected
                    ]}
                    onPress={() => handleInputChange('companyId', company.id)}
                  >
                    <Text style={[
                      styles.companyOptionText,
                      formData.companyId === company.id && styles.companyOptionTextSelected
                    ]}>
                      {company.company_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.companyId && <Text style={styles.errorText}>{errors.companyId}</Text>}
            </View>
          )}

          {!formData.worksForCompany && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.companyName || ''}
                onChangeText={(value) => handleInputChange('companyName', value)}
                placeholder="Enter company name if applicable"
              />
            </View>
          )}
        </View>

        {/* Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Years of Experience</Text>
            <TextInput
              style={styles.input}
              value={formData.yearsExperience || ''}
              onChangeText={(value) => handleInputChange('yearsExperience', value)}
              placeholder="e.g., 2"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Document Uploads */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          
          {renderDocumentUpload('Driver\'s License', 'driverLicense', formData.driverLicenseUrl)}
          {renderDocumentUpload('Vehicle Registration', 'vehicleRegistration', formData.vehicleRegistrationUrl)}
          {renderDocumentUpload('Insurance Document', 'insuranceDocument', formData.insuranceDocumentUrl)}
          {renderDocumentUpload('Profile Photo', 'profilePhoto', formData.profilePhotoUrl)}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Application</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: 'white',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  vehicleTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vehicleTypeBtn: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  vehicleTypeBtnSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  vehicleTypeText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  vehicleTypeTextSelected: {
    color: 'white',
  },
  pickerContainer: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#374151',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxLabel: {
    fontSize: 16,
    color: 'white',
  },
  companyOption: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  companyOptionSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  companyOptionText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  companyOptionTextSelected: {
    color: 'white',
  },
  documentSection: {
    marginBottom: 20,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginBottom: 10,
  },
  uploadBtn: {
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  uploadBtnText: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 8,
  },
  uploadedDocument: {
    position: 'relative',
  },
  documentPreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  changeDocumentBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeDocumentText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  submitBtnDisabled: {
    backgroundColor: '#6B7280',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
