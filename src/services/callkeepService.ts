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
  private pendingCalls = new Map<string, CallkeepCallInfo>(); // uuid → call info
  private answerHandler: AnswerHandler | null = null;
  private endHandler: EndHandler | null = null;

  setup() {
    if (this.isSetup) return;

    try {
      RNCallKeep.setup({
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
    }
  }

  onAnswerCall(handler: AnswerHandler) {
    this.answerHandler = handler;
  }

  onEndCall(handler: EndHandler) {
    this.endHandler = handler;
  }

  displayIncomingCall(info: CallkeepCallInfo) {
    if (!this.isSetup) {
      this.setup();
    }

    try {
      this.pendingCalls.set(info.uuid, info);
      RNCallKeep.displayIncomingCall(
        info.uuid,
        info.callerName,
        info.callerName,
        'generic',
        info.callType === 'video',
      );
      console.log('📞 CallKeep incoming call displayed:', info.uuid);
    } catch (error) {
      console.error('❌ CallKeep displayIncomingCall failed:', error);
    }
  }

  endCallkeepCall(uuid: string) {
    try {
      RNCallKeep.endCall(uuid);
      this.pendingCalls.delete(uuid);
    } catch (error) {
      console.error('❌ CallKeep endCall failed:', error);
    }
  }

  getCallInfo(uuid: string): CallkeepCallInfo | undefined {
    return this.pendingCalls.get(uuid);
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
      this.isSetup = false;
    } catch (error) {
      console.error('❌ CallKeep teardown failed:', error);
    }
  }
}

export const callkeepService = new CallkeepService();
