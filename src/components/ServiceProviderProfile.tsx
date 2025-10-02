import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface ServiceProvider {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  rating: number;
  totalJobs: number;
  completedJobs: number;
  responseTime: string;
  joinDate: string;
  isVerified: boolean;
  badges: string[];
  specialties: string[];
  portfolio: {
    id: string;
    image: string;
    title: string;
    description: string;
  }[];
}

interface ServiceProviderProfileProps {
  providerId: string;
  visible: boolean;
  onClose: () => void;
  onMessage?: (providerId: string) => void;
  onCall?: (providerId: string) => void;
}

export const ServiceProviderProfile: React.FC<ServiceProviderProfileProps> = ({
  providerId,
  visible,
  onClose,
  onMessage,
  onCall,
}) => {
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPortfolio, setShowPortfolio] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      loadProviderProfile();
      startAnimations();
    }
  }, [visible, providerId]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadProviderProfile = async () => {
    try {
      // TODO: Replace with actual API call
      // const providerData = await providersAPI.getProvider(providerId);
      
      // Mock data for now
      const mockProvider: ServiceProvider = {
        id: providerId,
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.com',
        phone: '+234 801 234 5678',
        avatar: 'https://via.placeholder.com/150',
        bio: 'Professional hair stylist with over 5 years of experience. Specialized in modern cuts, coloring, and styling for all hair types.',
        location: 'Lagos, Victoria Island',
        rating: 4.8,
        totalJobs: 250,
        completedJobs: 245,
        responseTime: '< 2 hours',
        joinDate: '2020-03-15',
        isVerified: true,
        badges: ['Top Rated', 'Quick Response', '100+ Jobs'],
        specialties: ['Hair Styling', 'Hair Coloring', 'Hair Treatment', 'Bridal Makeup'],
        portfolio: [
          {
            id: '1',
            image: 'https://via.placeholder.com/200x150',
            title: 'Bridal Hair & Makeup',
            description: 'Complete bridal transformation with elegant updo and natural makeup.'
          },
          {
            id: '2',
            image: 'https://via.placeholder.com/200x150',
            title: 'Modern Hair Cut',
            description: 'Trendy layered cut with highlights for a fresh modern look.'
          },
          {
            id: '3',
            image: 'https://via.placeholder.com/200x150',
            title: 'Color Transformation',
            description: 'Bold color change from dark brown to platinum blonde.'
          },
        ],
      };
      
      setProvider(mockProvider);
    } catch (error) {
      console.error('Error loading provider profile:', error);
      Alert.alert('Error', 'Failed to load provider profile');
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (badge: string, index: number) => (
    <View key={index} style={styles.badge}>
      <Text style={styles.badgeText}>{badge}</Text>
    </View>
  );

  const renderSpecialty = (specialty: string, index: number) => (
    <View key={index} style={styles.specialty}>
      <Text style={styles.specialtyText}>{specialty}</Text>
    </View>
  );

  const renderPortfolioItem = ({ item }: { item: any }) => (
    <View style={styles.portfolioItem}>
      <Image source={{ uri: item.image }} style={styles.portfolioImage} />
      <BlurView intensity={60} style={styles.portfolioOverlay}>
        <Text style={styles.portfolioTitle}>{item.title}</Text>
        <Text style={styles.portfolioDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </BlurView>
    </View>
  );

  const handleMessage = () => {
    if (onMessage && provider) {
      onMessage(provider.id);
      onClose();
    }
  };

  const handleCall = () => {
    if (onCall && provider) {
      onCall(provider.id);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <BlurView intensity={80} style={styles.modalContainer}>
        <Animated.View 
          style={[
            styles.profileContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(30,30,30,0.95)', 'rgba(0,0,0,0.9)']}
            style={styles.profileGradient}
          >
            {/* Header */}
            <View style={styles.profileHeader}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Service Provider</Text>
              <View style={styles.headerSpacer} />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading profile...</Text>
              </View>
            ) : provider ? (
              <FlatList
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <>
                    {/* Provider Info */}
                    <View style={styles.providerInfo}>
                      <View style={styles.avatarContainer}>
                        <Image 
                          source={{ uri: provider.avatar || 'https://via.placeholder.com/150' }} 
                          style={styles.avatar} 
                        />
                        {provider.isVerified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={24} color="#3498DB" />
                          </View>
                        )}
                      </View>
                      
                      <Text style={styles.providerName}>
                        {provider.firstName} {provider.lastName}
                      </Text>
                      
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.rating}>{provider.rating}</Text>
                        <Text style={styles.jobCount}>({provider.completedJobs} jobs completed)</Text>
                      </View>

                      {provider.location && (
                        <View style={styles.locationContainer}>
                          <Ionicons name="location-outline" size={16} color="#B0B0B0" />
                          <Text style={styles.locationText}>{provider.location}</Text>
                        </View>
                      )}
                    </View>

                    {/* Stats */}
                    <BlurView intensity={40} style={styles.statsContainer}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{provider.totalJobs}</Text>
                        <Text style={styles.statLabel}>Total Jobs</Text>
                      </View>
                      <View style={[styles.statItem, styles.statItemBorder]}>
                        <Text style={styles.statValue}>{provider.responseTime}</Text>
                        <Text style={styles.statLabel}>Response Time</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {Math.floor((Date.now() - new Date(provider.joinDate).getTime()) / (365 * 24 * 60 * 60 * 1000))}y
                        </Text>
                        <Text style={styles.statLabel}>Experience</Text>
                      </View>
                    </BlurView>

                    {/* Bio */}
                    {provider.bio && (
                      <View style={styles.bioContainer}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <Text style={styles.bioText}>{provider.bio}</Text>
                      </View>
                    )}

                    {/* Badges */}
                    {provider.badges.length > 0 && (
                      <View style={styles.badgesContainer}>
                        <Text style={styles.sectionTitle}>Badges</Text>
                        <View style={styles.badgesList}>
                          {provider.badges.map(renderBadge)}
                        </View>
                      </View>
                    )}

                    {/* Specialties */}
                    {provider.specialties.length > 0 && (
                      <View style={styles.specialtiesContainer}>
                        <Text style={styles.sectionTitle}>Specialties</Text>
                        <View style={styles.specialtiesList}>
                          {provider.specialties.map(renderSpecialty)}
                        </View>
                      </View>
                    )}

                    {/* Portfolio */}
                    {provider.portfolio.length > 0 && (
                      <View style={styles.portfolioContainer}>
                        <View style={styles.portfolioHeader}>
                          <Text style={styles.sectionTitle}>Portfolio</Text>
                          <TouchableOpacity onPress={() => setShowPortfolio(true)}>
                            <Text style={styles.viewAllText}>View All</Text>
                          </TouchableOpacity>
                        </View>
                        <FlatList
                          data={provider.portfolio.slice(0, 3)}
                          renderItem={renderPortfolioItem}
                          keyExtractor={(item) => item.id}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          ItemSeparatorComponent={() => <View style={styles.portfolioSeparator} />}
                        />
                      </View>
                    )}

                    {/* Contact Actions */}
                    <View style={styles.actionsContainer}>
                      <TouchableOpacity 
                        style={styles.messageButton}
                        onPress={handleMessage}
                      >
                        <BlurView intensity={60} style={styles.actionButtonBlur}>
                          <Ionicons name="chatbubble-outline" size={24} color="#3498DB" />
                          <Text style={styles.actionButtonText}>Message</Text>
                        </BlurView>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.callButton}
                        onPress={handleCall}
                      >
                        <LinearGradient
                          colors={['#3498DB', '#007AFF']}
                          style={styles.callGradient}
                        >
                          <Ionicons name="call-outline" size={24} color="#FFFFFF" />
                          <Text style={styles.callButtonText}>Call Now</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                }
                data={[]}
                renderItem={() => null}
              />
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Failed to load provider profile</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Portfolio Modal */}
        <Modal
          visible={showPortfolio}
          animationType="slide"
          transparent={true}
        >
          <BlurView intensity={80} style={styles.portfolioModal}>
            <View style={styles.portfolioModalContainer}>
              <View style={styles.portfolioModalHeader}>
                <Text style={styles.portfolioModalTitle}>Portfolio</Text>
                <TouchableOpacity onPress={() => setShowPortfolio(false)}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={provider?.portfolio || []}
                renderItem={renderPortfolioItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.portfolioRow}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </BlurView>
        </Modal>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  profileContainer: {
    maxHeight: height * 0.9,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: 'hidden',
  },
  profileGradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  
  // Header
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },

  // Provider Info
  providerInfo: {
    alignItems: 'center',
    marginBottom: 25,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(52,152,219,0.5)',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
  },
  providerName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  jobCount: {
    color: '#B0B0B0',
    fontSize: 14,
    marginLeft: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#B0B0B0',
    fontSize: 14,
    marginLeft: 4,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    color: '#3498DB',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    textAlign: 'center',
  },

  // Sections
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  // Bio
  bioContainer: {
    marginBottom: 25,
  },
  bioText: {
    color: '#B0B0B0',
    fontSize: 15,
    lineHeight: 22,
  },

  // Badges
  badgesContainer: {
    marginBottom: 25,
  },
  badgesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: 'rgba(52,152,219,0.2)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.3)',
  },
  badgeText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
  },

  // Specialties
  specialtiesContainer: {
    marginBottom: 25,
  },
  specialtiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specialty: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  specialtyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },

  // Portfolio
  portfolioContainer: {
    marginBottom: 25,
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  portfolioItem: {
    width: 150,
    height: 120,
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  portfolioOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  portfolioTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  portfolioDescription: {
    color: '#B0B0B0',
    fontSize: 10,
  },
  portfolioSeparator: {
    width: 10,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingBottom: 30,
    gap: 15,
  },
  messageButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  actionButtonBlur: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.3)',
  },
  actionButtonText: {
    color: '#3498DB',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  callButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  callGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },

  // Portfolio Modal
  portfolioModal: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  portfolioModalContainer: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 20,
    padding: 20,
    maxHeight: height * 0.8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  portfolioModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  portfolioModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  portfolioRow: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
});