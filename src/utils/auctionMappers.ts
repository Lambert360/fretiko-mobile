import { AuctionWithDetails } from '../services/auctionsAPI';

export interface AuctionCardData {
  id: string;
  title: string;
  image?: string;
  currentBid: number;
  timeStatus: 'upcoming' | 'active' | 'ended';
  secondsRemaining?: number;
  totalBids: number;
  auctionType: 'timed' | 'live';
  categoryId?: string;
}

export const mapAuctionToCard = (auction: AuctionWithDetails): AuctionCardData => ({
  id: auction.id,
  title: auction.title,
  image: auction.thumbnail_url || auction.images?.[0],
  currentBid: auction.current_bid,
  timeStatus: auction.time_status,
  secondsRemaining: auction.seconds_remaining,
  totalBids: auction.total_bids,
  auctionType: auction.auction_type,
  categoryId: auction.category_id,
});

export const getActiveAuctions = (auctions: AuctionWithDetails[], limit = 5): AuctionWithDetails[] =>
  auctions.filter(a => a.time_status === 'active').slice(0, limit);

export const getUpcomingAuctions = (auctions: AuctionWithDetails[], limit = 5): AuctionWithDetails[] =>
  auctions.filter(a => a.time_status === 'upcoming' || a.status === 'scheduled').slice(0, limit);

