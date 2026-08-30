import { AppState } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { callkeepService } from './callkeepService';

const BACKGROUND_CALL_NOTIFICATION_TASK = 'BACKGROUND_CALL_NOTIFICATION_TASK';

const parsePayload = (taskData: any) => {
  if (!taskData) return {};

  // Notification response (user tapped an action)
  if (taskData.actionIdentifier !== undefined) {
    return taskData.notification?.request?.content?.data || {};
  }

  // Full notification object (background notification with a remote trigger)
  if (taskData.notification) {
    return taskData.notification.request?.content?.data || {};
  }

  // FCM data message: the remote payload is in `data`.
  // Expo's server may wrap the original data in a JSON string under `dataString`.
  const raw = taskData.data || taskData;
  if (raw?.dataString && typeof raw.dataString === 'string') {
    try {
      return JSON.parse(raw.dataString);
    } catch (e) {
      console.error('❌ Background call task: failed to parse dataString:', e);
    }
  }
  return raw || {};
};

TaskManager.defineTask(
  BACKGROUND_CALL_NOTIFICATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
    if (error) {
      console.error('❌ Background call task error:', error);
      return;
    }

    // Do not ring when the app is already in the foreground; the socket/CallContext handles it.
    if (AppState.currentState === 'active') {
      console.log('📱 App is active; skipping background call task');
      return;
    }

    const payload = parsePayload(data);

    if (payload.type === 'call_incoming') {
      const { callSessionId, conversationId, callerName, callType } = payload;
      if (!callSessionId) {
        console.warn('⚠️ Background call task missing callSessionId');
        return;
      }

      console.log('📞 Background task: call_incoming', callSessionId);
      try {
        await callkeepService.displayIncomingCall({
          uuid: callSessionId,
          callSessionId,
          conversationId: conversationId || '',
          callerName: callerName || 'Unknown Caller',
          callType: callType || 'audio',
        });
        console.log('✅ CallKeep incoming call displayed in background');
      } catch (e) {
        console.error('❌ Failed to display CallKeep incoming call in background:', e);
      }
    } else if (payload.type === 'call_ended' && payload.callSessionId) {
      console.log('📞 Background task: call_ended', payload.callSessionId);
      try {
        await callkeepService.endCallkeepCall(payload.callSessionId);
        callkeepService.setActiveCall(null);
        await Notifications.dismissAllNotificationsAsync();
        await Notifications.setBadgeCountAsync(0);
      } catch (e) {
        console.error('❌ Failed to end CallKeep call in background:', e);
      }
    }
  },
);

Notifications.registerTaskAsync(BACKGROUND_CALL_NOTIFICATION_TASK).catch((error) =>
  console.error('❌ Failed to register background call task:', error),
);
