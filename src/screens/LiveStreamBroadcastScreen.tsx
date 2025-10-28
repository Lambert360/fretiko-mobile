import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { liveSalesAPI } from '../services/liveSalesAPI';
import { liveStreamSocket, LiveComment } from '../services/liveStreamSocket';

// Conditionally import Agora only if not in Expo Go
let AgoraUIKit: any = null;
if (Constants.appOwnership !== 'expo') {
  try {
    AgoraUIKit = require('agora-rn-uikit').default;
  } catch (error) {
    console.warn('Agora UI Kit not available:', error);
  }
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Live Stream Broadcast Screen
 * 
 * Full-screen camera interface for vendor broadcasting using Agora UI Kit
 * - Simple Agora integration with pre-built UI
 * - Real-time comments overlay
 * - Viewer count display
 * - Live indicators
 * - End stream functionality
 */

const LiveStreamBroadcastScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { stream } = route.params;

  // Agora state
  const [agoraConfig, setAgoraConfig] = useState<any>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stream state
  const [viewerCount, setViewerCount] = useState(0);
  const [isLive, setIsLive] = useState(false);

  // Comments
  const [comments, setComments] = useState<LiveComment[]>([]);
  const commentsListRef = useRef<FlatList>(null);

  // Initialize Agora configuration
  useEffect(() => {
    initializeStream();
    return () => {
      cleanupStream();
    };
  }, []);

  const initializeStream = async () => {
    try {
      // Check if running in Expo Go
      if (Constants.appOwnership === 'expo' || !AgoraUIKit) {
        Alert.alert(
          '📱 Expo Go Limitation',
          'Live streaming requires native Agora modules that are not available in Expo Go.\n\n' +
          'To broadcast live streams, please:\n' +
          '1. Build the app with EAS: npx eas build\n' +
          '2. Install the custom build on your device\n\n' +
          'Viewers can watch streams in Expo Go using HLS playback.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setLoading(true);
      
      // Get Agora token from backend
      const { token, channel, uid, appId } = await liveSalesAPI.generateAgoraToken(stream.id);

      console.log('🎥 Agora Config:', { appId, channel, uid });

      // Configure Agora UI Kit
      const connectionData = {
        appId: appId,
        channel: channel,
        token: token || null, // Use null if no token (for testing)
        uid: uid,
      };

      setAgoraConfig(connectionData);

      // Connect to WebSocket for comments
      await liveStreamSocket.connect();
      await liveStreamSocket.joinStream(stream.id, 'vendor');
      
      // Register event listeners
      liveStreamSocket.on('comment', handleNewComment);
      liveStreamSocket.on('viewer_count', (data) => setViewerCount(data.current_viewers));

      setLoading(false);
    } catch (error: any) {
      console.error('Error initializing stream:', error);
      Alert.alert('Error', error.message || 'Failed to initialize live stream');
      navigation.goBack();
    }
  };

  const cleanupStream = async () => {
    try {
      if (isLive) {
        await liveSalesAPI.endStream(stream.id);
      }
      liveStreamSocket.clearListeners();
      liveStreamSocket.leaveStream();
    } catch (error) {
      console.error('Error cleaning up stream:', error);
    }
  };

  const handleNewComment = (comment: LiveComment) => {
    setComments(prev => [...prev, comment]);
    setTimeout(() => {
      commentsListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleJoinSuccess = async () => {
    console.log('✅ Successfully joined Agora channel');
    setIsInCall(true);
    
    try {
      // Update stream status to live on backend
      const channelName = agoraConfig?.channel || `fretiko_${stream.id}`;
      await liveSalesAPI.updateStreamStatus(stream.id, 'live', channelName);
      setIsLive(true);
    } catch (error) {
      console.error('Error updating stream status:', error);
    }
  };

  const handleEndStream = () => {
    Alert.alert(
      'End Stream',
      'Are you sure you want to end this live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            setIsInCall(false);
            await cleanupStream();
            navigation.navigate('LiveSales');
          },
        },
      ]
    );
  };

  const renderCommentItem = ({ item }: { item: LiveComment }) => (
    <View style={styles.commentItem}>
      <Text style={styles.commentUser}>{item.user.username}: </Text>
      <Text style={styles.commentText}>{item.message}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Setting up stream...</Text>
      </View>
    );
  }

  if (!agoraConfig) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={60} color="#E74C3C" />
        <Text style={styles.errorText}>Failed to configure stream</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show placeholder if Agora not available
  if (!AgoraUIKit || Constants.appOwnership === 'expo') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="videocam-off" size={64} color="#666" />
        <Text style={[styles.streamTitle, { textAlign: 'center', marginTop: 20 }]}>
          Live Broadcasting Not Available
        </Text>
        <Text style={[styles.streamDescription, { textAlign: 'center', marginTop: 10 }]}>
          Live streaming requires a custom build with native modules.
          {'\n\n'}
          Please use an EAS build to broadcast live streams.
        </Text>
        <TouchableOpacity
          style={[styles.endButton, { marginTop: 30 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.endButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Agora Video UI */}
      <AgoraUIKit
        connectionData={agoraConfig}
        rtcCallbacks={{
          EndCall: () => setIsInCall(false),
          JoinChannelSuccess: handleJoinSuccess,
        }}
        styleProps={{
          localBtnContainer: { display: 'none' }, // Hide default buttons
        }}
      />

      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
        {isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
        
        <View style={styles.viewerCount}>
          <Ionicons name="eye" size={14} color="white" />
          <Text style={styles.viewerText}>{viewerCount}</Text>
        </View>
      </View>

      {/* Stream info */}
      <View style={styles.streamInfoOverlay}>
        <Text style={styles.streamTitle}>{stream.title}</Text>
        {stream.description && (
          <Text style={styles.streamDescription} numberOfLines={2}>
            {stream.description}
          </Text>
        )}
      </View>

      {/* Comments section */}
      {comments.length > 0 && (
        <View style={[styles.commentsSection, { paddingBottom: insets.bottom + 80 }]}>
          <FlatList
            ref={commentsListRef}
            data={comments}
            renderItem={renderCommentItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            showsVerticalScrollIndicator={false}
            style={styles.commentsList}
          />
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {!isInCall ? (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setIsInCall(true)}
          >
            <Ionicons name="videocam" size={24} color="white" />
            <Text style={styles.startButtonText}>Go Live</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.endButton}
            onPress={handleEndStream}
          >
            <Ionicons name="close-circle" size={24} color="white" />
            <Text style={styles.endButtonText}>End Stream</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 15,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 18,
    marginTop: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#3498DB',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 15,
    gap: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  liveText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    gap: 6,
  },
  viewerText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  streamInfoOverlay: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 150,
  },
  streamTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  streamDescription: {
    color: 'white',
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  commentsSection: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 0,
    maxHeight: 300,
  },
  commentsList: {
    flexGrow: 0,
  },
  commentItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    maxWidth: '80%',
  },
  commentUser: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  commentText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#27AE60',
    borderRadius: 25,
    paddingVertical: 16,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    paddingVertical: 16,
  },
  endButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default LiveStreamBroadcastScreen;
