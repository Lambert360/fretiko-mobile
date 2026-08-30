import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import giftCardAPI, { GiftCardDesign } from '../services/giftCardAPI';
import { SafeImage } from '../components/SafeImage';

type RootStackParamList = {
  RecipientSelection: { amount: number; designId: string };
};

type RouteParams = {
  GiftCardDesignSelection: { amount: number };
};

const GiftCardDesignSelection: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RouteParams, 'GiftCardDesignSelection'>>();
  const { amount } = route.params;
  const insets = useSafeAreaInsets();

  const [designs, setDesigns] = useState<GiftCardDesign[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDesigns();
  }, []);

  const loadDesigns = async () => {
    try {
      const designsData = await giftCardAPI.getGiftCardDesigns();
      setDesigns(designsData);
      if (designsData.length > 0) {
        setSelectedDesign(designsData[0].id);
      }
    } catch (error) {
      console.error('Failed to load designs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedDesign) {
      return;
    }
    navigation.navigate('RecipientSelection', { amount, designId: selectedDesign });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#F39C12" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Choose Design</Text>
          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText}>{amount.toLocaleString()} FRETI</Text>
          </View>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 24 }}>
        {designs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>No designs available right now</Text>
          </View>
        ) : (
          <View style={styles.designGrid}>
            {designs.map((design) => {
              const isSelected = selectedDesign === design.id;
              return (
                <TouchableOpacity
                  key={design.id}
                  style={[styles.designCard, isSelected && styles.designCardSelected]}
                  onPress={() => setSelectedDesign(design.id)}
                  activeOpacity={0.85}
                >
                  <SafeImage
                    source={{ uri: design.preview_url }}
                    style={styles.designImage}
                    resizeMode="cover"
                    fallbackText="Design"
                  />
                  {isSelected && (
                    <View style={styles.selectedOverlay}>
                      <View style={styles.selectedCheck}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    </View>
                  )}
                  <View style={styles.designInfo}>
                    <Text style={styles.designName} numberOfLines={1}>
                      {design.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.continueButton, !selectedDesign && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedDesign}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amountBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  amountBadgeText: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  designGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  designCard: {
    width: '46%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  designCardSelected: {
    borderColor: '#F39C12',
  },
  designImage: {
    width: '100%',
    height: 140,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  selectedCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F39C12',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  designInfo: {
    padding: 12,
    alignItems: 'center',
  },
  designName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    color: '#666666',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#F39C12',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default GiftCardDesignSelection;
