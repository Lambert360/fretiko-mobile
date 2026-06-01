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
  Dimensions,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, UserStats } from '../services/userAPI';
import { productsAPI, Product } from '../services/productsAPI';
import { servicesAPI, VideoFeedItem, Service } from '../services/servicesAPI';
import { postsAPI, Post } from '../services/postsAPI';
import { chatAPI } from '../services/chatAPI';
import ProductCard from '../components/ProductCard';
import VideoCard from '../components/VideoCard';
import { GridMediaCard } from '../components/GridMediaCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [activeTab, setActiveTab] = useState<'posts' | 'products' | 'services'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const openImageViewer = (url?: string | null) => {
    if (!url) return;
    setSelectedImageUrl(url);
    setImageViewerVisible(true);
  };

  const renderImageViewer = () => (
    <Modal
      visible={imageViewerVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setImageViewerVisible(false)}
    >
      <View style={styles.imageViewerOverlay}>
        <TouchableOpacity
          style={styles.imageViewerCloseButton}
          onPress={() => setImageViewerVisible(false)}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {selectedImageUrl && (
          <Image
            source={{ uri: selectedImageUrl }}
            style={styles.imageViewerImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );
  

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useEffect(() => {
    setActiveTab('posts');
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
    // Load posts for all user types
    if (activeTab === 'posts') {
      setPostsLoading(true);
      try {
        const userPosts = await postsAPI.getPostsByUser(userId);
        setPosts(userPosts);
      } catch (error) {
        console.error('Error loading user posts:', error);
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    }

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
      // Determine chat type based on BOTH users' roles
      // Priority: rider > vendor > friend
      // Check if either the current user OR target user is a rider/vendor
      let chatType: 'friend' | 'vendor' | 'rider' = 'friend';

      // Check if either user is a rider (highest priority)
      if (user.is_rider || profile.isRider) {
        chatType = 'rider';
      }
      // Check if either user is a seller/vendor
      else if (user.is_seller || profile.isSeller) {
        chatType = 'vendor';
      }
      // Otherwise, both are regular users (citizens)
      else {
        chatType = 'friend';
      }

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
        chatType: chatType,
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

  const handleTabPress = (tab: 'posts' | 'products' | 'services') => {
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
              <TouchableOpacity activeOpacity={0.95} onPress={() => openImageViewer(profile.bgPicUrl)}>
                <Image 
                  source={{ uri: profile.bgPicUrl }} 
                  style={styles.backgroundImage}
                  blurRadius={0.5}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.defaultBackground} />
            )}
            <View style={styles.heroOverlay} pointerEvents="none" />
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
            {/* Horizontal Layout: Avatar on left, Info on right */}
            <View style={styles.userInfoRow}>
              {/* Avatar on left */}
              <View style={styles.avatarContainerLeft}>
                <View style={styles.avatarWrapper}>
                  {profile?.avatarUrl ? (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => openImageViewer(profile.avatarUrl)}>
                      <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.defaultAvatar}>
                      <Text style={styles.avatarInitials}>
                        {profile?.username?.[0]?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Name, Bio, Location on right */}
              <View style={styles.userDetailsRight}>
                <Text style={styles.displayName}>
                  {profile?.username || 'User'}
                </Text>
                {profile?.bio && (
                  <Text style={styles.bioText} numberOfLines={3} ellipsizeMode="tail">
                    {profile.bio}
                  </Text>
                )}
                <Text style={styles.locationText}>
                  📍 {profile?.location || 'Location not set'}
                </Text>
                {/* Role indicator beneath biodata */}
                <View style={styles.roleIndicator}>
                  <Text style={styles.roleText}>{getUserRole()}</Text>
                </View>
              </View>
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
          {/* Posts — visible for ALL users */}
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => handleTabPress('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
              Posts
            </Text>
          </TouchableOpacity>

          {/* Services — visible for vendors and riders */}
          {(profile?.isSeller || profile?.isRider) && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'services' && styles.activeTab]}
              onPress={() => handleTabPress('services')}
            >
              <Text style={[styles.tabText, activeTab === 'services' && styles.activeTabText]}>
                {profile?.isRider ? 'Videos' : 'Services'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Products — visible for vendors only (not riders) */}
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
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {activeTab === 'posts' ? (
            postsLoading ? (
              <View style={styles.loadingContentContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingContentText}>Loading posts...</Text>
              </View>
            ) : posts.length > 0 ? (
              <View style={styles.postsGrid}>
                {posts.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    {item.mediaType === 'text' || !item.mediaUrls || item.mediaUrls.length === 0 ? (
                      <TouchableOpacity
                        style={styles.textPostCard}
                        onPress={() => navigation.navigate('PostDetails', { postId: item.id })}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="document-text-outline" size={28} color="#B0B0B0" />
                        <Text style={styles.textPostPreview} numberOfLines={3}>
                          {item.content || ''}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <GridMediaCard
                        imageUrl={item.processedMediaUrls?.[0] || item.mediaUrls[0]}
                        onPress={() => navigation.navigate('PostDetails', { postId: item.id })}
                        onLongPress={() => {}}
                        isVideo={item.mediaType === 'video' || item.mediaType === 'mixed'}
                      />
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContentContainer}>
                <Text style={styles.emptyContentIcon}>📝</Text>
                <Text style={styles.emptyContentTitle}>No Posts Yet</Text>
                <Text style={styles.emptyContentText}>
                  {profile?.username || 'This user'} hasn't posted anything yet
                </Text>
              </View>
            )
          ) : activeTab === 'products' ? (
            productsLoading ? (
              <View style={styles.loadingContentContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingContentText}>Loading products...</Text>
              </View>
            ) : products.length > 0 ? (
              <View style={styles.productsGrid}>
                {products.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <GridMediaCard
                      imageUrl={item.images && item.images.length > 0 ? item.images[0] : 'https://via.placeholder.com/300x300/333/fff?text=No+Image'}
                      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      onLongPress={() => {}}
                      isVideo={false}
                    />
                  </View>
                ))}
              </View>
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
              <View style={styles.servicesGrid}>
                {services.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <GridMediaCard
                      imageUrl={
                        (item.images && item.images.length > 0 ? item.images[0] : undefined) ||
                        (item.videos && item.videos.length > 0 ? item.videos[0] : undefined) ||
                        'https://via.placeholder.com/300x300/333/fff?text=No+Video'
                      }
                      onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
                      onLongPress={() => {}}
                      isVideo={true}
                    />
                  </View>
                ))}
              </View>
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
      {renderImageViewer()}
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
  
  // Hero / Social Media Profile Style Components
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

  // Fullscreen image viewer
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '80%',
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
    paddingTop: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
  },
  avatarContainerLeft: {
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
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
    alignSelf: 'flex-start', // Don't span full width
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
  userDetailsRight: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bioText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'left',
    marginBottom: 6,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#E0E0E0',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4,
  },
  textPostCard: {
    width: (SCREEN_WIDTH - 48) / 3,
    height: (SCREEN_WIDTH - 48) / 3,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textPostPreview: {
    color: '#B0B0B0',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 48) / 3, // 3 items per row with padding and gap
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4, // Space between items
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