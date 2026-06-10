import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: screenHeight } = Dimensions.get('window');

export interface LikerUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
  subtitle?: string;
}

interface LikesListModalProps {
  visible: boolean;
  onClose: () => void;
  likesCount: number;
  fetchLikers: () => Promise<LikerUser[]>;
  onUserPress?: (userId: string) => void;
  title?: string;
  emptyIcon?: string;
  emptyText?: string;
}

const LikesListModal: React.FC<LikesListModalProps> = ({
  visible,
  onClose,
  likesCount,
  fetchLikers,
  onUserPress,
  title,
  emptyIcon = 'heart-outline',
  emptyText = 'No likes yet',
}) => {
  const insets = useSafeAreaInsets();
  const [likers, setLikers] = useState<LikerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLikers();
      setLikers(data);
    } catch {
      setError('Failed to load likes. Try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchLikers]);

  useEffect(() => {
    if (visible) {
      setLikers([]);
      load();
    }
  }, [visible]);

  const renderItem = ({ item }: { item: LikerUser }) => (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => onUserPress?.(item.id)}
      activeOpacity={onUserPress ? 0.7 : 1}
    >
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>
            {item.username?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
        {!!item.subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
        )}
      </View>
      {item.isVerified && (
        <Ionicons name="checkmark-circle" size={15} color="#3897F0" style={styles.verifiedIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {title ?? `Liked by${likesCount > 0 ? ` ${likesCount}` : ''}`}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <ActivityIndicator color="#fff" size="small" style={styles.centered} />
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : likers.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name={emptyIcon as any} size={36} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <FlatList
            data={likers}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.65,
    minHeight: 200,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginTop: 10,
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LikesListModal;
