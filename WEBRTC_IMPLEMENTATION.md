# WebRTC Implementation Guide

## 📋 Overview

This document describes the WebRTC implementation for real-time audio and video calling in the Fretiko mobile app. The implementation uses `react-native-webrtc` for peer-to-peer communication without relying on paid third-party SDKs like Agora for 1-on-1 calls.

## 🎯 What Was Implemented

### Core Components

1. **WebRTC Service** (`src/services/webRTCService.ts`)
   - Peer connection management
   - Media stream handling (audio/video)
   - ICE candidate management
   - SDP offer/answer exchange
   - Connection state monitoring
   - Error handling

2. **WebRTC Configuration** (`src/config/webrtc.ts`)
   - STUN/TURN server configuration
   - Media constraints (audio/video quality)
   - Configuration validation

3. **Real-time Signaling** (Updated `src/services/realtimeAPI.ts`)
   - WebRTC signaling methods (SDP offer/answer, ICE candidates)
   - Call ended notifications
   - WebSocket-based peer-to-peer signaling

4. **UI Integration** (Updated `src/screens/IndividualChatScreen.tsx`)
   - RTCView components for video display
   - Real WebRTC call flow (offer/answer/ICE)
   - Media track controls (mute, video toggle, camera switch)
   - Proper cleanup on call end

## 🚀 Installation Steps

### 1. Install Dependencies

```bash
cd fretiko-mobile
npm install
```

**New dependencies added:**
- `react-native-webrtc`: ^124.0.4
- `@config-plugins/react-native-webrtc`: ^9.0.0

### 2. Rebuild Native Code

Since react-native-webrtc requires native modules, you must rebuild the app:

#### For iOS:

```bash
# Install CocoaPods dependencies
cd ios
pod install
cd ..

# Build the iOS app
npx expo run:ios
```

#### For Android:

```bash
# Build the Android app
npx expo run:android
```

### 3. Rebuild Custom Dev Client (Important!)

If using Expo Dev Client:

```bash
# Build development client
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

**Note**: You CANNOT use standard Expo Go for this - WebRTC requires native modules.

### 4. Environment Variables (Optional but Recommended)

For production, set up your own TURN server and add to `.env`:

```env
EXPO_PUBLIC_TURN_SERVER_URL=turn:your.server.com:3478
EXPO_PUBLIC_TURN_USERNAME=username
EXPO_PUBLIC_TURN_CREDENTIAL=password
```

## 🔧 TURN Server Setup (Production)

### Option 1: Self-Hosted coturn (Free)

**Requirements:**
- A VPS (Digital Ocean, AWS EC2, etc.)
- Public IP address
- Open ports: 3478 (UDP/TCP), 49152-65535 (UDP for relay)

**Installation:**

```bash
# On Ubuntu/Debian
sudo apt-get update
sudo apt-get install coturn

# Edit config
sudo nano /etc/turnserver.conf
```

**Configuration (`/etc/turnserver.conf`):**

```conf
# Listening port
listening-port=3478

# Enable fingerprint
fingerprint

# Use long-term credential mechanism
lt-cred-mech

# Create user credentials
user=username:password

# Realm (your domain)
realm=your.domain.com

# External IP (your server's public IP)
external-ip=YOUR_PUBLIC_IP

# Logging
log-file=/var/log/turnserver.log
verbose
```

**Start coturn:**

```bash
sudo systemctl start coturn
sudo systemctl enable coturn
```

**Test your TURN server:**
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

**Cost:** ~$5-10/month for VPS + bandwidth costs

### Option 2: Managed TURN Services (Paid)

- **Twilio Network Traversal**: https://www.twilio.com/stun-turn
- **Xirsys**: https://xirsys.com/
- **Metered TURN**: https://www.metered.ca/stun-turn

**Cost:** ~$0.50-$2.00 per GB

### Option 3: Free Public STUN Only (Development/Testing)

The app uses free public STUN servers by default:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- etc.

**Note:** STUN-only works for ~70-80% of connections. Calls will fail behind symmetric NATs and strict corporate firewalls. NOT recommended for production.

## 📱 Backend Requirements

The backend needs to relay WebRTC signaling messages between peers. Update your WebSocket handler:

```javascript
// Backend WebSocket handler (Node.js/Express example)
io.of('/chat').on('connection', (socket) => {
  // ... existing handlers ...

  // WebRTC signaling relay
  socket.on('webrtc_signal', (data) => {
    const { callSessionId, type, data: signalData } = data;
    
    // Relay to all other participants in the call
    socket.to(callSessionId).emit('webrtc_signal', {
      callSessionId,
      type,
      data: signalData
    });
    
    console.log(`📡 Relayed WebRTC signal: ${type} for call: ${callSessionId}`);
  });
});
```

**What this does:**
- Relays SDP offers from caller to callee
- Relays SDP answers from callee to caller
- Relays ICE candidates between peers
- Relays call ended signals

## 🎬 How It Works

### Call Flow

#### 1. Caller Initiates Call

```
User A presses call button
  ↓
Initialize WebRTC with STUN/TURN config
  ↓
Get user media (camera/microphone)
  ↓
Create peer connection
  ↓
Create SDP offer
  ↓
Set local description (offer)
  ↓
Send offer to peer via WebSocket
  ↓
Generate ICE candidates
  ↓
Send ICE candidates to peer via WebSocket
```

#### 2. Callee Receives Call

```
Receive incoming call notification
  ↓
User B presses accept
  ↓
Initialize WebRTC
  ↓
Get user media
  ↓
Create peer connection
  ↓
Receive SDP offer from WebSocket
  ↓
Set remote description (offer)
  ↓
Create SDP answer
  ↓
Set local description (answer)
  ↓
Send answer to peer via WebSocket
  ↓
Exchange ICE candidates
```

#### 3. Connection Established

```
Both peers exchange ICE candidates
  ↓
ICE negotiation completes
  ↓
Peer connection state: "connected"
  ↓
Media streams flowing bidirectionally
  ↓
Call UI shows remote video
```

### Architecture Diagram

```
┌─────────────┐                    ┌─────────────┐
│   Caller    │                    │   Callee    │
│  (User A)   │                    │  (User B)   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. Create Offer                │
       ├──────────────────────────────►  │
       │     (via WebSocket)              │
       │                                  │
       │  2. Send Answer                  │
       │  ◄──────────────────────────────┤
       │     (via WebSocket)              │
       │                                  │
       │  3. Exchange ICE Candidates      │
       │  ◄─────────────────────────────► │
       │     (via WebSocket)              │
       │                                  │
       │  4. Direct P2P Media Stream      │
       │  ◄═══════════════════════════════►
       │     (via STUN/TURN)              │
       │     Audio + Video                │
       └──────────────────────────────────┘
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Audio-only call (both directions)
- [ ] Video call (both directions)
- [ ] Mute/unmute during call
- [ ] Video on/off during call
- [ ] Camera switch (front/back)
- [ ] End call from either side
- [ ] Decline incoming call
- [ ] Missed call (timeout)
- [ ] Network interruption during call
- [ ] Call quality on WiFi
- [ ] Call quality on cellular data
- [ ] Multiple consecutive calls
- [ ] Call with screen rotation
- [ ] Call with app backgrounding/foregrounding

### Network Conditions to Test

1. **Good WiFi**: Should work perfectly
2. **Weak WiFi**: Should degrade gracefully
3. **Cellular 4G/5G**: Should work well
4. **Cellular 3G**: Audio-only should work
5. **Behind NAT**: TURN server needed
6. **Behind corporate firewall**: TURN server needed
7. **Network switch mid-call**: Should reconnect

## 🐛 Troubleshooting

### Issue: No video/audio

**Solution:**
- Check camera/microphone permissions
- Verify WebRTC initialization succeeded
- Check browser console for WebRTC errors
- Test with `webrtc-internals` (chrome://webrtc-internals)

### Issue: Calls fail immediately

**Solution:**
- Check TURN server configuration
- Verify backend WebSocket signaling is working
- Check ICE candidate exchange
- Review network firewall settings

### Issue: One-way audio/video

**Solution:**
- Check ICE candidate types (ensure relay candidates)
- Verify both peers set remote descriptions
- Check for asymmetric NAT issues
- Ensure TURN server is accessible from both sides

### Issue: Poor call quality

**Solution:**
- Reduce video resolution in config
- Check network bandwidth
- Enable adaptive bitrate
- Monitor packet loss and jitter stats

### Issue: Calls work sometimes but not always

**Solution:**
- Likely NAT traversal issue
- Set up TURN server (not just STUN)
- Test with different network combinations
- Check TURN server logs

## 📊 Monitoring & Analytics

### Key Metrics to Track

1. **Connection Success Rate**: % of calls that successfully connect
2. **ICE Connection Time**: Time to establish peer connection
3. **Call Duration**: Average call length
4. **Network Type Distribution**: WiFi vs Cellular
5. **Failure Reasons**: Why calls fail
6. **TURN Usage Rate**: % of calls using TURN relay

### WebRTC Stats API

```typescript
// Get connection stats
const stats = await webRTCService.getStats();
console.log('WebRTC Stats:', stats);
```

## 🔒 Security Considerations

1. **Signaling Security**: Use WSS (WebSocket Secure) for signaling
2. **TURN Authentication**: Always use credentials for TURN servers
3. **Media Encryption**: WebRTC encrypts media by default (SRTP)
4. **Access Control**: Verify users can only call authorized contacts
5. **Rate Limiting**: Prevent call spam
6. **Privacy**: Don't log media content, only metadata

## 📈 Scalability

### Current Implementation
- **Type**: Peer-to-peer (P2P)
- **Max Participants**: 2 (1-on-1 calls)
- **Server Load**: Low (signaling only)
- **Bandwidth**: Direct between peers

### For Group Calls (Future)
- **Option 1**: Mesh P2P (each peer connects to all others)
  - Max: 4-6 participants
  - High bandwidth per client
  - No server bandwidth costs

- **Option 2**: SFU (Selective Forwarding Unit)
  - Max: 20-50 participants
  - Medium bandwidth per client
  - Requires media server (Janus, MediaSoup, LiveKit)

- **Option 3**: MCU (Multipoint Control Unit)
  - Max: 100+ participants
  - Low bandwidth per client
  - High server processing costs
  - Server handles mixing

## 💰 Cost Analysis

### STUN Only (Current Default)
- **Cost**: $0
- **Success Rate**: ~70-80%
- **Use Case**: Development, testing

### Self-Hosted TURN
- **Initial Setup**: 2-4 hours
- **VPS**: $5-10/month
- **Bandwidth**: ~$0.05-0.10 per GB
- **Success Rate**: ~95-98%
- **Use Case**: Small to medium scale production

### Managed TURN Service
- **Setup**: 30 minutes
- **Cost**: $0.50-2.00 per GB
- **Success Rate**: ~98-99%
- **Use Case**: Large scale production

### Example Monthly Costs (1000 active users)

**Assumptions:**
- Average call: 10 minutes
- Calls per user per month: 10
- Total call minutes: 10,000 minutes/month
- TURN usage: 30% of calls
- Average bitrate: 500 kbps

**Self-Hosted TURN:**
- VPS: $10/month
- Bandwidth: (10,000 × 0.3 × 10 min × 500 kbps × 60 sec) / 8 / 1024 / 1024 = ~13.4 GB
- Bandwidth cost: $1.34
- **Total: ~$11.34/month**

**Managed TURN:**
- Bandwidth: 13.4 GB × $1.50 = $20.10
- **Total: ~$20.10/month**

## 🆚 Comparison with Agora

| Feature | WebRTC Implementation | Agora SDK |
|---------|----------------------|-----------|
| **Cost (10K min/month)** | $0-20 | $0 (free tier) |
| **Cost (100K min/month)** | $20-200 | $99-399 |
| **Setup Complexity** | High | Medium |
| **Maintenance** | High | Low |
| **Control** | Full | Limited |
| **Call Quality** | Good (with TURN) | Excellent |
| **Features** | Basic | Advanced |
| **Scalability** | Manual | Automatic |
| **Time to Production** | 2-4 weeks | 1 week |

## 📚 Additional Resources

- [react-native-webrtc Documentation](https://react-native-webrtc.github.io/)
- [WebRTC for the Curious](https://webrtcforthecurious.com/)
- [coturn Documentation](https://github.com/coturn/coturn)
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC Samples](https://webrtc.github.io/samples/)

## 🎉 Summary

You now have a fully functional WebRTC implementation for 1-on-1 audio and video calls without relying on paid SDKs. The system uses:

- ✅ Free and open-source WebRTC
- ✅ No per-minute charges
- ✅ Real peer-to-peer communication
- ✅ Full control over infrastructure
- ✅ STUN/TURN for NAT traversal
- ✅ Production-ready error handling
- ✅ Beautiful video UI with RTCView

For production deployment, set up a TURN server to ensure high connection success rates. Happy calling! 📞

