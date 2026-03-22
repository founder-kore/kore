import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Switch, TextInput, Linking, Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../constants/theme';
import {
  getFavoriteGenres, saveFavoriteGenres, getWatchedList,
  removeFromWatchedList,
  getMixHiddenGems, setMixHiddenGems, getStreak, isUnlocked,
  getEraLock, setEraLock, MILESTONES,
} from '../storage/userPrefs';

const NOTIF_HOUR_KEY    = 'kore_notif_hour';
const NOTIF_ENABLED_KEY = 'kore_notif_enabled';

const ALL_GENRES = [
  { category: 'Core',           genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'] },
  { category: 'Anime-specific', genres: ['Isekai', 'Mecha', 'Slice of Life', 'Sports', 'Supernatural', 'Psychological', 'Historical', 'Music'] },
  { category: 'Tone',           genres: ['Dark', 'Feel-good', 'Mind-bending', 'Wholesome', 'Gritty', 'Philosophical'] },
];

const TIME_SLOTS = [
  { label: 'Morning',   sub: '9:00 AM',  hour: 9  },
  { label: 'Afternoon', sub: '2:00 PM',  hour: 14 },
  { label: 'Evening',   sub: '7:00 PM',  hour: 19 },
  { label: 'Night',     sub: '10:00 PM', hour: 22 },
];

const ERA_LABELS = {
  '70s': '1970s',
  '80s': '1980s',
  '90s': '1990s',
  '00s': '2000s',
  '10s': '2010s',
  '20s': '2020s',
};

function ConfirmModal({ visible, title, message, onCancel, onConfirm, colors }) {
  if (!visible) return null;
  return (
    <View style={modal.overlay}>
      <View style={[modal.box, { backgroundColor: colors.snow }]}>
        <Text style={[modal.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[modal.sub,   { color: colors.charcoal }]}>{message}</Text>
        <View style={modal.row}>
          <TouchableOpacity style={[modal.cancelBtn, { borderColor: colors.border }]} onPress={onCancel}>
            <Text style={[modal.cancelText, { color: colors.charcoal }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modal.confirmBtn} onPress={onConfirm}>
            <Text style={modal.confirmText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const modal = StyleSheet.create({
  overlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24 },
  box:        { borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  title:      { fontSize: 18, fontWeight: '500', marginBottom: 8, textAlign: 'center' },
  sub:        { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  row:        { flexDirection: 'row', gap: 10 },
  cancelBtn:  { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '500' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#CC3333', alignItems: 'center' },
  confirmText:{ fontSize: 14, color: '#fff', fontWeight: '500' },
});

export default function ProfileScreen({ onBack, streak = 0 }) {
  const { colors, isDark, toggleDarkMode } = useTheme();

  const [favoriteGenres,    setFavoriteGenres]    = useState([]);
  const [watchedList,       setWatchedList]       = useState([]);
  const [genreSearch,       setGenreSearch]       = useState('');
  const [expandedCats,      setExpandedCats]      = useState({});
  const [saved,             setSaved]             = useState(false);
  const [notifEnabled,      setNotifEnabled]      = useState(false);
  const [notifPermission,   setNotifPermission]   = useState('undetermined');
  const [notifHour,         setNotifHour]         = useState(19);
  const [confirmConfig,     setConfirmConfig]     = useState(null);
  const [mixGems,           setMixGemsLocal]      = useState(false);
  const [eraLock,           setEraLockLocal]      = useState(null);
  const [streakLocal,       setStreakLocal]        = useState(streak);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [genres, watched, mix, currentStreak, era] = await Promise.all([
        getFavoriteGenres(), getWatchedList(),
        getMixHiddenGems(), getStreak(), getEraLock(),
      ]);
      setFavoriteGenres(genres);
      setWatchedList(watched);
      setMixGemsLocal(mix);
      setStreakLocal(currentStreak);
      setEraLockLocal(era);

      const savedHour    = await AsyncStorage.getItem(NOTIF_HOUR_KEY);
      const savedEnabled = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
      if (savedHour)    setNotifHour(parseInt(savedHour));
      if (savedEnabled === 'true') {
        const { status } = await Notifications.getPermissionsAsync();
        setNotifPermission(status);
        setNotifEnabled(status === 'granted');
      }
    } catch (e) {
      console.log('ProfileScreen loadData error:', e);
    }
  };

  const handleSaveGenres = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveFavoriteGenres(favoriteGenres);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleGenre = (genre) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavoriteGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
    setSaved(false);
  };

  const removeGenre = (genre) => {
    setFavoriteGenres(prev => prev.filter(g => g !== genre));
    setSaved(false);
  };

  const scheduleNotif = async (hour) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('kore-streak', {
          name: 'Streak Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250],
          lightColor: '#E8630A',
        });
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'コレ — Your daily pick is waiting 🌸',
          body: "Keep your streak alive. What's your vibe tonight?",
          ...(Platform.OS === 'android' ? { channelId: 'kore-streak' } : {}),
        },
        trigger: {
          type: 'daily',
          hour,
          minute: 0,
          ...(Platform.OS === 'android' ? { channelId: 'kore-streak' } : {}),
        },
      });
    } catch (e) {
      console.log('Could not schedule notification:', e);
    }
  };

  const handleEnableNotif = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifPermission(status);
    if (status === 'granted') {
      setNotifEnabled(true);
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'true');
      await scheduleNotif(notifHour);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setNotifPermission('denied');
    }
  };

  const handleDisableNotif = async () => {
    setNotifEnabled(false);
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'false');
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const handleSetNotifHour = async (hour) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifHour(hour);
    await AsyncStorage.setItem(NOTIF_HOUR_KEY, String(hour));
    if (notifEnabled) await scheduleNotif(hour);
  };

  const handleMixToggle = async (value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMixGemsLocal(value);
    await setMixHiddenGems(value);
  };

  const handleDisableEraLock = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setEraLock(null);
    setEraLockLocal(null);
  };




  const filteredGenres = (genres) =>
    genreSearch
      ? genres.filter(g => g.toLowerCase().includes(genreSearch.toLowerCase()))
      : genres;

  const hiddenGemUnlocked  = isUnlocked('hidden_gem',    streakLocal);
  const eraLockUnlocked    = isUnlocked('directors_cut', streakLocal);
  const whyNowBg = isDark ? '#2A1A00' : '#FFF5EE';

  // Which milestones have been visually unlocked (displayDays threshold for showing rewards section)
  const unlockedMilestones = MILESTONES.filter(m => streakLocal >= m.days);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>

          {/* ── Dark mode ── */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.ink }]}>Dark mode</Text>
                <Text style={[styles.sectionSub,   { color: colors.charcoal }]}>Currently {isDark ? 'on' : 'off'}</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={val => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleDarkMode(val); }}
                trackColor={{ false: colors.border, true: colors.ember }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* ── Mix hidden gems (14d unlock) ── */}
          {hiddenGemUnlocked && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.rowBetween}>
                <View style={styles.mixLabelWrap}>
                  <View style={styles.gemBadgeWrap}>
                    <Text style={styles.gemBadgeText}>💎 14d</Text>
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.ink, marginTop: 8 }]}>Mix in hidden gems</Text>
                  <Text style={[styles.sectionSub, { color: colors.charcoal }]}>
                    When on, ~30% of your regular picks quietly pull from the under-500k ratings pool.
                    The 💎 button always uses hidden gem mode regardless.
                  </Text>
                </View>
                <Switch
                  value={mixGems}
                  onValueChange={handleMixToggle}
                  trackColor={{ false: colors.border, true: '#1D9E75' }}
                  thumbColor="#fff"
                  style={{ marginLeft: 12, flexShrink: 0 }}
                />
              </View>
            </View>
          )}

          {/* ── Era Lock (45d internal / 60d shown) ── */}
          {eraLockUnlocked && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.rowBetween}>
                <View style={styles.mixLabelWrap}>
                  <View style={[styles.gemBadgeWrap, { backgroundColor: '#7F77DD' }]}>
                    <Text style={styles.gemBadgeText}>👑 60d</Text>
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.ink, marginTop: 8 }]}>Era Lock</Text>
                  {eraLock ? (
                    <Text style={[styles.sectionSub, { color: colors.charcoal }]}>
                      Active: <Text style={{ color: '#7F77DD', fontWeight: '500' }}>
                        {ERA_LABELS[eraLock] || eraLock}
                      </Text> — all picks from this era only.
                    </Text>
                  ) : (
                    <Text style={[styles.sectionSub, { color: colors.charcoal }]}>
                      Lock Kore to a specific anime decade. Changes Era Lock from the reward screen.
                    </Text>
                  )}
                </View>
                {eraLock && (
                  <TouchableOpacity
                    style={[styles.disableEraBtn, { borderColor: colors.border }]}
                    onPress={handleDisableEraLock}
                  >
                    <Text style={[styles.disableEraBtnText, { color: colors.charcoal }]}>Off</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Streak reminder ── */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Streak reminder</Text>
            <Text style={[styles.sectionSub,   { color: colors.charcoal }]}>
              Get a daily nudge to keep your streak alive.
            </Text>

            {notifPermission === 'denied' ? (
              <View style={styles.deniedWrap}>
                <Text style={[styles.deniedText, { color: colors.charcoal }]}>
                  Notifications are blocked. Enable them in Settings.
                </Text>
                <TouchableOpacity
                  style={[styles.settingsBtn, { backgroundColor: colors.ember }]}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={styles.settingsBtnText}>Open Settings →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={notifEnabled ? handleDisableNotif : handleEnableNotif}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleLabel, { color: colors.ink }]}>Daily reminder</Text>
                  <View style={[styles.toggleTrack, { backgroundColor: notifEnabled ? colors.ember : colors.border }]}>
                    <View style={[styles.toggleThumb, { transform: [{ translateX: notifEnabled ? 18 : 2 }] }]} />
                  </View>
                </TouchableOpacity>

                {notifEnabled && (
                  <View style={styles.timeSlotsWrap}>
                    <Text style={[styles.timeSlotsLabel, { color: colors.charcoal }]}>Remind me at</Text>
                    <View style={styles.timeSlotsRow}>
                      {TIME_SLOTS.map(slot => (
                        <TouchableOpacity
                          key={slot.hour}
                          style={[
                            styles.timeSlot,
                            { borderColor: colors.border, backgroundColor: colors.chalk },
                            notifHour === slot.hour && { borderColor: colors.ember, backgroundColor: whyNowBg },
                          ]}
                          onPress={() => handleSetNotifHour(slot.hour)}
                        >
                          <Text style={[
                            styles.timeSlotTitle, { color: colors.ink },
                            notifHour === slot.hour && { color: colors.ember, fontWeight: '500' },
                          ]}>
                            {slot.label}
                          </Text>
                          <Text style={[
                            styles.timeSlotSub, { color: colors.charcoal },
                            notifHour === slot.hour && { color: colors.ember },
                          ]}>
                            {slot.sub}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Favourite genres ── */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>Favourite genres</Text>
            <Text style={[styles.sectionSub,   { color: colors.charcoal }]}>
              These shape every recommendation Kore makes for you.
            </Text>

            <View style={[styles.searchRow, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
              <Text style={{ fontSize: 14, color: colors.charcoal }}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: colors.ink }]}
                placeholder="Search genres..."
                placeholderTextColor={colors.charcoal}
                value={genreSearch}
                onChangeText={setGenreSearch}
              />
              {genreSearch.length > 0 && (
                <TouchableOpacity onPress={() => setGenreSearch('')}>
                  <Text style={{ fontSize: 14, color: colors.charcoal }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {favoriteGenres.length > 0 && (
              <View style={styles.pillsRow}>
                {favoriteGenres.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pill, { backgroundColor: colors.ember }]}
                    onPress={() => removeGenre(g)}
                  >
                    <Text style={styles.pillText}>{g}</Text>
                    <Text style={styles.pillX}>✕</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => { setFavoriteGenres([]); setSaved(false); }}>
                  <Text style={[styles.clearPillsText, { color: colors.charcoal }]}>Clear all</Text>
                </TouchableOpacity>
              </View>
            )}

            {ALL_GENRES.map(cat => {
              const filtered = filteredGenres(cat.genres);
              if (filtered.length === 0) return null;
              const isExpanded = expandedCats[cat.category] ?? false;
              return (
                <View key={cat.category} style={styles.genreCat}>
                  <TouchableOpacity
                    style={styles.catHeader}
                    onPress={() => setExpandedCats(prev => ({ ...prev, [cat.category]: !prev[cat.category] }))}
                  >
                    <Text style={[styles.catTitle,   { color: colors.charcoal }]}>{cat.category}</Text>
                    <Text style={[styles.catChevron, { color: colors.charcoal }]}>{isExpanded ? '↑' : '↓'}</Text>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.chipGrid}>
                      {filtered.map(g => (
                        <TouchableOpacity
                          key={g}
                          style={[
                            styles.chip,
                            { borderColor: colors.border, backgroundColor: colors.chalk },
                            favoriteGenres.includes(g) && { backgroundColor: colors.ember, borderColor: colors.ember },
                          ]}
                          onPress={() => toggleGenre(g)}
                        >
                          <Text style={[
                            styles.chipText, { color: colors.charcoal },
                            favoriteGenres.includes(g) && { color: '#fff', fontWeight: '500' },
                          ]}>
                            {g}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: saved ? colors.chalk : colors.ink },
                saved && { borderColor: colors.ember, borderWidth: 1.5 },
              ]}
              onPress={handleSaveGenres}
            >
              <Text style={[styles.saveBtnText, { color: saved ? colors.ember : colors.snow }]}>
                {saved ? '✓ Preferences saved' : 'Save preferences'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>

      {confirmConfig && (
        <ConfirmModal
          visible={true}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onCancel={() => setConfirmConfig(null)}
          onConfirm={confirmConfig.onConfirm}
          colors={colors}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn:      { width: 60 },
  backText:     { fontSize: 15 },
  headerTitle:  { fontSize: 17, fontWeight: '500' },
  headerRight:  { width: 60 },
  scroll:       { padding: 16, paddingTop: 12 },

  section:      { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 12 },
  rowBetween:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  sectionSub:   { fontSize: 12, lineHeight: 18, marginBottom: 8 },

  // Mix gems + Era Lock badge
  mixLabelWrap:   { flex: 1 },
  gemBadgeWrap:   { alignSelf: 'flex-start', backgroundColor: '#1D9E75', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, marginBottom: 6 },
  gemBadgeText:   { fontSize: 11, color: '#fff', fontWeight: '500' },
  disableEraBtn:  { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, marginLeft: 12, marginTop: 4 },
  disableEraBtnText: { fontSize: 12, fontWeight: '500' },

  // Notifications
  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  toggleLabel:  { fontSize: 14, fontWeight: '500' },
  toggleTrack:  { width: 42, height: 26, borderRadius: 13, justifyContent: 'center', position: 'relative' },
  toggleThumb:  { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', position: 'absolute', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  timeSlotsWrap:  { marginTop: 14 },
  timeSlotsLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, color: '#888' },
  timeSlotsRow:   { flexDirection: 'row', gap: 8 },
  timeSlot:       { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', gap: 3 },
  timeSlotTitle:  { fontSize: 12, fontWeight: '500' },
  timeSlotSub:    { fontSize: 10 },
  deniedWrap:     { gap: 10 },
  deniedText:     { fontSize: 12, lineHeight: 18 },
  settingsBtn:    { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  settingsBtnText:{ fontSize: 12, color: '#fff', fontWeight: '500' },

  // Rating tabs

  // Anime rows

  // Genre search
  searchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14 },

  // Pills
  pillsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 },
  pill:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  pillText:      { fontSize: 13, color: '#fff' },
  pillX:         { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  clearPillsText:{ fontSize: 12, textDecorationLine: 'underline' },

  // Genre categories
  genreCat:   { marginBottom: 8 },
  catHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  catTitle:   { fontSize: 12, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
  catChevron: { fontSize: 12 },
  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  chip:       { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5 },
  chipText:   { fontSize: 13 },

  saveBtn:     { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 14, fontWeight: '500' },
  bottomPad:   { height: 40 },
});