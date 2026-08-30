import React, { forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const CARD_WIDTH = Math.min(width - 32, 350);
const CARD_HEIGHT = CARD_WIDTH * 0.68;

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

          {/* Glowing divider (chevron) */}
          <Path
            d={`M ${CARD_WIDTH * 0.6} 0 L ${CARD_WIDTH * 0.72} ${CARD_HEIGHT * 0.5} L ${CARD_WIDTH * 0.6} ${CARD_HEIGHT}`}
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

        {/* User information */}
        <View style={styles.userSection}>

          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {name.toUpperCase()}
          </Text>

          <View style={[styles.gradientLine, { backgroundColor: colors.primary }]} />

          <View style={styles.infoBox}>
            <View style={[styles.infoIconWrap, { borderColor: colors.primary }]}>
              <Ionicons name="person-outline" size={CARD_WIDTH * 0.028} color={colors.primary} />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.label}>
                USERNAME
              </Text>
              <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">
                @{username.replace('@', '')}
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconWrap, { borderColor: colors.quaternary }]}>
              <Ionicons name="mail-outline" size={CARD_WIDTH * 0.028} color={colors.quaternary} />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.label}>
                EMAIL
              </Text>
              <Text
                style={styles.value}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {email}
              </Text>
            </View>
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

          <View style={[styles.qrContainer, { borderColor: colors.primary }]}>
            <QRCode
              value={referralUrl}
              size={CARD_WIDTH * 0.17}
              backgroundColor="#FFFFFF"
              color="#000000"
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

  userSection: {
    position: 'absolute',
    left: '7%',
    top: '26%',
    width: '52%',
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
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: '#FF7A00',
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },

  infoIconWrap: {
    width: CARD_WIDTH * 0.06,
    height: CARD_WIDTH * 0.06,
    borderRadius: CARD_WIDTH * 0.03,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },

  infoTextWrap: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 4,
    marginBottom: 4,
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
    marginTop: 6,
    color: '#FF8A00',
    fontSize: CARD_WIDTH * 0.011,
    letterSpacing: 4,
  },

  qrSection: {
    position: 'absolute',
    right: '5%',
    bottom: '6%',
    width: '30%',
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
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
  },

  invite: {
    marginTop: 16,
    fontSize: CARD_WIDTH * 0.012,
    letterSpacing: 2,
    fontWeight: '600',
  },

});
