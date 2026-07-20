import { api } from './api';

export enum InvoiceItemType {
  PRODUCT = 'product',
  SERVICE = 'service',
}

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface InvoiceItem {
  id?: string;
  itemType: InvoiceItemType;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  totalPrice?: number;
  imageUrl?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  productId?: string;
  serviceId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  conversationId: string;
  messageId: string;
  vendorId: string;
  buyerId: string;
  totalAmount: number;
  status: InvoiceStatus;
  expiresAt: string;
  paidAt?: string;
  orderId?: string;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceRequest {
  conversationId: string;
  items: InvoiceItem[];
}

export interface UpdateInvoiceRequest {
  items?: InvoiceItem[];
  status?: InvoiceStatus;
}

class InvoiceAPI {
  /**
   * Upload an invoice item image and return its public URL.
   * Must be called BEFORE createInvoice/updateInvoice so the local device URI
   * is never sent as the imageUrl (it would be unreachable on other devices).
   */
  async uploadInvoiceItemImage(imageUri: string): Promise<string> {
    try {
      const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: mimeType,
        name: `invoice_item.${fileExtension}`,
      } as any);

      const response = await api.post('/chat/invoices/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data.imageUrl;
    } catch (error: any) {
      console.error('❌ Error uploading invoice item image:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(error.response?.data?.message || 'Failed to upload image');
    }
  }

  /**
   * Create a new invoice
   */
  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    try {
      console.log('📤 Sending invoice creation request:', JSON.stringify(data, null, 2));
      const response = await api.post('/chat/invoices', data);
      console.log('📥 Invoice creation response:', JSON.stringify(response.data, null, 2));
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Error creating invoice in API layer:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        },
      });
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice> {
    try {
      const response = await api.get(`/chat/invoices/${invoiceId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }
  }

  /**
   * Update invoice (vendor only)
   */
  async updateInvoice(invoiceId: string, data: UpdateInvoiceRequest): Promise<Invoice> {
    try {
      const response = await api.put(`/chat/invoices/${invoiceId}`, data);
      return response.data.data;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  }

  /**
   * Cancel invoice (vendor only)
   */
  async cancelInvoice(invoiceId: string): Promise<void> {
    try {
      await api.delete(`/chat/invoices/${invoiceId}`);
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      throw error;
    }
  }

  /**
   * Helper: Calculate total amount from items
   */
  calculateTotal(items: InvoiceItem[]): number {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  /**
   * Helper: Check if invoice is expired
   */
  isInvoiceExpired(invoice: Invoice): boolean {
    return new Date(invoice.expiresAt) < new Date() && invoice.status === InvoiceStatus.PENDING;
  }

  /**
   * Helper: Get time remaining until expiration
   */
  getTimeRemaining(invoice: Invoice): string {
    const now = new Date();
    const expires = new Date(invoice.expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }

  /**
   * Helper: Format invoice status for display
   */
  getStatusDisplay(status: InvoiceStatus): { text: string; color: string } {
    switch (status) {
      case InvoiceStatus.PENDING:
        return { text: 'Pending', color: '#F39C12' };
      case InvoiceStatus.PAID:
        return { text: 'Paid', color: '#27AE60' };
      case InvoiceStatus.EXPIRED:
        return { text: 'Expired', color: '#E74C3C' };
      case InvoiceStatus.CANCELLED:
        return { text: 'Cancelled', color: '#95A5A6' };
      default:
        return { text: 'Unknown', color: '#7F8C8D' };
    }
  }
}

export const invoiceAPI = new InvoiceAPI();
