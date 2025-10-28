import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { cartAPI, CartItem, CartSummary } from '../services/cartAPI';
import { checkoutAPI } from '../services/checkoutAPI';
import { productsAPI } from '../services/productsAPI';
import { useAuth } from './AuthContext';

export interface CartState {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  loading: boolean;
  isVisible: boolean;
}

export interface CartContextType extends CartState {
  // Cart actions
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  
  // Modal actions
  showCart: () => void;
  hideCart: () => void;
  
  // Booking actions
  addServiceToCart: (serviceId: string, date: Date, time: string, notes?: string) => Promise<void>;
  
  // Data refresh
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [cartState, setCartState] = useState<CartState>({
    items: [],
    itemCount: 0,
    totalAmount: 0,
    loading: false,
    isVisible: false,
  });

  // Load cart data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      refreshCart();
    }
  }, [isAuthenticated, isLoading]);

  const refreshCart = async () => {
    try {
      setCartState(prev => ({ ...prev, loading: true }));

      const [items, summary] = await Promise.all([
        cartAPI.getCartItems().catch((err) => {
          console.error('Failed to get cart items:', err);
          return [];
        }),
        cartAPI.getCartSummary().catch((err) => {
          console.error('Failed to get cart summary:', err);
          return { total: 0 };
        })
      ]);

      console.log('📦 Cart refreshed - Items:', items.length, 'Total count:', items.reduce((total, item) => total + item.quantity, 0));

      setCartState(prev => ({
        ...prev,
        items,
        itemCount: items.reduce((total, item) => total + item.quantity, 0),
        totalAmount: summary.total || 0,
        loading: false,
      }));
    } catch (error) {
      console.error('Error refreshing cart:', error);
      // Set fallback empty state
      setCartState(prev => ({
        ...prev,
        items: [],
        itemCount: 0,
        totalAmount: 0,
        loading: false
      }));
    }
  };

  const addToCart = async (productId: string, quantity: number = 1) => {
    try {
      setCartState(prev => ({ ...prev, loading: true }));
      
      try {
        // Try to add to backend cart
        await cartAPI.addToCart({
          productId,
          quantity,
          price: 0 // Backend will fetch current price
        });
        
        await refreshCart();
      } catch (apiError) {
        console.warn('Backend cart API failed, using local fallback:', apiError);
        
        // Fallback: Simulate adding to local cart state
        // In a real app, you might want to queue this for later sync
        setCartState(prev => ({
          ...prev,
          itemCount: prev.itemCount + quantity,
          loading: false
        }));
      }
      
      // Show success feedback regardless of backend success
      Alert.alert('Added to Cart', 'Item has been added to your cart!', [
        { text: 'Continue Shopping', style: 'default' },
        { text: 'View Cart', style: 'default', onPress: showCart }
      ]);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart. Please try again.');
      setCartState(prev => ({ ...prev, loading: false }));
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      console.log('🗑️ CartContext: Removing item from cart:', itemId);
      console.log('📊 CartContext: Current cart before removal:', {
        totalItems: cartState.items.length,
        items: cartState.items.map(i => ({ id: i.id, name: i.productName }))
      });
      setCartState(prev => ({ ...prev, loading: true }));

      try {
        await cartAPI.removeFromCart(itemId);
        console.log('✅ CartContext: Item removed from backend, refreshing cart...');
        await refreshCart();
        console.log('✅ CartContext: Cart refresh complete after removal');
        console.log('📊 CartContext: Cart after refresh:', {
          totalItems: cartState.items.length,
          items: cartState.items.map(i => ({ id: i.id, name: i.productName }))
        });
      } catch (apiError) {
        console.warn('CartContext: Backend cart API failed for remove operation:', apiError);
        // Fallback: Update local state
        setCartState(prev => {
          const newCount = Math.max(0, prev.itemCount - 1);
          console.log('📦 CartContext: Fallback: Updating local cart count to', newCount);
          return {
            ...prev,
            itemCount: newCount,
            loading: false
          };
        });
      }
    } catch (error) {
      console.error('CartContext: Error removing from cart:', error);
      Alert.alert('Error', 'Failed to remove item from cart.');
      setCartState(prev => ({ ...prev, loading: false }));
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      setCartState(prev => ({ ...prev, loading: true }));
      
      if (quantity <= 0) {
        await removeFromCart(itemId);
        return;
      }
      
      await cartAPI.updateCartItem(itemId, { quantity });
      await refreshCart();
    } catch (error) {
      console.error('Error updating cart quantity:', error);
      Alert.alert('Error', 'Failed to update item quantity.');
      setCartState(prev => ({ ...prev, loading: false }));
    }
  };

  const clearCart = async () => {
    try {
      setCartState(prev => ({ ...prev, loading: true }));
      
      try {
        await cartAPI.clearCart();
      } catch (apiError) {
        console.warn('Backend cart API failed for clear operation:', apiError);
        // Continue with local clear regardless
      }
      
      setCartState(prev => ({
        ...prev,
        items: [],
        itemCount: 0,
        totalAmount: 0,
        loading: false,
      }));
    } catch (error) {
      console.error('Error clearing cart:', error);
      Alert.alert('Error', 'Failed to clear cart.');
      setCartState(prev => ({ ...prev, loading: false }));
    }
  };

  const addServiceToCart = async (serviceId: string, date: Date, time: string, notes?: string) => {
    try {
      setCartState(prev => ({ ...prev, loading: true }));

      // All services require date and time for booking
      const bookingData = {
        serviceId,
        scheduledDate: date.toISOString(),
        scheduledTime: time,
        notes
      };

      // Create service booking and add to cart
      await checkoutAPI.addServiceBooking(bookingData);

      await refreshCart();

      Alert.alert('Added to Cart', 'Service has been added to your cart!', [
        { text: 'Continue', style: 'default' },
        { text: 'View Cart', style: 'default', onPress: showCart }
      ]);
    } catch (error) {
      console.error('Error adding service to cart:', error);
      Alert.alert('Error', 'Failed to add service to cart. Please try again.');
      setCartState(prev => ({ ...prev, loading: false }));
    }
  };

  const showCart = () => {
    setCartState(prev => ({ ...prev, isVisible: true }));
  };

  const hideCart = () => {
    setCartState(prev => ({ ...prev, isVisible: false }));
  };

  const value: CartContextType = {
    ...cartState,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    showCart,
    hideCart,
    addServiceToCart,
    refreshCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};