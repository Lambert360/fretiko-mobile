import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ikoConversationManager,
  ConversationState,
  ConversationMessage,
  ConversationMode,
  ConversationOptions
} from '../services/ikoConversationManager';
import { useAuth } from '../contexts/AuthContext';

export interface UseIkoOptions {
  autoStart?: boolean;
  mode?: ConversationMode;
  chatId?: string;
}

export interface UseIkoReturn {
  // State
  isConnected: boolean;
  isLoading: boolean;
  isRecording: boolean;
  isInCall: boolean;
  conversationState: ConversationState | null;
  messages: ConversationMessage[];
  suggestions: string[];
  error: string | null;

  // Actions
  startConversation: (options?: Partial<ConversationOptions>) => Promise<void>;
  endConversation: () => Promise<void>;
  sendTextMessage: (text: string) => Promise<void>;
  sendVoiceNote: (audioUri: string, mimeType: string, duration?: number) => Promise<void>;
  startLiveCall: () => Promise<void>;
  endLiveCall: () => void;
  generateImage: (prompt: string) => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  resumeConversation: (chatId: string) => Promise<void>;

  // Live call controls
  startRecording: () => void;
  stopRecording: () => void;
  sendLiveText: (text: string) => void;
}

export const useIko = (options: UseIkoOptions = {}): UseIkoReturn => {
  const { user } = useAuth();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs to avoid stale closures
  const messagesRef = useRef<ConversationMessage[]>([]);
  const isInitialized = useRef(false);

  // Update ref when messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initialize Iko conversation manager
  useEffect(() => {
    if (!user || isInitialized.current) return;

    const initializeIko = async () => {
      try {
        // Set up event listeners
        ikoConversationManager.on('conversationStarted', (state: ConversationState) => {
          setConversationState(state);
          setIsConnected(true);
          setError(null);
        });

        ikoConversationManager.on('conversationEnded', () => {
          setConversationState(null);
          setIsConnected(false);
          setIsInCall(false);
          setIsRecording(false);
        });

        ikoConversationManager.on('conversationResumed', (state: ConversationState) => {
          setConversationState(state);
          setIsConnected(true);
          setMessages(ikoConversationManager.getMessages());
        });

        ikoConversationManager.on('messageReceived', (message: ConversationMessage) => {
          setMessages(prev => [...prev, message]);
        });

        ikoConversationManager.on('liveConnectionChange', (connected: boolean) => {
          setIsInCall(connected);
        });

        ikoConversationManager.on('liveCallStarted', () => {
          setIsInCall(true);
        });

        ikoConversationManager.on('liveCallEnded', () => {
          setIsInCall(false);
          setIsRecording(false);
        });

        ikoConversationManager.on('error', (errorMessage: string) => {
          setError(errorMessage);
          setIsLoading(false);
        });

        ikoConversationManager.on('functionCall', (functionCall: any) => {
          console.log('Function call executed:', functionCall);
        });

        // Auto-start if requested
        if (options.autoStart) {
          await startConversation({
            mode: options.mode || 'text',
            chatId: options.chatId,
          });
        }

        // Load initial suggestions
        await refreshSuggestions();

        isInitialized.current = true;
      } catch (err) {
        console.error('Error initializing Iko:', err);
        setError('Failed to initialize Iko');
      }
    };

    initializeIko();

    // Cleanup on unmount
    return () => {
      // Don't call endConversation() on unmount - it clears the Gemini session
      // This would defeat our session persistence strategy
      // The session should persist across remounts so it can be restored
      // Users can explicitly end conversation when needed via endConversation action
      console.log('🧹 useIko cleanup - session persisted for reuse');
    };
  }, [user, options.autoStart, options.mode, options.chatId]);

  // Actions
  const startConversation = useCallback(async (convOptions: Partial<ConversationOptions> = {}) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fullOptions: ConversationOptions = {
        mode: 'text',
        userId: user.id,
        ...convOptions,
      };

      const state = await ikoConversationManager.startConversation(fullOptions);
      setConversationState(state);
      setMessages(ikoConversationManager.getMessages());
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Failed to start conversation with Iko');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const endConversation = useCallback(async () => {
    setIsLoading(true);
    try {
      await ikoConversationManager.endConversation();
      setMessages([]);
    } catch (err) {
      console.error('Error ending conversation:', err);
      setError('Failed to end conversation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await ikoConversationManager.sendTextMessage(text);
      setMessages(ikoConversationManager.getMessages());
    } catch (err) {
      console.error('Error sending text message:', err);
      setError('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendVoiceNote = useCallback(async (audioUri: string, mimeType: string, duration?: number) => {
    setIsLoading(true);
    setError(null);

    try {
      await ikoConversationManager.sendVoiceNote(audioUri, mimeType, duration);
      setMessages(ikoConversationManager.getMessages());
    } catch (err) {
      console.error('Error sending voice note:', err);
      setError('Failed to send voice note');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startLiveCall = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await ikoConversationManager.startLiveCall();
    } catch (err) {
      console.error('Error starting live call:', err);
      setError('Failed to start live call');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const endLiveCall = useCallback(() => {
    ikoConversationManager.endLiveCall();
  }, []);

  const generateImage = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await ikoConversationManager.generateImage(prompt);
      setMessages(ikoConversationManager.getMessages());
    } catch (err) {
      console.error('Error generating image:', err);
      setError('Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSuggestions = useCallback(async () => {
    try {
      const newSuggestions = await ikoConversationManager.getConversationSuggestions();
      setSuggestions(newSuggestions);
    } catch (err) {
      console.error('Error refreshing suggestions:', err);
    }
  }, []);

  const resumeConversation = useCallback(async (chatId: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const state = await ikoConversationManager.resumeConversation(chatId, user.id);
      if (state) {
        setConversationState(state);
        setMessages(ikoConversationManager.getMessages());
      }
    } catch (err) {
      console.error('Error resuming conversation:', err);
      setError('Failed to resume conversation');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Live call controls (these would typically use the geminiLiveAPI directly)
  const startRecording = useCallback(() => {
    // Implementation would call geminiLiveAPI.startRecording()
    setIsRecording(true);
    console.log('Start recording - implementation needed');
  }, []);

  const stopRecording = useCallback(() => {
    // Implementation would call geminiLiveAPI.stopRecording()
    setIsRecording(false);
    console.log('Stop recording - implementation needed');
  }, []);

  const sendLiveText = useCallback((text: string) => {
    // Implementation would call geminiLiveAPI.sendTextMessage()
    console.log('Send live text - implementation needed:', text);
  }, []);

  return {
    // State
    isConnected,
    isLoading,
    isRecording,
    isInCall,
    conversationState,
    messages,
    suggestions,
    error,

    // Actions
    startConversation,
    endConversation,
    sendTextMessage,
    sendVoiceNote,
    startLiveCall,
    endLiveCall,
    generateImage,
    refreshSuggestions,
    resumeConversation,

    // Live call controls
    startRecording,
    stopRecording,
    sendLiveText,
  };
};

export default useIko;