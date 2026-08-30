import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

export interface CallkeepCallInfo {
  uuid: string;
  callerName: string;
  callType: 'audio' | 'video';
  conversationId: string;
  callSessionId: string;
}

type AnswerHandler = (callUUID: string) => void;
type EndHandler = (callUUID: string) => void;

class CallkeepService {
  private isSetup = false;
  private setupPromise: Promise<void> | null = null;
  private pendingCalls = new Map<string, CallkeepCallInfo>(); // uuid → call info
  private activeCallSessionId: string | null = null;
  private answerHandler: AnswerHandler | null = null;
  private endHandler: EndHandler | null = null;

  setup(): Promise<void> {
    if (this.setupPromise) return this.setupPromise;

    this.setupPromise = (async () => {
      try {
        await RNCallKeep.setup({
          ios: {
            appName: 'Fretiko',
            supportsVideo: true,
            maximumCallGroups: '1',
            maximumCallsPerCallGroup: '1',
            includesCallsInRecents: true,
          },
          android: {
            alertTitle: 'Permissions required',
            alertDescription:
              'Fretiko needs phone account permission to manage incoming calls.',
            cancelButton: 'Cancel',
            okButton: 'Allow',
            imageName: 'phone_account_icon',
            additionalPermissions: [],
            selfManaged: false,
            foregroundService: {
              channelId: 'com.kinging.fretikomobile.calls',
              channelName: 'Fretiko Calls',
              notificationTitle: 'Fretiko call in progress',
              notificationIcon: 'ic_launcher',
            },
          },
        });

        RNCallKeep.setAvailable(true);

        // User answered the call from the native UI (lock-screen / system)
        RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
          console.log('📞 CallKeep answerCall:', callUUID);
          this.answerHandler?.(callUUID);
          RNCallKeep.backToForeground();
        });

        // User declined from native UI
        RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
          console.log('📞 CallKeep endCall:', callUUID);
          this.endHandler?.(callUUID);
          this.pendingCalls.delete(callUUID);
        });

        // Audio session activated — hand off to app
        RNCallKeep.addEventListener('didActivateAudioSession', () => {
          console.log('🔊 CallKeep audio session activated');
        });

        this.isSetup = true;
        console.log('✅ CallKeep setup complete');
      } catch (error) {
        console.error('❌ CallKeep setup failed:', error);
        this.isSetup = false;
        throw error;
      }
    })();

    return this.setupPromise;
  }

  onAnswerCall(handler: AnswerHandler) {
    this.answerHandler = handler;
  }

  onEndCall(handler: EndHandler) {
    this.endHandler = handler;
  }

  async displayIncomingCall(info: CallkeepCallInfo) {
    try {
      await this.setup();
    } catch (error) {
      console.error('❌ CallKeep not ready, cannot display incoming call:', error);
      return;
    }

    // Avoid double-ringing if this call is already displayed (e.g. socket
    // call_event and push notification both trigger this in quick succession)
    if (this.pendingCalls.has(info.uuid)) {
      console.log('📞 CallKeep incoming call already displayed, skipping duplicate:', info.uuid);
      return;
    }

    // Skip if we are already in an active call
    if (this.activeCallSessionId) {
      console.log('📞 CallKeep already in an active call, skipping incoming:', info.uuid);
      return;
    }

    try {
      this.pendingCalls.set(info.uuid, info);
      await RNCallKeep.displayIncomingCall(
        info.uuid,
        info.callerName,
        info.callerName,
        'generic',
        info.callType === 'video',
      );
      console.log('📞 CallKeep incoming call displayed:', info.uuid);
    } catch (error) {
      console.error('❌ CallKeep displayIncomingCall failed:', error);
      this.pendingCalls.delete(info.uuid);
    }
  }

  async endCallkeepCall(uuid: string) {
    try {
      await this.setup();
    } catch (error) {
      console.error('❌ CallKeep not ready, cannot end call:', error);
      return;
    }

    try {
      await RNCallKeep.endCall(uuid);
      this.pendingCalls.delete(uuid);
    } catch (error) {
      console.error('❌ CallKeep endCall failed:', error);
    }
  }

  getCallInfo(uuid: string): CallkeepCallInfo | undefined {
    return this.pendingCalls.get(uuid);
  }

  setActiveCall(sessionId: string | null) {
    this.activeCallSessionId = sessionId;
  }

  setAvailable(available: boolean) {
    try {
      RNCallKeep.setAvailable(available);
    } catch (error) {
      console.error('❌ CallKeep setAvailable failed:', error);
    }
  }

  teardown() {
    try {
      RNCallKeep.removeEventListener('answerCall');
      RNCallKeep.removeEventListener('endCall');
      RNCallKeep.removeEventListener('didActivateAudioSession');
      this.setupPromise = null;
      this.isSetup = false;
    } catch (error) {
      console.error('❌ CallKeep teardown failed:', error);
    }
  }
}

export const callkeepService = new CallkeepService();
