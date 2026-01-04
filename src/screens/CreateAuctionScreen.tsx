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
import { useNavigation, useRoute } from '@react-navigation/native';
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
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Route params for edit/relist modes
  const { mode, auctionId, auctionData } = route.params || {};
  const isEditMode = mode === 'edit';
  const isRelistMode = mode === 'relist';

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
  const [video, setVideo] = useState<string | null>(null);
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

    // Pre-fill form if in edit or relist mode
    if ((isEditMode || isRelistMode) && auctionData) {
      prefillForm(auctionData);
    }
  }, []);

  const loadProfile = async () => {
    try {
      const profileData = await userAPI.getProfile();
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  /**
   * Pre-fill form when in edit or relist mode
   */
  const prefillForm = (data: any) => {
    console.log('📝 Pre-filling form with auction data:', data);
    
    setTitle(data.title || '');
    setDescription(data.description || '');
    setLotNumber(data.lot_number || '');
    setAuctionType(data.auction_type || 'timed');
    setStartingPrice(data.starting_price?.toString() || '');
    setReservePrice(data.reserve_price?.toString() || '');
    setBidIncrement(data.bid_increment?.toString() || '');
    setSoftCloseEnabled(data.soft_close_enabled ?? true);
    setSoftCloseExtension((data.soft_close_extension ? data.soft_close_extension / 60 : 5).toString());
    setAuctioneerEnabled(data.auctioneer_enabled ?? false);
    setCrowdSoundsEnabled(data.crowd_sounds_enabled ?? false);

    // Set images if available
    if (data.images && data.images.length > 0) {
      setImages(data.images);
    }

    // Set video if available
    if (data.video_url) {
      setVideo(data.video_url);
    }

    // Set category (will be matched after categories load)
    if (data.category_id || data.category) {
      const categoryId = data.category_id || data.category?.id;
      // Wait for categories to load, then set selected category
      setTimeout(() => {
        const matchedCategory = categories.find(c => c.id === categoryId);
        if (matchedCategory) {
          setSelectedCategory(matchedCategory);
        }
      }, 500);
    }

    // For relist mode, reset times to future
    if (isRelistMode) {
      setStartTime(new Date());
      setEndTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } else if (isEditMode) {
      // For edit mode, keep original times if they're in the future
      setStartTime(data.start_time ? new Date(data.start_time) : new Date());
      setEndTime(data.end_time ? new Date(data.end_time) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
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

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        // Note: We'll let the backend handle size validation (50MB max)
        setVideo(asset.uri);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const removeVideo = () => {
    setVideo(null);
  };

  const validateForm = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!title.trim()) {
        Alert.alert('Missing Title', 'Please enter an auction title');
        resolve(false);
        return;
      }

      if (!description.trim()) {
        Alert.alert('Missing Description', 'Please describe your auction lot');
        resolve(false);
        return;
      }

      if (!selectedCategory) {
        Alert.alert('Missing Category', 'Please select a category');
        resolve(false);
        return;
      }

      if (!startingPrice || parseFloat(startingPrice) <= 0) {
        Alert.alert('Invalid Starting Price', 'Please enter a valid starting price');
        resolve(false);
        return;
      }

      if (reservePrice && parseFloat(reservePrice) < parseFloat(startingPrice)) {
        Alert.alert('Invalid Reserve Price', 'Reserve price must be higher than starting price');
        resolve(false);
        return;
      }

      if (startTime >= endTime) {
        Alert.alert('Invalid Timing', 'End time must be after start time');
        resolve(false);
        return;
      }

      if (softCloseEnabled) {
        const extensionMinutes = parseInt(softCloseExtension);
        if (isNaN(extensionMinutes) || extensionMinutes < 1) {
          Alert.alert('Invalid Extension Time', 'Extension time must be at least 1 minute');
          resolve(false);
          return;
        }
      }

      // Images are recommended but not mandatory
      // Show warning if no images but allow continue
      if (images.length === 0) {
        const message = video
          ? 'Adding photos will help attract more bidders and make your auction stand out!\n\nA thumbnail will be generated from your video, but photos provide better visibility in listings.'
          : 'Adding photos will help attract more bidders and make your auction stand out!\n\nWe recommend adding at least one photo for better visibility.';
        
        Alert.alert(
          'No Photos Added',
          message,
          [
            {
              text: 'Add Photos',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Continue Anyway',
              style: 'default',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true }
        );
        return;
      }

      resolve(true);
    });
  };

  const handleCreateAuction = async () => {
    try {
      const isValid = await validateForm();
      if (!isValid) return;

      setLoading(true);

      // Determine action based on mode
      let successAuction: any;

      if (isEditMode && auctionId) {
        // UPDATE existing auction
        console.log('✏️ Updating auction:', auctionId);

        const updateData: Partial<CreateAuctionData> = {
          title: title.trim(),
          description: description.trim(),
          lot_number: lotNumber.trim() || undefined,
          category_id: selectedCategory!.id,
          starting_price: parseFloat(startingPrice),
          reserve_price: reservePrice ? parseFloat(reservePrice) : undefined,
          bid_increment: bidIncrement ? parseFloat(bidIncrement) : undefined,
          auction_type: auctionType,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          soft_close_enabled: softCloseEnabled,
          soft_close_extension: softCloseEnabled ? parseInt(softCloseExtension) * 60 : undefined,
          auctioneer_enabled: auctionType === 'live' ? auctioneerEnabled : false,
          crowd_sounds_enabled: auctionType === 'live' ? crowdSoundsEnabled : false,
        };

        successAuction = await auctionsAPI.updateAuction(auctionId, updateData);
        console.log('✅ Auction updated successfully');
      } else {
        // CREATE new auction (or relist)
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

        // Add video file if provided
        if (video) {
          const fileExtension = video.split('.').pop() || 'mp4';
          const filename = `auction-video.${fileExtension}`;
          formData.append('video', {
            uri: video,
            type: 'video/mp4',
            name: filename,
          } as any);
        }

        const action = isRelistMode ? 'Relisting' : 'Creating';
        console.log(`🔨 ${action} auction with`, images.length, 'images', video ? 'and 1 video' : '');

        successAuction = await auctionsAPI.createAuctionWithImages(formData);

        console.log(`✅ Auction ${isRelistMode ? 'relisted' : 'created'} successfully:`, successAuction);
      }

      const createdAuction = successAuction;

      // Show appropriate success message based on mode
      const actionVerb = isEditMode ? 'Updated' : isRelistMode ? 'Relisted' : 'Created';
      const actionEmoji = isEditMode ? '✏️' : isRelistMode ? '🔄' : '🎉';

      // Check if live auction
      if (createdAuction.auction_type === 'live' && !isEditMode) {
        Alert.alert(
          `🎬 Live Auction ${actionVerb}!`,
          'Your live auction is ready. Start streaming now or view details?',
          [
            {
              text: 'Go Live Now',
              onPress: () => {
                navigation.replace('LiveStreamHost' as never, {
                  auctionId: createdAuction.id,
                  auction: createdAuction
                } as never);
              },
            },
            {
              text: 'View Details',
              onPress: () => {
                navigation.navigate('AuctionDetails' as never, { auctionId: createdAuction.id } as never);
              },
            },
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        // Timed auction or edit mode
        const message = isEditMode 
          ? 'Your auction has been updated successfully' 
          : isRelistMode
          ? 'Your auction has been relisted and is ready for bidders'
          : 'Your lot is now live and ready for bidders';

        Alert.alert(
          `${actionEmoji} Auction ${actionVerb}!`,
          message,
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
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
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
          <Text style={styles.headerTitle}>
            {isEditMode ? '✏️ Edit Auction' : isRelistMode ? '🔄 Relist Auction' : '🔨 Create Auction Lot'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isEditMode ? 'Update auction details' : isRelistMode ? 'List it again' : 'List your treasure'}
          </Text>
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
                <ScrollView 
                  style={styles.categoryPickerScroll}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
                  {categories.map((category) => (
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
                  ))}
                </ScrollView>
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
              themeVariant="dark"
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
              themeVariant="dark"
              onChange={(event, selectedDate) => {
                setShowEndTimePicker(Platform.OS === 'ios');
                if (selectedDate) setEndTime(selectedDate);
              }}
            />
          )}
        </View>

        {/* Media Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images" size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>Auction Media</Text>
          </View>

          {/* Video Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Video (Optional)</Text>
            <Text style={styles.inputHint}>
              Add a video showcase for your auction lot (Max 50MB)
            </Text>
            {!video ? (
              <TouchableOpacity style={styles.videoPickerButton} onPress={pickVideo}>
                <Ionicons name="videocam" size={32} color="#8E44AD" />
                <Text style={styles.videoPickerButtonText}>Add Video</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.videoPreviewContainer}>
                <View style={styles.videoPreview}>
                  <Ionicons name="play-circle" size={48} color="#FFF" />
                  <Text style={styles.videoPreviewText}>Video Selected</Text>
                </View>
                <TouchableOpacity
                  style={styles.videoRemoveButton}
                  onPress={removeVideo}
                >
                  <Ionicons name="close-circle" size={24} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Images Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Photos *</Text>
            <Text style={styles.inputHint}>
              Add high-quality images (Max 10). At least one image is required.
            </Text>
            <TouchableOpacity style={styles.imagePickerButton} onPress={pickImages}>
              <Ionicons name="camera" size={32} color="#8E44AD" />
              <Text style={styles.imagePickerButtonText}>Add Photos (Max 10)</Text>
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
    overflow: 'hidden',
  },
  categoryPickerScroll: {
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
    borderColor: '#555',
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
  videoPickerButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  videoPickerButtonText: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  videoPreviewContainer: {
    marginTop: 8,
    position: 'relative',
  },
  videoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 8,
  },
  videoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#000',
    borderRadius: 12,
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
