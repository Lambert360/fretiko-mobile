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
type RemoteEndHandler = (callSessionId: string, reason?: string) => void;

class CallkeepService {
  private isSetup = false;
  private setupPromise: Promise<void> | null = null;
  private pendingCalls = new Map<string, CallkeepCallInfo>(); // uuid → call info
  private activeCallSessionId: string | null = null;
  private answerHandler: AnswerHandler | null = null;
  private endHandler: EndHandler | null = null;
  private remoteEndHandler: RemoteEndHandler | null = null;
  private pendingAnswerCall: string | null = null;
  private pendingEndCall: string | null = null;

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
            includesCallsInRecents: false,
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
          if (this.answerHandler) {
            this.answerHandler(callUUID);
            if (Platform.OS === 'android') {
              RNCallKeep.backToForeground();
            }
          } else {
            this.pendingAnswerCall = callUUID;
          }
        });

        // User declined from native UI
        RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
          console.log('📞 CallKeep endCall:', callUUID);
          if (this.endHandler) {
            this.endHandler(callUUID);
            this.pendingCalls.delete(callUUID);
          } else {
            this.pendingEndCall = callUUID;
          }
        });

        // Audio session activated — hand off to app
        RNCallKeep.addEventListener('didActivateAudioSession', () => {
          console.log('🔊 CallKeep audio session activated');
        });

        // Replay CallKit actions that happened before the JS bundle was ready
        // (e.g. user tapped Answer while the app was killed by the VoIP push)
        RNCallKeep.addEventListener('didLoadWithEvents', (events: any[]) => {
          for (const event of events || []) {
            if (event.name === 'RNCallKeepPerformAnswerCallAction' && event.data?.callUUID) {
              console.log('CallKeep replayed answerCall:', event.data.callUUID);
              if (this.answerHandler) {
                this.answerHandler(event.data.callUUID);
                if (Platform.OS === 'android') {
                  RNCallKeep.backToForeground();
                }
              } else {
                this.pendingAnswerCall = event.data.callUUID;
              }
            } else if (event.name === 'RNCallKeepPerformEndCallAction' && event.data?.callUUID) {
              console.log('CallKeep replayed endCall:', event.data.callUUID);
              if (this.endHandler) {
                this.endHandler(event.data.callUUID);
                this.pendingCalls.delete(event.data.callUUID);
              } else {
                this.pendingEndCall = event.data.callUUID;
              }
            }
          }
        });

        this.isSetup = true;
        console.log('✅ CallKeep setup complete');
      } catch (error) {
        console.error('❌ CallKeep setup failed:', error);
        this.isSetup = false;
        this.setupPromise = null;
        throw error;
      }
    })();

    return this.setupPromise;
  }

  onAnswerCall(handler: AnswerHandler) {
    this.answerHandler = handler;
    if (this.pendingAnswerCall) {
      console.log('📞 CallKeep draining pending answerCall:', this.pendingAnswerCall);
      const pending = this.pendingAnswerCall;
      this.pendingAnswerCall = null;
      handler(pending);
    }
  }

  onEndCall(handler: EndHandler) {
    this.endHandler = handler;
    if (this.pendingEndCall) {
      console.log('📞 CallKeep draining pending endCall:', this.pendingEndCall);
      const pending = this.pendingEndCall;
      this.pendingEndCall = null;
      handler(pending);
    }
  }

  /**
   * Register a handler for a call being ended by the *other* party, delivered
   * via an FCM/VoIP push rather than the CallKeep native UI. This lets
   * CallContext tear down active Agora/UI state even when the socket
   * connection was dropped (e.g. app was backgrounded) and only the push
   * channel got the call_ended event through.
   */
  onRemoteCallEnded(handler: RemoteEndHandler) {
    this.remoteEndHandler = handler;
  }

  /**
   * Called by push notification handlers (foreground FCM listener and the
   * killed-state background handler) when a call_ended push arrives.
   */
  notifyRemoteCallEnded(callSessionId: string, reason?: string) {
    this.remoteEndHandler?.(callSessionId, reason);
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

    // On iOS, the native AppDelegate (PKPushRegistryDelegate) has already
    // reported every call_incoming VoIP push to CallKit synchronously,
    // before any JS code runs (see withVoipPushNotification.js). Calling
    // RNCallKeep.displayIncomingCall/reportNewIncomingCall again here for
    // the same UUID would report the call to CallKit a second time, which
    // can desync CallKit's internal state from what the JS bridge expects
    // and break answer/end handling. So on iOS this call site only needs to
    // record bookkeeping — the actual CallKit UI is already showing.
    if (Platform.OS === 'ios') {
      this.pendingCalls.set(info.uuid, info);
      return;
    }

    try {
      this.pendingCalls.set(info.uuid, info);
      const handle = info.callerName || 'FRETIKO CALL';
      const localizedCallerName =
        Platform.OS === 'android' && info.callerName
          ? `FRETIKO CALL - ${info.callerName}`
          : handle;
      await RNCallKeep.displayIncomingCall(
        info.uuid,
        handle,
        localizedCallerName,
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
      this.answerHandler = null;
      this.endHandler = null;
      this.pendingAnswerCall = null;
      this.pendingEndCall = null;
      this.setupPromise = null;
      this.isSetup = false;
    } catch (error) {
      console.error('❌ CallKeep teardown failed:', error);
    }
  }
}

export const callkeepService = new CallkeepService();
