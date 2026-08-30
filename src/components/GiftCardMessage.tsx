import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
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
  const { accessToken } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [localClaimed, setLocalClaimed] = useState(false);
  const [liveStatus, setLiveStatus] = useState<any | null>(null);
  const giftCardData = message.metadata?.giftCardData || message.metadata;

  const isRecipient =
    liveStatus?.isRecipient ?? (currentUserId === giftCardData.recipientUserId);
  const isClaimed =
    liveStatus?.isClaimed ??
    (giftCardData.status === 'claimed' || giftCardData.status === 'redeemed' || localClaimed);
  const isClaimer =
    giftCardData.claimedBy === currentUserId ||
    liveStatus?.isClaimedByMe ||
    localClaimed;
  const canViewCard = isOwn || isClaimer;
  const isClaimable =
    !isOwn &&
    isRecipient &&
    giftCardData.claimCode &&
    (giftCardData.status === 'active' || !giftCardData.status) &&
    !isClaimed &&
    !localClaimed;

  const buttonLabel = isClaimable
    ? 'Claim Gift Card'
    : isClaimer
    ? 'Gift Card Claimed'
    : isClaimed
    ? 'Claimed by another user'
    : !isRecipient
    ? 'Not for you'
    : 'Gift Card Claimed';
  const buttonIcon = isClaimable ? 'gift' : isClaimer ? 'checkmark-circle' : 'close-circle';

  useEffect(() => {
    if (isOwn || !accessToken || !giftCardData.claimCode) return;
    if (
      (giftCardData.status === 'claimed' || giftCardData.status === 'redeemed') &&
      (giftCardData.claimedBy || liveStatus)
    ) {
      return;
    }

    giftCardAPI
      .getClaimStatus(accessToken, giftCardData.claimCode)
      .then(setLiveStatus)
      .catch((err: any) => console.error('Gift card claim status check failed:', err));
  }, [
    accessToken,
    isOwn,
    giftCardData.claimCode,
    giftCardData.status,
    giftCardData.claimedBy,
    liveStatus,
  ]);

  const handleClaimGiftCard = async () => {
    if (isOwn) {
      // Sender viewing their own sent gift card
      if (giftCardData?.giftCardId) {
        (navigation.navigate as any)('GiftCardDetails', { giftCardId: giftCardData.giftCardId });
      }
      return;
    }

    if (!isClaimable) {
      return;
    }

    // Recipient claiming the gift card
    if (!accessToken) {
      Alert.alert('Authentication Error', 'Please log in to claim gift cards');
      return;
    }

    setClaiming(true);
    try {
      await giftCardAPI.claimGiftCard(accessToken, giftCardData.claimCode);
      setLocalClaimed(true);
      Alert.alert('Success! 🎁', 'Gift card claimed successfully!');
      (navigation.navigate as any)('MyGiftCards');
    } catch (error: any) {
      Alert.alert('Claim Failed', error.message || 'Failed to claim gift card');
    } finally {
      setClaiming(false);
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

  const previewUrl = giftCardData.designUrl || giftCardData.preview_url;
  const amount = giftCardData.amount || giftCardData.current_balance;

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      {/* Gift Card Reference Card - Tappable */}
      <TouchableOpacity
        style={styles.giftCardReferenceCard}
        onPress={canViewCard ? handleViewDetails : undefined}
        activeOpacity={canViewCard ? 0.8 : 1}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="gift" size={16} color="#F39C12" />
            <Text style={styles.giftCardLabel}>Gift Card</Text>
          </View>
          {giftCardData.status && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{giftCardData.status}</Text>
            </View>
          )}
        </View>

        {/* Gift Card Image — full-bleed cover */}
        {previewUrl ? (
          <Image
            source={{ uri: previewUrl }}
            style={styles.giftCardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.giftCardImagePlaceholder}>
            <Ionicons name="gift-outline" size={40} color="#F39C12" />
          </View>
        )}

        {/* Gift Card Info */}
        <View style={styles.giftCardInfo}>
          <Text style={styles.amount}>{amount?.toLocaleString?.() ?? amount} FRETI</Text>
          {giftCardData.designName || giftCardData.design?.name ? (
            <Text style={styles.designName} numberOfLines={1}>
              {giftCardData.designName || giftCardData.design?.name}
            </Text>
          ) : null}
          {giftCardData.expiresAt ? (
            <Text style={styles.expiresAt}>
              Expires {new Date(giftCardData.expiresAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Message Text */}
      {message.content && (
        <View style={styles.messageTextContainer}>
          <Text style={styles.messageText}>{message.content}</Text>
        </View>
      )}

      {/* Action Button */}
      {!isOwn && giftCardData.claimCode && (
        <TouchableOpacity
          onPress={isClaimable ? handleClaimGiftCard : undefined}
          style={[
            styles.claimButton,
            !isClaimable && styles.claimButtonDisabled,
          ]}
          disabled={!isClaimable || claiming}
          activeOpacity={isClaimable ? 0.85 : 1}
        >
          {claiming ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons
                name={buttonIcon as any}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.claimButtonText}>
                {buttonLabel}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
      {isOwn && (
        <TouchableOpacity
          onPress={handleViewDetails}
          style={styles.viewButton}
          activeOpacity={0.85}
        >
          <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
    maxWidth: '92%',
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sentContainer: {
    alignSelf: 'flex-end',
    marginRight: 8,
    backgroundColor: '#051094',
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    backgroundColor: '#59788E',
  },
  giftCardReferenceCard: {
    borderRadius: 12,
    padding: 8,
    margin: 8,
    marginBottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#F39C12',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  giftCardLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
  },
  statusBadgeText: {
    color: '#F39C12',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  giftCardImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
  },
  giftCardImagePlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  giftCardInfo: {
    paddingHorizontal: 4,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  designName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  expiresAt: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    marginTop: 2,
  },
  messageTextContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageText: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 20,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F39C12',
    paddingVertical: 10,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
  },
  claimButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  claimButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
  },
  viewButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default GiftCardMessage;
