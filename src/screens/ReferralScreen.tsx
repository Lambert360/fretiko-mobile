import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import ReferralCard from '../components/ReferralCard';
import referralsAPI, { ReferralData } from '../services/referralsAPI';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

type ReferralScreenNavigationProp = StackNavigationProp<any, 'ReferralScreen'>;

interface Props {
  navigation: ReferralScreenNavigationProp;
}

type ThemeType = 'original' | 'emerald' | 'royal';

const ReferralScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const cardRef = useRef<View>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>('original');

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      setLoading(true);
      const data = await referralsAPI.getMyReferralData();
      setReferralData(data);
    } catch (error) {
      console.error('Failed to load referral data:', error);
      Alert.alert('Error', 'Failed to load referral data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareReferralCard = async () => {
    if (!referralData) return;

    try {
      setSharing(true);

      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const shareMessage = `Join me on Fretiko 🚀\n\nScan my referral card or use my code: ${referralData.code}\n\n${referralData.url}`;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Referral Card',
        });
      } else {
        Alert.alert('Share', shareMessage);
      }
    } catch (error) {
      console.error('Failed to share referral card:', error);
      Alert.alert('Error', 'Failed to share referral card. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const copyReferralLink = async () => {
    if (!referralData) return;

    try {
      // Use clipboard API
      await Clipboard.setStringAsync(referralData.url);
      Alert.alert('Success', 'Referral link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      Alert.alert('Error', 'Failed to copy link. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8A00" />
        <Text style={styles.loadingText}>Loading referral card...</Text>
      </View>
    );
  }

  if (!referralData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load referral data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReferralData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>My Referral Card</Text>
      <Text style={styles.subtitle}>Share and earn rewards</Text>

      {/* Theme Selector */}
      <View style={styles.themeSelector}>
        <TouchableOpacity
          style={[styles.themeButton, selectedTheme === 'original' && styles.themeButtonActive]}
          onPress={() => setSelectedTheme('original')}
        >
          <Text style={[styles.themeButtonText, selectedTheme === 'original' && styles.themeButtonTextActive]}>
            Original
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.themeButton, selectedTheme === 'emerald' && styles.themeButtonActive]}
          onPress={() => setSelectedTheme('emerald')}
        >
          <Text style={[styles.themeButtonText, selectedTheme === 'emerald' && styles.themeButtonTextActive]}>
            Emerald
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.themeButton, selectedTheme === 'royal' && styles.themeButtonActive]}
          onPress={() => setSelectedTheme('royal')}
        >
          <Text style={[styles.themeButtonText, selectedTheme === 'royal' && styles.themeButtonTextActive]}>
            Royal
          </Text>
        </TouchableOpacity>
      </View>

      {/* Referral Card */}
      <View style={styles.cardContainer}>
        <ReferralCard
          ref={cardRef}
          name={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || 'User'}
          username={user?.username || 'user'}
          email={user?.email || ''}
          referralCode={referralData.code}
          referralUrl={referralData.url}
          stats={referralData.stats}
          theme={selectedTheme}
        />
      </View>

      {/* Stats Display */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Referral Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralData.stats.total_referrals}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralData.stats.completed_referrals}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralData.stats.total_clicks}</Text>
            <Text style={styles.statLabel}>Clicks</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralData.stats.total_rewards.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Rewards</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.actionButton, styles.shareButton]}
        onPress={shareReferralCard}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.actionButtonText}>Share Referral Card</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.copyButton]}
        onPress={copyReferralLink}
      >
        <Text style={styles.actionButtonText}>Copy Referral Link</Text>
      </TouchableOpacity>

      {/* Referral Code Display */}
      <View style={styles.codeDisplay}>
        <Text style={styles.codeLabel}>Your Referral Code</Text>
        <Text style={styles.codeValue}>{referralData.code}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  contentContainer: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FF8A00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 24,
  },
  themeSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
  },
  themeButtonActive: {
    borderColor: '#FF8A00',
    backgroundColor: 'rgba(255, 138, 0, 0.1)',
  },
  themeButtonText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '500',
  },
  themeButtonTextActive: {
    color: '#FF8A00',
  },
  cardContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#242424',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF8A00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
  },
  actionButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButton: {
    backgroundColor: '#FF8A00',
  },
  copyButton: {
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#333333',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  codeDisplay: {
    width: '100%',
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242424',
  },
  codeLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8,
    letterSpacing: 2,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
});

export default ReferralScreen;
