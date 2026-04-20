import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ScrollView,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MediaViewerModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'image' | 'video';
  uri: string;
  uris?: string[];
  initialIndex?: number;
}

const ModalVideoPlayer = ({ uri, onClose }: { uri: string; onClose: () => void }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    player.play();
    return () => {
      // Skip pause on unmount: modal close tears down the native player first,
      // so pause() can throw "shared object already released". Let native cleanup handle it.
    };
  }, [player]);

  return (
    <View style={styles.mediaContent}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
      />
    </View>
  );
};

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  visible,
  onClose,
  type,
  uri,
  uris,
  initialIndex = 0,
}) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef<ScrollView>(null);

  // Reset index when modal opens with new URIs
  useEffect(() => {
    if (visible && uris && uris.length > 0) {
      setCurrentIndex(initialIndex);
      scrollViewRef.current?.scrollTo({
        x: initialIndex * screenWidth,
        animated: false,
      });
    }
  }, [visible, uris, initialIndex]);

  if (!uri && (!uris || uris.length === 0)) return null;

  // Use uris array if provided, otherwise fall back to single uri
  const imageUris = uris && uris.length > 0 ? uris : [uri];
  const showMultiple = imageUris.length > 1 && type === 'image';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={[styles.closeButton, { top: Math.max(insets.top, 12) + 8 }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        {type === 'image' ? (
          <>
            {showMultiple ? (
              <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                  setCurrentIndex(index);
                }}
                style={styles.scrollView}
              >
                {imageUris.map((imageUri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Image
                source={{ uri: imageUris[0] }}
                style={styles.image}
                resizeMode="contain"
              />
            )}
            {showMultiple && (
              <View style={styles.indicatorContainer}>
                <Text style={styles.indicatorText}>
                  {currentIndex + 1} / {imageUris.length}
                </Text>
              </View>
            )}
          </>
        ) : (
          visible && <ModalVideoPlayer uri={uri} onClose={onClose} />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  mediaContent: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
  video: {
    width: screenWidth,
    height: screenHeight,
  },
  scrollView: {
    width: screenWidth,
    height: screenHeight,
  },
  imageContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  indicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
