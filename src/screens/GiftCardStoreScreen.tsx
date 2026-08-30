import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import giftCardAPI, { GiftCardDesign, SuggestedAmount } from '../services/giftCardAPI';

type RootStackParamList = {
  GiftCardDesignSelection: { amount: number };
  MyGiftCards: undefined;
};

const HERO_GRADIENT = ['#F39C12', '#E67E22', '#D35400'] as const;

const GiftCardStoreScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [designs, setDesigns] = useState<GiftCardDesign[]>([]);
  const [suggestedAmounts, setSuggestedAmounts] = useState<SuggestedAmount[]>([]);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDesignsAndAmounts();
  }, []);

  const loadDesignsAndAmounts = async () => {
    try {
      const [designsData, amountsData] = await Promise.all([
        giftCardAPI.getGiftCardDesigns(),
        giftCardAPI.getSuggestedAmounts(),
      ]);
      setDesigns(designsData);
      setSuggestedAmounts(amountsData);
    } catch (error) {
      console.error('Failed to load designs:', error);
      Alert.alert('Error', 'Failed to load gift card designs');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, '');
    setCustomAmount(numeric);
    setSelectedAmount(null);
  };

  const displayAmount = selectedAmount ?? (customAmount ? parseFloat(customAmount) : 0);

  const handleContinue = () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (!amount || amount < 1) {
      Alert.alert('Invalid Amount', 'Please enter an amount of at least 1 FRETI');
      return;
    }
    if (amount > 10000) {
      Alert.alert('Amount Too High', 'Maximum gift card amount is 10,000 FRETI');
      return;
    }
    navigation.navigate('GiftCardDesignSelection', { amount });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#F39C12" />
      </View>
    );
  }

  const isValid = (selectedAmount && selectedAmount >= 1) || (!!customAmount && parseFloat(customAmount) >= 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gift Cards</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('MyGiftCards')}
        >
          <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Hero preview card */}
        <View style={styles.heroWrapper}>
          <LinearGradient colors={HERO_GRADIENT} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.heroTopRow}>
              <Ionicons name="gift" size={28} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroBrand}>FRETIKO</Text>
            </View>
            <View style={styles.heroBottomRow}>
              <Text style={styles.heroAmountLabel}>GIFT CARD VALUE</Text>
              <Text style={styles.heroAmount}>
                {displayAmount > 0 ? `${displayAmount.toLocaleString()} FRETI` : 'Select Amount'}
              </Text>
            </View>
            <View style={styles.heroChip} />
          </LinearGradient>
        </View>

        {/* Amount selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Amount</Text>

          <View style={styles.amountGrid}>
            {suggestedAmounts.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.amountChip,
                  selectedAmount === item.amount && styles.amountChipSelected,
                ]}
                onPress={() => handleAmountSelect(item.amount)}
                activeOpacity={0.8}
              >
                {item.is_popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Popular</Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.amountChipText,
                    selectedAmount === item.amount && styles.amountChipTextSelected,
                  ]}
                >
                  {item.display_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.orDivider}>— or enter a custom amount —</Text>

          <View style={[styles.customAmountContainer, customAmount && styles.customAmountContainerActive]}>
            <Text style={styles.currencyPrefix}>₣</Text>
            <TextInput
              style={styles.customAmountInput}
              placeholder="Enter FRETI amount"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={customAmount}
              onChangeText={handleCustomAmountChange}
            />
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#3498DB" />
          <Text style={styles.infoText}>
            Gift cards can be sent to friends via chat or email, or redeemed by yourself at checkout.
          </Text>
        </View>
      </ScrollView>

      {/* Continue button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!isValid}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  heroWrapper: {
    padding: 20,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    height: 190,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#F39C12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBrand: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heroBottomRow: {
    gap: 4,
  },
  heroAmountLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  heroChip: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 40,
    height: 30,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amountChip: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    minWidth: '30%',
    alignItems: 'center',
    position: 'relative',
  },
  amountChipSelected: {
    borderColor: '#F39C12',
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
  },
  amountChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#CCCCCC',
  },
  amountChipTextSelected: {
    color: '#F39C12',
  },
  popularBadge: {
    position: 'absolute',
    top: -9,
    right: 6,
    backgroundColor: '#27AE60',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  orDivider: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    paddingHorizontal: 16,
  },
  customAmountContainerActive: {
    borderColor: '#F39C12',
  },
  currencyPrefix: {
    color: '#F39C12',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(52, 152, 219, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    color: '#9FC9E8',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#F39C12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default GiftCardStoreScreen;
