import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import giftCardAPI, { PurchaseGiftCardData } from '../services/giftCardAPI';
import { userAPI } from '../services/userAPI';

type RootStackParamList = {
  MyGiftCards: undefined;
  RecipientSelection: { amount: number; designId: string };
};

// Helper to sanitize username the same way as EditProfileScreen
const sanitizeUsername = (username: string): string => {
  return username.trim().toLowerCase().replace(/^@/, '').replace(/\s/g, '');
};

type RecipientType = 'self' | 'username' | 'email' | 'both';

const RECIPIENT_OPTIONS: { type: RecipientType; icon: keyof typeof Ionicons.glyphMap; title: string; description: string }[] = [
  { type: 'self', icon: 'person-circle-outline', title: 'For Myself', description: "I'll use this gift card" },
  { type: 'username', icon: 'chatbubble-ellipses-outline', title: 'For a Friend (Chat)', description: 'Send via Fretiko chat' },
  { type: 'email', icon: 'mail-outline', title: 'For Someone (Email)', description: 'Send via email' },
  { type: 'both', icon: 'layers-outline', title: 'Both Chat & Email', description: 'Send via both methods' },
];

const RecipientSelectionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RecipientSelection'>>();
  const { amount, designId } = route.params;
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [recipientType, setRecipientType] = useState<RecipientType>('self');
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

    if (!accessToken) {
      Alert.alert('Authentication Error', 'Please log in to purchase gift cards');
      return;
    }

    // Sanitize and validate username
    let sanitizedUsername = '';
    if (recipientType === 'username' || recipientType === 'both') {
      sanitizedUsername = sanitizeUsername(recipientUsername);

      if (sanitizedUsername.length < 3) {
        Alert.alert('Invalid Username', 'Username must be at least 3 characters');
        return;
      }
      if (sanitizedUsername.length > 50) {
        Alert.alert('Invalid Username', 'Username must be 50 characters or less');
        return;
      }
      if (!/^[a-z0-9_]+$/.test(sanitizedUsername)) {
        Alert.alert('Invalid Username', 'Username can only contain letters, numbers, and underscores');
        return;
      }

      try {
        const usernameCheck = await userAPI.checkUsernameAvailability(sanitizedUsername);
        if (usernameCheck.available) {
          Alert.alert('User Not Found', `We couldn't find a user with the username "${sanitizedUsername}". Please double-check and try again.`);
          return;
        }
      } catch (verifyError: any) {
        console.error('Username verification error:', verifyError);
        // Continue with purchase attempt if verification fails
      }
    }

    setLoading(true);
    try {
      const purchaseData: PurchaseGiftCardData = {
        designId,
        amount,
        recipientUsername: recipientType === 'username' || recipientType === 'both' ? sanitizedUsername : undefined,
        recipientEmail: recipientType === 'email' || recipientType === 'both' ? recipientEmail : undefined,
        personalMessage: personalMessage || undefined,
        deliveryPreference: recipientType === 'both' ? deliveryPreference : undefined,
      };

      const result = await giftCardAPI.purchaseGiftCard(accessToken, purchaseData);

      if (result?.deliveryFailed) {
        Alert.alert(
          'Gift Card Created, but Delivery Failed ⚠️',
          `Your ${amount.toLocaleString()} FRETI gift card was created and charged successfully, but we couldn't deliver it via ${result.deliveryMethod === 'both' ? 'email/chat' : result.deliveryMethod}. You can find it under "My Gift Cards" and share the card details manually.`,
          [
            { text: 'OK', onPress: () => navigation.navigate('MyGiftCards') },
          ]
        );
      } else {
        Alert.alert(
          'Success! 🎁',
          'Gift card purchased successfully!',
          [
            { text: 'OK', onPress: () => navigation.navigate('MyGiftCards') },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Purchase Failed', error.message || 'Failed to purchase gift card');
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
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Send To</Text>
          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>{amount.toLocaleString()} FRETI</Text>
          </View>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who is this gift card for?</Text>

          {RECIPIENT_OPTIONS.map((option) => {
            const isSelected = recipientType === option.type;
            return (
              <TouchableOpacity
                key={option.type}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setRecipientType(option.type)}
                activeOpacity={0.8}
              >
                <View style={[styles.optionIconWrap, isSelected && styles.optionIconWrapSelected]}>
                  <Ionicons name={option.icon} size={22} color={isSelected ? '#F39C12' : '#999999'} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {(recipientType === 'username' || recipientType === 'both') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient Username</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="at-outline" size={18} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor="#666666"
                value={recipientUsername}
                onChangeText={setRecipientUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        )}

        {(recipientType === 'email' || recipientType === 'both') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor="#666666"
                value={recipientEmail}
                onChangeText={setRecipientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        )}

        {recipientType === 'both' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Preference</Text>
            <View style={styles.deliveryOptions}>
              {(['email', 'chat', 'both'] as const).map((pref) => (
                <TouchableOpacity
                  key={pref}
                  style={[styles.deliveryOption, deliveryPreference === pref && styles.deliveryOptionSelected]}
                  onPress={() => setDeliveryPreference(pref)}
                >
                  <Text
                    style={[
                      styles.deliveryOptionText,
                      deliveryPreference === pref && styles.deliveryOptionTextSelected,
                    ]}
                  >
                    {pref === 'email' ? 'Email Only' : pref === 'chat' ? 'Chat Only' : 'Both'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Message (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Add a personal message..."
            placeholderTextColor="#666666"
            value={personalMessage}
            onChangeText={setPersonalMessage}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.purchaseButton, loading && styles.purchaseButtonDisabled]}
          onPress={handlePurchase}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="gift-outline" size={20} color="#FFFFFF" />
              <Text style={styles.purchaseButtonText}>Purchase - {amount.toLocaleString()} FRETI</Text>
            </>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amountBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  amountBadgeText: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  optionCardSelected: {
    borderColor: '#F39C12',
    backgroundColor: 'rgba(243, 156, 18, 0.08)',
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconWrapSelected: {
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  optionDescription: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#F39C12',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F39C12',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 14,
  },
  deliveryOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  deliveryOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
  },
  deliveryOptionSelected: {
    borderColor: '#F39C12',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  deliveryOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
  },
  deliveryOptionTextSelected: {
    color: '#F39C12',
  },
  textArea: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    color: '#FFFFFF',
    fontSize: 15,
    padding: 14,
    height: 100,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  purchaseButton: {
    flexDirection: 'row',
    backgroundColor: '#F39C12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default RecipientSelectionScreen;
