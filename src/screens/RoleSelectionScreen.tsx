import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRegistration } from '../contexts/RegistrationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Device from 'expo-device';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type UserRole = 'citizen' | 'rider' | 'vendor' | null;

interface RoleSelectionScreenProps {
  navigation: any;
  route: {
    params: {
      isFirstTime?: boolean;
    };
  };
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  navigation,
  route,
}) => {
  const { registrationData, updateRegistrationData } = useRegistration();
  const { isFirstTime = true } = route.params || {};
  const insets = useSafeAreaInsets();

  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: 'vendor' | 'rider' | 'citizen') => {
    // Toggle role selection
    setSelectedRole(prevRole => prevRole === role ? null : role);
  };

  const handleContinue = async () => {
    setLoading(true);

    try {
      // Store role selection in registration data
      const roleData = {
        user_role: (selectedRole || 'citizen') as 'citizen' | 'vendor' | 'rider',
        is_seller: selectedRole === 'vendor',
        is_rider: selectedRole === 'rider',
      };

      updateRegistrationData('stage2', roleData);

      // Collect device information for terms acceptance tracking
      console.log('🔍 Device module available:', !!Device);
      console.log('🔍 Device.osName:', Device.osName);
      console.log('🔍 Device.modelName:', Device.modelName);
      console.log('🔍 Platform.OS:', Platform.OS);
      console.log('🔍 Platform.Version:', Platform.Version);
      
      const deviceInfo = {
        ipAddress: 'mobile_app', // Will be enhanced with real IP later
        userAgent: `${Platform.OS} ${Platform.Version} - ${Device.deviceName || Device.modelName || 'Unknown Device'} - ${Device.brand || 'Unknown Brand'} ${Device.modelName || 'Unknown Model'}`,
      };

      console.log('📱 Device info for terms acceptance:', deviceInfo);
      if (!registrationData) {
        Alert.alert('Error', 'Registration data not found. Please start over.');
        navigation.navigate('Signup');
        return;
      }

      const requestBody = {
          email: registrationData.email,
          password: registrationData.password,
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
          dateOfBirth: registrationData.dateOfBirth,
          gender: registrationData.gender,
          hasAcceptedTerms: true,
          user_role: roleData.user_role,
          is_seller: roleData.is_seller,
          is_rider: roleData.is_rider,
          // Add device info for terms acceptance tracking
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
        };

      console.log('🚀 Request body being sent:', requestBody);

      const createUserResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.3:3000'}/auth/create-verified-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const createUserResult = await createUserResponse.json();
      
      if (createUserResult.success) {
        console.log('✅ User created successfully with role:', createUserResult.user);
        
        // Navigate to welcome screen - user will signin when they tap "Explore"
        navigation.navigate('Welcome');
      } else {
        Alert.alert('Error', createUserResult.message || 'Account creation failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);

    try {
      // Skip role selection - default to citizen
      const roleData = {
        user_role: 'citizen' as const,
        is_seller: false,
        is_rider: false,
      };

      updateRegistrationData('stage2', roleData);

      // Collect device information for terms acceptance tracking
      console.log('🔍 Device module available:', !!Device);
      console.log('🔍 Device.osName:', Device.osName);
      console.log('🔍 Device.modelName:', Device.modelName);
      console.log('🔍 Platform.OS:', Platform.OS);
      console.log('🔍 Platform.Version:', Platform.Version);
      
      const deviceInfo = {
        ipAddress: 'mobile_app', // Will be enhanced with real IP later
        userAgent: `${Platform.OS} ${Platform.Version} - ${Device.deviceName || Device.modelName || 'Unknown Device'} - ${Device.brand || 'Unknown Brand'} ${Device.modelName || 'Unknown Model'}`,
      };

      console.log('📱 Device info for terms acceptance (skip):', deviceInfo);
      if (!registrationData) {
        Alert.alert('Error', 'Registration data not found. Please start over.');
        navigation.navigate('Signup');
        return;
      }

      const requestBody = {
          email: registrationData.email,
          password: registrationData.password,
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
          dateOfBirth: registrationData.dateOfBirth,
          gender: registrationData.gender,
          hasAcceptedTerms: true,
          user_role: roleData.user_role,        // 'citizen'
          is_seller: roleData.is_seller,        // false
          is_rider: roleData.is_rider,         // false
          // Add device info for terms acceptance tracking
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
        };

      console.log('🚀 Skip - Request body being sent:', requestBody);

      const createUserResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.3:3000'}/auth/create-verified-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const createUserResult = await createUserResponse.json();
      
      if (createUserResult.success) {
        console.log('✅ User created successfully with citizen role:', createUserResult.user);
        
        // Navigate to welcome screen - user will signin when they tap "Explore"
        navigation.navigate('Welcome');
      } else {
        Alert.alert('Error', createUserResult.message || 'Account creation failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Image */}
      <ImageBackground
        source={require('../../assets/images/sign-up-role-selection.jpeg')}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        <View style={styles.overlay} />
      </ImageBackground>

      <View style={styles.content}>
        {/* Congratulations Text */}
        <View style={styles.header}>
          <Text style={styles.congratsText}>Congratulations</Text>
          <Text style={styles.subtitleText}>
            You are now a citizen...{'\n'}
            <Text style={styles.highlightText}>- you could be more!</Text>
          </Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cardsContainer}>
          {/* Vendor Card */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'vendor' && styles.roleCardSelected,
            ]}
            onPress={() => handleRoleSelect('vendor')}
            disabled={loading}
            activeOpacity={0.8}
          >
            <ImageBackground
              source={require('../../assets/images/hero1.jpeg')}
              style={styles.cardBackground}
              imageStyle={styles.cardBackgroundImage}
            >
              <View style={styles.cardOverlay} />
              <View style={styles.cardContent}>
                <View style={styles.iconContainer}>
                  <Ionicons name="storefront" size={48} color="#FFF" />
                </View>
                <Text style={styles.cardTitle}>Vendor</Text>
                <Text style={styles.cardSubtitle}>Sell & Grow</Text>
              </View>
              {selectedRole === 'vendor' && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={32} color="#34C759" />
                </View>
              )}
            </ImageBackground>
          </TouchableOpacity>

          {/* Rider Card */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'rider' && styles.roleCardSelected,
            ]}
            onPress={() => handleRoleSelect('rider')}
            disabled={loading}
            activeOpacity={0.8}
          >
            <ImageBackground
              source={require('../../assets/images/hero2.jpeg')}
              style={styles.cardBackground}
              imageStyle={styles.cardBackgroundImage}
            >
              <View style={styles.cardOverlay} />
              <View style={styles.cardContent}>
                <View style={styles.iconContainer}>
                  <Ionicons name="bicycle" size={48} color="#FFF" />
                </View>
                <Text style={styles.cardTitle}>Rider</Text>
                <Text style={styles.cardSubtitle}>Deliver & Earn</Text>
              </View>
              {selectedRole === 'rider' && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={32} color="#34C759" />
                </View>
              )}
            </ImageBackground>
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              selectedRole ? styles.continueButton : styles.skipButton,
            ]}
            onPress={selectedRole ? handleContinue : handleSkip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.actionButtonText}>
                {selectedRole ? 'Continue' : 'Skip'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  backgroundImageStyle: {
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  congratsText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitleText: {
    fontSize: 18,
    color: '#E0E0E0',
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  highlightText: {
    color: '#3498DB',
    fontWeight: '600',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  roleCard: {
    flex: 1,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  roleCardSelected: {
    borderColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  cardBackground: {
    flex: 1,
  },
  cardBackgroundImage: {
    opacity: 0.9,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#E0E0E0',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 4,
  },
  footer: {
    marginTop: 20,
  },
  actionButton: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  continueButton: {
    backgroundColor: '#3498DB',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
