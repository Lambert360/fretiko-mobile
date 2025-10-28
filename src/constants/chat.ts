// Chat-related constants

// AI Assistant UUID - Fixed UUID for the AI assistant participant
export const AI_ASSISTANT_UUID = '00000000-0000-4000-8000-000000000001';

// AI Assistant Display Name
export const AI_ASSISTANT_NAME = 'Iko';

// AI Assistant Avatar (Local Image)
export const AI_ASSISTANT_AVATAR = require('../../assets/images/moses.jpeg');

// Chat Types
export const CHAT_TYPES = {
  AI: 'ai',
  VENDOR: 'vendor',
  SUPPORT: 'support',
  FRIEND: 'friend',
  RIDER: 'rider',
} as const;

export type ChatType = typeof CHAT_TYPES[keyof typeof CHAT_TYPES];