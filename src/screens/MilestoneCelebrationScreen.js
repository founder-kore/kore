import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, Animated, Platform,
} from 'react-native';
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';

// Milestone celebration configs — each one has its own visual language
const CELEBRATION_CONFIG = {
  mood_insights: {
    bg:          '#0F0F1A',
    accentColor: '#7F77DD',
    badge:       '🧠',
    badgeLabel:  '7 Day Streak',
    headline:    'Mood Insights unlocked',
    body:        'You\'ve used Kore every day for a week. Claude now has enough data to build your anime personality profile. Find out what kind of viewer you actually are.',
    earlyLabel:  null,
    primaryLabel: 'See my profile →',
    primaryAction: 'mood_insights',
    secondaryLabel: 'Back to home',
    secondaryAction: 'home',
  },
  hidden_gem: {
    bg:          '#041A12',
    accentColor: '#1D9E75',
    badge:       '💎',
    badgeLabel:  '14 Day Streak',
    headline:    'Your profile card is ready',
    body:        'Two weeks in. Kore knows your taste well enough to build a holographic identity card — your anime archetype, DNA bars, spirit anime. Built specifically from your 14 days of picks.',
    earlyLabel:  null,
    primaryLabel: 'See my card →',
    primaryAction: 'profile_card',
    secondaryLabel: 'Back to home',
    secondaryAction: 'home',
  },
  kore_score: {
    bg:          '#1A0E00',
    accentColor: '#E8630A',
    badge:       '⚔️',
    badgeLabel:  null,               // set dynamically based on early unlock
    headline:    'Kore Score arrived early',
    body:        'You were supposed to get this at 30 days. You earned it 5 days ahead of schedule. Your Kore Score is a full RPG identity card — archetype, level, rank, and a NordVPN deal for the anime you can\'t access.',
    earlyLabel:  '30 Day Reward — 5 Days Early',
    primaryLabel: 'See my Kore Score →',
    primaryAction: 'kore_score',
    secondaryLabel: 'Claim NordVPN deal',
    secondaryAction: 'nordvpn',
  },
  directors_cut: {
    bg:          '#0E0A1A',
    accentColor: '#7F77DD',
    badge:       '👑',
    badgeLabel:  null,               // set dynamically
    headline:    'Your 60-day rewards dropped early',
    body:        '45 days without missing one. That\'s not a streak anymore — that\'s a habit. Era Lock and your personalised Amazon anime shelf are both ready.',
    earlyLabel:  '60 Day Reward — 15 Days Early',
    primaryLabel: 'Explore Era Lock →',
    primaryAction: 'era_lock',
    secondaryLabel: 'See my anime shelf',
    secondaryAction: 'amazon_shelf',
  },
};

function StarParticle({ delay, x, y, color }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      opacity: anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }),
      }],
    }}>
      <Text style={{ fontSize: 14, color }}>{['✦', '✧', '⋆', '·'][Math.floor(x * 4) % 4]}</Text>
    </Animated.View>
  );
}

export default function MilestoneCelebrationScreen({ milestone, streak, onContinue }) {
  const { colors } = useTheme();
  const config = CELEBRATION_CONFIG[milestone?.id];

  // Animation refs
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const badgeAnim  = useRef(new Animated.Value(0.6)).current;
  const titleAnim  = useRef(new Animated.Value(0)).current;
  const bodyAnim   = useRef(new Animated.Value(0)).current;
  const btnAnim    = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;

  const particles = useRef(Array.from({ length: 10 }, (_, i) => ({
    key: i,
    delay: i * 80 + 200,
    x: 10 + (i * 8.5) % 80,
    y: 15 + (i * 7.3) % 30,
  }))).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      // Background fades in
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      // Badge pops
      Animated.spring(badgeAnim, { toValue: 1, tension: 80, friction: 5, useNativeDriver: false }),
      // Title and body fade in
      Animated.parallel([
        Animated.timing(titleAnim,  { toValue: 1, duration: 350, useNativeDriver: false }),
        Animated.timing(glowAnim,   { toValue: 1, duration: 600, useNativeDriver: false }),
      ]),
      Animated.timing(bodyAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(btnAnim,  { toValue: 1, duration: 250, useNativeDriver: false }),
    ]).start();
  }, []);

  if (!config) return null;

  const isEarlyUnlock = milestone.days < milestone.displayDays;
  const accentColor  = config.accentColor;

  return (
    <Animated.View style={[styles.fullscreen, { backgroundColor: config.bg, opacity: fadeAnim }]}>
      <SafeAreaView style={styles.safeArea}>

        {/* Particle burst */}
        <View style={styles.particleLayer} pointerEvents="none">
          {particles.map(p => (
            <StarParticle
              key={p.key}
              delay={p.delay}
              x={p.x}
              y={p.y}
              color={accentColor + 'CC'}
            />
          ))}
        </View>

        <View style={styles.inner}>

          {/* Early unlock badge — only for milestones 3 and 4 */}
          {isEarlyUnlock && config.earlyLabel && (
            <Animated.View style={[styles.earlyBadge, { backgroundColor: accentColor + '25', borderColor: accentColor + '50', opacity: titleAnim }]}>
              <Text style={[styles.earlyBadgeText, { color: accentColor }]}>
                ⚡ {config.earlyLabel}
              </Text>
            </Animated.View>
          )}

          {/* Milestone badge */}
          <Animated.View style={[styles.badgeWrap, { transform: [{ scale: badgeAnim }] }]}>
            <Animated.View style={[styles.badgeGlow, {
              backgroundColor: accentColor,
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
            }]} />
            <View style={[styles.badgeCircle, { borderColor: accentColor + '40', backgroundColor: accentColor + '15' }]}>
              <Text style={styles.badgeEmoji}>{config.badge}</Text>
            </View>
          </Animated.View>

          {/* Day count / streak */}
          <Animated.View style={[styles.streakRow, { opacity: titleAnim }]}>
            <View style={[styles.streakPill, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={[styles.streakText, { color: accentColor }]}>{streak} day streak</Text>
            </View>
          </Animated.View>

          {/* Headline */}
          <Animated.Text style={[styles.headline, { color: '#F5F5F5', opacity: titleAnim }]}>
            {config.headline}
          </Animated.Text>

          {/* Body copy */}
          <Animated.Text style={[styles.body, { color: 'rgba(255,255,255,0.55)', opacity: bodyAnim }]}>
            {config.body}
          </Animated.Text>

          {/* Divider */}
          <Animated.View style={[styles.divider, { backgroundColor: accentColor + '30', opacity: bodyAnim }]} />

          {/* Primary CTA */}
          <Animated.View style={{ opacity: btnAnim, width: '100%' }}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: accentColor }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onContinue(config.primaryAction);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{config.primaryLabel}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Secondary CTA — always shown */}
          <Animated.View style={{ opacity: btnAnim, width: '100%', marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: 'rgba(255,255,255,0.12)' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onContinue(config.secondaryAction);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryBtnText, { color: 'rgba(255,255,255,0.5)' }]}>
                {config.secondaryLabel}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullscreen:    { flex: 1 },
  safeArea:      { flex: 1 },
  particleLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '60%' },

  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    gap: 16,
  },

  earlyBadge:     { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  earlyBadgeText: { fontSize: 12, fontWeight: '500', letterSpacing: 0.3 },

  badgeWrap:   { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeGlow:   { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  badgeCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji:  { fontSize: 42 },

  streakRow: { alignItems: 'center' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  streakFire: { fontSize: 14 },
  streakText: { fontSize: 13, fontWeight: '500' },

  headline: { fontSize: 26, fontWeight: '500', textAlign: 'center', lineHeight: 34 },

  body: { fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 320 },

  divider: { width: 48, height: 1, marginVertical: 4 },

  primaryBtn:     { width: '100%', padding: 18, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '500', color: '#fff' },

  secondaryBtn:     { width: '100%', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  secondaryBtnText: { fontSize: 14 },
});