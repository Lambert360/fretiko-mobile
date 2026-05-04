import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Alert, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput,
  TouchableOpacity, 
  View,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { walletAPI, Wallet } from '../services/walletAPI';
import DualCurrencyInput from '../components/DualCurrencyInput';
import { currencyAPI } from '../services/currencyAPI';
import { PINVerification } from '../components/PINVerification';
import { bankAccountAPI, BankAccount } from '../services/bankAccountAPI';
import { pinAPI } from '../services/pinAPI';

interface WalletWithdrawScreenProps {
  navigation: any;
}

const WalletWithdrawScreen = ({ navigation }: WalletWithdrawScreenProps) => {
  const insets = useSafeAreaInsets();
  const [localAmount, setLocalAmount] = useState('');
  const [fretiAmount, setFretiAmount] = useState('');
  const [localCurrency, setLocalCurrency] = useState('NGN');
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [showPINModal, setShowPINModal] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<{fretiValue: number, localValue: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [rateError, setRateError] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<string>('1-3 business days');
  
  // Currency is now synced with bank account, no manual selection needed
  
  // Fetch real-time exchange rate when FRETI amount or currency changes
  useEffect(() => {
    const fetchExchangeRate = async () => {
      const fretiValue = parseFloat(fretiAmount);
      
      // Only fetch if we have a valid amount, currency, and selected bank account
      if (!fretiValue || fretiValue <= 0 || !localCurrency || !selectedBankAccount) {
        setLocalAmount('');
        setExchangeRate(null);
        return;
      }

      setIsFetchingRate(true);
      setRateError('');
      
      try {
        console.log(`💱 Fetching withdrawal exchange rate: ${fretiValue} FRETI → ${localCurrency}`);
        
        // Use wallet API endpoint for withdrawal rates (uses Flutterwave real-time rates)
        const rateInfo = await walletAPI.getWithdrawalRate(fretiValue, localCurrency);
        
        setLocalAmount(rateInfo.localAmount.toFixed(2));
        setExchangeRate(rateInfo.exchangeRate);
        
        console.log(`✅ Withdrawal exchange rate fetched: 1 FRETI = ${rateInfo.exchangeRate.toFixed(4)} ${localCurrency}`);
        console.log(`✅ Conversion: ${fretiValue} FRETI → ${rateInfo.localAmount.toFixed(2)} ${localCurrency}`);
      } catch (error: any) {
        console.error('❌ Error fetching exchange rate:', error);
        setRateError('Failed to fetch exchange rate. Using estimated conversion.');
        
        // Fallback: Use 1:1 if USD, otherwise show error
        if (localCurrency === 'USD') {
          setLocalAmount(fretiValue.toFixed(2));
          setExchangeRate(1.0);
        } else {
          // Still show something - use approximate conversion
          setLocalAmount(fretiValue.toFixed(2));
          setExchangeRate(1.0);
        }
      } finally {
        setIsFetchingRate(false);
      }
    };

    // Debounce the rate fetch
    const timeoutId = setTimeout(() => {
      fetchExchangeRate();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fretiAmount, localCurrency, selectedBankAccount]);

  useEffect(() => {
    loadWalletData();
  }, []);

  // Reload bank accounts when screen comes into focus (e.g., after adding a new account)
  useFocusEffect(
    useCallback(() => {
      loadBankAccounts();
    }, [])
  );

  const loadBankAccounts = async () => {
    try {
      setLoadingAccounts(true);
      console.log('🏦 Loading bank accounts...');
      const accounts = await bankAccountAPI.getBankAccounts();
      console.log('✅ Bank accounts loaded:', accounts.length, 'accounts');
      setBankAccounts(accounts);

      // Set default account
      const defaultAccount = accounts.find(acc => acc.isDefault);
      if (defaultAccount) {
        setSelectedBankAccount(defaultAccount.id);
        // Sync currency with bank account currency
        const currency = defaultAccount.currency || 'NGN';
        setLocalCurrency(currency);
        
        // Fetch processing time for default currency
        try {
          const timeResponse = await walletAPI.getProcessingTime(currency);
          setProcessingTime(timeResponse.displayText);
        } catch (error) {
          console.warn('Failed to fetch processing time:', error);
        }
        
        console.log('✅ Default bank account selected:', defaultAccount.id, 'Currency:', currency);
      } else if (accounts.length > 0) {
        setSelectedBankAccount(accounts[0].id);
        // Sync currency with bank account currency
        const currency = accounts[0].currency || 'NGN';
        setLocalCurrency(currency);
        
        // Fetch processing time for first account currency
        try {
          const timeResponse = await walletAPI.getProcessingTime(currency);
          setProcessingTime(timeResponse.displayText);
        } catch (error) {
          console.warn('Failed to fetch processing time:', error);
        }
        
        console.log('✅ First bank account selected:', accounts[0].id, 'Currency:', currency);
      } else {
        console.log('⚠️ No bank accounts found');
        setSelectedBankAccount('');
      }
    } catch (error: any) {
      console.error('❌ Error loading bank accounts:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load bank accounts. Please try again.';
      if (error.message?.includes('network') || error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication error. Please log in again.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Bank account service not found. Please contact support.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert('Error Loading Bank Accounts', errorMessage);
    } finally {
      setLoadingAccounts(false);
    }
  };

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

    if (!selectedBankAccount) {
      Alert.alert('Error', 'Please select a bank account for withdrawal');
      return;
    }

    // Check if user has a PIN set up
    try {
      const pinStatus = await pinAPI.getPinStatus();
      
      if (!pinStatus.hasPin) {
        // User needs to create a PIN first
        Alert.alert(
          'PIN Required',
          'For security, you need to create a 6-digit PIN before making withdrawals.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create PIN',
              onPress: () => navigation.navigate('CreatePIN', { returnScreen: 'WalletWithdraw' }),
            },
          ]
        );
        return;
      }

      if (pinStatus.isLocked) {
        Alert.alert(
          'PIN Locked',
          `Your PIN is temporarily locked due to too many failed attempts. Please try again ${pinStatus.lockedUntil ? 'after ' + new Date(pinStatus.lockedUntil).toLocaleTimeString() : 'later'}.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // PIN exists and is not locked, proceed with withdrawal
      const selectedAccount = bankAccounts.find(acc => acc.id === selectedBankAccount);

      Alert.alert(
        'Confirm Withdrawal',
        `You are about to withdraw ${currencyAPI.formatCurrency(fretiValue, 'FRETI')} which equals ${currencyAPI.formatCurrency(localValue, localCurrency)}.\n\nWithdraw to:\n${selectedAccount?.bankName} - ${selectedAccount?.accountNumber}\n\nFunds will be processed within ${processingTime}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Verify with PIN', 
            style: 'default',
            onPress: () => {
              setPendingWithdrawal({ fretiValue, localValue });
              setShowPINModal(true);
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error checking PIN status:', error);
      Alert.alert('Error', 'Failed to verify PIN status. Please try again.');
    }
  };

  const handlePINVerificationSuccess = () => {
    if (pendingWithdrawal) {
      processWithdrawal(pendingWithdrawal.fretiValue, pendingWithdrawal.localValue);
      setPendingWithdrawal(null);
    }
  };

  const processWithdrawal = async (fretiValue: number, localValue: number) => {
    if (!selectedBankAccount) {
      Alert.alert('Error', 'Please select a bank account for withdrawal');
      return;
    }

    setLoading(true);
    try {
      const result = await walletAPI.createWithdrawal({
        fretiAmount: fretiValue,
        bankAccountId: selectedBankAccount,
        localCurrency: localCurrency
      });

      // Graceful handling for pending payment integration
      const statusMessage = result.status === 'requested' || result.status === 'pending'
        ? '\n\n⚠️ Note: Payout integration is currently being configured. Your withdrawal will be processed once our payment gateway is active. Funds are securely held in your pending withdrawal balance.'
        : '';

      Alert.alert(
        'Withdrawal Request Created', 
        `Your withdrawal has been requested successfully!\n\nFreti Amount: ${currencyAPI.formatCurrency(fretiValue, 'FRETI')}\nLocal Amount: ${currencyAPI.formatCurrency(localValue, localCurrency)}\nStatus: ${result.status.toUpperCase()}${statusMessage}\n\nProcessing Time: ${processingTime}`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Navigate to Wallet screen (not goBack, to avoid going to CreatePIN)
              navigation.navigate('Wallet');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Withdrawal error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create withdrawal. Please try again.';
      
      if (error.message?.includes('Insufficient')) {
        errorMessage = error.message; // Show insufficient balance error as-is
      } else if (error.message?.includes('limit')) {
        errorMessage = error.message; // Show limit error as-is
      } else if (error.message?.includes('network') || error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('Unable to load wallet')) {
        errorMessage = 'Unable to verify your wallet balance. Please try again.';
      }
      
      Alert.alert('Withdrawal Error', errorMessage);
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
            Withdrawals are processed within {processingTime}. Funds will be converted to your selected currency and sent to your payment method.
          </Text>
        </View>

        {/* Withdraw Form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Withdrawal Amount</Text>
          
          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Amount (in FRETI)</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₣</Text>
              <TextInput
                style={styles.amountInput}
                value={fretiAmount}
                onChangeText={setFretiAmount}
                placeholder="0.00"
                placeholderTextColor="#666"
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.currencyLabel}>FRETI</Text>
            </View>
            <Text style={styles.inputHint}>
              Enter amount in FRETI. Your balance will be converted to {localCurrency} automatically.
            </Text>
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
                    onPress={() => {
                      setFretiAmount(quickAmount?.toFixed(2) || '0');
                      // Exchange rate will be fetched automatically via useEffect
                    }}
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
                  onPress={() => {
                    setFretiAmount(wallet?.availableBalance?.toFixed(6) || '0');
                    // Exchange rate will be fetched automatically via useEffect
                  }}
                >
                  <Text style={styles.quickAmountText}>All</Text>
                  <Text style={styles.quickAmountValue}>
                    {walletAPI.formatFreti(wallet.availableBalance)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bank Account Selection */}
          <View style={styles.inputGroup}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.inputLabel}>Withdraw To</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AddBankAccount')}>
                <Text style={styles.addAccountText}>+ Add Account</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bankAccounts}>
              {loadingAccounts ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading bank accounts...</Text>
                </View>
              ) : bankAccounts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="business-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyText}>No bank accounts added</Text>
                  <Text style={styles.emptySubtext}>Add a bank account to withdraw funds</Text>
                </View>
              ) : (
                bankAccounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.bankAccountCard,
                    selectedBankAccount === account.id && styles.bankAccountCardActive
                  ]}
                  onPress={async () => {
                    setSelectedBankAccount(account.id);
                    // Sync currency with selected bank account's currency
                    const newCurrency = account.currency || 'NGN';
                    setLocalCurrency(newCurrency);
                    // Reset local amount - will be recalculated when currency changes
                    setLocalAmount('');
                    setExchangeRate(null);
                    
                    // Fetch processing time for this currency
                    try {
                      const response = await walletAPI.getProcessingTime(newCurrency);
                      setProcessingTime(response.displayText);
                    } catch (error) {
                      console.warn('Failed to fetch processing time:', error);
                      setProcessingTime('1-3 business days'); // Fallback
                    }
                  }}
                >
                  <View style={[
                    styles.bankAccountIcon,
                    selectedBankAccount === account.id && styles.bankAccountIconActive
                  ]}>
                    <Ionicons 
                      name="business" 
                      size={20} 
                      color={selectedBankAccount === account.id ? '#F39C12' : '#FFFFFF'} 
                    />
                  </View>
                  <View style={styles.bankAccountInfo}>
                    <Text style={[
                      styles.bankAccountName,
                      selectedBankAccount === account.id && styles.bankAccountNameActive
                    ]}>
                      {account.bankName}
                    </Text>
                    <Text style={styles.bankAccountNumber}>{account.accountNumber}</Text>
                    <Text style={styles.bankAccountHolder}>{account.accountName}</Text>
                  </View>
                  {selectedBankAccount === account.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#F39C12" />
                  )}
                  {account.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </TouchableOpacity>
                ))
              )}
            </View>
          </View>

          {/* Currency Display (read-only, synced with bank account) */}
          {selectedBankAccount && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Receive Currency</Text>
              <View style={styles.currencyDisplay}>
                <View style={styles.currencyDisplayBadge}>
                  <Ionicons name="cash" size={20} color="#007AFF" />
                  <Text style={styles.currencyDisplayText}>
                    {localCurrency}
                  </Text>
                </View>
                <Text style={styles.currencyDisplayNote}>
                  Currency is determined by your selected bank account
                </Text>
              </View>
            </View>
          )}

          {/* Conversion Display */}
          {fretiAmount && parseFloat(fretiAmount) > 0 && selectedBankAccount && (
            <View style={styles.conversionCard}>
              <Text style={styles.conversionTitle}>Conversion</Text>
              {isFetchingRate ? (
                <View style={styles.loadingRateContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.loadingRateText}>Fetching exchange rate...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.conversionRow}>
                    <Text style={styles.conversionLabel}>You withdraw:</Text>
                    <Text style={styles.conversionValueFreti}>
                      {walletAPI.formatFreti(parseFloat(fretiAmount))}
                    </Text>
                  </View>
                  <View style={styles.conversionRow}>
                    <Text style={styles.conversionLabel}>You receive:</Text>
                    <Text style={styles.conversionValue}>
                      {localAmount && parseFloat(localAmount) > 0
                        ? currencyAPI.formatCurrency(parseFloat(localAmount), localCurrency)
                        : 'Calculating...'}
                    </Text>
                  </View>
                  {exchangeRate !== null && (
                    <View style={styles.conversionRow}>
                      <Text style={styles.conversionLabel}>Exchange Rate:</Text>
                      <Text style={styles.conversionRate}>
                        1 FRETI = {exchangeRate >= 1 ? exchangeRate.toFixed(2) : exchangeRate.toFixed(4)} {localCurrency}
                      </Text>
                    </View>
                  )}
                  {rateError && (
                    <View style={styles.rateErrorContainer}>
                      <Ionicons name="warning" size={14} color="#FFA500" />
                      <Text style={styles.rateErrorText}>{rateError}</Text>
                    </View>
                  )}
                </>
              )}
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
                <Text style={styles.limitsValue}>{processingTime}</Text>
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
            (!fretiAmount || parseFloat(fretiAmount) <= 0 || loading || exchangeRate === null) && styles.withdrawButtonDisabled
          ]}
          onPress={handleWithdraw}
          disabled={!fretiAmount || parseFloat(fretiAmount) <= 0 || loading || exchangeRate === null}
        >
          <Text style={styles.withdrawButtonText}>
            {loading ? 'Processing...' : `Withdraw ${fretiAmount ? walletAPI.formatFreti(parseFloat(fretiAmount)) : 'Funds'}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* PIN Verification Modal */}
      <PINVerification
        visible={showPINModal}
        onClose={() => {
          setShowPINModal(false);
          setPendingWithdrawal(null);
        }}
        onSuccess={handlePINVerificationSuccess}
        title="Verify Withdrawal"
        subtitle="Enter your 6-digit PIN to confirm withdrawal"
      />
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
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addAccountText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '600',
  },
  bankAccounts: {
    gap: 12,
  },
  bankAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  bankAccountCardActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderColor: '#F39C12',
  },
  bankAccountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bankAccountIconActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
  },
  bankAccountInfo: {
    flex: 1,
  },
  bankAccountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  bankAccountNameActive: {
    color: '#F39C12',
  },
  bankAccountNumber: {
    fontSize: 13,
    color: '#CCCCCC',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  bankAccountHolder: {
    fontSize: 11,
    color: '#999999',
  },
  defaultBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  currencyDisplay: {
    marginTop: 4,
  },
  currencyDisplayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    marginBottom: 8,
  },
  currencyDisplayText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  currencyDisplayNote: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
  },
  loadingRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingRateText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#CCCCCC',
  },
  rateErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: 6,
  },
  rateErrorText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#FFA500',
    flex: 1,
  },
});

export default WalletWithdrawScreen;