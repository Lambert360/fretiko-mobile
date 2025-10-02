import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, ResizeMode } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI, LiveStream, Comment, GiftType } from '../services/liveSalesAPI';
import { userAPI } from '../services/userAPI';
import LiveProductPurchaseModal from '../components/LiveProductPurchaseModal';
import LiveServiceBookingModal from '../components/LiveServiceBookingModal';
import { auctionSounds } from '../utils/auctionSounds';
import { WinnerAnnouncementAnimation } from '../components/WinnerAnnouncementAnimation';
import { auctionsAPI, auctionSocket } from '../services/auctionsAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Real-time comment component
const CommentItem = ({ comment, isOwnComment }: { comment: Comment; isOwnComment: boolean }) => (
  <View style={[styles.commentItem, isOwnComment && styles.ownComment]}>
    <Image
      source={{ uri: comment.user.avatar_url || 'https://via.placeholder.com/24x24' }}
      style={styles.commentAvatar}
    />
    <View style={styles.commentContent}>
      <Text style={styles.commentUsername}>{comment.user.username}</Text>
      <Text style={styles.commentMessage}>{comment.message}</Text>
    </View>
    {comment.is_pinned && (
      <Ionicons name="pin" size={12} color="#FFD700" style={styles.pinnedIcon} />
    )}
  </View>
);

// Live product card overlay (TikTok Shop style)
const ProductOverlay = ({ 
  products, 
  isVisible, 
  onClose, 
  onProductPress 
}: { 
  products: any[];
  isVisible: boolean;
  onClose: () => void;
  onProductPress: (product: any) => void;
}) => {
  if (!isVisible) return null;

  return (
    <Animated.View style={styles.productOverlay}>
      <View style={styles.productOverlayHeader}>
        <Text style={styles.productOverlayTitle}>Products ({products.length})</Text>
        <TouchableOpacity onPress={onClose} style={styles.productOverlayClose}>
          <Ionicons name="close" size={20} color="white" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.productCard}
            onPress={() => onProductPress(item)}
          >
            <Image
              source={{ uri: item.product.primary_image_url || 'https://via.placeholder.com/120x120' }}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.product.name}
              </Text>
              <View style={styles.productPricing}>
                <Text style={styles.productPrice}>₣{item.live_price}</Text>
                <Text style={styles.productStock}>{item.live_stock} left</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.productsList}
      />
    </Animated.View>
  );
};

// Auction Bidding Overlay - for live auction streams
const AuctionBidOverlay = ({
  auction,
  isVisible,
  onClose,
  onPlaceBid,
}: {
  auction: any;
  isVisible: boolean;
  onClose: () => void;
  onPlaceBid: (amount: number) => void;
}) => {
  const [bidAmount, setBidAmount] = useState(auction?.current_bid + auction?.bid_increment || 0);

  if (!isVisible || !auction) return null;

  const suggestedBids = [
    auction.current_bid + auction.bid_increment,
    auction.current_bid + auction.bid_increment * 2,
    auction.current_bid + auction.bid_increment * 5,
  ];

  return (
    <View style={styles.auctionBidOverlay}>
      <View style={styles.auctionBidContent}>
        <View style={styles.auctionBidHeader}>
          <Text style={styles.auctionBidTitle}>🔨 Place Your Bid</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.auctionInfo}>
          <Text style={styles.auctionItemName}>{auction.title}</Text>
          <View style={styles.auctionBidStats}>
            <View style={styles.auctionStat}>
              <Text style={styles.auctionStatLabel}>Current Bid</Text>
              <Text style={styles.auctionStatValue}>₣{auction.current_bid}</Text>
            </View>
            <View style={styles.auctionStat}>
              <Text style={styles.auctionStatLabel}>Total Bids</Text>
              <Text style={styles.auctionStatValue}>{auction.total_bids || 0}</Text>
            </View>
            <View style={styles.auctionStat}>
              <Text style={styles.auctionStatLabel}>Min Increment</Text>
              <Text style={styles.auctionStatValue}>₣{auction.bid_increment}</Text>
            </View>
          </View>
        </View>

        <View style={styles.suggestedBids}>
          <Text style={styles.suggestedBidsLabel}>Quick Bid</Text>
          <View style={styles.suggestedBidsRow}>
            {suggestedBids.map((amount, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestedBidButton,
                  bidAmount === amount && styles.suggestedBidButtonActive,
                ]}
                onPress={() => setBidAmount(amount)}
              >
                <Text style={[
                  styles.suggestedBidText,
                  bidAmount === amount && styles.suggestedBidTextActive,
                ]}>
                  ₣{amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.customBidInput}>
          <Text style={styles.customBidLabel}>Custom Amount</Text>
          <View style={styles.bidInputRow}>
            <Text style={styles.currencySymbol}>₣</Text>
            <TextInput
              style={styles.bidInput}
              value={bidAmount.toString()}
              onChangeText={(text) => setBidAmount(Number(text) || 0)}
              keyboardType="numeric"
              placeholder="Enter bid amount"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.placeBidButton,
            bidAmount <= auction.current_bid && styles.placeBidButtonDisabled,
          ]}
          onPress={() => {
            if (bidAmount > auction.current_bid) {
              onPlaceBid(bidAmount);
              onClose();
            }
          }}
          disabled={bidAmount <= auction.current_bid}
        >
          <Ionicons name="hammer" size={20} color="white" />
          <Text style={styles.placeBidButtonText}>
            Place Bid of ₣{bidAmount}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// AI Auctioneer Commentary Display
const AuctioneerCommentary = ({
  message,
  isVisible,
}: {
  message: string;
  isVisible: boolean;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible && message) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [message, isVisible]);

  if (!isVisible || !message) return null;

  return (
    <Animated.View style={[styles.auctioneerBanner, { opacity: fadeAnim }]}>
      <View style={styles.auctioneerIcon}>
        <Ionicons name="megaphone" size={20} color="#8E44AD" />
      </View>
      <Text style={styles.auctioneerText}>{message}</Text>
    </Animated.View>
  );
};

// Gift selection overlay
const GiftOverlay = ({ 
  gifts, 
  isVisible, 
  onClose, 
  onGiftSend 
}: { 
  gifts: GiftType[];
  isVisible: boolean;
  onClose: () => void;
  onGiftSend: (gift: GiftType, quantity: number) => void;
}) => {
  const [selectedGift, setSelectedGift] = useState<GiftType | null>(null);
  const [quantity, setQuantity] = useState(1);

  if (!isVisible) return null;

  return (
    <View style={styles.giftOverlay}>
      <View style={styles.giftOverlayContent}>
        <View style={styles.giftOverlayHeader}>
          <Text style={styles.giftOverlayTitle}>Send Gift</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={gifts}
          numColumns={3}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.giftItem,
                selectedGift?.id === item.id && styles.giftItemSelected
              ]}
              onPress={() => setSelectedGift(item)}
            >
              <View style={[styles.giftIcon, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon_name as any} size={24} color="white" />
              </View>
              <Text style={styles.giftName}>{item.display_name}</Text>
              <Text style={styles.giftValue}>₣{item.base_value}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.giftsList}
        />

        {selectedGift && (
          <View style={styles.giftSendSection}>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={16} color="white" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={16} color="white" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.sendGiftButton}
              onPress={() => {
                onGiftSend(selectedGift, quantity);
                onClose();
                setSelectedGift(null);
                setQuantity(1);
              }}
            >
              <Text style={styles.sendGiftText}>
                Send ₣{(selectedGift.base_value * quantity).toFixed(2)}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

/**
 * Live Stream Viewer Screen
 * 
 * Full-screen live streaming experience with:
 * - Video player with real-time controls
 * - Live comments and reactions
 * - Product overlay (TikTok Shop style)
 * - Gift sending functionality
 * - Live purchasing capabilities
 */
const LiveStreamViewerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // Stream data
  const [stream, setStream] = useState<LiveStream | null>(route.params?.stream || null);
  const [loading, setLoading] = useState(!stream);
  
  // Real-time data
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewers, setViewers] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<string>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);

  // Animation refs for TikTok-style effects
  const heartAnimation = useRef(new Animated.Value(1)).current;
  const giftAnimation = useRef(new Animated.Value(1)).current;
  const shareAnimation = useRef(new Animated.Value(1)).current;
  const productBounce = useRef(new Animated.Value(1)).current;
  const reactionParticles = useRef<Animated.Value[]>([]).current;
  
  // UI state
  const [commentText, setCommentText] = useState('');
  const [showProducts, setShowProducts] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  
  // Data
  const [giftTypes, setGiftTypes] = useState<GiftType[]>([]);

  // Auction state (for live auction streams)
  const [isAuctionStream, setIsAuctionStream] = useState(false);
  const [currentAuction, setCurrentAuction] = useState<any>(null);
  const [showAuctionBid, setShowAuctionBid] = useState(false);
  const [auctioneerMessage, setAuctioneerMessage] = useState('');
  const [showAuctioneerMessage, setShowAuctioneerMessage] = useState(false);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [winnerData, setWinnerData] = useState<any>(null);

  // Refs
  const videoRef = useRef<Video>(null);
  const commentsListRef = useRef<FlatList>(null);
  const hideUITimer = useRef<NodeJS.Timeout>();

  // Initialize auction sounds and WebSocket when entering auction stream
  useEffect(() => {
    if (isAuctionStream && currentAuction) {
      auctionSounds.initialize();
      auctionSounds.startAmbience(0.2);

      // Connect to auction WebSocket
      auctionSocket.joinAuction(currentAuction.id, user?.id);

      // Setup WebSocket event listeners
      const handleBidPlaced = (data: any) => {
        console.log('Bid placed event:', data);
        // Update auction state with new bid
        setCurrentAuction((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            current_bid: data.amount,
            total_bids: (prev.total_bids || 0) + 1,
          };
        });
        // Play excited crowd sound
        auctionSounds.playExcitedCrowd(0.5);
      };

      const handleAuctioneerSpeaks = (data: any) => {
        console.log('Auctioneer speaks:', data);
        // Show auctioneer message
        if (data.message) {
          setAuctioneerMessage(data.message);
          setShowAuctioneerMessage(true);
        }
        // Play sound based on event type
        if (data.event_type === 'going_once') {
          auctionSounds.playGoingOnce();
        } else if (data.event_type === 'going_twice') {
          auctionSounds.playGoingTwice();
        } else if (data.event_type === 'sold') {
          auctionSounds.playSold();
        }
      };

      const handleBidConfirmed = (data: any) => {
        console.log('Bid confirmed:', data);
        Alert.alert('Bid Placed!', `Your bid of ₣${data.amount} has been placed successfully.`);
      };

      const handleBidError = (data: any) => {
        console.error('Bid error:', data);
        // Alert is already shown by auctionSocket
      };

      auctionSocket.on('bid_placed', handleBidPlaced);
      auctionSocket.on('auctioneer_speaks', handleAuctioneerSpeaks);
      auctionSocket.on('bid_confirmed', handleBidConfirmed);
      auctionSocket.on('bid_error', handleBidError);

      return () => {
        // Cleanup
        auctionSounds.stopAmbience();
        auctionSocket.off('bid_placed', handleBidPlaced);
        auctionSocket.off('auctioneer_speaks', handleAuctioneerSpeaks);
        auctionSocket.off('bid_confirmed', handleBidConfirmed);
        auctionSocket.off('bid_error', handleBidError);
        auctionSocket.leaveAuction(currentAuction.id);
      };
    }
  }, [isAuctionStream, currentAuction?.id]);

  // Auto-hide UI after inactivity
  const resetHideTimer = () => {
    if (hideUITimer.current) {
      clearTimeout(hideUITimer.current);
    }
    setShowUI(true);
    hideUITimer.current = setTimeout(() => {
      setShowUI(false);
    }, 3000);
  };

  // Load stream data
  const loadStreamData = async () => {
    try {
      if (!route.params?.streamId) {
        throw new Error('Stream ID not provided');
      }

      const streamData = await liveSalesAPI.getStreamById(route.params.streamId);
      setStream(streamData);
      setViewers(streamData.viewer_count);
    } catch (error) {
      console.error('Error loading stream:', error);
      Alert.alert('Error', 'Failed to load stream. Please try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Load gift types
  const loadGiftTypes = async () => {
    try {
      const gifts = await liveSalesAPI.getGiftTypes();
      setGiftTypes(gifts);
    } catch (error) {
      console.error('Error loading gifts:', error);
    }
  };

  // Load connection status with vendor
  const loadConnectionStatus = async () => {
    if (!stream || !user || stream.vendor.id === user.id) return;

    try {
      const status = await userAPI.getConnectionStatus(stream.vendor.id);
      setConnectionStatus(status.status);
      setConnectionId(status.connectionId || null);
    } catch (error) {
      console.error('Error loading connection status:', error);
      setConnectionStatus('none');
    }
  };

  // Load comments
  const loadComments = async () => {
    if (!stream) return;
    
    try {
      const streamComments = await liveSalesAPI.getStreamComments(stream.id);
      setComments(streamComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  // Send comment
  const sendComment = async () => {
    if (!commentText.trim() || !stream) return;

    try {
      const newComment = await liveSalesAPI.postComment(stream.id, commentText.trim());
      setComments(prev => [newComment, ...prev]);
      setCommentText('');

      // Scroll to top to show new comment
      commentsListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment. Please try again.');
    }
  };

  // Monitor comments for auction SOLD events
  useEffect(() => {
    if (!isAuctionStream || comments.length === 0) return;

    const latestComment = comments[0];

    // Check if latest comment is a SOLD announcement from host
    if (latestComment.message.includes('📢') && latestComment.message.includes('SOLD')) {
      // Extract bid amount from message
      const bidMatch = latestComment.message.match(/₣(\d+)/);
      const bidAmount = bidMatch ? parseInt(bidMatch[1]) : currentAuction?.current_bid || 0;

      // Show winner animation
      setWinnerData({
        winnerName: 'Highest Bidder',
        bidAmount: bidAmount,
        itemName: currentAuction?.item_name || 'Auction Item',
      });
      setShowWinnerAnimation(true);
    }
  }, [comments, isAuctionStream]);

  // Send reaction with TikTok-style animation
  const sendReaction = async (reactionType: string) => {
    if (!stream) return;

    try {
      // Trigger button animation
      if (reactionType === 'heart') {
        Animated.sequence([
          Animated.timing(heartAnimation, {
            toValue: 1.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(heartAnimation, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();

        // Create floating heart particles
        createReactionParticles('heart');
      }

      await liveSalesAPI.sendReaction(stream.id, reactionType);
    } catch (error) {
      console.error('Error sending reaction:', error);
    }
  };

  // Create floating reaction particles
  const createReactionParticles = (type: string) => {
    // Create 3-5 floating particles
    const particleCount = Math.floor(Math.random() * 3) + 3;

    for (let i = 0; i < particleCount; i++) {
      const particle = new Animated.Value(0);
      reactionParticles.push(particle);

      // Animate particle from bottom to top with fade
      Animated.parallel([
        Animated.timing(particle, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Remove particle after animation
        const index = reactionParticles.indexOf(particle);
        if (index > -1) {
          reactionParticles.splice(index, 1);
        }
      });
    }
  };

  // Handle gift button with animation
  const handleGiftPress = () => {
    Animated.sequence([
      Animated.timing(giftAnimation, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(giftAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setShowGifts(true);
  };

  // Handle share with animation
  const handleSharePress = () => {
    Animated.sequence([
      Animated.timing(shareAnimation, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(shareAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    console.log('Share stream');
  };

  // Handle product button with bounce
  const handleProductToggle = () => {
    Animated.sequence([
      Animated.timing(productBounce, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(productBounce, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setShowProducts(!showProducts);
  };

  // Auction: Place bid
  const handlePlaceBid = async (amount: number) => {
    if (!currentAuction) return;

    try {
      // Validate bid amount
      if (amount < currentAuction.current_bid + currentAuction.bid_increment) {
        Alert.alert(
          'Invalid Bid',
          `Minimum bid is ₣${currentAuction.current_bid + currentAuction.bid_increment}`
        );
        return;
      }

      // Play sound for new bid
      auctionSounds.playNewBid();

      // Use WebSocket for real-time bidding
      auctionSocket.placeBid(currentAuction.id, amount);

      // Close bid overlay
      setShowAuctionBid(false);

      // Optimistically update UI (will be confirmed by WebSocket event)
      setCurrentAuction({
        ...currentAuction,
        current_bid: amount,
        total_bids: (currentAuction.total_bids || 0) + 1,
      });

      // Show auctioneer commentary
      setAuctioneerMessage(`New bid of ₣${amount}! Do I hear ${amount + currentAuction.bid_increment}?`);
      setShowAuctioneerMessage(true);
    } catch (error) {
      console.error('Error placing bid:', error);
      Alert.alert('Error', 'Failed to place bid. Please try again.');
    }
  };

  // Auction: Handle auctioneer events from WebSocket
  const handleAuctioneerEvent = (event: any) => {
    setAuctioneerMessage(event.message);
    setShowAuctioneerMessage(true);

    // Auto-hide after 4 seconds
    setTimeout(() => {
      setShowAuctioneerMessage(false);
    }, 4000);
  };

  // Send gift
  const handleGiftSend = async (gift: GiftType, quantity: number) => {
    if (!stream) return;

    try {
      await liveSalesAPI.sendGift(stream.id, gift.name, quantity);
      Alert.alert('Success', `Sent ${quantity}x ${gift.display_name}!`);
    } catch (error) {
      console.error('Error sending gift:', error);
      Alert.alert('Error', 'Failed to send gift. Please try again.');
    }
  };

  // Handle product selection
  const handleProductPress = (product: any) => {
    setShowProducts(false);
    setSelectedProduct(product);
    setShowPurchaseModal(true);
  };

  // Handle purchase success
  const handlePurchaseSuccess = () => {
    setSelectedProduct(null);
    setShowPurchaseModal(false);
    // Reload stream data to get updated stock counts
    if (stream) {
      loadStreamData();
    }
  };

  // Handle service selection
  const handleServicePress = (service: any) => {
    setSelectedService(service);
    setShowServiceModal(true);
  };

  // Handle booking success
  const handleBookingSuccess = () => {
    setSelectedService(null);
    setShowServiceModal(false);
    // Reload stream data if needed
    if (stream) {
      loadStreamData();
    }
  };

  // Connect to stream
  const connectToStream = async () => {
    if (!stream) return;

    try {
      await liveSalesAPI.joinStream(stream.id);
      setIsConnected(true);
    } catch (error) {
      console.error('Error joining stream:', error);
    }
  };

  // Disconnect from stream
  const disconnectFromStream = async () => {
    if (!stream || !isConnected) return;

    try {
      await liveSalesAPI.leaveStream(stream.id);
      setIsConnected(false);
    } catch (error) {
      console.error('Error leaving stream:', error);
    }
  };

  // Handle plug/unplug action
  const handlePlugToggle = async () => {
    if (!stream || !user || stream.vendor.id === user.id || loadingConnection) return;

    setLoadingConnection(true);
    try {
      if (connectionStatus === 'accepted') {
        // Unplug (disconnect)
        if (connectionId) {
          await userAPI.deleteConnection(connectionId);
          setConnectionStatus('none');
          setConnectionId(null);
          Alert.alert('Unplugged', `You have disconnected from @${stream.vendor.username}`);
        }
      } else if (connectionStatus === 'none' || connectionStatus === 'blocked') {
        // Plug (connect)
        await userAPI.sendConnection(stream.vendor.id);
        setConnectionStatus('pending');
        Alert.alert('Plug Sent', `Connection request sent to @${stream.vendor.username}`);
      }
      // If status is 'pending', button should be disabled (handled in UI)
    } catch (error) {
      console.error('Error toggling connection:', error);
      Alert.alert('Error', 'Failed to update connection. Please try again.');
    } finally {
      setLoadingConnection(false);
    }
  };

  // Get plug button text and style
  const getPlugButtonConfig = () => {
    if (!stream || !user || stream.vendor.id === user.id) {
      return { text: '', visible: false, disabled: true, style: 'none' };
    }

    switch (connectionStatus) {
      case 'accepted':
        return { text: 'Unplug', visible: true, disabled: false, style: 'unplug' };
      case 'pending':
        return { text: 'Pending', visible: true, disabled: true, style: 'pending' };
      case 'blocked':
        return { text: 'Blocked', visible: true, disabled: true, style: 'blocked' };
      default:
        return { text: 'Plug', visible: true, disabled: false, style: 'plug' };
    }
  };

  // Initialize
  useEffect(() => {
    if (!stream) {
      loadStreamData();
    }
    loadGiftTypes();
    loadComments();
    connectToStream();
    loadConnectionStatus();

    return () => {
      disconnectFromStream();
      if (hideUITimer.current) {
        clearTimeout(hideUITimer.current);
      }
    };
  }, []);

  // Reload connection status when stream changes
  useEffect(() => {
    if (stream) {
      loadConnectionStatus();
    }
  }, [stream]);

  // Start hide timer on mount
  useEffect(() => {
    resetHideTimer();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FF4757" />
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  if (!stream) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="sad-outline" size={80} color="#666" />
        <Text style={styles.errorText}>Stream not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main video player */}
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1}
        onPress={resetHideTimer}
      >
        {stream.stream_url ? (
          <Video
            ref={videoRef}
            source={{ uri: stream.stream_url } as AVPlaybackSource}
            style={styles.video}
            shouldPlay={true}
            isLooping={true}
            isMuted={isMuted}
            resizeMode={ResizeMode.COVER}
            useNativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: stream.thumbnail_url || 'https://via.placeholder.com/400x600' }}
            style={styles.video}
            resizeMode="cover"
          />
        )}

        {/* Top UI Overlay */}
        {showUI && (
          <View style={styles.topOverlay}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <View style={styles.streamInfo}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.viewerCount}>{viewers} viewers</Text>
            </View>

            <TouchableOpacity 
              style={styles.muteButton}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons 
                name={isMuted ? "volume-mute" : "volume-high"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Vendor info overlay */}
        {showUI && (
          <View style={styles.vendorOverlay}>
            <Image
              source={{ uri: stream.vendor.avatar_url || 'https://via.placeholder.com/40x40' }}
              style={styles.vendorAvatar}
            />
            <View style={styles.vendorDetails}>
              <View style={styles.vendorNameRow}>
                <Text style={styles.vendorName}>@{stream.vendor.username}</Text>
                {stream.vendor.is_verified && (
                  <Ionicons name="checkmark-circle" size={16} color="#3498DB" />
                )}
              </View>
              <Text style={styles.streamTitle}>{stream.title}</Text>
            </View>

            {/* Plug/Unplug Button */}
            {(() => {
              const plugConfig = getPlugButtonConfig();
              if (!plugConfig.visible) return null;

              return (
                <TouchableOpacity
                  style={[
                    styles.plugButton,
                    plugConfig.style === 'unplug' && styles.unplugButton,
                    plugConfig.style === 'pending' && styles.pendingButton,
                    plugConfig.style === 'blocked' && styles.blockedButton,
                    (plugConfig.disabled || loadingConnection) && styles.disabledButton
                  ]}
                  onPress={handlePlugToggle}
                  disabled={plugConfig.disabled || loadingConnection}
                >
                  {loadingConnection ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons
                        name={plugConfig.style === 'unplug' ? 'unlink' : 'link'}
                        size={14}
                        color="white"
                      />
                      <Text style={styles.plugButtonText}>{plugConfig.text}</Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })()
            }
          </View>
        )}

        {/* Right side action buttons - TikTok style */}
        {showUI && (
          <View style={styles.rightActions}>
            {/* Heart/Like Button */}
            <Animated.View style={{ transform: [{ scale: heartAnimation }] }}>
              <TouchableOpacity
                style={[styles.actionButton, styles.heartButton]}
                onPress={() => sendReaction('heart')}
                activeOpacity={0.7}
              >
                <Ionicons name="heart" size={32} color="#FF4757" />
              </TouchableOpacity>
            </Animated.View>

            {/* Gift Button */}
            <Animated.View style={{ transform: [{ scale: giftAnimation }] }}>
              <TouchableOpacity
                style={[styles.actionButton, styles.giftButton]}
                onPress={handleGiftPress}
                activeOpacity={0.7}
              >
                <Ionicons name="gift" size={30} color="#FFD700" />
              </TouchableOpacity>
            </Animated.View>

            {/* Share Button */}
            <Animated.View style={{ transform: [{ scale: shareAnimation }] }}>
              <TouchableOpacity
                style={[styles.actionButton, styles.shareButton]}
                onPress={handleSharePress}
                activeOpacity={0.7}
              >
                <Ionicons name="share-social" size={28} color="white" />
              </TouchableOpacity>
            </Animated.View>

            {/* Product Button with Badge */}
            {stream.stream_type === 'products' && stream.products && stream.products.length > 0 && (
              <Animated.View style={{ transform: [{ scale: productBounce }] }}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.productButton]}
                  onPress={handleProductToggle}
                  activeOpacity={0.7}
                >
                  <Ionicons name="bag" size={30} color="white" />
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{stream.products.length}</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Service Button */}
            {stream.stream_type === 'services' && stream.services && stream.services.length > 0 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.serviceButton]}
                onPress={() => handleServicePress(stream.services[0])}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar" size={30} color="white" />
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{stream.services.length}</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Auction Bid Button - for live auction streams */}
            {isAuctionStream && currentAuction && (
              <TouchableOpacity
                style={[styles.actionButton, styles.auctionButton]}
                onPress={() => setShowAuctionBid(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="hammer" size={30} color="#8E44AD" />
                {currentAuction.total_bids > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{currentAuction.total_bids}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* AI Auctioneer Commentary Banner */}
        {isAuctionStream && (
          <AuctioneerCommentary
            message={auctioneerMessage}
            isVisible={showAuctioneerMessage}
          />
        )}

        {/* Floating Reaction Particles */}
        {reactionParticles.map((particle, index) => (
          <Animated.View
            key={index}
            style={[
              styles.reactionParticle,
              {
                right: 60 + Math.random() * 40,
                bottom: 200 + Math.random() * 100,
                opacity: particle.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    translateY: particle.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -200],
                    }),
                  },
                  {
                    scale: particle.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.5, 1.2, 0.8],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="heart" size={24} color="#FF4757" />
          </Animated.View>
        ))}
      </TouchableOpacity>

      {/* Comments section */}
      <View style={styles.commentsSection}>
        <FlatList
          ref={commentsListRef}
          data={comments}
          renderItem={({ item }) => (
            <CommentItem 
              comment={item} 
              isOwnComment={item.user.id === user?.id}
            />
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          inverted
          contentContainerStyle={styles.commentsList}
        />
      </View>

      {/* Comment input */}
      <KeyboardAvoidingView 
        style={styles.commentInputContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#888"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              !commentText.trim() && styles.sendButtonDisabled
            ]}
            onPress={sendComment}
            disabled={!commentText.trim()}
          >
            <Ionicons name="send" size={20} color={commentText.trim() ? "#FF4757" : "#666"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Product overlay */}
      <ProductOverlay
        products={stream.products || []}
        isVisible={showProducts}
        onClose={() => setShowProducts(false)}
        onProductPress={handleProductPress}
      />

      {/* Gift overlay */}
      <GiftOverlay
        gifts={giftTypes}
        isVisible={showGifts}
        onClose={() => setShowGifts(false)}
        onGiftSend={handleGiftSend}
      />

      {/* Winner Announcement Animation */}
      {showWinnerAnimation && winnerData && (
        <WinnerAnnouncementAnimation
          isVisible={showWinnerAnimation}
          winnerName={winnerData.winnerName}
          bidAmount={winnerData.bidAmount}
          itemName={winnerData.itemName}
          onAnimationEnd={() => {
            setShowWinnerAnimation(false);
            setWinnerData(null);
          }}
        />
      )}

      {/* Product purchase modal */}
      <LiveProductPurchaseModal
        visible={showPurchaseModal}
        product={selectedProduct}
        streamId={stream?.id || ''}
        onClose={() => {
          setShowPurchaseModal(false);
          setSelectedProduct(null);
        }}
        onPurchaseSuccess={handlePurchaseSuccess}
      />

      {/* Service booking modal */}
      <LiveServiceBookingModal
        visible={showServiceModal}
        service={selectedService}
        streamId={stream?.id || ''}
        onClose={() => {
          setShowServiceModal(false);
          setSelectedService(null);
        }}
        onBookingSuccess={handleBookingSuccess}
      />

      {/* Auction bid overlay */}
      {isAuctionStream && currentAuction && (
        <AuctionBidOverlay
          auction={currentAuction}
          isVisible={showAuctionBid}
          onClose={() => setShowAuctionBid(false)}
          onPlaceBid={handlePlaceBid}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Video player
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },

  // Overlays
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  streamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 4,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewerCount: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  muteButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },

  // Vendor info
  vendorOverlay: {
    position: 'absolute',
    left: 16,
    top: 120,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: screenWidth - 100, // Leave space for right actions
  },
  vendorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  vendorDetails: {
    flex: 1,
  },
  vendorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorName: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
  },
  streamTitle: {
    color: '#CCC',
    fontSize: 12,
  },

  // Plug/Unplug button
  plugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  unplugButton: {
    backgroundColor: '#E74C3C',
  },
  pendingButton: {
    backgroundColor: '#F39C12',
  },
  blockedButton: {
    backgroundColor: '#95A5A6',
  },
  disabledButton: {
    opacity: 0.6,
  },
  plugButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },

  // Right actions - TikTok style
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heartButton: {
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  giftButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  shareButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  productButton: {
    position: 'relative',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  serviceButton: {
    position: 'relative',
    backgroundColor: 'rgba(155, 89, 182, 0.2)',
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF4757',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  reactionParticle: {
    position: 'absolute',
    zIndex: 1000,
  },

  // Comments
  commentsSection: {
    position: 'absolute',
    left: 16,
    right: 80,
    bottom: 100,
    height: 200,
  },
  commentsList: {
    paddingVertical: 8,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  ownComment: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(52, 152, 219, 0.8)',
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  commentMessage: {
    color: 'white',
    fontSize: 14,
    lineHeight: 18,
  },
  pinnedIcon: {
    marginLeft: 4,
  },

  // Comment input
  commentInputContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    maxHeight: 80,
    paddingVertical: 8,
  },
  sendButton: {
    padding: 8,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Product overlay
  productOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  productOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  productOverlayTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  productOverlayClose: {
    padding: 4,
  },
  productsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productCard: {
    width: 120,
    marginRight: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 120,
  },
  productInfo: {
    padding: 8,
  },
  productName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    color: '#FF4757',
    fontSize: 14,
    fontWeight: 'bold',
  },
  productStock: {
    color: '#888',
    fontSize: 10,
  },

  // Gift overlay
  giftOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  giftOverlayContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  giftOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  giftOverlayTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  giftsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  giftItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
  },
  giftItemSelected: {
    backgroundColor: '#3498DB',
  },
  giftIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  giftName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  giftValue: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
  },
  giftSendSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
  },
  sendGiftButton: {
    backgroundColor: '#FF4757',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendGiftText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Loading states
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonText: {
    color: '#3498DB',
    fontSize: 16,
    fontWeight: '600',
  },

  // Auction styles
  auctionButton: {
    backgroundColor: 'rgba(142, 68, 173, 0.3)',
    borderWidth: 2,
    borderColor: '#8E44AD',
  },
  auctionBidOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  auctionBidContent: {
    padding: 20,
  },
  auctionBidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  auctionBidTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  auctionInfo: {
    marginBottom: 20,
  },
  auctionItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 12,
  },
  auctionBidStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  auctionStat: {
    flex: 1,
    alignItems: 'center',
  },
  auctionStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  auctionStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8E44AD',
  },
  suggestedBids: {
    marginBottom: 20,
  },
  suggestedBidsLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  suggestedBidsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  suggestedBidButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  suggestedBidButtonActive: {
    backgroundColor: '#8E44AD',
    borderColor: '#8E44AD',
  },
  suggestedBidText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestedBidTextActive: {
    color: 'white',
  },
  customBidInput: {
    marginBottom: 20,
  },
  customBidLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  bidInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 20,
    color: '#8E44AD',
    fontWeight: 'bold',
    marginRight: 8,
  },
  bidInput: {
    flex: 1,
    fontSize: 18,
    color: 'white',
    paddingVertical: 12,
  },
  placeBidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8E44AD',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  placeBidButtonDisabled: {
    backgroundColor: '#444',
    opacity: 0.5,
  },
  placeBidButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  auctioneerBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(142, 68, 173, 0.95)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  auctioneerIcon: {
    marginRight: 12,
  },
  auctioneerText: {
    flex: 1,
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    lineHeight: 22,
  },
});

export default LiveStreamViewerScreen;