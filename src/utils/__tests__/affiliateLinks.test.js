import {
  getAmazonAffiliateUrl,
  getCdJapanAffiliateUrl,
  getNordVpnAffiliateUrl,
} from '../affiliateLinks';

describe('affiliateLinks helpers', () => {
  test('encodes anime titles in Amazon affiliate URLs', () => {
    expect(getAmazonAffiliateUrl('D.Gray-man: Hallow')).toContain('D.Gray-man%3A%20Hallow');
  });

  test('encodes anime titles in CDJapan affiliate URLs', () => {
    expect(getCdJapanAffiliateUrl('K-On! Movie')).toContain('K-On!%20Movie');
  });

  test('falls back to a safe NordVPN URL when no affiliate link is configured', () => {
    expect(getNordVpnAffiliateUrl()).toBe('https://nordvpn.com');
  });
});
