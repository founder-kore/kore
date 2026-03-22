import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Animated, Share,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getHistory, getRatings, getFavoriteGenres } from '../storage/userPrefs';
import { generateMoodInsights } from '../services/claude';

const MOOD_COLORS = {
  'Chill': '#7F77DD', 'Hype': '#E8630A', 'Emotional': '#D4537E',
  'Curious': '#1D9E75', 'Escapist': '#378ADD', 'Social': '#BA7517',
};

const MOOD_EMOJIS = {
  'Chill': '🌸', 'Hype': '⚔️', 'Emotional': '🫧',
  'Curious': '🦋', 'Escapist': '⛩️', 'Social': '🎎',
};

function GenreBar({ genre, percentage, index, colors }) {
  const barColors = ['#E8630A', '#7F77DD', '#1D9E75', '#D4537E', '#378ADD'];
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: percentage, duration: 800, delay: index * 120, useNativeDriver: false }).start();
  }, [percentage]);
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.charcoal }]}>{genre}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.chalk }]}>
        <Animated.View style={[styles.barFill, {
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: barColors[index % barColors.length],
        }]} />
      </View>
      <Text style={[styles.barPct, { color: barColors[index % barColors.length] }]}>{percentage}%</Text>
    </View>
  );
}

export default function MoodInsightsScreen({ onBack, streak = 0 }) {
  const { colors, isDark } = useTheme();
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [insights,  setInsights]  = useState(null);
  const [history,   setHistory]   = useState([]);
  const [ratings,   setRatings]   = useState([]);
  const [topGenres, setTopGenres] = useState([]);
  const [sharing,   setSharing]   = useState(false);

  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(24)).current;
  const statsFade = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadInsights(); }, []);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hist, ratingsList, genres] = await Promise.all([getHistory(), getRatings(), getFavoriteGenres()]);
      setHistory(hist);
      setRatings(ratingsList);

      // Compute genre breakdown
      const genreCount = {};
      hist.forEach(h => { (h.genre || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }); });
      const total = Object.values(genreCount).reduce((a, b) => a + b, 0) || 1;
      const top = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([genre, count]) => ({ genre, percentage: Math.round((count / total) * 100) }));
      setTopGenres(top);

      if (hist.length < 3) {
        setLoading(false);
        return;
      }

      const result = await generateMoodInsights({ history: hist, ratings: ratingsList, favoriteGenres: genres, streak });
      setInsights(result);

      // Animate in
      Animated.sequence([
        Animated.parallel([
          Animated.timing(cardFade,  { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(cardSlide, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]),
        Animated.timing(statsFade, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]).start();

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!insights) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      await Share.share({
        message: `My anime personality on コレ Kore:\n\n${insights.archetype}\n${insights.tagline}\n\n${insights.profile}\n\n🔥 ${streak} day streak`,
        title: `My Kore Anime Personality`,
      });
    } catch {}
    finally { setSharing(false); }
  };

  const lovedCount    = ratings.filter(r => r.rating === 'loved').length;
  const likedCount    = ratings.filter(r => r.rating === 'liked').length;
  const dislikedCount = ratings.filter(r => r.rating === 'disliked').length;

  // Compute dominant mood
  const moodCount = {};
  history.forEach(h => { if (h.mood) moodCount[h.mood] = (moodCount[h.mood] || 0) + 1; });
  const dominantMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  if (loading) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Mood Insights</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={[styles.loadingEmoji]}>🧠</Text>
        <Text style={[styles.loadingTitle, { color: colors.ink }]}>Analysing your picks...</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>Claude is reading your taste patterns.</Text>
      </View>
    </SafeAreaView>
  );

  if (history.length < 3) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Mood Insights</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={styles.loadingEmoji}>📊</Text>
        <Text style={[styles.loadingTitle, { color: colors.ink }]}>Need a few more picks</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>Get at least 3 recommendations for your personality profile to generate.</Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Mood Insights</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={[styles.loadingTitle, { color: colors.ember }]}>Something went wrong</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.ink }]} onPress={loadInsights}>
          <Text style={[styles.retryBtnText, { color: colors.snow }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const profileBg = isDark ? '#1A1A1A' : '#1A1A1A';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Mood Insights</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.unlockLabel, { color: colors.charcoal }]}>🔥 7 day unlock</Text>

        {/* Archetype card */}
        {insights && (
          <Animated.View style={[styles.archetypeCard, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}>
            <Text style={styles.archetypeSmallLabel}>YOUR ARCHETYPE</Text>
            <Text style={styles.archetypeName}>{insights.archetype}</Text>
            <Text style={styles.archetypeTagline}>{insights.tagline}</Text>
            <View style={styles.cardDivider} />
            <Text style={styles.archetypeProfile}>{insights.profile}</Text>
            {insights.hidden_pattern && (
              <View style={styles.hiddenPatternWrap}>
                <Text style={styles.hiddenPatternLabel}>PATTERN DETECTED</Text>
                <Text style={styles.hiddenPatternText}>{insights.hidden_pattern}</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Stats row */}
        <Animated.View style={{ opacity: statsFade }}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>{dominantMood ? (MOOD_EMOJIS[dominantMood] || '🎌') : '🎌'}</Text>
              <Text style={[styles.statVal, { color: colors.ink }]}>{dominantMood || '—'}</Text>
              <Text style={[styles.statLabel, { color: colors.charcoal }]}>Top mood</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>🎌</Text>
              <Text style={[styles.statVal, { color: colors.ink }]}>{history.length}</Text>
              <Text style={[styles.statLabel, { color: colors.charcoal }]}>Picks</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={[styles.statVal, { color: colors.ink }]}>{streak}</Text>
              <Text style={[styles.statLabel, { color: colors.charcoal }]}>Streak</Text>
            </View>
          </View>

          {/* Rating breakdown */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>❤️</Text>
              <Text style={[styles.statVal, { color: colors.ink }]}>{lovedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.charcoal }]}>Loved</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>👍</Text>
              <Text style={[styles.statVal, { color: colors.ink }]}>{likedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.charcoal }]}>Liked</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.statEmoji}>👎</Text>
              <Text style={[styles.statVal, { color: colors.ink }]}>{dislikedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.charcoal }]}>Dropped</Text>
            </View>
          </View>

          {/* Anime DNA */}
          {topGenres.length > 0 && (
            <View style={[styles.dnaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.dnaLabel, { color: colors.charcoal }]}>ANIME DNA</Text>
              {topGenres.map((g, i) => (
                <GenreBar key={g.genre} genre={g.genre} percentage={g.percentage} index={i} colors={colors} />
              ))}
            </View>
          )}

          {/* Mood timeline */}
          {history.length > 0 && (
            <View style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.dnaLabel, { color: colors.charcoal }]}>LAST {Math.min(history.length, 20)} PICKS</Text>
              <View style={styles.dotRow}>
                {history.slice(0, 20).reverse().map((h, i) => (
                  <View key={i} style={[styles.moodDot, { backgroundColor: MOOD_COLORS[h.mood] || '#888' }]} />
                ))}
              </View>
              <Text style={[styles.dotLegend, { color: colors.charcoal }]}>Each dot is one pick — colour = mood</Text>
            </View>
          )}

          {/* Share */}
          <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.ink }]} onPress={handleShare} disabled={sharing}>
            <Text style={[styles.shareBtnText, { color: colors.snow }]}>
              {sharing ? 'Sharing...' : 'Share my anime personality'}
            </Text>
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

  // Archetype card
  archetypeCard: { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 22, marginBottom: 14 },
  archetypeSmallLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'none', marginBottom: 10 },
  archetypeName: { fontSize: 26, fontWeight: '500', color: '#F5F5F5', marginBottom: 6, lineHeight: 32 },
  archetypeTagline: { fontSize: 14, color: '#E8630A', fontStyle: 'italic', lineHeight: 22, marginBottom: 16 },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  archetypeProfile: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 14 },
  hiddenPatternWrap: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14 },
  hiddenPatternLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 6 },
  hiddenPatternText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 3 },
  statEmoji: { fontSize: 20 },
  statVal: { fontSize: 18, fontWeight: '500' },
  statLabel: { fontSize: 10, textAlign: 'center' },

  dnaCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 10 },
  dnaLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 1.5, marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  barLabel: { fontSize: 12, width: 100, flexShrink: 0 },
  barTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barPct: { fontSize: 11, fontWeight: '500', width: 32, textAlign: 'right' },

  timelineCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 14 },
  dotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  dotLegend: { fontSize: 11, opacity: 0.5 },

  shareBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  shareBtnText: { fontSize: 15, fontWeight: '500' },
  bottomPad: { height: 40 },
});