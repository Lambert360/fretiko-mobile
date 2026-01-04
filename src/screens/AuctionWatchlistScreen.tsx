import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { auctionsAPI, auctionSocket, AuctionWithDetails } from '../services/auctionsAPI';

/**
 * Auction Watchlist Screen
 *
 * Displays all auctions the user has added to their watchlist
 * Users can view watched auctions and remove them from the watchlist
 */
const AuctionWatchlistScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Organized by sections
  const [activeAuctions, setActiveAuctions] = useState<AuctionWithDetails[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionWithDetails[]>([]);
  const [endedAuctions, setEndedAuctions] = useState<AuctionWithDetails[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  
  // Refs for countdown timers
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Organize watchlist into sections
  const organizeWatchlist = (auctions: AuctionWithDetails[]) => {
    const active: AuctionWithDetails[] = [];
    const upcoming: AuctionWithDetails[] = [];
    const ended: AuctionWithDetails[] = [];

    auctions.forEach(auction => {
      if (auction.time_status === 'active') {
        active.push(auction);
      } else if (auction.time_status === 'upcoming') {
        upcoming.push(auction);
      } else {
        ended.push(auction);
      }
    });

    // Sort active by time remaining (ending soon first)
    active.sort((a, b) => (a.seconds_remaining || 0) - (b.seconds_remaining || 0));
    // Sort upcoming by start time (starting soon first)
    upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    // Sort ended by end time (most recent first)
    ended.sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());

    setActiveAuctions(active);
    setUpcomingAuctions(upcoming);
    setEndedAuctions(ended);
  };

  // Load watchlist
  const loadWatchlist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const data = await auctionsAPI.getUserWatchlist(50);
      organizeWatchlist(data);
    } catch (error: any) {
      console.error('Error loading watchlist:', error);
      if (error.message !== 'Authentication required') {
        Alert.alert('Error', 'Failed to load watchlist. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update countdown timers for active and upcoming auctions
  useEffect(() => {
    const updateTimers = () => {
      const now = Date.now();
      
      setActiveAuctions(prev => prev.map(auction => {
        if (auction.time_status === 'active' && auction.end_time) {
          const endTime = new Date(auction.end_time).getTime();
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
          
          if (remaining === 0) {
            // Auction ended, move to ended section
            setTimeout(() => {
              setActiveAuctions(prevActive => prevActive.filter(a => a.id !== auction.id));
              setEndedAuctions(prevEnded => [...prevEnded, { ...auction, time_status: 'ended', seconds_remaining: 0 }]);
            }, 0);
            return { ...auction, seconds_remaining: 0 };
          }
          
          return { ...auction, seconds_remaining: remaining };
        }
        return auction;
      }));

      setUpcomingAuctions(prev => prev.map(auction => {
        if (auction.time_status === 'upcoming' && auction.start_time) {
          const startTime = new Date(auction.start_time).getTime();
          const remaining = Math.max(0, Math.floor((startTime - now) / 1000));
          
          if (remaining === 0 && auction.status === 'active') {
            // Auction started, move to active section
            setTimeout(() => {
              setUpcomingAuctions(prevUpcoming => prevUpcoming.filter(a => a.id !== auction.id));
              setActiveAuctions(prevActive => [{ ...auction, time_status: 'active', seconds_remaining: 0 }, ...prevActive]);
            }, 0);
            return { ...auction, seconds_remaining: 0 };
          }
          
          return { ...auction, seconds_remaining: remaining };
        }
        return auction;
      }));
    };

    // Update every second
    timeUpdateInterval.current = setInterval(updateTimers, 1000);
    updateTimers(); // Initial update

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [activeAuctions.length, upcomingAuctions.length]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!user) return;

    // Connect to WebSocket
    auctionSocket.connect();

    // Handler for auction status changes
    const handleAuctionStatusChanged = async (data: { auction_id: string; status: string }) => {
      const auctionId = data.auction_id;
      
      // Fetch updated auction data
      try {
        const updatedAuction = await auctionsAPI.getAuction(auctionId);
        
        // Check if auction is in watchlist by checking all sections
        setActiveAuctions(prev => {
          const found = prev.find(a => a.id === auctionId);
          if (found) {
            if (data.status === 'active') {
              return prev.map(a => a.id === auctionId ? updatedAuction : a);
            } else {
              // Move to ended
              setEndedAuctions(prevEnded => {
                if (!prevEnded.find(a => a.id === auctionId)) {
                  return [updatedAuction, ...prevEnded];
                }
                return prevEnded;
              });
              return prev.filter(a => a.id !== auctionId);
            }
          }
          return prev;
        });

        setUpcomingAuctions(prev => {
          const found = prev.find(a => a.id === auctionId);
          if (found) {
            if (data.status === 'active') {
              // Move to active
              setActiveAuctions(prevActive => {
                if (!prevActive.find(a => a.id === auctionId)) {
                  return [updatedAuction, ...prevActive];
                }
                return prevActive;
              });
              return prev.filter(a => a.id !== auctionId);
            } else if (data.status === 'ended' || data.status === 'sold') {
              // Move to ended
              setEndedAuctions(prevEnded => {
                if (!prevEnded.find(a => a.id === auctionId)) {
                  return [updatedAuction, ...prevEnded];
                }
                return prevEnded;
              });
              return prev.filter(a => a.id !== auctionId);
            }
          }
          return prev;
        });

        setEndedAuctions(prev => {
          const found = prev.find(a => a.id === auctionId);
          if (found && data.status === 'active') {
            // Move back to active (unlikely but possible)
            setActiveAuctions(prevActive => {
              if (!prevActive.find(a => a.id === auctionId)) {
                return [updatedAuction, ...prevActive];
              }
              return prevActive;
            });
            return prev.filter(a => a.id !== auctionId);
          }
          return found ? prev.map(a => a.id === auctionId ? updatedAuction : a) : prev;
        });
      } catch (error) {
        console.error('Error fetching updated auction data:', error);
      }
    };

    // Handler for bid updates
    const handleNewBid = (data: any) => {
      const auctionId = data.auction_id;
      
      // Update auction in whichever section it's in
      const updateAuction = (auction: AuctionWithDetails) => {
        if (auction.id === auctionId) {
          return {
            ...auction,
            current_bid: data.current_bid || data.amount || auction.current_bid,
            total_bids: data.total_bids !== undefined ? data.total_bids : auction.total_bids,
            unique_bidders: data.unique_bidders !== undefined ? data.unique_bidders : auction.unique_bidders,
          };
        }
        return auction;
      };

      setActiveAuctions(prev => prev.map(updateAuction));
      setUpcomingAuctions(prev => prev.map(updateAuction));
      setEndedAuctions(prev => prev.map(updateAuction));
    };

    // Listen for events
    auctionSocket.on('global_auction_status_changed', handleAuctionStatusChanged);
    auctionSocket.on('new_bid', handleNewBid);

    return () => {
      auctionSocket.off('global_auction_status_changed', handleAuctionStatusChanged);
      auctionSocket.off('new_bid', handleNewBid);
    };
  }, [user]);

  // Refresh watchlist when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadWatchlist();
      }
    }, [user])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadWatchlist();
  };

  const handleRemoveFromWatchlist = async (auctionId: string) => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to manage your watchlist');
      return;
    }

    setRemovingId(auctionId);
    try {
      await auctionsAPI.toggleWatchlist(auctionId);
      // Remove from all sections
      setActiveAuctions(prev => prev.filter(a => a.id !== auctionId));
      setUpcomingAuctions(prev => prev.filter(a => a.id !== auctionId));
      setEndedAuctions(prev => prev.filter(a => a.id !== auctionId));
    } catch (error: any) {
      console.error('Error removing from watchlist:', error);
      Alert.alert('Error', 'Failed to remove from watchlist. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  const navigateToAuction = (auction: AuctionWithDetails) => {
    navigation.navigate('AuctionDetails', { auctionId: auction.id });
  };

  const renderAuctionItem = ({ item }: { item: AuctionWithDetails }) => (
    <TouchableOpacity
      style={styles.auctionCard}
      onPress={() => navigateToAuction(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.thumbnail_url || item.images[0] || 'https://via.placeholder.com/150' }}
        style={styles.auctionImage}
        resizeMode="cover"
      />

      <View style={styles.auctionInfo}>
        <View style={styles.auctionHeader}>
          <Text style={styles.auctionTitle} numberOfLines={2}>{item.title}</Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFromWatchlist(item.id)}
            disabled={removingId === item.id}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {removingId === item.id ? (
              <ActivityIndicator size="small" color="#FF4757" />
            ) : (
              <Ionicons name="close-circle" size={24} color="#FF4757" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.currentBid}>₣{auctionsAPI.formatPrice(item.current_bid)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: auctionsAPI.getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {item.status === 'active' && item.time_status === 'active' ? 'LIVE' : item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.auctionFooter}>
          <Text style={styles.timeRemaining}>
            {item.time_status === 'upcoming'
              ? `Starts ${item.seconds_remaining ? auctionsAPI.formatTimeRemaining(item.seconds_remaining) : 'soon'}`
              : item.time_status === 'active'
                ? (item.seconds_remaining ? auctionsAPI.formatTimeRemaining(item.seconds_remaining) : 'Ending soon')
                : 'Ended'
            }
          </Text>
          <Text style={styles.bidCount}>{item.total_bids} bids</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Watchlist</Text>

          <View style={styles.backButton} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={64} color="#666" />
          <Text style={styles.emptyText}>Login Required</Text>
          <Text style={styles.emptySubtext}>Please log in to view your watchlist</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Watchlist</Text>

          <View style={styles.backButton} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E44AD" />
          <Text style={styles.loadingText}>Loading watchlist...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Watchlist</Text>

        <View style={styles.backButton} />
      </View>

      {/* Watchlist Count */}
      {activeAuctions.length + upcomingAuctions.length + endedAuctions.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {activeAuctions.length + upcomingAuctions.length + endedAuctions.length} {activeAuctions.length + upcomingAuctions.length + endedAuctions.length === 1 ? 'auction' : 'auctions'} watched
          </Text>
        </View>
      )}

      {/* Watchlist Sections */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#8E44AD" />
        }
      >
        {/* Active Auctions Section */}
        {activeAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Active</Text>
                <Text style={styles.sectionSubtitle}>⏰ {activeAuctions.length} {activeAuctions.length === 1 ? 'auction' : 'auctions'} accepting bids</Text>
              </View>
            </View>
            {activeAuctions.map((item) => (
              <View key={item.id}>
                {renderAuctionItem({ item })}
              </View>
            ))}
          </View>
        )}

        {/* Upcoming Auctions Section */}
        {upcomingAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Upcoming</Text>
                <Text style={styles.sectionSubtitle}>📅 {upcomingAuctions.length} {upcomingAuctions.length === 1 ? 'auction' : 'auctions'} starting soon</Text>
              </View>
            </View>
            {upcomingAuctions.map((item) => (
              <View key={item.id}>
                {renderAuctionItem({ item })}
              </View>
            ))}
          </View>
        )}

        {/* Ended Auctions Section */}
        {endedAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ended</Text>
                <Text style={styles.sectionSubtitle}>✅ {endedAuctions.length} {endedAuctions.length === 1 ? 'auction' : 'auctions'} completed</Text>
              </View>
            </View>
            {endedAuctions.map((item) => (
              <View key={item.id}>
                {renderAuctionItem({ item })}
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {activeAuctions.length === 0 && upcomingAuctions.length === 0 && endedAuctions.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>Your watchlist is empty</Text>
            <Text style={styles.emptySubtext}>
              Start adding auctions to your watchlist to keep track of items you're interested in
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => navigation.navigate('AuctionDiscovery')}
            >
              <Text style={styles.browseButtonText}>Browse Auctions</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  countText: {
    color: '#888',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
  },
  auctionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  auctionImage: {
    width: 120,
    height: 120,
  },
  auctionInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  auctionTitle: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentBid: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  auctionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRemaining: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '600',
  },
  bidCount: {
    color: '#888',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#8E44AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#8E44AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AuctionWatchlistScreen;

