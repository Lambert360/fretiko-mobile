import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';

const { width: screenWidth } = Dimensions.get('window');

interface QualityPreset {
  name: string;
  resolution: string;
  frameRate: number;
  bitrate: number;
  description: string;
}

interface NetworkInfo {
  quality: number; // 1-6 (1 = excellent, 6 = poor)
  bandwidth: number; // Estimated bandwidth in kbps
  latency: number; // Network latency in ms
}

interface StreamQualityControlsProps {
  isVisible: boolean;
  onClose: () => void;
  currentQuality: 'low' | 'medium' | 'high' | 'auto';
  onQualityChange: (quality: 'low' | 'medium' | 'high' | 'auto') => void;
  networkInfo?: NetworkInfo;
  isPublisher?: boolean;
  customPresets?: QualityPreset[];
}

/**
 * Stream Quality Controls Component
 *
 * Comprehensive quality management interface that provides:
 * - Predefined quality presets (Low, Medium, High, Auto)
 * - Custom quality configuration for advanced users
 * - Network-aware quality recommendations
 * - Real-time quality monitoring and adjustments
 * - Publisher vs viewer specific controls
 * - Adaptive bitrate recommendations based on network conditions
 */
const StreamQualityControls: React.FC<StreamQualityControlsProps> = ({
  isVisible,
  onClose,
  currentQuality,
  onQualityChange,
  networkInfo,
  isPublisher = true,
  customPresets,
}) => {
  const [selectedQuality, setSelectedQuality] = useState(currentQuality);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customResolution, setCustomResolution] = useState('640x480');
  const [customFrameRate, setCustomFrameRate] = useState(24);
  const [customBitrate, setCustomBitrate] = useState(800);
  const [slideAnim] = useState(new Animated.Value(0));

  // Default quality presets
  const defaultPresets: Record<string, QualityPreset> = {
    low: {
      name: 'Low Quality',
      resolution: '480x360',
      frameRate: 15,
      bitrate: 400,
      description: 'Best for poor network conditions',
    },
    medium: {
      name: 'Medium Quality',
      resolution: '640x480',
      frameRate: 24,
      bitrate: 800,
      description: 'Balanced quality and performance',
    },
    high: {
      name: 'High Quality',
      resolution: '1280x720',
      frameRate: 30,
      bitrate: 1500,
      description: 'Best quality for good network',
    },
    auto: {
      name: 'Auto Quality',
      resolution: 'Variable',
      frameRate: 30,
      bitrate: 0,
      description: 'Automatically adjusts based on network',
    },
  };

  const presets = customPresets ?
    customPresets.reduce((acc, preset) => ({ ...acc, [preset.name.toLowerCase()]: preset }), {}) :
    defaultPresets;

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

  // Get network quality recommendation
  const getNetworkRecommendation = (): 'low' | 'medium' | 'high' | 'auto' => {
    if (!networkInfo) return 'auto';

    const { quality, bandwidth } = networkInfo;

    // Poor network (quality 4-6 or low bandwidth)
    if (quality >= 4 || bandwidth < 500) {
      return 'low';
    }
    // Good network (quality 1-2 and high bandwidth)
    else if (quality <= 2 && bandwidth > 1000) {
      return 'high';
    }
    // Medium network
    else {
      return 'medium';
    }
  };

  // Apply quality changes
  const handleApplyChanges = () => {
    onQualityChange(selectedQuality);
    onClose();

    // Show confirmation
    Alert.alert(
      'Quality Updated',
      `Stream quality changed to ${presets[selectedQuality]?.name || selectedQuality}`,
      [{ text: 'OK' }]
    );
  };

  // Reset to recommended quality
  const handleUseRecommended = () => {
    const recommended = getNetworkRecommendation();
    setSelectedQuality(recommended);
  };

  // Render quality preset option
  const renderQualityOption = (key: string, preset: QualityPreset) => {
    const isSelected = selectedQuality === key;
    const isRecommended = key === getNetworkRecommendation();

    return (
      <TouchableOpacity
        key={key}
        style={[styles.qualityOption, isSelected && styles.qualityOptionSelected]}
        onPress={() => setSelectedQuality(key as any)}
      >
        <View style={styles.qualityOptionContent}>
          <View style={styles.qualityOptionHeader}>
            <Text style={[styles.qualityOptionName, isSelected && styles.qualityOptionNameSelected]}>
              {preset.name}
            </Text>
            {isRecommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>Recommended</Text>
              </View>
            )}
          </View>

          <Text style={[styles.qualityOptionDescription, isSelected && styles.qualityOptionDescriptionSelected]}>
            {preset.description}
          </Text>

          <View style={styles.qualitySpecs}>
            <Text style={[styles.qualitySpec, isSelected && styles.qualitySpecSelected]}>
              {preset.resolution}
            </Text>
            <Text style={[styles.qualitySpec, isSelected && styles.qualitySpecSelected]}>
              {preset.frameRate}fps
            </Text>
            {preset.bitrate > 0 && (
              <Text style={[styles.qualitySpec, isSelected && styles.qualitySpecSelected]}>
                {preset.bitrate}kbps
              </Text>
            )}
          </View>
        </View>

        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#34C759" />
        )}
      </TouchableOpacity>
    );
  };

  // Render network status
  const renderNetworkStatus = () => {
    if (!networkInfo) return null;

    const { quality, bandwidth, latency } = networkInfo;
    const qualityColor = quality <= 2 ? '#34C759' : quality <= 4 ? '#FF9500' : '#FF3B30';
    const qualityText = quality <= 2 ? 'Excellent' : quality <= 4 ? 'Good' : 'Poor';

    return (
      <View style={styles.networkStatus}>
        <Text style={styles.networkStatusTitle}>Network Status</Text>

        <View style={styles.networkMetrics}>
          <View style={styles.networkMetric}>
            <View style={styles.networkMetricHeader}>
              <Ionicons name="wifi" size={16} color={qualityColor} />
              <Text style={styles.networkMetricLabel}>Quality</Text>
            </View>
            <Text style={[styles.networkMetricValue, { color: qualityColor }]}>
              {qualityText} ({quality}/6)
            </Text>
          </View>

          <View style={styles.networkMetric}>
            <View style={styles.networkMetricHeader}>
              <Ionicons name="speedometer" size={16} color="#666" />
              <Text style={styles.networkMetricLabel}>Bandwidth</Text>
            </View>
            <Text style={styles.networkMetricValue}>
              {bandwidth >= 1000 ? `${(bandwidth / 1000).toFixed(1)}Mbps` : `${bandwidth}kbps`}
            </Text>
          </View>

          <View style={styles.networkMetric}>
            <View style={styles.networkMetricHeader}>
              <Ionicons name="time" size={16} color="#666" />
              <Text style={styles.networkMetricLabel}>Latency</Text>
            </View>
            <Text style={styles.networkMetricValue}>{latency}ms</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render advanced controls
  const renderAdvancedControls = () => {
    if (!showAdvanced) return null;

    const resolutionOptions = [
      '320x240', '480x360', '640x480', '854x480',
      '1280x720', '1920x1080'
    ];

    const frameRateOptions = [15, 24, 30, 60];
    const bitrateOptions = [200, 400, 800, 1200, 1500, 2000, 3000];

    return (
      <View style={styles.advancedControls}>
        <Text style={styles.advancedTitle}>Advanced Settings</Text>

        <View style={styles.advancedControl}>
          <Text style={styles.advancedLabel}>Resolution</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={customResolution}
              onValueChange={setCustomResolution}
              style={styles.picker}
            >
              {resolutionOptions.map(resolution => (
                <Picker.Item
                  key={resolution}
                  label={resolution}
                  value={resolution}
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.advancedControl}>
          <Text style={styles.advancedLabel}>Frame Rate</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={customFrameRate}
              onValueChange={setCustomFrameRate}
              style={styles.picker}
            >
              {frameRateOptions.map(fps => (
                <Picker.Item
                  key={fps}
                  label={`${fps} fps`}
                  value={fps}
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.advancedControl}>
          <Text style={styles.advancedLabel}>Bitrate</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={customBitrate}
              onValueChange={setCustomBitrate}
              style={styles.picker}
            >
              {bitrateOptions.map(bitrate => (
                <Picker.Item
                  key={bitrate}
                  label={`${bitrate} kbps`}
                  value={bitrate}
                />
              ))}
            </Picker>
          </View>
        </View>

        <Text style={styles.advancedWarning}>
          ⚠️ Advanced settings may affect stream performance. Use recommended presets for best results.
        </Text>
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
                    outputRange: [300, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Stream Quality</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Network Status */}
          {renderNetworkStatus()}

          {/* Quality Presets */}
          <View style={styles.qualitySection}>
            <View style={styles.qualitySectionHeader}>
              <Text style={styles.qualitySectionTitle}>Quality Presets</Text>
              {networkInfo && (
                <TouchableOpacity
                  style={styles.recommendedButton}
                  onPress={handleUseRecommended}
                >
                  <Text style={styles.recommendedButtonText}>Use Recommended</Text>
                </TouchableOpacity>
              )}
            </View>

            {Object.entries(presets).map(([key, preset]) =>
              renderQualityOption(key, preset)
            )}
          </View>

          {/* Advanced Controls Toggle */}
          {isPublisher && (
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={styles.advancedToggleText}>Advanced Settings</Text>
              <Ionicons
                name={showAdvanced ? "chevron-up" : "chevron-down"}
                size={20}
                color="#667eea"
              />
            </TouchableOpacity>
          )}

          {/* Advanced Controls */}
          {renderAdvancedControls()}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApplyChanges}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>Apply Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
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
    maxHeight: '90%',
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

  // Network status styles
  networkStatus: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  networkStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  networkMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  networkMetric: {
    flex: 1,
    alignItems: 'center',
  },
  networkMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  networkMetricLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  networkMetricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },

  // Quality section styles
  qualitySection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  qualitySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qualitySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  recommendedButton: {
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  recommendedButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },

  // Quality option styles
  qualityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  qualityOptionSelected: {
    borderColor: '#34C759',
    backgroundColor: '#f0fff4',
  },
  qualityOptionContent: {
    flex: 1,
  },
  qualityOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  qualityOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  qualityOptionNameSelected: {
    color: '#34C759',
  },
  recommendedBadge: {
    backgroundColor: '#667eea',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  qualityOptionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  qualityOptionDescriptionSelected: {
    color: '#22C55E',
  },
  qualitySpecs: {
    flexDirection: 'row',
    gap: 8,
  },
  qualitySpec: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qualitySpecSelected: {
    color: '#16A34A',
    backgroundColor: '#dcfce7',
  },

  // Advanced controls styles
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
  advancedControls: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
  },
  advancedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  advancedControl: {
    marginBottom: 16,
  },
  advancedLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  picker: {
    height: 50,
  },
  advancedWarning: {
    fontSize: 12,
    color: '#ff6b35',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Action buttons styles
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default StreamQualityControls;