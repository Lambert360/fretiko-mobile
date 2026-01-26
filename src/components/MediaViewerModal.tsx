import React, { useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
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
        showsControls={true}
      />
    </View>
  );
};

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  visible,
  onClose,
  type,
  uri,
}) => {
  const insets = useSafeAreaInsets();
  if (!uri) return null;

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
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
          />
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
});
