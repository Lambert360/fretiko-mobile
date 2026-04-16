import React, { useState } from 'react';
import { Image, View, Text, ImageProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SafeImageProps extends ImageProps {
  fallbackSource?: ImageProps['source'];
  showFallbackIcon?: boolean;
  fallbackText?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  source,
  fallbackSource,
  showFallbackIcon = true,
  fallbackText = 'Image not available',
  style,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for invalid ImagePicker paths
  const isValidSource = (source: any) => {
    if (!source || !source.uri) return false;
    
    const uri = source.uri;
    // Filter out ImagePicker cached files that no longer exist
    if (typeof uri === 'string' && uri.includes('ImagePicker/')) {
      console.log('🚫 Blocking ImagePicker cached file:', uri);
      return false;
    }
    
    return true;
  };

  const handleError = () => {
    console.log('❌ Image load error:', source);
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (!isValidSource(source) || hasError) {
    if (fallbackSource) {
      return (
        <Image 
          source={fallbackSource} 
          style={style}
          {...props}
        />
      );
    }

    // Show fallback UI
    return (
      <View style={[style, { 
        backgroundColor: '#1a1a1a', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }]}>
        {showFallbackIcon && (
          <Ionicons name="image-outline" size={24} color="#666" />
        )}
        <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
          {fallbackText}
        </Text>
      </View>
    );
  }

  return (
    <Image 
      source={source}
      style={style}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};

export default SafeImage;
