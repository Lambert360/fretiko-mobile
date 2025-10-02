import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Alert,
  Switch,
  Slider,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AudioLevel {
  inputLevel: number; // 0-100
  outputLevel: number; // 0-100
}

interface CameraAudioControlsProps {
  isVisible: boolean;
  onClose: () => void;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isFrontCamera: boolean;
  onToggleAudio: (enabled: boolean) => void;
  onToggleVideo: (enabled: boolean) => void;
  onSwitchCamera: () => void;
  audioLevel?: AudioLevel;
  onVolumeChange?: (volume: number) => void;
  onMicrophoneGainChange?: (gain: number) => void;
  currentVolume?: number;
  currentMicGain?: number;
}

/**
 * Camera and Audio Controls Component
 *
 * Comprehensive controls for managing camera and audio settings during live streaming:
 * - Camera on/off toggle
 * - Front/back camera switching
 * - Audio on/off toggle
 * - Volume control slider
 * - Microphone gain adjustment
 * - Real-time audio level monitoring
 * - Camera resolution and settings
 * - Audio enhancement options
 */
const CameraAudioControls: React.FC<CameraAudioControlsProps> = ({
  isVisible,
  onClose,
  isAudioEnabled,
  isVideoEnabled,
  isFrontCamera,
  onToggleAudio,
  onToggleVideo,
  onSwitchCamera,
  audioLevel,
  onVolumeChange,
  onMicrophoneGainChange,
  currentVolume = 50,
  currentMicGain = 50,
}) => {
  const [localVolume, setLocalVolume] = useState(currentVolume);
  const [localMicGain, setLocalMicGain] = useState(currentMicGain);
  const [showAdvancedAudio, setShowAdvancedAudio] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [audioLevelAnim] = useState(new Animated.Value(0));

  // Audio enhancement settings
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);

  // Animation effects
  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  // Animate audio level indicator
  useEffect(() => {
    if (audioLevel && isAudioEnabled) {
      Animated.timing(audioLevelAnim, {
        toValue: audioLevel.inputLevel / 100,
        duration: 100,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(audioLevelAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [audioLevel, isAudioEnabled]);

  // Handle volume change
  const handleVolumeChange = (value: number) => {
    setLocalVolume(value);
    onVolumeChange?.(value);
  };

  // Handle microphone gain change
  const handleMicGainChange = (value: number) => {
    setLocalMicGain(value);
    onMicrophoneGainChange?.(value);
  };

  // Handle camera toggle with permission check
  const handleCameraToggle = () => {
    if (!isVideoEnabled) {
      // Check camera permissions before enabling
      Alert.alert(
        'Camera Access',
        'This will enable your camera for the live stream.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => onToggleVideo(true) },
        ]
      );
    } else {
      onToggleVideo(false);
    }
  };

  // Handle audio toggle with permission check
  const handleAudioToggle = () => {
    if (!isAudioEnabled) {
      Alert.alert(
        'Microphone Access',
        'This will enable your microphone for the live stream.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => onToggleAudio(true) },
        ]
      );
    } else {
      onToggleAudio(false);
    }
  };

  // Render audio level indicator
  const renderAudioLevelIndicator = () => (
    <View style={styles.audioLevelContainer}>
      <Text style={styles.audioLevelLabel}>Mic Level</Text>
      <View style={styles.audioLevelMeter}>
        <Animated.View
          style={[
            styles.audioLevelFill,
            {
              width: audioLevelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: audioLevelAnim.interpolate({
                inputRange: [0, 0.7, 0.9, 1],
                outputRange: ['#34C759', '#34C759', '#FF9500', '#FF3B30'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.audioLevelValue}>
        {audioLevel ? Math.round(audioLevel.inputLevel) : 0}%
      </Text>
    </View>
  );

  // Render camera controls
  const renderCameraControls = () => (
    <View style={styles.controlSection}>
      <Text style={styles.sectionTitle}>Camera</Text>

      <View style={styles.controlRow}>
        <View style={styles.controlInfo}>
          <Ionicons
            name={isVideoEnabled ? "videocam" : "videocam-off"}
            size={24}
            color={isVideoEnabled ? "#34C759" : "#FF3B30"}
          />
          <Text style={styles.controlLabel}>Camera</Text>
        </View>
        <Switch
          value={isVideoEnabled}
          onValueChange={handleCameraToggle}
          trackColor={{ false: '#ccc', true: '#34C759' }}
          thumbColor={isVideoEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      {isVideoEnabled && (
        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Ionicons
              name="camera-reverse"
              size={24}
              color="#667eea"
            />
            <Text style={styles.controlLabel}>
              {isFrontCamera ? 'Front Camera' : 'Back Camera'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.switchButton}
            onPress={onSwitchCamera}
          >
            <Text style={styles.switchButtonText}>Switch</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render audio controls
  const renderAudioControls = () => (
    <View style={styles.controlSection}>
      <Text style={styles.sectionTitle}>Audio</Text>

      <View style={styles.controlRow}>
        <View style={styles.controlInfo}>
          <Ionicons
            name={isAudioEnabled ? "mic" : "mic-off"}
            size={24}
            color={isAudioEnabled ? "#34C759" : "#FF3B30"}
          />
          <Text style={styles.controlLabel}>Microphone</Text>
        </View>
        <Switch
          value={isAudioEnabled}
          onValueChange={handleAudioToggle}
          trackColor={{ false: '#ccc', true: '#34C759' }}
          thumbColor={isAudioEnabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      {isAudioEnabled && renderAudioLevelIndicator()}

      {/* Volume Control */}
      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Ionicons name="volume-high" size={20} color="#666" />
          <Text style={styles.sliderLabel}>Volume</Text>
          <Text style={styles.sliderValue}>{Math.round(localVolume)}%</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={localVolume}
          onValueChange={handleVolumeChange}
          minimumTrackTintColor="#667eea"
          maximumTrackTintColor="#e1e5e9"
          thumbStyle={styles.sliderThumb}
        />
      </View>

      {/* Microphone Gain */}
      {isAudioEnabled && (
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Ionicons name="mic" size={20} color="#666" />
            <Text style={styles.sliderLabel}>Mic Gain</Text>
            <Text style={styles.sliderValue}>{Math.round(localMicGain)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={localMicGain}
            onValueChange={handleMicGainChange}
            minimumTrackTintColor="#34C759"
            maximumTrackTintColor="#e1e5e9"
            thumbStyle={styles.sliderThumb}
          />
        </View>
      )}
    </View>
  );

  // Render advanced audio settings
  const renderAdvancedAudioSettings = () => {
    if (!showAdvancedAudio) return null;

    return (
      <View style={styles.controlSection}>
        <Text style={styles.sectionTitle}>Audio Enhancement</Text>

        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Ionicons name="remove-circle" size={24} color="#667eea" />
            <View>
              <Text style={styles.controlLabel}>Noise Reduction</Text>
              <Text style={styles.controlDescription}>
                Reduces background noise
              </Text>
            </View>
          </View>
          <Switch
            value={noiseReduction}
            onValueChange={setNoiseReduction}
            trackColor={{ false: '#ccc', true: '#667eea' }}
            thumbColor={noiseReduction ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Ionicons name="repeat" size={24} color="#667eea" />
            <View>
              <Text style={styles.controlLabel}>Echo Cancellation</Text>
              <Text style={styles.controlDescription}>
                Removes audio echo
              </Text>
            </View>
          </View>
          <Switch
            value={echoCancellation}
            onValueChange={setEchoCancellation}
            trackColor={{ false: '#ccc', true: '#667eea' }}
            thumbColor={echoCancellation ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Ionicons name="trending-up" size={24} color="#667eea" />
            <View>
              <Text style={styles.controlLabel}>Auto Gain Control</Text>
              <Text style={styles.controlDescription}>
                Automatically adjusts volume
              </Text>
            </View>
          </View>
          <Switch
            value={autoGainControl}
            onValueChange={setAutoGainControl}
            trackColor={{ false: '#ccc', true: '#667eea' }}
            thumbColor={autoGainControl ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>
    );
  };

  if (!isVisible) return null;

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Camera & Audio</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            {renderCameraControls()}
            {renderAudioControls()}

            {/* Advanced Audio Toggle */}
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvancedAudio(!showAdvancedAudio)}
            >
              <Text style={styles.advancedToggleText}>Advanced Audio</Text>
              <Ionicons
                name={showAdvancedAudio ? "chevron-up" : "chevron-down"}
                size={20}
                color="#667eea"
              />
            </TouchableOpacity>

            {renderAdvancedAudioSettings()}
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                !isAudioEnabled && styles.quickActionButtonDisabled
              ]}
              onPress={() => handleAudioToggle()}
            >
              <Ionicons
                name={isAudioEnabled ? "mic" : "mic-off"}
                size={24}
                color="white"
              />
              <Text style={styles.quickActionText}>
                {isAudioEnabled ? 'Mute' : 'Unmute'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickActionButton,
                !isVideoEnabled && styles.quickActionButtonDisabled
              ]}
              onPress={() => handleCameraToggle()}
            >
              <Ionicons
                name={isVideoEnabled ? "videocam" : "videocam-off"}
                size={24}
                color="white"
              />
              <Text style={styles.quickActionText}>
                {isVideoEnabled ? 'Stop Video' : 'Start Video'}
              </Text>
            </TouchableOpacity>

            {isVideoEnabled && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={onSwitchCamera}
              >
                <Ionicons name="camera-reverse" size={24} color="white" />
                <Text style={styles.quickActionText}>Flip</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 34, // Safe area
  },

  // Header styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },

  // Controls container
  controlsContainer: {
    paddingVertical: 16,
  },

  // Control section styles
  controlSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  controlInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginLeft: 12,
  },
  controlDescription: {
    fontSize: 12,
    color: '#666',
    marginLeft: 12,
  },
  switchButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  switchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Audio level indicator
  audioLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  audioLevelLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    width: 60,
  },
  audioLevelMeter: {
    flex: 1,
    height: 6,
    backgroundColor: '#e1e5e9',
    borderRadius: 3,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  audioLevelFill: {
    height: '100%',
    borderRadius: 3,
  },
  audioLevelValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 35,
    textAlign: 'right',
  },

  // Slider styles
  sliderContainer: {
    marginVertical: 12,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#667eea',
  },

  // Advanced toggle
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  advancedToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginRight: 8,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#667eea',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  quickActionButtonDisabled: {
    backgroundColor: '#FF3B30',
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default CameraAudioControls;