import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
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
import { InterstateCompanySelection } from './InterstateDeliveryScreen';
import { riderSelectionBridge } from '../utils/riderSelectionBridge';
import { addressSelectionBridge } from '../utils/addressSelectionBridge';
import LocationSelector from '../components/LocationSelector';

interface CheckoutScreenProps {
  navigation: any;
  route?: {
    params?: {
      productId?: string;
      quantity?: number;
      directCheckout?: boolean;
      source?: 'cart' | 'product' | 'invoice' | 'auction' | 'wishlist';
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
      selectedItemIds?: string[]; // NEW: Product/Service IDs for filtering checkout items
      selectedCartItemIds?: string[]; // NEW: Cart item IDs for removing after purchase
      wishlistItemIds?: string[]; // NEW: Wishlist item IDs for checkout
      wishlistItems?: Array<{
        id: string;
        productId: string;
        productName: string;
        productImage: string;
        price: number;
      }>; // NEW: Wishlist items data (optional, for direct data)
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
  country?: string;
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
    sellerLocation?: { state?: string; country?: string; city?: string } | null;
    itemType?: string;
    isOutOfState?: boolean;
    isOutOfCountry?: boolean;
  }>;
  subtotal: number;
  shipping: number;
  tax: number;
  escrowFee: number;
  total: number;
  hasOutOfStateItems?: boolean;
  hasOutOfCountryItems?: boolean;
}

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { productId, quantity, directCheckout, source, invoiceId, items: invoiceItems, totalAmount: invoiceTotal, vendorId, auctionCheckout, selectedItemIds, selectedCartItemIds, wishlistItemIds, wishlistItems } = route?.params || {};
  
  // Debug: Log what we received
  console.log('🛒 Checkout screen params:', {
    hasSelectedItemIds: !!selectedItemIds,
    selectedItemIdsCount: selectedItemIds?.length || 0,
    hasSelectedCartItemIds: !!selectedCartItemIds,
    selectedCartItemIdsCount: selectedCartItemIds?.length || 0,
  });
  
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    isDefault: false,
  });
  const [showAddressLocationSelector, setShowAddressLocationSelector] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('wallet');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useEscrow, setUseEscrow] = useState(true);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [selectedRider, setSelectedRider] = useState<Rider | 'pickup' | null>(null); // No default - user must choose
  const [selectedInterstateCompany, setSelectedInterstateCompany] = useState<InterstateCompanySelection | null>(null);
  const riderCallbackKeyRef = useRef<string | null>(null);
  const addressCallbackKeyRef = useRef<string | null>(null);
  const prevRequiresInterstateRef = useRef<boolean>(false);
  const requiresInterstateDelivery = useMemo(() => {
    const firstItem = orderSummary?.items?.[0];
    const sellerLoc = firstItem?.sellerLocation;
    if (!sellerLoc || (!sellerLoc.state && !sellerLoc.country)) {
      return !!(orderSummary?.hasOutOfStateItems || orderSummary?.hasOutOfCountryItems);
    }
    const sellerCountry = (sellerLoc.country || '').trim().toLowerCase();
    const sellerState = (sellerLoc.state || '').trim().toLowerCase();
    const buyerCountry = (deliveryAddress.country || '').trim().toLowerCase();
    const buyerState = (deliveryAddress.state || '').trim().toLowerCase();

    if (sellerCountry && buyerCountry && sellerCountry !== buyerCountry) return true;
    return !!(
      (!sellerCountry || !buyerCountry || sellerCountry === buyerCountry) &&
      sellerState && buyerState && sellerState !== buyerState
    );
  }, [orderSummary, deliveryAddress]);

  useEffect(() => {
    if (prevRequiresInterstateRef.current !== requiresInterstateDelivery) {
      setSelectedRider(null);
      setSelectedInterstateCompany(null);
      prevRequiresInterstateRef.current = requiresInterstateDelivery;
    }
  }, [requiresInterstateDelivery]);
  
  // Escrow bypass eligibility
  const [escrowBypass, setEscrowBypass] = useState<{
    canBypass: boolean;
    reason: string;
    vendorTrusted: boolean;
    buyerEligible: boolean;
  } | null>(null);
  const [checkingEscrow, setCheckingEscrow] = useState(false);
  
  // Multi-vendor state
  const [isMultiVendor, setIsMultiVendor] = useState(false);
  const [vendorGroups, setVendorGroups] = useState<any[]>([]);
  const [riderAssignments, setRiderAssignments] = useState<any[]>([]);
  const [totalRiderFee, setTotalRiderFee] = useState(0);
  const [loadingRiderPreview, setLoadingRiderPreview] = useState(false);
  
  // Rewards state
  const [rewards, setRewards] = useState<CheckoutDisplayRewards | null>(null);
  const [useRewards, setUseRewards] = useState(false);
  const [rewardsAmount, setRewardsAmount] = useState(0);
  
  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);
  
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

  // Load rider preview when address changes (multi-vendor only)
  useEffect(() => {
    if (isMultiVendor && deliveryAddress.address && deliveryAddress.city) {
      loadRiderPreview();
    }
  }, [isMultiVendor, deliveryAddress.address, deliveryAddress.city]);

  // Helper: Group items by vendor
  const groupItemsByVendor = (items: any[]) => {
    const groups: { [key: string]: any } = {};
    
    items.forEach(item => {
      const vendorId = item.sellerId || 'unknown';
      if (!groups[vendorId]) {
        groups[vendorId] = {
          vendorId: vendorId,
          items: [],
          subtotal: 0,
        };
      }
      
      groups[vendorId].items.push(item);
      groups[vendorId].subtotal += item.price * item.quantity;
    });
    
    return Object.values(groups);
  };

  // Load rider preview for multi-vendor checkout
  const loadRiderPreview = async () => {
    if (!isMultiVendor || !deliveryAddress.address || !deliveryAddress.city) {
      return;
    }

    try {
      setLoadingRiderPreview(true);
      console.log('🚴 Loading rider preview for multi-vendor checkout...');

      const buyerLocation = {
        address: deliveryAddress.address,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
      };

      const orderDetails = {
        weight: orderSummary?.items.reduce((sum: number, item: any) => sum + (item.quantity * 0.5), 0) || 1, // Estimate 0.5kg per item
        itemCount: orderSummary?.items.length || 0,
      };

      const preview = await checkoutAPI.previewRiderAssignments({
        buyerLocation,
        orderDetails,
      });

      setRiderAssignments(preview.riderAssignments);
      setTotalRiderFee(preview.totalRiderFee);

      console.log(`✅ Rider preview loaded: ${preview.riderAssignments.length} riders assigned`);
    } catch (error) {
      console.error('Error loading rider preview:', error);
      // Don't block checkout on rider preview failure
    } finally {
      setLoadingRiderPreview(false);
    }
  };

  // Check if buyer can bypass escrow for this vendor
  const checkEscrowBypassEligibility = async (vendorId: string, orderTotal: number) => {
    if (!vendorId || !orderTotal) return;
    
    try {
      setCheckingEscrow(true);
      console.log('🔒 Checking escrow bypass eligibility for vendor:', vendorId);
      
      const riderId = (selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object') 
        ? (selectedRider as Rider).id 
        : undefined;

      const bypassCheck = await walletAPI.checkEscrowBypass({
        vendorId,
        riderId,
        orderAmount: orderTotal,
        category: orderSummary?.items[0]?.name || undefined, // Use first item category if available
      });

      setEscrowBypass(bypassCheck);
      
      console.log('🔒 Escrow bypass result:', bypassCheck);
      
      // If buyer can bypass and vendor is trusted, default to no escrow
      // But buyer can still manually enable escrow if they want
      if (bypassCheck.canBypass && bypassCheck.vendorTrusted && bypassCheck.buyerEligible) {
        setUseEscrow(false);
      } else {
        setUseEscrow(true); // Force escrow if not eligible
      }
    } catch (error) {
      console.error('Error checking escrow bypass:', error);
      // Default to escrow for safety
      setUseEscrow(true);
      setEscrowBypass(null);
    } finally {
      setCheckingEscrow(false);
    }
  };

  const loadCheckoutData = async () => {
    try {
      setLoading(true);

      let summary;

      // Handle auction-based checkout
      if (source === 'auction' && auctionCheckout) {
        console.log('🔨 Loading auction checkout data for auction:', auctionCheckout.auctionId);
        try {
          summary = await checkoutAPI.getAuctionCheckoutSummary(auctionCheckout.auctionId);
          setUseEscrow(true); // Auctions always use escrow
        } catch (error: any) {
          console.error('Error loading auction checkout summary:', error);
          // If auction checkout fails, show error and navigate back
          Alert.alert(
            'Checkout Error',
            error.message || 'Failed to load auction checkout information. The auction may not be completed yet.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack(),
              },
            ]
          );
          return;
        }
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
          escrowFee: 0, // Escrow is FREE
          total: invoiceTotal,
        };
      }
      // Handle wishlist-based checkout
      else if (source === 'wishlist' && wishlistItemIds && wishlistItemIds.length > 0) {
        console.log('💖 Loading wishlist checkout data for items:', wishlistItemIds);
        summary = await checkoutAPI.getWishlistCheckoutSummary(wishlistItemIds);
        setUseEscrow(true); // Wishlist purchases always use escrow
        
        // ✅ Multi-vendor detection for wishlist (same as cart)
        if (summary?.items) {
          const uniqueVendors = new Set(summary.items.map((item: any) => item.sellerId));
          const isMulti = uniqueVendors.size > 1;
          setIsMultiVendor(isMulti);
          
          if (isMulti) {
            console.log(`🏪 Multi-vendor wishlist checkout detected: ${uniqueVendors.size} vendors`);
            // Group items by vendor
            const groups = groupItemsByVendor(summary.items);
            setVendorGroups(groups);
          }
        }
      } else {
        // Regular checkout (from cart or direct product)
        // If selective checkout, pass selectedItemIds to backend for filtering
        if (selectedItemIds && selectedItemIds.length > 0) {
          console.log('🔍 Frontend: Requesting selective checkout for items:', selectedItemIds);
        }
        
        summary = directCheckout
          ? await checkoutAPI.getDirectCheckoutSummary(productId!, quantity!)
          : await checkoutAPI.getCheckoutSummary(selectedItemIds);  // Pass selectedItemIds to backend
        
        console.log(`✅ Frontend: Received checkout summary with ${summary.items.length} items, total: ₣${summary.subtotal}`);
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

      // Detect multi-vendor scenario (for cart-based checkout - wishlist handled above)
      if (!directCheckout && !source && source !== 'wishlist' && summary?.items) {
        const uniqueVendors = new Set(summary.items.map((item: any) => item.sellerId));
        const isMulti = uniqueVendors.size > 1;
        setIsMultiVendor(isMulti);
        
        if (isMulti) {
          console.log(`🏪 Multi-vendor checkout detected: ${uniqueVendors.size} vendors`);
          // Group items by vendor
          const groups = groupItemsByVendor(summary.items);
          setVendorGroups(groups);
        }
      }

      // Check escrow bypass eligibility (only for single-vendor, not auctions)
      if (!isMultiVendor && summary?.items?.length > 0 && source !== 'auction') {
        const firstItem = summary.items[0];
        if (firstItem.sellerId) {
          await checkEscrowBypassEligibility(firstItem.sellerId, summary.total);
        }
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
    
    // Multi-vendor: use totalRiderFee from rider assignments
    // Single-vendor: use selectedRider price, interstate company price, or default shipping
    const riderPrice = isMultiVendor 
      ? totalRiderFee 
      : requiresInterstateDelivery
        ? (selectedInterstateCompany?.deliveryPrice || 0)
        : (selectedRider === 'pickup' ? 0 : selectedRider?.price || orderSummary?.shipping || 0);
    
    const subtotal = (orderSummary?.subtotal || 0) + (orderSummary?.tax || 0) + riderPrice + (useEscrow ? (orderSummary?.escrowFee || 0) : 0);
    const rewardsDiscount = useRewards ? rewardsAmount : 0;
    return Math.max(0, subtotal - rewardsDiscount); // Can't be negative
  };

  const handlePlaceOrder = async () => {
    if (!orderSummary) return;
    
    // Validate that user has selected a delivery option
    if (requiresInterstateDelivery) {
      if (!selectedInterstateCompany) {
        Alert.alert(
          'Delivery Company Required',
          'Please select a logistics partner for interstate/international delivery before proceeding.',
          [{ text: 'OK' }]
        );
        return;
      }
    } else if (!selectedRider) {
      Alert.alert(
        'Delivery Option Required',
        'Please select either Self Pickup or a Delivery Rider before proceeding.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Validate delivery address only if delivery rider is selected (not pickup)
    if (requiresInterstateDelivery || (selectedRider !== 'pickup' && typeof selectedRider === 'object')) {
      if (!deliveryAddress.fullName || !deliveryAddress.address || 
          !deliveryAddress.phone || !deliveryAddress.city || 
          !deliveryAddress.state) {
        Alert.alert('Missing Information', 'Please provide complete delivery address (Full Name, Phone, Address, City, State)');
        return;
      }
    }
    
    const finalTotal = calculateFinalTotal();
    if (walletBalance < finalTotal) {
      Alert.alert(
        'Insufficient Balance', 
        `You need ${walletAPI.formatFreti((finalTotal ?? 0) - (walletBalance ?? 0))} more to complete this order. Would you like to add funds to your wallet?`,
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
        `Total: ${walletAPI.formatFreti(finalTotal ?? 0)}\nPayment: Freti Wallet${requiresInterstateDelivery && selectedInterstateCompany ? `\nDelivery Partner: ${selectedInterstateCompany.companyName}` : selectedRider === 'pickup' ? '\nDelivery: Self Pickup (Free)' : (selectedRider && typeof selectedRider === 'object') ? `\nRider: ${selectedRider.name || 'Rider'} (${selectedRider.vehicleType || 'N/A'})` : ''}\n${useEscrow ? 'Funds will be held in escrow until delivery is confirmed.' : 'Payment will be processed immediately.'}`,
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

      // Regular checkout flow (cart, direct product, auction, wishlist, or invoice)
      const baseOrderData = {
        deliveryAddress,
        paymentMethodId: selectedPaymentMethod,
        useEscrow,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        useRewards,
        rewardsAmount,
        directCheckout: directCheckout && productId && quantity ? { productId, quantity } : undefined,
        auctionCheckout: auctionCheckout ? { auctionId: auctionCheckout.auctionId } : undefined,
        invoiceCheckout: source === 'invoice' && invoiceId && invoiceItems && vendorId ? {
          invoiceId,
          invoiceNumber: `INV-${invoiceId.substring(0, 8)}`, // Generate invoice number from ID
          items: invoiceItems,
          totalAmount: invoiceTotal || 0,
          vendorId,
        } : undefined,
        selectedItemIds: selectedItemIds || undefined, // NEW: For selective checkout
        wishlistItemIds: source === 'wishlist' ? wishlistItemIds : undefined, // NEW: For wishlist checkout
      };

      // Multi-vendor checkout: use grouped order API
      if (isMultiVendor && riderAssignments.length > 0) {
        console.log('🏪 Creating grouped order for multi-vendor checkout...');
        
        const groupedOrderData = {
          ...baseOrderData,
          riderAssignments,
          totalRiderFee,
        };

        const result = await checkoutAPI.createGroupedOrder(groupedOrderData);
        order = { 
          id: result.orderGroup.id, 
          orderNumber: result.orderGroup.group_number,
          isGrouped: true,
          orders: result.orders,
        };

        console.log(`✅ Grouped order created: ${result.orders.length} individual orders`);
      } else {
        // Single-vendor checkout: use regular order API
        console.log('🛒 Creating single order...');
        
        const orderData = {
          ...baseOrderData,
          selectedRider: requiresInterstateDelivery ? undefined : selectedRider === 'pickup' ? {
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
          interstateCompany: requiresInterstateDelivery && selectedInterstateCompany ? {
            companyId: selectedInterstateCompany.companyId,
            companyName: selectedInterstateCompany.companyName,
            deliveryPrice: selectedInterstateCompany.deliveryPrice,
            estimatedDeliveryDays: selectedInterstateCompany.estimatedDeliveryDays,
          } : undefined,
        };

        console.log('📦 Order data being sent to backend:');
        console.log('  - Payment method:', orderData.paymentMethodId);
        console.log('  - Source:', source);
        console.log('  - Number of items:', orderSummary?.items?.length || 0);
        console.log('  - Items:', orderSummary?.items?.map(i => ({ id: i.id, name: i.name })) || []);
        console.log('  - Total:', orderSummary?.subtotal || 0);
        if (source === 'invoice') {
          console.log('  - Invoice ID:', invoiceId);
        }

        order = await checkoutAPI.createOrder(orderData as any);
        console.log(`✅ Single order created: ${order.orderNumber}`);
      }

      // Clear cart items
      if (!directCheckout && !auctionCheckout && source !== 'invoice') {
        // Check if we have specific cart item IDs to remove (selective checkout)
        if (selectedCartItemIds && selectedCartItemIds.length > 0) {
          console.log(`🗑️ Removing ${selectedCartItemIds.length} selected items from cart`);
          console.log('🗑️ Cart item IDs to remove:', selectedCartItemIds);
          
          // Remove items sequentially to avoid race conditions
          for (const itemId of selectedCartItemIds) {
            try {
              console.log(`🗑️ Removing cart item: ${itemId}`);
              await cartAPI.removeItem(itemId);
              console.log(`✅ Successfully removed cart item: ${itemId}`);
            } catch (error) {
              console.error(`❌ Failed to remove cart item ${itemId}:`, error);
            }
          }
          console.log('✅ Finished removing all selected cart items');
        } else if (selectedItemIds && selectedItemIds.length > 0) {
          // Legacy: If we only have product/service IDs but no cart item IDs
          // Don't clear cart - this is safer than accidentally clearing everything
          console.warn('⚠️ No cart item IDs provided, skipping cart cleanup for safety');
        } else {
          // No selection info at all - this is a full cart checkout (old flow)
          console.log('🗑️ Clearing entire cart (no selection info)');
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
              // Check if this is a grouped order (multi-vendor)
              if ((order as any).isGrouped && order.id) {
                // Navigate to GroupedOrderScreen
                navigation.navigate('GroupedOrder', { groupId: order.id });
              } else {
                // Navigate to single OrderTracking screen
                navigation.navigate('OrderTracking', { orderId: order.id });
              }
            },
          },
          {
            text: 'Go to Orders',
            onPress: () => {
              navigation.navigate('Orders');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error placing order:', error);
      Alert.alert(
        'Order Failed',
        error?.message || 'Failed to place order. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleAddressChange = (field: keyof DeliveryAddress, value: string | boolean) => {
    setDeliveryAddress(prev => ({ ...prev, [field]: value }));
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

  const handleSelectRider = () => {
    if (!deliveryAddress.address) {
      Alert.alert('Address Required', 'Please set your delivery address first');
      return;
    }

    // Use the vendor's (seller's) location from the checkout summary.
    // The backend now attaches sellerLocation to each item.
    // Fall back to the buyer's delivery address state when seller location is unavailable.
    const firstItem = orderSummary?.items?.[0];
    const sellerLoc = firstItem?.sellerLocation;
    const vendorState = sellerLoc?.state || deliveryAddress.state || undefined;
    const vendorCountry = sellerLoc?.country || undefined;
    const vendorCity = sellerLoc?.city || deliveryAddress.city || undefined;

    const pickupLocation = {
      latitude: 6.5244, // GPS coordinates are still mocked; state/country carry the real filter signal
      longitude: 3.3792,
      address: vendorCity
        ? `Vendor Location, ${vendorCity}`
        : vendorState
          ? `Vendor Location, ${vendorState}`
          : 'Vendor Location',
      state: vendorState,
      country: vendorCountry,
      city: vendorCity,
    };

    // Calculate order details
    const orderDetails = {
      weight: orderSummary ? orderSummary.items.reduce((total, item) => total + (item.quantity * 0.5), 0) : 1, // Assume 0.5kg per item
      itemCount: orderSummary ? orderSummary.items.length : 1,
      distance: 2.5, // Mock distance calculation
    };

    // Derive item types from the checkout summary so the backend can filter
    // to motorized-only riders when services are present.
    const itemTypes = orderSummary
      ? [...new Set(orderSummary.items.map(i => i.itemType || 'product'))]
      : ['product'];

    if (riderCallbackKeyRef.current) riderSelectionBridge.clear(riderCallbackKeyRef.current);
    const callbackKey = `checkout_rider_${Date.now()}`;
    riderCallbackKeyRef.current = callbackKey;

    if (requiresInterstateDelivery) {
      riderSelectionBridge.register(callbackKey, (company: InterstateCompanySelection) => setSelectedInterstateCompany(company));
      navigation.navigate('InterstateDelivery', {
        pickupLocation: { state: vendorState, country: vendorCountry, city: vendorCity },
        deliveryLocation: { state: deliveryAddress.state, country: deliveryAddress.country, city: deliveryAddress.city },
        callbackKey,
      });
      return;
    }

    riderSelectionBridge.register(callbackKey, (rider: Rider) => setSelectedRider(rider));

    navigation.navigate('RiderSelection', {
      pickupLocation,
      orderDetails,
      callbackKey,
      itemTypes,
    });
  };

  const handleRemoveRider = () => {
    setSelectedRider(null); // Reset to show both options
    setSelectedInterstateCompany(null);
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
            <Text style={styles.walletBalance}>Balance: {walletAPI.formatFreti(method.balance ?? 0)}</Text>
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
    <Modal visible={showAddressModal} transparent animationType="slide" onRequestClose={() => setShowAddressModal(false)}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
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
                <Text style={styles.inputLabel}>City / Town *</Text>
                <TextInput
                  style={styles.textInput}
                  value={deliveryAddress.city}
                  onChangeText={(text) => handleAddressChange('city', text)}
                  placeholder="City or town"
                  placeholderTextColor="#666"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>State / Country *</Text>
                <TouchableOpacity
                  style={[styles.textInput, { justifyContent: 'center' }]}
                  onPress={() => setShowAddressLocationSelector(true)}
                >
                  <Text style={{ color: deliveryAddress.state ? '#FFF' : '#666', fontSize: 14 }}>
                    {deliveryAddress.state
                      ? `${deliveryAddress.state}${deliveryAddress.country ? `, ${deliveryAddress.country}` : ''}`
                      : 'Select state...'}
                  </Text>
                </TouchableOpacity>
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

      <LocationSelector
        visible={showAddressLocationSelector}
        selectedLocation={deliveryAddress.state && deliveryAddress.country ? `${deliveryAddress.state}, ${deliveryAddress.country}` : ''}
        onLocationSelect={() => {}}
        onLocationSelectDetailed={(state, country) => {
          handleAddressChange('state', state);
          handleAddressChange('country', country);
        }}
        onClose={() => setShowAddressLocationSelector(false)}
      />
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Checkout</Text>
          {source === 'wishlist' && (
            <View style={styles.wishlistBadge}>
              <Ionicons name="heart" size={12} color="#FFF" />
              <Text style={styles.wishlistBadgeText}>Wishlist</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => setShowInfoModal(true)}>
          <Ionicons name="information-circle-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={{ paddingBottom: 120 + (insets.bottom || 0) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <View style={styles.addressHeaderActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  if (addressCallbackKeyRef.current) addressSelectionBridge.clear(addressCallbackKeyRef.current);
                  const callbackKey = `checkout_address_${Date.now()}`;
                  addressCallbackKeyRef.current = callbackKey;
                  addressSelectionBridge.register(callbackKey, (address: DeliveryAddress) => {
                    setDeliveryAddress(address);
                  });
                  navigation.navigate('AddressBook', {
                    selectMode: true,
                    callbackKey,
                  });
                }}
              >
                <Ionicons name="list" size={16} color="#3498DB" />
                <Text style={styles.editButtonText}>Select</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setShowAddressModal(true)}
              >
                <Ionicons name="pencil" size={16} color="#3498DB" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
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
            <Text style={styles.sectionTitle}>{requiresInterstateDelivery ? 'Interstate Delivery' : 'Delivery Rider'}</Text>
            {!isMultiVendor && (selectedRider || selectedInterstateCompany) && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleRemoveRider}
              >
                <Ionicons name="close" size={16} color="#E74C3C" />
                <Text style={[styles.editButtonText, { color: '#E74C3C' }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Multi-vendor: Show rider assignments */}
          {isMultiVendor ? (
            <View>
              {loadingRiderPreview ? (
                <View style={styles.riderPreviewLoading}>
                  <Text style={styles.riderPreviewLoadingText}>
                    Optimizing delivery routes...
                  </Text>
                </View>
              ) : riderAssignments.length > 0 ? (
                <View>
                  <View style={styles.multiVendorNoticeBox}>
                    <Ionicons name="information-circle" size={18} color="#007AFF" />
                    <Text style={styles.multiVendorNoticeText}>
                      {riderAssignments.length} rider{riderAssignments.length > 1 ? 's' : ''} assigned for optimal delivery
                    </Text>
                  </View>
                  
                  {riderAssignments.map((assignment, index) => (
                    <View key={index} style={styles.riderAssignmentCard}>
                      <View style={styles.riderAssignmentHeader}>
                        <Text style={styles.riderAssignmentTitle}>
                          Rider {index + 1} - {assignment.rider.name}
                        </Text>
                        <Text style={styles.riderAssignmentPrice}>
                          {walletAPI.formatFreti(assignment.pricing?.total ?? 0)}
                        </Text>
                      </View>
                      <View style={styles.riderAssignmentDetails}>
                        <Text style={styles.riderAssignmentVendors}>
                          {assignment.vendorIds.length} vendor{assignment.vendorIds.length > 1 ? 's' : ''} • {assignment.vehicleType}
                        </Text>
                        <Text style={styles.riderAssignmentRoute}>
                          {assignment.route.totalDistance != null ? assignment.route.totalDistance.toFixed(1) : '0.0'}km • {assignment.route.estimatedTime ?? 0} min
                        </Text>
                      </View>
                      {assignment.vendorIds.length > 1 && (
                        <View style={styles.multiStopBadge}>
                          <Ionicons name="flag" size={12} color="#FF9500" />
                          <Text style={styles.multiStopText}>
                            Multi-stop delivery
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.riderPreviewEmpty}>
                  <Ionicons name="bicycle" size={32} color="#999" />
                  <Text style={styles.riderPreviewEmptyText}>
                    Add delivery address to see rider assignments
                  </Text>
                </View>
              )}
            </View>
          ) : requiresInterstateDelivery ? (
            selectedInterstateCompany ? (
              <View style={styles.selectedRiderCard}>
                <View style={styles.selectedRiderInfo}>
                  <View style={styles.selectedRiderAvatar}>
                    <Ionicons name="business" size={20} color="#FFF" />
                  </View>
                  <View style={styles.selectedRiderDetails}>
                    <Text style={styles.selectedRiderName}>{selectedInterstateCompany.companyName}</Text>
                    <Text style={styles.selectedRiderDistance}>
                      {selectedInterstateCompany.isInternational ? 'International' : 'Interstate'} delivery • Est. {selectedInterstateCompany.estimatedDeliveryDays} day(s)
                    </Text>
                  </View>
                </View>
                <View style={styles.selectedRiderPrice}>
                  <Text style={styles.selectedRiderPriceText}>{walletAPI.formatFreti(selectedInterstateCompany.deliveryPrice)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.deliveryOptions}>
                <View style={styles.multiVendorNoticeBox}>
                  <Ionicons name="information-circle" size={18} color="#007AFF" />
                  <Text style={styles.multiVendorNoticeText}>
                    This order ships across states/countries and requires a verified logistics partner.
                  </Text>
                </View>
                <TouchableOpacity style={styles.selectRiderCard} onPress={handleSelectRider}>
                  <View style={styles.selectRiderIcon}>
                    <Ionicons name="business" size={24} color="#3498DB" />
                  </View>
                  <View style={styles.selectRiderInfo}>
                    <Text style={styles.selectRiderTitle}>Choose Delivery Partner</Text>
                    <Text style={styles.selectRiderSubtitle}>
                      Select from verified interstate/international logistics companies
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            )
          ) : selectedRider === 'pickup' ? (
            // Single-vendor: Show selected pickup option
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
                    {selectedRider.distanceFromPickup != null ? selectedRider.distanceFromPickup.toFixed(1) : '0.0'}km away • {selectedRider.estimatedArrival ?? 0} min arrival
                  </Text>
                </View>
              </View>
              <View style={styles.selectedRiderPrice}>
                <Text style={styles.selectedRiderPriceText}>{walletAPI.formatFreti(selectedRider.price ?? 0)}</Text>
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
                    -{walletAPI.formatFreti(useRewards ? (rewardsAmount ?? 0) : 0)}
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
                Fee: {walletAPI.formatFreti(orderSummary.escrowFee ?? 0)}
              </Text>
              {escrowBypass && !escrowBypass.canBypass && (
                <Text style={styles.escrowLockReason}>
                  🔒 {escrowBypass.reason}
                </Text>
              )}
              {escrowBypass && escrowBypass.canBypass && (
                <Text style={styles.escrowOptionalNote}>
                  ✅ Optional - You can bypass escrow for this vendor
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                (!escrowBypass?.canBypass) && styles.toggleButtonDisabled
              ]}
              onPress={() => {
                // Only allow toggle if buyer can bypass escrow
                if (escrowBypass?.canBypass) {
                  setUseEscrow(!useEscrow);
                } else {
                  Alert.alert(
                    'Escrow Required',
                    escrowBypass?.reason || 'Escrow protection is required for this purchase.',
                    [{ text: 'OK' }]
                  );
                }
              }}
              disabled={checkingEscrow}
            >
              <View style={[
                styles.toggleTrack, 
                useEscrow && styles.toggleTrackActive,
                (!escrowBypass?.canBypass) && styles.toggleTrackLocked
              ]}>
                <View style={[
                  styles.toggleThumb, 
                  useEscrow && styles.toggleThumbActive,
                  (!escrowBypass?.canBypass) && styles.toggleThumbLocked
                ]} />
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
                Items ({orderSummary.items?.length || 0})
              </Text>
              <Text style={styles.summaryValue}>{walletAPI.formatFreti(orderSummary.subtotal ?? 0)}</Text>
            </View>
            
            {/* Interstate delivery fee */}
            {requiresInterstateDelivery && selectedInterstateCompany && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Delivery Fee ({selectedInterstateCompany.companyName})
                </Text>
                <Text style={styles.summaryValue}>
                  {walletAPI.formatFreti(selectedInterstateCompany.deliveryPrice ?? 0)}
                </Text>
              </View>
            )}
            
            {/* Only show rider fee if a rider is selected */}
            {(selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object') && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Rider Fee ({selectedRider.name || 'Rider'})
                </Text>
                <Text style={styles.summaryValue}>
                  {walletAPI.formatFreti(selectedRider.price ?? 0)}
                </Text>
              </View>
            )}
            
            {/* Multi-vendor rider fee */}
            {isMultiVendor && totalRiderFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Rider Fee ({riderAssignments.length} riders)
                </Text>
                <Text style={styles.summaryValue}>
                  {walletAPI.formatFreti(totalRiderFee ?? 0)}
                </Text>
              </View>
            )}
            
            {/* Escrow Fee - Always show as Free */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Escrow Fee</Text>
              <Text style={styles.summaryValue}>Free</Text>
            </View>

            {useRewards && rewardsAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.discountLabel]}>
                  Rewards Discount ⭐
                </Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>
                  -{walletAPI.formatFreti(rewardsAmount ?? 0)}
                </Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {walletAPI.formatFreti(calculateFinalTotal() ?? 0)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <Animated.View
        style={[
          styles.bottomBar,
          { transform: [{ scale: scaleAnim }] },
          { paddingBottom: Math.max(insets.bottom || 0, 12) + 12 },
        ]}
      >
        <View style={styles.totalPreview}>
          <Text style={styles.totalPreviewLabel}>Total</Text>
          <Text style={styles.totalPreviewValue}>
            {walletAPI.formatFreti(calculateFinalTotal() ?? 0)}
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

      {/* Info Modal */}
      <Modal visible={showInfoModal} transparent animationType="slide">
        <View style={styles.infoModalOverlay}>
          <View style={styles.infoModal}>
            {/* Header */}
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>Checkout Information</Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoModalContent} showsVerticalScrollIndicator={false}>
              {/* Order Summary Section */}
              <View style={styles.infoSection}>
                <View style={styles.infoSectionHeader}>
                  <Ionicons name="receipt-outline" size={20} color="#3498DB" />
                  <Text style={styles.infoSectionTitle}>Order Breakdown</Text>
                </View>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Items ({orderSummary?.items?.length || 0})</Text>
                    <Text style={styles.infoValue}>
                      {orderSummary ? walletAPI.formatFreti(orderSummary.subtotal ?? 0) : '₣0'}
                    </Text>
                  </View>
                  
                  {/* Interstate delivery fee */}
                  {requiresInterstateDelivery && selectedInterstateCompany && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Delivery Fee ({selectedInterstateCompany.companyName})</Text>
                      <Text style={styles.infoValue}>
                        {walletAPI.formatFreti(selectedInterstateCompany.deliveryPrice ?? 0)}
                      </Text>
                    </View>
                  )}
                  
                  {/* Only show rider fee if a rider is selected */}
                  {(selectedRider && selectedRider !== 'pickup' && typeof selectedRider === 'object') && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Rider Fee</Text>
                      <Text style={styles.infoValue}>
                        {walletAPI.formatFreti(selectedRider.price ?? 0)}
                      </Text>
                    </View>
                  )}
                  
                  {/* Multi-vendor rider fee */}
                  {isMultiVendor && totalRiderFee > 0 && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Rider Fee ({riderAssignments.length} riders)</Text>
                      <Text style={styles.infoValue}>
                        {walletAPI.formatFreti(totalRiderFee ?? 0)}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Escrow Fee</Text>
                    <Text style={styles.infoValue}>Free</Text>
                  </View>
                  
                  <View style={[styles.infoRow, styles.infoRowTotal]}>
                    <Text style={styles.infoTotalLabel}>Total</Text>
                    <Text style={styles.infoTotalValue}>
                      {walletAPI.formatFreti(calculateFinalTotal() ?? 0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Security Section */}
              <View style={styles.infoSection}>
                <View style={styles.infoSectionHeader}>
                  <Ionicons name="shield-checkmark" size={20} color="#27AE60" />
                  <Text style={styles.infoSectionTitle}>Secure Checkout</Text>
                </View>
                <View style={styles.infoCard}>
                  <View style={styles.securityFeature}>
                    <Ionicons name="lock-closed" size={16} color="#27AE60" />
                    <Text style={styles.securityText}>256-bit SSL encryption protects your payment</Text>
                  </View>
                  {useEscrow && (
                    <View style={styles.securityFeature}>
                      <Ionicons name="time-outline" size={16} color="#3498DB" />
                      <Text style={styles.securityText}>
                        Escrow holds funds until you confirm delivery
                      </Text>
                    </View>
                  )}
                  <View style={styles.securityFeature}>
                    <Ionicons name="shield-outline" size={16} color="#3498DB" />
                    <Text style={styles.securityText}>Buyer protection on all purchases</Text>
                  </View>
                  <View style={styles.securityFeature}>
                    <Ionicons name="checkmark-circle" size={16} color="#27AE60" />
                    <Text style={styles.securityText}>Verified vendors and riders only</Text>
                  </View>
                </View>
              </View>

              {/* Help Section */}
              <View style={styles.infoSection}>
                <View style={styles.infoSectionHeader}>
                  <Ionicons name="help-circle-outline" size={20} color="#F39C12" />
                  <Text style={styles.infoSectionTitle}>Need Help?</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.helpText}>
                    Have questions about your order? Our support team is here to help!
                  </Text>
                  <TouchableOpacity
                    style={styles.supportButton}
                    onPress={() => {
                      setShowInfoModal(false);
                      // Navigate to Create Dispute screen for support
                      navigation.navigate('CreateDispute');
                    }}
                  >
                    <Ionicons name="chatbox-ellipses" size={18} color="#FFF" />
                    <Text style={styles.supportButtonText}>Contact Support</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* What is Escrow? */}
              {useEscrow && (
                <View style={styles.infoSection}>
                  <View style={styles.infoSectionHeader}>
                    <Ionicons name="information-circle" size={20} color="#9B59B6" />
                    <Text style={styles.infoSectionTitle}>What is Escrow?</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.escrowExplanation}>
                      Escrow is a secure payment method that protects both buyers and sellers. 
                      Your payment is held safely until you confirm delivery of your order. 
                      This ensures you receive what you paid for before the vendor gets paid.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.infoModalCloseButton}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalCloseButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  wishlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E91E63',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  wishlistBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  addressHeaderActions: {
    flexDirection: 'row',
    gap: 8,
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
  toggleButtonDisabled: {
    opacity: 0.6,
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
  toggleTrackLocked: {
    backgroundColor: '#666',
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
  toggleThumbLocked: {
    backgroundColor: '#CCC',
  },
  escrowLockReason: {
    color: '#E74C3C',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 14,
  },
  escrowOptionalNote: {
    color: '#27AE60',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 14,
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
  // Multi-vendor rider preview styles
  riderPreviewLoading: {
    padding: 20,
    alignItems: 'center',
  },
  riderPreviewLoadingText: {
    color: '#999',
    fontSize: 14,
  },
  riderPreviewEmpty: {
    padding: 30,
    alignItems: 'center',
  },
  riderPreviewEmptyText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  multiVendorNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  multiVendorNoticeText: {
    color: '#007AFF',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  riderAssignmentCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  riderAssignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  riderAssignmentTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  riderAssignmentPrice: {
    color: '#27AE60',
    fontSize: 15,
    fontWeight: 'bold',
  },
  riderAssignmentDetails: {
    marginBottom: 6,
  },
  riderAssignmentVendors: {
    color: '#CCC',
    fontSize: 13,
    marginBottom: 4,
  },
  riderAssignmentRoute: {
    color: '#999',
    fontSize: 12,
  },
  multiStopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  multiStopText: {
    color: '#FF9500',
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '500',
  },
  // Info Modal Styles
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  infoModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  infoModalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  infoModalContent: {
    padding: 20,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoSectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#CCC',
    fontSize: 14,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  infoRowTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 8,
    paddingTop: 12,
  },
  infoTotalLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoTotalValue: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: '700',
  },
  securityFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  securityText: {
    color: '#CCC',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  helpText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  supportButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  escrowExplanation: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  infoModalCloseButton: {
    backgroundColor: '#3498DB',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoModalCloseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CheckoutScreen;