import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatConversation } from '../services/chatAPI';

interface ShareModalProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  conversations: ChatConversation[];
  conversationsLoading: boolean;
  selectedConversations: ChatConversation[];
  onSelect: (selected: ChatConversation[]) => void;
  onShare: () => void;
  onShareExternal: () => void;
  isSharing?: boolean;
  shareButtonText?: string;
  externalButtonText?: string;
  insetsBottom?: number;
}

const { height: screenHeight } = Dimensions.get('window');

const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  title = 'Share',
  onClose,
  conversations,
  conversationsLoading,
  selectedConversations,
  onSelect,
  onShare,
  onShareExternal,
  isSharing = false,
  shareButtonText = 'Share to Chats',
  externalButtonText = 'Share to Other Apps',
  insetsBottom = 0,
}) => {
  const toggleConversation = (conversation: ChatConversation) => {
    const isSelected = selectedConversations.find((c) => c.id === conversation.id);
    if (isSelected) {
      onSelect(selectedConversations.filter((c) => c.id !== conversation.id));
    } else {
      onSelect([...selectedConversations, conversation]);
    }
  };

  const renderItem = ({ item }: { item: ChatConversation }) => {
    const isSelected = selectedConversations.find((c) => c.id === item.id);

    return (
      <TouchableOpacity
        style={[styles.conversationItem, isSelected && styles.conversationItemSelected]}
        onPress={() => toggleConversation(item)}
      >
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <Text style={[styles.name, isSelected && styles.nameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.container, { paddingBottom: 16 + insetsBottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Select chats to share with</Text>

          {conversationsLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#3498DB" />
              <Text style={styles.loaderText}>Loading chats...</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#666" />
                  <Text style={styles.emptyText}>No chat conversations yet</Text>
                </View>
              }
            />
          )}

          <TouchableOpacity
            style={[
              styles.button,
              (selectedConversations.length === 0 || conversationsLoading || isSharing) && styles.buttonDisabled,
            ]}
            onPress={onShare}
            disabled={selectedConversations.length === 0 || conversationsLoading || isSharing}
          >
            {isSharing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {shareButtonText} {selectedConversations.length > 0 ? `(${selectedConversations.length})` : ''}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onShareExternal}
          >
            <Text style={styles.buttonText}>{externalButtonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: '#0d0d0d',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: screenHeight * 0.75,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  list: {
    maxHeight: screenHeight * 0.4,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  conversationItemSelected: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 12,
  },
  name: {
    flex: 1,
    color: 'white',
    fontSize: 15,
  },
  nameSelected: {
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    height: screenHeight * 0.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: '#888',
    marginTop: 12,
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#888',
    marginTop: 12,
  },
  button: {
    backgroundColor: '#E74C3C',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});

export default ShareModal;
