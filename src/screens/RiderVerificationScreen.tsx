import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Country, State } from 'country-state-city';
import { riderVerificationAPI, LogisticsPartner } from '../services/riderVerificationAPI';

const ALL_COUNTRIES = Country.getAllCountries();

const COUNTRY_LIST = ALL_COUNTRIES.map(c => c.name).sort();

interface StateMeta { name: string; isoCode: string; countryCode: string }

const getStatesForCountry = (countryName: string): StateMeta[] => {
  const country = ALL_COUNTRIES.find(c => c.name === countryName);
  if (!country) return [];
  return State.getStatesOfCountry(country.isoCode).map(s => ({
    name: s.name,
    isoCode: s.isoCode,
    countryCode: country.isoCode,
  }));
};

interface SelectionModalProps {
  visible: boolean;
  title: string;
  items: string[];
  onSelect: (item: string) => void;
  onClose: () => void;
}

const SelectionModal: React.FC<SelectionModalProps> = ({ visible, title, items, onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => items.filter(item => item.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <View style={modalStyles.searchRow}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" />
            <TextInput
              style={modalStyles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search..."
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={modalStyles.item}
                onPress={() => { setSearch(''); onSelect(item); }}
              >
                <Text style={modalStyles.itemText}>{item}</Text>
                <Ionicons name="chevron-forward" size={16} color="#4B5563" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={modalStyles.emptyText}>No results for "{search}"</Text>
            }
            ItemSeparatorComponent={() => <View style={modalStyles.separator} />}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export const RiderVerificationScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [companies, setCompanies] = useState<LogisticsPartner[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<LogisticsPartner | null>(null);
  const [riderId, setRiderId] = useState('');
  const [riderIdError, setRiderIdError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [stateModalVisible, setStateModalVisible] = useState(false);

  const stateMetas = selectedCountry ? getStatesForCountry(selectedCountry) : [];
  const stateList = stateMetas.map(s => s.name);

  const handleCountrySelect = (country: string) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setSelectedStateCode(null);
    setCompanies([]);
    setCompaniesLoaded(false);
    setSelectedCompany(null);
    setRiderId('');
    setRiderIdError('');
    setCountryModalVisible(false);
  };

  const handleStateSelect = (stateName: string) => {
    const meta = stateMetas.find(s => s.name === stateName);
    const isoCode = meta ? `${meta.countryCode}-${meta.isoCode}` : stateName;
    setSelectedState(stateName);
    setSelectedStateCode(isoCode);
    setSelectedCompany(null);
    setRiderId('');
    setRiderIdError('');
    setStateModalVisible(false);
    loadCompanies(isoCode);
  };

  const loadCompanies = async (stateCode: string) => {
    setCompaniesLoading(true);
    setCompanies([]);
    setCompaniesLoaded(false);
    try {
      const data = await riderVerificationAPI.getCompanies(stateCode);
      setCompanies(data);
    } catch (error: any) {
      console.error('Failed to load companies:', error);
      Alert.alert('Error', 'Failed to load companies. Please check your connection and try again.');
    } finally {
      setCompaniesLoading(false);
      setCompaniesLoaded(true);
    }
  };

  const handleClaim = async () => {
    if (!selectedCompany) return;
    if (!riderId.trim()) {
      setRiderIdError('Please enter your Rider ID.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await riderVerificationAPI.claimRiderAccount(riderId, selectedCompany.id);
      if (result.success) {
        Alert.alert('Account Activated!', result.message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Claim Failed', result.message || 'Please check your Rider ID and try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to claim account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canShowStateSection = selectedCountry !== null;
  const canShowCompanySection = selectedState !== null;
  const canShowRiderIdSection = selectedCompany !== null;
  const canSubmit = selectedCompany !== null && riderId.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activate Rider Account</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={22} color="#10B981" style={{ marginTop: 2 }} />
          <Text style={styles.infoText}>
            Your logistics company has already registered your account. Select your location to find your company, then enter the unique Rider ID they gave you.
          </Text>
        </View>

        {/* Step 1: Country */}
        <View style={styles.section}>
          <View style={styles.stepRow}>
            <View style={[styles.stepBadge, selectedCountry && styles.stepBadgeDone]}>
              {selectedCountry
                ? <Ionicons name="checkmark" size={12} color="white" />
                : <Text style={styles.stepBadgeText}>1</Text>}
            </View>
            <Text style={styles.sectionTitle}>Select Your Country</Text>
          </View>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setCountryModalVisible(true)}>
            <Text style={selectedCountry ? styles.pickerBtnValueText : styles.pickerBtnPlaceholderText}>
              {selectedCountry ?? 'Tap to select country'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Step 2: State */}
        {canShowStateSection && (
          <View style={styles.section}>
            <View style={styles.stepRow}>
              <View style={[styles.stepBadge, selectedState && styles.stepBadgeDone]}>
                {selectedState
                  ? <Ionicons name="checkmark" size={12} color="white" />
                  : <Text style={styles.stepBadgeText}>2</Text>}
              </View>
              <Text style={styles.sectionTitle}>Select Your State / Province</Text>
            </View>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setStateModalVisible(true)}>
              <Text style={selectedState ? styles.pickerBtnValueText : styles.pickerBtnPlaceholderText}>
                {selectedState ?? `Tap to select state in ${selectedCountry}`}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Company */}
        {canShowCompanySection && (
          <View style={styles.section}>
            <View style={styles.stepRow}>
              <View style={[styles.stepBadge, selectedCompany && styles.stepBadgeDone]}>
                {selectedCompany
                  ? <Ionicons name="checkmark" size={12} color="white" />
                  : <Text style={styles.stepBadgeText}>3</Text>}
              </View>
              <Text style={styles.sectionTitle}>Your Logistics Company</Text>
            </View>
            <Text style={styles.label}>Companies operating in {selectedState}</Text>

            {companiesLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#10B981" size="small" />
                <Text style={styles.loadingText}>Finding companies in {selectedState}...</Text>
              </View>
            ) : companiesLoaded && companies.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="business-outline" size={32} color="#4B5563" />
                <Text style={styles.emptyTitle}>No companies found</Text>
                <Text style={styles.emptySubtitle}>
                  No verified logistics companies are currently operating in {selectedState}. Try a different state or contact your company.
                </Text>
              </View>
            ) : (
              companies.map((company) => (
                <TouchableOpacity
                  key={company.id}
                  style={[
                    styles.companyOption,
                    selectedCompany?.id === company.id && styles.companyOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCompany(company);
                    setRiderId('');
                    setRiderIdError('');
                  }}
                >
                  <View style={styles.companyOptionInner}>
                    <View style={styles.companyIconWrap}>
                      <Ionicons name="business" size={18} color={selectedCompany?.id === company.id ? 'white' : '#10B981'} />
                    </View>
                    <Text style={[
                      styles.companyOptionText,
                      selectedCompany?.id === company.id && styles.companyOptionTextSelected,
                    ]}>
                      {company.company_name}
                    </Text>
                    {selectedCompany?.id === company.id && (
                      <Ionicons name="checkmark-circle" size={20} color="white" />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Step 4: Rider ID */}
        {canShowRiderIdSection && (
          <View style={styles.section}>
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>4</Text>
              </View>
              <Text style={styles.sectionTitle}>Your Rider ID</Text>
            </View>
            <Text style={styles.label}>
              Enter the unique Rider ID that {selectedCompany?.company_name} gave you
            </Text>
            <TextInput
              style={[styles.input, riderIdError ? styles.inputError : null]}
              value={riderId}
              onChangeText={(val) => {
                setRiderId(val);
                if (riderIdError) setRiderIdError('');
              }}
              placeholder="e.g. uncutltd0001"
              placeholderTextColor="#4B5563"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {riderIdError ? <Text style={styles.errorText}>{riderIdError}</Text> : null}
          </View>
        )}

        {/* Submit */}
        {canShowRiderIdSection && (
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || isSubmitting) && styles.submitBtnDisabled]}
            onPress={handleClaim}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Activate My Account</Text>
            )}
          </TouchableOpacity>
        )}

      </ScrollView>

      <SelectionModal
        visible={countryModalVisible}
        title="Select Country"
        items={COUNTRY_LIST}
        onSelect={handleCountrySelect}
        onClose={() => setCountryModalVisible(false)}
      />

      <SelectionModal
        visible={stateModalVisible}
        title={`Select State in ${selectedCountry}`}
        items={stateList}
        onSelect={handleStateSelect}
        onClose={() => setStateModalVisible(false)}
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
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B98133',
    borderRadius: 10,
    padding: 14,
    marginBottom: 28,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#D1FAE5',
    lineHeight: 20,
  },
  section: {
    marginBottom: 28,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: {
    backgroundColor: '#10B981',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },
  label: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 12,
    lineHeight: 18,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerBtnPlaceholderText: {
    fontSize: 15,
    color: '#4B5563',
    flex: 1,
  },
  pickerBtnValueText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: 'white',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
  },
  companyOption: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  companyOptionSelected: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  companyOptionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  companyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F2419',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#D1D5DB',
  },
  companyOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#374151',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: 'white',
    padding: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  itemText: {
    fontSize: 15,
    color: '#E5E7EB',
  },
  separator: {
    height: 1,
    backgroundColor: '#1F2937',
    marginHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    paddingVertical: 32,
  },
});
