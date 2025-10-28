import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/userAPI';

interface AccountDeletionModalProps {
  visible: boolean;
  onClose: () => void;
  onAccountDeleted: () => void;
  username: string;
}

const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
  visible,
  onClose,
  onAccountDeleted,
  username,
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [step, setStep] = useState<'warning' | 'confirmation' | 'processing' | 'complete'>('warning');

  const requiredText = 'DELETE';
  const isConfirmationValid = confirmationText === requiredText;

  const handleDeleteAccount = async () => {
    if (!isConfirmationValid) {
      Alert.alert('Invalid Confirmation', 'Please type "DELETE" exactly as shown to confirm account deletion.');
      return;
    }

    try {
      setIsDeleting(true);
      setStep('processing');

      // Call the delete account API
      const result = await userAPI.deleteAccount();
      
      setStep('complete');
      
      // Show success message
      Alert.alert(
        'Account Deleted Successfully',
        'Your account and all associated data have been permanently deleted. You will be logged out automatically.',
        [
          {
            text: 'OK',
            onPress: () => {
              onAccountDeleted();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Account deletion error:', error);
      setStep('confirmation');
      Alert.alert(
        'Deletion Failed',
        error.message || 'Failed to delete account. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmationText('');
    setStep('warning');
    setIsDeleting(false);
    onClose();
  };

  const renderWarningStep = () => (
    <ScrollView style={styles.stepContainer}>
      <View style={styles.warningIcon}>
        <Ionicons name="warning" size={60} color="#FF6B6B" />
      </View>
      
      <Text style={styles.stepTitle}>⚠️ Account Deletion Warning</Text>
      
      <Text style={styles.warningText}>
        You are about to permanently delete your Fretiko account. This action cannot be undone.
      </Text>

      <View style={styles.warningList}>
        <Text style={styles.warningListTitle}>The following data will be permanently deleted:</Text>
        <View style={styles.warningItem}>
          <Ionicons name="person" size={16} color="#FF6B6B" />
          <Text style={styles.warningItemText}>Your profile and personal information</Text>
        </View>
        <View style={styles.warningItem}>
          <Ionicons name="storefront" size={16} color="#FF6B6B" />
          <Text style={styles.warningItemText}>All your products and services</Text>
        </View>
        <View style={styles.warningItem}>
          <Ionicons name="heart" size={16} color="#FF6B6B" />
          <Text style={styles.warningItemText}>Your wishlist and saved items</Text>
        </View>
        <View style={styles.warningItem}>
          <Ionicons name="chatbubbles" size={16} color="#FF6B6B" />
          <Text style={styles.warningItemText}>All chat messages and conversations</Text>
        </View>
        <View style={styles.warningItem}>
          <Ionicons name="people" size={16} color="#FF6B6B" />
          <Text style={styles.warningItemText}>All connections and relationships</Text>
        </View>
        <View style={styles.warningItem}>
          <Ionicons name="card" size={16} color="#FF6B6B" />
          <Text style={styles.warningItemText}>Your wallet and transaction history</Text>
        </View>
        <View style={styles.warningItem}>
          <Ionicons name="receipt" size={16} color="#FF6B6B" />
          <Text style={styles.warningItemText}>All orders and purchase history</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.continueButton} 
          onPress={() => setStep('confirmation')}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderConfirmationStep = () => (
    <ScrollView style={styles.stepContainer}>
      <View style={styles.confirmationIcon}>
        <Ionicons name="shield-checkmark" size={60} color="#FF6B6B" />
      </View>
      
      <Text style={styles.stepTitle}>Final Confirmation</Text>
      
      <Text style={styles.confirmationText}>
        To confirm account deletion, please type <Text style={styles.requiredText}>DELETE</Text> in the box below.
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.confirmationInput,
            confirmationText === requiredText && styles.validInput,
            confirmationText !== '' && confirmationText !== requiredText && styles.invalidInput
          ]}
          value={confirmationText}
          onChangeText={setConfirmationText}
          placeholder="Type DELETE here"
          placeholderTextColor="#666"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {confirmationText === requiredText && (
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" style={styles.validationIcon} />
        )}
        {confirmationText !== '' && confirmationText !== requiredText && (
          <Ionicons name="close-circle" size={24} color="#FF6B6B" style={styles.validationIcon} />
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => setStep('warning')}>
          <Text style={styles.cancelButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.deleteButton,
            !isConfirmationValid && styles.deleteButtonDisabled
          ]}
          onPress={handleDeleteAccount}
          disabled={!isConfirmationValid || isDeleting}
        >
          <Ionicons name="trash" size={20} color="#FFF" />
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderProcessingStep = () => (
    <View style={styles.stepContainer}>
      <ActivityIndicator size="large" color="#FF6B6B" />
      <Text style={styles.stepTitle}>Deleting Account...</Text>
      <Text style={styles.processingText}>
        Please wait while we permanently delete your account and all associated data.
      </Text>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
      <Text style={styles.stepTitle}>Account Deleted</Text>
      <Text style={styles.completeText}>
        Your account has been permanently deleted. You will be logged out automatically.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {step === 'warning' && renderWarningStep()}
          {step === 'confirmation' && renderConfirmationStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'complete' && renderCompleteStep()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  warningIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmationIcon: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  warningText: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  warningList: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  warningListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningItemText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginLeft: 12,
    flex: 1,
  },
  confirmationText: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  requiredText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  confirmationInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFF',
    borderWidth: 2,
    borderColor: '#333',
  },
  validInput: {
    borderColor: '#4CAF50',
  },
  invalidInput: {
    borderColor: '#FF6B6B',
  },
  validationIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  processingText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
  completeText: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#E74C3C',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#666',
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default AccountDeletionModal;
