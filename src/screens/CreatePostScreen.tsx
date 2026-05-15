import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { useNavigation } from '@react-navigation/native';
import { postsAPI, PostMedia, MediaType, PrivacyLevel } from '../services/postsAPI';
import { useAuth } from '../contexts/AuthContext';
import SafeImage from '../components/SafeImage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const MAX_MEDIA_ITEMS = 10;
const MAX_TEXT_LENGTH = 2000;

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; icon: string }[] = [
  { value: 'public', label: 'Public', icon: 'globe' },
  { value: 'friends', label: 'Friends', icon: 'people' },
  { value: 'private', label: 'Private', icon: 'lock-closed' },
];

const CreatePostScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('public');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPrivacySelector, setShowPrivacySelector] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const contentInputRef = useRef<TextInput>(null);

  // Reset state when screen mounts
  useEffect(() => {
    setContent('');
    setMedia([]);
    setPrivacyLevel('public');
    setUploadProgress(0);
    setPreviewMode(false);
  }, []);

  // Pick images from gallery
  const pickImages = useCallback(async () => {
    try {
      const remainingSlots = MAX_MEDIA_ITEMS - media.length;
      if (remainingSlots <= 0) {
        Alert.alert('Limit Reached', `You can only add up to ${MAX_MEDIA_ITEMS} media items.`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
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
        mediaTypes: 'videos',
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
        mediaTypes: 'images',
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
        const ext = item.mediaType === 'video' ? 'mp4' : (item.mimeType?.split('/')[1] || 'jpg');
        const fileName = `${user?.id || 'anon'}/posts/${Date.now()}-${i}.${ext}`;
        const fileType = item.mimeType || (item.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
        
        const uploadResult = await postsAPI.uploadMedia(
          item.mediaUrl,
          fileType,
          fileName
        );

        if (uploadResult.url) {
          uploadedMedia.push({
            ...item,
            mediaUrl: uploadResult.url,
            thumbnailUrl: item.mediaType === 'video' ? uploadResult.url : undefined,
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
      
      let uploadedMedia: PostMedia[] = [];
      if (media.length > 0) {
        uploadedMedia = await uploadMedia();
      }

      const post = await postsAPI.createPost({
        content: content.trim() || undefined,
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        mediaType: determineMediaType(uploadedMedia),
        privacyLevel,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      navigation.goBack();
      
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

  // Toggle preview mode
  const togglePreview = () => {
    setPreviewMode(!previewMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Render preview mode
  const renderPreview = () => {
    const hasMedia = media.length > 0;
    const mainMedia = media[0];
    
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Preview</Text>
        
        {/* Large Media Preview */}
        {hasMedia && (
          <View style={styles.previewMediaContainer}>
            {mainMedia.mediaType === 'video' ? (
              <VideoPreview uri={mainMedia.mediaUrl} />
            ) : (
              <Image
                source={{ uri: mainMedia.mediaUrl }}
                style={styles.previewMainMedia}
                resizeMode="contain"
              />
            )}
            
            {/* Media counter for multiple items */}
            {media.length > 1 && (
              <View style={styles.previewMediaCounter}>
                <Text style={styles.previewMediaCounterText}>
                  +{media.length - 1} more
                </Text>
              </View>
            )}
          </View>
        )}
        
        {/* Content Preview */}
        {content.trim() ? (
          <View style={styles.previewContentBox}>
            <Text style={styles.previewContent}>{content}</Text>
          </View>
        ) : null}
        
        {/* Privacy Badge */}
        <View style={styles.previewPrivacyBadge}>
          <Ionicons
            name={PRIVACY_OPTIONS.find(p => p.value === privacyLevel)?.icon as any}
            size={14}
            color="#666"
          />
          <Text style={styles.previewPrivacyText}>
            {PRIVACY_OPTIONS.find(p => p.value === privacyLevel)?.label}
          </Text>
        </View>
        
        {/* Back to Edit Button */}
        <TouchableOpacity style={styles.backToEditButton} onPress={togglePreview}>
          <Ionicons name="arrow-back" size={20} color="#3498DB" />
          <Text style={styles.backToEditText}>Back to Edit</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Video Preview Component - Separate component to use hooks properly
const VideoPreview = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={styles.previewVideoContainer}>
      <VideoView
        style={styles.previewMainMedia}
        player={player}
        allowsFullscreen={true}
        allowsPictureInPicture={false}
      />
    </View>
  );
};

  // Render media item - NO hooks inside this function
  const renderMediaItem = ({ item, index }: { item: PostMedia; index: number }) => {
    return (
      <View style={styles.mediaItemContainer}>
        {item.mediaType === 'video' ? (
          <>
            <View style={styles.videoThumbnail}>
              <Ionicons name="play-circle" size={50} color="white" />
            </View>
            <View style={styles.videoIndicator}>
              <Ionicons name="videocam" size={16} color="white" />
            </View>
          </>
        ) : (
          <Image
            source={{ uri: item.mediaUrl }}
            style={styles.mediaItem}
            resizeMode="cover"
          />
        )}
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {previewMode ? 'Preview' : 'Create Post'}
        </Text>
        
        <View style={styles.headerRight}>
          {!previewMode && (
            <TouchableOpacity
              onPress={togglePreview}
              disabled={!content.trim() && media.length === 0}
              style={[
                styles.previewButton,
                (!content.trim() && media.length === 0) && styles.previewButtonDisabled,
              ]}
            >
              <Ionicons name="eye" size={20} color="#3498DB" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={previewMode ? handleSubmit : togglePreview}
            disabled={isLoading || (!content.trim() && media.length === 0)}
            style={[
              styles.postButton,
              (isLoading || (!content.trim() && media.length === 0)) && styles.postButtonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.postButtonText}>
                {previewMode ? 'Post' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {previewMode ? (
          renderPreview()
        ) : (
          <>
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
          </>
        )}
      </ScrollView>

      {/* Privacy Selector Modal */}
      {showPrivacySelector && (
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
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewButton: {
    padding: 8,
    marginRight: 8,
  },
  previewButtonDisabled: {
    opacity: 0.5,
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
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 12,
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
    color: '#fff',
  },
  privacySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  privacyText: {
    fontSize: 14,
    color: '#888',
    marginHorizontal: 4,
  },
  textInput: {
    fontSize: 18,
    lineHeight: 24,
    color: '#fff',
    minHeight: 120,
    maxHeight: 300,
    textAlignVertical: 'top',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 12,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
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
    backgroundColor: '#111',
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
  videoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#111',
    borderRadius: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
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
    borderTopColor: '#333',
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  mediaCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
  // Preview Mode Styles
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#000',
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  previewMediaContainer: {
    width: screenWidth - 32,
    height: screenWidth - 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 20,
    position: 'relative',
  },
  previewVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewMainMedia: {
    width: '100%',
    height: '100%',
  },
  previewMediaCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewMediaCounterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  previewContentBox: {
    width: screenWidth - 32,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#fff',
  },
  previewPrivacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 20,
  },
  previewPrivacyText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6,
  },
  backToEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  backToEditText: {
    fontSize: 16,
    color: '#3498DB',
    marginLeft: 8,
    fontWeight: '600',
  },
  // Privacy Modal Styles
  privacyModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  privacyModal: {
    backgroundColor: '#111',
    borderRadius: 16,
    width: '100%',
    maxWidth: 350,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  privacyModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
    backgroundColor: '#1a3a5c',
  },
  privacyOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  privacyOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  privacyOptionDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  privacyModalClose: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  privacyModalCloseText: {
    fontSize: 16,
    color: '#666',
  },
});

export default CreatePostScreen;
