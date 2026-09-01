import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Register the Firebase Cloud Messaging background handler for Android.
// This must run before the app root is registered so the headless task is
// available when a call push arrives while the app is killed.
if (Platform.OS === 'android') {
  const messaging = require('@react-native-firebase/messaging').default;

  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    const data = remoteMessage?.data || {};

    if (data.type === 'call_incoming') {
      const { handleIncomingCallPush } = require('./src/services/callBackgroundTask');
      await handleIncomingCallPush(data);
    } else if (data.type === 'call_ended' && data.callSessionId) {
      const { handleCallEndedPush } = require('./src/services/callBackgroundTask');
      await handleCallEndedPush(data);
    }
  });
}

import App from './App';

registerRootComponent(App);
