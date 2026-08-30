import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../contexts/AuthContext';
import giftCardAPI, { GiftCard } from '../services/giftCardAPI';
import { SafeImage } from '../components/SafeImage';

type RootStackParamList = {
  MyGiftCards: undefined;
};

type RouteParams = {
  GiftCardDetails: { giftCardId?: string; claimCode?: string };
};

const CARD_GRADIENT = ['#F39C12', '#E67E22', '#D35400'] as const;

const GiftCardDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RouteParams, 'GiftCardDetails'>>();
  const { giftCardId, claimCode } = route.params;
  const { accessToken } = useAuth();
  const isClaimMode = !!claimCode && !giftCardId;
  const insets = useSafeAreaInsets();

  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinRevealed, setPinRevealed] = useState(false);

  useEffect(() => {
    loadGiftCardDetails();
  }, []);

  const loadGiftCardDetails = async () => {
    if (!accessToken) {
      Alert.alert('Authentication Error', 'Please log in to view gift card details');
      navigation.goBack();
      return;
    }

    try {
      if (isClaimMode && claimCode) {
        const card = await giftCardAPI.getGiftCardByClaimCode(claimCode);
        if (card) {
          setGiftCard(card as GiftCard);
        } else {
          Alert.alert('Error', 'Gift card not found or already claimed');
          navigation.goBack();
        }
      } else if (giftCardId) {
        const cards = await giftCardAPI.getMyGiftCards(accessToken);
        const card = cards.find((c) => c.id === giftCardId);

        if (card) {
          setGiftCard(card);
        } else {
          Alert.alert('Error', 'Gift card not found');
          navigation.goBack();
        }
      } else {
        Alert.alert('Error', 'No gift card identifier provided');
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load gift card details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleClaimGiftCard = async () => {
    if (!accessToken || !giftCard?.claim_code) return;

    try {
      setLoading(true);
      await giftCardAPI.claimGiftCard(accessToken, giftCard.claim_code);
      Alert.alert('Success! 🎁', 'Gift card claimed successfully!', [
        { text: 'OK', onPress: () => (navigation.navigate as any)('MyGiftCards') },
      ]);
    } catch (error: any) {
      Alert.alert('Claim Failed', error.message || 'Failed to claim gift card');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCardNumber = async () => {
    if (!giftCard) return;
    await Clipboard.setStringAsync(giftCard.card_number);
    Alert.alert('Copied', 'Card number copied to clipboard');
  };

  const handleCopyPin = async () => {
    if (!giftCard) return;
    if (!pinRevealed) {
      setPinRevealed(true);
      return;
    }
    await Clipboard.setStringAsync(giftCard.pin || '');
    Alert.alert('Copied', 'PIN copied to clipboard');
  };

  const handleCopyClaimCode = async () => {
    if (!giftCard) return;
    await Clipboard.setStringAsync(giftCard.claim_code || '');
    Alert.alert('Copied', 'Claim code copied to clipboard');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#F39C12" />
      </View>
    );
  }

  if (!giftCard) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>Gift card not found</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Card Details</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Hero card */}
        <View style={styles.cardPreviewWrapper}>
          {giftCard.design?.design_url ? (
            <View style={styles.cardPreview}>
              <SafeImage
                source={{ uri: giftCard.design.design_url }}
                style={styles.cardImage}
                resizeMode="cover"
                fallbackText="Gift Card"
              />
              <View style={styles.cardOverlay}>
                <Text style={styles.cardAmount}>{giftCard.current_balance.toLocaleString()} FRETI</Text>
                <Text style={styles.cardDesign}>{giftCard.design?.name}</Text>
              </View>
            </View>
          ) : (
            <LinearGradient colors={CARD_GRADIENT} style={styles.cardPreview} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.cardOverlay}>
                <Text style={styles.cardAmount}>{giftCard.current_balance.toLocaleString()} FRETI</Text>
                <Text style={styles.cardDesign}>{giftCard.design?.name || 'Gift Card'}</Text>
              </View>
            </LinearGradient>
          )}
        </View>

        {/* Balance Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Balance Information</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(giftCard.status) }]}>
              <Text style={styles.statusText}>{getStatusText(giftCard.status)}</Text>
            </View>
          </View>

          <View style={styles.balanceInfo}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceValue}>{giftCard.current_balance.toLocaleString()} FRETI</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Initial Amount</Text>
              <Text style={styles.balanceValue}>{giftCard.initial_balance.toLocaleString()} FRETI</Text>
            </View>
            <View style={[styles.balanceRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.balanceLabel}>Remaining</Text>
              <Text style={[styles.balanceValue, { color: '#27AE60' }]}>
                {giftCard.current_balance.toLocaleString()} FRETI
              </Text>
            </View>
          </View>
        </View>

        {/* Card details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card Details</Text>

          <TouchableOpacity style={styles.detailRow} onPress={handleCopyCardNumber} activeOpacity={0.7}>
            <Text style={styles.detailLabel}>Card Number</Text>
            <View style={styles.detailValueRow}>
              <Text style={styles.detailValue}>{giftCard.card_number}</Text>
              <Ionicons name="copy-outline" size={16} color="#666666" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.detailRow} onPress={handleCopyPin} activeOpacity={0.7}>
            <Text style={styles.detailLabel}>PIN</Text>
            <View style={styles.detailValueRow}>
              <Text style={styles.detailValue}>{pinRevealed ? (giftCard.pin || '••••') : '••••'}</Text>
              <Ionicons name={pinRevealed ? 'copy-outline' : 'eye-outline'} size={16} color="#666666" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.detailRow} onPress={handleCopyClaimCode} activeOpacity={0.7}>
            <Text style={styles.detailLabel}>Claim Code</Text>
            <View style={styles.detailValueRow}>
              <Text style={styles.detailValue}>{giftCard.claim_code || 'N/A'}</Text>
              <Ionicons name="copy-outline" size={16} color="#666666" />
            </View>
          </TouchableOpacity>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Design</Text>
            <Text style={styles.detailValue}>{giftCard.design?.name}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Purchased</Text>
            <Text style={styles.detailValue}>{new Date(giftCard.purchased_at).toLocaleDateString()}</Text>
          </View>

          <View style={[styles.detailRow, !giftCard.last_used_at && { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Expires</Text>
            <Text style={styles.detailValue}>{new Date(giftCard.expires_at).toLocaleDateString()}</Text>
          </View>

          {giftCard.last_used_at && (
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Last Used</Text>
              <Text style={styles.detailValue}>{new Date(giftCard.last_used_at).toLocaleDateString()}</Text>
            </View>
          )}
        </View>

        {/* Delivery info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery Method</Text>
            <Text style={styles.detailValue}>{giftCard.delivery_method}</Text>
          </View>

          {(giftCard as any).recipient_username && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Recipient</Text>
              <Text style={styles.detailValue}>@{(giftCard as any).recipient_username}</Text>
            </View>
          )}

          {(giftCard as any).email_sent_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email Sent</Text>
              <Text style={styles.detailValue}>{new Date((giftCard as any).email_sent_at).toLocaleString()}</Text>
            </View>
          )}

          {(giftCard as any).chat_sent_at && (
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Chat Sent</Text>
              <Text style={styles.detailValue}>{new Date((giftCard as any).chat_sent_at).toLocaleString()}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {isClaimMode && giftCard.status === 'active' && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.useButton} onPress={handleClaimGiftCard} activeOpacity={0.85}>
            <Ionicons name="gift" size={20} color="#FFFFFF" />
            <Text style={styles.useButtonText}>Claim Gift Card</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isClaimMode && giftCard.status === 'claimed' && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={styles.useButton} activeOpacity={0.85}>
            <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
            <Text style={styles.useButtonText}>Use at Checkout</Text>
          </TouchableOpacity>
        </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  cardPreviewWrapper: {
    padding: 20,
  },
  cardPreview: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 190,
    position: 'relative',
    shadowColor: '#F39C12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 20,
  },
  cardAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardDesign: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  balanceInfo: {
    backgroundColor: '#0D0D0D',
    padding: 14,
    borderRadius: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  balanceLabel: {
    fontSize: 13,
    color: '#999999',
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  detailLabel: {
    fontSize: 13,
    color: '#999999',
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  useButton: {
    flexDirection: 'row',
    backgroundColor: '#F39C12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  useButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#999999',
    fontSize: 15,
  },
});

export default GiftCardDetailsScreen;
