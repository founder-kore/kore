import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Animated, Share,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getHistory, getRatings, getFavoriteGenres } from '../storage/userPrefs';
import { generateMoodInsights } from '../services/claude';

const MOOD_EMOJIS = {
  'Chill': '🌸', 'Hype': '⚔️', 'Emotional': '🫧',
  'Curious': '🦋', 'Escapist': '⛩️', 'Social': '🎎',
};

const BAR_COLORS = ['#E8630A', '#7F77DD', '#1D9E75', '#D4537E', '#4D9FFF'];

function getArchetypeIcon(archetype) {
  if (!archetype) return '✨';
  const a = archetype.toLowerCase();
  if (a.includes('hype') || a.includes('action') || a.includes('catalyst')) return '⚡';
  if (a.includes('phantom') || a.includes('ghost') || a.includes('dark')) return '🌑';
  if (a.includes('philosopher') || a.includes('thinker') || a.includes('mind')) return '🔮';
  if (a.includes('hero') || a.includes('warrior')) return '⚔️';
  if (a.includes('romantic') || a.includes('heart')) return '💫';
  return '✨';
}

function getSpiritAnimeIcon(title) {
  if (!title) return '✨';
  const t = title.toLowerCase();
  if (t.includes('fairy') || t.includes('one piece') || t.includes('naruto')) return '⚡';
  if (t.includes('death') || t.includes('attack') || t.includes('demon')) return '⚔️';
  if (t.includes('your lie') || t.includes('clannad') || t.includes('violet')) return '💫';
  return '✨';
}

function AnimatedDnaBar({ genre, percentage, index, isDark }) {
  const anim = useRef(new Animated.Value(0)).current;
  const color = BAR_COLORS[index % BAR_COLORS.length];
  useEffect(() => {
    Animated.timing(anim, { toValue: percentage, duration: 800, delay: index * 120, useNativeDriver: false }).start();
  }, [percentage]);
  return (
    <View style={styles.dnaRow}>
      <Text style={[styles.dnaGenre, { color: isDark ? '#888' : '#666' }]}>{genre}</Text>
      <View style={[styles.dnaBarBg, { backgroundColor: isDark ? '#1A1A1A' : '#EBEBEB' }]}>
        <Animated.View style={[styles.dnaBarFill, {
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
        }]} />
      </View>
      <Text style={[styles.dnaPct, { color: color }]}>{percentage}%</Text>
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

  const heroBg     = isDark ? '#111' : '#FAFAF9';
  const heroBorder = isDark ? '#1A1A1A' : '#EBEBEB';


  if (loading) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: heroBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Mood Insights</Text>
        <View style={styles.headerRight} />
      </View>
      <View style={styles.centered}>
        <Text style={styles.loadingEmoji}>🧠</Text>
        <Text style={[styles.loadingTitle, { color: colors.ink }]}>Analysing your picks...</Text>
        <Text style={[styles.loadingSub, { color: colors.charcoal }]}>Kore is reading your taste patterns.</Text>
      </View>
    </SafeAreaView>
  );

  if (history.length < 3) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: heroBorder }]}>
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
      <View style={[styles.header, { borderBottomColor: heroBorder }]}>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: heroBg }]}>
      <View style={[styles.header, { borderBottomColor: heroBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Mood Insights</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero: archetype card ── */}
        {insights && (
          <Animated.View style={[styles.heroSection, {
            backgroundColor: heroBg,
            borderBottomColor: heroBorder,
            opacity: cardFade,
            transform: [{ translateY: cardSlide }],
          }]}>
            <View style={[styles.unlockBadge, {
              backgroundColor: isDark ? '#1A1208' : '#FFF0E0',
              borderColor: isDark ? '#4A3010' : '#F5D9B0',
            }]}>
              <Text style={styles.unlockBadgeText}>🔥 7 DAY UNLOCK</Text>
            </View>

            <View style={styles.archetypeRow}>
              <View style={[styles.archetypeIconBox, {
                backgroundColor: isDark ? '#1A1A2E' : '#EEEDFE',
                borderColor: isDark ? '#2E2E50' : '#AFA9EC',
              }]}>
                <Text style={styles.archetypeIconEmoji}>{getArchetypeIcon(insights.archetype)}</Text>
              </View>
              <View style={styles.archetypeTextCol}>
                <Text style={styles.archetypeSmallLabel}>YOUR ARCHETYPE</Text>
                <Text style={[styles.archetypeName, { color: isDark ? '#F5F5F5' : '#1A1A1A' }]}>{insights.archetype}</Text>
                <Text style={styles.archetypeTagline}>{insights.tagline}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Profile text card ── */}
        {insights?.profile && (
          <Animated.View style={[styles.profileCard, {
            backgroundColor: isDark ? '#161616' : '#F5F4F2',
            borderColor: isDark ? '#222' : '#E0DFDD',
            opacity: cardFade,
          }]}>
            <Text style={[styles.profileText, { color: isDark ? '#999' : '#666' }]}>{insights.profile}</Text>
          </Animated.View>
        )}

        {/* ── Pattern detected ── */}
        {insights?.hidden_pattern && (
          <Animated.View style={[styles.patternBox, {
            backgroundColor: isDark ? '#0F1A15' : '#E8F5EE',
            borderColor: isDark ? '#1A3028' : '#86EFAC',
            opacity: cardFade,
          }]}>
            <Text style={styles.patternEmoji}>🧬</Text>
            <Text style={[styles.patternText, { color: isDark ? '#5DCAA5' : '#0F6E56' }]}>{insights.hidden_pattern}</Text>
          </Animated.View>
        )}

        {/* ── Spirit anime card ── */}
        {insights?.spirit_anime && (
          <Animated.View style={{ opacity: cardFade }}>
            <View style={[styles.spiritCard, {
              backgroundColor: isDark ? '#111827' : '#EEF2FF',
              borderColor: isDark ? '#1E2D3D' : '#C7D2FE',
            }]}>
              <Text style={styles.spiritLabel}>✦ YOUR SPIRIT ANIME</Text>
              <View style={styles.spiritRow}>
                <View style={[styles.spiritIconBox, {
                  backgroundColor: isDark ? '#1A2535' : '#E0E7FF',
                  borderColor: isDark ? '#1E2D3D' : '#C7D2FE',
                }]}>
                  <Text style={styles.spiritIconEmoji}>{getSpiritAnimeIcon(insights.spirit_anime)}</Text>
                </View>
                <View style={styles.spiritTextCol}>
                  <Text style={[styles.spiritTitle, { color: isDark ? '#F5F5F5' : '#1A1A1A' }]}>{insights.spirit_anime}</Text>
                  <View style={styles.spiritPillRow}>
                    {topGenres.slice(0, 3).map((g, i) => (
                      <View key={i} style={[styles.spiritPill, {
                        backgroundColor: isDark ? '#1A1208' : '#FFF0E0',
                        borderColor: isDark ? '#4A3010' : '#F5D9B0',
                      }]}>
                        <Text style={styles.spiritPillText}>{g.genre}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Stats grid ── */}
        <Animated.View style={{ opacity: statsFade }}>
          <Text style={[styles.sectionMeta, { color: isDark ? '#444' : '#AAA' }]}>YOUR NUMBERS</Text>

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

          <View style={[styles.statsRow, { marginTop: 8 }]}>
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

          {/* ── Anime DNA ── */}
          {topGenres.length > 0 && (
            <>
              <Text style={[styles.sectionMeta, { color: isDark ? '#444' : '#AAA', paddingTop: 16, paddingBottom: 10 }]}>🧬 ANIME DNA</Text>
              {topGenres.map((g, i) => (
                <AnimatedDnaBar key={g.genre} genre={g.genre} percentage={g.percentage} index={i} isDark={isDark} />
              ))}
            </>
          )}

          {/* ── Share ── */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
            <Text style={styles.shareBtnText}>{sharing ? 'Sharing...' : '✦ Share my anime personality'}</Text>
          </TouchableOpacity>

        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn:     { width: 60 },
  backText:    { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  headerRight: { width: 60 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  loadingEmoji: { fontSize: 44 },
  loadingTitle: { fontSize: 20, fontWeight: '500', textAlign: 'center' },
  loadingSub:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn:     { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '500' },

  // Hero section
  heroSection:       { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, borderBottomWidth: 0.5 },
  unlockBadge:       { alignSelf: 'flex-start', borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14 },
  unlockBadgeText:   { fontSize: 10, color: '#E8630A', fontWeight: '500', letterSpacing: 0.5 },
  archetypeRow:      { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  archetypeIconBox:  { width: 64, height: 64, borderRadius: 16, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  archetypeIconEmoji:{ fontSize: 32 },
  archetypeTextCol:  { flex: 1 },
  archetypeSmallLabel: { fontSize: 9, color: '#7F77DD', letterSpacing: 0.8, fontWeight: '500', marginBottom: 4 },
  archetypeName:     { fontSize: 18, fontWeight: '500', lineHeight: 22, marginBottom: 5 },
  archetypeTagline:  { fontSize: 11, color: '#E8630A', fontStyle: 'italic' },

  // Profile card
  profileCard: { borderRadius: 12, borderWidth: 0.5, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 18, marginTop: 14 },
  profileText: { fontSize: 12, lineHeight: 20 },

  // Pattern box
  patternBox:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, borderWidth: 0.5, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 18, marginTop: 10 },
  patternEmoji: { fontSize: 16, flexShrink: 0 },
  patternText:  { flex: 1, fontSize: 11, lineHeight: 17 },

  // Spirit anime card
  spiritCard:      { borderRadius: 12, borderWidth: 0.5, padding: 14, marginHorizontal: 18, marginTop: 10 },
  spiritLabel:     { fontSize: 9, color: '#4D9FFF', letterSpacing: 0.8, fontWeight: '500', marginBottom: 8 },
  spiritRow:       { flexDirection: 'row', gap: 12, alignItems: 'center' },
  spiritIconBox:   { width: 48, height: 48, borderRadius: 10, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  spiritIconEmoji: { fontSize: 22 },
  spiritTextCol:   { flex: 1 },
  spiritTitle:     { fontSize: 15, fontWeight: '500', marginBottom: 6 },
  spiritPillRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spiritPill:      { borderWidth: 0.5, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  spiritPillText:  { fontSize: 10, color: '#E8630A' },

  // Stats
  sectionMeta: { fontSize: 9, letterSpacing: 0.8, paddingHorizontal: 18, paddingTop: 16 },
  statsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 18 },
  statCard:    { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 3 },
  statEmoji:   { fontSize: 20 },
  statVal:     { fontSize: 18, fontWeight: '500' },
  statLabel:   { fontSize: 10, textAlign: 'center' },

  // DNA
  dnaRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, marginBottom: 10 },
  dnaGenre:   { fontSize: 11, width: 90, flexShrink: 0 },
  dnaBarBg:   { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  dnaBarFill: { height: 5, borderRadius: 3 },
  dnaPct:     { fontSize: 10, width: 30, textAlign: 'right', fontWeight: '500' },

  // Share
  shareBtn:     { backgroundColor: '#E8630A', borderRadius: 12, padding: 13, marginHorizontal: 18, marginTop: 16, marginBottom: 20, alignItems: 'center' },
  shareBtnText: { fontSize: 13, color: '#fff', fontWeight: '500' },
});
