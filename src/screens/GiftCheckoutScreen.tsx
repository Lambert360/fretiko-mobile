import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { wishlistAPI, WishlistItem } from '../services/wishlistAPI';
import { walletAPI } from '../services/walletAPI';
import { riderAPI, Rider } from '../services/riderAPI';

interface GiftCheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      wishlistItem?: WishlistItem; // Single item (legacy support)
      wishlistItems?: WishlistItem[]; // Multiple items (new)
      recipientId: string;
      recipientName: string;
      totalPrice?: number; // Pre-calculated total for multiple items
    };
  };
}

const GiftCheckoutScreen: React.FC<GiftCheckoutScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { wishlistItem, wishlistItems, recipientId, recipientName, totalPrice } = route.params;

  // Support both single item and multiple items
  const items = wishlistItems || (wishlistItem ? [wishlistItem] : []);

  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [giftMessage, setGiftMessage] = useState('');
  const [canPurchase, setCanPurchase] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | 'pickup' | null>('pickup'); // Default to self-pickup
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });

  useEffect(() => {
    loadGiftCheckoutData();
  }, []);

  const loadGiftCheckoutData = async () => {
    try {
      setLoading(true);

      if (items.length === 0) {
        Alert.alert('No Items', 'No items to purchase', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      // Check if user can purchase items as gifts (check first item for now)
      const purchaseCheck = await wishlistAPI.canPurchaseAsGift(items[0].id);

      if (!purchaseCheck.canPurchase) {
        Alert.alert('Cannot Purchase', purchaseCheck.reason || 'These items cannot be purchased as gifts', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }

      setCanPurchase(true);

      // Load wallet balance
      const wallet = await walletAPI.getWallet();
      setWalletBalance(wallet.availableBalance);
    } catch (error) {
      console.error('Error loading gift checkout data:', error);
      Alert.alert('Error', 'Failed to load gift checkout information');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    // 🔥 FIX: Gift purchases - buyer pays item price + delivery fee (if rider selected)
    // Platform fee is deducted from vendor during escrow release, not from buyer
    const itemTotal = items.reduce((sum, item) => sum + item.price, 0);
    const deliveryFee = selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object'
      ? selectedRider.price
      : 0;
    return itemTotal + deliveryFee;
  };

  const handleSelectRider = () => {
    // Validate address is filled before allowing rider selection
    if (!deliveryAddress.address || !deliveryAddress.city) {
      Alert.alert(
        'Address Required',
        'Please provide delivery address (street and city) before selecting a rider.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to rider selection screen
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
        weight: items.length * 0.5, // Estimate 0.5kg per item
        itemCount: items.length,
        distance: 5, // TODO: Calculate actual distance
      },
      onRiderSelected: (rider: Rider) => {
        setSelectedRider(rider);
      },
    });
  };

  const handlePlaceGiftOrder = () => {
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

    const total = calculateTotal();

    if (walletBalance < total) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${walletAPI.formatFreti(total - walletBalance)} more to complete this purchase. Would you like to add funds to your wallet?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Funds',
            onPress: () => navigation.navigate('Wallet'),
          },
        ]
      );
      return;
    }

    const itemDescription = items.length === 1
      ? items[0].productName
      : `${items.length} items`;

    const deliveryOption = selectedRider === 'pickup'
      ? 'Self Pickup (Free)'
      : selectedRider && typeof selectedRider === 'object'
      ? `${selectedRider.name} (${walletAPI.formatFreti(selectedRider.price)})`
      : 'Not Selected (Delivery will be arranged later)';

    Alert.alert(
      'Confirm Gift Purchase',
      `You're buying ${itemDescription} as a gift for ${recipientName}.\n\nDelivery Address:\n${deliveryAddress.fullName}\n${deliveryAddress.address}\n${deliveryAddress.city}, ${deliveryAddress.state}\n\nDelivery: ${deliveryOption}\n\nTotal: ${walletAPI.formatFreti(total)}\n\nThe items will be delivered to the address you provided, and ${recipientName} will be notified of your gift.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Purchase', onPress: processGiftOrder },
      ]
    );
  };

  const processGiftOrder = async () => {
    try {
      setProcessingOrder(true);

      // Process each item as a gift order
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

      const results = await Promise.all(
        items.map(item =>
          wishlistAPI.createGiftOrder({
            giftRecipientId: recipientId,
            orderId: null, // Backend will create the order automatically
            wishlistItemId: item.id,
            giftMessage: giftMessage.trim() || undefined,
            isSurprise: false, // Based on user requirements
            deliveryAddress: {
              fullName: deliveryAddress.fullName,
              phone: deliveryAddress.phone,
              address: deliveryAddress.address,
              city: deliveryAddress.city,
              state: deliveryAddress.state,
              postalCode: deliveryAddress.postalCode || '',
            },
            selectedRider: riderInfo,
          })
        )
      );

      const orderNumbers = results.map(r => r.orderNumber).join(', ');

      Alert.alert(
        'Gift Purchase Successful!',
        `Your gift${items.length > 1 ? 's' : ''} for ${recipientName} ${items.length > 1 ? 'have' : 'has'} been ordered! They will be notified and can track the delivery.\n\nOrder${items.length > 1 ? 's' : ''}: ${orderNumbers}`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error processing gift order:', error);
      Alert.alert(
        'Purchase Failed',
        error.response?.data?.message || error.message || 'Failed to process gift purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingOrder(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E91E63" />
        <Text style={styles.loadingText}>Loading gift checkout...</Text>
      </View>
    );
  }

  if (!canPurchase) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="close-circle" size={64} color="#E74C3C" />
        <Text style={styles.errorText}>This item cannot be purchased as a gift</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = calculateTotal();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gift Checkout</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 + (insets.bottom || 0) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Gift Recipient Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sending Gift To</Text>
          <View style={styles.recipientCard}>
            <View style={styles.recipientIcon}>
              <Ionicons name="person-circle" size={48} color="#E91E63" />
            </View>
            <View style={styles.recipientInfo}>
              <Text style={styles.recipientName}>{recipientName}</Text>
              <Text style={styles.recipientLabel}>Will receive this gift</Text>
            </View>
          </View>
        </View>

        {/* Gift Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Gift {items.length > 1 ? `Items (${items.length})` : 'Item'}
          </Text>
          {items.map((item, index) => (
            <View key={item.id} style={[styles.itemCard, index > 0 && { marginTop: 12 }]}>
              <Image source={{ uri: item.productImage }} style={styles.productImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.productName}>{item.productName}</Text>
                <Text style={styles.productPrice}>{walletAPI.formatFreti(item.price)}</Text>
                {item.sellerName && (
                  <Text style={styles.sellerName}>Sold by {item.sellerName}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Gift Message Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gift Message (Optional)</Text>
          <TextInput
            style={styles.messageInput}
            value={giftMessage}
            onChangeText={setGiftMessage}
            placeholder={`Write a personal message for ${recipientName}...`}
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={200}
          />
          <Text style={styles.charCount}>{giftMessage.length}/200</Text>
        </View>

        {/* Delivery Address Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.sectionSubtitle}>
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

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="lock-closed" size={16} color="#3498DB" />
              <Text style={styles.privacyText}>
                This address will only be used for delivery and will not be shared with the recipient
              </Text>
            </View>
          </View>
        </View>

        {/* Rider Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Option (Optional)</Text>
          <Text style={styles.sectionSubtitle}>
            Select a rider for delivery or choose self-pickup. You can skip this and arrange delivery later.
          </Text>

          {selectedRider === 'pickup' ? (
            <View style={styles.selectedRiderCard}>
              <View style={styles.selectedRiderInfo}>
                <View style={styles.selectedRiderAvatar}>
                  <Ionicons name="walk" size={24} color="#3498DB" />
                </View>
                <View style={styles.selectedRiderDetails}>
                  <Text style={styles.selectedRiderName}>Self Pickup</Text>
                  <Text style={styles.selectedRiderDistance}>
                    Pick up the order directly from the vendor (Free)
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.changeRiderButton}
                onPress={handleSelectRider}
              >
                <Text style={styles.changeRiderText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : selectedRider && typeof selectedRider === 'object' ? (
            <View style={styles.selectedRiderCard}>
              <View style={styles.selectedRiderInfo}>
                <View style={styles.selectedRiderAvatar}>
                  <Text style={styles.selectedRiderInitial}>
                    {selectedRider.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.selectedRiderDetails}>
                  <Text style={styles.selectedRiderName}>{selectedRider.name}</Text>
                  <View style={styles.selectedRiderStats}>
                    <Ionicons name="star" size={12} color="#F39C12" />
                    <Text style={styles.selectedRiderRating}>{selectedRider.rating}</Text>
                    <Text style={styles.selectedRiderVehicle}>
                      • {selectedRider.vehicleType.charAt(0).toUpperCase() + selectedRider.vehicleType.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.selectedRiderDistance}>
                    {selectedRider.distanceFromPickup.toFixed(1)}km away • {selectedRider.estimatedArrival} min arrival
                  </Text>
                </View>
              </View>
              <View style={styles.selectedRiderPrice}>
                <Text style={styles.selectedRiderPriceText}>
                  {walletAPI.formatFreti(selectedRider.price)}
                </Text>
                <TouchableOpacity
                  style={styles.changeRiderButton}
                  onPress={handleSelectRider}
                >
                  <Text style={styles.changeRiderText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.deliveryOptions}>
              <TouchableOpacity style={styles.selectRiderCard} onPress={handleSelectRider}>
                <View style={styles.selectRiderIcon}>
                  <Ionicons name="person-add" size={24} color="#3498DB" />
                </View>
                <View style={styles.selectRiderText}>
                  <Text style={styles.selectRiderTitle}>Select a Rider</Text>
                  <Text style={styles.selectRiderSubtitle}>
                    Choose a delivery rider or select self-pickup
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.selectRiderCard, styles.pickupOption]} 
                onPress={() => setSelectedRider('pickup')}
              >
                <View style={styles.selectRiderIcon}>
                  <Ionicons name="walk" size={24} color="#3498DB" />
                </View>
                <View style={styles.selectRiderText}>
                  <Text style={styles.selectRiderTitle}>Self Pickup (Free)</Text>
                  <Text style={styles.selectRiderSubtitle}>
                    Pick up directly from the vendor
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Method Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentCard}>
            <View style={styles.paymentIcon}>
              <Ionicons name="wallet" size={24} color="#3498DB" />
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Freti Wallet</Text>
              <Text style={styles.paymentBalance}>
                Balance: {walletAPI.formatFreti(walletBalance)}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Item Price</Text>
              <Text style={styles.summaryValue}>
                {walletAPI.formatFreti(items.reduce((sum, item) => sum + item.price, 0))}
              </Text>
            </View>

            {selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>
                  {walletAPI.formatFreti(selectedRider.price)}
                </Text>
              </View>
            )}

            {selectedRider === 'pickup' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>
                <Text style={styles.summaryValue}>Self Pickup (Free)</Text>
              </View>
            )}

            <View style={styles.summaryNote}>
              <Ionicons name="gift" size={16} color="#E91E63" />
              <Text style={styles.noteText}>
                You pay the item price{selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' ? ' plus delivery fee' : ''}. Payment held securely in escrow until {recipientName} confirms delivery.
              </Text>
            </View>

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {walletAPI.formatFreti(total)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom || 0, 12) + 12 }]}>
        <View style={styles.totalPreview}>
          <Text style={styles.totalPreviewLabel}>Total Gift Cost</Text>
          <Text style={styles.totalPreviewValue}>
            {walletAPI.formatFreti(total)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.purchaseButton, processingOrder && styles.buttonDisabled]}
          onPress={handlePlaceGiftOrder}
          disabled={processingOrder}
        >
          {processingOrder ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="gift" size={18} color="#FFF" />
              <Text style={styles.purchaseButtonText}>Send Gift</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.3)',
  },
  recipientIcon: {
    marginRight: 12,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  recipientLabel: {
    color: '#999',
    fontSize: 14,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  productPrice: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sellerName: {
    color: '#999',
    fontSize: 12,
  },
  messageInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.2)',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    color: '#CCC',
    fontSize: 14,
    flex: 1,
  },
  sectionSubtitle: {
    color: '#999',
    fontSize: 12,
    marginBottom: 16,
    marginTop: 4,
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
  privacyText: {
    color: '#3498DB',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentBalance: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#CCC',
    fontSize: 14,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  noteText: {
    color: '#3498DB',
    fontSize: 12,
    flex: 1,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 16,
  },
  totalPreview: {
    flex: 1,
  },
  totalPreviewLabel: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 2,
  },
  totalPreviewValue: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#E91E63',
    borderRadius: 24,
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deliveryOptions: {
    gap: 12,
  },
  selectRiderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  pickupOption: {
    borderColor: 'rgba(52, 152, 219, 0.3)',
    backgroundColor: 'rgba(52, 152, 219, 0.05)',
  },
  selectRiderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectRiderText: {
    flex: 1,
  },
  selectRiderTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectRiderSubtitle: {
    color: '#999',
    fontSize: 12,
  },
  selectedRiderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  selectedRiderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  selectedRiderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedRiderInitial: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedRiderDetails: {
    flex: 1,
  },
  selectedRiderName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedRiderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  selectedRiderRating: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  selectedRiderVehicle: {
    color: '#999',
    fontSize: 12,
    marginLeft: 4,
  },
  selectedRiderDistance: {
    color: '#CCC',
    fontSize: 12,
  },
  selectedRiderPrice: {
    alignItems: 'flex-end',
  },
  selectedRiderPriceText: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  changeRiderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.4)',
  },
  changeRiderText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default GiftCheckoutScreen;
