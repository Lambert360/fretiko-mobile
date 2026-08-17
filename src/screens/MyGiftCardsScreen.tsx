import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import giftCardAPI, { GiftCard } from '../services/giftCardAPI';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  GiftCardDetails: { giftCardId: string };
};

const MyGiftCardsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGiftCards();
  }, []);

  const loadGiftCards = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const cards = await giftCardAPI.getMyGiftCards(token);
      setGiftCards(cards);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load gift cards');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadGiftCards();
  };

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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading gift cards...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Gift Cards</Text>
        <Text style={styles.subtitle}>{giftCards.length} gift cards</Text>
      </View>

      {giftCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No gift cards yet</Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => navigation.navigate('GiftCardStore' as never)}
          >
            <Text style={styles.emptyButtonText}>Get Your First Gift Card</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardsContainer}>
          {giftCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.card}
              onPress={() => navigation.navigate('GiftCardDetails', { giftCardId: card.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardDesign}>{card.design?.name || 'Gift Card'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(card.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(card.status)}</Text>
                </View>
              </View>
              
              <View style={styles.cardBody}>
                <Text style={styles.balance}>{card.current_balance} FRETI</Text>
                <Text style={styles.initialBalance}>Initial: {card.initial_balance} FRETI</Text>
              </View>
              
              <View style={styles.cardFooter}>
                <Text style={styles.expiry}>
                  Expires: {new Date(card.expires_at).toLocaleDateString()}
                </Text>
                {card.status === 'claimed' && (
                  <Text style={styles.redeemButton}>Use at Checkout →</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
  },
  cardsContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardDesign: {
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
  cardBody: {
    marginBottom: 15,
  },
  balance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  initialBalance: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  expiry: {
    fontSize: 12,
    color: '#666',
  },
  redeemButton: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MyGiftCardsScreen;
