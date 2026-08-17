import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Switch } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import giftCardAPI, { PurchaseGiftCardData } from '../services/giftCardAPI';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  MyGiftCards: undefined;
};

type RouteParams = {
  RecipientSelection: { amount: number; designId: string };
};

const RecipientSelectionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RouteParams>>();
  const { amount, designId } = route.params;
  
  const [recipientType, setRecipientType] = useState<'self' | 'username' | 'email' | 'both'>('self');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [deliveryPreference, setDeliveryPreference] = useState<'email' | 'chat' | 'both'>('both');
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    // Validation
    if (recipientType === 'username' && !recipientUsername) {
      Alert.alert('Required', 'Please enter recipient username');
      return;
    }
    if (recipientType === 'email' && !recipientEmail) {
      Alert.alert('Required', 'Please enter recipient email');
      return;
    }
    if (recipientType === 'both' && (!recipientUsername || !recipientEmail)) {
      Alert.alert('Required', 'Please enter both username and email');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const purchaseData: PurchaseGiftCardData = {
        designId,
        amount,
        recipientUsername: recipientType === 'username' || recipientType === 'both' ? recipientUsername : undefined,
        recipientEmail: recipientType === 'email' || recipientType === 'both' ? recipientEmail : undefined,
        personalMessage: personalMessage || undefined,
        deliveryPreference: recipientType === 'both' ? deliveryPreference : undefined,
      };

      const result = await giftCardAPI.purchaseGiftCard(token, purchaseData);
      
      Alert.alert(
        'Success! 🎁',
        'Gift card purchased successfully!',
        [
          { text: 'OK', onPress: () => navigation.navigate('MyGiftCards') }
        ]
      );
    } catch (error: any) {
      Alert.alert('Purchase Failed', error.message || 'Failed to purchase gift card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Recipient</Text>
        <Text style={styles.subtitle}>Amount: {amount} FRETI</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Who is this gift card for?</Text>
        
        <TouchableOpacity
          style={[styles.optionCard, recipientType === 'self' && styles.selectedOptionCard]}
          onPress={() => setRecipientType('self')}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>For Myself</Text>
            <Text style={styles.optionDescription}>I'll use this gift card</Text>
          </View>
          {recipientType === 'self' && <View style={styles.checkmark}>✓</View>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, recipientType === 'username' && styles.selectedOptionCard]}
          onPress={() => setRecipientType('username')}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>For a Friend (Chat)</Text>
            <Text style={styles.optionDescription}>Send via Fretiko chat</Text>
          </View>
          {recipientType === 'username' && <View style={styles.checkmark}>✓</View>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, recipientType === 'email' && styles.selectedOptionCard]}
          onPress={() => setRecipientType('email')}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>For Someone (Email)</Text>
            <Text style={styles.optionDescription}>Send via email</Text>
          </View>
          {recipientType === 'email' && <View style={styles.checkmark}>✓</View>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, recipientType === 'both' && styles.selectedOptionCard]}
          onPress={() => setRecipientType('both')}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Both Chat & Email</Text>
            <Text style={styles.optionDescription}>Send via both methods</Text>
          </View>
          {recipientType === 'both' && <View style={styles.checkmark}>✓</View>}
        </TouchableOpacity>
      </View>

      {recipientType === 'username' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipient Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            value={recipientUsername}
            onChangeText={setRecipientUsername}
            autoCapitalize="none"
          />
        </View>
      )}

      {recipientType === 'email' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipient Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter email address"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      )}

      {recipientType === 'both' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipient Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            value={recipientUsername}
            onChangeText={setRecipientUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Enter email address"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <View style={styles.deliveryPreferenceContainer}>
            <Text style={styles.deliveryPreferenceLabel}>Delivery Preference:</Text>
            <View style={styles.deliveryOptions}>
              <TouchableOpacity
                style={[styles.deliveryOption, deliveryPreference === 'email' && styles.selectedDeliveryOption]}
                onPress={() => setDeliveryPreference('email')}
              >
                <Text style={styles.deliveryOptionText}>Email Only</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deliveryOption, deliveryPreference === 'chat' && styles.selectedDeliveryOption]}
                onPress={() => setDeliveryPreference('chat')}
              >
                <Text style={styles.deliveryOptionText}>Chat Only</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deliveryOption, deliveryPreference === 'both' && styles.selectedDeliveryOption]}
                onPress={() => setDeliveryPreference('both')}
              >
                <Text style={styles.deliveryOptionText}>Both</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Message (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add a personal message..."
          value={personalMessage}
          onChangeText={setPersonalMessage}
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity 
        style={styles.purchaseButton}
        onPress={handlePurchase}
        disabled={loading}
      >
        {loading ? (
          <Text style={styles.purchaseButtonText}>Processing...</Text>
        ) : (
          <Text style={styles.purchaseButtonText}>Purchase Gift Card - {amount} FRETI</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  optionCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedOptionCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e9',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  checkmark: {
    backgroundColor: '#4CAF50',
    color: 'white',
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    lineHeight: 30,
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  deliveryPreferenceContainer: {
    marginTop: 15,
  },
  deliveryPreferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  deliveryOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  deliveryOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  selectedDeliveryOption: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e9',
  },
  deliveryOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  purchaseButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default RecipientSelectionScreen;
