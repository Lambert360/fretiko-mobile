import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

// Mirrors backend src/ai/dto/ai.dto.ts
export enum AiResponseType {
  TEXT = 'text',
  PRODUCTS = 'products',
  VENDORS = 'vendors',
  COMPARISON = 'comparison',
  TRENDING = 'trending',
  ACTIONS = 'actions',
  THINKING = 'thinking',
}

export interface AiAction {
  id: string;
  type: 'save' | 'follow' | 'alert' | 'draft' | 'compare' | 'view' | 'cart';
  label: string;
  payload: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface AiStreamingResponse {
  type: AiResponseType;
  content?: string;
  data?: any;
  actions?: AiAction[];
  metadata?: any;
}

export interface AiRecommendedProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  vendor_username?: string;
}

export interface AiRecommendedVendor {
  id: string;
  username: string;
  avatar_url?: string;
  is_verified?: boolean;
  bio?: string;
  location?: string;
}

export interface AiChatResult {
  text: string;
  conversationId: string;
  recommendedProducts?: AiRecommendedProduct[];
  recommendedVendors?: AiRecommendedVendor[];
  actions?: AiAction[];
  error?: string;
  errorMessage?: string;
}

export interface AiConversationSummary {
  id: string;
  [key: string]: any;
}

export interface PriceAlert {
  id: string;
  productQuery: string;
  productId?: string;
  targetPrice?: number;
  [key: string]: any;
}

const CONVERSATION_KEY_PREFIX = 'ai_assistant_conversation_';

class AiAssistantAPI {
  /**
   * Send a text message to the backend RAG AI assistant (product/vendor
   * search, comparisons, trending, general chat). Automatically persists
   * and reuses the backend conversation ID for a given Fretiko chat ID.
   */
  async sendMessage(chatId: string, message: string): Promise<AiChatResult> {
    let conversationId: string | undefined;
    try {
      conversationId = await this.getStoredConversationId(chatId);

      const response = await api.post('/ai/chat', {
        message,
        conversationId,
      });

      const data = response.data as {
        conversationId: string;
        responses: AiStreamingResponse[];
      };

      await this.storeConversationId(chatId, data.conversationId);

      return this.parseResponses(data.conversationId, data.responses);
    } catch (error: any) {
      console.error('Error sending message to AI assistant:', error);
      return {
        text: '',
        conversationId: conversationId || '',
        error: 'AI_REQUEST_FAILED',
        errorMessage: "I'm having trouble connecting right now. Please try again in a moment! 🔧",
      };
    }
  }

  private parseResponses(
    conversationId: string,
    responses: AiStreamingResponse[]
  ): AiChatResult {
    const textParts: string[] = [];
    let recommendedProducts: AiRecommendedProduct[] | undefined;
    let recommendedVendors: AiRecommendedVendor[] | undefined;
    let actions: AiAction[] | undefined;

    for (const r of responses || []) {
      switch (r.type) {
        case AiResponseType.TEXT:
          if (r.content) textParts.push(r.content);
          break;

        case AiResponseType.PRODUCTS:
        case AiResponseType.COMPARISON:
          if (Array.isArray(r.data)) {
            recommendedProducts = r.data.slice(0, 3).map((p: any) => ({
              id: p.id,
              name: p.name || p.title,
              price: Number(p.price) || 0,
              image: p.primary_image_url || p.images?.[0] || p.image || 'https://via.placeholder.com/60',
              vendor_username: p.username || p.seller?.name || p.sellerName,
            }));
          }
          break;

        case AiResponseType.VENDORS:
          if (Array.isArray(r.data)) {
            recommendedVendors = r.data.slice(0, 3).map((v: any) => ({
              id: v.id,
              username: v.username,
              avatar_url: v.avatar_url,
              is_verified: v.is_verified,
              bio: v.bio,
              location: v.location,
            }));
          }
          break;

        case AiResponseType.TRENDING:
          if (Array.isArray(r.data?.products)) {
            recommendedProducts = r.data.products.slice(0, 3).map((p: any) => ({
              id: p.id,
              name: p.name || p.title,
              price: Number(p.price) || 0,
              image: p.primary_image_url || p.images?.[0] || 'https://via.placeholder.com/60',
              vendor_username: p.username,
            }));
          }
          break;

        case AiResponseType.ACTIONS:
          actions = r.actions;
          break;

        case AiResponseType.THINKING:
        default:
          break;
      }
    }

    return {
      text: textParts.join('\n\n') || 'I understand.',
      conversationId,
      recommendedProducts,
      recommendedVendors,
      actions,
    };
  }

  async getConversations(limit = 20): Promise<AiConversationSummary[]> {
    try {
      const response = await api.get('/ai/conversations', { params: { limit } });
      return response.data.conversations || [];
    } catch (error) {
      console.error('Error fetching AI conversations:', error);
      return [];
    }
  }

  async getConversationHistory(conversationId: string): Promise<any[]> {
    try {
      const response = await api.get(`/ai/conversations/${conversationId}`);
      return response.data.messages || [];
    } catch (error) {
      console.error('Error fetching AI conversation history:', error);
      return [];
    }
  }

  async getPriceAlerts(): Promise<PriceAlert[]> {
    try {
      const response = await api.get('/ai/price-alerts');
      return response.data.alerts || [];
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      return [];
    }
  }

  async createPriceAlert(dto: {
    productQuery: string;
    productId?: string;
    targetPrice?: number;
  }): Promise<PriceAlert | null> {
    try {
      const response = await api.post('/ai/price-alerts', dto);
      return response.data.alert;
    } catch (error) {
      console.error('Error creating price alert:', error);
      return null;
    }
  }

  async deletePriceAlert(alertId: string): Promise<boolean> {
    try {
      await api.delete(`/ai/price-alerts/${alertId}`);
      return true;
    } catch (error) {
      console.error('Error deleting price alert:', error);
      return false;
    }
  }

  async clearConversation(chatId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CONVERSATION_KEY_PREFIX}${chatId}`);
    } catch (error) {
      console.error('Error clearing AI assistant conversation:', error);
    }
  }

  private async getStoredConversationId(chatId: string): Promise<string | undefined> {
    try {
      const value = await AsyncStorage.getItem(`${CONVERSATION_KEY_PREFIX}${chatId}`);
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  private async storeConversationId(chatId: string, conversationId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`${CONVERSATION_KEY_PREFIX}${chatId}`, conversationId);
    } catch (error) {
      console.error('Error storing AI assistant conversation ID:', error);
    }
  }
}

export const aiAssistantAPI = new AiAssistantAPI();
