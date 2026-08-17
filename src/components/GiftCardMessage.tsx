import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { createClient } from '@supabase/supabase-js';
import giftCardAPI from '../services/giftCardAPI';

interface GiftCardMessageProps {
  message: any;
  isOwn: boolean;
  currentUserId: string;
}

type RootStackParamList = {
  GiftCardDetails: { giftCardId: string };
  MyGiftCards: undefined;
};

const GiftCardMessage: React.FC<GiftCardMessageProps> = ({ message, isOwn, currentUserId }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const giftCardData = message.metadata?.giftCardData || message.metadata;
  
  const handleClaimGiftCard = async () => {
    if (isOwn) {
      // Sender viewing their own sent gift card
      if (giftCardData?.giftCardId) {
        (navigation.navigate as any)('GiftCardDetails', { giftCardId: giftCardData.giftCardId });
      }
    } else {
      // Recipient claiming the gift card
      try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
        const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          Alert.alert('Authentication Error', 'Please log in to claim gift cards');
          return;
        }
        
        await giftCardAPI.claimGiftCard(token, giftCardData.claimCode);
        Alert.alert('Success', 'Gift card claimed successfully!');
        (navigation.navigate as any)('MyGiftCards');
      } catch (error: any) {
        Alert.alert('Claim Failed', error.message || 'Failed to claim gift card');
      }
    }
  };
  
  const handleViewDetails = () => {
    if (giftCardData?.giftCardId) {
      (navigation.navigate as any)('GiftCardDetails', { giftCardId: giftCardData.giftCardId });
    }
  };
  
  if (!giftCardData) {
    return null;
  }
  
  return (
    <View style={[styles.container, isOwn ? styles.ownMessage : styles.otherMessage]}>
      <Image 
        source={{ uri: giftCardData.designUrl || giftCardData.preview_url || 'https://via.placeholder.com/280x120.png?text=Gift+Card' }} 
        style={styles.giftCardImage} 
      />
      <View style={styles.content}>
        <Text style={styles.amount}>{giftCardData.amount || giftCardData.current_balance} FRETI</Text>
        <Text style={styles.message}>{message.content || 'You received a gift card!'}</Text>
        {!isOwn && giftCardData.claimCode && (
          <TouchableOpacity 
            onPress={handleClaimGiftCard} 
            style={styles.claimButton}
          >
            <Text style={styles.claimButtonText}>Claim Gift Card</Text>
          </TouchableOpacity>
        )}
        {isOwn && (
          <TouchableOpacity 
            onPress={handleViewDetails}
            style={styles.viewButton}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 280,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E3F2FD',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
  },
  giftCardImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  content: {
    padding: 12,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  claimButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  claimButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default GiftCardMessage;
