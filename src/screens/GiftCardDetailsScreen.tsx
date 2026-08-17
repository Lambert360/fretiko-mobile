import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import giftCardAPI, { GiftCard } from '../services/giftCardAPI';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  MyGiftCards: undefined;
};

type RouteParams = {
  GiftCardDetails: { giftCardId: string };
};

const GiftCardDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RouteParams>>();
  const { giftCardId } = route.params;
  
  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGiftCardDetails();
  }, []);

  const loadGiftCardDetails = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const cards = await giftCardAPI.getMyGiftCards(token);
      const card = cards.find(c => c.id === giftCardId);
      
      if (card) {
        setGiftCard(card);
      } else {
        Alert.alert('Error', 'Gift card not found');
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load gift card details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCardNumber = () => {
    if (giftCard) {
      Alert.alert('Card Number', giftCard.card_number);
    }
  };

  const handleCopyPin = () => {
    if (giftCard) {
      Alert.alert('PIN', (giftCard as any).pin || '••••');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!giftCard) {
    return (
      <View style={styles.centerContainer}>
        <Text>Gift card not found</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#FF9800';
      case 'claimed': return '#4CAF50';
      case 'redeemed': return '#9E9E9E';
      case 'expired': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Pending Claim';
      case 'claimed': return 'Available';
      case 'redeemed': return 'Used';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gift Card Details</Text>
      </View>

      <View style={styles.cardPreview}>
        <Image 
          source={{ uri: giftCard.design?.design_url }} 
          style={styles.cardImage}
          resizeMode="cover"
        />
        <View style={styles.cardOverlay}>
          <Text style={styles.cardAmount}>{giftCard.current_balance} FRETI</Text>
          <Text style={styles.cardDesign}>{giftCard.design?.name}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Balance Information</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(giftCard.status) }]}>
            <Text style={styles.statusText}>{getStatusText(giftCard.status)}</Text>
          </View>
        </View>
        
        <View style={styles.balanceInfo}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Current Balance:</Text>
            <Text style={styles.balanceValue}>{giftCard.current_balance} FRETI</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Initial Amount:</Text>
            <Text style={styles.balanceValue}>{giftCard.initial_balance} FRETI</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Remaining:</Text>
            <Text style={[styles.balanceValue, { color: '#4CAF50' }]}>
              {giftCard.current_balance} FRETI
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Card Details</Text>
        
        <TouchableOpacity style={styles.detailRow} onPress={handleCopyCardNumber}>
          <Text style={styles.detailLabel}>Card Number:</Text>
          <Text style={styles.detailValue}>{giftCard.card_number}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.detailRow} onPress={handleCopyPin}>
          <Text style={styles.detailLabel}>PIN:</Text>
          <Text style={styles.detailValue}>••••</Text>
        </TouchableOpacity>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Design:</Text>
          <Text style={styles.detailValue}>{giftCard.design?.name}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Purchased:</Text>
          <Text style={styles.detailValue}>{new Date(giftCard.purchased_at).toLocaleDateString()}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Expires:</Text>
          <Text style={styles.detailValue}>{new Date(giftCard.expires_at).toLocaleDateString()}</Text>
        </View>
        
        {giftCard.last_used_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Used:</Text>
            <Text style={styles.detailValue}>{new Date(giftCard.last_used_at).toLocaleDateString()}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Information</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Delivery Method:</Text>
          <Text style={styles.detailValue}>{giftCard.delivery_method}</Text>
        </View>
        
        {(giftCard as any).recipient_username && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient:</Text>
            <Text style={styles.detailValue}>{(giftCard as any).recipient_username}</Text>
          </View>
        )}
        
        {(giftCard as any).email_sent_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email Sent:</Text>
            <Text style={styles.detailValue}>{new Date((giftCard as any).email_sent_at).toLocaleString()}</Text>
          </View>
        )}
        
        {(giftCard as any).chat_sent_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Chat Sent:</Text>
            <Text style={styles.detailValue}>{new Date((giftCard as any).chat_sent_at).toLocaleString()}</Text>
          </View>
        )}
      </View>

      {giftCard.status === 'claimed' && (
        <TouchableOpacity style={styles.useButton}>
          <Text style={styles.useButtonText}>Use at Checkout</Text>
        </TouchableOpacity>
      )}
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
  cardPreview: {
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
    height: 200,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
  },
  cardAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  cardDesign: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
  },
  section: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  balanceInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  useButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  useButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GiftCardDetailsScreen;
