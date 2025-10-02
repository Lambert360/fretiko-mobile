import { api } from './api';

// Interfaces matching backend DTOs
export interface IkoPreferences {
  budget_ranges: {
    [category: string]: number;
  };
  favorite_categories: string[];
  preferred_times: {
    [activity: string]: string;
  };
  communication_style: 'formal' | 'friendly' | 'casual' | 'professional';
  location_preferences: string;
  notification_preferences: {
    proactive_suggestions: boolean;
    price_alerts: boolean;
    plan_reminders: boolean;
  };
}

export interface IkoContext {
  first_interaction: boolean;
  last_conversation: string | null;
  ongoing_plans: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    scheduledFor?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    createdAt: string;
    updatedAt?: string;
    notes?: string;
  }>;
  learned_patterns: {
    [key: string]: any;
  };
  conversation_count: number;
  preferences_learned: boolean;
  last_interaction_type?: 'text' | 'voice' | 'call';
  last_interaction_summary?: string;
}

export interface IkoUserProfile {
  userId: string;
  username: string;
  location?: string;
  memberSince: string;
  preferences: IkoPreferences;
  context: IkoContext;
}

export interface UpdateIkoPreferencesRequest {
  budget_ranges?: { [category: string]: number };
  favorite_categories?: string[];
  preferred_times?: { [activity: string]: string };
  communication_style?: 'formal' | 'friendly' | 'casual' | 'professional';
  location_preferences?: string;
  notification_preferences?: {
    proactive_suggestions?: boolean;
    price_alerts?: boolean;
    plan_reminders?: boolean;
  };
}

export interface UpdateIkoContextRequest {
  first_interaction?: boolean;
  last_conversation?: string;
  ongoing_plans?: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    scheduledFor?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    createdAt: string;
    updatedAt?: string;
    notes?: string;
  }>;
  learned_patterns?: { [key: string]: any };
  conversation_count?: number;
  preferences_learned?: boolean;
  last_interaction_type?: 'text' | 'voice' | 'call';
  last_interaction_summary?: string;
}

export interface CreateOngoingPlanRequest {
  type: string;
  title: string;
  description?: string;
  scheduledFor?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface UpdateOngoingPlanRequest {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  description?: string;
  scheduledFor?: string;
}

export interface RecordConversationRequest {
  interactionType: 'text' | 'voice' | 'call';
  summary?: string;
}

class IkoAPI {
  private token: string | null = null;

  setAuthToken(token: string) {
    this.token = token;
  }

  /**
   * Get user's complete Iko profile (preferences + context + user info)
   */
  async getIkoProfile(): Promise<IkoUserProfile> {
    try {
      const response = await api.get('/iko/profile');
      return response.data;
    } catch (error) {
      console.error('Error fetching Iko profile:', error);
      throw error;
    }
  }

  /**
   * Get user's Iko preferences
   */
  async getIkoPreferences(): Promise<{
    preferences: IkoPreferences;
    lastUpdated: string;
  }> {
    try {
      const response = await api.get('/iko/preferences');
      return response.data;
    } catch (error) {
      console.error('Error fetching Iko preferences:', error);
      throw error;
    }
  }

  /**
   * Update user's Iko preferences
   */
  async updateIkoPreferences(updates: UpdateIkoPreferencesRequest): Promise<{
    preferences: IkoPreferences;
    lastUpdated: string;
  }> {
    try {
      const response = await api.put('/iko/preferences', updates);
      return response.data;
    } catch (error) {
      console.error('Error updating Iko preferences:', error);
      throw error;
    }
  }

  /**
   * Get user's Iko context
   */
  async getIkoContext(): Promise<{
    context: IkoContext;
    lastUpdated: string;
  }> {
    try {
      const response = await api.get('/iko/context');
      return response.data;
    } catch (error) {
      console.error('Error fetching Iko context:', error);
      throw error;
    }
  }

  /**
   * Update user's Iko context
   */
  async updateIkoContext(updates: UpdateIkoContextRequest): Promise<{
    context: IkoContext;
    lastUpdated: string;
  }> {
    try {
      const response = await api.put('/iko/context', updates);
      return response.data;
    } catch (error) {
      console.error('Error updating Iko context:', error);
      throw error;
    }
  }

  /**
   * Record a conversation interaction
   */
  async recordConversation(data: RecordConversationRequest): Promise<void> {
    try {
      await api.post('/iko/conversation', data);
    } catch (error) {
      console.error('Error recording conversation:', error);
      // Don't throw error as this is a tracking function
    }
  }

  /**
   * Add an ongoing plan
   */
  async addOngoingPlan(plan: CreateOngoingPlanRequest): Promise<{
    message: string;
    planId: string;
  }> {
    try {
      const response = await api.post('/iko/plans', plan);
      return response.data;
    } catch (error) {
      console.error('Error adding ongoing plan:', error);
      throw error;
    }
  }

  /**
   * Update an ongoing plan
   */
  async updateOngoingPlan(planId: string, updates: UpdateOngoingPlanRequest): Promise<{
    message: string;
  }> {
    try {
      const response = await api.put(`/iko/plans/${planId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating ongoing plan:', error);
      throw error;
    }
  }

  /**
   * Get ongoing plans
   */
  async getOngoingPlans(): Promise<{ plans: IkoContext['ongoing_plans'] }> {
    try {
      const response = await api.get('/iko/plans');
      return response.data;
    } catch (error) {
      console.error('Error fetching ongoing plans:', error);
      throw error;
    }
  }

  /**
   * Helper: Update budget for a specific category
   */
  async updateBudgetForCategory(category: string, amount: number): Promise<void> {
    try {
      const { preferences } = await this.getIkoPreferences();
      const updatedBudgetRanges = {
        ...preferences.budget_ranges,
        [category]: amount,
      };

      await this.updateIkoPreferences({
        budget_ranges: updatedBudgetRanges,
      });
    } catch (error) {
      console.error('Error updating budget for category:', error);
      throw error;
    }
  }

  /**
   * Helper: Add favorite category
   */
  async addFavoriteCategory(category: string): Promise<void> {
    try {
      const { preferences } = await this.getIkoPreferences();
      if (!preferences.favorite_categories.includes(category)) {
        const updatedCategories = [...preferences.favorite_categories, category];
        await this.updateIkoPreferences({
          favorite_categories: updatedCategories,
        });
      }
    } catch (error) {
      console.error('Error adding favorite category:', error);
      throw error;
    }
  }

  /**
   * Helper: Remove favorite category
   */
  async removeFavoriteCategory(category: string): Promise<void> {
    try {
      const { preferences } = await this.getIkoPreferences();
      const updatedCategories = preferences.favorite_categories.filter(cat => cat !== category);
      await this.updateIkoPreferences({
        favorite_categories: updatedCategories,
      });
    } catch (error) {
      console.error('Error removing favorite category:', error);
      throw error;
    }
  }

  /**
   * Helper: Mark first interaction as complete
   */
  async completeFirstInteraction(): Promise<void> {
    try {
      await this.updateIkoContext({
        first_interaction: false,
      });
    } catch (error) {
      console.error('Error completing first interaction:', error);
      throw error;
    }
  }

  /**
   * Helper: Mark preferences as learned
   */
  async markPreferencesAsLearned(): Promise<void> {
    try {
      await this.updateIkoContext({
        preferences_learned: true,
      });
    } catch (error) {
      console.error('Error marking preferences as learned:', error);
      throw error;
    }
  }
}

export const ikoAPI = new IkoAPI();