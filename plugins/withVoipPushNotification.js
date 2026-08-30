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
 * - Patch the library header with explicit NS_SWIFT_NAME attributes so the
 *   renamed SDK selectors compile cleanly from Swift
 * - Insert PushKit setup and delegate methods into AppDelegate.swift
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

  // 4. Patch react-native-voip-push-notification's header to add explicit
  //    NS_SWIFT_NAME attributes before pod install picks it up.
  config = withDangerousMod(config, ['ios', (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const headerPath = path.join(
      projectRoot,
      'node_modules',
      'react-native-voip-push-notification',
      'ios',
      'RNVoipPushNotification',
      'RNVoipPushNotificationManager.h'
    );

    if (fs.existsSync(headerPath)) {
      let header = fs.readFileSync(headerPath, 'utf8');

      if (!header.includes('NS_SWIFT_NAME')) {
        header = header.replace(
          '+ (void)didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(NSString *)type;',
          '+ (void)didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(NSString *)type NS_SWIFT_NAME(didUpdate(_:forType:));'
        );
        header = header.replace(
          '+ (void)didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(NSString *)type;',
          '+ (void)didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(NSString *)type NS_SWIFT_NAME(didReceiveIncomingPush(with:forType:));'
        );
        fs.writeFileSync(headerPath, header);
      }
    }

    return config;
  }]);

  // 5. Modify AppDelegate.swift to set up the PKPushRegistry and delegate methods
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
    if (!newContents.includes('RNVoipPushNotificationManager.didUpdate')) {
      const pushDelegateMethods = `

  // MARK: - PKPushRegistryDelegate

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue)
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType
  ) {
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    // iOS 11+ requires calling the completion handler. Use the VoIP
    // payload's callSessionId as the completion key so JS can call
    // onVoipNotificationCompleted(data.callSessionId) after it finishes.
    let callSessionId = payload.dictionaryPayload["callSessionId"] as? String
      ?? payload.dictionaryPayload["uuid"] as? String
      ?? UUID().uuidString
    RNVoipPushNotificationManager.addCompletionHandler(callSessionId, completionHandler: completion)
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)
  }
`;
      newContents = newContents.replace(
        '}\n\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {',
        `${pushDelegateMethods}\n}\n\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {`
      );
    }

    // Make sure the bridging header imports the VoIP manager
    const targetName = getProjectName(config.modRequest.projectRoot);
    const bridgingHeaderPath = path.join(
      config.modRequest.platformProjectRoot,
      targetName,
      `${targetName}-Bridging-Header.h`
    );
    fs.mkdirSync(path.dirname(bridgingHeaderPath), { recursive: true });
    if (!fs.existsSync(bridgingHeaderPath)) {
      fs.writeFileSync(bridgingHeaderPath, '// Bridging header\n');
    }
    const importLine = '#import <RNVoipPushNotification/RNVoipPushNotificationManager.h>';
    const oldImportLine = '#import "FretikoPushKitManager.h"';
    let bridgingContents = fs.readFileSync(bridgingHeaderPath, 'utf8');
    bridgingContents = bridgingContents.replace(oldImportLine, '');
    if (!bridgingContents.includes(importLine)) {
      bridgingContents = `${bridgingContents.trim()}\n${importLine}\n`;
      fs.writeFileSync(bridgingHeaderPath, bridgingContents);
    }

    config.modResults.contents = newContents;
    return config;
  });

  return config;
};

module.exports = withVoipPushNotification;
