import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { walletAPI } from '../services/walletAPI';
import { checkoutAPI } from '../services/checkoutAPI';
import { ordersAPI } from '../services/ordersAPI';
import { Rider } from './RiderSelectionScreen';

interface DeliveryAddress {
  id?: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
}

interface LiveAuctionCartCheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      wonItems: Array<{
        auctionId: string;
        title: string;
        winningBid: number;
        wonAt: string;
        thumbnail_url?: string;
        images?: string[];
      }>;
    };
  };
}

const LiveAuctionCartCheckoutScreen: React.FC<LiveAuctionCartCheckoutScreenProps> = ({
  navigation,
  route
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { wonItems } = route.params;

  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedRider, setSelectedRider] = useState<Rider | 'pickup' | null>(null); // No default - user must choose
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    isDefault: false,
  });
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => {
    loadCheckoutData();
  }, []);

  const loadCheckoutData = async () => {
    try {
      const wallet = await walletAPI.getWallet();
      setWalletBalance(wallet.availableBalance);

      // Load saved address if exists
      const savedAddress = await checkoutAPI.getDefaultAddress();
      if (savedAddress) {
        setDeliveryAddress(savedAddress);
      }
    } catch (error) {
      console.error('Error loading checkout data:', error);
      Alert.alert('Error', 'Failed to load checkout information');
    }
  };

  const calculateTotal = () => {
    const itemsTotal = wonItems.reduce((sum: number, item) => sum + (item.winningBid || 0), 0);
    const deliveryFee = selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object'
      ? (selectedRider.price || 0)
      : 0;
    // Escrow is free - no fee
    return itemsTotal + deliveryFee;
  };

  const handleCheckout = () => {
    // Validate that user has selected a delivery option
    if (!selectedRider) {
      Alert.alert(
        'Delivery Option Required',
        'Please select either Self Pickup or a Delivery Rider before proceeding.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validate delivery address if rider is selected (not pickup)
    if (selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object') {
      if (!deliveryAddress.fullName || !deliveryAddress.address || 
          !deliveryAddress.phone || !deliveryAddress.city || 
          !deliveryAddress.state) {
        Alert.alert(
          'Delivery Address Required',
          'Please provide the delivery address for your order.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    const total = calculateTotal();
    
    if (walletBalance < total) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₣${(total || 0).toFixed(2)} but only have ₣${(walletBalance || 0).toFixed(2)} in your wallet. Please top up your wallet.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Complete Purchase',
      `You are about to checkout ${wonItems.length} won auction item(s) for ₣${(total || 0).toFixed(2)}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Purchase', onPress: processAuctionCheckout },
      ]
    );
  };

  const handleSelectRider = () => {
    if (!deliveryAddress.address) {
      Alert.alert('Address Required', 'Please set your delivery address first');
      return;
    }

    // Navigate to rider selection screen
    navigation.navigate('RiderSelection', {
      pickupLocation: {
        latitude: 6.5244, // TODO: Get vendor location from auction
        longitude: 3.3792,
        address: 'Vendor Location, Lagos'
      },
      deliveryLocation: {
        latitude: 6.5244, // TODO: Geocode delivery address
        longitude: 3.3792,
        address: `${deliveryAddress.address}, ${deliveryAddress.city}`
      },
      orderDetails: {
        weight: wonItems.length * 0.5, // Estimate 0.5kg per item
        itemCount: wonItems.length,
        distance: 2.5, // Mock distance
      },
      onRiderSelected: (rider: Rider) => {
        setSelectedRider(rider);
      },
    });
  };

  const handleRemoveRider = () => {
    setSelectedRider(null); // Reset to show both options
  };

  const handleSaveAddress = async () => {
    try {
      // Validate all required fields
      if (!deliveryAddress.fullName || !deliveryAddress.address ||
          !deliveryAddress.phone || !deliveryAddress.city ||
          !deliveryAddress.state) {
        Alert.alert('Missing Fields', 'Please fill all required fields (Full Name, Phone, Address, City, State)');
        return;
      }

      // Save address to backend
      await checkoutAPI.saveAddress(deliveryAddress);

      // Close modal
      setShowAddressModal(false);

      // Show success message
      Alert.alert('Success', 'Delivery address saved successfully');
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address. Please try again.');
    }
  };

  const handleAddressChange = (field: keyof DeliveryAddress, value: string | boolean) => {
    setDeliveryAddress(prev => ({ ...prev, [field]: value }));
  };

  const processAuctionCheckout = async () => {
    try {
      setLoading(true);

      // Prepare rider info for order creation
      const riderInfo = selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object'
        ? {
            riderId: selectedRider.id,
            riderName: selectedRider.name,
            vehicleType: selectedRider.vehicleType as 'pickup' | 'wheelbarrow' | 'bike' | 'car',
            deliveryPrice: selectedRider.price,
            estimatedArrival: selectedRider.estimatedArrival,
          }
        : selectedRider === 'pickup'
          ? {
              riderId: 'pickup',
              riderName: 'Self Pickup',
              vehicleType: 'pickup' as const,
              deliveryPrice: 0,
              estimatedArrival: 0,
            }
          : undefined;

      // Prepare delivery address (only if not pickup)
      const orderDeliveryAddress = selectedRider && selectedRider !== 'pickup'
        ? {
            ...deliveryAddress,
            isDefault: false, // Required by DeliveryAddress interface
          }
        : {
            fullName: user?.username || '',
            phone: '',
            address: '',
            city: '',
            state: '',
            postalCode: '',
            isDefault: false,
          };

      // Process each won auction item separately
      // Each won item is a separate auction, so each needs its own order
      const createdOrders: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < wonItems.length; i++) {
        const item = wonItems[i];
        try {
          console.log(`🛒 Creating order for auction ${item.auctionId} (${i + 1}/${wonItems.length})`);

          // Get checkout summary for this auction
          const summary = await checkoutAPI.getAuctionCheckoutSummary(item.auctionId);

          // Create order directly (like live sales checkout)
          const orderData = {
            auctionCheckout: {
              auctionId: item.auctionId,
            },
            deliveryAddress: orderDeliveryAddress,
            paymentMethodId: 'wallet', // Auctions use wallet payment
            useEscrow: true, // Auctions always use escrow
            selectedRider: riderInfo,
          };

          const order = await checkoutAPI.createOrder(orderData);
          createdOrders.push(order.orderNumber);
          console.log(`✅ Order created: ${order.orderNumber} for auction ${item.auctionId}`);
        } catch (error: any) {
          console.error(`❌ Failed to create order for auction ${item.auctionId}:`, error);
          errors.push(`${item.title}: ${error.message || 'Failed to create order'}`);
        }
      }

      // Show results
      if (createdOrders.length > 0 && errors.length === 0) {
        // All orders created successfully
        Alert.alert(
          'Order(s) Created Successfully!',
          `${createdOrders.length} order(s) created with pending status. You can track them in your orders.`,
          [
            {
              text: 'View Orders',
              onPress: () => navigation.navigate('Orders'),
            },
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else if (createdOrders.length > 0 && errors.length > 0) {
        // Some succeeded, some failed
        Alert.alert(
          'Partial Success',
          `${createdOrders.length} order(s) created successfully.\n\n${errors.length} failed:\n${errors.join('\n')}`,
          [
            {
              text: 'View Orders',
              onPress: () => navigation.navigate('Orders'),
            },
            {
              text: 'OK',
            },
          ]
        );
      } else {
        // All failed
        Alert.alert(
          'Order Creation Failed',
          `Failed to create orders:\n${errors.join('\n')}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error processing auction checkout:', error);
      Alert.alert(
        'Checkout Failed',
        error.message || 'Failed to process checkout. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  if (!wonItems || wonItems.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="trophy-outline" size={64} color="#FF4757" />
        <Text style={styles.errorText}>No won items to checkout</Text>
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
        <Text style={styles.headerTitle}>Auction Checkout</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 + (insets.bottom || 0) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Your Auction Wins</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Congratulations!</Text>
              <Text style={styles.infoSubtitle}>
                You won {wonItems.length} item(s) in the live auction
              </Text>
            </View>
          </View>
        </View>

        {/* Won Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Won Items ({wonItems.length})
          </Text>
          {wonItems.map((item, index) => (
            <View key={item.auctionId} style={[styles.itemCard, index > 0 && { marginTop: 12 }]}>
              <Image
                source={{ uri: item.thumbnail_url || item.images?.[0] || 'https://via.placeholder.com/100' }}
                style={styles.itemImage}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.title}</Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemLabel}>Winning Bid</Text>
                  <Text style={styles.itemPrice}>₣{(item.winningBid || 0).toFixed(2)}</Text>
                </View>
                <Text style={styles.itemAuctionId}>Auction ID: {item.auctionId.substring(0, 8)}...</Text>
              </View>
              <View style={styles.winnerBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
              </View>
            </View>
          ))}
        </View>

        {/* Delivery Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Option</Text>
          <Text style={styles.sectionSubtitle}>
            Choose how you'd like to receive your won items
          </Text>

          {selectedRider === 'pickup' ? (
            <View style={styles.selectedOption}>
              <View style={styles.optionIcon}>
                <Ionicons name="walk" size={24} color="#3498DB" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Self Pickup</Text>
                <Text style={styles.optionSubtitle}>Pick up directly from the vendor</Text>
                <Text style={styles.optionPrice}>Free</Text>
              </View>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handleSelectRider}
              >
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : selectedRider ? (
            <View style={styles.selectedOption}>
              <View style={styles.optionIcon}>
                <Ionicons name="bicycle" size={24} color="#3498DB" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{selectedRider.name}</Text>
                <Text style={styles.optionSubtitle}>
                  {selectedRider.vehicleType} • {selectedRider.estimatedArrival} min
                </Text>
                <Text style={styles.optionPrice}>₣{(selectedRider.price || 0).toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handleRemoveRider}
              >
                <Text style={styles.changeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.deliveryOptions}>
              <TouchableOpacity style={styles.selectOption} onPress={handleSelectRider}>
                <View style={styles.optionIcon}>
                  <Ionicons name="bicycle" size={24} color="#3498DB" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Select Delivery Rider</Text>
                  <Text style={styles.optionSubtitle}>Choose a rider for fast delivery</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>

              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>

              <TouchableOpacity
                style={styles.pickupOption}
                onPress={() => setSelectedRider('pickup')}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="walk" size={24} color="#27AE60" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Self Pickup</Text>
                  <Text style={styles.optionSubtitle}>
                    Pick up directly from the vendor - Free
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Delivery Address */}
        {selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <Text style={styles.sectionSubtitle}>
              Where should we deliver your items?
            </Text>

            {/* Selected Address Display */}
            {deliveryAddress.address ? (
              <View style={styles.selectedAddress}>
                <View style={styles.addressIcon}>
                  <Ionicons name="location" size={24} color="#8E44AD" />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressName}>
                    {deliveryAddress.fullName || 'No name'}
                  </Text>
                  <Text style={styles.addressText}>
                    {deliveryAddress.address}, {deliveryAddress.city}, {deliveryAddress.state}
                  </Text>
                  <Text style={styles.addressPhone}>
                    {deliveryAddress.phone || 'No phone'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setShowAddressModal(true)}
                >
                  <Ionicons name="pencil" size={18} color="#3498DB" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addAddressButton}
                onPress={() => setShowAddressModal(true)}
              >
                <Ionicons name="add-circle" size={24} color="#8E44AD" />
                <Text style={styles.addAddressText}>Add Delivery Address</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.editAddressButton}
              onPress={() => navigation.navigate('AddressBook', {
                selectMode: true,
                onAddressSelected: (address: any) => {
                  setDeliveryAddress({
                    id: address.id,
                    fullName: address.fullName || '',
                    phone: address.phone || '',
                    address: address.address || '',
                    city: address.city || '',
                    state: address.state || '',
                    postalCode: address.postalCode || '',
                    isDefault: address.isDefault || false,
                  });
                }
              })}
            >
              <Ionicons name="location" size={18} color="#3498DB" />
              <Text style={styles.editAddressText}>Select from Address Book</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({wonItems.length} item(s))</Text>
              <Text style={styles.summaryValue}>
                ₣{wonItems.reduce((sum, item) => sum + (item.winningBid || 0), 0).toFixed(2)}
              </Text>
            </View>

            {selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₣{(selectedRider.price || 0).toFixed(2)}</Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>₣{(calculateTotal() || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Wallet Balance */}
        <View style={styles.section}>
          <View style={styles.walletCard}>
            <Ionicons name="wallet" size={24} color="#3498DB" />
            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>Available Balance</Text>
              <Text style={styles.walletBalance}>₣{(walletBalance || 0).toFixed(2)}</Text>
            </View>
            {walletBalance < calculateTotal() && (
              <TouchableOpacity
                style={styles.topUpButton}
                onPress={() => navigation.navigate('Wallet')}
              >
                <Text style={styles.topUpButtonText}>Top Up</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Checkout Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (loading || walletBalance < calculateTotal()) && styles.checkoutButtonDisabled
          ]}
          onPress={handleCheckout}
          disabled={loading || walletBalance < calculateTotal()}
        >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text style={styles.checkoutButtonText}>
                    Complete Purchase - ₣{(calculateTotal() || 0).toFixed(2)}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </>
              )}
        </TouchableOpacity>
      </View>
      
      {/* Address Modal */}
      <Modal 
        visible={showAddressModal} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.addressModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Address</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.addressForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={deliveryAddress.fullName}
                  onChangeText={(text) => handleAddressChange('fullName', text)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#666"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <TextInput
                  style={styles.textInput}
                  value={deliveryAddress.phone}
                  onChangeText={(text) => handleAddressChange('phone', text)}
                  placeholder="Enter phone number"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address *</Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  value={deliveryAddress.address}
                  onChangeText={(text) => handleAddressChange('address', text)}
                  placeholder="Enter delivery address"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={deliveryAddress.city}
                    onChangeText={(text) => handleAddressChange('city', text)}
                    placeholder="City"
                    placeholderTextColor="#666"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>State *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={deliveryAddress.state}
                    onChangeText={(text) => handleAddressChange('state', text)}
                    placeholder="State"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Postal Code</Text>
                <TextInput
                  style={styles.textInput}
                  value={deliveryAddress.postalCode}
                  onChangeText={(text) => handleAddressChange('postalCode', text)}
                  placeholder="Enter postal code"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddressModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveAddress}
              >
                <Text style={styles.modalSaveText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  infoIcon: {
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoSubtitle: {
    color: '#888',
    fontSize: 14,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemLabel: {
    color: '#888',
    fontSize: 12,
  },
  itemPrice: {
    color: '#8E44AD',
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemAuctionId: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  winnerBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 14,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 14,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginBottom: 0,
  },
  summaryTotalLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryTotalValue: {
    color: '#8E44AD',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  selectedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#8E44AD',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  optionPrice: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#222',
  },
  changeText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  deliveryOptions: {
    gap: 12,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  pickupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#27AE60',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  orText: {
    color: '#666',
    fontSize: 12,
    marginHorizontal: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInputHalf: {
    flex: 1,
    backgroundColor: '#222',
    color: '#FFF',
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
  },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  editAddressText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  walletInfo: {
    flex: 1,
    marginLeft: 12,
  },
  walletLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  walletBalance: {
    color: '#3498DB',
    fontSize: 20,
    fontWeight: 'bold',
  },
  topUpButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  topUpButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  checkoutButton: {
    flexDirection: 'row',
    backgroundColor: '#8E44AD',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#444',
    opacity: 0.6,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#8E44AD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addressForm: {
    padding: 20,
  },
  // Address Modal Styles
  addressModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    color: '#FFF',
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#8E44AD',
    padding: 16,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Selected Address Styles
  selectedAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 2,
  },
  addressPhone: {
    color: '#888',
    fontSize: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  addAddressText: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LiveAuctionCartCheckoutScreen;

