import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Animated,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchAPI, SearchType, UserResult, RiderResult } from '../services/searchAPI';
import { useSearch, useDiscoverContent, useSearchSuggestions } from '../hooks/useSearch';
import {
  PersonCard,
  ProviderCard,
  ProductCard,
  ServiceCard,
  type PersonData,
  type ProviderData,
  type ProductData,
  type ServiceData
} from '../components/cards';
import {
  mapProductsArray,
  mapServicesArray,
  mapPeopleArray,
  mapProvidersArray,
} from '../utils/dataMappers';

const SearchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('For You');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    showOnSale: false,
    showNewArrivals: false,
    showLiveNow: false,
    showNearMe: false,
    showTopRated: false,
    showFreeShipping: false,
    showVerifiedOnly: false,
    priceRange: 'all', // 'all', 'under50', '50to200', 'over200'
    sortBy: 'relevance', // 'relevance', 'price_low', 'price_high', 'newest', 'rating'
  });
  
  // Debounce timer
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use our search hooks
  const { search, searchResults, isSearching, searchError, searchHistory, clearSearch } = useSearch();
  const { discoverContent, isLoading: isLoadingDiscover, error: discoverError, refreshContent } = useDiscoverContent(false, 300000);
  const { suggestions, isLoading: isLoadingSuggestions } = useSearchSuggestions(searchQuery, isSearchFocused && searchQuery.length > 0);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const tabs = ['For You', 'Products', 'Services', 'Vendors', 'Riders', 'People'];

  // Get data from discover content - no mock fallback data
  const trendingData = discoverContent?.trending || [];

  // Map API data to card format using useMemo to prevent re-renders
  const featuredContent = useMemo(() => {
    const raw = discoverContent?.featured || { products: [], services: [], people: [], providers: [] };
    return {
      products: mapProductsArray(raw.products || []),
      services: mapServicesArray(raw.services || []),
      people: mapPeopleArray(raw.people || []),
      providers: mapProvidersArray(raw.providers || []),
    };
  }, [discoverContent]);

  const recommendations = useMemo(() => {
    const raw = discoverContent?.recommendations || { products: [], services: [], people: [], providers: [] };
    return {
      products: mapProductsArray(raw.products || []),
      services: mapServicesArray(raw.services || []),
      people: mapPeopleArray(raw.people || []),
      providers: mapProvidersArray(raw.providers || []),
    };
  }, [discoverContent]);

  // Get recent searches from search history
  const recentSearches = searchHistory;

  // Quick filters
  const quickFilters = [
    { id: '1', name: 'On Sale', icon: 'pricetag', color: '#E74C3C' },
    { id: '2', name: 'New Arrivals', icon: 'flash', color: '#F39C12' },
    { id: '3', name: 'Live Now', icon: 'radio', color: '#E91E63' },
    { id: '4', name: 'Near Me', icon: 'location', color: '#2196F3' },
    { id: '5', name: 'Top Rated', icon: 'star', color: '#FF9800' },
    { id: '6', name: 'Free Shipping', icon: 'car', color: '#4CAF50' },
  ];

  // People tab filters
  const peopleFilters = [
    { id: '1', name: 'Near Me', icon: 'location', color: '#2196F3' },
    { id: '2', name: 'Verified', icon: 'shield-checkmark', color: '#27AE60' },
    { id: '3', name: 'Top Rated', icon: 'star', color: '#FF9800' },
    { id: '4', name: 'Online Now', icon: 'radio', color: '#E91E63' },
    { id: '5', name: 'New Members', icon: 'flash', color: '#F39C12' },
    { id: '6', name: 'Mutual Friends', icon: 'people', color: '#9C27B0' },
  ];

  // Riders tab filters
  const riderFilters = [
    { id: '1', name: 'Available Now', icon: 'checkmark-circle', color: '#27AE60' },
    { id: '2', name: 'Near Me', icon: 'location', color: '#2196F3' },
    { id: '3', name: 'Fast Delivery', icon: 'flash', color: '#F39C12' },
    { id: '4', name: 'Top Rated', icon: 'star', color: '#FF9800' },
    { id: '5', name: 'Eco-Friendly', icon: 'leaf', color: '#4CAF50' },
    { id: '6', name: 'Bulk Orders', icon: 'car', color: '#673AB7' },
  ];

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isSearchFocused) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isSearchFocused]);

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    // Validate query length
    if (query.trim().length < 2) {
      return; // Too short, wait for more input
    }

    if (query.trim().length > 500) {
      // Handle very long queries
      return;
    }

    try {
      // Map tab to search type
      let searchType = SearchType.ALL;
      switch (activeTab) {
        case 'Products':
          searchType = SearchType.PRODUCTS;
          break;
        case 'Services':
          searchType = SearchType.SERVICES;
          break;
        case 'People':
          searchType = SearchType.PEOPLE;
          break;
        case 'Riders':
        case 'Vendors':
          searchType = SearchType.PROVIDERS;
          break;
        default:
          searchType = SearchType.ALL;
      }

      // Perform search using our hook
      await search({
        query: query.trim(),
        type: searchType,
        limit: 20,
        page: 1,
      });
    } catch (error) {
      console.error('Search handling error:', error);
      // Error is already handled by the useSearch hook
    }
  }, [activeTab, search]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    // Clear search if query is empty
    if (query.trim().length === 0) {
      clearSearch();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      return;
    }

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer - 500ms debounce
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 500);
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerContent}>
        <Animated.View style={[styles.searchContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.searchInputContainer}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#3498DB" style={styles.searchIcon} />
            ) : (
              <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" style={styles.searchIcon} />
            )}
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, services, vendors..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={handleSearch}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onSubmitEditing={() => {
                // Close suggestions modal and perform search when Enter is pressed
                setIsSearchFocused(false);
                performSearch(searchQuery);
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                clearSearch();
                if (debounceTimer.current) {
                  clearTimeout(debounceTimer.current);
                }
              }} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Ionicons name="options-outline" size={22} color="#FFFFFF" />
          {(filters.showOnSale || filters.showNearMe || filters.showTopRated || filters.showVerifiedOnly) && (
            <View style={styles.filterActiveBadge} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Suggestions */}
      {isSearchFocused && (
        <Animated.View
          style={[
            styles.searchSuggestions,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
              opacity: slideAnim,
            },
          ]}
        >
          {suggestions.length > 0 ? (
            <>
              <Text style={styles.suggestionsTitle}>Suggestions</Text>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`suggestion-${index}`}
                  style={styles.suggestionItem}
                  onPress={() => handleSearch(suggestion)}
                >
                  <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                  <Ionicons name="arrow-up-outline" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ))}
              {recentSearches.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.suggestionsTitle}>Recent</Text>
                  {recentSearches.slice(0, 3).map((search, index) => (
                    <TouchableOpacity
                      key={`recent-${index}`}
                      style={styles.suggestionItem}
                      onPress={() => handleSearch(search)}
                    >
                      <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.suggestionText}>{search}</Text>
                      <Ionicons name="arrow-up-outline" size={16} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.suggestionsTitle}>Recent Searches</Text>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={`recent-${index}`}
                  style={styles.suggestionItem}
                  onPress={() => handleSearch(search)}
                >
                  <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.suggestionText}>{search}</Text>
                  <Ionicons name="arrow-up-outline" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ))}
            </>
          )}
        </Animated.View>
      )}
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            {activeTab === tab && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderQuickFilters = () => {
    let currentFilters = quickFilters;
    
    if (activeTab === 'People') {
      currentFilters = peopleFilters;
    } else if (activeTab === 'Riders') {
      currentFilters = riderFilters;
    }

    return (
      <View style={styles.quickFiltersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFiltersContent}>
          {currentFilters.map((filter) => (
            <TouchableOpacity key={filter.id} style={[styles.filterChip, { borderColor: filter.color }]}>
              <Ionicons name={filter.icon as any} size={16} color={filter.color} />
              <Text style={[styles.filterText, { color: filter.color }]}>{filter.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTrendingItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.trendingItem}>
      <View style={styles.trendingContent}>
        <View style={styles.trendingHeader}>
          <Text style={styles.trendingTitle}>{item.title}</Text>
          <View style={[styles.growthBadge, { backgroundColor: `${item.growth.includes('-') ? '#E74C3C' : '#27AE60'}20` }]}>
            <Text style={[styles.growthText, { color: item.growth.includes('-') ? '#E74C3C' : '#27AE60' }]}>
              {item.growth}
            </Text>
          </View>
        </View>
        <Text style={styles.trendingSubtitle}>{item.location}</Text>
        <Text style={styles.trendingPosts}>{item.posts}</Text>
      </View>
      <TouchableOpacity style={styles.trendingOptions}>
        <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderHighlightItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.highlightItem}>
      <View style={styles.highlightImageContainer}>
        <Image source={{ uri: item.image }} style={styles.highlightImage} />
        <View style={[styles.categoryBadge, { backgroundColor: item.category === 'Hot Deal' ? '#E74C3C' : item.category === 'New Service' ? '#2196F3' : '#E91E63' }]}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        <View style={styles.engagementBadge}>
          <Ionicons name="eye" size={12} color="#FFFFFF" />
          <Text style={styles.engagementText}>{item.engagement}</Text>
        </View>
      </View>
      <View style={styles.highlightContent}>
        <View style={styles.highlightHeader}>
          <Image source={{ uri: item.vendorAvatar }} style={styles.vendorAvatar} />
          <View style={styles.highlightInfo}>
            <Text style={styles.highlightTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.highlightSubtitle}>{item.subtitle}</Text>
            <Text style={styles.vendorName}>{item.vendor}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFeaturedPersonItem = ({ item }: { item: PersonData }) => (
    <PersonCard
      person={item}
      variant="featured"
      onPress={(person) => navigation.navigate('PublicProfile', { userId: person.id })}
      onConnect={(person) => console.log('Connect with:', person.username)}
    />
  );

  const renderFeaturedProviderItem = ({ item }: { item: ProviderData }) => (
    <ProviderCard
      rider={item}
      variant="featured"
      onPress={(rider) => navigation.navigate('PublicProfile', { userId: rider.id })}
      onSelect={(rider) => console.log('Select provider:', rider.name)}
    />
  );

  const renderFeaturedProductItem = ({ item }: { item: ProductData }) => (
    <ProductCard
      product={item}
      variant="featured"
      onPress={(product) => navigation.navigate('ProductDetails', { productId: product.id })}
      onLike={(product) => console.log('Like product:', product.title)}
      onBookmark={(product) => console.log('Bookmark product:', product.title)}
      onVendorPress={(vendorId) => navigation.navigate('PublicProfile', { userId: vendorId })}
    />
  );

  const renderFeaturedServiceItem = ({ item }: { item: ServiceData }) => (
    <ServiceCard
      service={item}
      variant="featured"
      onPress={(service) => navigation.navigate('ServiceDetails', { serviceId: service.id })}
      onLike={(service) => console.log('Like service:', service.title)}
      onBookmark={(service) => console.log('Bookmark service:', service.title)}
      onProviderPress={(providerId) => navigation.navigate('PublicProfile', { userId: providerId })}
      onBookNow={(service) => console.log('Book service:', service.title)}
    />
  );

  const renderTrendingPersonItem = ({ item }: { item: any }) => (
    <PersonCard
      person={{
        id: item?.id || '',
        username: item?.username || 'Unknown',
        avatar: item?.avatar || `https://picsum.photos/400/400?random=${item?.id || 'default'}`,
        followers: item?.followers || 0,
        location: item?.location || 'Unknown',
        recentActivity: item?.activity || 'No recent activity',
        engagementRate: parseInt((item?.growth || '0%').replace('+', '').replace('%', '')),
      }}
      variant="trending"
      onPress={(person) => navigation.navigate('PublicProfile', { userId: person.id })}
    />
  );

  const renderUserItem = ({ item }: { item: UserResult }) => (
    <PersonCard
      person={{
        id: item?.id || '',
        username: item?.username || 'Unknown',
        firstName: item?.firstName || '',
        lastName: item?.lastName || '',
        avatar: item?.avatarUrl || `https://picsum.photos/400/400?random=${item?.id || 'default'}`,
        location: item?.location || 'Unknown',
        trustScore: item?.trustScore || 0,
        isOnline: item?.isOnline || false,
        mutualConnections: item?.mutualConnections || 0,
      }}
      variant="compact"
      onPress={(person) => navigation.navigate('PublicProfile', { userId: person.id })}
      onConnect={(person) => console.log('Connect with user:', person.username)}
    />
  );

  const renderRiderItem = ({ item }: { item: RiderResult }) => (
    <ProviderCard
      rider={item}
      variant="selection"
      onPress={(rider) => navigation.navigate('PublicProfile', { userId: rider.id })}
      onSelect={(rider) => console.log('Select provider for order:', rider.name)}
    />
  );

  const renderContent = () => {
    if (searchQuery.length > 0) {
      return (
        <ScrollView style={styles.searchResults} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.searchResultsTitle}>Search Results for "{searchQuery}"</Text>
          
          {isSearching && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}
          
          {searchError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#E74C3C" />
              <Text style={styles.errorText}>{searchError}</Text>
            </View>
          )}
          
          {searchResults && !isSearching && (
            <>
              {/* People Results */}
              {(searchResults?.results?.people?.length || 0) > 0 && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>People ({searchResults?.results?.people?.length || 0})</Text>
                  <FlatList
                    data={searchResults?.results?.people || []}
                    renderItem={({ item }) => (
                      <PersonCard
                        person={item}
                        variant="compact"
                        onPress={() => navigation.navigate('PublicProfile', { userId: item.id })}
                      />
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}
              
              {/* Providers Results */}
              {(searchResults?.results?.providers?.length || 0) > 0 && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>Providers ({searchResults?.results?.providers?.length || 0})</Text>
                  <FlatList
                    data={searchResults?.results?.providers || []}
                    renderItem={({ item }) => (
                      <ProviderCard
                        rider={item}
                        variant="compact"
                        onPress={() => navigation.navigate('PublicProfile', { userId: item.id })}
                      />
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}
              
              {/* Products Results */}
              {(searchResults?.results?.products?.length || 0) > 0 && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>Products ({searchResults?.results?.products?.length || 0})</Text>
                  <FlatList
                    data={searchResults?.results?.products || []}
                    renderItem={({ item }) => (
                      <ProductCard
                        product={item}
                        variant="list"
                        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      />
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}
              
              {/* Services Results */}
              {(searchResults?.results?.services?.length || 0) > 0 && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>Services ({searchResults?.results?.services?.length || 0})</Text>
                  <FlatList
                    data={searchResults?.results?.services || []}
                    renderItem={({ item }) => (
                      <ServiceCard
                        service={item}
                        variant="list"
                        onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
                      />
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </>
          )}
          
          {/* No Results */}
          {searchResults && !isSearching && searchResults.pagination.total === 0 && (
            <View style={styles.noResultsContainer}>
              <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.noResultsText}>No results found</Text>
              <Text style={styles.noResultsSubtext}>Try searching with different keywords</Text>
            </View>
          )}
        </ScrollView>
      );
    }

    switch (activeTab) {
      case 'For You':
        return (
          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoadingDiscover}
                onRefresh={refreshContent}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
          >
            {renderQuickFilters()}
            
            {isLoadingDiscover && !discoverContent && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading discover content...</Text>
              </View>
            )}

            {discoverError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#E74C3C" />
                <Text style={styles.errorText}>{discoverError}</Text>
                <TouchableOpacity onPress={refreshContent} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {featuredContent.products.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Products</Text>
                <FlatList
                  data={featuredContent.products}
                  renderItem={({ item }) => (
                    <ProductCard
                      product={item}
                      variant="featured"
                      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      onLike={() => console.log('Product liked:', item.id)}
                      onBookmark={() => console.log('Product bookmarked:', item.id)}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {featuredContent.services.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Services</Text>
                <FlatList
                  data={featuredContent.services}
                  renderItem={({ item }) => (
                    <ServiceCard
                      service={item}
                      variant="featured"
                      onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
                      onBookNow={() => console.log('Service booked:', item.id)}
                      onAddToCart={() => console.log('Service added to cart:', item.id)}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {recommendations.products.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended for You</Text>
                <FlatList
                  data={[...recommendations.products, ...recommendations.services].slice(0, 6)}
                  renderItem={({ item }) => {
                    const isService = 'provider' in item;
                    return isService ? (
                      <ServiceCard
                        service={item}
                        variant="grid"
                        onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
                      />
                    ) : (
                      <ProductCard
                        product={item}
                        variant="grid"
                        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      />
                    );
                  }}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  numColumns={2}
                />
              </View>
            )}

            {trendingData.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Trending</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={trendingData}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.trendingItem}
                      onPress={() => handleSearch(item.query)}
                    >
                      <View style={styles.trendingContent}>
                        <Text style={styles.trendingTitle}>{item.query || 'Search query'}</Text>
                        <Text style={styles.trendingSubtitle}>{String(item.count ?? 0)} searches • {item.category || 'All'}</Text>
                      </View>
                      <View style={styles.trendingBadge}>
                        <Ionicons name="trending-up" size={16} color="#4CAF50" />
                        <Text style={styles.trendingGrowth}>Trending</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item, index) => `${item.query}-${index}`}
                  scrollEnabled={false}
                />
              </View>
            )}
          </ScrollView>
        );
      
      case 'People':
        return (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoadingDiscover}
                onRefresh={refreshContent}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
          >
            {renderQuickFilters()}

            {isLoadingDiscover && !discoverContent && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading people...</Text>
              </View>
            )}

            {discoverError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#E74C3C" />
                <Text style={styles.errorText}>{discoverError}</Text>
                <TouchableOpacity onPress={refreshContent} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {featuredContent.people.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured People</Text>
                <FlatList
                  data={featuredContent.people}
                  renderItem={renderFeaturedPersonItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {recommendations.people.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recommended People</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recommendations.people}
                  renderItem={renderFeaturedPersonItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {featuredContent.people.length === 0 && recommendations.people.length === 0 && !isLoadingDiscover && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyStateText}>No people found</Text>
                <Text style={styles.emptyStateSubtext}>Check back later for featured people</Text>
              </View>
            )}
          </ScrollView>
        );

      case 'Riders':
        return (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoadingDiscover}
                onRefresh={refreshContent}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
          >
            {renderQuickFilters()}

            {isLoadingDiscover && !discoverContent && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading riders...</Text>
              </View>
            )}

            {discoverError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#E74C3C" />
                <Text style={styles.errorText}>{discoverError}</Text>
                <TouchableOpacity onPress={refreshContent} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {featuredContent.providers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Riders</Text>
                <FlatList
                  data={featuredContent.providers}
                  renderItem={renderFeaturedProviderItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {recommendations.providers.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Top Performers</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recommendations.providers.sort((a, b) => (b.rating || 0) - (a.rating || 0))}
                  renderItem={renderFeaturedProviderItem}
                  keyExtractor={(item) => `top-${item.id}`}
                  scrollEnabled={false}
                />
              </View>
            )}

            {featuredContent.providers.length === 0 && recommendations.providers.length === 0 && !isLoadingDiscover && (
              <View style={styles.emptyState}>
                <Ionicons name="bicycle-outline" size={64} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyStateText}>No riders found</Text>
                <Text style={styles.emptyStateSubtext}>Check back later for available riders</Text>
              </View>
            )}
          </ScrollView>
        );

      case 'Products':
        return (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoadingDiscover}
                onRefresh={refreshContent}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
          >
            {renderQuickFilters()}

            {isLoadingDiscover && !discoverContent && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading products...</Text>
              </View>
            )}

            {discoverError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#E74C3C" />
                <Text style={styles.errorText}>{discoverError}</Text>
                <TouchableOpacity onPress={refreshContent} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {featuredContent.products.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Products</Text>
                <FlatList
                  data={featuredContent.products}
                  renderItem={({ item }) => (
                    <ProductCard
                      product={item}
                      variant="list"
                      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      onLike={() => console.log('Product liked:', item.id)}
                      onBookmark={() => console.log('Product bookmarked:', item.id)}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {recommendations.products.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recommended Products</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recommendations.products}
                  renderItem={({ item }) => (
                    <ProductCard
                      product={item}
                      variant="grid"
                      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  scrollEnabled={false}
                />
              </View>
            )}

            {featuredContent.products.length === 0 && recommendations.products.length === 0 && !isLoadingDiscover && (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={64} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyStateText}>No products found</Text>
                <Text style={styles.emptyStateSubtext}>Check back later for new products</Text>
              </View>
            )}
          </ScrollView>
        );

      case 'Services':
        return (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoadingDiscover}
                onRefresh={refreshContent}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
          >
            {renderQuickFilters()}

            {isLoadingDiscover && !discoverContent && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading services...</Text>
              </View>
            )}

            {discoverError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#E74C3C" />
                <Text style={styles.errorText}>{discoverError}</Text>
                <TouchableOpacity onPress={refreshContent} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {featuredContent.services.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Services</Text>
                <FlatList
                  data={featuredContent.services}
                  renderItem={({ item }) => (
                    <ServiceCard
                      service={item}
                      variant="list"
                      onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
                      onBookNow={() => console.log('Service booked:', item.id)}
                      onAddToCart={() => console.log('Service added to cart:', item.id)}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {recommendations.services.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recommended Services</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recommendations.services}
                  renderItem={({ item }) => (
                    <ServiceCard
                      service={item}
                      variant="grid"
                      onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  scrollEnabled={false}
                />
              </View>
            )}

            {featuredContent.services.length === 0 && recommendations.services.length === 0 && !isLoadingDiscover && (
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={64} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyStateText}>No services found</Text>
                <Text style={styles.emptyStateSubtext}>Check back later for new services</Text>
              </View>
            )}
          </ScrollView>
        );

      case 'Vendors':
        return (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoadingDiscover}
                onRefresh={refreshContent}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
          >
            {renderQuickFilters()}

            {isLoadingDiscover && !discoverContent && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading vendors...</Text>
              </View>
            )}

            {discoverError && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#E74C3C" />
                <Text style={styles.errorText}>{discoverError}</Text>
                <TouchableOpacity onPress={refreshContent} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {featuredContent.people.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Vendors</Text>
                <FlatList
                  data={featuredContent.people}
                  renderItem={renderFeaturedPersonItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {recommendations.people.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Top Rated Vendors</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={recommendations.people}
                  renderItem={renderFeaturedPersonItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </View>
            )}

            {featuredContent.people.length === 0 && recommendations.people.length === 0 && !isLoadingDiscover && (
              <View style={styles.emptyState}>
                <Ionicons name="storefront-outline" size={64} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyStateText}>No vendors found</Text>
                <Text style={styles.emptyStateSubtext}>Check back later for featured vendors</Text>
              </View>
            )}
          </ScrollView>
        );

      default:
        return (
          <View style={[styles.emptyState, { paddingBottom: 100 }]}>
            <Ionicons name="search-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyStateText}>Search for {activeTab === 'People' ? 'users' : activeTab.toLowerCase()}</Text>
            <Text style={styles.emptyStateSubtext}>Find the best {activeTab === 'People' ? 'users' : activeTab.toLowerCase()} on Fretiko</Text>
          </View>
        );
    }
  };

  const renderFilterModal = () => (
    <Modal
      visible={isFilterModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsFilterModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Filters</Text>
            <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Quick Filters */}
            <Text style={styles.filterSectionTitle}>Quick Filters</Text>
            <View style={styles.filterOptions}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>On Sale</Text>
                <Switch
                  value={filters.showOnSale}
                  onValueChange={(val) => setFilters({ ...filters, showOnSale: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>New Arrivals</Text>
                <Switch
                  value={filters.showNewArrivals}
                  onValueChange={(val) => setFilters({ ...filters, showNewArrivals: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Live Now</Text>
                <Switch
                  value={filters.showLiveNow}
                  onValueChange={(val) => setFilters({ ...filters, showLiveNow: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Near Me</Text>
                <Switch
                  value={filters.showNearMe}
                  onValueChange={(val) => setFilters({ ...filters, showNearMe: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Top Rated</Text>
                <Switch
                  value={filters.showTopRated}
                  onValueChange={(val) => setFilters({ ...filters, showTopRated: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Free Shipping</Text>
                <Switch
                  value={filters.showFreeShipping}
                  onValueChange={(val) => setFilters({ ...filters, showFreeShipping: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Verified Only</Text>
                <Switch
                  value={filters.showVerifiedOnly}
                  onValueChange={(val) => setFilters({ ...filters, showVerifiedOnly: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Price Range */}
            <Text style={styles.filterSectionTitle}>Price Range</Text>
            <View style={styles.priceOptions}>
              {['all', 'under50', '50to200', 'over200'].map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[styles.priceOption, filters.priceRange === range && styles.priceOptionActive]}
                  onPress={() => setFilters({ ...filters, priceRange: range })}
                >
                  <Text style={[styles.priceOptionText, filters.priceRange === range && styles.priceOptionTextActive]}>
                    {range === 'all' ? 'All Prices' : range === 'under50' ? 'Under ₣50' : range === '50to200' ? '₣50 - ₣200' : 'Over ₣200'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sort By */}
            <Text style={styles.filterSectionTitle}>Sort By</Text>
            <View style={styles.sortOptions}>
              {[
                { id: 'relevance', label: 'Relevance', icon: 'star' },
                { id: 'price_low', label: 'Price: Low to High', icon: 'arrow-up' },
                { id: 'price_high', label: 'Price: High to Low', icon: 'arrow-down' },
                { id: 'newest', label: 'Newest First', icon: 'time' },
                { id: 'rating', label: 'Highest Rated', icon: 'trophy' },
              ].map((sort) => (
                <TouchableOpacity
                  key={sort.id}
                  style={[styles.sortOption, filters.sortBy === sort.id && styles.sortOptionActive]}
                  onPress={() => setFilters({ ...filters, sortBy: sort.id })}
                >
                  <Ionicons 
                    name={sort.icon as any} 
                    size={18} 
                    color={filters.sortBy === sort.id ? '#3498DB' : 'rgba(255,255,255,0.6)'} 
                  />
                  <Text style={[styles.sortOptionText, filters.sortBy === sort.id && styles.sortOptionTextActive]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => setFilters({
                showOnSale: false,
                showNewArrivals: false,
                showLiveNow: false,
                showNearMe: false,
                showTopRated: false,
                showFreeShipping: false,
                showVerifiedOnly: false,
                priceRange: 'all',
                sortBy: 'relevance',
              })}
            >
              <Text style={styles.resetButtonText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                setIsFilterModalVisible(false);
                // Re-trigger search with filters if search query exists
                if (searchQuery.trim().length >= 2) {
                  performSearch(searchQuery);
                }
              }}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {!isSearchFocused && renderTabs()}
      {renderContent()}
      {renderFilterModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  clearButton: {
    marginLeft: 8,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  filterActiveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27AE60',
    borderWidth: 1,
    borderColor: '#000000',
  },
  searchSuggestions: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginTop: 10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestionsTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabsContent: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1DA1F2',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: '#1DA1F2',
    borderRadius: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100, // Add padding to prevent content from being hidden behind bottom nav
  },
  quickFiltersContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  quickFiltersContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    gap: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  seeAllText: {
    color: '#1DA1F2',
    fontSize: 16,
    fontWeight: '600',
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  trendingContent: {
    flex: 1,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  trendingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  growthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  growthText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  trendingSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginBottom: 2,
  },
  trendingPosts: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  trendingOptions: {
    padding: 8,
  },
  highlightItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  highlightImageContainer: {
    position: 'relative',
    height: 180,
  },
  highlightImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  engagementBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  engagementText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  highlightContent: {
    padding: 16,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  vendorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  highlightInfo: {
    flex: 1,
  },
  highlightTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 6,
  },
  highlightSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginBottom: 4,
  },
  vendorName: {
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  searchResults: {
    flex: 1,
    padding: 16,
  },
  searchResultsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  
  // Loading and result states
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  resultSection: {
    marginBottom: 24,
  },
  resultSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noResultsText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },

  // User item styles
  userItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27AE60',
    marginLeft: 8,
  },
  userUsername: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  userLocation: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 2,
  },
  mutualConnections: {
    color: '#1DA1F2',
    fontSize: 12,
    fontWeight: '500',
  },
  userActions: {
    alignItems: 'flex-end',
  },
  trustScore: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  trustScoreText: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  connectButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Rider item styles
  riderItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  riderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  riderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  riderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  riderName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  riderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  vehicleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  riderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riderRating: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  riderDeliveries: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  riderDistance: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  selectRiderButton: {
    backgroundColor: 'rgba(29, 161, 242, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1DA1F2',
  },
  selectRiderText: {
    color: '#1DA1F2',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredPersonImageContainer: {
    position: 'relative',
    height: 200,
  },
  featuredPersonImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  onlineIndicatorLarge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#27AE60',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredPersonContent: {
    padding: 16,
  },
  featuredPersonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  featuredPersonName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  trustScoreSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trustScoreSmallText: {
    color: '#27AE60',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  featuredPersonUsername: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  featuredPersonSpecialty: {
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  featuredPersonStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  featuredPersonFollowers: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredPersonMutual: {
    color: '#9C27B0',
    fontSize: 12,
    fontWeight: '500',
  },
  featuredPersonActivity: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Featured rider styles
  featuredRiderItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featuredRiderImageContainer: {
    position: 'relative',
    height: 200,
  },
  featuredRiderImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  vehicleBadgeLarge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredRiderContent: {
    padding: 16,
  },
  featuredRiderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  featuredRiderName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  riderRatingLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riderRatingText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  featuredRiderDistance: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  featuredRiderDeliveries: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  featuredRiderSpecialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  specialtyTag: {
    color: '#1DA1F2',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  featuredRiderActivity: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Trending person styles
  trendingPersonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  trendingPersonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingPersonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
  trendingPersonInfo: {
    flex: 1,
  },
  trendingPersonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  trendingPersonUsername: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  trendingPersonFollowers: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 2,
  },
  trendingPersonLocation: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginBottom: 2,
  },
  trendingPersonActivity: {
    color: '#1DA1F2',
    fontSize: 11,
    fontWeight: '500',
  },
  // Error handling styles
  errorContainer: {
    backgroundColor: 'rgba(231,76,60,0.1)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // New trending styles
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendingGrowth: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },

  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  filterSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
  },
  filterOptions: {
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  priceOptions: {
    gap: 8,
  },
  priceOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  priceOptionActive: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: '#3498DB',
  },
  priceOptionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  priceOptionTextActive: {
    color: '#3498DB',
    fontWeight: '600',
  },
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  sortOptionActive: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: '#3498DB',
  },
  sortOptionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#3498DB',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#3498DB',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchScreen;