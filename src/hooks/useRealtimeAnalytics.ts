import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

interface RealtimeAnalyticsData {
  streamId: string;
  title: string;
  status: string;
  viewerCount: number;
  totalViewers: number;
  totalSales: number;
  engagementCount: number;
  giftCount: number;
  giftValue: number;
  conversionRate: number;
  streamDuration: number;
  averageWatchTime: number;
  peakViewers: number;
  commentCount: number;
  reactionCount: number;
  productsSold: number;
  engagementRate: number;
  recentActivity: Array<{
    type: 'purchase' | 'gift';
    amount: number;
    timestamp: string;
  }>;
}

interface UseRealtimeAnalyticsOptions {
  streamId?: string;
  enabled?: boolean;
  updateInterval?: number;
}

interface UseRealtimeAnalyticsReturn {
  analyticsData: RealtimeAnalyticsData | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  subscribeToAnalytics: (streamId: string) => void;
  unsubscribeFromAnalytics: (streamId: string) => void;
}

/**
 * Hook for real-time analytics updates via WebSocket
 *
 * Features:
 * - Automatic WebSocket connection management
 * - Real-time analytics data updates
 * - Error handling and reconnection
 * - Authentication with JWT token
 * - Subscription management for specific streams
 */
export const useRealtimeAnalytics = (
  options: UseRealtimeAnalyticsOptions = {}
): UseRealtimeAnalyticsReturn => {
  const { streamId, enabled = true, updateInterval = 5000 } = options;

  const [analyticsData, setAnalyticsData] = useState<RealtimeAnalyticsData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());

  // Get authentication token
  const getAuthToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('No authentication token found');
      }
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw error;
    }
  };

  // Get user ID
  const getUserId = async () => {
    try {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        return parsed.id || parsed.user_id;
      }
      throw new Error('No user info found');
    } catch (error) {
      console.error('Error getting user ID:', error);
      throw error;
    }
  };

  // Initialize WebSocket connection
  const connect = async () => {
    if (socketRef.current?.connected || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const userId = await getUserId();

      // Create WebSocket connection
      const baseUrl = API_BASE_URL.replace(/^https?:\/\//, '');
      const socket = io(`ws://${baseUrl}/live-sales`, {
        auth: {
          token,
          userId,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      // Connection handlers
      socket.on('connect', () => {
        console.log('WebSocket connected for analytics');
        setIsConnected(true);
        setIsLoading(false);
        setError(null);

        // Authenticate after connection
        socket.emit('authenticate', { token, userId });
      });

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setError('Failed to connect to analytics service');
        setIsLoading(false);
      });

      // Authentication handlers
      socket.on('authenticated', () => {
        console.log('WebSocket authenticated for analytics');

        // Subscribe to existing streams
        subscriptionsRef.current.forEach(streamId => {
          socket.emit('subscribe_analytics', { streamId });
        });
      });

      socket.on('authentication_error', (error) => {
        console.error('WebSocket authentication error:', error);
        setError('Authentication failed');
        setIsLoading(false);
      });

      // Analytics data handlers
      socket.on('analytics_update', (data: RealtimeAnalyticsData) => {
        console.log('Received analytics update:', data);
        setAnalyticsData(data);
      });

      socket.on('analytics_data', (data: RealtimeAnalyticsData) => {
        console.log('Received analytics data:', data);
        setAnalyticsData(data);
      });

      socket.on('analytics_subscribed', (data: RealtimeAnalyticsData) => {
        console.log('Subscribed to analytics:', data);
        setAnalyticsData(data);
      });

      // Error handlers
      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        setError(error.message || 'An error occurred');
      });

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setError('Failed to initialize connection');
      setIsLoading(false);
    }
  };

  // Disconnect WebSocket
  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setAnalyticsData(null);
      subscriptionsRef.current.clear();
    }
  };

  // Subscribe to analytics for a specific stream
  const subscribeToAnalytics = (streamId: string) => {
    if (!socketRef.current?.connected) {
      subscriptionsRef.current.add(streamId);
      return;
    }

    console.log('Subscribing to analytics for stream:', streamId);
    socketRef.current.emit('subscribe_analytics', { streamId });
    subscriptionsRef.current.add(streamId);
  };

  // Unsubscribe from analytics for a specific stream
  const unsubscribeFromAnalytics = (streamId: string) => {
    if (socketRef.current?.connected) {
      console.log('Unsubscribing from analytics for stream:', streamId);
      socketRef.current.emit('unsubscribe_analytics', { streamId });
    }
    subscriptionsRef.current.delete(streamId);
  };

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled]);

  // Auto-subscribe to stream when provided
  useEffect(() => {
    if (streamId && enabled) {
      subscribeToAnalytics(streamId);

      return () => {
        unsubscribeFromAnalytics(streamId);
      };
    }
  }, [streamId, enabled]);

  // Periodic data refresh (fallback)
  useEffect(() => {
    if (!enabled || !streamId || !isConnected) return;

    const interval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('get_analytics', { streamId });
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [streamId, enabled, isConnected, updateInterval]);

  return {
    analyticsData,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    subscribeToAnalytics,
    unsubscribeFromAnalytics,
  };
};

export default useRealtimeAnalytics;