import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileScreen from '../ProfileScreen';
import {
  getFavoriteGenres,
  getStreak,
  getEraLock,
} from '../../storage/userPrefs';
import {
  getCurrentUser,
  getProfileState,
  getRenderableAvatarUrl,
  resolveAvatarUrl,
} from '../../services/supabase';

jest.mock('../../constants/theme', () => ({
  useTheme: () => ({
    isDark: false,
    toggleDarkMode: jest.fn(),
    colors: {
      snow: '#ffffff',
      ember: '#E8630A',
      ink: '#111111',
      chalk: '#f4f4f4',
      border: '#dddddd',
      charcoal: '#666666',
      card: '#fafafa',
    },
  }),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: {
    DEFAULT: 'DEFAULT',
  },
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }) => <View {...props}>{children}</View>,
  };
});

jest.mock('../../storage/userPrefs', () => ({
  getFavoriteGenres: jest.fn(),
  saveFavoriteGenres: jest.fn(),
  getStreak: jest.fn(),
  isUnlocked: jest.fn(),
  getEraLock: jest.fn(),
  MILESTONES: [
    { id: 'mood_insights', days: 7 },
    { id: 'profile_card', days: 14 },
    { id: 'kore_score', days: 25 },
    { id: 'directors_cut', days: 45 },
  ],
}));

jest.mock('../../services/supabase', () => ({
  signOut: jest.fn(),
  getCurrentUser: jest.fn(() => Promise.resolve(null)),
  getProfileState: jest.fn(() => Promise.resolve({ profile: null, missing: true })),
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
  updateCloudPreferences: jest.fn(() => Promise.resolve()),
}));

describe('ProfileScreen', () => {
  const renderScreen = (props = {}) =>
    render(
      <ProfileScreen
        onBack={jest.fn()}
        onSignOut={jest.fn()}
        onEdit={jest.fn()}
        onOpenEraLock={jest.fn()}
        setAffiliateRewardType={jest.fn()}
        navigateTo={jest.fn()}
        {...props}
      />
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    getFavoriteGenres.mockResolvedValue([]);
    getStreak.mockResolvedValue(6);
    getEraLock.mockResolvedValue(null);
    getCurrentUser.mockResolvedValue(null);
    getProfileState.mockResolvedValue({ profile: null, missing: true });
  });

  test('renders guest state correctly', async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');

    const { getByText, queryByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Guest')).toBeTruthy();
    });

    expect(getByText('Data stored locally only')).toBeTruthy();
    expect(getByText('Create account →')).toBeTruthy();
    expect(queryByText('Sign out')).toBeNull();
  });

  test('renders signed-in state correctly with a mock profile', async () => {
    getStreak.mockResolvedValue(12);

    const { getByText, getByTestId, queryByTestId } = renderScreen({
      userProfile: {
        username: 'lowbie',
        display_name: 'Lowbie',
        avatar_color: '#E8630A',
        avatar_url: 'https://cdn.example.com/avatar.jpg?t=1',
        created_at: '2026-03-15T00:00:00.000Z',
      },
    });

    await waitFor(() => {
      expect(getByText('Lowbie')).toBeTruthy();
    });

    expect(getByText('@lowbie')).toBeTruthy();
    expect(getByText('🔥 12 day streak')).toBeTruthy();
    expect(getByText('🌸 March 2026')).toBeTruthy();
    expect(getByText('Sign out')).toBeTruthy();
    expect(getByTestId('profile-avatar-image').props.source).toEqual({
      uri: 'https://cdn.example.com/avatar.jpg?t=1',
      cache: 'reload',
    });
    expect(queryByTestId('profile-avatar-fallback')).toBeNull();
  });

  test('shows Era Lock as locked before the required streak', async () => {
    getStreak.mockResolvedValue(44);

    const { getByText } = renderScreen({
      userProfile: {
        username: 'lowbie',
        display_name: 'Lowbie',
      },
    });

    await waitFor(() => {
      expect(getByText('Era Lock')).toBeTruthy();
    });

    expect(getByText('Unlocks at 45 day streak')).toBeTruthy();
    expect(getByText('🔒 Locked')).toBeTruthy();
  });

  test('shows the fallback avatar only when no avatar_url exists', async () => {
    const { getByTestId, queryByTestId } = renderScreen({
      userProfile: {
        username: 'lowbie',
        display_name: 'Lowbie',
        avatar_color: '#E8630A',
        avatar_url: '',
      },
    });

    await waitFor(() => {
      expect(getByTestId('profile-avatar-fallback')).toBeTruthy();
    });

    expect(getByTestId('profile-avatar-fallback-text').props.children).toBe('LO');
    expect(queryByTestId('profile-avatar-image')).toBeNull();
  });

  test('refreshes to the latest avatar when a newer profile row is loaded', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    getProfileState.mockResolvedValue({
      profile: {
        id: 'user-1',
        username: 'lowbie',
        display_name: 'Lowbie',
        avatar_color: '#E8630A',
        avatar_url: 'https://cdn.example.com/fresh-avatar.jpg?t=2',
      },
      missing: false,
    });

    const { getByTestId, queryByTestId } = renderScreen({
      userProfile: {
        id: 'user-1',
        username: 'lowbie',
        display_name: 'Lowbie',
        avatar_color: '#E8630A',
        avatar_url: '',
      },
    });

    await waitFor(() => {
      expect(getByTestId('profile-avatar-image').props.source).toEqual({
        uri: 'https://cdn.example.com/fresh-avatar.jpg?t=2',
        cache: 'reload',
      });
    });

    expect(queryByTestId('profile-avatar-fallback')).toBeNull();
  });

  test('normalizes a storage-path avatar_url before rendering the profile image', async () => {
    const { getByTestId, queryByTestId } = renderScreen({
      userProfile: {
        username: 'lowbie',
        display_name: 'Lowbie',
        avatar_color: '#E8630A',
        avatar_url: 'user-1/avatar.jpg',
      },
    });

    await waitFor(() => {
      expect(getByTestId('profile-avatar-image').props.source).toEqual({
        uri: 'https://cdn.example.com/user-1/avatar.jpg?signed=1',
        cache: 'reload',
      });
    });

    expect(resolveAvatarUrl).toHaveBeenCalledWith('user-1/avatar.jpg', { cacheBust: true });
    expect(queryByTestId('profile-avatar-fallback')).toBeNull();
  });

  test('shows Era Lock as unlocked when the streak requirement is met', async () => {
    getStreak.mockResolvedValue(45);
    getEraLock.mockResolvedValue('90s');

    const { getByText, queryByText } = renderScreen({
      userProfile: {
        username: 'lowbie',
        display_name: 'Lowbie',
      },
    });

    await waitFor(() => {
      expect(getByText('Active: 1990s')).toBeTruthy();
    });

    expect(queryByText('🔒 Locked')).toBeNull();
  });

  test('renders the reward timeline milestone nodes', async () => {
    const { getByText, getAllByText } = renderScreen({
      userProfile: {
        username: 'lowbie',
        display_name: 'Lowbie',
      },
    });

    await waitFor(() => {
      expect(getByText('YOUR REWARDS JOURNEY')).toBeTruthy();
    });

    expect(getByText('DAY 7')).toBeTruthy();
    expect(getByText('DAY 14')).toBeTruthy();
    expect(getByText('DAY 30')).toBeTruthy();
    expect(getByText('DAY 60')).toBeTruthy();
    expect(() => getByText('DAY 25')).toThrow();
    expect(() => getByText('DAY 45')).toThrow();
    expect(getByText('Insights')).toBeTruthy();
    expect(getAllByText('Profile').length).toBeGreaterThan(0);
    expect(getByText('Score')).toBeTruthy();
    expect(getByText('Shelf')).toBeTruthy();
  });

  test('keeps Amazon Shelf on the existing profile reward path when unlocked', async () => {
    getStreak.mockResolvedValue(45);
    const navigateTo = jest.fn();

    const { getByText } = renderScreen({
      userProfile: {
        username: 'lowbie',
        display_name: 'Lowbie',
      },
      navigateTo,
    });

    await waitFor(() => {
      expect(getByText('Shelf')).toBeTruthy();
    });

    fireEvent.press(getByText('Shelf'));
    expect(navigateTo).toHaveBeenCalledWith('amazon_shelf');
  });

});
