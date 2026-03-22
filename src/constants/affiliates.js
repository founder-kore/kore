// src/constants/affiliates.js
//
// ─── HOW TO GO LIVE ────────────────────────────────────────────────────────
// This is the ONLY file you need to edit after affiliate approval.
// 1. CDJapan: cdjapan.co.jp/aff/?method=login_new  (2 business day approval)
//    → Replace CDJAPAN_AFFILIATE_ID with your affiliate ID
// 2. NordVPN: nordvpn.com/affiliate (via Impact, fast)
//    → Replace NORDVPN_AFFILIATE_URL with your Impact affiliate link
// 3. Amazon Associates: affiliate-program.amazon.com (instant tag)
//    → Replace AMAZON_ASSOCIATE_TAG with your tracking tag
//
// All reward screens import from here — no other files need touching.
// ───────────────────────────────────────────────────────────────────────────

// CDJapan — 5–7% commission · 30-day cookie · PayPal payments
// Physical anime Blu-rays, manga volumes, OSTs, figures from Japan
export const CDJAPAN_AFFILIATE_ID = 'PLACEHOLDER';
export const CDJAPAN_BASE_URL     = 'https://www.cdjapan.co.jp';

export function getCDJapanSearchURL(title) {
  const query = encodeURIComponent(title);
  // When approved: append ?affid=${CDJAPAN_AFFILIATE_ID} to track commissions
  if (CDJAPAN_AFFILIATE_ID === 'PLACEHOLDER') {
    return `${CDJAPAN_BASE_URL}/search/new?q=${query}`;
  }
  return `${CDJAPAN_BASE_URL}/search/new?q=${query}&affid=${CDJAPAN_AFFILIATE_ID}`;
}

export function getCDJapanHomeURL() {
  if (CDJAPAN_AFFILIATE_ID === 'PLACEHOLDER') return CDJAPAN_BASE_URL;
  return `${CDJAPAN_BASE_URL}?affid=${CDJAPAN_AFFILIATE_ID}`;
}

// NordVPN — 40–100% new · 30% renewals · via Impact
// Legitimate pitch: regional access walls block anime — a VPN fixes that
export const NORDVPN_AFFILIATE_URL = 'https://nordvpn.com';

// Amazon Associates — 3–5% physical goods
// Used for personalised manga/OST/artbook shelf at 60d milestone
export const AMAZON_ASSOCIATE_TAG = 'kore-placeholder-20';

export function getAmazonSearchURL(query) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_ASSOCIATE_TAG}&i=instant-video`;
}

export function getAmazonProductURL(searchQuery) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}+manga&tag=${AMAZON_ASSOCIATE_TAG}`;
}