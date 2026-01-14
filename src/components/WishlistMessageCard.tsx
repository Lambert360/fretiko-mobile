import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

interface WishlistPreviewItem {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface WishlistData {
  shareId: string;
  shareType: 'view_only' | 'view_and_add';
  itemCount: number;
  ownerName: string;
  ownerId: string;
  recipientName: string;
  recipientId: string;
  previewItems: WishlistPreviewItem[];
  canAddItems: boolean;
  sharedAt: Date;
  purchaseStatus?: {
    itemsPurchased: number;
    itemsProcessing: number;
    itemsCompleted: number;
    totalItems: number;
    overallStatus: 'none' | 'processing' | 'completed';
  };
}

interface WishlistMessageCardProps {
  wishlistData: WishlistData;
  isCurrentUser: boolean;
  onPress: (shareId: string, ownerId: string, ownerName: string, shareType: 'view_only' | 'view_and_add') => void;
}

const WishlistMessageCard: React.FC<WishlistMessageCardProps> = ({
  wishlistData,
  isCurrentUser,
  onPress,
}) => {
  const { shareId, shareType, itemCount, ownerName, ownerId, previewItems, canAddItems, purchaseStatus } = wishlistData;

  // 🔥 DEBUG: Log purchaseStatus to verify it's being passed
  React.useEffect(() => {
    console.log('🎁 WishlistMessageCard purchaseStatus:', purchaseStatus);
    console.log('🎁 WishlistMessageCard itemCount:', itemCount);
  }, [purchaseStatus, itemCount]);

  const handlePress = () => {
    onPress(shareId, ownerId, ownerName, shareType);
  };

  const formatPrice = (price: number) => {
    return `₣${price.toLocaleString()}`;
  };

  const getPermissionText = () => {
    if (isCurrentUser) {
      return shareType === 'view_and_add'
        ? 'They can view and add items'
        : 'They can view only';
    } else {
      return canAddItems
        ? 'You can view and add items'
        : 'You can view only';
    }
  };

  const getPurchaseStatusBadge = () => {
    if (!purchaseStatus || purchaseStatus.overallStatus === 'none') {
      return null;
    }

    const { overallStatus, itemsPurchased, totalItems } = purchaseStatus;
    
    if (overallStatus === 'processing') {
      return (
        <View style={styles.purchaseStatusBadge}>
          <Ionicons name="time" size={14} color="#FFA726" />
          <Text style={styles.purchaseStatusTextProcessing}>
            {itemsPurchased} of {totalItems} processing
          </Text>
        </View>
      );
    }

    if (overallStatus === 'completed') {
      return (
        <View style={styles.purchaseStatusBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#66BB6A" />
          <Text style={styles.purchaseStatusTextCompleted}>
            {itemsPurchased} of {totalItems} completed
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer
      ]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="gift" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {isCurrentUser ? 'You shared your wishlist' : `${ownerName}'s Wishlist`}
          </Text>
          <Text style={styles.subtitle}>{itemCount} item{itemCount > 1 ? 's' : ''}</Text>
          {/* 🔥 FIX: Always check purchaseStatus exists and has valid data */}
          {purchaseStatus && purchaseStatus.overallStatus !== 'none' && purchaseStatus.totalItems > 0 && (
            <View style={styles.purchaseStatusContainer}>
              {getPurchaseStatusBadge()}
            </View>
          )}
        </View>
      </View>

      {/* Preview Images */}
      {previewItems.length > 0 && (
        <View style={styles.previewContainer}>
          {previewItems.slice(0, 3).map((item, index) => (
            <View key={`preview-${item.id}`} style={styles.previewItemWrapper}>
              <Image
                source={{ uri: item.image }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              {index === 2 && itemCount > 3 && (
                <View style={styles.moreItemsOverlay}>
                  <Text style={styles.moreItemsText}>+{itemCount - 3}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Preview Item Names (first 2) */}
      {previewItems.length > 0 && (
        <View style={styles.itemNamesContainer}>
          {previewItems.slice(0, 2).map((item) => (
            <View key={`name-${item.id}`} style={styles.itemNameRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                • {item.name}
              </Text>
              <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
            </View>
          ))}
          {itemCount > 2 && (
            <Text style={styles.moreItemsLink}>and {itemCount - 2} more item{itemCount - 2 > 1 ? 's' : ''}...</Text>
          )}
        </View>
      )}

      {/* Permission Badge */}
      <View style={styles.footer}>
        <View style={[
          styles.permissionBadge,
          canAddItems ? styles.permissionBadgeAdd : styles.permissionBadgeView
        ]}>
          <Ionicons
            name={canAddItems ? "add-circle" : "eye"}
            size={14}
            color={canAddItems ? "#27AE60" : "#3498DB"}
          />
          <Text style={[
            styles.permissionText,
            canAddItems ? styles.permissionTextAdd : styles.permissionTextView
          ]}>
            {getPermissionText()}
          </Text>
        </View>

        {/* View Button */}
        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View Wishlist</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: screenWidth * 0.75,
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  currentUserContainer: {
    backgroundColor: '#051094', // Admiral Blue - matches regular sent messages
    alignSelf: 'flex-end',
  },
  otherUserContainer: {
    backgroundColor: '#59788E', // Stone - matches regular received messages
    alignSelf: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  previewContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 6,
  },
  previewItemWrapper: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  moreItemsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreItemsText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  itemNamesContainer: {
    marginBottom: 10,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 8,
  },
  itemPrice: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  moreItemsLink: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  permissionBadgeView: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
  },
  permissionBadgeAdd: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
  },
  permissionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  permissionTextView: {
    color: '#3498DB',
  },
  permissionTextAdd: {
    color: '#27AE60',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  purchaseStatusContainer: {
    marginTop: 6,
  },
  purchaseStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    gap: 4,
  },
  purchaseStatusTextProcessing: {
    color: '#FFA726',
    fontSize: 11,
    fontWeight: '600',
  },
  purchaseStatusTextCompleted: {
    color: '#66BB6A',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default WishlistMessageCard;
