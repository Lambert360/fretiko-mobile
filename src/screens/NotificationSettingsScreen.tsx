/**
 * FRETIKO MOBILE - NOTIFICATION SETTINGS SCREEN
 * Allows users to manage their notification preferences
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI } from '../services/notificationsAPI';
import { pushNotificationService } from '../services/pushNotificationService';

export const NotificationSettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushTokenRegistered, setPushTokenRegistered] = useState(false);
  
  // Notification preferences
  const [preferences, setPreferences] = useState({
    orders: true,
    messages: true,
    delivery: true,
    payments: true,
    social: false,
    live_events: true,
    system: true,
    marketing: false,
  });

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      setIsLoading(true);

      // Check if push notifications are enabled
      const isEnabled = await pushNotificationService.areNotificationsEnabled();
      setPushEnabled(isEnabled);

      // Check if push token is registered
      const token = pushNotificationService.getCurrentToken();
      setPushTokenRegistered(!!token);

      // Load user preferences from backend
      if (accessToken && user) {
        try {
          const userPreferences = await notificationsAPI.getPreferences(accessToken);
          setPreferences(userPreferences);
        } catch (error) {
          console.log('⚠️ Could not load preferences, using defaults');
        }
      }
    } catch (error) {
      console.error('❌ Error loading notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    try {
      const isEnabled = await pushNotificationService.requestPermissions();
      
      if (isEnabled && accessToken) {
        // Register push token
        const success = await pushNotificationService.registerPushToken(accessToken);
        
        if (success) {
          setPushEnabled(true);
          setPushTokenRegistered(true);
          Alert.alert(
            'Success',
            'Push notifications enabled successfully!'
          );
        } else {
          Alert.alert(
            'Error',
            'Failed to register push notifications. Please try again.'
          );
        }
      } else {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings to receive push notifications.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error enabling push notifications:', error);
      Alert.alert('Error', 'Failed to enable push notifications');
    }
  };

  const handleTogglePreference = async (key: keyof typeof preferences) => {
    try {
      // Update local state optimistically
      const newValue = !preferences[key];
      setPreferences(prev => ({ ...prev, [key]: newValue }));

      // Save to backend
      if (accessToken) {
        setIsSaving(true);
        await notificationsAPI.updatePreferences(accessToken, {
          ...preferences,
          [key]: newValue,
        });
        console.log(`✅ ${key} preference updated to:`, newValue);
      }
    } catch (error) {
      console.error(`❌ Error updating ${key} preference:`, error);
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !preferences[key] }));
      Alert.alert('Error', 'Failed to update preference. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      Alert.alert(
        'Test Notification',
        'Send a test notification to your device?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: async () => {
              await pushNotificationService.scheduleLocalNotification(
                'Test Notification',
                'This is a test notification from Fretiko!',
                { type: 'test' }
              );
              Alert.alert('Success', 'Test notification sent!');
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Push Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={24} color="#3498DB" />
            <Text style={styles.sectionTitle}>Push Notifications</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>
                  {pushEnabled ? 'Enabled' : 'Disabled'}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {pushEnabled
                    ? pushTokenRegistered
                      ? 'Receiving push notifications'
                      : 'Push token not registered'
                    : 'Enable to receive notifications'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusIndicator,
                  pushEnabled ? styles.statusEnabled : styles.statusDisabled,
                ]}
              />
            </View>

            {!pushEnabled && (
              <TouchableOpacity
                style={styles.enableButton}
                onPress={handleEnablePushNotifications}
              >
                <Ionicons name="notifications" size={20} color="#FFFFFF" />
                <Text style={styles.enableButtonText}>Enable Push Notifications</Text>
              </TouchableOpacity>
            )}

            {pushEnabled && (
              <TouchableOpacity
                style={styles.testButton}
                onPress={handleTestNotification}
              >
                <Ionicons name="send-outline" size={20} color="#3498DB" />
                <Text style={styles.testButtonText}>Send Test Notification</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notification Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options-outline" size={24} color="#3498DB" />
            <Text style={styles.sectionTitle}>Notification Categories</Text>
          </View>

          <View style={styles.card}>
            {/* Orders */}
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="cart-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>Orders</Text>
                  <Text style={styles.preferenceSubtitle}>
                    Order status and updates
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.orders}
                onValueChange={() => handleTogglePreference('orders')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>

            {/* Messages */}
            <View style={[styles.preferenceRow, styles.preferenceRowBorder]}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="chatbubble-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>Messages</Text>
                  <Text style={styles.preferenceSubtitle}>
                    New messages and chats
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.messages}
                onValueChange={() => handleTogglePreference('messages')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>

            {/* Delivery */}
            <View style={[styles.preferenceRow, styles.preferenceRowBorder]}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="bicycle-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>Delivery</Text>
                  <Text style={styles.preferenceSubtitle}>
                    Rider and delivery updates
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.delivery}
                onValueChange={() => handleTogglePreference('delivery')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>

            {/* Payments */}
            <View style={[styles.preferenceRow, styles.preferenceRowBorder]}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="wallet-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>Payments</Text>
                  <Text style={styles.preferenceSubtitle}>
                    Wallet and payment updates
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.payments}
                onValueChange={() => handleTogglePreference('payments')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>

            {/* Social */}
            <View style={[styles.preferenceRow, styles.preferenceRowBorder]}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="people-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>Social</Text>
                  <Text style={styles.preferenceSubtitle}>
                    Connections and interactions
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.social}
                onValueChange={() => handleTogglePreference('social')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>

            {/* Live Events */}
            <View style={[styles.preferenceRow, styles.preferenceRowBorder]}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="videocam-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>Live Events</Text>
                  <Text style={styles.preferenceSubtitle}>
                    Live streams and auctions
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.live_events}
                onValueChange={() => handleTogglePreference('live_events')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>

            {/* System */}
            <View style={[styles.preferenceRow, styles.preferenceRowBorder]}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="settings-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>System</Text>
                  <Text style={styles.preferenceSubtitle}>
                    Important system updates
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.system}
                onValueChange={() => handleTogglePreference('system')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>

            {/* Marketing */}
            <View style={[styles.preferenceRow, styles.preferenceRowBorder]}>
              <View style={styles.preferenceInfo}>
                <View style={styles.preferenceIcon}>
                  <Ionicons name="megaphone-outline" size={20} color="#3498DB" />
                </View>
                <View>
                  <Text style={styles.preferenceTitle}>Marketing</Text>
                  <Text style={styles.preferenceSubtitle}>
                    Promotions and offers
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.marketing}
                onValueChange={() => handleTogglePreference('marketing')}
                trackColor={{ false: '#444', true: '#3498DB' }}
                thumbColor="#FFFFFF"
                disabled={isSaving || !pushEnabled}
              />
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={20} color="#888" />
          <Text style={styles.infoText}>
            Push notifications require device permissions. You can manage these in your
            device settings at any time.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusEnabled: {
    backgroundColor: '#2ECC71',
  },
  statusDisabled: {
    backgroundColor: '#E74C3C',
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3498DB',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  testButtonText: {
    color: '#3498DB',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  preferenceRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  preferenceSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginLeft: 12,
  },
});

export default NotificationSettingsScreen;

