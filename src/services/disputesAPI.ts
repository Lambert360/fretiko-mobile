import { api } from './api';

export interface Dispute {
  id: string;
  disputeCategory: 'order_dispute' | 'bug_report' | 'general';
  orderId?: string;
  escrowId?: string;
  disputantId: string;
  respondentId?: string;
  disputeType: string;
  status: 'open' | 'under_review' | 'resolved' | 'cancelled';
  reason: string;
  description?: string;
  evidence?: Array<{ type: 'image' | 'document'; url: string; description: string }>;
  resolution?: string;
  resolutionReason?: string;
  resolutionAmount?: number;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    order_number: string;
    status: string;
    total_amount: string;
  };
}

export interface DisputeMessage {
  id: string;
  message: string;
  senderId: string;
  senderName?: string;
  isAdminMessage: boolean;
  isStaffMessage?: boolean;
  attachments?: Array<{ type: string; url: string }>;
  createdAt: string;
}

export interface DisputeDetail extends Dispute {
  messages: DisputeMessage[];
}

export interface CreateDisputeRequest {
  // Dispute category (customer care only)
  disputeCategory: 'order_dispute' | 'bug_report' | 'general';
  
  // Order dispute fields (optional)
  orderId?: string;
  
  // Dispute type (varies by category)
  disputeType: 
    // Order dispute types
    | 'item_not_received' | 'item_not_as_described' | 'damaged_item' | 'wrong_item' | 'refund_request' | 'quality_issue' | 'delivery_issue'
    // Bug report types
    | 'app_crash' | 'payment_issue' | 'login_issue' | 'feature_not_working' | 'performance_issue'
    // General
    | 'other';
  
  reason: string;
  description?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  evidence?: Array<{ type: 'image' | 'document'; url: string; description: string }>;
}

class DisputesAPI {
  /**
   * Create a new dispute for an order
   */
  async createDispute(request: CreateDisputeRequest): Promise<Dispute> {
    try {
      const response = await api.post<Dispute>('/disputes', request);
      return response.data;
    } catch (error: any) {
      console.error('Error creating dispute:', error);
      throw new Error(error.response?.data?.message || 'Failed to create dispute');
    }
  }

  /**
   * Get all disputes for the current user
   */
  async getMyDisputes(): Promise<Dispute[]> {
    try {
      const response = await api.get<Dispute[]>('/disputes/my-disputes');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching disputes:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch disputes');
    }
  }

  /**
   * Get dispute details by ID
   */
  async getDispute(disputeId: string): Promise<DisputeDetail> {
    try {
      const response = await api.get<DisputeDetail>(`/disputes/${disputeId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching dispute:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch dispute');
    }
  }

  /**
   * Send a message to a dispute thread
   */
  async sendMessage(
    disputeId: string,
    message: string,
    attachments?: Array<{ type: string; url: string }>,
  ): Promise<{ success: boolean; messageId: string }> {
    try {
      const response = await api.post<{ success: boolean; messageId: string }>(
        `/disputes/${disputeId}/messages`,
        { message, attachments },
      );
      return response.data;
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw new Error(error.response?.data?.message || 'Failed to send message');
    }
  }
}

export const disputesAPI = new DisputesAPI();

