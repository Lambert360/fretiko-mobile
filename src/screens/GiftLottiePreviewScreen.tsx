import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Dimensions,
  ImageBackground,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import LottieGiftEffect from '../components/LottieGiftEffect';
import { giftAPI, VirtualGift } from '../services/giftAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const GiftLottiePreviewScreen = () => {
  const navigation = useNavigation();
  const [gifts, setGifts] = useState<VirtualGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGift, setActiveGift] = useState<VirtualGift | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await giftAPI.getAvailableGifts();
        if (mounted) setGifts(data);
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load gifts');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePlay = useCallback((gift: VirtualGift) => {
    setActiveGift(gift);
    setModalVisible(false);
  }, []);

  const handleComplete = useCallback(() => {
    setActiveGift(null);
  }, []);

  const renderStage = () => {
    if (!activeGift) return null;
    return (
      <>
        <LottieGiftEffect
          gift={{
            id: activeGift.id,
            name: activeGift.name,
            emoji: activeGift.emoji,
            quantity: 1,
            display_lottie_url: activeGift.display_lottie_url,
            lottie_config: activeGift.lottie_config,
            sound_url: activeGift.sound_url,
            animation_type: activeGift.animation_type,
          }}
          onComplete={handleComplete}
        />
        <View style={styles.giftNotice}>
          <Ionicons name="gift" size={14} color="#FFD700" />
          <Text style={styles.giftNoticeText}>{activeGift.name} sent!</Text>
        </View>
      </>
    );
  };

  const renderButton = ({ item }: { item: VirtualGift }) => (
    <TouchableOpacity
      style={[
        styles.modalButton,
        activeGift?.id === item.id && styles.modalButtonActive,
      ]}
      onPress={() => handlePlay(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.modalButtonText}>{item.emoji ? `${item.emoji} ${item.name}` : item.name}</Text>
      <Ionicons
        name={activeGift?.id === item.id ? 'pause-circle' : 'play-circle'}
        size={20}
        color="#FFFFFF"
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Stream preview: 3/4 of the screen */}
      <View style={styles.previewArea}>
        <ImageBackground
          source={require('../../assets/images/hero1.jpeg')}
          style={styles.streamBackground}
          imageStyle={styles.streamImage}
          resizeMode="cover"
        >
          {/* Streamer overlay */}
          <View style={styles.streamOverlay}>
            <View style={styles.topBar}>
              <View style={styles.streamerInfo}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.streamerName}>DJ_Moses_Official</Text>
                  <Text style={styles.streamerSubtitle}>Live from Lagos</Text>
                </View>
              </View>

              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            <View style={styles.viewerBadge}>
              <Ionicons name="eye" size={14} color="#FFFFFF" />
              <Text style={styles.viewerText}>1.2K</Text>
            </View>

            <View style={styles.commentBox}>
              <Text style={styles.commentUser}>victor_:</Text>
              <Text style={styles.commentText}>This stream is fire! 🔥</Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* Controls: 1/4 of the screen */}
      <View style={styles.controlsArea}>
        <TouchableOpacity
          style={styles.sendGiftButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="gift" size={22} color="#000000" />
          <Text style={styles.sendGiftButtonText}>Send a Gift</Text>
        </TouchableOpacity>
      </View>

      {/* Gift selector modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send a Gift</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#FFD700" style={{ marginVertical: 40 }} />
            ) : error ? (
              <Text style={styles.emptyText}>Error: {error}</Text>
            ) : gifts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="gift-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>No gifts in the catalog</Text>
                <Text style={styles.emptySubtext}>Create gifts in the admin panel to preview them here.</Text>
              </View>
            ) : (
              <FlatList
                data={gifts}
                renderItem={renderButton}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.modalList}
                columnWrapperStyle={styles.modalColumnWrapper}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Gift animation overlay */}
      {activeGift && (
        <View style={styles.stageArea} pointerEvents="none">
          {renderStage()}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  previewArea: {
    flex: 3,
    overflow: 'hidden',
  },
  streamBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  streamImage: {
    borderRadius: 0,
  },
  streamOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  stageArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.45,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  streamerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  streamerName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  streamerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewerBadge: {
    position: 'absolute',
    top: 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  viewerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  lottie: {
    width: screenWidth * 0.7,
    height: screenWidth * 0.7,
    alignSelf: 'center',
  },
  giftNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
    marginTop: 8,
  },
  giftNoticeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  commentBox: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  commentUser: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  controlsArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0A0A0A',
  },
  sendGiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
    width: '100%',
    maxWidth: 320,
  },
  sendGiftButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    maxHeight: screenHeight * 0.6,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  modalClose: {
    padding: 4,
  },
  modalList: {
    paddingBottom: 20,
  },
  modalColumnWrapper: {
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  modalButtonActive: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
    borderColor: '#F39C12',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default GiftLottiePreviewScreen;
