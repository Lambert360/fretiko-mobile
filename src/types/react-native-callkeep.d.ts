declare module 'react-native-callkeep' {
  interface IOSOptions {
    appName: string;
    supportsVideo?: boolean;
    maximumCallGroups?: string;
    maximumCallsPerCallGroup?: string;
    includesCallsInRecents?: boolean;
    imageName?: string;
    ringtoneSound?: string;
  }

  interface AndroidForegroundService {
    channelId: string;
    channelName: string;
    notificationTitle: string;
    notificationIcon?: string;
  }

  interface AndroidOptions {
    alertTitle: string;
    alertDescription: string;
    cancelButton: string;
    okButton: string;
    imageName?: string;
    additionalPermissions?: string[];
    selfManaged?: boolean;
    foregroundService?: AndroidForegroundService;
  }

  interface SetupOptions {
    ios: IOSOptions;
    android: AndroidOptions;
  }

  interface AnswerCallPayload {
    callUUID: string;
  }

  interface EndCallPayload {
    callUUID: string;
  }

  type CallKeepEventMap = {
    answerCall: AnswerCallPayload;
    endCall: EndCallPayload;
    didActivateAudioSession: Record<string, never>;
    didDisplayIncomingCall: { callUUID: string; handle: string; localizedCallerName: string; hasVideo: string; fromPushKit: string; payload: any };
    didPerformSetMutedCallAction: { callUUID: string; muted: boolean };
    didReceiveStartCallAction: { callUUID: string; handle: string; name: string; video: boolean };
    showIncomingCallUi: { callUUID: string; handle: string; name: string };
  };

  const RNCallKeep: {
    setup(options: SetupOptions): void;
    setAvailable(available: boolean): void;
    displayIncomingCall(
      uuid: string,
      handle: string,
      localizedCallerName?: string,
      handleType?: 'generic' | 'number' | 'email',
      hasVideo?: boolean,
    ): void;
    endCall(uuid: string): void;
    endAllCalls(): void;
    rejectCall(uuid: string): void;
    setCurrentCallActive(uuid: string): void;
    backToForeground(): void;
    addEventListener<K extends keyof CallKeepEventMap>(
      event: K,
      handler: (payload: CallKeepEventMap[K]) => void,
    ): void;
    removeEventListener(event: keyof CallKeepEventMap): void;
  };

  export default RNCallKeep;
}
