import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { postsAPI, Post } from '../services/postsAPI';
import { useAuth } from '../contexts/AuthContext';
import { GridMediaCard } from '../components/GridMediaCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 48) / 3;

const MyPostsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);

  const springAnim = useRef(new Animated.Value(1)).current;

  const loadPosts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await postsAPI.getPostsByUser(user.id);
      setPosts(data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPosts();
    }, [loadPosts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const openActionModal = (post: Post) => {
    setSelectedPost(post);
    Animated.spring(springAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    setIsActionModalVisible(true);
  };

  const closeActionModal = () => {
    setIsActionModalVisible(false);
    setSelectedPost(null);
  };

  const handleView = () => {
    if (!selectedPost) return;
    closeActionModal();
    navigation.navigate('PostDetails', { postId: selectedPost.id });
  };

  const handleEdit = () => {
    if (!selectedPost) return;
    closeActionModal();
    navigation.navigate('CreatePost', {
      postId: selectedPost.id,
      initialContent: selectedPost.content || '',
      initialPrivacy: selectedPost.privacyLevel,
    });
  };

  const handleDelete = () => {
    if (!selectedPost) return;
    closeActionModal();

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await postsAPI.deletePost(selectedPost.id);
              setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
              setTimeout(() => Alert.alert('Deleted', 'Your post has been deleted.'), 100);
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderPostGrid = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#9B59B6" />
          <Text style={styles.loadingText}>Loading your posts...</Text>
        </View>
      );
    }

    if (posts.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>No Posts Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the create button to share your first post.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreatePost')}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create Post</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.grid}>
        {posts.map((post) => {
          const isTextPost =
            post.mediaType === 'text' || !post.mediaUrls || post.mediaUrls.length === 0;

          return (
            <View key={post.id} style={styles.gridItemWrapper}>
              {isTextPost ? (
                <TouchableOpacity
                  style={styles.textPostCard}
                  onPress={() => navigation.navigate('PostDetails', { postId: post.id })}
                  onLongPress={() => openActionModal(post)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="document-text-outline" size={24} color="#9B59B6" />
                  <Text style={styles.textPostPreview} numberOfLines={4}>
                    {post.content || ''}
                  </Text>
                  <Text style={styles.postDateLabel}>{formatDate(post.createdAt)}</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <GridMediaCard
                    imageUrl={post.processedMediaUrls?.[0] || post.mediaUrls[0]}
                    onPress={() => navigation.navigate('PostDetails', { postId: post.id })}
                    onLongPress={() => openActionModal(post)}
                    isVideo={post.mediaType === 'video' || post.mediaType === 'mixed'}
                  />
                  {post.mediaUrls.length > 1 && (
                    <View style={styles.multiMediaBadge}>
                      <Ionicons name="images-outline" size={12} color="#FFFFFF" />
                      <Text style={styles.multiMediaCount}>{post.mediaUrls.length}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Posts</Text>
        <TouchableOpacity
          style={styles.createPostBtn}
          onPress={() => navigation.navigate('CreatePost')}
        >
          <Ionicons name="add" size={24} color="#9B59B6" />
        </TouchableOpacity>
      </View>

      {/* Post count badge */}
      {!loading && posts.length > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </Text>
          <Text style={styles.hintText}>Long-press any post to edit or delete</Text>
        </View>
      )}

      {/* Grid */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#9B59B6"
            colors={['#9B59B6']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderPostGrid()}
      </ScrollView>

      {/* Action Modal */}
      <Modal
        transparent
        visible={isActionModalVisible}
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeActionModal}
        >
          <Animated.View
            style={[styles.actionModal, { transform: [{ scale: springAnim }] }]}
          >
            <View style={styles.modalHandle} />

            {/* Post preview label */}
            {selectedPost && (
              <Text style={styles.modalPostPreview} numberOfLines={2}>
                {selectedPost.mediaType === 'text'
                  ? selectedPost.content || 'Text post'
                  : `${selectedPost.mediaUrls.length} media item${selectedPost.mediaUrls.length > 1 ? 's' : ''}`}
              </Text>
            )}

            <View style={styles.modalDivider} />

            {/* View */}
            <TouchableOpacity style={styles.modalAction} onPress={handleView}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#1E3A5F' }]}>
                <Ionicons name="eye-outline" size={20} color="#3498DB" />
              </View>
              <Text style={styles.modalActionText}>View Post</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            {/* Edit */}
            <TouchableOpacity style={styles.modalAction} onPress={handleEdit}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#1E3D1E' }]}>
                <Ionicons name="create-outline" size={20} color="#2ECC71" />
              </View>
              <Text style={styles.modalActionText}>Edit Post</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity style={styles.modalAction} onPress={handleDelete}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#3D1E1E' }]}>
                <Ionicons name="trash-outline" size={20} color="#E74C3C" />
              </View>
              <Text style={[styles.modalActionText, { color: '#E74C3C' }]}>Delete Post</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={styles.cancelButton} onPress={closeActionModal}>
              <Text style={styles.cancelText}>Cancel</Text>
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
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  createPostBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  hintText: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 4,
  },
  gridItemWrapper: {
    width: GRID_ITEM_SIZE,
  },
  textPostCard: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(155,89,182,0.3)',
  },
  textPostPreview: {
    color: '#B0B0B0',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
  },
  postDateLabel: {
    color: '#555',
    fontSize: 9,
    marginTop: 6,
  },
  multiMediaBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
  },
  multiMediaCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#B0B0B0',
    marginTop: 16,
    fontSize: 15,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9B59B6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 28,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  actionModal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalPostPreview: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  modalActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default MyPostsScreen;
