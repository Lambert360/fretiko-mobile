import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { checkoutAPI } from '../services/checkoutAPI';
import { cartAPI } from '../services/cartAPI';
import { walletAPI } from '../services/walletAPI';
import { rewardsAPI, CheckoutDisplayRewards } from '../services/rewardsAPI';
import { invoiceAPI } from '../services/invoiceAPI';
import { Rider } from './RiderSelectionScreen';

interface CheckoutScreenProps {
  navigation: any;
  route?: {
    params?: {
      productId?: string;
      quantity?: number;
      directCheckout?: boolean;
      source?: 'cart' | 'product' | 'invoice' | 'auction';
      invoiceId?: string;
      auctionCheckout?: {
        auctionId: string;
      };
      items?: Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
        image?: string;
        type?: string;
      }>;
      totalAmount?: number;
      vendorId?: string;
    };
  };
}

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

interface PaymentMethod {
  id: string;
  type: 'wallet';
  name: string;
  description: string;
  icon: string;
  balance?: number;
}

interface OrderSummary {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    sellerId: string;
    requiresEscrow: boolean;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  escrowFee: number;
  total: number;
}

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { productId, quantity, directCheckout, source, invoiceId, items: invoiceItems, totalAmount: invoiceTotal, vendorId, auctionCheckout } = route?.params || {};
  
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    isDefault: false,
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('wallet');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useEscrow, setUseEscrow] = useState(true);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [selectedRider, setSelectedRider] = useState<Rider | 'pickup' | null>(null);
  
  // Rewards state
  const [rewards, setRewards] = useState<CheckoutDisplayRewards | null>(null);
  const [useRewards, setUseRewards] = useState(false);
  const [rewardsAmount, setRewardsAmount] = useState(0);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadCheckoutData();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadCheckoutData = async () => {
    try {
      setLoading(true);

      let summary;

      // Handle auction-based checkout
      if (source === 'auction' && auctionCheckout) {
        console.log('🔨 Loading auction checkout data for auction:', auctionCheckout.auctionId);
        summary = await checkoutAPI.getAuctionCheckoutSummary(auctionCheckout.auctionId);
        setUseEscrow(true); // Auctions always use escrow
      }
      // Handle invoice-based checkout
      else if (source === 'invoice' && invoiceItems && invoiceTotal !== undefined) {
        console.log('📄 Loading invoice checkout data');

        // Create order summary from invoice data
        summary = {
          items: invoiceItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            sellerId: vendorId || '',
            requiresEscrow: true,
          })),
          subtotal: invoiceTotal,
          shipping: 0, // Will be set when rider is selected
          tax: 0,
          escrowFee: invoiceTotal * 0.02, // 2% escrow fee
          total: invoiceTotal + (invoiceTotal * 0.02),
        };
      } else {
        // Regular checkout (from cart or direct product)
        summary = directCheckout
          ? await checkoutAPI.getDirectCheckoutSummary(productId!, quantity!)
          : await checkoutAPI.getCheckoutSummary();
      }

      const [wallet, methods, rewardsData] = await Promise.all([
        walletAPI.getWallet(),
        checkoutAPI.getPaymentMethods(),
        rewardsAPI.getCheckoutDisplayRewards(),
      ]);

      setOrderSummary(summary);
      setWalletBalance(wallet.availableBalance);
      setPaymentMethods(methods);
      setRewards(rewardsData);

      // Set max redeemable rewards amount
      if (rewardsData.can_redeem && summary) {
        const maxRedeemable = rewardsAPI.getMaxRedeemableForPurchase(
          rewardsData.available_rewards,
          summary.total
        );
        setRewardsAmount(maxRedeemable);
      }

      // Load saved address if exists
      const savedAddress = await checkoutAPI.getDefaultAddress();
      if (savedAddress) {
        setDeliveryAddress(savedAddress);
      }
    } catch (error) {
      console.error('Error loading checkout data:', error);
      Alert.alert('Error', 'Failed to load checkout information');
    } finally {
      setLoading(false);
    }
  };

  // Calculate final total (shared function)
  const calculateFinalTotal = () => {
    if (!orderSummary) return 0;
    const riderPrice = selectedRider === 'pickup' ? 0 : selectedRider?.price || orderSummary.shipping;
    const subtotal = orderSummary.subtotal + orderSummary.tax + riderPrice + (useEscrow ? orderSummary.escrowFee : 0);
    const rewardsDiscount = useRewards ? rewardsAmount : 0;
    return Math.max(0, subtotal - rewardsDiscount); // Can't be negative
  };

  const handlePlaceOrder = async () => {
    if (!orderSummary) return;
    
    // Validate required fields
    if (!deliveryAddress.fullName || !deliveryAddress.address || !deliveryAddress.phone) {
      Alert.alert('Missing Information', 'Please provide complete delivery address');
      return;
    }
    
    const finalTotal = calculateFinalTotal();
    if (walletBalance < finalTotal) {
      Alert.alert(
        'Insufficient Balance', 
        `You need ${walletAPI.formatFreti(finalTotal - walletBalance)} more to complete this order. Would you like to add funds to your wallet?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Add Funds', 
            onPress: () => {
              navigation.navigate('Wallet');
            }
          },
        ]
      );
      return;
    }
    
    Alert.alert(
      'Confirm Order',
      `Total: ${walletAPI.formatFreti(finalTotal)}\nPayment: Freti Wallet${selectedRider === 'pickup' ? '\nDelivery: Self Pickup (Free)' : selectedRider ? `\nRider: ${selectedRider.name} (${selectedRider.vehicleType})` : ''}\n${useEscrow ? 'Funds will be held in escrow until delivery is confirmed.' : 'Payment will be processed immediately.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Place Order', onPress: processOrder },
      ]
    );
  };

  const processOrder = async () => {
    try {
      setProcessingOrder(true);
      
      // Animate button
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
      ]).start();

      let order;

      // Handle invoice-based checkout
      if (source === 'invoice' && invoiceId) {
        console.log('📄 Creating order from invoice:', invoiceId);

        // Create order from invoice using the backend endpoint
        const { orderId } = await invoiceAPI.createOrderFromInvoice(invoiceId);

        // Fetch the created order details
        order = { id: orderId, orderNumber: `INV-${invoiceId.substring(0, 8)}` };

        console.log('✅ Order created from invoice:', orderId);
      } else {
        // Regular checkout flow (cart, direct product, or auction)
        const orderData = {
          deliveryAddress,
          paymentMethodId: selectedPaymentMethod,
          useEscrow,
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          directCheckout: directCheckout ? { productId, quantity } : undefined,
          auctionCheckout: auctionCheckout ? { auctionId: auctionCheckout.auctionId } : undefined,
          selectedRider: selectedRider === 'pickup' ? {
            riderId: 'pickup',
            riderName: 'Self Pickup',
            vehicleType: 'pickup',
            deliveryPrice: 0,
            estimatedArrival: 0,
          } : selectedRider ? {
            riderId: selectedRider.id,
            riderName: selectedRider.name,
            vehicleType: selectedRider.vehicleType,
            deliveryPrice: selectedRider.price,
            estimatedArrival: selectedRider.estimatedArrival,
          } : undefined,
        };

        order = await checkoutAPI.createOrder(orderData);

        // Clear cart if not direct checkout or auction
        if (!directCheckout && !auctionCheckout) {
          await cartAPI.clearCart();
        }
      }
      
      Alert.alert(
        'Order Placed Successfully!',
        `Order #${order.orderNumber} has been placed. You'll receive updates via notifications.`,
        [
          {
            text: 'View Order',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [
                  { name: 'Home' },
                  { name: 'OrderDetails', params: { orderId: order.id } },
                ],
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert(
        'Order Failed',
        error.message || 'Failed to place order. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleAddressChange = (field: keyof DeliveryAddress, value: string | boolean) => {
    setDeliveryAddress(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectRider = () => {
    if (!deliveryAddress.address) {
      Alert.alert('Address Required', 'Please set your delivery address first');
      return;
    }

    // Mock pickup location (vendor location)
    const pickupLocation = {
      latitude: 6.5244, // Lagos coordinates
      longitude: 3.3792,
      address: 'Vendor Location, Lagos'
    };

    // Calculate order details
    const orderDetails = {
      weight: orderSummary ? orderSummary.items.reduce((total, item) => total + (item.quantity * 0.5), 0) : 1, // Assume 0.5kg per item
      itemCount: orderSummary ? orderSummary.items.length : 1,
      distance: 2.5, // Mock distance calculation
    };

    navigation.navigate('RiderSelection', {
      pickupLocation,
      orderDetails,
      onRiderSelected: (rider: Rider) => {
        setSelectedRider(rider);
      },
    });
  };

  const handleRemoveRider = () => {
    setSelectedRider(null);
  };

  const renderPaymentMethod = (method: PaymentMethod) => (
    <TouchableOpacity
      key={method.id}
      style={[
        styles.paymentMethod,
        selectedPaymentMethod === method.id && styles.selectedPaymentMethod,
      ]}
      onPress={() => setSelectedPaymentMethod(method.id)}
    >
      <View style={styles.paymentMethodInfo}>
        <View style={styles.paymentMethodIcon}>
          <Ionicons name={method.icon as any} size={24} color="#3498DB" />
        </View>
        <View style={styles.paymentMethodText}>
          <Text style={styles.paymentMethodName}>{method.name}</Text>
          <Text style={styles.paymentMethodDescription}>{method.description}</Text>
          {method.type === 'wallet' && method.balance !== undefined && (
            <Text style={styles.walletBalance}>Balance: {walletAPI.formatFreti(method.balance || 0)}</Text>
          )}
        </View>
      </View>
      <View style={styles.radioButton}>
        {selectedPaymentMethod === method.id && (
          <View style={styles.radioButtonSelected} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderAddressModal = () => (
    <Modal visible={showAddressModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.addressModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Delivery Address</Text>
            <TouchableOpacity onPress={() => setShowAddressModal(false)}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.addressForm} showsVerticalScrollIndicator={false}>
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
              onPress={() => setShowAddressModal(false)}
            >
              <Text style={styles.modalSaveText}>Save Address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading checkout...</Text>
      </View>
    );
  }

  if (!orderSummary) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load checkout information</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadCheckoutData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerButton} />
      </View>

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setShowAddressModal(true)}
            >
              <Ionicons name="pencil" size={16} color="#3498DB" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.addressCard}>
            {deliveryAddress.fullName ? (
              <>
                <Text style={styles.addressName}>{deliveryAddress.fullName}</Text>
                <Text style={styles.addressPhone}>{deliveryAddress.phone}</Text>
                <Text style={styles.addressText}>
                  {deliveryAddress.address}
                  {deliveryAddress.city && `, ${deliveryAddress.city}`}
                  {deliveryAddress.state && `, ${deliveryAddress.state}`}
                  {deliveryAddress.postalCode && ` ${deliveryAddress.postalCode}`}
                </Text>
              </>
            ) : (
              <Text style={styles.noAddressText}>No delivery address set</Text>
            )}
          </View>
        </View>

        {/* Rider Selection Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Rider</Text>
            {selectedRider && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleRemoveRider}
              >
                <Ionicons name="close" size={16} color="#E74C3C" />
                <Text style={[styles.editButtonText, { color: '#E74C3C' }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {selectedRider === 'pickup' ? (
            <View style={styles.selectedRiderCard}>
              <View style={styles.selectedRiderInfo}>
                <View style={styles.selectedRiderAvatar}>
                  <Ionicons name="walk" size={20} color="#FFF" />
                </View>
                <View style={styles.selectedRiderDetails}>
                  <Text style={styles.selectedRiderName}>Self Pickup</Text>
                  <Text style={styles.selectedRiderDistance}>
                    Pick up your order directly from the vendor
                  </Text>
                </View>
              </View>
              <View style={styles.selectedRiderPrice}>
                <Text style={styles.selectedRiderPriceText}>Free</Text>
              </View>
            </View>
          ) : selectedRider ? (
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
                <Text style={styles.selectedRiderPriceText}>{walletAPI.formatFreti(selectedRider.price)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.deliveryOptions}>
              <TouchableOpacity style={styles.selectRiderCard} onPress={handleSelectRider}>
                <View style={styles.selectRiderIcon}>
                  <Ionicons name="person-add" size={24} color="#3498DB" />
                </View>
                <View style={styles.selectRiderInfo}>
                  <Text style={styles.selectRiderTitle}>Choose Delivery Rider</Text>
                  <Text style={styles.selectRiderSubtitle}>
                    Select from available riders near your vendor
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              
              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR</Text>
                <View style={styles.orLine} />
              </View>
              
              <TouchableOpacity 
                style={styles.pickupCard} 
                onPress={() => setSelectedRider('pickup')}
              >
                <View style={styles.selectRiderIcon}>
                  <Ionicons name="walk" size={24} color="#27AE60" />
                </View>
                <View style={styles.selectRiderInfo}>
                  <Text style={styles.selectRiderTitle}>Self Pickup</Text>
                  <Text style={styles.selectRiderSubtitle}>
                    Pick up your order directly from the vendor - Free
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Method Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethods}>
            {paymentMethods.map(renderPaymentMethod)}
          </View>
        </View>

        {/* Rewards Section */}
        {rewards && rewards.can_redeem && (
          <View style={styles.section}>
            <View style={styles.rewardsContainer}>
              <View style={styles.rewardsHeader}>
                <Text style={styles.sectionTitle}>Rewards Available ⭐</Text>
                <Text style={styles.rewardsBalance}>{rewards.display_available}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.rewardsToggleContainer}
                onPress={() => setUseRewards(!useRewards)}
              >
                <View style={styles.rewardsToggleLeft}>
                  <Ionicons 
                    name={useRewards ? "checkbox" : "checkbox-outline"} 
                    size={24} 
                    color={useRewards ? "#F39C12" : "rgba(255,255,255,0.6)"} 
                  />
                  <View style={styles.rewardsToggleText}>
                    <Text style={styles.rewardsToggleTitle}>Apply Rewards</Text>
                    <Text style={styles.rewardsToggleSubtext}>
                      Use up to {rewardsAPI.formatRewardsForDisplay(rewardsAmount)} for this purchase
                    </Text>
                  </View>
                </View>
                <View style={styles.rewardsSavings}>
                  <Text style={styles.rewardsSavingsAmount}>
                    -{walletAPI.formatFreti(useRewards ? rewardsAmount : 0)}
                  </Text>
                </View>
              </TouchableOpacity>

              {useRewards && (
                <View style={styles.rewardsAdjustmentContainer}>
                  <Text style={styles.rewardsAdjustmentLabel}>Amount to use:</Text>
                  <View style={styles.rewardsSliderContainer}>
                    <TouchableOpacity
                      style={styles.rewardsAdjustButton}
                      onPress={() => setRewardsAmount(Math.max(0, rewardsAmount - 1))}
                    >
                      <Ionicons name="remove" size={16} color="#F39C12" />
                    </TouchableOpacity>
                    <View style={styles.rewardsAmountDisplay}>
                      <Text style={styles.rewardsAmountText}>
                        {rewardsAPI.formatRewardsForDisplay(rewardsAmount)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.rewardsAdjustButton}
                      onPress={() => setRewardsAmount(Math.min(
                        rewards.max_redeemable, 
                        rewardsAmount + 1
                      ))}
                    >
                      <Ionicons name="add" size={16} color="#F39C12" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Escrow Option */}
        <View style={styles.section}>
          <View style={styles.escrowContainer}>
            <View style={styles.escrowInfo}>
              <Text style={styles.escrowTitle}>Buyer Protection (Escrow)</Text>
              <Text style={styles.escrowDescription}>
                Your payment is held securely until you confirm delivery
              </Text>
              <Text style={styles.escrowFee}>
                Fee: {walletAPI.formatFreti(orderSummary.escrowFee)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setUseEscrow(!useEscrow)}
            >
              <View style={[styles.toggleTrack, useEscrow && styles.toggleTrackActive]}>
                <View style={[styles.toggleThumb, useEscrow && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Instructions (Optional)</Text>
          <TextInput
            style={styles.instructionsInput}
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            placeholder="Any special instructions for delivery..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Items ({orderSummary.items.length})
              </Text>
              <Text style={styles.summaryValue}>{walletAPI.formatFreti(orderSummary.subtotal)}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {selectedRider === 'pickup' ? 'Delivery (Self Pickup)' : 
                 selectedRider ? `Delivery (${selectedRider.name})` : 'Shipping'}
              </Text>
              <Text style={styles.summaryValue}>
                {selectedRider === 'pickup' ? 'Free' :
                 selectedRider ? walletAPI.formatFreti(selectedRider.price) : 
                 orderSummary.shipping > 0 ? walletAPI.formatFreti(orderSummary.shipping) : 'Free'
                }
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{walletAPI.formatFreti(orderSummary.tax)}</Text>
            </View>
            
            {useEscrow && orderSummary.escrowFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Escrow Fee</Text>
                <Text style={styles.summaryValue}>{walletAPI.formatFreti(orderSummary.escrowFee)}</Text>
              </View>
            )}

            {useRewards && rewardsAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.discountLabel]}>
                  Rewards Discount ⭐
                </Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>
                  -{walletAPI.formatFreti(rewardsAmount)}
                </Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {walletAPI.formatFreti(calculateFinalTotal())}
              </Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <Animated.View style={[styles.bottomBar, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.totalPreview}>
          <Text style={styles.totalPreviewLabel}>Total</Text>
          <Text style={styles.totalPreviewValue}>
            {walletAPI.formatFreti(calculateFinalTotal())}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.placeOrderButton}
          onPress={handlePlaceOrder}
          disabled={processingOrder}
        >
          <Text style={styles.placeOrderButtonText}>
            {processingOrder ? 'Processing...' : 'Place Order'}
          </Text>
          {!processingOrder && (
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </Animated.View>

      {renderAddressModal()}
    </View>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '500',
  },
  addressCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addressName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressPhone: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 8,
  },
  addressText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  noAddressText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedPaymentMethod: {
    borderColor: '#3498DB',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentMethodText: {
    flex: 1,
  },
  paymentMethodName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentMethodDescription: {
    color: '#CCC',
    fontSize: 12,
    lineHeight: 16,
  },
  walletBalance: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3498DB',
  },
  escrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  escrowInfo: {
    flex: 1,
    marginRight: 16,
  },
  escrowTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  escrowDescription: {
    color: '#CCC',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  escrowFee: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '500',
  },
  toggleButton: {
    padding: 4,
  },
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: '#3498DB',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  instructionsInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 80,
    textAlignVertical: 'top',
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
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#27AE60',
    borderRadius: 24,
  },
  placeOrderButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Rewards styles
  rewardsContainer: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  rewardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rewardsBalance: {
    color: '#F39C12',
    fontSize: 16,
    fontWeight: '700',
  },
  rewardsToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rewardsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rewardsToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  rewardsToggleTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rewardsToggleSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  rewardsSavings: {
    alignItems: 'flex-end',
  },
  rewardsSavingsAmount: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: '700',
  },
  rewardsAdjustmentContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
  },
  rewardsAdjustmentLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  rewardsSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  rewardsAdjustButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardsAmountDisplay: {
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  rewardsAmountText: {
    color: '#F39C12',
    fontSize: 16,
    fontWeight: '700',
  },
  discountLabel: {
    color: '#27AE60',
  },
  discountValue: {
    color: '#27AE60',
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
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  addressModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  addressForm: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#3498DB',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedRiderCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  selectedRiderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  },
  selectRiderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectRiderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectRiderInfo: {
    flex: 1,
  },
  selectRiderTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectRiderSubtitle: {
    color: '#CCC',
    fontSize: 12,
    lineHeight: 16,
  },
  deliveryOptions: {
    gap: 12,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  orText: {
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39, 174, 96, 0.2)',
  },
});

export default CheckoutScreen;