import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/userAPI';

interface UserProfile {
  id: string;
  username: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  phone?: string;
  dateOfBirth?: string;
  isSeller: boolean;
  isRider?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AccountSettingsScreenProps {
  navigation: any;
  route?: {
    params?: {
      profile?: UserProfile;
    };
  };
}

export const AccountSettingsScreen: React.FC<AccountSettingsScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(route?.params?.profile || null);
  const [loading, setLoading] = useState(!route?.params?.profile);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) {
      loadProfile();
    }
  }, []);

  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getProfile();
      setProfile(profileData);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert(
        'Profile Error',
        'Could not load your profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account Settings</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile', { profile })}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Text style={styles.avatarInitials}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Text>
              </View>
            )}
            {profile?.isSeller && (
              <View style={styles.sellerBadge}>
                <Text style={styles.sellerBadgeText}>🏪</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.changeAvatarButton}
            onPress={() => navigation.navigate('EditProfile', { profile, focusAvatar: true })}
          >
            <Text style={styles.changeAvatarText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={styles.userInfoSection}>
          <Text style={styles.displayName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.username}>@{profile?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Bio Section */}
        {profile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          
          {profile?.location && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>📍 Location</Text>
              <Text style={styles.detailValue}>{profile.location}</Text>
            </View>
          )}
          
          {profile?.phone && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>📞 Phone</Text>
              <Text style={styles.detailValue}>{profile.phone}</Text>
            </View>
          )}
          
          {profile?.dateOfBirth && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>🎂 Birthday</Text>
              <Text style={styles.detailValue}>{formatDate(profile.dateOfBirth)}</Text>
            </View>
          )}
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>📅 Member Since</Text>
            <Text style={styles.detailValue}>{formatDate(profile?.createdAt || '')}</Text>
          </View>
        </View>

        {/* Account Type Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Type</Text>
          <View style={styles.accountTypeContainer}>
            <View style={styles.accountTypeInfo}>
              <Text style={styles.accountType}>
                {profile?.isSeller ? '🏪 Vendor Account' : '👤 Citizen Account'}
              </Text>
              {profile?.isRider && (
                <Text style={styles.riderBadge}>🚗 Rider</Text>
              )}
            </View>
            <Text style={styles.accountTypeDescription}>
              {profile?.isSeller 
                ? 'You can sell products and services on Fretiko'
                : 'Upgrade to vendor account to start selling'}
            </Text>
          </View>
        </View>

        {/* Settings Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Coming Soon', 'Privacy settings will be available soon!')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="shield-outline" size={20} color="#007AFF" />
              <Text style={styles.settingLabel}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#B0B0B0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Coming Soon', 'Notification preferences will be available soon!')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={20} color="#007AFF" />
              <Text style={styles.settingLabel}>Notification Preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#B0B0B0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Coming Soon', 'Account management will be available soon!')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="person-outline" size={20} color="#007AFF" />
              <Text style={styles.settingLabel}>Account Management</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#B0B0B0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Coming Soon', 'Data & storage settings will be available soon!')}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="cloud-outline" size={20} color="#007AFF" />
              <Text style={styles.settingLabel}>Data & Storage</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#B0B0B0" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => navigation.navigate('RoleSelection', { isFirstTime: false })}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>
              Change Role
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Help & Support will be available soon!')}
          >
            <Ionicons name="help-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Help & Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Terms & Privacy will be available soon!')}
          >
            <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Terms & Privacy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#B0B0B0',
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  defaultAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sellerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFD700',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  sellerBadgeText: {
    fontSize: 16,
  },
  changeAvatarButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeAvatarText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  userInfoSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 16,
    color: '#B0B0B0',
    lineHeight: 24,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  detailLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#B0B0B0',
    flex: 1,
    textAlign: 'right',
  },
  accountTypeContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
  },
  accountTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  riderBadge: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  accountTypeDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '500',
  },
  actionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  actionButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});