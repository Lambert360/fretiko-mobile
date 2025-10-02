import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { storiesAPI, Story } from '../services/storiesAPI';
import { userAPI } from '../services/userAPI';
import { useAuth } from '../contexts/AuthContext';

interface StoryDeepLinkParams {
  storyId: string;
}

export const StoryDeepLinkScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const { storyId } = route.params as StoryDeepLinkParams;

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isPlugged, setIsPlugged] = useState(false);
  const [storyPoster, setStoryPoster] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStoryAccess();
  }, [storyId]);

  const checkStoryAccess = async () => {
    try {
      console.log('🔗 Checking access for story:', storyId);

      // Try to fetch the story
      const storyData = await storiesAPI.getStory(storyId);
      setStory(storyData);
      setStoryPoster(storyData.user_profiles);

      // Check if user is the story poster (always has access)
      if (user && storyData.user_id === user.id) {
        setHasAccess(true);
        setLoading(false);
        return;
      }

      // Check if user is plugged with story poster
      if (user && storyData.user_profiles?.id) {
        const connections = await userAPI.getConnections();
        const isConnected = connections.some((conn: any) => {
          const otherUserId = conn.requesterId === user.id ? conn.addresseeId : conn.requesterId;
          return otherUserId === storyData.user_profiles.id && conn.status === 'accepted';
        });

        setIsPlugged(isConnected);
        setHasAccess(isConnected);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error checking story access:', error);
      setError('Story not found or expired');
      setLoading(false);
    }
  };

  const handleRequestConnection = async () => {
    if (!user || !storyPoster) return;

    try {
      await userAPI.sendConnectionRequest(storyPoster.id);
      Alert.alert(
        'Connection Request Sent',
        `Your connection request has been sent to @${storyPoster.username}. You'll be able to view their stories once they accept.`
      );
      navigation.goBack();
    } catch (error: any) {
      console.error('❌ Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  const handleViewStory = () => {
    if (!story) return;

    // Navigate to Stories screen with this specific story
    navigation.navigate('Stories', {
      stories: [story],
      initialIndex: 0,
      userInfo: {
        username: story.user_profiles.username,
        avatar_url: story.user_profiles.avatar_url,
      },
      canAddMore: false,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading story...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !story) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Story</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#ccc" />
          <Text style={styles.errorTitle}>Story Not Found</Text>
          <Text style={styles.errorText}>
            This story may have expired or been deleted.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasAccess) {
    // User has access - automatically navigate to story view
    setTimeout(() => handleViewStory(), 100);
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Opening story...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // User doesn't have access - show connection prompt
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Story</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.accessDeniedContainer}>
        {/* Story Preview */}
        <View style={styles.storyPreviewContainer}>
          <Image
            source={{
              uri: story.media_type === 'image' ? story.media_url : story.thumbnail_url
            }}
            style={styles.storyPreview}
            blurRadius={15}
          />
          <View style={styles.blurOverlay}>
            <Ionicons name="lock-closed" size={40} color="white" />
          </View>
        </View>

        {/* Story Poster Info */}
        <View style={styles.posterInfo}>
          <Image
            source={{
              uri: storyPoster?.avatar_url || 'https://via.placeholder.com/80x80.png?text=👤'
            }}
            style={styles.posterAvatar}
          />
          <Text style={styles.posterUsername}>@{storyPoster?.username}</Text>
          {story.caption && (
            <Text style={styles.storyCaption} numberOfLines={2}>
              "{story.caption}"
            </Text>
          )}
        </View>

        {/* Access Request */}
        <View style={styles.accessRequestContainer}>
          <Text style={styles.accessTitle}>Connect to View Story</Text>
          <Text style={styles.accessDescription}>
            You need to be connected with @{storyPoster?.username} to view their stories.
          </Text>

          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleRequestConnection}
          >
            <Ionicons name="person-add" size={20} color="white" />
            <Text style={styles.connectButtonText}>
              Connect with @{storyPoster?.username}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  accessDeniedContainer: {
    flex: 1,
    padding: 20,
  },
  storyPreviewContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 30,
  },
  storyPreview: {
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  posterAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  posterUsername: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  storyCaption: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  accessRequestContainer: {
    alignItems: 'center',
  },
  accessTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  accessDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});