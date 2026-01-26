import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { disputesAPI, DisputeDetail, DisputeMessage } from '../services/disputesAPI';
import { useAuth } from '../contexts/AuthContext';
import { fileUploadService } from '../services/fileUploadService';
import { realtimeAPI } from '../services/realtimeAPI';

const DisputeDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { disputeId } = route.params as { disputeId: string };

  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<{ type: string; url: string } | null>(null);
  const [messageAttachments, setMessageAttachments] = useState<Array<{ uri: string; type: string; name: string; uploadedUrl?: string }>>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadDispute();
      
      // Join dispute room for real-time updates
      if (disputeId) {
        realtimeAPI.joinDispute(disputeId);
      }

      // Subscribe to dispute message events
      const unsubscribe = realtimeAPI.subscribe('dispute_message', (data: any) => {
        if (data.disputeId === disputeId && data.message) {
          console.log('⚖️ Real-time dispute message received:', data.message);
          
          // Add new message to dispute messages
          setDispute(prev => {
            if (!prev) return prev;
            
            // Check if message already exists (prevent duplicates)
            const messageExists = prev.messages.some(msg => msg.id === data.message.id);
            if (messageExists) {
              return prev;
            }

            // Transform backend message to frontend format
            const newMessage: DisputeMessage = {
              id: data.message.id,
              message: data.message.message,
              senderId: data.message.senderId,
              isAdminMessage: false, // Will be determined by sender role
              attachments: data.message.attachments || [],
              createdAt: data.message.createdAt,
            };

            return {
              ...prev,
              messages: [...prev.messages, newMessage],
            };
          });

          // Scroll to bottom after new message
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      });

      // Subscribe to dispute update events (status changes, etc.)
      const unsubscribeUpdate = realtimeAPI.subscribe('dispute_update', (data: any) => {
        if (data.disputeId === disputeId && data.update) {
          console.log('⚖️ Real-time dispute update received:', data.update);
          setDispute(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              ...data.update,
            };
          });
        }
      });

      // Cleanup: Leave dispute room and unsubscribe
      return () => {
        if (disputeId) {
          realtimeAPI.leaveDispute(disputeId);
        }
        unsubscribe();
        unsubscribeUpdate();
      };
    }, [disputeId])
  );

  const loadDispute = async () => {
    try {
      setLoading(true);
      const disputeData = await disputesAPI.getDispute(disputeId);
      setDispute(disputeData);
      // Scroll to bottom after loading
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error: any) {
      console.error('Error loading dispute:', error);
      Alert.alert('Error', error.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDispute();
  };

  const pickImageForMessage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'We need camera roll permissions to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'image',
          name: asset.fileName || `image_${Date.now()}.jpg`,
        }));
        setMessageAttachments(prev => [...prev, ...newAttachments].slice(0, 5)); // Max 5 attachments
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickDocumentForMessage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'document',
          name: asset.name || `document_${Date.now()}.pdf`,
        }));
        setMessageAttachments(prev => [...prev, ...newAttachments].slice(0, 5)); // Max 5 attachments
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const removeMessageAttachment = (index: number) => {
    setMessageAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && messageAttachments.length === 0) || !dispute) {
      Alert.alert('Error', 'Please enter a message or add an attachment');
      return;
    }

    try {
      setIsSending(true);
      setUploadingAttachments(true);

      // Upload attachments if any
      let uploadedAttachments: Array<{ type: string; url: string }> = [];
      
      if (messageAttachments.length > 0) {
        for (let i = 0; i < messageAttachments.length; i++) {
          const item = messageAttachments[i];
          if (item.uploadedUrl) {
            uploadedAttachments.push({
              type: item.type,
              url: item.uploadedUrl,
            });
            continue;
          }

          try {
            const mimeType = item.type === 'image' ? 'image/jpeg' : 'application/pdf';
            const uploadResult = await fileUploadService.uploadFile(item.uri, item.name, mimeType);

            if (uploadResult.success) {
              uploadedAttachments.push({
                type: item.type,
                url: uploadResult.publicUrl,
              });
            } else {
              console.warn(`Failed to upload attachment ${item.name}:`, uploadResult.error);
            }
          } catch (uploadError) {
            console.error(`Error uploading attachment ${item.name}:`, uploadError);
          }
        }
      }

      await disputesAPI.sendMessage(
        dispute.id,
        messageText.trim() || 'Attachment',
        uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      );
      
      setMessageText('');
      setMessageAttachments([]);
      
      // Reload dispute to get updated messages
      await loadDispute();
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
      setUploadingAttachments(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#FFA500';
      case 'under_review': return '#3498DB';
      case 'resolved': return '#27AE60';
      case 'cancelled': return '#E74C3C';
      default: return '#888';
    }
  };

  const getStatusText = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTypeText = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderMessage = (message: DisputeMessage, index: number) => {
    const isCurrentUser = message.senderId === user?.id;
    const isStaff = message.isStaffMessage || message.isAdminMessage;

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isStaff ? styles.staffMessage : isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
        ]}
      >
        {isStaff && (
          <View style={styles.staffBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#007AFF" />
            <Text style={styles.staffBadgeText}>Customer Care</Text>
          </View>
        )}
        {!isStaff && !isCurrentUser && (
          <Text style={styles.senderName}>{message.senderName || 'Other Party'}</Text>
        )}
        <View style={[
          styles.messageBubble,
          isStaff ? styles.staffBubble : isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
        ]}>
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserMessageText : styles.otherUserMessageText,
          ]}>
            {message.message}
          </Text>
          {message.attachments && message.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {message.attachments.map((att, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.attachmentItem}
                  onPress={() => {
                    if (att.type === 'image') {
                      setViewingAttachment(att);
                    } else {
                      // Open document in browser or external app
                      Linking.openURL(att.url).catch(err => {
                        Alert.alert('Error', 'Could not open document. Please try again.');
                      });
                    }
                  }}
                >
                  <Ionicons
                    name={att.type === 'image' ? 'image-outline' : 'document-outline'}
                    size={16}
                    color={isCurrentUser ? '#FFFFFF' : '#007AFF'}
                  />
                  <Text style={[
                    styles.attachmentText,
                    isCurrentUser ? styles.currentUserMessageText : styles.otherUserMessageText,
                  ]}>
                    {att.type === 'image' ? 'View Image' : 'Open Document'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <Text style={[styles.messageTime, !isCurrentUser && styles.messageTimeLeft]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    );
  };

  if (loading && !dispute) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dispute Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dispute Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Dispute not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dispute Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Dispute Info */}
        <View style={styles.disputeInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type:</Text>
            <Text style={styles.infoValue}>{getTypeText(dispute.disputeType)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(dispute.status) }]}>
              <Text style={styles.statusText}>{getStatusText(dispute.status)}</Text>
            </View>
          </View>
          {dispute.order && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order:</Text>
              <Text style={styles.infoValue}>#{dispute.order.order_number}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created:</Text>
            <Text style={styles.infoValue}>{formatDate(dispute.createdAt)}</Text>
          </View>
        </View>

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {dispute.messages && dispute.messages.length > 0 ? (
            dispute.messages.map((message, index) => renderMessage(message, index))
          ) : (
            <View style={styles.emptyMessages}>
              <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
              <Text style={styles.emptyMessagesText}>No messages yet</Text>
            </View>
          )}
        </ScrollView>

        {/* Message Input */}
        {dispute.status !== 'resolved' && dispute.status !== 'cancelled' && (
          <View style={styles.inputContainer}>
            {/* Attachment Preview */}
            {messageAttachments.length > 0 && (
              <ScrollView horizontal style={styles.attachmentPreview} showsHorizontalScrollIndicator={false}>
                {messageAttachments.map((att, index) => (
                  <View key={index} style={styles.attachmentPreviewItem}>
                    {att.type === 'image' ? (
                      <Image source={{ uri: att.uri }} style={styles.attachmentPreviewImage} />
                    ) : (
                      <View style={styles.attachmentPreviewDocument}>
                        <Ionicons name="document" size={24} color="#666" />
                        <Text style={styles.attachmentPreviewName} numberOfLines={1}>
                          {att.name}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeAttachmentButton}
                      onPress={() => removeMessageAttachment(index)}
                    >
                      <Ionicons name="close-circle" size={18} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.inputRow}>
              <View style={styles.attachmentButtons}>
                <TouchableOpacity
                  style={styles.attachmentButton}
                  onPress={pickImageForMessage}
                  disabled={isSending || uploadingAttachments}
                >
                  <Ionicons name="image-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.attachmentButton}
                  onPress={pickDocumentForMessage}
                  disabled={isSending || uploadingAttachments}
                >
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type your message..."
              placeholderTextColor="#999"
              multiline
              maxLength={1000}
                editable={!isSending && !uploadingAttachments}
            />
            <TouchableOpacity
                style={[
                  styles.sendButton,
                  ((!messageText.trim() && messageAttachments.length === 0) || isSending || uploadingAttachments) && styles.sendButtonDisabled
                ]}
              onPress={handleSendMessage}
                disabled={(!messageText.trim() && messageAttachments.length === 0) || isSending || uploadingAttachments}
            >
                {isSending || uploadingAttachments ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            </View>
            {uploadingAttachments && (
              <Text style={styles.uploadingText}>Uploading attachments...</Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Attachment Viewer Modal */}
      <Modal
        visible={!!viewingAttachment}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingAttachment(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attachment</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setViewingAttachment(null)}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {viewingAttachment && (
              <View style={styles.attachmentViewer}>
                {viewingAttachment.type === 'image' ? (
                  <ScrollView
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                    contentContainerStyle={styles.imageViewer}
                  >
                    <Image
                      source={{ uri: viewingAttachment.url }}
                      style={styles.fullImage}
                      resizeMode="contain"
                    />
                  </ScrollView>
                ) : (
                  <View style={styles.documentViewer}>
                    <Ionicons name="document" size={64} color="#666" />
                    <Text style={styles.documentText}>Document Preview</Text>
                    <TouchableOpacity
                      style={styles.openDocumentButton}
                      onPress={() => {
                        Linking.openURL(viewingAttachment.url).catch(err => {
                          Alert.alert('Error', 'Could not open document.');
                        });
                        setViewingAttachment(null);
                      }}
                    >
                      <Text style={styles.openDocumentText}>Open in Browser</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disputeInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  currentUserMessage: {
    alignItems: 'flex-end',
  },
  otherUserMessage: {
    alignItems: 'flex-start',
  },
  staffMessage: {
    // Customer care should look like an incoming chat (left-aligned)
    alignItems: 'flex-start',
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  staffBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  currentUserBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  staffBubble: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
    borderWidth: 1,
    maxWidth: '90%',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  currentUserMessageText: {
    color: '#FFFFFF',
  },
  otherUserMessageText: {
    color: '#000',
  },
  attachmentsContainer: {
    marginTop: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attachmentText: {
    fontSize: 14,
    marginLeft: 6,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeLeft: {
    alignSelf: 'flex-start',
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyMessagesText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  inputContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  attachmentPreview: {
    marginBottom: 8,
    maxHeight: 80,
  },
  attachmentPreviewItem: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
  },
  attachmentPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  attachmentPreviewDocument: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9F9F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  attachmentPreviewName: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachmentButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  attachmentButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#000',
    maxHeight: 100,
  },
  uploadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: Dimensions.get('window').width * 0.95,
    height: Dimensions.get('window').height * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalCloseButton: {
    padding: 4,
  },
  attachmentViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: Dimensions.get('window').width * 0.95,
    height: Dimensions.get('window').height * 0.7,
  },
  documentViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  documentText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  openDocumentButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  openDocumentText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DisputeDetailsScreen;

