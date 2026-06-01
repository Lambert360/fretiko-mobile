import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserGift } from '../services/giftAPI';

const { height: screenHeight } = Dimensions.get('window');

interface GiftSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  gifts: UserGift[];
  loading: boolean;
  onSendGift: (giftId: string, quantity: number) => void;
  title?: string;
  subtitle?: string;
}

const GiftSelectorModal: React.FC<GiftSelectorModalProps> = ({
  visible,
  onClose,
  gifts,
  loading,
  onSendGift,
  title = 'Send a Gift',
  subtitle = 'Select a gift to send to this post',
}) => {
  const slideAnim = React.useRef(new Animated.Value(screenHeight)).current;
  const [selectedGift, setSelectedGift] = useState<UserGift | null>(null);
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 15,
      }).start();
      setSelectedGift(null); // Reset selection when modal opens
      setSending(false); // Reset sending state when modal opens
    } else {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelectGift = (gift: UserGift) => {
    setSelectedGift(gift);
  };

  const handleSendGift = async () => {
    if (selectedGift && !sending) {
      setSending(true);
      try {
        await onSendGift(selectedGift.gift_id, 1);
        onClose();
      } catch (error) {
        setSending(false);
      }
    }
  };

  const renderGiftItem = ({ item }: { item: UserGift }) => {
    const giftValue = item.total_value / item.quantity;
    const isSelected = selectedGift?.gift_id === item.gift_id;
    return (
      <TouchableOpacity
        style={[
          styles.giftItem,
          item.quantity === 0 && styles.giftItemDisabled,
          isSelected && styles.giftItemSelected,
        ]}
        onPress={() => handleSelectGift(item)}
        disabled={item.quantity === 0}
      >
        <Text style={styles.giftEmoji}>{item.emoji}</Text>
        <Text style={styles.giftName} numberOfLines={1}>
          {item.gift_name}
        </Text>
        <Text style={styles.giftValue}>₣{giftValue}</Text>
        <Text style={styles.giftQuantity}>x{item.quantity}</Text>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={20} color="#FFD700" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading gifts...</Text>
        </View>
      );
    }

    if (gifts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="gift-outline" size={50} color="#666" />
          <Text style={styles.emptyTitle}>No Gifts Available</Text>
          <Text style={styles.emptySubtitle}>
            Purchase gifts from the marketplace to send to posts
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={gifts}
        renderItem={renderGiftItem}
        keyExtractor={(item) => item.gift_id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.giftList}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{subtitle}</Text>

          {renderContent()}

          {selectedGift && (
            <View style={styles.sendButtonContainer}>
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={handleSendGift}
                activeOpacity={0.8}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="gift" size={20} color="#FFF" />
                    <Text style={styles.sendButtonText}>
                      Send {selectedGift.emoji} {selectedGift.gift_name}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.6,
    minHeight: screenHeight * 0.4,
    paddingBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  giftList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  giftItem: {
    flex: 1,
    aspectRatio: 0.85,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  giftItemDisabled: {
    opacity: 0.4,
  },
  giftItemSelected: {
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#3A3A3A',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  giftEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  giftName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  giftValue: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  giftQuantity: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sendButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  sendButton: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GiftSelectorModal;
