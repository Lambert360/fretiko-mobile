import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  RefreshControl,
  Share,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { productsAPI } from '../services/productsAPI';
import { wishlistAPI, WishlistItem, ShareableFriend } from '../services/wishlistAPI';
import { cartAPI } from '../services/cartAPI';

const { width: screenWidth } = Dimensions.get('window');

interface WishlistScreenProps {
  navigation: any;
}

const WishlistScreen: React.FC<WishlistScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [shareableFriends, setShareableFriends] = useState<ShareableFriend[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadWishlist();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadWishlist = async () => {
    try {
      setLoading(true);
      const items = await wishlistAPI.getWishlistItems();
      setWishlistItems(items);
    } catch (error) {
      console.error('Error loading wishlist:', error);
      Alert.alert('Error', 'Failed to load wishlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadShareableFriends = async (search?: string) => {
    try {
      setSearchLoading(true);
      const friends = await wishlistAPI.getShareableFriends(search, 20);
      setShareableFriends(friends);
    } catch (error) {
      console.error('Error loading shareable friends:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounce search to avoid too many API calls
  useEffect(() => {
    if (showShareModal) {
      const timer = setTimeout(() => {
        loadShareableFriends(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, showShareModal]);

  const onRefresh = () => {
    setRefreshing(true);
    loadWishlist();
  };

  const handleRemoveItem = async (productId: string, productName: string) => {
    Alert.alert(
      'Remove from Wishlist',
      `Are you sure you want to remove "${productName}" from your wishlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await wishlistAPI.removeFromWishlist(productId);
              setWishlistItems(prev => prev.filter(item => item.productId !== productId));
              Alert.alert('Removed', 'Item removed from wishlist');
            } catch (error) {
              console.error('Error removing item:', error);
              Alert.alert('Error', 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  const handleAddToCart = async (item: WishlistItem) => {
    try {
      // Animate button press
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
      ]).start();

      await cartAPI.addToCart({
        productId: item.productId,
        quantity: 1,
        price: item.price,
      });

      Alert.alert('Added to Cart', `${item.productName} has been added to your cart!`, [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
      ]);
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart');
    }
  };

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetails', { productId });
  };

  const handleToggleSelection = (productId: string) => {
    setSelectedItems(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === wishlistItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(wishlistItems.map(item => item.productId));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;

    Alert.alert(
      'Remove Items',
      `Are you sure you want to remove ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} from your wishlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove items in parallel
              await Promise.all(
                selectedItems.map(productId => wishlistAPI.removeFromWishlist(productId))
              );
              
              // Update local state
              setWishlistItems(prev => 
                prev.filter(item => !selectedItems.includes(item.productId))
              );
              
              setSelectedItems([]);
              setIsSelectionMode(false);
              
              Alert.alert('Success', 'Selected items removed from wishlist');
            } catch (error) {
              console.error('Error removing selected items:', error);
              Alert.alert('Error', 'Failed to remove some items');
            }
          },
        },
      ]
    );
  };

  const handleAddSelectedToCart = async () => {
    if (selectedItems.length === 0) return;

    try {
      const selectedWishlistItems = wishlistItems.filter(item => 
        selectedItems.includes(item.productId)
      );

      // Add items to cart in parallel
      await Promise.all(
        selectedWishlistItems.map(item => 
          cartAPI.addToCart({
            productId: item.productId,
            quantity: 1,
            price: item.price,
          })
        )
      );

      setSelectedItems([]);
      setIsSelectionMode(false);

      Alert.alert(
        'Added to Cart',
        `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} added to cart!`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
        ]
      );
    } catch (error) {
      console.error('Error adding selected items to cart:', error);
      Alert.alert('Error', 'Failed to add some items to cart');
    }
  };

  const handleShareWishlist = async () => {
    // Load users first
    setSearchQuery(''); // Reset search
    await loadShareableFriends();
    setShowShareModal(true);
  };

  const handleShareWithFriend = async (friendId: string, shareType: 'view_only' | 'view_and_add' = 'view_and_add') => {
    try {
      const result = await wishlistAPI.shareWishlist({
        friendId,
        shareType,
        shareMessage: `Check out my wishlist! I have ${wishlistItems.length} items you might like.`
      });
      
      Alert.alert(
        'Shared Successfully!', 
        `Your wishlist has been shared with your friend. They ${result.canAddItems ? 'can view and add items to' : 'can only view'} your wishlist.`,
        [{ text: 'OK' }]
      );
      
      setShowShareModal(false);
    } catch (error: any) {
      console.error('Error sharing wishlist with friend:', error);
      Alert.alert('Error', error.message || 'Failed to share wishlist');
    }
  };

  const handleShareExternal = async () => {
    try {
      // Get user's username from user object or API
      const username = (user as any)?.username || user?.email?.split('@')[0] || 'user';
      const encodedUsername = encodeURIComponent(username);
      const wishlistUrl = `fretiko://wishlist/${user?.id}/${encodedUsername}`;

      await Share.share({
        message: `Check out my wishlist on Fretiko! I have ${wishlistItems.length} amazing items saved.\n\n${wishlistUrl}`,
        url: wishlistUrl,
      });
      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing wishlist externally:', error);
    }
  };

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => (
    <TouchableOpacity
      style={styles.wishlistItem}
      onPress={() => isSelectionMode ? handleToggleSelection(item.productId) : handleProductPress(item.productId)}
      onLongPress={() => {
        if (!isSelectionMode) {
          setIsSelectionMode(true);
          setSelectedItems([item.productId]);
        }
      }}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <TouchableOpacity
          style={styles.selectionCheckbox}
          onPress={() => handleToggleSelection(item.productId)}
        >
          <Ionicons
            name={selectedItems.includes(item.productId) ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={selectedItems.includes(item.productId) ? '#3498DB' : '#666'}
          />
        </TouchableOpacity>
      )}

      <Image source={{ uri: item.productImage }} style={styles.productImage} />
      
      <View style={styles.itemInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>
        <Text style={styles.productPrice}>₦{item.price.toFixed(2)}</Text>
        <Text style={styles.addedDate}>
          {item.addedByFriend 
            ? `Added by ${item.addedByFriend} on ${new Date(item.createdAt).toLocaleDateString()}`
            : `Added ${new Date(item.createdAt).toLocaleDateString()}`
          }
        </Text>
        
        {item.collaborationNote && (
          <Text style={styles.collaborationNote}>💬 {item.collaborationNote}</Text>
        )}
        
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="cart" size={16} color="#FFF" />
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveItem(item.productId, item.productName)}
          >
            <Ionicons name="trash-outline" size={16} color="#E74C3C" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyWishlist = () => (
    <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="heart-outline" size={64} color="#666" />
      </View>
      <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
      <Text style={styles.emptySubtitle}>
        Save items you love for later by tapping the heart icon
      </Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('Home', { screen: 'HomeTab' })}
      >
        <Text style={styles.shopButtonText}>Start Shopping</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSelectionBar = () => (
    <View style={styles.selectionBar}>
      <TouchableOpacity
        style={styles.selectAllButton}
        onPress={handleSelectAll}
      >
        <Ionicons
          name={selectedItems.length === wishlistItems.length ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color="#3498DB"
        />
        <Text style={styles.selectAllText}>
          {selectedItems.length === wishlistItems.length ? 'Deselect All' : 'Select All'}
        </Text>
      </TouchableOpacity>
      
      <Text style={styles.selectedCount}>
        {selectedItems.length} selected
      </Text>
    </View>
  );

  const renderActionBar = () => (
    <View style={styles.actionBar}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleAddSelectedToCart}
        disabled={selectedItems.length === 0}
      >
        <Ionicons name="cart" size={18} color="#FFF" />
        <Text style={styles.actionButtonText}>Add to Cart</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        onPress={handleDeleteSelected}
        disabled={selectedItems.length === 0}
      >
        <Ionicons name="trash" size={18} color="#FFF" />
        <Text style={styles.actionButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const renderShareModal = () => (
    <Modal
      visible={showShareModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowShareModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Wishlist</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowShareModal(false)}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by username..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchLoading && (
                <ActivityIndicator size="small" color="#3498DB" style={styles.searchLoader} />
              )}
            </View>

            {/* Share with Users Section */}
            <Text style={styles.sectionTitle}>Share with User</Text>
            <Text style={styles.sectionSubtitle}>
              Share your wishlist with any verified user
            </Text>

            {shareableFriends.length > 0 ? (
              shareableFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendItem}
                  onPress={() => handleShareWithFriend(friend.id, 'view_and_add')}
                >
                  <View style={styles.friendInfo}>
                    <View style={styles.friendAvatar}>
                      {friend.avatarUrl ? (
                        <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="person" size={20} color="#666" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.friendName}>{friend.fullName || friend.username}</Text>
                      <Text style={styles.friendUsername}>@{friend.username}</Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#3498DB" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noFriendsContainer}>
                <Ionicons name="people-outline" size={40} color="#666" />
                <Text style={styles.noFriendsText}>
                  {searchQuery ? 'No users found' : 'Search for users'}
                </Text>
                <Text style={styles.noFriendsSubtext}>
                  {searchQuery ? 'Try a different username' : 'Enter a username to find users to share with'}
                </Text>
              </View>
            )}

            {/* Share Externally Section */}
            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Share Externally</Text>
            <TouchableOpacity
              style={styles.shareOption}
              onPress={handleShareExternal}
            >
              <View style={styles.shareOptionContent}>
                <Ionicons name="share-outline" size={24} color="#3498DB" />
                <View style={styles.shareOptionText}>
                  <Text style={styles.shareOptionTitle}>Share Link</Text>
                  <Text style={styles.shareOptionSubtitle}>
                    Share your wishlist with anyone via link
                  </Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#3498DB" />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
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
        
        <Text style={styles.headerTitle}>
          Wishlist ({wishlistItems.length})
        </Text>
        
        <View style={styles.headerActions}>
          {wishlistItems.length > 0 && !isSelectionMode && (
            <>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleShareWishlist}
              >
                <Ionicons name="share-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setIsSelectionMode(true)}
              >
                <Ionicons name="checkmark-circle-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </>
          )}
          
          {isSelectionMode && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setIsSelectionMode(false);
                setSelectedItems([]);
              }}
            >
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selection Bar */}
      {isSelectionMode && renderSelectionBar()}

      {wishlistItems.length === 0 ? (
        renderEmptyWishlist()
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
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
        </Animated.View>
      )}

      {/* Action Bar for Selection Mode */}
      {isSelectionMode && renderActionBar()}

      {/* Share Modal */}
      {renderShareModal()}
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
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
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 152, 219, 0.2)',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedCount: {
    color: '#CCC',
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  wishlistItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  selectionCheckbox: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
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
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3498DB',
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    marginRight: 12,
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  itemSeparator: {
    height: 16,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#3498DB',
    borderRadius: 24,
  },
  deleteButton: {
    backgroundColor: '#E74C3C',
  },
  actionButtonText: {
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
  // Share Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  searchLoader: {
    marginLeft: 8,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitleSpaced: {
    marginTop: 32,
  },
  sectionSubtitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  friendUsername: {
    color: '#999',
    fontSize: 14,
  },
  noFriendsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noFriendsText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  noFriendsSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 20,
  },
  shareOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shareOptionText: {
    marginLeft: 16,
    flex: 1,
  },
  shareOptionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  shareOptionSubtitle: {
    color: '#999',
    fontSize: 14,
  },
});

export default WishlistScreen;