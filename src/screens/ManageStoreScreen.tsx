import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  Animated,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { productsAPI, Product } from '../services/productsAPI';
import { servicesAPI, Service } from '../services/servicesAPI';
import { walletAPI } from '../services/walletAPI';
import { userAPI } from '../services/userAPI';
import { SafeImage } from '../components/SafeImage';
import LocationSelector from '../components/LocationSelector';

type StoreTab = 'products' | 'services';
type ProductFilter = 'all' | 'active' | 'hidden' | 'out';
type ServiceFilter = 'all' | 'active' | 'hidden';
type SelectedItem =
  | { kind: 'product'; item: Product }
  | { kind: 'service'; item: Service };

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like-new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

const AVAILABILITY_OPTIONS = [
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'evenings', label: 'Evenings' },
  { key: 'emergency', label: 'Emergency' },
] as const;

const BOOKING_TYPES = [
  { value: 'add_to_cart', label: 'Add to Cart' },
  { value: 'book_now', label: 'Book Now' },
] as const;

const ManageStoreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [storeTab, setStoreTab] = useState<StoreTab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);

  // Restock modal state (products only)
  const [isRestockVisible, setIsRestockVisible] = useState(false);
  const [restockValue, setRestockValue] = useState('');

  // Shared edit modal state
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTags, setEditTags] = useState('');

  // Product-specific edit state
  const [editQuantity, setEditQuantity] = useState('');
  const [editCondition, setEditCondition] = useState('new');
  const [editShipping, setEditShipping] = useState({ pickup: false, delivery: false, shipping: false });

  // Service-specific edit state
  const [editDuration, setEditDuration] = useState('');
  const [isLocationSelectorVisible, setLocationSelectorVisible] = useState(false);
  const [editAvailability, setEditAvailability] = useState({
    weekdays: false,
    weekends: false,
    evenings: false,
    emergency: false,
  });
  const [editBookingType, setEditBookingType] = useState<'add_to_cart' | 'book_now'>('add_to_cart');

  const [saving, setSaving] = useState(false);

  // Store visibility state (vendor-level, applies to whole catalog)
  const [catalogHidden, setCatalogHidden] = useState(false);
  const [isAdultContent, setIsAdultContent] = useState(false);
  const [isVisibilityVisible, setIsVisibilityVisible] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState<'catalog' | 'adult' | null>(null);

  const springAnim = useRef(new Animated.Value(1)).current;

  const loadStore = useCallback(async () => {
    try {
      const [productsData, servicesData, profileData] = await Promise.all([
        productsAPI.getMyProducts().catch(e => {
          console.error('Error loading products:', e);
          return [] as Product[];
        }),
        servicesAPI.getMyServices().catch(e => {
          console.error('Error loading services:', e);
          return [] as Service[];
        }),
        userAPI.getProfile().catch(e => {
          console.error('Error loading profile:', e);
          return null;
        }),
      ]);
      setProducts(productsData || []);
      setServices(servicesData || []);
      if (profileData) {
        setCatalogHidden(!!profileData.catalogHidden);
        setIsAdultContent(!!profileData.isAdultContent);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadStore();
    }, [loadStore])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadStore();
  };

  const updateProductInList = (updated: Product) => {
    setProducts(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)));
  };

  const updateServiceInList = (updated: Service) => {
    setServices(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)));
  };

  const handleVisibilityToggle = async (field: 'catalog' | 'adult') => {
    const prev = field === 'catalog' ? catalogHidden : isAdultContent;
    const next = !prev;
    if (field === 'catalog') setCatalogHidden(next); else setIsAdultContent(next);
    setSavingVisibility(field);
    try {
      await userAPI.updateProfile(
        field === 'catalog' ? { catalogHidden: next } : { isAdultContent: next },
      );
    } catch (e) {
      console.error('Error updating store visibility:', e);
      if (field === 'catalog') setCatalogHidden(prev); else setIsAdultContent(prev);
      Alert.alert('Error', 'Failed to update store visibility. Please try again.');
    } finally {
      setSavingVisibility(null);
    }
  };

  // ---------- Filters / counts ----------

  const isProductHidden = (p: Product) => p.status === 'inactive' || p.status === 'draft' || p.status === 'removed';
  const isServiceHidden = (s: Service) => s.status === 'inactive' || s.status === 'draft' || s.status === 'removed';
  const isOutOfStock = (p: Product) => (p.quantity ?? 0) <= 0;

  const matchesSearch = (name?: string, tags?: string[]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return name?.toLowerCase().includes(q) || tags?.some(t => t.toLowerCase().includes(q));
  };

  const productCounts = {
    all: products.length,
    active: products.filter(p => p.status === 'active').length,
    hidden: products.filter(isProductHidden).length,
    out: products.filter(isOutOfStock).length,
  };

  const serviceCounts = {
    all: services.length,
    active: services.filter(s => s.status === 'active').length,
    hidden: services.filter(isServiceHidden).length,
  };

  const filteredProducts = products.filter(p => {
    if (productFilter === 'active' && p.status !== 'active') return false;
    if (productFilter === 'hidden' && !isProductHidden(p)) return false;
    if (productFilter === 'out' && !isOutOfStock(p)) return false;
    return matchesSearch(p.name, p.tags);
  });

  const filteredServices = services.filter(s => {
    if (serviceFilter === 'active' && s.status !== 'active') return false;
    if (serviceFilter === 'hidden' && !isServiceHidden(s)) return false;
    return matchesSearch(s.name, s.tags);
  });

  // ---------- Actions ----------

  const openActionModal = (item: SelectedItem) => {
    setSelected(item);
    Animated.spring(springAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
    setIsActionModalVisible(true);
  };

  const closeActionModal = () => {
    setIsActionModalVisible(false);
    setSelected(null);
  };

  const handleView = () => {
    if (!selected) return;
    closeActionModal();
    if (selected.kind === 'product') {
      navigation.navigate('ProductDetails', { productId: selected.item.id });
    } else {
      navigation.navigate('ServiceDetails', { serviceId: selected.item.id });
    }
  };

  const openEditModal = () => {
    if (!selected) return;
    if (selected.kind === 'product') {
      const p = selected.item;
      setEditName(p.name || '');
      setEditPrice(String(p.price ?? ''));
      setEditDescription(p.description || '');
      setEditQuantity(String(p.quantity ?? 0));
      setEditCondition(p.condition || 'new');
      setEditLocation(p.location || '');
      setEditTags((p.tags || []).join(', '));
      setEditShipping({
        pickup: !!p.shipping_options?.pickup,
        delivery: !!p.shipping_options?.delivery,
        shipping: !!p.shipping_options?.shipping,
      });
    } else {
      const s = selected.item;
      setEditName(s.name || '');
      setEditPrice(String(s.base_price ?? ''));
      setEditDescription(s.description || '');
      setEditLocation(s.location || s.service_area || '');
      setEditTags((s.tags || []).join(', '));
      setEditDuration(s.duration || '');
      setEditAvailability({
        weekdays: !!s.availability?.weekdays,
        weekends: !!s.availability?.weekends,
        evenings: !!s.availability?.evenings,
        emergency: !!s.availability?.emergency,
      });
      setEditBookingType(s.booking_type || 'add_to_cart');
    }
    setIsActionModalVisible(false);
    setIsEditVisible(true);
  };

  const openRestockModal = () => {
    if (!selected || selected.kind !== 'product') return;
    setRestockValue(String(selected.item.quantity ?? 0));
    setIsActionModalVisible(false);
    setIsRestockVisible(true);
  };

  const handleSaveRestock = async () => {
    if (!selected || selected.kind !== 'product') return;
    const newQty = parseInt(restockValue, 10);
    if (isNaN(newQty) || newQty < 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid stock quantity.');
      return;
    }

    setSaving(true);
    try {
      const updated = await productsAPI.updateProduct(selected.item.id, { quantity: newQty });
      updateProductInList(updated);
      setIsRestockVisible(false);
      setSelected(null);
    } catch (error: any) {
      Alert.alert('Restock Failed', error?.message || 'Could not update stock. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const price = parseFloat(editPrice);

    if (!editName.trim()) {
      Alert.alert('Missing Name', 'A name is required.');
      return;
    }
    if (isNaN(price) || price < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      if (selected.kind === 'product') {
        const qty = parseInt(editQuantity, 10);
        if (isNaN(qty) || qty < 0) {
          Alert.alert('Invalid Quantity', 'Please enter a valid stock quantity.');
          setSaving(false);
          return;
        }
        if (!editShipping.pickup && !editShipping.delivery && !editShipping.shipping) {
          Alert.alert('Shipping Options', 'Please select at least one shipping/pickup option.');
          setSaving(false);
          return;
        }
        const updated = await productsAPI.updateProduct(selected.item.id, {
          name: editName.trim(),
          description: editDescription.trim(),
          price,
          quantity: qty,
          condition: editCondition,
          location: editLocation.trim(),
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          shipping_options: editShipping,
        });
        updateProductInList(updated);
      } else {
        const updated = await servicesAPI.updateService(selected.item.id, {
          name: editName.trim(),
          description: editDescription.trim(),
          base_price: price,
          duration: editDuration.trim() || undefined,
          location: editLocation.trim(),
          service_area: editLocation.trim(),
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          availability: editAvailability,
          booking_type: editBookingType,
        });
        updateServiceInList(updated);
      }
      setIsEditVisible(false);
      setSelected(null);
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!selected) return;
    const item = selected.item;
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    closeActionModal();
    try {
      if (selected.kind === 'product') {
        const updated = await productsAPI.updateProduct(item.id, { status: newStatus });
        updateProductInList(updated);
      } else {
        const updated = await servicesAPI.updateService(item.id, { status: newStatus });
        updateServiceInList(updated);
      }
      setTimeout(
        () =>
          Alert.alert(
            'Done',
            newStatus === 'inactive'
              ? `"${item.name}" is now hidden from buyers.`
              : `"${item.name}" is now visible to buyers.`
          ),
        100
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update visibility.');
    }
  };

  const handleMarkSold = async () => {
    if (!selected || selected.kind !== 'product') return;
    const product = selected.item;
    closeActionModal();
    try {
      const updated = await productsAPI.updateProduct(product.id, { status: 'sold' });
      updateProductInList(updated);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to mark product as sold.');
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    const kind = selected.kind;
    const item = selected.item;
    closeActionModal();

    Alert.alert(
      `Delete ${kind === 'product' ? 'Product' : 'Service'}`,
      `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (kind === 'product') {
                await productsAPI.deleteProduct(item.id);
                setProducts(prev => prev.filter(p => p.id !== item.id));
              } else {
                await servicesAPI.deleteService(item.id);
                setServices(prev => prev.filter(s => s.id !== item.id));
              }
              setTimeout(() => Alert.alert('Deleted', `Your ${kind} has been deleted.`), 100);
            } catch (error) {
              Alert.alert('Error', `Failed to delete ${kind}. Please try again.`);
            }
          },
        },
      ]
    );
  };

  // ---------- Render helpers ----------

  const renderStatusBadge = (status: string, hidden: boolean) => {
    let label = 'Active';
    let color = '#2ECC71';
    if (status === 'sold') {
      label = 'Sold';
      color = '#F39C12';
    } else if (status === 'removed') {
      label = 'Removed';
      color = '#E74C3C';
    } else if (hidden) {
      label = status === 'draft' ? 'Draft' : 'Hidden';
      color = '#8E8E93';
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const imageUri = item.primary_image_url || item.images?.[0];

    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
      >
        <View style={styles.thumbWrapper}>
          <SafeImage
            source={{ uri: imageUri }}
            style={styles.thumb}
            resizeMode="cover"
            fallbackText=""
          />
          {isOutOfStock(item) && (
            <View style={styles.outOverlay}>
              <Text style={styles.outOverlayText}>OUT</Text>
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>{walletAPI.formatFreti(item.price)}</Text>
          <View style={styles.metaRow}>
            {renderStatusBadge(item.status, isProductHidden(item))}
            <Text
              style={[
                styles.stockText,
                { color: (item.quantity ?? 0) <= 0 ? '#E74C3C' : (item.quantity ?? 0) <= 3 ? '#F39C12' : '#B0B0B0' },
              ]}
            >
              {(item.quantity ?? 0) <= 0 ? 'Out of stock' : `${item.quantity} in stock`}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Ionicons name="eye-outline" size={12} color="#666" />
            <Text style={styles.statsText}>{item.view_count ?? 0}</Text>
            <Ionicons name="heart-outline" size={12} color="#666" style={{ marginLeft: 10 }} />
            <Text style={styles.statsText}>{item.like_count ?? 0}</Text>
            {item.is_multi_item && (
              <Text style={styles.multiItemText}> · {item.variants?.length || 0} variants</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => openActionModal({ kind: 'product', item })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#888" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderService = ({ item }: { item: Service }) => {
    const imageUri = item.primary_media_url || item.images?.[0] || item.videos?.[0];

    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ServiceDetails', { serviceId: item.id })}
      >
        <View style={styles.thumbWrapper}>
          <SafeImage
            source={{ uri: imageUri }}
            style={styles.thumb}
            resizeMode="cover"
            fallbackText=""
          />
          {item.media_type === 'video' && (
            <View style={styles.videoBadge}>
              <Ionicons name="videocam" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>{walletAPI.formatFreti(item.base_price)}</Text>
          <View style={styles.metaRow}>
            {renderStatusBadge(item.status, isServiceHidden(item))}
            {item.duration ? <Text style={styles.stockText}>{item.duration}</Text> : null}
          </View>
          <View style={styles.statsRow}>
            <Ionicons name="eye-outline" size={12} color="#666" />
            <Text style={styles.statsText}>{item.view_count ?? 0}</Text>
            <Ionicons name="calendar-outline" size={12} color="#666" style={{ marginLeft: 10 }} />
            <Text style={styles.statsText}>{item.booking_count ?? 0} bookings</Text>
            <Ionicons name="heart-outline" size={12} color="#666" style={{ marginLeft: 10 }} />
            <Text style={styles.statsText}>{item.like_count ?? 0}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => openActionModal({ kind: 'service', item })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#888" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderProductFilterTab = (key: ProductFilter, label: string, count: number) => {
    const isActive = productFilter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.filterTab, isActive && styles.filterTabActive]}
        onPress={() => setProductFilter(key)}
      >
        <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderServiceFilterTab = (key: ServiceFilter, label: string, count: number) => {
    const isActive = serviceFilter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.filterTab, isActive && styles.filterTabActive]}
        onPress={() => setServiceFilter(key)}
      >
        <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    const isProducts = storeTab === 'products';
    const hasAny = isProducts ? products.length > 0 : services.length > 0;
    const uploadScreen = isProducts ? 'ProductUpload' : 'ServiceUpload';
    return (
      <View style={styles.centerContainer}>
        <Ionicons name={isProducts ? 'cube-outline' : 'construct-outline'} size={64} color="#444" />
        <Text style={styles.emptyTitle}>
          {hasAny ? 'No Matches' : isProducts ? 'No Products Yet' : 'No Services Yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {hasAny
            ? `No ${isProducts ? 'products' : 'services'} match this filter or search.`
            : isProducts
              ? 'List your first product to start selling on the marketplace.'
              : 'List your first service to start getting bookings.'}
        </Text>
        {!hasAny && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate(uploadScreen)}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.createButtonText}>
              {isProducts ? 'List Product' : 'List Service'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const selectedItem = selected?.item;
  const selectedIsProduct = selected?.kind === 'product';
  const selectedStatus = selectedItem?.status;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Store</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsVisibilityVisible(true)}
        >
          <Ionicons
            name={catalogHidden || isAdultContent ? 'eye-off' : 'eye'}
            size={22}
            color={catalogHidden || isAdultContent ? '#E67E22' : '#9B59B6'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            navigation.navigate(storeTab === 'products' ? 'ProductUpload' : 'ServiceUpload')
          }
        >
          <Ionicons name="add" size={24} color="#9B59B6" />
        </TouchableOpacity>
      </View>

      {/* Store tab switcher */}
      <View style={styles.tabRow}>
        {(['products', 'services'] as const).map(tab => {
          const isActive = storeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.storeTab, isActive && styles.storeTabActive]}
              onPress={() => setStoreTab(tab)}
            >
              <Ionicons
                name={tab === 'products' ? 'cube-outline' : 'construct-outline'}
                size={16}
                color={isActive ? '#C39BD3' : '#888'}
              />
              <Text style={[styles.storeTabText, isActive && styles.storeTabTextActive]}>
                {tab === 'products' ? `Products (${products.length})` : `Services (${services.length})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search your ${storeTab}...`}
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {storeTab === 'products' ? (
          <>
            {renderProductFilterTab('all', 'All', productCounts.all)}
            {renderProductFilterTab('active', 'Active', productCounts.active)}
            {renderProductFilterTab('hidden', 'Hidden', productCounts.hidden)}
            {renderProductFilterTab('out', 'Out of Stock', productCounts.out)}
          </>
        ) : (
          <>
            {renderServiceFilterTab('all', 'All', serviceCounts.all)}
            {renderServiceFilterTab('active', 'Active', serviceCounts.active)}
            {renderServiceFilterTab('hidden', 'Hidden', serviceCounts.hidden)}
          </>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#9B59B6" />
          <Text style={styles.loadingText}>Loading your store...</Text>
        </View>
      ) : storeTab === 'products' ? (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9B59B6"
              colors={['#9B59B6']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={item => item.id}
          renderItem={renderService}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9B59B6"
              colors={['#9B59B6']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Action Modal */}
      <Modal
        transparent
        visible={isActionModalVisible}
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeActionModal}>
          <Animated.View style={[styles.actionModal, { transform: [{ scale: springAnim }] }]}>
            <View style={styles.modalHandle} />

            {selectedItem && (
              <Text style={styles.modalProductPreview} numberOfLines={2}>
                {selectedItem.name}
              </Text>
            )}

            <View style={styles.modalDivider} />

            <TouchableOpacity style={styles.modalAction} onPress={handleView}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#1E3A5F' }]}>
                <Ionicons name="eye-outline" size={20} color="#3498DB" />
              </View>
              <Text style={styles.modalActionText}>
                View {selectedIsProduct ? 'Product' : 'Service'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalAction} onPress={openEditModal}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#1E3D1E' }]}>
                <Ionicons name="create-outline" size={20} color="#2ECC71" />
              </View>
              <Text style={styles.modalActionText}>Edit Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            {selectedIsProduct && selectedStatus !== 'removed' && (
              <TouchableOpacity style={styles.modalAction} onPress={openRestockModal}>
                <View style={[styles.modalActionIcon, { backgroundColor: '#3D2E1E' }]}>
                  <Ionicons name="layers-outline" size={20} color="#F39C12" />
                </View>
                <Text style={styles.modalActionText}>Restock</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            )}

            {selectedStatus === 'removed' ? (
              <View style={styles.modalAction}>
                <View style={[styles.modalActionIcon, { backgroundColor: '#3D1E1E' }]}>
                  <Ionicons name="shield-outline" size={20} color="#E74C3C" />
                </View>
                <Text style={[styles.modalActionText, { color: '#888', fontSize: 13 }]}>
                  Removed by moderation. You can edit the listing, but only staff can restore it.
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.modalAction} onPress={handleToggleVisibility}>
                <View style={[styles.modalActionIcon, { backgroundColor: '#2E2E3D' }]}>
                  <Ionicons
                    name={selectedStatus === 'active' ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9B59B6"
                  />
                </View>
                <Text style={styles.modalActionText}>
                  {selectedStatus === 'active'
                    ? 'Hide from Buyers'
                    : selectedStatus === 'sold'
                      ? 'Relist as Active'
                      : 'Unhide / Activate'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            )}

            {selectedIsProduct && selectedStatus === 'active' && (
              <TouchableOpacity style={styles.modalAction} onPress={handleMarkSold}>
                <View style={[styles.modalActionIcon, { backgroundColor: '#3D3A1E' }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#F1C40F" />
                </View>
                <Text style={styles.modalActionText}>Mark as Sold</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalAction} onPress={handleDelete}>
              <View style={[styles.modalActionIcon, { backgroundColor: '#3D1E1E' }]}>
                <Ionicons name="trash-outline" size={20} color="#E74C3C" />
              </View>
              <Text style={[styles.modalActionText, { color: '#E74C3C' }]}>
                Delete {selectedIsProduct ? 'Product' : 'Service'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={closeActionModal}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Restock Modal (products only) */}
      <Modal
        transparent
        visible={isRestockVisible}
        animationType="slide"
        onRequestClose={() => setIsRestockVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsRestockVisible(false)}
          />
          <View style={styles.sheetModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.sheetTitle}>Restock</Text>
            {selected?.kind === 'product' && (
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {selected.item.name} · currently {selected.item.quantity ?? 0} in stock
              </Text>
            )}

            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() =>
                  setRestockValue(String(Math.max(0, (parseInt(restockValue, 10) || 0) - 1)))
                }
              >
                <Ionicons name="remove" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TextInput
                style={styles.stepperInput}
                value={restockValue}
                onChangeText={setRestockValue}
                keyboardType="number-pad"
                selectTextOnFocus
              />
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setRestockValue(String((parseInt(restockValue, 10) || 0) + 1))}
              >
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.quickChipsRow}>
              {[5, 10, 25].map(n => (
                <TouchableOpacity
                  key={n}
                  style={styles.quickChip}
                  onPress={() =>
                    setRestockValue(
                      String(
                        (selected?.kind === 'product' ? selected.item.quantity ?? 0 : 0) + n
                      )
                    )
                  }
                >
                  <Text style={styles.quickChipText}>+{n}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.quickChip} onPress={() => setRestockValue('0')}>
                <Text style={styles.quickChipText}>Set to 0</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={handleSaveRestock}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Update Stock</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal
        transparent
        visible={isEditVisible}
        animationType="slide"
        onRequestClose={() => setIsEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsEditVisible(false)}
          />
          <View style={[styles.sheetModal, { maxHeight: '88%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.sheetTitle}>
              Edit {selectedIsProduct ? 'Product' : 'Service'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={selectedIsProduct ? 'Product name' : 'Service name'}
                placeholderTextColor="#555"
              />

              <View style={styles.fieldRow}>
                <View style={{ flex: 1, marginRight: selectedIsProduct ? 8 : 0 }}>
                  <Text style={styles.fieldLabel}>Price (₣)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editPrice}
                    onChangeText={setEditPrice}
                    placeholder="0.00"
                    placeholderTextColor="#555"
                    keyboardType="decimal-pad"
                  />
                </View>
                {selectedIsProduct && (
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.fieldLabel}>Stock</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editQuantity}
                      onChangeText={setEditQuantity}
                      placeholder="0"
                      placeholderTextColor="#555"
                      keyboardType="number-pad"
                    />
                  </View>
                )}
              </View>

              {selectedIsProduct && (
                <>
                  <Text style={styles.fieldLabel}>Condition</Text>
                  <View style={styles.conditionRow}>
                    {CONDITIONS.map(c => (
                      <TouchableOpacity
                        key={c.value}
                        style={[
                          styles.conditionChip,
                          editCondition === c.value && styles.conditionChipActive,
                        ]}
                        onPress={() => setEditCondition(c.value)}
                      >
                        <Text
                          style={[
                            styles.conditionChipText,
                            editCondition === c.value && styles.conditionChipTextActive,
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {!selectedIsProduct && (
                <>
                  <Text style={styles.fieldLabel}>Duration</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editDuration}
                    onChangeText={setEditDuration}
                    placeholder="e.g. 2 hours"
                    placeholderTextColor="#555"
                  />

                  <Text style={styles.fieldLabel}>Availability</Text>
                  <View style={styles.conditionRow}>
                    {AVAILABILITY_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.conditionChip,
                          editAvailability[opt.key] && styles.conditionChipActive,
                        ]}
                        onPress={() =>
                          setEditAvailability(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))
                        }
                      >
                        <Text
                          style={[
                            styles.conditionChipText,
                            editAvailability[opt.key] && styles.conditionChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Booking Type</Text>
                  <View style={styles.conditionRow}>
                    {BOOKING_TYPES.map(bt => (
                      <TouchableOpacity
                        key={bt.value}
                        style={[
                          styles.conditionChip,
                          editBookingType === bt.value && styles.conditionChipActive,
                        ]}
                        onPress={() => setEditBookingType(bt.value)}
                      >
                        <Text
                          style={[
                            styles.conditionChipText,
                            editBookingType === bt.value && styles.conditionChipTextActive,
                          ]}
                        >
                          {bt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={selectedIsProduct ? 'Describe your product...' : 'Describe your service...'}
                placeholderTextColor="#555"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>
                {selectedIsProduct ? 'Location' : 'Service Area / Location'}
              </Text>
              <TouchableOpacity
                style={styles.locationPicker}
                onPress={() => setLocationSelectorVisible(true)}
              >
                <Ionicons
                  name="location"
                  size={18}
                  color={editLocation ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
                />
                <Text
                  style={[
                    styles.locationPickerText,
                    !editLocation && styles.locationPickerPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {editLocation || 'Select location'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Tags (comma separated)</Text>
              <TextInput
                style={styles.fieldInput}
                value={editTags}
                onChangeText={setEditTags}
                placeholder={selectedIsProduct ? 'e.g. sneakers, nike, running' : 'e.g. plumbing, repairs'}
                placeholderTextColor="#555"
              />

              {selectedIsProduct && (
                <>
                  <Text style={styles.fieldLabel}>Fulfilment Options</Text>
                  <View style={styles.conditionRow}>
                    {(['pickup', 'delivery', 'shipping'] as const).map(key => (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.conditionChip,
                          editShipping[key] && styles.conditionChipActive,
                        ]}
                        onPress={() => setEditShipping(prev => ({ ...prev, [key]: !prev[key] }))}
                      >
                        <Text
                          style={[
                            styles.conditionChipText,
                            editShipping[key] && styles.conditionChipTextActive,
                          ]}
                        >
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Location picker (shared by product + service edit) */}
      <LocationSelector
        visible={isLocationSelectorVisible}
        selectedLocation={editLocation}
        onLocationSelect={loc => setEditLocation(loc)}
        onClose={() => setLocationSelectorVisible(false)}
      />

      {/* Store Visibility Modal */}
      <Modal
        transparent
        visible={isVisibilityVisible}
        animationType="slide"
        onRequestClose={() => setIsVisibilityVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsVisibilityVisible(false)}
          />
          <View style={styles.sheetModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.sheetTitle}>Store Visibility</Text>
            <Text style={styles.sheetSubtitle}>
              Applies to your entire product &amp; service catalog
            </Text>

            <View style={styles.visibilityRow}>
              <View style={styles.visibilityTextWrap}>
                <Text style={styles.visibilityLabel}>Unlisted Catalog</Text>
                <Text style={styles.visibilityDesc}>
                  Your products and services won't appear in feeds, search, or your
                  public store. People with a direct link can still view and buy.
                </Text>
              </View>
              <Switch
                value={catalogHidden}
                onValueChange={() => handleVisibilityToggle('catalog')}
                disabled={savingVisibility !== null}
                trackColor={{ false: '#333', true: '#9B59B6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.visibilityDivider} />

            <View style={styles.visibilityRow}>
              <View style={styles.visibilityTextWrap}>
                <Text style={styles.visibilityLabel}>Adult Content (18+)</Text>
                <Text style={styles.visibilityDesc}>
                  Mark your catalog as adult content. Only users 18 or older can
                  discover or open your listings. This does not permit pornographic
                  or sexually explicit material — all listings must still comply
                  with our content policies.
                </Text>
              </View>
              <Switch
                value={isAdultContent}
                onValueChange={() => handleVisibilityToggle('adult')}
                disabled={savingVisibility !== null}
                trackColor={{ false: '#333', true: '#E67E22' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.visibilityNote}>
              <Ionicons name="information-circle-outline" size={16} color="#888" />
              <Text style={styles.visibilityNoteText}>
                Existing orders, chats, and cart items are unaffected. Adult content
                must also comply with marketplace and payment provider policies.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  storeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  storeTabActive: {
    backgroundColor: 'rgba(155,89,182,0.18)',
    borderColor: '#9B59B6',
  },
  storeTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
  },
  storeTabTextActive: {
    color: '#C39BD3',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(155,89,182,0.18)',
    borderColor: '#9B59B6',
  },
  filterTabText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#C39BD3',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  thumbWrapper: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
  },
  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOverlayText: {
    color: '#E74C3C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  productPrice: {
    color: '#27AE60',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B0B0B0',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },
  statsText: {
    color: '#666',
    fontSize: 11,
  },
  multiItemText: {
    color: '#666',
    fontSize: 11,
  },
  moreButton: {
    padding: 8,
    marginLeft: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#B0B0B0',
    marginTop: 16,
    fontSize: 15,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9B59B6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 28,
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  actionModal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  sheetModal: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalProductPreview: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 8,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 14,
  },
  modalActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetSubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  visibilityTextWrap: {
    flex: 1,
    gap: 4,
  },
  visibilityLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  visibilityDesc: {
    color: '#888',
    fontSize: 12,
    lineHeight: 17,
  },
  visibilityDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  visibilityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 12,
  },
  visibilityNoteText: {
    flex: 1,
    color: '#888',
    fontSize: 12,
    lineHeight: 17,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepperInput: {
    width: 110,
    height: 52,
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickChipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickChipText: {
    color: '#C39BD3',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#9B59B6',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fieldLabel: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldInputMultiline: {
    minHeight: 90,
  },
  locationPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  locationPickerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  locationPickerPlaceholder: {
    color: '#555',
  },
  fieldRow: {
    flexDirection: 'row',
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  conditionChipActive: {
    backgroundColor: 'rgba(155,89,182,0.18)',
    borderColor: '#9B59B6',
  },
  conditionChipText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  conditionChipTextActive: {
    color: '#C39BD3',
  },
});

export default ManageStoreScreen;
