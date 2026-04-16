import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { storyUploadService } from '../services/storyUploadService';
import { storiesAPI } from '../services/storiesAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const StoryUploadScreen = () => {
  const navigation = useNavigation();

  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: 'image' | 'video';
    name: string;
    mimeType: string;
    duration?: number;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string>(`draft-${Date.now()}`);

  const player = useVideoPlayer(selectedMedia?.uri || '', (player) => {
    player.loop = true;
    player.play();
  });

  const pickImageFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Please allow access to your photo library to select images and videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [9, 16], // Story aspect ratio
        quality: 0.8,
        videoMaxDuration: 30, // 30 seconds max for stories
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Validate file size
        if (asset.fileSize && asset.fileSize > 25 * 1024 * 1024) { // 25MB limit
          Alert.alert('File too large', 'Please select a file smaller than 25MB.');
          return;
        }

        setSelectedMedia({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName || `story_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          duration: asset.duration,
        });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select media. Please try again.');
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Please allow camera access to take photos and videos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [9, 16], // Story aspect ratio
        quality: 0.8,
        videoMaxDuration: 30, // 30 seconds max for stories
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        setSelectedMedia({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName || `story_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
          duration: asset.duration,
        });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture media. Please try again.');
    }
  };

  const showMediaPicker = () => {
    Alert.alert(
      'Select Media',
      'Choose how you want to add media to your story',
      [
        { text: 'Camera', onPress: takePhotoWithCamera },
        { text: 'Gallery', onPress: pickImageFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Save draft when caption changes
  React.useEffect(() => {
    if (selectedMedia && caption) {
      const draft = {
        id: currentDraftId,
        fileUri: selectedMedia.uri,
        fileName: selectedMedia.name,
        fileType: selectedMedia.mimeType,
        caption: caption.trim(),
        duration: selectedMedia.duration,
        timestamp: Date.now(),
      };
      storyUploadService.saveDraft(draft);
    }
  }, [caption, selectedMedia, currentDraftId]);

  const uploadStory = async () => {
    if (!selectedMedia) {
      Alert.alert('No media selected', 'Please select a photo or video for your story.');
      return;
    }

    setIsUploading(true);

    try {
      console.log('🚀 Starting enhanced story upload...');

      // Upload with compression and retry logic
      const result = await storyUploadService.uploadCompleteStoryEnhanced(
        selectedMedia.uri,
        selectedMedia.name,
        selectedMedia.mimeType,
        caption.trim() || undefined,
        selectedMedia.duration
      );

      if (result.uploadResult.success && result.storyData) {
        console.log('✅ Story uploaded successfully');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Delete draft after successful upload
        await storyUploadService.deleteDraft(currentDraftId);

        Alert.alert(
          'Story uploaded!',
          'Your story has been shared with your plugged users.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error(result.uploadResult.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Story upload error:', error);
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Failed to upload story. Will retry automatically.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry Now', onPress: () => uploadStory() }
        ]
      );
    } finally {
      setIsUploading(false);
    }
  };

  const renderMediaPreview = () => {
    if (!selectedMedia) return null;

    return (
      <View style={styles.mediaContainer}>
        {selectedMedia.type === 'video' ? (
          <VideoView
            style={styles.media}
            player={player}
            fullscreenOptions={{
              allowFullscreen: false,
              allowPictureInPicture: false,
            }}
          />
        ) : (
          <Image
            source={{ uri: selectedMedia.uri }}
            style={styles.media}
            resizeMode="contain"
          />
        )}

        {/* Media overlay controls */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.6)']}
          style={styles.mediaOverlay}
        >
          <SafeAreaView style={styles.mediaControls}>
            {/* Top controls */}
            <View style={styles.topControls}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setSelectedMedia(null)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>

              <Text style={styles.mediaTypeIndicator}>
                {selectedMedia.type === 'video' ? '📹' : '📷'}
              </Text>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              <TouchableOpacity
                style={styles.captionButton}
                onPress={() => setShowCaptionInput(true)}
              >
                <Ionicons name="text-outline" size={20} color="white" />
                <Text style={styles.captionButtonText}>Add Caption</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={uploadStory}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="white" />
                    <Text style={styles.uploadButtonText}>Share Story</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Caption display */}
        {caption && (
          <View style={styles.captionDisplay}>
            <Text style={styles.captionText}>{caption}</Text>
            <TouchableOpacity
              style={styles.editCaptionButton}
              onPress={() => setShowCaptionInput(true)}
            >
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderCaptionInput = () => {
    if (!showCaptionInput) return null;

    return (
      <View style={styles.captionInputOverlay}>
        <View style={styles.captionInputContainer}>
          <Text style={styles.captionInputTitle}>Add a caption</Text>

          <TextInput
            style={styles.captionInput}
            placeholder="What's happening?"
            placeholderTextColor="#999"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={150}
            autoFocus
          />

          <Text style={styles.characterCount}>{caption.length}/150</Text>

          <View style={styles.captionInputButtons}>
            <TouchableOpacity
              style={[styles.captionInputButton, styles.cancelButton]}
              onPress={() => {
                setShowCaptionInput(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captionInputButton, styles.saveButton]}
              onPress={() => {
                setShowCaptionInput(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.saveButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateContent}>
        <View style={styles.emptyStateIcon}>
          <Ionicons name="camera" size={60} color="#666" />
        </View>

        <Text style={styles.emptyStateTitle}>Create Your Story</Text>
        <Text style={styles.emptyStateSubtitle}>
          Share a moment with your plugged users.{'\n'}
          Photos and videos disappear after 24 hours.
        </Text>

        <TouchableOpacity
          style={styles.selectMediaButton}
          onPress={showMediaPicker}
        >
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.selectMediaButtonText}>Select Media</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {selectedMedia ? renderMediaPreview() : renderEmptyState()}
      {renderCaptionInput()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateContent: {
    alignItems: 'center',
  },
  emptyStateIcon: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyStateSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  selectMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  selectMediaButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  mediaContainer: {
    flex: 1,
  },
  media: {
    width: screenWidth,
    height: screenHeight,
  },
  mediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mediaControls: {
    flex: 1,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  controlButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaTypeIndicator: {
    fontSize: 24,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
    marginTop: 'auto',
  },
  captionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  captionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  captionDisplay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    borderRadius: 12,
  },
  captionText: {
    color: 'white',
    fontSize: 16,
    flex: 1,
    lineHeight: 22,
  },
  editCaptionButton: {
    marginLeft: 8,
    padding: 4,
  },
  captionInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  captionInputContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 20,
  },
  captionInputTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  captionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    color: 'white',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  captionInputButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  captionInputButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StoryUploadScreen;