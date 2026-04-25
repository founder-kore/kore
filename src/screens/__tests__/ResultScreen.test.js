import React from 'react';
import { act } from '@testing-library/react-native';
import { render, waitFor } from '@testing-library/react-native';
import ResultScreen from '../ResultScreen';
import { generateAffiliateProductsForAnime } from '../../services/claude';

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
  saveRating: jest.fn(),
  addToWatchLater: jest.fn(),
  isInWatchLater: jest.fn(() => Promise.resolve(false)),
  getRatings: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../../services/claude', () => ({
  getStreamingSearchUrl: jest.fn(() => 'https://example.com'),
  getFillerGuide: jest.fn(() => Promise.resolve(null)),
  generateAffiliateProductsForAnime: jest.fn(() => Promise.resolve({ amazon: [], cdjapan: [] })),
}));

describe('ResultScreen', () => {
  const result = {
    title: 'Frieren: Beyond Journey\'s End',
    japanese_title: 'Sousou no Frieren',
    episode_count: 28,
    release_year: 2023,
    season_count: 1,
    rating: 'PG-13',
    genre: ['Fantasy', 'Adventure'],
    synopsis: 'An elf mage reflects on time, grief, and the lives she outlives.',
    pitch: 'A reflective fantasy with emotional depth and strong character writing.',
    why_now: 'You want something thoughtful without losing momentum.',
    streaming: ['Crunchyroll'],
    dub_available: true,
    perfect_match: true,
    match_note: null,
  };

  const renderScreen = ({ props = {}, resultOverride = {} } = {}) =>
    render(
      <ResultScreen
        result={{ ...result, ...resultOverride }}
        coverArt={{ cover: null, banner: null }}
        loading={false}
        error={null}
        onBack={jest.fn()}
        onGenerateAnother={jest.fn()}
        rerollCoolingDown={false}
        rerollCount={0}
        maxRerolls={3}
        vibe="Chill"
        {...props}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    generateAffiliateProductsForAnime.mockReset();
    generateAffiliateProductsForAnime.mockResolvedValue({ amazon: [], cdjapan: [] });
  });

  test('renders the loading state', () => {
    jest.useFakeTimers();

    const { getByText, unmount } = renderScreen({
      props: {
        result: null,
        loading: true,
      },
    });

    expect(getByText('Chill mode')).toBeTruthy();
    expect(getByText('Finding something that won\'t stress you out...')).toBeTruthy();

    unmount();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  test('renders the error state', () => {
    const { getByText } = renderScreen({
      props: {
        result: null,
        error: 'Custom error message',
      },
    });

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Custom error message')).toBeTruthy();
    expect(getByText('Try again →')).toBeTruthy();
    expect(getByText('← Change my answers')).toBeTruthy();
  });

  test('renders result title and core metadata', async () => {
    const { getAllByText, getByText } = renderScreen();

    await waitFor(() => {
      expect(getAllByText('Frieren: Beyond Journey\'s End').length).toBeGreaterThan(0);
    });

    expect(getByText('Sousou no Frieren')).toBeTruthy();
    expect(getByText('2023')).toBeTruthy();
    expect(getByText('28 eps')).toBeTruthy();
    expect(getByText('PG-13')).toBeTruthy();
    expect(getByText('Dub ✓')).toBeTruthy();
    expect(getByText('Watch on')).toBeTruthy();
    expect(getByText('Crunchyroll')).toBeTruthy();
  });

  test('renders the rating section correctly', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Already watched this? Rate it')).toBeTruthy();
    });

    expect(getByText('Loved it')).toBeTruthy();
    expect(getByText('Liked it')).toBeTruthy();
    expect(getByText('Not for me')).toBeTruthy();
  });

  test('renders the save for later button', async () => {
    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('Save for later')).toBeTruthy();
    });
  });

  test('does not show the affiliate section when no affiliate perks are unlocked', async () => {
    const { queryByText } = renderScreen({
      props: {
        affiliateUnlockState: { milestones_seen: [] },
      },
    });

    await waitFor(() => {
      expect(queryByText('Enhance Your Experience')).toBeNull();
    });
  });

  test('does not show the Amazon affiliate card on the result page even when Amazon Shelf is unlocked', async () => {
    generateAffiliateProductsForAnime.mockResolvedValueOnce({
      amazon: [
        { product_name: 'Frieren Manga Vol. 1', product_type: 'manga', search_query: 'Frieren manga volume 1' },
      ],
      cdjapan: [],
    });

    const { queryByText } = renderScreen({
      props: {
        affiliateUnlockState: { milestones_seen: ['directors_cut'] },
      },
    });

    await waitFor(() => {
      expect(queryByText('Related Products on Amazon')).toBeNull();
    });

    expect(queryByText('View on Amazon')).toBeNull();
    expect(queryByText('Enhance Your Experience')).toBeNull();
  });

  test('shows the CDJapan affiliate card when CDJapan is unlocked and relevant items exist', async () => {
    generateAffiliateProductsForAnime.mockResolvedValue({
      amazon: [],
      cdjapan: [
        { product_name: 'Frieren Original Soundtrack', product_type: 'soundtrack', search_query: 'Frieren original soundtrack' },
      ],
    });

    const { getByText } = renderScreen({
      props: {
        affiliateUnlockState: {
          streak: 7,
          milestones_seen: ['mood_insights'],
          cdjapanUnlocked: true,
        },
      },
    });

    await waitFor(() => {
      expect(getByText('Official Japanese Goods')).toBeTruthy();
    });

    expect(getByText('Frieren Original Soundtrack')).toBeTruthy();
    expect(getByText('View on CDJapan')).toBeTruthy();
  });

  test('does not show the CDJapan affiliate card when CDJapan is unlocked but no relevant items exist', async () => {
    generateAffiliateProductsForAnime.mockResolvedValue({
      amazon: [],
      cdjapan: [],
    });

    const { queryByText } = renderScreen({
      props: {
        affiliateUnlockState: {
          streak: 7,
          milestones_seen: ['mood_insights'],
          cdjapanUnlocked: true,
        },
      },
    });

    await waitFor(() => {
      expect(queryByText('Enhance Your Experience')).toBeNull();
    });

    expect(queryByText('Official Japanese Goods')).toBeNull();
  });

  test('does not show the NordVPN card when the anime is available in the user region', async () => {
    const { queryByText } = renderScreen({
      props: {
        affiliateUnlockState: { milestones_seen: ['kore_score'] },
        userRegion: 'US',
      },
      resultOverride: {
        availability: {
          availableRegions: ['US', 'CA'],
        },
      },
    });

    await waitFor(() => {
      expect(queryByText('Not available in your region?')).toBeNull();
    });
  });

  test('shows the NordVPN card when the anime is unavailable in the user region', async () => {
    const { getByText } = renderScreen({
      props: {
        affiliateUnlockState: { milestones_seen: ['kore_score'] },
        userRegion: 'US',
      },
      resultOverride: {
        availability: {
          availableRegions: ['JP'],
        },
      },
    });

    await waitFor(() => {
      expect(getByText('Not available in your region?')).toBeTruthy();
    });

    expect(getByText('Try NordVPN')).toBeTruthy();
  });
});
