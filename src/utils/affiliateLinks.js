const AMAZON_BASE_URL = 'https://www.amazon.com/s';
const CDJAPAN_BASE_URL = 'https://www.cdjapan.co.jp/search/new';
const NORDVPN_FALLBACK_URL = 'https://nordvpn.com';

export const AMAZON_ASSOCIATE_TAG = 'REPLACE_WITH_AMAZON_TAG';
export const CDJAPAN_AFFILIATE_ID = 'REPLACE_WITH_CDJAPAN_ID';
export const NORDVPN_AFFILIATE_URL = 'REPLACE_WITH_NORDVPN_LINK';

function normalizeAnimeTitle(animeTitle) {
  const normalized = typeof animeTitle === 'string' ? animeTitle.trim() : '';
  return normalized.length > 0 ? normalized : 'anime';
}

function isPlaceholderValue(value) {
  return !value || value.startsWith('REPLACE_WITH_');
}

export function getAmazonAffiliateUrl(animeTitle) {
  const query = encodeURIComponent(normalizeAnimeTitle(animeTitle));
  const tag = encodeURIComponent(AMAZON_ASSOCIATE_TAG);
  return `${AMAZON_BASE_URL}?k=${query}&tag=${tag}`;
}

export function getCdJapanAffiliateUrl(animeTitle) {
  const query = encodeURIComponent(normalizeAnimeTitle(animeTitle));
  if (isPlaceholderValue(CDJAPAN_AFFILIATE_ID)) {
    return `${CDJAPAN_BASE_URL}?q=${query}`;
  }
  return `${CDJAPAN_BASE_URL}?q=${query}&affid=${encodeURIComponent(CDJAPAN_AFFILIATE_ID)}`;
}

export function getNordVpnAffiliateUrl() {
  if (isPlaceholderValue(NORDVPN_AFFILIATE_URL)) {
    return NORDVPN_FALLBACK_URL;
  }
  return NORDVPN_AFFILIATE_URL;
}
