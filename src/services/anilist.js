const ANILIST_URL = 'https://graphql.anilist.co';

export async function getAnimeCoverArt(title) {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          title { romaji english }
          coverImage { extraLarge large }
          bannerImage
        }
      }
    `;
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: title } }),
    });
    const data = await response.json();
    const media = data?.data?.Media;
    if (!media) return null;
    return {
      // Always prefer extraLarge for best quality — large only as fallback
      cover: media.coverImage?.extraLarge || media.coverImage?.large || null,
      banner: media.bannerImage || null,
    };
  } catch {
    return null;
  }
}