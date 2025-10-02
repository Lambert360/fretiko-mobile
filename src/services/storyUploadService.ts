import { StorageClient } from '@supabase/storage-js';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fileUploadService } from './fileUploadService';
import { API_BASE_URL } from '../config/api';

// Supabase configuration
const supabaseUrl = 'https://piytfaopdlxltdczdvtk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpeXRmYW9wZGx4bHRkY3pkdnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTU2MDksImV4cCI6MjA3MDkzMTYwOX0.rkKCsoP2elIhsHHeiTHWgaomCjP93Odd-iULbyOXE-Y';

export interface StoryUploadResult {
  publicUrl: string;
  path: string;
  success: boolean;
  error?: string;
  thumbnailUrl?: string;
}

export interface CreateStoryData {
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string;
  caption?: string;
  duration?: number;
}

// Get current user from mobile app's auth system
const getCurrentUser = async () => {
  try {
    const userDataString = await AsyncStorage.getItem('userData');
    const accessToken = await SecureStore.getItemAsync('accessToken');

    if (!userDataString || !accessToken) {
      throw new Error('User not authenticated');
    }

    const userData = JSON.parse(userDataString);
    return { user: userData, token: accessToken };
  } catch (error) {
    console.error('Error getting current user:', error);
    throw new Error('User not authenticated');
  }
};

// Create an authenticated storage client for stories
const createStorageClient = () => {
  return new StorageClient(`${supabaseUrl}/storage/v1`, {
    apikey: supabaseAnonKey,
    authorization: `Bearer ${supabaseAnonKey}`,
    'X-Client-Info': 'fretiko-mobile',
  });
};

class StoryUploadService {
  private readonly bucketName = 'stories';

  /**
   * Upload a story media file to Supabase Storage
   * @param fileUri Local file URI from device
   * @param fileName Original file name or custom name
   * @param fileType MIME type (e.g., 'image/jpeg', 'video/mp4')
   * @param generateThumbnail Whether to generate thumbnail for video
   * @returns Promise with upload result
   */
  async uploadStoryMedia(
    fileUri: string,
    fileName: string,
    fileType: string,
    generateThumbnail: boolean = false
  ): Promise<StoryUploadResult> {
    try {
      console.log('📤 Starting story media upload:', { fileUri, fileName, fileType });

      // Get current user
      const { user, token } = await getCurrentUser();
      console.log('👤 Current user for story upload:', user.id);

      const fileExtension = this.getFileExtension(fileName, fileType);
      const timestamp = Date.now();
      const uniqueFileName = `${user.id}/${timestamp}-story.${fileExtension}`;

      // Read file as base64
      console.log('📖 Reading story file from device...');
      const fileData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Create authenticated storage client
      const storageClient = createStorageClient();

      // Upload main media to Supabase Storage
      console.log('☁️ Uploading story media to Supabase Storage...');
      const { data, error } = await storageClient
        .from(this.bucketName)
        .upload(uniqueFileName, byteArray, {
          contentType: fileType,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('❌ Story upload failed:', error);
        return {
          publicUrl: '',
          path: '',
          success: false,
          error: error.message,
        };
      }

      // Get public URL
      const { data: publicUrlData } = storageClient
        .from(this.bucketName)
        .getPublicUrl(data.path);

      let thumbnailUrl: string | undefined;

      // Generate thumbnail for videos if requested
      if (generateThumbnail && fileType.startsWith('video/')) {
        try {
          console.log('🖼️ Generating thumbnail for video story...');
          const thumbnailResult = await this.generateVideoThumbnail(fileUri, user.id, timestamp);
          if (thumbnailResult.success) {
            thumbnailUrl = thumbnailResult.publicUrl;
          }
        } catch (thumbnailError) {
          console.warn('⚠️ Thumbnail generation failed:', thumbnailError);
          // Continue without thumbnail - not critical
        }
      }

      console.log('✅ Story upload successful:', publicUrlData.publicUrl);

      return {
        publicUrl: publicUrlData.publicUrl,
        path: data.path,
        success: true,
        thumbnailUrl,
      };

    } catch (error) {
      console.error('💥 Story upload error:', error);
      return {
        publicUrl: '',
        path: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Generate thumbnail for video story
   * @param videoUri Local video file URI
   * @param userId User ID for file path
   * @param timestamp Timestamp for unique naming
   * @returns Promise with thumbnail upload result
   */
  private async generateVideoThumbnail(
    videoUri: string,
    userId: string,
    timestamp: number
  ): Promise<StoryUploadResult> {
    try {
      // For now, we'll use a placeholder approach since video thumbnail generation
      // requires additional native modules. In production, you might want to:
      // 1. Use expo-av's VideoThumbnails API
      // 2. Use ffmpeg or similar for server-side thumbnail generation
      // 3. Use a third-party service

      console.log('📸 Video thumbnail generation not implemented yet');

      // Return empty result for now
      return {
        publicUrl: '',
        path: '',
        success: false,
        error: 'Thumbnail generation not implemented',
      };

    } catch (error) {
      return {
        publicUrl: '',
        path: '',
        success: false,
        error: error instanceof Error ? error.message : 'Thumbnail generation failed',
      };
    }
  }

  /**
   * Create a story entry via NestJS backend API
   * @param storyData Story data to create
   * @returns Promise with API response
   */
  async createStory(storyData: CreateStoryData): Promise<any> {
    try {
      const { user, token } = await getCurrentUser();

      console.log('📝 Creating story entry via NestJS backend...');

      const response = await fetch(`${API_BASE_URL}/stories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(storyData),
      });

      if (!response.ok) {
        throw new Error(`Backend API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Story created successfully via backend:', result.id);

      return result;

    } catch (error) {
      console.error('💥 Story creation error:', error);
      throw error;
    }
  }

  /**
   * Upload story using backend upload endpoint (FormData)
   * @param fileUri Local file URI from device
   * @param fileName File name
   * @param fileType MIME type
   * @param caption Optional story caption
   * @param duration Video duration in seconds (for videos)
   * @returns Promise with complete story creation result
   */
  async uploadCompleteStory(
    fileUri: string,
    fileName: string,
    fileType: string,
    caption?: string,
    duration?: number
  ): Promise<{ uploadResult: StoryUploadResult; storyData?: any }> {
    try {
      console.log('🚀 Starting story upload via backend...');
      console.log('📁 File details:', { fileUri, fileName, fileType, caption, duration });

      const { user, token } = await getCurrentUser();

      // Normalize MIME type to ensure it matches backend expectations
      let normalizedType = fileType.toLowerCase();

      // Handle common MIME type variations
      if (normalizedType === 'image/jpg') {
        normalizedType = 'image/jpeg';
      }
      if (normalizedType === 'video/quicktime') {
        normalizedType = 'video/mov';
      }

      // Fallback: determine MIME type from file extension if not provided correctly
      if (!normalizedType || normalizedType === 'application/octet-stream') {
        const extension = fileName.toLowerCase().split('.').pop();
        console.log('🔍 Fallback: determining MIME type from extension:', extension);

        switch (extension) {
          case 'jpg':
          case 'jpeg':
            normalizedType = 'image/jpeg';
            break;
          case 'png':
            normalizedType = 'image/png';
            break;
          case 'webp':
            normalizedType = 'image/webp';
            break;
          case 'mp4':
            normalizedType = 'video/mp4';
            break;
          case 'mov':
            normalizedType = 'video/mov';
            break;
          default:
            console.warn('⚠️ Unknown file extension:', extension);
            normalizedType = 'image/jpeg'; // Default fallback
        }
      }

      console.log('📝 Final MIME type:', normalizedType);

      // Create FormData for multipart upload
      const formData = new FormData();

      // Add file to form data with proper MIME type
      formData.append('file', {
        uri: fileUri,
        type: normalizedType,
        name: fileName,
      } as any);

      // Add optional fields
      if (caption) {
        formData.append('caption', caption);
      }
      if (duration) {
        formData.append('duration', duration.toString());
      }

      // Upload via backend endpoint (don't set Content-Type header for FormData)
      const response = await fetch(`${API_BASE_URL}/stories/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Remove Content-Type to let browser set boundary for multipart/form-data
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Story uploaded successfully via backend:', result.id);

      return {
        uploadResult: {
          publicUrl: result.media_url,
          path: result.id,
          success: true,
        },
        storyData: result,
      };

    } catch (error) {
      console.error('💥 Complete story upload error:', error);
      return {
        uploadResult: {
          publicUrl: '',
          path: '',
          success: false,
          error: error instanceof Error ? error.message : 'Story upload failed',
        },
      };
    }
  }

  /**
   * Delete a story media file from storage
   * @param filePath The path of the file to delete
   */
  async deleteStoryMedia(filePath: string): Promise<boolean> {
    try {
      const storageClient = createStorageClient();
      const { error } = await storageClient
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('❌ Story delete failed:', error);
        return false;
      }

      console.log('✅ Story file deleted:', filePath);
      return true;
    } catch (error) {
      console.error('💥 Story delete error:', error);
      return false;
    }
  }

  /**
   * Validate story media before upload
   */
  async validateStoryMedia(fileUri: string, mimeType: string): Promise<{ valid: boolean; error?: string }> {
    // Check file type (stories support images and videos)
    if (!this.isStoryMediaTypeSupported(mimeType)) {
      return { valid: false, error: 'File type not supported for stories' };
    }

    // Check file size (25MB limit for stories - smaller than regular uploads)
    const sizeInMB = await this.getFileSizeInMB(fileUri);
    if (sizeInMB > 25) {
      return { valid: false, error: 'Story file size exceeds 25MB limit' };
    }

    return { valid: true };
  }

  /**
   * Check if file type is supported for stories
   */
  private isStoryMediaTypeSupported(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
    ];
    return supportedTypes.includes(mimeType);
  }

  /**
   * Get file extension from filename or MIME type
   */
  private getFileExtension(fileName: string, mimeType: string): string {
    // First try to get extension from filename
    const fileNameExt = fileName.split('.').pop()?.toLowerCase();
    if (fileNameExt && ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'].includes(fileNameExt)) {
      return fileNameExt;
    }

    // Fallback to MIME type mapping
    const mimeToExtension: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
    };

    return mimeToExtension[mimeType] || 'bin';
  }

  /**
   * Get file size in MB
   */
  private async getFileSizeInMB(fileUri: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && 'size' in fileInfo) {
        return fileInfo.size / (1024 * 1024); // Convert bytes to MB
      }
      return 0;
    } catch {
      return 0;
    }
  }
}

export const storyUploadService = new StoryUploadService();