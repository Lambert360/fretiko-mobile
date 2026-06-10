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
import { disputesAPI, CreateDisputeRequest } from '../services/disputesAPI';
import { ordersAPI } from '../services/ordersAPI';
import { userAPI } from '../services/userAPI';

// Dispute types by category
const ORDER_DISPUTE_TYPES = [
  { value: 'item_not_received', label: 'Item Not Received' },
  { value: 'item_not_as_described', label: 'Item Not As Described' },
  { value: 'damaged_item', label: 'Damaged Item' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'refund_request', label: 'Refund Request' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'other', label: 'Other' },
] as const;

const BUG_REPORT_TYPES = [
  { value: 'app_crash', label: 'App Crash' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'login_issue', label: 'Login Issue' },
  { value: 'feature_not_working', label: 'Feature Not Working' },
  { value: 'performance_issue', label: 'Performance Issue' },
  { value: 'other', label: 'Other' },
] as const;


const GENERAL_TYPES = [
  { value: 'other', label: 'General Support Request' },
] as const;

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: '#27AE60' },
  { value: 'medium', label: 'Medium', color: '#F39C12' },
  { value: 'high', label: 'High', color: '#E67E22' },
  { value: 'urgent', label: 'Urgent', color: '#E74C3C' },
] as const;

interface EvidenceItem {
  uri: string;
  type: 'image' | 'document';
  name: string;
  uploadedUrl?: string;
  uploading?: boolean;
}

const CreateDisputeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const params = (route.params as { 
    orderId?: string;
    disputeCategory?: 'order_dispute' | 'bug_report' | 'general';
  }) || {};

  // Determine dispute category from params or default to general
  const disputeCategory = params.disputeCategory || 
    (params.orderId ? 'order_dispute' : 'general');

  // Get dispute types based on category
  const getDisputeTypes = () => {
    switch (disputeCategory) {
      case 'order_dispute': return ORDER_DISPUTE_TYPES;
      case 'bug_report': return BUG_REPORT_TYPES;
      default: return GENERAL_TYPES;
    }
  };

  const DISPUTE_TYPES = getDisputeTypes();

  const [orderNumber, setOrderNumber] = useState<string>('');
  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(params.orderId || null);
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [disputeType, setDisputeType] = useState<string>('');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  React.useEffect(() => {
    if (params.orderId) {
      loadOrderInfo();
    }
  }, [params.orderId]);

  const loadOrderInfo = async () => {
    try {
      const order = await ordersAPI.getOrderDetails(params.orderId!);
      setOrderNumber(order.orderNumber);
      setResolvedOrderId(order.id);
    } catch (error) {
      console.error('Error loading order:', error);
    }
  };

  const searchOrderByNumber = async () => {
    if (!orderNumber.trim()) {
      Alert.alert('Error', 'Please enter an order number');
      return;
    }

    try {
      setIsSearchingOrder(true);
      const orders = await ordersAPI.searchOrders(orderNumber.trim());
      
      if (orders.length === 0) {
        Alert.alert('Not Found', `No order found with number: ${orderNumber}`);
        setResolvedOrderId(null);
        return;
      }

      // If multiple orders found, use the first one (most recent)
      const foundOrder = orders[0];
      setResolvedOrderId(foundOrder.id);
      setOrderNumber(foundOrder.orderNumber);
      Alert.alert('Success', `Order found: ${foundOrder.orderNumber}`);
    } catch (error: any) {
      console.error('Error searching order:', error);
      Alert.alert('Error', error.message || 'Failed to search for order');
      setResolvedOrderId(null);
    } finally {
      setIsSearchingOrder(false);
    }
  };

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
    // Validation based on category
    if (disputeCategory === 'order_dispute') {
      const finalOrderId = params.orderId || resolvedOrderId;
      if (!finalOrderId) {
        Alert.alert('Error', 'Please select or search for an order');
        return;
      }
    }

    if (!disputeType) {
      Alert.alert('Error', 'Please select a dispute type');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the dispute');
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

            const uploadedUrl = await userAPI.uploadEvidence(item.uri, item.name, mimeType);
            uploadedEvidence.push({
              type: item.type,
              url: uploadedUrl,
              description: item.name,
            });
          } catch (uploadError) {
            console.error(`Error uploading evidence ${item.name}:`, uploadError);
            // Continue with other files
          }
        }
      }

      const request: CreateDisputeRequest = {
        disputeCategory: disputeCategory,
        disputeType: disputeType as any,
        reason: reason.trim(),
        description: description.trim() || undefined,
        priority: priority,
        evidence: uploadedEvidence.length > 0 ? uploadedEvidence : undefined,
        // Add optional fields based on category
        ...(disputeCategory === 'order_dispute' && { orderId: params.orderId || resolvedOrderId || undefined }),
      };

      const dispute = await disputesAPI.createDispute(request);

      Alert.alert(
        'Success',
        'Dispute created successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
              // Navigate to dispute details
              setTimeout(() => {
                (navigation as any).navigate('DisputeDetails', { disputeId: dispute.id });
              }, 100);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating dispute:', error);
      Alert.alert('Error', error.message || 'Failed to create dispute');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeLabel = DISPUTE_TYPES.find((t) => t.value === disputeType)?.label || 'Select Dispute Type';

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
          <Text style={styles.headerTitle}>
            {disputeCategory === 'bug_report' ? 'Report Bug' :
             disputeCategory === 'general' ? 'Contact Support' :
             'File Dispute'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {/* Category-specific fields */}
            {disputeCategory === 'order_dispute' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Order *</Text>
                {params.orderId || resolvedOrderId ? (
                <View style={styles.orderDisplay}>
                  <Ionicons name="receipt-outline" size={20} color="#666" />
                  <Text style={styles.orderText}>Order #{orderNumber || 'Loading...'}</Text>
                  {!params.orderId && (
                    <TouchableOpacity
                      onPress={() => {
                        setResolvedOrderId(null);
                        setOrderNumber('');
                      }}
                      style={styles.clearButton}
                    >
                      <Ionicons name="close-circle" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View>
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={[styles.input, styles.searchInput]}
                      value={orderNumber}
                      onChangeText={setOrderNumber}
                      placeholder="Enter order number (e.g., ORD-2025-0123)"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.searchButton, isSearchingOrder && styles.searchButtonDisabled]}
                      onPress={searchOrderByNumber}
                      disabled={isSearchingOrder || !orderNumber.trim()}
                    >
                      {isSearchingOrder ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="search" size={20} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                  {isSearchingOrder && (
                    <Text style={styles.searchingText}>Searching for order...</Text>
                  )}
                </View>
              )}
              </View>
            )}


            {disputeCategory === 'bug_report' && (
              <View style={styles.inputGroup}>
                <View style={styles.infoCard}>
                  <Ionicons name="bug" size={20} color="#E74C3C" />
                  <Text style={styles.infoText}>
                    Help us improve by reporting bugs and issues
                  </Text>
                </View>
              </View>
            )}

            {disputeCategory === 'general' && (
              <View style={styles.inputGroup}>
                <View style={styles.infoCard}>
                  <Ionicons name="help-circle" size={20} color="#F39C12" />
                  <Text style={styles.infoText}>
                    General support request
                  </Text>
                </View>
              </View>
            )}

            {/* Dispute Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {disputeCategory === 'bug_report' ? 'Issue Type *' :
                 'Dispute Type *'}
              </Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowTypePicker(!showTypePicker)}
              >
                <Text style={[styles.pickerText, !disputeType && styles.pickerPlaceholder]}>
                  {selectedTypeLabel}
                </Text>
                <Ionicons
                  name={showTypePicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>

              {showTypePicker && (
                <View style={styles.pickerOptions}>
                  {DISPUTE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.pickerOption,
                        disputeType === type.value && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setDisputeType(type.value);
                        setShowTypePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          disputeType === type.value && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                      {disputeType === type.value && (
                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  ))}
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
                placeholder="Briefly describe the issue"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Priority */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Priority *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPriorityPicker(!showPriorityPicker)}
              >
                <View style={styles.priorityContent}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_LEVELS.find(p => p.value === priority)?.color || '#999' }]} />
                  <Text style={styles.pickerText}>
                    {PRIORITY_LEVELS.find(p => p.value === priority)?.label || 'Select Priority'}
                  </Text>
                </View>
                <Ionicons
                  name={showPriorityPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>

              {showPriorityPicker && (
                <View style={styles.pickerOptions}>
                  {PRIORITY_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level.value}
                      style={[
                        styles.pickerOption,
                        priority === level.value && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setPriority(level.value);
                        setShowPriorityPicker(false);
                      }}
                    >
                      <View style={styles.priorityContent}>
                        <View style={[styles.priorityDot, { backgroundColor: level.color }]} />
                        <Text
                          style={[
                            styles.pickerOptionText,
                            priority === level.value && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {level.label}
                        </Text>
                      </View>
                      {priority === level.value && (
                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Additional Details (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Provide more details about the dispute..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            {/* Evidence Upload */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Evidence (Optional)</Text>
              <Text style={styles.subLabel}>Add photos or documents to support your dispute</Text>
              
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
              * Required fields. Your {disputeCategory === 'bug_report' ? 'bug report' :
                                     'request'} will be reviewed by our customer care team.
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
              <Text style={styles.submitButtonText}>
                {disputeCategory === 'bug_report' ? 'Submit Bug Report' :
                 disputeCategory === 'general' ? 'Submit Request' :
                 'Submit Dispute'}
              </Text>
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
  orderDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  orderText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
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
  pickerOptions: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
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
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  priorityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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

export default CreateDisputeScreen;

