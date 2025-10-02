import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  FlatList,
  Image,
  Alert,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

// Import our components
import LiveStreamViewer from '../components/LiveStreamViewer';
import LiveStreamPublisher from '../components/LiveStreamPublisher';
import StreamQualityControls from '../components/StreamQualityControls';
import CameraAudioControls from '../components/CameraAudioControls';
import LiveProductPurchaseModal from '../components/LiveProductPurchaseModal';
import LiveServiceBookingModal from '../components/LiveServiceBookingModal';

// Import services
import { liveSalesAPI, Comment, GiftType } from '../services/liveSalesAPI';
import { streamingService } from '../services/streamingService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface IntegratedLiveStreamScreenProps {
  route: {
    params: {
      streamId: string;
      channelName?: string;
      vendorId: string;
      isPublisher?: boolean;
      hasVideoStreaming?: boolean;
      fallbackUrl?: string;
      thumbnailUrl?: string;
      streamConfig?: any;
    };
  };
}

/**
 * Integrated Live Stream Screen
 *
 * Combines video streaming with live sales features:
 * - Video streaming (publisher or viewer mode)
 * - Live chat with real-time comments
 * - Product showcase and purchasing
 * - Gift sending and receiving
 * - Service booking
 * - Analytics integration
 * - Quality controls and camera management
 */
const IntegratedLiveStreamScreen: React.FC<IntegratedLiveStreamScreenProps> = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const {
    streamId,
    channelName,
    vendorId,
    isPublisher = false,
    hasVideoStreaming = false,
    fallbackUrl,
    thumbnailUrl,
    streamConfig,
  } = route.params as any;

  // State management
  const [stream, setStream] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [giftTypes, setGiftTypes] = useState<GiftType[]>([]);

  // UI states
  const [showProducts, setShowProducts] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [showQualityControls, setShowQualityControls] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Modals
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // Video streaming states
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [currentQuality, setCurrentQuality] = useState<'low' | 'medium' | 'high' | 'auto'>('medium');
  const [viewerCount, setViewerCount] = useState(0);

  // Refs
  const commentsListRef = useRef<FlatList>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const slideAnimation = useRef(new Animated.Value(0)).current;

  // Load stream data
  useEffect(() => {
    loadStreamData();
    loadGiftTypes();

    // Auto-hide controls
    resetControlsTimer();

    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, []);

  // Load stream data
  const loadStreamData = async () => {
    try {
      setIsLoading(true);

      const [streamData, commentsData, productsData, servicesData] = await Promise.all([
        liveSalesAPI.getStreamById(streamId),
        liveSalesAPI.getStreamComments(streamId),
        liveSalesAPI.getStreamProducts(streamId),
        liveSalesAPI.getStreamServices(streamId),
      ]);

      setStream(streamData);
      setComments(commentsData);
      setProducts(productsData);
      setServices(servicesData);
      setViewerCount(streamData.viewer_count || 0);
    } catch (error) {
      console.error('Error loading stream data:', error);
      Alert.alert('Error', 'Failed to load stream data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load gift types
  const loadGiftTypes = async () => {
    try {
      const gifts = await liveSalesAPI.getGiftTypes();
      setGiftTypes(gifts);
    } catch (error) {
      console.error('Error loading gift types:', error);
    }
  };

  // Handle comment submission
  const handleSendComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      const comment = await liveSalesAPI.sendComment(streamId, newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');

      // Scroll to bottom
      setTimeout(() => {
        commentsListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment');
    }
  };

  // Handle gift sending
  const handleSendGift = async (gift: GiftType, quantity: number) => {
    if (!user) return;

    try {
      await liveSalesAPI.sendGift(streamId, gift.name, quantity);
      setShowGifts(false);

      // Add gift animation here
      Alert.alert('Success', `Sent ${quantity}x ${gift.display_name}!`);
    } catch (error) {
      console.error('Error sending gift:', error);
      Alert.alert('Error', 'Failed to send gift');
    }
  };

  // Handle product purchase
  const handleProductPress = (product: any) => {
    setSelectedProduct(product);
    setShowPurchaseModal(true);
    setShowProducts(false);
  };

  // Handle service booking
  const handleServicePress = (service: any) => {
    setSelectedService(service);
    setShowServiceModal(true);
    setShowServices(false);
  };

  // Handle viewer count change
  const handleViewerCountChange = useCallback((count: number) => {
    setViewerCount(count);
  }, []);

  // Handle stream end
  const handleStreamEnd = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Controls auto-hide logic
  const resetControlsTimer = () => {
    setShowControls(true);

    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }

    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  };

  // Handle screen touch
  const handleScreenTouch = () => {
    resetControlsTimer();
  };

  // Video streaming control handlers
  const handleToggleVideo = async (enabled: boolean) => {
    setIsVideoEnabled(enabled);
    if (isPublisher) {
      await streamingService.toggleVideo(enabled);
    }
  };

  const handleToggleAudio = async (enabled: boolean) => {
    setIsAudioEnabled(enabled);
    if (isPublisher) {
      await streamingService.toggleAudio(enabled);
    }
  };

  const handleSwitchCamera = async () => {
    setIsFrontCamera(!isFrontCamera);
    if (isPublisher) {
      await streamingService.switchCamera();
    }
  };

  const handleQualityChange = (quality: 'low' | 'medium' | 'high' | 'auto') => {
    setCurrentQuality(quality);
  };

  // Animate side panels
  const toggleSidePanel = (show: boolean) => {
    Animated.timing(slideAnimation, {
      toValue: show ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Render comment item
  const renderComment = ({ item: comment }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Image
        source={{ uri: comment.user.avatar_url || 'https://via.placeholder.com/24x24' }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <Text style={styles.commentUsername}>{comment.user.username}</Text>
        <Text style={styles.commentMessage}>{comment.message}</Text>
      </View>
    </View>
  );

  // Render product item
  const renderProduct = ({ item: product }: { item: any }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() => handleProductPress(product)}
    >
      <Image source={{ uri: product.image }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productPrice}>₣{product.price.toFixed(2)}</Text>
        <Text style={styles.productStock}>{product.stock_quantity} left</Text>
      </View>
    </TouchableOpacity>
  );

  // Render gift item
  const renderGift = ({ item: gift }: { item: GiftType }) => (
    <TouchableOpacity
      style={styles.giftItem}
      onPress={() => handleSendGift(gift, 1)}
    >
      <Text style={styles.giftIcon}>{gift.icon}</Text>
      <Text style={styles.giftName}>{gift.display_name}</Text>
      <Text style={styles.giftPrice}>₣{gift.price}</Text>
    </TouchableOpacity>
  );

  // Render video content
  const renderVideoContent = () => {
    if (hasVideoStreaming) {
      if (isPublisher) {
        return (
          <LiveStreamPublisher
            streamId={streamId}
            channelName={channelName!}
            vendorId={vendorId}
            onStreamEnd={handleStreamEnd}
            onViewerCountChange={handleViewerCountChange}
            streamConfig={streamConfig}
          />
        );
      } else {
        return (
          <LiveStreamViewer
            streamId={streamId}
            channelName={channelName!}
            vendorId={vendorId}
            streamUrl={fallbackUrl}
            thumbnailUrl={thumbnailUrl}
            onViewerJoin={() => console.log('Viewer joined')}
            onViewerLeave={() => console.log('Viewer left')}
            showAnalytics={true}
          />
        );
      }
    }

    // Fallback to traditional video
    return (
      <View style={styles.fallbackVideoContainer}>
        <Image
          source={{ uri: thumbnailUrl || 'https://via.placeholder.com/400x600' }}
          style={styles.fallbackVideo}
          resizeMode="cover"
        />
      </View>
    );
  };

  // Render overlay controls
  const renderOverlayControls = () => {
    if (!showControls) return null;

    return (
      <Animated.View
        style={[
          styles.overlayControls,
          {
            opacity: showControls ? 1 : 0,
          },
        ]}
      >
        {/* Top controls */}
        <View style={[styles.topControls, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.streamStatus}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Text style={styles.viewerCountText}>{viewerCount} viewers</Text>
          </View>

          {isPublisher && hasVideoStreaming && (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowCameraControls(true)}
            >
              <Ionicons name="settings" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Side controls */}
        <View style={styles.sideControls}>
          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => {
              setShowProducts(!showProducts);
              toggleSidePanel(!showProducts);
            }}
          >
            <Ionicons name="bag" size={24} color="white" />
            <Text style={styles.sideButtonText}>{products.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => {
              setShowGifts(!showGifts);
              toggleSidePanel(!showGifts);
            }}
          >
            <Ionicons name="gift" size={24} color="white" />
          </TouchableOpacity>

          {services.length > 0 && (
            <TouchableOpacity
              style={styles.sideButton}
              onPress={() => {
                setShowServices(!showServices);
                toggleSidePanel(!showServices);
              }}
            >
              <Ionicons name="calendar" size={24} color="white" />
              <Text style={styles.sideButtonText}>{services.length}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.sideButton}>
            <Ionicons name="share" size={24} color="white" />
          </TouchableOpacity>

          {hasVideoStreaming && (
            <TouchableOpacity
              style={styles.sideButton}
              onPress={() => setShowQualityControls(true)}
            >
              <Ionicons name="settings" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  // Render bottom section
  const renderBottomSection = () => (
    <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 10 }]}>
      {/* Comments section */}
      <View style={styles.commentsSection}>
        <FlatList
          ref={commentsListRef}
          data={comments.slice(-5)} // Show last 5 comments
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          style={styles.commentsList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Input section */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputSection}
      >
        <TextInput
          style={styles.commentInput}
          placeholder="Say something..."
          placeholderTextColor="#999"
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={200}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
          onPress={handleSendComment}
          disabled={!newComment.trim()}
        >
          <Ionicons name="send" size={20} color={newComment.trim() ? "white" : "#ccc"} />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );

  // Render side panels
  const renderSidePanels = () => (
    <Animated.View
      style={[
        styles.sidePanels,
        {
          transform: [
            {
              translateX: slideAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [300, 0],
              }),
            },
          ],
        },
      ]}
    >
      {showProducts && (
        <View style={styles.sidePanel}>
          <Text style={styles.sidePanelTitle}>Products</Text>
          <FlatList
            data={products}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            numColumns={2}
            style={styles.sidePanelList}
          />
        </View>
      )}

      {showGifts && (
        <View style={styles.sidePanel}>
          <Text style={styles.sidePanelTitle}>Send Gifts</Text>
          <FlatList
            data={giftTypes}
            renderItem={renderGift}
            keyExtractor={(item) => item.id}
            numColumns={3}
            style={styles.sidePanelList}
          />
        </View>
      )}
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Video content */}
      <TouchableOpacity
        style={styles.videoWrapper}
        activeOpacity={1}
        onPress={handleScreenTouch}
      >
        {renderVideoContent()}
      </TouchableOpacity>

      {/* Overlay controls */}
      {renderOverlayControls()}

      {/* Side panels */}
      {renderSidePanels()}

      {/* Bottom section */}
      {renderBottomSection()}

      {/* Modals */}
      {selectedProduct && (
        <LiveProductPurchaseModal
          isVisible={showPurchaseModal}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          streamId={streamId}
          onSuccess={() => {
            setShowPurchaseModal(false);
            setSelectedProduct(null);
          }}
        />
      )}

      {selectedService && (
        <LiveServiceBookingModal
          isVisible={showServiceModal}
          onClose={() => {
            setShowServiceModal(false);
            setSelectedService(null);
          }}
          service={selectedService}
          streamId={streamId}
          onSuccess={() => {
            setShowServiceModal(false);
            setSelectedService(null);
          }}
        />
      )}

      <StreamQualityControls
        isVisible={showQualityControls}
        onClose={() => setShowQualityControls(false)}
        currentQuality={currentQuality}
        onQualityChange={handleQualityChange}
        isPublisher={isPublisher}
      />

      <CameraAudioControls
        isVisible={showCameraControls}
        onClose={() => setShowCameraControls(false)}
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isFrontCamera={isFrontCamera}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onSwitchCamera={handleSwitchCamera}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  videoWrapper: {
    flex: 1,
  },
  fallbackVideoContainer: {
    flex: 1,
  },
  fallbackVideo: {
    width: '100%',
    height: '100%',
  },

  // Overlay controls
  overlayControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamStatus: {
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewerCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Side controls
  sideControls: {
    position: 'absolute',
    right: 16,
    top: '30%',
    alignItems: 'center',
    gap: 16,
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },

  // Bottom section
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '40%',
  },
  commentsSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  commentAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  commentMessage: {
    color: 'white',
    fontSize: 12,
    marginTop: 2,
  },

  // Input section
  inputSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
    color: '#1a1a1a',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },

  // Side panels
  sidePanels: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 300,
    backgroundColor: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(10px)',
  },
  sidePanel: {
    flex: 1,
    padding: 16,
  },
  sidePanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  sidePanelList: {
    flex: 1,
  },

  // Product styles
  productItem: {
    width: '48%',
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: '1%',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 2,
  },
  productStock: {
    fontSize: 10,
    color: '#666',
  },

  // Gift styles
  giftItem: {
    width: '30%',
    aspectRatio: 1,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: '1.5%',
  },
  giftIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  giftName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 2,
  },
  giftPrice: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#667eea',
  },
});

export default IntegratedLiveStreamScreen;