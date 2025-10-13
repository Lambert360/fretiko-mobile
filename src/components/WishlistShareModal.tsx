import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wishlistAPI, WishlistItem } from '../services/wishlistAPI';

interface WishlistShareModalProps {
  visible: boolean;
  recipientId: string;
  recipientName: string;
  onClose: () => void;
  onShareSuccess: (shareType: 'view_only' | 'view_and_add', itemCount: number) => void;
}

export const WishlistShareModal: React.FC<WishlistShareModalProps> = ({
  visible,
  recipientId,
  recipientName,
  onClose,
  onShareSuccess,
}) => {
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [shareType, setShareType] = useState<'view_only' | 'view_and_add'>('view_and_add');

  useEffect(() => {
    if (visible) {
      loadWishlistItems();
    }
  }, [visible]);

  const loadWishlistItems = async () => {
    try {
      setLoading(true);
      const items = await wishlistAPI.getWishlistItems();
      setWishlistItems(items);
      // Select all items by default
      setSelectedItemIds(items.map(item => item.id));
    } catch (error) {
      console.error('Error loading wishlist items:', error);
      Alert.alert('Error', 'Failed to load wishlist items');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === wishlistItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(wishlistItems.map(item => item.id));
    }
  };

  const handleShare = async () => {
    if (selectedItemIds.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item to share');
      return;
    }

    try {
      setSharing(true);
      await wishlistAPI.shareWishlist({
        friendId: recipientId,
        shareType,
        shareMessage: `Check out my wishlist!`,
        selectedItemIds,
      });

      onShareSuccess(shareType, selectedItemIds.length);
      onClose();
    } catch (error: any) {
      console.error('Error sharing wishlist:', error);
      Alert.alert('Error', error.message || 'Failed to share wishlist');
    } finally {
      setSharing(false);
    }
  };

  const renderItem = (item: WishlistItem) => {
    const isSelected = selectedItemIds.includes(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => toggleItemSelection(item.id)}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <View style={styles.checkbox}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color="#3498DB" />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color="#666" />
          )}
        </View>

        {/* Product Image */}
        <Image source={{ uri: item.productImage }} style={styles.productImage} />

        {/* Product Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productName}
          </Text>
          <Text style={styles.productPrice}>₦{item.price.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share Wishlist</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Recipient Info */}
          <View style={styles.recipientInfo}>
            <Ionicons name="person-circle" size={32} color="#3498DB" />
            <View style={styles.recipientTextContainer}>
              <Text style={styles.recipientLabel}>Sharing with</Text>
              <Text style={styles.recipientName}>{recipientName}</Text>
            </View>
          </View>

          {/* Permission Selection */}
          <View style={styles.permissionSection}>
            <Text style={styles.sectionTitle}>Permission</Text>
            <View style={styles.permissionOptions}>
              <TouchableOpacity
                style={[
                  styles.permissionOption,
                  shareType === 'view_and_add' && styles.permissionOptionSelected,
                ]}
                onPress={() => setShareType('view_and_add')}
              >
                <View style={styles.radioButton}>
                  {shareType === 'view_and_add' && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionTitle}>View & Add</Text>
                  <Text style={styles.permissionDescription}>
                    Can view and add items
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.permissionOption,
                  shareType === 'view_only' && styles.permissionOptionSelected,
                ]}
                onPress={() => setShareType('view_only')}
              >
                <View style={styles.radioButton}>
                  {shareType === 'view_only' && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionTitle}>View Only</Text>
                  <Text style={styles.permissionDescription}>
                    Can only view items
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Item Selection */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={styles.sectionTitle}>
                Select Items ({selectedItemIds.length}/{wishlistItems.length})
              </Text>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={toggleSelectAll}
              >
                <Text style={styles.selectAllText}>
                  {selectedItemIds.length === wishlistItems.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3498DB" />
                <Text style={styles.loadingText}>Loading items...</Text>
              </View>
            ) : wishlistItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="heart-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>Your wishlist is empty</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.itemsList}
                showsVerticalScrollIndicator={false}
              >
                {wishlistItems.map(renderItem)}
              </ScrollView>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={sharing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.shareButton,
                (sharing || selectedItemIds.length === 0) && styles.buttonDisabled,
              ]}
              onPress={handleShare}
              disabled={sharing || selectedItemIds.length === 0}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="share" size={18} color="#FFF" />
                  <Text style={styles.shareButtonText}>
                    Share ({selectedItemIds.length})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  recipientTextContainer: {
    marginLeft: 12,
  },
  recipientLabel: {
    color: '#999',
    fontSize: 12,
  },
  recipientName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  permissionOptions: {
    gap: 12,
  },
  permissionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  permissionOptionSelected: {
    borderColor: '#3498DB',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3498DB',
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  permissionDescription: {
    color: '#999',
    fontSize: 13,
  },
  itemsSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 12,
  },
  selectAllText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '500',
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: '#3498DB',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  checkbox: {
    marginRight: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  productName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#999',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 12,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#3498DB',
    flexDirection: 'row',
    gap: 8,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
