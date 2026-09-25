/**
 * SoundBoardModal
 *
 * The host's live soundboard. Two libraries in one sheet:
 *  - "Fretiko" — platform sounds curated by admins
 *  - "Mine" — the host's own uploads (persist across streams)
 *
 * Tapping a tile plays it live to every viewer. Pinning a tile drops it
 * into one of the 3 quick-play slots on the broadcast bar.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { soundsAPI, StreamSound } from '../services/soundsAPI';
import {
  BUILTIN_SOUNDS,
  playSoundboardSound,
  stopSoundboardSound,
  getPlayingSoundboardIds,
} from '../services/auctionSoundService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = (SCREEN_WIDTH - 32 - 32 - 24) / 3; // padding + gaps -> 3 cols

export interface SoundBoardEntry {
  /** sounds-table UUID or 'builtin:*' key */
  id: string;
  name: string;
  emoji?: string;
  soundUrl?: string;
  isBuiltin?: boolean;
  isMine?: boolean;
}

interface SoundBoardModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when the host picks a sound — screen emits the socket event */
  onPlay: (entry: SoundBoardEntry) => void;
  /** Current 3 quick-slot ids; updated live as the host re-pins */
  primaries: string[];
  onPrimariesChange: (slots: string[]) => void;
  /** Pushes the full entry list (builtins + platform + mine) up so the
   *  screen can resolve quick-slot ids to playable sources */
  onLibraryChange: (entries: SoundBoardEntry[]) => void;
  /** Called when the host stops a playing sound — screen emits the socket event */
  onStop?: (entry: SoundBoardEntry) => void;
}

type LibraryTab = 'mine' | 'platform';

const ACCENT = '#FF0050';
const ACCENT_2 = '#FF5E3A';

const emojiForName = (name: string): string => {
  const lower = name.toLowerCase();
  if (/cheer|yay|celebrat/.test(lower)) return '🎉';
  if (/clap|applau/.test(lower)) return '👏';
  if (/laugh|haha|funny/.test(lower)) return '😂';
  if (/air.?horn|horn/.test(lower)) return '📯';
  if (/drum/.test(lower)) return '🥁';
  if (/bell|ding/.test(lower)) return '🔔';
  if (/whistle/.test(lower)) return '😗';
  if (/boom|bang|explos/.test(lower)) return '💥';
  if (/money|cash|kaching|coin/.test(lower)) return '💰';
  if (/wow|omg|surprise/.test(lower)) return '😮';
  if (/sad|trombone|fail/.test(lower)) return '😅';
  if (/tick|timer|clock/.test(lower)) return '⏱️';
  return '🔊';
};

const SoundBoardModal: React.FC<SoundBoardModalProps> = ({
  visible,
  onClose,
  onPlay,
  primaries,
  onPrimariesChange,
  onLibraryChange,
  onStop,
}) => {
  const [tab, setTab] = useState<LibraryTab>('mine');
  const [platformSounds, setPlatformSounds] = useState<StreamSound[]>([]);
  const [mySounds, setMySounds] = useState<StreamSound[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** When set, the next slot tap pins this sound to that slot */
  const [assigning, setAssigning] = useState<SoundBoardEntry | null>(null);
  const [savingSlots, setSavingSlots] = useState(false);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const lib = await soundsAPI.getLibrary();
      setPlatformSounds(lib.platform);
      setMySounds(lib.mine);
      onPrimariesChange(lib.primaries);
    } catch (error) {
      console.warn('Failed to load sound library:', error);
    } finally {
      setLoading(false);
    }
  }, [onPrimariesChange]);

  useEffect(() => {
    if (visible) {
      setTab('mine');
      setAssigning(null);
      loadLibrary();
    }
  }, [visible, loadLibrary]);

  // Poll actual player state while the sheet is open so tiles reflect
  // playing/stopped accurately (and clear when a sound ends on its own).
  useEffect(() => {
    if (!visible) return;
    const sync = () =>
      setPlayingIds((prev) => {
        const next = new Set(getPlayingSoundboardIds());
        if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
          return prev; // unchanged — skip re-render
        }
        return next;
      });
    const interval = setInterval(sync, 300);
    return () => clearInterval(interval);
  }, [visible]);

  const builtins: SoundBoardEntry[] = useMemo(
    () =>
      Object.entries(BUILTIN_SOUNDS).map(([id, meta]) => ({
        id,
        name: meta.name,
        emoji: meta.emoji,
        isBuiltin: true,
      })),
    [],
  );

  const toEntry = (s: StreamSound, isMine: boolean): SoundBoardEntry => ({
    id: s.id,
    name: s.name,
    emoji: emojiForName(s.name),
    soundUrl: s.sound_url,
    isMine,
  });

  const platformEntries = useMemo(
    () => [...builtins, ...platformSounds.map((s) => toEntry(s, false))],
    [builtins, platformSounds],
  );
  const myEntries = useMemo(() => mySounds.map((s) => toEntry(s, true)), [mySounds]);

  const entryById = useMemo(() => {
    const map = new Map<string, SoundBoardEntry>();
    [...platformEntries, ...myEntries].forEach((e) => map.set(e.id, e));
    return map;
  }, [platformEntries, myEntries]);

  // Keep the parent screen's sound map in sync with this library
  // (covers uploads, deletes, and fresh loads)
  useEffect(() => {
    onLibraryChange([...platformEntries, ...myEntries]);
  }, [platformEntries, myEntries, onLibraryChange]);

  const handleTilePress = (entry: SoundBoardEntry) => {
    if (assigning) {
      setAssigning(null);
      return;
    }
    if (playingIds.has(entry.id)) {
      // Tap a playing sound to stop it — locally and on every viewer
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      stopSoundboardSound(entry.id);
      setPlayingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
      onStop?.(entry);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    playSoundboardSound(entry.id, entry.soundUrl);
    setPlayingIds((prev) => new Set(prev).add(entry.id));
    onPlay(entry);
  };

  const handlePickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      if (asset.size && asset.size > 5 * 1024 * 1024) {
        Alert.alert('File too large', 'Pick a sound under 5MB.');
        return;
      }

      setUploading(true);
      const created = await soundsAPI.uploadSound({
        uri: asset.uri,
        name: asset.name || 'sound.mp3',
        mimeType: asset.mimeType || 'audio/mpeg',
      });
      setMySounds((prev) => [created, ...prev]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error: any) {
      console.warn('Sound upload failed:', error);
      Alert.alert(
        'Upload failed',
        error?.response?.data?.message || 'Could not upload that sound. Try again.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (entry: SoundBoardEntry) => {
    Alert.alert('Delete sound?', `"${entry.name}" will be removed from your soundboard.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeletingId(entry.id);
            await soundsAPI.deleteSound(entry.id);
            setMySounds((prev) => prev.filter((s) => s.id !== entry.id));
            // Backend already resets any slot that pointed at this sound —
            // mirror it locally so the bar updates instantly.
            const idx = primaries.indexOf(entry.id);
            if (idx >= 0) {
              const fallback = ['builtin:cheer', 'builtin:clap', 'builtin:laugh'][idx];
              const next = [...primaries];
              next[idx] = fallback;
              onPrimariesChange(next);
            }
          } catch (error: any) {
            Alert.alert(
              'Delete failed',
              error?.response?.data?.message || 'Could not delete that sound.',
            );
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleSlotPress = async (slotIndex: number) => {
    if (!assigning || savingSlots) return;
    const next = [...primaries];
    next[slotIndex] = assigning.id;
    setSavingSlots(true);
    try {
      const saved = await soundsAPI.setPrimaries(next);
      onPrimariesChange(saved);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error: any) {
      Alert.alert(
        'Could not pin sound',
        error?.response?.data?.message || 'Try again in a moment.',
      );
    } finally {
      setSavingSlots(false);
      setAssigning(null);
    }
  };

  const renderTile = (entry: SoundBoardEntry) => {
    const isPlaying = playingIds.has(entry.id);
    const isPinned = primaries.includes(entry.id);
    const isAssignTarget = assigning?.id === entry.id;

    return (
      <View key={entry.id} style={styles.tileWrap}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={[
            styles.tile,
            isPlaying && styles.tilePlaying,
            isAssignTarget && styles.tileAssignTarget,
          ]}
          onPress={() => handleTilePress(entry)}
        >
          {isPlaying ? (
            <LinearGradient
              colors={[ACCENT, ACCENT_2]}
              style={styles.tilePlayingInner}
            >
              <Text style={styles.tileEmoji}>{entry.emoji}</Text>
              <View style={styles.stopBadge}>
                <Ionicons name="stop" size={12} color="#fff" />
              </View>
            </LinearGradient>
          ) : (
            <Text style={styles.tileEmoji}>{entry.emoji}</Text>
          )}
          {isPinned && (
            <View style={styles.pinnedBadge}>
              <Ionicons name="pin" size={9} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.tileName} numberOfLines={1}>
          {entry.name}
        </Text>
        <View style={styles.tileActions}>
          <TouchableOpacity
            style={styles.tileActionBtn}
            onPress={() => setAssigning(isAssignTarget ? null : entry)}
          >
            <Ionicons
              name="pin"
              size={13}
              color={isAssignTarget ? ACCENT : 'rgba(255,255,255,0.55)'}
            />
          </TouchableOpacity>
          {entry.isMine && (
            <TouchableOpacity
              style={styles.tileActionBtn}
              onPress={() => handleDelete(entry)}
              disabled={deletingId === entry.id}
            >
              {deletingId === entry.id ? (
                <ActivityIndicator size={12} color="rgba(255,255,255,0.55)" />
              ) : (
                <Ionicons name="trash-outline" size={13} color="rgba(255,255,255,0.55)" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const slotEntries = primaries.map((id) => entryById.get(id) ?? null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="musical-notes" size={18} color="#fff" />
            </View>
            <Text style={styles.title}>Soundboard</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Quick slots strip */}
          <View style={styles.slotsStrip}>
            <Text style={styles.slotsLabel}>
              {assigning ? `Pin "${assigning.name}" to…` : 'Quick slots'}
            </Text>
            <View style={styles.slotsRow}>
              {slotEntries.map((entry, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={assigning ? 0.7 : 1}
                  style={[styles.slotChip, assigning && styles.slotChipTarget]}
                  onPress={() => handleSlotPress(i)}
                  disabled={!assigning}
                >
                  {savingSlots && assigning ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.slotEmoji}>{entry?.emoji ?? '🔊'}</Text>
                      <Text style={styles.slotName} numberOfLines={1}>
                        {entry?.name ?? `Slot ${i + 1}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {assigning && (
              <TouchableOpacity onPress={() => setAssigning(null)}>
                <Text style={styles.cancelAssign}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tab switcher */}
          <View style={styles.tabRow}>
            {(['mine', 'platform'] as LibraryTab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                {tab === t ? (
                  <LinearGradient
                    colors={[ACCENT, ACCENT_2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tabBtnGradient}
                  >
                    <Text style={styles.tabTextActive}>
                      {t === 'mine' ? 'My Sounds' : 'Fretiko'}
                    </Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.tabText}>
                    {t === 'mine' ? 'My Sounds' : 'Fretiko'}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {tab === 'mine' ? (
                <View style={styles.grid}>
                  {/* Upload tile */}
                  <View style={styles.tileWrap}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[styles.tile, styles.uploadTile]}
                      onPress={handlePickAndUpload}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={ACCENT} />
                      ) : (
                        <Ionicons name="add" size={30} color={ACCENT} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.tileName} numberOfLines={1}>
                      {uploading ? 'Uploading…' : 'Add Sound'}
                    </Text>
                    <View style={styles.tileActions} />
                  </View>
                  {myEntries.map(renderTile)}
                </View>
              ) : (
                <View style={styles.grid}>{platformEntries.map(renderTile)}</View>
              )}

              {tab === 'mine' && myEntries.length === 0 && !uploading && (
                <Text style={styles.emptyHint}>
                  Your sounds live here. Upload an MP3 or any audio clip — it stays
                  on your soundboard for every future stream.
                </Text>
              )}
              {tab === 'platform' && (
                <Text style={styles.emptyHint}>
                  Tap to play live · tap the pin to send a sound to your quick slots.
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#141019',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: 34,
    maxHeight: '72%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsStrip: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  slotsLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  slotChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  slotChipTarget: {
    borderColor: ACCENT,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,0,80,0.12)',
  },
  slotEmoji: {
    fontSize: 16,
  },
  slotName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  cancelAssign: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 11,
    overflow: 'hidden',
  },
  tabBtnActive: {},
  tabBtnGradient: {
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 11,
  },
  tabText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 9,
  },
  tabTextActive: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tileWrap: {
    width: TILE_SIZE,
    alignItems: 'center',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 0.82,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tilePlaying: {
    borderColor: ACCENT,
  },
  tilePlayingInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileAssignTarget: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(255,0,80,0.14)',
  },
  uploadTile: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,0,80,0.55)',
    backgroundColor: 'rgba(255,0,80,0.08)',
  },
  tileEmoji: {
    fontSize: 30,
  },
  pinnedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    maxWidth: TILE_SIZE,
  },
  tileActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    height: 20,
  },
  tileActionBtn: {
    width: 24,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 10,
  },
});

export default SoundBoardModal;
