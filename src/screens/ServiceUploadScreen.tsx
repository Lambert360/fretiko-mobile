import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import { servicesAPI, ServiceCategory } from '../services/servicesAPI';
import { API_BASE_URL } from '../config/api';
import * as SecureStore from 'expo-secure-store';
import DualCurrencyInput from '../components/DualCurrencyInput';
import { currencyAPI } from '../services/currencyAPI';
import LocationSelector from '../components/LocationSelector';
import { 
  Alert, 
  Dimensions, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ServiceUploadScreenProps {
  navigation: any;
}

interface ServiceMedia {
  uri: string;
  id: string;
  type: 'image' | 'video';
}

const ServiceUploadScreen = ({ navigation }: ServiceUploadScreenProps) => {
  const insets = useSafeAreaInsets();
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [fretiAmount, setFretiAmount] = useState('');
  const [localCurrency, setLocalCurrency] = useState('NGN');
  const [category, setCategory] = useState('');
  const [duration, setDuration] = useState('');
  const [media, setMedia] = useState<ServiceMedia[]>([]);
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState({
    weekdays: false,
    weekends: false,
    evenings: false,
    emergency: false
  });
  const [uploading, setUploading] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isPriceValid, setIsPriceValid] = useState(true);
  const [priceError, setPriceError] = useState<string>('');
  const [isLocationSelectorVisible, setLocationSelectorVisible] = useState(false);
  const [bookingType, setBookingType] = useState('add_to_cart');
  
  const supportedCurrencies = ['NGN', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'];

  useEffect(() => {
    loadServiceCategories();
  }, []);

  const loadServiceCategories = async () => {
    try {
      setLoadingCategories(true);
      const categories = await servicesAPI.getCategories();
      setServiceCategories(categories);
    } catch (error) {
      console.error('Error loading service categories:', error);
      Alert.alert('Error', 'Failed to load service categories. Please try again.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handlePriceValidation = (isValid: boolean, error?: string) => {
    setIsPriceValid(isValid);
    setPriceError(error || '');
  };

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
    setLocationSelectorVisible(false);
  };

  const pickMedia = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera roll permissions to add media.');
        return;
      }

      Alert.alert(
        'Select Media Type',
        'What would you like to add?',
        [
          { text: 'Photo', onPress: () => pickImages() },
          { text: 'Video', onPress: () => pickVideo() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [16, 9],
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => ({
          uri: asset.uri,
          id: Date.now().toString() + Math.random().toString(),
          type: 'image' as const
        }));
        setMedia(prev => [...prev, ...newImages].slice(0, 6)); // Max 6 media items
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.duration && asset.duration > 60000) { // 60 seconds
          Alert.alert('Video Too Long', 'Please select a video shorter than 60 seconds.');
          return;
        }

        const newVideo = {
          uri: asset.uri,
          id: Date.now().toString(),
          type: 'video' as const
        };
        setMedia(prev => [newVideo, ...prev.filter(m => m.type !== 'video')].slice(0, 6));
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const removeMedia = (mediaId: string) => {
    setMedia(prev => prev.filter(m => m.id !== mediaId));
  };

  const handleUpload = async () => {
    if (!serviceName.trim() || !description.trim() || !fretiAmount.trim() || !category) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!isPriceValid) {
      Alert.alert('Price Error', priceError || 'Please fix price validation errors.');
      return;
    }

    if (media.length === 0) {
      Alert.alert('No Media', 'Please add at least one photo or video of your service.');
      return;
    }

    if (!availability.weekdays && !availability.weekends && !availability.evenings && !availability.emergency) {
      Alert.alert('Availability', 'Please select at least one availability option.');
      return;
    }

    setUploading(true);

    try {
      console.log('📤 Starting service upload via backend...');

      const accessToken = await SecureStore.getItemAsync('accessToken');
      if (!accessToken) {
        throw new Error('User not authenticated');
      }

      // Create FormData for multipart upload
      const formData = new FormData();

      // Add media files to FormData
      media.forEach((mediaItem, index) => {
        const mimeType = mediaItem.type === 'image' ? 'image/jpeg' : 'video/mp4';
        const fileName = `service_${Date.now()}_${index}.${mediaItem.type === 'image' ? 'jpg' : 'mp4'}`;
        formData.append('media', {
          uri: mediaItem.uri,
          type: mimeType,
          name: fileName,
        } as any);
      });

      // Add service data to FormData
      formData.append('name', serviceName.trim());
      formData.append('description', description.trim());
      formData.append('base_price', fretiAmount);
      formData.append('category_id', category);
      if (duration.trim()) formData.append('duration', duration.trim());
      if (location.trim()) {
        formData.append('location', location.trim());
        formData.append('service_area', location.trim());
      }
      formData.append('availability', JSON.stringify(availability));
      formData.append('tags', JSON.stringify(tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)));
      // Services are always booking-based (schedule required)

      // Upload via backend endpoint
      const response = await fetch(`${API_BASE_URL}/services/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          // Remove Content-Type to let browser set boundary for multipart/form-data
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Service uploaded successfully via backend:', result.id);

      Alert.alert(
        'Service Listed!',
        'Your service has been successfully listed on the marketplace.',
        [
          { text: 'List Another', onPress: () => resetForm() },
          { text: 'View Services', onPress: () => navigation.navigate('Main', { screen: 'Home' }) }
        ]
      );
    } catch (error) {
      console.error('Error uploading service:', error);
      Alert.alert('Upload Failed', 'Failed to list your service. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setServiceName('');
    setDescription('');
    setLocalAmount('');
    setFretiAmount('');
    setCategory('');
    setDuration('');
    setMedia([]);
    setTags('');
    setLocation('');
    setAvailability({ weekdays: false, weekends: false, evenings: false, emergency: false });
    setBookingType('add_to_cart');
  };

  const renderCategoryItem = ({ item }: { item: ServiceCategory }) => (
    <TouchableOpacity
      style={[styles.categoryChip, category === item.id && styles.selectedCategoryChip]}
      onPress={() => setCategory(item.id)}
    >
      <Text style={[styles.categoryText, category === item.id && styles.selectedCategoryText]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderMediaItem = ({ item, index }: { item: ServiceMedia; index: number }) => (
    <View style={styles.mediaContainer}>
      {item.type === 'image' ? (
        <Image source={{ uri: item.uri }} style={styles.mediaImage} />
      ) : (
        <View style={styles.videoContainer}>
          <View style={styles.mediaVideo}>
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam" size={48} color="rgba(255,255,255,0.6)" />
              <Text style={styles.videoPlaceholderText}>Video Preview</Text>
            </View>
          </View>
          <View style={styles.videoOverlay}>
            <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
          </View>
        </View>
      )}
      <TouchableOpacity
        style={styles.removeMediaButton}
        onPress={() => removeMedia(item.id)}
      >
        <Ionicons name="close-circle" size={24} color="#E74C3C" />
      </TouchableOpacity>
      {index === 0 && (
        <View style={styles.primaryBadge}>
          <Text style={styles.primaryText}>Main</Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List Service</Text>
        <TouchableOpacity onPress={resetForm} style={styles.resetButton}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Media Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Media *</Text>
          <Text style={styles.sectionSubtitle}>Add photos and videos (max 60s) to showcase your service</Text>
          
          <FlatList
            data={[...media].reverse()}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.mediaList}
            ListHeaderComponent={
              media.length < 6 ? (
                <TouchableOpacity style={styles.addMediaButton} onPress={pickMedia}>
                  <Ionicons name="add-circle" size={32} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.addMediaText}>Add Media</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Service Name *</Text>
            <TextInput
              style={styles.textInput}
              value={serviceName}
              onChangeText={setServiceName}
              placeholder="e.g., Food delivery, House cleaning, Photography"
              placeholderTextColor="rgba(255,255,255,0.5)"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your service, experience, and what makes you special"
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              numberOfLines={4}
              maxLength={1000}
            />
          </View>

          {/* Dual Currency Pricing */}
          <View style={styles.inputGroup}>
            <DualCurrencyInput
              localCurrency={localCurrency}
              onLocalCurrencyChange={setLocalCurrency}
              localAmount={localAmount}
              fretiAmount={fretiAmount}
              onLocalAmountChange={setLocalAmount}
              onFretiAmountChange={setFretiAmount}
              title="Service Base Price *"
              placeholder="0.00"
              supportedCurrencies={supportedCurrencies}
              minAmount={0.01}
              maxAmount={100000}
              onValidationChange={handlePriceValidation}
              containerStyle={styles.priceInputContainer}
            />
            
            {/* Price Helper Text */}
            <Text style={styles.helperText}>
              Set your starting price. Clients will see this in Freti (₣). You can adjust pricing for individual bookings.
            </Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.inputLabel}>Duration</Text>
              <TextInput
                style={styles.textInput}
                value={duration}
                onChangeText={setDuration}
                placeholder="e.g., 2 hours"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            </View>
          </View>
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Category *</Text>
          <FlatList
            data={serviceCategories}
            numColumns={2}
            scrollEnabled={false}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability *</Text>
          <Text style={styles.sectionSubtitle}>When are you available to provide this service?</Text>
          
          <View style={styles.availabilityOptions}>
            <TouchableOpacity
              style={[styles.availabilityOption, availability.weekdays && styles.selectedAvailabilityOption]}
              onPress={() => setAvailability(prev => ({ ...prev, weekdays: !prev.weekdays }))}
            >
              <MaterialIcons 
                name="business-center" 
                size={24} 
                color={availability.weekdays ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.availabilityText, availability.weekdays && styles.selectedAvailabilityText]}>
                Weekdays
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.availabilityOption, availability.weekends && styles.selectedAvailabilityOption]}
              onPress={() => setAvailability(prev => ({ ...prev, weekends: !prev.weekends }))}
            >
              <MaterialIcons 
                name="weekend" 
                size={24} 
                color={availability.weekends ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.availabilityText, availability.weekends && styles.selectedAvailabilityText]}>
                Weekends
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.availabilityOption, availability.evenings && styles.selectedAvailabilityOption]}
              onPress={() => setAvailability(prev => ({ ...prev, evenings: !prev.evenings }))}
            >
              <MaterialIcons 
                name="nights-stay" 
                size={24} 
                color={availability.evenings ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.availabilityText, availability.evenings && styles.selectedAvailabilityText]}>
                Evenings
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.availabilityOption, availability.emergency && styles.selectedAvailabilityOption]}
              onPress={() => setAvailability(prev => ({ ...prev, emergency: !prev.emergency }))}
            >
              <MaterialIcons 
                name="local-hospital" 
                size={24} 
                color={availability.emergency ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.availabilityText, availability.emergency && styles.selectedAvailabilityText]}>
                Emergency
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tags (comma-separated)</Text>
            <TextInput
              style={styles.textInput}
              value={tags}
              onChangeText={setTags}
              placeholder="delivery, fast, reliable, professional"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Service Area</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setLocationSelectorVisible(true)}
            >
              <View style={styles.locationButtonContent}>
                <Ionicons name="location" size={20} color={location ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
                <Text style={[
                  styles.locationButtonText,
                  !location && styles.locationButtonPlaceholder
                ]}>
                  {location || 'Select service area'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Upload Button */}
      <View style={[styles.uploadButtonContainer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.uploadButton, uploading && styles.uploadingButton]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <Text style={styles.uploadButtonText}>Uploading & Listing...</Text>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>List Service</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Location Selector Modal */}
      <LocationSelector
        visible={isLocationSelectorVisible}
        selectedLocation={location}
        onLocationSelect={handleLocationSelect}
        onClose={() => setLocationSelectorVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 16,
  },
  mediaList: {
    paddingVertical: 8,
  },
  mediaContainer: {
    marginRight: 12,
    position: 'relative',
  },
  mediaImage: {
    width: 120,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  videoContainer: {
    width: 120,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
  },
  videoPlaceholderText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 8,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#F39C12',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  addMediaButton: {
    width: 120,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMediaText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  categoriesList: {
    paddingVertical: 8,
  },
  categoryChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 4,
    alignItems: 'center',
  },
  selectedCategoryChip: {
    backgroundColor: '#F39C12',
    borderColor: '#F39C12',
  },
  categoryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  availabilityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  availabilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '48%',
  },
  selectedAvailabilityOption: {
    backgroundColor: '#9B59B6',
    borderColor: '#9B59B6',
  },
  availabilityText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  selectedAvailabilityText: {
    color: '#FFFFFF',
  },
  uploadButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  uploadButton: {
    backgroundColor: '#F39C12',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadingButton: {
    backgroundColor: 'rgba(243, 156, 18, 0.6)',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // New styles for dual currency pricing
  priceInputContainer: {
    marginBottom: 10,
  },
  helperText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 16,
  },
  // Booking type styles
  bookingTypeContainer: {
    gap: 16,
  },
  bookingTypeOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedBookingType: {
    backgroundColor: 'rgba(52, 152, 219, 0.15)',
    borderColor: '#3498DB',
  },
  bookingTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bookingTypeText: {
    marginLeft: 16,
    flex: 1,
  },
  bookingTypeTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedBookingTypeTitle: {
    color: '#FFFFFF',
  },
  bookingTypeDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 18,
  },
  selectedBookingTypeDescription: {
    color: 'rgba(255,255,255,0.7)',
  },
  locationButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
  },
  locationButtonPlaceholder: {
    color: 'rgba(255,255,255,0.5)',
  },
});

export default ServiceUploadScreen;