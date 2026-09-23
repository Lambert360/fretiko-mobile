/**
 * Feature Flags Configuration
 * Controls which features are enabled/disabled in the app
 */

export const getFeatureFlags = () => {
  return {
    // MFA (Multi-Factor Authentication) feature
    mfaEnabled: process.env.EXPO_PUBLIC_MFA_ENABLED === 'true' || true,
    mfaTotpEnabled: true,
    mfaBackupCodesEnabled: false, // Future enhancement
    
    // Security settings
    securitySettingsEnabled: true,
    
    // Biometric authentication (future)
    biometricAuthEnabled: false,
  };
};

export const isMFAEnabled = () => {
  return getFeatureFlags().mfaEnabled;
};

export const isMFATotpEnabled = () => {
  return getFeatureFlags().mfaTotpEnabled;
};
