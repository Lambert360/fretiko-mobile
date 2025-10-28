import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface ServiceData {
  id: string;
  title: string;
  price: number;
  image?: string;
  provider?: {
    id: string;
    name: string;
    avatar?: string;
    rating?: number;
  };
  category?: string;
  duration?: string;
  priceType?: 'fixed' | 'hourly' | 'starting_at' | 'negotiable';
}

interface ServiceMessageCardProps {
  service: ServiceData;
  isCurrentUser: boolean;
  messageText?: string;
}

const ServiceMessageCard: React.FC<ServiceMessageCardProps> = ({ service, isCurrentUser, messageText }) => {
  const navigation = useNavigation<any>();

  const handleViewService = () => {
    navigation.navigate('ServiceDetails', { serviceId: service.id });
  };

  const getPriceDisplay = () => {
    const price = `₦${service.price.toLocaleString()}`;
    
    switch (service.priceType) {
      case 'hourly':
        return `${price}/hour`;
      case 'starting_at':
        return `From ${price}`;
      case 'negotiable':
        return `${price} (Negotiable)`;
      default:
        return price;
    }
  };

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      {/* Service Reference Card - Tappable */}
      <TouchableOpacity
        style={styles.serviceReferenceCard}
        onPress={handleViewService}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="briefcase" size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.serviceLabel}>Service</Text>
          </View>
          <View style={styles.recommendBadge}>
            <Ionicons name="sparkles" size={10} color="#3498DB" />
            <Text style={styles.recommendText}>IKO</Text>
          </View>
        </View>

        {/* Service Content - Compact */}
        <View style={styles.serviceContent}>
          {/* Service Image */}
          {service.image ? (
            <Image source={{ uri: service.image }} style={styles.serviceImage} />
          ) : (
            <View style={styles.serviceImagePlaceholder}>
              <Ionicons name="briefcase-outline" size={24} color="#888" />
            </View>
          )}

          {/* Service Info */}
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName} numberOfLines={2}>
              {service.title}
            </Text>

            {service.provider?.name && (
              <View style={styles.providerRow}>
                <Ionicons name="person-outline" size={10} color="rgba(255, 255, 255, 0.5)" />
                <Text style={styles.providerName}>{service.provider.name}</Text>
                {service.provider.rating && (
                  <>
                    <Ionicons name="star" size={10} color="#FFD700" style={{ marginLeft: 4 }} />
                    <Text style={styles.rating}>{service.provider.rating.toFixed(1)}</Text>
                  </>
                )}
              </View>
            )}

            {service.category && (
              <Text style={styles.category}>{service.category}</Text>
            )}

            {/* Price */}
            <Text style={styles.priceValue}>{getPriceDisplay()}</Text>
          </View>
        </View>

        {/* Duration Badge */}
        {service.duration && (
          <View style={styles.durationBadge}>
            <Ionicons name="time-outline" size={10} color="rgba(255, 255, 255, 0.6)" />
            <Text style={styles.durationText}>{service.duration}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Message Text Below Service Card */}
      {messageText && (
        <View style={styles.messageTextContainer}>
          <Text style={styles.messageText}>{messageText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '85%',
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sentContainer: {
    alignSelf: 'flex-end',
    marginRight: 8,
    backgroundColor: '#051094',
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    backgroundColor: '#59788E',
  },
  serviceReferenceCard: {
    borderRadius: 12,
    padding: 8,
    margin: 8,
    marginBottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  recommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
  },
  recommendText: {
    color: '#3498DB',
    fontSize: 9,
    fontWeight: '600',
  },
  serviceContent: {
    flexDirection: 'row',
    gap: 8,
  },
  serviceImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  serviceImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  serviceName: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 4,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 4,
  },
  providerName: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
  },
  rating: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    marginLeft: 2,
  },
  category: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    marginBottom: 4,
  },
  priceValue: {
    color: '#27AE60',
    fontSize: 13,
    fontWeight: 'bold',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  durationText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
  },
  messageTextContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageText: {
    color: '#FFF',
    fontSize: 15,
    lineHeight: 20,
  },
});

export default ServiceMessageCard;

