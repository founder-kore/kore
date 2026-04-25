import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AuthScreen from '../AuthScreen';
import { signIn, signInWithGoogle, checkUsernameAvailable, getGoogleAvatarUrl, upsertProfile } from '../../services/supabase';

jest.mock('../../constants/theme', () => ({
  useTheme: () => ({
    colors: {
      chalk: '#fff',
      snow: '#fff',
      ink: '#111',
      charcoal: '#666',
      ember: '#f60',
    },
    isDark: false,
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('../../services/supabase', () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
  checkUsernameAvailable: jest.fn(),
  upsertProfile: jest.fn(),
  getGoogleAvatarUrl: jest.fn(),
  signInWithGoogle: jest.fn(),
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
    },
  },
}));

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    signIn.mockResolvedValue({});
    signInWithGoogle.mockResolvedValue({});
    checkUsernameAvailable.mockResolvedValue(true);
    getGoogleAvatarUrl.mockResolvedValue(null);
    upsertProfile.mockResolvedValue({});
  });

  test('shows a controlled error and stops loading if auth hydration does not settle after email sign in', async () => {
    signIn.mockResolvedValue({ session: { user: { id: 'email-user' } } });
    const onAuthSuccess = jest.fn(() => Promise.reject(new Error('Could not finish signing in. Please try again.')));
    const { getAllByText, getByPlaceholderText, getByText } = render(
      <AuthScreen onAuthSuccess={onAuthSuccess} onContinueAsGuest={jest.fn()} />
    );

    fireEvent.press(getAllByText('Sign in')[0]);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign in →'));

    await waitFor(() => {
      expect(getByText('Could not finish signing in. Please try again.')).toBeTruthy();
    });

    expect(signIn).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(onAuthSuccess).toHaveBeenCalledWith({ user: { id: 'email-user' } });
    expect(getByText('Sign in →')).toBeTruthy();
  });

  test('switches into profile mode when startAtProfile becomes true', async () => {
    const { queryByText, getByText, rerender } = render(
      <AuthScreen onAuthSuccess={jest.fn()} onContinueAsGuest={jest.fn()} startAtProfile={false} />
    );

    expect(getByText('Welcome back')).toBeTruthy();
    expect(queryByText('Set up your profile')).toBeNull();

    rerender(
      <AuthScreen
        onAuthSuccess={jest.fn()}
        onContinueAsGuest={jest.fn()}
        startAtProfile={true}
        userId="google-user"
      />
    );

    await waitFor(() => {
      expect(getByText('Set up your profile')).toBeTruthy();
    });
  });

  test('starts Google auth without directly routing through onAuthSuccess', async () => {
    signInWithGoogle.mockResolvedValue({ session: { user: { id: 'google-user' } } });
    const onAuthSuccess = jest.fn(() => Promise.resolve());
    const { getByText } = render(
      <AuthScreen onAuthSuccess={onAuthSuccess} onContinueAsGuest={jest.fn()} />
    );

    fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalled();
    });

    expect(onAuthSuccess).not.toHaveBeenCalled();
  });

  test('shows a controlled timeout error if Google auth does not trigger navigation', async () => {
    jest.useFakeTimers();
    signInWithGoogle.mockResolvedValue({});
    const onAuthSuccess = jest.fn(() => Promise.resolve());
    const { getByText } = render(
      <AuthScreen onAuthSuccess={onAuthSuccess} onContinueAsGuest={jest.fn()} />
    );

    fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalled();
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(7000);
    });

    await waitFor(() => {
      expect(getByText('Google sign in completed, but the app did not finish loading. Please try again.')).toBeTruthy();
    });

    expect(onAuthSuccess).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
