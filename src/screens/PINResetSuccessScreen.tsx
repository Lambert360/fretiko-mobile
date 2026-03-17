/**
 * FRETIKO MOBILE - PIN RESET SUCCESS SCREEN
 * 
 * Confirmation screen shown after successful PIN reset
 * Part of the forgot PIN flow
 * the screen needed extra attention. caching issue. lol
 */


import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface PINResetSuccessScreenProps {
  navigation: any;
  route: any;
}

const PINResetSuccessScreen: React.FC<PINResetSuccessScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const goToWallet = () => {
    // Navigate to wallet withdrawal screen since PIN is used for withdrawals
    // Use replace to prevent going back to success screen
    navigation.replace('WalletWithdraw');
  };

  const goToSecurity = () => {
    // Navigate to account settings screen
    navigation.navigate('AccountSettings');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Success Animation Area */}
      <View style={styles.successContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#27ae60" />
        </View>
        <Text style={styles.successTitle}>PIN Reset Successful!</Text>
        <Text style={styles.successMessage}>
          Your withdrawal PIN has been updated successfully. You can now use it for secure withdrawals.
        </Text>
      </View>

      {/* Security Information */}
      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="shield-checkmark" size={24} color="#F39C12" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Security Enhanced</Text>
            <Text style={styles.infoText}>
              Your new PIN is now active for all withdrawal transactions
            </Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.infoIcon}>
            <Ionicons name="lock-closed" size={24} color="#3498db" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>PIN Updated</Text>
            <Text style={styles.infoText}>
              You can now use your new 6-digit PIN immediately
            </Text>
          </View>
        </View>
      </View>

      {/* Security Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Important Security Notes:</Text>
        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <Ionicons name="information-circle" size={16} color="#F39C12" />
            <Text style={styles.tipText}>
              Never share your PIN with anyone
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="information-circle" size={16} color="#F39C12" />
            <Text style={styles.tipText}>
              Avoid using personal information like birth dates
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="information-circle" size={16} color="#F39C12" />
            <Text style={styles.tipText}>
              Change your PIN regularly for security
            </Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="information-circle" size={16} color="#F39C12" />
            <Text style={styles.tipText}>
              Store your PIN securely and don't write it down
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={goToWallet}
        >
          <Text style={styles.buttonText}>Continue Withdrawal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={goToSecurity}
        >
          <Text style={styles.secondaryButtonText}>Security Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          If you didn't request this PIN reset, please contact support immediately
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 30,
  },
  iconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tipsContainer: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 12,
    flex: 1,
  },
  buttonContainer: {
    gap: 16,
    paddingHorizontal: 20,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#F39C12',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#F39C12',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F39C12',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
});

export default PINResetSuccessScreen;
