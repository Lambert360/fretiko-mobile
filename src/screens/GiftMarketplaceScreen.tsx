import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { giftAPI, VirtualGift } from '../services/giftAPI';
import { walletAPI } from '../services/walletAPI';

interface GiftSelection {
  gift_id: string;
  quantity: number;
}

const GiftMarketplaceScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [gifts, setGifts] = useState<VirtualGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedGifts, setSelectedGifts] = useState<Map<string, number>>(new Map());
  const [purchasing, setPurchasing] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [giftsData, wallet] = await Promise.all([
        giftAPI.getAvailableGifts(),
        walletAPI.getWallet(),
      ]);
      setGifts(giftsData);
      setWalletBalance(wallet.availableBalance);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load gift marketplace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const updateGiftQuantity = (giftId: string, change: number) => {
    const newSelected = new Map(selectedGifts);
    const current = newSelected.get(giftId) || 0;
    const newQuantity = Math.max(0, Math.min(100, current + change));
    
    if (newQuantity === 0) {
      newSelected.delete(giftId);
    } else {
      newSelected.set(giftId, newQuantity);
    }
    setSelectedGifts(newSelected);
  };

  const getTotalCost = () => {
    let total = 0;
    selectedGifts.forEach((quantity, giftId) => {
      const gift = gifts.find(g => g.id === giftId);
      if (gift) {
        total += gift.credit_value * quantity;
      }
    });
    return total;
  };

  const handlePurchase = async () => {
    if (selectedGifts.size === 0) {
      Alert.alert('No Selection', 'Please select gifts to purchase');
      return;
    }

    const totalCost = getTotalCost();
    if (walletBalance < totalCost) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${walletAPI.formatFreti(totalCost)} but only have ${walletAPI.formatFreti(walletBalance)}`
      );
      return;
    }

    setShowPurchaseModal(true);
  };

  const confirmPurchase = async () => {
    // Prevent duplicate requests
    if (purchasing) {
      console.warn('Purchase already in progress, ignoring duplicate request');
      return;
    }

    try {
      setPurchasing(true);
      setShowPurchaseModal(false);

      const purchases: Array<{ gift_id: string; quantity: number }> = [];
      selectedGifts.forEach((quantity, giftId) => {
        purchases.push({ gift_id: giftId, quantity });
      });

      const result = await giftAPI.purchaseGifts(purchases);

      Alert.alert(
        'Purchase Successful',
        `Purchased ${result.gifts_added.length} gift type(s)!\n\nTotal cost: ${walletAPI.formatFreti(result.total_cost)}\nNew balance: ${walletAPI.formatFreti(result.new_wallet_balance)}`,
        [{ text: 'OK', onPress: () => {
          setSelectedGifts(new Map());
          loadData();
          navigation.goBack();
        }}]
      );
    } catch (error: any) {
      console.error('Error purchasing gifts:', error);
      Alert.alert('Error', error.message || 'Failed to purchase gifts');
    } finally {
      setPurchasing(false);
    }
  };

  const renderGiftItem = ({ item }: { item: VirtualGift }) => {
    const quantity = selectedGifts.get(item.id) || 0;

    return (
      <View style={styles.giftCard}>
        <View style={styles.giftEmojiContainer}>
          <Text style={styles.giftEmoji}>{item.emoji}</Text>
        </View>
        <Text style={styles.giftName}>{item.name}</Text>
        <Text style={styles.giftPrice}>{walletAPI.formatFreti(item.credit_value)}</Text>
        
        {quantity > 0 ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateGiftQuantity(item.id, -1)}
            >
              <Ionicons name="remove" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateGiftQuantity(item.id, 1)}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => updateGiftQuantity(item.id, 1)}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gift Marketplace</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      </View>
    );
  }

  const totalCost = getTotalCost();
  const totalItems = Array.from(selectedGifts.values()).reduce((sum, qty) => sum + qty, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛒 Gift Marketplace</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Wallet Balance */}
      <View style={styles.walletBar}>
        <View style={styles.walletInfo}>
          <Ionicons name="wallet" size={20} color="#3498DB" />
          <Text style={styles.walletLabel}>Balance:</Text>
          <Text style={styles.walletBalance}>{walletAPI.formatFreti(walletBalance)}</Text>
        </View>
      </View>

      {/* Gifts Grid */}
      <FlatList
        data={gifts}
        renderItem={renderGiftItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.giftsGrid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* Purchase Bar */}
      {selectedGifts.size > 0 && (
        <View style={styles.purchaseBar}>
          <View style={styles.purchaseInfo}>
            <Text style={styles.purchaseLabel}>
              {totalItems} item{totalItems > 1 ? 's' : ''} • {walletAPI.formatFreti(totalCost)}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.buyButton,
              (walletBalance < totalCost || purchasing) && styles.buyButtonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={walletBalance < totalCost || purchasing}
          >
            {purchasing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buyButtonText}>Buy</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Purchase Confirmation Modal */}
      <Modal
        visible={showPurchaseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Purchase</Text>
            <ScrollView 
              style={styles.modalGiftsList}
              contentContainerStyle={styles.modalGiftsListContent}
              showsVerticalScrollIndicator={true}
            >
              {Array.from(selectedGifts.entries()).map(([giftId, quantity]) => {
                const gift = gifts.find(g => g.id === giftId);
                if (!gift) return null;
                return (
                  <View key={giftId} style={styles.modalGiftItem}>
                    <Text style={styles.modalGiftEmoji}>{gift.emoji}</Text>
                    <View style={styles.modalGiftInfo}>
                      <Text style={styles.modalGiftName}>{gift.name}</Text>
                      <Text style={styles.modalGiftDetails}>
                        {quantity}x • {walletAPI.formatFreti(gift.credit_value * quantity)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.modalTotal}>
              <Text style={styles.modalTotalLabel}>Total:</Text>
              <Text style={styles.modalTotalValue}>{walletAPI.formatFreti(totalCost)}</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowPurchaseModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmPurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Purchase</Text>
                )}
              </TouchableOpacity>
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
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletBar: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  walletBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498DB',
  },
  giftsGrid: {
    padding: 16,
    paddingBottom: 100,
  },
  giftCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    alignItems: 'center',
    minHeight: 200,
  },
  giftEmojiContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  giftEmoji: {
    fontSize: 32,
  },
  giftName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  giftPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498DB',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 'auto',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 'auto',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 30,
    textAlign: 'center',
  },
  purchaseBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  purchaseInfo: {
    flex: 1,
  },
  purchaseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buyButton: {
    backgroundColor: '#27AE60',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buyButtonDisabled: {
    backgroundColor: 'rgba(39,174,96,0.5)',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalGiftsList: {
    maxHeight: 250,
    marginBottom: 16,
  },
  modalGiftsListContent: {
    paddingBottom: 8,
  },
  modalGiftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalGiftEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  modalGiftInfo: {
    flex: 1,
  },
  modalGiftName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalGiftDetails: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  modalTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
  },
  modalTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3498DB',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalButtonConfirm: {
    backgroundColor: '#27AE60',
  },
  modalButtonTextCancel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GiftMarketplaceScreen;

