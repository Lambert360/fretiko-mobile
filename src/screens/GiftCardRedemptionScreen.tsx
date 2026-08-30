import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import giftCardAPI, { RedeemGiftCardData } from '../services/giftCardAPI';

type RootStackParamList = {
  Checkout: { giftCardApplied: number; transactionId: string };
};

const GiftCardRedemptionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [cardNumber, setCardNumber] = useState('');
  const [pin, setPin] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const handleCheckBalance = async () => {
    if (!cardNumber || !pin) {
      Alert.alert('Required', 'Please enter card number and PIN');
      return;
    }

    setCheckingBalance(true);
    try {
      const result = await giftCardAPI.checkBalance({ cardNumber, pin });
      setBalance(result.balance);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to check balance');
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleRedeem = async () => {
    if (!cardNumber || !pin || !orderTotal) {
      Alert.alert('Required', 'Please fill in all fields');
      return;
    }

    const total = parseFloat(orderTotal);
    if (isNaN(total) || total <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid order total');
      return;
    }

    if (!accessToken) {
      Alert.alert('Authentication Error', 'Please log in to redeem gift cards');
      return;
    }

    setLoading(true);
    try {
      const redeemData: RedeemGiftCardData = {
        cardNumber,
        pin,
        orderTotal: total,
      };

      const result = await giftCardAPI.redeemGiftCard(accessToken, redeemData);

      Alert.alert(
        'Success! 🎉',
        `${result.appliedAmount} FRETI applied to your order`,
        [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );
    } catch (error: any) {
      Alert.alert('Redemption Failed', error.message || 'Failed to redeem gift card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Redeem Gift Card</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={styles.introRow}>
          <View style={styles.introIconWrap}>
            <Ionicons name="gift" size={26} color="#F39C12" />
          </View>
          <Text style={styles.introText}>Apply your gift card balance at checkout</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Card Number</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="card-outline" size={18} color="#666666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter 16-digit card number"
              placeholderTextColor="#666666"
              value={cardNumber}
              onChangeText={setCardNumber}
              keyboardType="numeric"
              maxLength={16}
            />
          </View>

          <Text style={styles.label}>PIN</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="key-outline" size={18} color="#666666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter 4-digit PIN"
              placeholderTextColor="#666666"
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
          </View>

          <Text style={styles.label}>Order Total (FRETI)</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="cash-outline" size={18} color="#666666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter order total"
              placeholderTextColor="#666666"
              value={orderTotal}
              onChangeText={setOrderTotal}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={styles.checkButton}
            onPress={handleCheckBalance}
            disabled={checkingBalance}
            activeOpacity={0.8}
          >
            {checkingBalance ? (
              <ActivityIndicator color="#3498DB" size="small" />
            ) : (
              <>
                <Ionicons name="search-outline" size={18} color="#3498DB" />
                <Text style={styles.checkButtonText}>Check Balance</Text>
              </>
            )}
          </TouchableOpacity>

          {balance !== null && (
            <View style={styles.balanceDisplay}>
              <Ionicons name="checkmark-circle" size={22} color="#27AE60" />
              <View style={{ flex: 1 }}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceValue}>{balance.toLocaleString()} FRETI</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.redeemButton, loading && styles.redeemButtonDisabled]}
          onPress={handleRedeem}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="gift-outline" size={20} color="#FFFFFF" />
              <Text style={styles.redeemButtonText}>Redeem Gift Card</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  introIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999999',
    marginBottom: 8,
    marginTop: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 14,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 152, 219, 0.4)',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  checkButtonText: {
    color: '#3498DB',
    fontSize: 15,
    fontWeight: '700',
  },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(39, 174, 96, 0.3)',
    padding: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#999999',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#27AE60',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  redeemButton: {
    flexDirection: 'row',
    backgroundColor: '#F39C12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  redeemButtonDisabled: {
    opacity: 0.7,
  },
  redeemButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default GiftCardRedemptionScreen;
