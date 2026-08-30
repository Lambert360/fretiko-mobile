import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { callkeepService } from './callkeepService';

const BACKGROUND_CALL_NOTIFICATION_TASK = 'BACKGROUND_CALL_NOTIFICATION_TASK';

TaskManager.defineTask(
  BACKGROUND_CALL_NOTIFICATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
    if (error) {
      console.error('❌ Background call task error:', error);
      return;
    }

    const taskData = (data || {}) as any;
    const notification = taskData?.notification as Notifications.Notification | undefined;
    const payload = (notification?.request?.content?.data as any) || {};

    if (payload.type === 'call_incoming') {
      const { callSessionId, conversationId, callerName, callType } = payload;
      if (!callSessionId) return;

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
