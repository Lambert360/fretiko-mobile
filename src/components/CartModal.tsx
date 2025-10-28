import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import { CartItem } from '../services/cartAPI';
import { walletAPI } from '../services/walletAPI';

const { width, height } = Dimensions.get('window');

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
}

const CartModal: React.FC<CartModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { items, itemCount, loading, updateQuantity, removeFromCart } = useCart();
  
  // Selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Auto-select all items when modal opens
  React.useEffect(() => {
    if (visible && items.length > 0 && selectedItems.size === 0) {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  }, [visible, items]);

  // Group items by vendor
  const vendorGroups = useMemo(() => {
    const groups = items.reduce((acc, item) => {
      const vendorId = item.sellerId || 'unknown';
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendorId,
          vendorName: item.sellerName || 'Unknown Seller',
          items: [],
          selectedCount: 0,
          selectedSubtotal: 0,
        };
      }
      acc[vendorId].items.push(item);
      
      // Calculate selected items for this vendor
      if (selectedItems.has(item.id)) {
        acc[vendorId].selectedCount++;
        acc[vendorId].selectedSubtotal += item.price * item.quantity;
      }
      
      return acc;
    }, {} as Record<string, { vendorId: string; vendorName: string; items: CartItem[]; selectedCount: number; selectedSubtotal: number }>);

    return Object.values(groups);
  }, [items, selectedItems]);

  const isMultiVendor = vendorGroups.length > 1;

  // Calculate selected summary
  const selectedSummary = useMemo(() => {
    const selectedCartItems = items.filter(item => selectedItems.has(item.id));
    const subtotal = selectedCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
      itemsCount: selectedCartItems.length,
      subtotal,
      total: subtotal,
    };
  }, [items, selectedItems]);

  // Selection handlers
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  const toggleVendorSelection = (vendorId: string) => {
    const vendorGroup = vendorGroups.find(g => g.vendorId === vendorId);
    if (!vendorGroup) return;

    const allSelected = vendorGroup.items.every(item => selectedItems.has(item.id));
    
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      vendorGroup.items.forEach(item => {
        if (allSelected) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
      });
      return newSet;
    });
  };

  const handleCheckout = () => {
    if (selectedItems.size === 0) {
      return;
    }

    // Get product/service IDs from selected cart items
    const selectedCartItems = items.filter(item => selectedItems.has(item.id));
    const selectedProductServiceIds = selectedCartItems
      .map(item => item.productId || item.serviceId)
      .filter(Boolean) as string[];

    // Close modal and navigate to checkout with selection
    onClose();
    navigation.navigate('Checkout', {
      selectedItemIds: selectedProductServiceIds,
      selectedCartItemIds: Array.from(selectedItems),
    });
  };

  const renderCartItem = (item: CartItem) => {
    const isSelected = selectedItems.has(item.id);
    
    return (
      <View 
        key={item.id}
        style={[
          styles.cartItem,
          !isSelected && styles.cartItemUnselected
        ]}
      >
        {/* Selection Checkbox */}
        <TouchableOpacity
          onPress={() => toggleItemSelection(item.id)}
          style={styles.checkbox}
          activeOpacity={0.7}
        >
          <View style={[styles.checkboxInner, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
        </TouchableOpacity>

        <Image 
          source={{ uri: item.productImage || 'https://via.placeholder.com/80x80' }}
          style={styles.itemImage}
        />
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
          <Text style={styles.itemPrice}>{walletAPI.formatFreti(item.price)}</Text>
          
          {item.serviceDate && (
            <Text style={styles.serviceInfo}>
              📅 {new Date(item.serviceDate).toLocaleDateString()} at {item.serviceTime}
            </Text>
          )}
        </View>
        
        <View style={styles.quantityControls}>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
          >
            <Ionicons name="remove" size={14} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.quantityText}>{item.quantity}</Text>
          
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
          >
            <Ionicons name="add" size={14} color="white" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => removeFromCart(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#FF4757" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyCart}>
      <Ionicons name="cart-outline" size={80} color="#666" />
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptySubtitle}>Add some products to get started!</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Shopping Cart</Text>
            {items.length > 0 && (
              <Text style={styles.selectionCounter}>
                {selectedItems.size} of {items.length} selected
              </Text>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={toggleSelectAll}
          >
            <Ionicons 
              name={selectedItems.size === items.length ? "checkbox" : "square-outline"} 
              size={24} 
              color={selectedItems.size === items.length ? "#3498DB" : "#FFF"} 
            />
          </TouchableOpacity>
        </View>

        {/* Cart Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498DB" />
            <Text style={styles.loadingText}>Loading cart...</Text>
          </View>
        ) : items.length === 0 ? (
          renderEmptyCart()
        ) : (
          <>
            {/* Multi-vendor notice */}
            {isMultiVendor && (
              <View style={styles.multiVendorNotice}>
                <Ionicons name="storefront" size={16} color="#3498DB" />
                <Text style={styles.multiVendorText}>
                  {vendorGroups.length} vendors • Items grouped by seller
                </Text>
              </View>
            )}

            {/* Vendor-Grouped Items */}
            <ScrollView 
              style={styles.cartList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {vendorGroups.map((group, groupIndex) => {
                const allVendorItemsSelected = group.items.every(item => selectedItems.has(item.id));
                
                return (
                  <View key={group.vendorId} style={styles.vendorGroup}>
                    {/* Vendor Header (only show if multi-vendor) */}
                    {isMultiVendor && (
                      <TouchableOpacity 
                        style={styles.vendorHeader}
                        onPress={() => toggleVendorSelection(group.vendorId)}
                        activeOpacity={0.7}
                      >
                        <Ionicons 
                          name={allVendorItemsSelected ? "checkbox" : "square-outline"} 
                          size={16} 
                          color={allVendorItemsSelected ? "#3498DB" : "#888"} 
                        />
                        <Ionicons name="storefront" size={14} color="#3498DB" style={{ marginLeft: 8 }} />
                        <Text style={styles.vendorName}>{group.vendorName}</Text>
                        <Text style={styles.vendorItemCount}>
                          {group.selectedCount}/{group.items.length}
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    {/* Vendor Items */}
                    {group.items.map((item) => renderCartItem(item))}
                    
                    {/* Vendor Subtotal (only show if multi-vendor) */}
                    {isMultiVendor && (
                      <View style={styles.vendorSubtotal}>
                        <Text style={styles.vendorSubtotalLabel}>
                          Vendor Subtotal {group.selectedCount > 0 && `(${group.selectedCount} selected)`}
                        </Text>
                        <Text style={styles.vendorSubtotalAmount}>
                          {walletAPI.formatFreti(group.selectedSubtotal)}
                        </Text>
                      </View>
                    )}
                    
                    {/* Divider between vendors */}
                    {isMultiVendor && groupIndex < vendorGroups.length - 1 && (
                      <View style={styles.vendorDivider} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
            
            {/* Summary */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Selected Items ({selectedSummary.itemsCount})
                </Text>
                <Text style={styles.summaryValue}>{walletAPI.formatFreti(selectedSummary.subtotal)}</Text>
              </View>
              
              <View style={styles.infoNote}>
                <Ionicons name="information-circle-outline" size={14} color="#666" />
                <Text style={styles.infoNoteText}>
                  Shipping calculated at checkout
                </Text>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{walletAPI.formatFreti(selectedSummary.total)}</Text>
              </View>
            </View>
            
            {/* Checkout Button */}
            <View style={[styles.checkoutContainer, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity 
                style={[
                  styles.checkoutButton,
                  selectedItems.size === 0 && styles.checkoutButtonDisabled
                ]}
                onPress={handleCheckout}
                disabled={selectedItems.size === 0}
              >
                <Text style={styles.checkoutText}>
                  Checkout ({selectedItems.size} items)
                </Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectionCounter: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  multiVendorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  multiVendorText: {
    color: '#3498DB',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  cartList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  vendorGroup: {
    marginBottom: 16,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.2)',
  },
  vendorName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  vendorItemCount: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  vendorSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  vendorSubtotalLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  vendorSubtotalAmount: {
    color: '#3498DB',
    fontSize: 15,
    fontWeight: 'bold',
  },
  vendorDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  cartItemUnselected: {
    opacity: 0.5,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    color: '#27AE60',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  serviceInfo: {
    color: '#888',
    fontSize: 11,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  quantityButton: {
    backgroundColor: '#3498DB',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 12,
    minWidth: 18,
    textAlign: 'center',
  },
  removeButton: {
    padding: 6,
  },
  summary: {
    backgroundColor: '#1a1a1a',
    margin: 20,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 13,
  },
  summaryValue: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 10,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#252525',
    borderRadius: 6,
    marginVertical: 4,
    gap: 6,
  },
  infoNoteText: {
    fontSize: 11,
    color: '#888',
    flex: 1,
  },
  totalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  checkoutButton: {
    backgroundColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  checkoutText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default CartModal;
