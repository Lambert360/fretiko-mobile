import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Alert, 
  Dimensions, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View,
  Linking,
  AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { walletAPI, DepositResponse } from '../services/walletAPI';
import DualCurrencyInput from '../components/DualCurrencyInput';
import { currencyAPI } from '../services/currencyAPI';
import { usePaymentStatus } from '../hooks/usePaymentStatus';

interface WalletDepositScreenProps {
  navigation: any;
  route?: any;
}

type PaymentMethod = 'bank_transfer' | 'card' | 'mobile_money';

const WalletDepositScreen = ({ navigation }: WalletDepositScreenProps) => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const [localAmount, setLocalAmount] = useState('');
  const [fretiAmount, setFretiAmount] = useState('');
  const [localCurrency, setLocalCurrency] = useState('NGN'); // Default to Nigerian Naira
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [loading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState<string>('');
  const [pendingDepositId, setPendingDepositId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(walletAPI.isOnline());
  const [alertShown, setAlertShown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processedDeposits = useRef<Set<string>>(new Set()); // Track processed deposits

  // Flutterwave supported currencies - comprehensive list
  // Source: https://flutterwave.com/support/general/what-are-the-currencies-accepted-on-flutterwave
  const supportedCurrencies = [
    // Major International Currencies (most common)
    'USD', // United States Dollar
    'EUR', // Euro
    'GBP', // British Pound Sterling
    'CAD', // Canadian Dollar
    'AUD', // Australian Dollar
    
    // African Currencies (Flutterwave's primary market)
    'NGN', // Nigerian Naira
    'GHS', // Ghanaian Cedi
    'KES', // Kenyan Shilling
    'ZAR', // South African Rand
    'UGX', // Ugandan Shilling
    'TZS', // Tanzanian Shilling
    'RWF', // Rwandan Franc
    'XAF', // Central African CFA Franc
    'XOF', // West African CFA Franc
    'MWK', // Malawian Kwacha
    'ZMW', // Zambian Kwacha
    'EGP', // Egyptian Pound
    'MAD', // Moroccan Dirham
    'SLL', // Sierra Leonean Leone
    'BWP', // Botswana Pula
    'ETB', // Ethiopian Birr
    'MZN', // Mozambican Metical
    'MGA', // Malagasy Ariary
    'AOA', // Angolan Kwanza
    'SCR', // Seychellois Rupee
    'MUR', // Mauritian Rupee
    'SZL', // Swazi Lilangeni
    'LSL', // Lesotho Loti
    'NAD', // Namibian Dollar
    'BIF', // Burundian Franc
    'DJF', // Djiboutian Franc
    'SOS', // Somali Shilling
    'SDG', // Sudanese Pound
    'SSP', // South Sudanese Pound
    'STN', // São Tomé and Príncipe Dobra
    'CDF', // Congolese Franc
    'LRD', // Liberian Dollar
    'GMD', // Gambian Dalasi
    'GNF', // Guinean Franc
    'TND', // Tunisian Dinar
    'DZD', // Algerian Dinar
    'MRU', // Mauritanian Ouguiya
  ];

  // Check if screen was opened via deep link with deposit_id
  useEffect(() => {
    const params = route.params as any;
    const depositId = params?.deposit_id || params?.depositId;
    
    if (depositId && !alertShown && !isProcessing && depositId !== pendingDepositId) {
      // Screen opened from payment callback - stay on Deposit screen to show success
      console.log('📥 Deposit callback received, staying on Deposit screen:', depositId);
      setPendingDepositId(depositId);
      setIsProcessing(true);
      // DON'T navigate to Wallet screen - stay here to show success alert
      // navigation.navigate('Wallet'); // REMOVED - let user see success first
      // Polling will continue in background via usePaymentStatus hook
    }
  }, [(route.params as any)?.deposit_id, (route.params as any)?.depositId, alertShown, isProcessing, pendingDepositId]);

  // Poll for payment status if there's a pending deposit
  const { deposit: pendingDeposit, isPolling, startPolling, stopPolling } = usePaymentStatus({
    depositId: pendingDepositId || '',
    onSuccess: (deposit) => {
      // Check if this deposit was already processed
      if (processedDeposits.current.has(deposit.id)) {
        console.log('⚠️ Deposit already processed, skipping alert:', deposit.id);
        return;
      }
      
      // Mark this deposit as processed
      processedDeposits.current.add(deposit.id);
      
      setAlertShown(true);
      console.log('🎉 Showing success alert for deposit:', deposit.id);
      
      Alert.alert(
        'Payment Successful! 🎉',
        `Your deposit of ${currencyAPI.formatCurrency(deposit.fretiAmount, 'FRETI')} has been completed.\n\n₣${deposit.fretiAmount} FRETI has been credited to your wallet.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setPendingDepositId(null);
              setAlertShown(false);
              setIsProcessing(false);
              navigation.navigate('Wallet');
              console.log('✅ Deposit completed, navigating to Wallet screen');
            }
          }
        ]
      );
    },
    onFailure: (deposit) => {
      // Check if this deposit was already processed
      if (processedDeposits.current.has(deposit.id)) {
        console.log('⚠️ Deposit already processed, skipping failure alert:', deposit.id);
        return;
      }
      
      // Mark this deposit as processed
      processedDeposits.current.add(deposit.id);
      
      setAlertShown(true);
      console.log('❌ Showing failure alert for deposit:', deposit.id);
      
      Alert.alert(
        'Payment Failed',
        deposit.failureReason || 'Your payment could not be processed. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              setPendingDepositId(null);
              setAlertShown(false);
              setIsProcessing(false);
            }
          }
        ]
      );
    },
    pollInterval: 5000, // Poll every 5 seconds
    maxPollAttempts: 60, // Max 5 minutes
  });

  // Check for pending deposits when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (pendingDepositId && !isPolling) {
        startPolling();
      }
    }, [pendingDepositId, isPolling, startPolling])
  );

  // Listen for app state changes to refresh when returning from payment
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && pendingDepositId && !isPolling) {
        // App came to foreground, start polling
        startPolling();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [pendingDepositId, isPolling, startPolling]);

  // Cleanup state when component unmounts
  useEffect(() => {
    return () => {
      setAlertShown(false);
      setIsProcessing(false);
      stopPolling();
    };
  }, [stopPolling]);

  // NOTE: Payment method selection is for UX display only.
  // Flutterwave handles the actual payment method selection on their payment page.
  // The selected method here is not sent to the backend - it's purely informational for the user.
  const paymentMethods = [
    { 
      id: 'bank_transfer' as PaymentMethod, 
      label: 'Bank Transfer', 
      icon: 'business', 
      description: 'Direct bank transfer',
      processingTime: '1-3 business days'
    },
    { 
      id: 'card' as PaymentMethod, 
      label: 'Card Payment', 
      icon: 'card', 
      description: 'Credit/Debit card',
      processingTime: 'Instant'
    },
    { 
      id: 'mobile_money' as PaymentMethod, 
      label: 'Mobile Money', 
      icon: 'phone-portrait', 
      description: 'Mobile wallet payment',
      processingTime: 'Instant'
    },
  ];

  const handleValidationChange = (valid: boolean, error?: string) => {
    setIsValid(valid);
    setValidationError(error || '');
  };

  const handleDeposit = async () => {
    if (!isValid) {
      Alert.alert('Error', validationError || 'Please fix validation errors');
      return;
    }

    const fretiValue = parseFloat(fretiAmount);
    const localValue = parseFloat(localAmount);
    
    if (!fretiValue || fretiValue <= 0) {
      Alert.alert('Error', 'Please enter a valid deposit amount');
      return;
    }

    setLoading(true);
    try {
      // Check if online, use offline-capable method
      let result;
      if (walletAPI.isOnline()) {
        result = await walletAPI.createDeposit({
          fretiAmount: fretiValue,
          localAmount: localValue,
          localCurrency: localCurrency
        });
      } else {
        // Use offline-capable deposit method
        result = await walletAPI.createDepositRequestOffline({
          fretiAmount: fretiValue,
          localAmount: localValue,
          localCurrency: localCurrency
        });
      }

      // Get selected payment method details (for display only)
      // NOTE: Payment method selection is informational - Flutterwave handles actual method selection
      const selectedMethod = paymentMethods.find(m => m.id === paymentMethod);
      
      // Handle offline vs online responses
      if (result.cached) {
        // Offline cached response
        Alert.alert(
          'Deposit Cached 📴', 
          `Your deposit of ${currencyAPI.formatCurrency(fretiValue, 'FRETI')} has been cached and will be processed when you're back online.\n\nAmount: ${currencyAPI.formatCurrency(localValue, localCurrency)}\n\nWe'll notify you when processing begins.`,
          [
            { 
              text: 'OK', 
              onPress: () => navigation.goBack()
            }
          ]
        );
        return;
      }
      
      // If payment link is provided, open it
      if (result.paymentLink) {
        // Store deposit ID for status polling
        setPendingDepositId(result.id);
        
        Alert.alert(
          'Complete Payment', 
          `Your deposit of ${currencyAPI.formatCurrency(fretiValue, 'FRETI')} has been initiated.\n\nYou'll pay: ${currencyAPI.formatCurrency(localValue, localCurrency)}\n\nYou will be redirected to complete the payment. We'll check the status when you return.`,
          [
            { 
              text: 'Cancel', 
              style: 'cancel',
              onPress: () => {
                setPendingDepositId(null);
                navigation.goBack();
              }
            },
            { 
              text: 'Continue to Payment', 
              onPress: async () => {
                try {
                  const canOpen = await Linking.canOpenURL(result.paymentLink!);
                  if (canOpen) {
                    // Start polling for status
                    startPolling();
                    await Linking.openURL(result.paymentLink!);
                  } else {
                    Alert.alert('Error', 'Unable to open payment link');
                  }
                } catch (error) {
                  console.error('Error opening payment link:', error);
                  Alert.alert('Error', 'Failed to open payment link');
                }
              }
            }
          ]
        );
      } else {
        // Fallback for when payment link is not available
        Alert.alert(
          'Deposit Request Created', 
          `Your deposit of ${currencyAPI.formatCurrency(fretiValue, 'FRETI')} has been initiated.\n\nYou'll pay: ${currencyAPI.formatCurrency(localValue, localCurrency)}\nStatus: ${result.status.toUpperCase()}\n\nPayment Method: ${selectedMethod?.label}\nProcessing Time: ${selectedMethod?.processingTime}`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                // If status is pending, store ID for polling
                if (result.status === 'pending' || result.status === 'processing') {
                  setPendingDepositId(result.id);
                  startPolling();
                }
                navigation.goBack();
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('❌ Deposit error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create deposit. Please try again.';
      
      if (error.message?.includes('limit')) {
        errorMessage = error.message; // Show limit error as-is
      } else if (error.message?.includes('Duplicate')) {
        errorMessage = 'A similar deposit request already exists. Please check your transaction history.';
      } else if (error.message?.includes('network') || error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      Alert.alert('Deposit Error', errorMessage);
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
        <Text style={styles.headerTitle}>Deposit Funds</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#3498DB" />
            <Text style={styles.infoTitle}>Deposit Information</Text>
          </View>
          <Text style={styles.infoText}>
            Add funds to your Freti wallet. Freti is pegged to USD at a 1:1 rate. Real-time exchange rates are used for currency conversion.
          </Text>
        </View>

        {/* Deposit Form */}
        <View style={styles.formCard}>
          {/* Payment Method Selection */}
          <View style={styles.paymentMethodSection}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentMethods}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethodCard,
                    paymentMethod === method.id && styles.paymentMethodCardActive
                  ]}
                  onPress={() => setPaymentMethod(method.id)}
                >
                  <View style={[
                    styles.paymentMethodIcon,
                    paymentMethod === method.id && styles.paymentMethodIconActive
                  ]}>
                    <Ionicons 
                      name={method.icon as any} 
                      size={24} 
                      color={paymentMethod === method.id ? '#F39C12' : '#FFFFFF'} 
                    />
                  </View>
                  <View style={styles.paymentMethodInfo}>
                    <Text style={[
                      styles.paymentMethodLabel,
                      paymentMethod === method.id && styles.paymentMethodLabelActive
                    ]}>
                      {method.label}
                    </Text>
                    <Text style={styles.paymentMethodDescription}>
                      {method.description}
                    </Text>
                    <Text style={styles.paymentMethodTime}>
                      {method.processingTime}
                    </Text>
                  </View>
                  {paymentMethod === method.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#F39C12" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Deposit Amount</Text>
          
          {/* Dual Currency Input */}
          <DualCurrencyInput
            localCurrency={localCurrency}
            onLocalCurrencyChange={setLocalCurrency}
            localAmount={localAmount}
            fretiAmount={fretiAmount}
            onLocalAmountChange={setLocalAmount}
            onFretiAmountChange={setFretiAmount}
            title="Enter deposit amount"
            placeholder="0.00"
            supportedCurrencies={supportedCurrencies}
            minAmount={1}
            maxAmount={10000}
            onValidationChange={handleValidationChange}
            containerStyle={styles.dualCurrencyContainer}
          />

          {/* Validation Error */}
          {validationError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={16} color="#E74C3C" />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : null}

          {/* Limits Information */}
          <View style={styles.limitsCard}>
            <Text style={styles.limitsTitle}>Daily Limits</Text>
            <View style={styles.limitsRow}>
              <Text style={styles.limitsLabel}>Daily Deposit Limit:</Text>
              <Text style={styles.limitsValue}>₣10,000.00</Text>
            </View>
            <View style={styles.limitsRow}>
              <Text style={styles.limitsLabel}>Minimum Deposit:</Text>
              <Text style={styles.limitsValue}>₣1.00</Text>
            </View>
          </View>

          {/* Conversion Summary */}
          {localAmount && fretiAmount && parseFloat(localAmount) > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Transaction Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You pay:</Text>
                <Text style={styles.summaryValue}>
                  {currencyAPI.formatCurrency(parseFloat(localAmount), localCurrency)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You receive:</Text>
                <Text style={styles.summaryValueFreti}>
                  {currencyAPI.formatCurrency(parseFloat(fretiAmount), 'FRETI')}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Processing time:</Text>
                <Text style={styles.summaryInfo}>Instant</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={[
            styles.depositButton,
            (!fretiAmount || parseFloat(fretiAmount) <= 0 || loading || !isValid) && styles.depositButtonDisabled
          ]}
          onPress={handleDeposit}
          disabled={!fretiAmount || parseFloat(fretiAmount) <= 0 || loading || !isValid}
        >
          <Text style={styles.depositButtonText}>
            {loading 
              ? 'Creating Deposit...' 
              : fretiAmount && parseFloat(fretiAmount) > 0
                ? `Deposit ${currencyAPI.formatCurrency(parseFloat(fretiAmount), 'FRETI')}`
                : 'Enter Amount to Deposit'
            }
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
  dualCurrencyContainer: {
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  summaryCard: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#CCC',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryValueFreti: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498DB',
  },
  summaryInfo: {
    fontSize: 14,
    color: '#27AE60',
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
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
  depositButton: {
    backgroundColor: '#3498DB',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#3498DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  depositButtonDisabled: {
    backgroundColor: '#3A3A3A',
    shadowOpacity: 0,
    elevation: 0,
  },
  depositButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paymentMethodSection: {
    marginBottom: 24,
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentMethodCardActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderColor: '#F39C12',
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodIconActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  paymentMethodLabelActive: {
    color: '#F39C12',
  },
  paymentMethodDescription: {
    fontSize: 13,
    color: '#CCCCCC',
    marginBottom: 2,
  },
  paymentMethodTime: {
    fontSize: 11,
    color: '#999999',
    fontStyle: 'italic',
  },
});

export default WalletDepositScreen;