// src/screens/ProfileScreen.js

import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, TextInput, Linking, Platform, Image,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../constants/theme';
import {
  getFavoriteGenres, saveFavoriteGenres,
  getMixHiddenGems, setMixHiddenGems, getStreak, isUnlocked,
  getEraLock, setEraLock, MILESTONES,
} from '../storage/userPrefs';
import { signOut, getCurrentUser, getProfile } from '../services/supabase';

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
  '70s': '1970s', '80s': '1980s', '90s': '1990s',
  '00s': '2000s', '10s': '2010s', '20s': '2020s',
};

function ToggleRow({ label, sub, value, onToggle, colors, borderC, last }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, { borderBottomColor: borderC }, last && { borderBottomWidth: 0 }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, { color: colors.ink }]}>{label}</Text>
        {sub ? <Text style={[styles.menuSub, { color: colors.charcoal }]}>{sub}</Text> : null}
      </View>
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.ember : colors.border }]}>
        <View style={[styles.toggleThumb, { transform: [{ translateX: value ? 18 : 2 }] }]} />
      </View>
    </TouchableOpacity>
  );
}

function SectionBlock({ label, children, colors, cardBg, borderC }) {
  return (
    <View style={styles.sectionWrap}>
      {label && <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>{label}</Text>}
      <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: borderC }]}>
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen({ onBack, streak = 0, onSignOut, userProfile: propProfile, onEdit }) {
  const { colors, isDark, toggleDarkMode } = useTheme();

  const [favoriteGenres,  setFavoriteGenres]  = useState([]);
  const [genreSearch,     setGenreSearch]     = useState('');
  const [expandedCats,    setExpandedCats]    = useState({});
  const [genresOpen,      setGenresOpen]      = useState(false); // collapsed by default
  const [saved,           setSaved]           = useState(false);
  const [notifEnabled,    setNotifEnabled]    = useState(false);
  const [notifPermission, setNotifPermission] = useState('undetermined');
  const [notifHour,       setNotifHour]       = useState(19);
  const [mixGems,         setMixGemsLocal]    = useState(false);
  const [eraLock,         setEraLockLocal]    = useState(null);
  const [streakLocal,     setStreakLocal]      = useState(streak);
  const [userProfile,     setUserProfile]     = useState(propProfile || null);
  const [isGuest,         setIsGuest]         = useState(false);

  useEffect(() => {
    if (propProfile) setUserProfile(propProfile);
  }, [propProfile]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [genres, mix, currentStreak, era] = await Promise.all([
        getFavoriteGenres(), getMixHiddenGems(), getStreak(), getEraLock(),
      ]);
      const guestMode = await AsyncStorage.getItem('kore_guest_mode');
      setIsGuest(guestMode === 'true');
      setFavoriteGenres(genres);
      setMixGemsLocal(mix);
      setStreakLocal(currentStreak);
      setEraLockLocal(era);

      // Fallback — load profile directly if not passed as prop
      if (!propProfile && guestMode !== 'true') {
        try {
          const user = await getCurrentUser();
          if (user) {
            const profile = await getProfile(user.id);
            if (profile) setUserProfile(profile);
          }
        } catch {}
      }

      const savedHour    = await AsyncStorage.getItem(NOTIF_HOUR_KEY);
      const savedEnabled = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
      if (savedHour) setNotifHour(parseInt(savedHour));
      if (savedEnabled === 'true') {
        const { status } = await Notifications.getPermissionsAsync();
        setNotifPermission(status);
        setNotifEnabled(status === 'granted');
      }
    } catch (e) { console.log('ProfileScreen loadData error:', e); }
  };

  const handleSaveGenres = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveFavoriteGenres(favoriteGenres);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setGenresOpen(false); // collapse after saving
    }, 1200);
  };

  const toggleGenre = (genre) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavoriteGenres(prev => prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]);
    setSaved(false);
  };

  const removeGenre = (genre) => { setFavoriteGenres(prev => prev.filter(g => g !== genre)); setSaved(false); };

  const scheduleNotif = async (hour) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('kore-streak', {
          name: 'Streak Reminders', importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'コレ — Your daily pick is waiting 🌸',
          body: "Keep your streak alive. What's your vibe tonight?",
          ...(Platform.OS === 'android' ? { channelId: 'kore-streak' } : {}),
        },
        trigger: { type: 'daily', hour, minute: 0 },
      });
    } catch (e) { console.log('Could not schedule notification:', e); }
  };

  const handleEnableNotif = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifPermission(status);
    if (status === 'granted') {
      setNotifEnabled(true);
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'true');
      await scheduleNotif(notifHour);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else { setNotifPermission('denied'); }
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

  const handleToggleGenres = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGenresOpen(prev => !prev);
    if (genresOpen) {
      // closing — reset search
      setGenreSearch('');
    }
  };

  const hiddenGemUnlocked = isUnlocked('hidden_gem',    streakLocal);
  const eraLockUnlocked   = isUnlocked('directors_cut', streakLocal);
  const whyNowBg = isDark ? '#2A1A00' : '#FFF5EE';
  const cardBg   = isDark ? '#1A1A1A' : colors.snow;
  const borderC  = isDark ? '#2A2A2A' : colors.border;

  const notifTimeLabel = TIME_SLOTS.find(s => s.hour === notifHour)?.sub || '7:00 PM';
  const genrePreview   = favoriteGenres.length > 0
    ? favoriteGenres.slice(0, 3).join(' · ') + (favoriteGenres.length > 3 ? ` +${favoriteGenres.length - 3}` : '')
    : 'None set';
  const initials = userProfile
    ? (userProfile.display_name || userProfile.username || '?').slice(0, 2).toUpperCase()
    : '?';

  const filteredGenres = (genres) =>
    genreSearch ? genres.filter(g => g.toLowerCase().includes(genreSearch.toLowerCase())) : genres;

  // Whether this is the last item in the Recommendations section
  const recsHasMore = hiddenGemUnlocked || eraLockUnlocked;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.chalk }]}>

        <View style={[styles.header, { borderBottomColor: borderC }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Profile card ── */}
          {!isGuest && userProfile && (
            <View style={[styles.profileCard, { backgroundColor: cardBg, borderColor: borderC }]}>
              <View style={styles.profileRow}>
                <View style={styles.avatarWrap}>
                  {userProfile.avatar_url ? (
                    <Image
                      source={{ uri: userProfile.avatar_url }}
                      style={styles.avatar}
                      onError={() => setUserProfile(prev => ({ ...prev, avatar_url: null }))}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: userProfile.avatar_color || colors.ember }]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                  )}
                  <View style={[styles.editDot, { borderColor: colors.chalk }]}>
                    <Text style={styles.editIcon}>✎</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileName, { color: colors.ink }]}>{userProfile.display_name || userProfile.username}</Text>
                  <Text style={[styles.profileUsername, { color: colors.charcoal }]}>@{userProfile.username}</Text>
                  {streakLocal > 0 && (
                    <View style={styles.streakPill}>
                      <Text style={styles.streakText}>🔥 {streakLocal} day streak</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
                  <Text style={[styles.editLabel, { color: colors.ember }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isGuest && (
            <View style={[styles.profileCard, { backgroundColor: cardBg, borderColor: borderC }]}>
              <Text style={[styles.profileName, { color: colors.ink }]}>Guest</Text>
              <Text style={[styles.profileUsername, { color: colors.charcoal }]}>Data stored locally only</Text>
              <TouchableOpacity
                style={[styles.createAccountBtn, { backgroundColor: colors.ember }]}
                onPress={() => { if (onSignOut) onSignOut(); }}
                activeOpacity={0.85}
              >
                <Text style={styles.createAccountText}>Create account →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── APPEARANCE ── */}
          <SectionBlock label="APPEARANCE" colors={colors} cardBg={cardBg} borderC={borderC}>
            <ToggleRow
              label="Dark mode"
              sub={isDark ? 'Currently on' : 'Currently off'}
              value={isDark}
              onToggle={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleDarkMode(!isDark); }}
              colors={colors} borderC={borderC} last
            />
          </SectionBlock>

          {/* ── RECOMMENDATIONS ── */}
          <SectionBlock label="RECOMMENDATIONS" colors={colors} cardBg={cardBg} borderC={borderC}>

            {/* Favourite genres row — tapping expands the picker inline */}
            <TouchableOpacity
              style={[
                styles.menuRow,
                { borderBottomColor: borderC },
                genresOpen && { backgroundColor: isDark ? '#222' : '#fafafa' },
                !recsHasMore && !genresOpen && { borderBottomWidth: 0 },
              ]}
              onPress={handleToggleGenres}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.ink }]}>Favourite genres</Text>
                <Text style={[styles.menuSub, { color: colors.charcoal }]}>{genrePreview}</Text>
              </View>
              <Text style={[styles.menuArrow, { color: colors.charcoal, transform: [{ rotate: genresOpen ? '90deg' : '0deg' }] }]}>›</Text>
            </TouchableOpacity>

            {/* Inline expanded genre picker */}
            {genresOpen && (
              <View style={[styles.genresPicker, { borderBottomColor: borderC, borderBottomWidth: recsHasMore ? 0.5 : 0 }]}>
                <View style={[styles.searchRow, { backgroundColor: isDark ? '#2A2A2A' : colors.chalk, borderColor: borderC }]}>
                  <Text style={{ fontSize: 14, color: colors.charcoal }}>🔍</Text>
                  <TextInput
                    style={[styles.searchInput, { color: colors.ink }]}
                    placeholder="Search genres..."
                    placeholderTextColor={colors.charcoal}
                    value={genreSearch}
                    onChangeText={setGenreSearch}
                    autoCorrect={false}
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
                      <TouchableOpacity key={g} style={[styles.pill, { backgroundColor: colors.ember }]} onPress={() => removeGenre(g)}>
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
                  const isExpanded = expandedCats[cat.category] ?? (cat.category === 'Core');
                  return (
                    <View key={cat.category} style={styles.genreCat}>
                      <TouchableOpacity
                        style={styles.catHeader}
                        onPress={() => setExpandedCats(prev => ({ ...prev, [cat.category]: !prev[cat.category] }))}
                      >
                        <Text style={[styles.catTitle, { color: colors.charcoal }]}>{cat.category}</Text>
                        <Text style={[styles.catChevron, { color: colors.charcoal }]}>{isExpanded ? '↑' : '↓'}</Text>
                      </TouchableOpacity>
                      {isExpanded && (
                        <View style={styles.chipGrid}>
                          {filtered.map(g => (
                            <TouchableOpacity
                              key={g}
                              style={[styles.chip, { borderColor: borderC, backgroundColor: isDark ? '#2A2A2A' : colors.chalk },
                                favoriteGenres.includes(g) && { backgroundColor: colors.ember, borderColor: colors.ember }]}
                              onPress={() => toggleGenre(g)}
                            >
                              <Text style={[styles.chipText, { color: colors.charcoal },
                                favoriteGenres.includes(g) && { color: '#fff', fontWeight: '500' }]}>{g}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: saved ? colors.chalk : isDark ? '#E8630A' : colors.ink },
                    saved && { borderColor: colors.ember, borderWidth: 1.5 }]}
                  onPress={handleSaveGenres}
                >
                  <Text style={[styles.saveBtnText, { color: saved ? colors.ember : colors.snow }]}>
                    {saved ? '✓ Saved' : 'Save preferences'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {hiddenGemUnlocked && (
              <ToggleRow
                label="Hidden Gem mode"
                sub="Mix rare picks into recommendations"
                value={mixGems}
                onToggle={() => handleMixToggle(!mixGems)}
                colors={colors} borderC={borderC}
                last={!eraLockUnlocked}
              />
            )}

            {eraLockUnlocked && (
              <View style={[styles.menuRow, { borderBottomColor: borderC, borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLabel, { color: colors.ink }]}>Era Lock</Text>
                  <Text style={[styles.menuSub, { color: colors.charcoal }]}>
                    {eraLock ? `Active: ${ERA_LABELS[eraLock] || eraLock}` : 'Currently off'}
                  </Text>
                </View>
                {eraLock ? (
                  <TouchableOpacity style={[styles.disableBtn, { borderColor: borderC }]} onPress={handleDisableEraLock}>
                    <Text style={[styles.disableBtnText, { color: colors.charcoal }]}>Turn off</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.menuArrow, { color: colors.charcoal }]}>›</Text>
                )}
              </View>
            )}
          </SectionBlock>

          {/* ── NOTIFICATIONS ── */}
          <SectionBlock label="NOTIFICATIONS" colors={colors} cardBg={cardBg} borderC={borderC}>
            {notifPermission === 'denied' ? (
              <View style={{ paddingVertical: 8 }}>
                <Text style={[styles.menuLabel, { color: colors.ink, marginBottom: 4 }]}>Streak reminder</Text>
                <Text style={[styles.menuSub, { color: colors.charcoal, marginBottom: 10 }]}>
                  Notifications blocked. Enable in Settings.
                </Text>
                <TouchableOpacity
                  style={[styles.createAccountBtn, { backgroundColor: colors.ember, alignSelf: 'flex-start' }]}
                  onPress={() => Linking.openSettings()}
                >
                  <Text style={styles.createAccountText}>Open Settings →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ToggleRow
                  label="Streak reminder"
                  sub={notifEnabled ? `Daily at ${notifTimeLabel}` : 'Get a nudge to keep your streak alive'}
                  value={notifEnabled}
                  onToggle={notifEnabled ? handleDisableNotif : handleEnableNotif}
                  colors={colors} borderC={borderC}
                  last={!notifEnabled}
                />
                {notifEnabled && (
                  <View style={styles.timeSlotsWrap}>
                    <Text style={[styles.timeSlotsLabel, { color: colors.charcoal }]}>Remind me at</Text>
                    <View style={styles.timeSlotsRow}>
                      {TIME_SLOTS.map(slot => (
                        <TouchableOpacity
                          key={slot.hour}
                          style={[styles.timeSlot, { borderColor: borderC, backgroundColor: isDark ? '#2A2A2A' : colors.chalk },
                            notifHour === slot.hour && { borderColor: colors.ember, backgroundColor: whyNowBg }]}
                          onPress={() => handleSetNotifHour(slot.hour)}
                        >
                          <Text style={[styles.timeSlotTitle, { color: colors.ink },
                            notifHour === slot.hour && { color: colors.ember }]}>{slot.label}</Text>
                          <Text style={[styles.timeSlotSub, { color: colors.charcoal },
                            notifHour === slot.hour && { color: colors.ember }]}>{slot.sub}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </SectionBlock>

          {/* ── Sign out ── */}
          {!isGuest && (
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (onSignOut) onSignOut();
                try { await signOut(); } catch {}
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn:      { width: 60 },
  backText:     { fontSize: 15 },
  headerTitle:  { fontSize: 17, fontWeight: '500' },
  scroll:       { padding: 16, paddingTop: 14 },

  profileCard:  { borderRadius: 16, borderWidth: 0.5, padding: 16, marginBottom: 16 },
  profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap:   { position: 'relative' },
  avatar:       { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 20, fontWeight: '500', color: '#fff' },
  editDot:      { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#E8630A', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  editIcon:     { fontSize: 10, color: '#fff' },
  profileName:  { fontSize: 16, fontWeight: '500', marginBottom: 2 },
  profileUsername: { fontSize: 13 },
  editLabel:    { fontSize: 13, fontWeight: '500' },
  streakPill:   { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#E8630A18', borderWidth: 0.5, borderColor: '#E8630A40', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  streakText:   { fontSize: 11, color: '#E8630A', fontWeight: '500' },
  createAccountBtn: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  createAccountText:{ fontSize: 13, color: '#fff', fontWeight: '500' },

  sectionWrap:  { marginBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.8, marginBottom: 5, paddingLeft: 2 },
  sectionCard:  { borderRadius: 14, borderWidth: 0.5, paddingHorizontal: 14, paddingVertical: 4 },

  menuRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 0.5 },
  menuLabel:    { fontSize: 14 },
  menuSub:      { fontSize: 11, marginTop: 2 },
  menuArrow:    { fontSize: 16 },

  toggleTrack:  { width: 40, height: 24, borderRadius: 12, justifyContent: 'center', position: 'relative' },
  toggleThumb:  { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', position: 'absolute' },

  disableBtn:   { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 0.5 },
  disableBtnText:{ fontSize: 12 },

  timeSlotsWrap:  { paddingVertical: 10 },
  timeSlotsLabel: { fontSize: 11, letterSpacing: 0.5, marginBottom: 8 },
  timeSlotsRow:   { flexDirection: 'row', gap: 8 },
  timeSlot:       { flex: 1, padding: 8, borderRadius: 10, borderWidth: 0.5, alignItems: 'center', gap: 2 },
  timeSlotTitle:  { fontSize: 12, fontWeight: '500' },
  timeSlotSub:    { fontSize: 10 },

  // Inline genre picker (expanded inside the card)
  genresPicker: { paddingVertical: 12, paddingHorizontal: 2 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 0.5, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchInput:  { flex: 1, fontSize: 14 },
  pillsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  pillText:     { fontSize: 13, color: '#fff' },
  pillX:        { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  clearPillsText:{ fontSize: 12, textDecorationLine: 'underline' },
  genreCat:     { marginBottom: 6 },
  catHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  catTitle:     { fontSize: 11, fontWeight: '500', letterSpacing: 0.3, textTransform: 'uppercase' },
  catChevron:   { fontSize: 12 },
  chipGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  chip:         { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 0.5 },
  chipText:     { fontSize: 13 },
  saveBtn:      { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText:  { fontSize: 14, fontWeight: '500' },

  signOutBtn:   { alignItems: 'center', paddingVertical: 16 },
  signOutText:  { fontSize: 14, color: '#CC3333', fontWeight: '500' },
});