jest.mock('../../services/supabase', () => ({
  getCloudHistory: jest.fn(),
  addToCloudHistory: jest.fn(),
  clearCloudHistory: jest.fn(),
  getCloudRatings: jest.fn(),
  saveCloudRating: jest.fn(),
  removeCloudRating: jest.fn(),
  getCloudWatchLater: jest.fn(),
  addToCloudWatchLater: jest.fn(),
  removeFromCloudWatchLater: jest.fn(),
  clearCloudWatchLater: jest.fn(),
  getCloudPreferences: jest.fn(),
  updateCloudPreferences: jest.fn(),
  getCurrentUser: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCloudPreferences, getCloudRatings } from '../../services/supabase';
import {
  MILESTONES,
  setActiveUser,
  clearActiveUser,
  clearPrefsCache,
  getEraLock,
  getNewlyUnlockedMilestone,
  getNextMilestone,
  getFavoriteGenres,
  getCombinedAvoidList,
  getRatings,
  getStreak,
  getWatchLater,
  isUnlocked,
  markMilestoneSeen,
  removeFromWatchLater,
  removeRating,
  saveRating,
  setEraLock,
  updateStreak,
  addToWatchLater,
} from '../userPrefs';

describe('userPrefs milestone helpers', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    clearActiveUser();
    clearPrefsCache();
    await AsyncStorage.clear();
  });

  test('MILESTONES contains the expected unlock ids and day thresholds', () => {
    expect(MILESTONES).toHaveLength(4);
    expect(MILESTONES.map(m => m.id)).toEqual([
      'mood_insights',
      'profile_card',
      'kore_score',
      'directors_cut',
    ]);
    expect(MILESTONES.map(m => m.days)).toEqual([7, 14, 25, 45]);
  });

  test('isUnlocked returns false at day 6 and true at milestone thresholds', () => {
    expect(isUnlocked('mood_insights', 6)).toBe(false);
    expect(isUnlocked('mood_insights', 7)).toBe(true);
    expect(isUnlocked('profile_card', 14)).toBe(true);
    expect(isUnlocked('kore_score', 25)).toBe(true);
    expect(isUnlocked('directors_cut', 45)).toBe(true);
    expect(isUnlocked('missing_milestone', 999)).toBe(false);
  });

  test('getNextMilestone returns the next pending milestone or null when complete', () => {
    expect(getNextMilestone(0)?.id).toBe('mood_insights');
    expect(getNextMilestone(7)?.id).toBe('profile_card');
    expect(getNextMilestone(24)?.id).toBe('kore_score');
    expect(getNextMilestone(45)).toBeNull();
  });

  test('getNewlyUnlockedMilestone returns null before unlock thresholds', async () => {
    await expect(getNewlyUnlockedMilestone(6)).resolves.toBeNull();
  });

  test('getNewlyUnlockedMilestone returns the expected milestone at each unlock threshold', async () => {
    await expect(getNewlyUnlockedMilestone(7)).resolves.toMatchObject({ id: 'mood_insights' });

    await AsyncStorage.setItem('kore_milestones_seen', JSON.stringify(['mood_insights']));
    await expect(getNewlyUnlockedMilestone(14)).resolves.toMatchObject({ id: 'profile_card' });

    await AsyncStorage.setItem('kore_milestones_seen', JSON.stringify(['mood_insights', 'profile_card']));
    await expect(getNewlyUnlockedMilestone(25)).resolves.toMatchObject({ id: 'kore_score' });

    await AsyncStorage.setItem('kore_milestones_seen', JSON.stringify(['mood_insights', 'profile_card', 'kore_score']));
    await expect(getNewlyUnlockedMilestone(45)).resolves.toMatchObject({ id: 'directors_cut' });
  });

  test('markMilestoneSeen stores a milestone once and prevents it from being newly unlocked again', async () => {
    await markMilestoneSeen('mood_insights');
    await markMilestoneSeen('mood_insights');

    expect(await AsyncStorage.getItem('kore_milestones_seen')).toBe(JSON.stringify(['mood_insights']));
    await expect(getNewlyUnlockedMilestone(7)).resolves.toBeNull();
  });
});

describe('userPrefs streak logic', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    clearActiveUser();
    clearPrefsCache();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('same-day updateStreak does not increment twice', async () => {
    jest.setSystemTime(new Date('2026-03-31T10:00:00.000Z'));

    await expect(updateStreak()).resolves.toBe(1);
    await expect(updateStreak()).resolves.toBe(1);
    await expect(getStreak()).resolves.toBe(1);
  });

  test('next-day updateStreak increments the streak', async () => {
    await AsyncStorage.setItem('kore_streak', '7');
    await AsyncStorage.setItem('kore_last_used', new Date('2026-03-30T10:00:00.000Z').toDateString());
    jest.setSystemTime(new Date('2026-03-31T10:00:00.000Z'));

    await expect(updateStreak()).resolves.toBe(8);
    await expect(getStreak()).resolves.toBe(8);
  });

  test('missed-day updateStreak resets the streak to 1', async () => {
    await AsyncStorage.setItem('kore_streak', '7');
    await AsyncStorage.setItem('kore_last_used', new Date('2026-03-28T10:00:00.000Z').toDateString());
    jest.setSystemTime(new Date('2026-03-31T10:00:00.000Z'));

    await expect(updateStreak()).resolves.toBe(1);
    await expect(getStreak()).resolves.toBe(1);
  });
});

describe('userPrefs ratings', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    clearActiveUser();
    clearPrefsCache();
    await AsyncStorage.clear();
  });

  test('saveRating adds a rating locally', async () => {
    const updated = await saveRating('Frieren', 'loved');

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ title: 'Frieren', rating: 'loved' });
    await expect(getRatings()).resolves.toEqual([
      expect.objectContaining({ title: 'Frieren', rating: 'loved' }),
    ]);
  });

  test('saveRating replaces an existing rating for the same title', async () => {
    await saveRating('Frieren', 'liked');
    const updated = await saveRating('Frieren', 'loved');

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ title: 'Frieren', rating: 'loved' });
  });

  test('removeRating removes a stored rating', async () => {
    await saveRating('Frieren', 'loved');
    await saveRating('Dungeon Meshi', 'liked');

    const updated = await removeRating('Frieren');

    expect(updated).toEqual([
      expect.objectContaining({ title: 'Dungeon Meshi', rating: 'liked' }),
    ]);
    await expect(getRatings()).resolves.toEqual([
      expect.objectContaining({ title: 'Dungeon Meshi', rating: 'liked' }),
    ]);
  });
});

describe('userPrefs watch later', () => {
  const watchLaterEntry = {
    title: 'Frieren',
    japanese_title: 'Sousou no Frieren',
    episode_count: 28,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    clearActiveUser();
    clearPrefsCache();
    await AsyncStorage.clear();
  });

  test('addToWatchLater stores an item locally', async () => {
    const updated = await addToWatchLater(watchLaterEntry);

    expect(updated).toEqual([watchLaterEntry]);
    await expect(getWatchLater()).resolves.toEqual([watchLaterEntry]);
  });

  test('addToWatchLater does not duplicate the same title', async () => {
    await addToWatchLater(watchLaterEntry);
    const updated = await addToWatchLater(watchLaterEntry);

    expect(updated).toEqual([watchLaterEntry]);
  });

  test('removeFromWatchLater removes a stored item', async () => {
    await addToWatchLater(watchLaterEntry);
    await addToWatchLater({ title: 'Dungeon Meshi', episode_count: 24 });

    const updated = await removeFromWatchLater('Frieren');

    expect(updated).toEqual([{ title: 'Dungeon Meshi', episode_count: 24 }]);
    await expect(getWatchLater()).resolves.toEqual([{ title: 'Dungeon Meshi', episode_count: 24 }]);
  });

  test('getCombinedAvoidList does not include watch later titles', async () => {
    await addToWatchLater(watchLaterEntry);

    await expect(getCombinedAvoidList()).resolves.toEqual([]);
  });
});

describe('userPrefs era lock', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    clearActiveUser();
    clearPrefsCache();
    await AsyncStorage.clear();
  });

  test('setEraLock stores and getEraLock returns the selected era', async () => {
    await setEraLock('90s');

    await expect(getEraLock()).resolves.toBe('90s');
  });

  test('setEraLock null clears the stored era lock', async () => {
    await setEraLock('90s');
    await setEraLock(null);

    await expect(getEraLock()).resolves.toBeNull();
  });
});

describe('userPrefs active user cache', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    clearActiveUser();
    clearPrefsCache();
    await AsyncStorage.clear();
  });

  test('clearActiveUser clears the cached cloud preferences', async () => {
    getCloudPreferences
      .mockResolvedValueOnce({ favorite_genres: ['Action'] })
      .mockResolvedValueOnce({ favorite_genres: ['Drama'] });

    setActiveUser('user-1');
    await expect(getFavoriteGenres()).resolves.toEqual(['Action']);

    clearActiveUser();
    setActiveUser('user-2');

    await expect(getFavoriteGenres()).resolves.toEqual(['Drama']);
    expect(getCloudPreferences).toHaveBeenCalledTimes(2);
  });

  test('getRatings resolves ratings for the active user only', async () => {
    getCloudRatings
      .mockResolvedValueOnce([{ title: 'User One Anime', rating: 'disliked' }])
      .mockResolvedValueOnce([{ title: 'User Two Anime', rating: 'liked' }]);

    setActiveUser('user-1');
    await expect(getRatings()).resolves.toEqual([
      { title: 'User One Anime', rating: 'disliked' },
    ]);

    clearActiveUser();
    setActiveUser('user-2');

    await expect(getRatings()).resolves.toEqual([
      { title: 'User Two Anime', rating: 'liked' },
    ]);
  });
});
