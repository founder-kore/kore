import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import EditProfileScreen from '../EditProfileScreen';
import * as ImagePicker from 'expo-image-picker';
import {
  getCurrentUser,
  getGoogleAvatarUrl,
  getRenderableAvatarUrl,
  resolveAvatarUrl,
  updateProfile,
  uploadAvatar,
  checkUsernameAvailable,
} from '../../services/supabase';

jest.mock('../../constants/theme', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      snow: '#ffffff',
      ember: '#E8630A',
      ink: '#111111',
      chalk: '#f4f4f4',
      border: '#dddddd',
      charcoal: '#666666',
    },
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'Light',
  },
  NotificationFeedbackType: {
    Success: 'Success',
  },
}));

jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../services/supabase', () => ({
  updateProfile: jest.fn(() => Promise.resolve()),
  uploadAvatar: jest.fn(() => Promise.resolve('user-1/avatar.png')),
  checkUsernameAvailable: jest.fn(() => Promise.resolve(true)),
  getCurrentUser: jest.fn(() => Promise.resolve({ id: 'user-1' })),
  getGoogleAvatarUrl: jest.fn(() => Promise.resolve(null)),
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
}));

describe('EditProfileScreen', () => {
  const userProfile = {
    username: 'lowbie',
    display_name: 'Lowbie',
    avatar_color: '#E8630A',
    avatar_url: 'https://cdn.example.com/avatar-old.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ImagePicker.getMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://avatar.png' }],
    });
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    getGoogleAvatarUrl.mockResolvedValue(null);
    checkUsernameAvailable.mockResolvedValue(true);
  });

  test('tapping Change photo triggers the picker flow', async () => {
    const { getByText } = render(
      <EditProfileScreen onBack={jest.fn()} userProfile={userProfile} onSave={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByText('Change photo'));
    });

    await waitFor(() => {
      expect(ImagePicker.getMediaLibraryPermissionsAsync).toHaveBeenCalled();
      expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
      }));
    });
  });

  test('canceled picker does not break anything', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });

    const { getByText, queryByText } = render(
      <EditProfileScreen onBack={jest.fn()} userProfile={userProfile} onSave={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByText('Change photo'));
    });

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(queryByText('Could not open your photo library. Try again.')).toBeNull();
  });

  test('successful avatar update refreshes the displayed image', async () => {
    const onSave = jest.fn();
    const { getByText, getByTestId } = render(
      <EditProfileScreen onBack={jest.fn()} userProfile={userProfile} onSave={onSave} />
    );

    expect(getByTestId('edit-profile-avatar-image').props.source).toEqual({
      uri: 'https://cdn.example.com/avatar-old.jpg',
      cache: 'reload',
    });

    await act(async () => {
      fireEvent.press(getByText('Change photo'));
    });

    await waitFor(() => {
      expect(getByTestId('edit-profile-avatar-image').props.source).toEqual({
        uri: 'file://avatar.png',
        cache: 'reload',
      });
    });

    await act(async () => {
      fireEvent.press(getByText('Save changes'));
    });

    await waitFor(() => {
      expect(uploadAvatar).toHaveBeenCalledWith('user-1', 'file://avatar.png', 'image/png');
    });

    expect(updateProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({
      display_name: 'Lowbie',
      username: 'lowbie',
      avatar_color: '#E8630A',
      avatar_url: 'user-1/avatar.png',
    }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      avatar_url: 'https://cdn.example.com/user-1/avatar.png?signed=1',
    }));
    expect(getByTestId('edit-profile-avatar-image').props.source).toEqual({
      uri: 'https://cdn.example.com/user-1/avatar.png?signed=1',
      cache: 'reload',
    });
  });

  test('upload or profile update failure shows a controlled error instead of doing nothing', async () => {
    uploadAvatar.mockRejectedValueOnce(new Error('upload failed'));

    const { getByText } = render(
      <EditProfileScreen onBack={jest.fn()} userProfile={userProfile} onSave={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByText('Change photo'));
    });

    await act(async () => {
      fireEvent.press(getByText('Save changes'));
    });

    await waitFor(() => {
      expect(getByText('upload failed')).toBeTruthy();
    });
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
