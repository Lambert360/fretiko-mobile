import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auctionsAPI, AuctionWithDetails } from '../services/auctionsAPI';

export interface AuctionCardProps {
  auction: AuctionWithDetails;
  onPress?: (auction: AuctionWithDetails) => void;
  variant?: 'horizontal' | 'grid';
}

// Lightweight countdown formatter for MVP
const formatCountdown = (seconds?: number) => {
  if (!seconds || seconds <= 0) return 'Ending soon';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export const AuctionCard: React.FC<AuctionCardProps> = ({ auction, onPress, variant = 'horizontal' }) => {
  const imageUri = auction.thumbnail_url || auction.images?.[0] || 'https://via.placeholder.com/300';
  const statusLabel = auction.time_status === 'active' ? 'Active' : auction.time_status === 'upcoming' ? 'Upcoming' : 'Ended';
  const statusColor = auctionsAPI.getStatusColor(auction.time_status);

  const timeRemaining = useMemo(() => formatCountdown(auction.seconds_remaining), [auction.seconds_remaining]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(auction)}
      style={[styles.card, variant === 'grid' && styles.cardGrid]}
    >
      <Image source={{ uri: imageUri }} style={[styles.image, variant === 'grid' && styles.imageGrid]} resizeMode="cover" />

      <View style={styles.badgeContainer}>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
        {auction.auction_type === 'live' && (
          <View style={[styles.badge, styles.liveBadge]}>
            <Ionicons name="radio" size={12} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>Live</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{auction.title}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Current bid</Text>
          <Text style={styles.value}>{auctionsAPI.formatPrice(auction.current_bid)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Ends in</Text>
          <Text style={styles.value}>{timeRemaining}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Ionicons name="people" size={14} color="#888" style={{ marginRight: 4 }} />
            <Text style={styles.footerText}>{auction.total_bids} bids</Text>
          </View>
          <View style={styles.footerRow}>
            <Ionicons name="pricetag" size={14} color="#888" style={{ marginRight: 4 }} />
            <Text style={styles.footerText}>{auction.auction_type === 'timed' ? 'Timed' : 'Live'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  cardGrid: {
    width: '48%',
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: '#111',
  },
  imageGrid: {
    height: 160,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  liveBadge: {
    backgroundColor: '#E74C3C',
  },
  content: {
    padding: 12,
    gap: 6,
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#888',
    fontSize: 12,
  },
  value: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 12,
  },
});

export default AuctionCard;

