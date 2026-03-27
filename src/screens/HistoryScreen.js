// src/screens/HistoryScreen.js — "Your Anime"

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, SafeAreaView, TextInput, Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getHistory, clearHistory, getRatingSummary, getRatings } from '../storage/userPrefs';

const HISTORY_CAP = 50;

const MOOD_COLORS = {
  Chill:      '#4D9FFF',
  Hype:       '#FF6B35',
  Emotional:  '#C77DFF',
  Curious:    '#00C9A7',
  Nostalgic:  '#FFD166',
  Dark:       '#4A4A4A',
  Escapist:   '#FF6B9D',
  Social:     '#FFD166',
};

const RATING_CONFIG = {
  loved:    { label: 'Loved',      color: '#E8630A' },
  liked:    { label: 'Liked',      color: '#52A46E' },
  disliked: { label: 'Not for me', color: '#999'    },
};

function computeStats(history) {
  if (!history.length) return null;
  const moodCounts  = {};
  const genreCounts = {};

  history.forEach(entry => {
    const m = entry.mood || entry.vibe || 'Unknown';
    moodCounts[m] = (moodCounts[m] || 0) + 1;

    const genres = Array.isArray(entry.genre)
      ? entry.genre
      : Array.isArray(entry.genres)
        ? entry.genres
        : (entry.genre || '').split(',').map(g => g.trim()).filter(Boolean);
    genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
  });

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);

  const total = history.length;
  const dna = Object.entries(moodCounts)
    .map(([label, count]) => ({
      label,
      pct: Math.round((count / total) * 100),
      color: MOOD_COLORS[label] || '#999',
    }))
    .filter(d => d.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  return { total, topGenres, dna };
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Concept B anime card row ─────────────────────────────────────────────────
function AnimeCardRow({ title, cover, genres, ratingKey, onPress, colors, borderC }) {
  const cfg = RATING_CONFIG[ratingKey] || RATING_CONFIG.liked;
  const genreText = Array.isArray(genres)
    ? genres.slice(0, 2).join(' · ')
    : (genres || '');

  return (
    <TouchableOpacity
      style={[styles.cardRow, { borderBottomColor: borderC }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.coverThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: colors.chalk }]}>
          <Text style={{ fontSize: 18 }}>🎌</Text>
        </View>
      )}
      <View style={styles.cardRowInfo}>
        <Text style={[styles.cardRowTitle, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
        {genreText ? (
          <Text style={[styles.cardRowMeta, { color: colors.charcoal }]} numberOfLines={1}>{genreText}</Text>
        ) : null}
        <View style={[styles.ratingBadge, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[styles.ratingBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={[styles.rowArrow, { color: colors.charcoal }]}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Rated dropdown panel ─────────────────────────────────────────────────────
function RatedDropdown({ items, ratingMap, colors, cardBg, borderC, onSelectAnime }) {
  const [query, setQuery] = useState('');
  const filtered = items.filter(t => t.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={[styles.dropCard, { backgroundColor: cardBg, borderColor: borderC }]}>
      <View style={[styles.searchRow, { borderBottomColor: borderC }]}>
        <Text style={[styles.searchIcon, { color: colors.charcoal }]}>⌕</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.ink }]}
          placeholder="Search..."
          placeholderTextColor={colors.charcoal}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={{ color: colors.charcoal, fontSize: 14, paddingHorizontal: 4 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.dropCount, { color: colors.charcoal }]}>{filtered.length} anime</Text>
      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={[styles.emptyDropText, { color: colors.charcoal }]}>No results</Text>
        ) : (
          filtered.map((title, i) => {
            const entry = ratingMap[title] || {};
            return (
              <AnimeCardRow
                key={i}
                title={title}
                cover={entry.cover || null}
                genres={entry.genre || entry.genres || []}
                ratingKey={entry.ratingKey || 'liked'}
                onPress={() => onSelectAnime && onSelectAnime(entry.historyEntry || { title })}
                colors={colors}
                borderC={borderC}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Collapsible past recommendations ────────────────────────────────────────
function CollapsibleRecs({ history, colors, cardBg, borderC, onSelectAnime }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const [showAll, setShowAll] = useState(false);
  const chevAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(chevAnim, { toValue: open ? 0 : 1, duration: 200, useNativeDriver: false }).start();
    setOpen(v => !v);
  };

  const chevRot = chevAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const filtered = history.filter(e =>
    (e.title || '').toLowerCase().includes(query.toLowerCase())
  );
  const displayed = showAll ? filtered : filtered.slice(0, 5);

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC, padding: 0, overflow: 'hidden' }]}>
      <TouchableOpacity style={styles.collHeader} onPress={toggle} activeOpacity={0.7}>
        <Text style={[styles.cardLabel, { color: colors.ink, marginBottom: 0 }]}>
          Past recommendations{' '}
          <Text style={{ fontWeight: '400', color: colors.charcoal }}>· {history.length}</Text>
        </Text>
        <Animated.Text style={[styles.chevron, { color: colors.charcoal, transform: [{ rotate: chevRot }] }]}>▾</Animated.Text>
      </TouchableOpacity>

      {open && (
        <View style={[styles.collBody, { borderTopColor: borderC }]}>
          {/* Search */}
          <View style={[styles.searchRow, { borderBottomColor: borderC, marginHorizontal: -14, paddingHorizontal: 14, marginBottom: 0 }]}>
            <Text style={[styles.searchIcon, { color: colors.charcoal }]}>⌕</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.ink }]}
              placeholder="Search recommendations..."
              placeholderTextColor={colors.charcoal}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text style={{ color: colors.charcoal, fontSize: 14, paddingHorizontal: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {displayed.map((entry, i) => {
            const moodColor = MOOD_COLORS[entry.mood || entry.vibe] || colors.ember;
            const genres = Array.isArray(entry.genre) ? entry.genre : [];
            return (
              <TouchableOpacity
                key={i}
                style={[styles.cardRow, { borderBottomColor: borderC }]}
                onPress={() => onSelectAnime && onSelectAnime(entry)}
                activeOpacity={0.7}
              >
                {entry.cover ? (
                  <Image source={{ uri: entry.cover }} style={styles.coverThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.coverPlaceholder, { backgroundColor: colors.chalk }]}>
                    <Text style={{ fontSize: 18 }}>🎌</Text>
                  </View>
                )}
                <View style={styles.cardRowInfo}>
                  <Text style={[styles.cardRowTitle, { color: colors.ink }]} numberOfLines={1}>
                    {entry.title || 'Unknown'}
                  </Text>
                  <Text style={[styles.cardRowMeta, { color: colors.charcoal }]} numberOfLines={1}>
                    {entry.mood || entry.vibe}{'  ·  '}{formatDate(entry.date || entry.timestamp)}
                  </Text>
                  {genres.length > 0 && (
                    <View style={[styles.ratingBadge, { backgroundColor: moodColor + '18' }]}>
                      <Text style={[styles.ratingBadgeText, { color: moodColor }]}>
                        {genres.slice(0, 2).join(' · ')}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rowArrow, { color: colors.charcoal }]}>›</Text>
              </TouchableOpacity>
            );
          })}

          {filtered.length > 5 && (
            <TouchableOpacity style={styles.showAllBtn} onPress={() => setShowAll(v => !v)} activeOpacity={0.7}>
              <Text style={[styles.showAllText, { color: colors.ember }]}>
                {showAll ? 'Show less ↑' : `Show all ${filtered.length} ↓`}
              </Text>
            </TouchableOpacity>
          )}

          {filtered.length === 0 && (
            <Text style={[styles.emptyDropText, { color: colors.charcoal }]}>No results</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen({ onBack, onSelectAnime }) {
  const { colors, isDark } = useTheme();
  const [history, setHistory]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [ratings, setRatings]   = useState({ loved: [], liked: [], disliked: [] });
  const [ratingMap, setRatingMap] = useState({});
  const [openPill, setOpenPill] = useState(null);

  useEffect(() => {
    // Load history
    getHistory()
      .then(raw => {
        if (!Array.isArray(raw)) return;
        const capped = raw.slice(-HISTORY_CAP);
        setHistory([...capped].reverse());
        setStats(computeStats(capped));

        // Build a map of title → history entry for cover art lookup
        const map = {};
        capped.forEach(e => { if (e.title) map[e.title] = e; });
        return map;
      })
      .then(histMap => {
        // Load ratings and merge with history data
        return Promise.all([getRatingSummary(), getRatings()]).then(([summary, ratingsList]) => {
          setRatings(summary);
          // Build ratingMap: title → { cover, genre, ratingKey, historyEntry }
          const map = {};
          ratingsList.forEach(r => {
            map[r.title] = {
              ratingKey:    r.rating,
              cover:        histMap?.[r.title]?.cover  || null,
              genre:        histMap?.[r.title]?.genre  || [],
              historyEntry: histMap?.[r.title] || { title: r.title },
            };
          });
          setRatingMap(map);
        });
      })
      .catch(() => {});
  }, []);

  const togglePill = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpenPill(prev => prev === key ? null : key);
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    clearHistory().then(() => { setHistory([]); setStats(null); }).catch(() => {});
  };

  const hasHistory = history.length > 0;
  const totalRated = ratings.loved.length + ratings.liked.length + ratings.disliked.length;

  const cardBg  = isDark ? '#1A1A1A' : colors.chalk;
  const borderC = isDark ? '#2A2A2A' : colors.border;

  // Which list opens for each pill
  const pillLists = {
    rated:    [...ratings.loved, ...ratings.liked, ...ratings.disliked],
    loved:    ratings.loved,
    liked:    ratings.liked,
    notforme: ratings.disliked,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.snow }]}>

      {/* ── Nav ── */}
      <View style={[styles.navBar, { borderBottomColor: borderC }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.ink }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.ink }]}>Your Anime</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageSubtitle, { color: colors.charcoal }]}>Your taste. Your story.</Text>

        {/* ── Stat pills ── */}
        <View style={styles.pillStrip}>
          {[
            { key: 'rated',    label: 'Rated',      value: totalRated,              accent: false, icon: '📋' },
{ key: 'loved',    label: 'Loved',      value: ratings.loved.length,    accent: true,  icon: '❤️' },
{ key: 'liked',    label: 'Liked',      value: ratings.liked.length,    accent: false, icon: '👍' },
{ key: 'notforme', label: 'Not for me', value: ratings.disliked.length, accent: false, icon: '👻' },
          ].map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.pill, { backgroundColor: cardBg, borderColor: openPill === p.key ? colors.ember : borderC }]}
              onPress={() => togglePill(p.key)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16, marginBottom: 2 }}>{p.icon}</Text>
              <Text style={[styles.pillVal, { color: p.accent ? colors.ember : colors.ink }]}>{p.value}</Text>
              <Text style={[styles.pillLbl, { color: colors.charcoal }]}>{p.label}</Text>
              <Text style={[styles.pillArr, { color: colors.charcoal }]}>{openPill === p.key ? '▴' : '▾'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Dropdown panel ── */}
        {openPill && (
          <RatedDropdown
            items={pillLists[openPill] || []}
            ratingMap={ratingMap}
            colors={colors}
            cardBg={cardBg}
            borderC={borderC}
            onSelectAnime={onSelectAnime}
          />
        )}

        {/* ── Mood DNA ── */}
        {stats?.dna?.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
            <Text style={[styles.cardLabel, { color: colors.ink }]}>Mood DNA</Text>
            <Text style={[styles.cardSub, { color: colors.charcoal }]}>
              How your moods break down across {stats.total} recommendation{stats.total !== 1 ? 's' : ''}
            </Text>
            <View style={styles.dnaBarRow}>
              {stats.dna.map(d => (
                <View key={d.label} style={[styles.dnaSegment, { flex: d.pct, backgroundColor: d.color }]} />
              ))}
            </View>
            <View style={styles.dnaLegend}>
              {stats.dna.map(d => (
                <View key={d.label} style={[styles.dnaLegendPill, { borderColor: d.color, backgroundColor: d.color + '18' }]}>
                  <Text style={[styles.dnaLegendLabel, { color: d.color }]}>{d.label}</Text>
                  <Text style={[styles.dnaLegendPct, { color: d.color }]}>{d.pct}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Your Genres ── */}
        {stats?.topGenres?.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
            <Text style={[styles.cardLabel, { color: colors.ink }]}>Your Genres</Text>
            <View style={styles.genreRow}>
              {stats.topGenres.map(g => (
                <View key={g} style={[styles.genrePill, { backgroundColor: isDark ? '#2A2A2A' : '#F0EFED' }]}>
                  <Text style={[styles.genrePillText, { color: colors.charcoal }]}>{g}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Past Recommendations ── */}
        {hasHistory && (
          <CollapsibleRecs
            history={history}
            colors={colors}
            cardBg={cardBg}
            borderC={borderC}
            onSelectAnime={onSelectAnime}
          />
        )}

        {/* ── Empty state ── */}
        {!hasHistory && totalRated === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: borderC }]}>
            <Text style={[styles.emptyEmoji, { color: colors.ember }]}>✦</Text>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>No recommendations yet</Text>
            <Text style={[styles.emptyBody, { color: colors.charcoal }]}>
              Answer the three questions on the home screen and your story starts here.
            </Text>
          </View>
        )}

        {/* ── Clear ── */}
        {hasHistory && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear all history</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  navBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backBtn:   { width: 44, alignItems: 'flex-start' },
  backArrow: { fontSize: 22 },
  navTitle:  { fontSize: 16, fontWeight: '500' },
  container: { padding: 20 },
  pageSubtitle: { fontSize: 13, marginBottom: 16 },

  pillStrip: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  pill:      { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', borderWidth: 0.5 },
  pillVal:   { fontSize: 14, fontWeight: '600', marginBottom: 1 },
  pillLbl:   { fontSize: 9, textAlign: 'center' },
  pillArr:   { fontSize: 9, marginTop: 2 },

  dropCard:   { borderRadius: 12, borderWidth: 0.5, marginBottom: 10, overflow: 'hidden' },
  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5 },
  searchIcon: { fontSize: 15 },
  searchInput:{ flex: 1, fontSize: 13, paddingVertical: 0 },
  dropCount:  { fontSize: 11, paddingHorizontal: 14, paddingVertical: 6 },

  cardRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  coverThumb:  { width: 40, height: 56, borderRadius: 6, flexShrink: 0 },
  coverPlaceholder: { width: 40, height: 56, borderRadius: 6, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  cardRowInfo: { flex: 1 },
  cardRowTitle:{ fontSize: 13, fontWeight: '500', marginBottom: 2 },
  cardRowMeta: { fontSize: 11, marginBottom: 4 },
  ratingBadge: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20 },
  ratingBadgeText: { fontSize: 10, fontWeight: '500' },
  rowArrow:    { fontSize: 16 },

  emptyDropText: { fontSize: 12, textAlign: 'center', paddingVertical: 20, paddingHorizontal: 14 },

  card:      { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5 },
  cardLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  cardSub:   { fontSize: 11, marginBottom: 12, lineHeight: 16 },

  dnaBarRow:  { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  dnaSegment: { height: '100%' },
  dnaLegend:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dnaLegendPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, borderWidth: 0.5 },
  dnaLegendLabel: { fontSize: 11, fontWeight: '500' },
  dnaLegendPct:   { fontSize: 11, opacity: 0.7 },

  genreRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  genrePill:     { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  genrePillText: { fontSize: 12 },

  collHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  chevron:    { fontSize: 14 },
  collBody:   { borderTopWidth: 0.5, paddingHorizontal: 14, paddingBottom: 6 },

  showAllBtn:  { paddingVertical: 12, alignItems: 'center' },
  showAllText: { fontSize: 12, fontWeight: '500' },

  clearBtn:  { alignItems: 'center', paddingVertical: 14 },
  clearText: { fontSize: 12, color: '#999' },

  emptyCard:  { borderRadius: 12, borderWidth: 0.5, padding: 36, alignItems: 'center', marginTop: 20 },
  emptyEmoji: { fontSize: 30, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  emptyBody:  { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});