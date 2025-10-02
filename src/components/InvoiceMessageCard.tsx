import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Invoice, InvoiceStatus, invoiceAPI } from '../services/invoiceAPI';

interface InvoiceMessageCardProps {
  invoice: Invoice;
  isCurrentUser: boolean;
}

const InvoiceMessageCard: React.FC<InvoiceMessageCardProps> = ({ invoice, isCurrentUser }) => {
  const navigation = useNavigation();

  const statusDisplay = invoiceAPI.getStatusDisplay(invoice.status);
  const isExpired = invoiceAPI.isInvoiceExpired(invoice);
  const showActions = invoice.status === InvoiceStatus.PENDING && !isExpired;

  const handleViewDetails = () => {
    navigation.navigate('InvoiceDetails', { invoiceId: invoice.id });
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCurrentUser ? styles.sentContainer : styles.receivedContainer,
      ]}
      onPress={handleViewDetails}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="receipt" size={20} color="#FFF" />
          <Text style={styles.invoiceLabel}>Invoice</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusDisplay.color + '30' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusDisplay.color }]} />
          <Text style={[styles.statusText, { color: statusDisplay.color }]}>
            {statusDisplay.text}
          </Text>
        </View>
      </View>

      {/* Invoice Number */}
      <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>

      {/* Items Preview */}
      <View style={styles.itemsPreview}>
        <Text style={styles.itemsCount}>
          {invoice.items.length} {invoice.items.length === 1 ? 'item' : 'items'}
        </Text>
        <View style={styles.previewDivider} />
        {invoice.items.slice(0, 2).map((item, index) => (
          <View key={item.id || index} style={styles.previewItem}>
            <View style={styles.previewItemLeft}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewImagePlaceholder}>
                  <Ionicons name="cube-outline" size={16} color="#888" />
                </View>
              )}
              <View style={styles.previewItemInfo}>
                <Text style={styles.previewItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.previewItemQty}>Qty: {item.quantity}</Text>
              </View>
            </View>
            <Text style={styles.previewItemPrice}>₣{(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        {invoice.items.length > 2 && (
          <Text style={styles.moreItems}>+{invoice.items.length - 2} more items</Text>
        )}
      </View>

      {/* Total */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>₣{invoice.totalAmount.toFixed(2)}</Text>
      </View>

      {/* Expiry Notice */}
      {showActions && (
        <View style={styles.expiryNotice}>
          <Ionicons name="time-outline" size={14} color="#F39C12" />
          <Text style={styles.expiryText}>{invoiceAPI.getTimeRemaining(invoice)}</Text>
        </View>
      )}

      {/* Expired Notice */}
      {isExpired && invoice.status === InvoiceStatus.PENDING && (
        <View style={styles.expiredNotice}>
          <Ionicons name="alert-circle" size={14} color="#E74C3C" />
          <Text style={styles.expiredText}>Expired</Text>
        </View>
      )}

      {/* Paid Notice */}
      {invoice.status === InvoiceStatus.PAID && (
        <View style={styles.paidNotice}>
          <Ionicons name="checkmark-circle" size={14} color="#27AE60" />
          <Text style={styles.paidText}>Paid</Text>
        </View>
      )}

      {/* Action Hint */}
      <View style={styles.actionHint}>
        <Text style={styles.actionHintText}>Tap to view details</Text>
        <Ionicons name="chevron-forward" size={16} color="#888" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
  },
  sentContainer: {
    backgroundColor: '#051094',
    borderColor: '#0518B0',
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  receivedContainer: {
    backgroundColor: '#59788E',
    borderColor: '#6A8A9E',
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invoiceLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  invoiceNumber: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginBottom: 12,
  },
  itemsPreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  itemsCount: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  previewImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewItemInfo: {
    flex: 1,
  },
  previewItemName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },
  previewItemQty: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  previewItemPrice: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  moreItems: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 8,
  },
  totalLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  totalValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  expiryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  expiryText: {
    color: '#F39C12',
    fontSize: 12,
    fontWeight: '500',
  },
  expiredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  expiredText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: '600',
  },
  paidNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  paidText: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '600',
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionHintText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default InvoiceMessageCard;
