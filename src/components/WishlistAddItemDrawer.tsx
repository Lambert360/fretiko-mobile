import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productsAPI, Product } from '../services/productsAPI';
import { servicesAPI, Service } from '../services/servicesAPI';
import { wishlistAPI } from '../services/wishlistAPI';
import { walletAPI } from '../services/walletAPI';

/**
 * WishlistAddItemDrawer Component
 *
 * Purpose: Bottom drawer modal for adding items to a shared wishlist
 *
 * What it does:
 * - Shows a search bar to search products/services
 * - Displays list of products below
 * - Each product has an "Add" button
 * - Adds selected items to the shared wishlist
 * - Real-time search functionality
 *
 * What's needed to use it:
 * - visible: Boolean to control drawer visibility
 * - onClose: Function to close the drawer
 * - ownerId: ID of the wishlist owner
 * - onItemAdded: Callback when item is successfully added
 */

interface WishlistAddItemDrawerProps {
  visible: boolean;
  onClose: () => void;
  ownerId: string;
  onItemAdded: () => void;
}

type CombinedItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  type: 'product' | 'service';
};

export const WishlistAddItemDrawer: React.FC<WishlistAddItemDrawerProps> = ({
  visible,
  onClose,
  ownerId,
  onItemAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<CombinedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadItems();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchItems();
    } else {
      loadItems();
    }
  }, [searchQuery]);

  const loadItems = async () => {
    try {
      setLoading(true);

      // Load both products and services
      const [products, services] = await Promise.all([
        productsAPI.getProducts(),
        servicesAPI.getUserServices(ownerId).catch(() => []), // Fallback to empty if fails
      ]);

      // Combine and transform items
      const combinedItems: CombinedItem[] = [
        ...products.map((p: Product) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          imageUrl: p.primary_image_url || p.images?.[0] || 'https://via.placeholder.com/100',
          type: 'product' as const,
        })),
        ...services.map((s: Service) => ({
          id: s.id,
          name: s.name,
          price: s.base_price || 0,
          imageUrl: s.images?.[0] || 'https://via.placeholder.com/100',
          type: 'service' as const,
        })),
      ];

      setItems(combinedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const searchItems = async () => {
    try {
      setLoading(true);

      // Search products and services
      const [products, services] = await Promise.all([
        productsAPI.getProducts({ search: searchQuery }),
        servicesAPI.getUserServices(ownerId).catch(() => []),
      ]);

      // Filter services by search query
      const filteredServices = services.filter((s: Service) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Combine results
      const combinedItems: CombinedItem[] = [
        ...products.map((p: Product) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          imageUrl: p.primary_image_url || p.images?.[0] || 'https://via.placeholder.com/100',
          type: 'product' as const,
        })),
        ...filteredServices.map((s: Service) => ({
          id: s.id,
          name: s.name,
          price: s.base_price || 0,
          imageUrl: s.images?.[0] || 'https://via.placeholder.com/100',
          type: 'service' as const,
        })),
      ];

      setItems(combinedItems);
    } catch (error) {
      console.error('Error searching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (item: CombinedItem) => {
    try {
      setAddingItemId(item.id);

      // Add item to shared wishlist using the new API
      await wishlistAPI.addToSharedWishlist(ownerId, {
        productId: item.id,
        productName: item.name,
        productImage: item.imageUrl,
        price: item.price,
      });

      Alert.alert('Success', `🎉 ${item.name} added to the wishlist! The owner will be notified.`);
      onItemAdded(); // Refresh parent wishlist
    } catch (error: any) {
      console.error('Error adding item to shared wishlist:', error);
      Alert.alert('Oops!', error.message || 'Failed to add item to wishlist');
    } finally {
      setAddingItemId(null);
    }
  };

  const renderItem = ({ item }: { item: CombinedItem }) => (
    <View style={styles.itemContainer}>
      <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemPrice}>{walletAPI.formatFreti(item.price)}</Text>
        <Text style={styles.itemType}>
          {item.type === 'product' ? '📦 Product' : '🛠️ Service'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.addButton, addingItemId === item.id && styles.addButtonDisabled]}
        onPress={() => handleAddItem(item)}
        disabled={addingItemId === item.id}
      >
        {addingItemId === item.id ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.drawerContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <Text style={styles.headerTitle}>Add Item to Wishlist</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products or services..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Items List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3498DB" />
              <Text style={styles.loadingText}>Loading items...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color="#666" />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search term' : 'No products or services available'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  drawerContainer: {
    backgroundColor: '#000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  handleBar: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemPrice: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemType: {
    color: '#666',
    fontSize: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#555',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemSeparator: {
    height: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});
