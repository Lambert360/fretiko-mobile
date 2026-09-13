const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Writes `android.minSdkVersion` to android/gradle.properties so the
 * ExpoRootProjectPlugin / version catalog picks it up.
 *
 * Expo SDK 54 prebuild does NOT automatically write the app.json
 * `android.minSdkVersion` value to gradle.properties — it only writes
 * `hermesEnabled` and `newArchEnabled`. Without this plugin the build
 * silently falls back to the React Native default (minSdk 24), which
 * crashes react-native-vision-camera's HardwareBuffer path on API 26+
 * devices that are running API 28 (e.g. Infinix X650D Android 9).
 */
function withMinSdkGradleProperty(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const minSdk = config.android?.minSdkVersion;

    if (minSdk == null) {
      return config;
    }

    // Remove any existing android.minSdkVersion entry
    const existingIndex = props.findIndex(
      (p) => p.key === 'android.minSdkVersion'
    );
    if (existingIndex >= 0) {
      props.splice(existingIndex, 1);
    }

    props.push({
      type: 'property',
      key: 'android.minSdkVersion',
      value: String(minSdk),
    });

    return config;
  });
}

module.exports = withMinSdkGradleProperty;
