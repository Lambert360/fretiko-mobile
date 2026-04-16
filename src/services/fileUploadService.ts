import { StorageClient } from '@supabase/storage-js';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import Supabase configuration from centralized config (keys now loaded from env variables)
import { supabaseStorage } from '../config/supabase';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export interface UploadResult {
  publicUrl: string;
  path: string;
  success: boolean;
  error?: string;
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

// Create an authenticated storage client with user token
const createStorageClient = async () => {
  const { token } = await getCurrentUser();
  return new StorageClient(`${supabaseUrl}/storage/v1`, {
    apikey: supabaseAnonKey,
    authorization: `Bearer ${token}`,
    'X-Client-Info': 'fretiko-mobile',
  });
};

// Check if Supabase Storage is properly configured
const isSupabaseConfigured = () => {
  try {
    return !!(supabaseUrl && supabaseAnonKey);
  } catch (error) {
    console.error('Supabase configuration error:', error);
    return false;
  }
};

class FileUploadService {
  private readonly bucketName = 'media';

  /**
   * Upload a file to Supabase Storage
   * @param fileUri Local file URI from device
   * @param fileName Original file name or custom name
   * @param fileType MIME type (e.g., 'image/jpeg', 'video/mp4')
   * @returns Promise with upload result
   */
  async uploadFile(fileUri: string, fileName: string, fileType: string): Promise<UploadResult> {
    try {
      console.log('📤 Starting file upload:', { fileUri, fileName, fileType });

      // Check if Supabase Storage is configured
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase storage not configured. Please update your Supabase URL and key in config/supabase.ts');
      }

      // Get current user from mobile app's auth system
      const { user, token } = await getCurrentUser();
      console.log('👤 Current user for upload:', user.id);

      const fileExtension = this.getFileExtension(fileName, fileType);
      const uniqueFileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

      // Read file as base64
      console.log('📖 Reading file from device...');
      const fileData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
      });

      // Convert base64 to Uint8Array
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Create authenticated storage client with user token
      const storageClient = await createStorageClient();

      // Upload to Supabase Storage
      console.log('☁️ Uploading to Supabase Storage...');
      const { data, error } = await storageClient
        .from(this.bucketName)
        .upload(uniqueFileName, byteArray, {
          contentType: fileType,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('❌ Upload failed:', error);
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

      console.log('✅ Upload successful:', publicUrlData.publicUrl);

      return {
        publicUrl: publicUrlData.publicUrl,
        path: data.path,
        success: true,
      };

    } catch (error) {
      console.error('💥 File upload error:', error);
      return {
        publicUrl: '',
        path: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Upload multiple files
   * @param files Array of file objects with uri, name, and type
   * @returns Promise with array of upload results
   */
  async uploadMultipleFiles(files: Array<{ uri: string; name: string; type: string }>): Promise<UploadResult[]> {
    console.log('📤 Starting batch upload of', files.length, 'files');
    
    const uploadPromises = files.map(file => 
      this.uploadFile(file.uri, file.name, file.type)
    );

    const results = await Promise.all(uploadPromises);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Batch upload complete: ${successCount}/${files.length} successful`);
    
    return results;
  }

  /**
   * Delete a file from Supabase Storage
   * @param filePath The path of the file to delete
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const storageClient = await createStorageClient();
      const { error } = await storageClient
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('❌ Delete failed:', error);
        return false;
      }

      console.log('✅ File deleted:', filePath);
      return true;
    } catch (error) {
      console.error('💥 Delete error:', error);
      return false;
    }
  }

  /**
   * Get file extension from filename or MIME type
   */
  private getFileExtension(fileName: string, mimeType: string): string {
    // First try to get extension from filename
    const fileNameExt = fileName.split('.').pop()?.toLowerCase();
    if (fileNameExt && ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi'].includes(fileNameExt)) {
      return fileNameExt;
    }

    // Fallback to MIME type mapping
    const mimeToExtension: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png', 
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
    };

    return mimeToExtension[mimeType] || 'bin';
  }

  /**
   * Check if file type is supported
   */
  isFileTypeSupported(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo'
    ];
    return supportedTypes.includes(mimeType);
  }

  /**
   * Get file size in MB
   */
  async getFileSizeInMB(fileUri: string): Promise<number> {
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

  /**
   * Validate file before upload
   */
  async validateFile(fileUri: string, mimeType: string): Promise<{ valid: boolean; error?: string }> {
    // Check file type
    if (!this.isFileTypeSupported(mimeType)) {
      return { valid: false, error: 'File type not supported' };
    }

    // Check file size (50MB limit)
    const sizeInMB = await this.getFileSizeInMB(fileUri);
    if (sizeInMB > 50) {
      return { valid: false, error: 'File size exceeds 50MB limit' };
    }

    return { valid: true };
  }
}

export const fileUploadService = new FileUploadService();