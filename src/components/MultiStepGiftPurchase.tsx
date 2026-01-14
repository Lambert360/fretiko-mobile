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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wishlistAPI } from '../services/wishlistAPI';
import { walletAPI } from '../services/walletAPI';

interface Rider {
  id: string;
  name: string;
  price: number;
  vehicleType: string;
  rating: number;
  distanceFromPickup: number;
  estimatedArrival: number;
}

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
  navigation?: any; // Optional navigation for rider selection
}

type Step = 'validation' | 'confirmation' | 'processing' | 'complete';

const MultiStepGiftPurchase: React.FC<MultiStepGiftPurchaseProps> = ({
  visible,
  onClose,
  items,
  recipientId,
  recipientName,
  onPurchaseComplete,
  navigation,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('validation');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [selectedRider, setSelectedRider] = useState<Rider | 'pickup' | null>('pickup'); // Default to self-pickup

  useEffect(() => {
    if (visible) {
      validatePurchase();
      loadWalletBalance();
      // Reset rider selection when modal opens
      setSelectedRider('pickup');
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
    // Validate delivery address
    if (!deliveryAddress.fullName || !deliveryAddress.address || 
        !deliveryAddress.phone || !deliveryAddress.city || 
        !deliveryAddress.state) {
      Alert.alert(
        'Delivery Address Required',
        'Please provide the recipient\'s delivery address including full name, phone, address, city, and state.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setProcessing(true);
      setCurrentStep('processing');

      // 🔥 FIX: Use wishlistItemId from validation result, not product.id
      const validItems = validationResult.availableItems;
      const results = await Promise.all(
        validItems.map((item: any) => {
          const addressData = {
            fullName: deliveryAddress.fullName,
            phone: deliveryAddress.phone,
            address: deliveryAddress.address,
            city: deliveryAddress.city,
            state: deliveryAddress.state,
            postalCode: deliveryAddress.postalCode || '',
          };

          const riderInfo = selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object'
            ? {
                riderId: selectedRider.id,
                riderName: selectedRider.name,
                vehicleType: selectedRider.vehicleType,
                deliveryPrice: selectedRider.price,
                estimatedArrival: selectedRider.estimatedArrival,
              }
            : selectedRider === 'pickup'
            ? { riderId: 'pickup' }
            : undefined;

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
              deliveryAddress: addressData,
              selectedRider: riderInfo,
            });
          }
          return wishlistAPI.createGiftOrder({
            giftRecipientId: recipientId,
            orderId: null,
            wishlistItemId: item.wishlistItemId, // 🔥 FIX: Use wishlistItemId from validation result
            giftMessage: giftMessage.trim() || undefined,
            isSurprise: false,
            deliveryAddress: addressData,
            selectedRider: riderInfo,
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
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.stepContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
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

      {/* Delivery Option */}
      <View style={styles.deliveryContainer}>
        <Text style={styles.deliveryLabel}>Delivery Option *</Text>
        <Text style={styles.deliverySubtitle}>
          Choose how the gift will be delivered
        </Text>
        
        <View style={styles.deliveryOptions}>
          <TouchableOpacity
            style={[
              styles.deliveryOptionCard,
              selectedRider === 'pickup' && styles.deliveryOptionCardSelected
            ]}
            onPress={() => setSelectedRider('pickup')}
          >
            <View style={styles.deliveryOptionIcon}>
              <Ionicons name="walk" size={24} color={selectedRider === 'pickup' ? "#3498DB" : "#666"} />
            </View>
            <View style={styles.deliveryOptionInfo}>
              <Text style={[
                styles.deliveryOptionTitle,
                selectedRider === 'pickup' && styles.deliveryOptionTitleSelected
              ]}>
                Self Pickup
              </Text>
              <Text style={styles.deliveryOptionSubtitle}>Pick up from vendor (Free)</Text>
            </View>
            {selectedRider === 'pickup' && (
              <Ionicons name="checkmark-circle" size={24} color="#3498DB" />
            )}
          </TouchableOpacity>

          {navigation ? (
            <TouchableOpacity
              style={[
                styles.deliveryOptionCard,
                selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' && styles.deliveryOptionCardSelected
              ]}
              onPress={() => {
                if (!deliveryAddress.address || !deliveryAddress.city) {
                  Alert.alert(
                    'Address Required',
                    'Please provide delivery address (street and city) before selecting a rider.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                // Navigate to rider selection
                navigation.navigate('RiderSelection', {
                  pickupLocation: {
                    latitude: 6.5244, // TODO: Get vendor location from product
                    longitude: 3.3792,
                    address: 'Vendor Location',
                  },
                  deliveryLocation: {
                    latitude: 6.5244, // TODO: Geocode delivery address
                    longitude: 3.3792,
                    address: `${deliveryAddress.address}, ${deliveryAddress.city}`,
                  },
                  orderDetails: {
                    weight: validationResult?.availableItems?.length * 0.5 || 1,
                    itemCount: validationResult?.availableItems?.length || 1,
                    distance: 5, // TODO: Calculate actual distance
                  },
                  onRiderSelected: (rider: Rider) => {
                    setSelectedRider(rider);
                  },
                });
              }}
            >
              <View style={styles.deliveryOptionIcon}>
                <Ionicons 
                  name="bicycle" 
                  size={24} 
                  color={selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' ? "#3498DB" : "#666"} 
                />
              </View>
              <View style={styles.deliveryOptionInfo}>
                <Text style={[
                  styles.deliveryOptionTitle,
                  selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' && styles.deliveryOptionTitleSelected
                ]}>
                  {selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object'
                    ? selectedRider.name
                    : 'Select Delivery Rider'
                  }
                </Text>
                <Text style={styles.deliveryOptionSubtitle}>
                  {selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object'
                    ? `${selectedRider.vehicleType} • ${walletAPI.formatFreti(selectedRider.price)} • ${selectedRider.estimatedArrival} min`
                    : 'Choose a delivery rider'
                  }
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ) : (
            <View style={styles.deliveryOptionCard}>
              <View style={styles.deliveryOptionIcon}>
                <Ionicons name="information-circle" size={24} color="#999" />
              </View>
              <View style={styles.deliveryOptionInfo}>
                <Text style={styles.deliveryOptionTitle}>Delivery Rider</Text>
                <Text style={styles.deliveryOptionSubtitle}>
                  Delivery will be arranged after order confirmation
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Total Price */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Item Total</Text>
        <Text style={styles.totalPrice}>
          {walletAPI.formatFreti(validationResult?.totalPrice || 0)}
        </Text>
      </View>

      {selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' && (
        <View style={styles.deliveryFeeContainer}>
          <Text style={styles.deliveryFeeLabel}>Delivery Fee</Text>
          <Text style={styles.deliveryFeePrice}>
            {walletAPI.formatFreti(selectedRider.price)}
          </Text>
        </View>
      )}

      <View style={styles.finalTotalContainer}>
        <Text style={styles.finalTotalLabel}>Total Gift Cost</Text>
        <Text style={styles.finalTotalPrice}>
          {walletAPI.formatFreti(
            (validationResult?.totalPrice || 0) + 
            (selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' ? selectedRider.price : 0)
          )}
        </Text>
      </View>

      {/* Wallet Balance Check */}
      {walletBalance < ((validationResult?.totalPrice || 0) + (selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' ? selectedRider.price : 0)) && (
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

      {/* Delivery Address */}
      <View style={styles.addressContainer}>
        <Text style={styles.addressLabel}>Delivery Address *</Text>
        <Text style={styles.addressSubtitle}>
          Please provide {recipientName}'s delivery address where the gift should be sent
        </Text>
        
        <TextInput
          style={styles.addressInput}
          placeholder="Full Name *"
          placeholderTextColor="#666"
          value={deliveryAddress.fullName}
          onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, fullName: text })}
        />
        
        <TextInput
          style={styles.addressInput}
          placeholder="Phone Number *"
          placeholderTextColor="#666"
          value={deliveryAddress.phone}
          onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, phone: text })}
          keyboardType="phone-pad"
        />
        
        <TextInput
          style={[styles.addressInput, styles.addressInputLarge]}
          placeholder="Street Address *"
          placeholderTextColor="#666"
          value={deliveryAddress.address}
          onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, address: text })}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
        
        <View style={styles.addressRow}>
          <TextInput
            style={[styles.addressInput, styles.addressInputHalf]}
            placeholder="City *"
            placeholderTextColor="#666"
            value={deliveryAddress.city}
            onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, city: text })}
          />
          <TextInput
            style={[styles.addressInput, styles.addressInputHalf]}
            placeholder="State *"
            placeholderTextColor="#666"
            value={deliveryAddress.state}
            onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, state: text })}
          />
        </View>
        
        <TextInput
          style={styles.addressInput}
          placeholder="Postal Code (Optional)"
          placeholderTextColor="#666"
          value={deliveryAddress.postalCode}
          onChangeText={(text) => setDeliveryAddress({ ...deliveryAddress, postalCode: text })}
          keyboardType="numeric"
        />

        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={16} color="#3498DB" />
          <Text style={styles.privacyText}>
            This address will only be used for delivery and will not be shared with the recipient
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.purchaseButton,
            (walletBalance < ((validationResult?.totalPrice || 0) + (selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' ? selectedRider.price : 0)) || processing) && styles.buttonDisabled
          ]}
          onPress={handlePurchase}
          disabled={walletBalance < ((validationResult?.totalPrice || 0) + (selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' ? selectedRider.price : 0)) || processing}
        >
          <Ionicons name="gift" size={18} color="#FFF" />
          <Text style={styles.purchaseButtonText}>Send Gift</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
    paddingBottom: 40,
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
  addressContainer: {
    marginTop: 20,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  addressSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  addressInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  addressInputLarge: {
    minHeight: 60,
    paddingTop: 12,
  },
  addressInputHalf: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  privacyText: {
    color: '#3498DB',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  deliveryContainer: {
    marginTop: 20,
  },
  deliveryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  deliverySubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  deliveryOptions: {
    gap: 12,
  },
  deliveryOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deliveryOptionCardSelected: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: '#3498DB',
  },
  deliveryOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deliveryOptionInfo: {
    flex: 1,
  },
  deliveryOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCC',
    marginBottom: 4,
  },
  deliveryOptionTitleSelected: {
    color: '#FFF',
  },
  deliveryOptionSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  deliveryFeeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginTop: 12,
  },
  deliveryFeeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CCC',
  },
  deliveryFeePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498DB',
  },
  finalTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  finalTotalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});

export default MultiStepGiftPurchase;
