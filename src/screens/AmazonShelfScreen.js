import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Linking, Animated,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getRatings, getHistory } from '../storage/userPrefs';
import { generateAmazonShelf } from '../services/claude';
import { getAmazonProductURL, AMAZON_ASSOCIATE_TAG } from '../constants/affiliates';

const PRODUCT_TYPE_CONFIG = {
  manga_volumes: { emoji: '📚', label: 'Manga' },
  art_book:      { emoji: '🎨', label: 'Art Book' },
  ost:           { emoji: '🎵', label: 'Soundtrack' },
  figure:        { emoji: '🗿', label: 'Figure' },
  other:         { emoji: '📦', label: 'Merch' },
};

export default function AmazonShelfScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [shelf,     setShelf]     = useState([]);
  const [lovedList, setLovedList] = useState([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadShelf(); }, []);

  const loadShelf = async () => {
    setLoading(true);
    setError(null);
    fadeAnim.setValue(0);

    try {
      const [ratings, history] = await Promise.all([getRatings(), getHistory()]);
      const loved = ratings.filter(r => r.rating === 'loved').map(r => r.title);
      setLovedList(loved);

      if (loved.length === 0) {
        // No loved anime yet — show a friendly empty state
        setShelf([]);
        setLoading(false);
        return;
      }

      const items = await generateAmazonShelf({ lovedList: loved, history });
      setShelf(Array.isArray(items) ? items : []);

      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProduct = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = getAmazonProductURL(item.amazon_search);
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.log('Could not open Amazon URL:', e);
    }
  };

  const handleOpenAmazon = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Linking.openURL(`https://www.amazon.com/anime-manga/s?tag=${AMAZON_ASSOCIATE_TAG}`);
    } catch {}
  };

  if (loading) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Your Anime Shelf</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={styles.loadingEmoji}>📦</Text>
        <Text style={[styles.loadingTitle, { color: colors.ink }]}>Building your shelf...</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>
          Claude is picking the best products for every anime you loved.
        </Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Your Anime Shelf</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={[styles.loadingTitle, { color: colors.ember }]}>Something went wrong</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.ink }]} onPress={loadShelf}>
          <Text style={[styles.retryBtnText, { color: colors.snow }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Your Anime Shelf</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? '#1A1A1A' : '#1A1A1A' }]}>
          <View style={[styles.unlockBadge, { backgroundColor: '#7F77DD25', borderColor: '#7F77DD50' }]}>
            <Text style={[styles.unlockBadgeText, { color: '#7F77DD' }]}>👑 60 Day Unlock</Text>
          </View>
          <Text style={styles.heroTitle}>Your anime shelf</Text>
          <Text style={styles.heroSub}>
            {lovedList.length > 0
              ? `Based on ${lovedList.length} anime you loved, Claude picked the best physical products to go deeper — manga volumes, art books, and OSTs.`
              : 'Rate anime you\'ve loved and your personalised shelf will appear here.'}
          </Text>
        </View>

        {/* Empty state */}
        {lovedList.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>❤️</Text>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Rate anime you love first</Text>
            <Text style={[styles.emptyText, { color: colors.charcoal }]}>
              Go to any recommendation, scroll to the rating section, and tap "Loved it". Once you have loved anime, your shelf will generate.
            </Text>
          </View>
        )}

        {/* Product shelf */}
        {shelf.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {shelf.map((item, i) => {
              const typeConfig = PRODUCT_TYPE_CONFIG[item.product_type] || PRODUCT_TYPE_CONFIG.other;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleOpenProduct(item)}
                  activeOpacity={0.75}
                >
                  {/* Product type badge */}
                  <View style={[styles.typeBadge, { backgroundColor: colors.chalk }]}>
                    <Text style={styles.typeBadgeEmoji}>{typeConfig.emoji}</Text>
                    <Text style={[styles.typeBadgeLabel, { color: colors.charcoal }]}>{typeConfig.label}</Text>
                  </View>

                  <View style={styles.productInfo}>
                    {/* For anime label */}
                    <Text style={[styles.productAnime, { color: colors.ember }]}>
                      For: {item.anime_title}
                    </Text>
                    {/* Product name */}
                    <Text style={[styles.productName, { color: colors.ink }]} numberOfLines={2}>
                      {item.product_name}
                    </Text>
                    {/* Reason */}
                    <Text style={[styles.productReason, { color: colors.charcoal }]} numberOfLines={2}>
                      {item.reason}
                    </Text>
                  </View>

                  <View style={styles.productAction}>
                    <Text style={[styles.productArrow, { color: colors.charcoal }]}>→</Text>
                    <Text style={[styles.productAmazon, { color: colors.charcoal }]}>Amazon</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Browse more */}
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: colors.chalk, borderColor: colors.border }]}
              onPress={handleOpenAmazon}
            >
              <Text style={[styles.browseBtnText, { color: colors.ink }]}>Browse more anime on Amazon ↗</Text>
            </TouchableOpacity>

            {/* Regenerate */}
            <TouchableOpacity
              style={[styles.regenBtn, { borderColor: colors.border }]}
              onPress={loadShelf}
            >
              <Text style={[styles.regenBtnText, { color: colors.charcoal }]}>Refresh shelf</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Affiliate disclosure */}
        <View style={[styles.disclosureCard, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
          <Text style={[styles.disclosureText, { color: colors.charcoal }]}>
            Kore earns a small commission from Amazon purchases made through these links at no extra cost to you. All recommendations are generated by Claude based on your actual loved anime — not paid placements.
          </Text>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn:      { width: 60 },
  backText:     { fontSize: 15 },
  headerTitle:  { fontSize: 17, fontWeight: '500' },
  headerRight:  { width: 60 },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  loadingEmoji: { fontSize: 44 },
  loadingTitle: { fontSize: 20, fontWeight: '500', textAlign: 'center' },
  loadingSub:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn:     { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '500' },
  scroll:       { padding: 20 },

  heroCard:     { borderRadius: 20, padding: 20, marginBottom: 20 },
  unlockBadge:  { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  unlockBadgeText: { fontSize: 11, fontWeight: '500' },
  heroTitle:    { fontSize: 26, fontWeight: '500', color: '#F5F5F5', marginBottom: 8 },
  heroSub:      { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22 },

  emptyWrap:    { alignItems: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 16 },
  emptyEmoji:   { fontSize: 40 },
  emptyTitle:   { fontSize: 18, fontWeight: '500', textAlign: 'center' },
  emptyText:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  productCard:   { borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  typeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20, marginBottom: 8 },
  typeBadgeEmoji:{ fontSize: 12 },
  typeBadgeLabel:{ fontSize: 10, fontWeight: '500' },
  productInfo:   { flex: 1, gap: 4 },
  productAnime:  { fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  productName:   { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  productReason: { fontSize: 12, lineHeight: 18 },
  productAction: { alignItems: 'center', marginTop: 10 },
  productArrow:  { fontSize: 18 },
  productAmazon: { fontSize: 10, marginTop: 2 },

  browseBtn:    { padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  browseBtnText:{ fontSize: 14, fontWeight: '500' },
  regenBtn:     { padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', marginBottom: 12 },
  regenBtnText: { fontSize: 13 },

  disclosureCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 8 },
  disclosureText: { fontSize: 11, lineHeight: 17 },
  bottomPad:      { height: 40 },
});