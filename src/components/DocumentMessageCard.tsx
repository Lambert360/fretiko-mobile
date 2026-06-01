import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FileData {
  name: string;
  size: string;
  type: string;
  url?: string;
}

interface DocumentMessageCardProps {
  fileData: FileData;
  isCurrentUser: boolean;
  onPress: (fileUrl: string, fileName: string) => void;
  messageText?: string;
  isDownloading?: boolean;
  downloadProgress?: number; // 0–1
}

/**
 * Get file icon based on MIME type or file extension
 */
const getFileIcon = (mimeType: string, fileName: string): string => {
  const type = mimeType.toLowerCase();
  const name = fileName.toLowerCase();
  
  // PDF files
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return 'document-text';
  }
  
  // Word documents
  if (type.includes('word') || type.includes('document') || 
      name.endsWith('.doc') || name.endsWith('.docx')) {
    return 'document-text';
  }
  
  // Excel/Spreadsheets
  if (type.includes('excel') || type.includes('spreadsheet') || 
      type.includes('csv') || name.endsWith('.xls') || 
      name.endsWith('.xlsx') || name.endsWith('.csv')) {
    return 'grid';
  }
  
  // PowerPoint/Presentations
  if (type.includes('powerpoint') || type.includes('presentation') || 
      name.endsWith('.ppt') || name.endsWith('.pptx')) {
    return 'easel';
  }
  
  // Images
  if (type.includes('image') || 
      name.endsWith('.jpg') || name.endsWith('.jpeg') || 
      name.endsWith('.png') || name.endsWith('.gif') || 
      name.endsWith('.webp')) {
    return 'image';
  }
  
  // Audio
  if (type.includes('audio') || 
      name.endsWith('.mp3') || name.endsWith('.wav') || 
      name.endsWith('.m4a') || name.endsWith('.ogg')) {
    return 'musical-note';
  }
  
  // Video
  if (type.includes('video') || 
      name.endsWith('.mp4') || name.endsWith('.mov') || 
      name.endsWith('.avi') || name.endsWith('.mkv')) {
    return 'videocam';
  }
  
  // Archives
  if (type.includes('zip') || type.includes('compressed') || 
      name.endsWith('.zip') || name.endsWith('.rar') || 
      name.endsWith('.7z') || name.endsWith('.tar')) {
    return 'archive';
  }
  
  // Code/Text files
  if (type.includes('text') || type.includes('code') || 
      name.endsWith('.txt') || name.endsWith('.json') || 
      name.endsWith('.xml') || name.endsWith('.html') || 
      name.endsWith('.js') || name.endsWith('.ts') || 
      name.endsWith('.css') || name.endsWith('.py')) {
    return 'code-slash';
  }
  
  // Default document icon
  return 'document';
};

/**
 * Get file icon background color based on file type
 */
const getFileIconColor = (mimeType: string, fileName: string): string => {
  const type = mimeType.toLowerCase();
  const name = fileName.toLowerCase();
  
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return '#E74C3C'; // Red for PDF
  }
  
  if (type.includes('word') || type.includes('document') || 
      name.endsWith('.doc') || name.endsWith('.docx')) {
    return '#2B579A'; // Blue for Word
  }
  
  if (type.includes('excel') || type.includes('spreadsheet') || 
      name.endsWith('.xls') || name.endsWith('.xlsx')) {
    return '#217346'; // Green for Excel
  }
  
  if (type.includes('powerpoint') || name.endsWith('.ppt') || name.endsWith('.pptx')) {
    return '#D24726'; // Orange for PowerPoint
  }
  
  if (type.includes('image') || 
      name.endsWith('.jpg') || name.endsWith('.png')) {
    return '#9B59B6'; // Purple for images
  }
  
  if (type.includes('audio') || type.includes('video')) {
    return '#3498DB'; // Blue for media
  }
  
  if (type.includes('zip') || name.endsWith('.zip')) {
    return '#F39C12'; // Yellow for archives
  }
  
  if (type.includes('code') || name.endsWith('.js') || name.endsWith('.json')) {
    return '#34495E'; // Dark gray for code
  }
  
  return '#607D8B'; // Default gray-blue
};

/**
 * Format file size for display
 */
const formatFileSize = (size: string): string => {
  const bytes = parseInt(size, 10);
  
  if (isNaN(bytes)) return 'Unknown size';
  
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
};

/**
 * Get file extension for display
 */
const getFileExtension = (fileName: string): string => {
  const parts = fileName.split('.');
  if (parts.length > 1) {
    return parts.pop()?.toUpperCase() || 'FILE';
  }
  return 'FILE';
};

const DocumentMessageCard: React.FC<DocumentMessageCardProps> = ({
  fileData,
  isCurrentUser,
  onPress,
  messageText,
  isDownloading = false,
  downloadProgress = 0,
}) => {
  const fileIcon = getFileIcon(fileData.type, fileData.name);
  const iconColor = getFileIconColor(fileData.type, fileData.name);
  const formattedSize = formatFileSize(fileData.size);
  const fileExtension = getFileExtension(fileData.name);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: downloadProgress,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [downloadProgress]);

  useEffect(() => {
    if (isDownloading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [isDownloading]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handlePress = () => {
    if (!isDownloading) {
      onPress(fileData.url || '', fileData.name);
    }
  };

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.sentContainer : styles.receivedContainer,
      ]}
    >
      {/* Document Card - Tappable */}
      <TouchableOpacity
        style={styles.documentCard}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="document" size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.documentLabel}>Document</Text>
          </View>
          <View style={[styles.extensionBadge, { backgroundColor: iconColor + '30' }]}>
            <Text style={[styles.extensionText, { color: iconColor }]}>
              {fileExtension}
            </Text>
          </View>
        </View>

        {/* Document Content */}
        <View style={styles.documentContent}>
          {/* File Icon Container */}
          <View style={[styles.iconContainer, { backgroundColor: iconColor }]}>
            <Ionicons name={fileIcon as any} size={28} color="#FFFFFF" />
          </View>

          {/* File Info */}
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={2}>
              {fileData.name}
            </Text>
            <Text style={styles.fileSize}>{formattedSize}</Text>
          </View>

          {/* Download / Spinner Icon */}
          <View style={styles.downloadIcon}>
            {isDownloading ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="sync-outline" size={24} color="rgba(255, 255, 255, 0.9)" />
              </Animated.View>
            ) : (
              <Ionicons name="download-outline" size={24} color="rgba(255, 255, 255, 0.8)" />
            )}
          </View>
        </View>

        {/* Progress bar (visible while downloading) */}
        {isDownloading && (
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        )}

        {/* Action Hint */}
        <View style={styles.actionHint}>
          <Ionicons
            name={isDownloading ? 'cloud-download-outline' : 'open-outline'}
            size={12}
            color="rgba(255, 255, 255, 0.6)"
          />
          <Text style={styles.actionHintText}>
            {isDownloading
              ? `Downloading… ${Math.round(downloadProgress * 100)}%`
              : 'Tap to open'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Message Text Below Document Card */}
      {messageText && (
        <View style={styles.messageTextContainer}>
          <Text style={styles.messageText}>{messageText}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '85%',
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sentContainer: {
    alignSelf: 'flex-end',
    marginRight: 8,
    backgroundColor: '#051094', // Admiral Blue - matches regular sent messages
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    backgroundColor: '#59788E', // Stone - matches regular received messages
  },
  documentCard: {
    borderRadius: 12,
    padding: 10,
    margin: 8,
    marginBottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#607D8B', // Blue-gray accent for documents
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  documentLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  extensionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  extensionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 4,
  },
  fileSize: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  downloadIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionHintText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#27AE60',
    borderRadius: 2,
  },
  messageTextContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
});

export default DocumentMessageCard;
