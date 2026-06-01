import { API_BASE_URL } from '../config/api';
import * as SecureStore from 'expo-secure-store';

export interface VideoProcessingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    processedVideoUrl: string;
    metadata: any;
  };
}

export class BackgroundVideoService {
  private baseUrl = `${API_BASE_URL}/api/video-processing`;

  /**
   * Get processing status for a specific entity (service/product/post_media)
   */
  async getEntityStatus(
    entityType: 'service' | 'product' | 'post_media',
    entityId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(
        `${this.baseUrl}/entity-status/${entityType}/${entityId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get entity status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add video to background processing queue
   */
  async addVideoToQueue(videoUrl: string, options: {
    platform?: 'android' | 'ios' | 'web';
    priority?: 'low' | 'medium' | 'high';
  } = {}): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.baseUrl}/queue-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoUrl,
          platform: options.platform || 'android',
          priority: options.priority || 'medium'
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('📋 Video added to processing queue:', data.jobId);
        return { success: true, jobId: data.jobId };
      } else {
        return { success: false, error: data.error };
      }

    } catch (error) {
      console.error('Failed to add video to queue:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{ success: boolean; job?: VideoProcessingJob; error?: string }> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.baseUrl}/job-status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, job: data.job };
      } else {
        return { success: false, error: data.error };
      }

    } catch (error) {
      console.error('Failed to get job status:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get user's processing jobs
   */
  async getUserJobs(): Promise<{ success: boolean; jobs?: VideoProcessingJob[]; error?: string }> {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.baseUrl}/my-jobs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, jobs: data.jobs };
      } else {
        return { success: false, error: data.error };
      }

    } catch (error) {
      console.error('Failed to get user jobs:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Poll job status until completion
   */
  async waitForJobCompletion(jobId: string, options: {
    maxWaitTime?: number; // milliseconds
    pollInterval?: number; // milliseconds
    onProgress?: (status: VideoProcessingJob) => void;
  } = {}): Promise<{ success: boolean; job?: VideoProcessingJob; error?: string }> {
    const {
      maxWaitTime = 300000, // 5 minutes
      pollInterval = 5000, // 5 seconds
      onProgress
    } = options;

    const startTime = Date.now();
    let lastStatus: VideoProcessingJob | null = null;

    while (Date.now() - startTime < maxWaitTime) {
      const result = await this.getJobStatus(jobId);
      
      if (!result.success || !result.job) {
        return { success: false, error: result.error };
      }

      lastStatus = result.job;
      
      // Call progress callback
      if (onProgress) {
        onProgress(lastStatus);
      }

      // Check if job is complete
      if (lastStatus.status === 'completed') {
        console.log('✅ Video processing completed:', jobId);
        return { success: true, job: lastStatus };
      }

      // Check if job failed
      if (lastStatus.status === 'failed') {
        console.error('❌ Video processing failed:', jobId, lastStatus.error);
        return { success: false, error: lastStatus.error };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout reached
    return { 
      success: false, 
      error: 'Processing timeout. Please check status later.',
      job: lastStatus || undefined
    };
  }

  /**
   * Process video with automatic fallback to original if processing fails
   */
  async processVideoWithFallback(videoUrl: string, options: {
    platform?: 'android' | 'ios' | 'web';
    priority?: 'low' | 'medium' | 'high';
    maxWaitTime?: number;
    onProgress?: (status: VideoProcessingJob) => void;
  } = {}): Promise<{ 
    success: boolean; 
    videoUrl: string; 
    wasProcessed: boolean;
    error?: string;
  }> {
    try {
      console.log('🔄 Starting background video processing...');

      // Add to processing queue
      const queueResult = await this.addVideoToQueue(videoUrl, options);
      
      if (!queueResult.success || !queueResult.jobId) {
        console.log('⚠️ Failed to add to queue, using original video');
        return { 
          success: true, 
          videoUrl, 
          wasProcessed: false,
          error: queueResult.error
        };
      }

      // Wait for processing to complete
      const completionResult = await this.waitForJobCompletion(queueResult.jobId, {
        maxWaitTime: options.maxWaitTime,
        onProgress: options.onProgress
      });

      if (completionResult.success && completionResult.job?.result?.processedVideoUrl) {
        console.log('✅ Video processing successful, using processed version');
        return {
          success: true,
          videoUrl: completionResult.job.result.processedVideoUrl,
          wasProcessed: true
        };
      } else {
        console.log('⚠️ Processing failed or timed out, using original video');
        return {
          success: true,
          videoUrl,
          wasProcessed: false,
          error: completionResult.error
        };
      }

    } catch (error) {
      console.error('Video processing error:', error);
      return {
        success: true,
        videoUrl,
        wasProcessed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const backgroundVideoService = new BackgroundVideoService();
