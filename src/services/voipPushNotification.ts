import { Platform } from 'react-native';
import RNVoipPushNotification from 'react-native-voip-push-notification';
import { supabase } from '../lib/supabase';
import { notificationsAPI } from './notificationsAPI';
import { callkeepService } from './callkeepService';
import { pushNotificationService } from './pushNotificationService';

let isInitialized = false;

const handleRegister = async (token: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      await notificationsAPI.registerVoipPushToken(session.access_token, token);
      console.log('✅ VoIP token registered:', token);
    } else {
      console.warn('⚠️ No active session to register VoIP token');
    }
  } catch (error) {
    console.error('❌ Failed to register VoIP token:', error);
  }
};

const handleNotification = async (notification: any) => {
  const data = notification || {};
  const callSessionId = data.callSessionId || data.uuid;

  if (data.type === 'call_incoming') {
    await callkeepService.displayIncomingCall({
      uuid: data.callSessionId,
      callSessionId: data.callSessionId,
      conversationId: data.conversationId,
      callerName: data.callerName || 'Unknown Caller',
      callType: data.callType || 'audio',
    });
  } else if (data.type === 'call_ended' && callSessionId) {
    await callkeepService.endCallkeepCall(callSessionId);
    callkeepService.setActiveCall(null);
    await pushNotificationService.clearAllNotifications();
    await pushNotificationService.setBadgeCount(0);
  }

  const completionUuid = callSessionId || data.uuid;
  if (completionUuid) {
    RNVoipPushNotification.onVoipNotificationCompleted(completionUuid);
  }
};

const handleDidLoadWithEvents = (events: any[]) => {
  events?.forEach((event: any) => {
    if (event.name === RNVoipPushNotification.RNVoipPushRemoteNotificationsRegisteredEvent) {
      handleRegister(event.data);
    } else if (event.name === RNVoipPushNotification.RNVoipPushRemoteNotificationReceivedEvent) {
      handleNotification(event.data);
    }
  });
};

export const initializeVoipPushNotifications = () => {
  if (isInitialized) return;
  if (Platform.OS !== 'ios') return;

  isInitialized = true;

  RNVoipPushNotification.addEventListener('register', handleRegister);
  RNVoipPushNotification.addEventListener('notification', handleNotification);
  RNVoipPushNotification.addEventListener('didLoadWithEvents', handleDidLoadWithEvents);

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
