import {
  generateMoodInsights,
  getFillerGuide,
  getRecommendation,
  getStreamingSearchUrl,
} from '../claude';

describe('claude service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('getStreamingSearchUrl builds search URLs for major platforms', () => {
    expect(getStreamingSearchUrl('Crunchyroll', 'Frieren')).toBe('https://www.crunchyroll.com/search?q=Frieren');
    expect(getStreamingSearchUrl('Netflix', 'Frieren')).toBe('https://www.netflix.com/search?q=Frieren');
    expect(getStreamingSearchUrl('HiDive', 'Frieren')).toBe('https://www.hidive.com/search#sortby=relevance&q=Frieren');
    expect(getStreamingSearchUrl('Hulu', 'Frieren')).toBe('https://www.hulu.com/search?q=Frieren');
    expect(getStreamingSearchUrl('Amazon Prime', 'Frieren')).toBe('https://www.amazon.com/s?k=Frieren+anime&i=instant-video');
    expect(getStreamingSearchUrl('Disney+', 'Frieren')).toBe('https://www.disneyplus.com/search/Frieren');
    expect(getStreamingSearchUrl('HBO Max', 'Frieren')).toBe('https://www.max.com/search?q=Frieren');
    expect(getStreamingSearchUrl('Tubi', 'Frieren')).toBe('https://tubitv.com/search/Frieren');
    expect(getStreamingSearchUrl('Peacock', 'Frieren')).toBe('https://www.peacocktv.com/search?q=Frieren');
    expect(getStreamingSearchUrl('Apple TV+', 'Frieren')).toBe('https://tv.apple.com/search?term=Frieren');
    expect(getStreamingSearchUrl('Unknown', 'Frieren')).toBeNull();
  });

  test('getRecommendation returns parsed API data on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          text: '{"title":"Frieren","genre":["Fantasy"]}',
        }],
      }),
    });

    await expect(getRecommendation({
      vibe: 'Chill',
      storyType: 'Slow burn',
      sessionLength: 'A few episodes of anything',
    })).resolves.toEqual({
      title: 'Frieren',
      genre: ['Fantasy'],
    });
  });

  test('public recommendation helpers surface API failure messages', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: 'Claude API is unavailable' },
      }),
    });

    await expect(getRecommendation({
      vibe: 'Chill',
      storyType: 'Slow burn',
      sessionLength: 'A few episodes of anything',
    })).rejects.toThrow('Claude API is unavailable');
  });

  test('public recommendation helpers surface timeout errors', async () => {
    jest.useFakeTimers();

    global.fetch.mockImplementationOnce((_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }));

    const promise = getRecommendation({
      vibe: 'Chill',
      storyType: 'Slow burn',
      sessionLength: 'A few episodes of anything',
    });
    const expectation = expect(promise).rejects.toThrow('Request timed out');

    await jest.advanceTimersByTimeAsync(15000);
    await expectation;

    jest.useRealTimers();
  });

  test('public recommendation helpers normalize malformed successful responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          text: 'not-json',
        }],
      }),
    });

    await expect(generateMoodInsights({
      history: [],
      ratings: [],
      favoriteGenres: [],
      streak: 7,
    })).rejects.toThrow('Unexpected response from recommendation service');
  });

  test('public recommendation helpers normalize missing successful payload fields', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [],
      }),
    });

    await expect(getRecommendation({
      vibe: 'Chill',
      storyType: 'Slow burn',
      sessionLength: 'A few episodes of anything',
    })).rejects.toThrow('Unexpected response from recommendation service');
  });

  test('getFillerGuide returns null when the API returns null text', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          text: 'null',
        }],
      }),
    });

    await expect(getFillerGuide('Naruto', 220)).resolves.toBeNull();
  });

  test('getFillerGuide returns null on API failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));

    await expect(getFillerGuide('Naruto', 220)).resolves.toBeNull();
  });
});
