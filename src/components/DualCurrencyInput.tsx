import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { currencyAPI } from '../services/currencyAPI';

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
  supportedCurrencies = ['USD', 'NGN', 'EUR', 'GBP'],
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

  // Debounced conversion function
  const convertCurrency = useCallback(
    async (amount: string, sourceField: 'local' | 'freti') => {
      if (!amount || amount === '0' || isNaN(parseFloat(amount))) {
        if (sourceField === 'local') {
          onFretiAmountChange('');
        } else {
          onLocalAmountChange('');
        }
        return;
      }

      setIsConverting(true);
      setConversionError('');

      try {
        const numAmount = parseFloat(amount);
        let convertedAmount: number;

        if (sourceField === 'local') {
          // Converting from local currency to Freti
          convertedAmount = await currencyAPI.quickConvert(localCurrency, 'FRETI', numAmount);
          onFretiAmountChange(convertedAmount.toFixed(2));
        } else {
          // Converting from Freti to local currency
          convertedAmount = await currencyAPI.quickConvert('FRETI', localCurrency, numAmount);
          onLocalAmountChange(convertedAmount.toFixed(2));
        }

        // Validation
        const isValid = numAmount >= minAmount && (!maxAmount || numAmount <= maxAmount);
        const error = !isValid 
          ? (numAmount < minAmount 
              ? `Minimum amount is ${currencyAPI.formatCurrency(minAmount, sourceField === 'local' ? localCurrency : 'FRETI')}`
              : `Maximum amount is ${currencyAPI.formatCurrency(maxAmount!, sourceField === 'local' ? localCurrency : 'FRETI')}`
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
    },
    [localCurrency, minAmount, maxAmount, onLocalAmountChange, onFretiAmountChange, onValidationChange]
  );

  // Debounced effect for local amount changes
  useEffect(() => {
    if (lastEditedField === 'local' && localAmount) {
      const timeoutId = setTimeout(() => {
        convertCurrency(localAmount, 'local');
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [localAmount, lastEditedField, convertCurrency]);

  // Debounced effect for Freti amount changes
  useEffect(() => {
    if (lastEditedField === 'freti' && fretiAmount) {
      const timeoutId = setTimeout(() => {
        convertCurrency(fretiAmount, 'freti');
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [fretiAmount, lastEditedField, convertCurrency]);

  const handleLocalAmountChange = (text: string) => {
    // Allow only numbers and decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleanText.split('.');
    const formattedText = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanText;
    
    setLastEditedField('local');
    onLocalAmountChange(formattedText);
  };

  const handleFretiAmountChange = (text: string) => {
    // Allow only numbers and decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleanText.split('.');
    const formattedText = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanText;
    
    setLastEditedField('freti');
    onFretiAmountChange(formattedText);
  };

  const handleCurrencySelect = (currency: string) => {
    onLocalCurrencyChange?.(currency);
    setShowCurrencyDropdown(false);
    
    // Trigger conversion with current amount
    if (localAmount) {
      setTimeout(() => convertCurrency(localAmount, 'local'), 100);
    }
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

    return (
      <View style={styles.currencyDropdown}>
        {supportedCurrencies.map((currency) => (
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
    paddingVertical: 8,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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