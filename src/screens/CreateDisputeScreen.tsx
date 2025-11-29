import { Ionicons } from '@expo/vector-icons';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { disputesAPI, CreateDisputeRequest } from '../services/disputesAPI';
import { ordersAPI } from '../services/ordersAPI';

const DISPUTE_TYPES = [
  { value: 'item_not_received', label: 'Item Not Received' },
  { value: 'item_not_as_described', label: 'Item Not As Described' },
  { value: 'damaged_item', label: 'Damaged Item' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'refund_request', label: 'Refund Request' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'other', label: 'Other' },
] as const;

const CreateDisputeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { orderId } = (route.params as { orderId?: string }) || {};

  const [orderNumber, setOrderNumber] = useState<string>('');
  const [disputeType, setDisputeType] = useState<string>('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  React.useEffect(() => {
    if (orderId) {
      loadOrderInfo();
    }
  }, [orderId]);

  const loadOrderInfo = async () => {
    try {
      const order = await ordersAPI.getOrderDetails(orderId!);
      setOrderNumber(order.orderNumber);
    } catch (error) {
      console.error('Error loading order:', error);
    }
  };

  const handleSubmit = async () => {
    if (!orderId && !orderNumber.trim()) {
      Alert.alert('Error', 'Please select an order');
      return;
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

      // If orderId is provided, use it; otherwise, we'd need to look up by order number
      const finalOrderId = orderId || orderNumber;

      const request: CreateDisputeRequest = {
        orderId: finalOrderId,
        disputeType: disputeType as any,
        reason: reason.trim(),
        description: description.trim() || undefined,
        priority: 'medium',
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
          <Text style={styles.headerTitle}>File Dispute</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {/* Order Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Order</Text>
              {orderId ? (
                <View style={styles.orderDisplay}>
                  <Ionicons name="receipt-outline" size={20} color="#666" />
                  <Text style={styles.orderText}>Order #{orderNumber || 'Loading...'}</Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={orderNumber}
                  onChangeText={setOrderNumber}
                  placeholder="Enter order number"
                  placeholderTextColor="#999"
                />
              )}
            </View>

            {/* Dispute Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Dispute Type *</Text>
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

            <Text style={styles.hint}>
              * Required fields. Your dispute will be reviewed by our customer care team.
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
              <Text style={styles.submitButtonText}>Submit Dispute</Text>
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
});

export default CreateDisputeScreen;

