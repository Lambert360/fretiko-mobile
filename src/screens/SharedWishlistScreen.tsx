import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    loadSharedWishlist();
  }, [ownerId]);

  const loadSharedWishlist = async () => {
    try {
      setLoading(true);

      // Get the shared wishlist items
      const items = await wishlistAPI.getCollaborativeWishlist(ownerId);
      setWishlistItems(items);

      // Check if we have permission to add items
      // This would be determined by the share_type in wishlist_shares
      // For now, we'll assume view_and_add permission
      setCanAddItems(true);
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
    // Navigate to gift checkout screen
    navigation.navigate('GiftCheckout', {
      wishlistItem: item,
      recipientId: ownerId,
      recipientName: ownerUsername,
    });
  };

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetails', { productId });
  };

  const handleAddItemToWishlist = () => {
    // Navigate to products/services to add items
    Alert.alert(
      'Add Item',
      'Browse products and services to add items to this wishlist',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Browse Products', onPress: () => navigation.navigate('Home', { screen: 'HomeTab' }) },
      ]
    );
  };

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => (
    <TouchableOpacity
      style={styles.wishlistItem}
      onPress={() => handleProductPress(item.productId)}
    >
      <Image source={{ uri: item.productImage }} style={styles.productImage} />

      <View style={styles.itemInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>
        <Text style={styles.productPrice}>₦{item.price.toFixed(2)}</Text>
        <Text style={styles.addedDate}>
          {item.addedByFriend
            ? `Added by ${item.addedByFriend}`
            : `Added by ${ownerUsername || 'Owner'}`
          }
        </Text>

        {item.collaborationNote && (
          <Text style={styles.collaborationNote}>💬 {item.collaborationNote}</Text>
        )}

        <TouchableOpacity
          style={styles.giftButton}
          onPress={() => handleBuyAsGift(item)}
        >
          <Ionicons name="gift" size={16} color="#FFF" />
          <Text style={styles.giftButtonText}>Buy as Gift</Text>
        </TouchableOpacity>
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
});

export default SharedWishlistScreen;
