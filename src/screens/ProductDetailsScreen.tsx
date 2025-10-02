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
  TextInput,
  FlatList,
  Modal,
  Share,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { productsAPI, Product as APIProduct } from '../services/productsAPI';
import { chatAPI } from '../services/chatAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ProductDetailsProps {
  navigation: any;
  route: {
    params: {
      productId: string;
    };
  };
}

// Using APIProduct interface from productsAPI service

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
  helpful: number;
}

const ProductDetailsScreen: React.FC<ProductDetailsProps> = ({ navigation, route }) => {
  const { productId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState<APIProduct | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadProduct();
    loadReviews();
    checkWishlistStatus();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const productData = await productsAPI.getProduct(productId);
      setProduct(productData);
    } catch (error) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const reviewsData = await productsAPI.getProductReviews(productId);
      setReviews(reviewsData);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const checkWishlistStatus = async () => {
    try {
      const wishlist = await productsAPI.getWishlist();
      setIsInWishlist(wishlist.some(item => item.productId === productId));
    } catch (error) {
      console.error('Error checking wishlist:', error);
    }
  };

  const handleAddToCart = async () => {
    if (!product || !user) return;
    
    try {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }),
      ]).start();

      await addToCart(product.id, quantity);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleToggleWishlist = async () => {
    if (!product || !user) return;
    
    try {
      if (isInWishlist) {
        await productsAPI.removeFromWishlist(productId);
        setIsInWishlist(false);
        Alert.alert('Removed', 'Product removed from wishlist');
      } else {
        await productsAPI.addToWishlist({
          productId: productId,
          productName: product.name,
          productImage: product.images[0],
          price: product.price,
        });
        setIsInWishlist(true);
        Alert.alert('Added', 'Product added to wishlist!');
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
      Alert.alert('Error', 'Failed to update wishlist');
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedRating || !reviewText.trim()) {
      Alert.alert('Missing Information', 'Please provide a rating and review');
      return;
    }

    try {
      setSubmittingReview(true);
      await productsAPI.addProductReview({
        productId,
        rating: selectedRating,
        comment: reviewText.trim(),
      });

      setShowReviewModal(false);
      setSelectedRating(0);
      setReviewText('');
      loadReviews(); // Reload reviews
      loadProduct(); // Reload product to update average rating
      
      Alert.alert('Success', 'Your review has been submitted!');
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleShareProduct = async () => {
    if (!product) return;
    
    try {
      await Share.share({
        message: `Check out this amazing product: ${product.name} for ₦${(product.price || 0).toFixed(2)} on Fretiko!`,
        url: `fretiko://product/${product.id}`,
      });
    } catch (error) {
      console.error('Error sharing product:', error);
    }
  };

  const handleContactSeller = async (e?: any) => {
    if (e) e.stopPropagation(); // Prevent parent TouchableOpacity from triggering
    if (!product || !user) return;

    try {
      // Find existing conversation or create a new one with the product owner
      const conversation = await chatAPI.findOrCreateConversation(
        [product.user_id], // The product owner
        'vendor' // Since this is about a product, it's vendor communication
      );

      // Navigate to IndividualChatScreen with proper parameters
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: `Product: ${product.name}`, // Use product name as chat name
        chatAvatar: product.images[0] || 'https://via.placeholder.com/50', // Use product image as avatar
        chatType: 'vendor' as const,
        isOnline: true, // Assume online for now
        verified: false, // Set based on user verification status if available
        isAI: false,
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
    }
  };

  const renderStars = (rating: number, size = 16, interactive = false, onStarPress?: (rating: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            disabled={!interactive}
            onPress={() => interactive && onStarPress?.(star)}
            style={interactive ? styles.interactiveStar : {}}
          >
            <Ionicons
              name={star <= rating ? 'star' : star <= rating + 0.5 ? 'star-half' : 'star-outline'}
              size={size}
              color={star <= rating ? '#FFD700' : '#666'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderImageCarousel = () => {
    if (!product?.images.length) return null;

    return (
      <View style={styles.imageCarouselContainer}>
        <FlatList
          data={product.images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setCurrentImageIndex(index);
          }}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={styles.productImage} resizeMode="cover" />
          )}
          keyExtractor={(_, index) => index.toString()}
        />
        
        {/* Image indicators */}
        <View style={styles.imageIndicators}>
          {product.images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                { backgroundColor: index === currentImageIndex ? '#3498DB' : 'rgba(255,255,255,0.4)' }
              ]}
            />
          ))}
        </View>
        
        {/* Wishlist button overlay */}
        <TouchableOpacity style={styles.wishlistButton} onPress={handleToggleWishlist}>
          <Ionicons
            name={isInWishlist ? 'heart' : 'heart-outline'}
            size={24}
            color={isInWishlist ? '#E74C3C' : '#FFF'}
          />
        </TouchableOpacity>
        
        {/* Share button overlay */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShareProduct}>
          <Ionicons name="share-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderReviewItem = ({ item }: { item: Review }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <Image
          source={{
            uri: item.userAvatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
          }}
          style={styles.reviewerAvatar}
        />
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{item.userName}</Text>
          <View style={styles.reviewRatingRow}>
            {renderStars(item.rating || 0, 14)}
            <Text style={styles.reviewDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.helpfulButton}>
          <Ionicons name="thumbs-up-outline" size={16} color="#666" />
          <Text style={styles.helpfulText}>{item.helpful}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.reviewComment}>{item.comment}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Product Details</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Carousel */}
        {renderImageCarousel()}

        {/* Product Info */}
        <Animated.View style={[styles.productInfo, { opacity: fadeAnim }]}>
          {/* Badges */}
          <View style={styles.badgesContainer}>
            {product.is_featured && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Featured</Text>
              </View>
            )}
            {product.status === 'active' && (
              <View style={[styles.badge, styles.trendingBadge]}>
                <Text style={styles.badgeText}>Available</Text>
              </View>
            )}
          </View>

          {/* Title and Price */}
          <Text style={styles.productTitle}>{product.name}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>₦{(product.price || 0).toFixed(2)}</Text>
          </View>

          {/* Rating and Reviews */}
          <View style={styles.ratingContainer}>
            {renderStars(product.average_rating || 0, 18)}
            <Text style={styles.ratingText}>
              {(product.average_rating || 0).toFixed(1)} ({product.review_count || 0} reviews)
            </Text>
            <Text style={styles.soldCount}>{product.view_count || 0} views</Text>
          </View>

          {/* Seller Info */}
          <TouchableOpacity
            style={styles.sellerContainer}
            onPress={() => navigation.navigate('PublicProfile', { userId: product.user_id })}
          >
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
              }}
              style={styles.sellerLogo}
            />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>Seller</Text>
              <View style={styles.sellerRating}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.sellerRatingText}>Seller Rating</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.chatButton} onPress={handleContactSeller}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#3498DB" />
              <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Quantity Selector */}
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Ionicons name="remove" size={20} color={quantity <= 1 ? '#666' : '#FFF'} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                disabled={quantity >= product.quantity}
              >
                <Ionicons name="add" size={20} color={quantity >= product.quantity ? '#666' : '#FFF'} />
              </TouchableOpacity>
            </View>
            <Text style={styles.stockText}>{product.quantity} in stock</Text>
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsRow}>
                {product.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Reviews Section */}
          <View style={styles.reviewsContainer}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
              <TouchableOpacity
                style={styles.addReviewButton}
                onPress={() => setShowReviewModal(true)}
              >
                <Ionicons name="add" size={16} color="#3498DB" />
                <Text style={styles.addReviewText}>Add Review</Text>
              </TouchableOpacity>
            </View>
            
            {reviews.length > 0 ? (
              <FlatList
                data={reviews}
                renderItem={renderReviewItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.reviewSeparator} />}
              />
            ) : (
              <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
            )}
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <Animated.View style={[styles.bottomBar, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity style={styles.wishlistBarButton} onPress={handleToggleWishlist}>
          <Ionicons
            name={isInWishlist ? 'heart' : 'heart-outline'}
            size={24}
            color={isInWishlist ? '#E74C3C' : '#FFF'}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
          <Ionicons name="cart" size={20} color="#FFF" />
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyNowButton} onPress={() => navigation.navigate('Checkout', { productId, quantity })}>
          <Text style={styles.buyNowText}>Buy Now</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.reviewModal}>
            <Text style={styles.modalTitle}>Write a Review</Text>
            
            <Text style={styles.ratingLabel}>Your Rating:</Text>
            <View style={styles.modalRatingContainer}>
              {renderStars(selectedRating, 32, true, setSelectedRating)}
            </View>
            
            <Text style={styles.commentLabel}>Your Review:</Text>
            <TextInput
              style={styles.commentInput}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Share your experience with this product..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowReviewModal(false);
                  setSelectedRating(0);
                  setReviewText('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                <Text style={styles.submitButtonText}>
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  imageCarouselContainer: {
    height: screenHeight * 0.4,
    position: 'relative',
  },
  productImage: {
    width: screenWidth,
    height: screenHeight * 0.4,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wishlistButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    position: 'absolute',
    top: 16,
    right: 72,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 20,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trendingBadge: {
    backgroundColor: '#2ED573',
  },
  discountBadge: {
    backgroundColor: '#FF4757',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 30,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  currentPrice: {
    color: '#27AE60',
    fontSize: 28,
    fontWeight: 'bold',
  },
  originalPrice: {
    color: '#666',
    fontSize: 18,
    textDecorationLine: 'line-through',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  interactiveStar: {
    padding: 4,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  soldCount: {
    color: '#666',
    fontSize: 14,
  },
  sellerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 20,
  },
  sellerLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sellerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerRatingText: {
    color: '#666',
    fontSize: 12,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  chatButtonText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  quantityLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  quantityText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
  },
  stockText: {
    color: '#666',
    fontSize: 12,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  tagsContainer: {
    marginBottom: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#FFF',
    fontSize: 12,
  },
  reviewsContainer: {
    marginBottom: 24,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  addReviewText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewItem: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewDate: {
    color: '#666',
    fontSize: 12,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helpfulText: {
    color: '#666',
    fontSize: 12,
  },
  reviewComment: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 18,
  },
  reviewSeparator: {
    height: 12,
  },
  noReviewsText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  wishlistBarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#3498DB',
    borderRadius: 24,
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buyNowButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#27AE60',
    borderRadius: 24,
  },
  buyNowText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  reviewModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  modalRatingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  commentLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    minHeight: 100,
    marginBottom: 24,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#3498DB',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProductDetailsScreen;