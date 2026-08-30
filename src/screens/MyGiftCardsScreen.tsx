import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import giftCardAPI, { GiftCard } from '../services/giftCardAPI';

type RootStackParamList = {
  GiftCardDetails: { giftCardId: string };
  GiftCardStore: undefined;
  GiftCardRedemption: undefined;
};

const CARD_GRADIENTS: Record<string, readonly [string, string, ...string[]]> = {
  active: ['#3498DB', '#2C7DB0'],
  claimed: ['#F39C12', '#E67E22'],
  redeemed: ['#4A4A4A', '#2E2E2E'],
  expired: ['#7F1D1D', '#4C1414'],
  blocked: ['#7F1D1D', '#4C1414'],
};

const MyGiftCardsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGiftCards();
  }, []);

  const loadGiftCards = async () => {
    if (!accessToken) {
      Alert.alert('Authentication Error', 'Please log in to view gift cards');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const cards = await giftCardAPI.getMyGiftCards(accessToken);
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
      case 'active': return '#3498DB';
      case 'claimed': return '#F39C12';
      case 'redeemed': return '#9E9E9E';
      case 'expired': return '#E74C3C';
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Gift Cards</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.headerButton, { marginRight: 4 }]} onPress={() => navigation.navigate('GiftCardRedemption')}>
            <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('GiftCardStore')}>
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F39C12" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F39C12" />
          }
        >
          <Text style={styles.subtitle}>{giftCards.length} gift card{giftCards.length === 1 ? '' : 's'}</Text>

          {giftCards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="gift-outline" size={40} color="#F39C12" />
              </View>
              <Text style={styles.emptyText}>No gift cards yet</Text>
              <Text style={styles.emptySubtext}>Purchase a gift card for yourself or send one to a friend</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('GiftCardStore')}
                activeOpacity={0.85}
              >
                <Ionicons name="gift" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Get Your First Gift Card</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {giftCards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  style={styles.cardWrapper}
                  onPress={() => navigation.navigate('GiftCardDetails', { giftCardId: card.id })}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={CARD_GRADIENTS[card.status] || CARD_GRADIENTS.claimed}
                    style={styles.card}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardBrandRow}>
                        <Ionicons name="gift" size={18} color="rgba(255,255,255,0.85)" />
                        <Text style={styles.cardDesign}>{card.design?.name || 'Gift Card'}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(card.status) === '#9E9E9E' ? '#EEEEEE' : '#FFFFFF' }]}>
                          {getStatusText(card.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.balance}>{card.current_balance.toLocaleString()} FRETI</Text>
                    <Text style={styles.initialBalance}>Initial: {card.initial_balance.toLocaleString()} FRETI</Text>

                    <View style={styles.cardBottomRow}>
                      <Text style={styles.expiry}>
                        Expires {new Date(card.expires_at).toLocaleDateString()}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                    </View>

                    <View style={styles.cardChip} />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  subtitle: {
    color: '#999999',
    fontSize: 13,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  cardsContainer: {
    padding: 20,
    gap: 16,
  },
  cardWrapper: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardDesign: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  balance: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  initialBalance: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  expiry: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  cardChip: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 34,
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(243, 156, 18, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F39C12',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default MyGiftCardsScreen;
