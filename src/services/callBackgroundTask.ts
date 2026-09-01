import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callkeepService } from './callkeepService';

const PENDING_CALL_ENDED_KEY = '@fretiko/pendingCallEnded';

export async function getPendingCallEnded(): Promise<{ callSessionId: string; reason?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CALL_ENDED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.callSessionId) return null;
    if (parsed.timestamp && Date.now() - parsed.timestamp > 60000) {
      await clearPendingCallEnded();
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Error reading pending call ended:', error);
    return null;
  }
}

export async function clearPendingCallEnded(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CALL_ENDED_KEY);
  } catch (error) {
    console.error('Error clearing pending call ended:', error);
  }
}

async function setPendingCallEnded(callSessionId: string, reason?: string): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_CALL_ENDED_KEY,
      JSON.stringify({ callSessionId, reason, timestamp: Date.now() })
    );
  } catch (error) {
    console.error('Error setting pending call ended:', error);
  }
}

function parsePayload(rawData: any): Record<string, any> {
  if (rawData?.dataString) {
    try {
      return { ...rawData, ...JSON.parse(rawData.dataString) };
    } catch {
      return rawData || {};
    }
  }
  return rawData || {};
}

/**
 * Handle an FCM `call_incoming` message on Android (foreground or killed).
 */
export async function handleIncomingCallPush(rawData: any): Promise<void> {
  try {
    const data = parsePayload(rawData);
    const { callSessionId, callerName, conversationId, callType } = data;

    if (!callSessionId) {
      console.warn('Received call_incoming without callSessionId');
      return;
    }

    await callkeepService.displayIncomingCall({
      uuid: callSessionId,
      callSessionId,
      callerName: callerName || 'Incoming call',
      conversationId: conversationId || '',
      callType: callType === 'video' ? 'video' : 'audio',
    });
  } catch (error) {
    console.error('Error handling FCM call_incoming:', error);
  }
}

/**
 * Handle an FCM `call_ended` message on Android.
 */
export async function handleCallEndedPush(rawData: any): Promise<void> {
  try {
    const data = parsePayload(rawData);
    const { callSessionId, reason } = data;

    if (!callSessionId) return;

    callkeepService.endCallkeepCall(callSessionId);
    callkeepService.setActiveCall(null);
    // If the main app's JS context is still alive (app backgrounded, not
    // killed), this notifies CallContext to tear down any active Agora/UI
    // state too. No-op if nothing has registered a handler yet.
    callkeepService.notifyRemoteCallEnded(callSessionId, reason);
    // Persist the ended event so the main app can pick it up when it returns
    // from a killed/background state. Headless JS is a separate JS context.
    await setPendingCallEnded(callSessionId, reason);
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Error handling FCM call_ended:', error);
  }
}
