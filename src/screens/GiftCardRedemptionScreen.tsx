import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import giftCardAPI, { RedeemGiftCardData } from '../services/giftCardAPI';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  Checkout: { giftCardApplied: number; transactionId: string };
};

const GiftCardRedemptionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  const [cardNumber, setCardNumber] = useState('');
  const [pin, setPin] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const handleCheckBalance = async () => {
    if (!cardNumber || !pin) {
      Alert.alert('Required', 'Please enter card number and PIN');
      return;
    }

    try {
      const result = await giftCardAPI.checkBalance({ cardNumber, pin });
      setBalance(result.balance);
      Alert.alert('Card Balance', `Available balance: ${result.balance} FRETI`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to check balance');
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

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const redeemData: RedeemGiftCardData = {
        cardNumber,
        pin,
        orderTotal: total,
      };

      const result = await giftCardAPI.redeemGiftCard(token, redeemData);
      
      Alert.alert(
        'Success! 🎉',
        `${result.appliedAmount} FRETI applied to your order`,
        [
          { 
            text: 'OK', 
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Redemption Failed', error.message || 'Failed to redeem gift card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Redeem Gift Card</Text>
        <Text style={styles.subtitle}>Apply your gift card at checkout</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Card Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter 16-digit card number"
          value={cardNumber}
          onChangeText={setCardNumber}
          keyboardType="numeric"
          maxLength={16}
        />

        <Text style={styles.label}>PIN</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter 4-digit PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          maxLength={4}
          secureTextEntry
        />

        <Text style={styles.label}>Order Total (FRETI)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter order total"
          value={orderTotal}
          onChangeText={setOrderTotal}
          keyboardType="numeric"
        />

        <TouchableOpacity 
          style={styles.checkButton}
          onPress={handleCheckBalance}
        >
          <Text style={styles.checkButtonText}>Check Balance</Text>
        </TouchableOpacity>

        {balance !== null && (
          <View style={styles.balanceDisplay}>
            <Text style={styles.balanceLabel}>Available Balance:</Text>
            <Text style={styles.balanceValue}>{balance} FRETI</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.redeemButton}
          onPress={handleRedeem}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.redeemButtonText}>Redeem Gift Card</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 30,
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
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    fontSize: 16,
  },
  checkButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  checkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  balanceDisplay: {
    backgroundColor: '#e8f5e9',
    padding: 20,
    borderRadius: 10,
    marginTop: 15,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 5,
  },
  redeemButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  redeemButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GiftCardRedemptionScreen;
