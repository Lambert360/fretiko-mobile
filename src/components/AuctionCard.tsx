import React, { useMemo, useState, useEffect } from 'react';
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
  const [currentItem, setCurrentItem] = useState<any>(null);
  const statusLabel = auction.time_status === 'active' ? 'Active' : auction.time_status === 'upcoming' ? 'Upcoming' : 'Ended';
  const statusColor = auctionsAPI.getStatusColor(auction.time_status);

  // For live auctions, fetch current item to get images
  useEffect(() => {
    if (auction.auction_type === 'live' && auction.time_status === 'active') {
      console.log('🎯 AuctionCard: Fetching current item for live auction:', auction.id, auction.title);
      auctionsAPI.getCurrentItem(auction.id).then(item => {
        console.log('🎯 AuctionCard: Received current item:', item);
        console.log('🎯 AuctionCard: Current item images:', item?.images);
        console.log('🎯 AuctionCard: Current item video_url:', item?.video_url);
        setCurrentItem(item);
      }).catch(err => {
        console.error('Error fetching current item for auction card:', err);
        setCurrentItem(null);
      });
    } else {
      console.log('🎯 AuctionCard: Not fetching current item - auction type:', auction.auction_type, 'time_status:', auction.time_status);
      setCurrentItem(null);
    }
  }, [auction.id, auction.auction_type, auction.time_status]);

  // Get image URI based on auction type
  const imageUri = useMemo(() => {
    let uri;
    if (auction.auction_type === 'live' && currentItem?.images?.length > 0) {
      // Live auction: use current item's first image
      uri = currentItem.images[0];
      console.log('🎯 AuctionCard: Using current item image for live auction:', auction.id, uri);
    } else if (auction.images?.length > 0) {
      // Timed auction: use auction's first image
      uri = auction.images[0];
      console.log('🎯 AuctionCard: Using auction image for timed auction:', auction.id, uri);
    } else {
      // Fallback to thumbnail or placeholder
      uri = auction.thumbnail_url || 'https://via.placeholder.com/300';
      console.log('🎯 AuctionCard: Using fallback image:', auction.id, uri);
    }
    console.log('🎯 AuctionCard: Final imageUri:', uri, 'for auction:', auction.id, auction.title);
    return uri;
  }, [auction, currentItem]);

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

