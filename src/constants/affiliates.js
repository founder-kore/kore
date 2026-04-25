import {
  AMAZON_ASSOCIATE_TAG,
  CDJAPAN_AFFILIATE_ID,
  NORDVPN_AFFILIATE_URL,
  getAmazonAffiliateUrl,
  getCdJapanAffiliateUrl,
} from '../utils/affiliateLinks';

export { AMAZON_ASSOCIATE_TAG, CDJAPAN_AFFILIATE_ID, NORDVPN_AFFILIATE_URL };

export const CDJAPAN_BASE_URL = 'https://www.cdjapan.co.jp';

function hasCdJapanAffiliateId() {
  return typeof CDJAPAN_AFFILIATE_ID === 'string' && !CDJAPAN_AFFILIATE_ID.startsWith('REPLACE_WITH_');
}

export function getCDJapanSearchURL(title) {
  return getCdJapanAffiliateUrl(title);
}

export function getCDJapanHomeURL() {
  if (!hasCdJapanAffiliateId()) {
    return CDJAPAN_BASE_URL;
  }
  return `${CDJAPAN_BASE_URL}?affid=${encodeURIComponent(CDJAPAN_AFFILIATE_ID)}`;
}

export function getAmazonSearchURL(query) {
  return getAmazonAffiliateUrl(query);
}

export function getAmazonProductURL(searchQuery) {
  return getAmazonAffiliateUrl(searchQuery);
}
