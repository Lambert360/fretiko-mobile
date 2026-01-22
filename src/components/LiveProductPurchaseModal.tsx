import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI } from '../services/liveSalesAPI';
import { useNavigation } from '@react-navigation/native';
import { useLiveInventory } from '../hooks/useLiveInventory';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LiveProduct {
  id: string;
  product_id: string;
  product: {
    id: string;
    name: string;
    primary_image_url?: string;
    description?: string;
    category_name?: string;
  };
  live_price: number;
  live_stock: number;
  original_stock: number;
  sold_count: number;
  display_order: number;
  is_featured: boolean;
}

interface LiveProductPurchaseModalProps {
  visible: boolean;
  product: LiveProduct | null;
  streamId: string;
  onClose: () => void;
  onPurchaseSuccess: () => void;
}

/**
 * Live Product Purchase Modal
 * 
 * TikTok Shop-style product purchase interface with:
 * - Product details and pricing
 * - Quantity selection with stock validation
 * - Delivery options (rider selection)
 * - Two purchase modes: Checkout vs Continue Watching
 * - Real-time stock updates
 * - Wallet integration
 */
const LiveProductPurchaseModal: React.FC<LiveProductPurchaseModalProps> = ({
  visible,
  product,
  streamId,
  onClose,
  onPurchaseSuccess,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  // Live inventory tracking
  const {
    availableStock,
    isLowStock,
    isOutOfStock,
    reserveStock,
    confirmReservation,
    cancelReservation,
    hasActiveReservation,
    canPurchase,
  } = useLiveInventory(streamId, product?.product_id || '');
  
  // Purchase state
  const [quantity, setQuantity] = useState(1);
  const [selectedRider, setSelectedRider] = useState<any>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [riders, setRiders] = useState<any[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Load user data when modal opens
  useEffect(() => {
    if (visible && product) {
      loadRiders();
      loadWalletBalance();
      setQuantity(1);
      setSelectedRider(null);
      setDeliveryAddress('');
      setNotes('');
    }
  }, [visible, product]);

  // Load available riders
  const loadRiders = async () => {
    setLoadingRiders(true);
    try {
      // TODO: Implement actual riders API call
      const mockRiders = [
        {
          id: '1',
          name: 'John Rider',
          rating: 4.8,
          delivery_fee: 5.00,
          estimated_time: '15-30 min',
          profile_pic_url: 'https://via.placeholder.com/40x40',
        },
        {
          id: '2',
          name: 'Sarah Express',
          rating: 4.9,
          delivery_fee: 7.50,
          estimated_time: '10-20 min',
          profile_pic_url: 'https://via.placeholder.com/40x40',
        },
      ];
      setRiders(mockRiders);
    } catch (error) {
      console.error('Error loading riders:', error);
    } finally {
      setLoadingRiders(false);
    }
  };

  // Load wallet balance
  const loadWalletBalance = async () => {
    try {
      // TODO: Implement actual wallet API call
      setWalletBalance(250.00); // Mock balance
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  };

  // Calculate total price
  const calculateTotal = () => {
    if (!product) return 0;
    const productTotal = product.live_price * quantity;
    const deliveryFee = selectedRider ? selectedRider.delivery_fee : 0;
    const platformFee = productTotal * 0.05; // 5% platform fee
    return productTotal + deliveryFee + platformFee;
  };

  // Handle quantity change
  const handleQuantityChange = (change: number) => {
    if (!product) return;
    
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= availableStock) {
      setQuantity(newQuantity);
    }
  };

  // Handle rider selection
  const handleRiderSelect = (rider: any) => {
    setSelectedRider(rider);
  };

  // Handle continue watching purchase (instant wallet debit)
  const handleContinueWatching = async () => {
    if (!product) return;
    
    // Check stock availability
    if (!canPurchase(quantity)) {
      Alert.alert(
        'Insufficient Stock',
        `Only ${availableStock} items available. Please adjust quantity.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    const total = calculateTotal();
    
    if (total > walletBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₣${(total - walletBalance).toFixed(2)} more in your wallet.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Funds', onPress: () => {/* Navigate to wallet */} }
        ]
      );
      return;
    }

    // Reserve stock first
    const reservation = await reserveStock(quantity);
    if (!reservation.success) {
      Alert.alert(
        'Stock Unavailable',
        reservation.error || 'Unable to reserve stock. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Pay ₣${total.toFixed(2)} from your wallet and continue watching?`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => cancelReservation() // Cancel reservation if user cancels
        },
        { text: 'Confirm', onPress: () => processPurchase(true) }
      ]
    );
  };

  // Handle checkout flow
  const handleCheckout = () => {
    if (!product) return;
    
    const checkoutItem = {
      type: 'product',
      id: product.product_id,
      name: product.product.name,
      image_url: product.product.primary_image_url,
      price: product.live_price,
      quantity,
    };
    
    // Close modal and navigate to mini-checkout
    onClose();
    navigation.navigate('LiveMiniCheckout', {
      streamId,
      item: checkoutItem,
      riderId: selectedRider?.id,
      deliveryAddress: deliveryAddress || undefined,
      returnToStream: true,
    });
  };

  // Add to cart instead of direct purchase
  const addToCart = () => {
    // This would need to communicate with the viewer's cart
    // For now, we'll just close the modal and let the viewer add to cart manually
    onClose();
    // In a real implementation, this would send a signal to the viewer to add to cart
    console.log('🛒 Add to cart requested for product:', product);
  };

  // Process the purchase
  const processPurchase = async (continueWatching: boolean) => {
    if (!product) return;
    
    setLoading(true);
    try {
      const purchaseData = {
        stream_id: streamId,
        product_id: product.product_id,
        quantity,
        continue_watching: continueWatching,
        rider_id: selectedRider?.id,
        delivery_address: deliveryAddress || undefined,
      };

      await liveSalesAPI.purchaseProduct(purchaseData);
      
      // Confirm the stock reservation
      if (hasActiveReservation) {
        await confirmReservation();
      }
      
      Alert.alert(
        'Purchase Successful!',
        continueWatching 
          ? 'Payment processed! Continue enjoying the stream.'
          : 'Order placed! You\'ll receive confirmation shortly.',
        [{ text: 'OK', onPress: onPurchaseSuccess }]
      );
      
      onClose();
    } catch (error) {
      console.error('Error processing purchase:', error);
      // Cancel reservation on error
      if (hasActiveReservation) {
        await cancelReservation();
      }
      Alert.alert('Error', 'Failed to process purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !product) {
    return null;
  }

  const total = calculateTotal();
  const productTotal = product.live_price * quantity;
  const deliveryFee = selectedRider ? selectedRider.delivery_fee : 0;
  const platformFee = productTotal * 0.05;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Purchase Product</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Product Info */}
          <View style={styles.productSection}>
            <Image
              source={{ uri: product.product.primary_image_url || 'https://via.placeholder.com/120x120' }}
              style={styles.productImage}
            />
            <View style={styles.productDetails}>
              <Text style={styles.productName}>{product.product.name}</Text>
              <Text style={styles.productCategory}>{product.product.category_name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.livePrice}>₣{product.live_price.toFixed(2)}</Text>
                <View style={styles.stockContainer}>
                  <Text style={[
                    styles.stockText,
                    isOutOfStock && styles.stockTextOutOfStock,
                    isLowStock && styles.stockTextLowStock,
                  ]}>
                    {availableStock} left
                  </Text>
                  {isLowStock && !isOutOfStock && (
                    <View style={styles.lowStockBadge}>
                      <Text style={styles.lowStockText}>LOW</Text>
                    </View>
                  )}
                  {isOutOfStock && (
                    <View style={styles.outOfStockBadge}>
                      <Text style={styles.outOfStockText}>OUT</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Quantity Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
                onPress={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={20} color={quantity <= 1 ? "#666" : "white"} />
              </TouchableOpacity>
              
              <Text style={styles.quantityText}>{quantity}</Text>
              
              <TouchableOpacity
                style={[styles.quantityButton, quantity >= availableStock && styles.quantityButtonDisabled]}
                onPress={() => handleQuantityChange(1)}
                disabled={quantity >= availableStock}
              >
                <Ionicons name="add" size={20} color={quantity >= availableStock ? "#666" : "white"} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Delivery Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery (Optional)</Text>
            <Text style={styles.sectionSubtitle}>
              Select a rider for delivery or skip for pickup
            </Text>
            
            {loadingRiders ? (
              <ActivityIndicator size="small" color="#3498DB" />
            ) : (
              <View style={styles.ridersContainer}>
                <TouchableOpacity
                  style={[styles.riderOption, !selectedRider && styles.riderOptionSelected]}
                  onPress={() => setSelectedRider(null)}
                >
                  <Ionicons name="walk" size={20} color={!selectedRider ? "#3498DB" : "#888"} />
                  <Text style={[styles.riderName, !selectedRider && styles.riderNameSelected]}>
                    Self Pickup (Free)
                  </Text>
                </TouchableOpacity>

                {riders.map((rider) => (
                  <TouchableOpacity
                    key={rider.id}
                    style={[styles.riderOption, selectedRider?.id === rider.id && styles.riderOptionSelected]}
                    onPress={() => handleRiderSelect(rider)}
                  >
                    <Image source={{ uri: rider.profile_pic_url }} style={styles.riderAvatar} />
                    <View style={styles.riderDetails}>
                      <Text style={[styles.riderName, selectedRider?.id === rider.id && styles.riderNameSelected]}>
                        {rider.name}
                      </Text>
                      <Text style={styles.riderInfo}>
                        ⭐ {rider.rating} • {rider.estimated_time}
                      </Text>
                    </View>
                    <Text style={[styles.riderFee, selectedRider?.id === rider.id && styles.riderFeeSelected]}>
                      ₣{rider.delivery_fee.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedRider && (
              <View style={styles.addressSection}>
                <Text style={styles.inputLabel}>Delivery Address</Text>
                <TextInput
                  style={styles.addressInput}
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  placeholder="Enter delivery address..."
                  placeholderTextColor="#888"
                  multiline
                />
              </View>
            )}
          </View>

          {/* Order Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special requests or notes..."
              placeholderTextColor="#888"
              multiline
              maxLength={200}
            />
          </View>

          {/* Price Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.priceBreakdown}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  {product.product.name} x{quantity}
                </Text>
                <Text style={styles.priceValue}>₣{productTotal.toFixed(2)}</Text>
              </View>
              
              {selectedRider && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Delivery Fee</Text>
                  <Text style={styles.priceValue}>₣{deliveryFee.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Platform Fee (5%)</Text>
                <Text style={styles.priceValue}>₣{platformFee.toFixed(2)}</Text>
              </View>
              
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₣{total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Wallet Balance */}
          <View style={styles.walletSection}>
            <View style={styles.walletRow}>
              <Ionicons name="wallet" size={20} color="#FFD700" />
              <Text style={styles.walletText}>
                Wallet Balance: ₣{walletBalance.toFixed(2)}
              </Text>
            </View>
            {total > walletBalance && (
              <Text style={styles.insufficientText}>
                Insufficient balance. Add ₣{(total - walletBalance).toFixed(2)} to wallet.
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.addToCartButton,
              isOutOfStock && styles.actionButtonDisabled
            ]}
            onPress={addToCart}
            disabled={loading || isOutOfStock}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="bag-add" size={20} color="white" />
                <Text style={styles.addToCartButtonText}>
                  {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                </Text>
              </>
            )}
          </TouchableOpacity>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Product section
  productSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginVertical: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productCategory: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  livePrice: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockText: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '600',
  },
  stockTextLowStock: {
    color: '#F39C12',
  },
  stockTextOutOfStock: {
    color: '#FF4757',
  },
  lowStockBadge: {
    backgroundColor: '#F39C12',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  lowStockText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  outOfStockBadge: {
    backgroundColor: '#FF4757',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  outOfStockText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },

  // Sections
  section: {
    marginVertical: 12,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },

  // Quantity selector
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    backgroundColor: '#666',
  },
  quantityText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 24,
  },

  // Riders
  ridersContainer: {
    gap: 8,
  },
  riderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  riderOptionSelected: {
    borderColor: '#3498DB',
    backgroundColor: '#1a2a3a',
  },
  riderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '600',
  },
  riderNameSelected: {
    color: 'white',
  },
  riderInfo: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  riderFee: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  riderFeeSelected: {
    color: '#3498DB',
  },

  // Address
  addressSection: {
    marginTop: 12,
  },
  inputLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  addressInput: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Notes
  notesInput: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Price breakdown
  priceBreakdown: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    color: '#CCC',
    fontSize: 14,
  },
  priceValue: {
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

  // Wallet
  walletSection: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  insufficientText: {
    color: '#FF4757',
    fontSize: 12,
    marginTop: 8,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  addToCartButton: {
    backgroundColor: '#FF0050',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addToCartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutButton: {
    backgroundColor: '#3498DB',
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  continueButton: {
    backgroundColor: '#FF4757',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  continueSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
});

export default LiveProductPurchaseModal;