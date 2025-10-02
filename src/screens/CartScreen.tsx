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
import { useAuth } from '../contexts/AuthContext';
import { cartAPI } from '../services/cartAPI';
import { productsAPI } from '../services/productsAPI';
import { walletAPI } from '../services/walletAPI';

const { width: screenWidth } = Dimensions.get('window');

interface CartScreenProps {
  navigation: any;
}

interface CartItem {
  id: string;
  productId: string;
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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadCart();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

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
      await productsAPI.addToWishlist({
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

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before proceeding');
      return;
    }

    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
    ]).start();

    navigation.navigate('Checkout');
  };

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetails', { productId });
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <TouchableOpacity onPress={() => handleProductPress(item.productId)}>
        <Image source={{ uri: item.productImage }} style={styles.productImage} />
        {item.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}% OFF</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <View style={styles.itemInfo}>
        <TouchableOpacity onPress={() => handleProductPress(item.productId)}>
          <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>
        </TouchableOpacity>
        
        <Text style={styles.sellerName}>by {item.sellerName}</Text>
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
        onPress={() => navigation.navigate('Home', { screen: 'HomeTab' })}
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
        <Text style={styles.summaryLabel}>Items ({cartSummary.itemsCount})</Text>
        <Text style={styles.summaryValue}>{walletAPI.formatFreti(cartSummary.subtotal)}</Text>
      </View>
      
      {cartSummary.discount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Discount</Text>
          <Text style={[styles.summaryValue, styles.discountValue]}>
            -{walletAPI.formatFreti(cartSummary.discount)}
          </Text>
        </View>
      )}
      
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Shipping</Text>
        <Text style={styles.summaryValue}>
          {cartSummary.shipping > 0 ? walletAPI.formatFreti(cartSummary.shipping) : 'Free'}
        </Text>
      </View>
      
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Tax</Text>
        <Text style={styles.summaryValue}>{walletAPI.formatFreti(cartSummary.tax)}</Text>
      </View>
      
      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{walletAPI.formatFreti(cartSummary.total)}</Text>
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
        <Text style={styles.headerTitle}>
          Cart ({cartItems.length})
        </Text>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => navigation.navigate('Wishlist')}
        >
          <Ionicons name="heart-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {cartItems.length === 0 ? (
        renderEmptyCart()
      ) : (
        <>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
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
          
          {renderCartSummary()}
          
          {/* Bottom Action Bar */}
          <Animated.View style={[styles.bottomBar, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.totalPreview}>
              <Text style={styles.totalPreviewLabel}>Total</Text>
              <Text style={styles.totalPreviewValue}>{walletAPI.formatFreti(cartSummary.total)}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={handleProceedToCheckout}
            >
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
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
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
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
});

export default CartScreen;