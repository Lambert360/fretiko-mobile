import { api } from './api';

export interface WishlistItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  sellerId?: string;
  sellerName?: string;
  category?: string;
  createdAt: string;
  isAvailable: boolean;
  notes?: string;
  priority?: number;
  addedByFriend?: string;
  collaborationNote?: string;
  canAddItems?: boolean;
  giftOrderStatus?: {
    status: string;
    orderId: string;
    orderNumber: string | null;
    orderStatus: string | null;
  } | null;
}

export interface ShareWishlistRequest {
  friendId: string;
  shareType?: 'view_only' | 'view_and_add';
  shareMessage?: string;
  selectedItemIds?: string[]; // For selective sharing
}

export interface AddToFriendWishlistRequest {
  friendUserId: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  note?: string;
}

export interface CreateGiftOrderRequest {
  giftRecipientId: string;
  orderId: string | null;
  wishlistItemId: string;
  giftMessage?: string;
  isSurprise?: boolean;
  deliveryAddress: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
  };
  selectedRider?: {
    riderId: string;
    riderName?: string;
    vehicleType?: string;
    deliveryPrice?: number;
    estimatedArrival?: number;
  };
}

export interface ShareableFriend {
  id: string;
  username: string;
  fullName?: string; // Will contain username since full_name column doesn't exist
  avatarUrl?: string;
}

export interface SharedWishlist {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerFullName?: string;
  shareType: 'view_only' | 'view_and_add';
  shareMessage?: string;
  sharedAt: string;
  isActive: boolean;
}

export interface GiftOrder {
  id: string;
  orderId: string;
  giftGiverId: string;
  giftRecipientId: string;
  wishlistItemId: string;
  giftMessage?: string;
  isSurprise: boolean;
  status: string;
  createdAt: string;
  giver?: {
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
  recipient?: {
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
  order?: {
    orderNumber: string;
    status: string;
    totalAmount: number;
  };
}

export interface GiftPurchaseCheck {
  canPurchase: boolean;
  reason?: string;
  productInfo?: {
    id: string;
    name: string;
    price: number;
    sellerId: string;
  };
  recipientInfo?: {
    id: string;
    username: string;
    fullName?: string;
  };
}

class WishlistAPI {
  // Basic wishlist operations
  async getWishlistItems(): Promise<WishlistItem[]> {
    try {
      const response = await api.get('/wishlist');
      return response.data;
    } catch (error) {
      console.error('Error fetching wishlist items:', error);
      throw error;
    }
  }

  async getWishlistCount(): Promise<{ count: number }> {
    try {
      const response = await api.get('/wishlist/count');
      return response.data;
    } catch (error) {
      console.error('Error fetching wishlist count:', error);
      throw error;
    }
  }

  async addToWishlist(wishlistData: {
    productId: string;
    productName: string;
    productImage: string;
    price: number;
  }): Promise<{ message: string }> {
    try {
      const response = await api.post('/wishlist', wishlistData);
      return response.data;
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      throw error;
    }
  }

  // Add item to shared wishlist (for collaborators)
  async addToSharedWishlist(ownerId: string, itemData: {
    productId: string;
    productName: string;
    productImage: string;
    price: number;
    collaborationNote?: string;
  }): Promise<{ message: string; item: any }> {
    try {
      const response = await api.post(`/wishlist/shared/${ownerId}/add`, itemData);
      return response.data;
    } catch (error: any) {
      console.error('Error adding to shared wishlist:', error);
      // Provide user-friendly error messages
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Failed to add item to shared wishlist');
    }
  }

  async removeFromWishlist(productId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`/wishlist/${productId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      throw error;
    }
  }

  async clearWishlist(): Promise<{ message: string }> {
    try {
      const response = await api.delete('/wishlist');
      return response.data;
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      throw error;
    }
  }

  async checkIsInWishlist(productId: string): Promise<{ isInWishlist: boolean }> {
    try {
      const response = await api.get(`/wishlist/check/${productId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking wishlist status:', error);
      throw error;
    }
  }

  // Sharing operations
  async shareWishlist(shareData: ShareWishlistRequest): Promise<{
    message: string;
    shareId: string;
    shareType: string;
    canAddItems: boolean;
    sharedItemsCount?: number;
    chatMessage?: {
      messageId: string;
      conversationId: string;
      wishlistData: any;
    };
  }> {
    try {
      const response = await api.post('/wishlist/share', shareData);
      return response.data;
    } catch (error) {
      console.error('Error sharing wishlist:', error);
      throw error;
    }
  }

  async getSharedWishlistItems(ownerId: string): Promise<WishlistItem[]> {
    try {
      const response = await api.get(`/wishlist/shared/${ownerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching shared wishlist items:', error);
      throw error;
    }
  }

  async getSharedWishlists(): Promise<SharedWishlist[]> {
    try {
      const response = await api.get('/wishlist/shared');
      return response.data;
    } catch (error) {
      console.error('Error fetching shared wishlists:', error);
      throw error;
    }
  }

  async getCollaborativeWishlist(ownerId?: string): Promise<WishlistItem[]> {
    try {
      const endpoint = ownerId ? `/wishlist/collaborative/${ownerId}` : '/wishlist/collaborative';
      const response = await api.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('Error fetching collaborative wishlist:', error);
      throw error;
    }
  }

  async addToFriendWishlist(data: AddToFriendWishlistRequest): Promise<{
    message: string;
    wishlistItemId?: string;
    collaborationNote?: string;
    alreadyExists?: boolean;
  }> {
    try {
      const response = await api.post('/wishlist/add-to-friend', data);
      return response.data;
    } catch (error) {
      console.error('Error adding to friend wishlist:', error);
      throw error;
    }
  }

  async stopSharingWishlist(friendId: string): Promise<{ message: string }> {
    try {
      const response = await api.put(`/wishlist/stop-sharing/${friendId}`);
      return response.data;
    } catch (error) {
      console.error('Error stopping wishlist sharing:', error);
      throw error;
    }
  }

  async getShareableFriends(searchQuery?: string, limit?: number): Promise<ShareableFriend[]> {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (limit) params.append('limit', limit.toString());

      const response = await api.get(`/wishlist/shareable-friends?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching shareable friends:', error);
      throw error;
    }
  }

  // Gift operations
  async createGiftOrder(giftData: CreateGiftOrderRequest): Promise<{
    message: string;
    giftOrderId: string;
    orderId?: string;
    orderNumber?: string;
    recipientName?: string;
    productName?: string;
    totalAmount?: number;
    isSurprise: boolean;
  }> {
    try {
      const response = await api.post('/wishlist/gift', giftData);
      return response.data;
    } catch (error) {
      console.error('Error creating gift order:', error);
      throw error;
    }
  }

  async getReceivedGifts(): Promise<GiftOrder[]> {
    try {
      const response = await api.get('/wishlist/gifts/received');
      return response.data;
    } catch (error) {
      console.error('Error fetching received gifts:', error);
      throw error;
    }
  }

  async getGivenGifts(): Promise<GiftOrder[]> {
    try {
      const response = await api.get('/wishlist/gifts/given');
      return response.data;
    } catch (error) {
      console.error('Error fetching given gifts:', error);
      throw error;
    }
  }

  async canPurchaseAsGift(wishlistItemId: string): Promise<GiftPurchaseCheck> {
    try {
      const response = await api.get(`/wishlist/can-gift/${wishlistItemId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking gift purchase eligibility:', error);
      throw error;
    }
  }

  // Multi-step gift purchase validation
  async validateGiftPurchase(items: Array<{ wishlistItemId: string; quantity?: number }>): Promise<{
    valid: boolean;
    totalPrice: number;
    availableItems: any[];
    validationResults: any[];
    summary: {
      totalItems: number;
      validItems: number;
      invalidItems: number;
    };
  }> {
    try {
      const response = await api.post('/wishlist/validate-gift-purchase', { items });
      return response.data;
    } catch (error: any) {
      console.error('Error validating gift purchase:', error);
      // Provide user-friendly error messages
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Failed to validate gift purchase');
    }
  }
}

export const wishlistAPI = new WishlistAPI();