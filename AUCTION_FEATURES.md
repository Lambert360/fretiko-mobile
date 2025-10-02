# Live Auction Features - Implementation Guide

This document describes the live auction features implemented for the Fretiko mobile app.

## Overview

The live auction system enables sellers to host real-time auctions during live streams, with bidders participating through an interactive TikTok-style interface.

## Features Implemented

### 1. Live Stream Host Screen (Seller)
**File:** `src/screens/LiveStreamHostScreen.tsx`

**Features:**
- **Auction Control Panel**: Overlay UI for controlling auction flow
  - Current bid display
  - Total bids counter
  - Time remaining
  - Going Once button (amber)
  - Going Twice button (orange)
  - SOLD! button (green)
  - No Sale button (red)

- **Auctioneer Message Suggester**: Quick message templates for hosts
  - Horizontal scrollable quick phrases
  - Pre-written engaging messages
  - Tap to fill message input

- **Sound Effects Integration**: Automatic sound triggers
  - Crowd ambience on auction start
  - Hammer sound on going once/twice
  - Cheer sound on sold
  - Sound cleanup on exit

- **Winner Announcement**: Celebratory animation when item sells
  - Confetti cannon effect
  - Trophy icon with scale animation
  - Winner details display
  - Auto-dismiss after 4 seconds

**Styling:**
- Purple theme (#8E44AD) consistent with auction branding
- Semi-transparent backgrounds for overlay clarity
- Color-coded buttons for different auction states

### 2. Live Stream Viewer Screen (Bidder)
**File:** `src/screens/LiveStreamViewerScreen.tsx`

**Features:**
- **Auction Bid Overlay**: Bottom sheet for placing bids
  - Current bid and total bids display
  - Minimum bid increment info
  - Quick bid suggestion buttons (+increment, +2x, +3x)
  - Custom bid amount input
  - Place Bid button with validation

- **AI Auctioneer Commentary Banner**: Top banner with announcements
  - Auto-animated fade in/out
  - Megaphone icon
  - Dynamic messages from host

- **Auction Button**: Hammer icon on action bar
  - Shows bid count badge
  - Purple glow effect
  - Tap to open bid overlay

- **Sound Effects**: Reactive audio feedback
  - Crowd ambience during auction
  - Excited crowd on new bids
  - Auto-start/stop on enter/exit

- **Winner Announcement**: Same celebratory animation as host
  - Triggered automatically on SOLD message
  - Parses bid amount from comment
  - Displays to all viewers

**Styling:**
- TikTok-style overlay design
- Purple accent color (#8E44AD)
- Semi-transparent backgrounds
- Smooth animations

### 3. Auction Sound Manager
**File:** `src/utils/auctionSounds.ts`

**Purpose:** Centralized sound effect management for auction events

**Sound Events:**
- `initialize()` - Setup sound system
- `startAmbience(volume)` - Background crowd noise
- `stopAmbience()` - Stop background
- `playExcitedCrowd(volume)` - New bid reaction
- `playCheer(volume)` - Winner celebration
- `playHammer(volume)` - Gavel hit
- `playBell(volume)` - Auction start
- `playGoingOnce()` - Hammer + excited crowd
- `playGoingTwice()` - Louder hammer + crowd
- `playSold()` - Hammer + cheer sequence
- `playNewBid()` - Excited crowd
- `cleanup()` - Release resources

**Implementation Notes:**
- Currently logs sound events to console
- Ready for expo-audio integration
- TODO: Add MP3 files to `assets/sounds/`:
  - `crowd-ambience.mp3`
  - `crowd-excited.mp3`
  - `crowd-cheer.mp3`
  - `gavel-hit.mp3`
  - `auction-bell.mp3`

### 4. Winner Announcement Animation
**File:** `src/components/WinnerAnnouncementAnimation.tsx`

**Features:**
- **Confetti Cannon**: 200 confetti pieces from top center
- **Trophy Icon**: 80px gold trophy with scale animation
- **SOLD! Text**: Large purple text with shadow
- **Winner Details Card**:
  - Winner name with person icon
  - Item name with tag icon
  - Final bid with cash icon (highlighted in orange)
- **Congratulations Banner**: Purple banner at bottom
- **Sparkle Effects**: 8 animated stars scattered randomly

**Animation Sequence:**
1. Confetti fires (0ms)
2. Card fades in + scales up (400ms)
3. Details slide down (300ms, +200ms delay)
4. Hold for 3 seconds
5. Fade out (400ms)
6. Auto-dismiss and cleanup

**Props:**
```typescript
interface WinnerAnnouncementProps {
  isVisible: boolean;
  winnerName: string;
  bidAmount: number;
  itemName: string;
  onAnimationEnd?: () => void;
}
```

## Integration Points

### Backend Integration (TODO)
Add these API endpoints to `src/services/auctionsAPI.ts`:

```typescript
// Place a bid on an auction
async placeBid(auctionId: string, amount: number) {
  return await api.post(`/auctions/${auctionId}/bids`, { amount });
}

// Trigger auction event (going_once, going_twice, sold, no_sale)
async triggerAuctionEvent(auctionId: string, event: string) {
  return await api.post(`/auctions/${auctionId}/events`, { event });
}

// Get auction details
async getAuction(auctionId: string) {
  return await api.get(`/auctions/${auctionId}`);
}

// Get current highest bidder
async getHighestBidder(auctionId: string) {
  return await api.get(`/auctions/${auctionId}/highest-bidder`);
}
```

### Real-time Updates
The system uses live stream comments for real-time communication:
- Host sends auction events as comments with 📢 prefix
- Viewers monitor comments for SOLD announcements
- Auctioneer messages broadcast to all viewers

For production, consider:
- WebSocket for real-time bid updates
- Server-side bid validation
- Race condition handling
- Optimistic UI updates with rollback

### Sound Files
To enable actual audio playback:

1. Add MP3 files to `assets/sounds/`
2. Update `auctionSounds.ts` to use expo-audio:
```typescript
import { useAudioPlayer } from 'expo-audio';

// In components, create players:
const ambiencePlayer = useAudioPlayer(require('../../assets/sounds/crowd-ambience.mp3'));
const hammerPlayer = useAudioPlayer(require('../../assets/sounds/gavel-hit.mp3'));
// etc.

// Replace console.log calls with:
ambiencePlayer.play();
hammerPlayer.play();
```

## Usage Example

### For Sellers (Hosting Auction):
1. Start live stream
2. Enable auction mode: `setIsAuctionStream(true)`
3. Set auction data:
```typescript
setCurrentAuction({
  id: 'auction_123',
  item_name: 'Vintage Watch',
  current_bid: 1000,
  bid_increment: 100,
  total_bids: 5,
  status: 'active',
  time_left: 300, // seconds
});
```
4. Control panel appears automatically
5. Use quick messages to engage bidders
6. Tap action buttons to advance auction state
7. Winner animation shows on SOLD

### For Bidders (Viewing Auction):
1. Join live stream with auction
2. Enable auction mode: `setIsAuctionStream(true)`
3. Set auction data (same structure as above)
4. Hammer icon appears on action bar
5. Tap to open bid overlay
6. Select quick bid or enter custom amount
7. Confirm bid
8. See winner animation if someone else wins

## Styling Guide

### Colors
- **Primary Purple**: `#8E44AD` - Main auction color
- **Gold**: `#FFD700` - Trophy and accents
- **Amber**: `#FFC107` - Going Once
- **Orange**: `#FF9800` - Going Twice, Final Bid
- **Green**: `#4CAF50` - SOLD
- **Red**: `#F44336` - No Sale

### Animations
- Fade duration: 400ms
- Scale spring: friction 8, tension 40
- Slide duration: 300ms
- Hold time: 3-4 seconds
- Confetti: 200 pieces, 3s fall

### Layout
- Overlay backgrounds: `rgba(0, 0, 0, 0.85-0.95)`
- Border radius: 12-24px
- Padding: 16-32px
- Semi-transparent borders with accent colors

## Testing Checklist

- [ ] Host can start auction
- [ ] Control panel displays correctly
- [ ] Going Once/Twice buttons work
- [ ] SOLD triggers winner animation
- [ ] No Sale ends auction properly
- [ ] Quick messages populate input
- [ ] Sound effects trigger on events
- [ ] Viewer sees bid overlay
- [ ] Quick bid buttons calculate correctly
- [ ] Custom bid validates min increment
- [ ] Bid placement shows feedback
- [ ] Auctioneer banner appears/fades
- [ ] Winner animation plays fully
- [ ] Confetti renders
- [ ] All animations complete
- [ ] Sounds clean up on exit
- [ ] Multiple auctions in sequence work
- [ ] UI responsive on different screen sizes

## Future Enhancements

1. **Backend Integration**
   - Real-time WebSocket bid updates
   - Server-side bid validation
   - Transaction processing
   - Winner notification system

2. **Advanced Features**
   - Reserve price setting
   - Auto-increment bidding
   - Bid history timeline
   - Multiple item auctions
   - Scheduled auction start

3. **Analytics**
   - Bid engagement metrics
   - Average bid increments
   - Time to sell
   - Viewer participation rate
   - Revenue per auction

4. **Social Features**
   - Bid notifications to followers
   - Share auction moments
   - Bid leaderboard
   - VIP bidder badges

## Dependencies

```json
{
  "expo-audio": "^latest",
  "react-native-confetti-cannon": "^latest",
  "@expo/vector-icons": "^latest",
  "react-native-safe-area-context": "^latest"
}
```

## File Structure

```
fretiko-mobile/
├── src/
│   ├── components/
│   │   └── WinnerAnnouncementAnimation.tsx
│   ├── screens/
│   │   ├── LiveStreamHostScreen.tsx
│   │   └── LiveStreamViewerScreen.tsx
│   ├── utils/
│   │   └── auctionSounds.ts
│   └── services/
│       └── auctionsAPI.ts (TODO)
├── assets/
│   └── sounds/ (TODO - add MP3 files)
└── AUCTION_FEATURES.md
```

---

**Implementation Date:** October 2, 2025
**Status:** ✅ Complete - Ready for backend integration
