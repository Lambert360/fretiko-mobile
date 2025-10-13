import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  Dimensions, 
  FlatList, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { productsAPI, ProductCategory } from '../services/productsAPI';
import { API_BASE_URL } from '../config/api';
import * as SecureStore from 'expo-secure-store';
import DualCurrencyInput from '../components/DualCurrencyInput';
import { currencyAPI } from '../services/currencyAPI';

interface ProductUploadScreenProps {
  navigation: any;
}

interface ProductMedia {
  uri: string;
  id: string;
  type: 'image' | 'video';
}

const ProductUploadScreen = ({ navigation }: ProductUploadScreenProps) => {
  const insets = useSafeAreaInsets();
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [localAmount, setLocalAmount] = useState('');
  const [fretiAmount, setFretiAmount] = useState('');
  const [localCurrency, setLocalCurrency] = useState('NGN');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('new');
  const [quantity, setQuantity] = useState('1');
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [shippingOptions, setShippingOptions] = useState({
    pickup: false,
    delivery: false,
    shipping: false
  });
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [isPriceValid, setIsPriceValid] = useState(true);
  const [priceError, setPriceError] = useState<string>('');
  
  const supportedCurrencies = ['NGN', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await productsAPI.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load product categories.');
    }
  };

  const handlePriceValidation = (isValid: boolean, error?: string) => {
    setIsPriceValid(isValid);
    setPriceError(error || '');
  };

  const conditions = [
    { value: 'new', label: 'New', icon: 'sparkles' },
    { value: 'like-new', label: 'Like New', icon: 'diamond' },
    { value: 'good', label: 'Good', icon: 'thumbs-up' },
    { value: 'fair', label: 'Fair', icon: 'hand-left' },
  ];

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
        aspect: [4, 3],
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
    if (!productName.trim() || !description.trim() || !fretiAmount.trim() || !categoryId) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!isPriceValid) {
      Alert.alert('Price Error', priceError || 'Please fix price validation errors.');
      return;
    }

    if (media.length === 0) {
      Alert.alert('No Media', 'Please add at least one photo or video of your product.');
      return;
    }

    if (!shippingOptions.pickup && !shippingOptions.delivery && !shippingOptions.shipping) {
      Alert.alert('Shipping Options', 'Please select at least one shipping/pickup option.');
      return;
    }

    setUploading(true);

    try {
      console.log('📤 Starting product upload via backend...');

      const accessToken = await SecureStore.getItemAsync('accessToken');
      if (!accessToken) {
        throw new Error('User not authenticated');
      }

      // Create FormData for multipart upload
      const formData = new FormData();

      // Separate images and videos
      const images = media.filter(m => m.type === 'image');
      const videos = media.filter(m => m.type === 'video');

      // Add image files to FormData
      images.forEach((image, index) => {
        const fileName = `product_${Date.now()}_${index}.jpg`;
        formData.append('images', {
          uri: image.uri,
          type: 'image/jpeg',
          name: fileName,
        } as any);
      });

      // Add video files to FormData
      videos.forEach((video, index) => {
        const fileName = `product_${Date.now()}_${index}.mp4`;
        formData.append('videos', {
          uri: video.uri,
          type: 'video/mp4',
          name: fileName,
        } as any);
      });

      // Add product data to FormData
      formData.append('name', productName.trim());
      formData.append('description', description.trim());
      formData.append('price', fretiAmount);
      formData.append('category_id', categoryId);
      formData.append('condition', condition);
      formData.append('quantity', quantity);
      formData.append('location', location.trim());
      formData.append('tags', JSON.stringify(tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)));
      formData.append('shipping_options', JSON.stringify(shippingOptions));

      // Upload via backend endpoint
      const response = await fetch(`${API_BASE_URL}/products/upload`, {
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
      console.log('✅ Product uploaded successfully via backend:', result.id);

      Alert.alert(
        'Product Listed!',
        'Your product has been successfully listed on the marketplace.',
        [
          { text: 'List Another', onPress: () => resetForm() },
          { text: 'View Products', onPress: () => navigation.navigate('Main', { screen: 'Home' }) }
        ]
      );
    } catch (error) {
      console.error('❌ Product upload failed:', error);
      Alert.alert('Upload Failed', 'Failed to list your product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setProductName('');
    setDescription('');
    setLocalAmount('');
    setFretiAmount('');
    setCategoryId('');
    setCondition('new');
    setQuantity('1');
    setMedia([]);
    setTags('');
    setLocation('');
    setShippingOptions({ pickup: false, delivery: false, shipping: false });
  };

  const renderCategoryItem = ({ item }: { item: ProductCategory }) => (
    <TouchableOpacity
      style={[styles.categoryChip, categoryId === item.id && styles.selectedCategoryChip]}
      onPress={() => setCategoryId(item.id)}
    >
      <Text style={[styles.categoryText, categoryId === item.id && styles.selectedCategoryText]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderConditionItem = ({ item }: { item: typeof conditions[0] }) => (
    <TouchableOpacity
      style={[styles.conditionChip, condition === item.value && styles.selectedConditionChip]}
      onPress={() => setCondition(item.value)}
    >
      <Ionicons 
        name={item.icon as any} 
        size={16} 
        color={condition === item.value ? '#FFFFFF' : 'rgba(255,255,255,0.7)'} 
      />
      <Text style={[styles.conditionText, condition === item.value && styles.selectedConditionText]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderMediaItem = ({ item, index }: { item: ProductMedia; index: number }) => (
    <View style={styles.imageContainer}>
      {item.type === 'image' ? (
        <Image source={{ uri: item.uri }} style={styles.productImage} />
      ) : (
        <View style={styles.productImage}>
          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 }}>Video</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.removeImageButton}
        onPress={() => removeMedia(item.id)}
      >
        <Ionicons name="close-circle" size={24} color="#E74C3C" />
      </TouchableOpacity>
      {index === 0 && (
        <View style={styles.primaryBadge}>
          <Text style={styles.primaryText}>Main</Text>
        </View>
      )}
      {item.type === 'video' && (
        <View style={[styles.primaryBadge, { top: 8, left: 8, backgroundColor: '#E74C3C' }]}>
          <Text style={styles.primaryText}>Video</Text>
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
        <Text style={styles.headerTitle}>List Product</Text>
        <TouchableOpacity onPress={resetForm} style={styles.resetButton}>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Media Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Media *</Text>
          <Text style={styles.sectionSubtitle}>Add up to 6 photos or videos (max 60s)</Text>

          <FlatList
            data={media}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.imagesList}
            ListFooterComponent={
              media.length < 6 ? (
                <TouchableOpacity style={styles.addImageButton} onPress={pickMedia}>
                  <Ionicons name="add-circle" size={32} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.addImageText}>Add Media</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Product Name *</Text>
            <TextInput
              style={styles.textInput}
              value={productName}
              onChangeText={setProductName}
              placeholder="Enter product name"
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
              placeholder="Describe your product in detail"
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
              title="Product Price *"
              placeholder="0.00"
              supportedCurrencies={supportedCurrencies}
              minAmount={0.01}
              maxAmount={1000000}
              onValidationChange={handlePriceValidation}
              containerStyle={styles.priceInputContainer}
            />
            
            {/* Price Helper Text */}
            <Text style={styles.helperText}>
              Buyers will see the price in Freti (₣). You can set your price in your local currency for convenience.
            </Text>
          </View>

          {/* Quantity */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={[styles.textInput, styles.quantityInput]}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="1"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category *</Text>
          <FlatList
            data={categories}
            numColumns={2}
            scrollEnabled={false}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoriesList}
          />
        </View>

        {/* Condition Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condition</Text>
          <FlatList
            data={conditions}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderConditionItem}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.conditionsList}
          />
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
              placeholder="electronics, phone, smartphone"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.textInput}
              value={location}
              onChangeText={setLocation}
              placeholder="City, State"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          </View>
        </View>

        {/* Shipping Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Options *</Text>
          <Text style={styles.sectionSubtitle}>Select at least one option</Text>
          
          <View style={styles.shippingOptions}>
            <TouchableOpacity
              style={[styles.shippingOption, shippingOptions.pickup && styles.selectedShippingOption]}
              onPress={() => setShippingOptions(prev => ({ ...prev, pickup: !prev.pickup }))}
            >
              <MaterialIcons 
                name="store" 
                size={24} 
                color={shippingOptions.pickup ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.shippingText, shippingOptions.pickup && styles.selectedShippingText]}>
                Local Pickup
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shippingOption, shippingOptions.delivery && styles.selectedShippingOption]}
              onPress={() => setShippingOptions(prev => ({ ...prev, delivery: !prev.delivery }))}
            >
              <MaterialIcons 
                name="delivery-dining" 
                size={24} 
                color={shippingOptions.delivery ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.shippingText, shippingOptions.delivery && styles.selectedShippingText]}>
                Local Delivery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shippingOption, shippingOptions.shipping && styles.selectedShippingOption]}
              onPress={() => setShippingOptions(prev => ({ ...prev, shipping: !prev.shipping }))}
            >
              <MaterialIcons 
                name="local-shipping" 
                size={24} 
                color={shippingOptions.shipping ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.shippingText, shippingOptions.shipping && styles.selectedShippingText]}>
                Shipping
              </Text>
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
              <Text style={styles.uploadButtonText}>List Product</Text>
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
  imagesList: {
    paddingVertical: 8,
  },
  imageContainer: {
    marginRight: 12,
    position: 'relative',
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  removeImageButton: {
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
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
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
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  conditionsList: {
    paddingVertical: 8,
  },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  selectedConditionChip: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  conditionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  selectedConditionText: {
    color: '#FFFFFF',
  },
  shippingOptions: {
    gap: 12,
  },
  shippingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  selectedShippingOption: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  shippingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  selectedShippingText: {
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
  quantityInput: {
    textAlign: 'center',
    maxWidth: 120,
    alignSelf: 'flex-start',
  },
});

export default ProductUploadScreen;