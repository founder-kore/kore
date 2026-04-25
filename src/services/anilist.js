const ANILIST_URL = 'https://graphql.anilist.co';

const QUERY = `
  query ($search: String) {
    Page(perPage: 3) {
      media(search: $search, type: ANIME, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        title { romaji english native }
        coverImage { extraLarge large medium }
        bannerImage
        startDate { year }
      }
    }
  }
`;

export async function getAnimeCoverArt(title) {
  if (!title) return null;

  const trySearch = async (term) => {
    try {
      const res = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { search: term } }),
      });
      const data = await res.json();
      return data?.data?.Page?.media?.[0] || null;
    } catch { 
      return null; 
    }
  };

  // Attempt 1: Exact Title Search
  let best = await trySearch(title);

  // Attempt 2: Aggressive Subtitle & Season Stripping
  // Removes colons, dashes, parentheses, and "Season/Part" phrasing
  if (!best) {
    let simplified = title.split(/[:\-–(]/)[0].trim();
    simplified = simplified.replace(/Season \d+/i, '').replace(/Part \d+/i, '').trim();
    
    if (simplified && simplified !== title) {
      best = await trySearch(simplified);
    }
  }

  // Attempt 3: JIKAN (MyAnimeList) API FALLBACK
  if (!best) {
    try {
      // Tiny delay to respect API limits
      await new Promise(resolve => setTimeout(resolve, 350));
      
      const cleanTitle = title.split(/[:\-–(]/)[0].trim();
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`);
      const json = await res.json();
      const jikanData = json?.data?.[0];
      
      if (jikanData) {
        const coverArt = jikanData.images?.jpg?.large_image_url || jikanData.images?.jpg?.image_url;
        return {
          cover: coverArt,
          // FIX: Jikan doesn't have banners, so we use the cover art as the banner fallback
          banner: coverArt
        };
      }
    } catch {
      return null;
    }
  }

  // If both AniList and Jikan fail (extremely rare), return null
  if (!best) return null;
  
  const coverImg = best.coverImage?.extraLarge || best.coverImage?.large;
  
  return {
    cover: coverImg,
    // FIX: If AniList doesn't have an official banner, use the high-res cover image as the banner
    banner: best.bannerImage || coverImg || null 
  };
}