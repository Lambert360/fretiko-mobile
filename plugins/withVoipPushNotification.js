const {
  withInfoPlist,
  withXcodeProject,
  withAppDelegate,
  withEntitlementsPlist,
  withDangerousMod,
} = require('@expo/config-plugins');
const {
  addFramework,
  getProjectName,
} = require('@expo/config-plugins/build/ios/utils/Xcodeproj');
const fs = require('fs');
const path = require('path');

/**
 * Custom Expo config plugin for iOS PushKit / react-native-voip-push-notification.
 *
 * This plugin handles the full iOS native setup end-to-end:
 * - Info.plist UIBackgroundModes (audio, remote-notification, voip)
 * - aps-environment entitlement
 * - Link PushKit.framework
 * - Insert PushKit setup and delegate methods into AppDelegate.swift
 * - Update the Objective-C bridging header for RNVoipPushNotification
 */
const withVoipPushNotification = (config) => {
  // 1. Ensure UIBackgroundModes contains the modes PushKit needs
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    if (!Array.isArray(infoPlist.UIBackgroundModes)) {
      infoPlist.UIBackgroundModes = [];
    }
    ['audio', 'remote-notification', 'voip'].forEach((mode) => {
      if (!infoPlist.UIBackgroundModes.includes(mode)) {
        infoPlist.UIBackgroundModes.push(mode);
      }
    });
    return config;
  });

  // 2. Ensure the aps-environment entitlement is set for VoIP pushes
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    if (!entitlements['aps-environment']) {
      entitlements['aps-environment'] = 'production';
    }
    return config;
  });

  // 3. Link the PushKit system framework in the Xcode project
  config = withXcodeProject(config, (config) => {
    const projectName = getProjectName(config.modRequest.projectRoot);
    addFramework({
      project: config.modResults,
      projectName,
      framework: 'PushKit.framework',
    });
    return config;
  });

  // 4. Modify AppDelegate.swift to set up the PKPushRegistry and delegate methods
  config = withAppDelegate(config, (config) => {
    const { contents, language } = config.modResults;
    if (language !== 'swift' || !contents) {
      return config;
    }

    let newContents = contents;

    // Add `import PushKit` if it is missing
    if (!newContents.includes('import PushKit')) {
      newContents = newContents.replace(
        'import ReactAppDependencyProvider\n',
        'import ReactAppDependencyProvider\nimport PushKit\n'
      );
    }

    // Conform AppDelegate to PKPushRegistryDelegate
    newContents = newContents.replace(
      'public class AppDelegate: ExpoAppDelegate {',
      'public class AppDelegate: ExpoAppDelegate, PKPushRegistryDelegate {'
    );

    // Add the voipRegistry property
    if (!newContents.includes('var voipRegistry: PKPushRegistry?')) {
      newContents = newContents.replace(
        '  var reactNativeFactory: RCTReactNativeFactory?\n',
        '  var reactNativeFactory: RCTReactNativeFactory?\n  var voipRegistry: PKPushRegistry?\n'
      );
    }

    // Insert the PKPushRegistry setup right after `bindReactNativeFactory`
    if (!newContents.includes('Initialize PushKit registry')) {
      newContents = newContents.replace(
        '    bindReactNativeFactory(factory)\n\n#if os(iOS) || os(tvOS)',
        `    bindReactNativeFactory(factory)\n\n    // Initialize PushKit registry for iOS VoIP call notifications\n    let registry = PKPushRegistry(queue: .main)\n    registry.delegate = self\n    registry.desiredPushTypes = [.voIP]\n    self.voipRegistry = registry\n\n#if os(iOS) || os(tvOS)`
      );
    }

    // Append the PKPushRegistryDelegate methods before ReactNativeDelegate
    if (!newContents.includes('RNVoipPushNotificationManager.didUpdatePushCredentials')) {
      const pushDelegateMethods = `

  // MARK: - PKPushRegistryDelegate

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    forType type: PKPushType
  ) {
    RNVoipPushNotificationManager.didUpdatePushCredentials(pushCredentials, forType: type.rawValue)
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    forType type: PKPushType
  ) {
    RNVoipPushNotificationManager.didReceiveIncomingPushWithPayload(payload, forType: type.rawValue)
  }
`;
      newContents = newContents.replace(
        '}\n\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {',
        `${pushDelegateMethods}\n}\n\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {`
      );
    }

    config.modResults.contents = newContents;
    return config;
  });

  // 5. Update the bridging header so the Swift code can see RNVoipPushNotificationManager
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const targetName = getProjectName(config.modRequest.projectRoot);
      const bridgingHeaderPath = path.join(
        config.modRequest.platformProjectRoot,
        targetName,
        `${targetName}-Bridging-Header.h`
      );

      if (fs.existsSync(bridgingHeaderPath)) {
        const importLine = '#import <RNVoipPushNotification/RNVoipPushNotificationManager.h>';
        let contents = fs.readFileSync(bridgingHeaderPath, 'utf8');
        if (!contents.includes(importLine)) {
          contents = `${contents.trim()}\n${importLine}\n`;
          fs.writeFileSync(bridgingHeaderPath, contents);
        }
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withVoipPushNotification;
