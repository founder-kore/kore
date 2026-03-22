import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getWatchLater, removeFromWatchLater, clearWatchLater } from '../storage/userPrefs';

function ConfirmModal({ visible, title, message, confirmLabel, onCancel, onConfirm, colors, danger }) {
  if (!visible) return null;
  return (
    <View style={modal.overlay}>
      <View style={[modal.box, { backgroundColor: colors.snow }]}>
        <Text style={[modal.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[modal.sub, { color: colors.charcoal }]}>{message}</Text>
        <View style={modal.row}>
          <TouchableOpacity style={[modal.cancelBtn, { borderColor: colors.border }]} onPress={onCancel}>
            <Text style={[modal.cancelText, { color: colors.charcoal }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modal.confirmBtn} onPress={onConfirm}>
            <Text style={modal.confirmText}>{confirmLabel || 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const modal = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24 },
  box: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  title: { fontSize: 18, fontWeight: '500', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  row: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '500' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#CC3333', alignItems: 'center' },
  confirmText: { fontSize: 14, color: '#fff', fontWeight: '500' },
});

export default function WatchLaterScreen({ onBack, onSelectAnime }) {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [modalConfig, setModalConfig] = useState(null);

  useEffect(() => {
    getWatchLater().then(setItems);
  }, []);

  const showModal = (config) => setModalConfig(config);
  const hideModal = () => setModalConfig(null);

  const handleRemoveOne = async (title) => {
    const updated = await removeFromWatchLater(title);
    setItems(updated);
    hideModal();
  };

  const handleClearAll = async () => {
    await clearWatchLater();
    setItems([]);
    hideModal();
  };

  const tapRemove = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showModal({
      title: 'Remove from Watch Later?',
      message: `Remove "${item.title}"? You can always save it again.`,
      confirmLabel: 'Remove',
      onConfirm: () => handleRemoveOne(item.title),
    });
  };

  const tapClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showModal({
      title: 'Clear all?',
      message: 'This removes everything from your Watch Later list. No undo.',
      confirmLabel: 'Clear all',
      onConfirm: handleClearAll,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>Watch Later</Text>
          {items.length > 0 ? (
            <TouchableOpacity style={styles.clearHeaderBtn} onPress={tapClearAll}>
              <Text style={styles.clearHeaderText}>Clear all</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerRight} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔖</Text>
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>Nothing saved yet</Text>
              <Text style={[styles.emptyText, { color: colors.charcoal }]}>
                Tap the 🔖 button on any recommendation to save it here.
              </Text>
            </View>
          ) : (
            <>
              {items.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectAnime(item);
                  }}
                  activeOpacity={0.7}
                >
                  {item.cover ? (
                    <Image source={{ uri: item.cover }} style={styles.coverThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.coverThumbPlaceholder, { backgroundColor: colors.chalk }]}>
                      <Text style={{ fontSize: 16 }}>🎌</Text>
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemTitle, { color: colors.ink }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.itemMeta, { color: colors.charcoal }]} numberOfLines={1}>
                      {item.episode_count ? `${item.episode_count} eps` : ''}
                      {item.episode_count && item.genre?.[0] ? ' · ' : ''}
                      {item.genre?.[0] || ''}
                    </Text>
                    {item.why_now ? (
                      <Text style={[styles.itemWhyNow, { color: colors.ember }]} numberOfLines={2}>
                        "{item.why_now}"
                      </Text>
                    ) : null}
                    <Text style={[styles.itemDate, { color: colors.charcoal }]}>Saved {formatDate(item.date)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      tapRemove(item);
                    }}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              {/* Clear all at bottom */}
              <TouchableOpacity style={styles.clearAllBtn} onPress={tapClearAll}>
                <Text style={styles.clearAllText}>Clear all watch later</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>

      {modalConfig && (
        <ConfirmModal
          visible={true}
          title={modalConfig.title}
          message={modalConfig.message}
          confirmLabel={modalConfig.confirmLabel}
          colors={colors}
          onCancel={hideModal}
          onConfirm={modalConfig.onConfirm}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn: { width: 60 },
  backText: { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  headerRight: { width: 60 },
  clearHeaderBtn: { width: 60, alignItems: 'flex-end' },
  clearHeaderText: { fontSize: 13, color: '#CC3333', fontWeight: '500' },
  scroll: { padding: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
  coverThumb: { width: 52, height: 74, borderRadius: 8 },
  coverThumbPlaceholder: { width: 52, height: 74, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: '500' },
  itemMeta: { fontSize: 12 },
  itemWhyNow: { fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  itemDate: { fontSize: 11 },
  removeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFECEC', borderWidth: 1, borderColor: '#FFCCCC' },
  removeBtnText: { fontSize: 11, color: '#CC3333', fontWeight: '500' },
  clearAllBtn: { padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#FFCCCC', alignItems: 'center', backgroundColor: '#FFF5F5', marginTop: 4, marginBottom: 8 },
  clearAllText: { fontSize: 13, color: '#CC3333', fontWeight: '500' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '500', textAlign: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  bottomPad: { height: 40 },
});