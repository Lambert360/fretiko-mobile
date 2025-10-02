import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeAPI, LiveStats, LiveComment } from '../services/realtimeAPI';
import { useAuth } from '../contexts/AuthContext';

export interface UseRealtimeInteractionsResult {
  stats: LiveStats;
  comments: LiveComment[];
  isConnected: boolean;
  like: () => Promise<void>;
  unlike: () => Promise<void>;
  addComment: (comment: string) => Promise<void>;
  share: () => Promise<void>;
  toggleCommentLike: (commentId: string) => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshComments: () => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
}

export const useRealtimeInteractions = (serviceId: string): UseRealtimeInteractionsResult => {
  const { user } = useAuth();
  const [stats, setStats] = useState<LiveStats>({
    serviceId,
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
    isLiked: false,
    isBookmarked: false,
  });
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // Initialize real-time connection
  useEffect(() => {
    let mounted = true;

    const initializeRealtime = async () => {
      if (!user?.id) return;

      try {
        // Connect to real-time service
        if (!realtimeAPI.isConnected()) {
          await realtimeAPI.connect(user.id);
          setIsConnected(true);
        }

        // Join service room for updates
        realtimeAPI.joinService(serviceId);

        // Load initial data
        await Promise.all([
          refreshStats(),
          refreshComments(),
        ]);

        // Track view
        realtimeAPI.trackView(serviceId);

        // Subscribe to real-time events
        const unsubscribeStats = realtimeAPI.subscribe('stats', (updatedStats: LiveStats) => {
          if (updatedStats.serviceId === serviceId && mounted) {
            setStats(updatedStats);
          }
        });

        const unsubscribeComment = realtimeAPI.subscribe('comment', (newComment: LiveComment) => {
          if (newComment.serviceId === serviceId && mounted) {
            setComments(prev => [newComment, ...prev]);
            setStats(prev => ({ ...prev, comments: prev.comments + 1 }));
          }
        });

        const unsubscribeInteraction = realtimeAPI.subscribe('interaction', (interaction: any) => {
          if (interaction.serviceId === serviceId && mounted) {
            switch (interaction.type) {
              case 'like':
                setStats(prev => ({
                  ...prev,
                  likes: interaction.likes,
                  isLiked: interaction.userId === user.id ? true : prev.isLiked
                }));
                break;
              case 'share':
                setStats(prev => ({ ...prev, shares: prev.shares + 1 }));
                break;
              case 'view':
                setStats(prev => ({ ...prev, views: prev.views + 1 }));
                break;
            }
          }
        });

        const unsubscribeActivity = realtimeAPI.subscribe('activity', (activity: any) => {
          // Handle live activity updates (typing indicators, presence, etc.)
          console.log('Live activity:', activity);
        });

        // Store unsubscribe functions
        unsubscribeRefs.current = [
          unsubscribeStats,
          unsubscribeComment,
          unsubscribeInteraction,
          unsubscribeActivity,
        ];

      } catch (error) {
        console.error('Failed to initialize real-time interactions:', error);
        // Fallback to polling or static data
        await Promise.all([
          refreshStats(),
          refreshComments(),
        ]);
      }
    };

    initializeRealtime();

    return () => {
      mounted = false;
      // Unsubscribe from events
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
      // Leave service room
      realtimeAPI.leaveService(serviceId);
    };
  }, [serviceId, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const liveStats = await realtimeAPI.getLiveStats(serviceId);
      setStats(liveStats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }, [serviceId]);

  const refreshComments = useCallback(async () => {
    try {
      const liveComments = await realtimeAPI.getLiveComments(serviceId);
      setComments(liveComments);
    } catch (error) {
      console.error('Error refreshing comments:', error);
    }
  }, [serviceId]);

  const like = useCallback(async () => {
    if (stats.isLiked) return; // Already liked
    
    try {
      // Optimistic update
      setStats(prev => ({
        ...prev,
        isLiked: true,
        likes: prev.likes + 1
      }));

      // Send real-time like
      const updatedStats = await realtimeAPI.sendLike(serviceId, true);
      setStats(updatedStats);
    } catch (error) {
      // Revert optimistic update
      setStats(prev => ({
        ...prev,
        isLiked: false,
        likes: prev.likes - 1
      }));
      console.error('Error liking service:', error);
      throw error;
    }
  }, [serviceId, stats.isLiked]);

  const unlike = useCallback(async () => {
    if (!stats.isLiked) return; // Not liked
    
    try {
      // Optimistic update
      setStats(prev => ({
        ...prev,
        isLiked: false,
        likes: prev.likes - 1
      }));

      // Send real-time unlike
      const updatedStats = await realtimeAPI.sendLike(serviceId, false);
      setStats(updatedStats);
    } catch (error) {
      // Revert optimistic update
      setStats(prev => ({
        ...prev,
        isLiked: true,
        likes: prev.likes + 1
      }));
      console.error('Error unliking service:', error);
      throw error;
    }
  }, [serviceId, stats.isLiked]);

  const addComment = useCallback(async (comment: string) => {
    try {
      const newComment = await realtimeAPI.sendComment(serviceId, comment);
      
      // Optimistic update - the real-time event will also trigger an update
      // but this ensures immediate feedback
      setComments(prev => [newComment, ...prev]);
      setStats(prev => ({ ...prev, comments: prev.comments + 1 }));
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }, [serviceId]);

  const share = useCallback(async () => {
    try {
      // Optimistic update
      setStats(prev => ({ ...prev, shares: prev.shares + 1 }));

      await realtimeAPI.sendShare(serviceId);
    } catch (error) {
      // Revert optimistic update
      setStats(prev => ({ ...prev, shares: prev.shares - 1 }));
      console.error('Error sharing service:', error);
      throw error;
    }
  }, [serviceId]);

  const toggleCommentLike = useCallback(async (commentId: string) => {
    try {
      const result = await realtimeAPI.toggleCommentLike(commentId);
      
      // Update local comment state
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, isLiked: result.liked, likes: result.likes }
          : comment
      ));
    } catch (error) {
      console.error('Error toggling comment like:', error);
      throw error;
    }
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    realtimeAPI.sendTypingIndicator(serviceId, isTyping);
  }, [serviceId]);

  return {
    stats,
    comments,
    isConnected,
    like,
    unlike,
    addComment,
    share,
    toggleCommentLike,
    refreshStats,
    refreshComments,
    sendTyping,
  };
};