import { api } from './api';

export interface TagContentItem {
  id: string;
  type: 'post' | 'product' | 'service' | 'story';
  title: string;
  content: string;
  image?: string;
  createdAt?: string;
  authorId?: string;
}

export const tagsAPI = {
  getTagContent: async (tag: string, limit: number = 50, offset: number = 0): Promise<TagContentItem[]> => {
    const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
    const response = await api.get(`/tags/${encodeURIComponent(cleanTag)}/content`, {
      params: { limit, offset },
    });
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? data : (data?.items || []);
  },
};

export default tagsAPI;
