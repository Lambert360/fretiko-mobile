import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { servicesAPI, VideoFeedItem } from '../services/servicesAPI';
import ServiceVideoPlayer from '../components/ServiceVideoPlayer';
import { MediaViewerModal } from '../components/MediaViewerModal';
import { useAuth } from '../contexts/AuthContext';
import { chatAPI } from '../services/chatAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ServiceDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [service, setService] = useState<VideoFeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerType, setMediaViewerType] = useState<'image' | 'video'>('image');
  const [mediaViewerUri, setMediaViewerUri] = useState<string>('');

  const serviceId = route.params?.serviceId;

  const openMediaViewer = (type: 'image' | 'video', uri: string) => {
    setMediaViewerType(type);
    setMediaViewerUri(uri);
    setMediaViewerVisible(true);
  };

  useEffect(() => {
    if (serviceId) {
      loadServiceDetails();
    }
  }, [serviceId]);

  const loadServiceDetails = async () => {
    try {
      setLoading(true);
      // Get service details from the video feed
      const videoFeed = await servicesAPI.getVideoFeed();
      const serviceDetails = videoFeed.find(item => item.id === serviceId);

      if (serviceDetails) {
        setService(serviceDetails);
        setIsLiked(serviceDetails.isLiked || false);
        setIsBookmarked(serviceDetails.isBookmarked || false);
      } else {
        Alert.alert('Error', 'Service not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading service details:', error);
      Alert.alert('Error', 'Failed to load service details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!service) return;

    try {
      const result = await servicesAPI.toggleLike(service.id);
      setIsLiked(result.liked);

      // Update the service like count
      setService(prev => prev ? {
        ...prev,
        likes: result.likeCount.toString(),
        isLiked: result.liked
      } : null);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // TODO: Implement bookmark API call when available
  };

  const handleComment = () => {
    // TODO: Open comments modal/screen
    console.log('Open comments for service:', service?.id);
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Share service:', service?.id);
  };

  const handleBookNow = () => {
    if (!service) return;

    // TODO: Navigate to booking screen or open booking modal
    Alert.alert(
      'Book Service',
      `Book "${service.title}" now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book Now',
          onPress: () => {
            console.log('Booking service:', service.id);
            // TODO: Implement booking logic
          }
        }
      ]
    );
  };

  const handleChatWithProvider = async () => {
    if (!service || !user) return;

    try {
      console.log('🔍 Starting chat with service provider:', service.userId);

      // Determine chat type based on current user's role
      // Service providers can be either vendors or riders
      // Priority: rider > vendor > friend
      let chatType: 'friend' | 'vendor' | 'rider' = 'vendor'; // Default to vendor for service providers

      // Check if current user is a rider (highest priority)
      if (user.is_rider) {
        chatType = 'rider';
      }
      // If current user is seller, keep it as vendor
      else if (user.is_seller) {
        chatType = 'vendor';
      }
      // Service provider is assumed to be vendor, so default stays 'vendor'

      // Find existing conversation or create a new one with the service provider
      const conversation = await chatAPI.findOrCreateConversation(
        [service.userId], // The service provider's user ID
        chatType
      );

      console.log('✅ Conversation found/created:', conversation.id);

      // Navigate to IndividualChatScreen with proper parameters
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: service.serviceProvider || 'Service Provider', // Use provider name
        chatAvatar: service.userAvatar || 'https://via.placeholder.com/50', // Use provider avatar
        chatType: chatType,
        isOnline: true, // Assume online for now
        verified: false, // Set based on provider verification status if available
        isAI: false,
        otherUserId: service.userId, // Add the service provider's ID
      });
    } catch (error) {
      console.error('Error creating conversation with service provider:', error);
      Alert.alert('Error', 'Unable to start conversation with service provider. Please try again.');
    }
  };

  const handleProfilePress = () => {
    if (service?.userId) {
      navigation.navigate('PublicProfile', { userId: service.userId });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading service...</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#E74C3C" />
        <Text style={styles.errorText}>Service not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Details</Text>
        <View style={styles.headerRightButtons}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => navigation.navigate('CreateContentReport', { 
              serviceId: serviceId,
              reportCategory: 'service'
            })}
          >
            <Ionicons name="flag-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Section */}
        <View style={styles.videoContainer}>
          {service.videoUri ? (
            <>
              {/* Video: pointerEvents none so overlay receives touches */}
              <View style={styles.videoWrapper} pointerEvents="none">
                <ServiceVideoPlayer
                  videoUri={service.videoUri}
                  isCurrentVideo={true}
                  shouldAutoPlay={isPlaying}
                  onLoad={(status) => console.log('Video loaded:', status)}
                  onPlaybackStatusUpdate={(status) => console.log('Video status:', status)}
                />
              </View>
              {/* Overlay: tap-to-open modal + play/pause; videoActions sibling stays on top */}
              <View style={styles.videoOverlay} pointerEvents="box-none">
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => openMediaViewer('video', service.videoUri!)}
                />
                <TouchableOpacity
                  style={styles.playPauseButton}
                  onPress={() => setIsPlaying(!isPlaying)}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={32}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : service.thumbnail ? (
            <TouchableOpacity
              style={styles.thumbnailContainer}
              activeOpacity={1}
              onPress={() => openMediaViewer('image', service.thumbnail!)}
            >
              <Image source={{ uri: service.thumbnail }} style={styles.thumbnail} />
            </TouchableOpacity>
          ) : (
            <View style={styles.noVideoContainer}>
              <Ionicons name="videocam-off" size={64} color="#888" />
              <Text style={styles.noVideoText}>No video available</Text>
            </View>
          )}

          {/* Video Actions (like, comment, bookmark) - sibling of overlay, on top */}
          <View style={styles.videoActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={28}
                color={isLiked ? "#E74C3C" : "#FFFFFF"}
              />
              <Text style={styles.actionText}>{service.likes}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
              <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
              <Text style={styles.actionText}>{service.comments}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleBookmark}>
              <Ionicons
                name={isBookmarked ? "bookmark" : "bookmark-outline"}
                size={28}
                color={isBookmarked ? "#FFD700" : "#FFFFFF"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Information */}
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text 
            style={styles.serviceDescription}
            numberOfLines={descriptionExpanded ? undefined : 3}
          >
            {service.description}
          </Text>
          {service.description && service.description.length > 150 && (
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

          {/* Provider Info */}
          <TouchableOpacity style={styles.providerSection} onPress={handleProfilePress}>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{service.serviceProvider}</Text>
              <Text style={styles.providerLocation}>{service.location}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>{service.rating}</Text>
                <Text style={styles.completedJobs}>• {service.completedJobs} jobs completed</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>

          {/* Price Section */}
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Starting from</Text>
            <Text style={styles.price}>₣{service.price?.toLocaleString()}</Text>
            {service.originalPrice && (
              <Text style={styles.originalPrice}>₣{service.originalPrice.toLocaleString()}</Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.bookButton} onPress={handleBookNow}>
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatButton} onPress={handleChatWithProvider}>
              <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
              <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerRightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight * 0.6,
    position: 'relative',
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbnailContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  noVideoText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoActions: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  serviceInfo: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  serviceTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  serviceDescription: {
    color: '#CCCCCC',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  providerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerLocation: {
    color: '#888',
    fontSize: 14,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  completedJobs: {
    color: '#888',
    fontSize: 12,
    marginLeft: 8,
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  priceLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  originalPrice: {
    color: '#888',
    fontSize: 16,
    textDecorationLine: 'line-through',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bookButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  chatButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ServiceDetailsScreen;