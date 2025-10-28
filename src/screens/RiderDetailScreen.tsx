import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  riderProfileAPI,
  RiderProfile,
  VehicleType,
  VehicleCondition,
  ServicePricing,
  OperatingHours,
} from '../services/riderProfileAPI';
import * as ImagePicker from 'expo-image-picker';

type TabType = 'vehicle' | 'pricing' | 'availability' | 'stats';

export default function RiderDetailScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('vehicle');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [profileWithStats, setProfileWithStats] = useState<any>(null);
  
  // Form states
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.BIKE);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [capacityWeight, setCapacityWeight] = useState('');
  const [capacityVolume, setCapacityVolume] = useState('');
  const [vehicleCondition, setVehicleCondition] = useState<VehicleCondition>(VehicleCondition.GOOD);
  const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([]);
  
  const [servicePricing, setServicePricing] = useState<ServicePricing>({
    intracity: { enabled: true, base_price: 2.0, per_km_rate: 0.5 },
    intercity: { enabled: true, base_price: 5.0, per_km_rate: 1.0 },
    interstate: { enabled: false, base_price: 10.0, per_km_rate: 2.0 },
    express: { enabled: false, base_price: 5.0, per_km_rate: 1.5 },
    cargo: { enabled: false, custom_price: null },
    shipping: { enabled: false, custom_price: null },
    food: { enabled: false, base_price: 2.0, per_km_rate: 0.5 },
    grocery: { enabled: false, base_price: 3.0, per_km_rate: 0.75 },
  });
  
  const [promisedDeliveryTime, setPromisedDeliveryTime] = useState('');
  const [deliveryPromiseMessage, setDeliveryPromiseMessage] = useState('');
  const [maxDeliveryDistance, setMaxDeliveryDistance] = useState('10');
  const [operatingHours, setOperatingHours] = useState<OperatingHours>({
    monday: { start: '08:00', end: '20:00' },
    tuesday: { start: '08:00', end: '20:00' },
    wednesday: { start: '08:00', end: '20:00' },
    thursday: { start: '08:00', end: '20:00' },
    friday: { start: '08:00', end: '20:00' },
    saturday: { start: '09:00', end: '18:00' },
    sunday: { start: '09:00', end: '18:00' },
  });
  
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await riderProfileAPI.getRiderProfile();
      
      if (data) {
        setProfile(data);
        populateFormFromProfile(data);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load rider profile');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await riderProfileAPI.getRiderProfileWithStats();
      setProfileWithStats(data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    }
  };

  const populateFormFromProfile = (data: RiderProfile) => {
    setVehicleType(data.vehicle_type);
    setVehicleMake(data.vehicle_make || '');
    setVehicleModel(data.vehicle_model || '');
    setVehicleYear(data.vehicle_year?.toString() || '');
    setVehicleColor(data.vehicle_color || '');
    setLicensePlate(data.license_plate || '');
    setCapacityWeight(data.vehicle_capacity_weight?.toString() || '');
    setCapacityVolume(data.vehicle_capacity_volume?.toString() || '');
    setVehicleCondition(data.vehicle_condition);
    setVehiclePhotos(data.vehicle_photos || []);
    setServicePricing(data.service_pricing);
    setPromisedDeliveryTime(data.promised_delivery_time?.toString() || '');
    setDeliveryPromiseMessage(data.delivery_promise_message || '');
    setMaxDeliveryDistance(data.max_delivery_distance?.toString() || '10');
    setOperatingHours(data.operating_hours);
    setIsOnline(data.is_online);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const data: any = {
        vehicle_type: vehicleType,
        vehicle_make: vehicleMake || undefined,
        vehicle_model: vehicleModel || undefined,
        vehicle_year: vehicleYear ? parseInt(vehicleYear) : undefined,
        vehicle_color: vehicleColor || undefined,
        license_plate: licensePlate || undefined,
        vehicle_capacity_weight: capacityWeight ? parseFloat(capacityWeight) : undefined,
        vehicle_capacity_volume: capacityVolume ? parseFloat(capacityVolume) : undefined,
        vehicle_condition: vehicleCondition,
        vehicle_photos: vehiclePhotos,
        service_pricing: servicePricing,
        promised_delivery_time: promisedDeliveryTime ? parseInt(promisedDeliveryTime) : undefined,
        delivery_promise_message: deliveryPromiseMessage || undefined,
        max_delivery_distance: maxDeliveryDistance ? parseInt(maxDeliveryDistance) : 10,
        operating_hours: operatingHours,
      };

      let updatedProfile;
      if (profile) {
        updatedProfile = await riderProfileAPI.updateRiderProfile(data);
      } else {
        updatedProfile = await riderProfileAPI.createRiderProfile(data);
      }

      setProfile(updatedProfile);
      Alert.alert('Success', profile ? 'Profile updated successfully' : 'Profile created successfully');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOnline = async (value: boolean) => {
    try {
      setIsOnline(value);
      const updatedProfile = await riderProfileAPI.toggleOnlineStatus(value);
      setProfile(updatedProfile);
      Alert.alert('Status Updated', `You are now ${value ? 'online' : 'offline'}`);
    } catch (error: any) {
      console.error('Error toggling online status:', error);
      setIsOnline(!value); // Revert on error
      Alert.alert('Error', 'Failed to update online status');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - vehiclePhotos.length,
      });

      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setVehiclePhotos([...vehiclePhotos, ...newPhotos].slice(0, 5));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setVehiclePhotos(vehiclePhotos.filter((_, i) => i !== index));
  };

  const getVehicleIcon = (type: VehicleType) => {
    switch (type) {
      case VehicleType.WHEELBARROW: return 'cart-outline';
      case VehicleType.BIKE: return 'bicycle';
      case VehicleType.CAR: return 'car-sport';
      case VehicleType.VAN: return 'bus';
      case VehicleType.TRUCK: return 'car-outline';
      default: return 'bicycle';
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'intracity': return 'location';
      case 'intercity': return 'navigate';
      case 'interstate': return 'airplane';
      case 'express': return 'flash';
      case 'cargo': return 'cube';
      case 'shipping': return 'mail';
      case 'food': return 'restaurant';
      case 'grocery': return 'basket';
      default: return 'location';
    }
  };

  const renderVehicleTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Vehicle Type *</Text>
      <View style={styles.vehicleTypeGrid}>
        {Object.values(VehicleType).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.vehicleTypeCard,
              vehicleType === type && styles.vehicleTypeCardActive,
            ]}
            onPress={() => setVehicleType(type)}
          >
            <Ionicons
              name={getVehicleIcon(type) as any}
              size={32}
              color={vehicleType === type ? '#3498DB' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[
              styles.vehicleTypeText,
              vehicleType === type && styles.vehicleTypeTextActive,
            ]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Vehicle Details</Text>
      <TextInput
        style={styles.input}
        placeholder="Make (e.g., Honda, Toyota)"
        value={vehicleMake}
        onChangeText={setVehicleMake}
      />
      <TextInput
        style={styles.input}
        placeholder="Model (e.g., Civic, Corolla)"
        value={vehicleModel}
        onChangeText={setVehicleModel}
      />
      <TextInput
        style={styles.input}
        placeholder="Year (e.g., 2020)"
        value={vehicleYear}
        onChangeText={setVehicleYear}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Color"
        value={vehicleColor}
        onChangeText={setVehicleColor}
      />
      <TextInput
        style={styles.input}
        placeholder="License Plate"
        value={licensePlate}
        onChangeText={setLicensePlate}
      />

      <Text style={styles.sectionTitle}>Capacity</Text>
      <TextInput
        style={styles.input}
        placeholder="Weight Capacity (kg)"
        value={capacityWeight}
        onChangeText={setCapacityWeight}
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Volume Capacity (m³)"
        value={capacityVolume}
        onChangeText={setCapacityVolume}
        keyboardType="decimal-pad"
      />

      <Text style={styles.sectionTitle}>Condition</Text>
      <View style={styles.conditionRow}>
        {Object.values(VehicleCondition).map((condition) => (
          <TouchableOpacity
            key={condition}
            style={[
              styles.conditionButton,
              vehicleCondition === condition && styles.conditionButtonActive,
            ]}
            onPress={() => setVehicleCondition(condition)}
          >
            <Text style={[
              styles.conditionText,
              vehicleCondition === condition && styles.conditionTextActive,
            ]}>
              {condition.charAt(0).toUpperCase() + condition.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Vehicle Photos (Max 5)</Text>
      <View style={styles.photosContainer}>
        {vehiclePhotos.map((photo, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => handleRemovePhoto(index)}
            >
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
        {vehiclePhotos.length < 5 && (
          <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImage}>
            <Ionicons name="camera" size={32} color="#3498DB" />
            <Text style={styles.addPhotoText}>Tap to Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Service Categories & Pricing</Text>
      <Text style={styles.sectionSubtitle}>
        Enable services you offer and set your pricing
      </Text>

      {Object.entries(servicePricing).map(([key, value]) => (
        <View key={key} style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceHeaderLeft}>
              <Ionicons name={getServiceIcon(key) as any} size={24} color="#3498DB" />
              <Text style={styles.serviceName}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </View>
            <Switch
              value={value?.enabled || false}
              onValueChange={(enabled) =>
                setServicePricing({ ...servicePricing, [key]: { ...value, enabled } })
              }
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#3498DB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {value?.enabled && (
            <View style={styles.servicePricing}>
              {key === 'cargo' || key === 'shipping' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Custom Price (₣)"
                  value={value.custom_price?.toString() || ''}
                  onChangeText={(text) =>
                    setServicePricing({
                      ...servicePricing,
                      [key]: { ...value, custom_price: text ? parseFloat(text) : null },
                    })
                  }
                  keyboardType="decimal-pad"
                />
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Base Price (₣)"
                    value={value.base_price?.toString() || ''}
                    onChangeText={(text) =>
                      setServicePricing({
                        ...servicePricing,
                        [key]: { ...value, base_price: text ? parseFloat(text) : 0 },
                      })
                    }
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Per KM Rate (₣)"
                    value={value.per_km_rate?.toString() || ''}
                    onChangeText={(text) =>
                      setServicePricing({
                        ...servicePricing,
                        [key]: { ...value, per_km_rate: text ? parseFloat(text) : 0 },
                      })
                    }
                    keyboardType="decimal-pad"
                  />
                </>
              )}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderAvailabilityTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Delivery Promise</Text>
      <TextInput
        style={styles.input}
        placeholder="Promised Delivery Time (minutes)"
        value={promisedDeliveryTime}
        onChangeText={setPromisedDeliveryTime}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Promise Message (e.g., Lightning fast delivery!)"
        value={deliveryPromiseMessage}
        onChangeText={setDeliveryPromiseMessage}
        maxLength={100}
      />
      <Text style={styles.characterCount}>{deliveryPromiseMessage.length}/100</Text>

      <Text style={styles.sectionTitle}>Max Delivery Distance</Text>
      <TextInput
        style={styles.input}
        placeholder="Max Distance (km)"
        value={maxDeliveryDistance}
        onChangeText={setMaxDeliveryDistance}
        keyboardType="numeric"
      />

      <Text style={styles.sectionTitle}>Operating Hours</Text>
      <Text style={styles.sectionSubtitle}>Set your working hours for each day</Text>
      {Object.entries(operatingHours).map(([day, hours]) => (
        <View key={day} style={styles.dayRow}>
          <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
          <View style={styles.timeInputs}>
            <TextInput
              style={styles.timeInput}
              placeholder="08:00"
              value={hours?.start || ''}
              onChangeText={(text) =>
                setOperatingHours({
                  ...operatingHours,
                  [day]: { ...hours, start: text },
                })
              }
            />
            <Text style={styles.timeSeparator}>-</Text>
            <TextInput
              style={styles.timeInput}
              placeholder="20:00"
              value={hours?.end || ''}
              onChangeText={(text) =>
                setOperatingHours({
                  ...operatingHours,
                  [day]: { ...hours, end: text },
                })
              }
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderStatsTab = () => {
    if (!profileWithStats) {
      loadStats();
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      );
    }

    const stats = profileWithStats.stats;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="bicycle" size={32} color="#3498DB" />
            <Text style={styles.statValue}>{stats.total_deliveries}</Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="star" size={32} color="#F39C12" />
            <Text style={styles.statValue}>{stats.rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash" size={32} color="#27AE60" />
            <Text style={styles.statValue}>₣{stats.total_earnings.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="shield-checkmark" size={32} color="#3498DB" />
            <Text style={styles.statValue}>{stats.trust_score}</Text>
            <Text style={styles.statLabel}>Trust Score</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rider Profile</Text>
        <View style={styles.onlineToggle}>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#27AE60' }}
            thumbColor="#FFFFFF"
          />
          <Text style={[styles.onlineText, isOnline && styles.onlineTextActive]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Profile Completion */}
      {profile && (
        <View style={styles.completionContainer}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionText}>Profile Completion</Text>
            <Text style={styles.completionPercentage}>{profile.profile_completion}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${profile.profile_completion}%` }]} />
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicle' && styles.tabActive]}
          onPress={() => setActiveTab('vehicle')}
        >
          <Ionicons
            name="car-sport"
            size={20}
            color={activeTab === 'vehicle' ? '#3498DB' : 'rgba(255,255,255,0.4)'}
          />
          <Text style={[styles.tabText, activeTab === 'vehicle' && styles.tabTextActive]}>
            Vehicle
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pricing' && styles.tabActive]}
          onPress={() => setActiveTab('pricing')}
        >
          <Ionicons
            name="pricetag"
            size={20}
            color={activeTab === 'pricing' ? '#3498DB' : 'rgba(255,255,255,0.4)'}
          />
          <Text style={[styles.tabText, activeTab === 'pricing' && styles.tabTextActive]}>
            Pricing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'availability' && styles.tabActive]}
          onPress={() => setActiveTab('availability')}
        >
          <Ionicons
            name="time"
            size={20}
            color={activeTab === 'availability' ? '#3498DB' : 'rgba(255,255,255,0.4)'}
          />
          <Text style={[styles.tabText, activeTab === 'availability' && styles.tabTextActive]}>
            Availability
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Ionicons
            name="stats-chart"
            size={20}
            color={activeTab === 'stats' ? '#3498DB' : 'rgba(255,255,255,0.4)'}
          />
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            Stats
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'vehicle' && renderVehicleTab()}
      {activeTab === 'pricing' && renderPricingTab()}
      {activeTab === 'availability' && renderAvailabilityTab()}
      {activeTab === 'stats' && renderStatsTab()}

      {/* Save Button */}
      {activeTab !== 'stats' && (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlineText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  onlineTextActive: {
    color: '#27AE60',
  },
  completionContainer: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  completionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  completionPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498DB',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3498DB',
  },
  tabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#3498DB',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  vehicleTypeCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vehicleTypeCardActive: {
    borderColor: '#3498DB',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  vehicleTypeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  vehicleTypeTextActive: {
    color: '#3498DB',
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#E74C3C',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  conditionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  conditionButtonActive: {
    borderColor: '#3498DB',
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  conditionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  conditionTextActive: {
    color: '#3498DB',
    fontWeight: '600',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#E74C3C',
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: '#3498DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 12,
    color: '#3498DB',
  },
  serviceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  servicePricing: {
    marginTop: 12,
    gap: 8,
  },
  pricingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
    borderRadius: 6,
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    color: '#F39C12',
    flex: 1,
  },
  characterCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
    marginTop: -8,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    width: 100,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    width: 70,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
    fontSize: 14,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  timeSeparator: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498DB',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

