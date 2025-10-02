// Gemini Live API for real-time voice conversations
// Note: This is a conceptual implementation as Gemini Live API details may vary

import { ikoAPI } from './ikoAPI';
import { ikoSearchAPI } from './ikoSearchAPI';

export interface LiveSessionConfig {
  userId: string;
  userToken: string;
  sessionId?: string;
  systemInstruction?: string;
  functions?: any[];
}

export interface LiveMessage {
  type: 'audio' | 'text' | 'function_call' | 'function_response' | 'system';
  content: any;
  timestamp: number;
}

export interface LiveSessionState {
  sessionId: string;
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  userId: string;
  messages: LiveMessage[];
  functions: any[];
}

class GeminiLiveAPI {
  private websocket: WebSocket | null = null;
  private sessionState: LiveSessionState | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;

  // Event listeners
  private onConnectionChange: ((connected: boolean) => void) | null = null;
  private onAudioReceived: ((audioData: ArrayBuffer) => void) | null = null;
  private onTextReceived: ((text: string) => void) | null = null;
  private onFunctionCall: ((functionCall: any) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  /**
   * Initialize a live conversation session
   */
  async initializeLiveSession(config: LiveSessionConfig): Promise<LiveSessionState> {
    try {
      // Get user profile for context
      const userProfile = await ikoAPI.getIkoProfile();

      const sessionId = config.sessionId || `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.sessionState = {
        sessionId,
        isConnected: false,
        isRecording: false,
        isPlaying: false,
        userId: config.userId,
        messages: [],
        functions: config.functions || this.getDefaultFunctions(),
      };

      // Create system instruction with user context
      const systemInstruction = config.systemInstruction || this.createLiveSystemInstruction(userProfile);

      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      return this.sessionState;
    } catch (error) {
      console.error('Error initializing live session:', error);
      throw error;
    }
  }

  /**
   * Connect to Gemini Live API via WebSocket
   */
  async connect(): Promise<void> {
    try {
      if (!this.sessionState) {
        throw new Error('Session not initialized');
      }

      // In production, this would be the actual Gemini Live API WebSocket URL
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService/BidiGenerateContent`;

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('Connected to Gemini Live API');
        if (this.sessionState) {
          this.sessionState.isConnected = true;
        }
        this.onConnectionChange?.(true);

        // Send initial configuration
        this.sendConfiguration();
      };

      this.websocket.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };

      this.websocket.onclose = () => {
        console.log('Disconnected from Gemini Live API');
        if (this.sessionState) {
          this.sessionState.isConnected = false;
        }
        this.onConnectionChange?.(false);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError?.('Connection error');
      };
    } catch (error) {
      console.error('Error connecting to live API:', error);
      throw error;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      if (!this.sessionState || !this.sessionState.isConnected) {
        throw new Error('Not connected to live session');
      }

      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.sendAudioChunk(event.data);
        }
      };

      this.mediaRecorder.start(100); // Send chunks every 100ms
      this.sessionState.isRecording = true;

      console.log('Started recording');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.sessionState?.isRecording) {
      this.mediaRecorder.stop();
      this.sessionState.isRecording = false;
      console.log('Stopped recording');
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  /**
   * Send text message during live session
   */
  sendTextMessage(text: string): void {
    if (!this.websocket || !this.sessionState?.isConnected) {
      console.warn('Cannot send text: not connected');
      return;
    }

    const message = {
      type: 'text',
      content: text,
      timestamp: Date.now(),
    };

    this.websocket.send(JSON.stringify(message));
    this.sessionState.messages.push(message);
  }

  /**
   * Disconnect from live session
   */
  disconnect(): void {
    this.stopRecording();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.sessionState) {
      this.sessionState.isConnected = false;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Set event listeners
   */
  setEventListeners(listeners: {
    onConnectionChange?: (connected: boolean) => void;
    onAudioReceived?: (audioData: ArrayBuffer) => void;
    onTextReceived?: (text: string) => void;
    onFunctionCall?: (functionCall: any) => void;
    onError?: (error: string) => void;
  }): void {
    this.onConnectionChange = listeners.onConnectionChange || null;
    this.onAudioReceived = listeners.onAudioReceived || null;
    this.onTextReceived = listeners.onTextReceived || null;
    this.onFunctionCall = listeners.onFunctionCall || null;
    this.onError = listeners.onError || null;
  }

  /**
   * Get current session state
   */
  getSessionState(): LiveSessionState | null {
    return this.sessionState;
  }

  // Private helper methods
  private createLiveSystemInstruction(userProfile: any): string {
    const { preferences, context } = userProfile;

    return `You are Iko, a friendly AI assistant for Fretiko in a live voice conversation.

User: ${userProfile.username}
Location: ${userProfile.location || 'Not specified'}
Preferences: ${preferences.favorite_categories?.join(', ') || 'None'}
Communication: ${preferences.communication_style || 'friendly'}

Instructions:
- Keep responses conversational and natural for voice
- Use function calls when users want to search or get recommendations
- Be proactive but not overwhelming
- Remember this is a live conversation, so be responsive and engaging
- If you need to perform actions, ask for confirmation first`;
  }

  private getDefaultFunctions(): any[] {
    return [
      {
        name: 'search_products',
        description: 'Search for products on the platform',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            category: { type: 'string', description: 'Product category' },
            maxPrice: { type: 'number', description: 'Maximum price' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_services',
        description: 'Search for services on the platform',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            category: { type: 'string', description: 'Service category' },
            location: { type: 'string', description: 'Location preference' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_recommendations',
        description: 'Get personalized recommendations',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['products', 'services', 'mixed'] },
            context: { type: 'string', description: 'Context for recommendations' },
          },
          required: ['type'],
        },
      },
      {
        name: 'book_service',
        description: 'Book a service appointment',
        parameters: {
          type: 'object',
          properties: {
            serviceId: { type: 'string', description: 'ID of the service to book' },
            timeSlot: { type: 'string', description: 'Preferred time slot' },
            notes: { type: 'string', description: 'Additional notes' },
          },
          required: ['serviceId', 'timeSlot'],
        },
      },
      {
        name: 'purchase_product',
        description: 'Purchase a product',
        parameters: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'ID of the product to purchase' },
            quantity: { type: 'number', description: 'Quantity to purchase' },
          },
          required: ['productId'],
        },
      },
      {
        name: 'create_activity_plan',
        description: 'Create a personalized activity plan',
        parameters: {
          type: 'object',
          properties: {
            activity: { type: 'string', description: 'Type of activity to plan' },
            budget: { type: 'number', description: 'Budget for the activity' },
            targetDate: { type: 'string', description: 'Target date for the activity' },
          },
          required: ['activity', 'budget'],
        },
      },
    ];
  }

  private sendConfiguration(): void {
    if (!this.websocket || !this.sessionState) return;

    const config = {
      type: 'setup',
      sessionId: this.sessionState.sessionId,
      functions: this.sessionState.functions,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    this.websocket.send(JSON.stringify(config));
  }

  private sendAudioChunk(audioBlob: Blob): void {
    if (!this.websocket) return;

    audioBlob.arrayBuffer().then(buffer => {
      const message = {
        type: 'audio_chunk',
        content: Array.from(new Uint8Array(buffer)),
        timestamp: Date.now(),
      };

      this.websocket!.send(JSON.stringify(message));
    });
  }

  private handleIncomingMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'audio':
          this.handleAudioResponse(message.content);
          break;
        case 'text':
          this.onTextReceived?.(message.content);
          break;
        case 'function_call':
          this.handleFunctionCall(message.content);
          break;
        case 'error':
          this.onError?.(message.content);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }

      // Add to session messages
      if (this.sessionState) {
        this.sessionState.messages.push({
          type: message.type,
          content: message.content,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private handleAudioResponse(audioData: number[]): void {
    if (!this.audioContext) return;

    try {
      // Convert audio data to ArrayBuffer
      const buffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(buffer);
      audioData.forEach((byte, index) => {
        view[index] = byte;
      });

      this.onAudioReceived?.(buffer);

      // Play audio
      this.playAudio(buffer);
    } catch (error) {
      console.error('Error handling audio response:', error);
    }
  }

  private async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;

    try {
      const audioData = await this.audioContext.decodeAudioData(audioBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioData;
      source.connect(this.audioContext.destination);
      source.start(0);

      if (this.sessionState) {
        this.sessionState.isPlaying = true;
      }

      source.onended = () => {
        if (this.sessionState) {
          this.sessionState.isPlaying = false;
        }
      };
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  private async handleFunctionCall(functionCall: any): Promise<void> {
    try {
      this.onFunctionCall?.(functionCall);

      let result;

      switch (functionCall.name) {
        case 'search_products':
          result = await ikoSearchAPI.searchProducts(functionCall.args);
          break;
        case 'search_services':
          result = await ikoSearchAPI.searchServices(functionCall.args);
          break;
        case 'search_users':
          result = await ikoSearchAPI.searchUsers(functionCall.args);
          break;
        case 'get_recommendations':
          result = await ikoSearchAPI.getRecommendations(functionCall.args);
          break;
        case 'book_service':
          result = await ikoSearchAPI.bookService(functionCall.args);
          break;
        case 'purchase_product':
          result = await ikoSearchAPI.purchaseProduct(functionCall.args);
          break;
        case 'check_availability':
          result = await ikoSearchAPI.checkAvailability(functionCall.args);
          break;
        case 'create_activity_plan':
          result = await ikoSearchAPI.createActivityPlan(functionCall.args);
          break;
        case 'set_budget_alert':
          result = await ikoSearchAPI.setBudgetAlert(functionCall.args);
          break;
        case 'get_product_details':
          result = await ikoSearchAPI.getProductDetails(functionCall.args);
          break;
        case 'get_service_details':
          result = await ikoSearchAPI.getServiceDetails(functionCall.args);
          break;
        case 'track_order':
          result = await ikoSearchAPI.trackOrder(functionCall.args);
          break;
        default:
          result = { error: `Unknown function: ${functionCall.name}` };
      }

      // Send function result back
      if (this.websocket) {
        const response = {
          type: 'function_response',
          functionId: functionCall.id,
          result,
          timestamp: Date.now(),
        };

        this.websocket.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('Error handling function call:', error);

      // Send error response
      if (this.websocket) {
        const errorResponse = {
          type: 'function_response',
          functionId: functionCall.id,
          error: 'Function execution failed',
          timestamp: Date.now(),
        };

        this.websocket.send(JSON.stringify(errorResponse));
      }
    }
  }
}

export const geminiLiveAPI = new GeminiLiveAPI();