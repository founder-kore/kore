// src/storage/userPrefs.js
//
// Cloud-aware storage layer.
// When a user is logged in (setActiveUser called), all reads come from Supabase
// and all writes go to both AsyncStorage and Supabase simultaneously.
// When no user is set (guest mode), only AsyncStorage is used.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCloudHistory, addToCloudHistory, clearCloudHistory,
  getCloudRatings, saveCloudRating, removeCloudRating,
  getCloudWatchLater, addToCloudWatchLater,
  removeFromCloudWatchLater, clearCloudWatchLater,
  getCloudPreferences, updateCloudPreferences,
  getCurrentUser,
} from '../services/supabase';

const KEYS = {
  WATCHED:         'kore_watched_list',
  GENRES:          'kore_favorite_genres',
  STREAK:          'kore_streak',
  LAST_USED:       'kore_last_used',
  RATINGS:         'kore_ratings',
  HISTORY:         'kore_history',
  WATCH_LATER:     'kore_watch_later',
  MILESTONES_SEEN: 'kore_milestones_seen',
  HIDDEN_GEM_MODE: 'kore_hidden_gem_mode',
  DIRECTORS_CUT:   'kore_directors_cut_mode',
  MIX_HIDDEN_GEMS: 'kore_mix_hidden_gems',
  ERA_LOCK:        'kore_era_lock',
};

// ─── ACTIVE USER ─────────────────────────────────────────────────────────────
// Call setActiveUser(userId) from App.js when user logs in.
// Call clearActiveUser() on sign out.

let _activeUserId = null;

let _prefsCache = null;
let _prefsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedPrefs(userId) {
  const now = Date.now();
  if (_prefsCache && (now - _prefsCacheTime) < CACHE_TTL) return _prefsCache;
  const prefs = await getCloudPreferences(userId);
  _prefsCache = prefs;
  _prefsCacheTime = now;
  return prefs;
}

export function clearPrefsCache() {
  _prefsCache = null;
  _prefsCacheTime = 0;
}

export function setActiveUser(userId) {
  _activeUserId = userId || null;
  _prefsCache = null;
  _prefsCacheTime = 0;
}

export function clearActiveUser() {
  _activeUserId = null;
}

export function getActiveUserId() {
  return _activeUserId;
}

// Resolves the active user ID — falls back to checking the auth session if the
// in-memory ID was cleared by a spurious SIGNED_OUT during token refresh.
async function resolveUserId() {
  if (_activeUserId) return _activeUserId;
  try {
    const user = await getCurrentUser();
    if (user?.id) {
      _activeUserId = user.id; // restore it
      return user.id;
    }
  } catch {}
  return null;
}

// ─── MILESTONES ──────────────────────────────────────────────────────────────

export const MILESTONES = [
  { id: 'mood_insights',  days: 7,  displayDays: 7,  icon: '🧠', color: '#7F77DD', title: 'Mood Insights',   rewardType: 'content' },
  { id: 'kore_score',     days: 25, displayDays: 30, icon: '⚔️', color: '#E8630A', title: 'Kore Score',      rewardType: 'kore_score_and_nordvpn' },
  { id: 'directors_cut',  days: 45, displayDays: 60, icon: '👑', color: '#7F77DD', title: 'Full Rewards',    rewardType: 'era_lock_and_amazon' },
];

export function isUnlocked(id, streak) {
  const m = MILESTONES.find(m => m.id === id);
  return m ? streak >= m.days : false;
}

export function getNextMilestone(streak) {
  return MILESTONES.find(m => streak < m.days) || null;
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────

export async function getHistory() {
  const raw = await AsyncStorage.getItem(KEYS.HISTORY).catch(() => null);
  const local = raw ? JSON.parse(raw) : [];

  const userId = await resolveUserId();
  if (userId) {
    try {
      const cloud = await getCloudHistory(userId);
      if (cloud && cloud.length > 0) {
        if (local.length === 0) return cloud;
        const seen = new Set(local.map(h => h.title));
        const merged = [...local, ...cloud.filter(c => !seen.has(c.title))];
        return merged.slice(0, 200);
      }
    } catch {}
  }
  return local;
}

export async function addToHistory(entry) {
  try {
    // Always write to AsyncStorage
    const local = await AsyncStorage.getItem(KEYS.HISTORY);
    const history = local ? JSON.parse(local) : [];
    const updated = [entry, ...history].slice(0, 200);
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));

    // Also write to Supabase if logged in
    if (_activeUserId && entry.title) {
      addToCloudHistory(_activeUserId, entry).catch(() => {});
    }

    if (entry.title) await addToWatchedList(entry.title);
    return updated;
  } catch { return []; }
}

export async function clearHistory() {
  await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify([]));
  if (_activeUserId) {
    clearCloudHistory(_activeUserId).catch(() => {});
  }
}

// ─── WATCHED LIST ─────────────────────────────────────────────────────────────

export async function getWatchedList() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATCHED);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function addToWatchedList(title) {
  const list = await getWatchedList();
  if (!list.includes(title)) {
    await AsyncStorage.setItem(KEYS.WATCHED, JSON.stringify([title, ...list]));
  }
}

export async function removeFromWatchedList(title) {
  const list = await getWatchedList();
  const updated = list.filter(t => t !== title);
  await AsyncStorage.setItem(KEYS.WATCHED, JSON.stringify(updated));
  return updated;
}

// ─── RATINGS ─────────────────────────────────────────────────────────────────

export async function getRatings() {
  const raw = await AsyncStorage.getItem(KEYS.RATINGS).catch(() => null);
  const local = raw ? JSON.parse(raw) : [];

  const userId = await resolveUserId();
  if (userId) {
    try {
      const cloud = await getCloudRatings(userId);
      if (cloud && cloud.length > 0) {
        if (local.length === 0) return cloud;
        const seen = new Set(local.map(r => r.title));
        return [...local, ...cloud.filter(c => !seen.has(c.title))];
      }
    } catch {}
  }
  return local;
}

export async function saveRating(title, rating) {
  try {
    // AsyncStorage
    const raw = await AsyncStorage.getItem(KEYS.RATINGS);
    const ratings = raw ? JSON.parse(raw) : [];
    const updated = [{ title, rating, date: new Date().toISOString() }, ...ratings.filter(r => r.title !== title)];
    await AsyncStorage.setItem(KEYS.RATINGS, JSON.stringify(updated));

    // Supabase
    if (_activeUserId) {
      saveCloudRating(_activeUserId, title, rating).catch(() => {});
    }

    return updated;
  } catch { return []; }
}

export async function removeRating(title) {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RATINGS);
    const ratings = raw ? JSON.parse(raw) : [];
    const updated = ratings.filter(r => r.title !== title);
    await AsyncStorage.setItem(KEYS.RATINGS, JSON.stringify(updated));

    if (_activeUserId) {
      removeCloudRating(_activeUserId, title).catch(() => {});
    }

    return updated;
  } catch { return []; }
}

export async function getRatingSummary() {
  const ratings = await getRatings();
  return {
    loved:    ratings.filter(r => r.rating === 'loved').map(r => r.title),
    liked:    ratings.filter(r => r.rating === 'liked').map(r => r.title),
    disliked: ratings.filter(r => r.rating === 'disliked').map(r => r.title),
  };
}

// ─── WATCH LATER ─────────────────────────────────────────────────────────────

export async function getWatchLater() {
  const raw = await AsyncStorage.getItem(KEYS.WATCH_LATER).catch(() => null);
  const local = raw ? JSON.parse(raw) : [];

  const userId = await resolveUserId();
  if (userId) {
    try {
      const cloud = await getCloudWatchLater(userId);
      if (cloud && cloud.length > 0) {
        if (local.length === 0) return cloud;
        const seen = new Set(local.map(i => i.title));
        return [...local, ...cloud.filter(c => !seen.has(c.title))];
      }
    } catch {}
  }
  return local;
}

export async function addToWatchLater(entry) {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATCH_LATER);
    const list = raw ? JSON.parse(raw) : [];
    if (list.find(i => i.title === entry.title)) return list;
    const updated = [entry, ...list];
    await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify(updated));

    if (_activeUserId) {
      addToCloudWatchLater(_activeUserId, entry).catch(() => {});
    }

    return updated;
  } catch { return []; }
}

export async function removeFromWatchLater(title) {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATCH_LATER);
    const list = raw ? JSON.parse(raw) : [];
    const updated = list.filter(i => i.title !== title);
    await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify(updated));

    if (_activeUserId) {
      removeFromCloudWatchLater(_activeUserId, title).catch(() => {});
    }

    return updated;
  } catch { return []; }
}

export async function clearWatchLater() {
  await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify([]));
  if (_activeUserId) {
    clearCloudWatchLater(_activeUserId).catch(() => {});
  }
}

export async function isInWatchLater(title) {
  const list = await getWatchLater();
  return list.some(i => i.title === title);
}

// ─── GENRES ──────────────────────────────────────────────────────────────────

export async function getFavoriteGenres() {
  try {
    if (_activeUserId) {
     const prefs = await getCachedPrefs(_activeUserId);
      if (prefs?.favorite_genres && prefs.favorite_genres.length > 0) {
        return prefs.favorite_genres;
      }
    }
    const raw = await AsyncStorage.getItem(KEYS.GENRES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveFavoriteGenres(genres) {
  await AsyncStorage.setItem(KEYS.GENRES, JSON.stringify(genres));
  if (_activeUserId) {
    updateCloudPreferences(_activeUserId, { favorite_genres: genres }).catch(() => {});
  }
}

// ─── STREAK ──────────────────────────────────────────────────────────────────

export async function getStreak() {
  try {
    if (_activeUserId) {
      const prefs = await getCachedPrefs(_activeUserId);
      if (prefs?.streak !== undefined && prefs.streak !== null) {
        // Sync to local too
        await AsyncStorage.setItem(KEYS.STREAK, String(prefs.streak));
        if (prefs.last_used) await AsyncStorage.setItem(KEYS.LAST_USED, prefs.last_used);
        return prefs.streak;
      }
    }
    const raw = await AsyncStorage.getItem(KEYS.STREAK);
    return raw ? parseInt(raw) : 0;
  } catch { return 0; }
}

export async function updateStreak() {
  try {
    const lastUsed = await AsyncStorage.getItem(KEYS.LAST_USED);
    const today    = new Date().toDateString();
    const current  = await getStreak();
    if (lastUsed === today) return current;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const newStreak = lastUsed === yesterday.toDateString() ? current + 1 : 1;
    await AsyncStorage.setItem(KEYS.STREAK, String(newStreak));
    await AsyncStorage.setItem(KEYS.LAST_USED, today);

    if (_activeUserId) {
      _prefsCache = null;
      updateCloudPreferences(_activeUserId, { streak: newStreak, last_used: today }).catch(() => {});
    }

    return newStreak;
  } catch { return 1; }
}

// ─── MILESTONES SEEN ─────────────────────────────────────────────────────────

export async function getMilestonesSeen() {
  try {
    if (_activeUserId) {
      const prefs = await getCachedPrefs(_activeUserId);
      if (prefs?.milestones_seen && prefs.milestones_seen.length > 0) {
        return prefs.milestones_seen;
      }
    }
    const raw = await AsyncStorage.getItem(KEYS.MILESTONES_SEEN);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function markMilestoneSeen(id) {
  const seen = await getMilestonesSeen();
  if (!seen.includes(id)) {
    const updated = [...seen, id];
    await AsyncStorage.setItem(KEYS.MILESTONES_SEEN, JSON.stringify(updated));
    clearPrefsCache();
    if (_activeUserId) {
      updateCloudPreferences(_activeUserId, { milestones_seen: updated }).catch(() => {});
    }
  }
}

export async function getNewlyUnlockedMilestone(streak) {
  const seen = await getMilestonesSeen();
  return MILESTONES.find(m => streak >= m.days && !seen.includes(m.id)) || null;
}

// ─── AVOID LIST ──────────────────────────────────────────────────────────────

export async function getCombinedAvoidList() {
  const [watched, history] = await Promise.all([getWatchedList(), getHistory()]);
  const historyTitles = history.map(h => h.title).filter(Boolean);
  return [...new Set([...watched, ...historyTitles])];
}

// ─── SPECIAL MODES ───────────────────────────────────────────────────────────

export async function setHiddenGemMode(val) {
  await AsyncStorage.setItem(KEYS.HIDDEN_GEM_MODE, String(val));
}

export async function getHiddenGemMode() {
  const raw = await AsyncStorage.getItem(KEYS.HIDDEN_GEM_MODE);
  return raw === 'true';
}

export async function getDirectorsCutMode() {
  const raw = await AsyncStorage.getItem(KEYS.DIRECTORS_CUT);
  return raw === 'true';
}

export async function setDirectorsCutMode(val) {
  await AsyncStorage.setItem(KEYS.DIRECTORS_CUT, String(val));
}

export async function getMixHiddenGems() {
  try {
    if (_activeUserId) {
      const prefs = await getCachedPrefs(_activeUserId);
      if (prefs?.directors_cut !== undefined) return prefs.directors_cut === true;
    }
    const raw = await AsyncStorage.getItem(KEYS.MIX_HIDDEN_GEMS);
    return raw === 'true';
  } catch { return false; }
}

export async function setMixHiddenGems(val) {
  await AsyncStorage.setItem(KEYS.MIX_HIDDEN_GEMS, String(val));
  if (_activeUserId) {
    updateCloudPreferences(_activeUserId, { directors_cut: val }).catch(() => {});
  }
}

export async function getEraLock() {
  try {
    if (_activeUserId) {
      const prefs = await getCachedPrefs(_activeUserId);
      if (prefs?.era_lock) return prefs.era_lock;
    }
    const raw = await AsyncStorage.getItem(KEYS.ERA_LOCK);
    return raw || null;
  } catch { return null; }
}

export async function setEraLock(era) {
  if (era === null) {
    await AsyncStorage.removeItem(KEYS.ERA_LOCK);
  } else {
    await AsyncStorage.setItem(KEYS.ERA_LOCK, era);
  }
  clearPrefsCache();
  if (_activeUserId) {
    updateCloudPreferences(_activeUserId, { era_lock: era }).catch(() => {});
  }
}

// ─── CLEAR ALL ───────────────────────────────────────────────────────────────

export async function clearAllAnimeData() {
  await Promise.all([
    AsyncStorage.setItem(KEYS.WATCHED, JSON.stringify([])),
    AsyncStorage.setItem(KEYS.RATINGS, JSON.stringify([])),
    AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify([])),
  ]);
}