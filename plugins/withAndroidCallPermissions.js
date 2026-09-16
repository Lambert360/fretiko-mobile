const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Ensure the Android permissions that react-native-callkeep's
 * VoiceConnectionService needs are present in the final manifest.
 *
 * react-native-callkeep starts a foreground service with type
 * FOREGROUND_SERVICE_TYPE_MICROPHONE, which requires both the generic
 * FOREGROUND_SERVICE permission and FOREGROUND_SERVICE_MICROPHONE on
 * Android 14+.
 */
const withAndroidCallPermissions = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = [];
    }

    // Strip any existing permission entries for the permissions we need, so we
    // can re-add them cleanly (this removes stale entries with tools:node="remove").
    const targetNames = new Set([
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    ]);

    manifest['uses-permission'] = manifest['uses-permission'].filter((perm) => {
      if (!perm?.$) return true;
      return !targetNames.has(perm.$['android:name']);
    });

    for (const name of targetNames) {
      manifest['uses-permission'].push({
        $: { 'android:name': name },
      });
    }

    return config;
  });
};

module.exports = withAndroidCallPermissions;
