import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { mentionsAPI, Mention } from '../services/mentionsAPI';

const MentionsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMentions = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await mentionsAPI.getMyMentions({ limit: 50, offset: 0 });
      setMentions(data);
      if (data.length > 0) {
        mentionsAPI.markAllRead().catch(() => {});
      }
    } catch (error) {
      console.error('Failed to load mentions', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMentions(false);
  }, [loadMentions]);

  const handlePress = useCallback(async (item: Mention) => {
    try {
      switch (item.mentionable_type) {
        case 'post':
          navigation.navigate('PostDetails', { postId: item.mentionable_id });
          break;
        case 'product':
          navigation.navigate('ProductDetails', { productId: item.mentionable_id });
          break;
        case 'service':
          navigation.navigate('ServiceDetails', { serviceId: item.mentionable_id });
          break;
        case 'story':
          navigation.navigate('StoryDeepLink', { storyId: item.mentionable_id });
          break;
        case 'comment': {
          const resolution = await mentionsAPI.resolveCommentParent(item.mentionable_id);
          if (!resolution) {
            Alert.alert('Mentions', 'Could not find the original content for this comment.');
            break;
          }

          if (resolution.parent_type === 'post') {
            navigation.navigate('PostDetails', { postId: resolution.parent_id });
          } else if (resolution.parent_type === 'story') {
            navigation.navigate('StoryDeepLink', { storyId: resolution.parent_id });
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to resolve mention parent', error);
      Alert.alert('Mentions', 'Something went wrong opening this mention.');
    }
  }, [navigation]);

  const renderItem = ({ item }: { item: Mention }) => {
    const actor = item.mentioner?.username ? `@${item.mentioner.username}` : 'Someone';
    let label = `${actor} mentioned you`;
    switch (item.mentionable_type) {
      case 'post':
        label = `${actor} mentioned you in a post`;
        break;
      case 'product':
        label = `${actor} mentioned you in a product`;
        break;
      case 'service':
        label = `${actor} mentioned you in a service`;
        break;
      case 'comment':
        label = `${actor} mentioned you in a comment`;
        break;
      case 'story':
        label = `${actor} mentioned you in a story`;
        break;
    }

    const createdAt = new Date(item.created_at);
    const timestamp = createdAt.toLocaleString();

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => handlePress(item)}
      >
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{label}</Text>
          <Text style={styles.itemSubtitle}>{timestamp}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}> 
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading mentions...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}> 
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mentions</Text>
      </View>
      <FlatList
        data={mentions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={mentions.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadMentions(true)}
            tintColor="#FFFFFF"
          />
        }
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No mentions yet</Text>
            <Text style={styles.emptySubtitle}>You will see posts, comments, and chats where you are mentioned here.</Text>
          </View>
        ) : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
  itemContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemContent: {
    flexDirection: 'column',
  },
  itemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default MentionsScreen;
