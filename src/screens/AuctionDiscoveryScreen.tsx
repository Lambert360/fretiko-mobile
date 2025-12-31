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
import { auctionsAPI, AuctionCategoryWithStats, AuctionWithDetails } from '../services/auctionsAPI';
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
      
      // Filter live lots that are actually streaming (have stream_url and haven't ended)
      const liveAuctionsData = ((results[2] as any).auctions || []).filter(
        (auction: AuctionWithDetails) => 
          auction.status === 'active' && 
          auction.auction_type === 'live' &&
          auction.stream_url &&
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
  }, []);

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
    navigation.navigate('AuctionDetails', { auctionId: auction.id });
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
                  <Text style={styles.headerOptionText}>My Auctions</Text>
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

        {/* My Auctions - Only for sellers */}
        {profile?.isSeller && myAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Auctions</Text>
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

        {/* Live Lots - Streaming Now */}
        {liveAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Live Lots</Text>
                <Text style={styles.urgentText}>🔴 Watch & bid in real-time!</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AuctionList', { status: 'active', auction_type: 'live' })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={liveAuctions}
              renderItem={renderAuctionCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auctionsList}
            />
          </View>
        )}

        {/* Active Lots - Timed Auctions */}
        {activeAuctions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Active Lots</Text>
                <Text style={styles.urgentText}>⏱️ Bid now!</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AuctionList', { status: 'active', auction_type: 'timed' })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeAuctions}
              renderItem={renderAuctionCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.auctionsList}
            />
          </View>
        )}

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Create Lot Button - Only visible to sellers */}
      {profile?.isSeller && (
        <TouchableOpacity
          style={styles.createLotButton}
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