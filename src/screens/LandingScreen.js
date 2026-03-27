// src/screens/LandingScreen.js

import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, Animated, Platform,
} from 'react-native';
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';

const FEATURES = [
  { emoji: '🎌', title: 'Three questions', sub: 'Vibe, story type, how much you\'re committing' },
  { emoji: '⚔️', title: 'One perfect pick', sub: 'Not a list — exactly one recommendation for tonight' },
  { emoji: '🔥', title: 'Earn rewards', sub: 'Build your streak to unlock taste insights and more' },
];

export default function LandingScreen({ onGetStarted }) {
  const { colors, isDark } = useTheme();

  const logoAnim   = useRef(new Animated.Value(0.94)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;
  const ctaAnim    = useRef(new Animated.Value(0)).current;
  const ctaSlide   = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Logo pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoAnim, { toValue: 1.05, duration: 2000, useNativeDriver: false }),
        Animated.timing(logoAnim, { toValue: 0.94, duration: 2000, useNativeDriver: false }),
      ])
    ).start();

    // Content fade in
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
    ]).start();

    // CTA delayed
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(ctaAnim,  { toValue: 1, tension: 80, friction: 8, useNativeDriver: false }),
        Animated.spring(ctaSlide, { toValue: 0, tension: 80, friction: 8, useNativeDriver: false }),
      ]).start();
    }, 400);
  }, []);

  const cardBg  = isDark ? '#1A1A1A' : colors.snow;
  const borderC = isDark ? '#2A2A2A' : '#E8E7E5';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.chalk }]}>
      <View style={styles.container}>

        {/* ── Logo block ── */}
        <View style={styles.logoBlock}>
          <Animated.Text style={[styles.logo, { color: colors.ember, transform: [{ scale: logoAnim }] }]}>
            コレ
          </Animated.Text>
          <Text style={[styles.appName, { color: colors.ink }]}>Kore</Text>
        </View>

        {/* ── Hero text ── */}
        <Animated.View style={[styles.heroBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={[styles.tagline, { color: colors.ink }]}>
            One anime.{'\n'}Right now.
          </Text>
          <View style={[styles.taglineLine, { backgroundColor: colors.ember }]} />
          <Text style={[styles.sub, { color: colors.charcoal }]}>
            Tell Kore your mood tonight and get exactly one recommendation — no lists, no scrolling, no endless browsing.
          </Text>
        </Animated.View>

        {/* ── Feature cards ── */}
        <Animated.View style={[styles.featuresBlock, { opacity: fadeAnim }]}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureCard, { backgroundColor: cardBg, borderColor: borderC }]}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.ink }]}>{f.title}</Text>
                <Text style={[styles.featureSub, { color: colors.charcoal }]}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ── CTA ── */}
        <Animated.View style={[styles.ctaBlock, { opacity: ctaAnim, transform: [{ translateY: ctaSlide }] }]}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.ink }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onGetStarted();
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaBtnText, { color: colors.snow }]}>Get started →</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1 },
  container:      {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    justifyContent: 'space-between',
  },

  logoBlock:      { alignItems: 'center', paddingTop: 40 },
  logo:           { fontSize: 64, fontWeight: '700', lineHeight: 72 },
  appName:        { fontSize: 17, fontWeight: '400', letterSpacing: 1, marginTop: -4 },

  heroBlock:      { gap: 12 },
  tagline:        { fontSize: 40, fontWeight: '500', lineHeight: 48, letterSpacing: -0.5 },
  taglineLine:    { width: 36, height: 3, borderRadius: 2 },
  sub:            { fontSize: 14, lineHeight: 22 },

  featuresBlock:  { gap: 8 },
  featureCard:    {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 14, borderWidth: 0.5,
  },
  featureEmoji:   { fontSize: 22, width: 28, textAlign: 'center' },
  featureText:    { flex: 1 },
  featureTitle:   { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  featureSub:     { fontSize: 12, lineHeight: 17 },

  ctaBlock:       { gap: 0 },
  ctaBtn:         { padding: 18, borderRadius: 14, alignItems: 'center' },
  ctaBtnText:     { fontSize: 16, fontWeight: '500' },
});