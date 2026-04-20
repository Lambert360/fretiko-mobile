import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { auctionsAPI, auctionSocket, AuctionCategoryWithStats, AuctionWithDetails } from '../services/auctionsAPI';
import { userAPI, UserProfile } from '../services/userAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Auction Discovery Screen
 *
 * Main entry point for the auction platform featuring:
 * - 6 auction categories with elegant cards
 * - Active lots section
 * - Ending soon section
 * - Navigation to category pages and individual auctions
 */
const AuctionDiscoveryScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // State
  const [categories, setCategories] = useState<AuctionCategoryWithStats[]>([]);
  const [liveAuctions, setLiveAuctions] = useState<AuctionWithDetails[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<AuctionWithDetails[]>([]);
  const [endingSoonAuctions, setEndingSoonAuctions] = useState<AuctionWithDetails[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<AuctionWithDetails[]>([]);
  const [myAuctions, setMyAuctions] = useState<AuctionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Load auction data
  const loadAuctionData = async () => {
    try {
      // Load profile first
      const profileData = await userAPI.getProfile();
      setProfile(profileData);

      // Load auction data in parallel
      const promises = [
        auctionsAPI.getCategories(true) as Promise<AuctionCategoryWithStats[]>,
        auctionsAPI.getAuctionsEndingSoon(),
        auctionsAPI.getAuctions({ status: 'active', auction_type: 'live', limit: 20, sort: 'bids_desc' }), // Live lots
        auctionsAPI.getAuctions({ status: 'active', auction_type: 'timed', limit: 20, sort: 'bids_desc' }), // Active timed lots
        auctionsAPI.getAuctions({ status: 'scheduled', limit: 20, sort: 'time_asc' }), // Upcoming auctions
      ];

      const results = await Promise.all(promises);

      setCategories(results[0] as AuctionCategoryWithStats[]);
      setEndingSoonAuctions((results[1] as any).auctions);
      
      const now = new Date();
      
      // Filter live lots that are active (status=active, type=live, and haven't ended)
      // Don't require stream_url - show them when they become active
      const liveAuctionsData = ((results[2] as any).auctions || []).filter(
        (auction: AuctionWithDetails) => 
          auction.status === 'active' && 
          auction.auction_type === 'live' &&
          new Date(auction.end_time) > now
      );
      setLiveAuctions(liveAuctionsData);
      
      // Filter active timed lots that haven't ended yet (client-side safeguard)
      const activeAuctionsData = ((results[3] as any).auctions || []).filter(
        (auction: AuctionWithDetails) => 
          auction.status === 'active' && 
          auction.auction_type === 'timed' &&
          new Date(auction.end_time) > now
      );
      setActiveAuctions(activeAuctionsData);
      
      // Filter to ONLY show truly upcoming auctions (start_time in future AND status=scheduled)
      // This is a client-side safeguard against stale data or status update delays
      const upcomingAuctionsData = ((results[4] as any).auctions || []).filter(
        (auction: AuctionWithDetails) => 
          auction.status === 'scheduled' && new Date(auction.start_time) > now
      );
      setUpcomingAuctions(upcomingAuctionsData);

      // Fetch my auctions if seller (active + scheduled only, excluding ended)
      if (profileData.isSeller && user?.id) {
        try {
          const [activeAuctions, scheduledAuctions] = await Promise.all([
            auctionsAPI.getAuctions({ seller_id: user.id, status: 'active', limit: 10 }),
            auctionsAPI.getAuctions({ seller_id: user.id, status: 'scheduled', limit: 10 })
          ]);
          
          const currentTime = new Date();
          
          // Filter and combine: active auctions that haven't ended, scheduled auctions that haven't started
          const filtered = [
            ...((activeAuctions as any).auctions || []).filter(
              (a: AuctionWithDetails) => new Date(a.end_time) > currentTime
            ),
            ...((scheduledAuctions as any).auctions || []).filter(
              (a: AuctionWithDetails) => new Date(a.start_time) > currentTime
            )
          ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
           .slice(0, 10);  // Take first 10
          
          setMyAuctions(filtered);
        } catch (error) {
          console.error('Error loading my auctions:', error);
          setMyAuctions([]);
        }
      }

    } catch (error) {
      console.error('Error loading auction data:', error);
      Alert.alert('Error', 'Failed to load auctions. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAuctionData();

    // Connect to WebSocket for real-time updates
    auctionSocket.connect();
  }, []);

  // Listen for real-time auction status changes
  useEffect(() => {
    // NO user check here - WebSocket should work for everyone
    // User check is done inside handlers only when updating myAuctions

    // Handler for auction status changes (scheduled -> active, or ended)
    const handleAuctionStatusChanged = async (data: { 
      auction_id: string; 
      status: string;
      seller_id?: string;
      auction_type?: string;
    }) => {
      console.log('📡 Auction status changed event:', data);
      
      // Handle new scheduled auction creation
      if (data.status === 'scheduled') {
        console.log('📅 New scheduled auction created:', data.auction_id);
        // Fetch the new auction if it belongs to the current user
        if (user?.id && data.seller_id === user.id) {
          try {
            const newAuction = await auctionsAPI.getAuction(data.auction_id);
            const now = new Date();
            
            // Only add if start_time is in the future (truly upcoming)
            if (new Date(newAuction.start_time) > now) {
              console.log('✅ Adding new auction to myAuctions and upcomingAuctions');
              setMyAuctions(prev => {
                // Check if not already in list
                if (!prev.find(a => a.id === data.auction_id)) {
                  return [...prev, newAuction].sort((a, b) => 
                    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                  ).slice(0, 10);
                }
                return prev;
              });
              
              // Also add to upcomingAuctions if it's truly upcoming
              setUpcomingAuctions(prev => {
                if (!prev.find(a => a.id === data.auction_id)) {
                  return [...prev, newAuction].sort((a, b) => 
                    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                  );
                }
                return prev;
              });
            }
          } catch (error) {
            console.error('Error fetching new auction:', error);
          }
        }
        return; // Don't process scheduled status further
      }
      
      // When an auction becomes active, move it from upcoming to active/live
      if (data.status === 'active') {
        // Remove from upcoming
        setUpcomingAuctions(prev => prev.filter(a => a.id !== data.auction_id));
        
        // Fetch updated auction data
        try {
          const updatedAuction = await auctionsAPI.getAuction(data.auction_id);
          
          // Add to appropriate active list based on auction type
          if (updatedAuction.auction_type === 'live') {
            setLiveAuctions(prev => {
              // Check if not already in list
              if (!prev.find(a => a.id === updatedAuction.id)) {
                return [updatedAuction, ...prev];
              }
              return prev;
            });
          } else {
            setActiveAuctions(prev => {
              // Check if not already in list
              if (!prev.find(a => a.id === updatedAuction.id)) {
                return [updatedAuction, ...prev];
              }
              return prev;
            });
          }

          // Check if this auction should be in "ending soon" (within 24 hours)
          const now = new Date();
          const endTime = new Date(updatedAuction.end_time);
          const hoursUntilEnd = (endTime.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          if (hoursUntilEnd > 0 && hoursUntilEnd <= 24) {
            setEndingSoonAuctions(prev => {
              if (!prev.find(a => a.id === updatedAuction.id)) {
                return [...prev, updatedAuction].sort((a, b) => 
                  new Date(a.end_time).getTime() - new Date(b.end_time).getTime()
                );
              }
              return prev;
            });
          }

          // Update myAuctions if this auction belongs to the current user (only check here)
          if (user?.id && (data.seller_id === user.id || updatedAuction.seller_id === user.id)) {
            console.log('🔄 Updating myAuctions for auction:', data.auction_id, 'Status: active');
            setMyAuctions(prev => {
              // Check if auction exists in myAuctions
              const existingIndex = prev.findIndex(a => a.id === data.auction_id);
              if (existingIndex >= 0) {
                // Update the auction with new status
                const updated = [...prev];
                updated[existingIndex] = updatedAuction;
                return updated;
              }
              // If not in list but belongs to user, add it
              return [...prev, updatedAuction].sort((a, b) => 
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
              ).slice(0, 10); // Keep max 10 items
            });
          }
        } catch (error) {
          console.error('Error fetching updated auction data:', error);
        }
      } else if (data.status === 'ended' || data.status === 'sold' || data.status === 'cancelled') {
        console.log('🔄 Removing auction from myAuctions (ended/sold/cancelled):', data.auction_id);
        // Remove from myAuctions if auction ended/was sold/was cancelled (only if user exists)
        if (user?.id) {
          if (data.seller_id === user.id) {
            setMyAuctions(prev => prev.filter(a => a.id !== data.auction_id));
          } else {
            // Fallback: check if it exists in myAuctions (for cases where seller_id might not be in event)
            setMyAuctions(prev => {
              const existsInMyAuctions = prev.find(a => a.id === data.auction_id);
              if (existsInMyAuctions && existsInMyAuctions.seller_id === user.id) {
                return prev.filter(a => a.id !== data.auction_id);
              }
              return prev;
            });
          }
        }
        
        // Remove from all public lists (no user check needed)
        setUpcomingAuctions(prev => prev.filter(a => a.id !== data.auction_id));
        setActiveAuctions(prev => prev.filter(a => a.id !== data.auction_id));
        setLiveAuctions(prev => prev.filter(a => a.id !== data.auction_id));
        setEndingSoonAuctions(prev => prev.filter(a => a.id !== data.auction_id));
      }
    };

    // Handler for new bid events - update auction stats in all lists
    const handleNewBid = (bidData: {
      auction_id: string;
      current_bid: number;
      total_bids: number;
      unique_bidders: number;
      view_count?: number;
      watch_count?: number;
    }) => {
      // Helper function to update auction in a list
      const updateAuctionInList = (list: AuctionWithDetails[], auctionId: string, updates: Partial<AuctionWithDetails>) => {
        return list.map(auction => 
          auction.id === auctionId 
            ? { ...auction, ...updates }
            : auction
        );
      };

      // Update in all public lists (no user check needed)
      setActiveAuctions(prev => updateAuctionInList(prev, bidData.auction_id, {
        current_bid: bidData.current_bid,
        total_bids: bidData.total_bids,
        unique_bidders: bidData.unique_bidders,
        ...(bidData.view_count !== undefined && { view_count: bidData.view_count }),
        ...(bidData.watch_count !== undefined && { watch_count: bidData.watch_count }),
      }));

      setLiveAuctions(prev => updateAuctionInList(prev, bidData.auction_id, {
        current_bid: bidData.current_bid,
        total_bids: bidData.total_bids,
        unique_bidders: bidData.unique_bidders,
        ...(bidData.view_count !== undefined && { view_count: bidData.view_count }),
        ...(bidData.watch_count !== undefined && { watch_count: bidData.watch_count }),
      }));

      setEndingSoonAuctions(prev => updateAuctionInList(prev, bidData.auction_id, {
        current_bid: bidData.current_bid,
        total_bids: bidData.total_bids,
        unique_bidders: bidData.unique_bidders,
        ...(bidData.view_count !== undefined && { view_count: bidData.view_count }),
        ...(bidData.watch_count !== undefined && { watch_count: bidData.watch_count }),
      }));

      // Only update myAuctions if user exists
      if (user?.id) {
        setMyAuctions(prev => updateAuctionInList(prev, bidData.auction_id, {
          current_bid: bidData.current_bid,
          total_bids: bidData.total_bids,
          unique_bidders: bidData.unique_bidders,
          ...(bidData.view_count !== undefined && { view_count: bidData.view_count }),
          ...(bidData.watch_count !== undefined && { watch_count: bidData.watch_count }),
        }));
      }
    };

    // Listen for auction status changes (now broadcast globally from backend)
    auctionSocket.on('auction_status_changed', handleAuctionStatusChanged);
    
    // Listen for new bid events
    auctionSocket.on('new_bid', handleNewBid);

    return () => {
      // Cleanup: remove listeners
      auctionSocket.off('auction_status_changed', handleAuctionStatusChanged);
      auctionSocket.off('new_bid', handleNewBid);
    };
  }, [user?.id]); // Keep user?.id in dependencies so handlers can access latest value

  const handleRefresh = () => {
    setRefreshing(true);
    loadAuctionData();
  };

  const navigateToCategory = (category: AuctionCategoryWithStats) => {
    navigation.navigate('AuctionCategory', {
      categorySlug: category.slug,
      categoryName: category.name,
      categoryColor: category.color,
    });
  };

  const navigateToAuction = (auction: AuctionWithDetails) => {
    // Route live auctions to LiveAuctionDetailsScreen, others to regular AuctionDetailsScreen
    if (auction.auction_type === 'live') {
      navigation.navigate('LiveAuctionDetails', { auctionId: auction.id });
    } else {
      navigation.navigate('AuctionDetails', { auctionId: auction.id });
    }
  };

  const navigateToCreateAuction = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to create auctions');
      return;
    }
    setShowOptionsMenu(false);
    navigation.navigate('CreateAuction');
  };

  const handleOptionPress = (option: string) => {
    setShowOptionsMenu(false);
    
    switch (option) {
      case 'create':
        navigateToCreateAuction();
        break;
      case 'myAuctions':
        navigation.navigate('AuctionList', { seller_id: user?.id });
        break;
      case 'liveLots':
        navigation.navigate('AuctionList', { status: 'active', auction_type: 'live' });
        break;
      case 'activeAuctions':
        navigation.navigate('AuctionList', { status: 'active', auction_type: 'timed' });
        break;
      case 'endingSoon':
        navigation.navigate('AuctionList', { endingSoon: true });
        break;
      case 'watchlist':
        navigation.navigate('AuctionWatchlist');
        break;
      case 'myBids':
        navigation.navigate('AuctionList', { participated: true });
        break;
    }
  };

  const renderCategoryCard = ({ item }: { item: AuctionCategoryWithStats }) => {
    // Remove 'For' prefix from category names
    const displayName = item.name.replace(/^For\s+/i, '');

    return (
      <TouchableOpacity
        style={[styles.categoryCard, { borderTopColor: item.color }]}
        onPress={() => navigateToCategory(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.categoryIconContainer, { backgroundColor: `${item.color}15` }]}>
          <Ionicons name={item.icon_name as any} size={28} color={item.color} />
        </View>
        <Text style={styles.categoryName} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.categoryCount}>{item.active_auction_count}</Text>
      </TouchableOpacity>
    );
  };


  // Render regular auction card for grid layout
  const renderAuctionCardGrid = (item: AuctionWithDetails) => (
    <TouchableOpacity
      style={styles.auctionCardGrid}
      onPress={() => navigateToAuction(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.thumbnail_url || item.images[0] || 'https://via.placeholder.com/200x150' }}
        style={styles.auctionImage}
        resizeMode="cover"
      />

      <View style={styles.auctionOverlay}>
        <View style={styles.auctionHeader}>
          {/* Live Streaming Badge for Live Auctions when active */}
          {item.auction_type === 'live' && item.time_status === 'active' && (
            <View style={styles.liveStreamBadge}>
              <View style={styles.livePulseDot} />
              <Ionicons name="videocam" size={12} color="white" />
              <Text style={styles.liveStreamText}>LIVE</Text>
            </View>
          )}
          
          <View style={[styles.statusBadge, { backgroundColor: auctionsAPI.getStatusColor(item.time_status) }]}>
            <Text style={styles.statusText}>
              {item.time_status === 'active' ? 'LIVE' : item.time_status.toUpperCase()}
            </Text>
          </View>

          {item.is_watched_by_user && (
            <View style={styles.watchedBadge}>
              <Ionicons name="heart" size={12} color="#E74C3C" />
            </View>
          )}
        </View>

        <View style={styles.auctionDetails}>
          <Text style={styles.auctionTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.currentBid}>
            Current: {auctionsAPI.formatPrice(item.current_bid)}
          </Text>

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
      </View>
    </TouchableOpacity>
  );

  // Keep original renderAuctionCard for horizontal scrolling sections
  const renderAuctionCard = ({ item }: { item: AuctionWithDetails }) => (
    <TouchableOpacity
      style={styles.auctionCard}
      onPress={() => navigateToAuction(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.thumbnail_url || item.images[0] || 'https://via.placeholder.com/200x150' }}
        style={styles.auctionImage}
        resizeMode="cover"
      />

      <View style={styles.auctionOverlay}>
        <View style={styles.auctionHeader}>
          {/* Live Streaming Badge for Live Auctions */}
          {item.auction_type === 'live' && item.time_status === 'active' && item.stream_url && (
            <View style={styles.liveStreamBadge}>
              <View style={styles.livePulseDot} />
              <Ionicons name="videocam" size={12} color="white" />
              <Text style={styles.liveStreamText}>STREAMING</Text>
            </View>
          )}
          
          <View style={[styles.statusBadge, { backgroundColor: auctionsAPI.getStatusColor(item.time_status) }]}>
            <Text style={styles.statusText}>
              {item.time_status === 'active' ? 'LIVE' : item.time_status.toUpperCase()}
            </Text>
          </View>

          {item.is_watched_by_user && (
            <View style={styles.watchedBadge}>
              <Ionicons name="heart" size={12} color="#E74C3C" />
            </View>
          )}
        </View>

        <View style={styles.auctionDetails}>
          <Text style={styles.auctionTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.currentBid}>
            Current: {auctionsAPI.formatPrice(item.current_bid)}
          </Text>

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
      </View>
    </TouchableOpacity>
  );

  // Build alternating rows between active and live auctions
  const buildAlternatingAuctionRows = () => {
    const ITEMS_PER_SECTION = 10; // 10 cards = 5 rows (2 columns each)
    
    type AuctionRow = 
      | { type: 'grid'; items: AuctionWithDetails[] }
      | { type: 'video'; item: AuctionWithDetails }
      | { type: 'section-header'; title: string; subtitle: string };
    
    const rows: AuctionRow[] = [];
    let activeIdx = 0;
    let liveIdx = 0;
    let currentSection: 'active' | 'live' = 'active'; // Start with active
    
    // Add initial section header for active lots
    if (activeAuctions.length > 0) {
      rows.push({ 
        type: 'section-header', 
        title: 'Active Lots', 
        subtitle: '⏱️ Bid now!' 
      });
    }
    
    while (activeIdx < activeAuctions.length || liveIdx < liveAuctions.length) {
      if (currentSection === 'active') {
        // Add active auctions in grid format (2 per row)
        const itemsToAdd = Math.min(ITEMS_PER_SECTION, activeAuctions.length - activeIdx);
        
        if (itemsToAdd > 0) {
          const sectionItems = activeAuctions.slice(activeIdx, activeIdx + itemsToAdd);
          
          // Group items into rows of 2
          for (let i = 0; i < sectionItems.length; i += 2) {
            const rowItems = sectionItems.slice(i, i + 2);
            rows.push({ type: 'grid', items: rowItems });
          }
          
          activeIdx += itemsToAdd;
        }
        
        // Switch to live auctions if available
        if (liveIdx < liveAuctions.length) {
          currentSection = 'live';
          rows.push({ 
            type: 'section-header', 
            title: 'Live Lots', 
            subtitle: '🔴 Watch & bid in real-time!' 
          });
        } else if (activeIdx < activeAuctions.length) {
          // More active auctions available, continue with active
          rows.push({ 
            type: 'section-header', 
            title: 'Active Lots', 
            subtitle: '⏱️ Bid now!' 
          });
        } else {
          break;
        }
      } else {
        // Add live auctions as full-width video cards
        const itemsToAdd = Math.min(ITEMS_PER_SECTION, liveAuctions.length - liveIdx);
        
        if (itemsToAdd > 0) {
          const sectionItems = liveAuctions.slice(liveIdx, liveIdx + itemsToAdd);
          
          // Add each live auction as a full-width video card
          sectionItems.forEach(item => {
            rows.push({ type: 'video', item });
          });
          
          liveIdx += itemsToAdd;
        }
        
        // Switch back to active auctions if available
        if (activeIdx < activeAuctions.length) {
          currentSection = 'active';
          rows.push({ 
            type: 'section-header', 
            title: 'Active Lots', 
            subtitle: '⏱️ Bid now!' 
          });
        } else if (liveIdx < liveAuctions.length) {
          // More live auctions available, continue with live
          rows.push({ 
            type: 'section-header', 
            title: 'Live Lots', 
            subtitle: '🔴 Watch & bid in real-time!' 
          });
        } else {
          break;
        }
      }
    }
    
    return rows;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8E44AD" />
        <Text style={styles.loadingText}>Loading auctions...</Text>
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

        <Text style={styles.headerTitle}>Auctions</Text>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowOptionsMenu(!showOptionsMenu)}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#8E44AD" />
        </TouchableOpacity>
      </View>

      {/* Header Options Menu Dropdown */}
      {showOptionsMenu && (
        <>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setShowOptionsMenu(false)}
          />
          <View style={styles.headerOptionsMenu}>
            {/* Vendor-only options */}
            {profile?.isSeller && (
              <>
                <TouchableOpacity
                  style={styles.headerOptionItem}
                  onPress={() => handleOptionPress('create')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="hammer" size={20} color="#8E44AD" />
                  <Text style={styles.headerOptionText}>Create Auction</Text>
                </TouchableOpacity>

                <View style={styles.headerOptionDivider} />

                <TouchableOpacity
                  style={styles.headerOptionItem}
                  onPress={() => handleOptionPress('myAuctions')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="list" size={20} color="#27AE60" />
                  <Text style={styles.headerOptionText}>My Lots</Text>
                </TouchableOpacity>

                <View style={styles.headerOptionDivider} />
              </>
            )}

            {/* Options for everyone */}
            <TouchableOpacity
              style={styles.headerOptionItem}
              onPress={() => handleOptionPress('liveLots')}
              activeOpacity={0.7}
            >
              <Ionicons name="videocam" size={20} color="#E74C3C" />
              <Text style={styles.headerOptionText}>Live Lots</Text>
            </TouchableOpacity>

            <View style={styles.headerOptionDivider} />

            <TouchableOpacity
              style={styles.headerOptionItem}
              onPress={() => handleOptionPress('activeAuctions')}
              activeOpacity={0.7}
            >
              <Ionicons name="pulse" size={20} color="#3498DB" />
              <Text style={styles.headerOptionText}>Active Lots</Text>
            </TouchableOpacity>

            <View style={styles.headerOptionDivider} />

            <TouchableOpacity
              style={styles.headerOptionItem}
              onPress={() => handleOptionPress('endingSoon')}
              activeOpacity={0.7}
            >
              <Ionicons name="alarm" size={20} color="#F39C12" />
              <Text style={styles.headerOptionText}>Ending Soon</Text>
            </TouchableOpacity>

            <View style={styles.headerOptionDivider} />

            <TouchableOpacity
              style={styles.headerOptionItem}
              onPress={() => handleOptionPress('watchlist')}
              activeOpacity={0.7}
            >
              <Ionicons name="star" size={20} color="#E91E63" />
              <Text style={styles.headerOptionText}>Watchlist</Text>
            </TouchableOpacity>

            <View style={styles.headerOptionDivider} />

            <TouchableOpacity
              style={styles.headerOptionItem}
              onPress={() => handleOptionPress('myBids')}
              activeOpacity={0.7}
            >
              <Ionicons name="pricetag" size={20} color="#9B59B6" />
              <Text style={styles.headerOptionText}>My Bids</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Discover Unique Auctions</Text>
            <Text style={styles.heroSubtitle}>
              Bid on exclusive items from verified sellers
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="hammer" size={48} color="#8E44AD" />
          </View>
        </View>

        {/* My Lots - Only for sellers */}
        {profile?.isSeller && myAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Lots</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AuctionList', { seller_id: user?.id })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={myAuctions}
              renderItem={renderAuctionCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auctionsList}
            />
          </View>
        )}

        {/* Categories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Categories</Text>
          <Text style={styles.sectionSubtitle}>Find your next treasure</Text>

          <View style={styles.categoriesGrid}>
            {categories.map((item) => (
              <View key={item.id} style={styles.categoryWrapper}>
                {renderCategoryCard({ item })}
              </View>
            ))}
          </View>
        </View>

        {/* Upcoming Auctions - Anticipate */}
        {upcomingAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Coming Soon</Text>
                <Text style={styles.anticipateText}>✨ Mark your calendars!</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AuctionList', { status: 'scheduled' })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={upcomingAuctions}
              renderItem={renderAuctionCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auctionsList}
            />
          </View>
        )}

        {/* Ending Soon */}
        {endingSoonAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ending Soon</Text>
                <Text style={styles.urgentText}>⏰ Don't miss these opportunities!</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AuctionList', { endingSoon: true })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={endingSoonAuctions}
              renderItem={renderAuctionCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auctionsList}
            />
          </View>
        )}

        {/* Active & Live Lots - Alternating Vertical Layout */}
        {(activeAuctions.length > 0 || liveAuctions.length > 0) && (
          <View style={styles.section}>
            {buildAlternatingAuctionRows().map((row, rowIndex) => {
              if (row.type === 'section-header') {
                return (
                  <View key={`header-${rowIndex}`} style={styles.sectionHeader}>
                    <View>
                      <Text style={styles.sectionTitle}>{row.title}</Text>
                      <Text style={styles.urgentText}>{row.subtitle}</Text>
                    </View>
                  </View>
                );
              } else if (row.type === 'video') {
                // Full-width card for live auctions
                return (
                  <View key={`video-${rowIndex}-${row.item.id}`} style={styles.liveAuctionVideoCardContainer}>
                    {renderAuctionCardGrid(row.item)}
                  </View>
                );
              } else if (row.type === 'grid') {
                // 2-column grid for active auctions
                return (
                  <View key={`grid-${rowIndex}`} style={styles.auctionGridRow}>
                    {row.items.map((item) => (
                      <View key={item.id} style={styles.auctionGridItem}>
                        {renderAuctionCardGrid(item)}
                      </View>
                    ))}
                    {/* Fill empty space if only 1 item in row */}
                    {row.items.length === 1 && <View style={styles.auctionGridItem} />}
                  </View>
                );
              }
              return null;
            })}
            
            {/* See All buttons */}
            <View style={styles.sectionHeader}>
              {activeAuctions.length > 0 && (
                <TouchableOpacity 
                  onPress={() => navigation.navigate('AuctionList', { status: 'active', auction_type: 'timed' })}
                  style={styles.seeAllButton}
                >
                  <Text style={styles.seeAllText}>See All Active Lots</Text>
                </TouchableOpacity>
              )}
              {liveAuctions.length > 0 && (
                <TouchableOpacity 
                  onPress={() => navigation.navigate('AuctionList', { status: 'active', auction_type: 'live' })}
                  style={styles.seeAllButton}
                >
                  <Text style={styles.seeAllText}>See All Live Lots</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Create Lot Button - Only visible to sellers */}
      {profile?.isSeller && (
        <TouchableOpacity
          style={[styles.createLotButton, { bottom: 20 + insets.bottom }]}
          onPress={navigateToCreateAuction}
          activeOpacity={0.8}
        >
          <View style={styles.createLotGradient}>
            <Ionicons name="hammer" size={24} color="#FFF" />
            <Text style={styles.createLotText}>Create Lot</Text>
          </View>
        </TouchableOpacity>
      )}
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
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  headerOptionsMenu: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 999,
  },
  headerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerOptionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  headerOptionDivider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#888',
    fontSize: 16,
    lineHeight: 22,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8E44AD20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  urgentText: {
    color: '#F39C12',
    fontSize: 12,
    marginTop: 4,
  },
  seeAllText: {
    color: '#8E44AD',
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  categoryWrapper: {
    width: '33.33%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  categoryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 3,
    minHeight: 100,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryName: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryCount: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  anticipateText: {
    color: '#F39C12',
    fontSize: 12,
    marginTop: 4,
  },
  auctionsList: {
    paddingLeft: 20,
  },
  auctionCard: {
    width: 180,
    height: 220,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  auctionCardGrid: {
    width: '100%',
    height: 220,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  auctionGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  auctionGridItem: {
    width: '48%',
  },
  liveAuctionVideoCardContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  liveAuctionVideoCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  liveAuctionVideo: {
    width: '100%',
    height: screenWidth * (9/16), // 16:9 aspect ratio
    backgroundColor: '#000',
  },
  liveVideoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#E74C3C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveVideoPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  liveVideoBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  liveAuctionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
  },
  liveAuctionInfo: {
    flex: 1,
  },
  liveAuctionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  liveAuctionBidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveAuctionBid: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveAuctionBids: {
    color: '#888',
    fontSize: 14,
  },
  liveAuctionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveAuctionTime: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '600',
  },
  seeAllButton: {
    marginTop: 8,
  },
  auctionImage: {
    width: '100%',
    height: 120,
  },
  auctionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 8,
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
  watchedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStreamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 4,
  },
  liveStreamText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  auctionDetails: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
  },
  auctionTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  currentBid: {
    color: '#27AE60',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  auctionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRemaining: {
    color: '#F39C12',
    fontSize: 11,
    fontWeight: '600',
  },
  bidCount: {
    color: '#888',
    fontSize: 11,
  },
  bottomPadding: {
    height: 100, // Extra space for floating button
  },
  // Floating Create Lot Button
  createLotButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#8E44AD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  createLotGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8E44AD',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#9B59B6',
  },
  createLotText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default AuctionDiscoveryScreen;