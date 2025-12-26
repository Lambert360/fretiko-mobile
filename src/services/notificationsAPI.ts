/**
 * FRETIKO MOBILE - NOTIFICATIONS API SERVICE
 * Handles all API calls related to notifications
 */

import { API_CONFIG } from '../config/api';

// ============================================
// TYPES - Match backend DTOs
// ============================================
export type NotificationType = 'order' | 'social' | 'promotion' | 'system' | 'delivery' | 'live' | 'payment' | 'chat' | 'user_warning';
export type NotificationPriority = 'high' | 'medium' | 'low';
export type ActionButtonType = 'primary' | 'secondary';

export interface ActionButton {
  label: string;
  type: ActionButtonType;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  avatar_url?: string;
  badge?: string;
  priority: NotificationPriority;
  is_read: boolean;
  is_deleted: boolean;
  has_actions: boolean;
  action_buttons?: ActionButton[];
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface NotificationStats {
  total_notifications: number;
  unread_count: number;
  unread_orders: number;
  unread_social: number;
  unread_live: number;
  unread_delivery: number;
  unread_payment: number;
  unread_chat: number;
  latest_notification_at?: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  order_notifications: boolean;
  social_notifications: boolean;
  promotion_notifications: boolean;
  system_notifications: boolean;
  delivery_notifications: boolean;
  live_notifications: boolean;
  payment_notifications: boolean;
  chat_notifications: boolean;
  quiet_hours_enabled: boolean;
  quiet_start_time?: string;
  quiet_end_time?: string;
  quiet_timezone: string;
  expo_push_tokens: string[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface NotificationQuery {
  type?: NotificationType;
  is_read?: boolean;
  priority?: NotificationPriority;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'priority' | 'type';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// API SERVICE CLASS
// ============================================
class NotificationsAPIService {
  private baseURL: string;

  constructor() {
    this.baseURL = `${API_CONFIG.BASE_URL}/notifications`;
  }

  /**
   * Set auth token for requests
   */
  private getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value.toString());
      }
    });

    return searchParams.toString();
  }

  // ============================================
  // NOTIFICATION CRUD METHODS
  // ============================================

  /**
   * Get user's notifications with optional filtering
   */
  async getNotifications(token: string, query?: NotificationQuery): Promise<PaginatedNotifications> {
    try {
      let url = this.baseURL;
      
      if (query) {
        const queryString = this.buildQueryString(query);
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(token),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get notifications: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(token: string, notificationId: string): Promise<Notification> {
    try {
      const response = await fetch(`${this.baseURL}/${notificationId}`, {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          is_read: true,
        }),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to mark notification as read: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification (soft delete)
   */
  async deleteNotification(token: string, notificationId: string): Promise<Notification> {
    try {
      const response = await fetch(`${this.baseURL}/${notificationId}`, {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          is_deleted: true,
        }),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to delete notification: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async bulkMarkAsRead(token: string, notificationIds: string[]): Promise<{ updated_count: number }> {
    try {
      const response = await fetch(`${this.baseURL}/bulk`, {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify({
          notification_ids: notificationIds,
          is_read: true,
        }),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk mark as read: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error bulk marking as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(token: string): Promise<{ updated_count: number }> {
    try {
      const response = await fetch(`${this.baseURL}/mark-all-read`, {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify({}),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to mark all as read: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    }
  }

  // ============================================
  // NOTIFICATION STATS METHODS
  // ============================================

  /**
   * Get notification statistics (unread counts, etc.)
   */
  async getNotificationStats(token: string): Promise<NotificationStats> {
    try {
      const response = await fetch(`${this.baseURL}/stats`, {
        method: 'GET',
        headers: this.getHeaders(token),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get notification stats: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Get just unread count (for badge display)
   */
  async getUnreadCount(token: string): Promise<{ unread_count: number }> {
    try {
      const response = await fetch(`${this.baseURL}/unread-count`, {
        method: 'GET',
        headers: this.getHeaders(token),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get unread count: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Get recent notifications (last 24 hours)
   */
  async getRecentNotifications(token: string): Promise<Notification[]> {
    try {
      const response = await fetch(`${this.baseURL}/recent`, {
        method: 'GET',
        headers: this.getHeaders(token),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get recent notifications: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting recent notifications:', error);
      throw error;
    }
  }

  /**
   * Get urgent notifications (high priority, unread)
   */
  async getUrgentNotifications(token: string): Promise<Notification[]> {
    try {
      const response = await fetch(`${this.baseURL}/urgent`, {
        method: 'GET',
        headers: this.getHeaders(token),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get urgent notifications: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting urgent notifications:', error);
      throw error;
    }
  }

  // ============================================
  // NOTIFICATION SETTINGS METHODS
  // ============================================

  /**
   * Get user's notification settings
   */
  async getNotificationSettings(token: string): Promise<NotificationSettings> {
    try {
      const response = await fetch(`${this.baseURL}/settings`, {
        method: 'GET',
        headers: this.getHeaders(token),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to get notification settings: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting notification settings:', error);
      throw error;
    }
  }

  /**
   * Update user's notification settings
   */
  async updateNotificationSettings(token: string, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    try {
      const response = await fetch(`${this.baseURL}/settings`, {
        method: 'PUT',
        headers: this.getHeaders(token),
        body: JSON.stringify(settings),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to update notification settings: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }

  /**
   * Register device token for push notifications
   */
  async registerPushToken(token: string, expoPushToken: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseURL}/push-token`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify({ token: expoPushToken }),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to register push token: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error registering push token:', error);
      throw error;
    }
  }

  /**
   * Unregister device token for push notifications
   */
  async unregisterPushToken(token: string, expoPushToken: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${this.baseURL}/push-token`, {
        method: 'DELETE',
        headers: this.getHeaders(token),
        body: JSON.stringify({ token: expoPushToken }),
        timeout: API_CONFIG.TIMEOUT,
      });

      if (!response.ok) {
        throw new Error(`Failed to unregister push token: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error unregistering push token:', error);
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS FOR FRONTEND
  // ============================================

  /**
   * Get notifications by type (matches frontend tabs)
   */
  async getNotificationsByType(token: string, type: NotificationType): Promise<PaginatedNotifications> {
    return this.getNotifications(token, { type, limit: 50, sort_by: 'created_at', sort_order: 'desc' });
  }

  /**
   * Get mentions (social and chat notifications)
   */
  async getMentions(token: string): Promise<PaginatedNotifications> {
    const [social, chat] = await Promise.all([
      this.getNotificationsByType(token, 'social'),
      this.getNotificationsByType(token, 'chat')
    ]);

    // Combine and sort by created_at
    const allNotifications = [
      ...social.notifications,
      ...chat.notifications
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      notifications: allNotifications,
      total: social.total + chat.total,
      limit: 50,
      offset: 0,
      has_more: social.has_more || chat.has_more
    };
  }

  /**
   * Get verified notifications (orders, payments, system)
   */
  async getVerifiedNotifications(token: string): Promise<PaginatedNotifications> {
    const [orders, payments, system] = await Promise.all([
      this.getNotificationsByType(token, 'order'),
      this.getNotificationsByType(token, 'payment'),
      this.getNotificationsByType(token, 'system')
    ]);

    // Combine and sort by created_at
    const allNotifications = [
      ...orders.notifications,
      ...payments.notifications,
      ...system.notifications
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      notifications: allNotifications,
      total: orders.total + payments.total + system.total,
      limit: 50,
      offset: 0,
      has_more: orders.has_more || payments.has_more || system.has_more
    };
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================
export const notificationsAPI = new NotificationsAPIService();
export default notificationsAPI;