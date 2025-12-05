import { API_CONFIG } from '../config/api';

export type ReportCategory = 'product' | 'service' | 'chat' | 'user';
export type ReportType = 
  | 'inappropriate_content' | 'spam' | 'fraudulent_listing' | 'copyright_violation' | 'misleading_information'
  | 'harassment' | 'spam_messages' | 'inappropriate_language' | 'threats'
  | 'suspicious_activity' | 'fake_account' | 'scam_attempt'
  | 'other';

export interface CreateContentReportRequest {
  reportCategory: ReportCategory;
  productId?: string;
  serviceId?: string;
  chatId?: string;
  reportedUserId?: string;
  reportType: ReportType;
  reason: string;
  description?: string;
  evidence?: Array<{ type: 'image' | 'document'; url: string; description: string }>;
}

export interface ContentReport {
  id: string;
  reporterId: string;
  reportCategory: ReportCategory;
  productId?: string;
  serviceId?: string;
  chatId?: string;
  reportedUserId?: string;
  reportType: ReportType;
  status: 'pending' | 'under_review' | 'approved' | 'action_taken' | 'dismissed';
  reason: string;
  description?: string;
  evidence?: any[];
  actionTaken?: string;
  actionReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

class ContentReportsAPI {
  private baseUrl = `${API_CONFIG.BASE_URL}/content-reports`;

  async createContentReport(request: CreateContentReportRequest, token: string): Promise<ContentReport> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create content report');
    }

    return response.json();
  }

  async getMyReports(token: string): Promise<ContentReport[]> {
    const response = await fetch(`${this.baseUrl}/my-reports`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch reports');
    }

    return response.json();
  }

  async getContentReport(reportId: string, token: string): Promise<ContentReport> {
    const response = await fetch(`${this.baseUrl}/${reportId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch report');
    }

    return response.json();
  }

  async addMessage(reportId: string, message: string, attachments: Array<{ type: string; url: string }>, token: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${reportId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, attachments }),
    });

    if (!response.ok) {
      throw new Error('Failed to add message');
    }

    return response.json();
  }
}

export const contentReportsAPI = new ContentReportsAPI();

