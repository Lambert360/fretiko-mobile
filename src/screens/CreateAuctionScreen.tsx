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
  Platform,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Dimensions,
  Modal,
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
// Simplified Live Auction Item Card for list view
const LiveAuctionItemCard: React.FC<{
  item: any;
  onEdit: () => void;
  onRemove: () => void;
}> = ({ item, onEdit, onRemove }) => {
  return (
    <TouchableOpacity style={styles.liveItemCard} onPress={onEdit}>
      <View style={styles.liveItemHeader}>
        <View style={styles.liveItemInfo}>
          <Text style={styles.liveItemTitle}>{item.title || 'Untitled Item'}</Text>
          <Text style={styles.liveItemLotNumber}>{item.lotNumber}</Text>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.liveItemRemoveButton}>
          <Ionicons name="close-circle" size={24} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <View style={styles.liveItemSummary}>
        <Text style={styles.liveItemPrice}>₣{item.startingPrice || '0.00'}</Text>
        <Text style={styles.liveItemMediaCount}>
          {item.images.length > 0 && `${item.images.length} photo${item.images.length !== 1 ? 's' : ''}`}
          {item.images.length > 0 && item.videos.length > 0 && ', '}
          {item.videos.length > 0 && `${item.videos.length} video${item.videos.length !== 1 ? 's' : ''}`}
          {item.images.length === 0 && item.videos.length === 0 && 'No media'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Live Auction Item Modal for editing
const LiveAuctionItemModal: React.FC<{
  visible: boolean;
  item: any;
  onUpdate: (field: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddImage: (uri: string) => void;
  onRemoveImage: (index: number) => void;
  onAddVideo: (uri: string) => void;
  onRemoveVideo: (index: number) => void;
}> = ({ visible, item, onUpdate, onSave, onCancel, onAddImage, onRemoveImage, onAddVideo, onRemoveVideo }) => {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const insets = useSafeAreaInsets();

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        result.assets.forEach(asset => {
          if (asset.uri) onAddImage(asset.uri);
        });
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        onAddVideo(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={[styles.modalContainer, { paddingBottom: (insets.bottom || 0) + 12 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Auction Item</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Essential Fields Only */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Item Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter item title"
              placeholderTextColor="#666"
              value={item.title}
              onChangeText={(value) => onUpdate('title', value)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Lot Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., LOT-001"
              placeholderTextColor="#666"
              value={item.lotNumber}
              onChangeText={(value) => onUpdate('lotNumber', value)}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Starting Price (₣) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#666"
                value={item.startingPrice}
                onChangeText={(value) => onUpdate('startingPrice', value)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Reserve Price (₣)</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor="#666"
                value={item.reservePrice}
                onChangeText={(value) => onUpdate('reservePrice', value)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Media Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Photos & Videos</Text>
            
            {/* Images */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {item.images.length < 5 && (
                <TouchableOpacity
                  style={styles.modalAddMediaButton}
                  onPress={pickImages}
                >
                  <Ionicons name="camera" size={20} color="#8E44AD" />
                  <Text style={styles.modalAddMediaText}>Add Photo</Text>
                </TouchableOpacity>
              )}
              {item.images.map((uri: string, index: number) => (
                <View key={`img-${index}`} style={styles.modalImagePreview}>
                  <Image source={{ uri }} style={styles.modalItemImage} />
                  <TouchableOpacity
                    style={styles.modalRemoveMediaButton}
                    onPress={() => onRemoveImage(index)}
                  >
                    <Ionicons name="close-circle" size={16} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Videos */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.modalAddMediaButton}
                onPress={pickVideo}
              >
                <Ionicons name="videocam" size={16} color="#3498DB" />
                <Text style={styles.modalAddMediaText}>Add Video</Text>
              </TouchableOpacity>
              {item.videos.map((uri: string, index: number) => (
                <View key={`vid-${index}`} style={styles.modalVideoPreview}>
                  <View style={styles.modalVideoThumbnail}>
                    <Ionicons name="videocam" size={16} color="#3498DB" />
                    <Text style={styles.modalVideoText}>Video</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalRemoveMediaButton}
                    onPress={() => onRemoveVideo(index)}
                  >
                    <Ionicons name="close-circle" size={16} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Modal Actions */}
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveButtonText}>Save Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

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
  // Set start time to 1 hour from now to ensure it's always in the future
  const [startTime, setStartTime] = useState(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour from now
  const [endTime, setEndTime] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days from now
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [softCloseEnabled, setSoftCloseEnabled] = useState(true);
  const [softCloseExtension, setSoftCloseExtension] = useState('5'); // minutes (will be converted to seconds)
  const [auctioneerEnabled, setAuctioneerEnabled] = useState(false);
  const [crowdSoundsEnabled, setCrowdSoundsEnabled] = useState(false);

  // Multi-item state for live auctions
  const [liveAuctionItems, setLiveAuctionItems] = useState<Array<{
    id: string;
    title: string;
    description: string;
    lotNumber: string;
    startingPrice: string;
    reservePrice: string;
    bidIncrement: string;
    images: string[];
    videos: string[];
  }>>([]);

  // UI State
  const [categories, setCategories] = useState<AuctionCategory[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  // Separate date/time pickers for Android
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePickerOnly, setShowStartTimePickerOnly] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePickerOnly, setShowEndTimePickerOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Live auction item modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // File size validation constants
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB per image
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for video

  // File size validation functions
  const validateImageFileSize = async (uri: string): Promise<boolean> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileSize = blob.size;
      
      if (fileSize > MAX_IMAGE_SIZE) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
        Alert.alert(
          'Image Too Large',
          `Image size is ${sizeMB}MB. Maximum allowed size is 10MB per image. Please choose a smaller image.`,
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking image file size:', error);
      return true; // Allow upload if we can't check size
    }
  };

  const validateVideoFileSize = async (uri: string): Promise<boolean> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileSize = blob.size;
      
      if (fileSize > MAX_VIDEO_SIZE) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
        Alert.alert(
          'Video Too Large',
          `Video size is ${sizeMB}MB. Maximum allowed size is 50MB. Please choose a smaller video or compress it.`,
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking video file size:', error);
      return true; // Allow upload if we can't check size
    }
  };

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
      setVideos([data.video_url]);
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
      setStartTime(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour from now
      setEndTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } else if (isEditMode) {
      // For edit mode, keep original times if they're in the future, otherwise set to 1 hour from now
      const originalStartTime = data.start_time ? new Date(data.start_time) : null;
      const now = new Date();
      setStartTime(originalStartTime && originalStartTime > now 
        ? originalStartTime 
        : new Date(Date.now() + 60 * 60 * 1000)); // 1 hour from now if in past
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
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled) {
        // Validate file sizes before adding
        const validImages: string[] = [];
        
        for (const asset of result.assets) {
          const isValidSize = await validateImageFileSize(asset.uri);
          if (isValidSize) {
            validImages.push(asset.uri);
          }
        }
        
        if (validImages.length > 0) {
          setImages([...images, ...validImages].slice(0, 10)); // Max 10 images
          
          // Alert if some images were rejected
          if (validImages.length < result.assets.length) {
            const rejectedCount = result.assets.length - validImages.length;
            Alert.alert(
              'Some Images Rejected',
              `${rejectedCount} image(s) were too large and not added. Maximum size is 10MB per image.`,
              [{ text: 'OK' }]
            );
          }
        }
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
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        // Validate video file size before setting
        const isValidSize = await validateVideoFileSize(asset.uri);
        if (isValidSize) {
          setVideos(prev => [asset.uri, ...prev]); // Add to beginning (newest first)
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const removeVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  // Multi-item management functions for live auctions
  const addLiveAuctionItem = () => {
    // Open modal with empty item for editing
    const newItem = {
      id: Date.now().toString(),
      title: '',
      description: description || '', // Inherit from main auction
      lotNumber: `LOT-${String(liveAuctionItems.length + 1).padStart(3, '0')}`, // Auto-generate
      startingPrice: startingPrice || '', // Inherit from main auction
      reservePrice: reservePrice || '', // Inherit from main auction
      bidIncrement: bidIncrement || '', // Inherit from main auction
      images: [],
      videos: [],
    };
    setEditingItem(newItem);
    setShowItemModal(true);
  };

  const updateLiveAuctionItem = (id: string, field: string, value: any) => {
    setLiveAuctionItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeLiveAuctionItem = (id: string) => {
    setLiveAuctionItems(prev => prev.filter(item => item.id !== id));
  };

  // Modal functions
  const openEditItemModal = (item: any) => {
    setEditingItem(item);
    setShowItemModal(true);
  };

  const saveItemFromModal = () => {
    if (!editingItem) return;
    
    const existingIndex = liveAuctionItems.findIndex(item => item.id === editingItem.id);
    if (existingIndex >= 0) {
      // Update existing item
      setLiveAuctionItems(prev => prev.map(item => 
        item.id === editingItem.id ? editingItem : item
      ));
    } else {
      // Add new item
      setLiveAuctionItems(prev => [...prev, editingItem]);
    }
    
    setShowItemModal(false);
    setEditingItem(null);
  };

  const cancelItemModal = () => {
    setShowItemModal(false);
    setEditingItem(null);
  };

  const addImageToLiveItem = (itemId: string, imageUri: string) => {
    setLiveAuctionItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, images: [...item.images, imageUri] } : item
    ));
  };

  const removeImageFromLiveItem = (itemId: string, imageIndex: number) => {
    setLiveAuctionItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, images: item.images.filter((_, i) => i !== imageIndex) } : item
    ));
  };

  const addVideoToLiveItem = (itemId: string, videoUri: string) => {
    setLiveAuctionItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, videos: [videoUri, ...item.videos] } : item // Add to beginning (newest first)
    ));
  };

  const removeVideoFromLiveItem = (itemId: string, videoIndex: number) => {
    setLiveAuctionItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, videos: item.videos.filter((_, i) => i !== videoIndex) } : item
    ));
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

      // Validate pricing based on auction type
      if (auctionType === 'timed') {
        // For timed auctions, validate single item pricing
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
      } else {
        // For live auctions, validate primary item OR additional items
        const hasPrimaryItem = startingPrice && parseFloat(startingPrice) > 0;
        const hasAdditionalItems = liveAuctionItems.length > 0;
        
        if (!hasPrimaryItem && !hasAdditionalItems) {
          Alert.alert('No Items Added', 'Please add a primary item or at least one additional item for the live auction');
          resolve(false);
          return;
        }

        // Validate primary item pricing if set
        if (hasPrimaryItem) {
          if (!startingPrice || parseFloat(startingPrice) <= 0) {
            Alert.alert('Invalid Primary Item Price', 'Please enter a valid starting price for the primary item');
            resolve(false);
            return;
          }

          if (reservePrice && parseFloat(reservePrice) < parseFloat(startingPrice)) {
            Alert.alert('Invalid Reserve Price', 'Reserve price must be higher than starting price');
            resolve(false);
            return;
          }
        }

        // Validate additional items
        for (const item of liveAuctionItems) {
          if (!item.title.trim()) {
            Alert.alert('Missing Item Title', 'All items must have a title');
            resolve(false);
            return;
          }

          if (!item.startingPrice || parseFloat(item.startingPrice) <= 0) {
            Alert.alert('Invalid Item Price', 'All items must have a valid starting price');
            resolve(false);
            return;
          }

          if (item.reservePrice && parseFloat(item.reservePrice) < parseFloat(item.startingPrice)) {
            Alert.alert('Invalid Reserve Price', 'Reserve price must be higher than starting price for all items');
            resolve(false);
            return;
          }
        }
      }

      // Validate that start time is in the future
      const now = new Date();
      if (startTime <= now) {
        Alert.alert('Invalid Start Time', 'Start time must be in the future. Please select a future date and time.');
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
        const message = videos.length > 0
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

      // Final file size validation before upload
      for (const video of videos) {
        const isVideoValid = await validateVideoFileSize(video);
        if (!isVideoValid) return; // Stop if any video is too large
      }

      // Validate all images one more time
      const validImages: string[] = [];
      for (const imageUri of images) {
        const isImageValid = await validateImageFileSize(imageUri);
        if (isImageValid) {
          validImages.push(imageUri);
        }
      }
      
      if (validImages.length !== images.length) {
        // Some images were too large, update the images array
        setImages(validImages);
        if (validImages.length === 0) {
          Alert.alert(
            'All Images Too Large',
            'All selected images exceed the 10MB size limit. Please select smaller images.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

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

        // Add files under 'files' field (backend interceptor expects this)
        // For live auctions, associate images with specific items using filename prefixes
        let allItems = [];
        let fileIndex = 0;

        if (auctionType === 'live') {
          console.log('🔍 Debug - liveAuctionItems:', JSON.stringify(liveAuctionItems, null, 2));
          console.log('🔍 Debug - liveAuctionItems length:', liveAuctionItems.length);
          
          // Primary item (index 0)
          const primaryItem = {
            title: title,
            description: description,
            starting_price: parseFloat(startingPrice),
            reserve_price: reservePrice ? parseFloat(reservePrice) : undefined,
            bid_increment: parseFloat(bidIncrement) || 1,
            lot_number: lotNumber,
          };
          allItems.push(primaryItem);
          console.log('🔍 Debug - Primary item created:', JSON.stringify(primaryItem, null, 2));

          // Add primary item images with item-0 prefix in filename
          images.forEach((uri, index) => {
            const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
            const fileName = `item-0-image-${index}.jpg`;
            
            const file = {
              uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
              type: 'image/jpeg',
              name: fileName,
            };
            formData.append('files', file as any);
            console.log('📁 Adding primary item image to FormData:', { uri: file.uri, name: file.name });
          });

          // Add primary item videos with item-0 prefix in filename
          for (const [index, uri] of videos.entries()) {
            const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
            const fileExtension = uri.split('.').pop() || 'mp4';
            const fileName = `item-0-video-${index}.${fileExtension}`;
            
            const file = {
              uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
              type: 'video/mp4',
              name: fileName,
            };
            
            formData.append('files', file as any);
            console.log('📁 Adding primary item video to FormData:', { uri: file.uri, name: file.name });
          }

          console.log('🔍 Debug - Total files being sent to FormData:', formData.getAll('files').length);
          console.log('🔍 Debug - All files in FormData:', formData.getAll('files').map((f: any) => f.name));

          // Add additional items with their images (indices 1, 2, 3...)
          liveAuctionItems.forEach((item, itemIndex) => {
            console.log(`🔍 Debug - Processing additional item ${itemIndex}:`, JSON.stringify(item, null, 2));
            
            const additionalItem = {
              title: item.title,
              description: item.description,
              starting_price: parseFloat(item.startingPrice),
              reserve_price: item.reservePrice ? parseFloat(item.reservePrice) : undefined,
              bid_increment: parseFloat(item.bidIncrement) || 1,
              lot_number: item.lotNumber,
            };
            console.log(`🔍 Debug - Additional item ${itemIndex} created:`, JSON.stringify(additionalItem, null, 2));
            allItems.push(additionalItem);

            // Add additional item images with proper indexing in filename
            item.images.forEach((uri, imgIndex) => {
              const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
              const fileName = `item-${itemIndex + 1}-image-${imgIndex}.jpg`;
              
              const file = {
                uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
                type: 'image/jpeg',
                name: fileName,
              };
              formData.append('files', file as any);
              console.log('📁 Adding additional item image to FormData:', { 
                uri: file.uri, 
                name: file.name,
                itemIndex: itemIndex + 1,
                imgIndex: imgIndex
              });
            });

            // Add additional item videos with proper indexing in filename
            if (item.videos && item.videos.length > 0) {
              for (const [vidIndex, uri] of item.videos.entries()) {
                const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
                const fileName = `item-${itemIndex + 1}-video-${vidIndex}.mp4`;
                
                const file = {
                  uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
                  type: 'video/mp4',
                  name: fileName,
                };
                
                formData.append('files', file as any);
                console.log('📁 Adding additional item video to FormData:', { 
                  uri: file.uri, 
                  name: file.name,
                  itemIndex: itemIndex + 1,
                  vidIndex: vidIndex
                });
              }
            }
          });

          console.log('🔍 Debug - Final FormData files count:', formData.getAll('files').length);
          console.log('🔍 Debug - Final FormData files:', formData.getAll('files').map((f: any) => f.name));

          // Add all items to FormData
          console.log('🔍 Debug - Final allItems array before FormData:', JSON.stringify(allItems, null, 2));
          formData.append('items', JSON.stringify(allItems));
          console.log('📦 Adding all items to FormData for live auction:', allItems.length, 'items');

        } else {
          // Timed auctions - use simple naming
          images.forEach((uri, index) => {
            const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
            const fileName = `image-${index}.jpg`;
            
            const file = {
              uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
              type: 'image/jpeg',
              name: fileName,
            };
            formData.append('files', file as any);
            console.log('📁 Adding timed auction image to FormData:', { uri: file.uri, name: file.name, type: file.type });
          });

          videos.forEach((uri, index) => {
            const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
            const fileExtension = uri.split('.').pop() || 'mp4';
            const fileName = `video-${index}.${fileExtension}`;
            
            const file = {
              uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
              type: 'video/mp4',
              name: fileName,
            };
            formData.append('files', file as any);
            console.log('📁 Adding timed auction video to FormData:', { uri: file.uri, name: file.name, type: file.type });
          });
        }

        const action = isRelistMode ? 'Relisting' : 'Creating';
        console.log(`🔨 ${action} auction with`, images.length, 'images', videos.length, 'videos', liveAuctionItems.length, 'additional items');

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
                (navigation as any).replace('LiveStreamHost', {
                  auctionId: createdAuction.id,
                  auction: createdAuction
                });
              },
            },
            {
              text: 'View Details',
              onPress: () => {
                (navigation as any).navigate('AuctionDetails', { auctionId: createdAuction.id });
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
                (navigation as any).navigate('AuctionDetails', { auctionId: createdAuction.id });
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

        {/* Dynamic Item Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name={auctionType === 'timed' ? 'pricetag' : 'list'} size={20} color="#8E44AD" />
            <Text style={styles.sectionTitle}>
              {auctionType === 'timed' ? 'Item Details' : 'Auction Items'}
            </Text>
          </View>

          {auctionType === 'timed' ? (
            // Timed Auction - Single Item
            <>
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
            </>
          ) : (
            // Live Auction - Primary Item + Multiple Additional Items
            <>
              <Text style={styles.liveAuctionDescription}>
                Set up your primary auction item and add additional items for the live auction.
              </Text>

              {/* Primary Auction Item (Original Flow) */}
              <View style={styles.primaryItemSection}>
                <Text style={styles.sectionTitle}>Primary Auction Item</Text>
                <Text style={styles.sectionSubtitle}>
                  This will be the main item displayed on the auction card and details screen.
                </Text>

                {/* Primary Item Images */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Photos & Videos</Text>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {images.map((uri, index) => (
                      <View key={`img-${index}`} style={styles.imagePreview}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={16} color="#E74C3C" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    
                    {videos.map((uri, index) => (
                      <View key={`vid-${index}`} style={styles.imagePreview}>
                        <View style={styles.videoPreview}>
                          <Ionicons name="play-circle" size={32} color="#8E44AD" />
                          <Text style={styles.videoText}>Video</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeVideo(index)}
                        >
                          <Ionicons name="close-circle" size={16} color="#E74C3C" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    
                    <TouchableOpacity style={styles.addMediaButton} onPress={pickImages}>
                      <Ionicons name="camera" size={20} color="#8E44AD" />
                      <Text style={styles.addMediaText}>Add Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.addMediaButton} onPress={pickVideo}>
                      <Ionicons name="videocam" size={20} color="#8E44AD" />
                      <Text style={styles.addMediaText}>Add Video</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* Primary Item Pricing */}
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>Starting Price (₣) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0.00"
                      placeholderTextColor="#666"
                      value={startingPrice}
                      onChangeText={setStartingPrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Reserve Price (₣)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Optional"
                      placeholderTextColor="#666"
                      value={reservePrice}
                      onChangeText={setReservePrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Bid Increment (₣)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 5.00"
                    placeholderTextColor="#666"
                    value={bidIncrement}
                    onChangeText={setBidIncrement}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Additional Items Section */}
              <View style={styles.additionalItemsSection}>
                <View style={styles.additionalItemsHeader}>
                  <Text style={styles.sectionTitle}>Additional Items</Text>
                  <Text style={styles.sectionSubtitle}>
                    Add more items to sell during your live auction
                  </Text>
                </View>

                {/* Live Auction Items List - Simplified Cards */}
                <View style={styles.liveItemsList}>
                  {liveAuctionItems.map((item) => (
                    <LiveAuctionItemCard
                      key={item.id}
                      item={item}
                      onEdit={() => openEditItemModal(item)}
                      onRemove={() => removeLiveAuctionItem(item.id)}
                    />
                  ))}
                </View>

                {/* Add Another Item Button */}
                <TouchableOpacity
                  style={styles.addLiveItemButton}
                  onPress={addLiveAuctionItem}
                >
                  <Ionicons name="add-circle" size={24} color="#8E44AD" />
                  <Text style={styles.addLiveItemText}>Add Another Item</Text>
                </TouchableOpacity>

                {/* Items Summary */}
                {liveAuctionItems.length > 0 && (
                  <View style={styles.liveItemsSummary}>
                    <Text style={styles.liveItemsSummaryText}>
                      {liveAuctionItems.length} additional item{liveAuctionItems.length !== 1 ? 's' : ''} added
                    </Text>
                    <Text style={styles.liveItemsTotalValue}>
                      Total Additional Value: ₣{liveAuctionItems.reduce((sum, item) => 
                        sum + (parseFloat(item.startingPrice) || 0), 0).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Live Auction Item Modal */}
              <LiveAuctionItemModal
                visible={showItemModal}
                item={editingItem || {}}
                onUpdate={(field, value) => setEditingItem((prev: any) => prev ? {...prev, [field]: value} : null)}
                onSave={saveItemFromModal}
                onCancel={cancelItemModal}
                onAddImage={(uri) => {
                  if (editingItem) {
                    setEditingItem((prev: any) => prev ? {...prev, images: [...prev.images, uri]} : null);
                  }
                }}
                onRemoveImage={(index) => {
                  if (editingItem) {
                    setEditingItem((prev: any) => prev ? {...prev, images: prev.images.filter((_: any, i: any) => i !== index)} : null);
                  }
                }}
                onAddVideo={(uri) => {
                  if (editingItem) {
                    setEditingItem((prev: any) => prev ? {...prev, videos: [uri, ...prev.videos]} : null);
                  }
                }}
                onRemoveVideo={(index) => {
                  if (editingItem) {
                    setEditingItem((prev: any) => prev ? {...prev, videos: prev.videos.filter((_: any, i: any) => i !== index)} : null);
                  }
                }}
              />
            </>
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
              onPress={() => {
                if (Platform.OS === 'android') {
                  // On Android, show date picker first
                  setShowStartDatePicker(true);
                } else {
                  // On iOS, show combined datetime picker
                  setShowStartTimePicker(true);
                }
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#8E44AD" />
              <Text style={styles.datePickerButtonText}>
                {startTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Android: Separate Date Picker for Start Time */}
          {Platform.OS === 'android' && showStartDatePicker && (
            <DateTimePicker
              value={startTime}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  // Update date part, keep time part
                  const newDate = new Date(selectedDate);
                  newDate.setHours(startTime.getHours());
                  newDate.setMinutes(startTime.getMinutes());
                  setStartTime(newDate);
                  // Close date picker and show time picker
                  setShowStartDatePicker(false);
                  setShowStartTimePickerOnly(true);
                } else if (event.type === 'dismissed') {
                  setShowStartDatePicker(false);
                }
              }}
            />
          )}

          {/* Android: Separate Time Picker for Start Time */}
          {Platform.OS === 'android' && showStartTimePickerOnly && (
            <DateTimePicker
              value={startTime}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  // Update time part, keep date part
                  const newDate = new Date(startTime);
                  newDate.setHours(selectedDate.getHours());
                  newDate.setMinutes(selectedDate.getMinutes());
                  setStartTime(newDate);
                  setShowStartTimePickerOnly(false);
                } else if (event.type === 'dismissed') {
                  setShowStartTimePickerOnly(false);
                }
              }}
            />
          )}

          {/* iOS: Combined DateTime Picker for Start Time */}
          {Platform.OS === 'ios' && showStartTimePicker && (
            <DateTimePicker
              value={startTime}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  setStartTime(selectedDate);
                  setShowStartTimePicker(false);
                } else if (event.type === 'dismissed') {
                  setShowStartTimePicker(false);
                }
              }}
            />
          )}

          {/* End Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>End Time *</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => {
                if (Platform.OS === 'android') {
                  // On Android, show date picker first
                  setShowEndDatePicker(true);
                } else {
                  // On iOS, show combined datetime picker
                  setShowEndTimePicker(true);
                }
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#8E44AD" />
              <Text style={styles.datePickerButtonText}>
                {endTime.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Android: Separate Date Picker for End Time */}
          {Platform.OS === 'android' && showEndDatePicker && (
            <DateTimePicker
              value={endTime}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  // Update date part, keep time part
                  const newDate = new Date(selectedDate);
                  newDate.setHours(endTime.getHours());
                  newDate.setMinutes(endTime.getMinutes());
                  setEndTime(newDate);
                  // Close date picker and show time picker
                  setShowEndDatePicker(false);
                  setShowEndTimePickerOnly(true);
                } else if (event.type === 'dismissed') {
                  setShowEndDatePicker(false);
                }
              }}
            />
          )}

          {/* Android: Separate Time Picker for End Time */}
          {Platform.OS === 'android' && showEndTimePickerOnly && (
            <DateTimePicker
              value={endTime}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  // Update time part, keep date part
                  const newDate = new Date(endTime);
                  newDate.setHours(selectedDate.getHours());
                  newDate.setMinutes(selectedDate.getMinutes());
                  setEndTime(newDate);
                  setShowEndTimePickerOnly(false);
                } else if (event.type === 'dismissed') {
                  setShowEndTimePickerOnly(false);
                }
              }}
            />
          )}

          {/* iOS: Combined DateTime Picker for End Time */}
          {Platform.OS === 'ios' && showEndTimePicker && (
            <DateTimePicker
              value={endTime}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                  setEndTime(selectedDate);
                  setShowEndTimePicker(false);
                } else if (event.type === 'dismissed') {
                  setShowEndTimePicker(false);
                }
              }}
            />
          )}
        </View>

        {/* Media Section - Only for Timed Auctions */}
        {auctionType === 'timed' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images" size={20} color="#8E44AD" />
              <Text style={styles.sectionTitle}>Auction Media</Text>
            </View>

            {/* Video Section */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Videos (Optional)</Text>
              <Text style={styles.inputHint}>
                Add video showcases for your auction lot (Max 50MB each)
              </Text>
              
              {/* Video Grid */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.videoGrid}
                contentContainerStyle={styles.videoGridContent}
              >
                {/* Add Video Button - Always visible and fixed at start */}
                <TouchableOpacity style={styles.addVideoButton} onPress={pickVideo}>
                  <Ionicons name="videocam" size={24} color="#8E44AD" />
                  <Text style={styles.addVideoButtonText}>Add Video</Text>
                </TouchableOpacity>
                
                {/* Videos - Newest first (index 0 is newest) */}
                {videos.map((uri, index) => (
                  <View key={index} style={styles.videoPreviewContainer}>
                    <View style={styles.videoPreview}>
                      <Ionicons name="play-circle" size={24} color="#FFF" />
                      <Text style={styles.videoPreviewText}>Video</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.videoRemoveButton}
                      onPress={() => removeVideo(index)}
                    >
                      <Ionicons name="close-circle" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
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
        )}

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
  helpText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
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
  // Video grid styles
  videoGrid: {
    marginTop: 16,
  },
  videoGridContent: {
    flexDirection: 'row',
    gap: 12,
  },
  videoPreviewContainer: {
    width: (screenWidth - 72) / 3,
    height: (screenWidth - 72) / 3,
    position: 'relative',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPreviewText: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
  },
  videoRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  addVideoButton: {
    width: (screenWidth - 72) / 3,
    height: (screenWidth - 72) / 3,
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
    borderWidth: 2,
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addVideoButtonText: {
    color: '#8E44AD',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  // Live auction multi-item styles
  liveAuctionDescription: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  liveItemsList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  liveItemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  liveItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  liveItemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  liveItemRemoveButton: {
    padding: 4,
  },
  liveItemContent: {
    padding: 16,
  },
  liveItemRow: {
    marginBottom: 16,
  },
  liveItemField: {
    flex: 1,
  },
  liveItemLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  liveItemInput: {
    backgroundColor: '#2a2a2a',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#444',
  },
  liveItemTextArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  liveItemMediaContainer: {
    marginTop: 8,
  },
  liveItemImagePreview: {
    width: 60,
    height: 60,
    marginRight: 8,
    position: 'relative',
  },
  liveItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  liveItemVideoPreview: {
    width: 60,
    height: 60,
    marginRight: 8,
    position: 'relative',
  },
  liveItemVideoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveItemVideoText: {
    color: '#3498DB',
    fontSize: 8,
    marginTop: 2,
  },
  liveItemRemoveMediaButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  liveItemAddMediaButton: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
    borderWidth: 1,
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveItemAddMediaText: {
    color: '#8E44AD',
    fontSize: 8,
    marginTop: 2,
  },
  addLiveItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
    borderWidth: 2,
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addLiveItemText: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  liveItemsSummary: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveItemsSummaryText: {
    color: '#888',
    fontSize: 14,
  },
  liveItemsTotalValue: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: '600',
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
  // Updated live auction styles
  liveItemInfo: {
    flex: 1,
  },
  liveItemSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  liveItemPrice: {
    color: '#8E44AD',
    fontSize: 16,
    fontWeight: 'bold',
  },
  liveItemLotNumber: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  liveItemMediaCount: {
    color: '#888',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#FFF',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#8E44AD',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
  },
  // Modal media styles
  modalImagePreview: {
    width: 80,
    height: 80,
    position: 'relative',
    marginRight: 8,
  },
  modalItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalRemoveMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  modalAddMediaButton: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
    borderWidth: 2,
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modalAddMediaText: {
    color: '#8E44AD',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  modalVideoPreview: {
    width: 80,
    height: 80,
    position: 'relative',
    marginRight: 8,
  },
  modalVideoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalVideoText: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 4,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  addMediaButton: {
    width: 80,
    height: 80,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addMediaText: {
    color: '#8E44AD',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  // New styles for enhanced live auction UI
  primaryItemSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#8E44AD',
  },
  additionalItemsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  additionalItemsHeader: {
    marginBottom: 16,
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  videoText: {
    color: '#8E44AD',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default CreateAuctionScreen;
