/**
 * FRETIKO MOBILE - ADD BANK ACCOUNT SCREEN
 * Allows users to add a new bank account for withdrawals
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bankAccountAPI } from '../services/bankAccountAPI';

interface AddBankAccountScreenProps {
  navigation: any;
}

const AddBankAccountScreen = ({ navigation }: AddBankAccountScreenProps) => {
  const insets = useSafeAreaInsets();
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'checking' | 'current'>('savings');
  const [currency, setCurrency] = useState('NGN');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [loading, setLoading] = useState(false);

  const accountTypes = [
    { id: 'savings', label: 'Savings' },
    { id: 'checking', label: 'Checking' },
    { id: 'current', label: 'Current' },
  ];

  const currencies = [
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

  // Filter currencies based on search
  const filteredCurrencies = currencies.filter(curr => 
    curr.toLowerCase().includes(currencySearch.toLowerCase())
  );

  // Sort currencies: Major currencies first, then alphabetically
  const majorCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'];
  const sortedCurrencies = [
    ...filteredCurrencies.filter(c => majorCurrencies.includes(c)),
    ...filteredCurrencies.filter(c => !majorCurrencies.includes(c)).sort()
  ];

  const handleCurrencySelect = (selectedCurrency: string) => {
    setCurrency(selectedCurrency);
    setShowCurrencyDropdown(false);
    setCurrencySearch('');
  };

  const handleAddAccount = async () => {
    // Validation
    if (!accountName.trim()) {
      Alert.alert('Error', 'Please enter account holder name');
      return;
    }

    if (!bankName.trim()) {
      Alert.alert('Error', 'Please enter bank name');
      return;
    }

    if (!accountNumber.trim()) {
      Alert.alert('Error', 'Please enter account number');
      return;
    }

    if (!bankCode.trim()) {
      Alert.alert('Error', 'Please enter bank code');
      return;
    }

    if (accountNumber.length < 10) {
      Alert.alert('Error', 'Account number must be at least 10 digits');
      return;
    }

    setLoading(true);
    try {
      const newAccount = await bankAccountAPI.createBankAccount({
        accountName: accountName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        bankCode: bankCode.trim(),
        accountType,
        currency,
      });

      Alert.alert(
        'Success',
        'Bank account added successfully! You can now use it for withdrawals.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back and trigger a refresh
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error adding bank account:', error);
      Alert.alert('Error', error.message || 'Failed to add bank account. Please try again.');
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Bank Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showCurrencyDropdown}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3498DB" />
          <Text style={styles.infoText}>
            Add your bank account details to receive withdrawals. Your information is securely encrypted.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          {/* Account Holder Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Holder Name *</Text>
            <TextInput
              style={styles.input}
              value={accountName}
              onChangeText={setAccountName}
              placeholder="John Doe"
              placeholderTextColor="#666"
              autoCapitalize="words"
            />
          </View>

          {/* Bank Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Name *</Text>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder="GTBank, Access Bank, etc."
              placeholderTextColor="#666"
              autoCapitalize="words"
            />
          </View>

          {/* Account Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Number *</Text>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="0123456789"
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={20}
            />
          </View>

          {/* Bank Code */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank Code *</Text>
            <TextInput
              style={styles.input}
              value={bankCode}
              onChangeText={setBankCode}
              placeholder="058"
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={10}
            />
            <Text style={styles.inputHint}>Bank sort code or routing number</Text>
          </View>

          {/* Account Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Type</Text>
            <View style={styles.optionsRow}>
              {accountTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.optionButton,
                    accountType === type.id && styles.optionButtonActive,
                  ]}
                  onPress={() => setAccountType(type.id as any)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      accountType === type.id && styles.optionButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Currency */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Currency</Text>
            <TouchableOpacity
              style={styles.currencyPicker}
              onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
            >
              <Text style={styles.currencyText}>{currency}</Text>
              <Ionicons 
                name={showCurrencyDropdown ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#999" 
              />
            </TouchableOpacity>
            
            {/* Currency Dropdown */}
            {showCurrencyDropdown && (
              <View style={styles.currencyDropdown}>
                <ScrollView 
                  style={styles.currencyDropdownScroll}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  maximumZoomScale={1}
                >
                  {sortedCurrencies.map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      style={[
                        styles.currencyOption,
                        currency === curr && styles.currencyOptionActive
                      ]}
                      onPress={() => handleCurrencySelect(curr)}
                    >
                      <Text style={[
                        styles.currencyOptionText,
                        currency === curr && styles.currencyOptionTextActive
                      ]}>
                        {curr}
                      </Text>
                      {currency === curr && (
                        <Ionicons name="checkmark" size={16} color="#F39C12" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Note */}
          <View style={styles.noteCard}>
            <Ionicons name="shield-checkmark" size={20} color="#27AE60" />
            <Text style={styles.noteText}>
              Your bank details are encrypted and stored securely. We never share your information.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={[styles.addButton, loading && styles.addButtonDisabled]}
          onPress={handleAddAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.addButtonText}>Add Bank Account</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 12,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  inputHint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 6,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderColor: '#F39C12',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CCCCCC',
  },
  optionButtonTextActive: {
    color: '#F39C12',
  },
  // Currency Picker Styles
  currencyPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  currencyDropdown: {
    position: 'absolute',
    bottom: '100%',  // Go UP instead of down
    left: 0,
    right: 0,
    backgroundColor: '#222',
    borderRadius: 12,
    marginBottom: 4,  // Space above the input
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },  // Shadow goes up
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 300,
  },
  currencyDropdownScroll: {
    maxHeight: 300,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  currencyOptionActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  currencyOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CCCCCC',
  },
  currencyOptionTextActive: {
    color: '#F39C12',
    fontWeight: '600',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#27AE60',
    marginLeft: 8,
    lineHeight: 18,
  },
  bottomAction: {
    padding: 20,
    paddingBottom: 20,
  },
  addButton: {
    backgroundColor: '#27AE60',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#27AE60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#3A3A3A',
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AddBankAccountScreen;
