import { getAnimeCoverArt } from '../anilist';

describe('anilist service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('getAnimeCoverArt returns null when title is missing', async () => {
    await expect(getAnimeCoverArt('')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('successful AniList response returns cover and banner', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        data: {
          Page: {
            media: [{
              coverImage: { extraLarge: 'cover-xl.jpg', large: 'cover-lg.jpg' },
              bannerImage: 'banner.jpg',
            }],
          },
        },
      }),
    });

    await expect(getAnimeCoverArt('Frieren')).resolves.toEqual({
      cover: 'cover-xl.jpg',
      banner: 'banner.jpg',
    });
  });

  test('AniList fallback search logic uses a simplified title when the exact search fails', async () => {
    global.fetch
      .mockResolvedValueOnce({
        json: async () => ({ data: { Page: { media: [] } } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            Page: {
              media: [{
                coverImage: { large: 'fallback-cover.jpg' },
                bannerImage: null,
              }],
            },
          },
        }),
      });

    await expect(getAnimeCoverArt('Attack on Titan: Season 2')).resolves.toEqual({
      cover: 'fallback-cover.jpg',
      banner: 'fallback-cover.jpg',
    });

    const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(firstBody.variables.search).toBe('Attack on Titan: Season 2');
    expect(secondBody.variables.search).toBe('Attack on Titan');
  });

  test('Jikan fallback returns cover and banner when AniList fails', async () => {
    jest.useFakeTimers();

    global.fetch
      .mockResolvedValueOnce({
        json: async () => ({ data: { Page: { media: [] } } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ data: { Page: { media: [] } } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: [{
            images: {
              jpg: {
                large_image_url: 'jikan-cover.jpg',
              },
            },
          }],
        }),
      });

    const promise = getAnimeCoverArt('Naruto: Shippuden');
    await jest.advanceTimersByTimeAsync(350);

    await expect(promise).resolves.toEqual({
      cover: 'jikan-cover.jpg',
      banner: 'jikan-cover.jpg',
    });

    jest.useRealTimers();
  });

  test('returns null when all cover art requests fail', async () => {
    jest.useFakeTimers();

    global.fetch
      .mockRejectedValueOnce(new Error('AniList failed'))
      .mockRejectedValueOnce(new Error('AniList fallback failed'))
      .mockRejectedValueOnce(new Error('Jikan failed'));

    const promise = getAnimeCoverArt('One Piece: Special');
    await jest.advanceTimersByTimeAsync(350);

    await expect(promise).resolves.toBeNull();

    jest.useRealTimers();
  });
});
