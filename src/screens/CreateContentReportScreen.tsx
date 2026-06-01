import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { contentReportsAPI, CreateContentReportRequest, ReportCategory, ReportType } from '../services/contentReportsAPI';
import { useAuth } from '../contexts/AuthContext';
import { fileUploadService } from '../services/fileUploadService';

// Report types by category
const PRODUCT_REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'spam', label: 'Spam' },
  { value: 'fraudulent_listing', label: 'Fraudulent Listing' },
  { value: 'copyright_violation', label: 'Copyright Violation' },
  { value: 'misleading_information', label: 'Misleading Information' },
  { value: 'other', label: 'Other' },
];

const SERVICE_REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'spam', label: 'Spam' },
  { value: 'fraudulent_listing', label: 'Fraudulent Listing' },
  { value: 'copyright_violation', label: 'Copyright Violation' },
  { value: 'misleading_information', label: 'Misleading Information' },
  { value: 'other', label: 'Other' },
];

const CHAT_REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam_messages', label: 'Spam Messages' },
  { value: 'inappropriate_language', label: 'Inappropriate Language' },
  { value: 'threats', label: 'Threats' },
  { value: 'other', label: 'Other' },
];

const USER_REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'fake_account', label: 'Fake Account' },
  { value: 'scam_attempt', label: 'Scam Attempt' },
  { value: 'other', label: 'Other' },
];

const POST_REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright_violation', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' },
];

interface EvidenceItem {
  uri: string;
  type: 'image' | 'document';
  name: string;
  uploadedUrl?: string;
  uploading?: boolean;
}

const CreateContentReportScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const params = (route.params as { 
    productId?: string;
    serviceId?: string;
    chatId?: string;
    postId?: string;
    reportedUserId?: string;
    reportCategory?: ReportCategory;
  }) || {};

  // Determine report category from params
  const reportCategory: ReportCategory = params.reportCategory ||
    (params.productId ? 'product' :
     params.serviceId ? 'service' :
     params.postId ? 'post' :
     params.chatId ? 'chat' :
     params.reportedUserId ? 'user' :
     'product');

  // Get report types based on category
  const getReportTypes = () => {
    switch (reportCategory) {
      case 'product': return PRODUCT_REPORT_TYPES;
      case 'service': return SERVICE_REPORT_TYPES;
      case 'post': return POST_REPORT_TYPES;
      case 'chat': return CHAT_REPORT_TYPES;
      case 'user': return USER_REPORT_TYPES;
      default: return PRODUCT_REPORT_TYPES;
    }
  };

  const REPORT_TYPES = getReportTypes();

  const [reportType, setReportType] = useState<ReportType | ''>('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera roll permissions to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newEvidence: EvidenceItem[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'image' as const,
          name: asset.fileName || `image_${Date.now()}.jpg`,
        }));
        setEvidence(prev => [...prev, ...newEvidence].slice(0, 10)); // Max 10 evidence items
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newEvidence: EvidenceItem[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'document' as const,
          name: asset.name || `document_${Date.now()}.pdf`,
        }));
        setEvidence(prev => [...prev, ...newEvidence].slice(0, 10)); // Max 10 evidence items
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const removeEvidence = (index: number) => {
    setEvidence(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation
    if (reportCategory === 'product' && !params.productId) {
      Alert.alert('Error', 'Product reference is missing');
      return;
    }
    if (reportCategory === 'service' && !params.serviceId) {
      Alert.alert('Error', 'Service reference is missing');
      return;
    }
    if (reportCategory === 'post' && !params.postId) {
      Alert.alert('Error', 'Post reference is missing');
      return;
    }
    if (reportCategory === 'chat' && !params.chatId) {
      Alert.alert('Error', 'Chat reference is missing');
      return;
    }
    if (reportCategory === 'user' && !params.reportedUserId) {
      Alert.alert('Error', 'User reference is missing');
      return;
    }

    if (!reportType) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the report');
      return;
    }

    if (!accessToken || !user) {
      Alert.alert('Error', 'You must be logged in to submit a report');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload evidence files if any
      let uploadedEvidence: Array<{ type: 'image' | 'document'; url: string; description: string }> = [];
      
      if (evidence.length > 0) {
        Alert.alert('Uploading', 'Please wait while we upload your evidence...');
        
        for (let i = 0; i < evidence.length; i++) {
          const item = evidence[i];
          if (item.uploadedUrl) {
            // Already uploaded
            uploadedEvidence.push({
              type: item.type,
              url: item.uploadedUrl,
              description: item.name,
            });
            continue;
          }

          try {
            // Determine MIME type
            const mimeType = item.type === 'image' 
              ? 'image/jpeg' 
              : 'application/pdf';

            const uploadResult = await fileUploadService.uploadFile(
              item.uri,
              item.name,
              mimeType
            );

            if (uploadResult.success) {
              uploadedEvidence.push({
                type: item.type,
                url: uploadResult.publicUrl,
                description: item.name,
              });
            } else {
              console.warn(`Failed to upload evidence ${item.name}:`, uploadResult.error);
            }
          } catch (uploadError) {
            console.error(`Error uploading evidence ${item.name}:`, uploadError);
            // Continue with other files
          }
        }
      }

      const request: CreateContentReportRequest = {
        reportCategory: reportCategory,
        reportType: reportType as ReportType,
        reason: reason.trim(),
        description: description.trim() || undefined,
        evidence: uploadedEvidence.length > 0 ? uploadedEvidence : undefined,
        productId: params.productId,
        serviceId: params.serviceId,
        postId: params.postId,
        chatId: params.chatId,
        reportedUserId: params.reportedUserId,
      };

      const report = await contentReportsAPI.createContentReport(request, accessToken);

      Alert.alert(
        'Success',
        'Content report submitted successfully. Our moderation team will review it.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating content report:', error);
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeLabel = REPORT_TYPES.find((t) => t.value === reportType)?.label || 'Select Report Type';

  const getCategoryLabel = () => {
    switch (reportCategory) {
      case 'product': return 'Report Product';
      case 'service': return 'Report Service';
      case 'post': return 'Report Post';
      case 'chat': return 'Report Chat';
      case 'user': return 'Report User';
      default: return 'Report Content';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getCategoryLabel()}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {/* Category info */}
            <View style={styles.inputGroup}>
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#007AFF" />
                <Text style={styles.infoText}>
                  {reportCategory === 'product' && 'Reporting a product listing'}
                  {reportCategory === 'service' && 'Reporting a service listing'}
                  {reportCategory === 'post' && 'Reporting a post'}
                  {reportCategory === 'chat' && 'Reporting inappropriate chat behavior'}
                  {reportCategory === 'user' && 'Reporting a user account'}
                </Text>
              </View>
            </View>

            {/* Report Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Report Type *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowTypePicker(!showTypePicker)}
              >
                <Text style={[styles.pickerText, !reportType && styles.pickerPlaceholder]}>
                  {selectedTypeLabel}
                </Text>
                <Ionicons
                  name={showTypePicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>

              {showTypePicker && (
                <View style={styles.pickerOptionsContainer}>
                  <ScrollView
                    style={styles.pickerOptions}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                  >
                    {REPORT_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.pickerOption,
                          reportType === type.value && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setReportType(type.value);
                          setShowTypePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            reportType === type.value && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {type.label}
                        </Text>
                        {reportType === type.value && (
                          <Ionicons name="checkmark" size={20} color="#007AFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Reason */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reason *</Text>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="Briefly describe why you're reporting this content"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Additional Details (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Provide more details about the report..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            {/* Evidence Upload */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Evidence (Optional)</Text>
              <Text style={styles.subLabel}>Add photos or documents to support your report</Text>
              
              <View style={styles.evidenceButtons}>
                <TouchableOpacity
                  style={styles.evidenceButton}
                  onPress={pickImage}
                >
                  <Ionicons name="image-outline" size={20} color="#007AFF" />
                  <Text style={styles.evidenceButtonText}>Add Photos</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.evidenceButton}
                  onPress={pickDocument}
                >
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                  <Text style={styles.evidenceButtonText}>Add Documents</Text>
                </TouchableOpacity>
              </View>

              {evidence.length > 0 && (
                <View style={styles.evidenceList}>
                  {evidence.map((item, index) => (
                    <View key={index} style={styles.evidenceItem}>
                      {item.type === 'image' ? (
                        <Image source={{ uri: item.uri }} style={styles.evidenceImage} />
                      ) : (
                        <View style={styles.evidenceDocument}>
                          <Ionicons name="document" size={24} color="#666" />
                          <Text style={styles.evidenceName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeEvidenceButton}
                        onPress={() => removeEvidence(index)}
                      >
                        <Ionicons name="close-circle" size={20} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.hint}>
              * Required fields. Your report will be reviewed by our moderation team.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pickerText: {
    fontSize: 16,
    color: '#000',
  },
  pickerPlaceholder: {
    color: '#999',
  },
  pickerOptionsContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
    overflow: 'hidden',
  },
  pickerOptions: {
    flexGrow: 0,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerOptionSelected: {
    backgroundColor: '#F0F8FF',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  evidenceButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  evidenceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  evidenceButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  evidenceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  evidenceItem: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  evidenceDocument: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9F9F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  evidenceName: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  removeEvidenceButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    flex: 1,
  },
});

export default CreateContentReportScreen;

