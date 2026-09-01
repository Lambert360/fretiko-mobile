const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Applies the Google Services Gradle plugin and copies google-services.json
 * to the Android app directory for @react-native-firebase/messaging.
 * This is the minimal Android-only setup; iOS is kept out via react-native.config.js.
 */
module.exports = function withFirebaseAndroidGradle(config) {
  // 1. Add google-services classpath to the project build.gradle
  config = withProjectBuildGradle(config, (config) => {
    const file = config.modResults;
    const classpath = "classpath 'com.google.gms:google-services:4.4.2'";
    if (!file.contents.includes(classpath)) {
      file.contents = file.contents.replace(
        /dependencies\s*\{([^}]*)\}/,
        `dependencies {$1    ${classpath}\n  }`
      );
    }
    return config;
  });

  // 2. Apply the plugin in the app build.gradle
  config = withAppBuildGradle(config, (config) => {
    const file = config.modResults;
    const plugin = "apply plugin: 'com.google.gms.google-services'";
    if (!file.contents.includes(plugin)) {
      file.contents = file.contents.replace(
        /apply plugin: "com\.android\.application"/,
        `apply plugin: "com.android.application"\n${plugin}`
      );
    }
    return config;
  });

  // 3. Copy google-services.json into android/app if it is configured in app.json
  config = withDangerousMod(config, ['android', async (config) => {
    const googleServicesFile = config.android?.googleServicesFile;
    if (googleServicesFile) {
      const src = path.resolve(config.modRequest.projectRoot, googleServicesFile);
      const dest = path.resolve(
        config.modRequest.platformProjectRoot,
        'app',
        'google-services.json'
      );
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }
    return config;
  }]);

  return config;
};
