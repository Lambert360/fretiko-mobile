## Mobile Performance Optimization – Auction & Live Screens

This checklist focuses on the **auction** and **live streaming** surfaces:
- `AuctionLiveViewerScreen.tsx`
- `AuctionLiveBroadcastScreen.tsx`
- `LiveStreamViewerScreen.tsx`

It builds on existing notes in `PERFORMANCE_FIXES_SUMMARY.md` and `PROGRESSIVE_LOADING_FIX.md`.

---

### 1. Rendering & Lists

- [ ] Ensure all large lists (comments, bid history, viewers) use `FlatList` with:
  - `keyExtractor` stable keys.
  - `removeClippedSubviews={true}` where safe.
  - `initialNumToRender` tuned for viewport.
- [ ] Memoize item renderers with `React.memo` or inline `useCallback` where necessary.
- [ ] Avoid anonymous inline functions in hot paths; hoist handlers where practical.

---

### 2. Images & Media

- [ ] Use thumbnail/low‑res images for auction cards and only load full‑res where needed.
- [ ] Ensure all `<Image>` components have explicit `width`/`height` to avoid layout thrash.
- [ ] Consider caching frequently viewed images (auction thumbnails) using an image cache library if needed.
- [ ] Confirm live video components are unmounted or paused when screens are unfocused.

---

### 3. WebSocket & Realtime

- [ ] Confirm only **one** active socket per namespace:
  - `/auctions` for auctions.
  - `/live-sales` for live streaming.
- [ ] On unmount or navigation away:
  - [ ] `leaveAuction(auctionId)` is called.
  - [ ] Event handlers are removed via `.off(...)`.
  - [ ] Agora engine cleanup is called (`leaveChannel` / `release`).
- [ ] Throttle or debounce any high‑frequency UI updates driven by sockets (e.g., viewer counts, reactions).

---

### 4. State Management

- [ ] Keep heavy objects (auction, stream) in local state and pass only minimal props to children.
- [ ] Avoid putting rapidly changing values (like timers) into global context.
- [ ] Use `useRef` instead of `useState` for values that do not need to trigger re‑renders (e.g., internal timers, last known bid).

---

### 5. Animations

- [ ] Keep animated overlays (hearts, reactions) lightweight:
  - Limit max concurrent animations (e.g., cap at 20).
  - Fade out and clean up arrays promptly.
- [ ] Prefer `useNativeDriver: true` where possible for smoother animations.

---

### 6. Network & Error Handling

- [ ] Use centralized error handling helpers from `src/utils/errorHandler.ts` where possible.
- [ ] Surface user‑friendly messages (no raw error JSON).
- [ ] Log unexpected errors with enough context (screen name, auctionId/streamId, userId).

---

### 7. Testing Checklist

Test on **low‑end devices** and under:
- Poor network conditions (3G simulator).
- Long sessions (30–60 minutes in a live auction).

Verify:
- [ ] No memory leak (app remains responsive).
- [ ] CPU usage acceptable while streaming and reacting.
- [ ] Navigating between live screens and other tabs remains smooth.


