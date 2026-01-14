import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { wishlistAPI, WishlistItem } from '../services/wishlistAPI';
import { walletAPI } from '../services/walletAPI';
import { WishlistAddItemDrawer } from '../components/WishlistAddItemDrawer';
import MultiStepGiftPurchase from '../components/MultiStepGiftPurchase';
import { realtimeAPI } from '../services/realtimeAPI';

interface SharedWishlistScreenProps {
  navigation: any;
  route: any;
}

const SharedWishlistScreen: React.FC<SharedWishlistScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { ownerId, ownerUsername } = route.params || {};

  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canAddItems, setCanAddItems] = useState(false);
  const [isAddDrawerVisible, setIsAddDrawerVisible] = useState(false);
  const [isMultiStepGiftVisible, setIsMultiStepGiftVisible] = useState(false);
  const [selectedGiftItems, setSelectedGiftItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    loadSharedWishlist();
  }, [ownerId]);

  // 🔥 NEW: Join wishlist room for real-time updates
  useEffect(() => {
    if (!ownerId || !realtimeAPI.isConnected()) {
      console.log('⚠️ WebSocket not connected or ownerId missing, skipping wishlist room join');
      return;
    }

    // Join the wishlist room to receive updates
    realtimeAPI.joinWishlist(ownerId);

    // Cleanup: Leave the room when component unmounts
    return () => {
      realtimeAPI.leaveWishlist(ownerId);
    };
  }, [ownerId]); // Re-join if ownerId changes

  // 🔥 NEW: WebSocket subscriptions for real-time wishlist updates
  useEffect(() => {
    if (!ownerId || !realtimeAPI.isConnected()) {
      console.log('⚠️ WebSocket not connected or ownerId missing, skipping wishlist subscriptions');
      return;
    }

    console.log('🔌 Setting up WebSocket listeners for shared wishlist:', ownerId);

    // Subscribe to wishlist item gift ordered event (when someone purchases an item)
    const giftOrderedListener = realtimeAPI.subscribe('wishlist_item_gift_ordered', (data: any) => {
      console.log('🎁 Wishlist gift order received:', data);
      
      // Only update if this is for this owner's wishlist
      if (data.wishlistItemId) {
        setWishlistItems(prevItems => {
          return prevItems.map(item => {
            if (item.id === data.wishlistItemId) {
              // Update item with gift order status
              return {
                ...item,
                giftOrderStatus: {
                  status: data.giftOrderStatus?.status || data.orderStatus || 'pending',
                  orderId: data.orderId,
                  orderNumber: data.orderNumber || null,
                  orderStatus: data.giftOrderStatus?.orderStatus || data.orderStatus || null,
                },
              };
            }
            return item;
          });
        });
        
        console.log(`✅ Updated wishlist item ${data.wishlistItemId} with gift order status`);
      }
    });

    // Subscribe to gift order status update (when order status changes)
    const giftStatusUpdateListener = realtimeAPI.subscribe('gift_order_status_update', (data: any) => {
      console.log('📦 Gift order status update received:', data);
      
      // Only update if this is for this owner's wishlist
      if (data.wishlistItemId) {
        setWishlistItems(prevItems => {
          return prevItems.map(item => {
            if (item.id === data.wishlistItemId) {
              // Update item with new gift order status
              return {
                ...item,
                giftOrderStatus: {
                  status: data.giftOrderStatus?.status || data.orderStatus || 'pending',
                  orderId: data.orderId,
                  orderNumber: data.orderNumber || item.giftOrderStatus?.orderNumber || null,
                  orderStatus: data.giftOrderStatus?.orderStatus || data.orderStatus || null,
                },
              };
            }
            return item;
          });
        });
        
        console.log(`✅ Updated wishlist item ${data.wishlistItemId} with new status: ${data.orderStatus}`);
      }
    });

    // Subscribe to general order status updates (in case they come through the general channel)
    // Filter for orders that are gift orders for items in this wishlist
    const orderStatusListener = realtimeAPI.subscribe('order_status_update', (data: any) => {
      console.log('📦 Order status update received (checking if gift order):', data);
      
      // Check if this order is associated with any wishlist item in this list
      if (data.orderId) {
        setWishlistItems(prevItems => {
          let updated = false;
          const updatedItems = prevItems.map(item => {
            // If this item has a gift order with this orderId, update it
            if (item.giftOrderStatus?.orderId === data.orderId) {
              updated = true;
              return {
                ...item,
                giftOrderStatus: {
                  ...item.giftOrderStatus,
                  status: data.status,
                  orderStatus: data.status,
                },
              };
            }
            return item;
          });
          
          if (updated) {
            console.log(`✅ Updated wishlist item with order status: ${data.status}`);
          }
          
          return updatedItems;
        });
      }
    });

    // Cleanup subscriptions on unmount
    return () => {
      console.log('🔌 Cleaning up WebSocket listeners for shared wishlist:', ownerId);
      giftOrderedListener();
      giftStatusUpdateListener();
      orderStatusListener();
    };
  }, [ownerId]); // Re-subscribe if ownerId changes

  const loadSharedWishlist = async () => {
    try {
      setLoading(true);

      // Get the shared wishlist items (selective sharing)
      const items = await wishlistAPI.getSharedWishlistItems(ownerId);
      setWishlistItems(items);

      // Check permission from first item (all items have same permission)
      if (items.length > 0 && items[0].canAddItems !== undefined) {
        setCanAddItems(items[0].canAddItems);
      } else {
        // If no items or no permission info, assume view-only
        setCanAddItems(false);
      }
    } catch (error: any) {
      console.error('Error loading shared wishlist:', error);
      Alert.alert('Error', error.message || 'Failed to load wishlist');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSharedWishlist();
  };

  const handleBuyAsGift = (item: WishlistItem) => {
    setSelectedGiftItems([item]);
    setIsMultiStepGiftVisible(true);
  };

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetails', { productId });
  };

  const handleAddItemToWishlist = () => {
    // Open the add item drawer
    setIsAddDrawerVisible(true);
  };

  const handleItemAdded = () => {
    // Refresh the wishlist when an item is added
    loadSharedWishlist();
  };

  const calculateTotalPrice = () => {
    // Only calculate total for unpurchased items
    const unpurchasedItems = wishlistItems.filter(item => !item.giftOrderStatus);
    return unpurchasedItems.reduce((total, item) => total + item.price, 0);
  };

  // 🔥 NEW: Helper function to check purchase status of all items
  const getAllItemsPurchaseStatus = () => {
    if (wishlistItems.length === 0) {
      return { allPurchased: false, allCompleted: false, hasProcessing: false };
    }

    const purchasedItems = wishlistItems.filter(item => item.giftOrderStatus);
    const allPurchased = purchasedItems.length === wishlistItems.length;
    
    if (!allPurchased) {
      return { allPurchased: false, allCompleted: false, hasProcessing: false };
    }

    // All items are purchased, check their statuses
    const completedItems = purchasedItems.filter(item => {
      const status = item.giftOrderStatus?.orderStatus || item.giftOrderStatus?.status;
      return status === 'completed' || status === 'delivered';
    });
    
    const processingItems = purchasedItems.filter(item => {
      const status = item.giftOrderStatus?.orderStatus || item.giftOrderStatus?.status;
      return status && status !== 'completed' && status !== 'delivered' && status !== 'cancelled';
    });

    const allCompleted = completedItems.length === wishlistItems.length;
    const hasProcessing = processingItems.length > 0;

    return { allPurchased: true, allCompleted, hasProcessing };
  };

  const handleBuyAllAsGift = () => {
    if (wishlistItems.length === 0) {
      Alert.alert('Empty Wishlist', 'There are no items in this wishlist to purchase.');
      return;
    }

    // Filter out items that already have gift orders
    const unpurchasedItems = wishlistItems.filter(item => !item.giftOrderStatus);
    
    if (unpurchasedItems.length === 0) {
      Alert.alert('All Items Purchased', 'All items in this wishlist have already been purchased.');
      return;
    }

    setSelectedGiftItems(unpurchasedItems);
    setIsMultiStepGiftVisible(true);
  };

  const handleGiftPurchaseComplete = () => {
    // Refresh the wishlist to show updated items
    loadSharedWishlist();
  };

  const getOrderStatusBadge = (item: WishlistItem) => {
    if (!item.giftOrderStatus) return null;
    
    const status = item.giftOrderStatus.orderStatus || item.giftOrderStatus.status;
    let badgeColor = '#3498DB';
    let statusText = 'Order Created';
    let statusIcon: 'checkmark-circle' | 'time' | 'checkmark-done-circle' = 'checkmark-circle';
    
    if (status === 'completed' || status === 'delivered') {
      badgeColor = '#27AE60';
      statusText = 'Completed';
      statusIcon = 'checkmark-done-circle';
    } else if (status === 'confirmed' || status === 'preparing' || status === 'ready' || status === 'processing') {
      badgeColor = '#F39C12';
      statusText = 'Processing';
      statusIcon = 'time';
    } else if (status === 'pending') {
      badgeColor = '#3498DB';
      statusText = 'Order Created';
      statusIcon = 'checkmark-circle';
    }
    
    return (
      <View style={[styles.orderStatusBadge, { backgroundColor: badgeColor + '20', borderColor: badgeColor }]}>
        <Ionicons name={statusIcon} size={14} color={badgeColor} />
        <Text style={[styles.orderStatusText, { color: badgeColor }]}>{statusText}</Text>
      </View>
    );
  };

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => (
    <TouchableOpacity
      style={styles.wishlistItem}
      onPress={() => handleProductPress(item.productId)}
    >
      <Image source={{ uri: item.productImage }} style={styles.productImage} />

      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>
          {item.giftOrderStatus && getOrderStatusBadge(item)}
        </View>
        
        <Text style={styles.productPrice}>{walletAPI.formatFreti(item.price)}</Text>
        <Text style={styles.addedDate}>
          {item.addedByFriend
            ? `Added by ${item.addedByFriend}`
            : `Added by ${ownerUsername || 'Owner'}`
          }
        </Text>

        {item.collaborationNote && (
          <Text style={styles.collaborationNote}>💬 {item.collaborationNote}</Text>
        )}

        {item.giftOrderStatus?.orderNumber && (
          <Text style={styles.orderNumber}>Order: {item.giftOrderStatus.orderNumber}</Text>
        )}

        {!item.giftOrderStatus && (
          <TouchableOpacity
            style={styles.giftButton}
            onPress={() => handleBuyAsGift(item)}
          >
            <Ionicons name="gift" size={16} color="#FFF" />
            <Text style={styles.giftButtonText}>Buy as Gift</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyWishlist = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="heart-outline" size={64} color="#666" />
      </View>
      <Text style={styles.emptyTitle}>Wishlist is empty</Text>
      <Text style={styles.emptySubtitle}>
        {ownerUsername || 'This user'} hasn't added any items yet
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading wishlist...</Text>
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
          <Text style={styles.headerTitle}>
            {ownerUsername ? `${ownerUsername}'s Wishlist` : 'Shared Wishlist'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {canAddItems && wishlistItems.length > 0 && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleAddItemToWishlist}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {wishlistItems.length === 0 ? (
        renderEmptyWishlist()
      ) : (
        <FlatList
          data={wishlistItems}
          renderItem={renderWishlistItem}
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
      )}

      {/* Add Item Drawer */}
      <WishlistAddItemDrawer
        visible={isAddDrawerVisible}
        onClose={() => setIsAddDrawerVisible(false)}
        ownerId={ownerId}
        onItemAdded={handleItemAdded}
      />

      <MultiStepGiftPurchase
        visible={isMultiStepGiftVisible}
        onClose={() => setIsMultiStepGiftVisible(false)}
        items={selectedGiftItems}
        recipientId={ownerId}
        recipientName={ownerUsername}
        onPurchaseComplete={handleGiftPurchaseComplete}
        navigation={navigation}
      />

      {/* Buy All as Gift Floating Action Button - Smart Button */}
      {wishlistItems.length > 0 && (() => {
        const purchaseStatus = getAllItemsPurchaseStatus();
        const isDisabled = purchaseStatus.allPurchased;
        const buttonText = purchaseStatus.allCompleted 
          ? 'All Completed' 
          : purchaseStatus.hasProcessing 
          ? 'Processing...' 
          : 'Buy All as Gift';
        
        return (
          <TouchableOpacity
            style={[
              styles.buyAllFAB,
              isDisabled && styles.buyAllFABDisabled
            ]}
            onPress={handleBuyAllAsGift}
            activeOpacity={isDisabled ? 1 : 0.9}
            disabled={isDisabled}
          >
            <View style={styles.fabContent}>
              <Ionicons 
                name={purchaseStatus.allCompleted ? "checkmark-circle" : purchaseStatus.hasProcessing ? "time" : "gift"} 
                size={24} 
                color={isDisabled ? "#999" : "#FFF"} 
              />
              <View style={styles.fabTextContainer}>
                <Text style={[styles.fabText, isDisabled && styles.fabTextDisabled]}>
                  {buttonText}
                </Text>
                {!isDisabled && (
                  <Text style={styles.fabPrice}>
                    {walletAPI.formatFreti(calculateTotalPrice())}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })()}
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
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#999',
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
    marginTop: 12,
  },
  listContainer: {
    padding: 16,
  },
  wishlistItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
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
  productPrice: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  addedDate: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  collaborationNote: {
    color: '#3498DB',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  giftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E91E63',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  giftButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemSeparator: {
    height: 16,
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
  },
  buyAllFAB: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#E91E63',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#E91E63',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buyAllFABDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fabTextContainer: {
    alignItems: 'center',
  },
  fabText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fabTextDisabled: {
    color: '#999',
  },
  fabPrice: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
    marginTop: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  orderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    flexShrink: 1,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderNumber: {
    color: '#3498DB',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default SharedWishlistScreen;
