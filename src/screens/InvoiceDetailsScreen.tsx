import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { invoiceAPI, Invoice, InvoiceStatus, InvoiceItemType } from '../services/invoiceAPI';
import { useAuth } from '../contexts/AuthContext';
import { realtimeAPI } from '../services/realtimeAPI';

interface RouteParams {
  invoiceId: string;
}

const InvoiceDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { invoiceId } = route.params as RouteParams;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  // Refresh invoice when screen regains focus
  useFocusEffect(
    React.useCallback(() => {
      loadInvoice();
    }, [invoiceId])
  );

  // Listen for invoice_paid WebSocket events
  useEffect(() => {
    if (!invoice) return;

    // Subscribe to invoice_paid events
    const unsubscribeInvoicePaid = realtimeAPI.subscribe('invoice_paid', (data: any) => {
      if (data.invoiceId === invoiceId) {
        console.log('✅ Invoice paid event received, refreshing invoice');
        loadInvoice();
      }
    });

    return () => {
      unsubscribeInvoicePaid();
    };
  }, [invoice, invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const data = await invoiceAPI.getInvoice(invoiceId);
      setInvoice(data);
    } catch (error) {
      console.error('Error loading invoice:', error);
      Alert.alert('Error', 'Failed to load invoice');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleBuyInstantly = () => {
    if (!invoice) return;

    // Navigate to checkout screen with invoice data
    navigation.navigate('Checkout', {
      source: 'invoice',
      invoiceId: invoice.id,
      items: invoice.items.map(item => ({
        id: item.productId || item.serviceId || item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.imageUrl,
        type: item.itemType,
      })),
      totalAmount: invoice.totalAmount,
      vendorId: invoice.vendorId,
    });
  };

  const handleEdit = () => {
    if (!invoice) return;

    // Navigate to edit screen with invoice data
    navigation.navigate('CreateInvoice', {
      conversationId: invoice.conversationId,
      buyerName: 'Customer', // Could fetch from user profiles if needed
      editMode: true,
      invoiceId: invoice.id,
      existingItems: invoice.items.map(item => ({
        itemType: item.itemType,
        name: item.name,
        description: item.description || '',
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl || '',
        appointmentDate: item.appointmentDate,
        appointmentTime: item.appointmentTime,
        productId: item.productId,
        serviceId: item.serviceId,
      })),
    });
  };

  const handleCancel = async () => {
    if (!invoice) return;

    Alert.alert('Cancel Invoice', 'Are you sure you want to cancel this invoice?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true);
            await invoiceAPI.cancelInvoice(invoiceId);
            Alert.alert('Success', 'Invoice cancelled', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (error: any) {
            console.error('Error cancelling invoice:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to cancel invoice');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#051094" />
        <Text style={styles.loadingText}>Loading invoice...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Invoice not found</Text>
      </View>
    );
  }

  const isVendor = invoice.vendorId === user?.id;
  const isBuyer = invoice.buyerId === user?.id;
  const statusDisplay = invoiceAPI.getStatusDisplay(invoice.status);
  const isExpired = invoiceAPI.isInvoiceExpired(invoice);
  const canEdit = isVendor && invoice.status === InvoiceStatus.PENDING && !isExpired;
  // Don't show "Cancel" if order already exists (invoice is paid or order created)
  const canCancel = isVendor && invoice.status === InvoiceStatus.PENDING && !invoice.orderId;
  // Don't show "Buy Now" if order already exists (invoice is paid or order created)
  const canBuy = isBuyer && invoice.status === InvoiceStatus.PENDING && !isExpired && !invoice.orderId;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Invoice Details</Text>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: statusDisplay.color + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusDisplay.color }]} />
            <Text style={[styles.statusText, { color: statusDisplay.color }]}>
              {statusDisplay.text}
            </Text>
          </View>

          {invoice.status === InvoiceStatus.PENDING && !isExpired && (
            <View style={styles.expiryContainer}>
              <Ionicons name="time-outline" size={16} color="#F39C12" />
              <Text style={styles.expiryText}>{invoiceAPI.getTimeRemaining(invoice)}</Text>
            </View>
          )}

          {isExpired && invoice.status === InvoiceStatus.PENDING && (
            <View style={styles.expiredBanner}>
              <Ionicons name="alert-circle" size={20} color="#E74C3C" />
              <Text style={styles.expiredText}>This invoice has expired</Text>
            </View>
          )}
        </View>

        {/* Invoice Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({invoice.items.length})</Text>
          {invoice.items.map((item, index) => (
            <View key={item.id || index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTypeBadge}>
                  <Ionicons
                    name={item.itemType === InvoiceItemType.PRODUCT ? 'cube' : 'construct'}
                    size={14}
                    color="#888"
                  />
                  <Text style={styles.itemTypeText}>
                    {item.itemType === InvoiceItemType.PRODUCT ? 'Product' : 'Service'}
                  </Text>
                </View>
                <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
              </View>

              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              )}

              <Text style={styles.itemName}>{item.name}</Text>

              {item.description && (() => {
                const INSTRUCTIONS_LIMIT = 120;
                const itemKey = item.id || `item-${index}`;
                const isLong = item.description.length > INSTRUCTIONS_LIMIT;
                const isExpanded = expandedDescriptions[itemKey] || false;
                const displayText = isExpanded || !isLong
                  ? item.description
                  : `${item.description.substring(0, INSTRUCTIONS_LIMIT)}...`;
                
                return (
                  <View style={styles.itemDescriptionContainer}>
                    <Text style={styles.itemDescription}>{displayText}</Text>
                    {isLong && (
                      <TouchableOpacity
                        onPress={() => setExpandedDescriptions(prev => ({
                          ...prev,
                          [itemKey]: !prev[itemKey]
                        }))}
                        style={styles.seeMoreButton}
                      >
                        <Text style={styles.seeMoreText}>
                          {isExpanded ? 'See less' : 'See more'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}

              {item.itemType === InvoiceItemType.SERVICE && item.appointmentDate && (
                <View style={styles.appointmentContainer}>
                  <Ionicons name="calendar" size={16} color="#3498DB" />
                  <Text style={styles.appointmentText}>
                    {new Date(item.appointmentDate).toLocaleDateString()}
                    {item.appointmentTime && ` at ${item.appointmentTime}`}
                  </Text>
                </View>
              )}

              <View style={styles.itemPricing}>
                <Text style={styles.itemPrice}>₣{item.price.toFixed(2)} each</Text>
                <Text style={styles.itemTotal}>₣{item.totalPrice?.toFixed(2) || (item.price * item.quantity).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Total Section */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>₣{invoice.totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total Amount:</Text>
            <Text style={styles.grandTotalValue}>₣{invoice.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Order Link (if paid) */}
        {invoice.orderId && (
          <TouchableOpacity
            style={styles.orderLinkCard}
            onPress={() => navigation.navigate('OrderTracking', { orderId: invoice.orderId })}
          >
            <View style={styles.orderLinkContent}>
              <Ionicons name="receipt" size={24} color="#3498DB" />
              <View style={styles.orderLinkText}>
                <Text style={styles.orderLinkTitle}>View Order</Text>
                <Text style={styles.orderLinkSubtitle}>Track your order status</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#888" />
          </TouchableOpacity>
        )}

        {/* Action Buttons */}
        {canBuy && (
          <TouchableOpacity
            style={[styles.primaryButton, actionLoading && styles.buttonDisabled]}
            onPress={handleBuyInstantly}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="cart" size={20} color="#FFF" />
                <Text style={styles.primaryButtonText}>Buy Instantly</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isVendor && (
          <View style={styles.vendorActions}>
            {canEdit && (
              <TouchableOpacity
                style={[styles.secondaryButton, actionLoading && styles.buttonDisabled]}
                onPress={handleEdit}
                disabled={actionLoading}
              >
                <Ionicons name="create-outline" size={20} color="#051094" />
                <Text style={styles.secondaryButtonText}>Edit Invoice</Text>
              </TouchableOpacity>
            )}

            {canCancel && (
              <TouchableOpacity
                style={[styles.dangerButton, actionLoading && styles.buttonDisabled]}
                onPress={handleCancel}
                disabled={actionLoading}
              >
                <Ionicons name="close-circle-outline" size={20} color="#E74C3C" />
                <Text style={styles.dangerButtonText}>Cancel Invoice</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Metadata */}
        <View style={styles.metadataCard}>
          <Text style={styles.metadataTitle}>Invoice Information</Text>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Created:</Text>
            <Text style={styles.metadataValue}>
              {new Date(invoice.createdAt).toLocaleString()}
            </Text>
          </View>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Expires:</Text>
            <Text style={styles.metadataValue}>
              {new Date(invoice.expiresAt).toLocaleString()}
            </Text>
          </View>
          {invoice.paidAt && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Paid:</Text>
              <Text style={styles.metadataValue}>
                {new Date(invoice.paidAt).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
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
  invoiceNumber: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 16,
  },
  statusCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  expiryText: {
    color: '#F39C12',
    fontSize: 14,
    fontWeight: '500',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E74C3C20',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  expiredText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemTypeText: {
    color: '#888',
    fontSize: 12,
  },
  itemQuantity: {
    color: '#888',
    fontSize: 14,
  },
  itemImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  itemName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemDescriptionContainer: {
    marginBottom: 12,
  },
  itemDescription: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  seeMoreButton: {
    marginTop: 4,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  seeMoreText: {
    color: '#3498DB',
    fontSize: 13,
    fontWeight: '500',
  },
  appointmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3498DB20',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  appointmentText: {
    color: '#3498DB',
    fontSize: 14,
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  itemPrice: {
    color: '#888',
    fontSize: 14,
  },
  itemTotal: {
    color: '#27AE60',
    fontSize: 18,
    fontWeight: 'bold',
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
    marginBottom: 8,
  },
  totalLabel: {
    color: '#888',
    fontSize: 16,
  },
  totalValue: {
    color: '#FFF',
    fontSize: 16,
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
  orderLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3498DB20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3498DB40',
  },
  orderLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderLinkText: {
    flex: 1,
  },
  orderLinkTitle: {
    color: '#3498DB',
    fontSize: 16,
    fontWeight: '600',
  },
  orderLinkSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#051094',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  vendorActions: {
    gap: 12,
    marginBottom: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#051094',
    padding: 16,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#051094',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E74C3C',
    padding: 16,
    borderRadius: 12,
  },
  dangerButtonText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  metadataCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  metadataTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metadataLabel: {
    color: '#888',
    fontSize: 14,
  },
  metadataValue: {
    color: '#FFF',
    fontSize: 14,
  },
});

export default InvoiceDetailsScreen;
