import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { getRecommendation } from './src/services/claude';
import {
  getSession,
  signOut as supabaseSignOut,
  getProfileState,
  supabase,
} from './src/services/supabase';
import {
  getWatchedList,
  getFavoriteGenres,
  getRatings,
  getStreak,
  updateStreak,
  getNewlyUnlockedMilestone,
  markMilestoneSeen,
  getEraLock,
  clearActiveUser,
} from './src/storage/userPrefs';

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('./src/services/claude', () => ({
  getRecommendation: jest.fn(() => Promise.resolve({ title: 'Mock Recommendation' })),
}));

jest.mock('./src/services/anilist', () => ({
  getAnimeCoverArt: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('./src/services/supabase', () => ({
  getSession: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  getProfileState: jest.fn(),
  getRenderableAvatarUrl: jest.fn((value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return null;
    if (/^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|data:)/i.test(normalized)) {
      return normalized;
    }
    return `https://cdn.example.com/${normalized}`;
  }),
  resolveAvatarUrl: jest.fn(async (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return null;
    if (/^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|data:)/i.test(normalized)) {
      return normalized;
    }
    return `https://cdn.example.com/${normalized}?signed=1`;
  }),
  updateProfile: jest.fn(() => Promise.resolve()),
  createPreferences: jest.fn(() => Promise.resolve()),
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(),
    },
  },
}));

jest.mock('./src/storage/userPrefs', () => ({
  getWatchedList: jest.fn(),
  getFavoriteGenres: jest.fn(),
  getRatings: jest.fn(() => Promise.resolve([])),
  getStreak: jest.fn(),
  updateStreak: jest.fn(),
  addToHistory: jest.fn(() => Promise.resolve()),
  getCombinedAvoidList: jest.fn(() => Promise.resolve([])),
  getNewlyUnlockedMilestone: jest.fn(),
  markMilestoneSeen: jest.fn(() => Promise.resolve()),
  getDirectorsCutMode: jest.fn(() => Promise.resolve(false)),
  getMixHiddenGems: jest.fn(() => Promise.resolve(false)),
  getEraLock: jest.fn(() => Promise.resolve(null)),
  setActiveUser: jest.fn(),
  clearActiveUser: jest.fn(),
}));

jest.mock('./src/screens/LandingScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockLandingScreen({ onGetStarted }) {
    return (
      <View>
        <Text>LANDING_SCREEN</Text>
        <TouchableOpacity onPress={onGetStarted}>
          <Text>LANDING_GET_STARTED</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/AuthScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockAuthScreen({ onAuthSuccess, onContinueAsGuest, startAtProfile }) {
    return (
      <View>
        <Text>{startAtProfile ? 'AUTH_PROFILE_SETUP' : 'AUTH_SCREEN'}</Text>
        <TouchableOpacity onPress={onAuthSuccess}>
          <Text>AUTH_SUCCESS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onContinueAsGuest}>
          <Text>CONTINUE_AS_GUEST</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/OnboardingScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockOnboardingScreen({ onDone }) {
    return (
      <View>
        <Text>ONBOARDING_SCREEN</Text>
        <TouchableOpacity onPress={onDone}>
          <Text>ONBOARDING_DONE</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/HomeScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockHomeScreen(props) {
    return (
      <View>
        <Text>HOME_SCREEN</Text>
        <Text>HOME_STREAK:{props.streak}</Text>
        <TouchableOpacity onPress={() => props.onSubmit({ vibe: 'Chill', storyType: 'Slow burn', commitment: 'A few episodes of anything' })}>
          <Text>HOME_SUBMIT</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={props.onOpenProfile}>
          <Text>OPEN_PROFILE</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={props.onOpenHistory}>
          <Text>OPEN_HISTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={props.onOpenWatchLater}>
          <Text>OPEN_WATCHLATER</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/ProfileScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockProfileScreen({ onBack, onSignOut, userProfile, streak, onEdit, setAffiliateRewardType, navigateTo }) {
    return (
      <View>
        <Text>PROFILE_SCREEN</Text>
        <Text>PROFILE_STREAK:{streak}</Text>
        <Text>PROFILE_USER:{userProfile?.username || 'none'}</Text>
        <Text>PROFILE_AVATAR:{userProfile?.avatar_url || 'none'}</Text>
        <TouchableOpacity onPress={onBack}>
          <Text>PROFILE_BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit}>
          <Text>PROFILE_EDIT</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setAffiliateRewardType?.('cdjapan');
          navigateTo?.('affiliate_reward');
        }}>
          <Text>PROFILE_OPEN_AFFILIATE</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSignOut}>
          <Text>PROFILE_SIGN_OUT</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/HistoryScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockHistoryScreen({ onSelectAnime }) {
    return (
      <View>
        <Text>HISTORY_SCREEN</Text>
        <TouchableOpacity onPress={() => onSelectAnime({ title: 'History Anime', cover: null, banner: null })}>
          <Text>SELECT_HISTORY_ANIME</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/WatchLaterScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockWatchLaterScreen({ onSelectAnime }) {
    return (
      <View>
        <Text>WATCHLATER_SCREEN</Text>
        <TouchableOpacity onPress={() => onSelectAnime({ title: 'Watch Later Anime', cover: null, banner: null })}>
          <Text>SELECT_WATCHLATER_ANIME</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/ResultScreen', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockResultScreen({ result, isDetailView, loading, error }) {
    return (
      <View>
        <Text>{isDetailView ? 'DETAIL_VIEW' : 'RESULT_SCREEN'}</Text>
        <Text>RESULT_TITLE:{result?.title || 'none'}</Text>
        <Text>RESULT_LOADING:{String(loading)}</Text>
        <Text>RESULT_ERROR:{error || 'none'}</Text>
      </View>
    );
  };
});

jest.mock('./src/screens/MilestoneCelebrationScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockMilestoneCelebrationScreen({ milestone, onContinue }) {
    return (
      <View>
        <Text>MILESTONE_SCREEN</Text>
        <Text>MILESTONE_ID:{milestone?.id}</Text>
        <TouchableOpacity onPress={() => onContinue('mood_insights')}>
          <Text>CONTINUE_MOOD_INSIGHTS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onContinue('profile_card')}>
          <Text>CONTINUE_PROFILE_CARD</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onContinue('kore_score')}>
          <Text>CONTINUE_KORE_SCORE</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onContinue('era_lock')}>
          <Text>CONTINUE_ERA_LOCK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onContinue('mood_insights_and_cdjapan')}>
          <Text>CONTINUE_AFFILIATE_BUNDLE</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onContinue('nordvpn')}>
          <Text>CONTINUE_AFFILIATE_NORDVPN</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onContinue('home_only')}>
          <Text>CONTINUE_HOME_ONLY</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/MoodInsightsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockMoodInsightsScreen() {
    return <Text>MOOD_INSIGHTS_SCREEN</Text>;
  };
});

jest.mock('./src/screens/KoreScoreScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockKoreScoreScreen() {
    return <Text>KORE_SCORE_SCREEN</Text>;
  };
});

jest.mock('./src/screens/ProfileCardScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockProfileCardScreen() {
    return <Text>PROFILE_CARD_SCREEN</Text>;
  };
});

jest.mock('./src/screens/AffiliateRewardScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockAffiliateRewardScreen({ type, onBack }) {
    return (
      <View>
        <Text>AFFILIATE_REWARD_SCREEN:{type || 'none'}</Text>
        <TouchableOpacity onPress={onBack}>
          <Text>AFFILIATE_BACK</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('./src/screens/EraLockScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockEraLockScreen() {
    return <Text>ERA_LOCK_SCREEN</Text>;
  };
});

jest.mock('./src/screens/AmazonShelfScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockAmazonShelfScreen() {
    return <Text>AMAZON_SHELF_SCREEN</Text>;
  };
});

jest.mock('./src/screens/EditProfileScreen', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockEditProfileScreen({ onBack, onSave, userProfile }) {
    return (
      <View>
        <Text>EDIT_PROFILE_SCREEN</Text>
        <TouchableOpacity onPress={onBack}>
          <Text>EDIT_PROFILE_BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onSave?.({
          ...(userProfile || {}),
          username: 'updated-user',
          avatar_url: 'https://cdn.example.com/edited-avatar.jpg?t=1',
        })}>
          <Text>EDIT_PROFILE_SAVE</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

const defaultSession = null;
const authSubscription = { unsubscribe: jest.fn() };
let authStateChangeHandler;
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const validProfileState = (profile = { username: 'lowbie' }) => ({
  profile,
  missing: false,
});

describe('App integration flows', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    authStateChangeHandler = null;
    supabase.auth.onAuthStateChange.mockImplementation((handler) => {
      authStateChangeHandler = handler;
      return {
        data: { subscription: authSubscription },
      };
    });

    getSession.mockResolvedValue(defaultSession);
    getProfileState.mockResolvedValue(validProfileState());
    getWatchedList.mockResolvedValue([]);
    getFavoriteGenres.mockResolvedValue([]);
    getRatings.mockResolvedValue([]);
    getStreak.mockResolvedValue(0);
    updateStreak.mockResolvedValue(1);
    getNewlyUnlockedMilestone.mockResolvedValue(null);
    getEraLock.mockResolvedValue(null);
  });

  test('initializes to landing on first launch when not onboarded and not authenticated', async () => {
    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('LANDING_SCREEN')).toBeTruthy();
    });
  });

  test('initializes to home for an onboarded guest', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });
  });

  test('initializes to home for a signed-in onboarded user', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockResolvedValue(validProfileState());
    getStreak.mockResolvedValue(12);

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    expect(getByText('HOME_STREAK:12')).toBeTruthy();
  });

  test('signed-in user with a missing profile row routes to auth profile setup', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockResolvedValue({ profile: null, missing: true });

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('AUTH_PROFILE_SETUP')).toBeTruthy();
    });

    expect(getProfileState).toHaveBeenCalledTimes(1);
  });

  test('signed-in user with a blank username routes to auth profile setup', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockResolvedValue(validProfileState({ username: '   ' }));

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('AUTH_PROFILE_SETUP')).toBeTruthy();
    });
  });

  test('signed-in user with a valid profile but not onboarded routes to onboarding', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockResolvedValue(validProfileState({ username: 'lowbie' }));

    const { getByText, queryByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('ONBOARDING_SCREEN')).toBeTruthy();
    });

    expect(queryByText('AUTH_PROFILE_SETUP')).toBeNull();
  });

  test('signed-in user with a transient profile fetch failure on the auth path routes quickly without auth profile setup', async () => {
    jest.useFakeTimers();
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockImplementation(() => new Promise(() => {}));

    const { getByText, queryByText } = render(<App />);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(800);
    });

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    expect(queryByText('AUTH_PROFILE_SETUP')).toBeNull();
    expect(getProfileState).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('signed-in user on auth path does not wait through two long profile timeouts before routing', async () => {
    jest.useFakeTimers();
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockImplementation(() => new Promise(() => {}));

    const { queryByText, getByText } = render(<App />);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(700);
    });

    expect(queryByText('HOME_SCREEN')).toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    expect(getProfileState).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('SIGNED_IN routes using the actual new session instead of a stale persisted session', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    await AsyncStorage.setItem('kore_has_launched', 'true');
    getSession.mockResolvedValue(null);
    getProfileState.mockImplementation(async (userId) => {
      if (userId === 'new-google-user') {
        return validProfileState({ username: 'googleuser' });
      }
      return { profile: null, missing: true };
    });
    getStreak.mockResolvedValue(5);

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('AUTH_SCREEN')).toBeTruthy();
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', {
        user: {
          id: 'new-google-user',
          user_metadata: { avatar_url: 'https://example.com/google-avatar.jpg' },
        },
      });
    });

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    expect(getByText('HOME_STREAK:5')).toBeTruthy();
    expect(getProfileState).toHaveBeenCalledWith('new-google-user');
  });

  test('duplicate SIGNED_IN events for the same user do not re-run hydration in parallel', async () => {
    let resolveProfile;
    await AsyncStorage.setItem('kore_onboarded', 'true');
    await AsyncStorage.setItem('kore_has_launched', 'true');
    getSession.mockResolvedValue(null);
    getProfileState.mockImplementationOnce(() => new Promise((resolve) => {
      resolveProfile = resolve;
    }));

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('AUTH_SCREEN')).toBeTruthy();
    });

    await act(async () => {
      authStateChangeHandler?.('SIGNED_IN', { user: { id: 'same-user' } });
      authStateChangeHandler?.('SIGNED_IN', { user: { id: 'same-user' } });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getProfileState).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveProfile(validProfileState({ username: 'sameuser' }));
    });

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });
  });

  test('stale background hydration results do not overwrite the current user state', async () => {
    const firstStreak = deferred();
    const secondStreak = deferred();

    await AsyncStorage.setItem('kore_onboarded', 'true');
    await AsyncStorage.setItem('kore_has_launched', 'true');
    getSession.mockResolvedValue(null);
    getProfileState.mockResolvedValue(validProfileState({ username: 'active-user' }));
    getWatchedList.mockResolvedValue([]);
    getFavoriteGenres.mockResolvedValue([]);
    getStreak
      .mockImplementationOnce(() => firstStreak.promise)
      .mockImplementationOnce(() => secondStreak.promise);

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('AUTH_SCREEN')).toBeTruthy();
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', { user: { id: 'user-a' } });
    });

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    await act(async () => {
      await authStateChangeHandler?.('SIGNED_IN', { user: { id: 'user-b' } });
    });

    await act(async () => {
      secondStreak.resolve(9);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByText('HOME_STREAK:9')).toBeTruthy();
    });

    await act(async () => {
      firstStreak.resolve(99);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByText('HOME_STREAK:9')).toBeTruthy();
    });
  });

  test('handleAuthSuccess retries until session settles for email auth', async () => {
    jest.useFakeTimers();
    await AsyncStorage.setItem('kore_has_launched', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');

    getSession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ user: { id: 'email-user' } });
    getProfileState.mockResolvedValue(validProfileState({ username: 'emailuser' }));
    getStreak.mockResolvedValue(3);

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('AUTH_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('AUTH_SUCCESS'));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    expect(getByText('HOME_STREAK:3')).toBeTruthy();
    jest.useRealTimers();
  });

  test('completing onboarding routes to home', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('ONBOARDING_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('ONBOARDING_DONE'));

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });
  });

  test('submitting from home routes to milestone when a milestone is pending', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(7);
    getNewlyUnlockedMilestone.mockResolvedValue({
      id: 'mood_insights',
      days: 7,
      displayDays: 7,
      rewardType: 'mood_insights',
    });

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('HOME_SUBMIT'));

    await waitFor(() => {
      expect(getByText('MILESTONE_SCREEN')).toBeTruthy();
    });

    expect(markMilestoneSeen).toHaveBeenCalledWith('mood_insights');
  });

  test('handleMilestoneContinue routes to mood insights', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(7);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'mood_insights', days: 7, displayDays: 7 });

    const { getByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_MOOD_INSIGHTS'));

    await waitFor(() => {
      expect(getByText('MOOD_INSIGHTS_SCREEN')).toBeTruthy();
    });
  });

  test('handleMilestoneContinue routes to profile card', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(14);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'profile_card', days: 14, displayDays: 14 });

    const { getByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_PROFILE_CARD'));

    await waitFor(() => {
      expect(getByText('PROFILE_CARD_SCREEN')).toBeTruthy();
    });
  });

  test('profile card back to home does not trigger saved anime generation', async () => {
    jest.useFakeTimers();
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(14);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'profile_card', days: 14, displayDays: 14 });

    const { getByText, queryByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_HOME_ONLY'));
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());

    await jest.advanceTimersByTimeAsync(500);
    expect(queryByText('RESULT_SCREEN')).toBeNull();
    expect(getRecommendation).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('handleMilestoneContinue routes to kore score', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(25);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'kore_score', days: 25, displayDays: 30 });

    const { getByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_KORE_SCORE'));

    await waitFor(() => {
      expect(getByText('KORE_SCORE_SCREEN')).toBeTruthy();
    });
  });

  test('handleMilestoneContinue routes to era lock', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(45);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'directors_cut', days: 45, displayDays: 60 });

    const { getByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_ERA_LOCK'));

    await waitFor(() => {
      expect(getByText('ERA_LOCK_SCREEN')).toBeTruthy();
    });
  });

  test('handleMilestoneContinue routes to cdjapan affiliate reward', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(7);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'mood_insights', days: 7, displayDays: 7 });

    const { getByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_AFFILIATE_BUNDLE'));

    await waitFor(() => {
      expect(getByText('AFFILIATE_REWARD_SCREEN:cdjapan')).toBeTruthy();
    });
  });

  test('handleMilestoneContinue routes to nordvpn affiliate reward', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(25);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'kore_score', days: 25, displayDays: 30 });

    const { getByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_AFFILIATE_NORDVPN'));

    await waitFor(() => {
      expect(getByText('AFFILIATE_REWARD_SCREEN:nordvpn')).toBeTruthy();
    });
  });

  test('affiliate reward back returns to the milestone context', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    updateStreak.mockResolvedValue(25);
    getNewlyUnlockedMilestone.mockResolvedValue({ id: 'kore_score', days: 25, displayDays: 30 });

    const { getByText } = render(<App />);
    await waitFor(() => expect(getByText('HOME_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('HOME_SUBMIT'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('CONTINUE_AFFILIATE_NORDVPN'));
    await waitFor(() => expect(getByText('AFFILIATE_REWARD_SCREEN:nordvpn')).toBeTruthy());

    fireEvent.press(getByText('AFFILIATE_BACK'));
    await waitFor(() => expect(getByText('MILESTONE_SCREEN')).toBeTruthy());
  });

  test('back navigation returns to the previous screen instead of always routing home', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockResolvedValue(validProfileState({ username: 'lowbie' }));

    const { getByText, queryByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('OPEN_PROFILE'));
    await waitFor(() => expect(getByText('PROFILE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('PROFILE_OPEN_AFFILIATE'));
    await waitFor(() => expect(getByText('AFFILIATE_REWARD_SCREEN:cdjapan')).toBeTruthy());

    fireEvent.press(getByText('AFFILIATE_BACK'));
    await waitFor(() => expect(getByText('PROFILE_SCREEN')).toBeTruthy());

    expect(queryByText('HOME_SCREEN')).toBeNull();
  });

  test('returning from Edit Profile refreshes the profile avatar', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState
      .mockResolvedValueOnce(validProfileState({ username: 'lowbie', avatar_url: null }))
      .mockResolvedValueOnce(validProfileState({
        username: 'updated-user',
        avatar_url: 'https://cdn.example.com/fresh-avatar.jpg?t=2',
      }));

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('OPEN_PROFILE'));
    await waitFor(() => expect(getByText('PROFILE_SCREEN')).toBeTruthy());
    expect(getByText('PROFILE_AVATAR:none')).toBeTruthy();

    fireEvent.press(getByText('PROFILE_EDIT'));
    await waitFor(() => expect(getByText('EDIT_PROFILE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('EDIT_PROFILE_SAVE'));

    await waitFor(() => expect(getByText('PROFILE_SCREEN')).toBeTruthy());
    expect(getByText('PROFILE_AVATAR:https://cdn.example.com/fresh-avatar.jpg?t=2')).toBeTruthy();
    expect(getByText('PROFILE_USER:updated-user')).toBeTruthy();
  });

  test('returning from Edit Profile keeps a renderable avatar URL when the fetched profile row has a storage path', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState
      .mockResolvedValueOnce(validProfileState({ username: 'lowbie', avatar_url: null }))
      .mockResolvedValueOnce(validProfileState({
        username: 'updated-user',
        avatar_url: 'user-1/avatar.jpg',
      }));

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('OPEN_PROFILE'));
    await waitFor(() => expect(getByText('PROFILE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('PROFILE_EDIT'));
    await waitFor(() => expect(getByText('EDIT_PROFILE_SCREEN')).toBeTruthy());

    fireEvent.press(getByText('EDIT_PROFILE_SAVE'));

    await waitFor(() => expect(getByText('PROFILE_SCREEN')).toBeTruthy());
    expect(getByText('PROFILE_AVATAR:https://cdn.example.com/user-1/avatar.jpg?signed=1')).toBeTruthy();
  });

  test('selecting anime from history opens detail view', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('OPEN_HISTORY'));
    await waitFor(() => expect(getByText('HISTORY_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('SELECT_HISTORY_ANIME'));

    await waitFor(() => {
      expect(getByText('DETAIL_VIEW')).toBeTruthy();
    });

    expect(getByText('RESULT_TITLE:History Anime')).toBeTruthy();
  });

  test('selecting anime from watch later opens detail view', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('OPEN_WATCHLATER'));
    await waitFor(() => expect(getByText('WATCHLATER_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('SELECT_WATCHLATER_ANIME'));

    await waitFor(() => {
      expect(getByText('DETAIL_VIEW')).toBeTruthy();
    });

    expect(getByText('RESULT_TITLE:Watch Later Anime')).toBeTruthy();
  });

  test('sign out resets user state and routes to auth', async () => {
    await AsyncStorage.setItem('kore_onboarded', 'true');
    await AsyncStorage.setItem('kore_streak', '12');
    await AsyncStorage.setItem('kore_history', '[]');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState.mockResolvedValue(validProfileState());
    getStreak.mockResolvedValue(12);

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('OPEN_PROFILE'));
    await waitFor(() => expect(getByText('PROFILE_SCREEN')).toBeTruthy());
    fireEvent.press(getByText('PROFILE_SIGN_OUT'));

    await waitFor(() => {
      expect(getByText('AUTH_SCREEN')).toBeTruthy();
    });

    expect(supabaseSignOut).toHaveBeenCalled();
    expect(clearActiveUser).toHaveBeenCalled();
    await expect(AsyncStorage.getItem('kore_streak')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('kore_history')).resolves.toBeNull();
  });

  test('after profile setup completes, the same user does not return to auth profile setup on next login', async () => {
    await AsyncStorage.setItem('kore_has_launched', 'true');
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    getProfileState
      .mockResolvedValueOnce({ profile: null, missing: true })
      .mockResolvedValueOnce(validProfileState({ username: 'lowbie' }))
      .mockResolvedValueOnce(validProfileState({ username: 'lowbie' }));

    const { getByText, unmount } = render(<App />);

    await waitFor(() => {
      expect(getByText('AUTH_PROFILE_SETUP')).toBeTruthy();
    });

    fireEvent.press(getByText('AUTH_SUCCESS'));

    await waitFor(() => {
      expect(getByText('ONBOARDING_SCREEN')).toBeTruthy();
    });

    unmount();

    await AsyncStorage.setItem('kore_onboarded', 'true');

    const secondRender = render(<App />);

    await waitFor(() => {
      expect(secondRender.getByText('HOME_SCREEN')).toBeTruthy();
    });

    expect(secondRender.queryByText('AUTH_PROFILE_SETUP')).toBeNull();
  });

  test('rated not-for-me anime are filtered out before showing the final recommendation', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getRatings.mockResolvedValue([
      { title: 'Rejected Anime', rating: 'disliked' },
    ]);
    getRecommendation
      .mockResolvedValueOnce({ title: 'Rejected Anime' })
      .mockResolvedValueOnce({ title: 'Fresh Anime' });

    const { getByText, queryByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('HOME_SUBMIT'));

    await waitFor(() => {
      expect(getByText('RESULT_TITLE:Fresh Anime')).toBeTruthy();
    });

    expect(queryByText('RESULT_TITLE:Rejected Anime')).toBeNull();
    expect(getRecommendation).toHaveBeenCalledTimes(2);
    expect(getRecommendation).toHaveBeenNthCalledWith(1, expect.objectContaining({
      avoidList: expect.stringContaining('Rejected Anime'),
    }));
    expect(getRecommendation).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sessionAvoidList: expect.stringContaining('Rejected Anime'),
    }));
  });

  test('all rated titles, including liked and loved, are filtered out from recommendations', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getRatings.mockResolvedValue([
      { title: 'Loved Anime', rating: 'loved' },
      { title: 'Liked Anime', rating: 'liked' },
    ]);
    getRecommendation
      .mockResolvedValueOnce({ title: 'Loved Anime' })
      .mockResolvedValueOnce({ title: 'Liked Anime' })
      .mockResolvedValueOnce({ title: 'Fresh Anime' });

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('HOME_SUBMIT'));

    await waitFor(() => {
      expect(getByText('RESULT_TITLE:Fresh Anime')).toBeTruthy();
    });

    expect(getRecommendation).toHaveBeenCalledTimes(3);
    expect(getRecommendation).toHaveBeenNthCalledWith(1, expect.objectContaining({
      avoidList: expect.stringContaining('Loved Anime'),
    }));
    expect(getRecommendation).toHaveBeenNthCalledWith(1, expect.objectContaining({
      avoidList: expect.stringContaining('Liked Anime'),
    }));
  });

  test('recommendation filtering only excludes titles present in the current user ratings', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getRatings.mockResolvedValue([
      { title: 'Current User Reject', rating: 'disliked' },
    ]);
    getRecommendation.mockResolvedValueOnce({ title: 'Another User Title' });

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('HOME_SUBMIT'));

    await waitFor(() => {
      expect(getByText('RESULT_TITLE:Another User Title')).toBeTruthy();
    });

    expect(getRecommendation).toHaveBeenCalledTimes(1);
  });

  test('recommendation filtering stops safely after too many rated-title rerolls', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    await AsyncStorage.setItem('kore_onboarded', 'true');
    getRatings.mockResolvedValue([
      { title: 'Blocked Anime', rating: 'disliked' },
    ]);
    getRecommendation.mockResolvedValue({ title: 'Blocked Anime' });

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText('HOME_SCREEN')).toBeTruthy();
    });

    fireEvent.press(getByText('HOME_SUBMIT'));

    await waitFor(() => {
      expect(getByText('RESULT_ERROR:Could not find a fresh recommendation outside your rated titles. Please try again.')).toBeTruthy();
    });

    expect(getRecommendation).toHaveBeenCalledTimes(5);
  });
});
