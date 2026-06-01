/**
 * FRETIKO MOBILE - PUSH NOTIFICATION SERVICE
 * Handles push notification registration, permissions, and handling
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { notificationsAPI } from './notificationsAPI';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  notificationId?: string;
  type?: string;
  orderId?: string;
  messageId?: string;
  conversationId?: string;
  userId?: string;
  [key: string]: any;
}

export interface PushNotificationCallback {
  onNotificationReceived?: (notification: Notifications.Notification) => void;
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private callbacks: PushNotificationCallback = {};

  /**
   * Check if device supports push notifications
   */
  isDeviceSupported(): boolean {
    // Expo Go and physical devices support push notifications
    // Simulators/emulators do not
    return Constants.isDevice;
  }

  /**
   * Set the Expo push token (called from App.tsx on startup)
   */
  setExpoPushToken(token: string | null): void {
    this.expoPushToken = token;
    console.log('🔑 Push token stored locally:', token ? 'Token set' : 'Token cleared');
  }

  /**
   * Get the current Expo push token
   */
  getStoredExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Request notification permissions from user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      let finalStatus = existingStatus;
      
      // Only request if not already granted
      if (existingStatus !== 'granted') {
        console.log('📱 Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Notification permission denied');
        return false;
      }

      console.log('✅ Notification permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Get Expo push token for this device
   */
  async getExpoPushToken(): Promise<string | null> {
    try {
      // Check if device supports push notifications
      if (!this.isDeviceSupported()) {
        console.warn('⚠️ Push notifications not supported on this device (simulator/emulator)');
        return null;
      }

      // Request permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      // Get push token
      console.log('📱 Getting Expo push token...');
      
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      const token = tokenData.data;
      this.expoPushToken = token;
      
      console.log('✅ Expo push token obtained:', token);
      return token;
    } catch (error) {
      console.error('❌ Error getting Expo push token:', error);
      return null;
    }
  }

  /**
   * Register push token with backend
   */
  async registerPushToken(userToken: string): Promise<boolean> {
    try {
      // Get Expo push token
      const expoPushToken = await this.getExpoPushToken();
      
      if (!expoPushToken) {
        console.warn('⚠️ No push token to register');
        return false;
      }

      // Register with backend
      console.log('📤 Registering push token with backend...');
      await notificationsAPI.registerPushToken(userToken, expoPushToken);
      
      console.log('✅ Push token registered successfully');
      return true;
    } catch (error) {
      console.error('❌ Error registering push token:', error);
      return false;
    }
  }

  /**
   * Register a specific push token with backend (used when token is already cached)
   */
  async registerPushTokenWithToken(userToken: string, expoPushToken: string): Promise<boolean> {
    try {
      if (!expoPushToken) {
        console.warn('⚠️ No push token provided');
        return false;
      }

      // Store the token
      this.expoPushToken = expoPushToken;

      // Register with backend
      console.log('📤 Registering push token with backend...');
      await notificationsAPI.registerPushToken(userToken, expoPushToken);
      
      console.log('✅ Push token registered successfully');
      return true;
    } catch (error) {
      console.error('❌ Error registering push token:', error);
      return false;
    }
  }

  /**
   * Unregister push token from backend
   */
  async unregisterPushToken(userToken: string): Promise<boolean> {
    try {
      if (!this.expoPushToken) {
        console.warn('⚠️ No push token to unregister');
        return false;
      }

      console.log('📤 Unregistering push token from backend...');
      await notificationsAPI.unregisterPushToken(userToken, this.expoPushToken);
      
      console.log('✅ Push token unregistered successfully');
      this.expoPushToken = null;
      return true;
    } catch (error) {
      console.error('❌ Error unregistering push token:', error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(callbacks: PushNotificationCallback): void {
    console.log('🎧 Setting up notification listeners...');
    
    this.callbacks = callbacks;

    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('📬 Notification received:', notification);
        
        if (this.callbacks.onNotificationReceived) {
          this.callbacks.onNotificationReceived(notification);
        }
      }
    );

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notification tapped:', response);
        
        if (this.callbacks.onNotificationResponse) {
          this.callbacks.onNotificationResponse(response);
        }
      }
    );

    console.log('✅ Notification listeners set up');
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners(): void {
    console.log('🔇 Removing notification listeners...');
    
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }

    this.callbacks = {};
    console.log('✅ Notification listeners removed');
  }

  /**
   * Schedule a local notification (for testing or reminders)
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    triggerSeconds?: number
  ): Promise<string | null> {
    try {
      // Build trigger - null shows immediately, otherwise use seconds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trigger: any = triggerSeconds && triggerSeconds > 0 
        ? { seconds: triggerSeconds } 
        : null;
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger,
      });

      console.log('📅 Local notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling local notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<boolean> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('❌ Notification cancelled:', notificationId);
      return true;
    } catch (error) {
      console.error('❌ Error cancelling notification:', error);
      return false;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<boolean> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('❌ All notifications cancelled');
      return true;
    } catch (error) {
      console.error('❌ Error cancelling all notifications:', error);
      return false;
    }
  }

  /**
   * Get notification badge count
   */
  async getBadgeCount(): Promise<number> {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count;
    } catch (error) {
      console.error('❌ Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set notification badge count
   */
  async setBadgeCount(count: number): Promise<boolean> {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log('🔢 Badge count set to:', count);
      return true;
    } catch (error) {
      console.error('❌ Error setting badge count:', error);
      return false;
    }
  }

  /**
   * Clear all notifications from notification center
   */
  async clearAllNotifications(): Promise<boolean> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('🧹 All notifications cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
      return false;
    }
  }

  /**
   * Configure notification channel (Android only)
   */
  async configureNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // Create notification channels for different types
        const channels = [
          {
            name: 'fretiko_orders',
            importance: Notifications.AndroidImportance.HIGH,
            description: 'Order updates and status changes',
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          },
          {
            name: 'fretiko_messages',
            importance: Notifications.AndroidImportance.HIGH,
            description: 'New messages and chats',
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          },
          {
            name: 'fretiko_delivery',
            importance: Notifications.AndroidImportance.MAX,
            description: 'Delivery and rider updates',
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          },
          {
            name: 'fretiko_payments',
            importance: Notifications.AndroidImportance.HIGH,
            description: 'Payment and wallet updates',
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          },
          {
            name: 'fretiko_social',
            importance: Notifications.AndroidImportance.DEFAULT,
            description: 'Social interactions and connections',
            sound: 'default',
          },
          {
            name: 'fretiko_live',
            importance: Notifications.AndroidImportance.HIGH,
            description: 'Live events and streams',
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
          },
          {
            name: 'fretiko_system',
            importance: Notifications.AndroidImportance.DEFAULT,
            description: 'System updates and notifications',
          },
          {
            name: 'fretiko_general',
            importance: Notifications.AndroidImportance.DEFAULT,
            description: 'General notifications',
          },
          {
            name: 'calls',
            importance: Notifications.AndroidImportance.MAX,
            description: 'Incoming call alerts',
            sound: 'default',
            vibrationPattern: [0, 500, 250, 500],
            lightColor: '#FF27AE60',
            enableVibrate: true,
            showBadge: false,
          },
        ];

        for (const channel of channels) {
          await Notifications.setNotificationChannelAsync(channel.name, channel);
        }

        console.log('✅ Android notification channels configured');
      } catch (error) {
        console.error('❌ Error configuring notification channels:', error);
      }
    }
  }

  /**
   * Get current Expo push token
   */
  getCurrentToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error checking notification status:', error);
      return false;
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;

