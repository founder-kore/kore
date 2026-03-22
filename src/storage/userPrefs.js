import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ─── MILESTONES ─────────────────────────────────────────────────────────────
//
// days        = internal unlock threshold (what actually triggers celebration)
// displayDays = shown to user as the goal (creates early unlock surprise)
//
// User sees "earn 30-day reward" → gets it at day 25 (5 days early)
// User sees "earn 60-day reward" → gets it at day 45 (15 days early)
//
export const MILESTONES = [
  {
    id: 'mood_insights',
    days: 7,
    displayDays: 7,
    icon: '🧠',
    color: '#7F77DD',
    title: 'Mood Insights',
    rewardType: 'content',
  },
  {
    id: 'hidden_gem',
    days: 14,
    displayDays: 14,
    icon: '💎',
    color: '#1D9E75',
    title: 'Hidden Gem Mode',
    rewardType: 'profile_card',
  },
  {
    id: 'kore_score',
    days: 25,
    displayDays: 30,
    icon: '⚔️',
    color: '#E8630A',
    title: 'Kore Score',
    rewardType: 'kore_score_and_nordvpn',
  },
  {
    id: 'directors_cut',
    days: 45,
    displayDays: 60,
    icon: '👑',
    color: '#7F77DD',
    title: 'Full Rewards',
    rewardType: 'era_lock_and_amazon',
  },
];

// Returns true if milestone is unlocked based on INTERNAL threshold
export function isUnlocked(id, streak) {
  const m = MILESTONES.find(m => m.id === id);
  return m ? streak >= m.days : false;
}

// Next milestone not yet unlocked — uses displayDays for the progress bar goal
export function getNextMilestone(streak) {
  return MILESTONES.find(m => streak < m.days) || null;
}

// ─── WATCHED LIST ────────────────────────────────────────────────────────────

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

// ─── GENRES ──────────────────────────────────────────────────────────────────

export async function getFavoriteGenres() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GENRES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveFavoriteGenres(genres) {
  await AsyncStorage.setItem(KEYS.GENRES, JSON.stringify(genres));
}

// ─── STREAK ──────────────────────────────────────────────────────────────────

export async function getStreak() {
  try {
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
    return newStreak;
  } catch { return 1; }
}

// ─── RATINGS ─────────────────────────────────────────────────────────────────

export async function getRatings() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RATINGS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveRating(title, rating) {
  const ratings = await getRatings();
  const updated = [{ title, rating, date: new Date().toISOString() }, ...ratings.filter(r => r.title !== title)];
  await AsyncStorage.setItem(KEYS.RATINGS, JSON.stringify(updated));
  return updated;
}

export async function removeRating(title) {
  const ratings = await getRatings();
  const updated = ratings.filter(r => r.title !== title);
  await AsyncStorage.setItem(KEYS.RATINGS, JSON.stringify(updated));
  return updated;
}

export async function getRatingSummary() {
  const ratings = await getRatings();
  return {
    loved:    ratings.filter(r => r.rating === 'loved').map(r => r.title),
    liked:    ratings.filter(r => r.rating === 'liked').map(r => r.title),
    disliked: ratings.filter(r => r.rating === 'disliked').map(r => r.title),
  };
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────

export async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addToHistory(entry) {
  const history = await getHistory();
  const updated = [entry, ...history].slice(0, 200);
  await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
  if (entry.title) await addToWatchedList(entry.title);
  return updated;
}

export async function clearHistory() {
  await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify([]));
}

// ─── WATCH LATER ─────────────────────────────────────────────────────────────

export async function getWatchLater() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATCH_LATER);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addToWatchLater(entry) {
  const list = await getWatchLater();
  if (list.find(i => i.title === entry.title)) return list;
  const updated = [entry, ...list];
  await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify(updated));
  return updated;
}

export async function removeFromWatchLater(title) {
  const list = await getWatchLater();
  const updated = list.filter(i => i.title !== title);
  await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify(updated));
  return updated;
}

export async function clearWatchLater() {
  await AsyncStorage.setItem(KEYS.WATCH_LATER, JSON.stringify([]));
}

export async function isInWatchLater(title) {
  const list = await getWatchLater();
  return list.some(i => i.title === title);
}

// ─── AVOID LIST ──────────────────────────────────────────────────────────────

export async function getCombinedAvoidList() {
  const [watched, history] = await Promise.all([getWatchedList(), getHistory()]);
  const historyTitles = history.map(h => h.title).filter(Boolean);
  return [...new Set([...watched, ...historyTitles])];
}

// ─── MILESTONES ──────────────────────────────────────────────────────────────

export async function getMilestonesSeen() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MILESTONES_SEEN);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function markMilestoneSeen(id) {
  const seen = await getMilestonesSeen();
  if (!seen.includes(id)) {
    await AsyncStorage.setItem(KEYS.MILESTONES_SEEN, JSON.stringify([...seen, id]));
  }
}

// Checks if a milestone JUST became newly unlocked (internal threshold)
// Returns the milestone object if it fired, null if not
export async function getNewlyUnlockedMilestone(streak) {
  const seen = await getMilestonesSeen();
  return MILESTONES.find(m => streak >= m.days && !seen.includes(m.id)) || null;
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
  const raw = await AsyncStorage.getItem(KEYS.MIX_HIDDEN_GEMS);
  return raw === 'true';
}

export async function setMixHiddenGems(val) {
  await AsyncStorage.setItem(KEYS.MIX_HIDDEN_GEMS, String(val));
}

// Era Lock — locks recommendations to a specific anime decade
// Value is the era string e.g. '90s', '00s', or null if not set
export async function getEraLock() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ERA_LOCK);
    return raw || null;
  } catch { return null; }
}

export async function setEraLock(era) {
  // era is a string like '70s', '80s', '90s', '00s', '10s', '20s' or null to disable
  if (era === null) {
    await AsyncStorage.removeItem(KEYS.ERA_LOCK);
  } else {
    await AsyncStorage.setItem(KEYS.ERA_LOCK, era);
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