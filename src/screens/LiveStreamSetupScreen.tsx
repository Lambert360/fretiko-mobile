import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { liveSalesAPI, CreateStreamData, TimeSlot } from '../services/liveSalesAPI';
import { productsAPI, Product } from '../services/productsAPI';
import { servicesAPI, Service } from '../services/servicesAPI';

/**
 * Live Stream Setup Screen
 * 
 * Pre-stream configuration interface for vendors:
 * - Set stream title and description
 * - Choose stream type (products or services)
 * - Select products/services to feature
 * - Set live prices and stock
 * - Upload thumbnail
 * - Preview and go live
 */

interface SelectedProduct {
  product_id: string;
  product: Product;
  live_price: number;
  live_stock: number;
  display_order: number;
  is_featured: boolean;
}

const LiveStreamSetupScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // Stream configuration
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [streamType, setStreamType] = useState<'products' | 'services'>('products');
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  // Available items
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);

  // Selected items
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  // Time slots for services
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [slotDate, setSlotDate] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('');
  const [slotEndTime, setSlotEndTime] = useState('');
  const [slotDuration, setSlotDuration] = useState('60');

  // Product selection modal
  const [isProductModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SelectedProduct | null>(null);
  const [editLivePrice, setEditLivePrice] = useState('');
  const [editLiveStock, setEditLiveStock] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Load vendor's products and services
  useEffect(() => {
    loadVendorItems();
  }, []);

  const loadVendorItems = async () => {
    try {
      setLoading(true);
      const [products, services] = await Promise.all([
        productsAPI.getMyProducts(),
        servicesAPI.getMyServices(),
      ]);
      setAvailableProducts(products.filter(p => p.status === 'active'));
      setAvailableServices(services.filter(s => s.status === 'active'));
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load your products and services');
    } finally {
      setLoading(false);
    }
  };

  // Select thumbnail image
  const selectThumbnail = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
      aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
      setThumbnailUri(result.assets[0].uri);
    }
  };

  // Add product to stream
  const handleAddProduct = (product: Product) => {
    if (selectedProducts.some(p => p.product_id === product.id)) {
      Alert.alert('Already Added', 'This product is already in your stream');
        return;
      }

    const newProduct: SelectedProduct = {
      product_id: product.id,
      product: product,
      live_price: product.price,
      live_stock: product.quantity,
      display_order: selectedProducts.length,
      is_featured: false,
    };

    setEditingProduct(newProduct);
    setEditLivePrice(product.price.toString());
    setEditLiveStock(product.quantity.toString());
  };

  // Save product configuration
  const handleSaveProductConfig = () => {
    if (!editingProduct) return;

    const livePrice = parseFloat(editLivePrice);
    const liveStock = parseInt(editLiveStock);

    if (isNaN(livePrice) || livePrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid live price');
          return;
        }

    if (isNaN(liveStock) || liveStock <= 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity');
          return;
        }

    if (liveStock > editingProduct.product.quantity) {
      Alert.alert('Invalid Stock', 'Live stock cannot exceed available quantity');
          return;
        }

    const updatedProduct = {
      ...editingProduct,
      live_price: livePrice,
      live_stock: liveStock,
    };

    const existingIndex = selectedProducts.findIndex(p => p.product_id === editingProduct.product_id);
    
    if (existingIndex >= 0) {
      const updated = [...selectedProducts];
      updated[existingIndex] = updatedProduct;
      setSelectedProducts(updated);
    } else {
      setSelectedProducts([...selectedProducts, updatedProduct]);
    }

    setEditingProduct(null);
    setEditLivePrice('');
    setEditLiveStock('');
  };

  // Remove product from stream
  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.product_id !== productId));
  };

  // Toggle product featured status
  const toggleFeatured = (productId: string) => {
    setSelectedProducts(
      selectedProducts.map(p =>
        p.product_id === productId ? { ...p, is_featured: !p.is_featured } : p
      )
    );
  };

  // Time slot management
  const handleAddTimeSlot = () => {
    if (!slotDate || !slotStartTime || !slotEndTime) {
      Alert.alert('Missing Information', 'Please fill in date, start time, and end time.');
      return;
    }

    const duration = parseInt(slotDuration) || 60;
    if (duration <= 0) {
      Alert.alert('Invalid Duration', 'Duration must be greater than 0 minutes.');
      return;
    }

    const newSlot: TimeSlot = {
      id: Date.now().toString(),
      date: slotDate,
      start_time: slotStartTime,
      end_time: slotEndTime,
      duration_minutes: duration,
      is_available: true,
    };

    if (editingSlot) {
      setTimeSlots(timeSlots.map(s => s.id === editingSlot.id ? newSlot : s));
      setEditingSlot(null);
    } else {
      setTimeSlots([...timeSlots, newSlot]);
    }

    // Reset form
    setSlotDate('');
    setSlotStartTime('');
    setSlotEndTime('');
    setSlotDuration('60');
    setShowSlotModal(false);
  };

  const handleEditTimeSlot = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setSlotDate(slot.date);
    setSlotStartTime(slot.start_time);
    setSlotEndTime(slot.end_time);
    setSlotDuration(slot.duration_minutes.toString());
    setShowSlotModal(true);
  };

  const handleRemoveTimeSlot = (slotId: string) => {
    setTimeSlots(timeSlots.filter(s => s.id !== slotId));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Create stream and navigate to broadcast screen
  const handleGoLive = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your live stream');
      return;
    }

    if (streamType === 'products' && selectedProducts.length === 0) {
      Alert.alert('No Products', 'Please add at least one product to your stream');
      return;
    }

    try {
      setCreating(true);

      const streamData: CreateStreamData = {
        title: title.trim(),
        description: description.trim() || undefined,
        stream_type: streamType,
        thumbnail_url: thumbnailUri || undefined,
        products: streamType === 'products' ? selectedProducts.map(p => ({
          product_id: p.product_id,
          live_price: p.live_price,
          live_stock: p.live_stock,
          display_order: p.display_order,
          is_featured: p.is_featured,
        })) : undefined,
        time_slots: streamType === 'services' && timeSlots.length > 0 ? timeSlots.map(slot => ({
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_minutes: slot.duration_minutes,
        })) : undefined,
      };

      const stream = await liveSalesAPI.createStream(streamData);

      Alert.alert(
        'Stream Created',
        'Your live stream is ready. Start broadcasting now!',
        [
          {
            text: 'Go Live',
            onPress: () => navigation.replace('LiveStreamBroadcast', { stream }),
          },
        ],
        { cancelable: false }
      );
    } catch (error: any) {
      console.error('Error creating stream:', error);
      Alert.alert('Error', error.message || 'Failed to create live stream');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading your products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Setup Live Stream</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Stream Type Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stream Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, streamType === 'products' && styles.typeButtonActive]}
              onPress={() => setStreamType('products')}
            >
              <Ionicons
                name="storefront"
                size={24}
                color={streamType === 'products' ? '#3498DB' : '#666'}
              />
              <Text
          style={[
                  styles.typeButtonText,
                  streamType === 'products' && styles.typeButtonTextActive,
                ]}
              >
                Products
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeButton, streamType === 'services' && styles.typeButtonActive]}
              onPress={() => setStreamType('services')}
            >
              <Ionicons
                name="hammer"
                size={24}
                color={streamType === 'services' ? '#3498DB' : '#666'}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  streamType === 'services' && styles.typeButtonTextActive,
                ]}
              >
                Services
              </Text>
            </TouchableOpacity>
          </View>
      </View>

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stream Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Flash Sale - Up to 50% Off!"
            placeholderTextColor="#666"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Tell viewers what to expect..."
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Thumbnail */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thumbnail (Optional)</Text>
          <TouchableOpacity style={styles.thumbnailButton} onPress={selectThumbnail}>
            {thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={styles.thumbnailImage} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Ionicons name="image-outline" size={40} color="#666" />
                <Text style={styles.thumbnailPlaceholderText}>Tap to select thumbnail</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Time Slots Section - Only for Services */}
        {streamType === 'services' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Available Time Slots ({timeSlots.length})
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setEditingSlot(null);
                  setSlotDate('');
                  setSlotStartTime('');
                  setSlotEndTime('');
                  setSlotDuration('60');
                  setShowSlotModal(true);
                }}
              >
                <Ionicons name="time" size={20} color="#3498DB" />
                <Text style={styles.addButtonText}>Add Slot</Text>
              </TouchableOpacity>
            </View>

            {timeSlots.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={60} color="#444" />
                <Text style={styles.emptyText}>No time slots configured</Text>
                <Text style={styles.emptySubtext}>Viewers can book services during these times</Text>
              </View>
            ) : (
              <View style={styles.slotsList}>
                {timeSlots.map((slot) => (
                  <View key={slot.id} style={styles.slotCard}>
                    <View style={styles.slotInfo}>
                      <View style={styles.slotRow}>
                        <Ionicons name="calendar" size={16} color="#3498DB" />
                        <Text style={styles.slotDate}>{formatDate(slot.date)}</Text>
                      </View>
                      <View style={styles.slotRow}>
                        <Ionicons name="time" size={16} color="#3498DB" />
                        <Text style={styles.slotTime}>
                          {slot.start_time} - {slot.end_time}
                        </Text>
                      </View>
                      <Text style={styles.slotDuration}>{slot.duration_minutes} min duration</Text>
                    </View>
                    <View style={styles.slotActions}>
                      <TouchableOpacity
                        style={styles.slotEdit}
                        onPress={() => handleEditTimeSlot(slot)}
                      >
                        <Ionicons name="pencil" size={18} color="#3498DB" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.slotDelete}
                        onPress={() => handleRemoveTimeSlot(slot.id)}
                      >
                        <Ionicons name="trash" size={18} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Products Section */}
        {streamType === 'products' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Products ({selectedProducts.length})
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setProductModalVisible(true)}
              >
                <Ionicons name="add-circle" size={20} color="#3498DB" />
                <Text style={styles.addButtonText}>Add Products</Text>
              </TouchableOpacity>
            </View>

            {selectedProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cart-outline" size={60} color="#444" />
                <Text style={styles.emptyText}>No products added yet</Text>
                <Text style={styles.emptySubtext}>Tap "Add Products" to get started</Text>
            </View>
          ) : (
              <View style={styles.productsList}>
                {selectedProducts.map((item, index) => (
                  <View key={item.product_id} style={styles.productCard}>
                    <Image
                      source={{ uri: item.product.primary_image_url || 'https://via.placeholder.com/60' }}
                      style={styles.productImage}
                    />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <View style={styles.productPriceRow}>
                        <View>
                          <Text style={styles.productLabel}>Live Price</Text>
                          <Text style={styles.productPrice}>₣{item.live_price}</Text>
                        </View>
                        <View>
                          <Text style={styles.productLabel}>Stock</Text>
                          <Text style={styles.productStock}>{item.live_stock}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.productActions}>
                      <TouchableOpacity
                        onPress={() => toggleFeatured(item.product_id)}
                        style={styles.iconButton}
                      >
                        <Ionicons
                          name={item.is_featured ? 'star' : 'star-outline'}
                          size={22}
                          color={item.is_featured ? '#FFD700' : '#666'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingProduct(item);
                          setEditLivePrice(item.live_price.toString());
                          setEditLiveStock(item.live_stock.toString());
                        }}
                        style={styles.iconButton}
                      >
                        <Ionicons name="create-outline" size={22} color="#3498DB" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveProduct(item.product_id)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="trash-outline" size={22} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.section}>
          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={24} color="#FFD700" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Pro Tips</Text>
              <Text style={styles.tipText}>
                • Use an eye-catching title to attract viewers{'\n'}
                • Set competitive live prices{'\n'}
                • Feature your best products{'\n'}
                • Ensure good lighting and stable internet
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Product Selection Modal */}
      <Modal
        visible={isProductModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setProductModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setProductModalVisible(false)}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Products</Text>
            <View style={{ width: 28 }} />
          </View>

          <FlatList
            data={availableProducts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedProducts.some(p => p.product_id === item.id);
              return (
                <TouchableOpacity
                  style={[styles.modalProductCard, isSelected && styles.modalProductCardSelected]}
                  onPress={() => !isSelected && handleAddProduct(item)}
                  disabled={isSelected}
                >
                  <Image
                    source={{ uri: item.primary_image_url || 'https://via.placeholder.com/50' }}
                    style={styles.modalProductImage}
                  />
                  <View style={styles.modalProductInfo}>
                    <Text style={styles.modalProductName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.modalProductPrice}>₣{item.price}</Text>
                    <Text style={styles.modalProductStock}>Stock: {item.quantity}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color="#27AE60" />}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.modalList}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={60} color="#444" />
                <Text style={styles.emptyText}>No active products</Text>
                <Text style={styles.emptySubtext}>Create products first to add them to streams</Text>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* Time Slot Modal */}
      <Modal
        visible={showSlotModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSlotModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => setShowSlotModal(false)}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingSlot ? 'Edit Time Slot' : 'Add Time Slot'}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 20 }}>
            {/* Date Input */}
            <Text style={styles.inputLabel}>Date *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD (e.g., 2024-12-25)"
              placeholderTextColor="#666"
              value={slotDate}
              onChangeText={setSlotDate}
            />

            {/* Start Time */}
            <Text style={styles.inputLabel}>Start Time *</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM (e.g., 14:00)"
              placeholderTextColor="#666"
              value={slotStartTime}
              onChangeText={setSlotStartTime}
            />

            {/* End Time */}
            <Text style={styles.inputLabel}>End Time *</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM (e.g., 16:00)"
              placeholderTextColor="#666"
              value={slotEndTime}
              onChangeText={setSlotEndTime}
            />

            {/* Duration */}
            <Text style={styles.inputLabel}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              placeholder="60"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={slotDuration}
              onChangeText={setSlotDuration}
            />

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddTimeSlot}
            >
              <Text style={styles.saveButtonText}>{editingSlot ? 'Update Slot' : 'Add Slot'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Product Edit Modal */}
      <Modal
        visible={!!editingProduct}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditingProduct(null)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Configure Product</Text>
            
            {editingProduct && (
              <>
                <Text style={styles.editModalProductName}>{editingProduct.product.name}</Text>
                <Text style={styles.editModalProductOriginal}>
                  Original Price: ₣{editingProduct.product.price}
                </Text>

                <View style={styles.editInputGroup}>
                  <Text style={styles.editLabel}>Live Price *</Text>
                  <TextInput
                    style={styles.editInput}
                    placeholder="Enter live price"
                    placeholderTextColor="#666"
                    value={editLivePrice}
                    onChangeText={setEditLivePrice}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.editInputGroup}>
                  <Text style={styles.editLabel}>Live Stock *</Text>
                  <TextInput
                    style={styles.editInput}
                    placeholder="Enter stock quantity"
                    placeholderTextColor="#666"
                    value={editLiveStock}
                    onChangeText={setEditLiveStock}
                    keyboardType="numeric"
                  />
                  <Text style={styles.editHint}>
                    Max: {editingProduct.product.quantity} available
                  </Text>
                </View>

                <View style={styles.editModalActions}>
                  <TouchableOpacity
                    style={styles.editModalCancelButton}
                    onPress={() => setEditingProduct(null)}
                  >
                    <Text style={styles.editModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editModalSaveButton}
                    onPress={handleSaveProductConfig}
                  >
                    <Text style={styles.editModalSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Bottom Action Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={[styles.goLiveButton, creating && styles.goLiveButtonDisabled]}
          onPress={handleGoLive}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="videocam" size={24} color="white" />
              <Text style={styles.goLiveButtonText}>Go Live</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  headerRight: {
    width: 38,
  },
  loadingText: {
    color: '#888',
    marginTop: 10,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  typeButtonActive: {
    borderColor: '#3498DB',
    backgroundColor: '#1a2533',
  },
  typeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#3498DB',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  thumbnailButton: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    aspectRatio: 16 / 9,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderText: {
    color: '#666',
    marginTop: 10,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addButtonText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 10,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
  },
  productsList: {
    gap: 10,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    marginLeft: 10,
  },
  productName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  productPriceRow: {
    flexDirection: 'row',
    gap: 20,
  },
  productLabel: {
    color: '#666',
    fontSize: 11,
    marginBottom: 2,
  },
  productPrice: {
    color: '#27AE60',
    fontSize: 14,
    fontWeight: '600',
  },
  productStock: {
    color: '#888',
    fontSize: 14,
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 5,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  tipContent: {
    flex: 1,
    marginLeft: 10,
  },
  tipTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  tipText: {
    color: '#ccc',
    fontSize: 12,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  modalList: {
    padding: 15,
  },
  modalProductCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  modalProductCardSelected: {
    borderWidth: 2,
    borderColor: '#27AE60',
  },
  modalProductImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  modalProductInfo: {
    flex: 1,
    marginLeft: 10,
  },
  modalProductName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  modalProductPrice: {
    color: '#27AE60',
    fontSize: 13,
    marginBottom: 2,
  },
  modalProductStock: {
    color: '#888',
    fontSize: 12,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
    textAlign: 'center',
  },
  editModalProductName: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginBottom: 5,
  },
  editModalProductOriginal: {
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  editInputGroup: {
    marginBottom: 15,
  },
  editLabel: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  editHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  editModalCancelButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
  },
  editModalCancelText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  editModalSaveButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#3498DB',
    borderRadius: 8,
    alignItems: 'center',
  },
  editModalSaveText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    paddingTop: 15,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    paddingVertical: 16,
  },
  goLiveButtonDisabled: {
    opacity: 0.6,
  },
  goLiveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Time Slot Styles
  slotsList: {
    gap: 12,
  },
  slotCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotInfo: {
    flex: 1,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotDate: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  slotTime: {
    color: '#999',
    fontSize: 14,
    marginLeft: 8,
  },
  slotDuration: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  slotActions: {
    flexDirection: 'row',
    gap: 12,
  },
  slotEdit: {
    padding: 8,
  },
  slotDelete: {
    padding: 8,
  },
  inputLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: '#3498DB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LiveStreamSetupScreen;
