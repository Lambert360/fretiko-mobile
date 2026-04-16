import { api } from './api';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

export interface RiderVerificationData {
  fullName: string;
  country: string;
  state: string;
  city: string;
  vehicleType: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  licensePlate?: string;
  worksForCompany: boolean;
  companyId?: string;
  companyName?: string;
  driverLicenseUrl?: string;
  vehicleRegistrationUrl?: string;
  insuranceDocumentUrl?: string;
  profilePhotoUrl?: string;
  yearsExperience?: number;
  previousCompanies?: string[];
}

export interface VerificationResponse {
  success: boolean;
  message: string;
  trackingId?: string;
}

export interface VerificationStatus {
  id: string;
  status: 'in_progress' | 'under_review' | 'verified' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
}

export interface LogisticsPartner {
  id: string;
  company_name: string;
  contact_email: string;
  service_areas: string[];
  partner_status: string;
}

export interface DocumentUploadResponse {
  url: string;
  filename: string;
  size: number;
}

const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('accessToken');
  return token ? { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  } : { 'Content-Type': 'application/json' };
};

export const riderVerificationAPI = {
  // Submit verification request
  submitVerification: async (data: RiderVerificationData): Promise<VerificationResponse> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.post('/rider-verification/apply', data, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Rider verification submission error:', error);
      throw new Error(error.response?.data?.message || 'Failed to submit verification request');
    }
  },

  // Check verification status
  checkStatus: async (userId: string): Promise<VerificationStatus> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get(`/rider-verification/status/${userId}`, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Check verification status error:', error);
      throw new Error(error.response?.data?.message || 'Failed to check verification status');
    }
  },

  // Upload document
  uploadDocument: async (file: ImagePicker.ImagePickerAsset, type: string): Promise<DocumentUploadResponse> => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      
      // Create form data for file upload
      const formData = new FormData();
      
      // Get file info
      const fileInfo = await fetch(file.uri);
      const blob = await fileInfo.blob();
      
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'image/jpeg',
        name: `${type}_${Date.now()}.jpg`,
      } as any);
      
      formData.append('type', type);
      formData.append('userId', await SecureStore.getItemAsync('userId') || '');

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/rider-verification/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }

      return response.json();
    } catch (error: any) {
      console.error('Document upload error:', error);
      throw new Error(error.message || 'Failed to upload document');
    }
  },

  // Get available companies for selection
  getCompanies: async (): Promise<LogisticsPartner[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/logistics-partners/verified', { headers });
      return response.data;
    } catch (error: any) {
      console.error('Get companies error:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch companies');
    }
  },

  // Get verification requirements
  getRequirements: async (): Promise<{
    vehicleTypes: string[];
    documentTypes: string[];
    maxFileSize: number;
    allowedFileTypes: string[];
  }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/rider-verification/requirements', { headers });
      return response.data;
    } catch (error: any) {
      console.error('Get requirements error:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch requirements');
    }
  },

  // Delete uploaded document
  deleteDocument: async (documentUrl: string): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      await api.delete(`/rider-verification/document/${encodeURIComponent(documentUrl)}`, { headers });
    } catch (error: any) {
      console.error('Delete document error:', error);
      throw new Error(error.response?.data?.message || 'Failed to delete document');
    }
  },

  // Update verification request (if not yet reviewed)
  updateVerification: async (data: Partial<RiderVerificationData>): Promise<VerificationResponse> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.patch('/rider-verification/update', data, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Update verification error:', error);
      throw new Error(error.response?.data?.message || 'Failed to update verification request');
    }
  },

  // Get verification history
  getHistory: async (): Promise<VerificationStatus[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await api.get('/rider-verification/history', { headers });
      return response.data;
    } catch (error: any) {
      console.error('Get verification history error:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch verification history');
    }
  }
};
