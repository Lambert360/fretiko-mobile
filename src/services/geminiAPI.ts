import { GoogleGenerativeAI, GenerativeModel, Part, GenerationConfig } from '@google/generative-ai';
import { ikoAPI } from './ikoAPI';
import { ikoSearchAPI, IkoSearchFunctionSchemas } from './ikoSearchAPI';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// Types and interfaces
export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}

export interface GeminiChatSession {
  id: string;
  userId: string;
  messages: GeminiMessage[];
  context: {
    userPreferences?: any;
    conversationCount: number;
    lastInteraction: string;
  };
  functionCallHistory: Array<{
    function: string;
    parameters: any;
    result: any;
    timestamp: string;
  }>;
}

export interface GeminiFunctionCall {
  name: string;
  args: { [key: string]: any };
}

export interface GeminiResponse {
  text?: string;
  functionCalls?: GeminiFunctionCall[];
  error?: string;
}

export interface VoiceNoteRequest {
  audioUri: string;
  mimeType: string;
  duration?: number;
}

class GeminiAPI {
  private genAI: GoogleGenerativeAI;
  private textModel: GenerativeModel;
  private visionModel: GenerativeModel;
  private currentSession: GeminiChatSession | null = null;
  private apiKey: string;

  constructor() {
    // In production, this should come from secure environment variables
    this.apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

    if (!this.apiKey) {
      console.warn('Gemini API key not found. Some features may not work.');
      return;
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);

    // Initialize models with Gemini 2.0 Flash
    this.textModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
      tools: [
        {
          functionDeclarations: [
            IkoSearchFunctionSchemas.searchProducts,
            IkoSearchFunctionSchemas.searchServices,
            IkoSearchFunctionSchemas.searchUsers,
            IkoSearchFunctionSchemas.getRecommendations,
            IkoSearchFunctionSchemas.bookService,
            IkoSearchFunctionSchemas.purchaseProduct,
            IkoSearchFunctionSchemas.checkAvailability,
            IkoSearchFunctionSchemas.createActivityPlan,
            IkoSearchFunctionSchemas.setBudgetAlert,
            IkoSearchFunctionSchemas.getProductDetails,
            IkoSearchFunctionSchemas.getServiceDetails,
            IkoSearchFunctionSchemas.trackOrder,
          ],
        },
      ],
    });

    this.visionModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });
  }

  /**
   * Initialize a new chat session with user context
   */
  async initializeChatSession(userId: string): Promise<GeminiChatSession> {
    try {
      // Get user preferences and context from Iko
      const userProfile = await ikoAPI.getIkoProfile();

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.currentSession = {
        id: sessionId,
        userId,
        messages: [],
        context: {
          userPreferences: userProfile.preferences,
          conversationCount: userProfile.context.conversation_count || 0,
          lastInteraction: new Date().toISOString(),
        },
        functionCallHistory: [],
      };

      // Add system instruction with user context
      const systemInstruction = this.createSystemInstruction(userProfile);

      this.currentSession.messages.push({
        role: 'user',
        parts: [{ text: systemInstruction }],
      });

      // Save session
      await this.saveSession();

      return this.currentSession;
    } catch (error) {
      console.error('Error initializing chat session:', error);
      throw error;
    }
  }

  /**
   * Send a text message to Gemini
   */
  async sendTextMessage(message: string, userId?: string): Promise<GeminiResponse> {
    try {
      if (!this.currentSession && userId) {
        await this.initializeChatSession(userId);
      }

      if (!this.currentSession) {
        throw new Error('No active chat session');
      }

      // Add user message to session
      this.currentSession.messages.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // Start chat with current session history
      const chat = this.textModel.startChat({
        history: this.currentSession.messages.slice(0, -1), // Exclude the current message
      });

      // Send message and get response
      const result = await chat.sendMessage(message);
      const response = result.response;

      // Process function calls if any
      const functionCalls = response.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
        const functionResults = await this.processFunctionCalls(functionCalls);

        // Send function results back to model
        const functionResponse = await chat.sendMessage(functionResults);
        const finalResponse = functionResponse.response;

        // Add model response to session
        this.currentSession.messages.push({
          role: 'model',
          parts: [{ text: finalResponse.text() || 'Function executed successfully.' }],
        });

        await this.saveSession();

        return {
          text: finalResponse.text(),
          functionCalls: functionCalls.map(fc => ({ name: fc.name, args: fc.args })),
        };
      } else {
        // Add model response to session
        this.currentSession.messages.push({
          role: 'model',
          parts: [{ text: response.text() || 'I understand, but I don\'t have a response right now.' }],
        });

        await this.saveSession();

        return {
          text: response.text(),
        };
      }
    } catch (error) {
      console.error('Error sending text message to Gemini:', error);
      return {
        error: 'Sorry, I encountered an error processing your message. Please try again.',
      };
    }
  }

  /**
   * Process voice note (audio file)
   */
  async processVoiceNote(voiceNote: VoiceNoteRequest, userId?: string): Promise<GeminiResponse> {
    try {
      if (!this.currentSession && userId) {
        await this.initializeChatSession(userId);
      }

      // Read audio file and convert to base64
      const audioData = await this.readAudioFile(voiceNote.audioUri);

      const audioPart: Part = {
        inlineData: {
          mimeType: voiceNote.mimeType,
          data: audioData,
        },
      };

      // Use vision model for multimodal input (audio + text)
      const prompt = "Please transcribe this audio and respond appropriately based on the user's request.";
      const result = await this.visionModel.generateContent([prompt, audioPart]);
      const response = result.response;

      // Add to session
      if (this.currentSession) {
        this.currentSession.messages.push(
          {
            role: 'user',
            parts: [audioPart],
          },
          {
            role: 'model',
            parts: [{ text: response.text() || 'I heard your voice note.' }],
          }
        );

        await this.saveSession();
      }

      // Record the voice interaction
      await ikoAPI.recordConversation({
        interactionType: 'voice',
        summary: response.text()?.substring(0, 100),
      });

      return {
        text: response.text(),
      };
    } catch (error) {
      console.error('Error processing voice note:', error);
      return {
        error: 'Sorry, I had trouble processing your voice note. Please try again.',
      };
    }
  }

  /**
   * Simple send message method (for compatibility)
   */
  async sendMessage(message: string, userId?: string): Promise<string> {
    const response = await this.sendTextMessage(message, userId);
    return response.text || response.error || 'Sorry, I could not process your message.';
  }

  /**
   * Send voice message and get response with both text and audio
   */
  async sendVoiceMessage(message: string, userId?: string): Promise<{ text: string; audioUrl: string }> {
    try {
      // First get the text response
      const textResponse = await this.sendTextMessage(message, userId);

      if (textResponse.error || !textResponse.text) {
        throw new Error(textResponse.error || 'No text response received');
      }

      // Generate TTS audio URL from Google Text-to-Speech API
      const audioUrl = await this.generateTTSAudio(textResponse.text);

      return {
        text: textResponse.text,
        audioUrl: audioUrl
      };
    } catch (error) {
      console.error('Error in voice message:', error);
      throw error;
    }
  }

  /**
   * Generate TTS audio using Google Cloud Text-to-Speech API
   */
  private async generateTTSAudio(text: string): Promise<string> {
    try {
      // This would call Google Cloud Text-to-Speech API
      // For now, we'll return a placeholder URL
      // In production, you'd make an API call to your backend which calls Google TTS

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/tts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-F', // Natural female voice
            ssmlGender: 'FEMALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0
          }
        })
      });

      if (!response.ok) {
        throw new Error('TTS API call failed');
      }

      const result = await response.json();
      return result.audioUrl; // Backend returns the audio file URL

    } catch (error) {
      console.error('Error generating TTS audio:', error);
      // Return empty string to trigger fallback TTS
      throw error;
    }
  }

  /**
   * Start real-time voice conversation with Google Gemini Live API
   */
  async startLiveVoiceSession(): Promise<WebSocket | null> {
    try {
      console.log('🎙️ Starting Google Gemini Live voice session...');

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not found');
      }

      // Connect to Google Gemini Live API WebSocket (use v1beta endpoint)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ Connected to Google Gemini Live API');

        // Send initial session setup - use Gemini 2.0 Flash Live model (supported by Live API)
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Puck"
                  }
                }
              }
            },
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
                endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
                prefixPaddingMs: 500,
                silenceDurationMs: 1000
              }
            },
            systemInstruction: {
              parts: [{
                text: "You are Iko, a friendly AI assistant for the Fretiko platform. Keep responses brief and conversational."
              }]
            }
          }
        };

        ws.send(JSON.stringify(setupMessage));
        console.log('📤 Setup message sent to Gemini Live');
      };

      // Message handling will be done by the calling component (IndividualChatScreen)
      // ws.onmessage will be set externally

      ws.onerror = (error) => {
        console.error('❌ Gemini Live API WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('🔌 Gemini Live API connection closed:', event.code, event.reason);
        console.log('🔌 Close event details:', JSON.stringify({
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        }));
      };

      // Return the WebSocket for external handling
      return ws;

    } catch (error) {
      console.error('Error starting Gemini Live session:', error);
      return null;
    }
  }

  /**
   * Send audio chunk to Gemini Live API
   */
  sendAudioToGemini(ws: WebSocket, audioData: ArrayBuffer): void {
    try {
      // Send as binary WebSocket frame for optimal performance
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(audioData);
        console.log('🎵 Sent PCM audio chunk:', audioData.byteLength, 'bytes');
      } else {
        console.warn('⚠️ WebSocket not open, skipping audio chunk');
      }
    } catch (error) {
      console.error('Error sending audio to Gemini:', error);
    }
  }

  /**
   * Send structured audio message to Gemini Live API (Alternative method)
   */
  sendStructuredAudioToGemini(ws: WebSocket, pcmData: ArrayBuffer): void {
    try {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ WebSocket not open, skipping structured audio');
        return;
      }

      const message = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm",
              data: this.arrayBufferToBase64(pcmData)
            }
          ]
        }
      };

      ws.send(JSON.stringify(message));
      console.log('🎵 Sent structured PCM chunk to Gemini Live');
    } catch (error) {
      console.error('❌ Error sending structured audio to Gemini:', error);
    }
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Read audio file and convert to base64 for streaming to Gemini Live
   */
  async readAudioFileAsBase64(uri: string): Promise<string | null> {
    try {
      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`📁 Read audio file: ${uri}, size: ${base64Data.length} chars`);
      return base64Data;

    } catch (error) {
      console.error('Error reading audio file as base64:', error);
      return null;
    }
  }

  /**
   * Generate image based on text prompt
   */
  async generateImage(prompt: string): Promise<{ imageUrl?: string; error?: string }> {
    try {
      // Note: As of now, Gemini doesn't directly support image generation
      // This would typically integrate with another service like DALL-E or Midjourney
      // For now, we'll return a placeholder response

      const enhancedPrompt = `Generate an image: ${prompt}. Please provide a detailed description of what this image would look like, as I cannot generate images directly yet.`;

      const result = await this.textModel.generateContent(enhancedPrompt);
      const response = result.response;

      return {
        imageUrl: undefined, // Would be actual image URL in production
        error: `Image generation coming soon! Here's what it would look like: ${response.text()}`,
      };
    } catch (error) {
      console.error('Error generating image:', error);
      return {
        error: 'Sorry, image generation is not available right now.',
      };
    }
  }

  /**
   * Get conversation suggestions based on context
   */
  async getConversationSuggestions(): Promise<string[]> {
    try {
      if (!this.currentSession) {
        return [
          "What can you help me with?",
          "Show me trending products",
          "Find services near me",
          "What's new on Fretiko?",
        ];
      }

      const userPreferences = this.currentSession.context.userPreferences;
      const suggestions = [
        "What can you help me with?",
        userPreferences?.favorite_categories?.length > 0
          ? `Show me ${userPreferences.favorite_categories[0]} products`
          : "Show me trending products",
        "Find services near me",
        "Check my ongoing plans",
      ];

      return suggestions;
    } catch (error) {
      console.error('Error getting conversation suggestions:', error);
      return ["How can I help you today?"];
    }
  }

  /**
   * Clear current session
   */
  async clearSession(): Promise<void> {
    this.currentSession = null;
    try {
      await AsyncStorage.removeItem('gemini_current_session');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): GeminiChatSession | null {
    return this.currentSession;
  }

  // Private helper methods
  private createSystemInstruction(userProfile: any): string {
    const { preferences, context } = userProfile;

    return `You are Iko, a friendly and helpful AI assistant for the Fretiko platform. You help users find products, book services, connect with people, and manage their activities.

User Context:
- Username: ${userProfile.username}
- Location: ${userProfile.location || 'Not specified'}
- Member since: ${userProfile.memberSince}
- Favorite categories: ${preferences.favorite_categories?.join(', ') || 'None set'}
- Communication style: ${preferences.communication_style || 'friendly'}
- Budget preferences: ${JSON.stringify(preferences.budget_ranges || {})}
- Conversation count: ${context.conversation_count || 0}

Your capabilities:
1. Search for products, services, and users using function calls
2. Provide personalized recommendations
3. Help with planning and reminders
4. Answer questions about the platform
5. Assist with bookings and purchases (with user confirmation)

Always be helpful, friendly, and respect user preferences. Use function calls when users want to search or get recommendations.`;
  }

  private async processFunctionCalls(functionCalls: any[]): Promise<Part[]> {
    const results: Part[] = [];

    for (const fc of functionCalls) {
      try {
        let result;

        switch (fc.name) {
          case 'search_products':
            result = await ikoSearchAPI.searchProducts(fc.args);
            break;
          case 'search_services':
            result = await ikoSearchAPI.searchServices(fc.args);
            break;
          case 'search_users':
            result = await ikoSearchAPI.searchUsers(fc.args);
            break;
          case 'get_recommendations':
            result = await ikoSearchAPI.getRecommendations(fc.args);
            break;
          case 'book_service':
            result = await ikoSearchAPI.bookService(fc.args);
            break;
          case 'purchase_product':
            result = await ikoSearchAPI.purchaseProduct(fc.args);
            break;
          case 'check_availability':
            result = await ikoSearchAPI.checkAvailability(fc.args);
            break;
          case 'create_activity_plan':
            result = await ikoSearchAPI.createActivityPlan(fc.args);
            break;
          case 'set_budget_alert':
            result = await ikoSearchAPI.setBudgetAlert(fc.args);
            break;
          case 'get_product_details':
            result = await ikoSearchAPI.getProductDetails(fc.args);
            break;
          case 'get_service_details':
            result = await ikoSearchAPI.getServiceDetails(fc.args);
            break;
          case 'track_order':
            result = await ikoSearchAPI.trackOrder(fc.args);
            break;
          default:
            result = { error: `Unknown function: ${fc.name}` };
        }

        // Record function call
        if (this.currentSession) {
          this.currentSession.functionCallHistory.push({
            function: fc.name,
            parameters: fc.args,
            result,
            timestamp: new Date().toISOString(),
          });
        }

        results.push({
          functionResponse: {
            name: fc.name,
            response: {
              name: fc.name,
              content: result,
            },
          },
        } as any);
      } catch (error) {
        console.error(`Error executing function ${fc.name}:`, error);
        results.push({
          functionResponse: {
            name: fc.name,
            response: {
              name: fc.name,
              content: { error: `Failed to execute ${fc.name}` },
            },
          },
        } as any);
      }
    }

    return results;
  }

  private async readAudioFile(uri: string): Promise<string> {
    try {
      // Read audio file and convert to base64 for Gemini API
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Remove data URL prefix to get pure base64
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = (error) => {
          console.error('Error reading audio file:', error);
          reject(new Error('Failed to read audio file'));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error processing audio file:', error);
      throw new Error('Failed to process audio file for AI analysis');
    }
  }

  private async saveSession(): Promise<void> {
    try {
      if (this.currentSession) {
        await AsyncStorage.setItem(
          'gemini_current_session',
          JSON.stringify(this.currentSession)
        );
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  private async loadSession(): Promise<void> {
    try {
      const sessionData = await AsyncStorage.getItem('gemini_current_session');
      if (sessionData) {
        this.currentSession = JSON.parse(sessionData);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }
}

export const geminiAPI = new GeminiAPI();