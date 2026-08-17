import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import giftCardAPI, { GiftCardDesign } from '../services/giftCardAPI';

type RootStackParamList = {
  RecipientSelection: { amount: number; designId: string };
};

type RouteParams = {
  GiftCardDesignSelection: { amount: number };
};

const GiftCardDesignSelection: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RouteParams>>();
  const { amount } = route.params;
  
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Design</Text>
        <Text style={styles.subtitle}>Amount: {amount} FRETI</Text>
      </View>

      <View style={styles.designGrid}>
        {designs.map((design) => (
          <TouchableOpacity
            key={design.id}
            style={[
              styles.designCard,
              selectedDesign === design.id && styles.selectedDesignCard
            ]}
            onPress={() => setSelectedDesign(design.id)}
          >
            <Image 
              source={{ uri: design.preview_url }} 
              style={styles.designImage}
              resizeMode="cover"
            />
            <View style={styles.designInfo}>
              <Text style={styles.designName}>{design.name}</Text>
              {selectedDesign === design.id && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>✓ Selected</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.continueButton}
        onPress={handleContinue}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#4CAF50',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
  },
  designGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  designCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedDesignCard: {
    borderColor: '#4CAF50',
  },
  designImage: {
    width: '100%',
    height: 150,
  },
  designInfo: {
    padding: 15,
    alignItems: 'center',
  },
  designName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginTop: 10,
  },
  selectedBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GiftCardDesignSelection;
