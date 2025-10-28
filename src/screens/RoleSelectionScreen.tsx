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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../services/userAPI';
import { useAuth } from '../contexts/AuthContext';

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
  const { user, clearNewUserFlag } = useAuth();
  const { isFirstTime = true } = route.params || {};

  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: 'vendor' | 'rider') => {
    setSelectedRole(role);
  };

  const handleContinue = async () => {
    setLoading(true);

    try {
      // If role is selected, update the profile
      if (selectedRole === 'vendor' || selectedRole === 'rider') {
        await userAPI.updateProfile({
          isSeller: selectedRole === 'vendor',
          isRider: selectedRole === 'rider',
          preferences: {
            primaryRole: selectedRole,
            roleSelectedAt: new Date().toISOString(),
          },
        });
      }

      // Navigate to Welcome screen (will be created next)
      navigation.navigate('Welcome');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip to Welcome screen without selecting role (remains citizen)
    navigation.navigate('Welcome');
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
