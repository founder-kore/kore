import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  ScrollView,
} from 'react-native';
import { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { saveFavoriteGenres } from '../storage/userPrefs';

const QUICK_GENRES = [
  { label: 'Action',        emoji: '⚔️' },
  { label: 'Romance',       emoji: '💕' },
  { label: 'Comedy',        emoji: '😂' },
  { label: 'Psychological', emoji: '🧠' },
  { label: 'Fantasy',       emoji: '🐉' },
  { label: 'Sci-Fi',        emoji: '🚀' },
  { label: 'Horror',        emoji: '👻' },
  { label: 'Slice of Life', emoji: '🌸' },
  { label: 'Mystery',       emoji: '🔍' },
  { label: 'Isekai',        emoji: '🌀' },
  { label: 'Sports',        emoji: '🏆' },
  { label: 'Historical',    emoji: '⛩️' },
];

// ─── MILESTONE DETAIL CONTENT ─────────────────────────────────────────────────
// Rules applied:
// 1. No mentions of Claude anywhere
// 2. Affiliate tiers (7d, 30d) explicitly mention a discount code
// 3. No early unlock hints — that's a surprise at day 25 / 45
const MILESTONE_DETAILS = {
  mood_insights: {
    icon:        '🧠',
    title:       'CDJapan + Mood Insights',
    days:        7,
    color:       '#E8630A',
    tagline:     'A week of picks. Two rewards.',
    description: 'Seven days unlocks a CDJapan discount code for physical anime, plus a written personality profile built from everything you\'ve watched.',
    unlocks: [
      { icon: '🎫', text: 'CDJapan discount code — use it on Blu-rays, manga, OSTs or figures shipped from Japan' },
      { icon: '🧠', text: 'Mood Insights — your anime archetype, viewing pattern, and genre DNA in a shareable card' },
      { icon: '📤', text: 'Shareable — screenshot and send your profile' },
    ],
  },

  hidden_gem: {
    icon:        '💎',
    title:       'Profile Card',
    days:        14,
    color:       '#1D9E75',
    tagline:     'Two weeks in. Kore knows who you are.',
    description: 'Fourteen days of picks generates your holographic identity card — archetype, genre DNA bars, spirit anime and rank badge. Built from your actual data.',
    unlocks: [
      { icon: '🃏', text: 'Holographic profile card — dark card, rainbow stripe, your archetype and rank badge' },
      { icon: '🧬', text: 'Animated DNA bars + spirit anime — your taste visualised' },
      { icon: '📤', text: 'Shareable — post your archetype and card' },
    ],
  },

  kore_score: {
    icon:        '⚔️',
    title:       'Kore Score + NordVPN',
    days:        30,
    color:       '#E8630A',
    tagline:     'Your RPG anime identity card.',
    description: 'Thirty days unlocks Kore Score — a premium dark RPG card with cinematic reveal — plus a NordVPN discount code for anime blocked in your region.',
    unlocks: [
      { icon: '🃏', text: 'Dark RPG card — archetype, tagline, DNA bars, hidden obsession, spirit anime' },
      { icon: '🏅', text: 'Rank system: Newcomer → Watcher → Devotee → Legend' },
      { icon: '🎫', text: 'NordVPN discount code — access anime that\'s geo-locked in your country' },
    ],
  },

  directors_cut: {
    icon:        '👑',
    title:       'Era Lock + Amazon Shelf',
    days:        60,
    color:       '#7F77DD',
    tagline:     'Two months. Two big unlocks.',
    description: 'Sixty days unlocks Era Lock — pin all recommendations to one anime decade — and your personalised Amazon shelf built from every anime you\'ve loved. All items come with a discount code delivered in the app.',
    unlocks: [
      { icon: '📅', text: 'Era Lock — choose a decade (70s–20s) and every pick stays in that era' },
      { icon: '📦', text: 'Amazon anime shelf — manga volumes, art books and OSTs matched to your loved anime' },
      { icon: '🎫', text: 'Discount codes on all shelf items — delivered directly in the app' },
    ],
  },
};

const MILESTONE_ROWS = [
  { id: 'mood_insights', days: 7,  icon: '🧠', label: 'CDJapan + Mood Insights', sub: 'Discount code + personality profile' },
  { id: 'hidden_gem',    days: 14, icon: '💎', label: 'Profile Card',             sub: 'Holographic anime identity card' },
  { id: 'kore_score',    days: 30, icon: '⚔️', label: 'Kore Score + NordVPN',     sub: 'RPG card + discount code' },
  { id: 'directors_cut', days: 60, icon: '👑', label: 'Era Lock + Amazon Shelf',   sub: 'Decade lock + personalised shelf' },
];

const slides = [
  {
    id:       'welcome',
    emoji:    '🌸',
    title:    'One anime.\nRight now.',
    subtitle: 'Answer 3 questions about your mood. Get exactly one anime. No browsing, no overwhelm — just the right pick.',
  },
  {
    id:       'how',
    emoji:    '🎲',
    title:    'Your vibe,\nyour pick.',
    subtitle: 'Pick your vibe, your story type, and how much you\'re committing. Three questions, one decision, one anime.',
  },
  {
    id:           'milestones',
    emoji:        '🔥',
    title:        'Use it daily.\nUnlock everything.',
    subtitle:     'Kore gets better every day you use it. Keep your streak alive and unlock real rewards — not badges, actual things. Tap any row to see exactly what you get.',
    isMilestones: true,
  },
  {
    id:            'genres',
    emoji:         '✨',
    title:         'Quick taste\nsetup.',
    subtitle:      'Tap genres you like. Takes 10 seconds and makes your first recommendation way better.',
    isGenrePicker: true,
  },
];

// ─── MILESTONE DETAIL MODAL ───────────────────────────────────────────────────

function MilestoneDetailModal({ milestone, onClose, colors }) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useState(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: false }),
    ]).start();
  });

  const close = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: false }),
    ]).start(() => onClose());
  };

  const detail = MILESTONE_DETAILS[milestone.id];
  if (!detail) return null;

  return (
    <Animated.View style={[mStyles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={mStyles.backdrop} onPress={close} activeOpacity={1} />
      <Animated.View style={[mStyles.sheet, { backgroundColor: colors.snow, transform: [{ translateY: slideAnim }] }]}>
        <View style={[mStyles.handle, { backgroundColor: colors.border }]} />

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

          {/* Header */}
          <View style={mStyles.sheetHeader}>
            <View style={[mStyles.iconCircle, { backgroundColor: detail.color + '20' }]}>
              <Text style={mStyles.iconLarge}>{detail.icon}</Text>
            </View>
            <View style={mStyles.headerText}>
              <View style={[mStyles.dayBadge, { backgroundColor: colors.ink }]}>
                <Text style={mStyles.dayBadgeText}>{detail.days} day streak</Text>
              </View>
              <Text style={[mStyles.sheetTitle,   { color: colors.ink }]}>{detail.title}</Text>
              <Text style={[mStyles.sheetTagline, { color: detail.color }]}>{detail.tagline}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[mStyles.sheetDesc, { color: colors.charcoal }]}>{detail.description}</Text>

          {/* What it unlocks */}
          <Text style={[mStyles.unlocksLabel, { color: colors.charcoal }]}>WHAT YOU UNLOCK</Text>
          {detail.unlocks.map((item, i) => (
            <View
              key={i}
              style={[mStyles.unlockRow, {
                borderBottomColor:  colors.border,
                borderBottomWidth: i < detail.unlocks.length - 1 ? 0.5 : 0,
              }]}
            >
              <Text style={mStyles.unlockIcon}>{item.icon}</Text>
              <Text style={[mStyles.unlockText, { color: colors.ink }]}>{item.text}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[mStyles.closeBtn, { backgroundColor: colors.ink }]}
            onPress={close}
          >
            <Text style={[mStyles.closeBtnText, { color: colors.snow }]}>Got it</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const mStyles = StyleSheet.create({
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, justifyContent: 'flex-end' },
  backdrop:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, maxHeight: '88%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader:  { flexDirection: 'row', gap: 14, marginBottom: 14, alignItems: 'flex-start' },
  iconCircle:   { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconLarge:    { fontSize: 28 },
  headerText:   { flex: 1, gap: 6 },
  dayBadge:     { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20 },
  dayBadgeText: { fontSize: 10, color: '#F5F5F5', fontWeight: '500' },
  sheetTitle:   { fontSize: 20, fontWeight: '500', lineHeight: 26 },
  sheetTagline: { fontSize: 13, fontWeight: '500', lineHeight: 20 },
  sheetDesc:    { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  unlocksLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 1.5, marginBottom: 12 },
  unlockRow:    { flexDirection: 'row', gap: 12, paddingVertical: 14, alignItems: 'flex-start' },
  unlockIcon:   { fontSize: 18, marginTop: 1 },
  unlockText:   { fontSize: 13, lineHeight: 20, flex: 1 },
  closeBtn:     { marginTop: 20, marginBottom: 10, padding: 16, borderRadius: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '500' },
});

// ─── MAIN ONBOARDING SCREEN ───────────────────────────────────────────────────

export default function OnboardingScreen({ onDone }) {
  const { colors } = useTheme();
  const [currentSlide,      setCurrentSlide]      = useState(0);
  const [selectedGenres,    setSelectedGenres]    = useState([]);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isLast = currentSlide === slides.length - 1;
  const slide  = slides[currentSlide];

  const goNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      if (selectedGenres.length > 0) await saveFavoriteGenres(selectedGenres);
      onDone();
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: -20, duration: 160, useNativeDriver: false }),
    ]).start(() => {
      setCurrentSlide(prev => prev + 1);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    });
  };

  const toggleGenre = (genre) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={styles.inner}>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: i <= currentSlide ? colors.ember : colors.border },
                i === currentSlide && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {/* Slide content */}
        <Animated.View style={[styles.slideWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.slideEmoji}>{slide.emoji}</Text>
          <Text style={[styles.slideTitle,    { color: colors.ink }]}>{slide.title}</Text>
          <Text style={[styles.slideSubtitle, { color: colors.charcoal }]}>{slide.subtitle}</Text>

          {/* ── Milestone rows ── */}
          {slide.isMilestones && (
            <View style={styles.milestonesWrap}>
              {MILESTONE_ROWS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.milestoneRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedMilestone(m);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.milestoneDaysBadge, { backgroundColor: colors.ink }]}>
                    <Text style={styles.milestoneDaysText}>{m.days}d</Text>
                  </View>
                  <Text style={styles.milestoneIcon}>{m.icon}</Text>
                  <View style={styles.milestoneLabelWrap}>
                    <Text style={[styles.milestoneLabel, { color: colors.ink }]}>{m.label}</Text>
                    <Text style={[styles.milestoneSub,   { color: colors.charcoal }]}>{m.sub}</Text>
                  </View>
                  <Text style={[styles.milestoneChevron, { color: colors.charcoal }]}>›</Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.tapHint, { color: colors.charcoal }]}>
                Tap any row to see exactly what you unlock
              </Text>
            </View>
          )}

          {/* ── Genre picker ── */}
          {slide.isGenrePicker && (
            <View style={styles.genrePickerWrap}>
              <View style={styles.genreGrid}>
                {QUICK_GENRES.map(genre => {
                  const selected = selectedGenres.includes(genre.label);
                  return (
                    <TouchableOpacity
                      key={genre.label}
                      style={[
                        styles.genreChip,
                        { borderColor: colors.border, backgroundColor: colors.chalk },
                        selected && { backgroundColor: colors.ember, borderColor: colors.ember },
                      ]}
                      onPress={() => toggleGenre(genre.label)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.genreChipEmoji}>{genre.emoji}</Text>
                      <Text style={[
                        styles.genreChipText, { color: colors.charcoal },
                        selected && { color: '#fff', fontWeight: '600' },
                      ]}>
                        {genre.label}
                      </Text>
                      {selected && <Text style={styles.genreChipCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedGenres.length > 0 && (
                <View style={[styles.selectedNote, { backgroundColor: colors.chalk, borderColor: colors.ember }]}>
                  <Text style={[styles.selectedNoteText, { color: colors.ember }]}>
                    {selectedGenres.length} genre{selectedGenres.length !== 1 ? 's' : ''} selected ✓
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: colors.ink }]} onPress={goNext}>
            <Text style={[styles.ctaBtnText, { color: colors.snow }]}>
              {isLast
                ? selectedGenres.length > 0 ? 'Save and start →' : 'Start without genres →'
                : 'Continue →'}
            </Text>
          </TouchableOpacity>
          {isLast && (
            <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
              <Text style={[styles.skipBtnText, { color: colors.charcoal }]}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Milestone detail modal */}
      {selectedMilestone && (
        <MilestoneDetailModal
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner:     { flex: 1, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 32, justifyContent: 'space-between' },

  dotsRow:           { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 8 },
  progressDot:       { width: 6, height: 6, borderRadius: 3 },
  progressDotActive: { width: 20 },

  slideWrap:    { flex: 1, justifyContent: 'center', paddingTop: 16 },
  slideEmoji:   { fontSize: 52, marginBottom: 20, textAlign: 'center' },
  slideTitle:   { fontSize: 34, fontWeight: '500', lineHeight: 42, marginBottom: 14, textAlign: 'center' },
  slideSubtitle:{ fontSize: 15, lineHeight: 24, textAlign: 'center', marginBottom: 24 },

  milestonesWrap:    { gap: 10 },
  milestoneRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  milestoneDaysBadge:{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
  milestoneDaysText: { fontSize: 10, color: '#F5F5F5', fontWeight: '500' },
  milestoneIcon:     { fontSize: 20 },
  milestoneLabelWrap:{ flex: 1 },
  milestoneLabel:    { fontSize: 13, fontWeight: '500' },
  milestoneSub:      { fontSize: 11, marginTop: 2 },
  milestoneChevron:  { fontSize: 22, fontWeight: '300' },
  tapHint:           { fontSize: 11, textAlign: 'center', opacity: 0.5, marginTop: 4 },

  genrePickerWrap: { alignItems: 'center', gap: 14 },
  genreGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  genreChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1.5 },
  genreChipEmoji:  { fontSize: 14 },
  genreChipText:   { fontSize: 13 },
  genreChipCheck:  { fontSize: 11, color: '#fff', fontWeight: '700' },
  selectedNote:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5 },
  selectedNoteText:{ fontSize: 13, fontWeight: '500' },

  ctaWrap:    { gap: 10, paddingTop: 16 },
  ctaBtn:     { padding: 18, borderRadius: 14, alignItems: 'center' },
  ctaBtnText: { fontSize: 16, fontWeight: '500' },
  skipBtn:    { alignItems: 'center', padding: 10 },
  skipBtnText:{ fontSize: 14 },
});