import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  RefreshControl,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, UserStats } from '../services/userAPI';
import { productsAPI, Product } from '../services/productsAPI';
import { servicesAPI, VideoFeedItem, Service } from '../services/servicesAPI';
import { chatAPI } from '../services/chatAPI';
import ProductCard from '../components/ProductCard';
import VideoCard from '../components/VideoCard';

interface UserProfile {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  bgPicUrl?: string;
  location?: string;
  isSeller: boolean;
  isRider?: boolean;
  createdAt: string;
}

interface PublicProfileScreenProps {
  navigation: any;
  route: {
    params: {
      userId: string;
      username?: string;
    };
  };
}

const PublicProfileScreen = ({ navigation, route }: PublicProfileScreenProps) => {
  const { user } = useAuth();
  const { userId } = route.params;

  // Debug logging to track the userId parameter
  console.log('🔍 PublicProfileScreen received userId:', userId);
  console.log('🔍 Route params:', route.params);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted' | 'blocked'>('none');
  const [connectionId, setConnectionId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('services');
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useEffect(() => {
    if (profile?.isSeller && !profile?.isRider) {
      setActiveTab('products');
    } else {
      setActiveTab('services');
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      loadUserContent();
      loadConnectionStatus();
    }
  }, [activeTab, profile]);

  const loadConnectionStatus = async () => {
    try {
      const status = await userAPI.getConnectionStatus(userId);
      setConnectionStatus(status.status as 'none' | 'pending' | 'accepted' | 'blocked');
      setConnectionId(status.connectionId);
    } catch (error) {
      console.error('Error loading connection status:', error);
      setConnectionStatus('none');
    }
  };

  const loadProfile = async () => {
    if (!userId || userId === 'undefined') {
      console.error('❌ Invalid userId provided to PublicProfileScreen:', userId);
      Alert.alert('Error', 'Invalid user profile requested');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('📞 Loading profile for userId:', userId);
      // Load profile and stats in parallel
      const [profileData, statsData] = await Promise.all([
        userAPI.getPublicProfile(userId),
        userAPI.getPublicStats(userId)
      ]);

      console.log('✅ Profile loaded successfully:', profileData.username);
      setProfile(profileData as UserProfile);
      setStats(statsData);

    } catch (error: any) {
      console.error('❌ Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserContent = async () => {
    // Load products if user is a seller
    if (activeTab === 'products') {
      setProductsLoading(true);
      try {
        const userProducts = await productsAPI.getUserProducts(userId);
        setProducts(userProducts);
      } catch (error) {
        console.error('Error loading user products:', error);
        setProducts([]); // Set empty array on error
      } finally {
        setProductsLoading(false);
      }
    }

    // Load services/videos
    if (activeTab === 'services') {
      setServicesLoading(true);
      try {
        const userServices = await servicesAPI.getUserServices(userId);
        console.log('📋 Loaded services for user:', userServices.length);
        setServices(userServices);
      } catch (error) {
        console.error('Error loading user services:', error);
        setServices([]); // Set empty array on error
      } finally {
        setServicesLoading(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
    // loadUserContent will be called automatically when profile loads due to useEffect
  };

  const handleConnect = async () => {
    try {
      if (connectionStatus === 'none') {
        // Send connection request
        const newConnection = await userAPI.sendConnectionRequest(userId);
        setConnectionStatus('pending');
        setConnectionId(newConnection.id);
        Alert.alert('Success', 'Connection request sent!');
      } else if (connectionStatus === 'pending') {
        // Cancel connection request
        if (connectionId) {
          await userAPI.deleteConnection(connectionId);
          setConnectionStatus('none');
          setConnectionId(undefined);
          Alert.alert('Success', 'Connection request cancelled!');
        }
      } else if (connectionStatus === 'accepted') {
        // Disconnect/Unplug
        if (connectionId) {
          Alert.alert(
            'Disconnect',
            'Are you sure you want to unplug from this user?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unplug',
                style: 'destructive',
                onPress: async () => {
                  await userAPI.deleteConnection(connectionId);
                  setConnectionStatus('none');
                  setConnectionId(undefined);
                  Alert.alert('Success', 'Successfully unplugged!');
                }
              }
            ]
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update connection');
    }
  };

  const handleChatWithUser = async () => {
    if (!profile || !user) return;

    try {
      // Determine chat type based on user role
      // If they're a seller/vendor, use 'vendor' type to match bargain conversations
      // Otherwise use 'friend' for regular users
      const chatType = profile.isSeller ? 'vendor' : 'friend';

      // Find existing conversation or create a new one with the user
      const conversation = await chatAPI.findOrCreateConversation(
        [userId], // The profile user's ID
        chatType
      );

      // Navigate to IndividualChatScreen with proper parameters
      navigation.navigate('IndividualChatScreen', {
        chatId: conversation.id,
        chatName: profile.username || 'User', // Use username as chat name
        chatAvatar: profile.avatarUrl || 'https://via.placeholder.com/50', // Use user avatar
        chatType: chatType as const,
        isOnline: true, // Assume online for now
        verified: false, // Set based on user verification status if available
        isAI: false,
        otherUserId: userId,
      });
    } catch (error) {
      console.error('Error creating conversation with user:', error);
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
    }
  };

  const handleTabPress = (tab: 'products' | 'services') => {
    setActiveTab(tab);
    // Content will be loaded automatically by useEffect when activeTab changes
  };

  const getUserRole = () => {
    if (profile?.isRider && profile?.isSeller) return 'Vendor & Rider';
    if (profile?.isRider) return 'Rider';
    if (profile?.isSeller) return 'Vendor';
    return 'Citizen';
  };

  const getPlugsCount = () => stats?.plugsCount || 0;
  const getClientsCount = () => stats?.clientsCount || 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRegularUser = !profile?.isSeller && !profile?.isRider;

  // If viewing a regular user, show WhatsApp-style interface
  if (isRegularUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.whatsappHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.whatsappHeaderTitle}>Profile</Text>
        </View>

        <ScrollView style={styles.whatsappContent}>
          {/* Avatar Section */}
          <View style={styles.whatsappAvatarSection}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.whatsappAvatar} />
            ) : (
              <View style={styles.whatsappDefaultAvatar}>
                <Ionicons name="person" size={60} color="#B0B0B0" />
              </View>
            )}
            <Text style={styles.whatsappName}>
              {profile?.username || 'User'}
            </Text>
            <Text style={styles.whatsappPhone}>
              Citizen
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.whatsappActions}>
            <TouchableOpacity
              style={[
                styles.whatsappActionButton,
                connectionStatus === 'accepted' && { backgroundColor: '#27AE60' },
                connectionStatus === 'pending' && { backgroundColor: '#FFA500' },
                connectionStatus === 'blocked' && { backgroundColor: '#666', opacity: 0.5 }
              ]}
              onPress={handleConnect}
              disabled={connectionStatus === 'blocked'}
            >
              <Ionicons
                name={
                  connectionStatus === 'accepted' ? "checkmark-circle" :
                  connectionStatus === 'pending' ? "time" :
                  connectionStatus === 'blocked' ? "ban" : "person-add"
                }
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.whatsappActionText}>
                {connectionStatus === 'accepted' ? 'Plugged' :
                 connectionStatus === 'pending' ? 'Pending' :
                 connectionStatus === 'blocked' ? 'Blocked' : 'Plug'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.whatsappActionButton} onPress={handleChatWithUser}>
              <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
              <Text style={styles.whatsappActionText}>Chat</Text>
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.whatsappInfoSection}>
            <Text style={styles.whatsappSectionTitle}>About</Text>
            <Text style={styles.whatsappBio}>
              {profile?.bio || 'No bio available'}
            </Text>
            
            <Text style={styles.whatsappSectionTitle}>Location</Text>
            <Text style={styles.whatsappInfo}>
              📍 {profile?.location || 'Not specified'}
            </Text>

            <Text style={styles.whatsappSectionTitle}>Member Since</Text>
            <Text style={styles.whatsappInfo}>
              📅 {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : 'Unknown'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // For vendors/riders, show sophisticated social media profile design
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero Section with Background */}
        <View style={styles.heroSection}>
          <View style={styles.heroBackground}>
            {profile?.bgPicUrl ? (
              <Image 
                source={{ uri: profile.bgPicUrl }} 
                style={styles.backgroundImage}
                blurRadius={0.5}
              />
            ) : (
              <View style={styles.defaultBackground} />
            )}
            <View style={styles.heroOverlay} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {profile?.username || 'Profile'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* User Info Overlay */}
          <View style={styles.userInfoOverlay}>
            <View style={styles.avatarContainer}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Text style={styles.avatarInitials}>
                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <View style={styles.roleIndicator}>
                <Text style={styles.roleText}>{getUserRole()}</Text>
              </View>
            </View>

            <View style={styles.userDetails}>
              <Text style={styles.displayName}>
                {profile?.username || 'User'}
              </Text>
              {profile?.bio && (
                <Text style={styles.bioText}>{profile.bio}</Text>
              )}
              <Text style={styles.locationText}>
                📍 {profile?.location || 'Location not set'}
              </Text>
            </View>

            {/* Social Stats & Plug Button */}
            <View style={styles.socialStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{getPlugsCount()}</Text>
                <Text style={styles.statLabel}>Plugs</Text>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.plugButton,
                  connectionStatus === 'accepted' && styles.pluggedButton,
                  connectionStatus === 'pending' && styles.pendingButton,
                  connectionStatus === 'blocked' && styles.blockedButton
                ]}
                onPress={handleConnect}
                disabled={connectionStatus === 'blocked'}
              >
                <Text style={[
                  styles.plugButtonText,
                  connectionStatus === 'accepted' && styles.pluggedButtonText,
                  connectionStatus === 'pending' && styles.pendingButtonText,
                  connectionStatus === 'blocked' && styles.blockedButtonText
                ]}>
                  {connectionStatus === 'accepted' ? 'Plugged' :
                   connectionStatus === 'pending' ? 'Pending' :
                   connectionStatus === 'blocked' ? 'Blocked' : 'Plug'}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{getClientsCount()}</Text>
                <Text style={styles.statLabel}>Clients</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content Tabs */}
        <View style={styles.tabsContainer}>
          {profile?.isSeller && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'products' && styles.activeTab]}
              onPress={() => handleTabPress('products')}
            >
              <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
                Products
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.tab, activeTab === 'services' && styles.activeTab]}
            onPress={() => handleTabPress('services')}
          >
            <Text style={[styles.tabText, activeTab === 'services' && styles.activeTabText]}>
              {profile?.isRider ? 'Videos' : 'Services'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {activeTab === 'products' ? (
            productsLoading ? (
              <View style={styles.loadingContentContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingContentText}>Loading products...</Text>
              </View>
            ) : products.length > 0 ? (
              <FlatList
                key="products-list"
                data={products}
                renderItem={({ item }) => (
                  <ProductCard
                    title={item.name}
                    price={item.price}
                    image={item.images && item.images.length > 0 ? { uri: item.images[0] } : { uri: 'https://via.placeholder.com/300x300' }}
                    rating={item.average_rating || 0}
                    sellerName={profile?.username || 'Seller'}
                    sellerLogo={profile?.avatarUrl}
                    onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                  />
                )}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.productRow}
                contentContainerStyle={styles.productsGrid}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyContentContainer}>
                <Text style={styles.emptyContentIcon}>📦</Text>
                <Text style={styles.emptyContentTitle}>No Products Yet</Text>
                <Text style={styles.emptyContentText}>
                  {profile?.username || 'This user'} hasn't added any products yet
                </Text>
              </View>
            )
          ) : (
            servicesLoading ? (
              <View style={styles.loadingContentContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingContentText}>Loading services...</Text>
              </View>
            ) : services.length > 0 ? (
              <FlatList
                key="services-list"
                data={services}
                renderItem={({ item, index }) => {
                  console.log(`🎬 Transforming service ${index}:`, {
                    id: item.id,
                    name: item.name,
                    hasImages: item.images?.length > 0,
                    hasVideos: item.videos?.length > 0,
                    firstImage: item.images?.[0],
                    firstVideo: item.videos?.[0]
                  });

                  // Transform Service to VideoFeedItem format
                  const videoItem: VideoFeedItem = {
                    id: item.id,
                    title: item.name,
                    thumbnail: item.images && item.images.length > 0 ? item.images[0] : undefined,
                    videoUri: item.videos && item.videos.length > 0 ? item.videos[0] : undefined,
                    userId: item.user_id,
                    username: profile?.username || 'user',
                    userAvatar: profile?.avatarUrl || '',
                    description: item.description || '',
                    likes: item.like_count?.toString() || '0',
                    comments: '0',
                    shares: '0',
                    price: item.base_price || 0,
                    originalPrice: undefined,
                    location: item.location || '',
                    serviceProvider: profile?.username || 'Provider',
                    rating: 0,
                    completedJobs: item.booking_count?.toString() || '0',
                    isLiked: false,
                    isBookmarked: false,
                  };

                  console.log(`🎬 Final videoItem ${index}:`, {
                    id: videoItem.id,
                    title: videoItem.title,
                    thumbnail: videoItem.thumbnail,
                    videoUri: videoItem.videoUri,
                    price: videoItem.price
                  });

                  return (
                    <View style={{
                      width: 110,
                      height: 160,
                      backgroundColor: '#333',
                      marginRight: 8,
                      borderRadius: 8,
                      overflow: 'hidden'
                    }}>
                      <VideoCard
                        item={videoItem}
                        isActive={false}
                        isPlaying={false}
                        onVideoTouch={() => {}}
                        onLike={() => {}}
                        onComment={() => {}}
                        onBookmark={() => {}}
                        onShare={() => {}}
                        onBook={() => {}}
                        onVendorPress={() => {}}
                      />
                    </View>
                  );
                }}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.servicesScroll}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyContentContainer}>
                <Text style={styles.emptyContentIcon}>
                  {profile?.isRider ? '🎥' : '🛠️'}
                </Text>
                <Text style={styles.emptyContentTitle}>
                  {profile?.isRider ? 'No Videos Yet' : 'No Services Yet'}
                </Text>
                <Text style={styles.emptyContentText}>
                  {profile?.username || 'This user'} hasn't added any {activeTab} yet
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Floating Chat Button */}
      <TouchableOpacity style={styles.floatingChatButton} onPress={handleChatWithUser}>
        <Ionicons name="chatbubble" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#B0B0B0',
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  
  // WhatsApp Style Components
  whatsappHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  whatsappHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 20,
  },
  whatsappContent: {
    flex: 1,
  },
  whatsappAvatarSection: {
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  whatsappAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  whatsappDefaultAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
  whatsappPhone: {
    fontSize: 16,
    color: '#B0B0B0',
    marginTop: 8,
  },
  whatsappActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  whatsappActionButton: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 80,
  },
  whatsappActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
  },
  whatsappInfoSection: {
    padding: 20,
  },
  whatsappSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 20,
    marginBottom: 10,
  },
  whatsappBio: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  whatsappInfo: {
    fontSize: 16,
    color: '#B0B0B0',
    lineHeight: 24,
  },

  // Store Style Components (modern social media design)
  heroSection: {
    height: 400,
    position: 'relative',
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  defaultBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  roleIndicator: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  userDetails: {
    alignItems: 'center',
    marginBottom: 20,
  },
  displayName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bioText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  socialStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    marginTop: 2,
  },
  plugButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pluggedButton: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  plugButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pluggedButtonText: {
    color: '#007AFF',
  },
  pendingButton: {
    backgroundColor: '#FFA500',
  },
  pendingButtonText: {
    color: '#FFFFFF',
  },
  blockedButton: {
    backgroundColor: '#666',
    opacity: 0.5,
  },
  blockedButtonText: {
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#B0B0B0',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    marginTop: 20,
  },
  loadingContentContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingContentText: {
    color: '#B0B0B0',
    marginTop: 16,
    fontSize: 16,
  },
  emptyContentContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyContentIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyContentTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyContentText: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 24,
  },
  productsGrid: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  productRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  servicesScroll: {
    paddingHorizontal: 20,
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default PublicProfileScreen;