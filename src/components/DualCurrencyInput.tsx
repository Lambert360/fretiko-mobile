import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { currencyAPI } from '../services/currencyAPI';
import { walletAPI } from '../services/walletAPI';

interface DualCurrencyInputProps {
  // Primary currency (user's local currency)
  localCurrency: string;
  onLocalCurrencyChange?: (currency: string) => void;
  
  // Values
  localAmount: string;
  fretiAmount: string;
  onLocalAmountChange: (amount: string) => void;
  onFretiAmountChange: (amount: string) => void;
  
  // UI customization
  title?: string;
  placeholder?: string;
  editable?: boolean;
  showCurrencyPicker?: boolean;
  supportedCurrencies?: string[];
  
  // Styling
  containerStyle?: any;
  inputStyle?: any;
  
  // Validation
  minAmount?: number;
  maxAmount?: number;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

const DualCurrencyInput: React.FC<DualCurrencyInputProps> = ({
  localCurrency,
  onLocalCurrencyChange,
  localAmount,
  fretiAmount,
  onLocalAmountChange,
  onFretiAmountChange,
  title,
  placeholder = "Enter amount",
  editable = true,
  showCurrencyPicker = true,
  supportedCurrencies = [
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
  ],
  containerStyle,
  inputStyle,
  minAmount = 0,
  maxAmount,
  onValidationChange,
}) => {
  const [isConverting, setIsConverting] = useState(false);
  const [lastEditedField, setLastEditedField] = useState<'local' | 'freti'>('local');
  const [conversionError, setConversionError] = useState<string>('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  useEffect(() => {
    console.log(' Local amount effect triggered:', {
      lastEditedField,
      localAmount,
      shouldConvert: lastEditedField === 'local' && localAmount
    });
    
    if (lastEditedField === 'local' && localAmount) {
      const timeoutId = setTimeout(() => {
        console.log(' Starting conversion for local amount:', localAmount);
        
        (async () => {
          if (!localAmount || localAmount === '0' || isNaN(parseFloat(localAmount))) {
            console.log(' Invalid amount, clearing target field');
            onFretiAmountChange('');
            return;
          }

          setIsConverting(true);
          setConversionError('');

          try {
            const numAmount = parseFloat(localAmount);
            let fretiAmount: number;

            try {
              console.log(' Calling getDepositRate API...');
              const rateInfo = await walletAPI.getDepositRate(numAmount, localCurrency);
              console.log(' getDepositRate response:', rateInfo);
              
              fretiAmount = rateInfo.fretiAmount;
              onFretiAmountChange(fretiAmount.toFixed(2));
              
              if (rateInfo.usingFallback && rateInfo.warning) {
                console.warn(' Using fallback exchange rate:', rateInfo.warning);
                setConversionError(rateInfo.warning);
              } else {
                setConversionError('');
              }
              
              console.log(` ${rateInfo.usingFallback ? 'Fallback' : 'Real-time'} rate: ${numAmount} ${localCurrency} → ${fretiAmount.toFixed(2)} FRETI (Rate: ${rateInfo.exchangeRate.toFixed(4)})`);
            } catch (rateError: any) {
              console.warn(' All rate APIs failed, using basic conversion:', rateError.message);
              const convertedAmount = await currencyAPI.quickConvert(localCurrency, 'FRETI', numAmount);
              fretiAmount = convertedAmount;
              onFretiAmountChange(convertedAmount.toFixed(2));
              setConversionError('Exchange rate service unavailable. Using estimated rate. Actual rate may differ.');
            }

            const isValid = fretiAmount >= minAmount && (!maxAmount || fretiAmount <= maxAmount);
            const error = !isValid 
              ? (fretiAmount < minAmount 
                  ? `Minimum deposit is ${currencyAPI.formatCurrency(minAmount, 'FRETI')}`
                  : `Maximum deposit is ${currencyAPI.formatCurrency(maxAmount!, 'FRETI')} (approximately ${currencyAPI.formatCurrency(numAmount, localCurrency)} in ${localCurrency})`
                )
              : undefined;

            onValidationChange?.(isValid, error);

          } catch (error) {
            console.error('Currency conversion error:', error);
            setConversionError('Conversion failed. Please try again.');
            onValidationChange?.(false, 'Conversion failed');
          } finally {
            setIsConverting(false);
          }
        })();
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [localAmount, lastEditedField, localCurrency, minAmount, maxAmount]);

  useEffect(() => {
    console.log(' Freti amount effect triggered:', {
      lastEditedField,
      fretiAmount,
      shouldConvert: lastEditedField === 'freti' && fretiAmount
    });
    
    if (lastEditedField === 'freti' && fretiAmount) {
      const timeoutId = setTimeout(() => {
        (async () => {
          if (!fretiAmount || fretiAmount === '0' || isNaN(parseFloat(fretiAmount))) {
            console.log(' Invalid amount, clearing target field');
            onLocalAmountChange('');
            return;
          }

          setIsConverting(true);
          setConversionError('');

          try {
            const numAmount = parseFloat(fretiAmount);
            const fretiAmountValue = numAmount; // User is editing FRETI directly
            
            try {
              console.log(' Converting FRETI to local currency...');
              
              const rateInfo = await walletAPI.getDepositRate(1, localCurrency);
              console.log(' Rate info for 1 unit:', rateInfo);
              
              const inverseRate = 1 / rateInfo.fretiAmount;
              const convertedAmount = fretiAmountValue * inverseRate;
              
              console.log(` FRETI → Local rate: 1 FRETI = ${inverseRate.toFixed(6)} ${localCurrency}, so ${fretiAmountValue} FRETI = ${convertedAmount.toFixed(2)} ${localCurrency}`);
              
              onLocalAmountChange(convertedAmount.toFixed(2));
              setConversionError('');
            } catch (inverseError: any) {
              console.warn(' Inverse rate calculation failed, using fallback:', inverseError.message);
              const convertedAmount = await currencyAPI.quickConvert('FRETI', localCurrency, numAmount);
              onLocalAmountChange(convertedAmount.toFixed(2));
              setConversionError('Using estimated conversion rate. Actual rate may differ.');
            }

            const isValid = fretiAmountValue >= minAmount && (!maxAmount || fretiAmountValue <= maxAmount);
            const error = !isValid 
              ? (fretiAmountValue < minAmount 
                  ? `Minimum deposit is ${currencyAPI.formatCurrency(minAmount, 'FRETI')}`
                  : `Maximum deposit is ${currencyAPI.formatCurrency(maxAmount!, 'FRETI')} (approximately ${currencyAPI.formatCurrency(fretiAmountValue, localCurrency)} in ${localCurrency})`
                )
              : undefined;

            onValidationChange?.(isValid, error);

          } catch (error) {
            console.error('Currency conversion error:', error);
            setConversionError('Conversion failed. Please try again.');
            onValidationChange?.(false, 'Conversion failed');
          } finally {
            setIsConverting(false);
          }
        })();
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [fretiAmount, lastEditedField, localCurrency, minAmount, maxAmount]);

  const handleLocalAmountChange = useCallback((text: string) => {
    const cleanText = text.replace(/[^0-9.]/g, '');
    const parts = cleanText.split('.');
    const formattedText = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanText;
    
    console.log(' Local amount changed:', formattedText);
    setLastEditedField('local');
    onLocalAmountChange(formattedText);
  }, [onLocalAmountChange]);

  const handleFretiAmountChange = useCallback((text: string) => {
    // Allow only numbers and decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleanText.split('.');
    const formattedText = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanText;
    
    setLastEditedField('freti');
    onFretiAmountChange(formattedText);
  }, [onFretiAmountChange]);

  const handleCurrencySelect = (currency: string) => {
    onLocalCurrencyChange?.(currency);
    setShowCurrencyDropdown(false);
    
    // Note: Conversion will be triggered automatically by the useEffect when localCurrency changes
  };

  const renderCurrencyPicker = () => {
    if (!showCurrencyPicker) return null;

    return (
      <TouchableOpacity
        style={styles.currencyPicker}
        onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
        disabled={!editable}
      >
        <Text style={styles.currencyText}>{localCurrency}</Text>
        <Ionicons 
          name={showCurrencyDropdown ? "chevron-up" : "chevron-down"} 
          size={16} 
          color="#999" 
        />
      </TouchableOpacity>
    );
  };

  const renderCurrencyDropdown = () => {
    if (!showCurrencyDropdown) return null;

    // Sort currencies: Major currencies first, then alphabetically
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR'];
    const sortedCurrencies = [
      ...supportedCurrencies.filter(c => majorCurrencies.includes(c)),
      ...supportedCurrencies.filter(c => !majorCurrencies.includes(c)).sort()
    ];

    return (
      <View style={styles.currencyDropdown}>
        <ScrollView 
          style={styles.currencyDropdownScroll}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
          maximumZoomScale={1}
        >
          {sortedCurrencies.map((currency) => (
            <TouchableOpacity
              key={currency}
              style={[
                styles.currencyOption,
                currency === localCurrency && styles.selectedCurrency
              ]}
              onPress={() => handleCurrencySelect(currency)}
            >
              <Text style={[
                styles.currencyOptionText,
                currency === localCurrency && styles.selectedCurrencyText
              ]}>
                {currencyAPI.getCurrencySymbol(currency)} {currency}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      <View style={styles.inputContainer}>
        {/* Local Currency Input */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>
              {currencyAPI.getCurrencySymbol(localCurrency)} {localCurrency}
            </Text>
            {renderCurrencyPicker()}
          </View>
          
          <TextInput
            style={[styles.input, inputStyle]}
            value={localAmount}
            onChangeText={handleLocalAmountChange}
            placeholder={placeholder}
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            editable={editable}
            returnKeyType="done"
          />
        </View>

        {/* Conversion Indicator */}
        <View style={styles.conversionIndicator}>
          {isConverting ? (
            <ActivityIndicator size="small" color="#3498DB" />
          ) : (
            <Ionicons name="swap-vertical" size={20} color="#3498DB" />
          )}
        </View>

        {/* Freti Input */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>₣ FRETI</Text>
          </View>
          
          <TextInput
            style={[styles.input, inputStyle]}
            value={fretiAmount}
            onChangeText={handleFretiAmountChange}
            placeholder="0.00"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            editable={editable}
            returnKeyType="done"
          />
        </View>
      </View>

      {/* Currency Dropdown */}
      {renderCurrencyDropdown()}

      {/* Error Message */}
      {conversionError ? (
        <Text style={styles.errorText}>{conversionError}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  inputWrapper: {
    flex: 1,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputLabel: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '500',
  },
  currencyPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  currencyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  conversionIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderRadius: 20,
  },
  currencyDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#222',
    borderRadius: 12,
    marginTop: 4,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 300, // Limit height for scrolling
  },
  currencyDropdownScroll: {
    maxHeight: 300,
  },
  currencyOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedCurrency: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
  },
  currencyOptionText: {
    color: '#CCC',
    fontSize: 16,
  },
  selectedCurrencyText: {
    color: '#3498DB',
    fontWeight: '600',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DualCurrencyInput;