const { withAndroidManifest } = require('@expo/config-plugins');

const FIREBASE_INTENTS = [
  'com.google.firebase.MESSAGING_EVENT',
  'com.google.firebase.INSTANCE_ID_EVENT',
  'com.google.android.c2dm.intent.RECEIVE',
  'com.google.android.c2dm.intent.REGISTRATION',
];

/**
 * Disable the FCM service/receiver in expo-notifications on Android so
 * react-native-firebase/messaging can own FCM on this platform.
 * iOS is unaffected and can continue using expo-notifications for APNs/Expo Push.
 */
module.exports = function withAndroidDisableExpoFcm(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return config;

    // Add tools namespace for merge overrides
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // The React Native CLI autolinker reads the AndroidManifest package
    // attribute to determine project.android.packageName. The build.gradle
    // namespace is the source of truth, but adding this keeps autolinking happy.
    if (!manifest.$.package) {
      manifest.$.package = config.android?.package || 'com.kinging.fretikomobile';
    }

    // Resolve the default_notification_color metadata conflict between
    // expo-notifications and react-native-firebase/messaging by telling the
    // manifest merger to keep the app's value.
    if (application['meta-data']) {
      const metaData = Array.isArray(application['meta-data'])
        ? application['meta-data']
        : [application['meta-data']];
      metaData.forEach((meta) => {
        if (meta.$?.['android:name'] === 'com.google.firebase.messaging.default_notification_color') {
          meta.$['tools:replace'] = 'android:resource';
        }
      });
    }

    const isExpoFcmElement = (element) => {
      if (!element.$) return false;
      const name = element.$['android:name'] || '';
      // Keep react-native-firebase/messaging's own FCM service
      if (name.startsWith('io.invertase.firebase')) return false;

      const filters = Array.isArray(element['intent-filter'])
        ? element['intent-filter']
        : [element['intent-filter']].filter(Boolean);

      return filters.some((filter) => {
        const actions = Array.isArray(filter.action) ? filter.action : [];
        return actions.some((action) =>
          FIREBASE_INTENTS.includes(action.$?.['android:name'])
        );
      });
    };

    if (application.service) {
      application.service = application.service.filter(
        (s) => !isExpoFcmElement(s)
      );
    }

    if (application.receiver) {
      application.receiver = application.receiver.filter(
        (r) => !isExpoFcmElement(r)
      );
    }

    return config;
  });
};
