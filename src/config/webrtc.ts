/**
 * WebRTC Configuration
 * 
 * Configuration for WebRTC connections including STUN and TURN servers.
 * STUN servers help with NAT traversal, TURN servers provide relay when direct
 * peer-to-peer connection is not possible.
 */

import { WebRTCConfig } from '../services/webRTCService';

/**
 * Free public STUN servers
 * These servers help discover the public IP address and port for NAT traversal
 */
const PUBLIC_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stun.stunprotocol.org:3478',
];

/**
 * Get WebRTC configuration with ICE servers
 * 
 * Priority order:
 * 1. Use custom TURN server if credentials are provided (best for production)
 * 2. Fall back to public STUN servers (good for most cases)
 * 
 * Note: For production, you should set up your own TURN server using coturn
 * or use a managed service like Twilio TURN, Xirsys, etc.
 */
export const getWebRTCConfig = (): WebRTCConfig => {
  const config: WebRTCConfig = {
    iceServers: [],
  };

  // Add custom TURN server if configured (recommended for production)
  const turnUrl = process.env.EXPO_PUBLIC_TURN_SERVER_URL;
  const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    console.log('✅ Using custom TURN server');
    config.iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  } else {
    console.log('⚠️ No custom TURN server configured, using STUN only');
    console.log('💡 For better reliability, set up TURN server credentials in .env');
  }

  // Add public STUN servers (always include these)
  config.iceServers.push(...PUBLIC_STUN_SERVERS.map(url => ({ urls: url })));

  console.log(`🔧 WebRTC config initialized with ${config.iceServers.length} ICE servers`);

  return config;
};

/**
 * Get recommended media constraints based on call type
 */
export const getMediaConstraints = (type: 'audio' | 'video', quality: 'low' | 'medium' | 'high' = 'medium') => {
  // Audio-only call
  if (type === 'audio') {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
      },
      video: false,
    };
  }

  // Video call with audio
  const videoConstraints = {
    low: {
      width: { ideal: 320 },
      height: { ideal: 240 },
      frameRate: { ideal: 15 },
      facingMode: 'user' as const,
    },
    medium: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 24 },
      facingMode: 'user' as const,
    },
    high: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: 'user' as const,
    },
  };

  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
    },
    video: videoConstraints[quality],
  };
};

/**
 * Validate WebRTC configuration
 */
export const validateWebRTCConfig = (config: WebRTCConfig): { isValid: boolean; warnings: string[] } => {
  const warnings: string[] = [];

  if (!config.iceServers || config.iceServers.length === 0) {
    warnings.push('No ICE servers configured');
    return { isValid: false, warnings };
  }

  const hasTurnServer = config.iceServers.some(server => 
    (typeof server.urls === 'string' && server.urls.startsWith('turn:')) ||
    (Array.isArray(server.urls) && server.urls.some(url => url.startsWith('turn:')))
  );

  if (!hasTurnServer) {
    warnings.push('No TURN server configured - calls may fail behind strict firewalls/NATs');
  }

  const hasStunServer = config.iceServers.some(server =>
    (typeof server.urls === 'string' && server.urls.startsWith('stun:')) ||
    (Array.isArray(server.urls) && server.urls.some(url => url.startsWith('stun:')))
  );

  if (!hasStunServer) {
    warnings.push('No STUN server configured - NAT traversal may not work');
  }

  return {
    isValid: true,
    warnings,
  };
};

/**
 * Setup instructions for TURN server (for deployment)
 */
export const TURN_SERVER_SETUP_GUIDE = `
📚 Setting up a TURN Server (Production)

Option 1: Self-hosted coturn (Free, requires server)
-----------------------------------------------
1. Spin up a VPS (Digital Ocean, AWS EC2, etc.)
2. Install coturn: apt-get install coturn
3. Configure /etc/turnserver.conf:
   - listening-port=3478
   - fingerprint
   - lt-cred-mech
   - user=username:password
   - realm=your.domain.com
   - external-ip=YOUR_PUBLIC_IP
4. Start: systemctl start coturn
5. Test: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

Cost: ~$5-10/month for VPS + bandwidth

Option 2: Managed TURN services (Paid, easier)
-----------------------------------------------
- Twilio Network Traversal Service: https://www.twilio.com/stun-turn
- Xirsys: https://xirsys.com/
- Metered TURN: https://www.metered.ca/stun-turn

Cost: ~$0.50-2.00 per GB

Option 3: Use free public STUN only (Development)
-----------------------------------------------
- Works for ~70-80% of connections
- Fails behind symmetric NATs and strict firewalls
- Good for testing, NOT recommended for production

Environment Variables:
----------------------
Add to your .env file:
EXPO_PUBLIC_TURN_SERVER_URL=turn:your.server.com:3478
EXPO_PUBLIC_TURN_USERNAME=username
EXPO_PUBLIC_TURN_CREDENTIAL=password
`;

export default {
  getWebRTCConfig,
  getMediaConstraints,
  validateWebRTCConfig,
  TURN_SERVER_SETUP_GUIDE,
};

