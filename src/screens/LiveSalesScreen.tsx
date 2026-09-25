import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI, LiveStream } from '../services/liveSalesAPI';
import { userAPI } from '../services/userAPI';
import { liveStreamSocket, StreamStatusUpdate } from '../services/liveStreamSocket';
import AdaptiveText from '../components/AdaptiveText';
import { HeroMedia } from '../components/HeroMedia';

const { width: screenWidth } = Dimensions.get('window');

// Component for plugged vendors horizontal cards (Facebook-style)
const PluggedVendorCard = ({
  stream,
  onPress,
}: {
  stream: LiveStream;
  onPress: () => void;
}) => {
  const formatViewerCount = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <TouchableOpacity 
      style={styles.pluggedCard} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Live stream preview */}
      <View style={styles.pluggedVideoContainer}>
        <Image
          source={{
            uri: stream.thumbnail_url || stream.vendor.avatar_url || 'https://via.placeholder.com/100x140'
          }}
          style={styles.pluggedVideo}
          resizeMode="cover"
        />

        {/* Live indicator */}
        <View style={styles.pluggedLiveIndicator}>
          <View style={styles.pluggedLiveDot} />
          <Text style={styles.pluggedLiveText}>LIVE</Text>
        </View>

        {/* Viewer count */}
        <View style={styles.pluggedViewerCount}>
          <Text style={styles.pluggedViewerText}>{formatViewerCount(stream.viewer_count)}</Text>
        </View>
      </View>
      
      {/* Vendor info */}
      <View style={styles.pluggedVendorInfo}>
        <Image
          source={{ 
            uri: stream.vendor.avatar_url || 'https://via.placeholder.com/32x32' 
          }}
          style={styles.pluggedVendorAvatar}
        />
        <AdaptiveText style={styles.pluggedVendorName} baseFontSize={10} minFontSize={8} maxChars={12} numberOfLines={1}>
          {stream.vendor.username}
        </AdaptiveText>
        {stream.vendor.is_verified && (
          <Ionicons name="checkmark-circle" size={10} color="#3498DB" />
        )}
      </View>
    </TouchableOpacity>
  );
};

// Enhanced main stream card with thumbnail or video preview
const LiveStreamCard = ({
  stream,
  onPress,
  isFocused,
}: {
  stream: LiveStream;
  onPress: () => void;
  isFocused: boolean;
}) => {
  const formatViewerCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const hasPreviewVideo = Boolean(stream.preview_video_url);
  const player = useVideoPlayer(stream.preview_video_url || '', p => {
    p.muted = true;
    p.loop = true;
  });

  useEffect(() => {
    if (!hasPreviewVideo) return;
    if (isFocused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isFocused, hasPreviewVideo, player]);

  const formatSalesAmount = (amount: number) => {
    if (amount >= 1000000) return `₣${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₣${(amount / 1000).toFixed(1)}K`;
    return `₣${amount.toFixed(0)}`;
  };

  return (
    <TouchableOpacity 
      style={[styles.streamCard, isFocused && styles.streamCardFocused]} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Stream thumbnail or preview video */}
      <View style={styles.thumbnailContainer}>
        {hasPreviewVideo ? (
          <VideoView
            player={player}
            style={styles.thumbnail}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            pointerEvents="none"
          />
        ) : (
          <Image
            source={{
              uri: stream.thumbnail_url || stream.vendor.avatar_url || 'https://via.placeholder.com/400x600'
            }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}

        {/* Dark overlay for readability */}
        <View style={styles.overlay} />

        {/* Live indicator */}
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        {/* Viewer count */}
        <View style={styles.viewerCount}>
          <Ionicons name="eye" size={12} color="white" />
          <Text style={styles.viewerText}>{formatViewerCount(stream.viewer_count)}</Text>
        </View>
        
        {/* Stream type icon */}
        <View style={styles.streamTypeIcon}>
          <Ionicons 
            name={stream.stream_type === 'products' ? 'storefront' : 'hammer'} 
            size={16} 
            color="white" 
          />
        </View>
        
        {/* Sales indicator (if applicable) */}
        {stream.total_sales > 0 && (
          <View style={styles.salesIndicator}>
            <Ionicons name="flash" size={10} color="#FFD700" />
            <Text style={styles.salesText}>{formatSalesAmount(stream.total_sales)}</Text>
          </View>
        )}
      </View>
      
      {/* Stream info */}
      <View style={styles.streamInfo}>
        {/* Vendor info */}
        <View style={styles.vendorRow}>
          <Image
            source={{ 
              uri: stream.vendor.avatar_url || 'https://via.placeholder.com/40x40' 
            }}
            style={styles.vendorAvatar}
          />
          <View style={styles.vendorInfo}>
            <View style={styles.vendorNameRow}>
              <AdaptiveText style={styles.vendorName} baseFontSize={12} minFontSize={9} maxChars={15} numberOfLines={1}>@{stream.vendor.username}</AdaptiveText>
              {stream.vendor.is_verified && (
                <Ionicons name="checkmark-circle" size={14} color="#3498DB" />
              )}
            </View>
            <Text style={styles.streamTitle} numberOfLines={1}>
              {stream.title}
            </Text>
          </View>
        </View>
        
        {/* Stream description */}
        {stream.description && (
          <Text style={styles.streamDescription} numberOfLines={2}>
            {stream.description}
          </Text>
        )}
        
        {/* Stream stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="people" size={12} color="#888" />
            <Text style={styles.statText}>{formatViewerCount(stream.total_viewers)} viewers</Text>
          </View>
          
          {stream.stream_type === 'products' && stream.products && (
            <View style={styles.stat}>
              <Ionicons name="bag" size={12} color="#888" />
              <Text style={styles.statText}>{stream.products.length} products</Text>
            </View>
          )}
          
          <View style={styles.stat}>
            <Ionicons name="time" size={12} color="#888" />
            <Text style={styles.statText}>
              {new Date(stream.started_at || stream.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Enhanced Live Sales Discovery Screen
 * 
 * Features:
 * - Facebook-style horizontal plugged vendors cards
 * - Live video previews with focus-based audio
 * - Vertical main feed with smooth scrolling
 * - Audio control system (one stream at a time)
 */
const LiveSalesScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // State management
  const [pluggedStreams, setPluggedStreams] = useState<LiveStream[]>([]);
  const [mainStreams, setMainStreams] = useState<LiveStream[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [heroImages, setHeroImages] = useState<any[]>([]);
  
  // Screen focus tracking
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Focus tracking for visual feedback
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);
  
  // Plugged vendors section visibility
  const [showPluggedVendors, setShowPluggedVendors] = useState(true);
  const pluggedSectionHeight = useRef(new Animated.Value(1)).current;

  // Live stream search (vendor name or stream title)
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Check if user is a vendor (can create streams)
  // Debug user data
  console.log('🔍 LiveSales - User data:', {
    id: user?.id,
    user_role: user?.user_role,
    is_seller: user?.is_seller,
    username: user?.username
  });

  console.log('🔍 LiveSales - Profile data:', {
    isSeller: profile?.isSeller,
    isRider: profile?.isRider
  });

  const isVendor = profile?.isSeller || false;
  console.log('🔍 LiveSales - isVendor:', isVendor);

  // Load user profile to get seller status
  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getProfile();
      setProfile(profileData);
      console.log('✅ LiveSales - Profile loaded:', {
        isSeller: profileData.isSeller,
        isRider: profileData.isRider
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Load hero images for sign posts
  const loadHeroImages = async () => {
    try {
      const { heroImagesAPI } = await import('../services/heroImagesAPI');
      const images = await heroImagesAPI.getHeroImages('live_sales');
      setHeroImages(images);
    } catch (error) {
      console.warn('Failed to load live sales hero images:', error);
      setHeroImages([]);
    }
  };

  // Load plugged vendors streams
  const loadPluggedStreams = async () => {
    try {
      const plugged = await liveSalesAPI.getPluggedVendorsStreams(10);
      // Filter out ended/paused streams
      const activePlugged = plugged.filter(stream => stream.status === 'live');
      setPluggedStreams(activePlugged);
    } catch (error) {
      console.error('Error loading plugged streams:', error);
    }
  };

  // Load main feed streams
  const loadMainStreams = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setOffset(0);
      } else if (offset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = isRefresh ? 0 : offset;
      const limit = 20;
      
      // Exclude plugged vendors from main feed
      const newStreams = await liveSalesAPI.getActiveStreams(limit, currentOffset, true);
      
      // Filter out ended/paused streams as a safeguard
      const activeStreams = newStreams.filter(stream => stream.status === 'live');
      
      if (isRefresh || offset === 0) {
        setMainStreams(activeStreams);
        // Set first stream as focused for audio
        if (activeStreams.length > 0) {
          setFocusedStreamId(activeStreams[0].id);
        }
      } else {
        setMainStreams(prev => {
          // Combine and filter to ensure no duplicates or ended streams
          const combined = [...prev, ...activeStreams];
          const unique = combined.filter((stream, index, self) => 
            index === self.findIndex(s => s.id === stream.id) && stream.status === 'live'
          );
          return unique;
        });
      }
      
      // Check if there are more streams to load
      setHasMore(newStreams.length === limit);
      setOffset(currentOffset + newStreams.length);
      
    } catch (error) {
      console.error('Error loading main streams:', error);
      Alert.alert('Error', 'Failed to load live streams. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Load all data
  const loadAllData = async (isRefresh = false) => {
    await Promise.all([
      loadProfile(),
      loadHeroImages(),
      loadPluggedStreams(),
      loadMainStreams(isRefresh)
    ]);
  };

  // Load more streams when scrolling
  const loadMoreStreams = () => {
    if (!loadingMore && hasMore) {
      loadMainStreams();
    }
  };

  // Refresh all streams
  const refreshStreams = () => {
    loadAllData(true);
  };

  // Toggle the search bar; closing clears the query and restores the feed
  const handleSearchToggle = () => {
    if (searchVisible) {
      setSearchVisible(false);
      setSearchQuery('');
    } else {
      setSearchVisible(true);
    }
  };

  // Handle stream selection
  const handleStreamPress = (stream: LiveStream) => {
    navigation.navigate('LiveStreamViewer', { 
      streamId: stream.id,
      stream: stream
    });
  };

  // Handle go live button press
  const handleGoLive = () => {
    if (!isVendor) {
      Alert.alert(
        'Vendor Account Required',
        'You need to be registered as a vendor to start live streams. Would you like to become a vendor?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Become Vendor', onPress: () => navigation.navigate('RoleSelection') }
        ]
      );
      return;
    }

    navigation.navigate('LiveStreamSetup');
  };


  // Handle scroll for focus-based audio and plugged vendors visibility
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    
    // Hide/show plugged vendors section based on scroll
    if (scrollY > 100 && showPluggedVendors) {
      setShowPluggedVendors(false);
      Animated.timing(pluggedSectionHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else if (scrollY <= 50 && !showPluggedVendors) {
      setShowPluggedVendors(true);
      Animated.timing(pluggedSectionHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  // Handle main feed stream focus for visual feedback
  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const visibleStreams: { stream: LiveStream; percent: number }[] = [];
    viewableItems.forEach((v: any) => {
      if (v.item?.type === 'grid') {
        const percent = v.itemVisiblePercent || 0;
        v.item.streams.forEach((stream: LiveStream) => {
          visibleStreams.push({ stream, percent });
        });
      }
    });
    if (visibleStreams.length === 0) return;

    const mostVisible = visibleStreams.reduce((prev: any, current: any) =>
      prev.percent > current.percent ? prev : current
    );

    if (mostVisible.stream?.id && mostVisible.stream.id !== focusedStreamId) {
      setFocusedStreamId(mostVisible.stream.id);
    }
  }, [focusedStreamId]);

  // Setup WebSocket listeners for stream status updates
  React.useEffect(() => {
    if (!isScreenFocused) return;

    const removeStream = (streamId: string) => {
      console.log('🗑️ Removing ended stream from lists:', streamId);
      
      // Remove from main streams
      setMainStreams(prev => prev.filter(stream => stream.id !== streamId));
      
      // Remove from plugged streams
      setPluggedStreams(prev => prev.filter(stream => stream.id !== streamId));
      
      // Clear focused stream if it was the one that ended
      if (focusedStreamId === streamId) {
        setFocusedStreamId(null);
      }
    };

    const handleStreamStatusUpdate = (data: StreamStatusUpdate & { streamId?: string }) => {
      console.log('📡 Stream status update received:', data);
      
      // If stream ended or paused, remove it from both lists
      if (data.status === 'ended' || data.status === 'paused') {
        const streamId = data.streamId;
        if (streamId) {
          removeStream(streamId);
        }
      }
    };

    const handleStreamEnded = (data: { streamId: string; reason?: string; timestamp?: string }) => {
      console.log('🏁 Stream ended event received:', data);
      if (data.streamId) {
        removeStream(data.streamId);
      }
    };

    // Listen for stream status updates
    liveStreamSocket.on('stream_status', handleStreamStatusUpdate);
    
    // Also listen for stream_ended events (emitted by backend)
    liveStreamSocket.on('stream_ended', handleStreamEnded);

    return () => {
      // Cleanup listeners
      liveStreamSocket.off('stream_status', handleStreamStatusUpdate);
      liveStreamSocket.off('stream_ended', handleStreamEnded);
    };
  }, [isScreenFocused, focusedStreamId]);

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      loadAllData(true);

      return () => {
        // Cleanup when screen unfocuses
        setIsScreenFocused(false);
        setFocusedStreamId(null);
      };
    }, [])
  );

  // Render plugged vendor item
  const renderPluggedVendorItem = ({ item }: { item: LiveStream }) => (
    <PluggedVendorCard
      stream={item}
      onPress={() => handleStreamPress(item)}
    />
  );

  // Streams shown in the main feed. While searching, query the backend so
  // results cover every live stream — not just the loaded pages. The local
  // merged filter remains as a fallback while the request is in flight or if
  // it fails.
  const isSearching = searchQuery.trim().length > 0;
  const [searchResults, setSearchResults] = useState<LiveStream[] | null>(null);

  useEffect(() => {
    if (!isSearching) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await liveSalesAPI.getActiveStreams(50, 0, false, searchQuery.trim());
        setSearchResults(results.filter(s => s.status === 'live'));
      } catch (error) {
        console.error('Live stream search failed:', error);
        setSearchResults(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, isSearching]);

  const feedStreams = useMemo<LiveStream[]>(() => {
    if (!isSearching) return mainStreams;
    if (searchResults) return searchResults;
    const query = searchQuery.trim().toLowerCase();
    const merged = [...pluggedStreams, ...mainStreams];
    const unique = merged.filter(
      (stream, index, self) => index === self.findIndex(s => s.id === stream.id),
    );
    return unique.filter(
      (stream) =>
        stream.title?.toLowerCase().includes(query) ||
        stream.vendor?.username?.toLowerCase().includes(query),
    );
  }, [isSearching, searchQuery, searchResults, pluggedStreams, mainStreams]);

  // Build main feed rows with hero banners inserted after every 10 streams
  type MainRow =
    | { type: 'grid'; streams: LiveStream[] }
    | { type: 'hero'; hero: any };

  const mainRows = useMemo<MainRow[]>(() => {
    const ITEMS_PER_SECTION = 10;
    const HERO_CARD_THRESHOLD = 10;
    const rows: MainRow[] = [];
    let streamIdx = 0;
    let heroBannerIndex = 0;

    while (streamIdx < feedStreams.length) {
      const itemsToAdd = Math.min(ITEMS_PER_SECTION, feedStreams.length - streamIdx);
      const sectionItems = feedStreams.slice(streamIdx, streamIdx + itemsToAdd);

      for (let i = 0; i < sectionItems.length; i += 2) {
        rows.push({ type: 'grid', streams: sectionItems.slice(i, i + 2) });
      }

      streamIdx += itemsToAdd;

      if (
        !isSearching &&
        streamIdx < feedStreams.length &&
        itemsToAdd >= HERO_CARD_THRESHOLD &&
        heroImages.length > 0
      ) {
        rows.push({
          type: 'hero',
          hero: heroImages[heroBannerIndex % heroImages.length],
        });
        heroBannerIndex++;
      }
    }

    return rows;
  }, [feedStreams, isSearching, heroImages]);

  // Render main feed row (grid or hero banner)
  const renderMainRow = ({ item, index }: { item: MainRow; index: number }) => {
    if (item.type === 'hero') {
      return <HeroMedia key={`hero-${index}`} hero={item.hero} height={180} />;
    }

    return (
      <View key={`grid-${index}`} style={styles.row}>
        {item.streams.map((stream) => (
          <LiveStreamCard
            key={stream.id}
            stream={stream}
            onPress={() => handleStreamPress(stream)}
            isFocused={focusedStreamId === stream.id}
          />
        ))}
      </View>
    );
  };

  // Render loading footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3498DB" />
        <Text style={styles.footerText}>Loading more streams...</Text>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name={isSearching ? 'search-outline' : 'videocam-outline'} size={80} color="#444" />
      <Text style={styles.emptyTitle}>
        {isSearching ? 'No Matching Streams' : 'No Live Streams'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isSearching
          ? `No live streams match "${searchQuery.trim()}". Try a different vendor name or stream title.`
          : `No one is streaming right now. ${isVendor ? 'Be the first to go live!' : 'Check back later!'}`}
      </Text>
      {isVendor && !isSearching && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleGoLive}>
          <Text style={styles.emptyButtonText}>Start Live Stream</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Finding live streams...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Live Sales</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('TopVendorLeaderboard')}>
            <Ionicons name="trophy-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={handleSearchToggle}>
            <Ionicons name={searchVisible ? 'close' : 'search'} size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar — filters livestreams by title or vendor name */}
      {searchVisible && (
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color="#888" style={styles.searchBarIcon} />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Search live streams or vendors"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main content */}
      <FlatList
        data={mainRows}
        renderItem={renderMainRow}
        keyExtractor={(item, index) => (item.type === 'grid' ? `grid-${index}` : `hero-${index}`)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + (isVendor ? 100 : 20) }
        ]}
        ListHeaderComponent={() => (
          <View>
            {!isSearching && heroImages.length > 0 && (
              <HeroMedia hero={heroImages[0]} height={160} />
            )}
            <Animated.View
              style={[
                styles.pluggedVendorsSection,
                {
                  height: pluggedSectionHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, pluggedStreams.length > 0 ? 180 : 0],
                  }),
                  opacity: pluggedSectionHeight,
                }
              ]}
            >
              {!isSearching && pluggedStreams.length > 0 && (
                <>
                  <View style={styles.pluggedHeader}>
                    <Text style={styles.pluggedTitle}>Your Plugs</Text>
                    <Text style={styles.pluggedSubtitle}>{pluggedStreams.length} vendors live</Text>
                  </View>
                  <FlatList
                    data={pluggedStreams}
                    renderItem={renderPluggedVendorItem}
                    keyExtractor={(item) => `plugged-${item.id}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pluggedList}
                  />
                </>
              )}
            </Animated.View>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshStreams}
            colors={['#3498DB']}
            tintColor="#3498DB"
            title="Pull to refresh"
            titleColor="#888"
          />
        }
        onEndReached={loadMoreStreams}
        onEndReachedThreshold={0.5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
          minimumViewTime: 300,
        }}
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Go Live Button (vendors only) */}
      {isVendor && (
        <TouchableOpacity 
          style={[styles.goLiveButton, { bottom: insets.bottom + 20 }]}
          onPress={handleGoLive}
          activeOpacity={0.8}
        >
          <View style={styles.goLiveContent}>
            <Ionicons name="videocam" size={24} color="white" />
            <Text style={styles.goLiveText}>Go Live</Text>
          </View>
        </TouchableOpacity>
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
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    padding: 8,
  },

  // Search bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    paddingVertical: 0,
  },
  
  // Plugged vendors section
  pluggedVendorsSection: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  pluggedHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  pluggedTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pluggedSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  pluggedList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  
  // Plugged vendor card styles
  pluggedCard: {
    width: 100,
    marginHorizontal: 4,
  },
  pluggedVideoContainer: {
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a1a',
  },
  pluggedVideo: {
    width: '100%',
    height: '100%',
  },
  pluggedLiveIndicator: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  pluggedLiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'white',
    marginRight: 3,
  },
  pluggedLiveText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  pluggedViewerCount: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  pluggedViewerText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '600',
  },
  pluggedVendorInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  pluggedVendorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  pluggedVendorName: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // List styles
  listContent: {
    padding: 8,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  
  // Stream card styles
  streamCard: {
    width: screenWidth / 2 - 16,
    backgroundColor: '#111',
    borderRadius: 12,
    margin: 4,
    overflow: 'hidden',
  },
  streamCardFocused: {
    borderWidth: 2,
    borderColor: '#3498DB',
  },
  thumbnailContainer: {
    height: 160,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  
  // Live indicator
  liveIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Viewer count
  viewerCount: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  viewerText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  
  // Stream type icon
  streamTypeIcon: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 6,
    borderRadius: 16,
  },
  
  // Sales indicator
  salesIndicator: {
    position: 'absolute',
    top: 40,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  salesText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  
  // Stream info
  streamInfo: {
    padding: 12,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  streamTitle: {
    color: '#CCC',
    fontSize: 11,
    marginTop: 1,
  },
  streamDescription: {
    color: '#888',
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 8,
  },
  
  // Stats row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    color: '#888',
    fontSize: 10,
    marginLeft: 2,
  },
  
  // Loading states
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Go Live button
  goLiveButton: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#FF4757',
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  goLiveContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  goLiveText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default LiveSalesScreen;