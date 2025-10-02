import { chatAPI } from './chatAPI';
import { notificationsAPI } from './notificationsAPI';
import { API_BASE_URL } from '../config/api';
import * as SecureStore from 'expo-secure-store';

export interface StoryCommentNotification {
  storyId: string;
  storyPosterId: string;
  commenterId: string;
  commenterUsername: string;
  commenterAvatarUrl?: string;
  commentText: string;
  storyThumbnail?: string;
  storyCaption?: string;
}

class StoryNotificationAPI {
  /**
   * Get authentication headers for API calls
   */
  private async getAuthHeaders() {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) {
      throw new Error('User not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  /**
   * Send proper notification when someone comments on a story
   * Uses both the notifications system AND DM for better visibility
   */
  async sendCommentNotification(notification: StoryCommentNotification): Promise<void> {
    try {
      console.log('📨 Sending story comment notification to:', notification.storyPosterId);

      // Don't send notification if user is commenting on their own story
      if (notification.commenterId === notification.storyPosterId) {
        console.log('📨 Skipping self-notification');
        return;
      }

      // Method 1: Send formal notification through notifications system
      await this.createStoryNotification(notification);

      // Method 2: Also send DM for immediate visibility
      await this.sendCommentDM(notification);

      console.log('✅ Story comment notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending story comment notification:', error);
      // Don't throw error - notification failure shouldn't break comment functionality
    }
  }

  /**
   * Create a formal notification in the notifications system
   */
  private async createStoryNotification(notification: StoryCommentNotification): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();

      // Create notification via backend API
      const response = await fetch(`${API_BASE_URL}/stories/${notification.storyId}/notify-comment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          commenterId: notification.commenterId,
          commenterUsername: notification.commenterUsername,
          commenterAvatarUrl: notification.commenterAvatarUrl,
          commentText: notification.commentText,
        }),
      });

      if (response.ok) {
        console.log('✅ Story notification created in system');
      } else {
        console.warn('⚠️ Story notification API not implemented, falling back to DM only');
      }
    } catch (error) {
      console.warn('⚠️ Story notification creation failed, falling back to DM only');
    }
  }

  /**
   * Send DM notification (fallback or additional method)
   */
  private async sendCommentDM(notification: StoryCommentNotification): Promise<void> {
    try {
      // Create or find conversation with story poster
      const conversation = await chatAPI.findOrCreateConversation(
        [notification.storyPosterId],
        'friend' // Story comments create friend-type conversations
      );

      console.log('📨 Found/created conversation:', conversation.id);

      // Compose message with story context
      const messageContent = this.composeNotificationMessage(notification);

      // Send the notification message
      await chatAPI.sendMessage({
        conversationId: conversation.id,
        messageType: 'text',
        content: messageContent,
      });

      console.log('✅ Story comment DM sent successfully');
    } catch (error) {
      console.error('❌ Error sending story comment DM:', error);
    }
  }

  /**
   * Compose a user-friendly notification message
   */
  private composeNotificationMessage(notification: StoryCommentNotification): string {
    const { commenterUsername, commentText, storyCaption } = notification;

    let message = `💬 ${commenterUsername} commented on your story`;

    // Add story context if available
    if (storyCaption && storyCaption.trim()) {
      const shortCaption = storyCaption.length > 50
        ? storyCaption.substring(0, 50) + '...'
        : storyCaption;
      message += ` "${shortCaption}"`;
    }

    message += `:\n\n"${commentText}"`;

    return message;
  }

  /**
   * Send story share notification (for future implementation)
   */
  async sendShareNotification(params: {
    storyId: string;
    storyPosterId: string;
    sharerId: string;
    sharerUsername: string;
    recipientId: string;
    storyThumbnail?: string;
    storyCaption?: string;
  }): Promise<void> {
    try {
      console.log('📨 Sending story share notification to:', params.recipientId);

      // Create or find conversation with recipient
      const conversation = await chatAPI.findOrCreateConversation(
        [params.recipientId],
        'friend'
      );

      // Compose share message with deep link
      const messageContent = `🔗 ${params.sharerUsername} shared a story with you!\n\nTap to view: fretiko://story/${params.storyId}`;

      await chatAPI.sendMessage({
        conversationId: conversation.id,
        messageType: 'text',
        content: messageContent,
      });

      console.log('✅ Story share notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending story share notification:', error);
    }
  }
}

export const storyNotificationAPI = new StoryNotificationAPI();