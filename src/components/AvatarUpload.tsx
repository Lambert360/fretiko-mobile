import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { userAPI } from '../services/userAPI';
import { useAuth } from '../contexts/AuthContext';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onUploadSuccess: (avatarUrl: string) => void;
  size?: number;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatarUrl,
  onUploadSuccess,
  size = 120,
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need photo library access to select your profile picture.'
      );
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need camera access to take your profile picture.'
      );
      return false;
    }
    return true;
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Select Profile Picture',
      'Choose how you want to add your profile picture',
      [
        { text: 'Camera', onPress: takePicture },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const takePicture = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Could not open camera. Please try again.');
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not open photo library. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string) => {
    console.log('🖼️ Starting image upload:', imageUri);
    setUploading(true);
    setLocalImageUri(imageUri); // Show local image immediately

    try {
      console.log('📤 Calling userAPI.uploadAvatar...');
      const avatarUrl = await userAPI.uploadAvatar(imageUri);
      console.log('✅ Upload successful, avatarUrl:', avatarUrl);
      
      onUploadSuccess(avatarUrl);
      
      Alert.alert(
        'Success',
        'Your profile picture has been updated!',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      setLocalImageUri(null); // Reset on error
      Alert.alert(
        'Upload Failed',
        error.message || 'Could not upload your picture. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const getDisplayImage = () => {
    if (localImageUri) return localImageUri;
    if (currentAvatarUrl) return currentAvatarUrl;
    return null;
  };

  const getInitials = () => {
    return `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { width: size, height: size }]} 
      onPress={showImagePickerOptions}
      disabled={uploading}
    >
      {uploading && (
        <View style={[styles.uploadingOverlay, { borderRadius: size / 2 }]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}
      
      {getDisplayImage() ? (
        <Image 
          source={{ uri: getDisplayImage()! }} 
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} 
        />
      ) : (
        <View style={[styles.placeholderAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size / 3 }]}>
            {getInitials()}
          </Text>
        </View>
      )}
      
      <View style={styles.editIndicator}>
        <Text style={styles.editIndicatorText}>✏️</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  avatar: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  placeholderAvatar: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  initials: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  editIndicatorText: {
    fontSize: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  uploadingText: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
});