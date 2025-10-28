import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../contexts/AuthContext';
import { auctionsAPI, auctionSocket, AuctionWithDetails } from '../services/auctionsAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Comment {
  id: string;
  user: { username: string; avatar_url?: string };
  message: string;
  created_at: string;
}

/**
 * Auction Live Viewer Screen
 * 
 * For viewers to watch live auction stream and place bids simultaneously
 * - HLS video playback (Expo Go compatible)
 * - Real-time bidding interface
 * - WebSocket bid updates
 * - Live comments
 */
const AuctionLiveViewerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { auctionId } = route.params;

  // State
  const [auction, setAuction] = useState<AuctionWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [placingBid, setPlacingBid] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Video player
  const videoPlayer = auction?.stream_url ? useVideoPlayer(auction.stream_url, player => {
    player.loop = false;
    player.play();
  }) : null;

  // Load auction data
  const loadAuctionData = async () => {
    try {
      const auctionData = await auctionsAPI.getAuction(auctionId);
      setAuction(auctionData);
      setTimeRemaining(auctionData.seconds_remaining || 0);

      // Set initial bid amount
      const nextBid = auctionData.current_bid + auctionData.bid_increment;
      setBidAmount(nextBid.toString());
    } catch (error) {
      console.error('Error loading auction:', error);
      Alert.alert('Error', 'Failed to load auction');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Connect to WebSocket
  useEffect(() => {
    loadAuctionData();

    auctionSocket.connect();
    auctionSocket.joinAuction(auctionId, user?.id);

    // Handle real-time bid updates
    const handleNewBid = (data: any) => {
      if (data.auction_id === auctionId) {
        setAuction(prev => prev ? {
          ...prev,
          current_bid: data.amount,
          total_bids: (prev.total_bids || 0) + 1
        } : null);
      }
    };

    const handleAuctionStatusChanged = (data: any) => {
      if (data.auction_id === auctionId) {
        loadAuctionData();
        if (data.new_status === 'sold' || data.new_status === 'ended') {
          Alert.alert(
            'Auction Ended',
            data.winner_id === user?.id ? '🎉 Congratulations! You won!' : 'Auction has ended',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      }
    };

    auctionSocket.on('new_bid', handleNewBid);
    auctionSocket.on('auction_status_changed', handleAuctionStatusChanged);

    return () => {
      auctionSocket.off('new_bid', handleNewBid);
      auctionSocket.off('auction_status_changed', handleAuctionStatusChanged);
      auctionSocket.leaveAuction(auctionId);
      videoPlayer?.pause();
    };
  }, [auctionId]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => (prev && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  // Handle bid placement
  const handlePlaceBid = async () => {
    if (!user || !auction) return;

    const amount = parseFloat(bidAmount);
    const minimumBid = auction.current_bid + auction.bid_increment;

    if (isNaN(amount) || amount < minimumBid) {
      Alert.alert('Invalid Bid', `Minimum bid is ₣${minimumBid.toFixed(2)}`);
      return;
    }

    setPlacingBid(true);

    try {
      await auctionsAPI.placeBid({
        auction_id: auctionId,
        amount,
        bid_type: 'manual',
      });

      setBidModalVisible(false);
      Alert.alert('Success', 'Bid placed successfully!');
    } catch (error: any) {
      // Error handling in API service
    } finally {
      setPlacingBid(false);
    }
  };

  // Quick bid
  const handleQuickBid = (increment: number) => {
    if (!auction) return;
    const amount = auction.current_bid + (auction.bid_increment * increment);
    setBidAmount(amount.toString());
    setBidModalVisible(true);
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Ended';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading || !auction) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Loading live auction...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Video Player */}
      {videoPlayer && auction.stream_url && (
        <VideoView
          style={styles.video}
          player={videoPlayer}
          nativeControls={false}
          contentFit="cover"
        />
      )}

      {/* Overlay UI */}
      <View style={styles.overlay}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>

          <View style={styles.viewerCount}>
            <Ionicons name="eye" size={16} color="white" />
            <Text style={styles.viewerText}>{auction.view_count || 0}</Text>
          </View>
        </View>

        {/* Auction Info Card */}
        <View style={styles.auctionInfoCard}>
          <Text style={styles.auctionTitle} numberOfLines={1}>{auction.title}</Text>
          
          <View style={styles.bidRow}>
            <View>
              <Text style={styles.label}>Current Bid</Text>
              <Text style={styles.currentBid}>₣{auction.current_bid.toFixed(2)}</Text>
            </View>
            
            <View>
              <Text style={styles.label}>Time Left</Text>
              <Text style={styles.timeLeft}>{formatTimeRemaining(timeRemaining || 0)}</Text>
            </View>

            <View>
              <Text style={styles.label}>Bids</Text>
              <Text style={styles.bidCount}>{auction.total_bids || 0}</Text>
            </View>
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={styles.quickBidButton}
            onPress={() => handleQuickBid(1)}
          >
            <Text style={styles.quickBidText}>+1</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bidButton}
            onPress={() => setBidModalVisible(true)}
            disabled={auction.seller_id === user?.id}
          >
            <Ionicons name="hammer" size={20} color="white" />
            <Text style={styles.bidButtonText}>
              {auction.seller_id === user?.id ? 'Your Auction' : 'Place Bid'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBidButton}
            onPress={() => handleQuickBid(2)}
          >
            <Text style={styles.quickBidText}>+2</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bid Modal */}
      <Modal
        visible={bidModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBidModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Place Your Bid</Text>
              <TouchableOpacity onPress={() => setBidModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInfo}>
              Current bid: ₣{auction.current_bid.toFixed(2)}
            </Text>
            <Text style={styles.modalInfo}>
              Minimum bid: ₣{(auction.current_bid + auction.bid_increment).toFixed(2)}
            </Text>

            <TextInput
              style={styles.bidInput}
              value={bidAmount}
              onChangeText={setBidAmount}
              placeholder="Enter bid amount"
              placeholderTextColor="#888"
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setBidModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, placingBid && styles.disabledButton]}
                onPress={handlePlaceBid}
                disabled={placingBid}
              >
                {placingBid ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>Bid ₣{bidAmount}</Text>
                )}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  video: {
    width: screenWidth,
    height: screenHeight,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  viewerText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  auctionInfoCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  auctionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  currentBid: {
    color: '#8E44AD',
    fontSize: 24,
    fontWeight: 'bold',
  },
  timeLeft: {
    color: '#F39C12',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bidCount: {
    color: '#3498DB',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 32,
  },
  quickBidButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(142, 68, 173, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBidText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bidButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#8E44AD',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  bidButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: screenWidth - 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalInfo: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  bidInput: {
    backgroundColor: '#2a2a2a',
    color: 'white',
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#8E44AD',
    padding: 16,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default AuctionLiveViewerScreen;

