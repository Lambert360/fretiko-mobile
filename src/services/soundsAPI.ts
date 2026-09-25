/**
 * Sounds API
 * Live-stream soundboard: platform sounds + host's own uploads +
 * the host's 3 quick-play slot assignments.
 */

import { api } from './api';

export interface StreamSound {
  id: string;
  name: string;
  sound_url: string;
  is_active: boolean;
  sort_order: number;
  context?: 'gift' | 'live_stream';
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoundLibrary {
  platform: StreamSound[];
  mine: StreamSound[];
  /**
   * The host's 3 quick-play slots. Each entry is either a sounds-table
   * UUID or a 'builtin:*' key (builtin:cheer | builtin:clap | builtin:laugh).
   */
  primaries: string[];
}

export const BUILTIN_SOUND_IDS = {
  cheer: 'builtin:cheer',
  clap: 'builtin:clap',
  laugh: 'builtin:laugh',
} as const;

export const isBuiltinSoundId = (id: string) => id.startsWith('builtin:');

export const soundsAPI = {
  /**
   * Get the host's soundboard library
   * GET /sounds/live-stream/library
   */
  getLibrary: async (): Promise<SoundLibrary> => {
    const response = await api.get<SoundLibrary>('/sounds/live-stream/library');
    return response.data;
  },

  /**
   * Upload a custom sound
   * POST /sounds/live-stream (multipart: file + name)
   */
  uploadSound: async (file: { uri: string; name: string; mimeType?: string }): Promise<StreamSound> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'audio/mpeg',
    } as any);
    formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

    const response = await api.post<StreamSound>('/sounds/live-stream', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Delete one of the host's own sounds
   * DELETE /sounds/live-stream/:id
   */
  deleteSound: async (soundId: string): Promise<void> => {
    await api.delete(`/sounds/live-stream/${soundId}`);
  },

  /**
   * Save the host's 3 quick-play slots
   * PUT /sounds/live-stream/primaries
   */
  setPrimaries: async (primaries: string[]): Promise<string[]> => {
    const response = await api.put<{ primaries: string[] }>('/sounds/live-stream/primaries', {
      primaries,
    });
    return response.data.primaries;
  },
};
