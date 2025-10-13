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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { wishlistAPI, WishlistItem } from '../services/wishlistAPI';
import { walletAPI } from '../services/walletAPI';

interface GiftCheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      wishlistItem: WishlistItem;
      recipientId: string;
      recipientName: string;
    };
  };
}

const GiftCheckoutScreen: React.FC<GiftCheckoutScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { wishlistItem, recipientId, recipientName } = route.params;

  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [giftMessage, setGiftMessage] = useState('');
  const [canPurchase, setCanPurchase] = useState(false);

  useEffect(() => {
    loadGiftCheckoutData();
  }, []);

  const loadGiftCheckoutData = async () => {
    try {
      setLoading(true);

      // Check if user can purchase this item as a gift
      const purchaseCheck = await wishlistAPI.canPurchaseAsGift(wishlistItem.id);

      if (!purchaseCheck.canPurchase) {
        Alert.alert('Cannot Purchase', purchaseCheck.reason || 'This item cannot be purchased as a gift', [
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
    // Gift purchases: item price + escrow fee (2%)
    const escrowFee = wishlistItem.price * 0.02;
    return wishlistItem.price + escrowFee;
  };

  const handlePlaceGiftOrder = () => {
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

    Alert.alert(
      'Confirm Gift Purchase',
      `You're buying ${wishlistItem.productName} as a gift for ${recipientName}.\n\nTotal: ${walletAPI.formatFreti(total)}\n\nThe item will be delivered to ${recipientName}, and they will be notified of your gift.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm Purchase', onPress: processGiftOrder },
      ]
    );
  };

  const processGiftOrder = async () => {
    try {
      setProcessingOrder(true);

      // First, create a regular order for this product
      // The backend will handle creating the order and linking it as a gift
      const result = await wishlistAPI.createGiftOrder({
        giftRecipientId: recipientId,
        orderId: '', // Backend will create the order
        wishlistItemId: wishlistItem.id,
        giftMessage: giftMessage.trim() || undefined,
        isSurprise: false, // Based on user requirements
      });

      Alert.alert(
        'Gift Purchase Successful!',
        `Your gift for ${recipientName} has been ordered! They will be notified and can track the delivery.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error processing gift order:', error);
      Alert.alert(
        'Purchase Failed',
        error.message || 'Failed to process gift purchase. Please try again.',
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
  const escrowFee = wishlistItem.price * 0.02;

  return (
    <View style={styles.container}>
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
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
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

        {/* Gift Item Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gift Item</Text>
          <View style={styles.itemCard}>
            <Image source={{ uri: wishlistItem.productImage }} style={styles.productImage} />
            <View style={styles.itemInfo}>
              <Text style={styles.productName}>{wishlistItem.productName}</Text>
              <Text style={styles.productPrice}>₦{wishlistItem.price.toFixed(2)}</Text>
              {wishlistItem.sellerName && (
                <Text style={styles.sellerName}>Sold by {wishlistItem.sellerName}</Text>
              )}
            </View>
          </View>
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

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#3498DB" />
              <Text style={styles.infoText}>
                Will be delivered to {recipientName}'s address
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="notifications" size={20} color="#3498DB" />
              <Text style={styles.infoText}>
                {recipientName} will be notified with your name
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="eye" size={20} color="#3498DB" />
              <Text style={styles.infoText}>
                Both of you can track the order
              </Text>
            </View>
          </View>
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
                {walletAPI.formatFreti(wishlistItem.price)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Escrow Fee (2%)</Text>
              <Text style={styles.summaryValue}>
                {walletAPI.formatFreti(escrowFee)}
              </Text>
            </View>

            <View style={styles.summaryNote}>
              <Ionicons name="shield-checkmark" size={16} color="#3498DB" />
              <Text style={styles.noteText}>
                Payment held securely until {recipientName} confirms delivery
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
      <View style={styles.bottomBar}>
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
});

export default GiftCheckoutScreen;
