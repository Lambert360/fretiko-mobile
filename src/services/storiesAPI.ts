import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string;
  caption?: string;
  duration?: number;
  expires_at: string;
  is_active: boolean;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  user_profiles: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  has_viewed?: boolean;
  is_liked?: boolean;
}

export interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_profiles: {
    username: string;
    avatar_url?: string;
  };
}

export interface CreateStoryRequest {
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string;
  caption?: string;
  duration?: number;
}

export interface StoryQueryParams {
  limit?: number;
  offset?: number;
  user_id?: string;
}

// Get authentication headers
const getAuthHeaders = async () => {
  try {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) {
      throw new Error('User not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw new Error('User not authenticated');
  }
};

class StoriesAPI {
  /**
   * Create a new story
   */
  async createStory(storyData: CreateStoryRequest): Promise<Story> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories`, {
        method: 'POST',
        headers,
        body: JSON.stringify(storyData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create story: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create story error:', error);
      throw error;
    }
  }

  /**
   * Get stories feed for current user (from connected users only)
   */
  async getStoriesFeed(params?: StoryQueryParams): Promise<Story[]> {
    try {
      const headers = await getAuthHeaders();

      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.user_id) queryParams.append('user_id', params.user_id);

      const response = await fetch(`${API_BASE_URL}/stories/feed?${queryParams.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch stories feed: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get stories feed error:', error);
      throw error;
    }
  }

  /**
   * Get stories grouped by user (for discovery screen - excludes current user's stories)
   */
  async getStoriesGroupedByUser(): Promise<any[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/grouped`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch grouped stories: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get grouped stories error:', error);
      throw error;
    }
  }

  /**
   * Get current user's own active stories
   */
  async getMyStories(): Promise<Story[]> {
    try {
      console.log('🌐 getMyStories API call starting...');
      const headers = await getAuthHeaders();

      console.log('🌐 Making getMyStories API request to:', `${API_BASE_URL}/stories/my-stories`);
      const response = await fetch(`${API_BASE_URL}/stories/my-stories`, {
        method: 'GET',
        headers,
      });

      console.log('🌐 getMyStories API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.log('🌐 getMyStories API failed:', response.status, errorData);
        throw new Error(`Failed to fetch my stories: ${response.status} ${errorData}`);
      }

      const result = await response.json();
      console.log('🌐 getMyStories API success - received', result?.length || 0, 'stories');
      return result;
    } catch (error) {
      console.error('❌ Get my stories error:', error);
      throw error;
    }
  }

  /**
   * Get stories from a specific user
   */
  async getUserStories(userId: string): Promise<Story[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/user/${userId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch user stories: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user stories error:', error);
      throw error;
    }
  }

  /**
   * Get a specific story by ID
   */
  async getStory(storyId: string): Promise<Story> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/${storyId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to fetch story: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get story error:', error);
      throw error;
    }
  }

  /**
   * Update a story
   */
  async updateStory(storyId: string, updateData: { caption?: string; is_active?: boolean }): Promise<Story> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/${storyId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update story: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update story error:', error);
      throw error;
    }
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string): Promise<void> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/${storyId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to delete story: ${response.status} ${errorData}`);
      }
    } catch (error) {
      console.error('Delete story error:', error);
      throw error;
    }
  }

  /**
   * View a story (record view)
   */
  async viewStory(storyId: string): Promise<{ message: string; story: Story }> {
    try {
      const headers = await getAuthHeaders();

      console.log('🌐 Making viewStory API call:', `${API_BASE_URL}/stories/${storyId}/view`);

      const response = await fetch(`${API_BASE_URL}/stories/${storyId}/view`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.log('🌐 viewStory API failed:', response.status, errorData);
        throw new Error(`Failed to view story: ${response.status} ${errorData}`);
      }

      const result = await response.json();
      console.log('🌐 viewStory API success:', result.message);
      return result;
    } catch (error) {
      console.error('View story error:', error);
      throw error;
    }
  }

  /**
   * Toggle like on a story
   */
  async toggleLike(storyId: string): Promise<{ liked: boolean; message: string }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/${storyId}/like`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to toggle like: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Toggle like error:', error);
      throw error;
    }
  }

  /**
   * Add comment to a story
   */
  async addComment(storyId: string, content: string): Promise<StoryComment> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/${storyId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to add comment: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }

  /**
   * Get comments for a story
   */
  async getStoryComments(storyId: string): Promise<StoryComment[]> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/${storyId}/comments`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to get comments: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired stories (admin function)
   */
  async cleanupExpiredStories(): Promise<{ deletedCount: number }> {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/stories/cleanup`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to cleanup stories: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Cleanup stories error:', error);
      throw error;
    }
  }
}

export const storiesAPI = new StoriesAPI();