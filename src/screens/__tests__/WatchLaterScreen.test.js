import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import WatchLaterScreen from '../WatchLaterScreen';
import { getWatchLater, removeFromWatchLater, clearWatchLater } from '../../storage/userPrefs';

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
      card: '#fafafa',
    },
  }),
}));

jest.mock('../../storage/userPrefs', () => ({
  getWatchLater: jest.fn(),
  removeFromWatchLater: jest.fn(),
  clearWatchLater: jest.fn(),
}));

describe('WatchLaterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearWatchLater.mockResolvedValue();
  });

  test('refreshes from getWatchLater after removing a single item', async () => {
    getWatchLater
      .mockResolvedValueOnce([
        { title: 'Frieren', episode_count: 28 },
        { title: 'Dungeon Meshi', episode_count: 24 },
        { title: 'Haikyu!!', episode_count: 25 },
      ])
      .mockResolvedValueOnce([
        { title: 'Dungeon Meshi', episode_count: 24 },
        { title: 'Haikyu!!', episode_count: 25 },
      ]);

    removeFromWatchLater.mockResolvedValueOnce([
      { title: 'Dungeon Meshi', episode_count: 24 },
    ]);

    const { getAllByText, getByText, queryAllByText, queryByText } = render(
      <WatchLaterScreen
        onBack={jest.fn()}
        onSelectAnime={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(getByText('Frieren')).toBeTruthy();
      expect(getByText('Dungeon Meshi')).toBeTruthy();
      expect(getByText('Haikyu!!')).toBeTruthy();
    });

    fireEvent(getAllByText('✕')[0], 'press', { stopPropagation: jest.fn() });
    fireEvent.press(getByText('Remove'));

    await waitFor(() => {
      expect(queryByText('Remove from Watch Later?')).toBeNull();
      expect(queryAllByText('Frieren')).toHaveLength(0);
    });

    expect(getByText('Dungeon Meshi')).toBeTruthy();
    expect(getByText('Haikyu!!')).toBeTruthy();
    expect(getWatchLater).toHaveBeenCalledTimes(2);
    expect(removeFromWatchLater).toHaveBeenCalledWith('Frieren');
  });
});
