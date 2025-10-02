import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { userAPI } from '../services/userAPI';
import { storyNotificationAPI } from '../services/storyNotificationAPI';
import { useAuth } from '../contexts/AuthContext';

interface ShareStoryScreenProps {
  storyId: string;
  storyData: {
    id: string;
    user_id: string;
    media_url: string;
    media_type: 'image' | 'video';
    thumbnail_url?: string;
    caption?: string;
    user_profiles: {
      id: string;
      username: string;
      avatar_url?: string;
    };
  };
}

interface ConnectionUser {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  isSeller?: boolean;
  isRider?: boolean;
}

interface Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'accepted';
  createdAt: string;
  requester?: ConnectionUser;
  addressee?: ConnectionUser;
}

export const ShareStoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { storyId, storyData } = route.params as ShareStoryScreenProps;

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await userAPI.getConnections();
      setConnections(data);
    } catch (error: any) {
      console.error('Error loading connections:', error);
      Alert.alert('Error', 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayUser = (connection: Connection): ConnectionUser | null => {
    if (!user) return null;

    if (connection.requesterId === user.id) {
      return connection.addressee || null;
    } else {
      return connection.requester || null;
    }
  };

  const handleShareToFriend = async (recipientId: string, recipientUsername: string) => {
    if (!user || !storyData) return;

    setSharing(recipientId);

    try {
      await storyNotificationAPI.sendShareNotification({
        storyId: storyData.id,
        storyPosterId: storyData.user_profiles.id,
        sharerId: user.id,
        sharerUsername: user.username,
        recipientId: recipientId,
        storyThumbnail: storyData.media_type === 'image' ? storyData.media_url : storyData.thumbnail_url,
        storyCaption: storyData.caption,
      });

      Alert.alert('Success', `Story shared with ${recipientUsername}!`);
      navigation.goBack();
    } catch (error) {
      console.error('Error sharing story:', error);
      Alert.alert('Error', 'Failed to share story');
    } finally {
      setSharing(null);
    }
  };

  const renderConnectionItem = ({ item }: { item: Connection }) => {
    const displayUser = getDisplayUser(item);

    if (!displayUser) return null;

    const isSharing = sharing === displayUser.id;

    return (
      <TouchableOpacity
        style={styles.connectionItem}
        onPress={() => handleShareToFriend(displayUser.id, displayUser.username)}
        disabled={isSharing}
      >
        <View style={styles.userInfo}>
          <Image
            source={{
              uri: displayUser.avatarUrl || 'https://via.placeholder.com/50x50.png?text=👤'
            }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{displayUser.username}</Text>
            {displayUser.bio && (
              <Text style={styles.bio} numberOfLines={1}>
                {displayUser.bio}
              </Text>
            )}
            <View style={styles.badges}>
              {displayUser.isSeller && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Seller</Text>
                </View>
              )}
              {displayUser.isRider && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Rider</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {isSharing ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Ionicons name="send" size={20} color="#007AFF" />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Story</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading connections...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Story</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Story Preview */}
      <View style={styles.storyPreview}>
        <Image
          source={{
            uri: storyData.media_type === 'image' ? storyData.media_url : storyData.thumbnail_url
          }}
          style={styles.storyThumbnail}
        />
        <View style={styles.storyInfo}>
          <Text style={styles.storyPoster}>@{storyData.user_profiles.username}</Text>
          {storyData.caption && (
            <Text style={styles.storyCaption} numberOfLines={2}>
              {storyData.caption}
            </Text>
          )}
        </View>
      </View>

      {connections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No Connections</Text>
          <Text style={styles.emptyText}>
            Connect with friends to share stories with them
          </Text>
        </View>
      ) : (
        <FlatList
          data={connections}
          renderItem={renderConnectionItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  storyPreview: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  storyThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  storyInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  storyPoster: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  storyCaption: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});