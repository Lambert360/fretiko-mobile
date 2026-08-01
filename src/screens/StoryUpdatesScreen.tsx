import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { storiesAPI, Story } from '../services/storiesAPI';
import { useAuth } from '../contexts/AuthContext';

interface StoryGroupUser {
  id: string;
  username: string;
  avatar_url?: string;
  is_verified?: boolean;
}

interface StoryGroup {
  user: StoryGroupUser;
  stories: Story[];
  hasUnviewed: boolean;
}

interface Section {
  title: string;
  data: StoryGroup[];
}

const timeAgo = (dateString: string): string => {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const StoryUpdatesScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [myStoriesData, groupedData] = await Promise.all([
        storiesAPI.getMyStories().catch(() => []),
        storiesAPI.getStoriesGroupedByUser().catch(() => []),
      ]);

      setMyStories(myStoriesData);

      const groups = (groupedData || []) as StoryGroup[];
      const recent = groups.filter(g => g.hasUnviewed);
      const viewed = groups.filter(g => !g.hasUnviewed);

      const builtSections: Section[] = [];
      if (recent.length > 0) {
        builtSections.push({ title: 'Recent Updates', data: recent });
      }
      if (viewed.length > 0) {
        builtSections.push({ title: 'Viewed Updates', data: viewed });
      }

      setSections(builtSections);
    } catch (error) {
      console.error('Error loading story updates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenStories = useCallback(
    (group: StoryGroup, initialIndex = 0) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Stories', {
        stories: group.stories,
        initialIndex,
        userInfo: group.user,
      });
    },
    [navigation]
  );

  const handleOpenMyStory = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (myStories.length > 0 && user) {
      navigation.navigate('Stories', {
        stories: myStories,
        initialIndex: 0,
        userInfo: { username: user.username || 'You', avatar_url: user.avatar_url },
        canAddMore: true,
      });
    } else {
      navigation.navigate('StoryUpload');
    }
  }, [myStories, navigation, user]);

  const renderMyStory = () => {
    const cover = myStories[0]?.thumbnail_url || myStories[0]?.media_url || user?.avatar_url;
    const label = myStories.length > 0 ? 'My Story' : 'Add to My Story';
    const sublabel = myStories.length > 0
      ? `${myStories.length} ${myStories.length === 1 ? 'story' : 'stories'}`
      : 'Tap to upload';

    return (
      <View style={styles.myStorySection}>
        <TouchableOpacity style={styles.myStoryCard} onPress={handleOpenMyStory}>
          <Image
            source={{ uri: cover || 'https://via.placeholder.com/56' }}
            style={styles.myStoryAvatar}
          />
          <View style={styles.myStoryMeta}>
            <Text style={styles.myStoryName}>{label}</Text>
            <Text style={styles.myStorySubtext}>{sublabel}</Text>
          </View>
          {myStories.length > 0 ? null : (
            <Ionicons name="add-circle" size={28} color="#E91E63" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <Text style={styles.sectionHeader}>{section.title}</Text>
    ),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: StoryGroup }) => {
      const latestStory = item.stories[0];
      const countText = `${item.stories.length} ${item.stories.length === 1 ? 'story' : 'stories'}`;
      const timeText = latestStory ? timeAgo(latestStory.created_at) : '';
      const hasUnviewed = item.hasUnviewed;

      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => handleOpenStories(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.avatarRing, hasUnviewed ? styles.avatarRingUnviewed : styles.avatarRingViewed]}>
            <Image
              source={{ uri: item.user.avatar_url || 'https://via.placeholder.com/50' }}
              style={styles.avatar}
            />
          </View>
          <View style={styles.rowMeta}>
            <Text style={styles.username}>{item.user.username}</Text>
            <Text style={styles.subtext}>
              {countText}{timeText ? ` • ${timeText}` : ''}
            </Text>
          </View>
          {hasUnviewed && <View style={styles.unviewedDot} />}
        </TouchableOpacity>
      );
    },
    [handleOpenStories]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Plugs</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator color="#E91E63" style={styles.loader} />
      ) : (
        <SectionList
          ListHeaderComponent={renderMyStory}
          sections={sections}
          keyExtractor={(item) => item.user.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="albums" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No updates available</Text>
            </View>
          }
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    paddingBottom: 24,
  },
  myStorySection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  myStoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  myStoryAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  myStoryMeta: {
    flex: 1,
    marginLeft: 14,
  },
  myStoryName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  myStorySubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRingUnviewed: {
    borderWidth: 2,
    borderColor: '#E91E63',
  },
  avatarRingViewed: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowMeta: {
    flex: 1,
    marginLeft: 14,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  subtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  unviewedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E91E63',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    marginTop: 12,
  },
});

export default StoryUpdatesScreen;
