import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { chatAPI, ChatConversation } from '../services/chatAPI';
import { realtimeAPI } from '../services/realtimeAPI';
import { storiesAPI, Story } from '../services/storiesAPI';
import { useAuth } from '../contexts/AuthContext';
import { AI_ASSISTANT_UUID } from '../constants/chat';

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
  console.log('🎬 KonnectScreen component rendered');

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, accessToken, isLoading: authLoading, isAuthenticated } = useAuth();

  console.log('🔐 Auth state - User exists:', !!user, 'User ID:', user?.id, 'Has token:', !!accessToken, 'Auth loading:', authLoading, 'Is authenticated:', isAuthenticated);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'ai' | 'vendor' | 'rider' | 'support'>('all');
  const [storiesGroups, setStoriesGroups] = useState<StoriesGroup[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  console.log('📊 Component state - Loading:', loading, 'Chats length:', chats.length, 'Filter:', activeFilter);

  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load stories from API
  const loadStories = async () => {
    if (!isAuthenticated || !user?.id) {
      console.log('❌ Not authenticated, skipping stories load');
      setStoriesLoading(false);
      return;
    }

    try {
      console.log('📖 Loading stories...');
      setStoriesLoading(true);

      // Load user's own stories and discovery stories separately
      console.log('🚀 About to call getMyStories and getStoriesGroupedByUser APIs');

      const [myStories, groupedStories] = await Promise.all([
        storiesAPI.getMyStories().catch(error => {
          console.error('❌ getMyStories API failed:', error);
          return []; // Return empty array on failure
        }),
        storiesAPI.getStoriesGroupedByUser().catch(error => {
          console.error('❌ getStoriesGroupedByUser API failed:', error);
          return []; // Return empty array on failure
        })
      ]);

      console.log('✅ My stories loaded:', myStories.length, 'stories');
      console.log('📄 My stories data:', JSON.stringify(myStories, null, 2));

      // Log first story structure in detail
      if (myStories.length > 0) {
        console.log('🔍 First story structure:', {
          id: myStories[0].id,
          id_type: typeof myStories[0].id,
          user_id: myStories[0].user_id,
          media_url: myStories[0].media_url,
          has_user_profiles: !!myStories[0].user_profiles
        });
      }

      console.log('✅ Discovery stories loaded:', groupedStories.length, 'users with stories');

      // Create "My Story" section with user's own stories
      const myStorySection: StoriesGroup = {
        user: {
          id: user.id,
          username: 'Your Story',
          avatar_url: user.avatar_url,
        },
        stories: myStories,
        hasUnviewed: false, // User's own stories don't have "unviewed" state
      };

      // Combine with discovery stories
      const allStoriesGroups: StoriesGroup[] = [
        myStorySection,
        ...groupedStories,
      ];

      setStoriesGroups(allStoriesGroups);
    } catch (error) {
      console.error('❌ Error loading stories:', error);
      // Set empty array on error to show no stories available
      setStoriesGroups([]);
    } finally {
      setStoriesLoading(false);
    }
  };

  // Swipe animations for chat items (moved from renderChatItem to component level)
  const [swipeStates, setSwipeStates] = useState<{[key: string]: {
    translateX: Animated.Value;
    isSwipeActive: boolean;
  }}>({});

  // Get or create swipe state for a chat item
  const getSwipeState = (chatId: string) => {
    if (!swipeStates[chatId]) {
      setSwipeStates(prev => ({
        ...prev,
        [chatId]: {
          translateX: new Animated.Value(0),
          isSwipeActive: false
        }
      }));
    }
    return swipeStates[chatId] || {
      translateX: new Animated.Value(0),
      isSwipeActive: false
    };
  };

  // Update swipe active state
  const setSwipeActive = (chatId: string, isActive: boolean) => {
    setSwipeStates(prev => ({
      ...prev,
      [chatId]: {
        ...prev[chatId],
        isSwipeActive: isActive
      }
    }));
  };


  // Load all conversations from backend API (including AI conversations)
  const loadAllConversations = async (filter?: string): Promise<ChatConversation[]> => {
    try {
      console.log('🔍 Loading conversations with filter:', filter);
      const result = await chatAPI.getFilteredConversations({
        chatType: filter && filter !== 'all' ? filter as any : undefined,
        page: 1,
        limit: 50,
      });
      console.log('📥 Conversations received:', result.conversations.length, 'conversations');
      console.log('📝 First few conversations:', result.conversations.slice(0, 3));
      return result.conversations;
    } catch (error) {
      console.error('❌ Error loading conversations from backend:', error);
      // Show an alert to make the error visible to user for debugging
      Alert.alert('Debug Error', `Failed to load conversations: ${error.message || error}`);
      return [];
    }
  };

  // Load conversations from backend API only
  const loadConversations = async (refresh = false) => {
    try {
      console.log('🚀 Starting loadConversations, refresh:', refresh);
      console.log('👤 User:', user?.id, 'Token:', !!accessToken);

      if (refresh) {
        setRefreshing(true);
        // Haptic feedback on pull-to-refresh
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Also refresh stories when pulling to refresh
        loadStories();
      } else {
        setLoading(true);
      }

      // Load all conversations from backend (including AI conversations)
      const allConversations = await loadAllConversations(activeFilter);

      // Sort by timestamp (most recent first)
      allConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      console.log('💬 Setting chats with', allConversations.length, 'conversations');
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

  // Initialize real-time connection
  const initializeRealtimeConnection = async () => {
    try {
      const userId = user?.id || 'anonymous';
      console.log('🔌 Attempting real-time connection for user:', userId);

      // Add timeout to prevent hanging
      const connectPromise = realtimeAPI.connect(userId, accessToken);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      console.log('✅ Real-time connection successful');
      
      // Subscribe to real-time chat events
      const unsubscribeMessage = realtimeAPI.subscribe('chat_message', (data) => {
        console.log('📨 New message received:', data);
        // Update conversation list with new message and provide haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setChats(prev => prev.map(chat =>
          chat.id === data.conversationId
            ? {
                ...chat,
                lastMessage: data.message.content,
                unreadCount: chat.unreadCount + 1,
                timestamp: new Date().toISOString()
              }
            : chat
        ));
      });

      const unsubscribeTyping = realtimeAPI.subscribe('chat_typing', (data) => {
        console.log('⌨️ Typing indicator:', data);
        // Handle typing indicators with visual feedback
        setChats(prev => prev.map(chat =>
          chat.id === data.conversationId
            ? { ...chat, isTyping: data.isTyping }
            : chat
        ));
      });

      // Subscribe to user status updates
      const unsubscribeStatus = realtimeAPI.subscribe('user_status', (data) => {
        console.log('👤 User status update:', data);
        setChats(prev => prev.map(chat =>
          chat.id === data.userId
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
    }
  };

  useEffect(() => {
    console.log('🏁 useEffect triggered - User:', !!user, 'Token:', !!accessToken, 'Auth loading:', authLoading);

    // Wait for auth to finish loading
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }

    // Don't initialize if no user/token after auth is done loading
    if (!user || !accessToken) {
      console.log('⚠️ No user or token after auth loaded, skipping initialization');
      setLoading(false);
      return;
    }

    // Initialize app
    const init = async () => {
      console.log('🚀 Initializing KonnectScreen...');
      // Set auth token for chat API
      chatAPI.setAuthToken(accessToken);
      console.log('🔑 Auth token set for chatAPI');

      // Load conversations first (don't wait for real-time)
      console.log('📱 Loading conversations...');
      await loadConversations();

      // Load stories
      console.log('📖 Loading stories...');
      await loadStories();

      // Setup real-time connection (non-blocking - run in background)
      let cleanup;
      initializeRealtimeConnection()
        .then((cleanupFn) => {
          cleanup = cleanupFn;
          console.log('🔗 Real-time connection initialized successfully');
        })
        .catch((error) => {
          console.warn('⚠️ Real-time connection failed, continuing without it:', error);
        });

      return cleanup;
    };

    const cleanup = init();

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

    // Pulse animation for unread badges
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Cleanup on unmount
    return () => {
      cleanup.then(cleanupFn => {
        if (cleanupFn) cleanupFn();
      });
      realtimeAPI.disconnect();
    };
  }, [user, accessToken, authLoading]);

  // Refresh conversations when screen comes into focus (e.g., returning from a chat)
  // Reload conversations when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Only refresh if not loading initially
      if (!loading) {
        loadConversations();
      }
    }, [loading])
  );

  // Reload conversations when filter changes
  useEffect(() => {
    if (!loading) {
      loadConversations();
    }
  }, [activeFilter]);

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
    console.log('🤖 Creating/finding AI conversation for user:', user?.id);
    if (!user) {
      console.error('❌ No user found, cannot create AI conversation');
      return null;
    }

    try {
      // Use backend conversation system for AI chat persistence
      // For AI chats, we use a special UUID participant ID for Iko
      const aiParticipantId = AI_ASSISTANT_UUID;

      console.log('🔍 Calling findOrCreateConversation with AI participant:', aiParticipantId);
      const conversation = await chatAPI.findOrCreateConversation(
        [aiParticipantId], // AI participant
        'ai' // Chat type
      );

      console.log('✅ AI conversation created/found:', conversation?.id);
      return conversation;
    } catch (error) {
      console.error('❌ Error creating AI conversation:', error);
      Alert.alert('AI Chat Error', `Failed to create AI conversation: ${error.message || error}`);
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
        chatAvatar: chatItem.avatar,
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

  // Filter and sort chats with Iko always at the top
  console.log('🔢 Total chats:', chats.length, 'Loading:', loading);
  const filteredChats = chats
    .filter(chat => {
      // Search filter with null checks and object handling
      const lastMessageText = typeof chat.lastMessage === 'string'
        ? chat.lastMessage
        : chat.lastMessage?.content || '';

      const matchesSearch = (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lastMessageText || '').toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      let matchesType = true;
      if (activeFilter !== 'all') {
        matchesType = chat.chatType === activeFilter || (activeFilter === 'ai' && chat.isAI);
      }

      return matchesSearch && matchesType;
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

  console.log('📋 Filtered chats:', filteredChats.length, 'Search:', searchQuery, 'Filter:', activeFilter);

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
            onPress={() => Alert.alert('Camera', 'Opening camera for quick photo/video share')}
          >
            <Ionicons name="camera" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerAction}
            onPress={() => Alert.alert('Search People', 'Search for new people to connect with')}
          >
            <Ionicons name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[
        styles.searchContainer,
        isSearchFocused && styles.searchContainerFocused
      ]}>
        <Ionicons name="search" size={20} color="rgba(255,255,255,0.6)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Plugs Stories */}
      <View style={styles.storiesContainer}>
        <Text style={styles.storiesTitle}>My Plugs  🔌</Text>
        {storiesLoading ? (
          <View style={styles.storiesLoadingContainer}>
            <Text style={styles.storiesLoadingText}>Loading stories...</Text>
          </View>
        ) : (
          <View style={styles.storiesList}>
            {storiesGroups.length === 0 ? (
              <View style={styles.noStoriesContainer}>
                <Text style={styles.noStoriesText}>No stories available</Text>
              </View>
            ) : (
              storiesGroups.map((group, index) => {
                const isMyStory = group.user.username === 'Your Story';
                const hasStories = group.stories.length > 0;
                const hasUnviewed = group.hasUnviewed;

                return (
                  <TouchableOpacity
                    key={isMyStory ? `my-story-${group.user.id}` : `discovery-${group.user.id}`}
                    style={styles.storyItem}
                    onPress={() => {
                      if (isMyStory) {
                        if (hasStories) {
                          // User has stories - view them (backend provides user_profiles)
                          navigation.navigate('Stories', {
                            stories: group.stories,
                            initialIndex: 0,
                            userInfo: {
                              username: user.username || 'You',
                              avatar_url: user.avatar_url,
                            },
                            canAddMore: true, // Allow user to add more stories
                          });
                        } else {
                          // User has no stories - navigate to upload
                          navigation.navigate('StoryUpload');
                        }
                      } else {
                        // Navigate to stories viewer with this user's stories
                        navigation.navigate('Stories', {
                          stories: group.stories,
                          initialIndex: 0,
                          userInfo: group.user,
                        });
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={[
                      styles.storyRing,
                      isMyStory && hasStories ? styles.myStoryRing :
                      isMyStory && !hasStories ? styles.myStoryEmptyRing :
                      hasStories && hasUnviewed ? styles.unviewedStoryRing :
                      hasStories && !hasUnviewed ? styles.viewedStoryRing : styles.noStoryRing
                    ]}>
                      <Image
                        source={{
                          uri: group.user.avatar_url || 'https://via.placeholder.com/60'
                        }}
                        style={styles.storyAvatar}
                      />
                      {isMyStory && (
                        <View style={styles.addStoryIcon}>
                          <Ionicons
                            name={hasStories ? "add" : "add"}
                            size={hasStories ? 10 : 12}
                            color="#FFFFFF"
                          />
                        </View>
                      )}
                    </View>
                    <Text style={styles.storyName} numberOfLines={1}>
                      {group.user.username}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
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
            { backgroundColor: activeFilter === 'support' ? '#3498DB' : '#3498DB20' }
          ]}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveFilter(activeFilter === 'support' ? 'all' : 'support');
          }}
        >
          <Ionicons
            name="headset"
            size={18}
            color={activeFilter === 'support' ? '#FFFFFF' : '#3498DB'}
          />
          <Text style={[
            styles.quickActionText,
            { color: activeFilter === 'support' ? '#FFFFFF' : '#3498DB' }
          ]}>
            Support
          </Text>
        </TouchableOpacity>
      </View>
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
              <Image source={typeof item.avatar === 'string' ? { uri: item.avatar } : item.avatar} style={styles.avatar} />

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
                <Text style={styles.chatName}>{item.name}</Text>
                {item.verified && (
                  <Ionicons name="checkmark-circle" size={16} color="#3498DB" style={{ marginLeft: 4 }} />
                )}
                {item.isPinned && (
                  <Ionicons name="pin" size={14} color="#E91E63" style={{ marginLeft: 4 }} />
                )}
              </View>
              {/* Context menu for non-AI chats */}
              {item && !item.isAI && (
                <TouchableOpacity 
                  style={styles.contextMenuButton}
                  onPress={() => handleLongPress(item)}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.messagePreview}>
              {(item as any).isTyping ? (
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDots}>
                    <Animated.View style={[styles.typingDot, { opacity: pulseAnim }]} />
                    <Animated.View style={[styles.typingDot, { opacity: pulseAnim }]} />
                    <Animated.View style={[styles.typingDot, { opacity: pulseAnim }]} />
                  </View>
                  <Text style={styles.typingText}>typing...</Text>
                </View>
              ) : (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {typeof item.lastMessage === 'string'
                    ? item.lastMessage
                    : item.lastMessage?.content || 'No message'
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
                chatName: 'Iko',
                chatAvatar: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100&h=100&fit=crop&crop=face',
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
      
      <View style={styles.chatsList}>
        {filteredChats.length > 0 ? (
          <FlatList
            data={filteredChats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.chatsListContent, { paddingBottom: insets.bottom + 100 }]}
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
            onEndReachedThreshold={0.1}
            onEndReached={() => {
              // Load more conversations if needed
              console.log('Load more conversations...');
            }}
          />
        ) : loading ? (
          renderSkeletonLoading()
        ) : (
          renderEmptyState()
        )}
      </View>

      {/* Floating Action Button - Quick Access to Iko */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 70 }]}
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
                chatName: 'Iko',
                chatAvatar: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100&h=100&fit=crop&crop=face',
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  storiesContainer: {
    marginBottom: 16,
  },
  storiesTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  storiesList: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  storiesLoadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  storiesLoadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  noStoriesContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noStoriesText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 64,
  },
  storyRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    marginBottom: 6,
    position: 'relative',
  },
  unviewedStoryRing: {
    backgroundColor: '#E91E63',
  },
  viewedStoryRing: {
    backgroundColor: '#666666',
  },
  noStoryRing: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  myStoryRing: {
    backgroundColor: '#3498DB', // Blue ring for user's own stories
  },
  myStoryEmptyRing: {
    backgroundColor: 'rgba(52, 152, 219, 0.3)', // Lighter blue for empty "Your Story"
    borderWidth: 2,
    borderColor: '#3498DB',
    borderStyle: 'dashed',
  },
  storyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#000000',
  },
  addStoryIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  storyName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
    flex: 1,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatsList: {
    flex: 1,
  },
  chatsListContent: {
    paddingTop: 8,
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
});

export default KonnectScreen;