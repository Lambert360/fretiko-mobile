import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wishlistAPI } from '../services/wishlistAPI';
import { walletAPI } from '../services/walletAPI';

interface MultiStepGiftPurchaseProps {
  visible: boolean;
  onClose: () => void;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productImage: string;
    price: number;
  }>;
  recipientId: string;
  recipientName: string;
  onPurchaseComplete: () => void;
}

type Step = 'validation' | 'confirmation' | 'processing' | 'complete';

const MultiStepGiftPurchase: React.FC<MultiStepGiftPurchaseProps> = ({
  visible,
  onClose,
  items,
  recipientId,
  recipientName,
  onPurchaseComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('validation');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');

  useEffect(() => {
    if (visible) {
      validatePurchase();
      loadWalletBalance();
    }
  }, [visible]);

  const validatePurchase = async () => {
    try {
      setCurrentStep('validation');
      console.log('🎁 Validating items:', items.map(item => ({ id: item.id, productId: item.productId, name: item.productName })));
      const result = await wishlistAPI.validateGiftPurchase(
        items.map(item => ({ wishlistItemId: item.id, quantity: 1 }))
      );
      console.log('✅ Validation result:', result);
      setValidationResult(result);
      
      if (result.valid) {
        setCurrentStep('confirmation');
      } else {
        showValidationErrors(result);
      }
    } catch (error: any) {
      Alert.alert('Validation Failed', error.message);
      onClose();
    }
  };

  const loadWalletBalance = async () => {
    try {
      const wallet = await walletAPI.getWallet();
      setWalletBalance(wallet.availableBalance);
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  };

  const showValidationErrors = (result: any) => {
    const invalidItems = result.validationResults.filter((r: any) => !r.valid);
    const errorMessages = invalidItems.map((item: any) => `• ${item.reason}`).join('\n');
    
    Alert.alert(
      'Some Items Cannot Be Gifted',
      `We found issues with ${result.summary.invalidItems} item(s):\n\n${errorMessages}\n\nYou can still proceed with the ${result.summary.validItems} available items.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: onClose },
        { text: 'Continue with Available Items', onPress: () => setCurrentStep('confirmation') }
      ]
    );
  };

  const handlePurchase = async () => {
    try {
      setProcessing(true);
      setCurrentStep('processing');

      // 🔥 FIX: Use wishlistItemId from validation result, not product.id
      const validItems = validationResult.availableItems;
      const results = await Promise.all(
        validItems.map((item: any) => {
          if (!item.wishlistItemId) {
            // Fallback: find original item by product ID if wishlistItemId missing
            const originalItem = items.find(orig => orig.productId === item.id);
            if (!originalItem) {
              throw new Error(`Cannot find wishlist item for product ${item.id}`);
            }
            return wishlistAPI.createGiftOrder({
              giftRecipientId: recipientId,
              orderId: null,
              wishlistItemId: originalItem.id, // Use original wishlist item ID
              giftMessage: giftMessage.trim() || undefined,
              isSurprise: false,
            });
          }
          return wishlistAPI.createGiftOrder({
            giftRecipientId: recipientId,
            orderId: null,
            wishlistItemId: item.wishlistItemId, // 🔥 FIX: Use wishlistItemId from validation result
            giftMessage: giftMessage.trim() || undefined,
            isSurprise: false,
          });
        })
      );

      setCurrentStep('complete');
      
      // Extract order numbers for display
      const orderNumbers = results.map((r: any) => r.orderNumber).filter(Boolean).join(', ');
      const orderNumbersText = orderNumbers ? `\n\nOrder${results.length > 1 ? 's' : ''}: ${orderNumbers}` : '';
      
      Alert.alert(
        'Gift Purchase Successful! 🎉',
        `Your gift${validItems.length > 1 ? 's' : ''} for ${recipientName} ${validItems.length > 1 ? 'have' : 'has'} been ordered! They will be notified and can track the delivery.${orderNumbersText}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onPurchaseComplete();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Purchase Failed', error.message || 'Failed to process gift purchase');
      setCurrentStep('confirmation');
    } finally {
      setProcessing(false);
    }
  };

  const renderValidationStep = () => (
    <View style={styles.stepContainer}>
      <ActivityIndicator size="large" color="#E91E63" />
      <Text style={styles.stepTitle}>Validating Gift Items</Text>
      <Text style={styles.stepDescription}>
        Checking availability and permissions...
      </Text>
    </View>
  );

  const renderConfirmationStep = () => (
    <ScrollView contentContainerStyle={styles.stepContainer}>
      <Text style={styles.stepTitle}>Confirm Your Gift Purchase</Text>
      <Text style={styles.stepDescription}>
        Review your gift items and proceed with the purchase.
      </Text>

      {/* Gift Items */}
      <View style={styles.itemsContainer}>
        {validationResult?.availableItems?.map((item: any, index: number) => (
          <View key={index} style={styles.itemCard}>
            <Image source={{ uri: item.productImage }} style={styles.itemImage} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{walletAPI.formatFreti(item.price)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Total Price */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Gift Cost</Text>
        <Text style={styles.totalPrice}>
          {walletAPI.formatFreti(validationResult?.totalPrice || 0)}
        </Text>
      </View>

      {/* Wallet Balance Check */}
      {walletBalance < (validationResult?.totalPrice || 0) && (
        <View style={styles.insufficientFunds}>
          <Ionicons name="warning" size={20} color="#FF6B6B" />
          <Text style={styles.insufficientFundsText}>
            Insufficient wallet balance. Please add funds to your wallet.
          </Text>
        </View>
      )}

      {/* Gift Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageLabel}>Gift Message (Optional)</Text>
        <TextInput
          style={styles.messageInput}
          placeholder="Add a personal message..."
          value={giftMessage}
          onChangeText={setGiftMessage}
          multiline
          maxLength={200}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.purchaseButton,
            (walletBalance < (validationResult?.totalPrice || 0) || processing) && styles.buttonDisabled
          ]}
          onPress={handlePurchase}
          disabled={walletBalance < (validationResult?.totalPrice || 0) || processing}
        >
          <Ionicons name="gift" size={18} color="#FFF" />
          <Text style={styles.purchaseButtonText}>Send Gift</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderProcessingStep = () => (
    <View style={styles.stepContainer}>
      <ActivityIndicator size="large" color="#E91E63" />
      <Text style={styles.stepTitle}>Processing Your Gift</Text>
      <Text style={styles.stepDescription}>
        Creating gift orders and notifying the recipient...
      </Text>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
      <Text style={styles.stepTitle}>Gift Purchase Complete!</Text>
      <Text style={styles.stepDescription}>
        Your gift has been successfully sent to {recipientName}.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎁 Send Gift</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {currentStep === 'validation' && renderValidationStep()}
          {currentStep === 'confirmation' && renderConfirmationStep()}
          {currentStep === 'processing' && renderProcessingStep()}
          {currentStep === 'complete' && renderCompleteStep()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 10,
    textAlign: 'center',
  },
  itemsContainer: {
    width: '100%',
    marginTop: 20,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  itemPrice: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginTop: 20,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  insufficientFunds: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B20',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  insufficientFundsText: {
    color: '#FF6B6B',
    marginLeft: 8,
    fontSize: 12,
  },
  messageContainer: {
    marginTop: 20,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  messageInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: '#E91E63',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MultiStepGiftPurchase;
