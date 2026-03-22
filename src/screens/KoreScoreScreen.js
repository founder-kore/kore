import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Animated, Share,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getHistory, getRatings, getFavoriteGenres, getStreak } from '../storage/userPrefs';
import { generateKoreScore } from '../services/claude';

const RANK_COLORS = {
  'Newcomer':  '#888',
  'Watcher':   '#7F77DD',
  'Devotee':   '#1D9E75',
  'Legend':    '#E8630A',
};

function AnimatedDNABar({ genre, percentage, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percentage,
      duration: 900,
      delay: 800 + index * 150,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const barColors = ['#E8630A', '#7F77DD', '#1D9E75', '#D4537E'];

  return (
    <View style={dnaStyles.row}>
      <Text style={dnaStyles.label}>{genre}</Text>
      <View style={dnaStyles.track}>
        <Animated.View style={[dnaStyles.fill, {
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: barColors[index % barColors.length],
        }]} />
      </View>
      <Text style={[dnaStyles.pct, { color: barColors[index % barColors.length] }]}>{percentage}%</Text>
    </View>
  );
}

const dnaStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 92, flexShrink: 0 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  pct: { fontSize: 10, fontWeight: '500', width: 30, textAlign: 'right' },
});

export default function KoreScoreScreen({ onBack }) {
  const { colors } = useTheme();
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [score,      setScore]      = useState(null);
  const [history,    setHistory]    = useState([]);
  const [streak,     setStreakLocal] = useState(0);
  const [sharing,    setSharing]    = useState(false);

  // Staggered reveal animations
  const cardAnim   = useRef(new Animated.Value(0)).current;
  const logoAnim   = useRef(new Animated.Value(0)).current;
  const titleAnim  = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const dnaAnim    = useRef(new Animated.Value(0)).current;
  const chipsAnim  = useRef(new Animated.Value(0)).current;
  const statsAnim  = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadScore(); }, []);

  const loadScore = async () => {
    setLoading(true);
    setError(null);

    // Reset all anim values
    [cardAnim, logoAnim, titleAnim, taglineAnim, dnaAnim, chipsAnim, statsAnim, actionsAnim]
      .forEach(a => a.setValue(0));

    try {
      const [hist, ratingsList, genres, currentStreak] = await Promise.all([
        getHistory(), getRatings(), getFavoriteGenres(), getStreak(),
      ]);
      setHistory(hist);
      setStreakLocal(currentStreak);

      const result = await generateKoreScore({ history: hist, ratings: ratingsList, favoriteGenres: genres });
      setScore(result);

      // Staggered reveal
      const fade = (anim, delay) => Animated.timing(anim, { toValue: 1, duration: 350, delay, useNativeDriver: false });
      Animated.sequence([
        fade(cardAnim, 0),
        fade(logoAnim, 100),
        fade(titleAnim, 300),
        fade(taglineAnim, 500),
        fade(dnaAnim, 700),
        fade(chipsAnim, 1100),
        fade(statsAnim, 1300),
        fade(actionsAnim, 1500),
      ]).start();

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!score) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      const topGenres = score.dna.slice(0, 2).map(d => `${d.genre} ${d.percentage}%`).join(' · ');
      await Share.share({
        message: `My Kore Score after ${streak} days:\n\n⚔️ ${score.archetype}\n"${score.tagline}"\n\nAnime DNA: ${topGenres}\nSpirit anime: ${score.spirit_anime}\n\nRank: ${score.rank} — Level ${score.level}\n\nコレ Kore`,
        title: `My Kore Score`,
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
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Kore Score</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={styles.loadingEmoji}>⚔️</Text>
        <Text style={[styles.loadingTitle, { color: colors.ink }]}>Generating your card...</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>Claude is distilling 30 days of taste.</Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Kore Score</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={[styles.loadingTitle, { color: colors.ember }]}>Something went wrong</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.ink }]} onPress={loadScore}>
          <Text style={[styles.retryBtnText, { color: colors.snow }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (!score) return null;

  const rankColor = RANK_COLORS[score.rank] || '#E8630A';
  const watermarkGenre = score.dna?.[0]?.genre?.toUpperCase() || 'ANIME';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Kore Score</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.unlockLabel, { color: colors.charcoal }]}>🔥 30 day unlock</Text>

        {/* RPG Card */}
        <Animated.View style={[styles.card, { opacity: cardAnim }]}>

          {/* Watermark */}
          <Text style={styles.watermark} numberOfLines={1}>{watermarkGenre}</Text>

          {/* Top row */}
          <Animated.View style={[styles.cardTop, { opacity: logoAnim }]}>
            <Text style={styles.cardLogo}>コレ</Text>
            <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
              <Text style={styles.rankBadgeText}>{score.rank}</Text>
            </View>
          </Animated.View>

          {/* Archetype name */}
          <Animated.View style={{ opacity: titleAnim }}>
            <Text style={styles.archetypeName}>{score.archetype}</Text>
          </Animated.View>

          {/* Tagline */}
          <Animated.View style={{ opacity: taglineAnim }}>
            <Text style={styles.archetypeTagline}>{score.tagline}</Text>
          </Animated.View>

          <View style={styles.cardDivider} />

          {/* DNA bars */}
          <Animated.View style={{ opacity: dnaAnim }}>
            <Text style={styles.dnaLabel}>ANIME DNA</Text>
            {(score.dna || []).map((d, i) => (
              <AnimatedDNABar key={d.genre} genre={d.genre} percentage={d.percentage} index={i} />
            ))}
          </Animated.View>

          {/* Chips */}
          <Animated.View style={[styles.chipsWrap, { opacity: chipsAnim }]}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Hidden obsession</Text>
              <Text style={styles.chipValue}>{score.hidden_obsession}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Spirit anime</Text>
              <Text style={styles.chipValue}>{score.spirit_anime}</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Level stats */}
        <Animated.View style={[styles.statsRow, { opacity: statsAnim }]}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{score.level}</Text>
            <Text style={[styles.statLabel, { color: colors.charcoal }]}>Level</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.charcoal }]}>Day streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.ink }]}>{history.length}</Text>
            <Text style={[styles.statLabel, { color: colors.charcoal }]}>Total picks</Text>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={{ opacity: actionsAnim }}>
          <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.ink }]} onPress={handleShare} disabled={sharing}>
            <Text style={[styles.shareBtnText, { color: colors.snow }]}>{sharing ? 'Sharing...' : 'Share my Kore Score'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.regenBtn, { borderColor: colors.border }]} onPress={loadScore}>
            <Text style={[styles.regenBtnText, { color: colors.charcoal }]}>Regenerate card</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn: { width: 60 },
  backText: { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  headerRight: { width: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  loadingEmoji: { fontSize: 44 },
  loadingTitle: { fontSize: 20, fontWeight: '500', textAlign: 'center' },
  loadingSub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '500' },
  scroll: { padding: 20 },
  unlockLabel: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, opacity: 0.6 },

  // RPG Card
  card: { backgroundColor: '#0F0F0F', borderRadius: 22, padding: 24, marginBottom: 14, overflow: 'hidden', position: 'relative' },
  watermark: { position: 'absolute', top: '35%', left: -10, right: -10, fontSize: 72, fontWeight: '700', color: 'rgba(255,255,255,0.04)', textAlign: 'center', letterSpacing: -2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  cardLogo: { fontSize: 14, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
  rankBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },
  rankBadgeText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  archetypeName: { fontSize: 28, fontWeight: '500', color: '#F5F5F5', lineHeight: 34, marginBottom: 8 },
  archetypeTagline: { fontSize: 13, color: '#E8630A', fontStyle: 'italic', lineHeight: 20, marginBottom: 18 },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },
  dnaLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 12 },
  chipsWrap: { marginTop: 14, gap: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  chipLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 4 },
  chipValue: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 20, fontWeight: '500' },
  statLabel: { fontSize: 10, textAlign: 'center' },

  shareBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  shareBtnText: { fontSize: 15, fontWeight: '500' },
  regenBtn: { padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5 },
regenBtnText: { fontSize: 14 },
bottomPad: { height: 40 },
});