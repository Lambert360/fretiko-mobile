import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { checkoutAPI, DeliveryAddress } from '../services/checkoutAPI';

interface AddressBookScreenProps {
  navigation: any;
  route?: {
    params?: {
      selectMode?: boolean; // If true, allows selecting an address
      onAddressSelected?: (address: DeliveryAddress) => void;
    };
  };
}

const AddressBookScreen: React.FC<AddressBookScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { selectMode = false, onAddressSelected } = route?.params || {};

  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [formData, setFormData] = useState<DeliveryAddress>({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    isDefault: false,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadAddresses();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const data = await checkoutAPI.getAllAddresses();
      setAddresses(data);
    } catch (error) {
      console.error('Error loading addresses:', error);
      Alert.alert('Error', 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingAddress(null);
    setFormData({
      fullName: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      isDefault: false,
    });
    setShowAddressModal(true);
  };

  const handleEdit = (address: DeliveryAddress) => {
    setEditingAddress(address);
    setFormData(address);
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    try {
      // Validate required fields
      if (!formData.fullName || !formData.address || 
          !formData.phone || !formData.city || 
          !formData.state) {
        Alert.alert('Missing Fields', 'Please fill all required fields (Full Name, Phone, Address, City, State)');
        return;
      }

      if (editingAddress) {
        // Update existing address
        await checkoutAPI.updateAddress(editingAddress.id!, formData);
        Alert.alert('Success', 'Address updated successfully');
      } else {
        // Create new address
        await checkoutAPI.saveAddress(formData);
        Alert.alert('Success', 'Address added successfully');
      }

      setShowAddressModal(false);
      loadAddresses();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const handleDelete = (address: DeliveryAddress) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await checkoutAPI.deleteAddress(address.id!);
              Alert.alert('Success', 'Address deleted successfully');
              loadAddresses();
            } catch (error) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (address: DeliveryAddress) => {
    try {
      await checkoutAPI.setDefaultAddress(address.id!);
      Alert.alert('Success', 'Default address updated');
      loadAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
      Alert.alert('Error', 'Failed to set default address');
    }
  };

  const handleSelectAddress = (address: DeliveryAddress) => {
    if (selectMode && onAddressSelected) {
      onAddressSelected(address);
      navigation.goBack();
    }
  };

  const handleFormChange = (field: keyof DeliveryAddress, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderAddressCard = ({ item }: { item: DeliveryAddress }) => (
    <TouchableOpacity
      style={[styles.addressCard, item.isDefault && styles.defaultAddressCard]}
      onPress={() => selectMode ? handleSelectAddress(item) : handleEdit(item)}
    >
      {item.isDefault && (
        <View style={styles.defaultBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#27AE60" />
          <Text style={styles.defaultBadgeText}>Default</Text>
        </View>
      )}

      <View style={styles.addressCardHeader}>
        <View style={styles.addressCardInfo}>
          <Text style={styles.addressName}>{item.fullName}</Text>
          <Text style={styles.addressPhone}>{item.phone}</Text>
        </View>
        {!selectMode && (
          <View style={styles.addressActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEdit(item)}
            >
              <Ionicons name="pencil" size={18} color="#3498DB" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash" size={18} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.addressText}>
        {item.address}
        {item.city && `, ${item.city}`}
        {item.state && `, ${item.state}`}
        {item.postalCode && ` ${item.postalCode}`}
      </Text>

      {!item.isDefault && !selectMode && (
        <TouchableOpacity
          style={styles.setDefaultButton}
          onPress={() => handleSetDefault(item)}
        >
          <Text style={styles.setDefaultText}>Set as Default</Text>
        </TouchableOpacity>
      )}

      {selectMode && (
        <View style={styles.selectIndicator}>
          <Ionicons name="chevron-forward" size={20} color="#3498DB" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderAddressModal = () => (
    <Modal visible={showAddressModal} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.addressModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </Text>
            <TouchableOpacity onPress={() => setShowAddressModal(false)}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.addressForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.fullName}
                onChangeText={(text) => handleFormChange('fullName', text)}
                placeholder="Enter your full name"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(text) => handleFormChange('phone', text)}
                placeholder="Enter phone number"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address *</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={formData.address}
                onChangeText={(text) => handleFormChange('address', text)}
                placeholder="Enter delivery address"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.city}
                  onChangeText={(text) => handleFormChange('city', text)}
                  placeholder="City"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>State *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.state}
                  onChangeText={(text) => handleFormChange('state', text)}
                  placeholder="State"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Postal Code</Text>
              <TextInput
                style={styles.textInput}
                value={formData.postalCode}
                onChangeText={(text) => handleFormChange('postalCode', text)}
                placeholder="Enter postal code"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={styles.defaultToggle}
              onPress={() => handleFormChange('isDefault', !formData.isDefault)}
            >
              <View style={styles.defaultToggleLeft}>
                <Ionicons
                  name={formData.isDefault ? 'checkbox' : 'checkbox-outline'}
                  size={24}
                  color={formData.isDefault ? '#27AE60' : 'rgba(255,255,255,0.6)'}
                />
                <Text style={styles.defaultToggleText}>Set as default address</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAddressModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveAddress}
            >
              <Text style={styles.modalSaveText}>
                {editingAddress ? 'Update' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectMode ? 'Select Address' : 'Address Book'}
        </Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleAddNew}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyStateTitle}>No Addresses Yet</Text>
            <Text style={styles.emptyStateText}>
              Add your delivery addresses to make checkout faster
            </Text>
            <TouchableOpacity style={styles.addFirstButton} onPress={handleAddNew}>
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addFirstButtonText}>Add Address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={addresses}
            renderItem={renderAddressCard}
            keyExtractor={(item) => item.id!}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {renderAddressModal()}
    </View>
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
    paddingBottom: 10,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    padding: 16,
  },
  addressCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  defaultAddressCard: {
    borderColor: '#27AE60',
    borderWidth: 2,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39,174,96,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  defaultBadgeText: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressCardInfo: {
    flex: 1,
  },
  addressName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressPhone: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  setDefaultButton: {
    backgroundColor: 'rgba(52,152,219,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  setDefaultText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
  },
  selectIndicator: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addFirstButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  addressModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  addressForm: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  defaultToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defaultToggleText: {
    color: '#FFF',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#3498DB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddressBookScreen;

