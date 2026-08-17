import React, { forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';

import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Line,
  Path,
} from 'react-native-svg';

import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');

const CARD_WIDTH = Math.min(width - 32, 350);
const CARD_HEIGHT = CARD_WIDTH * 0.56;

// Theme definitions based on reference images
type ThemeType = 'original' | 'emerald' | 'royal';

interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
  accent: string;
}

const themes: Record<ThemeType, ThemeColors> = {
  original: {
    primary: '#FF8A00',   // Orange
    secondary: '#FF3D00', // Red-orange
    tertiary: '#7B4DFF', // Purple
    quaternary: '#00C8FF', // Cyan
    accent: '#FFD000',    // Yellow
  },
  emerald: {
    primary: '#00D084',   // Green
    secondary: '#00FF88', // Light green
    tertiary: '#00C8FF', // Cyan
    quaternary: '#FFD000', // Yellow
    accent: '#00FFB3',    // Teal
  },
  royal: {
    primary: '#8B5CFF',   // Purple
    secondary: '#FF2DAA', // Pink
    tertiary: '#00C8FF', // Cyan
    quaternary: '#FF6B35', // Orange
    accent: '#FF0080',    // Magenta
  },
};

interface ReferralStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_clicks: number;
  total_rewards: number;
}

interface ReferralCardProps {
  name: string;
  username: string;
  email: string;
  referralCode: string;
  referralUrl: string;
  stats?: ReferralStats;
  theme?: ThemeType;
}

const ReferralCard = forwardRef<View, ReferralCardProps>(
  (
    {
      name,
      username,
      email,
      referralCode,
      referralUrl,
      stats = {
        total_referrals: 0,
        completed_referrals: 0,
        pending_referrals: 0,
        total_clicks: 0,
        total_rewards: 0,
      },
      theme = 'original',
    },
    ref
  ) => {
    const colors = themes[theme];

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.card,
          {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
          },
        ]}
      >
        {/* Background */}
        <Svg
          width="100%"
          height="100%"
          style={StyleSheet.absoluteFill}
        >
          <Defs>

            {/* Border gradient */}
            <LinearGradient
              id="borderGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="0.45" stopColor={colors.secondary} />
              <Stop offset="0.75" stopColor={colors.tertiary} />
              <Stop offset="1" stopColor={colors.quaternary} />
            </LinearGradient>

            {/* Center divider gradient */}
            <LinearGradient
              id="dividerGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="0.5" stopColor={colors.secondary} />
              <Stop offset="1" stopColor={colors.quaternary} />
            </LinearGradient>

          </Defs>

          {/* Card background */}
          <Rect
            x="1"
            y="1"
            width="99.5%"
            height="99%"
            rx="28"
            fill="#050505"
            stroke="url(#borderGradient)"
            strokeWidth="2"
          />

          {/* Subtle futuristic lines */}
          <Line
            x1="45%"
            y1="0"
            x2="58%"
            y2="100%"
            stroke="#171717"
            strokeWidth="2"
          />

          <Line
            x1="48%"
            y1="0"
            x2="61%"
            y2="100%"
            stroke="#101010"
            strokeWidth="1"
          />

          {/* Glowing divider */}
          <Path
            d="M 52% 0 L 65% 50% L 52% 100%"
            fill="none"
            stroke="url(#dividerGradient)"
            strokeWidth="4"
          />
        </Svg>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>
            freti<Text style={[styles.logoDot, { color: colors.primary }]}>k</Text>o
          </Text>

          <Text style={styles.tagline}>
            <Text style={{ color: colors.primary }}>Smart.</Text>{' '}
            <Text style={{ color: colors.quaternary }}>Fast.</Text>{' '}
            <Text style={{ color: colors.accent }}>Reliable.</Text>
          </Text>
        </View>

        {/* Horse watermark */}
        <Image
          source={require('../assets/horse.png')}
          style={styles.horse}
          resizeMode="contain"
        />

        {/* User information */}
        <View style={styles.userSection}>

          <Text style={styles.name}>
            {name.toUpperCase()}
          </Text>

          <View style={[styles.gradientLine, { backgroundColor: colors.primary }]} />

          <View style={styles.infoBox}>
            <Text style={styles.label}>
              USERNAME
            </Text>

            <Text style={styles.value}>
              @{username.replace('@', '')}
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>
              EMAIL
            </Text>

            <Text
              style={styles.value}
              numberOfLines={1}
            >
              {email}
            </Text>
          </View>

          {/* Referral Stats */}
          <View style={styles.statsContainer}>
            <Text style={[styles.statsLabel, { color: colors.primary }]}>
              REFERRALS
            </Text>
            <Text style={styles.statsValue}>
              {stats.completed_referrals}
            </Text>
          </View>

          <Text style={[styles.cardType, { color: colors.primary }]}>
            REFERRAL CARD
          </Text>

        </View>

        {/* QR section */}
        <View style={styles.qrSection}>

          <Text style={styles.scanTitle}>
            SCAN TO JOIN
          </Text>

          <Text style={[styles.future, { color: colors.tertiary }]}>
            THE FUTURE
          </Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={referralUrl}
              size={CARD_WIDTH * 0.17}
              backgroundColor="#050505"
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.invite}>
            <Text style={{ color: colors.primary }}>
              Invite.
            </Text>{' '}

            <Text style={{ color: colors.quaternary }}>
              Connect.
            </Text>{' '}

            <Text style={{ color: colors.accent }}>
              Grow.
            </Text>
          </Text>

        </View>

      </View>
    );
  }
);

export default ReferralCard;

const styles = StyleSheet.create({

  card: {
    backgroundColor: '#050505',
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',

    shadowColor: '#00BFFF',
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: {
      width: 0,
      height: 0,
    },

    elevation: 15,
  },

  logoContainer: {
    position: 'absolute',
    left: '7%',
    top: '8%',
  },

  logo: {
    color: '#FFFFFF',
    fontSize: CARD_WIDTH * 0.045,
    fontWeight: '700',
    letterSpacing: -1.5,
  },

  logoDot: {
    color: '#FF8A00',
  },

  tagline: {
    marginTop: 2,
    fontSize: CARD_WIDTH * 0.012,
    fontWeight: '500',
    letterSpacing: 1,
  },

  horse: {
    position: 'absolute',
    width: '40%',
    height: '65%',
    left: '2%',
    top: '27%',
    opacity: 0.10,
  },

  userSection: {
    position: 'absolute',
    left: '7%',
    top: '39%',
    width: '39%',
  },

  name: {
    color: '#FFFFFF',
    fontSize: CARD_WIDTH * 0.027,
    fontWeight: '700',
    letterSpacing: 4,
  },

  gradientLine: {
    width: '50%',
    height: 2,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: '#FF7A00',
  },

  infoBox: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
  },

  label: {
    color: '#888888',
    fontSize: CARD_WIDTH * 0.009,
    letterSpacing: 2,
    marginBottom: 3,
  },

  value: {
    color: '#FFFFFF',
    fontSize: CARD_WIDTH * 0.015,
    fontWeight: '500',
  },

  statsContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
    marginBottom: 8,
  },

  statsLabel: {
    color: '#FF8A00',
    fontSize: CARD_WIDTH * 0.009,
    letterSpacing: 2,
    marginRight: 8,
  },

  statsValue: {
    color: '#FFFFFF',
    fontSize: CARD_WIDTH * 0.02,
    fontWeight: '700',
  },

  cardType: {
    marginTop: 15,
    color: '#FF8A00',
    fontSize: CARD_WIDTH * 0.011,
    letterSpacing: 4,
  },

  qrSection: {
    position: 'absolute',
    right: '7%',
    top: '25%',
    width: '28%',
    alignItems: 'center',
  },

  scanTitle: {
    color: '#FFFFFF',
    fontSize: CARD_WIDTH * 0.012,
    letterSpacing: 4,
  },

  future: {
    color: '#FF4D8D',
    fontSize: CARD_WIDTH * 0.015,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 15,
  },

  qrContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#00BFFF',
  },

  invite: {
    marginTop: 16,
    fontSize: CARD_WIDTH * 0.012,
    letterSpacing: 2,
    fontWeight: '600',
  },

});
