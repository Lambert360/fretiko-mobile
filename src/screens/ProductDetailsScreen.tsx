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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { productsAPI, Product as APIProduct } from '../services/productsAPI';
import { wishlistAPI } from '../services/wishlistAPI';
import { chatAPI } from '../services/chatAPI';
import ProductVideoPlayer from '../components/ProductVideoPlayer';
import { MediaViewerModal } from '../components/MediaViewerModal';

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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerType, setMediaViewerType] = useState<'image' | 'video'>('image');
  const [mediaViewerUri, setMediaViewerUri] = useState<string>('');
  
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
      const result = await wishlistAPI.checkIsInWishlist(productId);
      setIsInWishlist(result.isInWishlist);
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
        await wishlistAPI.removeFromWishlist(productId);
        setIsInWishlist(false);
        Alert.alert('Removed', 'Product removed from wishlist');
      } else {
        await wishlistAPI.addToWishlist({
          productId: productId,
          productName: product.name,
          productImage: product.primary_image_url || product.images[0] || '',
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
        message: `Check out this amazing product: ${product.name} for ₣${(product.price || 0).toFixed(2)} on Fretiko!`,
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
      // Determine chat type based on current user's role
      // Since this is a product, the seller is a vendor
      // Priority: rider > vendor > friend
      let chatType: 'friend' | 'vendor' | 'rider' = 'vendor'; // Default to vendor since it's a product

      // Check if current user is a rider (highest priority)
      if (user.is_rider) {
        chatType = 'rider';
      }
      // If current user is seller, keep it as vendor
      else if (user.is_seller) {
        chatType = 'vendor';
      }
      // Product owner is assumed to be vendor, so default stays 'vendor'

      // Find existing conversation or create a new one with the product owner
      const conversation = await chatAPI.findOrCreateConversation(
        [product.user_id], // The product owner
        chatType
      );

      // Navigate to IndividualChatScreen with proper parameters
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: `Product: ${product.name}`, // Use product name as chat name
        chatAvatar: product.images[0] || 'https://via.placeholder.com/50', // Use product image as avatar
        chatType: chatType as const,
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
    // Check if product has video
    const hasVideo = product?.media_type === 'video' && product?.primary_video_url;

    if (!hasVideo && !product?.images.length) return null;

    return (
      <View style={styles.imageCarouselContainer}>
        {hasVideo ? (
          <>
            {/* Video: pointerEvents none so overlay receives touches */}
            <View
              style={{ width: screenWidth, height: screenHeight * 0.4, backgroundColor: '#000' }}
              pointerEvents="none"
            >
              <ProductVideoPlayer
                videoUri={product.primary_video_url!}
                shouldAutoPlay={true}
                containerWidth={screenWidth}
                maxHeight={screenHeight * 0.4}
              />
            </View>
            {/* Overlay for video: tap-to-open modal, then buttons on top */}
            <View
              style={[styles.carouselOverlay, { width: screenWidth, height: screenHeight * 0.4 }]}
              pointerEvents="box-none"
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  setMediaViewerType('video');
                  setMediaViewerUri(product.primary_video_url!);
                  setMediaViewerVisible(true);
                }}
              />
              <View style={styles.videoBadge}>
                <Ionicons name="videocam" size={16} color="white" />
                <Text style={styles.videoBadgeText}>VIDEO PRODUCT</Text>
              </View>
              <TouchableOpacity style={styles.wishlistButton} onPress={handleToggleWishlist}>
                <Ionicons
                  name={isInWishlist ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isInWishlist ? '#E74C3C' : '#FFF'}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareProduct}>
                <Ionicons name="share-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
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
                <TouchableOpacity
                  style={{ width: screenWidth }}
                  activeOpacity={1}
                  onPress={() => {
                    setMediaViewerType('image');
                    setMediaViewerUri(item);
                    setMediaViewerVisible(true);
                  }}
                >
                  <Image source={{ uri: item }} style={styles.productImage} resizeMode="cover" />
                </TouchableOpacity>
              )}
              keyExtractor={(_, index) => index.toString()}
            />
            {product?.images && product.images.length > 1 && (
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
            )}
            <View style={[styles.carouselOverlay, { width: screenWidth, height: screenHeight * 0.4 }]} pointerEvents="box-none">
              <TouchableOpacity style={styles.wishlistButton} onPress={handleToggleWishlist}>
                <Ionicons
                  name={isInWishlist ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isInWishlist ? '#E74C3C' : '#FFF'}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareProduct}>
                <Ionicons name="share-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderReviewItem = ({ item }: { item: Review }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <TouchableOpacity
          style={styles.reviewerProfileButton}
          onPress={() => navigation.navigate('PublicProfile', { userId: item.userId })}
        >
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
        </TouchableOpacity>
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
        <View style={styles.headerRightButtons}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => navigation.navigate('CreateContentReport', { 
              productId: productId,
              reportCategory: 'product'
            })}
          >
            <Ionicons name="flag-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Cart')}>
            <Ionicons name="cart-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 + (insets.bottom || 0) }}
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
            <Text style={styles.currentPrice}>₣{(product.price || 0).toFixed(2)}</Text>
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
            {product.vendor_avatar ? (
              <Image
                source={{ uri: product.vendor_avatar }}
                style={styles.sellerLogo}
              />
            ) : (
              <View style={[styles.sellerLogo, styles.sellerLogoPlaceholder]}>
                <Text style={styles.sellerLogoText}>
                  {product.vendor_username?.charAt(0).toUpperCase() || 'V'}
                </Text>
              </View>
            )}
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{product.vendor_username || 'Unknown Vendor'}</Text>
              <View style={styles.sellerRating}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.sellerRatingText}>Verified Seller</Text>
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
            <Text 
              style={styles.description}
              numberOfLines={descriptionExpanded ? undefined : 3}
            >
              {product.description}
            </Text>
            {product.description && product.description.length > 150 && (
              <TouchableOpacity
                onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                style={styles.seeMoreButton}
              >
                <Text style={styles.seeMoreText}>
                  {descriptionExpanded ? 'See Less' : 'See More'}
                </Text>
                <Ionicons 
                  name={descriptionExpanded ? 'chevron-up' : 'chevron-down'} 
                  size={16} 
                  color="#007AFF" 
                />
              </TouchableOpacity>
            )}
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
      <Animated.View
        style={[
          styles.bottomBar,
          { transform: [{ scale: scaleAnim }] },
          { paddingBottom: Math.max(insets.bottom || 0, 12) + 12 },
        ]}
      >
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={() => {
              setShowReviewModal(false);
              setSelectedRating(0);
              setReviewText('');
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
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
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <MediaViewerModal
        visible={mediaViewerVisible}
        onClose={() => setMediaViewerVisible(false)}
        type={mediaViewerType}
        uri={mediaViewerUri}
      />
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
  headerRightButtons: {
    flexDirection: 'row',
    gap: 8,
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
  carouselOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  videoBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255,71,87,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
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
  sellerLogoPlaceholder: {
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerLogoText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
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
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
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
  reviewerProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  reviewModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: screenWidth - 40,
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