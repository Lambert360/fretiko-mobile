import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const LOTTIE_WIDTH = screenWidth * 0.7;
const LOTTIE_HEIGHT = LOTTIE_WIDTH;

type PreviewStep = {
  label: string;
  lottieSource: any;
};

type SoundId =
  | 'rose'
  | 'star'
  | 'heart'
  | 'celebration'
  | 'rocket'
  | 'diamond'
  | 'winner1'
  | 'crowd'
  | 'cheer';

// Sounds are loaded once via useAudioPlayer and reused (seekTo(0) + play())
// instead of being re-created on every tap. Re-creating a player on every
// tap (createAudioPlayer) is async under the hood and calling play()
// immediately can race with the native player still initializing, which is
// why the sound would sometimes not play on the first tap.
const SOUND_MODULES: Record<SoundId, any> = {
  rose: require('../../assets/sounds/rose.MP3'),
  star: require('../../assets/sounds/star.MP3'),
  heart: require('../../assets/sounds/heart.MP3'),
  celebration: require('../../assets/sounds/celebration.MP3'),
  rocket: require('../../assets/sounds/rocket.MP3'),
  diamond: require('../../assets/sounds/diamond.MP3'),
  winner1: require('../../assets/sounds/winner1.MP3'),
  crowd: require('../../assets/sounds/crowd_sound.MP3'),
  cheer: require('../../assets/sounds/cheer.MP3'),
};

type ComboItem = {
  type: 'combo';
  id: string;
  label: string;
  soundId: SoundId;
  steps: PreviewStep[];
  /** If set, the second lottie starts after this many milliseconds while the first is still playing */
  overlap?: number;
  /** Optional lottie to render on top of a specific step */
  overlay?: {
    lottieSource: any;
    stepIndex: number;
  };
};

type SingleItem = {
  type: 'single';
  id: string;
  label: string;
  lottieSource: any;
  soundId: SoundId;
};

type PreviewItem = ComboItem | SingleItem;

const PREVIEW_ITEMS: PreviewItem[] = [
  {
    type: 'combo',
    id: 'rose',
    label: 'Rose',
    soundId: 'rose',
    overlap: 220,
    steps: [
      { label: 'Rose 1', lottieSource: require('../../assets/lottie/rose1.lottie') },
      { label: 'Rose 2', lottieSource: require('../../assets/lottie/Rose2.lottie') },
    ],
  },
  {
    type: 'combo',
    id: 'star',
    label: 'Star',
    soundId: 'star',
    steps: [
      { label: 'Star 2', lottieSource: require('../../assets/lottie/star2.lottie') },
      { label: 'Star 1', lottieSource: require('../../assets/lottie/star1.lottie') },
    ],
  },
  {
    type: 'combo',
    id: 'heart',
    label: 'Heart',
    soundId: 'heart',
    steps: [
      { label: 'Heart 1', lottieSource: require('../../assets/lottie/heart1.lottie') },
      { label: 'Heart 2', lottieSource: require('../../assets/lottie/heart2.lottie') },
    ],
  },
  {
    type: 'combo',
    id: 'celebration',
    label: 'Celebration',
    soundId: 'celebration',
    steps: [
      { label: 'Celebration 1', lottieSource: require('../../assets/lottie/Celebration1.lottie') },
      { label: 'Celebration 2', lottieSource: require('../../assets/lottie/celebration2.lottie') },
    ],
  },
  {
    type: 'combo',
    id: 'rocket',
    label: 'Rocket',
    soundId: 'rocket',
    steps: [
      { label: 'Rocket 1', lottieSource: require('../../assets/lottie/rocket1.lottie') },
      { label: 'Rocket 2', lottieSource: require('../../assets/lottie/rocket2.lottie') },
    ],
  },
  {
    type: 'single',
    id: 'diamond',
    label: 'Diamond',
    lottieSource: require('../../assets/lottie/diamond.lottie'),
    soundId: 'diamond',
  },
  {
    type: 'single',
    id: 'money-gun',
    label: 'Money Gun',
    lottieSource: require('../../assets/lottie/money-gun.lottie'),
    soundId: 'winner1',
  },
  {
    type: 'single',
    id: 'shooting-game',
    label: 'Shooting Game',
    lottieSource: require('../../assets/lottie/shooting-game.lottie'),
    soundId: 'crowd',
  },
  {
    type: 'single',
    id: 'singer',
    label: 'Singer in Studio',
    lottieSource: require('../../assets/lottie/singer-in-studio.lottie'),
    soundId: 'cheer',
  },
];

const GiftLottiePreviewScreen = () => {
  const navigation = useNavigation();
  const [activeItem, setActiveItem] = useState<PreviewItem | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [overlapStep, setOverlapStep] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [lottieDone, setLottieDone] = useState(false);
  const [soundDone, setSoundDone] = useState(false);
  const overlapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlapTriggeredRef = useRef(false);
  const soundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Pre-create one persistent player per sound (mirrors useAuctionSounds
  // pattern). Re-using players via seekTo(0) + play() avoids the async
  // native-init race condition that createAudioPlayer() has when called
  // fresh on every button tap.
  const rosePlayer = useAudioPlayer(SOUND_MODULES.rose);
  const starPlayer = useAudioPlayer(SOUND_MODULES.star);
  const heartPlayer = useAudioPlayer(SOUND_MODULES.heart);
  const celebrationPlayer = useAudioPlayer(SOUND_MODULES.celebration);
  const rocketPlayer = useAudioPlayer(SOUND_MODULES.rocket);
  const diamondPlayer = useAudioPlayer(SOUND_MODULES.diamond);
  const winner1Player = useAudioPlayer(SOUND_MODULES.winner1);
  const crowdPlayer = useAudioPlayer(SOUND_MODULES.crowd);
  const cheerPlayer = useAudioPlayer(SOUND_MODULES.cheer);

  const soundPlayers: Record<SoundId, ReturnType<typeof useAudioPlayer>> = {
    rose: rosePlayer,
    star: starPlayer,
    heart: heartPlayer,
    celebration: celebrationPlayer,
    rocket: rocketPlayer,
    diamond: diamondPlayer,
    winner1: winner1Player,
    crowd: crowdPlayer,
    cheer: cheerPlayer,
  };

  useEffect(() => {
    if (overlapTimerRef.current) {
      clearTimeout(overlapTimerRef.current);
      overlapTimerRef.current = null;
    }
    overlapTriggeredRef.current = false;

    if (!activeItem || activeItem.type !== 'combo' || !activeItem.overlap) {
      setOverlapStep(0);
      return;
    }

    setOverlapStep(0);
    // Fallback timer: if onAnimationLoaded never fires, the second lottie
    // still appears after the configured overlap.
    overlapTimerRef.current = setTimeout(() => {
      if (!overlapTriggeredRef.current) {
        overlapTriggeredRef.current = true;
        setOverlapStep(1);
      }
    }, activeItem.overlap);

    return () => {
      if (overlapTimerRef.current) {
        clearTimeout(overlapTimerRef.current);
        overlapTimerRef.current = null;
      }
    };
  }, [activeItem, replayKey]);

  // Fade out the gift once both the lottie and sound have finished.
  useEffect(() => {
    if (!activeItem || !lottieDone || !soundDone) return;

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setActiveItem(null);
        setLottieDone(false);
        setSoundDone(false);
        setActiveStep(0);
        setOverlapStep(0);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [activeItem, lottieDone, soundDone]);

  const currentSource = activeItem
    ? activeItem.type === 'combo' && !activeItem.overlap
      ? activeItem.steps[activeStep].lottieSource
      : activeItem.type === 'single'
        ? activeItem.lottieSource
        : null
    : null;

  const currentLabel = activeItem
    ? activeItem.type === 'combo' && activeItem.overlap
      ? `${activeItem.label} sent!`
      : activeItem.type === 'combo'
        ? `${activeItem.label} (${activeItem.steps[activeStep].label})`
        : `${activeItem.label} sent!`
    : '';

  const handlePlay = useCallback((item: PreviewItem) => {
    setActiveItem(item);
    setActiveStep(0);
    setOverlapStep(0);
    setReplayKey(prev => prev + 1);
    setLottieDone(false);
    setSoundDone(false);
    fadeAnim.setValue(1);
    setModalVisible(false); // close the selector so the gift is visible

    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current);
      soundTimeoutRef.current = null;
    }

    try {
      const player = soundPlayers[item.soundId];
      // Reuse the pre-loaded, already-initialized player instead of creating
      // a new one. seekTo(0) resets playback so repeated taps replay from
      // the start reliably, without the async init race.
      player.seekTo(0);
      player.play();

      // Mark sound finished when its duration elapses (fallback to 2s if unknown).
      const durationMs =
        player.duration && player.duration > 0
          ? player.duration * 1000
          : 2000;
      soundTimeoutRef.current = setTimeout(() => {
        setSoundDone(true);
      }, durationMs);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [rosePlayer, starPlayer, heartPlayer, celebrationPlayer, rocketPlayer, diamondPlayer, winner1Player, crowdPlayer, cheerPlayer, setModalVisible]);

  const handleFirstLottieLoaded = useCallback(() => {
    if (!activeItem || activeItem.type !== 'combo' || !activeItem.overlap) return;
    if (overlapTriggeredRef.current) return;

    overlapTriggeredRef.current = true;
    if (overlapTimerRef.current) {
      clearTimeout(overlapTimerRef.current);
    }
    overlapTimerRef.current = setTimeout(() => {
      setOverlapStep(1);
    }, activeItem.overlap);
  }, [activeItem]);

  const handleAnimationFinish = useCallback(() => {
    if (!activeItem) return;

    if (activeItem.type === 'combo' && !activeItem.overlap && activeStep < activeItem.steps.length - 1) {
      setActiveStep(prev => prev + 1);
      setReplayKey(prev => prev + 1);
    } else {
      setLottieDone(true);
    }
  }, [activeItem, activeStep]);

  const renderStage = () => {
    if (!activeItem) return null;

    if (activeItem.type === 'combo' && activeItem.overlap) {
      return (
        <View style={styles.overlapContainer}>
          <LottieView
            key={`${activeItem.id}-0-${replayKey}`}
            source={activeItem.steps[0].lottieSource}
            autoPlay
            loop={false}
            style={styles.lottieOverlap}
            resizeMode="contain"
            onAnimationLoaded={handleFirstLottieLoaded}
          />
          {overlapStep >= 1 && (
            <LottieView
              key={`${activeItem.id}-1-${replayKey}`}
              source={activeItem.steps[1].lottieSource}
              autoPlay
              loop={false}
              style={styles.lottieOverlap}
              resizeMode="contain"
              onAnimationFinish={handleAnimationFinish}
            />
          )}
        </View>
      );
    }

    const overlaySource =
      activeItem.type === 'combo' && activeItem.overlay
        ? activeItem.overlay.lottieSource
        : null;
    const shouldOverlay =
      activeItem.type === 'combo' &&
      activeStep === activeItem.overlay?.stepIndex &&
      overlaySource !== null;

    return currentSource ? (
      <View style={shouldOverlay ? styles.overlapContainer : undefined}>
        <LottieView
          key={`${activeItem?.id}-${activeStep}-${replayKey}`}
          source={currentSource}
          autoPlay
          loop={false}
          style={shouldOverlay ? styles.lottieOverlap : styles.lottie}
          resizeMode="contain"
          onAnimationFinish={handleAnimationFinish}
        />
        {overlaySource !== null && shouldOverlay && (
          <LottieView
            key={`${activeItem?.id}-overlay-${replayKey}`}
            source={overlaySource}
            autoPlay
            loop={false}
            style={styles.lottieOverlap}
            resizeMode="contain"
          />
        )}
      </View>
    ) : null;
  };

  const renderButton = ({ item }: { item: PreviewItem }) => (
    <TouchableOpacity
      style={[
        styles.modalButton,
        activeItem?.id === item.id && styles.modalButtonActive,
      ]}
      onPress={() => handlePlay(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.modalButtonText}>{item.label}</Text>
      <Ionicons
        name={activeItem?.id === item.id ? 'pause-circle' : 'play-circle'}
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
          <Text style={styles.sendGiftButtonText}>Send Gift</Text>
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

            <FlatList
              data={PREVIEW_ITEMS}
              renderItem={renderButton}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.modalList}
              columnWrapperStyle={styles.modalColumnWrapper}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Gift animation overlay — sits in the same bottom-screen position the real gift modal uses */}
      {activeItem && (
        <Animated.View style={[styles.stageArea, { opacity: fadeAnim }]} pointerEvents="none">
          {renderStage()}

          {currentLabel !== '' && (
            <View style={styles.giftNotice}>
              <Ionicons name="gift" size={14} color="#FFD700" />
              <Text style={styles.giftNoticeText}>{currentLabel}</Text>
            </View>
          )}
        </Animated.View>
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
  overlapContainer: {
    width: LOTTIE_WIDTH,
    height: LOTTIE_HEIGHT,
    position: 'relative',
    alignSelf: 'center',
    marginTop: 0,
  },
  lottie: {
    width: LOTTIE_WIDTH,
    height: LOTTIE_HEIGHT,
    alignSelf: 'center',
    marginTop: 0,
  },
  lottieOverlap: {
    ...StyleSheet.absoluteFillObject,
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
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.6,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalClose: {
    padding: 4,
  },
  modalList: {
    padding: 16,
    paddingBottom: 32,
  },
  modalColumnWrapper: {
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    margin: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalButtonActive: {
    borderColor: '#3498DB',
    backgroundColor: '#1A2A3A',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default GiftLottiePreviewScreen;
