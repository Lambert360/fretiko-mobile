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
            d={`M ${CARD_WIDTH * 0.6} 0 L ${CARD_WIDTH * 0.68} ${CARD_HEIGHT * 0.5} L ${CARD_WIDTH * 0.6} ${CARD_HEIGHT}`}
            fill="none"
            stroke="url(#dividerGradient)"
            strokeWidth="3"
          />
        </Svg>

        {/* Content */}
        <View style={styles.content}>

          {/* Left column */}
          <View style={styles.leftColumn}>

            {/* Logo */}
            <View>
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
            <View>
              <Text style={styles.name} numberOfLines={1}>
                {name.toUpperCase()}
              </Text>

              <View style={[styles.gradientLine, { backgroundColor: colors.primary }]} />

              <View style={styles.infoBox}>
                <View style={[styles.infoIconWrap, { borderColor: colors.primary }]}>
                  <Ionicons name="person-outline" size={11} color={colors.primary} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.label}>
                    USERNAME
                  </Text>
                  <Text style={styles.value} numberOfLines={1}>
                    @{username.replace('@', '')}
                  </Text>
                </View>
              </View>

              <View style={[styles.infoBox, { marginBottom: 0 }]}>
                <View style={[styles.infoIconWrap, { borderColor: colors.quaternary }]}>
                  <Ionicons name="mail-outline" size={11} color={colors.quaternary} />
                </View>
                <View style={styles.infoTextWrap}>
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
              </View>
            </View>

            <Text style={[styles.cardType, { color: colors.primary }]}>
              REFERRAL CARD
            </Text>

          </View>

          {/* Right column (QR) */}
          <View style={styles.rightColumn}>

            <Text style={styles.scanTitle}>
              SCAN TO JOIN
            </Text>

            <Text style={[styles.future, { color: colors.tertiary }]}>
              THE FUTURE
            </Text>

            <View style={[styles.qrContainer, { borderColor: colors.primary }]}>
              <QRCode
                value={referralUrl}
                size={CARD_WIDTH * 0.18}
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

  content: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: CARD_WIDTH * 0.06,
    paddingVertical: CARD_HEIGHT * 0.09,
  },

  leftColumn: {
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: CARD_WIDTH * 0.05,
  },

  rightColumn: {
    width: CARD_WIDTH * 0.28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -1,
  },

  logoDot: {
    color: '#FF8A00',
  },

  tagline: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 1,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3,
  },

  gradientLine: {
    width: '55%',
    height: 2,
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: '#FF7A00',
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },

  infoIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    fontSize: 7,
    letterSpacing: 1.5,
    marginBottom: 2,
  },

  value: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },

  cardType: {
    color: '#FF8A00',
    fontSize: 8,
    letterSpacing: 3,
  },

  scanTitle: {
    color: '#FFFFFF',
    fontSize: 8,
    letterSpacing: 2.5,
  },

  future: {
    color: '#FF4D8D',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 2,
    marginBottom: 8,
  },

  qrContainer: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
  },

  invite: {
    marginTop: 8,
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: '600',
  },

});
