import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import giftCardAPI, { GiftCardDesign, SuggestedAmount, PurchaseGiftCardData } from '../services/giftCardAPI';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  GiftCardDesignSelection: { amount: number };
  RecipientSelection: { amount: number; designId: string };
};

const GiftCardStoreScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
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
        giftCardAPI.getSuggestedAmounts()
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
    setCustomAmount(text);
    setSelectedAmount(null);
  };

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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gift Card Store</Text>
        <Text style={styles.subtitle}>Send the perfect gift</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose Amount</Text>
        
        <View style={styles.amountGrid}>
          {suggestedAmounts.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.amountButton,
                selectedAmount === item.amount && styles.selectedAmountButton
              ]}
              onPress={() => handleAmountSelect(item.amount)}
            >
              <Text style={[
                styles.amountButtonText,
                selectedAmount === item.amount && styles.selectedAmountButtonText
              ]}>
                {item.display_name}
              </Text>
              {item.is_popular && <Text style={styles.popularBadge}>Popular</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.customAmountContainer}>
          <Text style={styles.customAmountLabel}>Or enter custom amount:</Text>
          <TextInput
            style={styles.customAmountInput}
            placeholder="Enter FRETI amount"
            keyboardType="numeric"
            value={customAmount}
            onChangeText={handleCustomAmountChange}
          />
        </View>
      </View>

      <TouchableOpacity 
        style={styles.continueButton}
        onPress={handleContinue}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#4CAF50',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amountButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    minWidth: 100,
    alignItems: 'center',
  },
  selectedAmountButton: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e9',
  },
  amountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedAmountButtonText: {
    color: '#4CAF50',
  },
  popularBadge: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 5,
  },
  customAmountContainer: {
    marginTop: 20,
  },
  customAmountLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  customAmountInput: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    fontSize: 16,
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GiftCardStoreScreen;
