import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auctionsAPI, AuctionCategory, CreateAuctionData } from '../services/auctionsAPI';
import { userAPI, UserProfile } from '../services/userAPI';
import { fileUploadService } from '../services/fileUploadService';
import { useAuth } from '../contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Create Auction Screen
 *
 * Vibey, energetic auction creation experience
 * Blending Sotheby's prestige with eBay accessibility
 * Designed for Gen Z & Millennials (15-40)
 */
const CreateAuctionScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuctionCategory | null>(null);
  const [auctionType, setAuctionType] = useState<'timed' | 'live'>('timed');
  const [startingPrice, setStartingPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [bidIncrement, setBidIncrement] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days from now
  const [images, setImages] = useState<string[]>([]);
  const [softCloseEnabled, setSoftCloseEnabled] = useState(true);
  const [softCloseExtension, setSoftCloseExtension] = useState('5'); // minutes (will be converted to seconds)
  const [auctioneerEnabled, setAuctioneerEnabled] = useState(false);
  const [crowdSoundsEnabled, setCrowdSoundsEnabled] = useState(false);

  // UI State
  const [categories, setCategories] = useState<AuctionCategory[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadCategories();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getProfile();
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await auctionsAPI.getCategories(false) as AuctionCategory[];
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages([...images, ...newImages].slice(0, 10)); // Max 10 images
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter an auction title');
      return false;
    }

    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please describe your auction lot');
      return false;
    }

    if (!selectedCategory) {
      Alert.alert('Missing Category', 'Please select a category');
      return false;
    }

    if (!startingPrice || parseFloat(startingPrice) <= 0) {
      Alert.alert('Invalid Starting Price', 'Please enter a valid starting price');
      return false;
    }

    if (images.length === 0) {
      Alert.alert('Missing Images', 'Please add at least one image');
      return false;
    }

    if (reservePrice && parseFloat(reservePrice) < parseFloat(startingPrice)) {
      Alert.alert('Invalid Reserve Price', 'Reserve price must be higher than starting price');
      return false;
    }

    if (startTime >= endTime) {
      Alert.alert('Invalid Timing', 'End time must be after start time');
      return false;
    }

    if (softCloseEnabled) {
      const extensionMinutes = parseInt(softCloseExtension);
      if (isNaN(extensionMinutes) || extensionMinutes < 1) {
        Alert.alert('Invalid Extension Time', 'Extension time must be at least 1 minute');
        return false;
      }
    }

    return true;
  };

  const handleCreateAuction = async () => {
    try {
      if (!validateForm()) return;

      setLoading(true);

      // Create FormData for multipart upload
      const formData = new FormData();

      // Add text fields
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      if (lotNumber.trim()) formData.append('lot_number', lotNumber.trim());
      formData.append('category_id', selectedCategory!.id);
      formData.append('starting_price', startingPrice);
      if (reservePrice) formData.append('reserve_price', reservePrice);
      if (bidIncrement) formData.append('bid_increment', bidIncrement);
      formData.append('auction_type', auctionType);
      formData.append('start_time', startTime.toISOString());
      formData.append('end_time', endTime.toISOString());
      formData.append('soft_close_enabled', softCloseEnabled.toString());
      if (softCloseEnabled) {
        formData.append('soft_close_extension', (parseInt(softCloseExtension) * 60).toString());
      }
      formData.append('auctioneer_enabled', (auctionType === 'live' ? auctioneerEnabled : false).toString());
      formData.append('crowd_sounds_enabled', (auctionType === 'live' ? crowdSoundsEnabled : false).toString());

      // Add images as files
      for (let i = 0; i < images.length; i++) {
        const uri = images[i];
        const filename = `image-${i}.jpg`;

        formData.append('images', {
          uri,
          type: 'image/jpeg',
          name: filename,
        } as any);
      }

      console.log('🔨 Creating auction with', images.length, 'images');

      const createdAuction = await auctionsAPI.createAuctionWithImages(formData);

      console.log('✅ Auction created successfully:', createdAuction);

      Alert.alert(
        '🎉 Auction Created!',
        'Your lot is now live and ready for bidders',
        [
          {
            text: 'View Auction',
            onPress: () => {
              navigation.navigate('AuctionDetails' as never, { auctionId: createdAuction.id } as never);
            },
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error creating auction:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      const errorMessage = error.response?.data?.message
        || error.message
        || 'Failed to create auction. Please try again.';

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const calculateListingFee = () => {
    const price = parseFloat(startingPrice) || 0;
    return price * 0.02; // 2% listing fee
  };

  const calculateCommission = () => {
    const price = parseFloat(startingPrice) || 0;
    return price * 0.10; // 10% commission on sale
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>🔨 Create Auction Lot</Text>
          <Text style={styles.headerSubtitle}>List your treasure</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Lot Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Lot Details</Text>
          </View>

          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Vintage Rolex Submariner 1960s"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe your item in detail... Tell its story!"
              placeholderTextColor="#666"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              maxLength={1000}
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>
          </View>

          {/* Lot Number (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Lot Number (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., LOT-2025-001"
              placeholderTextColor="#666"
              value={lotNumber}
              onChangeText={setLotNumber}
              maxLength={50}
            />
          </View>
        </View>

        {/* Category Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="grid" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Category</Text>
          </View>

          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={selectedCategory ? styles.pickerButtonTextSelected : styles.pickerButtonText}>
              {selectedCategory ? selectedCategory.name : 'Select a category *'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#888" />
          </TouchableOpacity>

          {showCategoryPicker && (
            <View style={styles.categoryPickerContainer}>
              {categoriesLoading ? (
                <ActivityIndicator color="#8E44AD" style={{ padding: 20 }} />
              ) : (
                categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryOption,
                      selectedCategory?.id === category.id && styles.categoryOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedCategory(category);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={[styles.categoryIconSmall, { backgroundColor: `${category.color}20` }]}>
                      <Ionicons name={category.icon_name as any} size={18} color={category.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.categoryOptionName}>{category.name}</Text>
                      <Text style={styles.categoryOptionDesc}>{category.description}</Text>
                    </View>
                    {selectedCategory?.id === category.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#8E44AD" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* Auction Type Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="timer" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Auction Type</Text>
          </View>

          <View style={styles.auctionTypeContainer}>
            <TouchableOpacity
              style={[styles.typeCard, auctionType === 'timed' && styles.typeCardSelected]}
              onPress={() => setAuctionType('timed')}
            >
              <Ionicons
                name="hourglass-outline"
                size={32}
                color={auctionType === 'timed' ? '#8E44AD' : '#666'}
              />
              <Text style={[styles.typeCardTitle, auctionType === 'timed' && styles.typeCardTitleSelected]}>
                Timed Auction
              </Text>
              <Text style={styles.typeCardDescription}>Classic online bidding with set end time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeCard, auctionType === 'live' && styles.typeCardSelected]}
              onPress={() => setAuctionType('live')}
            >
              <Ionicons
                name="radio-outline"
                size={32}
                color={auctionType === 'live' ? '#8E44AD' : '#666'}
              />
              <Text style={[styles.typeCardTitle, auctionType === 'live' && styles.typeCardTitleSelected]}>
                Live Auction
              </Text>
              <Text style={styles.typeCardDescription}>Real-time bidding with live streaming</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pricing Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Pricing</Text>
          </View>

          {/* Starting Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Starting Price (₣) *</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.currencySymbol}>₣</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0.00"
                placeholderTextColor="#666"
                value={startingPrice}
                onChangeText={setStartingPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Reserve Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reserve Price (₣) - Optional</Text>
            <Text style={styles.inputHint}>Minimum price you'll accept. Hidden from bidders.</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.currencySymbol}>₣</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0.00"
                placeholderTextColor="#666"
                value={reservePrice}
                onChangeText={setReservePrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Bid Increment */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bid Increment (₣) - Optional</Text>
            <Text style={styles.inputHint}>Minimum amount each bid must increase by.</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.currencySymbol}>₣</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Auto-calculated"
                placeholderTextColor="#666"
                value={bidIncrement}
                onChangeText={setBidIncrement}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Fee Preview */}
          {startingPrice && parseFloat(startingPrice) > 0 && (
            <View style={styles.feePreview}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Listing Fee (2%)</Text>
                <Text style={styles.feeValue}>₣{calculateListingFee().toFixed(2)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Commission on Sale (10%)</Text>
                <Text style={styles.feeValue}>₣{calculateCommission().toFixed(2)}</Text>
              </View>
              <View style={[styles.feeRow, styles.feeRowTotal]}>
                <Text style={styles.feeLabelTotal}>Total Fees</Text>
                <Text style={styles.feeValueTotal}>
                  ₣{(calculateListingFee() + calculateCommission()).toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Timing Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Auction Schedule</Text>
          </View>

          {/* Start Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Start Time *</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#8E44AD" />
              <Text style={styles.datePickerButtonText}>
                {startTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {showStartTimePicker && (
            <DateTimePicker
              value={startTime}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                setShowStartTimePicker(Platform.OS === 'ios');
                if (selectedDate) setStartTime(selectedDate);
              }}
            />
          )}

          {/* End Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>End Time *</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#8E44AD" />
              <Text style={styles.datePickerButtonText}>
                {endTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {showEndTimePicker && (
            <DateTimePicker
              value={endTime}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                setShowEndTimePicker(Platform.OS === 'ios');
                if (selectedDate) setEndTime(selectedDate);
              }}
            />
          )}
        </View>

        {/* Images Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Auction Images</Text>
          </View>

          <TouchableOpacity style={styles.imagePickerButton} onPress={pickImages}>
            <Ionicons name="camera" size={32} color="#8E44AD" />
            <Text style={styles.imagePickerButtonText}>Add Photos (Max 10)</Text>
            <Text style={styles.imagePickerButtonHint}>
              High-quality images attract more bidders
            </Text>
          </TouchableOpacity>

          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imagePreviewContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.imageRemoveButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#E74C3C" />
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={styles.primaryImageBadge}>
                      <Text style={styles.primaryImageBadgeText}>Primary</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Advanced Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Advanced Settings</Text>
          </View>

          {/* Soft Close */}
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Anti-Snipe Protection</Text>
              <Text style={styles.settingDescription}>
                Extends auction if bids come in near the end
              </Text>
            </View>
            <Switch
              value={softCloseEnabled}
              onValueChange={setSoftCloseEnabled}
              trackColor={{ false: '#333', true: '#8E44AD80' }}
              thumbColor={softCloseEnabled ? '#8E44AD' : '#888'}
            />
          </View>

          {softCloseEnabled && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Extension Time (minutes) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="5 (minimum 1 minute)"
                placeholderTextColor="#666"
                value={softCloseExtension}
                onChangeText={setSoftCloseExtension}
                keyboardType="number-pad"
              />
              <Text style={styles.helpText}>
                Auction extends by this time if bids come in near the end
              </Text>
            </View>
          )}

          {/* Live Auction Features */}
          {auctionType === 'live' && (
            <>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>AI Auctioneer 🤖</Text>
                  <Text style={styles.settingDescription}>
                    Gemini AI provides live commentary during bidding
                  </Text>
                </View>
                <Switch
                  value={auctioneerEnabled}
                  onValueChange={setAuctioneerEnabled}
                  trackColor={{ false: '#333', true: '#8E44AD80' }}
                  thumbColor={auctioneerEnabled ? '#8E44AD' : '#888'}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Crowd Sounds 🎉</Text>
                  <Text style={styles.settingDescription}>
                    Energetic auction ambiance for viewers
                  </Text>
                </View>
                <Switch
                  value={crowdSoundsEnabled}
                  onValueChange={setCrowdSoundsEnabled}
                  trackColor={{ false: '#333', true: '#8E44AD80' }}
                  thumbColor={crowdSoundsEnabled ? '#8E44AD' : '#888'}
                />
              </View>
            </>
          )}
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateAuction}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="hammer" size={20} color="#FFF" />
              <Text style={styles.createButtonText}>List My Lot</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#8E44AD',
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  inputHint: {
    color: '#666',
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
  },
  pickerButtonText: {
    color: '#666',
    fontSize: 16,
  },
  pickerButtonTextSelected: {
    color: '#FFF',
    fontSize: 16,
  },
  categoryPickerContainer: {
    marginTop: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    maxHeight: 300,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  categoryOptionSelected: {
    backgroundColor: '#8E44AD20',
  },
  categoryIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryOptionName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryOptionDesc: {
    color: '#888',
    fontSize: 12,
  },
  auctionTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  typeCardSelected: {
    borderColor: '#8E44AD',
    backgroundColor: '#8E44AD10',
  },
  typeCardTitle: {
    color: '#888',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  typeCardTitleSelected: {
    color: '#8E44AD',
  },
  typeCardDescription: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingLeft: 12,
  },
  currencySymbol: {
    color: '#8E44AD',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    padding: 12,
  },
  feePreview: {
    backgroundColor: '#8E44AD10',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#8E44AD30',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeRowTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#8E44AD30',
  },
  feeLabel: {
    color: '#AAA',
    fontSize: 14,
  },
  feeValue: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '600',
  },
  feeLabelTotal: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feeValueTotal: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
  },
  datePickerButtonText: {
    color: '#FFF',
    fontSize: 15,
  },
  imagePickerButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerButtonText: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  imagePickerButtonHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  imagePreviewContainer: {
    width: (screenWidth - 72) / 3,
    height: (screenWidth - 72) / 3,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  primaryImageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#8E44AD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  primaryImageBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  settingLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#000',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8E44AD',
    padding: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#9B59B6',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default CreateAuctionScreen;
