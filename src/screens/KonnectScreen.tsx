import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { chatAPI, ChatConversation } from '../services/chatAPI';
import { realtimeAPI } from '../services/realtimeAPI';
import { storiesAPI, Story } from '../services/storiesAPI';
import { useAuth } from '../contexts/AuthContext';
import { AI_ASSISTANT_UUID, AI_ASSISTANT_NAME, AI_ASSISTANT_AVATAR } from '../constants/chat';
import AdaptiveText from '../components/AdaptiveText';

const { width: screenWidth } = Dimensions.get('window');

// Use ChatConversation interface from API
type ChatItem = ChatConversation;

interface StoriesGroup {
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

const KonnectScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, accessToken, isLoading: authLoading, isAuthenticated } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'ai' | 'vendor' | 'rider' | 'support'>('all');
  const [storiesGroups, setStoriesGroups] = useState<StoriesGroup[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refs for cleanup functions
  const cleanupFnRef = useRef<(() => void) | null>(null);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Scroll-based animations for stories section (currently unused but kept for future enhancements)
  const scrollY = useRef(new Animated.Value(0)).current;
  const storiesHeightAnim = useRef(new Animated.Value(200)).current; // Full height
  const cardScaleAnim = useRef(new Animated.Value(1)).current; // Full card size
  const titleOpacityAnim = useRef(new Animated.Value(1)).current;
  const textOverlayOpacityAnim = useRef(new Animated.Value(1)).current;

  // Load stories from API
  const loadStories = async () => {
    if (!isAuthenticated || !user?.id) {
      setStoriesLoading(false);
      return;
    }

    try {
      setStoriesLoading(true);

      // Load user's own stories and discovery stories separately
      const [myStories, groupedStories] = await Promise.all([
        storiesAPI.getMyStories().catch(error => {
          console.error('getMyStories API failed:', error);
          return []; // Return empty array on failure
        }),
        storiesAPI.getStoriesGroupedByUser().catch(error => {
          console.error('getStoriesGroupedByUser API failed:', error);
          return []; // Return empty array on failure
        })
      ]);

      let allStoriesGroups: StoriesGroup[];

      // Always create "My Story" section so every user can create and view their own stories
      const myStorySection: StoriesGroup = {
        user: {
          id: user.id,
          username: 'Your Story',
          avatar_url: user.avatar_url,
        },
        stories: myStories,
        hasUnviewed: false, // User's own stories don't have "unviewed" state
      };

      // Combine "Your Story" with discovery stories
      allStoriesGroups = [
        myStorySection,
        ...groupedStories,
      ];

      setStoriesGroups(allStoriesGroups);
    } catch (error) {
      console.error('Error loading stories:', error);
      // Set empty array on error to show no stories available
      setStoriesGroups([]);
    } finally {
      setStoriesLoading(false);
    }
  };

  // Swipe animations for chat items - use refs to persist across renders and clean up unused ones
  const swipeStatesRef = useRef<Map<string, {
    translateX: Animated.Value;
    isSwipeActive: boolean;
  }>>(new Map());

  // Clean up swipe states for chats that no longer exist
  useEffect(() => {
    const currentChatIds = new Set(chats.map(chat => chat.id));
    const swipeIds = Array.from(swipeStatesRef.current.keys());
    
    // Remove swipe states for chats that no longer exist
    swipeIds.forEach(chatId => {
      if (!currentChatIds.has(chatId)) {
        swipeStatesRef.current.delete(chatId);
      }
    });
  }, [chats]);

  // Get or create swipe state for a chat item
  const getSwipeState = (chatId: string) => {
    if (!swipeStatesRef.current.has(chatId)) {
      swipeStatesRef.current.set(chatId, {
        translateX: new Animated.Value(0),
        isSwipeActive: false
      });
    }
    return swipeStatesRef.current.get(chatId)!;
  };

  // Update swipe active state (using ref only - no re-render needed)
  const setSwipeActive = (chatId: string, isActive: boolean) => {
    const state = swipeStatesRef.current.get(chatId);
    if (state) {
      state.isSwipeActive = isActive;
      // Note: No state update needed - swipe animation handles UI via Animated.Value
    }
  };

  // Load all conversations from backend API (including AI conversations)
  const loadAllConversations = async (filter?: string, page: number = 1): Promise<ChatConversation[]> => {
    try {
      const result = await chatAPI.getFilteredConversations({
        chatType: filter && filter !== 'all' ? filter as any : undefined,
        page: page,
        limit: 20, // Load 20 conversations per page
      });

      // Check if there are more conversations to load
      setHasMoreConversations(result.conversations.length === 20);

      return result.conversations;
    } catch (error: any) {
      console.error('Error loading conversations from backend:', error);
      Alert.alert('Error', `Failed to load conversations: ${error?.message || String(error)}`);
      return [];
    }
  };

  // Load conversations from backend API only
  const loadConversations = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setCurrentPage(1); // Reset to first page
        // Haptic feedback on pull-to-refresh
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Also refresh stories when pulling to refresh
        loadStories();
      } else {
        setLoading(true);
      }

      // Load all conversations from backend (including AI conversations)
      const allConversations = await loadAllConversations(activeFilter, 1);

      // Sort by timestamp (most recent first)
      allConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setChats(allConversations);

      // Initialize real-time connection for all conversations
      if (realtimeAPI.isConnected()) {
        allConversations.forEach(chat => {
          realtimeAPI.joinConversation(chat.id);
        });
      }

      // Success haptic feedback on refresh completion
      if (refresh) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations. Please try again.');

      // Error haptic feedback
      if (refresh) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load more conversations (pagination)
  const loadMoreConversations = async () => {
    if (loadingMore || !hasMoreConversations || loading) {
      return;
    }

    try {
      setLoadingMore(true);

      const nextPage = currentPage + 1;
      const moreConversations = await loadAllConversations(activeFilter, nextPage);

      if (moreConversations.length > 0) {
        // Sort and append new conversations
        moreConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setChats(prev => [...prev, ...moreConversations]);
        setCurrentPage(nextPage);

        // Join real-time for new conversations
        if (realtimeAPI.isConnected()) {
          moreConversations.forEach(chat => {
            realtimeAPI.joinConversation(chat.id);
          });
        }
      }
    } catch (error) {
      console.error('Error loading more conversations:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Initialize real-time connection
  const initializeRealtimeConnection = async (): Promise<(() => void) | undefined> => {
    try {
      const userId = user?.id || 'anonymous';

      // Add timeout to prevent hanging
      const connectPromise = realtimeAPI.connect(userId, accessToken || undefined);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      
      // Subscribe to real-time chat events
      const unsubscribeMessage = realtimeAPI.subscribe('chat_message', (data) => {
        // Update conversation list with new message and provide haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setChats(prev => prev.map(chat =>
          chat.id === data.conversationId
            ? {
                ...chat,
                lastMessage: data.message?.content || data.message || chat.lastMessage,
                // Only increment unread count if message is from another user
                unreadCount: data.message?.senderId === user?.id
                  ? chat.unreadCount
                  : chat.unreadCount + 1,
                timestamp: new Date().toISOString()
              }
            : chat
        ));
      });

      const unsubscribeTyping = realtimeAPI.subscribe('chat_typing', (data) => {
        // Handle typing indicators with visual feedback
        setChats(prev => prev.map(chat =>
          chat.id === data.conversationId
            ? { ...chat, isTyping: data.isTyping }
            : chat
        ));
      });

      // Subscribe to user status updates
      const unsubscribeStatus = realtimeAPI.subscribe('user_status', (data) => {
        setChats(prev => prev.map(chat =>
          chat.otherUserId === data.userId
            ? { ...chat, isOnline: data.isOnline, lastSeen: data.lastSeen }
            : chat
        ));
      });

      return () => {
        unsubscribeMessage();
        unsubscribeTyping();
        unsubscribeStatus();
      };
    } catch (error) {
      console.warn('Failed to connect to real-time services:', error);
      // Continue without real-time features
      return undefined;
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Don't initialize if no user/token after auth is done loading
    if (!user || !accessToken) {
      setLoading(false);
      return;
    }

    // Cleanup previous subscriptions if any
    if (cleanupFnRef.current) {
      cleanupFnRef.current();
      cleanupFnRef.current = null;
    }

    // Initialize app
    const init = async () => {
      // Set auth token for chat API
      chatAPI.setAuthToken(accessToken);

      // Load conversations first (don't wait for real-time)
      await loadConversations();

      // Load stories
      await loadStories();

      // Setup real-time connection (non-blocking - run in background)
      const cleanup = await initializeRealtimeConnection();
      if (cleanup) {
        cleanupFnRef.current = cleanup;
      }
    };

    init().catch((error) => {
      console.error('Initialization error:', error);
    });

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for unread badges - slower and smoother
    pulseAnimationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimationRef.current.start();

    // Cleanup on unmount
    return () => {
      if (cleanupFnRef.current) {
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
      // Stop pulse animation to prevent memory leaks and glitches
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
        pulseAnimationRef.current = null;
      }
      realtimeAPI.disconnect();
    };
  }, [user, accessToken, authLoading]);

  // Refresh conversations when screen comes into focus (e.g., returning from a chat)
  // Reload conversations when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Only refresh if user is authenticated (avoid loading dependency to prevent loops)
      if (isAuthenticated && user && accessToken) {
        loadConversations();
      }
    }, [isAuthenticated, user, accessToken]) // Removed 'loading' to prevent re-render loops
  );

  // Reload conversations when filter changes
  useEffect(() => {
    if (!loading && isAuthenticated && user && accessToken) {
      setCurrentPage(1); // Reset page
      setHasMoreConversations(true); // Reset pagination state
      loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // Format timestamp to relative time (e.g., "2m ago", "1h ago", "Yesterday")
  const formatTimestamp = (timestamp: string): string => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now.getTime() - messageTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;

    // For older messages, show date
    return messageTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getChatTypeColor = (type: string) => {
    switch (type) {
      case 'ai': return '#E91E63';
      case 'vendor': return '#FF9800';
      case 'support': return '#3498DB';
      case 'rider': return '#9C27B0';
      default: return '#27AE60';
    }
  };

  const getChatTypeIcon = (type: string) => {
    switch (type) {
      case 'ai': return 'sparkles';
      case 'vendor': return 'storefront';
      case 'support': return 'headset';
      case 'rider': return 'bicycle';
      default: return 'person';
    }
  };

  // Create or find AI conversation with consistent ID
  const createOrFindAIConversation = async () => {
    if (!user) {
      return null;
    }

    try {
      // Use backend conversation system for AI chat persistence
      // For AI chats, we use a special UUID participant ID for Iko
      const aiParticipantId = AI_ASSISTANT_UUID;

      const conversation = await chatAPI.findOrCreateConversation(
        [aiParticipantId], // AI participant
        'ai' // Chat type
      );

      return conversation;
    } catch (error: any) {
      console.error('Error creating AI conversation:', error);
      const errorMessage = error?.message || String(error);
      
      // Check for specific AI configuration errors
      if (errorMessage.includes('not configured') || errorMessage.includes('contact support')) {
        Alert.alert(
          'AI Assistant Unavailable',
          'The AI assistant is temporarily unavailable. Please try again later or contact support if the problem persists.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert(
          'Chat Error',
          'Unable to start conversation with Iko. Please check your connection and try again.',
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Retry', 
              style: 'default',
              onPress: () => createOrFindAIConversation()
            }
          ]
        );
      }
      return null;
    }
  };

  // Navigation to individual chat
  const handleChatPress = (chatItem: ChatItem) => {
    if (!chatItem) return;
    if (chatItem.isAI) {
      // Navigate to AI chat with Iko
      (navigation as any).navigate('IndividualChatScreen', {
        chatId: chatItem.id,
        chatName: chatItem.name,
        // Always use the dedicated AI avatar so it matches IndividualChatScreen
        chatAvatar: AI_ASSISTANT_AVATAR,
        chatType: chatItem.chatType,
        isAI: true,
      });
    } else {
      // Navigate to regular chat
      (navigation as any).navigate('IndividualChatScreen', {
        chatId: chatItem.id,
        chatName: chatItem.name,
        chatAvatar: chatItem.avatar,
        chatType: chatItem.chatType,
        isOnline: chatItem.isOnline,
        verified: chatItem.verified,
        otherUserId: chatItem.otherUserId, // Pass the other user's ID
      });
    }
  };

  // Swipe and long press handlers
  const handleSwipeLeft = async (chat: ChatItem) => {
    if (!chat || chat.isAI) return; // Don't allow actions on Iko
    
    Alert.alert(
      'Archive Chat',
      `Archive conversation with ${chat.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Archive', 
          style: 'destructive',
          onPress: async () => {
            try {
              await chatAPI.archiveConversation(chat.id);
              setChats(prev => prev.filter(c => c.id !== chat.id));
              Alert.alert('Archived', `Chat with ${chat.name} has been archived`);
            } catch (error) {
              Alert.alert('Error', 'Failed to archive conversation');
            }
          }
        },
      ]
    );
  };

  const handleSwipeRight = async (chat: ChatItem) => {
    if (!chat || chat.isAI) return; // Don't allow actions on Iko
    
    Alert.alert(
      'Mark as Read',
      `Mark conversation with ${chat.name} as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark Read', 
          onPress: async () => {
            try {
              await chatAPI.markConversationAsRead(chat.id);
              setChats(prev => prev.map(c => 
                c.id === chat.id ? { ...c, unreadCount: 0 } : c
              ));
              Alert.alert('Success', `Marked conversation with ${chat.name} as read`);
            } catch (error) {
              Alert.alert('Error', 'Failed to mark conversation as read');
            }
          }
        },
      ]
    );
  };

  const handleLongPress = (chat: ChatItem) => {
    if (!chat || chat.isAI) return; // Don't allow actions on Iko

    Alert.alert(
      `Chat Options - ${chat.name}`,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: (chat as any).isMuted ? 'Unmute Notifications' : 'Mute Notifications',
          onPress: async () => {
            try {
              const newMutedState = !((chat as any).isMuted);
              await chatAPI.toggleMuteConversation(chat.id, newMutedState);
              setChats(prev => prev.map(c =>
                c.id === chat.id ? { ...c, isMuted: newMutedState } : c
              ));
              Alert.alert(
                newMutedState ? 'Muted' : 'Unmuted',
                `Notifications from ${chat.name} have been ${newMutedState ? 'muted' : 'unmuted'}`
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to update notification settings');
            }
          }
        },
        { 
          text: chat.isPinned ? 'Unpin Chat' : 'Pin Chat', 
          onPress: async () => {
            try {
              const newPinnedState = !chat.isPinned;
              await chatAPI.togglePinConversation(chat.id, newPinnedState);
              setChats(prev => prev.map(c => 
                c.id === chat.id ? { ...c, isPinned: newPinnedState } : c
              ));
              Alert.alert(
                newPinnedState ? 'Pinned' : 'Unpinned', 
                `Chat with ${chat.name} has been ${newPinnedState ? 'pinned' : 'unpinned'}`
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to update pin status');
            }
          }
        },
        { 
          text: 'Block User', 
          style: 'destructive',
          onPress: () => Alert.alert('Blocked', `${chat.name} has been blocked`)
        },
      ]
    );
  };

  // Filter and sort chats with Iko always at the top - memoized to prevent recalculation
  const filteredChats = React.useMemo(() => {
    return chats
      .filter(chat => {
        // Search filter with null checks and object handling
        const lastMessageText = typeof chat.lastMessage === 'string'
          ? chat.lastMessage
          : (chat.lastMessage && typeof chat.lastMessage === 'object' && 'content' in chat.lastMessage)
            ? (chat.lastMessage as any).content || ''
            : '';

        const matchesSearch = (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (lastMessageText || '').toLowerCase().includes(searchQuery.toLowerCase());

        // Type filter
        let matchesType: boolean = true;
        if (activeFilter !== 'all') {
          matchesType = chat.chatType === activeFilter || (activeFilter === 'ai' && chat.isAI === true);
        }

        // Filter out truly empty conversations — a chat has content if it has any message (any type)
        // or if it is the AI conversation (always shown). Use the timestamp as the signal
        // because lastMessage is now always a string (could be an emoji label for media messages).
        const hasContent = chat.isAI || !!chat.timestamp;

        return matchesSearch && matchesType && hasContent;
      })
      .sort((a, b) => {
        // Always pin Iko (AI) to the top if showing all or AI filter
        if ((activeFilter === 'all' || activeFilter === 'ai') && a.isAI && !b.isAI) return -1;
        if ((activeFilter === 'all' || activeFilter === 'ai') && !a.isAI && b.isAI) return 1;

        // Then sort by pinned status
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // Finally sort by timestamp (most recent first)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [chats, searchQuery, activeFilter]); // Only recompute when these change

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerTop}>
        <TouchableOpacity 
          onPress={() => {
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Konnect</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setIsSearchFocused(!isSearchFocused)}
          >
            <Ionicons name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar - Only show when search icon is tapped */}
      {isSearchFocused && (
        <View style={[
          styles.searchContainer,
          styles.searchContainerFocused
        ]}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setIsSearchFocused(false)} style={{ marginLeft: 8 }}>
            <Text style={{ color: '#3498DB', fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Handle scroll — kept for FlatList onScroll prop compatibility
  const handleScroll = (_event: any) => {};

  const renderStories = () => {
    const hasAnyStories = storiesGroups.some(group => (group.stories?.length || 0) > 0);

    const myStoryGroup = storiesGroups.find(g => g.user.username === 'Your Story');
    const hasMyStories = (myStoryGroup?.stories?.length || 0) > 0;
    const myFirstStory = myStoryGroup?.stories?.[0];
    const myMediaSrc = myFirstStory?.thumbnail_url || myFirstStory?.media_url;
    const discoveryGroups = storiesGroups.filter(
      g => g.user.username !== 'Your Story' && (g.stories?.length || 0) > 0
    );

    return (
      <View style={styles.storiesStickyContainer}>
        <Text style={styles.storiesTitle}>My Plugs  🔌</Text>
        {storiesLoading ? (
          <View style={styles.storiesLoadingContainer}>
            <Text style={styles.storiesLoadingText}>Loading stories...</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesListContent}
          >
            {/* Create Story card — always first, available to all users */}
            <TouchableOpacity
              style={styles.createStoryCard}
              onPress={() => {
                if (hasMyStories && myStoryGroup && user) {
                  (navigation as any).navigate('Stories', {
                    stories: myStoryGroup.stories,
                    initialIndex: 0,
                    userInfo: { username: user.username || 'You', avatar_url: user.avatar_url },
                    canAddMore: true,
                  });
                } else {
                  (navigation as any).navigate('StoryUpload');
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              {hasMyStories && myMediaSrc && (
                <Image
                  source={{ uri: myMediaSrc }}
                  style={styles.createStoryMedia}
                />
              )}
              <View style={styles.createStoryAvatarWrapper}>
                <View>
                  <Image
                    source={{ uri: user?.avatar_url || 'https://via.placeholder.com/64' }}
                    style={styles.createStoryAvatar}
                  />
                  <View style={styles.createStoryPlusBadge}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                  </View>
                </View>
              </View>
              <View style={styles.createStoryLabel}>
                <Text style={styles.createStoryLabelText} numberOfLines={2}>
                  {hasMyStories ? 'Your Story' : 'Create story'}
                </Text>
              </View>
            </TouchableOpacity>
            {/* Discovery story cards */}
            {discoveryGroups.map((group) => {
              const firstStory = group.stories[0];
              const mediaSrc = firstStory?.thumbnail_url || firstStory?.media_url;
              const hasUnviewed = group.hasUnviewed;
              return (
                <TouchableOpacity
                  key={`story-${group.user.id}`}
                  style={styles.storyCard}
                  onPress={() => {
                    (navigation as any).navigate('Stories', {
                      stories: group.stories,
                      initialIndex: 0,
                      userInfo: group.user,
                    });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Image
                    source={{ uri: mediaSrc || group.user.avatar_url || 'https://via.placeholder.com/110' }}
                    style={styles.storyCardMedia}
                  />
                  <View style={[styles.storyAvatarRingWrapper, hasUnviewed ? styles.storyAvatarRingUnviewed : styles.storyAvatarRingViewed]}>
                    <Image
                      source={{ uri: group.user.avatar_url || 'https://via.placeholder.com/36' }}
                      style={styles.storyCardAvatar}
                    />
                  </View>
                  <View style={styles.storyCardOverlay} />
                  <View style={styles.storyCardTextContainer}>
                    <AdaptiveText style={styles.storyCardName} baseFontSize={13} minFontSize={10} maxChars={15} numberOfLines={2}>
                      {group.user.username}
                    </AdaptiveText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickActionsScrollView}
        contentContainerStyle={styles.quickActions}
      >
      <TouchableOpacity
        style={[
          styles.quickAction,
          { backgroundColor: activeFilter === 'ai' ? '#E91E63' : '#E91E6320' }
        ]}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setActiveFilter(activeFilter === 'ai' ? 'all' : 'ai');
        }}
      >
        <Ionicons
          name="sparkles"
          size={18}
          color={activeFilter === 'ai' ? '#FFFFFF' : '#E91E63'}
        />
        <Text style={[
          styles.quickActionText,
          { color: activeFilter === 'ai' ? '#FFFFFF' : '#E91E63' }
        ]}>
          AI Help
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.quickAction,
          { backgroundColor: activeFilter === 'vendor' ? '#FF9800' : '#FF980020' }
        ]}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setActiveFilter(activeFilter === 'vendor' ? 'all' : 'vendor');
        }}
      >
        <Ionicons
          name="storefront"
          size={18}
          color={activeFilter === 'vendor' ? '#FFFFFF' : '#FF9800'}
        />
        <Text style={[
          styles.quickActionText,
          { color: activeFilter === 'vendor' ? '#FFFFFF' : '#FF9800' }
        ]}>
          Vendors
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.quickAction,
          { backgroundColor: activeFilter === 'rider' ? '#9C27B0' : '#9C27B020' }
        ]}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setActiveFilter(activeFilter === 'rider' ? 'all' : 'rider');
        }}
      >
        <Ionicons
          name="bicycle"
          size={18}
          color={activeFilter === 'rider' ? '#FFFFFF' : '#9C27B0'}
        />
        <Text style={[
          styles.quickActionText,
          { color: activeFilter === 'rider' ? '#FFFFFF' : '#9C27B0' }
        ]}>
          Riders
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.quickAction,
          { backgroundColor: '#3498DB20' }
        ]}
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Customer care should take users to disputes (support flow)
          (navigation as any).navigate('Disputes');
        }}
      >
        <Ionicons
          name="headset"
          size={18}
          color={'#3498DB'}
        />
        <Text style={[
          styles.quickActionText,
          { color: '#3498DB' }
        ]}>
          Customer Care
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderChatItem = ({ item, index }: { item: ChatItem; index: number }) => {
    const swipeState = getSwipeState(item.id);
    const { translateX, isSwipeActive } = swipeState;

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate for horizontal swipes and non-AI chats
        return !item.isAI && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        setSwipeActive(item.id, true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (item.isAI) return;

        // Limit swipe distance
        const maxSwipe = 120;
        const clampedDx = Math.max(-maxSwipe, Math.min(maxSwipe, gestureState.dx));
        translateX.setValue(clampedDx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        setSwipeActive(item.id, false);

        if (item.isAI) return;

        const threshold = 60;

        if (gestureState.dx > threshold) {
          // Swipe right - Mark as read
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          handleSwipeRight(item);
        } else if (gestureState.dx < -threshold) {
          // Swipe left - Archive
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          handleSwipeLeft(item);
        }

        // Animate back to center
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      },
    });

    // Use the correct avatar for AI assistant; fall back to backend avatar for others
    const avatarSource = (item.isAI || item.chatType === 'ai')
      ? AI_ASSISTANT_AVATAR
      : typeof item.avatar === 'string'
        ? { uri: item.avatar }
        : item.avatar;

    return (
      <Animated.View
        style={[
          styles.chatItemContainer,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30],
                }),
              },
            ],
          },
        ]}
      >
        {/* Swipe Action Background */}
        {!item.isAI && (
          <View style={styles.swipeBackground}>
            <View style={[styles.swipeAction, styles.swipeActionLeft]}>
              <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              <Text style={styles.swipeActionText}>Read</Text>
            </View>
            <View style={[styles.swipeAction, styles.swipeActionRight]}>
              <Ionicons name="archive" size={24} color="#FFFFFF" />
              <Text style={styles.swipeActionText}>Archive</Text>
            </View>
          </View>
        )}

        <Animated.View
          style={[
            styles.chatItemAnimated,
            {
              transform: [{ translateX }],
            },
          ]}
          {...(!item.isAI ? panResponder.panHandlers : {})}
        >
          <TouchableOpacity
            style={[
              styles.chatItem,
              item.isPinned && styles.pinnedChatItem,
              isSwipeActive && styles.chatItemSwiping,
            ]}
            onPress={() => handleChatPress(item)}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            activeOpacity={0.8}
          >
            <View style={styles.avatarContainer}>
              <Image source={avatarSource} style={styles.avatar} />

              {/* Online indicator */}
            {item.isOnline && (
              <View style={styles.onlineIndicator} />
            )}
            
            {/* Chat type indicator */}
            <View style={[styles.chatTypeIndicator, { backgroundColor: getChatTypeColor(item.chatType) }]}>
              <Ionicons name={getChatTypeIcon(item.chatType) as any} size={10} color="white" />
            </View>
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <View style={styles.nameContainer}>
                <AdaptiveText style={styles.chatName} baseFontSize={18} maxChars={20} numberOfLines={1}>{item.name}</AdaptiveText>
                {item.verified && (
                  <Ionicons name="checkmark-circle" size={16} color="#3498DB" style={{ marginLeft: 4 }} />
                )}
                {item.isPinned && (
                  <Ionicons name="pin" size={14} color="#E91E63" style={{ marginLeft: 4 }} />
                )}
                {(item as any).isMuted && (
                  <Ionicons name="notifications-off" size={14} color="#888888" style={{ marginLeft: 4 }} />
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Timestamp */}
                <Text style={styles.timestamp}>
                  {formatTimestamp(item.timestamp)}
                </Text>
                {/* Context menu for non-AI chats */}
                {item && !item.isAI && (
                  <TouchableOpacity
                    style={styles.contextMenuButton}
                    onPress={() => handleLongPress(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={styles.contextMenuIconContainer}>
                      <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.8)" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.messagePreview}>
              {(item as any).isTyping ? (
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDots}>
                    <View style={[styles.typingDot, styles.typingDot1]} />
                    <View style={[styles.typingDot, styles.typingDot2]} />
                    <View style={[styles.typingDot, styles.typingDot3]} />
                  </View>
                  <Text style={styles.typingText}>typing...</Text>
                </View>
              ) : (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {typeof item.lastMessage === 'string'
                    ? item.lastMessage
                    : (item.lastMessage && typeof item.lastMessage === 'object' && 'content' in item.lastMessage)
                      ? (item.lastMessage as any).content || 'No message'
                      : 'No message'
                  }
                </Text>
              )}
              {item.unreadCount > 0 && (
                <Animated.View
                  style={[
                    styles.unreadBadge,
                    { transform: [{ scale: pulseAnim }] }
                  ]}
                >
                  <Text style={styles.unreadCount}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </Animated.View>
              )}
            </View>
          </View>

          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Animated.View style={[styles.emptyStateIcon, { transform: [{ scale: pulseAnim }] }]}>
        <Ionicons name="chatbubbles-outline" size={80} color="#E91E63" />
      </Animated.View>
      <Text style={styles.emptyStateTitle}>Welcome to Konnect! 👋</Text>
      <Text style={styles.emptyStateSubtitle}>
        Your conversations will appear here. Start by chatting with Iko, your AI assistant!
      </Text>

      <View style={styles.emptyStateActions}>
        <TouchableOpacity
          style={[styles.emptyActionButton, styles.primaryAction]}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Create or find AI conversation with persistent ID
            const conversation = await createOrFindAIConversation();

            if (conversation) {
              // Navigate to AI chat with persistent conversation ID
              (navigation as any).navigate('IndividualChatScreen', {
                chatId: conversation.id,
                chatName: AI_ASSISTANT_NAME,
                chatAvatar: AI_ASSISTANT_AVATAR,
                chatType: 'ai',
                isAI: true,
                verified: true,
              });
            } else {
              Alert.alert('Error', 'Unable to start AI conversation. Please try again.');
            }
          }}
        >
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.emptyActionText}>Chat with Iko AI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.emptyActionButton, styles.secondaryAction]}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await loadConversations(true);
          }}
        >
          <Ionicons name="refresh" size={20} color="#3498DB" />
          <Text style={[styles.emptyActionText, { color: '#3498DB' }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emptyStateFeatures}>
        <View style={styles.featureItem}>
          <Ionicons name="sparkles" size={24} color="#E91E63" />
          <Text style={styles.featureText}>AI Assistant</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="people" size={24} color="#27AE60" />
          <Text style={styles.featureText}>Real-time Chat</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="notifications" size={24} color="#3498DB" />
          <Text style={styles.featureText}>Smart Notifications</Text>
        </View>
      </View>
    </View>
  );

  const renderSkeletonLoading = () => (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 6 }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.skeletonItem,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
            },
          ]}
        >
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonContent}>
            <View style={[styles.skeletonLine, styles.skeletonName]} />
            <View style={[styles.skeletonLine, styles.skeletonMessage]} />
          </View>
          <View style={styles.skeletonBadge} />
        </Animated.View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderStories()}
      {renderQuickActions()}

      <View style={styles.chatsList}>
        {filteredChats.length > 0 ? (
          <Animated.FlatList
            data={filteredChats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.chatsListContent, { paddingBottom: insets.bottom + 154 }]}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadConversations(true)}
                tintColor="#E91E63"
                colors={['#E91E63']}
                progressBackgroundColor="#1A1A1A"
                title="Pull to refresh..."
                titleColor="rgba(255,255,255,0.6)"
              />
            }
            onEndReachedThreshold={0.3}
            onEndReached={loadMoreConversations}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#E91E63" />
                  <Text style={styles.loadingMoreText}>Loading more...</Text>
                </View>
              ) : null
            }
          />
        ) : loading ? (
          renderSkeletonLoading()
        ) : (
          renderEmptyState()
        )}
      </View>

      {/* Floating Action Button - Connections (stacked above Iko) */}
      <TouchableOpacity
        style={[styles.connectionsFab, { bottom: insets.bottom + 82 }]}
        onPress={() => {
          (navigation as any).navigate('ConnectionsList', {
            type: 'plugs',
            userId: user?.id,
            title: 'My Connections',
          });
        }}
      >
        <Ionicons name="people" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Floating Action Button - Quick Access to Iko */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={async () => {
          const ikoChat = chats.find(c => c.isAI || c.chatType === 'ai');
          if (ikoChat) {
            handleChatPress(ikoChat);
          } else {
            // Create or find AI conversation with persistent ID
            const conversation = await createOrFindAIConversation();

            if (conversation) {
              // Navigate to AI chat with persistent conversation ID
              (navigation as any).navigate('IndividualChatScreen', {
                chatId: conversation.id,
                chatName: AI_ASSISTANT_NAME,
                chatAvatar: AI_ASSISTANT_AVATAR,
                chatType: 'ai',
                isAI: true,
                verified: true,
              });
            } else {
              Alert.alert('Error', 'Unable to start AI conversation. Please try again.');
            }
          }
        }}
      >
        <Ionicons name="sparkles" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingHorizontal: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchContainerFocused: {
    borderColor: '#3498DB',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  storiesStickyContainer: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  storiesStickyContainerMinimal: {
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  storiesContainer: {},
  storiesTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 14,
  },
  storiesList: {},
  storiesListContent: {
    paddingLeft: 14,
    paddingRight: 14,
    gap: 10,
  },
  storiesLoadingContainer: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  storiesLoadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  uploadOnlyContainer: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadStoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.35)',
    backgroundColor: 'rgba(52, 152, 219, 0.10)',
  },
  uploadStoryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  noStoriesContainer: {
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  noStoriesText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  regularUserEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    width: screenWidth - 40,
  },
  emptyStateMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  findPlugsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  findPlugsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Facebook-style story card styles ─────────────────────────────────────
  createStoryCard: {
    width: 110,
    height: 200,
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
  },
  createStoryMedia: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  createStoryAvatarWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createStoryAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#3498DB',
  },
  createStoryPlusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1877F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  createStoryLabel: {
    paddingHorizontal: 8,
    paddingBottom: 10,
    alignItems: 'center',
  },
  createStoryLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  storyCard: {
    width: 110,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  storyCardMedia: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  storyAvatarRingWrapper: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatarRingUnviewed: { backgroundColor: '#1877F2' },
  storyAvatarRingViewed: { backgroundColor: '#555555' },
  storyCardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  storyCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  storyCardTextContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  storyCardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // ── Legacy ring/frame styles (preserved to avoid unused-key errors) ──────
  storyItem: { marginRight: 12, width: 90 },
  storyRing: { width: 60, height: 60, borderRadius: 30, padding: 2, marginBottom: 6, position: 'relative' },
  unviewedStoryRing: { backgroundColor: '#E91E63' },
  viewedStoryRing: { backgroundColor: '#666666' },
  noStoryRing: { backgroundColor: 'rgba(255,255,255,0.1)' },
  myStoryRing: { backgroundColor: '#3498DB' },
  myStoryEmptyRing: { backgroundColor: 'rgba(52, 152, 219, 0.3)', borderWidth: 2, borderColor: '#3498DB' },
  storyAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#000000' },
  addStoryIcon: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000000' },
  storyNameContainer: { alignItems: 'center', width: '100%' },
  storyName: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  storyAge: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '500', marginTop: 2 },
  storyCount: { color: '#3498DB', fontSize: 10, fontWeight: '600', marginTop: 2 },
  storyFrame: { width: 90, height: 140, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  unviewedStoryFrame: { borderWidth: 3, borderColor: '#E91E63' },
  viewedStoryFrame: { borderWidth: 3, borderColor: '#666666' },
  noStoryFrame: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  myStoryFrame: { borderWidth: 3, borderColor: '#3498DB' },
  myStoryEmptyFrame: { borderWidth: 3, borderColor: '#3498DB', backgroundColor: 'rgba(52, 152, 219, 0.1)' },
  storyImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  addStoryIconFrame: { position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  storyOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(0,0,0,0.5)' },
  storyTextContainer: { position: 'absolute', bottom: 8, left: 8, right: 8 },
  storyNameFrame: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  storyAgeFrame: { color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: '500', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  storyCountFrame: { color: '#3498DB', fontSize: 9, fontWeight: '700', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  quickActionsContainer: {
    paddingVertical: 0,
    marginVertical: 0,
  },
  quickActionsScrollView: {
    paddingVertical: 0,
    marginVertical: 0,
  },
  quickActions: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 0,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
    flexGrow: 0,
    flexShrink: 0,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  chatsList: {
    flex: 1,
  },
  chatsListContent: {
    paddingTop: 4,
  },
  chatItemContainer: {
    paddingHorizontal: 20,
    position: 'relative',
  },
  chatItemAnimated: {
    backgroundColor: '#000000',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#000000',
  },
  chatItemSwiping: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  swipeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 8,
  },
  swipeActionLeft: {
    backgroundColor: '#27AE60',
  },
  swipeActionRight: {
    backgroundColor: '#E74C3C',
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  pinnedChatItem: {
    backgroundColor: 'rgba(233, 30, 99, 0.05)',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#E91E63',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#27AE60',
    borderWidth: 3,
    borderColor: '#000000',
  },
  chatTypeIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#E91E63',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typingDots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E91E63',
    marginHorizontal: 1,
  },
  typingDot1: {
    opacity: 0.3,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 1,
  },
  typingText: {
    color: '#E91E63',
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    marginBottom: 20,
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  emptyStateActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  primaryAction: {
    backgroundColor: '#E91E63',
  },
  secondaryAction: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 20,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  contextMenuButton: {
    padding: 4,
  },
  contextMenuIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E91E63',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  connectionsFab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3498DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 16,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonLine: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
  },
  skeletonName: {
    height: 16,
    width: '60%',
    marginBottom: 8,
  },
  skeletonMessage: {
    height: 14,
    width: '80%',
  },
  skeletonBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingMoreText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default KonnectScreen;