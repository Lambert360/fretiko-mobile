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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { giftAPI, UserGift } from '../services/giftAPI';
import { walletAPI } from '../services/walletAPI';
import { realtimeAPI } from '../services/realtimeAPI';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

const MyGiftsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [gifts, setGifts] = useState<UserGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGifts, setSelectedGifts] = useState<Set<string>>(new Set());
  const [giftQuantities, setGiftQuantities] = useState<Map<string, number>>(new Map()); // user_gift_id -> quantity to convert
  const [converting, setConverting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  useEffect(() => {
    loadGifts();
  }, []);

  // Real-time gift collection updates
  useEffect(() => {
    if (!user?.id || !realtimeAPI.isConnected()) {
      return;
    }

    const unsubscribe = realtimeAPI.subscribe('gift_collection_updated', (data: any) => {
      console.log('🎁 Gift collection updated via WebSocket:', data);
      // Reload gifts to reflect changes
      loadGifts();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id]);

  // Reload when screen comes into focus (e.g., returning from marketplace)
  useFocusEffect(
    useCallback(() => {
      loadGifts();
    }, [])
  );

  const loadGifts = async () => {
    try {
      setLoading(true);
      const response = await giftAPI.getUserGifts();
      setGifts(response.gifts);
    } catch (error: any) {
      console.error('Error loading gifts:', error);
      Alert.alert('Error', error.message || 'Failed to load gifts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGifts();
  }, []);

  const toggleGiftSelection = (giftId: string) => {
    const newSelected = new Set(selectedGifts);
    const newQuantities = new Map(giftQuantities);
    
    if (newSelected.has(giftId)) {
      newSelected.delete(giftId);
      newQuantities.delete(giftId);
    } else {
      newSelected.add(giftId);
      // Default to converting 1 (not all) - user can adjust
      const gift = gifts.find(g => g.id === giftId);
      if (gift) {
        newQuantities.set(giftId, 1); // Start with 1, not full quantity
      }
    }
    setSelectedGifts(newSelected);
    setGiftQuantities(newQuantities);
  };

  const selectAllQuantity = (giftId: string) => {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;
    
    const newQuantities = new Map(giftQuantities);
    newQuantities.set(giftId, gift.quantity); // Set to full quantity
    setGiftQuantities(newQuantities);
  };

  const updateGiftQuantity = (giftId: string, change: number) => {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;

    const newQuantities = new Map(giftQuantities);
    const current = newQuantities.get(giftId) || gift.quantity;
    const newQuantity = Math.max(1, Math.min(gift.quantity, current + change));
    newQuantities.set(giftId, newQuantity);
    setGiftQuantities(newQuantities);
  };

  const handleConvert = async () => {
    if (selectedGifts.size === 0) {
      Alert.alert('No Selection', 'Please select gifts to convert');
      return;
    }

    setShowConvertModal(true);
  };

  const confirmConvert = async () => {
    try {
      setConverting(true);
      setShowConvertModal(false);

      // Build conversion array with quantities
      const giftsToConvert = Array.from(selectedGifts).map(userGiftId => ({
        user_gift_id: userGiftId,
        quantity: giftQuantities.get(userGiftId) || 1,
      }));

      const result = await giftAPI.convertGifts(giftsToConvert);

      Alert.alert(
        'Conversion Successful',
        `Converted ${result.gifts_converted.length} gift type(s) to ${walletAPI.formatFreti(result.user_credit)} credits.\n\nPlatform fee: ${walletAPI.formatFreti(result.platform_fee)}\nNew balance: ${walletAPI.formatFreti(result.new_wallet_balance)}`,
        [{ text: 'OK', onPress: () => {
          setSelectedGifts(new Set());
          setGiftQuantities(new Map());
          loadGifts();
        }}]
      );
    } catch (error: any) {
      console.error('Error converting gifts:', error);
      Alert.alert('Error', error.message || 'Failed to convert gifts');
    } finally {
      setConverting(false);
    }
  };

  const handlePurchase = () => {
    navigation.navigate('GiftMarketplace' as never);
  };

  const renderGiftItem = ({ item }: { item: UserGift }) => {
    const isSelected = selectedGifts.has(item.id);
    const convertQty = isSelected ? (giftQuantities.get(item.id) || 1) : 0;
    const canAdjustQuantity = isSelected && item.quantity > 1;

    return (
      <View style={[
        styles.giftCard,
        isSelected && styles.giftCardSelected,
      ]}>
        <TouchableOpacity
          onPress={() => toggleGiftSelection(item.id)}
          activeOpacity={0.7}
          style={styles.giftCardTouchable}
        >
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.giftEmojiContainer}>
            <Text style={styles.giftEmoji}>{item.emoji}</Text>
          </View>
          <Text style={styles.giftName}>{item.gift_name}</Text>
          <Text style={styles.giftQuantity}>x{item.quantity}</Text>
          <Text style={styles.giftValue}>{walletAPI.formatFreti(item.total_value)}</Text>
        </TouchableOpacity>
        
        {/* Quantity Selector - Only show when selected and quantity > 1 */}
        {canAdjustQuantity && (
          <View style={styles.quantitySelector}>
            <Text style={styles.quantitySelectorLabel}>
              Convert: {convertQty} of {item.quantity}
            </Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateGiftQuantity(item.id, -1)}
              >
                <Ionicons name="remove" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.quantitySelectorValue}>{convertQty}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateGiftQuantity(item.id, 1)}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {convertQty < item.quantity && (
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={() => selectAllQuantity(item.id)}
              >
                <Text style={styles.selectAllButtonText}>Select All ({item.quantity})</Text>
              </TouchableOpacity>
            )}
          </View>
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
          <Text style={styles.headerTitle}>My Gifts</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
        </View>
      </View>
    );
  }

  // Calculate total value based on selected quantities to convert
  const totalSelectedValue = Array.from(selectedGifts).reduce((sum, userGiftId) => {
    const gift = gifts.find(g => g.id === userGiftId);
    if (!gift) return sum;
    const convertQty = giftQuantities.get(userGiftId) || gift.quantity;
    const giftValuePerUnit = gift.total_value / gift.quantity;
    return sum + (giftValuePerUnit * convertQty);
  }, 0);

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
        <Text style={styles.headerTitle}>🎁 My Gifts</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Gifts</Text>
          <Text style={styles.statValue}>{gifts.reduce((sum, g) => sum + g.quantity, 0)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Value</Text>
          <Text style={styles.statValue}>
            {walletAPI.formatFreti(gifts.reduce((sum, g) => sum + g.total_value, 0))}
          </Text>
        </View>
      </View>

      {/* Gifts Grid */}
      {gifts.length > 0 ? (
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
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎁</Text>
          <Text style={styles.emptyText}>No gifts yet</Text>
          <Text style={styles.emptySubtext}>Purchase gifts or receive them from others</Text>
          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={handlePurchase}
          >
            <Text style={styles.purchaseButtonText}>Purchase Gifts</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons */}
      {gifts.length > 0 && (
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom || 0, 12) + 12 }]}>
          <TouchableOpacity
            style={[
              styles.convertButton,
              (selectedGifts.size === 0 || converting) && styles.convertButtonDisabled,
            ]}
            onPress={handleConvert}
            disabled={selectedGifts.size === 0 || converting}
          >
            {converting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                <Text style={styles.convertButtonText}>
                  Convert {selectedGifts.size > 0 ? `(${selectedGifts.size})` : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.purchaseButtonBar}
            onPress={handlePurchase}
          >
            <Ionicons name="cart" size={20} color="#FFFFFF" />
            <Text style={styles.purchaseButtonTextBar}>Purchase</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Convert Confirmation Modal */}
      <Modal
        visible={showConvertModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConvertModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Convert Gifts</Text>
            <Text style={styles.modalText}>
              Convert {Array.from(giftQuantities.values()).reduce((sum, qty) => sum + qty, 0)} gift(s) to credits?
            </Text>
            <ScrollView style={styles.modalGiftsList} nestedScrollEnabled>
              {Array.from(selectedGifts).map(userGiftId => {
                const gift = gifts.find(g => g.id === userGiftId);
                const convertQty = giftQuantities.get(userGiftId) || 1;
                if (!gift) return null;
                const giftValuePerUnit = gift.total_value / gift.quantity;
                const giftValue = giftValuePerUnit * convertQty;
                return (
                  <View key={userGiftId} style={styles.modalGiftItem}>
                    <Text style={styles.modalGiftEmoji}>{gift.emoji}</Text>
                    <View style={styles.modalGiftInfo}>
                      <Text style={styles.modalGiftName}>{gift.gift_name}</Text>
                      <Text style={styles.modalGiftDetails}>
                        {convertQty} of {gift.quantity} • {walletAPI.formatFreti(giftValue)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.modalSubtext}>
              You will receive 80% of the value ({walletAPI.formatFreti(Math.floor(totalSelectedValue * 0.8))})
              {'\n'}Platform fee: 20% ({walletAPI.formatFreti(Math.floor(totalSelectedValue * 0.2))})
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowConvertModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmConvert}
              >
                <Text style={styles.modalButtonTextConfirm}>Convert</Text>
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
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 20,
  },
  giftsGrid: {
    padding: 16,
    paddingBottom: 100,
  },
  giftCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    margin: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 180,
    overflow: 'hidden',
  },
  giftCardTouchable: {
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  giftCardSelected: {
    borderColor: '#3498DB',
    backgroundColor: '#1A2A3A',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3498DB',
    borderRadius: 12,
    padding: 4,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  giftQuantity: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  giftValue: {
    fontSize: 12,
    color: '#3498DB',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  purchaseButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionBar: {
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
  },
  convertButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#27AE60',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  convertButtonDisabled: {
    backgroundColor: 'rgba(39,174,96,0.5)',
  },
  convertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  purchaseButtonBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#3498DB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonTextBar: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
    lineHeight: 20,
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
  quantitySelector: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(52,152,219,0.1)',
  },
  quantitySelectorLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    textAlign: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantitySelectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 40,
    textAlign: 'center',
  },
  selectAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#27AE60',
    alignSelf: 'center',
    marginTop: 4,
  },
  selectAllButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalGiftsList: {
    maxHeight: 200,
    marginBottom: 16,
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
});

export default MyGiftsScreen;

