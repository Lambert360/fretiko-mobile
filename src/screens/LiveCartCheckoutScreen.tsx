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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { walletAPI } from '../services/walletAPI';
import { liveSalesAPI } from '../services/liveSalesAPI';
import { ordersAPI } from '../services/ordersAPI';
import { liveStreamSocket } from '../services/liveStreamSocket';
import { riderSelectionBridge } from '../utils/riderSelectionBridge';
import { addressSelectionBridge } from '../utils/addressSelectionBridge';

interface LiveCartCheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      streamId: string;
      cartItems: any[];
      streamTitle: string;
      vendorId: string;
      onCheckoutSuccess?: () => void;
    };
  };
}

const LiveCartCheckoutScreen: React.FC<LiveCartCheckoutScreenProps> = ({
  navigation,
  route
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { streamId, cartItems, streamTitle, vendorId, onCheckoutSuccess } = route.params;

  // Debug: Log cart items structure when screen loads
  useEffect(() => {
    console.log('🛒 Cart items received in checkout:', {
      totalItems: cartItems.length,
      items: cartItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        service_id: item.service_id,
        type: item.type,
        name: item.product?.name || item.service?.name || item.name,
        hasProductId: !!item.product_id,
        hasServiceId: !!item.service_id,
      })),
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedRider, setSelectedRider] = useState<any>(null); // No default - user must choose
  const riderCallbackKeyRef = React.useRef<string | null>(null);
  const addressCallbackKeyRef = React.useRef<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });

  useEffect(() => {
    loadCheckoutData();
  }, []);

  const loadCheckoutData = async () => {
    try {
      const wallet = await walletAPI.getWallet();
      setWalletBalance(wallet.availableBalance);
    } catch (error) {
      console.error('Error loading checkout data:', error);
      Alert.alert('Error', 'Failed to load checkout information');
      navigation.goBack();
    }
  };

  const calculateTotal = () => {
    const itemTotal = cartItems.reduce((sum, item) => {
      // Portfolio items use 'price', others use 'live_price'
      const itemPrice = item.type === 'portfolio' ? item.price : item.live_price;
      return sum + (itemPrice * item.quantity);
    }, 0);
    const deliveryFee = selectedRider && selectedRider !== 'pickup'
      ? selectedRider.price
      : 0;
    return itemTotal + deliveryFee;
  };

  const handleCheckout = () => {
    // Only validate delivery for products
    const hasProducts = cartItems.some(item => item.type === 'product');
    
    // Validate that user has selected a delivery option (only for products)
    if (hasProducts && !selectedRider) {
      Alert.alert(
        'Delivery Option Required',
        'Please select either Self Pickup or a Delivery Rider before proceeding.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (hasProducts && selectedRider !== 'pickup') {
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
        `You need ₣${(total - walletBalance).toFixed(2)} more to complete this purchase.`,
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

    // Build item summary
    const productCount = cartItems.filter(item => item.type === 'product').length;
    const serviceCount = cartItems.filter(item => item.type === 'service').length;
    
    let itemSummary = '';
    if (cartItems.length === 1) {
      const item = cartItems[0];
      if (item.type === 'product') {
        itemSummary = `${item.quantity}x ${item.name}`;
      } else {
        itemSummary = item.name;
      }
    } else {
      const parts: string[] = [];
      if (productCount > 0) parts.push(`${productCount} product${productCount > 1 ? 's' : ''}`);
      if (serviceCount > 0) parts.push(`${serviceCount} service${serviceCount > 1 ? 's' : ''}`);
      itemSummary = parts.join(' and ');
    }

    // Build confirmation message
    let confirmationMessage = `You're purchasing ${itemSummary} from the live stream "${streamTitle}".\n\n`;
    
    if (hasProducts) {
      const deliveryInfo = selectedRider === 'pickup'
        ? 'Self Pickup (Free)'
        : `Delivery by ${selectedRider.name} (₣${selectedRider.price.toFixed(2)})`;
      confirmationMessage += `Delivery: ${deliveryInfo}\n\n`;
    }
    
    confirmationMessage += `Total: ₣${total.toFixed(2)}\n\nYour payment will be held securely in escrow until you confirm delivery.`;

    Alert.alert(
      'Confirm Live Purchase',
      confirmationMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Purchase', onPress: processLivePurchase },
      ]
    );
  };

  const processLivePurchase = async () => {
    try {
      setLoading(true);

      // Separate products, services, and portfolio items
      const productItems = cartItems.filter(item => item.type === 'product');
      const serviceItems = cartItems.filter(item => item.type === 'service');
      const portfolioItems = cartItems.filter(item => item.type === 'portfolio');

      // Validate products before purchase - check if they still exist in the stream
      try {
        const currentStream = await liveSalesAPI.getStreamById(streamId);
        const availableProductIds = new Set(
          (currentStream.products || []).map((p: any) => p.product_id)
        );
        
        // Debug: Log what's in the stream vs what's in the cart
        console.log('🔍 Stream validation:', {
          streamId,
          availableProductIds: Array.from(availableProductIds),
          cartProductIds: productItems.map((item: any) => ({
            cartItemId: item.id,
            productId: item.product_id,
            productName: item.product?.name || item.name,
            hasProductId: !!item.product_id,
            fullItem: item,
          })),
        });
        
        // Check if any products in cart are no longer available
        const unavailableProducts = productItems.filter(
          (item: any) => item.product_id && !availableProductIds.has(item.product_id)
        );
        
        if (unavailableProducts.length > 0) {
          const productNames = unavailableProducts
            .map((item: any) => item.product?.name || item.name || 'Unknown product')
            .join(', ');
          
          console.error('❌ Products not found in stream:', {
            unavailableProducts: unavailableProducts.map((item: any) => ({
              productId: item.product_id,
              name: item.product?.name || item.name,
              cartItemId: item.id,
            })),
            availableInStream: Array.from(availableProductIds),
          });
          
          Alert.alert(
            'Products No Longer Available',
            `The following products are no longer available in this stream: ${productNames}. Please remove them from your cart and try again.`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
      } catch (validationError) {
        console.error('Error validating products:', validationError);
        // Continue with purchase attempt - backend will validate anyway
      }

      // Process products
      const productPromises = productItems.map(async (item) => {
        // For LiveStreamProduct, use product_id (actual product ID), not id (live_stream_product.id)
        // The item should have product_id from the LiveStreamProduct interface
        const productId = item.product_id;
        
        if (!productId) {
          console.error('❌ Missing product_id in cart item:', item);
          throw new Error(`Product "${item.product?.name || item.name || item.id}" is missing product_id. Please remove it from cart and try again.`);
        }
        
        console.log('🛒 Processing purchase:', {
          streamId,
          productId,
          itemId: item.id,
          itemName: item.product?.name || item.name,
          quantity: item.quantity,
          hasProductId: !!item.product_id,
        });
        
        const purchaseData = {
          stream_id: streamId,
          product_id: productId,
          quantity: item.quantity,
          continue_watching: false,
          rider_id: selectedRider !== 'pickup' ? selectedRider.id : undefined,
          delivery_address: selectedRider !== 'pickup' ? {
            fullName: deliveryAddress.fullName,
            phone: deliveryAddress.phone,
            address: deliveryAddress.address,
            city: deliveryAddress.city,
            state: deliveryAddress.state,
            postalCode: deliveryAddress.postalCode,
          } : undefined,
        };

        try {
          return await liveSalesAPI.purchaseProduct(purchaseData);
        } catch (error: any) {
          console.error('❌ Purchase failed for product:', {
            productId,
            streamId,
            error: error.message,
            fullError: error,
          });
          
          // Provide user-friendly error message
          if (error.message?.includes('not found in this stream') || 
              error.message?.includes('Product not found')) {
            throw new Error(`Product "${item.product?.name || item.name || 'Unknown'}" is no longer available in this stream. It may have been removed by the vendor. Please remove it from your cart.`);
          }
          throw error;
        }
      });

      // Process services
      const servicePromises = serviceItems.map(async (item) => {
        // For LiveStreamService, use service_id (actual service ID), not id (live_stream_service.id)
        const serviceId = item.service_id || item.id;
        
        // Services use booking API
        const bookingData = {
          stream_id: streamId,
          service_id: serviceId,
          service_date: new Date().toISOString().split('T')[0], // Today's date
          service_time: new Date().toTimeString().split(' ')[0].substring(0, 5), // Current time HH:MM
          service_notes: `Booked from live stream: ${streamTitle}`,
          continue_watching: false,
        };

        return liveSalesAPI.bookService(bookingData);
      });

      // Process portfolio services
      const portfolioPromises = portfolioItems.map(async (item) => {
        // Validate that portfolio items have booking date/time
        if (!item.bookingDate || !item.bookingTime) {
          throw new Error(`Portfolio service "${item.title || item.id}" is missing booking date/time. Please remove it from cart and re-add it with a scheduled date/time.`);
        }

        // Portfolio services use bookPortfolioService API
        const bookingData = {
          stream_id: streamId,
          portfolio_id: item.id,
          service_date: item.bookingDate, // Use selected date from cart
          service_time: item.bookingTime, // Use selected time from cart
          service_notes: `Booked portfolio item: ${item.title} from live stream: ${streamTitle}`,
        };

        return liveSalesAPI.bookPortfolioService(bookingData);
      });

      // Execute all purchases/bookings
      await Promise.all([...productPromises, ...servicePromises, ...portfolioPromises]);

      // Build success message based on what was purchased
      const productCount = productItems.length;
      const serviceCount = serviceItems.length;
      const portfolioCount = portfolioItems.length;
      
      let successMessage = 'Your live stream purchase has been completed!\n\n';
      const parts = [];
      
      if (productCount > 0) {
        parts.push(`${productCount} product${productCount > 1 ? 's' : ''}`);
      }
      if (serviceCount > 0) {
        parts.push(`${serviceCount} service${serviceCount > 1 ? 's' : ''}`);
      }
      if (portfolioCount > 0) {
        parts.push(`${portfolioCount} portfolio service${portfolioCount > 1 ? 's' : ''}`);
      }
      
      if (parts.length > 0) {
        if (productCount > 0) {
          successMessage += `Ordered ${parts.join(' and ')}!\n\nThe seller has been notified and will prepare your items.`;
        } else {
          successMessage += `Booked ${parts.join(' and ')}!\n\nThe seller has been notified of your booking.`;
        }
      }

      // Notify the live stream host about the purchases/bookings
      const purchaseMessage = `🎉 ${user?.username || 'Someone'} just purchased ${cartItems.length} item(s) from your live stream!`;
      liveStreamSocket.sendComment(purchaseMessage);

      // Also send a system notification to the host
      console.log('🔔 Host notification sent:', purchaseMessage);

      Alert.alert(
        'Purchase Successful! 🎉',
        successMessage,
        [
          {
            text: 'Continue Watching',
            onPress: () => {
              // Clear cart and return to stream
              onCheckoutSuccess?.();
              navigation.goBack();
            },
          },
          {
            text: 'View Orders',
            onPress: () => {
              onCheckoutSuccess?.();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
              // Navigate to orders tab
              setTimeout(() => {
                navigation.navigate('Orders');
              }, 100);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error processing live purchase:', error);
      Alert.alert(
        'Purchase Failed',
        error.response?.data?.message || error.message || 'Failed to process purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  if (!cartItems || cartItems.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cart-outline" size={64} color="#FF4757" />
        <Text style={styles.errorText}>No items in cart</Text>
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
        <Text style={styles.headerTitle}>Live Cart Checkout</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 + (insets.bottom || 0) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Stream Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purchasing from Live Stream</Text>
          <View style={styles.streamCard}>
            <View style={styles.streamIcon}>
              <Ionicons name="videocam" size={24} color="#FF0050" />
            </View>
            <View style={styles.streamInfo}>
              <Text style={styles.streamTitle}>{streamTitle}</Text>
              <Text style={styles.streamSubtitle}>Live shopping purchase</Text>
            </View>
          </View>
        </View>

        {/* Cart Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Cart Items ({cartItems.length})
          </Text>
          {cartItems.map((item, index) => (
            <View key={item.cartId} style={[styles.itemCard, index > 0 && { marginTop: 12 }]}>
              <Image source={{ uri: item.primary_image_url }} style={styles.productImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productQuantity}>Quantity: {item.quantity}</Text>
                <Text style={styles.productPrice}>₣{(item.live_price * item.quantity).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery Options */}
        {cartItems.some(item => item.type === 'product') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Option</Text>
            <Text style={styles.sectionSubtitle}>
              Choose how you'd like to receive your items
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
                  onPress={() => setSelectedRider(null)}
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
                  <Text style={styles.optionPrice}>₣{selectedRider.price.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => setSelectedRider(null)}
                >
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.deliveryOptions}>
                <TouchableOpacity
                  style={styles.selectOption}
                  onPress={() => {
                    if (riderCallbackKeyRef.current) riderSelectionBridge.clear(riderCallbackKeyRef.current);
                    const callbackKey = `live_cart_rider_${Date.now()}`;
                    riderCallbackKeyRef.current = callbackKey;
                    riderSelectionBridge.register(callbackKey, (rider: any) => setSelectedRider(rider));
                    navigation.navigate('RiderSelection', {
                      pickupLocation: {
                        latitude: 6.5244,
                        longitude: 3.3792,
                        address: deliveryAddress.city ? `Vendor Location, ${deliveryAddress.city}` : 'Vendor Location',
                        state: deliveryAddress.state || undefined,
                        city: deliveryAddress.city || undefined,
                      },
                      deliveryLocation: { latitude: 6.5244, longitude: 3.3792, address: deliveryAddress.address || 'Delivery Address' },
                      orderDetails: { weight: cartItems.length * 0.5, itemCount: cartItems.length, distance: 5 },
                      callbackKey,
                    });
                  }}
                >
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
        )}

        {/* Delivery Address */}
        {selectedRider !== 'pickup' && cartItems.some(item => item.type === 'product') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <Text style={styles.sectionSubtitle}>
              Where should we deliver your items?
            </Text>

            <View style={styles.addressForm}>
              <TextInput
                style={styles.addressInput}
                placeholder="Full Name *"
                placeholderTextColor="#666"
                value={deliveryAddress.fullName}
                onChangeText={(text) => setDeliveryAddress(prev => ({ ...prev, fullName: text }))}
              />
              <TextInput
                style={styles.addressInput}
                placeholder="Phone Number *"
                placeholderTextColor="#666"
                value={deliveryAddress.phone}
                onChangeText={(text) => setDeliveryAddress(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.addressInput}
                placeholder="Street Address *"
                placeholderTextColor="#666"
                value={deliveryAddress.address}
                onChangeText={(text) => setDeliveryAddress(prev => ({ ...prev, address: text }))}
              />
              <View style={styles.addressRow}>
                <TextInput
                  style={styles.addressInputHalf}
                  placeholder="City *"
                  placeholderTextColor="#666"
                  value={deliveryAddress.city}
                  onChangeText={(text) => setDeliveryAddress(prev => ({ ...prev, city: text }))}
                />
                <TextInput
                  style={styles.addressInputHalf}
                  placeholder="State *"
                  placeholderTextColor="#666"
                  value={deliveryAddress.state}
                  onChangeText={(text) => setDeliveryAddress(prev => ({ ...prev, state: text }))}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.editAddressButton}
              onPress={() => {
                if (addressCallbackKeyRef.current) addressSelectionBridge.clear(addressCallbackKeyRef.current);
                const callbackKey = `live_cart_address_${Date.now()}`;
                addressCallbackKeyRef.current = callbackKey;
                addressSelectionBridge.register(callbackKey, (address: any) => setDeliveryAddress(address));
                navigation.navigate('AddressBook', {
                  callbackKey,
                });
              }}
            >
              <Ionicons name="location" size={18} color="#3498DB" />
              <Text style={styles.editAddressText}>Select from Address Book</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items Total</Text>
              <Text style={styles.summaryValue}>
                ₣{cartItems.reduce((sum, item) => sum + (item.live_price * item.quantity), 0).toFixed(2)}
              </Text>
            </View>

            {selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₣{selectedRider.price.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.summaryNote}>
              <Ionicons name="shield-checkmark" size={16} color="#27AE60" />
              <Text style={styles.noteText}>
                Payment held securely in escrow until delivery confirmation
              </Text>
            </View>

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₣{total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Wallet Balance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.walletCard}>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet" size={24} color="#3498DB" />
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletName}>Freti Wallet</Text>
              <Text style={styles.walletBalance}>
                Balance: ₣{walletBalance.toFixed(2)}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Checkout Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.checkoutSummary}>
          <Text style={styles.checkoutTotalLabel}>Total</Text>
          <Text style={styles.checkoutTotalValue}>₣{total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, loading && styles.buttonDisabled]}
          onPress={handleCheckout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="card" size={18} color="#FFF" />
              <Text style={styles.checkoutButtonText}>Pay Now</Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionSubtitle: {
    color: '#999',
    fontSize: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  streamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 80, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 80, 0.3)',
  },
  streamIcon: {
    marginRight: 12,
  },
  streamInfo: {
    flex: 1,
  },
  streamTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  streamSubtitle: {
    color: '#FF0050',
    fontSize: 12,
    fontWeight: '500',
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
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productQuantity: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 2,
  },
  productPrice: {
    color: '#00F2EA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#CCC',
    fontSize: 12,
    marginBottom: 2,
  },
  optionPrice: {
    color: '#27AE60',
    fontSize: 14,
    fontWeight: '600',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.4)',
  },
  changeText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryOptions: {
    gap: 12,
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
  pickupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#27AE60',
  },
  addressForm: {
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
  addressInputHalf: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  editAddressText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
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
    marginVertical: 8,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#00F2EA',
    fontSize: 18,
    fontWeight: 'bold',
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  walletBalance: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 16,
  },
  checkoutSummary: {
    flex: 1,
  },
  checkoutTotalLabel: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 2,
  },
  checkoutTotalValue: {
    color: '#00F2EA',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#FF0050',
    borderRadius: 24,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
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
});

export default LiveCartCheckoutScreen;
