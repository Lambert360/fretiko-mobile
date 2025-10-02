import { geminiAPI, GeminiResponse, GeminiChatSession } from './geminiAPI';
import { geminiLiveAPI, LiveSessionConfig, LiveSessionState } from './geminiLiveAPI';
import { ikoAPI } from './ikoAPI';
import { chatAPI } from './chatAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ConversationMode = 'text' | 'voice_note' | 'live_call' | 'image_generation';

export interface ConversationState {
  mode: ConversationMode;
  isActive: boolean;
  userId: string;
  chatId: string; // Fretiko chat ID for persistence
  sessionId?: string; // Gemini session ID
  metadata: {
    startTime: string;
    lastActivity: string;
    messageCount: number;
    functionCallCount: number;
  };
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'iko' | 'system' | 'function_call';
  content: string;
  mode: ConversationMode;
  timestamp: string;
  metadata?: {
    audioUri?: string;
    imageUri?: string;
    functionName?: string;
    functionResult?: any;
  };
}

export interface ConversationOptions {
  mode: ConversationMode;
  userId: string;
  chatId?: string; // If continuing existing chat
  autoRecord?: boolean; // For voice modes
  systemPrompt?: string;
}

class IkoConversationManager {
  private currentState: ConversationState | null = null;
  private messages: ConversationMessage[] = [];
  private eventListeners: { [event: string]: Function[] } = {};

  // Event listener methods
  on(event: string, callback: Function): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback: Function): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data?: any): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Start a new conversation with Iko
   */
  async startConversation(options: ConversationOptions): Promise<ConversationState> {
    try {
      // Create or get Fretiko chat conversation
      let chatId = options.chatId;
      if (!chatId) {
        // Create new AI conversation in Fretiko chat system
        const conversation = await chatAPI.createConversation({
          participantIds: [options.userId], // Just the user, AI is implicit
          chatType: 'ai',
          initialMessage: 'Starting conversation with Iko',
        });
        chatId = conversation.id;
      }

      const sessionId = `iko_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.currentState = {
        mode: options.mode,
        isActive: true,
        userId: options.userId,
        chatId,
        sessionId,
        metadata: {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          messageCount: 0,
          functionCallCount: 0,
        },
      };

      // Initialize the appropriate AI service based on mode
      switch (options.mode) {
        case 'text':
        case 'voice_note':
        case 'image_generation':
          await geminiAPI.initializeChatSession(options.userId);
          break;
        case 'live_call':
          await this.initializeLiveCall(options);
          break;
      }

      // Load previous messages if continuing existing chat
      if (options.chatId) {
        await this.loadChatHistory(chatId);
      }

      // Save state
      await this.saveState();

      this.emit('conversationStarted', this.currentState);

      return this.currentState;
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  }

  /**
   * Send a text message to Iko
   */
  async sendTextMessage(text: string): Promise<ConversationMessage> {
    if (!this.currentState || !this.currentState.isActive) {
      throw new Error('No active conversation');
    }

    try {
      // Create user message
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'user',
        content: text,
        mode: 'text',
        timestamp: new Date().toISOString(),
      };

      this.messages.push(userMessage);
      this.updateActivity();

      // Send to Gemini
      const response = await geminiAPI.sendTextMessage(text, this.currentState.userId);

      // Create Iko response message
      const ikoMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'iko',
        content: response.text || 'I understand.',
        mode: 'text',
        timestamp: new Date().toISOString(),
        metadata: response.functionCalls ? {
          functionName: response.functionCalls[0]?.name,
          functionResult: response.functionCalls,
        } : undefined,
      };

      this.messages.push(ikoMessage);

      if (response.functionCalls) {
        this.currentState.metadata.functionCallCount += response.functionCalls.length;
      }

      // Save to Fretiko chat
      await this.saveToChatSystem(userMessage);
      await this.saveToChatSystem(ikoMessage);

      // Record interaction
      await ikoAPI.recordConversation({
        interactionType: 'text',
        summary: text.substring(0, 100),
      });

      await this.saveState();

      this.emit('messageReceived', ikoMessage);

      return ikoMessage;
    } catch (error) {
      console.error('Error sending text message:', error);
      throw error;
    }
  }

  /**
   * Send a voice note to Iko
   */
  async sendVoiceNote(audioUri: string, mimeType: string, duration?: number): Promise<ConversationMessage> {
    if (!this.currentState || !this.currentState.isActive) {
      throw new Error('No active conversation');
    }

    try {
      // Create user voice message
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'user',
        content: '[Voice Note]',
        mode: 'voice_note',
        timestamp: new Date().toISOString(),
        metadata: {
          audioUri,
        },
      };

      this.messages.push(userMessage);
      this.updateActivity();

      // Process with Gemini
      const response = await geminiAPI.processVoiceNote({
        audioUri,
        mimeType,
        duration,
      }, this.currentState.userId);

      // Create Iko response
      const ikoMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'iko',
        content: response.text || 'I heard your voice note.',
        mode: 'voice_note',
        timestamp: new Date().toISOString(),
      };

      this.messages.push(ikoMessage);

      // Save to chat system
      await this.saveToChatSystem(userMessage);
      await this.saveToChatSystem(ikoMessage);

      await this.saveState();

      this.emit('messageReceived', ikoMessage);

      return ikoMessage;
    } catch (error) {
      console.error('Error processing voice note:', error);
      throw error;
    }
  }

  /**
   * Start a live voice call with Iko
   */
  async startLiveCall(): Promise<void> {
    if (!this.currentState) {
      throw new Error('No active conversation');
    }

    try {
      this.currentState.mode = 'live_call';

      // Set up live API event listeners
      geminiLiveAPI.setEventListeners({
        onConnectionChange: (connected) => {
          this.emit('liveConnectionChange', connected);
        },
        onTextReceived: (text) => {
          const message: ConversationMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'iko',
            content: text,
            mode: 'live_call',
            timestamp: new Date().toISOString(),
          };
          this.messages.push(message);
          this.emit('messageReceived', message);
        },
        onFunctionCall: (functionCall) => {
          this.currentState!.metadata.functionCallCount++;
          this.emit('functionCall', functionCall);
        },
        onError: (error) => {
          this.emit('error', error);
        },
      });

      // Connect to live API
      await geminiLiveAPI.connect();

      this.emit('liveCallStarted');
    } catch (error) {
      console.error('Error starting live call:', error);
      throw error;
    }
  }

  /**
   * End live call
   */
  endLiveCall(): void {
    geminiLiveAPI.disconnect();
    if (this.currentState) {
      this.currentState.mode = 'text'; // Switch back to text mode
    }
    this.emit('liveCallEnded');
  }

  /**
   * Generate an image based on prompt
   */
  async generateImage(prompt: string): Promise<ConversationMessage> {
    if (!this.currentState || !this.currentState.isActive) {
      throw new Error('No active conversation');
    }

    try {
      // Create user message
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'user',
        content: `Generate image: ${prompt}`,
        mode: 'image_generation',
        timestamp: new Date().toISOString(),
      };

      this.messages.push(userMessage);
      this.updateActivity();

      // Generate image
      const result = await geminiAPI.generateImage(prompt);

      // Create Iko response
      const ikoMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'iko',
        content: result.error || 'Image generated successfully.',
        mode: 'image_generation',
        timestamp: new Date().toISOString(),
        metadata: {
          imageUri: result.imageUrl,
        },
      };

      this.messages.push(ikoMessage);

      // Save to chat system
      await this.saveToChatSystem(userMessage);
      await this.saveToChatSystem(ikoMessage);

      await this.saveState();

      this.emit('messageReceived', ikoMessage);

      return ikoMessage;
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  /**
   * Get conversation suggestions
   */
  async getConversationSuggestions(): Promise<string[]> {
    try {
      return await geminiAPI.getConversationSuggestions();
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return ['How can I help you?', 'What are you looking for?', 'Tell me more'];
    }
  }

  /**
   * End current conversation
   */
  async endConversation(): Promise<void> {
    if (!this.currentState) {
      return;
    }

    try {
      // End live call if active
      if (this.currentState.mode === 'live_call') {
        this.endLiveCall();
      }

      // Mark as inactive
      this.currentState.isActive = false;
      this.updateActivity();

      // Clear Gemini session
      await geminiAPI.clearSession();

      // Save final state
      await this.saveState();

      this.emit('conversationEnded', this.currentState);

      // Clear current state
      this.currentState = null;
      this.messages = [];
    } catch (error) {
      console.error('Error ending conversation:', error);
    }
  }

  /**
   * Get current conversation state
   */
  getCurrentState(): ConversationState | null {
    return this.currentState;
  }

  /**
   * Get conversation messages
   */
  getMessages(): ConversationMessage[] {
    return this.messages;
  }

  /**
   * Resume existing conversation
   */
  async resumeConversation(chatId: string, userId: string): Promise<ConversationState | null> {
    try {
      // Load from storage
      const stateKey = `iko_conversation_${chatId}`;
      const savedState = await AsyncStorage.getItem(stateKey);

      if (savedState) {
        this.currentState = JSON.parse(savedState);
        this.currentState!.isActive = true;

        // Load messages
        await this.loadChatHistory(chatId);

        // Reinitialize Gemini session
        await geminiAPI.initializeChatSession(userId);

        this.emit('conversationResumed', this.currentState);

        return this.currentState;
      }

      return null;
    } catch (error) {
      console.error('Error resuming conversation:', error);
      return null;
    }
  }

  // Private helper methods
  private async initializeLiveCall(options: ConversationOptions): Promise<void> {
    const config: LiveSessionConfig = {
      userId: options.userId,
      userToken: '', // Get from auth context
      sessionId: this.currentState?.sessionId,
      systemInstruction: options.systemPrompt,
    };

    await geminiLiveAPI.initializeLiveSession(config);
  }

  private updateActivity(): void {
    if (this.currentState) {
      this.currentState.metadata.lastActivity = new Date().toISOString();
      this.currentState.metadata.messageCount++;
    }
  }

  private async saveToChatSystem(message: ConversationMessage): Promise<void> {
    if (!this.currentState) return;

    try {
      await chatAPI.sendMessage({
        conversationId: this.currentState.chatId,
        messageType: message.metadata?.audioUri ? 'audio' : 'text',
        content: message.content,
        mediaUrl: message.metadata?.audioUri || message.metadata?.imageUri,
      });
    } catch (error) {
      console.warn('Failed to save to chat system:', error);
      // Don't throw error as this is not critical
    }
  }

  private async loadChatHistory(chatId: string): Promise<void> {
    try {
      const { messages } = await chatAPI.getMessages(chatId);

      // Convert chat messages to conversation messages
      const convertedMessages: ConversationMessage[] = messages.map(msg => ({
        id: msg.id,
        type: msg.senderId === 'iko' ? 'iko' : 'user',
        content: msg.content || '[Media Message]',
        mode: msg.messageType === 'audio' ? 'voice_note' : 'text',
        timestamp: msg.createdAt,
        metadata: msg.mediaUrl ? {
          audioUri: msg.messageType === 'audio' ? msg.mediaUrl : undefined,
          imageUri: msg.messageType === 'image' ? msg.mediaUrl : undefined,
        } : undefined,
      }));

      this.messages = convertedMessages;
    } catch (error) {
      console.warn('Failed to load chat history:', error);
    }
  }

  private async saveState(): Promise<void> {
    if (!this.currentState) return;

    try {
      const stateKey = `iko_conversation_${this.currentState.chatId}`;
      await AsyncStorage.setItem(stateKey, JSON.stringify(this.currentState));
    } catch (error) {
      console.error('Error saving conversation state:', error);
    }
  }
}

export const ikoConversationManager = new IkoConversationManager();