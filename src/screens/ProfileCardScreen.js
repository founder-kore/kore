import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Animated, Share,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getHistory, getRatings, getFavoriteGenres } from '../storage/userPrefs';
import { generateProfileCard } from '../services/claude';

// Diamond rarity indicators
function Diamonds({ count = 3, color }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[styles.diamond, {
            backgroundColor: i < count ? color : 'rgba(255,255,255,0.08)',
          }]}
        />
      ))}
    </View>
  );
}

function AnimatedBar({ genre, percentage, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  const barColors = ['#7F77DD', '#1D9E75', '#D4537E', '#E8630A'];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percentage,
      duration: 900,
      delay: 600 + index * 150,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  return (
    <View style={bStyles.row}>
      <Text style={bStyles.label}>{genre}</Text>
      <View style={bStyles.track}>
        <Animated.View style={[bStyles.fill, {
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: barColors[index % barColors.length],
        }]} />
      </View>
      <Text style={[bStyles.pct, { color: barColors[index % barColors.length] }]}>
        {percentage}%
      </Text>
    </View>
  );
}

const bStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 90, flexShrink: 0 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 2 },
  pct:   { fontSize: 10, fontWeight: '500', width: 28, textAlign: 'right' },
});

export default function ProfileCardScreen({ onBack, streak = 0 }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [card,    setCard]      = useState(null);
  const [dnaData, setDnaData]   = useState([]);
  const [history, setHistory]   = useState([]);
  const [sharing, setSharing]   = useState(false);

  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const statsFade = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadCard(); }, []);

  const loadCard = async () => {
    setLoading(true);
    setError(null);
    [cardFade, cardSlide, statsFade].forEach(a => a.setValue(a === cardSlide ? 30 : 0));

    try {
      const [hist, ratings, genres] = await Promise.all([
        getHistory(), getRatings(), getFavoriteGenres(),
      ]);
      setHistory(hist);

      // Compute genre DNA
      const genreCount = {};
      hist.forEach(h => { (h.genre || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }); });
      const total = Object.values(genreCount).reduce((a, b) => a + b, 0) || 1;
      const dna = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([genre, count]) => ({ genre, percentage: Math.round((count / total) * 100) }));
      setDnaData(dna);

      const result = await generateProfileCard({ history: hist, ratings, favoriteGenres: genres, streak });
      setCard(result);

      // Animate in
      Animated.sequence([
        Animated.parallel([
          Animated.timing(cardFade,  { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(cardSlide, { toValue: 0, duration: 500, useNativeDriver: false }),
        ]),
        Animated.timing(statsFade, { toValue: 1, duration: 350, useNativeDriver: false }),
      ]).start();

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!card) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      await Share.share({
        message: `My Kore anime profile at 14 days:\n\n${card.archetype}\n"${card.tagline}"\n\n${card.profile}\n\nSpirit anime: ${card.spirit_anime}\n\n🔥 ${streak} day streak · コレ Kore`,
        title: 'My Kore Profile Card',
      });
    } catch {}
    finally { setSharing(false); }
  };

  if (loading) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile Card</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={styles.loadingEmoji}>💎</Text>
        <Text style={[styles.loadingTitle, { color: colors.ink }]}>Building your card...</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>
          Claude is reading 14 days of taste data.
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
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile Card</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={[styles.loadingTitle, { color: colors.ember }]}>Something went wrong</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.ink }]} onPress={loadCard}>
          <Text style={[styles.retryBtnText, { color: colors.snow }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (!card) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile Card</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.unlockLabel, { color: colors.charcoal }]}>💎 14 day unlock</Text>

        {/* Holographic card */}
        <Animated.View style={[styles.card, {
          opacity: cardFade,
          transform: [{ translateY: cardSlide }],
        }]}>
          {/* Rainbow stripe */}
          <View style={styles.stripe} />

          {/* Top row */}
          <View style={styles.cardTop}>
            <Text style={styles.cardLogo}>コレ</Text>
            <Diamonds count={3} color="#7F77DD" />
          </View>

          {/* Archetype */}
          <Text style={styles.archetypeName}>{card.archetype}</Text>
          <Text style={styles.archetypeTagline}>{card.tagline}</Text>

          {/* Profile sentence */}
          <Text style={styles.profileText}>{card.profile}</Text>

          <View style={styles.cardDivider} />

          {/* DNA bars */}
          {dnaData.length > 0 && (
            <View style={styles.dnaWrap}>
              <Text style={styles.dnaLabel}>ANIME DNA</Text>
              {dnaData.map((d, i) => (
                <AnimatedBar key={d.genre} genre={d.genre} percentage={d.percentage} index={i} />
              ))}
            </View>
          )}

          {/* Spirit anime chip */}
          {card.spirit_anime && (
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>SPIRIT ANIME</Text>
                <Text style={styles.chipValue}>{card.spirit_anime}</Text>
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={[styles.rankBadge, { backgroundColor: '#1D9E75' }]}>
              <Text style={styles.rankBadgeText}>Early Watcher</Text>
            </View>
            <Text style={styles.serial}>{card.serial_number || 'KP-2026-0001'}</Text>
          </View>
        </Animated.View>

        {/* Stats row */}
        <Animated.View style={[styles.statsRow, { opacity: statsFade }]}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.charcoal }]}>Day streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{history.length}</Text>
            <Text style={[styles.statLabel, { color: colors.charcoal }]}>Total picks</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>14d</Text>
            <Text style={[styles.statLabel, { color: colors.charcoal }]}>Unlocked</Text>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={{ opacity: statsFade }}>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.ink }]}
            onPress={handleShare}
            disabled={sharing}
          >
            <Text style={[styles.shareBtnText, { color: colors.snow }]}>
              {sharing ? 'Sharing...' : 'Share my profile card'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.regenBtn, { borderColor: colors.border }]}
            onPress={loadCard}
          >
            <Text style={[styles.regenBtnText, { color: colors.charcoal }]}>Regenerate card</Text>
          </TouchableOpacity>
        </Animated.View>

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
  unlockLabel:  { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14, opacity: 0.6 },

  // Holographic card
  card:         { backgroundColor: '#0A0A1A', borderRadius: 20, padding: 22, marginBottom: 14, overflow: 'hidden' },
  stripe:       { height: 3, backgroundColor: 'transparent', borderRadius: 2, marginBottom: 16,
                  // Rainbow gradient via border — RN doesn't support gradient natively
                  // Using a visual substitute: layered shadows
                  borderBottomWidth: 3,
                  borderBottomColor: '#7F77DD',
                },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardLogo:     { fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: '500' },
  diamond:      { width: 8, height: 8, borderRadius: 1, transform: [{ rotate: '45deg' }] },

  archetypeName:   { fontSize: 24, fontWeight: '500', color: '#F5F5F5', marginBottom: 5, lineHeight: 30 },
  archetypeTagline:{ fontSize: 12, color: '#7F77DD', fontStyle: 'italic', marginBottom: 14 },
  profileText:     { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginBottom: 16 },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },

  dnaWrap:   { marginBottom: 14 },
  dnaLabel:  { fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.5, marginBottom: 10 },

  chipRow:   { marginBottom: 14 },
  chip:      { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  chipLabel: { fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginBottom: 4 },
  chipValue: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  cardFooter:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 },
  rankBadge:     { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
  rankBadgeText: { fontSize: 10, color: '#fff', fontWeight: '500' },
  serial:        { fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace' },

  statsRow:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:   { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 4 },
  statVal:    { fontSize: 20, fontWeight: '500' },
  statLabel:  { fontSize: 10, textAlign: 'center' },

  shareBtn:     { padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  shareBtnText: { fontSize: 15, fontWeight: '500' },
  regenBtn:     { padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5 },
  regenBtnText: { fontSize: 14 },
  bottomPad:    { height: 40 },
});