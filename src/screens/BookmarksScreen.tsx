import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { postsAPI, Post } from '../services/postsAPI';
import { servicesAPI, Service } from '../services/servicesAPI';

const { width: screenWidth } = Dimensions.get('window');

type TabType = 'posts' | 'services';

const BookmarksScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  
  const [bookmarkedServices, setBookmarkedServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesRefreshing, setServicesRefreshing] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const loadPosts = useCallback(async (showLoading = true) => {
    if (showLoading) setPostsLoading(true);
    setPostsError(null);
    try {
      const posts = await postsAPI.getUserBookmarks({ limit: 50 });
      setBookmarkedPosts(posts);
    } catch (err: any) {
      setPostsError(err.message || 'Failed to load posts');
    } finally {
      setPostsLoading(false);
      setPostsRefreshing(false);
    }
  }, []);

  const loadServices = useCallback(async (showLoading = true) => {
    if (showLoading) setServicesLoading(true);
    setServicesError(null);
    try {
      const services = await servicesAPI.getBookmarkedServices();
      setBookmarkedServices(services);
    } catch (err: any) {
      setServicesError(err.message || 'Failed to load services');
    } finally {
      setServicesLoading(false);
      setServicesRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
    loadServices();
  }, [loadPosts, loadServices]);

  const handleRefresh = () => {
    if (activeTab === 'posts') {
      setPostsRefreshing(true);
      loadPosts(false);
    } else {
      setServicesRefreshing(true);
      loadServices(false);
    }
  };

  const handlePostLike = async (postId: string) => {
    try {
      const post = bookmarkedPosts.find(p => p.id === postId);
      if (post?.isLiked) await postsAPI.unlikePost(postId);
      else await postsAPI.likePost(postId);
      setBookmarkedPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 } : p
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handlePostBookmark = async (postId: string) => {
    try {
      const isBookmarked = await postsAPI.toggleBookmark(postId);
      if (!isBookmarked) setBookmarkedPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      Alert.alert('Error', 'Failed to update bookmark');
    }
  };

  const handleServiceBookmark = async (serviceId: string) => {
    try {
      const result = await servicesAPI.toggleBookmark(serviceId);
      if (!result.bookmarked) setBookmarkedServices(prev => prev.filter(s => s.id !== serviceId));
    } catch (error) {
      Alert.alert('Error', 'Failed to update bookmark');
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => (
    <TouchableOpacity 
      style={styles.itemContainer} 
      onPress={() => (navigation as any).navigate('PostDetails', { postId: item.id })}
    >
      <View style={styles.itemHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => (navigation as any).navigate('PublicProfile', { userId: item.userId })}
        >
          <Image
            source={{ uri: item.user?.avatarUrl || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.username}>@{item.user?.username || 'User'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handlePostBookmark(item.id)}>
          <Ionicons name="bookmark" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {item.content && (
        <Text style={styles.content} numberOfLines={3}>{item.content}</Text>
      )}

      {item.mediaUrls.length > 0 && (
        <Image source={{ uri: item.mediaUrls[0] }} style={styles.mediaImage} resizeMode="cover" />
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}><Ionicons name="heart" size={16} color="#FF4757" /><Text style={styles.statText}>{item.likesCount}</Text></View>
        <View style={styles.stat}><Ionicons name="chatbubble" size={16} color="#3498DB" /><Text style={styles.statText}>{item.commentsCount}</Text></View>
        <View style={styles.stat}><Ionicons name="share" size={16} color="#27AE60" /><Text style={styles.statText}>{item.sharesCount}</Text></View>
        <View style={styles.stat}><Ionicons name="gift" size={16} color="#9B59B6" /><Text style={styles.statText}>{item.giftsCount}</Text></View>
      </View>
    </TouchableOpacity>
  );

  const renderServiceItem = ({ item }: { item: Service }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => (navigation as any).navigate('ServiceDetails', { serviceId: item.id })}>
      <View style={styles.itemHeader}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.username}>@Vendor</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleServiceBookmark(item.id)}>
          <Ionicons name="bookmark" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {item.images && item.images.length > 0 && (
        <Image source={{ uri: item.images[0] }} style={styles.mediaImage} resizeMode="cover" />
      )}

      <Text style={styles.serviceTitle} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.serviceDescription} numberOfLines={2}>{item.description}</Text>

      <View style={styles.serviceFooter}>
        <Text style={styles.price}>₣{Number(item.base_price || 0).toFixed(2)}</Text>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>4.5</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Ionicons name="heart" size={16} color="#FF4757" /><Text style={styles.statText}>{item.like_count || 0}</Text></View>
        <View style={styles.stat}><Ionicons name="bookmark" size={16} color="#3498DB" /><Text style={styles.statText}>{item.save_count || 0}</Text></View>
        <View style={styles.stat}><Ionicons name="share" size={16} color="#27AE60" /><Text style={styles.statText}>0</Text></View>
      </View>
    </TouchableOpacity>
  );

  const renderPostsEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bookmark-outline" size={80} color="#333" />
      <Text style={styles.emptyTitle}>No Saved Posts</Text>
      <Text style={styles.emptySubtitle}>Posts you bookmark will appear here</Text>
      <TouchableOpacity style={styles.exploreButton} onPress={() => (navigation as any).navigate('Home')}>
        <Text style={styles.exploreButtonText}>Explore Feed</Text>
      </TouchableOpacity>
    </View>
  );

  const renderServicesEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bag-outline" size={80} color="#333" />
      <Text style={styles.emptyTitle}>No Saved Services</Text>
      <Text style={styles.emptySubtitle}>Services you bookmark will appear here</Text>
      <TouchableOpacity style={styles.exploreButton} onPress={() => (navigation as any).navigate('Home')}>
        <Text style={styles.exploreButtonText}>Browse Stores</Text>
      </TouchableOpacity>
    </View>
  );

  const isLoading = activeTab === 'posts' ? postsLoading : servicesLoading;
  const isRefreshing = activeTab === 'posts' ? postsRefreshing : servicesRefreshing;
  const error = activeTab === 'posts' ? postsError : servicesError;
  const data = activeTab === 'posts' ? bookmarkedPosts : bookmarkedServices;

  if (postsLoading && servicesLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Loading bookmarks...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.backButton}>
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
          onPress={() => setActiveTab('posts')}
        >
          <Ionicons name="create-outline" size={18} color={activeTab === 'posts' ? '#3498DB' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
          {bookmarkedPosts.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{bookmarkedPosts.length}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'services' && styles.activeTab]}
          onPress={() => setActiveTab('services')}
        >
          <Ionicons name="bag-outline" size={18} color={activeTab === 'services' ? '#3498DB' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'services' && styles.activeTabText]}>Services</Text>
          {bookmarkedServices.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{bookmarkedServices.length}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#E74C3C" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data as any}
          renderItem={activeTab === 'posts' ? renderPostItem as any : renderServiceItem as any}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#3498DB" />
          }
          ListEmptyComponent={activeTab === 'posts' ? renderPostsEmpty : renderServicesEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  activeTab: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#3498DB',
  },
  badge: {
    backgroundColor: '#3498DB',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  itemContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#27AE60',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFD700',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  exploreButton: {
    marginTop: 24,
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BookmarksScreen;
