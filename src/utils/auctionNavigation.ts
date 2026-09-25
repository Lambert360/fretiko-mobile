/**
 * Centralized auction navigation.
 *
 * Live multi-item auctions and timed auctions have dedicated detail screens:
 *  - 'live'  → LiveAuctionDetails (host Start Live / viewer Join Live / winner checkout)
 *  - 'timed' → AuctionDetails
 *
 * Every entry point (lists, cards, notifications, create flow) should use this
 * helper so the destination stays consistent. AuctionDetailsScreen also
 * self-redirects live auctions as a safety net for deep links and any missed
 * call sites.
 */

export type AuctionLike = {
  id?: string;
  auction_id?: string;
  auction_type?: 'live' | 'timed' | string;
  auctionType?: 'live' | 'timed' | string;
};

export function getAuctionDetailsRoute(auction: AuctionLike): {
  name: 'LiveAuctionDetails' | 'AuctionDetails';
  auctionId: string | undefined;
} {
  const auctionId = auction.id ?? auction.auction_id;
  const type = auction.auction_type ?? auction.auctionType;
  return {
    name: type === 'live' ? 'LiveAuctionDetails' : 'AuctionDetails',
    auctionId,
  };
}

export function navigateToAuctionDetails(navigation: any, auction: AuctionLike): void {
  const { name, auctionId } = getAuctionDetailsRoute(auction);
  navigation.navigate(name, { auctionId });
}
