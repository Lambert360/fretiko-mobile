import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI } from '../services/liveSalesAPI';
import { checkoutAPI } from '../services/checkoutAPI';
import { walletAPI } from '../services/walletAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CheckoutItem {
  type: 'product' | 'service';
  id: string;
  name: string;
  image_url?: string;
  price: number;
  quantity?: number;
  date?: string;
  time?: string;
  notes?: string;
}

interface PaymentMethod {
  id: string;
  type: 'wallet' | 'card' | 'bank';
  name: string;
  icon: string;
  balance?: number;
  last4?: string;
  enabled: boolean;
}

/**
 * Live Mini Checkout Screen
 * 
 * Streamlined checkout interface for live purchases with:
 * - Quick order review
 * - Payment method selection
 * - One-tap payment processing
 * - Return to live stream option
 */
const LiveMiniCheckoutScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // Route params
  const { 
    streamId, 
    item, 
    riderId, 
    deliveryAddress, 
    returnToStream = true 
  } = route.params || {};
  
  // State
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    deliveryFee: 0,
    platformFee: 0,
    escrowFee: 0,
    total: 0,
  });
  const [useEscrow, setUseEscrow] = useState(true); // Default to escrow for safety
  const [escrowBypass, setEscrowBypass] = useState<any>(null);

  // Load payment methods
  const loadPaymentMethods = async () => {
    try {
      // Mock payment methods - in real implementation, this would come from API
      const methods: PaymentMethod[] = [
        {
          id: 'wallet',
          type: 'wallet',
          name: 'Freti Wallet',
          icon: 'wallet',
          balance: 250.00,
          enabled: true,
        },
        {
          id: 'card_1',
          type: 'card',
          name: 'Visa Card',
          icon: 'card',
          last4: '4532',
          enabled: true,
        },
        {
          id: 'bank_1',
          type: 'bank',
          name: 'Bank Transfer',
          icon: 'business',
          enabled: true,
        },
      ];
      
      setPaymentMethods(methods);
      
      // Auto-select wallet if sufficient balance
      const wallet = methods.find(m => m.type === 'wallet');
      if (wallet && wallet.balance && wallet.balance >= orderSummary.total) {
        setSelectedPayment(wallet);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  // Check escrow bypass eligibility
  const checkEscrowEligibility = async () => {
    if (!item) return;

    try {
      // For live purchases, we need vendor info - this would come from stream data
      const bypass = await walletAPI.checkEscrowBypass({
        vendorId: 'stream_vendor_id', // Would be passed from stream data
        riderId: riderId || undefined,
        orderAmount: item.price * (item.quantity || 1),
        category: item.type,
      });

      setEscrowBypass(bypass);

      // If buyer can bypass and vendor is trusted, default to no escrow
      if (bypass.canBypass && bypass.vendorTrusted && bypass.buyerEligible) {
        setUseEscrow(false);
      }
    } catch (error) {
      console.error('Error checking escrow bypass:', error);
      // Default to escrow for safety
      setUseEscrow(true);
    }
  };

  // Calculate order summary
  const calculateOrderSummary = async () => {
    if (!item) return;

    const subtotal = item.type === 'product'
      ? item.price * (item.quantity || 1)
      : item.price;

    const deliveryFee = riderId ? 7.50 : 0; // Mock delivery fee
    const platformFee = subtotal * 0.05; // 5% platform fee

    // Calculate escrow fee if escrow is enabled
    let escrowFee = 0;
    if (useEscrow) {
      try {
        escrowFee = await checkoutAPI.calculateEscrowFee(subtotal);
      } catch (error) {
        // Fallback calculation - Currently FREE (0%)
        const escrowRate = 0; // 0% = FREE (change to 0.025 for 2.5%)
        const minimumFee = 0; // ₣0 minimum (change to 50 for ₣50 minimum)
        escrowFee = Math.max(minimumFee, Math.round(subtotal * escrowRate));
      }
    }

    const total = subtotal + deliveryFee + platformFee + escrowFee;

    setOrderSummary({
      subtotal,
      deliveryFee,
      platformFee,
      escrowFee,
      total,
    });
  };

  // Handle payment method selection
  const handlePaymentSelect = (method: PaymentMethod) => {
    if (!method.enabled) return;
    setSelectedPayment(method);
  };

  // Process payment
  const processPayment = async () => {
    if (!selectedPayment || !item) return;
    
    setLoading(true);
    try {
      if (item.type === 'product') {
        const purchaseData = {
          stream_id: streamId,
          product_id: item.id,
          quantity: item.quantity || 1,
          continue_watching: false,
          rider_id: riderId,
          delivery_address: deliveryAddress,
          payment_method: selectedPayment.id,
          use_escrow: useEscrow,
        };
        
        await liveSalesAPI.purchaseProduct(purchaseData);
      } else {
        const bookingData: any = {
          stream_id: streamId,
          service_id: item.id,
          service_date: item.date!,
          service_time: item.time!,
          service_notes: item.notes,
          continue_watching: false,
          payment_method: selectedPayment.id,
          use_escrow: useEscrow,
        };

        // For now, we'll use purchaseProduct for service bookings too
        // since bookService doesn't handle payment processing
        const purchaseData = {
          stream_id: streamId,
          product_id: item.id,
          quantity: 1,
          continue_watching: false,
          rider_id: riderId,
          delivery_address: deliveryAddress,
          payment_method: selectedPayment.id,
          use_escrow: useEscrow,
        };

        await liveSalesAPI.purchaseProduct(purchaseData);
      }
      
      Alert.alert(
        'Payment Successful!',
        `Your ${item.type} ${item.type === 'product' ? 'order' : 'booking'} has been confirmed.`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              if (returnToStream) {
                navigation.goBack();
              } else {
                navigation.navigate('Orders');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Payment Error', 'Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Return to stream
  const handleReturnToStream = () => {
    navigation.goBack();
  };

  // Recalculate when escrow setting changes
  useEffect(() => {
    if (item) {
      calculateOrderSummary();
    }
  }, [useEscrow, item]);

  // Initialize
  useEffect(() => {
    if (item) {
      checkEscrowEligibility();
      calculateOrderSummary();
      loadPaymentMethods();
    }
  }, [item]);

  if (!item) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={80} color="#FF4757" />
        <Text style={styles.errorText}>Invalid checkout data</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.closeButton} onPress={handleReturnToStream}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Checkout</Text>
        {returnToStream && (
          <TouchableOpacity style={styles.streamButton} onPress={handleReturnToStream}>
            <Ionicons name="play-circle" size={24} color="#FF4757" />
          </TouchableOpacity>
        )}
        {!returnToStream && <View style={styles.headerRight} />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Item Details */}
        <View style={styles.itemSection}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>
              {item.type === 'product' ? 'Product' : 'Service'} Details
            </Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          
          <View style={styles.itemCard}>
            <Image
              source={{ uri: item.image_url || 'https://via.placeholder.com/80x80' }}
              style={styles.itemImage}
            />
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.name}</Text>
              
              {item.type === 'product' && (
                <>
                  <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                  <Text style={styles.itemPrice}>₣{item.price.toFixed(2)} each</Text>
                </>
              )}
              
              {item.type === 'service' && (
                <>
                  <Text style={styles.itemDateTime}>
                    {new Date(item.date!).toLocaleDateString()} at {item.time}
                  </Text>
                  <Text style={styles.itemPrice}>₣{item.price.toFixed(2)}</Text>
                </>
              )}
            </View>
          </View>
          
          {deliveryAddress && (
            <View style={styles.deliverySection}>
              <Text style={styles.deliveryLabel}>Delivery Address:</Text>
              <Text style={styles.deliveryAddress}>{deliveryAddress}</Text>
            </View>
          )}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {item.type === 'product' 
                  ? `${item.name} x${item.quantity}`
                  : item.name
                }
              </Text>
              <Text style={styles.summaryValue}>₣{orderSummary.subtotal.toFixed(2)}</Text>
            </View>
            
            {orderSummary.deliveryFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₣{orderSummary.deliveryFee.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform Fee (5%)</Text>
              <Text style={styles.summaryValue}>₣{orderSummary.platformFee.toFixed(2)}</Text>
            </View>

            {useEscrow && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Escrow Protection Fee</Text>
                <Text style={styles.summaryValue}>₣{orderSummary.escrowFee.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₣{orderSummary.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Escrow Protection Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Protection</Text>
          <View style={styles.escrowSection}>
            <TouchableOpacity
              style={styles.escrowToggle}
              onPress={() => setUseEscrow(!useEscrow)}
            >
              <View style={styles.escrowInfo}>
                <View style={styles.escrowHeader}>
                  <Ionicons
                    name={useEscrow ? "shield-checkmark" : "shield-outline"}
                    size={20}
                    color={useEscrow ? "#27AE60" : "#888"}
                  />
                  <Text style={[styles.escrowTitle, useEscrow && styles.escrowTitleActive]}>
                    Escrow Protection {useEscrow ? 'ON' : 'OFF'}
                  </Text>
                </View>
                <Text style={styles.escrowDescription}>
                  {useEscrow
                    ? "Your payment is held securely until you confirm delivery"
                    : "Payment will be sent directly to the vendor"
                  }
                </Text>
                {orderSummary.escrowFee > 0 && useEscrow && (
                  <Text style={styles.escrowFee}>
                    Protection fee: ₣{orderSummary.escrowFee.toFixed(2)}
                  </Text>
                )}
              </View>
              <View style={[styles.toggleSwitch, useEscrow && styles.toggleSwitchActive]}>
                <View style={[styles.toggleKnob, useEscrow && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>

            {escrowBypass && escrowBypass.canBypass && (
              <View style={styles.bypassNotice}>
                <Ionicons name="information-circle" size={16} color="#3498DB" />
                <Text style={styles.bypassText}>
                  You're eligible to skip escrow for this trusted vendor
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethods}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethod,
                  selectedPayment?.id === method.id && styles.paymentMethodSelected,
                  !method.enabled && styles.paymentMethodDisabled,
                ]}
                onPress={() => handlePaymentSelect(method)}
                disabled={!method.enabled}
              >
                <View style={styles.paymentIcon}>
                  <Ionicons 
                    name={method.icon as any} 
                    size={24} 
                    color={selectedPayment?.id === method.id ? "#3498DB" : "#888"} 
                  />
                </View>
                
                <View style={styles.paymentDetails}>
                  <Text style={[
                    styles.paymentName,
                    selectedPayment?.id === method.id && styles.paymentNameSelected
                  ]}>
                    {method.name}
                  </Text>
                  
                  {method.type === 'wallet' && method.balance && (
                    <Text style={styles.paymentBalance}>
                      Balance: ₣{method.balance.toFixed(2)}
                    </Text>
                  )}
                  
                  {method.type === 'card' && method.last4 && (
                    <Text style={styles.paymentLast4}>
                      •••• {method.last4}
                    </Text>
                  )}
                </View>
                
                {selectedPayment?.id === method.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#3498DB" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Security Notice */}
        <View style={styles.securitySection}>
          <View style={styles.securityHeader}>
            <Ionicons name="shield-checkmark" size={16} color="#27AE60" />
            <Text style={styles.securityText}>Secure Payment</Text>
          </View>
          <Text style={styles.securitySubtext}>
            Your payment information is encrypted and secure
          </Text>
        </View>
      </ScrollView>

      {/* Payment Button */}
      <View style={[styles.paymentSection, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.paymentButton,
            (!selectedPayment || loading) && styles.paymentButtonDisabled,
          ]}
          onPress={processPayment}
          disabled={!selectedPayment || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="card" size={20} color="white" />
              <Text style={styles.paymentButtonText}>
                Pay ₣{orderSummary.total.toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        {returnToStream && (
          <TouchableOpacity style={styles.returnButton} onPress={handleReturnToStream}>
            <Ionicons name="arrow-back" size={16} color="#3498DB" />
            <Text style={styles.returnButtonText}>Return to Live Stream</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  streamButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Item section
  itemSection: {
    marginVertical: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 4,
  },
  liveText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemQuantity: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  itemDateTime: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 4,
  },
  itemPrice: {
    color: '#FF4757',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deliverySection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  deliveryLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  deliveryAddress: {
    color: 'white',
    fontSize: 14,
  },

  // Sections
  section: {
    marginVertical: 12,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  // Summary
  summaryCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#CCC',
    fontSize: 14,
  },
  summaryValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 8,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Payment methods
  paymentMethods: {
    gap: 8,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  paymentMethodSelected: {
    borderColor: '#3498DB',
    backgroundColor: '#1a2a3a',
  },
  paymentMethodDisabled: {
    opacity: 0.5,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentDetails: {
    flex: 1,
  },
  paymentName: {
    color: '#CCC',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentNameSelected: {
    color: 'white',
  },
  paymentBalance: {
    color: '#27AE60',
    fontSize: 12,
    marginTop: 2,
  },
  paymentLast4: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },

  // Escrow protection
  escrowSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  escrowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  escrowInfo: {
    flex: 1,
    marginRight: 12,
  },
  escrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  escrowTitle: {
    color: '#CCC',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  escrowTitleActive: {
    color: '#27AE60',
  },
  escrowDescription: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  escrowFee: {
    color: '#F39C12',
    fontSize: 11,
    fontWeight: '600',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#27AE60',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  bypassNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  bypassText: {
    color: '#3498DB',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },

  // Security
  securitySection: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginVertical: 8,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  securityText: {
    color: '#27AE60',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  securitySubtext: {
    color: '#888',
    fontSize: 12,
  },

  // Payment section
  paymentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27AE60',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.5,
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  returnButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Error states
  errorText: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LiveMiniCheckoutScreen;