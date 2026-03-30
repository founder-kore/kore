const ANILIST_URL = 'https://graphql.anilist.co';

const QUERY = `
  query ($search: String) {
    Page(perPage: 5) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        title { romaji english native }
        coverImage { extraLarge large medium }
        bannerImage
        startDate { year }
      }
    }
  }
`;

async function searchAniList(search) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { search } }),
  });
  const data = await res.json();
  const media = data?.data?.Page?.media;
  if (!media || media.length === 0) return null;
  const best = media[0];
  const cover = best.coverImage?.extraLarge || best.coverImage?.large || best.coverImage?.medium || null;
  if (!cover) return null;
  return { cover, banner: best.bannerImage || null };
}

export async function getAnimeCoverArt(title) {
  if (!title) return null;

  // Try original title first
  try {
    const result = await searchAniList(title);
    if (result) return result;
  } catch {}

  // Fallback: simplified title (remove subtitles after colon/dash)
  const simplified = title.split(/[:\-–]/)[0].trim();
  if (simplified !== title) {
    try {
      const result = await searchAniList(simplified);
      if (result) return result;
    } catch {}
  }

  return null;
}
