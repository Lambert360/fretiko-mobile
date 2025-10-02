import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { userAPI } from '../services/userAPI';
import { useAuth } from '../contexts/AuthContext';

export type UserRole = 'citizen' | 'rider' | 'vendor';

interface RoleOption {
  role: UserRole;
  title: string;
  emoji: string;
  description: string;
  benefits: string[];
  color: string;
}

interface RoleSelectionScreenProps {
  navigation: any;
  route: {
    params: {
      isFirstTime?: boolean;
    };
  };
}

const roleOptions: RoleOption[] = [
  {
    role: 'citizen',
    title: 'Citizen',
    emoji: '🏠',
    description: 'Shop and discover amazing products and services',
    benefits: [
      'Browse and buy products',
      'Book services and experiences', 
      'Chat with sellers and riders',
      'Track deliveries in real-time',
      'Join the Fretiko community'
    ],
    color: '#007AFF'
  },
  {
    role: 'rider', 
    title: 'Rider',
    emoji: '🏍️',
    description: 'Deliver orders and earn money on your schedule',
    benefits: [
      'Earn money from deliveries',
      'Flexible working hours',
      'Track earnings and trips', 
      'Build customer relationships',
      'Be part of the delivery network'
    ],
    color: '#FF9500'
  },
  {
    role: 'vendor',
    title: 'Vendor', 
    emoji: '🏪',
    description: 'Sell products and offer services to customers',
    benefits: [
      'List and sell products',
      'Offer services and bookings',
      'Manage orders and inventory',
      'Accept payments seamlessly', 
      'Grow your business reach'
    ],
    color: '#34C759'
  }
];

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const { user, clearNewUserFlag } = useAuth();
  const { isFirstTime = true } = route.params || {};
  
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const handleContinue = async () => {
    if (!selectedRole) {
      Alert.alert('Select a Role', 'Please choose how you want to use Fretiko');
      return;
    }

    setLoading(true);
    setUpdatingProfile(true);

    try {
      // Update user profile with selected role
      await userAPI.updateProfile({
        isSeller: selectedRole === 'vendor',
        isRider: selectedRole === 'rider',
        preferences: {
          primaryRole: selectedRole,
          roleSelectedAt: new Date().toISOString(),
        }
      });

      if (isFirstTime) {
        // Clear the new user flag - this will automatically navigate to Main in App.tsx
        clearNewUserFlag();
        Alert.alert(
          `Welcome ${getSelectedRoleOption()?.title}! 🎉`,
          `You're now set up as a ${getSelectedRoleOption()?.title.toLowerCase()}. You can always change this later in your profile settings.`,
          [
            { 
              text: 'Get Started', 
              onPress: () => {
                // The navigation will be handled automatically by clearing the flag
              }
            }
          ]
        );
      } else {
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert(
        'Update Failed',
        error.message || 'Could not update your role. Please try again.'
      );
    } finally {
      setLoading(false);
      setUpdatingProfile(false);
    }
  };

  const getSelectedRoleOption = () => {
    return roleOptions.find(option => option.role === selectedRole);
  };

  const handleSkip = () => {
    if (isFirstTime) {
      // Default to citizen if skipped
      setSelectedRole('citizen');
      handleContinue();
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isFirstTime ? 'Choose Your Role' : 'Change Your Role'}
        </Text>
        <Text style={styles.subtitle}>
          {isFirstTime 
            ? `Welcome ${user?.firstName}! How do you want to use Fretiko?`
            : 'Select your new primary role'
          }
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {roleOptions.map((option) => (
          <TouchableOpacity
            key={option.role}
            style={[
              styles.roleCard,
              selectedRole === option.role && [
                styles.selectedCard,
                { borderColor: option.color }
              ],
              loading && styles.disabledCard
            ]}
            onPress={() => handleRoleSelect(option.role)}
            disabled={loading}
          >
            <View style={styles.roleHeader}>
              <Text style={styles.roleEmoji}>{option.emoji}</Text>
              <View style={styles.roleTitleContainer}>
                <Text style={[styles.roleTitle, { color: option.color }]}>
                  {option.title}
                </Text>
                {selectedRole === option.role && (
                  <View style={[styles.selectedBadge, { backgroundColor: option.color }]}>
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.roleDescription}>{option.description}</Text>

            <View style={styles.benefitsList}>
              {option.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Text style={[styles.benefitDot, { color: option.color }]}>•</Text>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {selectedRole && (
          <TouchableOpacity 
            style={[styles.continueButton, { backgroundColor: getSelectedRoleOption()?.color }]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={[styles.continueButtonText, { marginLeft: 8 }]}>
                  {updatingProfile ? 'Setting up your profile...' : 'Processing...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.continueButtonText}>
                Continue as {getSelectedRoleOption()?.title}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {isFirstTime && (
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  roleCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#333',
  },
  selectedCard: {
    borderWidth: 2,
    backgroundColor: '#1A1A1A',
  },
  disabledCard: {
    opacity: 0.6,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  roleTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  selectedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  roleDescription: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 16,
    lineHeight: 24,
  },
  benefitsList: {
    marginTop: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitDot: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  benefitText: {
    fontSize: 14,
    color: '#CCCCCC',
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingTop: 10,
  },
  continueButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#B0B0B0',
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});