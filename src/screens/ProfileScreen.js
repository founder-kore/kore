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
const NOTIF_MINUTE_KEY  = 'kore_notif_minute';
const NOTIF_ENABLED_KEY = 'kore_notif_enabled';

const NOTIF_MESSAGES = [
  { title: 'コレ', body: 'Your streak is waiting. What are you watching tonight?' },
  { title: 'コレ', body: "Don't break the streak. One anime, one question." },
  { title: 'コレ', body: "Tonight's pick is waiting for you." },
  { title: 'コレ', body: "Keep it going. What's the vibe tonight?" },
];

const TIME_PRESETS = [
  { label: '9am',  h: 9,  m: 0 },
  { label: '12pm', h: 12, m: 0 },
  { label: '6pm',  h: 18, m: 0 },
  { label: '8pm',  h: 20, m: 0 },
  { label: '10pm', h: 22, m: 0 },
];

const ALL_GENRES = [
  { category: 'Core',           genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'] },
  { category: 'Anime-specific', genres: ['Isekai', 'Mecha', 'Slice of Life', 'Sports', 'Supernatural', 'Psychological', 'Historical', 'Music'] },
  { category: 'Tone',           genres: ['Dark', 'Feel-good', 'Mind-bending', 'Wholesome', 'Gritty', 'Philosophical'] },
];


const ERA_LABELS = {
  '70s': '1970s', '80s': '1980s', '90s': '1990s',
  '00s': '2000s', '10s': '2010s', '20s': '2020s',
};

const MILESTONE_STEPS = [
  { days: 7,  label: 'Mood Insights' },
  { days: 14, label: 'Hidden Gem mode' },
  { days: 30, label: 'Kore Score' },
  { days: 60, label: 'Era Lock' },
];

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

export default function ProfileScreen({ onBack, streak = 0, onSignOut, userProfile: propProfile, onEdit, onOpenEraLock }) {
  const { colors, isDark, toggleDarkMode } = useTheme();

  const [favoriteGenres,  setFavoriteGenres]  = useState([]);
  const [genreSearch,     setGenreSearch]     = useState('');
  const [expandedCats,    setExpandedCats]    = useState({});
  const [genresOpen,      setGenresOpen]      = useState(false); // collapsed by default
  const [saved,           setSaved]           = useState(false);
  const [notifEnabled,    setNotifEnabled]    = useState(false);
  const [notifPermission, setNotifPermission] = useState('undetermined');
  const [notifHour,       setNotifHour]       = useState(20);
  const [notifMinute,     setNotifMinute]     = useState(0);
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
      const savedMinute  = await AsyncStorage.getItem(NOTIF_MINUTE_KEY);
      const savedEnabled = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
      if (savedHour)   setNotifHour(parseInt(savedHour));
      if (savedMinute) setNotifMinute(parseInt(savedMinute));
      if (savedEnabled === 'true') {
        if (Platform.OS !== 'web') {
          const { status } = await Notifications.getPermissionsAsync();
          setNotifPermission(status);
          setNotifEnabled(status === 'granted');
        } else {
          setNotifEnabled(true);
        }
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

  const scheduleStreakReminder = async (hour, minute) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('kore-streak', {
          name: 'Streak Reminders', importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      const msg = NOTIF_MESSAGES[Math.floor(Math.random() * NOTIF_MESSAGES.length)];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          sound: true,
          ...(Platform.OS === 'android' ? { channelId: 'kore-streak' } : {}),
        },
        trigger: { hour, minute, repeats: true },
      });
    } catch (e) { console.log('Could not schedule notification:', e); }
  };

  const handleToggleNotif = async (value) => {
    if (Platform.OS === 'web') {
      setNotifEnabled(value);
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(value));
      return;
    }
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifPermission(status);
      if (status !== 'granted') return;
      await scheduleStreakReminder(notifHour, notifMinute);
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'true');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.setItem(NOTIF_ENABLED_KEY, 'false');
    }
    setNotifEnabled(value);
  };

  const handleTimeChange = async (hour, minute) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifHour(hour);
    setNotifMinute(minute);
    await AsyncStorage.setItem(NOTIF_HOUR_KEY, String(hour));
    await AsyncStorage.setItem(NOTIF_MINUTE_KEY, String(minute));
    if (notifEnabled) await scheduleStreakReminder(hour, minute);
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
  const eraRowUnlocked    = streakLocal >= 60;
  const cardBg  = isDark ? '#1A1A1A' : colors.snow;
  const borderC = isDark ? '#2A2A2A' : colors.border;
  const genrePreview   = favoriteGenres.length > 0
    ? favoriteGenres.slice(0, 3).join(' · ') + (favoriteGenres.length > 3 ? ` +${favoriteGenres.length - 3}` : '')
    : 'None set';
  const initials = userProfile
    ? (userProfile.display_name || userProfile.username || '?').slice(0, 2).toUpperCase()
    : '?';

  const memberSince = userProfile?.created_at
    ? new Date(userProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const nextMilestone = MILESTONE_STEPS.find(m => streakLocal < m.days) || null;
  const milestoneProgress = nextMilestone
    ? Math.min(100, Math.round((streakLocal / nextMilestone.days) * 100))
    : 100;

  const filteredGenres = (genres) =>
    genreSearch ? genres.filter(g => g.toLowerCase().includes(genreSearch.toLowerCase())) : genres;

  // Whether this is the last item in the Recommendations section
  const recsHasMore = hiddenGemUnlocked || eraLockUnlocked || true; // era row always present

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
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {streakLocal > 0 && (
                      <View style={styles.streakPill}>
                        <Text style={styles.streakText}>🔥 {streakLocal} day streak</Text>
                      </View>
                    )}
                    {memberSince && (
                      <View style={[styles.sincePill, {
                        backgroundColor: isDark ? '#1A1A2E' : '#EEEDFE',
                        borderColor: isDark ? '#2E2E50' : '#AFA9EC',
                      }]}>
                        <Text style={[styles.sinceText, { color: isDark ? '#7F77DD' : '#534AB7' }]}>🌸 {memberSince}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
                  <Text style={[styles.editLabel, { color: colors.ember }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Next milestone progress ── */}
          {!isGuest && nextMilestone && (
            <View style={[styles.milestoneCard, {
              backgroundColor: isDark ? '#1A1208' : '#FFF5E6',
              borderColor: isDark ? '#4A3010' : '#F5D9B0',
            }]}>
              <Text style={styles.milestoneLabel}>NEXT MILESTONE · {nextMilestone.days} DAYS</Text>
              <View style={[styles.milestoneBarBg, { backgroundColor: isDark ? '#2A1F0F' : '#F5D9B0' }]}>
                <View style={[styles.milestoneBarFill, { width: `${milestoneProgress}%` }]} />
              </View>
              <Text style={[styles.milestoneSub, { color: isDark ? '#666' : '#A07040' }]}>
                {streakLocal} of {nextMilestone.days} days · Unlock {nextMilestone.label} at day {nextMilestone.days}
              </Text>
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
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomColor: borderC, borderBottomWidth: 0 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleDarkMode(!isDark); }}
              activeOpacity={0.7}
            >
              <View style={[styles.rowIcon, { backgroundColor: isDark ? '#2A2A2A' : '#F0EFED' }]}>
                <Text style={styles.rowIconText}>🌙</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.ink }]}>Dark mode</Text>
                <Text style={[styles.menuSub, { color: colors.charcoal }]}>{isDark ? 'Currently on' : 'Currently off'}</Text>
              </View>
              <View style={[styles.toggleTrack, { backgroundColor: isDark ? colors.ember : colors.border }]}>
                <View style={[styles.toggleThumb, { transform: [{ translateX: isDark ? 18 : 2 }] }]} />
              </View>
            </TouchableOpacity>
          </SectionBlock>

          {/* ── RECOMMENDATIONS ── */}
          <SectionBlock label="RECOMMENDATIONS" colors={colors} cardBg={cardBg} borderC={borderC}>

            {/* Favourite genres row — tapping expands the picker inline */}
            <TouchableOpacity
              style={[
                styles.menuRow,
                { borderBottomColor: borderC },
                genresOpen && { backgroundColor: isDark ? '#222' : '#fafafa' },
              ]}
              onPress={handleToggleGenres}
              activeOpacity={0.7}
            >
              <View style={[styles.rowIcon, { backgroundColor: isDark ? '#1A2A1A' : '#E8F5EE' }]}>
                <Text style={styles.rowIconText}>🎭</Text>
              </View>
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

            {/* Era preference row */}
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomColor: borderC }, !hiddenGemUnlocked && !eraLockUnlocked && { borderBottomWidth: 0 }, !eraRowUnlocked && { opacity: 0.4 }]}
              onPress={() => { if (eraRowUnlocked && onOpenEraLock) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenEraLock(); } }}
              activeOpacity={eraRowUnlocked ? 0.7 : 1}
            >
              <View style={[styles.rowIcon, { backgroundColor: isDark ? '#1A1A2A' : '#EEEDFE' }]}>
                <Text style={styles.rowIconText}>📅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.ink }]}>Era preference</Text>
                <Text style={[styles.menuSub, { color: colors.charcoal }]}>
                  {eraRowUnlocked
                    ? (eraLock ? `Active: ${ERA_LABELS[eraLock] || eraLock}` : 'Any era')
                    : 'Unlocks at 60 day streak'}
                </Text>
              </View>
              {eraRowUnlocked ? (
                <Text style={[styles.menuArrow, { color: colors.charcoal }]}>›</Text>
              ) : (
                <View style={[styles.lockedPill, { backgroundColor: isDark ? '#252525' : '#EBEBEB' }]}>
                  <Text style={[styles.lockedPillText, { color: isDark ? '#555' : '#888' }]}>🔒 Locked</Text>
                </View>
              )}
            </TouchableOpacity>

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
                <TouchableOpacity
                  style={[styles.menuRow, { borderBottomColor: borderC }, !notifEnabled && { borderBottomWidth: 0 }]}
                  onPress={() => handleToggleNotif(!notifEnabled)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rowIcon, { backgroundColor: isDark ? '#2A1A1A' : '#FAEEE6' }]}>
                    <Text style={styles.rowIconText}>🔔</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuLabel, { color: colors.ink }]}>Streak reminder</Text>
                    <Text style={[styles.menuSub, { color: colors.charcoal }]}>
                      {notifEnabled
                        ? `Daily at ${String(notifHour % 12 || 12).padStart(2, '0')}:${String(notifMinute).padStart(2, '0')} ${notifHour >= 12 ? 'PM' : 'AM'}`
                        : 'Get a nudge to keep your streak alive'}
                    </Text>
                  </View>
                  <View style={[styles.toggleTrack, { backgroundColor: notifEnabled ? colors.ember : (isDark ? '#333' : '#CCC') }]}>
                    <View style={[styles.toggleThumb, { transform: [{ translateX: notifEnabled ? 18 : 2 }] }]} />
                  </View>
                </TouchableOpacity>

                {notifEnabled && Platform.OS !== 'web' && (
                  <View style={[styles.notifPanel, { backgroundColor: isDark ? '#191919' : '#F8F7F5', borderTopColor: borderC }]}>
                    <Text style={[styles.notifPanelLabel, { color: colors.charcoal }]}>REMIND ME AT</Text>
                    <View style={styles.notifPresetRow}>
                      {TIME_PRESETS.map(p => {
                        const active = notifHour === p.h && notifMinute === p.m;
                        return (
                          <TouchableOpacity
                            key={p.label}
                            style={[styles.notifPresetPill, {
                              backgroundColor: active ? (isDark ? '#2A1F0F' : '#FFF0E0') : (isDark ? '#242424' : '#EFEFED'),
                              borderColor: active ? (isDark ? '#4A3010' : '#F5D9B0') : borderC,
                            }]}
                            onPress={() => handleTimeChange(p.h, p.m)}
                          >
                            <Text style={[styles.notifPresetText, { color: active ? '#E8630A' : colors.charcoal }]}>{p.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={[styles.notifDivider, { backgroundColor: borderC }]} />
                    <View style={styles.notifCustomRow}>
                      <Text style={[styles.notifCustomLabel, { color: colors.charcoal }]}>Custom time</Text>
                      <TextInput
                        style={[styles.notifCustomInput, { color: colors.ink, borderColor: borderC, backgroundColor: isDark ? '#242424' : '#EFEFED' }]}
                        value={`${String(notifHour).padStart(2, '0')}:${String(notifMinute).padStart(2, '0')}`}
                        onChangeText={(val) => {
                          const [h, m] = val.split(':').map(Number);
                          if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                            handleTimeChange(h, m);
                          }
                        }}
                        placeholder="HH:MM"
                        placeholderTextColor={colors.charcoal}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                    </View>
                  </View>
                )}

                {notifEnabled && Platform.OS === 'web' && (
                  <View style={[styles.notifWebNote, {
                    backgroundColor: isDark ? '#1A1A2E' : '#EEEDFE',
                    borderColor: isDark ? '#2E2E50' : '#AFA9EC',
                  }]}>
                    <Text style={[styles.notifWebNoteText, { color: isDark ? '#7F77DD' : '#534AB7' }]}>
                      Reminders are available in the Kore mobile app. Download it to get daily streak nudges.
                    </Text>
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
  streakPill:   { alignSelf: 'flex-start', backgroundColor: '#E8630A18', borderWidth: 0.5, borderColor: '#E8630A40', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  streakText:   { fontSize: 11, color: '#E8630A', fontWeight: '500' },
  sincePill:    { alignSelf: 'flex-start', borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  sinceText:    { fontSize: 11, fontWeight: '500' },
  milestoneCard:  { borderRadius: 14, borderWidth: 0.5, padding: 14, marginBottom: 16 },
  milestoneLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.8, color: '#E8630A', marginBottom: 8 },
  milestoneBarBg: { height: 5, borderRadius: 3, marginBottom: 8 },
  milestoneBarFill: { height: 5, borderRadius: 3, backgroundColor: '#E8630A' },
  milestoneSub:   { fontSize: 11 },
  rowIcon:      { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowIconText:  { fontSize: 14 },
  lockedPill:   { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  lockedPillText: { fontSize: 11, fontWeight: '500' },
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

  notifPanel:       { marginHorizontal: -14, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 0.5 },
  notifPanelLabel:  { fontSize: 10, fontWeight: '500', letterSpacing: 0.8, marginBottom: 10 },
  notifPresetRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  notifPresetPill:  { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 0.5 },
  notifPresetText:  { fontSize: 13, fontWeight: '500' },
  notifDivider:     { height: 0.5, marginBottom: 12 },
  notifCustomRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifCustomLabel: { fontSize: 13 },
  notifCustomInput: { fontSize: 13, borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 70, textAlign: 'center' },
  notifWebNote:     { marginTop: 8, borderRadius: 10, borderWidth: 0.5, paddingHorizontal: 14, paddingVertical: 10 },
  notifWebNoteText: { fontSize: 11, lineHeight: 16 },

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