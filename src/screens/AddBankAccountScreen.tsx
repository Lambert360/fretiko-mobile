/**
 * FRETIKO MOBILE - ADD BANK ACCOUNT SCREEN
 * Allows users to add a new bank account for withdrawals
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { bankAccountAPI, Bank, AccountPreview } from '../services/bankAccountAPI';

interface AddBankAccountScreenProps {
  navigation: any;
}

// Supported countries for Flutterwave account resolution
const SUPPORTED_COUNTRIES = [
  { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'GH', name: 'Ghana', currency: 'GHS' },
  { code: 'KE', name: 'Kenya', currency: 'KES' },
  { code: 'UG', name: 'Uganda', currency: 'UGX' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW' },
  { code: 'MW', name: 'Malawi', currency: 'MWK' },
  { code: 'BW', name: 'Botswana', currency: 'BWP' },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN' },
];

const AddBankAccountScreen = ({ navigation }: AddBankAccountScreenProps) => {
  const insets = useSafeAreaInsets();
  
  // Form state
  const [country, setCountry] = useState('NG');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'checking' | 'current'>('savings');
  
  // UI state
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Verification state
  const [verifiedAccount, setVerifiedAccount] = useState<AccountPreview | null>(null);
  const [verificationError, setVerificationError] = useState('');

  const accountTypes = [
    { id: 'savings', label: 'Savings' },
    { id: 'checking', label: 'Checking' },
    { id: 'current', label: 'Current' },
  ];

  // Fetch banks when country changes
  const fetchBanks = async (countryCode: string) => {
    try {
      setLoading(true);
      const banksList = await bankAccountAPI.getBanks(countryCode);
      setBanks(banksList);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch banks');
      setBanks([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle country selection
  const handleCountrySelect = (selectedCountry: typeof SUPPORTED_COUNTRIES[0]) => {
    setCountry(selectedCountry.code);
    setSelectedBank(null);
    setVerifiedAccount(null);
    setVerificationError('');
    setShowCountryDropdown(false);
    fetchBanks(selectedCountry.code);
  };

  // Handle bank selection
  const handleBankSelect = (bank: Bank) => {
    setSelectedBank(bank);
    setVerifiedAccount(null);
    setVerificationError('');
    setShowBankDropdown(false);
    setBankSearch('');
  };

  // Verify account with Flutterwave
  const handleVerifyAccount = async () => {
    if (!accountNumber.trim()) {
      Alert.alert('Error', 'Please enter account number');
      return;
    }

    if (!selectedBank) {
      Alert.alert('Error', 'Please select a bank');
      return;
    }

    if (accountNumber.length < 10) {
      Alert.alert('Error', 'Account number must be at least 10 digits');
      return;
    }

    setVerifying(true);
    setVerificationError('');
    setVerifiedAccount(null);

    try {
      const preview = await bankAccountAPI.previewAccount(
        accountNumber.trim(),
        selectedBank.code
      );
      setVerifiedAccount(preview);
    } catch (error: any) {
      setVerificationError(error.message || 'Account verification failed');
      Alert.alert('Verification Failed', error.message || 'Could not verify account. Please check your details.');
    } finally {
      setVerifying(false);
    }
  };

  // Add bank account after verification
  const handleAddAccount = async () => {
    // Validation
    if (!verifiedAccount) {
      Alert.alert('Error', 'Please verify your account first');
      return;
    }

    if (!selectedBank) {
      Alert.alert('Error', 'Please select a bank');
      return;
    }

    if (!accountNumber.trim()) {
      Alert.alert('Error', 'Please enter account number');
      return;
    }

    if (accountNumber.length < 10) {
      Alert.alert('Error', 'Account number must be at least 10 digits');
      return;
    }

    setLoading(true);
    try {
      const countryData = SUPPORTED_COUNTRIES.find(c => c.code === country);
      const newAccount = await bankAccountAPI.createBankAccount({
        accountName: verifiedAccount.accountName, // From Flutterwave
        bankName: selectedBank.name,
        accountNumber: accountNumber.trim(),
        bankCode: selectedBank.code,
        accountType,
        currency: countryData?.currency || 'NGN',
        country,
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
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
          keyboardShouldPersistTaps="handled"
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
          {/* Country Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country *</Text>
            <TouchableOpacity
              style={styles.currencyPicker}
              onPress={() => setShowCountryDropdown(true)}
            >
              <Text style={styles.currencyText}>
                {SUPPORTED_COUNTRIES.find(c => c.code === country)?.name || country}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Bank Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank *</Text>
            <TouchableOpacity
              style={[styles.currencyPicker, !banks.length && styles.inputDisabled]}
              onPress={() => { if (banks.length) setShowBankDropdown(true); }}
              disabled={!banks.length}
            >
              <Text style={[styles.currencyText, !selectedBank && styles.placeholderText]}>
                {selectedBank?.name || (banks.length ? 'Select your bank' : 'Select country first...')}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={banks.length ? '#999' : '#666'}
              />
            </TouchableOpacity>
          </View>

          {/* Account Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Account Number *</Text>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={(text) => {
                setAccountNumber(text);
                setVerifiedAccount(null);
                setVerificationError('');
              }}
              placeholder="0123456789"
              placeholderTextColor="#666"
              keyboardType="numeric"
              maxLength={20}
            />
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

          {/* Verify Account Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!selectedBank || !accountNumber || verifying) && styles.verifyButtonDisabled,
              verifiedAccount && styles.verifyButtonSuccess,
            ]}
            onPress={handleVerifyAccount}
            disabled={!selectedBank || !accountNumber || verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : verifiedAccount ? (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.verifyButtonText}>Verified</Text>
              </>
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.verifyButtonText}>Verify Account</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Verification Result */}
          {verifiedAccount && (
            <View style={styles.verificationResult}>
              <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
              <View style={styles.verificationText}>
                <Text style={styles.verificationLabel}>Account Name:</Text>
                <Text style={styles.verificationName}>{verifiedAccount.accountName}</Text>
              </View>
            </View>
          )}

          {verificationError && !verifiedAccount && (
            <View style={styles.verificationError}>
              <Ionicons name="close-circle" size={20} color="#E74C3C" />
              <Text style={styles.verificationErrorText}>{verificationError}</Text>
            </View>
          )}

            {/* Note */}
            <View style={styles.noteCard}>
              <Ionicons name="shield-checkmark" size={20} color="#27AE60" />
              <Text style={styles.noteText}>
                Your bank details are encrypted and stored securely. We never share your information.
              </Text>
            </View>
          </View>
        </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryDropdown(false)}
      >
        <KeyboardAvoidingView style={styles.pickerKAV} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCountryDropdown(false)} />
          <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setShowCountryDropdown(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={SUPPORTED_COUNTRIES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerOption, country === item.code && styles.pickerOptionActive]}
                onPress={() => handleCountrySelect(item)}
              >
                <Text style={[styles.pickerOptionText, country === item.code && styles.pickerOptionTextActive]}>
                  {item.name} ({item.code})
                </Text>
                {country === item.code && <Ionicons name="checkmark" size={18} color="#F39C12" />}
              </TouchableOpacity>
            )}
          />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bank Picker Modal */}
      <Modal
        visible={showBankDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowBankDropdown(false); setBankSearch(''); }}
      >
        <KeyboardAvoidingView style={styles.pickerKAV} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => { setShowBankDropdown(false); setBankSearch(''); }} />
          <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Bank</Text>
            <TouchableOpacity onPress={() => { setShowBankDropdown(false); setBankSearch(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.pickerSearch}
            value={bankSearch}
            onChangeText={setBankSearch}
            placeholder="Search banks..."
            placeholderTextColor="#666"
            autoFocus
          />
          <FlatList
            data={banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerOption, selectedBank?.id === item.id && styles.pickerOptionActive]}
                onPress={() => handleBankSelect(item)}
              >
                <Text style={[styles.pickerOptionText, selectedBank?.id === item.id && styles.pickerOptionTextActive]}>
                  {item.name}
                </Text>
                {selectedBank?.id === item.id && <Ionicons name="checkmark" size={18} color="#F39C12" />}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
          </View>
        </KeyboardAvoidingView>
      </Modal>

        {/* Bottom Action */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[
              styles.addButton,
              (loading || !verifiedAccount) && styles.addButtonDisabled,
            ]}
            onPress={handleAddAccount}
            disabled={loading || !verifiedAccount}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : !verifiedAccount ? (
              <>
                <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Verify Account to Continue</Text>
              </>
            ) : (
              <Text style={styles.addButtonText}>Add Bank Account</Text>
            )}
          </TouchableOpacity>
        </View>
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
    zIndex: 1,
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
  inputDisabled: {
    backgroundColor: '#0A0A0A',
    borderColor: '#333',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  placeholderText: {
    color: '#666',
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
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#CCCCCC',
  },
  pickerOptionTextActive: {
    color: '#F39C12',
    fontWeight: '600',
  },
  pickerKAV: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '45%',
    maxHeight: '80%',
    paddingBottom: 20,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerSearch: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    margin: 12,
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
  // New styles for verification flow
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  verifyButtonDisabled: {
    backgroundColor: '#1A3A5C',
    opacity: 0.6,
  },
  verifyButtonSuccess: {
    backgroundColor: '#27AE60',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(39, 174, 96, 0.3)',
    gap: 12,
  },
  verificationText: {
    flex: 1,
  },
  verificationLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  verificationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  verificationError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
    gap: 8,
  },
  verificationErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#E74C3C',
  },
});

export default AddBankAccountScreen;
