import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Animated, Share,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getHistory, getRatings, getFavoriteGenres } from '../storage/userPrefs';
import { generateProfileCard } from '../services/claude';

const DNA_COLORS = ['#E8630A', '#7F77DD', '#1D9E75', '#D4537E', '#4D9FFF', '#E8C87A'];
const PARTICLE_COLORS = ['#4D9FFF', '#7F77DD', '#E8630A', '#1D9E75', '#D4537E'];

function getArchetypeIcon(archetype = '') {
  const a = archetype.toLowerCase();
  if (a.includes('hype') || a.includes('action') || a.includes('catalyst')) return '⚡';
  if (a.includes('dark') || a.includes('phantom') || a.includes('shadow') || a.includes('magic')) return '🌑';
  if (a.includes('philosopher') || a.includes('mind') || a.includes('thinker')) return '🔮';
  if (a.includes('hero') || a.includes('warrior') || a.includes('fighter')) return '⚔️';
  if (a.includes('romantic') || a.includes('heart') || a.includes('emotion')) return '💫';
  if (a.includes('chill') || a.includes('explorer') || a.includes('drift')) return '🌊';
  if (a.includes('chaos') || a.includes('seeker')) return '🌀';
  return '✨';
}

function getRank(streak) {
  if (streak >= 45) return { label: 'Legend', color: '#E8630A' };
  if (streak >= 25) return { label: 'Devotee', color: '#7F77DD' };
  if (streak >= 14) return { label: 'Watcher', color: '#4D9FFF' };
  return { label: 'Early Watcher', color: '#1D9E75' };
}

function SpiderChart({ data }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 70;
  const n = data.length;
  if (n < 3) return null;
  const maxPct = Math.max(...data.map(d => d.percentage), 1);

  function getPoint(index, radius) {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  const rings = [0.33, 0.66, 1].map(scale => {
    const r = maxR * scale;
    return Array.from({ length: n }, (_, i) => getPoint(i, r))
      .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  const axes = Array.from({ length: n }, (_, i) => {
    const o = getPoint(i, maxR);
    return { x2: o.x.toFixed(1), y2: o.y.toFixed(1) };
  });

  const dataPts = data.map((d, i) => {
    const r = (d.percentage / maxPct) * maxR;
    return getPoint(i, r);
  });

  const labelPts = data.map((d, i) => {
    const pt = getPoint(i, maxR + 18);
    return { ...pt, label: d.genre.length > 8 ? d.genre.slice(0, 7) + '.' : d.genre };
  });

  return (
    <Svg width={size} height={size}>
      {rings.map((pts, i) => (
        <Polygon key={`r${i}`} points={pts} fill="none" stroke="#1E2D3D" strokeWidth="0.5" />
      ))}
      {axes.map((a, i) => (
        <Line key={`a${i}`} x1={cx} y1={cy} x2={a.x2} y2={a.y2} stroke="#1E2D3D" strokeWidth="0.5" />
      ))}
      <Polygon
        points={dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
        fill="rgba(77,159,255,0.13)"
        stroke="#4D9FFF"
        strokeWidth="1.5"
      />
      {dataPts.map((p, i) => (
        <Circle key={`d${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill={DNA_COLORS[i % DNA_COLORS.length]} />
      ))}
      {labelPts.map((p, i) => (
        <SvgText key={`l${i}`} x={p.x.toFixed(1)} y={p.y.toFixed(1)} fontSize="8" fill="#666" textAnchor="middle" alignmentBaseline="middle">
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function Particle({ color, left, duration, delay }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration, delay, useNativeDriver: true }).start(() => run());
    };
    run();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', bottom: 0, left: `${left}%`,
      width: 3, height: 3, borderRadius: 1.5,
      backgroundColor: color,
      opacity: anim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.7, 0.3, 0] }),
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -130] }) }],
    }} />
  );
}

export default function ProfileCardScreen({ onBack, streak = 0 }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [card,    setCard]    = useState(null);
  const [dnaData, setDnaData] = useState([]);
  const [history, setHistory] = useState([]);
  const [sharing, setSharing] = useState(false);

  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const statsFade = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-300)).current;

  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      left: Math.round((i / 20) * 100),
      duration: 3200 + i * 300,
      delay: i * 250,
    }))
  ).current;

  useEffect(() => {
    // Float up and down
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: -8, duration: 2000, useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ])).start();

    // Glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ])).start();

    // Shimmer sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 400, duration: 2800, useNativeDriver: true }),
        Animated.delay(1000),
      ])
    ).start();
  }, []);

  useEffect(() => { loadCard(); }, []);

  const loadCard = async () => {
    setLoading(true); setError(null);
    cardFade.setValue(0); cardSlide.setValue(30); statsFade.setValue(0);
    try {
      const [hist, ratings, genres] = await Promise.all([
        getHistory(), getRatings(), getFavoriteGenres(),
      ]);
      setHistory(hist);
      const genreCount = {};
      hist.forEach(h => { (h.genre || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }); });
      const total = Object.values(genreCount).reduce((a, b) => a + b, 0) || 1;
      const dna = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([genre, count]) => ({ genre, percentage: Math.round((count / total) * 100) }));
      setDnaData(dna);
      const result = await generateProfileCard({ history: hist, ratings, favoriteGenres: genres, streak });
      setCard(result);
      Animated.sequence([
        Animated.parallel([
          // FIX 2: Switched useNativeDriver from false to true to stop the crash
          Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(cardSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
        // FIX 2: Switched useNativeDriver from false to true to stop the crash
        Animated.timing(statsFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (!card) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      await Share.share({
        message: `My Kore anime profile:\n\n${card.archetype}\n"${card.tagline}"\n\nSpirit anime: ${card.spirit_anime}\n\n🔥 ${streak} day streak · コレ Kore`,
        title: 'My Kore Profile Card',
      });
    } catch {}
    finally { setSharing(false); }
  };

  const rank = getRank(streak);

  if (loading) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile Card</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.centered}>
        <Text style={{ fontSize: 44 }}>💠</Text>
        <Text style={[styles.loadTitle, { color: colors.ink }]}>Building your card...</Text>
        <Text style={[styles.loadSub, { color: colors.charcoal }]}>Kore is reading your taste patterns.</Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile Card</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.centered}>
        <Text style={[styles.loadTitle, { color: colors.ember }]}>Something went wrong</Text>
        <Text style={[styles.loadSub, { color: colors.charcoal }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.ink }]} onPress={loadCard}>
          <Text style={[styles.retryTxt, { color: colors.snow }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (!card) return null;

  const icon = getArchetypeIcon(card.archetype);
  const glowOp = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.5] });
  const glowSc = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile Card</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Unlock badge */}
        <View style={styles.unlockBadge}>
          <Text style={{ fontSize: 12 }}>💠</Text>
          <Text style={styles.unlockTxt}>14 DAY UNLOCK</Text>
        </View>

        {/* Floating card */}
        <Animated.View style={[styles.cardWrap, {
          opacity: cardFade,
          transform: [
            { translateY: cardSlide },
            { translateY: floatAnim },
          ],
        }]}>
          <View style={styles.card}>

            {/* Rainbow gradient stripe */}
            <LinearGradient
              colors={['#4D9FFF', '#7F77DD', '#E8630A', '#1D9E75', '#D4537E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rainbowStripe}
            />

            {/* Holographic overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(77,159,255,0.05)', 'rgba(127,119,221,0.05)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Shimmer sweep */}
            <Animated.View
              style={[styles.shimmer, { transform: [{ translateX: shimmerAnim }] }]}
              pointerEvents="none"
            />

            {/* Particles */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {particles.map((p, i) => <Particle key={i} {...p} />)}
            </View>

            <View style={styles.cardInner}>

              {/* Logo row */}
              <View style={styles.logoRow}>
                <Text style={styles.logo}>コレ · KORE</Text>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {['#4D9FFF','#7F77DD','#E8630A'].map((c, i) => (
                    <View key={i} style={[styles.diamond, { backgroundColor: c }]} />
                  ))}
                </View>
              </View>

              {/* Archetype hero */}
              <View style={styles.hero}>
                <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Animated.View style={[styles.iconGlow, { opacity: glowOp, transform: [{ scale: glowSc }] }]} />
                  <View style={styles.iconBox}>
                    <Text style={{ fontSize: 40 }}>{icon}</Text>
                  </View>
                </View>
                <Text style={styles.archetypeLabel}>YOUR ARCHETYPE</Text>
                <Text style={styles.archetypeName}>{card.archetype}</Text>
                <Text style={styles.tagline}>{card.tagline}</Text>
              </View>

              <View style={styles.divider} />

              {/* DNA Spider chart */}
              {dnaData.length >= 3 && (
                <View style={styles.dnaSection}>
                  <Text style={styles.dnaLabel}>🧬 ANIME DNA</Text>
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <SpiderChart data={dnaData} />
                  </View>
                  <View style={styles.legendGrid}>
                    {dnaData.map((d, i) => (
                      <View key={d.genre} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: DNA_COLORS[i % DNA_COLORS.length] }]} />
                        <Text style={styles.legendName} numberOfLines={1}>{d.genre}</Text>
                        <Text style={[styles.legendPct, { color: DNA_COLORS[i % DNA_COLORS.length] }]}>{d.percentage}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.divider} />

              {/* Spirit anime */}
              {card.spirit_anime && (
                <View style={styles.spiritRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spiritLabel}>✦ SPIRIT ANIME</Text>
                    <Text style={styles.spiritTitle}>{card.spirit_anime}</Text>
                  </View>
                  <View style={styles.spiritBox}>
                    <Text style={{ fontSize: 22 }}>{icon}</Text>
                  </View>
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.rankDot, { backgroundColor: rank.color }]} />
                  <Text style={[styles.rankTxt, { color: rank.color }]}>{rank.label}</Text>
                </View>
                <Text style={styles.serial}>{card.serial_number || 'KP-2026-0001'}</Text>
              </View>

            </View>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[styles.statsRow, { opacity: statsFade }]}>
          {[
            { val: streak, label: 'Day streak' },
            { val: history.length, label: 'Total picks' },
            { val: '14d', label: 'Unlocked' },
          ].map((s, i) => (
            <View key={i} style={styles.statBox}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={{ opacity: statsFade }}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
            <Text style={styles.shareTxt}>{sharing ? 'Sharing...' : '✦ Share my profile card'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.regenBtn, { borderColor: colors.border }]} onPress={loadCard}>
            <Text style={[styles.regenTxt, { color: colors.charcoal }]}>Regenerate card</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  backBtn:     { width: 60 },
  backText:    { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '500' },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  loadTitle:   { fontSize: 20, fontWeight: '500', textAlign: 'center' },
  loadSub:     { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn:    { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 8 },
  retryTxt:    { fontSize: 14, fontWeight: '500' },
  scroll:      { padding: 20 },

  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, alignSelf: 'flex-start', backgroundColor: '#0A1628', borderWidth: 0.5, borderColor: '#1E2D3D', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  unlockTxt:   { fontSize: 10, color: '#4D9FFF', fontWeight: '500', letterSpacing: 0.5 },

  cardWrap:      { marginBottom: 14 },
  card:          { backgroundColor: '#0D1117', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1E2D3D' },
  rainbowStripe: { height: 3 },
  shimmer:       { position: 'absolute', top: 0, left: 0, width: 100, height: '100%', backgroundColor: 'rgba(255,255,255,0.04)', transform: [{ skewX: '-15deg' }] },
  cardInner:     { padding: 20 },

  logoRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  logo:     { fontSize: 10, color: '#4D9FFF', fontWeight: '700', letterSpacing: 2 },
  diamond:  { width: 8, height: 8, borderRadius: 1, transform: [{ rotate: '45deg' }] },

  hero:           { alignItems: 'center', marginBottom: 4 },
  iconGlow:       { position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: '#4D9FFF' },
  iconBox:        { width: 88, height: 88, borderRadius: 22, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E2D3D', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  archetypeLabel: { fontSize: 9, color: '#4D9FFF', letterSpacing: 1, fontWeight: '500', marginBottom: 8 },
  archetypeName:  { fontSize: 22, fontWeight: '500', color: '#F5F5F5', textAlign: 'center', lineHeight: 28, marginBottom: 6 },
  tagline:        { fontSize: 12, color: '#7F77DD', fontStyle: 'italic', textAlign: 'center' },

  divider: { height: 0.5, backgroundColor: '#1E2D3D', marginVertical: 16 },

  dnaSection:  { marginBottom: 2 },
  dnaLabel:    { fontSize: 9, color: '#444', letterSpacing: 0.8, marginBottom: 14, textAlign: 'center' },
  legendGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
  legendDot:   { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  legendName:  { flex: 1, fontSize: 11, color: '#666' },
  legendPct:   { fontSize: 10, fontWeight: '500' },

  spiritRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  spiritLabel: { fontSize: 9, color: '#444', letterSpacing: 0.8, marginBottom: 4 },
  spiritTitle: { fontSize: 14, fontWeight: '500', color: '#F5F5F5' },
  spiritBox:   { width: 44, height: 44, borderRadius: 10, backgroundColor: '#161B22', borderWidth: 0.5, borderColor: '#1E2D3D', alignItems: 'center', justifyContent: 'center' },

  footer:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: '#1E2D3D', paddingTop: 12, marginTop: 16 },
  rankDot: { width: 6, height: 6, borderRadius: 3 },
  rankTxt: { fontSize: 10, fontWeight: '500' },
  serial:  { fontSize: 9, color: '#2A2A2A', fontFamily: 'monospace' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox:  { flex: 1, backgroundColor: '#111', borderRadius: 12, borderWidth: 0.5, borderColor: '#1A1A1A', padding: 12, alignItems: 'center', gap: 4 },
  statVal:  { fontSize: 18, fontWeight: '500', color: '#F5F5F5' },
  statLabel:{ fontSize: 10, color: '#444', textAlign: 'center' },

  shareBtn:  { padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8, backgroundColor: '#4D9FFF' },
  shareTxt:  { fontSize: 15, fontWeight: '500', color: '#fff' },
  regenBtn:  { padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  regenTxt:  { fontSize: 14 },
});