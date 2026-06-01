import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, UserStats } from '../services/userAPI';
import { walletAPI, Wallet, WalletStats } from '../services/walletAPI';
import { ordersAPI, Order } from '../services/ordersAPI';
import { giftAPI, UserGift } from '../services/giftAPI';
import { fileUploadService } from '../services/fileUploadService';
import { productsAPI, Product } from '../services/productsAPI';
import { postsAPI } from '../services/postsAPI';
import { searchAPI, SearchType } from '../services/searchAPI';
import * as ImagePicker from 'expo-image-picker';
import { SafeImage } from '../components/SafeImage';

interface UserProfile {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  bgPicUrl?: string;
  location?: string;
  phone?: string;
  dateOfBirth?: string;
  isSeller: boolean;
  isRider?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProfileScreenProps {
  navigation: any;
}

const ProfileScreen = ({ navigation }: ProfileScreenProps) => {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUserProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [gifts, setGifts] = useState<UserGift[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [postsCount, setPostsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [currentWalletView, setCurrentWalletView] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  
  // For ProfileScreen, this is always the user's own profile
  const isOwnProfile = true;

  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const particleAnims = useRef([...Array(8)].map(() => new Animated.Value(0))).current;
  const springAnim = useRef(new Animated.Value(1)).current;
  
  const screenHeight = Dimensions.get('window').height;
  const topSectionHeight = screenHeight * 0.35;

  // Animated particles and effects
  useEffect(() => {
    const animateParticles = () => {
      particleAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 3000 + index * 500,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    };
    animateParticles();

    // Pulse animation for avatar
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotate animation for user type badge
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Content fade animation
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      const opacity = value <= topSectionHeight ? 1 - (value / topSectionHeight) * 0.8 : 0.2;
      fadeAnim.setValue(Math.max(0.2, opacity));
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY, fadeAnim, topSectionHeight]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Load profile, stats, wallet, orders, gifts, and trending products in parallel
      const [profileData, statsData, walletData, walletStatsData, ordersData, giftsData, featuredData] = await Promise.all([
        userAPI.getProfile(),
        userAPI.getStats(),
        walletAPI.getWallet(),
        walletAPI.getWalletStats(),
        ordersAPI.getMyOrders({ status: ['delivered', 'shipped', 'processing', 'cancelled'] }),
        giftAPI.getUserGifts().catch(() => ({ gifts: [], total_gifts: 0, total_value: 0 })), // Gracefully handle errors
        searchAPI.getFeaturedContent(SearchType.PRODUCTS, undefined, 10).catch(() => ({ products: [] })) // Get featured/trending products
      ]);
      
      setProfile(profileData);
      setStats(statsData);
      setWallet(walletData);
      setWalletStats(walletStatsData);
      // Get latest 10 orders for profile display
      setOrders(ordersData.slice(0, 10));
      // Get latest 10 gifts for profile display
      setGifts(giftsData.gifts.slice(0, 10));
      // Set trending products from featured content
      setTrendingProducts(featuredData.products || []);

      // Load posts count for the current user (used in profile stats)
      try {
        if (profileData?.id) {
          const userPosts = await postsAPI.getPostsByUser(profileData.id);
          setPostsCount(userPosts.length);
        } else {
          setPostsCount(0);
        }
      } catch (postsError) {
        console.error('Error loading posts count:', postsError);
        setPostsCount(0);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      
      // Check if it's a token error
      if (error.message === 'Invalid token') {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please sign out and sign back in.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Sign Out', 
              onPress: () => logout(),
              style: 'destructive'
            }
          ]
        );
      } else {
        Alert.alert(
          'Profile Error',
          'Could not load your profile. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  // Button spring animation
  const handleButtonPress = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(springAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(springAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
    callback();
  };

  const handleAvatarUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploadingAvatar(true);
        const asset = result.assets[0];
        
        console.log('📸 Uploading avatar image...');
        const fileName = `avatar_${user?.id}_${Date.now()}.jpg`;
        const uploadResult = await fileUploadService.uploadFile(asset.uri, fileName, 'image/jpeg');
        
        if (uploadResult.success) {
          console.log('✅ Avatar uploaded:', uploadResult.publicUrl);
          
          // Update profile with new avatar URL
          await userAPI.updateProfile({ avatarUrl: uploadResult.publicUrl });
          
          // Refresh auth context with updated user data
          await refreshUserProfile();
          
          // Reload profile to show updated avatar
          await loadProfile();
          
          Alert.alert('Success', 'Profile picture updated successfully!');
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }
      }
    } catch (error) {
      console.error('❌ Avatar upload failed:', error);
      Alert.alert('Upload Failed', 'Failed to update profile picture. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBackgroundUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera roll permissions to change your background image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploadingBackground(true);
        const asset = result.assets[0];
        
        console.log('🖼️ Uploading background image...');
        const fileName = `background_${user?.id}_${Date.now()}.jpg`;
        const uploadResult = await fileUploadService.uploadFile(asset.uri, fileName, 'image/jpeg');
        
        if (uploadResult.success) {
          console.log('✅ Background uploaded:', uploadResult.publicUrl);
          
          // Update profile with new background URL
          await userAPI.updateProfile({ bgPicUrl: uploadResult.publicUrl });
          
          // Refresh auth context with updated user data
          await refreshUserProfile();
          
          // Reload profile to show updated background
          await loadProfile();
          
          Alert.alert('Success', 'Background image updated successfully!');
        } else {
          throw new Error(uploadResult.error || 'Upload failed');
        }
      }
    } catch (error) {
      console.error('❌ Background upload failed:', error);
      Alert.alert('Upload Failed', 'Failed to update background image. Please try again.');
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => {
            setIsOptionsVisible(false);
            logout();
          }
        },
      ]
    );
  };

  const getUserRole = () => {
    if (profile?.isRider && profile?.isSeller) return 'Vendor & Rider';
    if (profile?.isRider) return 'Rider';
    if (profile?.isSeller) return 'Vendor';
    return 'Citizen';
  };


  const getUserGradient = () => {
    const role = getUserRole();
    switch (role) {
      case 'Vendor':
        return ['#FF6B6B', '#4ECDC4', '#45B7D1'];
      case 'Rider':
        return ['#96CEB4', '#FFEAA7', '#DDA0DD'];
      case 'Citizen':
      default:
        return ['#667eea', '#764ba2', '#f093fb'];
    }
  };

  const formatOrderDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'delivered': 'Delivered',
      'shipped': 'Shipped',
      'out_for_delivery': 'Out for Delivery',
      'processing': 'Processing',
      'confirmed': 'Confirmed',
      'pending': 'Pending',
      'cancelled': 'Canceled'
    };
    return statusMap[status] || status;
  };

  // Helper function to get product image
  const getProductImage = (product: Product): string => {
    if (product.primary_image_url) return product.primary_image_url;
    if (product.images && product.images.length > 0) {
      return Array.isArray(product.images) ? product.images[0] : product.images[0];
    }
    return 'https://via.placeholder.com/150?text=No+Image';
  };

  // Helper function to calculate trend percentage (based on view/like growth)
  const getTrendPercentage = (product: Product): string => {
    // Calculate a simple trend based on engagement metrics
    const engagementScore = (product.view_count || 0) + (product.like_count || 0) * 3;
    if (engagementScore > 100) return '+25%';
    if (engagementScore > 50) return '+15%';
    if (engagementScore > 20) return '+8%';
    return '+5%';
  };

  const walletViews = ['balance', 'rewards', 'activity'];

  const userData = (profile && stats && wallet && walletStats) ? {
    name: `${user?.firstName} ${user?.lastName}`,
    email: user?.email,
    plugs: stats.plugsCount,
    clients: stats.clientsCount,
    posts: postsCount ?? 0,
    connectionRequests: stats.connectionRequestsCount,
    // Real wallet data from API
    fretiBalance: wallet.availableBalance,
    escrowBalance: wallet.escrowBalance,
    pendingWithdrawal: wallet.pendingWithdrawal,
    totalFretiBalance: wallet.availableBalance + wallet.escrowBalance,
    // Local currency equivalent from wallet stats
    localCurrency: walletStats.localCurrencyEquivalent.currency,
    availableLocal: walletStats.localCurrencyEquivalent.available,
    totalLocal: walletStats.localCurrencyEquivalent.total,
    escrowLocal: walletStats.localCurrencyEquivalent.escrow,
    pendingLocal: walletStats.localCurrencyEquivalent.pending,
    // Activity metrics from wallet stats
    recentTransactions: walletStats.recentTransactionCount,
    monthlySpending: walletStats.monthlySpending,
    monthlyDeposits: walletStats.monthlyDeposits,
  } : null;

  const renderFloatingParticles = () => (
    <View style={styles.particleContainer}>
      {particleAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              left: `${(index * 12.5) % 100}%`,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [topSectionHeight, -50],
                  }),
                },
                {
                  scale: anim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0],
                  }),
                },
              ],
              opacity: anim.interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [0, 1, 1, 0],
              }),
            },
          ]}
        />
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.loginTitle, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.loginTitleText}>Loading Profile</Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Dynamic gradient background */}
      <Animated.View style={[styles.gradientBackground, { opacity: 1 }]}>
        <Image source={{ uri: profile?.bgPicUrl || 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=2000&q=80' }} style={styles.backgroundImage} />
        <View style={[styles.gradientOverlay]} />
        <TouchableOpacity
          style={styles.backgroundUploadButton}
          onPress={handleBackgroundUpload}
          disabled={uploadingBackground}
        >
          {uploadingBackground ? (
            <Ionicons name="cloud-upload" size={20} color="rgba(255,255,255,0.8)" />
          ) : (
            <Ionicons name="camera" size={20} color="rgba(255,255,255,0.8)" />
          )}
        </TouchableOpacity>
      </Animated.View>

      {renderFloatingParticles()}

      {/* Top Section */}
      <View style={[styles.topSection, { height: topSectionHeight + insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 10 }]}>
          <TouchableOpacity
            onPress={() => handleButtonPress(() => navigation.goBack())}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            onPress={() => handleButtonPress(() => setIsOptionsVisible(true))}
            style={styles.headerButton}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Enhanced Bio Section */}
        {userData && (
          <Animated.View style={[styles.bioSection, { transform: [{ scale: springAnim }] }]}>
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
                <Image
                  source={{ uri: profile?.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face' }}
                  style={styles.avatar}
                />
                <View style={styles.avatarBorder} />
                <TouchableOpacity
                  style={styles.avatarUploadButton}
                  onPress={handleAvatarUpload}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Ionicons name="cloud-upload" size={16} color="#FFFFFF" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>

            <View style={styles.bioInfo}>
              <View style={styles.userNameContainer}>
                <Text style={styles.userName}>{userData.name}</Text>
                <Animated.View
                  style={[
                    styles.userTypeIcon,
                    {
                      transform: [
                        {
                          rotate: rotateAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Ionicons
                    name={getUserRole() === 'Vendor' ? 'storefront' : getUserRole() === 'Rider' ? 'bicycle' : 'person'}
                    size={14}
                    color="#FFFFFF"
                  />
                </Animated.View>
              </View>

              <Text style={styles.userEmail}>@{profile?.username}</Text>

              {/* Enhanced Stats - Clickable because this is YOUR profile */}
              <View style={styles.statsGrid}>
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => profile && navigation.navigate('ConnectionsList', { 
                    type: 'plugs', 
                    userId: profile.id,
                    title: 'My Plugs'
                  })}
                >
                  <Text style={styles.statNumber}>{userData.plugs}</Text>
                  <Text style={styles.statLabel}>Plugs</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => navigation.navigate('MyPosts')}
                >
                  <Text style={styles.statNumber}>{userData.posts}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </TouchableOpacity>

                {userData.clients !== undefined && (
                  <TouchableOpacity 
                    style={styles.statItem}
                    onPress={() => profile && navigation.navigate('ConnectionsList', { 
                      type: 'clients', 
                      userId: profile.id,
                      title: 'My Clients'
                    })}
                  >
                    <Text style={styles.statNumber}>{userData.clients}</Text>
                    <Text style={styles.statLabel}>Clients</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Buttons */}
              {!isOwnProfile && (profile?.isSeller || profile?.isRider) && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.connectButton]}
                    onPress={() => handleButtonPress(() => alert('Chat initiated!'))}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Connect</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.plugButton]}
                    onPress={() => handleButtonPress(() => alert('Plugged!'))}
                  >
                    <Ionicons name="person-add" size={16} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Plug</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={[styles.scrollContainer, { marginTop: topSectionHeight + insets.top }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {userData && (
          <>
            {/* Enhanced Wallet Section */}
            <Animated.View style={[styles.modernCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Wallet</Text>
                <TouchableOpacity 
                  style={styles.viewFullWalletButton}
                  onPress={() => navigation.navigate('Wallet')}
                >
                  <Text style={styles.viewFullWalletText}>View Full</Text>
                  <Ionicons name="chevron-forward" size={14} color="#F39C12" />
                </TouchableOpacity>
              </View>

              <View style={styles.walletContent}>
                <View style={styles.balanceGrid}>
                  <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={styles.fretiAmount}>{walletAPI.formatFreti(userData.fretiBalance)}</Text>
                    <Text style={styles.localAmount}>{walletAPI.formatCurrency(userData.availableLocal, userData.localCurrency)}</Text>
                  </View>
                  <View style={styles.rewardsCard}>
                    <Text style={styles.balanceLabel}>Total Balance</Text>
                    <Text style={styles.fretiAmount}>{walletAPI.formatFreti(userData.totalFretiBalance)}</Text>
                    <Text style={styles.localAmount}>{walletAPI.formatCurrency(userData.totalLocal, userData.localCurrency)}</Text>
                    <View style={styles.rewardsBadge}>
                      <Text style={styles.rewardsText}>{userData.recentTransactions}</Text>
                    </View>
                  </View>
                </View>
                
                {/* Show escrow and pending if they exist */}
                {(userData.escrowBalance > 0 || userData.pendingWithdrawal > 0) && (
                  <View style={styles.additionalBalances}>
                    {userData.escrowBalance > 0 && (
                      <View style={styles.escrowCard}>
                        <Text style={styles.escrowLabel}>In Escrow</Text>
                        <Text style={styles.escrowAmount}>{walletAPI.formatFreti(userData.escrowBalance)}</Text>
                        <Text style={styles.escrowLocal}>{walletAPI.formatCurrency(userData.escrowLocal, userData.localCurrency)}</Text>
                      </View>
                    )}
                    {userData.pendingWithdrawal > 0 && (
                      <View style={styles.pendingCard}>
                        <Text style={styles.pendingLabel}>Pending Withdrawal</Text>
                        <Text style={styles.pendingAmount}>{walletAPI.formatFreti(userData.pendingWithdrawal)}</Text>
                        <Text style={styles.pendingLocal}>{walletAPI.formatCurrency(userData.pendingLocal, userData.localCurrency)}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.walletActions}>
                  <TouchableOpacity
                    style={[styles.walletButton, styles.depositButton]}
                    onPress={() => handleButtonPress(() => navigation.navigate('WalletDeposit'))}
                  >
                    <View style={styles.buttonIconContainer}>
                      <MaterialIcons name="add" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.walletButtonText}>Deposit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.walletButton, styles.withdrawButton]}
                    onPress={() => handleButtonPress(() => navigation.navigate('WalletWithdraw'))}
                  >
                    <View style={styles.buttonIconContainer}>
                      <MaterialIcons name="remove" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.walletButtonText}>Withdraw</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.walletButton, styles.historyButton]}
                    onPress={() => handleButtonPress(() => navigation.navigate('WalletHistory'))}
                  >
                    <View style={styles.buttonIconContainer}>
                      <MaterialIcons name="history" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.walletButtonText}>History</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            {/* Enhanced Order History */}
            <Animated.View style={[styles.modernCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Order History</Text>
                {orders.length > 0 && (
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => navigation.navigate('Orders')}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="chevron-forward" size={14} color="#3498DB" />
                  </TouchableOpacity>
                )}
              </View>
              {orders.length > 0 ? (
                <FlatList
                  data={orders}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => {
                    // Get first item for display
                    const firstItem = item.items?.[0];
                    
                    // Helper function to get product image from order item
                    const getOrderItemImage = (orderItem: any): string => {
                      if (!orderItem) return 'https://via.placeholder.com/100?text=No+Image';
                      
                      // Try multiple paths to get the image
                      if (orderItem.image) return orderItem.image;
                      if (orderItem.productImage) return orderItem.productImage;
                      if (orderItem.product?.primary_image_url) return orderItem.product.primary_image_url;
                      if (orderItem.product?.image_url) return orderItem.product.image_url;
                      if (orderItem.product?.images && Array.isArray(orderItem.product.images) && orderItem.product.images.length > 0) {
                        const primaryImage = orderItem.product.images.find((img: any) => img.is_primary);
                        return primaryImage?.image_url || orderItem.product.images[0]?.image_url || orderItem.product.images[0];
                      }
                      if (orderItem.images && Array.isArray(orderItem.images) && orderItem.images.length > 0) {
                        const primaryImage = orderItem.images.find((img: any) => img.is_primary);
                        return primaryImage?.image_url || orderItem.images[0]?.image_url || orderItem.images[0];
                      }
                      
                      // Fallback placeholder
                      return 'https://via.placeholder.com/100?text=No+Image';
                    };
                    
                    const displayImage = getOrderItemImage(firstItem);
                    const displayTitle = firstItem?.name || `Order #${item.orderNumber}`;
                    
                    return (
                      <TouchableOpacity
                        style={styles.orderCard}
                        onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
                      >
                        <View style={styles.orderImageContainer}>
                          <Image 
                            source={{ uri: displayImage }} 
                            style={styles.orderImage}
                            onError={() => console.log('Failed to load order image:', displayImage)}
                          />
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  item.status === 'delivered'
                                    ? '#27AE60'
                                    : item.status === 'cancelled'
                                    ? '#E74C3C'
                                    : item.status === 'shipped' || item.status === 'out_for_delivery'
                                    ? '#3498DB'
                                    : '#F39C12',
                              },
                            ]}
                          >
                            <Text style={styles.statusText}>{getStatusDisplay(item.status)}</Text>
                          </View>
                        </View>
                        <View style={styles.orderDetails}>
                          <Text style={styles.orderTitle} numberOfLines={1}>{displayTitle}</Text>
                          {item.itemCount > 1 && (
                            <Text style={styles.orderItemCount}>+{item.itemCount - 1} more item{item.itemCount > 2 ? 's' : ''}</Text>
                          )}
                          <Text style={styles.orderDate}>{formatOrderDate(item.orderDate)}</Text>
                          <Text style={styles.orderTotal}>{walletAPI.formatFreti(item.total)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.orderList}
                />
              ) : (
                <View style={styles.emptyOrdersContainer}>
                  <Ionicons name="cube-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyOrdersText}>No orders yet</Text>
                  <Text style={styles.emptyOrdersSubtext}>Start shopping to see your orders here</Text>
                </View>
              )}
            </Animated.View>

            {/* My Gifts Section */}
            <Animated.View style={[styles.modernCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>My Gifts</Text>
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('MyGifts' as never)}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                  <Ionicons name="chevron-forward" size={14} color="#3498DB" />
                </TouchableOpacity>
              </View>
              {gifts.length > 0 ? (
                <FlatList
                  data={gifts}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.giftCard}
                      onPress={() => navigation.navigate('MyGifts' as never)}
                    >
                      <View style={styles.giftEmojiContainer}>
                        <Text style={styles.giftEmoji}>{item.emoji}</Text>
                        {item.quantity > 1 && (
                          <View style={styles.giftQuantityBadge}>
                            <Text style={styles.giftQuantityText}>{item.quantity}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.giftDetails}>
                        <Text style={styles.giftName} numberOfLines={1}>{item.gift_name}</Text>
                        <Text style={styles.giftValue}>{walletAPI.formatFreti(item.total_value)}</Text>
                        <Text style={styles.giftSource}>{item.source.replace(/_/g, ' ')}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.giftList}
                />
              ) : (
                <TouchableOpacity 
                  style={styles.emptyGiftsContainer}
                  onPress={() => navigation.navigate('MyGifts' as never)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="gift-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyGiftsText}>No gifts yet</Text>
                  <Text style={styles.emptyGiftsSubtext}>Purchase, convert, or send gifts to others</Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Enhanced Trends Section */}
            <Animated.View style={[styles.modernCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionTitle}>Trends</Text>
                <View style={styles.trendIndicator}>
                  <Text style={styles.trendText}>📈 Hot</Text>
                </View>
              </View>
              {trendingProducts.length > 0 ? (
                <FlatList
                  data={trendingProducts}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.trendCard}
                      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.trendImageContainer}>
                        <SafeImage 
                          source={{ uri: getProductImage(item) }} 
                          style={styles.trendImage}
                          fallbackSource={{ uri: 'https://via.placeholder.com/60x60.png?text=Product' }}
                          fallbackText="Product"
                        />
                        <View style={styles.trendBadge}>
                          <Text style={styles.trendPercentage}>{getTrendPercentage(item)}</Text>
                        </View>
                      </View>
                      <Text style={styles.trendPrice} numberOfLines={1}>{walletAPI.formatFreti(item.price)}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.trendList}
                />
              ) : (
                <View style={styles.emptyTrendsContainer}>
                  <Text style={styles.emptyTrendsText}>No trending products at the moment</Text>
                </View>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Create Post FAB — smaller, standalone, above Upload FAB */}
      <TouchableOpacity
        style={styles.createPostFAB}
        onPress={() => handleButtonPress(() => navigation.navigate('CreatePost'))}
      >
        <Animated.View style={[styles.createPostIcon, { transform: [{ scale: springAnim }] }]}>
          <Ionicons name="create" size={20} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      {/* Upload Floating Action Button — products/services listing */}
      <TouchableOpacity
        style={styles.uploadFAB}
        onPress={() => handleButtonPress(() => setIsUploadModalVisible(true))}
      >
        <Animated.View style={[styles.uploadIcon, { transform: [{ scale: springAnim }] }]}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      {/* Enhanced Options Modal */}
      <Modal transparent visible={isOptionsVisible} animationType="fade" onRequestClose={() => setIsOptionsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsOptionsVisible(false)}>
          <Animated.View style={[styles.modalContent, { transform: [{ scale: springAnim }] }]}>
            <TouchableOpacity style={styles.modalOption} onPress={() => handleButtonPress(() => { navigation.navigate('AccountSettings', { profile }); setIsOptionsVisible(false); })}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.modalText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => handleButtonPress(() => { navigation.navigate('Bookmarks'); setIsOptionsVisible(false); })}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="bookmark" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.modalText}>Bookmarks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => handleButtonPress(() => { navigation.navigate('MyPosts'); setIsOptionsVisible(false); })}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.modalText}>My Posts</Text>
            </TouchableOpacity>
            {(profile?.isSeller || profile?.isRider) && (
              <TouchableOpacity style={styles.modalOption} onPress={() => handleButtonPress(() => { navigation.navigate('PublicStore', { userId: user?.id, profile, isOwnStore: true }); setIsOptionsVisible(false); })}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.modalText}>View My Store</Text>
              </TouchableOpacity>
            )}
            {(profile?.isSeller || profile?.isRider) && (
              <TouchableOpacity style={styles.modalOption} onPress={() => handleButtonPress(() => { navigation.navigate('Workspace'); setIsOptionsVisible(false); })}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="bar-chart-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.modalText}>Workspace</Text>
              </TouchableOpacity>
            )}
            {profile?.isRider && (
              <TouchableOpacity style={styles.modalOption} onPress={() => handleButtonPress(() => { navigation.navigate('RiderDetailScreen'); setIsOptionsVisible(false); })}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="bicycle" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.modalText}>Set Rider Profile</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalOption} onPress={() => handleButtonPress(handleLogout)}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.modalText}>Logout</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Modern Upload Options Modal */}
      <Modal transparent visible={isUploadModalVisible} animationType="slide" onRequestClose={() => setIsUploadModalVisible(false)}>
        <TouchableOpacity style={styles.uploadModalOverlay} onPress={() => setIsUploadModalVisible(false)}>
          <Animated.View style={[styles.uploadModalContent, { transform: [{ scale: springAnim }] }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => {}}>
              <View style={styles.uploadModalHeader}>
                <Text style={styles.uploadModalTitle}>Create Listing</Text>
                <Text style={styles.uploadModalSubtitle}>What would you like to list on the marketplace?</Text>
              </View>

              <View style={styles.uploadOptions}>
                {/* Show Product option for vendors/sellers */}
                {profile?.isSeller && (
                  <TouchableOpacity
                    style={styles.uploadOption}
                    onPress={() => {
                      setIsUploadModalVisible(false);
                      navigation.navigate('ProductUpload');
                    }}
                  >
                    <View style={[styles.uploadOptionIcon, { backgroundColor: '#3498DB' }]}>
                      <Ionicons name="cube" size={28} color="#FFFFFF" />
                    </View>
                    <View style={styles.uploadOptionContent}>
                      <Text style={styles.uploadOptionTitle}>List Product</Text>
                      <Text style={styles.uploadOptionDescription}>Sell items to customers</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                )}

                {/* Show Service option for vendors/sellers and riders */}
                {(profile?.isSeller || profile?.isRider) && (
                  <TouchableOpacity
                    style={styles.uploadOption}
                    onPress={() => {
                      setIsUploadModalVisible(false);
                      navigation.navigate('ServiceUpload');
                    }}
                  >
                    <View style={[styles.uploadOptionIcon, { backgroundColor: '#E74C3C' }]}>
                      <Ionicons name="flash" size={28} color="#FFFFFF" />
                    </View>
                    <View style={styles.uploadOptionContent}>
                      <Text style={styles.uploadOptionTitle}>List Service</Text>
                      <Text style={styles.uploadOptionDescription}>Offer services to customers</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.uploadModalCancelButton}
                onPress={() => setIsUploadModalVisible(false)}
              >
                <Text style={styles.uploadModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height * 0.35,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  particleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height * 0.35,
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  topSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  bioSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    borderRadius: 24,
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarBorder: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: '#F39C12',
  },
  bioInfo: {
    flex: 1,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginRight: 8,
  },
  userTypeIcon: {
    backgroundColor: '#F39C12',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
  },
  connectButton: {
    backgroundColor: '#3498DB',
  },
  plugButton: {
    backgroundColor: '#27AE60',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollContainer: {
    flex: 1,
  },
  modernCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  walletTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 2,
  },
  walletTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  activeWalletTab: {
    backgroundColor: '#F39C12',
  },
  walletTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  activeWalletTabText: {
    color: '#FFFFFF',
  },
  viewFullWalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
  },
  viewFullWalletText: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  walletContent: {
    gap: 20,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
    position: 'relative',
  },
  rewardsCard: {
    flex: 1,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
    position: 'relative',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  fretiAmount: {
    color: '#F39C12',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  localAmount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  additionalBalances: {
    flexDirection: 'row',
    gap: 12,
  },
  escrowCard: {
    flex: 1,
    backgroundColor: 'rgba(230, 126, 34, 0.2)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(230, 126, 34, 0.3)',
  },
  pendingCard: {
    flex: 1,
    backgroundColor: 'rgba(155, 89, 182, 0.2)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  escrowLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  escrowAmount: {
    color: '#E67E22',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  escrowLocal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  pendingLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  pendingAmount: {
    color: '#9B59B6',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  pendingLocal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  rewardsBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F39C12',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
  },
  walletButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  depositButton: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    borderColor: 'rgba(39, 174, 96, 0.4)',
  },
  withdrawButton: {
    backgroundColor: 'rgba(230, 126, 34, 0.2)',
    borderColor: 'rgba(230, 126, 34, 0.4)',
  },
  historyButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderColor: 'rgba(52, 152, 219, 0.4)',
  },
  buttonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  orderList: {
    paddingVertical: 8,
  },
  orderCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginRight: 16,
    padding: 12,
    width: 160,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  orderImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  orderImage: {
    width: '100%',
    height: 80,
    borderRadius: 12,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderDetails: {
    gap: 4,
  },
  orderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  orderItemCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  orderDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  orderTotal: {
    color: '#F39C12',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyOrdersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyOrdersText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyOrdersSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  viewAllText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  trendIndicator: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  trendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trendList: {
    paddingVertical: 8,
  },
  trendCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginRight: 16,
    padding: 12,
    width: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  trendImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  trendImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  trendBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#27AE60',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  trendPercentage: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  trendPrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyTrendsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyTrendsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontStyle: 'italic',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
  },
  loginTitle: {
    marginBottom: 40,
  },
  loginTitleText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: 8,
    width: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginVertical: 2,
  },
  modalIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadFAB: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F39C12',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#F39C12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  uploadIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostFAB: {
    position: 'absolute',
    bottom: 96,
    right: 26,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9B59B6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#9B59B6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 1000,
  },
  createPostIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  uploadModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  uploadModalHeader: {
    marginBottom: 24,
  },
  uploadModalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadModalSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  uploadOptions: {
    gap: 12,
    marginBottom: 24,
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  uploadOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  uploadOptionContent: {
    flex: 1,
  },
  uploadOptionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  uploadOptionDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadModalCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  uploadModalCancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backgroundUploadButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarUploadButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F39C12',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  giftList: {
    paddingVertical: 8,
  },
  giftCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginRight: 16,
    padding: 12,
    width: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  giftEmojiContainer: {
    position: 'relative',
    marginBottom: 12,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
  },
  giftEmoji: {
    fontSize: 32,
  },
  giftQuantityBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F39C12',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftQuantityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  giftDetails: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  giftName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  giftValue: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '700',
  },
  giftSource: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  emptyGiftsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyGiftsText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyGiftsSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});

export { ProfileScreen };