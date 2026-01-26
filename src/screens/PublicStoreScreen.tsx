import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  FlatList,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, UserStats } from '../services/userAPI';
import { productsAPI, Product } from '../services/productsAPI';
import { servicesAPI, VideoFeedItem } from '../services/servicesAPI';
import { fileUploadService } from '../services/fileUploadService';
import * as ImagePicker from 'expo-image-picker';
import ProductCard from '../components/ProductCard';
import VideoCard from '../components/VideoCard';
import { GridMediaCard } from '../components/GridMediaCard';
import { GridCardActionModal } from '../components/GridCardActionModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UserProfile {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
  dateOfBirth?: string;
  isSeller: boolean;
  isRider?: boolean;
  bgPicUrl?: string; // Use bgPicUrl to match API response
  backgroundImageUrl?: string; // Keep for backward compatibility
  createdAt: string;
  updatedAt: string;
}

interface PublicStoreScreenProps {
  navigation: any;
  route: {
    params: {
      userId: string;
      profile?: UserProfile;
      isOwnStore?: boolean;
    };
  };
}

export const PublicStoreScreen: React.FC<PublicStoreScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { userId, profile: initialProfile, isOwnStore = false } = route.params;
  // Normalize initial profile: ensure bgPicUrl is available as backgroundImageUrl for compatibility
  const normalizedInitialProfile = initialProfile ? {
    ...initialProfile,
    backgroundImageUrl: initialProfile.bgPicUrl || initialProfile.backgroundImageUrl,
    bgPicUrl: initialProfile.bgPicUrl || initialProfile.backgroundImageUrl,
  } : null;
  const [profile, setProfile] = useState<UserProfile | null>(normalizedInitialProfile as UserProfile | null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(!initialProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('services');
  const [isPlugged, setIsPlugged] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<VideoFeedItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
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

  // Action modal state
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ id: string; type: 'product' | 'service' } | null>(null);

  // Animation values
  const springAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!profile) {
      loadProfile();
    }
    loadUserStats();
    loadUserContent();
  }, []);

  useEffect(() => {
    if (profile?.isSeller && !profile?.isRider) {
      setActiveTab('products');
    } else {
      setActiveTab('services');
    }
  }, [profile]);

  useEffect(() => {
    loadUserContent();
  }, [activeTab]);

  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getPublicProfile(userId);
      // Normalize profile data: ensure bgPicUrl is available as backgroundImageUrl for compatibility
      const normalizedProfile = {
        ...profileData,
        backgroundImageUrl: profileData.bgPicUrl || (profileData as any).backgroundImageUrl,
        bgPicUrl: profileData.bgPicUrl || (profileData as any).backgroundImageUrl,
      };
      setProfile(normalizedProfile as UserProfile);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert(
        'Profile Error',
        'Could not load this profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const userStats = await userAPI.getStats();
      // Map the stats from userAPI and add defaults for missing fields
      setStats({
        plugsCount: userStats.plugsCount || 0,
        clientsCount: userStats.clientsCount || 0,
        connectionRequestsCount: userStats.connectionRequestsCount || 0,
        totalOrders: 0, // TODO: Implement from orders API
        totalRevenue: 0, // TODO: Implement from orders/wallet API
        averageRating: 0, // TODO: Implement from reviews API
        totalReviews: 0 // TODO: Implement from reviews API
      });
    } catch (error: any) {
      console.error('Error loading user stats:', error);
      // Don't show error for stats, just use defaults
      setStats({
        plugsCount: 0,
        clientsCount: 0,
        connectionRequestsCount: 0,
        totalOrders: 0,
        totalRevenue: 0,
        averageRating: 0,
        totalReviews: 0
      });
    }
  };

  const loadUserContent = async () => {
    // Load products if user is a seller and products tab is active
    if (activeTab === 'products') {
      setProductsLoading(true);
      try {
        const allProducts = await productsAPI.getProducts();
        const userProducts = allProducts.filter(p => p.user_id === userId);
        setProducts(userProducts);
      } catch (error) {
        console.error('Error loading user products:', error);
        setProducts([]);
      } finally {
        setProductsLoading(false);
      }
    }

    // Load services/videos if services tab is active
    if (activeTab === 'services') {
      setServicesLoading(true);
      try {
        const allServices = await servicesAPI.getVideoFeed();
        console.log('🎥 All services loaded:', allServices.length);
        console.log('🎥 Looking for userId:', userId);
        const userServices = allServices.filter(s => s.userId === userId);
        console.log('🎥 User services found:', userServices.length);
        console.log('🎥 First service sample:', allServices[0]?.userId, 'vs', userId);
        setServices(userServices);
      } catch (error) {
        console.error('Error loading user services:', error);
        setServices([]);
      } finally {
        setServicesLoading(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
    loadUserStats();
    loadUserContent();
  };

  const handlePlugToggle = () => {
    setIsPlugged(!isPlugged);
    // Here you would typically make an API call to follow/unfollow
  };

  const handleButtonPress = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(springAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(springAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const handleImagePicker = async (type: 'avatar' | 'background') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;

        if (type === 'avatar') {
          setUploadingAvatar(true);
        } else {
          setUploadingBackground(true);
        }

        const uploadedUrl = await fileUploadService.uploadImage(imageUri, `${type}s`);

        if (type === 'avatar') {
          await userAPI.updateProfile({ avatarUrl: uploadedUrl });
          setProfile(prev => prev ? { ...prev, avatarUrl: uploadedUrl } : null);
        } else {
          await userAPI.updateProfile({ bgPicUrl: uploadedUrl });
          setProfile(prev => prev ? { ...prev, bgPicUrl: uploadedUrl, backgroundImageUrl: uploadedUrl } : null);
        }

        Alert.alert('Success', `${type === 'avatar' ? 'Profile picture' : 'Background image'} updated successfully!`);
      }
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
      Alert.alert('Error', `Failed to update ${type === 'avatar' ? 'profile picture' : 'background image'}`);
    } finally {
      if (type === 'avatar') {
        setUploadingAvatar(false);
      } else {
        setUploadingBackground(false);
      }
      setIsUploadModalVisible(false);
    }
  };

  const handleNavigateToConnections = (type: 'plugs' | 'clients') => {
    const title = type === 'plugs' ? 'Plugs' : 'Clients';
    navigation.navigate('ConnectionsList', {
      type,
      userId,
      title,
      username: profile?.username || 'Unknown User'
    });
  };

  const handleLongPress = (itemId: string, itemType: 'product' | 'service') => {
    setSelectedItem({ id: itemId, type: itemType });
    setIsActionModalVisible(true);
  };

  const handleViewItem = () => {
    if (!selectedItem) return;

    setIsActionModalVisible(false);

    if (selectedItem.type === 'product') {
      navigation.navigate('ProductDetails', { productId: selectedItem.id });
    } else {
      navigation.navigate('ServiceDetails', { serviceId: selectedItem.id });
    }

    setSelectedItem(null);
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;

    // Close modal first
    setIsActionModalVisible(false);

    // Show confirmation alert
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete this ${selectedItem.type}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setSelectedItem(null),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (selectedItem.type === 'product') {
                await productsAPI.deleteProduct(selectedItem.id);
                // Remove from local state - flexbox will auto-rearrange
                setProducts(prev => prev.filter(p => p.id !== selectedItem.id));
                // Small delay to ensure UI updates before showing success message
                setTimeout(() => {
                  Alert.alert('Success', 'Product deleted successfully');
                }, 100);
              } else {
                await servicesAPI.deleteService(selectedItem.id);
                // Remove from local state - flexbox will auto-rearrange
                setServices(prev => prev.filter(s => s.id !== selectedItem.id));
                // Small delay to ensure UI updates before showing success message
                setTimeout(() => {
                  Alert.alert('Success', 'Service deleted successfully');
                }, 100);
              }
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', `Failed to delete ${selectedItem.type}. Please try again.`);
            } finally {
              setSelectedItem(null);
            }
          },
        },
      ]
    );
  };

  const getUserRole = () => {
    if (profile?.isRider && profile?.isSeller) return 'Vendor & Rider';
    if (profile?.isRider) return 'Rider';
    if (profile?.isSeller) return 'Vendor';
    return 'User';
  };

  const getPlugsCount = () => stats?.plugsCount || 0;
  const getClientsCount = () => stats?.clientsCount || 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading store...</Text>
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
          <Text style={styles.whatsappHeaderTitle}>Contact Info</Text>
        </View>

        <ScrollView style={styles.whatsappContent}>
          {/* Avatar Section */}
          <View style={styles.whatsappAvatarSection}>
            {profile?.avatarUrl ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => openImageViewer(profile.avatarUrl)}>
                <Image source={{ uri: profile.avatarUrl }} style={styles.whatsappAvatar} />
              </TouchableOpacity>
            ) : (
              <View style={styles.whatsappDefaultAvatar}>
                <Ionicons name="person" size={60} color="#B0B0B0" />
              </View>
            )}
            <Text style={styles.whatsappName}>
              {profile?.username || 'User'}
            </Text>
            <Text style={styles.whatsappPhone}>
              {profile?.phone || 'Phone not available'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.whatsappActions}>
            <TouchableOpacity style={styles.whatsappActionButton}>
              <Ionicons name="call" size={24} color="#FFFFFF" />
              <Text style={styles.whatsappActionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.whatsappActionButton}>
              <Ionicons name="videocam" size={24} color="#FFFFFF" />
              <Text style={styles.whatsappActionText}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.whatsappActionButton}>
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
        {renderImageViewer()}
      </SafeAreaView>
    );
  }

  // For vendors/riders, show the current sophisticated profile design
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
            {(profile?.bgPicUrl || profile?.backgroundImageUrl) ? (
              <TouchableOpacity activeOpacity={0.95} onPress={() => openImageViewer(profile?.bgPicUrl || profile?.backgroundImageUrl)}>
                <Image 
                  source={{ uri: profile?.bgPicUrl || profile?.backgroundImageUrl }} 
                  style={styles.backgroundImage}
                  blurRadius={0.5}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.defaultBackground} />
            )}
            <View style={styles.heroOverlay} pointerEvents="none" />

            {/* Background Upload Button - Only for own store */}
            {isOwnStore && (
              <TouchableOpacity
                style={styles.backgroundUploadButton}
                onPress={() => handleImagePicker('background')}
                disabled={uploadingBackground}
              >
                {uploadingBackground ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={20} color="white" />
                )}
              </TouchableOpacity>
            )}
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
              {isOwnStore ? 'My Store' : `${profile?.username || 'Store'}`}
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
                  {profile?.username || 'Store'}
                </Text>
                {profile?.bio && (
                  <Text style={styles.bioText} numberOfLines={3} ellipsizeMode="tail">
                    {profile.bio}
                  </Text>
                )}
                <Text style={styles.locationText}>
                  📍 {profile?.location || 'Location not set'}
                </Text>
                {/* Vendor badge beneath biodata */}
                <View style={[styles.roleIndicator, !isOwnStore && styles.roleIndicatorCompact]}>
                  <Text style={styles.roleText}>{getUserRole()}</Text>
                </View>
              </View>
            </View>

            {/* Social Stats & Plug Button */}
            <View style={styles.socialStats}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => handleNavigateToConnections('plugs')}
                activeOpacity={0.7}
              >
                <Text style={styles.statNumber}>{getPlugsCount()}</Text>
                <Text style={styles.statLabel}>Plugs</Text>
              </TouchableOpacity>

              {!isOwnStore && (
                <TouchableOpacity
                  style={[styles.plugButton, isPlugged && styles.pluggedButton]}
                  onPress={handlePlugToggle}
                >
                  <Text style={[styles.plugButtonText, isPlugged && styles.pluggedButtonText]}>
                    {isPlugged ? 'Plugged' : 'Plug'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.statItem}
                onPress={() => handleNavigateToConnections('clients')}
                activeOpacity={0.7}
              >
                <Text style={styles.statNumber}>{getClientsCount()}</Text>
                <Text style={styles.statLabel}>Clients</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Content Tabs */}
        <View style={styles.tabsContainer}>
          {profile?.isSeller && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'products' && styles.activeTab]}
              onPress={() => setActiveTab('products')}
            >
              <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
                Products
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.tab, activeTab === 'services' && styles.activeTab]}
            onPress={() => setActiveTab('services')}
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
              <View style={styles.productsGrid}>
                {products.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <GridMediaCard
                      imageUrl={item.primary_image_url || 'https://via.placeholder.com/300x300/333/fff?text=No+Image'}
                      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      onLongPress={() => handleLongPress(item.id, 'product')}
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
                  {isOwnStore ? 'Start adding your products to reach more customers' :
                   `${profile?.username || 'This store'} hasn't added any products yet`}
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
                      imageUrl={item.thumbnailUrl || item.videoUrl || 'https://via.placeholder.com/300x300/333/fff?text=No+Video'}
                      onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
                      onLongPress={() => handleLongPress(item.id, 'service')}
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
                  {isOwnStore ? 
                    (profile?.isRider ? 'Share videos of your services to attract more clients' :
                     'Showcase your services to grow your business') :
                    `${profile?.username || 'This store'} hasn't added any ${activeTab} yet`}
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Upload Floating Action Button - Only for own store */}
      {isOwnStore && (profile?.isSeller || profile?.isRider) && (
        <TouchableOpacity
          style={styles.uploadFAB}
          onPress={() => handleButtonPress(() => setIsUploadModalVisible(true))}
        >
          <Animated.View style={[styles.uploadIcon, { transform: [{ scale: springAnim }] }]}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Floating Chat Button (only when viewing others) */}
      {!isOwnStore && (
        <TouchableOpacity style={styles.floatingChatButton}>
          <Ionicons name="chatbubble" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Upload Modal - Only for own store */}
      {isOwnStore && (
        <Modal transparent visible={isUploadModalVisible} animationType="fade" onRequestClose={() => setIsUploadModalVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsUploadModalVisible(false)}>
            <Animated.View style={[styles.uploadModalContent, { transform: [{ scale: springAnim }] }]}>
              <Text style={styles.uploadModalTitle}>Upload Content</Text>

              {profile?.isSeller && (
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={() => {
                    setIsUploadModalVisible(false);
                    navigation.navigate('ProductUpload');
                  }}
                >
                  <Ionicons name="cube-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.uploadOptionText}>Upload Product</Text>
                </TouchableOpacity>
              )}

              {(profile?.isSeller || profile?.isRider) && (
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={() => {
                    setIsUploadModalVisible(false);
                    navigation.navigate('ServiceUpload');
                  }}
                >
                  <Ionicons name={profile?.isRider ? "videocam-outline" : "construct-outline"} size={24} color="#FFFFFF" />
                  <Text style={styles.uploadOptionText}>
                    {profile?.isRider ? 'Upload Video' : 'Upload Service'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.uploadModalCancelButton}
                onPress={() => setIsUploadModalVisible(false)}
              >
                <Text style={styles.uploadModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Action Modal for Grid Card Options */}
      <GridCardActionModal
        visible={isActionModalVisible}
        onClose={() => {
          setIsActionModalVisible(false);
          setSelectedItem(null);
        }}
        onView={handleViewItem}
        onDelete={handleDeleteItem}
        itemType={selectedItem?.type || 'product'}
      />
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

  // Store Style Components (existing sophisticated design)
  heroSection: {
    height: 400,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
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
    zIndex: 0,
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
    position: 'relative',
    zIndex: 2,
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
    zIndex: 2,
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
  roleIndicatorCompact: {
    alignSelf: 'flex-start', // Ensure it only takes needed width when viewing others
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
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4, // Space between items
  },
  gridItem: {
    width: (SCREEN_WIDTH - 48) / 3, // 3 items per row with padding and gap
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  servicesScroll: {
    paddingHorizontal: 20,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 4, // Space between items
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
  avatarWrapper: {
    position: 'relative',
  },
  backgroundUploadButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  avatarUploadButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  uploadFAB: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
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
  uploadIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  uploadModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#333',
    borderRadius: 12,
    marginBottom: 12,
  },
  uploadOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '500',
  },
  uploadModalCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  uploadModalCancelText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
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