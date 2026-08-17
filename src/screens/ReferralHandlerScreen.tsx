import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import referralsAPI from '../services/referralsAPI';

interface Props {
  navigation: any;
  route: {
    params: {
      referralCode: string;
    };
  };
}

const ReferralHandlerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { isAuthenticated } = useAuth();
  const { referralCode } = route.params;

  useEffect(() => {
    handleReferral();
  }, []);

  const handleReferral = async () => {
    try {
      // Track the referral click
      await referralsAPI.trackReferralClick(referralCode);

      if (isAuthenticated) {
        // User is already logged in, show their referral card
        navigation.replace('ReferralScreen');
      } else {
        // User is not logged in, navigate to signup with referral code
        navigation.replace('Signup', { referralCode });
      }
    } catch (error) {
      console.error('Failed to handle referral:', error);
      // Even if tracking fails, continue to signup with referral code
      navigation.replace('Signup', { referralCode });
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF8A00" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
});

export default ReferralHandlerScreen;
