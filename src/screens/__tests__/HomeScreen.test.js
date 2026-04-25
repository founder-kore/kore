import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../HomeScreen';
import { getNextMilestone, isUnlocked } from '../../storage/userPrefs';

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
  getNextMilestone: jest.fn(),
  isUnlocked: jest.fn(),
}));

describe('HomeScreen', () => {
  const renderScreen = (streak = 0) =>
    render(
      <HomeScreen
        onSubmit={jest.fn()}
        onOpenProfile={jest.fn()}
        onOpenHistory={jest.fn()}
        onOpenWatchLater={jest.fn()}
        onOpenMoodInsights={jest.fn()}
        onOpenKoreScore={jest.fn()}
        onOpenProfileCard={jest.fn()}
        onOpenEraLock={jest.fn()}
        streak={streak}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    getNextMilestone.mockReturnValue({
      id: 'mood_insights',
      days: 7,
      title: 'Mood Insights',
      icon: 'x',
    });
    isUnlocked.mockReturnValue(false);
  });

  test('renders the base screen without crashing', () => {
    const { getByText } = renderScreen(0);

    expect(getByText('Kore')).toBeTruthy();
    expect(getByText('Surprise me')).toBeTruthy();
    expect(getByText('Question 1 of 3')).toBeTruthy();
  });

  test('keeps feature buttons hidden when rewards are still locked', () => {
    const { queryByText, getByText } = renderScreen(6);

    expect(getByText('1 day away')).toBeTruthy();
    expect(queryByText('Profile Card')).toBeNull();
    expect(queryByText('Kore Score')).toBeNull();
    expect(queryByText('Era Lock')).toBeNull();
  });

  test('renders milestone progress for the next reward', () => {
    getNextMilestone.mockReturnValue({
      id: 'profile_card',
      days: 14,
      title: 'Profile Card',
      icon: 'x',
    });

    const { getByText } = renderScreen(7);

    expect(getByText('Profile Card')).toBeTruthy();
    expect(getByText('7 days away')).toBeTruthy();
  });

  test('renders unlocked feature buttons when the streak is high enough', () => {
    getNextMilestone.mockReturnValue(null);
    isUnlocked.mockImplementation((id, streak) => {
      if (id === 'mood_insights') return streak >= 7;
      if (id === 'kore_score') return streak >= 25;
      return false;
    });

    const { getByText } = renderScreen(45);

    expect(getByText('Mood Insights')).toBeTruthy();
    expect(getByText('Profile Card')).toBeTruthy();
    expect(getByText('Kore Score')).toBeTruthy();
    expect(getByText('Era Lock')).toBeTruthy();
  });

  test('keeps showing the streak card after the final milestone is reached', () => {
    getNextMilestone.mockReturnValue(null);
    isUnlocked.mockImplementation((id, streak) => {
      if (id === 'mood_insights') return streak >= 7;
      if (id === 'kore_score') return streak >= 25;
      return false;
    });

    const { getByText } = renderScreen(61);

    expect(getByText('Current streak')).toBeTruthy();
    expect(getByText('61 days and climbing')).toBeTruthy();
  });

  test('does not render Amazon affiliate placements on the home screen', () => {
    getNextMilestone.mockReturnValue(null);
    isUnlocked.mockImplementation((id, streak) => {
      if (id === 'mood_insights') return streak >= 7;
      if (id === 'kore_score') return streak >= 25;
      return false;
    });

    const { queryByText } = renderScreen(61);

    expect(queryByText('Amazon Shelf')).toBeNull();
    expect(queryByText('Your Anime Shelf')).toBeNull();
    expect(queryByText('View on Amazon')).toBeNull();
  });
});
