const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Force all androidx.media3 dependencies to the same version to prevent
 * AbstractMethodError from version mismatches between expo-video and expo-audio.
 */
const MEDIA3_VERSION = '1.8.0';
const MEDIA3_ARTIFACTS = [
  'media3-exoplayer',
  'media3-exoplayer-dash',
  'media3-exoplayer-hls',
  'media3-exoplayer-smoothstreaming',
  'media3-session',
  'media3-ui',
  'media3-datasource-okhttp',
  'media3-common',
];

function withForceMedia3Version(config) {
  return withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Only add once
    if (buildGradle.includes("force 'androidx.media3:")) {
      return config;
    }

    const forceLines = MEDIA3_ARTIFACTS
      .map((artifact) => `      force 'androidx.media3:${artifact}:${MEDIA3_VERSION}'`)
      .join('\n');

    const resolutionBlock = `
  configurations.all {
    resolutionStrategy {
${forceLines}
    }
  }
`;

    // Insert before the closing brace of allprojects { ... }
    // Match the last "\n}" before "apply plugin: "expo-root-project""
    config.modResults.contents = buildGradle.replace(
      /(\n\}\s*\n\s*\napply plugin: "expo-root-project")/,
      resolutionBlock + '$1'
    );

    return config;
  });
}

module.exports = withForceMedia3Version;
