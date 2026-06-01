const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Custom Expo config plugin for react-native-callkeep.
 * react-native-callkeep has no app.plugin.js, so we manually inject
 * the VoiceConnectionService into AndroidManifest.xml. Without this,
 * Android throws a SecurityException when callkeep tries to register
 * a PhoneAccount with TelecomManager.
 */
const withCallkeep = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return config;

    if (!application.service) {
      application.service = [];
    }

    const SERVICE_NAME = 'io.wazo.callkeep.VoiceConnectionService';
    const alreadyAdded = application.service.some(
      (s) => s.$?.['android:name'] === SERVICE_NAME
    );

    if (!alreadyAdded) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:label': '@string/app_name',
          'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.telecom.ConnectionService' },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withCallkeep;
