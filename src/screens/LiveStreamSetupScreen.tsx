import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { liveSalesAPI } from '../services/liveSalesAPI';
import * as ImagePicker from 'expo-image-picker';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Product selection interface
interface ProductForStream {
  id: string;
  name: string;
  primary_image_url?: string;
  regular_price: number;
  live_price: number;
  live_stock: number;
  selected: boolean;
}

// Stream setup steps
enum SetupStep {
  STREAM_TYPE = 'stream_type',
  PRODUCT_SELECTION = 'product_selection',
  STREAM_CONFIG = 'stream_config',
  GO_LIVE_PREP = 'go_live_prep',
}

// Stream type selection component
const StreamTypeSelector = ({
  selectedType,
  onTypeSelect,
}: {
  selectedType: 'products' | 'services' | null;
  onTypeSelect: (type: 'products' | 'services') => void;
}) => (
  <View style={styles.typeSelector}>
    <Text style={styles.sectionTitle}>What are you selling today?</Text>
    <Text style={styles.sectionSubtitle}>Choose your stream type to get started</Text>

    <View style={styles.typeOptions}>
      <TouchableOpacity
        style={[
          styles.typeOption,
          selectedType === 'products' && styles.typeOptionSelected
        ]}
        onPress={() => onTypeSelect('products')}
      >
        <View style={[styles.typeIcon, { backgroundColor: '#3498DB' }]}>
          <Ionicons name="storefront" size={32} color="white" />
        </View>
        <Text style={styles.typeTitle}>Products</Text>
        <Text style={styles.typeDescription}>
          Showcase physical items, manage inventory, and enable instant purchases
        </Text>
        <View style={styles.typeFeatures}>
          <Text style={styles.typeFeature}>• Live inventory tracking</Text>
          <Text style={styles.typeFeature}>• Instant checkout</Text>
          <Text style={styles.typeFeature}>• Product showcase</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.typeOption,
          selectedType === 'services' && styles.typeOptionSelected
        ]}
        onPress={() => onTypeSelect('services')}
      >
        <View style={[styles.typeIcon, { backgroundColor: '#E67E22' }]}>
          <Ionicons name="hammer" size={32} color="white" />
        </View>
        <Text style={styles.typeTitle}>Services</Text>
        <Text style={styles.typeDescription}>
          Offer services, showcase your skills, and enable instant booking
        </Text>
        <View style={styles.typeFeatures}>
          <Text style={styles.typeFeature}>• Calendar integration</Text>
          <Text style={styles.typeFeature}>• Instant booking</Text>
          <Text style={styles.typeFeature}>• Skill showcase</Text>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);

// Product selection component
const ProductSelector = ({
  products,
  onProductToggle,
  onPriceChange,
  onStockChange,
}: {
  products: ProductForStream[];
  onProductToggle: (productId: string) => void;
  onPriceChange: (productId: string, price: number) => void;
  onStockChange: (productId: string, stock: number) => void;
}) => (
  <View style={styles.productSelector}>
    <Text style={styles.sectionTitle}>Select Products for Live Stream</Text>
    <Text style={styles.sectionSubtitle}>
      Choose products to feature and set live pricing
    </Text>

    <FlatList
      data={products}
      renderItem={({ item }) => (
        <View style={styles.productItem}>
          <TouchableOpacity
            style={styles.productSelectButton}
            onPress={() => onProductToggle(item.id)}
          >
            <View style={[
              styles.productCheckbox,
              item.selected && styles.productCheckboxSelected
            ]}>
              {item.selected && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>

          <Image
            source={{ uri: item.primary_image_url || 'https://via.placeholder.com/60x60' }}
            style={styles.productImage}
          />

          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.productRegularPrice}>
              Regular: ₣{item.regular_price.toFixed(2)}
            </Text>

            {item.selected && (
              <View style={styles.productLiveSettings}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Live Price</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={item.live_price.toString()}
                    onChangeText={(text) => {
                      const price = parseFloat(text) || 0;
                      onPriceChange(item.id, price);
                    }}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#888"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Live Stock</Text>
                  <TextInput
                    style={styles.stockInput}
                    value={item.live_stock.toString()}
                    onChangeText={(text) => {
                      const stock = parseInt(text) || 0;
                      onStockChange(item.id, stock);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#888"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      )}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
    />
  </View>
);

// Service setup component  
const ServiceSetup = ({
  displayImages,
  onAddImage,
  onRemoveImage,
}: {
  displayImages: string[];
  onAddImage: () => void;
  onRemoveImage: (index: number) => void;
}) => (
  <View style={styles.serviceSetup}>
    <Text style={styles.sectionTitle}>Service Stream Setup</Text>
    <Text style={styles.sectionSubtitle}>
      Add display photos to showcase your work (optional)
    </Text>

    <View style={styles.imageGallery}>
      {displayImages.map((image, index) => (
        <View key={index} style={styles.imageItem}>
          <Image source={{ uri: image }} style={styles.displayImage} />
          <TouchableOpacity
            style={styles.removeImageButton}
            onPress={() => onRemoveImage(index)}
          >
            <Ionicons name="close-circle" size={24} color="#FF4757" />
          </TouchableOpacity>
        </View>
      ))}

      {displayImages.length < 6 && (
        <TouchableOpacity style={styles.addImageButton} onPress={onAddImage}>
          <Ionicons name="camera" size={32} color="#888" />
          <Text style={styles.addImageText}>Add Photo</Text>
        </TouchableOpacity>
      )}
    </View>

    <View style={styles.serviceInstructions}>
      <Text style={styles.instructionTitle}>Tips for Service Streams:</Text>
      <Text style={styles.instruction}>• Show your workspace or tools</Text>
      <Text style={styles.instruction}>• Demonstrate your skills live</Text>
      <Text style={styles.instruction}>• Engage with viewers' questions</Text>
      <Text style={styles.instruction}>• Explain your process clearly</Text>
    </View>
  </View>
);

// Stream configuration component
const StreamConfig = ({
  title,
  description,
  thumbnail,
  onTitleChange,
  onDescriptionChange,
  onThumbnailSelect,
}: {
  title: string;
  description: string;
  thumbnail?: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onThumbnailSelect: () => void;
}) => (
  <View style={styles.streamConfig}>
    <Text style={styles.sectionTitle}>Stream Details</Text>
    <Text style={styles.sectionSubtitle}>
      Set up your stream information
    </Text>

    <View style={styles.configForm}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Stream Title *</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={onTitleChange}
          placeholder="Enter stream title..."
          placeholderTextColor="#888"
          maxLength={100}
        />
        <Text style={styles.charCount}>{title.length}/100</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Description</Text>
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Describe what you'll be showing..."
          placeholderTextColor="#888"
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Thumbnail (Optional)</Text>
        <TouchableOpacity style={styles.thumbnailSelector} onPress={onThumbnailSelect}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.thumbnailPreview} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="image" size={32} color="#888" />
              <Text style={styles.thumbnailText}>Add Thumbnail</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

// Go live preparation component
const GoLivePrep = ({
  streamType,
  selectedProducts,
  title,
  onGoLive,
  isLoading,
}: {
  streamType: 'products' | 'services';
  selectedProducts: ProductForStream[];
  title: string;
  onGoLive: () => void;
  isLoading: boolean;
}) => {
  const selectedCount = selectedProducts.filter(p => p.selected).length;

  return (
    <View style={styles.goLivePrep}>
      <Text style={styles.sectionTitle}>Ready to Go Live!</Text>
      <Text style={styles.sectionSubtitle}>
        Review your setup and arrange your space
      </Text>

      <View style={styles.prepSummary}>
        <View style={styles.summaryItem}>
          <Ionicons name="tv" size={20} color="#3498DB" />
          <Text style={styles.summaryText}>Stream: {title}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Ionicons 
            name={streamType === 'products' ? 'storefront' : 'hammer'} 
            size={20} 
            color="#27AE60" 
          />
          <Text style={styles.summaryText}>
            Type: {streamType === 'products' ? 'Products' : 'Services'}
          </Text>
        </View>

        {streamType === 'products' && (
          <View style={styles.summaryItem}>
            <Ionicons name="bag" size={20} color="#E67E22" />
            <Text style={styles.summaryText}>
              Products: {selectedCount} selected
            </Text>
          </View>
        )}
      </View>

      <View style={styles.prepInstructions}>
        <Text style={styles.instructionTitle}>Before going live:</Text>
        
        {streamType === 'products' ? (
          <>
            <Text style={styles.instruction}>• Arrange products in view of camera</Text>
            <Text style={styles.instruction}>• Ensure good lighting on products</Text>
            <Text style={styles.instruction}>• Have product details ready to share</Text>
            <Text style={styles.instruction}>• Test your camera and microphone</Text>
          </>
        ) : (
          <>
            <Text style={styles.instruction}>• Set up your workspace</Text>
            <Text style={styles.instruction}>• Prepare tools and materials</Text>
            <Text style={styles.instruction}>• Test your camera and microphone</Text>
            <Text style={styles.instruction}>• Plan your demonstration</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.goLiveButton, isLoading && styles.goLiveButtonDisabled]}
        onPress={onGoLive}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Ionicons name="videocam" size={24} color="white" />
        )}
        <Text style={styles.goLiveText}>
          {isLoading ? 'Starting Stream...' : 'Go Live Now'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Live Stream Setup Screen
 * 
 * Multi-step vendor flow for setting up live streams:
 * 1. Choose stream type (products vs services)
 * 2. Product selection OR service display setup
 * 3. Stream configuration (title, description, thumbnail)
 * 4. Go live preparation and launch
 */
const LiveStreamSetupScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Setup flow state
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.STREAM_TYPE);
  const [streamType, setStreamType] = useState<'products' | 'services' | null>(null);

  // Stream configuration
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState<string>();

  // Product stream state
  const [availableProducts, setAvailableProducts] = useState<ProductForStream[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Service stream state
  const [displayImages, setDisplayImages] = useState<string[]>([]);

  // UI state
  const [isCreating, setIsCreating] = useState(false);

  // Load user's products for product streams
  const loadUserProducts = async () => {
    setLoadingProducts(true);
    try {
      // TODO: Implement API call to get user's products
      // For now, using mock data
      const mockProducts: ProductForStream[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Handmade Leather Wallet',
          primary_image_url: 'https://via.placeholder.com/200x200',
          regular_price: 45.00,
          live_price: 40.00,
          live_stock: 5,
          selected: false,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Custom Phone Case',
          primary_image_url: 'https://via.placeholder.com/200x200',
          regular_price: 25.00,
          live_price: 20.00,
          live_stock: 10,
          selected: false,
        },
      ];
      setAvailableProducts(mockProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load your products.');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Handle stream type selection
  const handleTypeSelect = (type: 'products' | 'services') => {
    setStreamType(type);
    if (type === 'products') {
      loadUserProducts();
    }
  };

  // Handle product selection
  const handleProductToggle = (productId: string) => {
    setAvailableProducts(prev =>
      prev.map(product =>
        product.id === productId
          ? { ...product, selected: !product.selected }
          : product
      )
    );
  };

  // Handle product price change
  const handlePriceChange = (productId: string, price: number) => {
    setAvailableProducts(prev =>
      prev.map(product =>
        product.id === productId
          ? { ...product, live_price: price }
          : product
      )
    );
  };

  // Handle product stock change
  const handleStockChange = (productId: string, stock: number) => {
    setAvailableProducts(prev =>
      prev.map(product =>
        product.id === productId
          ? { ...product, live_stock: stock }
          : product
      )
    );
  };

  // Handle image selection for services
  const handleAddImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permission to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setDisplayImages(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  // Handle image removal
  const handleRemoveImage = (index: number) => {
    setDisplayImages(prev => prev.filter((_, i) => i !== index));
  };

  // Handle thumbnail selection
  const handleThumbnailSelect = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permission to add thumbnail.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setThumbnail(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking thumbnail:', error);
      Alert.alert('Error', 'Failed to select thumbnail.');
    }
  };

  // Handle next step
  const handleNextStep = () => {
    switch (currentStep) {
      case SetupStep.STREAM_TYPE:
        if (!streamType) {
          Alert.alert('Selection Required', 'Please choose a stream type.');
          return;
        }
        setCurrentStep(
          streamType === 'products' 
            ? SetupStep.PRODUCT_SELECTION 
            : SetupStep.STREAM_CONFIG
        );
        break;

      case SetupStep.PRODUCT_SELECTION:
        const selectedProducts = availableProducts.filter(p => p.selected);
        if (selectedProducts.length === 0) {
          Alert.alert('Products Required', 'Please select at least one product.');
          return;
        }
        setCurrentStep(SetupStep.STREAM_CONFIG);
        break;

      case SetupStep.STREAM_CONFIG:
        if (!title.trim()) {
          Alert.alert('Title Required', 'Please enter a stream title.');
          return;
        }
        setCurrentStep(SetupStep.GO_LIVE_PREP);
        break;
    }
  };

  // Handle back step
  const handleBackStep = () => {
    switch (currentStep) {
      case SetupStep.STREAM_TYPE:
        navigation.goBack();
        break;
      case SetupStep.PRODUCT_SELECTION:
        setCurrentStep(SetupStep.STREAM_TYPE);
        break;
      case SetupStep.STREAM_CONFIG:
        setCurrentStep(
          streamType === 'products'
            ? SetupStep.PRODUCT_SELECTION
            : SetupStep.STREAM_TYPE
        );
        break;
      case SetupStep.GO_LIVE_PREP:
        setCurrentStep(SetupStep.STREAM_CONFIG);
        break;
    }
  };

  // Handle go live
  const handleGoLive = async () => {
    setIsCreating(true);
    try {
      const selectedProducts = availableProducts.filter(p => p.selected);
      
      const streamData = {
        title: title.trim(),
        description: description.trim(),
        stream_type: streamType!,
        thumbnail_url: thumbnail,
        // TEMPORARILY REMOVE products to test basic stream creation
        // ...(streamType === 'products' && {
        //   products: selectedProducts.map((product, index) => ({
        //     product_id: product.id,
        //     live_price: product.live_price,
        //     live_stock: product.live_stock,
        //     display_order: index,
        //     is_featured: index === 0, // First product is featured
        //   }))
        // })
      };

      console.log('🚀 Sending stream data:', JSON.stringify(streamData, null, 2));
      const newStream = await liveSalesAPI.createStream(streamData);
      
      // Navigate to live streaming interface
      navigation.replace('LiveStreamHost', {
        streamId: newStream.id,
        stream: newStream
      });

    } catch (error) {
      console.error('Error creating stream:', error);
      Alert.alert('Error', 'Failed to create stream. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Get step progress
  const getStepProgress = () => {
    const steps = streamType === 'products' ? 4 : 3;
    let current = 1;
    
    switch (currentStep) {
      case SetupStep.STREAM_TYPE: current = 1; break;
      case SetupStep.PRODUCT_SELECTION: current = 2; break;
      case SetupStep.STREAM_CONFIG: current = streamType === 'products' ? 3 : 2; break;
      case SetupStep.GO_LIVE_PREP: current = streamType === 'products' ? 4 : 3; break;
    }
    
    return { current, total: steps };
  };

  const progress = getStepProgress();

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackStep}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Set Up Live Stream</Text>
          <Text style={styles.headerProgress}>
            Step {progress.current} of {progress.total}
          </Text>
        </View>
        
        <View style={styles.headerRight} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${(progress.current / progress.total) * 100}%` }
          ]} 
        />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep === SetupStep.STREAM_TYPE && (
          <StreamTypeSelector
            selectedType={streamType}
            onTypeSelect={handleTypeSelect}
          />
        )}

        {currentStep === SetupStep.PRODUCT_SELECTION && streamType === 'products' && (
          loadingProducts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3498DB" />
              <Text style={styles.loadingText}>Loading your products...</Text>
            </View>
          ) : (
            <ProductSelector
              products={availableProducts}
              onProductToggle={handleProductToggle}
              onPriceChange={handlePriceChange}
              onStockChange={handleStockChange}
            />
          )
        )}

        {currentStep === SetupStep.STREAM_CONFIG && streamType === 'services' && (
          <ServiceSetup
            displayImages={displayImages}
            onAddImage={handleAddImage}
            onRemoveImage={handleRemoveImage}
          />
        )}

        {currentStep === SetupStep.STREAM_CONFIG && (
          <StreamConfig
            title={title}
            description={description}
            thumbnail={thumbnail}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onThumbnailSelect={handleThumbnailSelect}
          />
        )}

        {currentStep === SetupStep.GO_LIVE_PREP && (
          <GoLivePrep
            streamType={streamType!}
            selectedProducts={availableProducts}
            title={title}
            onGoLive={handleGoLive}
            isLoading={isCreating}
          />
        )}
      </ScrollView>

      {/* Bottom action button */}
      {currentStep !== SetupStep.GO_LIVE_PREP && (
        <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
            <Text style={styles.nextButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerProgress: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },

  // Progress bar
  progressBar: {
    height: 3,
    backgroundColor: '#333',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 2,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Common styles
  sectionTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },

  // Stream type selector
  typeSelector: {
    paddingVertical: 20,
  },
  typeOptions: {
    gap: 20,
  },
  typeOption: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    borderColor: '#3498DB',
    backgroundColor: '#1a2a3a',
  },
  typeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  typeTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  typeDescription: {
    color: '#CCC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  typeFeatures: {
    gap: 4,
  },
  typeFeature: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },

  // Product selector
  productSelector: {
    paddingVertical: 20,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  productSelectButton: {
    marginRight: 12,
    marginTop: 4,
  },
  productCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCheckboxSelected: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productRegularPrice: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  productLiveSettings: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 4,
  },
  priceInput: {
    backgroundColor: '#2a2a2a',
    color: 'white',
    padding: 8,
    borderRadius: 6,
    fontSize: 14,
  },
  stockInput: {
    backgroundColor: '#2a2a2a',
    color: 'white',
    padding: 8,
    borderRadius: 6,
    fontSize: 14,
  },

  // Service setup
  serviceSetup: {
    paddingVertical: 20,
  },
  imageGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  imageItem: {
    position: 'relative',
  },
  displayImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#666',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  serviceInstructions: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  instructionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  instruction: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 18,
  },

  // Stream config
  streamConfig: {
    paddingVertical: 20,
  },
  configForm: {
    gap: 24,
  },
  titleInput: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  descriptionInput: {
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#333',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  thumbnailSelector: {
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#666',
    borderStyle: 'dashed',
  },
  thumbnailText: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },

  // Go live prep
  goLivePrep: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  prepSummary: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 24,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 12,
  },
  prepInstructions: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 32,
  },
  goLiveButton: {
    backgroundColor: '#FF4757',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  goLiveButtonDisabled: {
    opacity: 0.6,
  },
  goLiveText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Bottom action
  bottomAction: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  nextButton: {
    backgroundColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
});

export default LiveStreamSetupScreen;