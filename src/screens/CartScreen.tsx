import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  FlatList,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { cartAPI } from '../services/cartAPI';
import { wishlistAPI } from '../services/wishlistAPI';
import { walletAPI } from '../services/walletAPI';

const { width: screenWidth } = Dimensions.get('window');

interface CartScreenProps {
  navigation: any;
}

interface CartItem {
  id: string;
  productId?: string;
  serviceId?: string;
  productName: string;
  productImage: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  maxQuantity: number;
  sellerId: string;
  sellerName: string;
  category: string;
  discount?: number;
  serviceDate?: string;
  serviceTime?: string;
  serviceNotes?: string;
  sellerLocation?: { state?: string; country?: string; city?: string } | null;
  isOutOfState?: boolean;
  isOutOfCountry?: boolean;
}

interface CartSummary {
  itemsCount: number;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

const CartScreen: React.FC<CartScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartSummary, setCartSummary] = useState<CartSummary>({
    itemsCount: 0,
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingQuantity, setUpdatingQuantity] = useState<string | null>(null);
  
  // Selection state for selective checkout
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Calculate summary for selected items only
  const selectedSummary = React.useMemo(() => {
    const selected = cartItems.filter(item => selectedItems.has(item.id));
    
    const subtotal = selected.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = selected.reduce((sum, item) => sum + ((item.discount || 0) * item.quantity), 0);
    
    return {
      itemsCount: selected.length,
      subtotal,
      discount,
      shipping: 0, // Will be calculated in checkout
      tax: 0,
      total: subtotal - discount,
    };
  }, [cartItems, selectedItems]);

  // Group cart items by vendor
  const vendorGroups = React.useMemo(() => {
    const groups: { [key: string]: { vendorId: string; vendorName: string; items: CartItem[]; subtotal: number; selectedCount: number; selectedSubtotal: number } } = {};
    
    cartItems.forEach(item => {
      const vendorId = item.sellerId || 'unknown';
      if (!groups[vendorId]) {
        groups[vendorId] = {
          vendorId: vendorId,
          vendorName: item.sellerName || 'Unknown Vendor',
          items: [],
          subtotal: 0,
          selectedCount: 0,
          selectedSubtotal: 0,
        };
      }
      
      groups[vendorId].items.push(item);
      groups[vendorId].subtotal += item.price * item.quantity;
      
      if (selectedItems.has(item.id)) {
        groups[vendorId].selectedCount++;
        groups[vendorId].selectedSubtotal += item.price * item.quantity;
      }
    });
    
    return Object.values(groups);
  }, [cartItems, selectedItems]);

  useEffect(() => {
    loadCart();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Refresh cart whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 CartScreen focused - Refreshing cart...');
      loadCart();
    }, [])
  );

  const loadCart = async () => {
    try {
      setLoading(true);
      console.log('🛒 Loading cart items...');
      
      const [items, summary] = await Promise.all([
        cartAPI.getCartItems(),
        cartAPI.getCartSummary(),
      ]);
      
      console.log('🛒 Cart loaded:', {
        itemsCount: items.length,
        items: items.map(item => ({
          id: item.id,
          name: item.productName,
          quantity: item.quantity
        })),
        summary
      });
      
      setCartItems(items);
      setCartSummary(summary);
      
      // Select all items by default on initial load
      if (items.length > 0 && selectedItems.size === 0) {
        setSelectedItems(new Set(items.map(item => item.id)));
      }
    } catch (error) {
      console.error('❌ Error loading cart:', error);
      Alert.alert('Error', 'Failed to load cart items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCart();
  };

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    const item = cartItems.find(item => item.id === itemId);
    if (!item || newQuantity > item.maxQuantity) return;

    try {
      setUpdatingQuantity(itemId);
      
      // Optimistic update
      setCartItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
      
      await cartAPI.updateQuantity(itemId, newQuantity);
      
      // Recalculate summary
      const summary = await cartAPI.getCartSummary();
      setCartSummary(summary);
    } catch (error) {
      console.error('Error updating quantity:', error);
      // Revert optimistic update
      loadCart();
      Alert.alert('Error', 'Failed to update quantity');
    } finally {
      setUpdatingQuantity(null);
    }
  };

  const handleRemoveItem = async (itemId: string, productName: string) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove "${productName}" from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await cartAPI.removeItem(itemId);
              loadCart(); // Reload cart
              Alert.alert('Removed', 'Item removed from cart');
            } catch (error) {
              console.error('Error removing item:', error);
              Alert.alert('Error', 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  const handleAddToWishlist = async (item: CartItem) => {
    try {
      // Check if it's a service - wishlist currently only supports products
      if (item.serviceId || !item.productId) {
        Alert.alert(
          'Service Not Supported',
          'Wishlist currently only supports products. Services cannot be added to your wishlist at this time.',
          [{ text: 'OK' }]
        );
        return;
      }

      await wishlistAPI.addToWishlist({
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        price: item.price,
      });
      Alert.alert('Added to Wishlist', `${item.productName} has been added to your wishlist!`);
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      Alert.alert('Error', 'Failed to add item to wishlist');
    }
  };

  const handleClearCart = async () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await cartAPI.clearCart();
              loadCart();
              Alert.alert('Cleared', 'All items removed from cart');
            } catch (error) {
              console.error('Error clearing cart:', error);
              Alert.alert('Error', 'Failed to clear cart');
            }
          },
        },
      ]
    );
  };

  // Selection handlers
  const toggleItemSelection = (itemId: string) => {
    // Find the item to log its details
    const item = cartItems.find(i => i.id === itemId);
    
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      const isCurrentlySelected = newSet.has(itemId);
      
      if (isCurrentlySelected) {
        console.log(`❌ DESELECTING: ${item?.productName} (cart_item_id: ${itemId}, product/service_id: ${item?.productId || item?.serviceId})`);
        newSet.delete(itemId);
      } else {
        console.log(`✅ SELECTING: ${item?.productName} (cart_item_id: ${itemId}, product/service_id: ${item?.productId || item?.serviceId})`);
        newSet.add(itemId);
      }
      
      console.log(`📊 New selection state: ${Array.from(newSet).join(', ')}`);
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedItems(new Set(cartItems.map(item => item.id)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === cartItems.length) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  const selectVendorItems = (vendorId: string) => {
    const vendorGroup = vendorGroups.find(g => g.vendorId === vendorId);
    if (!vendorGroup) return;

    setSelectedItems(prev => {
      const newSet = new Set(prev);
      vendorGroup.items.forEach(item => newSet.add(item.id));
      return newSet;
    });
  };

  const deselectVendorItems = (vendorId: string) => {
    const vendorGroup = vendorGroups.find(g => g.vendorId === vendorId);
    if (!vendorGroup) return;

    setSelectedItems(prev => {
      const newSet = new Set(prev);
      vendorGroup.items.forEach(item => newSet.delete(item.id));
      return newSet;
    });
  };

  const toggleVendorSelection = (vendorId: string) => {
    const vendorGroup = vendorGroups.find(g => g.vendorId === vendorId);
    if (!vendorGroup) return;

    const allSelected = vendorGroup.items.every(item => selectedItems.has(item.id));
    if (allSelected) {
      deselectVendorItems(vendorId);
    } else {
      selectVendorItems(vendorId);
    }
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before proceeding');
      return;
    }

    if (selectedItems.size === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to checkout');
      return;
    }

    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();

    // Debug: Log all cart items
    console.log('🛒 ALL CART ITEMS:');
    cartItems.forEach(item => {
      console.log(`  - ${item.productName}: cart_item_id=${item.id}, product/service_id=${item.productId || item.serviceId}`);
    });

    // Debug: Log selected items
    console.log('✅ SELECTED CART ITEM IDs:', Array.from(selectedItems));

    // Get the actual product/service IDs from selected cart items
    const selectedCartItems = cartItems.filter(item => selectedItems.has(item.id));
    
    console.log('🎯 FILTERED CART ITEMS:');
    selectedCartItems.forEach(item => {
      console.log(`  - ${item.productName}: cart_item_id=${item.id}, product/service_id=${item.productId || item.serviceId}`);
    });

    const selectedProductServiceIds = selectedCartItems
      .map(item => item.productId || item.serviceId)
      .filter(Boolean) as string[];

    console.log('📦 Final product/service IDs for checkout:', selectedProductServiceIds);
    console.log('🗑️ Final cart item IDs for removal:', Array.from(selectedItems));

    // Pass both cart item IDs and product/service IDs to checkout
    navigation.navigate('Checkout', {
      selectedItemIds: selectedProductServiceIds, // For filtering checkout items
      selectedCartItemIds: Array.from(selectedItems), // For removing from cart after purchase
    });
  };

  const handleProductPress = (item: CartItem) => {
    if (item.productId) {
      navigation.navigate('ProductDetails', { productId: item.productId });
    } else if (item.serviceId) {
      navigation.navigate('ServiceDetails', { serviceId: item.serviceId });
    }
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isSelected = selectedItems.has(item.id);
    
    return (
    <View style={[styles.cartItem, !isSelected && styles.cartItemUnselected]}>
      {/* Selection Checkbox */}
      <TouchableOpacity 
        onPress={() => toggleItemSelection(item.id)} 
        style={styles.checkbox}
        activeOpacity={0.7}
      >
        <View style={[styles.checkboxInner, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handleProductPress(item)}>
        <Image source={{ uri: item.productImage }} style={styles.productImage} />
        {item.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}% OFF</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <View style={styles.itemInfo}>
        <TouchableOpacity onPress={() => handleProductPress(item)}>
          <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>
        </TouchableOpacity>
        
        <View style={styles.sellerInfoRow}>
          <Text style={styles.sellerName}>by {item.sellerName}</Text>
          {item.isOutOfCountry ? (
            <View style={styles.outOfStateBadge}>
              <Ionicons name="globe-outline" size={10} color="#FF6B35" />
              <Text style={styles.outOfStateText}>International</Text>
            </View>
          ) : item.isOutOfState ? (
            <View style={styles.outOfStateBadge}>
              <Ionicons name="navigate-outline" size={10} color="#FF6B35" />
              <Text style={styles.outOfStateText}>Out-of-State</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.category}>{item.category}</Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>{walletAPI.formatFreti(item.price)}</Text>
          {item.originalPrice && (
            <Text style={styles.originalPrice}>{walletAPI.formatFreti(item.originalPrice)}</Text>
          )}
        </View>
        
        <View style={styles.itemActions}>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1 || updatingQuantity === item.id}
            >
              <Ionicons 
                name="remove" 
                size={16} 
                color={item.quantity <= 1 ? '#666' : '#FFF'} 
              />
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{item.quantity}</Text>
            
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
              disabled={item.quantity >= item.maxQuantity || updatingQuantity === item.id}
            >
              <Ionicons 
                name="add" 
                size={16} 
                color={item.quantity >= item.maxQuantity ? '#666' : '#FFF'} 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.wishlistButton}
              onPress={() => handleAddToWishlist(item)}
            >
              <Ionicons name="heart-outline" size={16} color="#E74C3C" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveItem(item.id, item.productName)}
            >
              <Ionicons name="trash-outline" size={16} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        </View>
        
        {updatingQuantity === item.id && (
          <View style={styles.updatingOverlay}>
            <Text style={styles.updatingText}>Updating...</Text>
          </View>
        )}
      </View>
    </View>
    );
  };

  const renderEmptyCart = () => (
    <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="cart-outline" size={64} color="#666" />
      </View>
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptySubtitle}>
        Start shopping to add items to your cart
      </Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('Main', { screen: 'Home' })}
      >
        <Text style={styles.shopButtonText}>Start Shopping</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderCartSummary = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity style={styles.clearCartButton} onPress={handleClearCart}>
            <Text style={styles.clearCartText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>
          Selected Items ({selectedSummary.itemsCount})
        </Text>
        <Text style={styles.summaryValue}>{walletAPI.formatFreti(selectedSummary.subtotal)}</Text>
      </View>
      
      {selectedSummary.discount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Discount</Text>
          <Text style={[styles.summaryValue, styles.discountValue]}>
            -{walletAPI.formatFreti(selectedSummary.discount)}
          </Text>
        </View>
      )}
      
      <View style={styles.summaryNote}>
        <Ionicons name="information-circle-outline" size={16} color="#666" />
        <Text style={styles.summaryNoteText}>
          Shipping calculated at checkout
        </Text>
      </View>
      
      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{walletAPI.formatFreti(selectedSummary.total)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading cart...</Text>
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            Cart ({cartItems.length})
          </Text>
          {cartItems.length > 0 && (
            <Text style={styles.selectionCounter}>
              {selectedItems.size} of {cartItems.length} selected
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => navigation.navigate('Wishlist')}
          >
            <Ionicons name="heart-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={toggleSelectAll}
          >
            <Ionicons 
              name={selectedItems.size === cartItems.length ? "checkbox" : "square-outline"} 
              size={24} 
              color={selectedItems.size === cartItems.length ? "#3498DB" : "#FFF"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {cartItems.length === 0 ? (
        renderEmptyCart()
      ) : (
        <>
          {/* Render cart based on vendor count */}
          {vendorGroups.length === 1 ? (
            // Single vendor - use traditional flat list
            <FlatList
              data={cartItems}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.listContainer, { paddingBottom: 140 + (insets.bottom || 0) }]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#3498DB"
                />
              }
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          ) : (
            // Multi-vendor - show grouped view
            <ScrollView
              contentContainerStyle={[styles.listContainer, { paddingBottom: 140 + (insets.bottom || 0) }]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#3498DB"
                />
              }
            >
              {/* Multi-Vendor Notice */}
              <View style={styles.multiVendorNotice}>
                <Ionicons name="information-circle" size={20} color="#FF9500" />
                <Text style={styles.multiVendorText}>
                  Your cart contains items from {vendorGroups.length} vendors. Orders will be split and tracked separately for easier delivery.
                </Text>
              </View>

              {/* Render Grouped Cart Items */}
              {vendorGroups.map((group, groupIndex) => {
                const allVendorItemsSelected = group.items.every(item => selectedItems.has(item.id));
                
                return (
                <View key={group.vendorId} style={styles.vendorGroup}>
                  {/* Vendor Header */}
                  <TouchableOpacity 
                    style={styles.vendorHeader}
                    onPress={() => toggleVendorSelection(group.vendorId)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={allVendorItemsSelected ? "checkbox" : "square-outline"} 
                      size={18} 
                      color={allVendorItemsSelected ? "#3498DB" : "#007AFF"} 
                    />
                    <Ionicons name="storefront" size={16} color="#007AFF" style={{ marginLeft: 8 }} />
                    <Text style={styles.vendorName}>{group.vendorName}</Text>
                    <Text style={styles.vendorItemCount}>
                      {group.selectedCount}/{group.items.length}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Vendor Items */}
                  {group.items.map((item) => (
                    <View key={item.id}>
                      {renderCartItem({ item })}
                    </View>
                  ))}
                  
                  {/* Vendor Subtotal */}
                  <View style={styles.vendorSubtotal}>
                    <Text style={styles.vendorSubtotalLabel}>
                      Vendor Subtotal {group.selectedCount > 0 && `(${group.selectedCount} selected)`}
                    </Text>
                    <Text style={styles.vendorSubtotalAmount}>
                      {walletAPI.formatFreti(group.selectedSubtotal)}
                    </Text>
                  </View>
                  
                  {/* Divider between vendors */}
                  {groupIndex < vendorGroups.length - 1 && <View style={styles.vendorDivider} />}
                </View>
                );
              })}
            </ScrollView>
          )}
          
          {renderCartSummary()}
          
          {/* Bottom Action Bar */}
          <Animated.View
            style={[
              styles.bottomBar,
              { transform: [{ scale: scaleAnim }] },
              { paddingBottom: Math.max(insets.bottom || 0, 12) + 12 },
            ]}
          >
            <View style={styles.totalPreview}>
              <Text style={styles.totalPreviewLabel}>
                Selected Total {selectedItems.size > 0 && `(${selectedItems.size} items)`}
              </Text>
              <Text style={styles.totalPreviewValue}>
                {walletAPI.formatFreti(selectedSummary.total)}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.checkoutButton,
                selectedItems.size === 0 && styles.checkoutButtonDisabled
              ]}
              onPress={handleProceedToCheckout}
              disabled={selectedItems.size === 0}
            >
              <Text style={styles.checkoutButtonText}>Checkout</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
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
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  selectionCounter: {
    color: '#3498DB',
    fontSize: 12,
    marginTop: 2,
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
  listContainer: {
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cartItemUnselected: {
    opacity: 0.5,
  },
  checkbox: {
    marginRight: 12,
    justifyContent: 'center',
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxSelected: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  discountBadge: {
    position: 'absolute',
    top: -4,
    right: 12,
    backgroundColor: '#E74C3C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sellerName: {
    color: '#666',
    fontSize: 12,
    marginBottom: 2,
  },
  sellerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  outOfStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3EE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  outOfStateText: {
    color: '#FF6B35',
    fontSize: 9,
    fontWeight: '600',
  },
  category: {
    color: '#666',
    fontSize: 11,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  currentPrice: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  originalPrice: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  quantityText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  wishlistButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updatingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  itemSeparator: {
    height: 16,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  clearCartButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  clearCartText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: '600',
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
  discountValue: {
    color: '#27AE60',
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
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#3498DB',
    borderRadius: 24,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.5,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  shopButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: '#3498DB',
    borderRadius: 24,
  },
  shopButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginVertical: 8,
    gap: 8,
  },
  summaryNoteText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  // Multi-vendor grouping styles
  vendorGroup: {
    marginBottom: 20,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  vendorItemCount: {
    fontSize: 14,
    color: '#666',
  },
  vendorSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    marginTop: 8,
    marginHorizontal: 16,
  },
  vendorSubtotalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  vendorSubtotalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  vendorDivider: {
    height: 2,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
    marginHorizontal: 16,
  },
  multiVendorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  multiVendorText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});

export default CartScreen;