import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { walletAPI } from '../services/walletAPI';
import { riderAPI, InterstateCompanyOption } from '../services/riderAPI';
import { riderSelectionBridge } from '../utils/riderSelectionBridge';

interface InterstateDeliveryScreenProps {
  navigation: any;
  route: {
    params: {
      pickupLocation: { state?: string; country?: string; city?: string };
      deliveryLocation: { state?: string; country?: string; city?: string };
      callbackKey: string;
    };
  };
}

export interface InterstateCompanySelection {
  companyId: string;
  companyName: string;
  deliveryPrice: number;
  estimatedDeliveryDays: number;
  isInternational: boolean;
}

const InterstateDeliveryScreen: React.FC<InterstateDeliveryScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { pickupLocation, deliveryLocation, callbackKey } = route.params;

  const [companies, setCompanies] = useState<InterstateCompanyOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const options = await riderAPI.getInterstateOptions({ pickupLocation, deliveryLocation });
      setCompanies(options);
    } catch (error) {
      console.error('Error loading interstate delivery options:', error);
      Alert.alert('Error', 'Failed to load delivery companies');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = (company: InterstateCompanyOption) => {
    // Simple flat pricing model: base price only for now (no live distance calc on mobile yet)
    const deliveryPrice = company.basePrice;
    const estimatedDeliveryDays = company.estimatedDeliveryDaysMax;

    Alert.alert(
      'Confirm Delivery Company',
      `Select ${company.companyName} for ${walletAPI.formatFreti(deliveryPrice)}? Estimated delivery: ${company.estimatedDeliveryDaysMin}-${company.estimatedDeliveryDaysMax} day(s).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select',
          onPress: () => {
            const selection: InterstateCompanySelection = {
              companyId: company.companyId,
              companyName: company.companyName,
              deliveryPrice,
              estimatedDeliveryDays,
              isInternational: company.isInternational,
            };
            riderSelectionBridge.resolve(callbackKey, selection);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Finding delivery partners...</Text>
      </View>
    );
  }

  if (companies.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.header, { paddingTop: insets.top, position: 'absolute', top: 0, left: 0, right: 0 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Interstate Delivery</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.emptyStateContainer}>
          <Ionicons name="bus-outline" size={64} color="#444" />
          <Text style={styles.emptyStateTitle}>No delivery partners available</Text>
          <Text style={styles.emptyStateSubtitle}>
            No logistics company currently covers this route. Please try again later or contact support.
          </Text>
          <TouchableOpacity style={styles.emptyStateButton} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyStateButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Interstate Delivery</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={18} color="#3498DB" />
        <Text style={styles.infoBannerText}>
          This order requires interstate/international delivery. A verified logistics partner will handle pickup and delivery, with a PIN required for handoff safety.
        </Text>
      </View>

      <ScrollView style={styles.companiesContainer} showsVerticalScrollIndicator={false}>
        {companies.map((company) => (
          <TouchableOpacity
            key={company.companyId}
            style={styles.companyCard}
            onPress={() => handleSelectCompany(company)}
          >
            <View style={styles.companyHeader}>
              <View style={styles.companyIcon}>
                <Ionicons name="business" size={24} color="#3498DB" />
              </View>
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{company.companyName}</Text>
                <Text style={styles.companyMeta}>
                  {company.isInternational ? 'International Delivery' : 'Interstate Delivery'} • {company.estimatedDeliveryDaysMin}-{company.estimatedDeliveryDaysMax} day(s)
                </Text>
              </View>
              <View style={styles.companyPricing}>
                <Text style={styles.companyPrice}>{walletAPI.formatFreti(company.basePrice)}</Text>
                <Text style={styles.companyPriceLabel}>base fee</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    margin: 16,
    padding: 12,
    borderRadius: 12,
  },
  infoBannerText: {
    color: '#CCC',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  companiesContainer: {
    flex: 1,
    padding: 16,
  },
  companyCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  companyMeta: {
    color: '#999',
    fontSize: 12,
  },
  companyPricing: {
    alignItems: 'flex-end',
  },
  companyPrice: {
    color: '#27AE60',
    fontSize: 16,
    fontWeight: 'bold',
  },
  companyPriceLabel: {
    color: '#999',
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyStateTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyStateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InterstateDeliveryScreen;
