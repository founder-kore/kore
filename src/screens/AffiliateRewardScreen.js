import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Linking, Animated,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getCDJapanHomeURL } from '../constants/affiliates';
import { getHistory, getRatings } from '../storage/userPrefs';
import { getNordVpnAffiliateUrl } from '../utils/affiliateLinks';

// What Kore recommends shopping for based on top genres
const CDJAPAN_CATEGORIES = [
  { label: 'Anime Blu-rays', emoji: '📀', desc: 'Physical releases with Japanese dub + extras' },
  { label: 'Manga volumes',  emoji: '📚', desc: 'Exactly where the anime left off' },
  { label: 'Soundtracks',    emoji: '🎵', desc: 'OSTs from your favourite series' },
  { label: 'Merchandise',    emoji: '🎌', desc: 'Figures, posters, art books' },
];

const NORDVPN_REASONS = [
  { label: 'Regional walls',  emoji: '🌏', desc: 'Some anime is only on Crunchyroll JP or Netflix JP' },
  { label: 'Better libraries', emoji: '📺', desc: 'US Crunchyroll has fewer titles than the Japanese version' },
  { label: 'Geo-locked drops', emoji: '⚡', desc: 'New season premieres often hit JP first by 24-48 hours' },
];

export default function AffiliateRewardScreen({ type = 'cdjapan', onBack }) {
  const { colors, isDark } = useTheme();
  const [topTitle, setTopTitle] = useState(null);
  const [opening, setOpening] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const isCDJ     = type === 'cdjapan';
  const accentColor = isCDJ ? '#E8630A' : '#1D9E75';
  const cardBg    = isDark ? '#1A1A1A' : '#FAFAF9';

  useEffect(() => {
    loadTopTitle();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
    ]).start();
  }, []);

  const loadTopTitle = async () => {
    try {
      const [history, ratings] = await Promise.all([getHistory(), getRatings()]);
      const loved = ratings.find(r => r.rating === 'loved');
      if (loved) { setTopTitle(loved.title); return; }
      if (history.length > 0) setTopTitle(history[0].title);
    } catch {}
  };

  const handleOpen = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpening(true);
    try {
      const url = isCDJ ? getCDJapanHomeURL() : getNordVpnAffiliateUrl();
      await Linking.openURL(url);
    } catch (e) {
      console.log('Could not open URL:', e);
    } finally {
      setTimeout(() => setOpening(false), 1500);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>
          {isCDJ ? 'CDJapan Reward' : 'NordVPN Deal'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Hero card */}
          <View style={[styles.heroCard, { backgroundColor: isDark ? '#1A1A1A' : '#1A1A1A' }]}>
            <View style={[styles.heroBadge, { backgroundColor: accentColor + '25', borderColor: accentColor + '50' }]}>
              <Text style={[styles.heroBadgeText, { color: accentColor }]}>
                🔥 {isCDJ ? '7 Day' : '30 Day'} streak reward
              </Text>
            </View>
            <Text style={styles.heroEmoji}>{isCDJ ? '🎌' : '🌐'}</Text>
            <Text style={styles.heroTitle}>
              {isCDJ ? 'Shop CDJapan' : 'Get NordVPN'}
            </Text>
            <Text style={styles.heroSub}>
              {isCDJ
                ? topTitle
                  ? `You loved ${topTitle}. CDJapan has the manga, Blu-rays, and merchandise to go deeper.`
                  : 'Physical anime from Japan — Blu-rays, manga, OSTs, figures. Ships worldwide.'
                : 'Regional access walls block anime. A VPN removes them. NordVPN is the fastest option.'}
            </Text>
          </View>

          {/* What's there */}
          <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>
            {isCDJ ? 'WHAT YOU CAN FIND' : 'WHY ANIME FANS USE VPNS'}
          </Text>

          {(isCDJ ? CDJAPAN_CATEGORIES : NORDVPN_REASONS).map((item, i) => (
            <View key={i} style={[styles.featureCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <Text style={styles.featureEmoji}>{item.emoji}</Text>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.ink }]}>{item.label}</Text>
                <Text style={[styles.featureSub,   { color: colors.charcoal }]}>{item.desc}</Text>
              </View>
            </View>
          ))}

          {/* Main CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: accentColor }, opening && { opacity: 0.7 }]}
            onPress={handleOpen}
            disabled={opening}
          >
            <Text style={styles.ctaBtnText}>
              {opening
                ? 'Opening...'
                : isCDJ ? 'Shop CDJapan ↗' : 'Get NordVPN deal ↗'}
            </Text>
          </TouchableOpacity>

          {/* Affiliate disclosure — required by law */}
          <View style={[styles.disclosureCard, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
            <Text style={[styles.disclosureText, { color: colors.charcoal }]}>
              {isCDJ
                ? 'Kore earns a small commission from CDJapan purchases through this link. It doesn\'t affect the price you pay — commissions are how Kore stays free.'
                : 'Kore earns a commission if you purchase NordVPN through this link at no additional cost to you. The recommendation is genuine — regional anime access is a real problem.'}
            </Text>
          </View>

        </Animated.View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn:        { width: 60 },
  backText:       { fontSize: 15 },
  headerTitle:    { fontSize: 17, fontWeight: '500' },
  headerRight:    { width: 60 },
  scroll:         { padding: 20 },

  heroCard:       { borderRadius: 20, padding: 22, marginBottom: 20, alignItems: 'center' },
  heroBadge:      { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, marginBottom: 14 },
  heroBadgeText:  { fontSize: 11, fontWeight: '500' },
  heroEmoji:      { fontSize: 48, marginBottom: 12 },
  heroTitle:      { fontSize: 26, fontWeight: '500', color: '#F5F5F5', marginBottom: 8 },
  heroSub:        { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22, textAlign: 'center' },

  sectionLabel:   { fontSize: 10, fontWeight: '500', letterSpacing: 1.5, marginBottom: 10 },

  featureCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 8 },
  featureEmoji:   { fontSize: 22 },
  featureText:    { flex: 1 },
  featureTitle:   { fontSize: 14, fontWeight: '500', marginBottom: 3 },
  featureSub:     { fontSize: 12, lineHeight: 18 },

  ctaBtn:         { padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 14, marginBottom: 12 },
  ctaBtnText:     { fontSize: 16, fontWeight: '500', color: '#fff' },

  disclosureCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  disclosureText: { fontSize: 11, lineHeight: 17 },

  bottomPad: { height: 40 },
});
