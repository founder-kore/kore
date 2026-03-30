const SYSTEM_PROMPT = `You are Kore, a precise anime recommendation engine. You recommend exactly ONE anime per request.

ABSOLUTE RESPONSE FORMAT RULE:
Return a single valid JSON object only. No markdown fences, no explanation, no preamble, no postamble. Raw JSON only.

════════════════════════════════════════
RULE 1 — AVOID LIST (HIGHEST PRIORITY — NEVER BREAK)
════════════════════════════════════════
The user will provide an AVOID LIST containing anime they have watched AND anime already recommended this session.
NEVER recommend anything on this list. This rule overrides every other rule.
Do not recommend sequels, prequels, or spin-offs of titles on the avoid list unless explicitly asked.

════════════════════════════════════════
RULE 2 — COMMITMENT / LENGTH (ABSOLUTE — NO EXCEPTIONS)
════════════════════════════════════════
"A few episodes of a short series" → UNDER 25 total episodes. Hard max: 30. NEVER 31+.
"A few episodes of anything"       → Any series length. User only watches 2–4 tonight.
"Start and finish a short series"  → UNDER 15 total episodes. Hard max: 20. NEVER 21+.
"Start a long series"              → MINIMUM 50 episodes. NEVER under 50.
BEFORE OUTPUTTING: verify episode_count satisfies the rule. If not, pick a different title.

════════════════════════════════════════
RULE 3 — VIBE AND STORY TYPE (STRICT)
════════════════════════════════════════
Both vibe AND story type must be satisfied simultaneously.

Chill → relaxed, cozy, low-stakes. NEVER intense, violent, dark.
Hype → energetic, fast, exciting. NEVER slow, melancholic, quiet.
Emotional → heavy, moving, feelings-first. NEVER comedy-first, lighthearted.
Curious → cerebral, unusual, layered. NEVER generic shounen, predictable.
Escapist → immersive world, transports you. NEVER grounded, realistic.
Social → crowd-pleasing, easy to follow. NEVER niche, confusing.

Action-packed → fights and fast pace required.
Slow burn → patient storytelling, layered character depth.
Feel-good → warm, uplifting, no tragedy.
Mind-bending → genuinely complex narrative, real twists.
Emotional gut-punch → designed to make you feel deeply.
Dark & gritty → mature themes, moral complexity.

════════════════════════════════════════
RULE 4 — PERSONALISATION
════════════════════════════════════════
Loved list → strongest signal. Match genre, tone, era, emotional register.
Disliked list → avoid the style of every title listed.
Favourite genres → default to these unless vibe points elsewhere.

════════════════════════════════════════
RULE 5 — VARIETY
════════════════════════════════════════
Never recommend the same title twice. Avoid obvious mainstream picks every time.
Vary picks across genres, eras, studios when called multiple times.

════════════════════════════════════════
RULE 6 — PLATFORMS (STRICT — DO NOT GUESS)
════════════════════════════════════════
Only list a platform if you are HIGHLY CONFIDENT the anime is licensed there.
Empty streaming list is better than a wrong one.
Allowed: Crunchyroll, Netflix, HiDive, Hulu, Amazon Prime, Disney+, HBO Max, Tubi, Peacock, Apple TV+.
NEVER include Funimation — it no longer exists.

════════════════════════════════════════
RULE 7 — SPECIAL MODES
════════════════════════════════════════
HIDDEN GEM MODE: ONLY under 500,000 AniList ratings. No Attack on Titan, Demon Slayer, Naruto, One Piece, Dragon Ball, Death Note, Fullmetal Alchemist, Sword Art Online, or any mainstream title.
DIRECTOR'S CUT MODE: manga or anime allowed. Set type field accordingly.

════════════════════════════════════════
ERA LOCK — WHEN ACTIVE (overrides era diversity in Rule 5)
════════════════════════════════════════
70s ERA: Recommend ONLY anime produced 1970–1979. Focus on foundational mecha, space opera, and classic shounen. Quality over style; the era's charm is its rawness.
80s ERA: Recommend ONLY anime produced 1980–1989. This is the golden era of OVAs, mecha, cyberpunk, and shoujo. Bold visual style and synthesiser soundtracks define it.
90s ERA: Recommend ONLY anime produced 1990–1999. The decade that defined the medium — Evangelion, Cowboy Bebop, Sailor Moon. Artistically the most experimental era.
00s ERA: Recommend ONLY anime produced 2000–2009. The post-Eva era: dark psychologicals, isekai predecessors, moe boom. Haruhi, Code Geass, Death Note.
10s ERA: Recommend ONLY anime produced 2010–2019. The streaming era — isekai explosion, peak Attack on Titan, Shounen Jump renaissance, sophisticated romcoms.
20s ERA: Recommend ONLY anime produced 2020–present. Current season or very recent. Demon Slayer movies, Jujutsu Kaisen, Frieren, Oshi no Ko territory.

════════════════════════════════════════
FINAL CHECK BEFORE RESPONDING
════════════════════════════════════════
1. Title on avoid list? → Pick something else.
2. Episode count satisfies commitment rule? → If not, pick something else.
3. Matches both vibe AND story type? → If not, pick something else.
4. Funimation in streaming list? → Remove it.
5. Era lock active but title outside that era? → Pick something else.
Only output JSON once all checks pass.`;

const MOOD_INSIGHTS_PROMPT = `You are Kore, an anime personality analyst. Generate a personalised anime personality profile based on the user's viewing patterns.

Respond ONLY with a single valid JSON object. No markdown, no explanation.

The archetype should be creative and specific — 3 to 5 words that feel like a character class or title.
The tagline should be one short poetic line in quotation marks.
The profile should be 2 to 3 sentences written directly to the user ("you") — specific, personal, not generic. Reference their actual patterns. Make it feel like something only they would get.
The hidden_pattern should be one surprising but true observation about how they watch.
The spirit_anime should be the single anime title that best defines this viewer.`;

const KORE_SCORE_PROMPT = `You are Kore, an anime personality engine. Generate a personalised RPG-style anime identity card.

Respond ONLY with a single valid JSON object. No markdown, no explanation.

The archetype must be creative and specific — not generic. Examples: "The Midnight Philosopher", "The Reluctant Shonen Hero", "The Silent World Builder", "The Genre Defector", "The Chaos Purist", "The Quiet Devastator".
The tagline should be one poetic sentence that captures their taste perfectly.
The hidden obsession should be something surprising but true.
The spirit anime should be the one title that defines them most.`;

const PROFILE_CARD_PROMPT = `You are Kore, an anime identity generator. Generate a profile card for someone who has used Kore for 14 days.

Respond ONLY with a single valid JSON object. No markdown, no explanation.

The archetype should be 3–5 words, creative and specific — a title that captures their current phase.
The tagline is one short evocative phrase, not a full sentence. Like a caption.
The profile is one sentence written to the user, specific to their patterns.
The spirit_anime is the one title that best represents their taste so far.
The serial_number should be a formatted code like "KP-2026-XXXX" where XXXX is a 4-digit number based on their data.`;

const AMAZON_SHELF_PROMPT = `You are Kore, an anime merchandise curator. Generate a personalised anime shelf of Amazon product recommendations.

Respond ONLY with a single valid JSON array. No markdown, no explanation.

Each item should be directly connected to a specific anime the user loved. Be specific — not generic anime merchandise, but the exact best product for each loved title. Prioritise manga volumes continuing past the anime, official art books, and OSTs.`;

const FILLER_PROMPT = `You are an anime filler expert. Respond ONLY with a single valid JSON object or the word null. No markdown, no explanation. Only respond with data you are highly confident about.`;

export const STREAMING_URLS = {
  'Crunchyroll': 'https://www.crunchyroll.com',
  'Netflix':     'https://www.netflix.com',
  'HiDive':      'https://www.hidive.com',
  'Hulu':        'https://www.hulu.com',
  'Amazon Prime':'https://www.amazon.com/Prime-Video',
  'Disney+':     'https://www.disneyplus.com',
  'HBO Max':     'https://www.max.com',
  'Tubi':        'https://www.tubi.tv',
  'Peacock':     'https://www.peacocktv.com',
  'Apple TV+':   'https://www.apple.com/apple-tv-plus',
};

export function getStreamingSearchUrl(platform, title) {
  const encoded = encodeURIComponent(title);
  const p = platform.toLowerCase();
  if (p.includes('crunchyroll')) return `https://www.crunchyroll.com/search?q=${encoded}`;
  if (p.includes('netflix'))     return `https://www.netflix.com/search?q=${encoded}`;
  if (p.includes('hidive'))      return `https://www.hidive.com/search#sortby=relevance&q=${encoded}`;
  if (p.includes('hulu'))        return `https://www.hulu.com/search?q=${encoded}`;
  if (p.includes('amazon'))      return `https://www.amazon.com/s?k=${encoded}+anime&i=instant-video`;
  if (p.includes('disney'))      return `https://www.disneyplus.com/search/${encoded}`;
  if (p.includes('hbo') || p.includes('max')) return `https://www.max.com/search?q=${encoded}`;
  if (p.includes('tubi'))        return `https://tubitv.com/search/${encoded}`;
  if (p.includes('peacock'))     return `https://www.peacocktv.com/search?q=${encoded}`;
  if (p.includes('apple'))       return `https://tv.apple.com/search?term=${encoded}`;
  return null;
}

// Always use the Vercel proxy — never call Anthropic directly from the client.
// The proxy verifies the shared secret before forwarding to Anthropic.
//const API_URL = typeof window !== 'undefined' && typeof window.location !== 'undefined'
//  ? '/api/claude'
//  : 'https://kore-theapp.vercel.app/api/claude';

const API_URL = 'https://kore-theapp.vercel.app/api/claude';

const HEADERS = {
  'Content-Type': 'application/json',
  'x-kore-secret': process.env.EXPO_PUBLIC_KORE_SECRET,
};

// Core API call — parses JSON response, strips any stray markdown fences
async function callClaude(systemPrompt, userMessage, maxTokens = 1000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  let response;
  try {
    response = await fetch(API_URL, {
      signal: controller.signal,
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out — please try again');
    throw e;
  }
  clearTimeout(timeoutId);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'API call failed');
  const clean = data.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── RECOMMENDATION ───────────────────────────────────────────────────────────

export async function getRecommendation({
  vibe,
  storyType,
  sessionLength,
  seriesLength,
  favoriteGenres   = 'No preference',
  avoidList        = 'None',
  sessionAvoidList = '',
  lovedList        = '',
  dislikedList     = '',
  hiddenGemMode    = false,
  directorsCutMode = false,
  eraLock          = null,
}) {
  const fullAvoidList = [
    avoidList !== 'None' ? avoidList : '',
    sessionAvoidList || '',
  ].filter(Boolean).join(', ') || 'None';

  const tasteSection = (lovedList || dislikedList) ? `
TASTE FINGERPRINT:
${lovedList    ? `Loved (strongest signal — match this energy): ${lovedList}` : ''}
${dislikedList ? `Disliked (avoid this style entirely): ${dislikedList}` : ''}` : '';

  const genreSection = favoriteGenres !== 'No preference'
    ? `Favourite genres (use unless vibe points elsewhere): ${favoriteGenres}` : '';

  const modeSection = [
    hiddenGemMode    ? 'HIDDEN GEM MODE ACTIVE: Under 500,000 AniList ratings only. No mainstream titles.' : '',
    directorsCutMode ? "DIRECTOR'S CUT MODE ACTIVE: Manga or anime both allowed." : '',
    eraLock          ? `ERA LOCK ACTIVE: ${eraLock.toUpperCase()} ONLY. Recommend exclusively from the ${eraLock} era as defined in your rules.` : '',
  ].filter(Boolean).join('\n');

  const commitment = sessionLength || seriesLength || 'A few episodes of anything';

  const userMessage = `Generate one anime recommendation. Apply ALL rules from the system prompt in order.

VIBE: ${vibe}
STORY TYPE: ${storyType}
COMMITMENT: ${commitment}
${commitment === 'Start and finish a short series' ? '⚠ HARD LIMIT: episode_count MUST be under 20. Reject any title with 21+ episodes.' : ''}
${commitment === 'A few episodes of a short series' ? '⚠ HARD LIMIT: episode_count MUST be under 30. Reject any title with 31+ episodes.' : ''}
${commitment === 'Start a long series' ? '⚠ HARD LIMIT: episode_count MUST be 50 or more. Reject any title under 50 episodes.' : ''}
${genreSection}
${tasteSection}
${modeSection}

AVOID LIST (absolute — never recommend any of these):
${fullAvoidList}

Respond with this exact JSON only — raw JSON, no markdown:
{
  "title": "string",
  "japanese_title": "string",
  "type": "anime or manga or movie",
  "genre": ["string"],
  "episode_count": number or null,
  "chapter_count": number or null,
  "release_year": number or null,
  "season_count": number or null,
  "rating": "string",
  "streaming": ["string — from allowed platforms only, never Funimation"],
  "dub_available": boolean,
  "perfect_match": boolean,
  "match_note": "string or null",
  "synopsis": "string — 2 sentences max",
  "pitch": "string — why this specific person",
  "why_now": "string — one punchy sentence"
}`.trim();

  return callClaude(SYSTEM_PROMPT, userMessage, 1000);
}

// ─── MOOD INSIGHTS ────────────────────────────────────────────────────────────

export async function generateMoodInsights({ history, ratings, favoriteGenres, streak }) {
  const lovedTitles    = ratings.filter(r => r.rating === 'loved').map(r => r.title);
  const dislikedTitles = ratings.filter(r => r.rating === 'disliked').map(r => r.title);

  const genreCount = {};
  history.forEach(h => {
    (h.genre || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
  });
  const totalGenreHits = Object.values(genreCount).reduce((a, b) => a + b, 0) || 1;
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([genre, count]) => `${genre} (${Math.round((count / totalGenreHits) * 100)}%)`);

  const moodCount = {};
  history.forEach(h => { if (h.mood) moodCount[h.mood] = (moodCount[h.mood] || 0) + 1; });
  const topMoods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([mood, count]) => `${mood} (${count}x)`);

  const userMessage = `Generate anime personality insights for this viewer.

Total picks: ${history.length}
Streak: ${streak} days
Loved: ${lovedTitles.join(', ') || 'none yet'}
Disliked: ${dislikedTitles.join(', ') || 'none'}
Top genres: ${topGenres.join(', ') || 'mixed'}
Top moods: ${topMoods.join(', ') || 'mixed'}
Favourite genres (self-reported): ${favoriteGenres.join(', ') || 'none set'}

Return ONLY this JSON:
{
  "archetype": "string — 3–5 word creative title e.g. The Midnight Philosopher",
  "tagline": "string — one poetic line in quotation marks",
  "profile": "string — 2–3 sentences written directly to the user using 'you'. Reference their actual patterns. Specific and personal.",
  "hidden_pattern": "string — one surprising but true observation about how they watch",
  "spirit_anime": "string — the one anime title that best defines this viewer"
}`;

  return callClaude(MOOD_INSIGHTS_PROMPT, userMessage, 500);
}

// ─── KORE SCORE ───────────────────────────────────────────────────────────────

export async function generateKoreScore({ history, ratings, favoriteGenres }) {
  const lovedTitles    = ratings.filter(r => r.rating === 'loved').map(r => r.title);
  const likedTitles    = ratings.filter(r => r.rating === 'liked').map(r => r.title);
  const dislikedTitles = ratings.filter(r => r.rating === 'disliked').map(r => r.title);

  const genreCount = {};
  history.forEach(h => {
    (h.genre || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
  });
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([genre, count]) => `${genre} (${count}x)`);

  const moodCount = {};
  history.forEach(h => { if (h.mood) moodCount[h.mood] = (moodCount[h.mood] || 0) + 1; });
  const topMoods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([mood, count]) => `${mood} (${count}x)`);

  const userMessage = `Generate a Kore Score RPG card for this viewer.

Total picks: ${history.length}
Loved: ${lovedTitles.join(', ') || 'none yet'}
Liked: ${likedTitles.join(', ') || 'none yet'}
Disliked: ${dislikedTitles.join(', ') || 'none yet'}
Top genres: ${topGenres.join(', ') || 'mixed'}
Top moods: ${topMoods.join(', ') || 'mixed'}
Self-reported genres: ${favoriteGenres.join(', ') || 'none set'}

Return ONLY this JSON:
{
  "archetype": "string — creative specific title",
  "tagline": "string — one poetic sentence",
  "dna": [
    { "genre": "string", "percentage": number },
    { "genre": "string", "percentage": number },
    { "genre": "string", "percentage": number },
    { "genre": "string", "percentage": number }
  ],
  "hidden_obsession": "string",
  "spirit_anime": "string",
  "level": number,
  "rank": "Newcomer or Watcher or Devotee or Legend"
}`;

  return callClaude(KORE_SCORE_PROMPT, userMessage, 800);
}

// ─── PROFILE CARD (14d) ───────────────────────────────────────────────────────

export async function generateProfileCard({ history, ratings, favoriteGenres, streak }) {
  const lovedTitles = ratings.filter(r => r.rating === 'loved').map(r => r.title);

  const genreCount = {};
  history.forEach(h => {
    (h.genre || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
  });
  const totalGenreHits = Object.values(genreCount).reduce((a, b) => a + b, 0) || 1;
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([genre, count]) => ({ genre, percentage: Math.round((count / totalGenreHits) * 100) }));

  const moodCount = {};
  history.forEach(h => { if (h.mood) moodCount[h.mood] = (moodCount[h.mood] || 0) + 1; });
  const dominantMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const serialNum = String(Math.abs(
    lovedTitles.join('').split('').reduce((acc, c) => acc + c.charCodeAt(0), streak * 100)
  )).slice(-4).padStart(4, '0');

  const userMessage = `Generate a 14-day profile card for this anime viewer.

Days active: ${streak}
Total picks: ${history.length}
Loved: ${lovedTitles.join(', ') || 'none yet'}
Top genres: ${topGenres.map(g => `${g.genre} ${g.percentage}%`).join(', ') || 'mixed'}
Dominant mood: ${dominantMood || 'varied'}
Favourite genres (self-reported): ${favoriteGenres.join(', ') || 'none set'}

This is 14 days of data — the profile should feel like an emerging identity, not a final verdict.
The archetype should capture where their taste is heading, not just where it's been.

Return ONLY this JSON:
{
  "archetype": "string — 3–5 words, a title that captures their current phase",
  "tagline": "string — one short evocative phrase, not a full sentence",
  "profile": "string — one sentence written directly to the user ('you'), specific to their patterns",
  "spirit_anime": "string — the one title that best represents their taste so far",
  "serial_number": "KP-2026-${serialNum}"
}`;

  return callClaude(PROFILE_CARD_PROMPT, userMessage, 400);
}

// ─── AMAZON SHELF ─────────────────────────────────────────────────────────────

export async function generateAmazonShelf({ lovedList, history }) {
  if (!lovedList || lovedList.length === 0) return [];

  const genreCount = {};
  history.forEach(h => {
    (h.genre || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
  });
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([g]) => g);

  const userMessage = `Generate 4–6 personalised Amazon product recommendations for an anime fan.

Their loved anime: ${lovedList.slice(0, 8).join(', ')}
Their top genres: ${topGenres.join(', ') || 'mixed'}

Rules:
- Each product MUST be directly tied to one of their loved anime
- Prioritise: manga volumes continuing past the anime, official art books, OSTs
- For long-running anime (Naruto, Bleach, One Piece): recommend later volumes they probably haven't read
- Include the specific volume number for manga (e.g. "Vinland Saga Vol. 7-12 Box Set")
- Be specific — not "anime merchandise" but the actual best product

Return ONLY a JSON array:
[
  {
    "anime_title": "string — which loved anime this is for",
    "product_name": "string — specific product name with volume/edition if applicable",
    "product_type": "manga_volumes or art_book or ost or figure or other",
    "reason": "string — one sentence, why this specifically for someone who loved that anime",
    "amazon_search": "string — exact search query to find it on Amazon e.g. 'Vinland Saga Volume 7 manga'"
  }
]`;

  return callClaude(AMAZON_SHELF_PROMPT, userMessage, 800);
}

// ─── FILLER GUIDE ─────────────────────────────────────────────────────────────

export async function getFillerGuide(title, episodeCount) {
  if (!episodeCount || episodeCount < 50) return null;
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: FILLER_PROMPT,
        messages: [{
          role: 'user',
          content: `Does "${title}" (${episodeCount} episodes) have significant filler (10%+ of total)?

If yes:
{ "hasFiller": true, "fillerPercentage": number, "fillerCount": number, "totalCount": number, "ranges": ["95-130"], "hasMore": false }

If no or unsure:
null`,
        }],
      }),
    });
    const data = await response.json();
    if (!response.ok) return null;
    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    if (text === 'null') return null;
    const parsed = JSON.parse(text);
    return parsed?.hasFiller ? parsed : null;
  } catch { return null; }
}