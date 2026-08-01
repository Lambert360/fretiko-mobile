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
import LocationSelector from '../components/LocationSelector';

interface ProductUploadScreenProps {
  navigation: any;
}

interface ProductMedia {
  uri: string;
  id: string;
  type: 'image' | 'video';
}

interface ProductVariantForm {
  id: string;
  name: string;
  price: string;
  localAmount: string;
  localCurrency: string;
  mediaUri: string | null;
  mediaType: 'image' | 'video' | null;
  isPrimary: boolean;
}

const createEmptyVariant = (): ProductVariantForm => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  price: '',
  localAmount: '',
  localCurrency: 'NGN',
  mediaUri: null,
  mediaType: null,
  isPrimary: false,
});

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
  const [isMultiItem, setIsMultiItem] = useState(false);
  const [variants, setVariants] = useState<ProductVariantForm[]>([{ ...createEmptyVariant(), isPrimary: true }]);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [isPriceValid, setIsPriceValid] = useState(true);
  const [priceError, setPriceError] = useState<string>('');
  const [isLocationSelectorVisible, setLocationSelectorVisible] = useState(false);
  
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

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
    setLocationSelectorVisible(false);
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
      const currentVideoCount = media.filter(m => m.type === 'video').length;
      if (currentVideoCount >= 2) {
        Alert.alert('Video Limit', 'You can add up to 2 product videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const availableSlots = 2 - currentVideoCount;
        const selected = result.assets.slice(0, availableSlots);

        const validAssets = selected.filter(asset => !asset.duration || asset.duration <= 60000);
        if (validAssets.length < selected.length) {
          Alert.alert('Video Too Long', 'Videos longer than 60 seconds were skipped.');
        }

        const newVideos = validAssets.map((asset, index) => ({
          uri: asset.uri,
          id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'video' as const
        }));

        if (newVideos.length === 0) return;

        setMedia(prev => [...prev, ...newVideos].slice(0, 6));
      }
    } catch (error) {
      console.error('Error picking videos:', error);
      Alert.alert('Error', 'Failed to pick videos. Please try again.');
    }
  };

  const removeMedia = (mediaId: string) => {
    setMedia(prev => prev.filter(m => m.id !== mediaId));
  };

  const hasVideo = media.some(m => m.type === 'video');

  useEffect(() => {
    if (!hasVideo && isMultiItem) {
      setIsMultiItem(false);
    }
  }, [hasVideo]);

  // Keep the primary variant (item 1) synced with the first product video
  useEffect(() => {
    if (!isMultiItem) return;

    const firstVideo = media.find(m => m.type === 'video');
    const primaryIndex = variants.findIndex(v => v.isPrimary);
    if (primaryIndex === -1) return;

    setVariants(prev => {
      const primary = prev[primaryIndex];
      if (firstVideo) {
        if (primary.mediaUri === firstVideo.uri && primary.mediaType === 'video') return prev;
        const next = [...prev];
        next[primaryIndex] = { ...primary, mediaUri: firstVideo.uri, mediaType: 'video' };
        return next;
      }
      if (primary.mediaUri) {
        const next = [...prev];
        next[primaryIndex] = { ...primary, mediaUri: null, mediaType: null };
        return next;
      }
      return prev;
    });
  }, [media, isMultiItem]);

  const updateVariant = (id: string, updates: Partial<ProductVariantForm>) => {
    setVariants(prev => prev.map(v => (v.id === id ? { ...v, ...updates } : v)));
  };

  const addVariant = () => {
    setVariants(prev => [...prev, createEmptyVariant()]);
  };

  const removeVariant = (id: string) => {
    setVariants(prev => (prev.length > 1 ? prev.filter(v => v.id !== id) : prev));
  };

  const pickVariantMedia = async (variantId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
        if (mediaType === 'video' && asset.duration && asset.duration > 60000) {
          Alert.alert('Video Too Long', 'Please select a video shorter than 60 seconds.');
          return;
        }
        updateVariant(variantId, { mediaUri: asset.uri, mediaType, isPrimary: false });
      }
    } catch (error) {
      console.error('Error picking variant media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (!productName.trim() || !description.trim() || !categoryId) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!isMultiItem && !fretiAmount.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!isMultiItem && !isPriceValid) {
      Alert.alert('Price Error', priceError || 'Please fix price validation errors.');
      return;
    }

    if (media.length === 0) {
      Alert.alert('No Media', 'Please add at least one photo or video of your product.');
      return;
    }

    let validVariants: ProductVariantForm[] = [];
    if (isMultiItem) {
      validVariants = variants.filter(v => v.name.trim() && v.price.trim() && v.mediaUri);
      if (validVariants.length === 0) {
        Alert.alert('Missing Items', 'Please add at least one item with a name, price, and media.');
        return;
      }
      const invalidPrice = validVariants.some(v => isNaN(parseFloat(v.price)) || parseFloat(v.price) < 0);
      if (invalidPrice) {
        Alert.alert('Invalid Price', 'Please enter a valid price for each item.');
        return;
      }
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

      // Separate images and videos. For multi-item, the primary variant's media
      // is sent as variant_media, not duplicated as product media.
      const primaryVariant = isMultiItem ? variants.find(v => v.isPrimary) : undefined;
      const primaryUri = primaryVariant?.mediaUri || undefined;
      const images = media.filter(m => m.type === 'image' && m.uri !== primaryUri);
      const videos = media.filter(m => m.type === 'video' && m.uri !== primaryUri);

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
      const overallPrice = isMultiItem
        ? Math.min(...validVariants.map(v => parseFloat(v.price)))
        : parseFloat(fretiAmount);

      formData.append('name', productName.trim());
      formData.append('description', description.trim());
      formData.append('price', String(overallPrice));
      formData.append('category_id', categoryId);
      formData.append('condition', condition);
      formData.append('quantity', quantity);
      formData.append('location', location.trim());
      formData.append('tags', JSON.stringify(tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)));
      formData.append('shipping_options', JSON.stringify(shippingOptions));
      formData.append('is_multi_item', String(isMultiItem));

      if (isMultiItem) {
        const variantMeta = validVariants.map((variant, index) => {
          const fileExtension = variant.mediaType === 'video' ? 'mp4' : 'jpg';
          const fileName = `variant_${Date.now()}_${index}.${fileExtension}`;
          formData.append('variant_media', {
            uri: variant.mediaUri,
            type: variant.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
            name: fileName,
          } as any);
          return {
            name: variant.name.trim(),
            price: parseFloat(variant.price),
            mediaIndex: index,
            mediaType: variant.mediaType,
          };
        });
        formData.append('variants', JSON.stringify(variantMeta));
      }

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
    setIsMultiItem(false);
    setVariants([{ ...createEmptyVariant(), isPrimary: true }]);
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
            data={[...media].reverse()}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.imagesList}
            ListHeaderComponent={
              media.length < 6 ? (
                <TouchableOpacity style={styles.addImageButton} onPress={pickMedia}>
                  <Ionicons name="add-circle" size={32} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.addImageText}>Add Media</Text>
                </TouchableOpacity>
              ) : null
            }
          />

          {hasVideo && (
            <TouchableOpacity
              style={styles.multiItemToggle}
              onPress={() => setIsMultiItem(prev => !prev)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.multiItemToggleTitle}>Multiple Items in this Video</Text>
                <Text style={styles.multiItemToggleSubtitle}>
                  Showcase several products in one advert video. Buyers pick the item they want.
                </Text>
              </View>
              <View style={[styles.switchTrack, isMultiItem && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, isMultiItem && styles.switchThumbActive]} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Multi-Item Variants Section */}
        {isMultiItem && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items in this Video *</Text>
            <Text style={styles.sectionSubtitle}>
              Add each item's name, price, and media. Buyers will tap between them.
            </Text>

            {variants.map((variant, index) => (
              <View key={variant.id} style={styles.variantCard}>
                <View style={styles.variantHeader}>
                  <Text style={styles.variantIndexLabel}>{variant.isPrimary ? 'Primary Item (Showcase)' : `Item ${index + 1}`}</Text>
                  {variants.length > 1 && (
                    <TouchableOpacity onPress={() => removeVariant(variant.id)}>
                      <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.variantRow}>
                  <TouchableOpacity
                    style={styles.variantMediaPicker}
                    onPress={() => pickVariantMedia(variant.id)}
                  >
                    {variant.mediaUri ? (
                      variant.mediaType === 'video' ? (
                        <View style={styles.variantMediaThumb}>
                          <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.8)" />
                        </View>
                      ) : (
                        <Image source={{ uri: variant.mediaUri }} style={styles.variantMediaThumb} />
                      )
                    ) : (
                      <Ionicons name="add" size={28} color="rgba(255,255,255,0.6)" />
                    )}
                  </TouchableOpacity>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <TextInput
                      style={[styles.textInput, { marginBottom: 8 }]}
                      value={variant.name}
                      onChangeText={(text) => updateVariant(variant.id, { name: text })}
                      placeholder="Item name"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      maxLength={100}
                    />
                    <DualCurrencyInput
                      localCurrency={variant.localCurrency}
                      onLocalCurrencyChange={(currency) => updateVariant(variant.id, { localCurrency: currency })}
                      localAmount={variant.localAmount}
                      fretiAmount={variant.price}
                      onLocalAmountChange={(text) => updateVariant(variant.id, { localAmount: text })}
                      onFretiAmountChange={(text) => updateVariant(variant.id, { price: text })}
                      title="Item Price *"
                      placeholder="0.00"
                      supportedCurrencies={supportedCurrencies}
                      minAmount={0.01}
                      maxAmount={1000000}
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addVariantButton} onPress={addVariant}>
              <Ionicons name="add-circle-outline" size={20} color="#F39C12" />
              <Text style={styles.addVariantText}>Add Another Item</Text>
            </TouchableOpacity>
          </View>
        )}

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

          {/* Dual Currency Pricing (hidden for multi-item — each item has its own price) */}
          {!isMultiItem && (
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
          )}

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
                  {location || 'Select location'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
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
  multiItemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243,156,18,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.3)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  multiItemToggleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  multiItemToggleSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 16,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#F39C12',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  variantCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  variantIndexLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  variantRow: {
    flexDirection: 'row',
  },
  variantMediaPicker: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  variantMediaThumb: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  addVariantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.4)',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addVariantText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default ProductUploadScreen;