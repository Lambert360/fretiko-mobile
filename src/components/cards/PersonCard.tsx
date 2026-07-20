import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AdaptiveText from '../AdaptiveText';

export interface PersonData {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  location?: string;
  trustScore?: number;
  isOnline?: boolean;
  verified?: boolean;
  specialty?: string;
  followers?: string | number;
  mutualConnections?: number;
  recentActivity?: string;
  // Media content
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaAspectRatio?: 'landscape' | 'portrait' | 'square';
  // Social metrics
  posts?: number;
  following?: number;
  engagementRate?: number;
}

interface PersonCardProps {
  person: PersonData;
  variant?: 'featured' | 'compact' | 'trending';
  onPress?: (person: PersonData) => void;
  onConnect?: (person: PersonData) => void;
}

export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  variant = 'featured',
  onPress,
  onConnect,
}) => {
  // Safety check for undefined person
  if (!person) {
    return null;
  }
  const getMediaHeight = () => {
    if (!person?.mediaUrl) return 200;
    
    switch (person?.mediaAspectRatio) {
      case 'portrait': return 240;
      case 'landscape': return 160;
      case 'square': return 200;
      default: return 200;
    }
  };

  const renderMedia = () => {
    if (!person?.mediaUrl) {
      return (
        <Image 
          source={{ 
            uri: person?.avatar || `https://picsum.photos/400/400?random=${person?.id || 'default'}` 
          }} 
          style={[styles.mediaContent, { height: getMediaHeight() }]} 
        />
      );
    }

    // For now, handle as image. In real app, add video support
    return (
      <View style={[styles.mediaContainer, { height: getMediaHeight() }]}>
        <Image 
          source={{ uri: person?.mediaUrl || '' }} 
          style={styles.mediaContent}
          resizeMode={person?.mediaAspectRatio === 'landscape' ? 'cover' : 'cover'}
        />
        {person?.mediaType === 'video' && (
          <View style={styles.videoOverlay}>
            <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </View>
    );
  };

  const renderFeaturedCard = () => (
    <TouchableOpacity style={styles.featuredCard} onPress={() => onPress?.(person)}>
      <View style={styles.mediaWrapper}>
        {renderMedia()}
        
        {/* Overlay badges */}
        {person?.isOnline && <View style={styles.onlineIndicator} />}
        {!!person?.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        )}
        
        {/* Engagement overlay for video/special content */}
        {!!person?.engagementRate && (
          <View style={styles.engagementOverlay}>
            <Ionicons name="eye" size={12} color="#FFFFFF" />
            <Text style={styles.engagementText}>{String(person?.engagementRate)}K</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <AdaptiveText style={styles.personName} baseFontSize={18} maxChars={18} numberOfLines={1}>
            {person?.firstName && person?.lastName 
              ? `${person?.firstName} ${person?.lastName}` 
              : person?.username}
          </AdaptiveText>
          {!!person?.trustScore && (
            <View style={styles.trustScore}>
              <Ionicons name="shield-checkmark" size={12} color="#27AE60" />
              <Text style={styles.trustScoreText}>{String(person?.trustScore)}</Text>
            </View>
          )}
        </View>
        
        <AdaptiveText style={styles.username} baseFontSize={14} minFontSize={10} maxChars={18} numberOfLines={1}>@{person?.username}</AdaptiveText>
        
        {!!person?.specialty && (
          <Text style={styles.specialty}>{person?.specialty}</Text>
        )}
        
        {!!person?.location && (
          <Text style={styles.location}>
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            {' ' + person?.location}
          </Text>
        )}

        <View style={styles.statsRow}>
          {!!person?.followers && (
            <Text style={styles.statText}>
              {String(person?.followers)} followers
            </Text>
          )}
          {!!person?.mutualConnections && person?.mutualConnections > 0 && (
            <Text style={styles.mutualText}>
              {person?.mutualConnections} mutual
            </Text>
          )}
        </View>

        {person?.recentActivity && (
          <Text style={styles.activity}>{person?.recentActivity}</Text>
        )}

        {onConnect && (
          <TouchableOpacity 
            style={styles.connectButton} 
            onPress={() => onConnect(person)}
          >
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCompactCard = () => (
    <TouchableOpacity style={styles.compactCard} onPress={() => onPress?.(person)}>
      <Image 
        source={{ 
          uri: person?.avatar || `https://picsum.photos/60/60?random=${person?.id || 'default'}` 
        }} 
        style={styles.compactAvatar} 
      />
      <View style={styles.compactContent}>
        <View style={styles.compactHeader}>
          <AdaptiveText style={styles.compactName} baseFontSize={16} maxChars={16} numberOfLines={1}>
            {person?.firstName && person?.lastName 
              ? `${person?.firstName} ${person?.lastName}` 
              : person?.username}
          </AdaptiveText>
          {!!person?.isOnline && <View style={styles.onlineIndicatorSmall} />}
        </View>
        <AdaptiveText style={styles.compactUsername} baseFontSize={14} minFontSize={10} maxChars={18} numberOfLines={1}>@{person?.username}</AdaptiveText>
        {!!person?.location && (
          <Text style={styles.compactLocation}>{person?.location}</Text>
        )}
      </View>
      {!!onConnect && (
        <TouchableOpacity 
          style={styles.compactConnectButton} 
          onPress={() => onConnect(person)}
        >
          <Text style={styles.compactConnectText}>Connect</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderTrendingCard = () => (
    <TouchableOpacity style={styles.trendingCard} onPress={() => onPress?.(person)}>
      <Image 
        source={{ 
          uri: person?.avatar || `https://picsum.photos/40/40?random=${person?.id || 'default'}` 
        }} 
        style={styles.trendingAvatar} 
      />
      <View style={styles.trendingContent}>
        <View style={styles.trendingHeader}>
          <AdaptiveText style={styles.trendingUsername} baseFontSize={16} maxChars={15} numberOfLines={1}>@{person?.username}</AdaptiveText>
          {!!person?.engagementRate && (
            <View style={styles.growthBadge}>
              <Text style={styles.growthText}>+{String(person?.engagementRate)}%</Text>
            </View>
          )}
        </View>
        {!!person?.followers && (
          <Text style={styles.trendingFollowers}>
            {String(person?.followers)} followers
          </Text>
        )}
        {!!person?.location && (
          <Text style={styles.trendingLocation}>{person?.location}</Text>
        )}
        {!!person?.recentActivity && (
          <Text style={styles.trendingActivity}>{person?.recentActivity}</Text>
        )}
      </View>
      <TouchableOpacity style={styles.optionsButton}>
        <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  switch (variant) {
    case 'compact': return renderCompactCard();
    case 'trending': return renderTrendingCard();
    default: return renderFeaturedCard();
  }
};

const styles = StyleSheet.create({
  // Featured card styles
  featuredCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mediaWrapper: {
    position: 'relative',
  },
  mediaContainer: {
    position: 'relative',
  },
  mediaContent: {
    width: '100%',
    resizeMode: 'cover',
  },
  videoOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  onlineIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#27AE60',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  engagementOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  engagementText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  personName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  trustScore: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trustScoreText: {
    color: '#27AE60',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  username: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  specialty: {
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  location: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  statText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  mutualText: {
    color: '#9C27B0',
    fontSize: 12,
    fontWeight: '500',
  },
  activity: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  connectButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Compact card styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  compactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  compactContent: {
    flex: 1,
    marginLeft: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  onlineIndicatorSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27AE60',
    marginLeft: 8,
  },
  compactUsername: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 2,
  },
  compactLocation: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  compactConnectButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  compactConnectText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Trending card styles
  trendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  trendingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
  trendingContent: {
    flex: 1,
  },
  trendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  trendingUsername: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  growthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
  },
  growthText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  trendingFollowers: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 2,
  },
  trendingLocation: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginBottom: 2,
  },
  trendingActivity: {
    color: '#1DA1F2',
    fontSize: 11,
    fontWeight: '500',
  },
  optionsButton: {
    padding: 8,
  },
});