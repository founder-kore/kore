import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../constants/theme';
import { generateAffiliateProductsForAnime } from '../services/claude';
import AffiliateCard from './AffiliateCard';
import {
  getCdJapanAffiliateUrl,
  getNordVpnAffiliateUrl,
} from '../utils/affiliateLinks';
import {
  isAffiliatePlacementEnabled,
  isCdJapanUnlocked,
  isNordVpnUnlocked,
} from '../utils/affiliateUnlocks';
import { isAnimeUnavailableInRegion } from '../utils/regionAvailability';

function formatProductType(productType) {
  const normalized = typeof productType === 'string' ? productType.trim().toLowerCase() : '';

  switch (normalized) {
    case 'art_book': return 'Art book';
    case 'bluray': return 'Blu-ray';
    case 'figure': return 'Figure';
    case 'manga': return 'Manga';
    case 'merch': return 'Merch';
    case 'soundtrack': return 'Soundtrack';
    default:
      return normalized.length > 0
        ? normalized.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
        : '';
  }
}

export default function AffiliateEnhanceSection({
  anime,
  unlockState,
  userRegion,
}) {
  const { colors } = useTheme();
  const animeTitle = anime?.title || anime?.japanese_title || '';
  const genreKey = Array.isArray(anime?.genre) ? anime.genre.join('|') : '';
  const cdJapanVisible = isAffiliatePlacementEnabled('cdjapan', 'result') && isCdJapanUnlocked(unlockState);
  const nordVpnVisible = (
    isAffiliatePlacementEnabled('nordvpn', 'result')
    && isNordVpnUnlocked(unlockState)
    && isAnimeUnavailableInRegion(anime, userRegion)
  );
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cdJapanProducts, setCdJapanProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const shouldLoadProducts = animeTitle.length > 0 && cdJapanVisible;

    if (!shouldLoadProducts) {
      setLoadingProducts(false);
      setCdJapanProducts([]);
      return () => {
        cancelled = true;
      };
    }

    setLoadingProducts(true);
    generateAffiliateProductsForAnime({
      animeTitle,
      genres: anime?.genre || [],
      synopsis: anime?.synopsis || '',
      retailers: ['cdjapan'],
    })
      .then(result => {
        if (cancelled) return;
        setCdJapanProducts(Array.isArray(result?.cdjapan) ? result.cdjapan : []);
      })
      .catch(() => {
        if (cancelled) return;
        setCdJapanProducts([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [animeTitle, genreKey, anime?.synopsis, cdJapanVisible]);

  const cards = [];

  if (cdJapanVisible && cdJapanProducts.length > 0) {
    const searchQuery = cdJapanProducts[0]?.search_query || cdJapanProducts[0]?.product_name || animeTitle;
    cards.push({
      key: 'cdjapan',
      title: 'Official Japanese Goods',
      subtitle: 'Explore authentic Japanese releases, collectibles, music, Blu-rays, and more.',
      buttonLabel: 'View on CDJapan',
      url: getCdJapanAffiliateUrl(searchQuery),
      accentColor: '#E8630A',
      testID: 'affiliate-card-cdjapan',
      items: cdJapanProducts.map(item => ({
        label: item.product_name,
        meta: formatProductType(item.product_type),
      })),
    });
  }

  if (nordVpnVisible) {
    cards.push({
      key: 'nordvpn',
      title: 'Not available in your region?',
      subtitle: 'NordVPN can help you access region-specific anime services safely and securely.',
      buttonLabel: 'Try NordVPN',
      url: getNordVpnAffiliateUrl(),
      accentColor: '#1D9E75',
      testID: 'affiliate-card-nordvpn',
      items: [],
    });
  }

  if (cards.length === 0 && !loadingProducts) {
    return null;
  }

  return (
    <View testID="affiliate-enhance-section" style={styles.section}>
      <Text style={[styles.label, { color: colors.charcoal }]}>Enhance Your Experience</Text>

      {loadingProducts && (
        <View style={[styles.loadingCard, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.ember} />
          <Text style={[styles.loadingText, { color: colors.charcoal }]}>
            Looking for relevant items tied to this recommendation...
          </Text>
        </View>
      )}

      {cards.map(card => (
        <AffiliateCard
          key={card.key}
          title={card.title}
          subtitle={card.subtitle}
          items={card.items}
          buttonLabel={card.buttonLabel}
          url={card.url}
          accentColor={card.accentColor}
          testID={card.testID}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  loadingCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
