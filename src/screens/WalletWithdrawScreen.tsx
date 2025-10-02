import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { walletAPI, Wallet } from '../services/walletAPI';
import DualCurrencyInput from '../components/DualCurrencyInput';
import { currencyAPI } from '../services/currencyAPI';

interface WalletWithdrawScreenProps {
  navigation: any;
}

const WalletWithdrawScreen = ({ navigation }: WalletWithdrawScreenProps) => {
  const insets = useSafeAreaInsets();
  const [localAmount, setLocalAmount] = useState('');
  const [fretiAmount, setFretiAmount] = useState('');
  const [localCurrency, setLocalCurrency] = useState('NGN');
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState<string>('');
  
  const supportedCurrencies = ['NGN', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'];

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const walletData = await walletAPI.getWallet();
      setWallet(walletData);
    } catch (error) {
      console.error('Error loading wallet:', error);
    }
  };

  const handleValidationChange = (valid: boolean, error?: string) => {
    setIsValid(valid);
    setValidationError(error || '');
  };

  const handleWithdraw = async () => {
    if (!isValid) {
      Alert.alert('Error', validationError || 'Please fix validation errors');
      return;
    }

    const fretiValue = parseFloat(fretiAmount);
    const localValue = parseFloat(localAmount);
    
    if (!fretiValue || fretiValue <= 0) {
      Alert.alert('Error', 'Please enter a valid withdrawal amount');
      return;
    }

    if (!wallet) {
      Alert.alert('Error', 'Unable to load wallet information');
      return;
    }

    if (fretiValue > wallet.availableBalance) {
      Alert.alert('Error', `Insufficient balance. Available: ${currencyAPI.formatCurrency(wallet.availableBalance, 'FRETI')}`);
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `You are about to withdraw ${currencyAPI.formatCurrency(fretiValue, 'FRETI')} which equals ${currencyAPI.formatCurrency(localValue, localCurrency)}.\n\nFunds will be processed within 1-3 business days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: 'default',
          onPress: () => processWithdrawal(fretiValue, localValue)
        }
      ]
    );
  };

  const processWithdrawal = async (fretiValue: number, localValue: number) => {
    setLoading(true);
    try {
      const result = await walletAPI.createWithdrawal({
        fretiAmount: fretiValue,
        localCurrency: localCurrency
      });

      Alert.alert(
        'Withdrawal Requested', 
        `Your withdrawal has been requested successfully!\n\nFreti Amount: ${currencyAPI.formatCurrency(fretiValue, 'FRETI')}\nLocal Amount: ${currencyAPI.formatCurrency(localValue, localCurrency)}\nStatus: ${result.status}`,
        [
          { 
            text: 'OK', 
            onPress: () => navigation.goBack() 
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create withdrawal');
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
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        {wallet && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Ionicons name="wallet" size={24} color="#007AFF" />
              <Text style={styles.balanceTitle}>Available Balance</Text>
            </View>
            <Text style={styles.balanceAmount}>
              {walletAPI.formatFreti(wallet.availableBalance)}
            </Text>
            <Text style={styles.balanceSubtext}>
              Available for withdrawal
            </Text>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#FFA500" />
            <Text style={styles.infoTitle}>Withdrawal Information</Text>
          </View>
          <Text style={styles.infoText}>
            Withdrawals are processed within 1-3 business days. Funds will be converted to your selected currency and sent to your payment method.
          </Text>
        </View>

        {/* Withdraw Form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Withdrawal Amount</Text>
          
          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₣</Text>
              <TextInput
                style={styles.amountInput}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="0.00"
                placeholderTextColor="#666"
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.currencyLabel}>FRETI</Text>
            </View>
          </View>

          {/* Quick Amount Buttons */}
          {wallet && wallet.availableBalance > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quick Amounts</Text>
              <View style={styles.quickAmounts}>
                {[25, 50, 100].map((percentage) => {
                  const quickAmount = (wallet.availableBalance * percentage) / 100;
                  if (quickAmount >= 1) {
                    return (
                      <TouchableOpacity
                        key={percentage}
                        style={styles.quickAmountButton}
                        onPress={() => setWithdrawAmount(quickAmount.toFixed(2))}
                      >
                        <Text style={styles.quickAmountText}>{percentage}%</Text>
                        <Text style={styles.quickAmountValue}>
                          {walletAPI.formatFreti(quickAmount)}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  return null;
                })}
                <TouchableOpacity
                  style={styles.quickAmountButton}
                  onPress={() => setWithdrawAmount(wallet.availableBalance.toFixed(6))}
                >
                  <Text style={styles.quickAmountText}>All</Text>
                  <Text style={styles.quickAmountValue}>
                    {walletAPI.formatFreti(wallet.availableBalance)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Currency Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Receive Currency</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.currencyScroll}
            >
              {currencies.map((currency) => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.currencyOption,
                    localCurrency === currency && styles.currencyOptionActive
                  ]}
                  onPress={() => setLocalCurrency(currency)}
                >
                  <Text style={[
                    styles.currencyOptionText,
                    localCurrency === currency && styles.currencyOptionTextActive
                  ]}>
                    {currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Conversion Display */}
          {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
            <View style={styles.conversionCard}>
              <Text style={styles.conversionTitle}>Conversion</Text>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>You withdraw:</Text>
                <Text style={styles.conversionValueFreti}>
                  {walletAPI.formatFreti(parseFloat(withdrawAmount))}
                </Text>
              </View>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>You receive:</Text>
                <Text style={styles.conversionValue}>
                  {walletAPI.formatCurrency(parseFloat(withdrawAmount), localCurrency)}
                </Text>
              </View>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>Rate:</Text>
                <Text style={styles.conversionRate}>1 FRETI = 1 {localCurrency}</Text>
              </View>
            </View>
          )}

          {/* Limits Information */}
          {wallet && (
            <View style={styles.limitsCard}>
              <Text style={styles.limitsTitle}>Withdrawal Limits</Text>
              <View style={styles.limitsRow}>
                <Text style={styles.limitsLabel}>Daily Withdrawal Limit:</Text>
                <Text style={styles.limitsValue}>
                  {walletAPI.formatFreti(wallet.dailyWithdrawalLimit)}
                </Text>
              </View>
              <View style={styles.limitsRow}>
                <Text style={styles.limitsLabel}>Minimum Withdrawal:</Text>
                <Text style={styles.limitsValue}>₣1.00</Text>
              </View>
              <View style={styles.limitsRow}>
                <Text style={styles.limitsLabel}>Processing Time:</Text>
                <Text style={styles.limitsValue}>1-3 business days</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={[
            styles.withdrawButton,
            (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || loading) && styles.withdrawButtonDisabled
          ]}
          onPress={handleWithdraw}
          disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || loading}
        >
          <Text style={styles.withdrawButtonText}>
            {loading ? 'Processing...' : `Withdraw ${withdrawAmount ? walletAPI.formatFreti(parseFloat(withdrawAmount)) : 'Funds'}`}
          </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  balanceSubtext: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  infoCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 16,
    textAlign: 'center',
  },
  currencyLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#CCCCCC',
    marginLeft: 8,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  quickAmountButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 2,
  },
  quickAmountValue: {
    fontSize: 10,
    color: '#CCCCCC',
  },
  currencyScroll: {
    marginTop: 4,
  },
  currencyOption: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  currencyOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  currencyOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#CCCCCC',
  },
  currencyOptionTextActive: {
    color: '#FFFFFF',
  },
  conversionCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  conversionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversionLabel: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  conversionValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  conversionValueFreti: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  conversionRate: {
    fontSize: 14,
    color: '#999999',
  },
  limitsCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  limitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  limitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  limitsLabel: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  limitsValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  bottomAction: {
    padding: 20,
    paddingBottom: 20,
  },
  withdrawButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  withdrawButtonDisabled: {
    backgroundColor: '#3A3A3A',
    shadowOpacity: 0,
    elevation: 0,
  },
  withdrawButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default WalletWithdrawScreen;