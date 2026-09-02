import { Platform } from 'react-native';
import RNVoipPushNotification from 'react-native-voip-push-notification';
import { notificationsAPI } from './notificationsAPI';
import { callkeepService } from './callkeepService';
import { pushNotificationService } from './pushNotificationService';

let isInitialized = false;
let pendingVoipToken: string | null = null;
let pendingAuthToken: string | null = null;

const registerVoipTokenIfPossible = async () => {
  if (!pendingVoipToken || !pendingAuthToken) return;
  try {
    await notificationsAPI.registerVoipPushToken(pendingAuthToken, pendingVoipToken);
    console.log('✅ VoIP token registered:', pendingVoipToken);
  } catch (error) {
    console.error('❌ Failed to register VoIP token:', error);
  }
};

const handleRegister = async (token: string) => {
  pendingVoipToken = token;
  await registerVoipTokenIfPossible();
};

export const setVoipAuthToken = (token: string | null) => {
  pendingAuthToken = token ?? null;
  if (pendingAuthToken) {
    registerVoipTokenIfPossible();
  }
};

const handleNotification = async (notification: any) => {
  const data = notification || {};
  const callSessionId = data.callSessionId || data.uuid;

  try {
    if (data.type === 'call_incoming') {
      // On iOS, displayIncomingCall() skips re-reporting to CallKit (the
      // native AppDelegate already reported this call synchronously before
      // this JS handler ran) and just records bookkeeping.
      await callkeepService.displayIncomingCall({
        uuid: callSessionId,
        callSessionId,
        conversationId: data.conversationId,
        callerName: data.callerName || 'Unknown Caller',
        callType: data.callType || 'audio',
      });
    } else if (data.type === 'call_ended' && callSessionId) {
      await callkeepService.endCallkeepCall(callSessionId);
      callkeepService.setActiveCall(null);
      // If the app JS context is alive (foreground/background), tell CallContext
      // to tear down the active Agora call/UI the same way FCM does on Android.
      callkeepService.notifyRemoteCallEnded(callSessionId, data.reason);
      await pushNotificationService.clearAllNotifications();
      await pushNotificationService.setBadgeCount(0);
    }
  } finally {
    // Always complete the PushKit notification so iOS does not penalise us.
    const completionUuid = callSessionId || data.uuid;
    if (completionUuid) {
      RNVoipPushNotification.onVoipNotificationCompleted(completionUuid);
    }
  }
};

const handleDidLoadWithEvents = async (events: any[]) => {
  for (const event of events || []) {
    if (event.name === RNVoipPushNotification.RNVoipPushRemoteNotificationsRegisteredEvent) {
      await handleRegister(event.data);
    } else if (event.name === RNVoipPushNotification.RNVoipPushRemoteNotificationReceivedEvent) {
      await handleNotification(event.data);
    }
  }
};

export const initializeVoipPushNotifications = () => {
  if (isInitialized) return;
  if (Platform.OS !== 'ios') return;

  isInitialized = true;

  // didLoadWithEvents must be added first. startObserving fires it as soon
  // as any listener is attached, so this listener has to be in place before
  // that first addEventListener triggers the native didLoadWithEvents event.
  RNVoipPushNotification.addEventListener('didLoadWithEvents', handleDidLoadWithEvents);
  RNVoipPushNotification.addEventListener('register', handleRegister);
  RNVoipPushNotification.addEventListener('notification', handleNotification);

  RNVoipPushNotification.registerVoipToken();
  console.log('✅ VoIP push notifications initialized');
};

export const cleanupVoipPushNotifications = () => {
  if (Platform.OS !== 'ios') return;
  RNVoipPushNotification.removeEventListener('register');
  RNVoipPushNotification.removeEventListener('notification');
  RNVoipPushNotification.removeEventListener('didLoadWithEvents');
  isInitialized = false;
};
