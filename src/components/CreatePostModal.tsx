import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { postsAPI, PostMedia, MediaType, PrivacyLevel } from '../services/postsAPI';
import { fileUploadService } from '../services/fileUploadService';
import { useAuth } from '../contexts/AuthContext';
import SafeImage from './SafeImage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: (post: any) => void;
}

const MAX_MEDIA_ITEMS = 10;
const MAX_TEXT_LENGTH = 2000;

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; icon: string }[] = [
  { value: 'public', label: 'Public', icon: 'globe' },
  { value: 'friends', label: 'Friends', icon: 'people' },
  { value: 'private', label: 'Private', icon: 'lock-closed' },
];

const CreatePostModal: React.FC<CreatePostModalProps> = ({
  visible,
  onClose,
  onPostCreated,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('public');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPrivacySelector, setShowPrivacySelector] = useState(false);
  
  const contentInputRef = useRef<TextInput>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setContent('');
      setMedia([]);
      setPrivacyLevel('public');
      setUploadProgress(0);
    }
  }, [visible]);

  // Pick images from gallery
  const pickImages = useCallback(async () => {
    try {
      const remainingSlots = MAX_MEDIA_ITEMS - media.length;
      if (remainingSlots <= 0) {
        Alert.alert('Limit Reached', `You can only add up to ${MAX_MEDIA_ITEMS} media items.`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const newMedia: PostMedia[] = result.assets.map(asset => ({
          mediaUrl: asset.uri,
          mediaType: 'image',
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
        }));

        setMedia(prev => [...prev, ...newMedia]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to select images');
    }
  }, [media.length]);

  // Pick video from gallery
  const pickVideo = useCallback(async () => {
    try {
      if (media.length >= MAX_MEDIA_ITEMS) {
        Alert.alert('Limit Reached', `You can only add up to ${MAX_MEDIA_ITEMS} media items.`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const asset = result.assets[0];
        const newMedia: PostMedia = {
          mediaUrl: asset.uri,
          mediaType: 'video',
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          duration: asset.duration ?? undefined,
        };

        setMedia(prev => [...prev, newMedia]);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to select video');
    }
  }, [media.length]);

  // Take photo with camera
  const takePhoto = useCallback(async () => {
    try {
      if (media.length >= MAX_MEDIA_ITEMS) {
        Alert.alert('Limit Reached', `You can only add up to ${MAX_MEDIA_ITEMS} media items.`);
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const asset = result.assets[0];
        const newMedia: PostMedia = {
          mediaUrl: asset.uri,
          mediaType: 'image',
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
        };

        setMedia(prev => [...prev, newMedia]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, [media.length]);

  // Remove media item
  const removeMedia = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMedia(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Reorder media items
  const reorderMedia = useCallback((fromIndex: number, toIndex: number) => {
    setMedia(prev => {
      const newMedia = [...prev];
      const [moved] = newMedia.splice(fromIndex, 1);
      newMedia.splice(toIndex, 0, moved);
      return newMedia;
    });
  }, []);

  // Upload media files
  const uploadMedia = async (): Promise<PostMedia[]> => {
    const uploadedMedia: PostMedia[] = [];
    
    for (let i = 0; i < media.length; i++) {
      const item = media[i];
      setUploadProgress(((i + 1) / media.length) * 100);
      
      try {
        // Upload file - generate a filename from the URI
        const fileName = item.mediaUrl.split('/').pop() || `file-${Date.now()}`;
        const fileType = item.mimeType || (item.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
        
        const uploadResult = await fileUploadService.uploadFile(
          item.mediaUrl,
          fileName,
          fileType,
          'posts-media' // Use posts-media bucket
        );

        if (uploadResult.success && uploadResult.publicUrl) {
          uploadedMedia.push({
            ...item,
            mediaUrl: uploadResult.publicUrl,
            thumbnailUrl: item.mediaType === 'video' ? uploadResult.publicUrl : undefined,
          });
        }
      } catch (error) {
        console.error('Error uploading media:', error);
        throw new Error(`Failed to upload media item ${i + 1}`);
      }
    }
    
    return uploadedMedia;
  };

  // Determine media type from files
  const determineMediaType = (files: PostMedia[]): MediaType => {
    if (files.length === 0) return 'text';
    if (files.length === 1) return files[0].mediaType;
    
    const hasImages = files.some(f => f.mediaType === 'image');
    const hasVideos = files.some(f => f.mediaType === 'video');
    
    if (hasImages && hasVideos) return 'mixed';
    return hasVideos ? 'video' : 'image';
  };

  // Submit post
  const handleSubmit = async () => {
    if (!content.trim() && media.length === 0) {
      Alert.alert('Empty Post', 'Please add some text or media to your post.');
      return;
    }

    setIsLoading(true);
    
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Upload media if any
      let uploadedMedia: PostMedia[] = [];
      if (media.length > 0) {
        uploadedMedia = await uploadMedia();
      }

      // Create post
      const post = await postsAPI.createPost({
        content: content.trim() || undefined,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        mediaType: determineMediaType(uploadedMedia),
        privacyLevel,
      });

      // Success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (onPostCreated) {
        onPostCreated(post);
      }
      
      onClose();
      
      Alert.alert('Success', 'Your post has been created!');
    } catch (error: any) {
      console.error('Error creating post:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Render media item
  const renderMediaItem = ({ item, index }: { item: PostMedia; index: number }) => {
    if (item.mediaType === 'video') {
      const player = useVideoPlayer(item.mediaUrl, (p) => {
        p.loop = true;
        p.pause();
      });

      return (
        <View style={styles.mediaItemContainer}>
          <VideoView
            style={styles.mediaItem}
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
          <View style={styles.videoIndicator}>
            <Ionicons name="videocam" size={16} color="white" />
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeMedia(index)}
          >
            <Ionicons name="close-circle" size={24} color="#FF4757" />
          </TouchableOpacity>
          <Text style={styles.mediaIndex}>{index + 1}</Text>
        </View>
      );
    }

    return (
      <View style={styles.mediaItemContainer}>
        <Image
          source={{ uri: item.mediaUrl }}
          style={styles.mediaItem}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeMedia(index)}
        >
          <Ionicons name="close-circle" size={24} color="#FF4757" />
        </TouchableOpacity>
        <Text style={styles.mediaIndex}>{index + 1}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Create Post</Text>
          
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading || (!content.trim() && media.length === 0)}
            style={[
              styles.postButton,
              (isLoading || (!content.trim() && media.length === 0)) && styles.postButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* User Info */}
          <View style={styles.userInfo}>
            <SafeImage
              source={{ uri: user?.avatar_url || 'https://via.placeholder.com/50' }}
              style={styles.userAvatar}
            />
            <View style={styles.userInfoText}>
              <Text style={styles.username}>@{user?.username || 'User'}</Text>
              <TouchableOpacity
                style={styles.privacySelector}
                onPress={() => setShowPrivacySelector(true)}
              >
                <Ionicons
                  name={PRIVACY_OPTIONS.find(p => p.value === privacyLevel)?.icon as any}
                  size={14}
                  color="#666"
                />
                <Text style={styles.privacyText}>
                  {PRIVACY_OPTIONS.find(p => p.value === privacyLevel)?.label}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Text Input */}
          <TextInput
            ref={contentInputRef}
            style={styles.textInput}
            multiline
            placeholder="What's on your mind?"
            placeholderTextColor="#999"
            value={content}
            onChangeText={setContent}
            maxLength={MAX_TEXT_LENGTH}
            textAlignVertical="top"
          />

          {/* Character Count */}
          <Text style={styles.characterCount}>
            {content.length}/{MAX_TEXT_LENGTH}
          </Text>

          {/* Media Preview */}
          {media.length > 0 && (
            <View style={styles.mediaSection}>
              <FlatList
                data={media}
                renderItem={renderMediaItem}
                keyExtractor={(item, index) => `media-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mediaList}
              />
            </View>
          )}

          {/* Upload Progress */}
          {isLoading && uploadProgress > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${uploadProgress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                Uploading... {Math.round(uploadProgress)}%
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={pickImages}>
              <Ionicons name="images" size={24} color="#4CAF50" />
              <Text style={styles.actionButtonText}>Photos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={pickVideo}>
              <Ionicons name="videocam" size={24} color="#FF5722" />
              <Text style={styles.actionButtonText}>Video</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#2196F3" />
              <Text style={styles.actionButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>

          {/* Media Count */}
          <Text style={styles.mediaCount}>
            {media.length}/{MAX_MEDIA_ITEMS} media items
          </Text>
        </ScrollView>

        {/* Privacy Selector Modal */}
        <Modal
          visible={showPrivacySelector}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPrivacySelector(false)}
        >
          <View style={styles.privacyModalOverlay}>
            <View style={styles.privacyModal}>
              <Text style={styles.privacyModalTitle}>Who can see this?</Text>
              {PRIVACY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.privacyOption,
                    privacyLevel === option.value && styles.privacyOptionActive,
                  ]}
                  onPress={() => {
                    setPrivacyLevel(option.value);
                    setShowPrivacySelector(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name={option.icon as any} size={24} color="#333" />
                  <View style={styles.privacyOptionText}>
                    <Text style={styles.privacyOptionLabel}>{option.label}</Text>
                    <Text style={styles.privacyOptionDescription}>
                      {option.value === 'public' && 'Everyone can see this'}
                      {option.value === 'friends' && 'Only your friends can see this'}
                      {option.value === 'private' && 'Only you can see this'}
                    </Text>
                  </View>
                  {privacyLevel === option.value && (
                    <Ionicons name="checkmark" size={24} color="#3498DB" />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.privacyModalClose}
                onPress={() => setShowPrivacySelector(false)}
              >
                <Text style={styles.privacyModalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  postButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  postButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userInfoText: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  privacySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  privacyText: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 4,
  },
  textInput: {
    fontSize: 18,
    lineHeight: 24,
    color: '#333',
    minHeight: 120,
    maxHeight: 300,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  mediaSection: {
    marginTop: 16,
  },
  mediaList: {
    paddingRight: 16,
  },
  mediaItemContainer: {
    width: 150,
    height: 150,
    marginRight: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  mediaItem: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  mediaIndex: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498DB',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  mediaCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
  privacyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  privacyModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 350,
    padding: 20,
  },
  privacyModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  privacyOptionActive: {
    backgroundColor: '#f0f8ff',
  },
  privacyOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  privacyOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  privacyOptionDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  privacyModalClose: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  privacyModalCloseText: {
    fontSize: 16,
    color: '#999',
  },
});

export default CreatePostModal;
