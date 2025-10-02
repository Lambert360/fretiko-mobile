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

interface BackgroundUploadProps {
  currentBackgroundUrl?: string;
  onUploadSuccess: (backgroundUrl: string) => void;
  width: number;
  height: number;
}

export const BackgroundUpload: React.FC<BackgroundUploadProps> = ({
  currentBackgroundUrl,
  onUploadSuccess,
  width,
  height,
}) => {
  const [uploading, setUploading] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need photo library access to select your background image.'
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
        'We need camera access to take your background image.'
      );
      return false;
    }
    return true;
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Select Background Image',
      'Choose how you want to add your background image',
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
        aspect: [16, 9], // Landscape aspect for background
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
        aspect: [16, 9], // Landscape aspect for background
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
    console.log('🖼️ Starting background image upload:', imageUri);
    setUploading(true);
    setLocalImageUri(imageUri); // Show local image immediately

    try {
      console.log('📤 Calling userAPI.uploadBackground...');
      const backgroundUrl = await userAPI.uploadBackground(imageUri);
      console.log('✅ Background upload successful, backgroundUrl:', backgroundUrl);
      
      onUploadSuccess(backgroundUrl);
      
      Alert.alert(
        'Success',
        'Your background image has been updated!',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('❌ Background upload failed:', error);
      setLocalImageUri(null); // Reset on error
      Alert.alert(
        'Upload Failed',
        error.message || 'Could not upload your background image. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const getDisplayImage = () => {
    if (localImageUri) return localImageUri;
    if (currentBackgroundUrl) return currentBackgroundUrl;
    return 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=2000&q=80'; // Default background
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { width, height }]} 
      onPress={showImagePickerOptions}
      disabled={uploading}
      activeOpacity={0.8}
    >
      {uploading && (
        <View style={[styles.uploadingOverlay, { width, height }]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.uploadingText}>Uploading Background...</Text>
        </View>
      )}
      
      <Image 
        source={{ uri: getDisplayImage() }} 
        style={[styles.backgroundImage, { width, height }]} 
      />
      
      {/* Dark overlay for visibility */}
      <View style={[styles.overlay, { width, height }]} />
      
      {/* Edit indicator */}
      <View style={styles.editIndicator}>
        <Text style={styles.editIndicatorText}>📷</Text>
        <Text style={styles.editText}>Change Background</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
  },
  backgroundImage: {
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  editIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editIndicatorText: {
    fontSize: 16,
    marginRight: 6,
  },
  editText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  uploadingText: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
});