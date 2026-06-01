import { api } from './api';

export type MediaType = 'text' | 'image' | 'video' | 'mixed';
export type PrivacyLevel = 'public' | 'friends' | 'private';
export type InteractionType = 'like' | 'comment' | 'share' | 'gift';
export type FeedItemType = 'post' | 'service';

export interface UserInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface Post {
  id: string;
  userId: string;
  user?: UserInfo;
  content: string | null;
  mediaUrls: string[];
  processedMediaUrls?: string[];
  mediaType: MediaType;
  privacyLevel: PrivacyLevel;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  giftsCount: number;
  isPinned: boolean;
  isDeleted: boolean;
  isLiked?: boolean;
  isBookmarked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostMedia {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  fileSize?: number;
}

export interface PostInteraction {
  id: string;
  postId: string;
  userId: string;
  user?: UserInfo;
  interactionType: InteractionType;
  content: string | null;
  giftId: string | null;
  parentCommentId: string | null;
  createdAt: string;
  // Comment reaction fields
  likesCount?: number;
  giftsCount?: number;
  isLiked?: boolean;
  isGifted?: boolean;
}

export interface UnifiedFeedItem {
  id: string;
  type: FeedItemType;
  itemId: string;
  score: number;
  isSeen: boolean;
  createdAt: string;
  postData?: Post;
  serviceData?: any; // Will be VideoFeedItem when needed
}

export interface CreatePostRequest {
  content?: string;
  media?: PostMedia[];
  mediaType?: MediaType;
  privacyLevel?: PrivacyLevel;
}

export interface CreateInteractionRequest {
  interactionType: InteractionType;
  content?: string;
  giftId?: string;
  parentCommentId?: string;
}

export interface PostGiftRequest {
  postId: string;
  giftId: string; // Gift UUID (like live sales)
  message?: string;
}

export interface FeedQueryParams {
  limit?: number;
  offset?: number;
  type?: FeedItemType;
  userId?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    limit?: number;
    offset?: number;
    total?: number;
  };
}

class PostsAPI {
  private baseUrl = '/posts';

  // Create a new post
  async createPost(request: CreatePostRequest): Promise<Post> {
    try {
      const response = await api.post<ApiResponse<Post>>(this.baseUrl, request);
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating post:', error);
      throw new Error(error.response?.data?.message || 'Failed to create post');
    }
  }

  // Get personalized feed (posts + services)
  async getFeed(params?: FeedQueryParams): Promise<UnifiedFeedItem[]> {
    try {
      const response = await api.get<ApiResponse<UnifiedFeedItem[]>>(
        `${this.baseUrl}/feed`,
        { params }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching feed:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch feed');
    }
  }

  // Get single post by ID
  async getPostById(postId: string): Promise<Post> {
    try {
      const response = await api.get<ApiResponse<Post>>(`${this.baseUrl}/${postId}`);
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching post:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch post');
    }
  }

  // Get posts by user
  async getPostsByUser(userId: string, params?: PaginationParams): Promise<Post[]> {
    try {
      const response = await api.get<ApiResponse<Post[]>>(
        `${this.baseUrl}/user/${userId}`,
        { params }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching user posts:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch user posts');
    }
  }

  // Update post
  async updatePost(postId: string, request: Partial<CreatePostRequest>): Promise<Post> {
    try {
      const response = await api.put<ApiResponse<Post>>(
        `${this.baseUrl}/${postId}`,
        request
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error updating post:', error);
      throw new Error(error.response?.data?.message || 'Failed to update post');
    }
  }

  // Delete post
  async deletePost(postId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${postId}`);
    } catch (error: any) {
      console.error('Error deleting post:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete post');
    }
  }

  // Like a post
  async likePost(postId: string): Promise<PostInteraction> {
    try {
      const response = await api.post<ApiResponse<PostInteraction>>(
        `${this.baseUrl}/${postId}/interact`,
        { interactionType: 'like' }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error liking post:', error);
      throw new Error(error.response?.data?.message || 'Failed to like post');
    }
  }

  // Unlike a post
  async unlikePost(postId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${postId}/interact/like`);
    } catch (error: any) {
      console.error('Error unliking post:', error);
      throw new Error(error.response?.data?.message || 'Failed to unlike post');
    }
  }

  // Add comment to post
  async addComment(postId: string, content: string, parentCommentId?: string): Promise<PostInteraction> {
    try {
      const response = await api.post<ApiResponse<PostInteraction>>(
        `${this.baseUrl}/${postId}/interact`,
        { 
          interactionType: 'comment',
          content,
          parentCommentId
        }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error adding comment:', error);
      throw new Error(error.response?.data?.message || 'Failed to add comment');
    }
  }

  // Get comments for a post
  async getComments(postId: string, params?: PaginationParams): Promise<PostInteraction[]> {
    try {
      const response = await api.get<ApiResponse<PostInteraction[]>>(
        `${this.baseUrl}/${postId}/comments`,
        { params }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch comments');
    }
  }

  // Share a post
  async sharePost(postId: string): Promise<PostInteraction> {
    try {
      const response = await api.post<ApiResponse<PostInteraction>>(
        `${this.baseUrl}/${postId}/interact`,
        { interactionType: 'share' }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error sharing post:', error);
      throw new Error(error.response?.data?.message || 'Failed to share post');
    }
  }

  // Send gift to post
  async sendGift(request: PostGiftRequest): Promise<PostInteraction> {
    try {
      const response = await api.post<ApiResponse<PostInteraction>>(
        `${this.baseUrl}/${request.postId}/gift`,
        request
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error sending gift:', error);
      throw new Error(error.response?.data?.message || 'Failed to send gift');
    }
  }

  // Toggle bookmark
  async toggleBookmark(postId: string): Promise<boolean> {
    try {
      const response = await api.post<ApiResponse<{ isBookmarked: boolean }>>(
        `${this.baseUrl}/${postId}/bookmark`
      );
      return response.data.data.isBookmarked;
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
      throw new Error(error.response?.data?.message || 'Failed to toggle bookmark');
    }
  }

  // Like a comment
  async likeComment(commentId: string): Promise<PostInteraction> {
    try {
      const response = await api.post<ApiResponse<PostInteraction>>(
        `${this.baseUrl}/comments/${commentId}/like`
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error liking comment:', error);
      throw new Error(error.response?.data?.message || 'Failed to like comment');
    }
  }

  // Unlike a comment
  async unlikeComment(commentId: string): Promise<void> {
    try {
      await api.delete<ApiResponse<void>>(
        `${this.baseUrl}/comments/${commentId}/like`
      );
    } catch (error: any) {
      console.error('Error unliking comment:', error);
      throw new Error(error.response?.data?.message || 'Failed to unlike comment');
    }
  }

  // Send gift to comment
  async sendGiftToComment(commentId: string, giftId: string): Promise<PostInteraction> {
    try {
      const response = await api.post<ApiResponse<PostInteraction>>(
        `${this.baseUrl}/comments/${commentId}/gift`,
        { giftId }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error sending gift to comment:', error);
      throw new Error(error.response?.data?.message || 'Failed to send gift to comment');
    }
  }

  // Get user's bookmarks
  async getUserBookmarks(params?: PaginationParams): Promise<Post[]> {
    try {
      const response = await api.get<ApiResponse<Post[]>>(
        `${this.baseUrl}/user/bookmarks/me`,
        { params }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching bookmarks:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch bookmarks');
    }
  }

  // Report post
  async reportPost(postId: string, reason: string, details?: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${postId}/report`, {
        reason,
        details
      });
    } catch (error: any) {
      console.error('Error reporting post:', error);
      throw new Error(error.response?.data?.message || 'Failed to report post');
    }
  }

  // Get related posts (more from user)
  async getRelatedPosts(postId: string, limit: number = 10): Promise<Post[]> {
    try {
      const response = await api.get<ApiResponse<Post[]>>(
        `${this.baseUrl}/${postId}/related`,
        { params: { limit } }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching related posts:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch related posts');
    }
  }

  // Upload media file (image or video) to backend
  async uploadMedia(fileUri: string, fileType: string, fileName: string): Promise<{ url: string; path: string }> {
    try {
      console.log('📤 Uploading media via backend API:', { fileUri, fileType, fileName });
      
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // For React Native, we need to create the file object differently
      const file = {
        uri: fileUri,
        type: fileType,
        name: fileName || `file-${Date.now()}.${fileType.split('/')[1] || 'jpg'}`,
      } as any;
      
      formData.append('file', file);
      
      const response = await api.post(`${this.baseUrl}/upload-media`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        transformRequest: (data) => data, // Don't transform FormData
      });
      
      console.log('✅ Media uploaded successfully:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Media upload error:', error);
      throw new Error(error.response?.data?.message || 'Failed to upload media');
    }
  }

  // Helper method to determine media type from files
  determineMediaType(files: PostMedia[]): MediaType {
    if (!files || files.length === 0) return 'text';
    if (files.length === 1) return files[0].mediaType;
    
    const hasImages = files.some(f => f.mediaType === 'image');
    const hasVideos = files.some(f => f.mediaType === 'video');
    
    if (hasImages && hasVideos) return 'mixed';
    return hasVideos ? 'video' : 'image';
  }

  // Format post for display
  formatPostTime(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  }

  // Format interaction count (1.2K, 1M, etc.)
  formatCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }
}

export const postsAPI = new PostsAPI();
