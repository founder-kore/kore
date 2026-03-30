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

  const trySearch = async (term) => {
    try {
      const res = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { search: term } }),
      });
      const data = await res.json();
      return data?.data?.Page?.media?.[0] || null;
    } catch { return null; }
  };

  // Attempt 1: Exact Title
  let best = await trySearch(title);

  // Attempt 2: Strip subtitles (Colon/Dash)
  if (!best) {
    const simplified = title.split(/[:\-–]/)[0].trim();
    if (simplified !== title) best = await trySearch(simplified);
  }

  // Attempt 3: Fuzzy Search (remove everything except alphanumeric)
  if (!best) {
    const fuzzy = title.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    best = await trySearch(fuzzy);
  }

  if (!best) return null;
  return {
    cover: best.coverImage?.extraLarge || best.coverImage?.large,
    banner: best.bannerImage || null 
  };
}
