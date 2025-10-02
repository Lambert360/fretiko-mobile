import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { invoiceAPI, InvoiceItem, InvoiceItemType } from '../services/invoiceAPI';

interface RouteParams {
  conversationId: string;
  buyerName: string;
  editMode?: boolean;
  invoiceId?: string;
  existingItems?: InvoiceItem[];
}

const CreateInvoiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { conversationId, buyerName, editMode, invoiceId, existingItems } = route.params as RouteParams;

  const [items, setItems] = useState<InvoiceItem[]>(
    existingItems && existingItems.length > 0
      ? existingItems
      : [
          {
            itemType: InvoiceItemType.PRODUCT,
            name: '',
            description: '',
            price: 0,
            quantity: 1,
            imageUrl: '',
          },
        ]
  );
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState<number | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<number | null>(null);

  const addItem = () => {
    setItems([
      ...items,
      {
        itemType: InvoiceItemType.PRODUCT,
        name: '',
        description: '',
        price: 0,
        quantity: 1,
        imageUrl: '',
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      Alert.alert('Error', 'Invoice must have at least one item');
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const pickImage = async (index: number) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        updateItem(index, 'imageUrl', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleDateChange = (index: number, event: any, selectedDate?: Date) => {
    setShowDatePicker(null);
    if (selectedDate) {
      updateItem(index, 'appointmentDate', selectedDate.toISOString());
    }
  };

  const handleTimeChange = (index: number, event: any, selectedTime?: Date) => {
    setShowTimePicker(null);
    if (selectedTime) {
      const timeString = selectedTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      updateItem(index, 'appointmentTime', timeString);
    }
  };

  const validateInvoice = (): boolean => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.name.trim()) {
        Alert.alert('Validation Error', `Item ${i + 1}: Please enter item name`);
        return false;
      }

      if (item.price <= 0) {
        Alert.alert('Validation Error', `Item ${i + 1}: Price must be greater than 0`);
        return false;
      }

      if (item.quantity <= 0) {
        Alert.alert('Validation Error', `Item ${i + 1}: Quantity must be at least 1`);
        return false;
      }

      if (item.itemType === InvoiceItemType.SERVICE) {
        if (!item.appointmentDate) {
          Alert.alert('Validation Error', `Item ${i + 1}: Service requires appointment date`);
          return false;
        }
      }
    }

    return true;
  };

  const handleCreateInvoice = async () => {
    console.log(editMode ? '📝 handleUpdateInvoice called' : '📄 handleCreateInvoice called');

    if (!validateInvoice()) {
      console.log('❌ Validation failed');
      return;
    }

    try {
      setLoading(true);

      // Sanitize items before sending
      const sanitizedItems = items.map(item => {
        const sanitized: any = {
          itemType: item.itemType,
          name: item.name.trim(),
          price: Number(item.price),
          quantity: Number(item.quantity),
        };

        // Only include optional fields if they have values
        if (item.description?.trim()) sanitized.description = item.description.trim();
        if (item.imageUrl?.trim()) sanitized.imageUrl = item.imageUrl.trim();
        if (item.appointmentDate) sanitized.appointmentDate = item.appointmentDate;
        if (item.appointmentTime?.trim()) sanitized.appointmentTime = item.appointmentTime.trim();
        if (item.productId) sanitized.productId = item.productId;
        if (item.serviceId) sanitized.serviceId = item.serviceId;

        return sanitized;
      });

      if (editMode && invoiceId) {
        // Update existing invoice
        console.log('🚀 Updating invoice with data:', {
          invoiceId,
          itemCount: sanitizedItems.length,
          items: sanitizedItems,
        });

        const result = await invoiceAPI.updateInvoice(invoiceId, {
          items: sanitizedItems,
        });

        console.log('✅ Invoice updated successfully:', result);

        Alert.alert('Success', 'Invoice updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Create new invoice
        console.log('🚀 Creating invoice with data:', {
          conversationId,
          itemCount: sanitizedItems.length,
          items: sanitizedItems,
        });

        const result = await invoiceAPI.createInvoice({
          conversationId,
          items: sanitizedItems,
        });

        console.log('✅ Invoice created successfully:', result);

        Alert.alert('Success', 'Invoice created successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error: any) {
      console.error(`❌ Error ${editMode ? 'updating' : 'creating'} invoice:`, error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      });

      // More user-friendly error message
      let errorMessage = `Failed to ${editMode ? 'update' : 'create'} invoice`;
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const renderItem = (item: InvoiceItem, index: number) => (
    <View key={index} style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>Item {index + 1}</Text>
        {items.length > 1 && (
          <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={20} color="#E74C3C" />
          </TouchableOpacity>
        )}
      </View>

      {/* Item Type Toggle */}
      <View style={styles.itemTypeContainer}>
        <TouchableOpacity
          style={[
            styles.itemTypeButton,
            item.itemType === InvoiceItemType.PRODUCT && styles.itemTypeButtonActive,
          ]}
          onPress={() => updateItem(index, 'itemType', InvoiceItemType.PRODUCT)}
        >
          <Ionicons
            name="cube-outline"
            size={20}
            color={item.itemType === InvoiceItemType.PRODUCT ? '#FFF' : '#888'}
          />
          <Text
            style={[
              styles.itemTypeText,
              item.itemType === InvoiceItemType.PRODUCT && styles.itemTypeTextActive,
            ]}
          >
            Product
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.itemTypeButton,
            item.itemType === InvoiceItemType.SERVICE && styles.itemTypeButtonActive,
          ]}
          onPress={() => updateItem(index, 'itemType', InvoiceItemType.SERVICE)}
        >
          <Ionicons
            name="construct-outline"
            size={20}
            color={item.itemType === InvoiceItemType.SERVICE ? '#FFF' : '#888'}
          />
          <Text
            style={[
              styles.itemTypeText,
              item.itemType === InvoiceItemType.SERVICE && styles.itemTypeTextActive,
            ]}
          >
            Service
          </Text>
        </TouchableOpacity>
      </View>

      {/* Item Name */}
      <Text style={styles.label}>
        Name <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Enter item name"
        placeholderTextColor="#666"
        value={item.name}
        onChangeText={(text) => updateItem(index, 'name', text)}
      />

      {/* Description (Optional) */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Enter description (optional)"
        placeholderTextColor="#666"
        value={item.description}
        onChangeText={(text) => updateItem(index, 'description', text)}
        multiline
        numberOfLines={3}
      />

      {/* Price and Quantity */}
      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Text style={styles.label}>
            Price (₣) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor="#666"
            value={item.price > 0 ? item.price.toString() : ''}
            onChangeText={(text) => updateItem(index, 'price', parseFloat(text) || 0)}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.halfWidth}>
          <Text style={styles.label}>
            Quantity <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor="#666"
            value={item.quantity.toString()}
            onChangeText={(text) => updateItem(index, 'quantity', parseInt(text) || 1)}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Total for this item */}
      <View style={styles.itemTotalContainer}>
        <Text style={styles.itemTotalLabel}>Item Total:</Text>
        <Text style={styles.itemTotalValue}>₣{(item.price * item.quantity).toFixed(2)}</Text>
      </View>

      {/* Service-specific: Appointment Date & Time */}
      {item.itemType === InvoiceItemType.SERVICE && (
        <>
          <Text style={styles.label}>
            Appointment Date <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(index)}>
            <Ionicons name="calendar-outline" size={20} color="#888" />
            <Text style={styles.dateButtonText}>
              {item.appointmentDate
                ? new Date(item.appointmentDate).toLocaleDateString()
                : 'Select Date'}
            </Text>
          </TouchableOpacity>

          {showDatePicker === index && (
            <DateTimePicker
              value={item.appointmentDate ? new Date(item.appointmentDate) : new Date()}
              mode="date"
              display="default"
              onChange={(event, date) => handleDateChange(index, event, date)}
              minimumDate={new Date()}
            />
          )}

          <Text style={styles.label}>Appointment Time</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePicker(index)}>
            <Ionicons name="time-outline" size={20} color="#888" />
            <Text style={styles.dateButtonText}>{item.appointmentTime || 'Select Time'}</Text>
          </TouchableOpacity>

          {showTimePicker === index && (
            <DateTimePicker
              value={new Date()}
              mode="time"
              display="default"
              onChange={(event, time) => handleTimeChange(index, event, time)}
            />
          )}
        </>
      )}

      {/* Optional Image */}
      <Text style={styles.label}>Image (Optional)</Text>
      <TouchableOpacity style={styles.imageButton} onPress={() => pickImage(index)}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={40} color="#666" />
            <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
          </View>
        )}
      </TouchableOpacity>
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
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{editMode ? 'Edit Invoice' : 'Create Invoice'}</Text>
          <Text style={styles.headerSubtitle}>For {buyerName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Items */}
        {items.map((item, index) => renderItem(item, index))}

        {/* Add Item Button */}
        <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
          <Ionicons name="add-circle-outline" size={24} color="#051094" />
          <Text style={styles.addItemText}>Add Another Item</Text>
        </TouchableOpacity>

        {/* Total Section */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal ({items.length} items):</Text>
            <Text style={styles.totalValue}>₣{calculateTotal().toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total Amount:</Text>
            <Text style={styles.grandTotalValue}>₣{calculateTotal().toFixed(2)}</Text>
          </View>
          <Text style={styles.expiryNote}>
            ⏰ Invoice expires 24 hours after sending
          </Text>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreateInvoice}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name={editMode ? 'checkmark' : 'send'} size={20} color="#FFF" />
              <Text style={styles.createButtonText}>{editMode ? 'Update Invoice' : 'Send Invoice'}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    borderBottomColor: '#333',
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
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    padding: 8,
  },
  itemTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  itemTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  itemTypeButtonActive: {
    backgroundColor: '#051094',
    borderColor: '#051094',
  },
  itemTypeText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  itemTypeTextActive: {
    color: '#FFF',
  },
  label: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  required: {
    color: '#E74C3C',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  itemTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  itemTotalLabel: {
    color: '#888',
    fontSize: 14,
  },
  itemTotalValue: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  imageButton: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#444',
  },
  itemImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#051094',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addItemText: {
    color: '#051094',
    fontSize: 16,
    fontWeight: '600',
  },
  totalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    color: '#888',
    fontSize: 16,
  },
  totalValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 8,
  },
  grandTotalLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    color: '#27AE60',
    fontSize: 24,
    fontWeight: 'bold',
  },
  expiryNote: {
    color: '#F39C12',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#051094',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CreateInvoiceScreen;
