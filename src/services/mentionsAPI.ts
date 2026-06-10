import { api } from './api';

export type MentionableType = 'post' | 'product' | 'service' | 'comment' | 'story';

export interface Mention {
  id: string;
  mentioned_user_id: string;
  mentioner_user_id: string;
  mentionable_id: string;
  mentionable_type: MentionableType;
  is_read: boolean;
  created_at: string;
  mentioner?: {
    username: string;
    avatarUrl?: string | null;
  } | null;
}

export interface MentionListOptions {
  limit?: number;
  offset?: number;
}

export const mentionsAPI = {
  async getMyMentions(options: MentionListOptions = {}): Promise<Mention[]> {
    const params: any = {};
    if (typeof options.limit === 'number') params.limit = options.limit;
    if (typeof options.offset === 'number') params.offset = options.offset;

    const response = await api.get('/mentions/me', { params });
    return response.data as Mention[];
  },

  async resolveCommentParent(commentId: string): Promise<{ parent_type: 'post' | 'story'; parent_id: string } | null> {
    const response = await api.get(`/mentions/resolve-comment/${commentId}`);
    return response.data || null;
  },

  async markAllRead(): Promise<void> {
    await api.patch('/mentions/me/read-all');
  },
};

export default mentionsAPI;
