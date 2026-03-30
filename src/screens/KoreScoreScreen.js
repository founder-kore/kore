import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Animated, Share,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import Svg, {
  Rect, Circle, Ellipse, Line, Path, Text as SvgText,
  Defs, RadialGradient, Stop,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getHistory, getRatings, getFavoriteGenres, getStreak } from '../storage/userPrefs';
import { generateKoreScore } from '../services/claude';

// ─── Power level formula ───────────────────────────────────────────────
// picks × 100 + loved × 500 + liked × 200 + streak × 50
function calcPower({ picks, loved, liked, streak }) {
  return (picks * 100) + (loved * 500) + (liked * 200) + (streak * 50);
}

// Level = floor(power / 500) capped at 99
function calcLevel(power) {
  return Math.min(Math.floor(power / 500), 99);
}

// Tier based on level
function getTier(level) {
  if (level >= 51) return 'legend';
  if (level >= 21) return 'devotee';
  return 'watcher';
}

const TIER_CONFIG = {
  watcher: {
    rank:         'Watcher',
    rankSymbol:   '✦ WATCHER ✦',
    color:        '#4D9FFF',
    colorDim:     'rgba(77,159,255,0.2)',
    colorFaint:   'rgba(77,159,255,0.06)',
    bg:           '#0A1225',
    bgCard:       '#0E162B',
    border:       ['#4D9FFF', '#7F77DD', '#4D9FFF'],
    ornament:     '· · ·',
    shareEmoji:   '💫',
    shadow:       'rgba(77,159,255,0.18)',
    barColors:    ['#4D9FFF', '#7F77DD'],
    statBorder:   '#0F1A2A',
    statBg:       '#060A0F',
    footerBg:     '#060A0F',
  },
  devotee: {
    rank:         'Devotee',
    rankSymbol:   '⚔ DEVOTEE ⚔',
    color:        '#E8630A',
    colorDim:     'rgba(232,99,10,0.2)',
    colorFaint:   'rgba(232,99,10,0.06)',
    bg:           '#160A00',
    bgCard:       '#1C0E00',
    border:       ['#E8630A', '#FFB347', '#E8630A', '#D4537E'],
    ornament:     '⚔ · ⚔',
    shareEmoji:   '⚔️',
    shadow:       'rgba(232,99,10,0.25)',
    barColors:    ['#E8630A', '#FFB347'],
    statBorder:   '#1A0A00',
    statBg:       '#080400',
    footerBg:     '#080400',
  },
  legend: {
    rank:         'Legend',
    rankSymbol:   '★ LEGEND ★',
    color:        '#FFD700',
    colorDim:     'rgba(255,215,0,0.2)',
    colorFaint:   'rgba(255,215,0,0.06)',
    bg:           '#141000',
    bgCard:       '#1A1400',
    border:       ['#FFD700', '#E8630A', '#7F77DD', '#1D9E75', '#4D9FFF', '#FFD700'],
    ornament:     '★ · ★ · ★',
    shareEmoji:   '👑',
    shadow:       'rgba(255,215,0,0.2)',
    barColors:    ['#FFD700', '#E8630A', '#7F77DD'],
    statBorder:   'rgba(255,215,0,0.12)',
    statBg:       '#080600',
    footerBg:     '#080600',
  },
};

// ─── Character art per tier ────────────────────────────────────────────
function WatcherArt() {
  return (
    <Svg viewBox="0 0 200 160" width="100%" height="160">
      <Rect width="200" height="160" fill="#0A1225" />
      {/* Stars */}
      <Circle cx="20" cy="15" r="1" fill="#4D9FFF" opacity="0.6" />
      <Circle cx="60" cy="8" r="1" fill="#7F77DD" opacity="0.5" />
      <Circle cx="110" cy="18" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="160" cy="10" r="1.5" fill="#4D9FFF" opacity="0.5" />
      <Circle cx="185" cy="22" r="1" fill="#7F77DD" opacity="0.4" />
      {/* Moon */}
      <Circle cx="165" cy="28" r="16" fill="#0A0A20" opacity="0.8" />
      <Circle cx="169" cy="24" r="13" fill="#04070E" />
      {/* Aura */}
      <Ellipse cx="100" cy="125" rx="45" ry="42" fill="rgba(77,159,255,0.05)" />
      {/* Robes */}
      <Path d="M58 160 L73 92 Q100 75 127 92 L142 160 Z" fill="#12182B" />
      <Path d="M61 160 L75 94 Q100 80 125 94 L139 160 Z" fill="#0A0F18" />
      <Path d="M75 94 Q100 80 125 94 L121 108 Q100 99 79 108 Z" fill="#0F1525" />
      {/* Shoulders subtle */}
      <Path d="M73 92 Q63 86 59 97 Q66 105 76 99 Z" fill="#0D1220" stroke="rgba(77,159,255,0.2)" strokeWidth="0.5" />
      <Path d="M127 92 Q137 86 141 97 Q134 105 124 99 Z" fill="#0D1220" stroke="rgba(77,159,255,0.2)" strokeWidth="0.5" />
      {/* Staff */}
      <Line x1="130" y1="160" x2="116" y2="58" stroke="#1A1A2A" strokeWidth="2.5" />
      <Circle cx="116" cy="53" r="7" fill="#080810" stroke="#4D9FFF" strokeWidth="1" />
      <Circle cx="116" cy="53" r="4" fill="rgba(77,159,255,0.35)" />
      <Circle cx="116" cy="53" r="2" fill="#4D9FFF" />
      <Circle cx="117" cy="51.5" r="1" fill="#fff" opacity="0.6" />
      <Circle cx="116" cy="53" r="10" fill="rgba(77,159,255,0.07)" />
      {/* Head */}
      <Circle cx="100" cy="72" r="18" fill="#080C18" />
      <Circle cx="100" cy="70" r="16" fill="#0D1222" />
      {/* Hair neat */}
      <Path d="M83 61 Q100 50 117 61 Q109 55 100 53 Q91 55 83 61 Z" fill="#060810" />
      {/* Face */}
      <Ellipse cx="100" cy="74" rx="11" ry="13" fill="#C0B0D8" />
      {/* Eyes blue calm */}
      <Ellipse cx="94" cy="70" rx="3.5" ry="3" fill="#0A0F20" />
      <Ellipse cx="106" cy="70" rx="3.5" ry="3" fill="#0A0F20" />
      <Ellipse cx="94" cy="70" rx="2.5" ry="2" fill="#4D9FFF" />
      <Ellipse cx="106" cy="70" rx="2.5" ry="2" fill="#4D9FFF" />
      <Circle cx="94" cy="70" r="1.5" fill="#6DB8FF" />
      <Circle cx="106" cy="70" r="1.5" fill="#6DB8FF" />
      <Circle cx="94.7" cy="69.2" r="0.8" fill="#fff" />
      <Circle cx="106.7" cy="69.2" r="0.8" fill="#fff" />
      <Ellipse cx="94" cy="70" rx="4.5" ry="4" fill="rgba(77,159,255,0.15)" />
      <Ellipse cx="106" cy="70" rx="4.5" ry="4" fill="rgba(77,159,255,0.15)" />
      <Path d="M97 81 Q100 83 103 81" stroke="#9080B0" strokeWidth="0.8" fill="none" />
      {/* Collar */}
      <Path d="M84 88 Q100 82 116 88" fill="none" stroke="#4D9FFF" strokeWidth="0.8" opacity="0.4" />
      {/* Particles */}
      <Circle cx="78" cy="108" r="1" fill="#4D9FFF" opacity="0.3" />
      <Circle cx="124" cy="102" r="1" fill="#7F77DD" opacity="0.3" />
      {/* コレ */}
      <SvgText x="8" y="16" fontSize="9" fill="rgba(77,159,255,0.35)" fontWeight="700" letterSpacing="1">コレ</SvgText>
      <SvgText x="185" y="16" fontSize="7" fill="rgba(255,255,255,0.15)" textAnchor="end">PWR</SvgText>
    </Svg>
  );
}

function DevoteeArt() {
  return (
    <Svg viewBox="0 0 200 160" width="100%" height="160">
      <Rect width="200" height="160" fill="#160A00" />
      <Ellipse cx="100" cy="160" rx="100" ry="55" fill="rgba(232,99,10,0.06)" />
      {/* Embers */}
      <Circle cx="28" cy="110" r="1.5" fill="#E8630A" opacity="0.6" />
      <Circle cx="170" cy="95" r="1" fill="#FFB347" opacity="0.7" />
      <Circle cx="35" cy="80" r="1" fill="#E8630A" opacity="0.4" />
      <Circle cx="165" cy="75" r="1.5" fill="#FF8C00" opacity="0.5" />
      <Circle cx="22" cy="58" r="1" fill="#FFB347" opacity="0.5" />
      {/* City silhouette */}
      <Rect x="0" y="138" width="22" height="22" fill="#0D0400" />
      <Rect x="18" y="130" width="12" height="30" fill="#0D0400" />
      <Rect x="155" y="132" width="20" height="28" fill="#0D0400" />
      <Rect x="172" y="126" width="14" height="34" fill="#0D0400" />
      <Rect x="184" y="136" width="16" height="24" fill="#0D0400" />
      {/* Aura fire */}
      <Ellipse cx="100" cy="120" rx="48" ry="44" fill="rgba(232,99,10,0.06)" />
      <Ellipse cx="100" cy="110" rx="30" ry="32" fill="rgba(255,100,0,0.07)" />
      {/* Body armor */}
      <Path d="M54 160 L70 88 Q100 68 130 88 L146 160 Z" fill="#211200" />
      <Path d="M57 160 L72 90 Q100 74 128 90 L143 160 Z" fill="#180A00" />
      <Path d="M72 90 Q100 74 128 90 L124 105 Q100 93 76 105 Z" fill="#241200" />
      <Path d="M80 95 Q100 88 120 95 L118 100 Q100 95 82 100 Z" fill="#E8630A" opacity="0.3" />
      {/* Shoulders */}
      <Path d="M70 88 Q60 82 56 93 Q64 102 74 96 Z" fill="#200E00" stroke="rgba(232,99,10,0.3)" strokeWidth="0.5" />
      <Path d="M130 88 Q140 82 144 93 Q136 102 126 96 Z" fill="#200E00" stroke="rgba(232,99,10,0.3)" strokeWidth="0.5" />
      {/* Belt */}
      <Path d="M78 128 Q100 122 122 128 L120 133 Q100 129 80 133 Z" fill="#200E00" stroke="rgba(232,99,10,0.2)" strokeWidth="0.5" />
      {/* Head */}
      <Circle cx="100" cy="68" r="18" fill="#100600" />
      <Circle cx="100" cy="66" r="16" fill="#180C00" />
      {/* Spiky hair */}
      <Path d="M82 56 Q86 40 91 54" fill="#0A0300" />
      <Path d="M87 52 Q90 34 95 49" fill="#100600" />
      <Path d="M93 50 Q96 32 99 48" fill="#0A0300" />
      <Path d="M99 50 Q102 32 105 48" fill="#100600" />
      <Path d="M105 52 Q108 34 113 50" fill="#0A0300" />
      <Path d="M111 56 Q115 41 119 56" fill="#100600" />
      {/* Face */}
      <Ellipse cx="100" cy="70" rx="12" ry="14" fill="#D08060" />
      {/* Scar */}
      <Path d="M93 62 L96 68" stroke="rgba(180,80,40,0.7)" strokeWidth="0.8" />
      {/* Eyes fire */}
      <Ellipse cx="93" cy="66" rx="4" ry="3.5" fill="#0C0300" />
      <Ellipse cx="107" cy="66" rx="4" ry="3.5" fill="#0C0300" />
      <Ellipse cx="93" cy="66" rx="2.8" ry="2.2" fill="#E8630A" />
      <Ellipse cx="107" cy="66" rx="2.8" ry="2.2" fill="#E8630A" />
      <Circle cx="93" cy="66" r="1.6" fill="#FFB347" />
      <Circle cx="107" cy="66" r="1.6" fill="#FFB347" />
      <Circle cx="93.8" cy="65" r="0.8" fill="#fff" />
      <Circle cx="107.8" cy="65" r="0.8" fill="#fff" />
      <Ellipse cx="93" cy="66" rx="5" ry="4.5" fill="rgba(232,99,10,0.18)" />
      <Ellipse cx="107" cy="66" rx="5" ry="4.5" fill="rgba(232,99,10,0.18)" />
      {/* Fierce brows */}
      <Path d="M88 62 L94 64" stroke="#8B5030" strokeWidth="1" />
      <Path d="M106 62 L112 64" stroke="#8B5030" strokeWidth="1" />
      <Path d="M96 76 Q100 73 104 76" stroke="#A06040" strokeWidth="0.8" fill="none" />
      {/* Fire wrists */}
      <Ellipse cx="60" cy="126" rx="5" ry="9" fill="rgba(232,99,10,0.1)" />
      <Ellipse cx="140" cy="126" rx="5" ry="9" fill="rgba(232,99,10,0.1)" />
      {/* Particles */}
      <Circle cx="65" cy="100" r="1.5" fill="#E8630A" opacity="0.4" />
      <Circle cx="136" cy="94" r="2" fill="#FFB347" opacity="0.35" />
      <Circle cx="60" cy="118" r="1" fill="#E8630A" opacity="0.3" />
      {/* コレ */}
      <SvgText x="8" y="16" fontSize="9" fill="rgba(232,99,10,0.4)" fontWeight="700" letterSpacing="1">コレ</SvgText>
      <SvgText x="185" y="16" fontSize="7" fill="rgba(255,255,255,0.15)" textAnchor="end">PWR</SvgText>
    </Svg>
  );
}

function LegendArt() {
  return (
    <Svg viewBox="0 0 200 160" width="100%" height="160">
      <Rect width="200" height="160" fill="#141000" />
      <Ellipse cx="100" cy="0" rx="120" ry="50" fill="rgba(255,215,0,0.04)" />
      <Ellipse cx="100" cy="160" rx="120" ry="60" fill="rgba(232,99,10,0.05)" />
      {/* Gold stars */}
      <Circle cx="15" cy="12" r="1.5" fill="#FFD700" opacity="0.6" />
      <Circle cx="55" cy="6" r="1" fill="#FFD700" opacity="0.5" />
      <Circle cx="110" cy="10" r="1.5" fill="#FFB347" opacity="0.5" />
      <Circle cx="160" cy="8" r="1" fill="#FFD700" opacity="0.6" />
      <Circle cx="185" cy="18" r="1.5" fill="#FFB347" opacity="0.4" />
      <Circle cx="30" cy="22" r="1" fill="#FFD700" opacity="0.4" />
      {/* Moon gold tinted */}
      <Circle cx="160" cy="30" r="22" fill="rgba(255,215,0,0.05)" />
      <Circle cx="160" cy="30" r="17" fill="#0C0900" opacity="0.9" />
      <Circle cx="165" cy="26" r="13" fill="#080600" />
      {/* Epic aura multilayer */}
      <Ellipse cx="100" cy="125" rx="58" ry="52" fill="rgba(255,215,0,0.03)" />
      <Ellipse cx="100" cy="118" rx="44" ry="44" fill="rgba(232,99,10,0.04)" />
      <Ellipse cx="100" cy="110" rx="30" ry="34" fill="rgba(127,119,221,0.05)" />
      {/* Royal cloak flowing */}
      <Path d="M42 160 L62 76 Q100 52 138 76 L158 160 Z" fill="#1F1500" />
      <Path d="M45 160 L65 78 Q100 58 135 78 L155 160 Z" fill="#140E00" />
      {/* Cloak interior */}
      <Path d="M70 160 L76 100 Q100 85 124 100 L130 160 Z" fill="#0A0600" />
      {/* Royal armor */}
      <Path d="M65 78 Q100 58 135 78 L130 95 Q100 82 70 95 Z" fill="#1E1600" />
      <Path d="M76 83 Q100 73 124 83 L122 89 Q100 82 78 89 Z" fill="rgba(255,215,0,0.18)" />
      {/* Gold trim */}
      <Path d="M65 78 Q100 58 135 78" fill="none" stroke="rgba(255,215,0,0.35)" strokeWidth="1" />
      <Path d="M70 95 Q100 82 130 95" fill="none" stroke="rgba(255,215,0,0.18)" strokeWidth="0.5" />
      {/* Shoulder armor epic */}
      <Path d="M62 76 Q50 68 45 80 Q54 92 66 84 Z" fill="#1A1200" stroke="rgba(255,215,0,0.4)" strokeWidth="0.8" />
      <Path d="M138 76 Q150 68 155 80 Q146 92 134 84 Z" fill="#1A1200" stroke="rgba(255,215,0,0.4)" strokeWidth="0.8" />
      {/* Crown */}
      <Path d="M81 40 L84 30 L91 37 L100 26 L109 37 L116 30 L119 40 Z" fill="#FFD700" opacity="0.7" />
      <Path d="M81 40 L119 40 L117 44 L83 44 Z" fill="#E8A000" opacity="0.6" />
      {/* Crown jewels */}
      <Circle cx="100" cy="34" r="3" fill="#E8630A" opacity="0.8" />
      <Circle cx="88" cy="38" r="2" fill="#4D9FFF" opacity="0.7" />
      <Circle cx="112" cy="38" r="2" fill="#7F77DD" opacity="0.7" />
      {/* Head noble */}
      <Circle cx="100" cy="62" r="18" fill="#100C00" />
      <Circle cx="100" cy="60" r="16" fill="#1A1500" />
      {/* Elegant hair */}
      <Path d="M82 50 Q100 38 118 50 Q110 44 100 42 Q90 44 82 50 Z" fill="#0C0800" />
      <Path d="M82 50 Q77 72 81 100" stroke="#0C0800" strokeWidth="4.5" fill="none" />
      <Path d="M118 50 Q123 72 119 100" stroke="#0C0800" strokeWidth="4.5" fill="none" />
      {/* Face noble */}
      <Ellipse cx="100" cy="64" rx="12" ry="14" fill="#C8A060" />
      {/* Gold eyes */}
      <Ellipse cx="93" cy="59" rx="4.5" ry="4" fill="#100800" />
      <Ellipse cx="107" cy="59" rx="4.5" ry="4" fill="#100800" />
      <Ellipse cx="93" cy="59" rx="3" ry="2.5" fill="#FFD700" />
      <Ellipse cx="107" cy="59" rx="3" ry="2.5" fill="#FFD700" />
      <Circle cx="93" cy="59" r="2" fill="#FFE566" />
      <Circle cx="107" cy="59" r="2" fill="#FFE566" />
      <Circle cx="93.8" cy="57.8" r="1" fill="#fff" opacity="0.8" />
      <Circle cx="107.8" cy="57.8" r="1" fill="#fff" opacity="0.8" />
      <Ellipse cx="93" cy="59" rx="6" ry="5.5" fill="rgba(255,215,0,0.18)" />
      <Ellipse cx="107" cy="59" rx="6" ry="5.5" fill="rgba(255,215,0,0.18)" />
      <Path d="M97 72 Q100 74 103 72" stroke="#B08040" strokeWidth="0.8" fill="none" />
      {/* Royal staff ornate */}
      <Line x1="136" y1="160" x2="118" y2="30" stroke="#151000" strokeWidth="4" />
      <Line x1="136" y1="160" x2="118" y2="30" stroke="#221800" strokeWidth="2" />
      <Line x1="136" y1="160" x2="118" y2="30" stroke="rgba(255,215,0,0.1)" strokeWidth="1" />
      <Circle cx="118" cy="24" r="10" fill="#0A0800" stroke="rgba(255,215,0,0.5)" strokeWidth="1.5" />
      <Circle cx="118" cy="24" r="7" fill="rgba(255,215,0,0.12)" />
      <Circle cx="118" cy="24" r="4" fill="#FFD700" opacity="0.65" />
      <Circle cx="119" cy="22.5" r="2" fill="#fff" opacity="0.45" />
      <Circle cx="118" cy="24" r="13" fill="rgba(255,215,0,0.06)" />
      {/* Many particles */}
      <Circle cx="58" cy="92" r="2" fill="#FFD700" opacity="0.3" />
      <Circle cx="144" cy="86" r="2.5" fill="#E8630A" opacity="0.28" />
      <Circle cx="52" cy="114" r="1.5" fill="#7F77DD" opacity="0.28" />
      <Circle cx="150" cy="108" r="2" fill="#FFD700" opacity="0.22" />
      <Circle cx="62" cy="130" r="1.5" fill="#4D9FFF" opacity="0.28" />
      <Circle cx="140" cy="126" r="1.5" fill="#E8630A" opacity="0.28" />
      {/* Ground runes */}
      <Circle cx="100" cy="155" r="40" fill="none" stroke="rgba(255,215,0,0.06)" strokeWidth="0.8" />
      <Circle cx="100" cy="155" r="28" fill="none" stroke="rgba(232,99,10,0.05)" strokeWidth="0.5" />
      <Line x1="60" y1="155" x2="140" y2="155" stroke="rgba(255,215,0,0.04)" strokeWidth="0.5" />
      <Line x1="100" y1="115" x2="100" y2="195" stroke="rgba(255,215,0,0.04)" strokeWidth="0.5" />
      {/* コレ */}
      <SvgText x="8" y="16" fontSize="9" fill="rgba(255,215,0,0.45)" fontWeight="700" letterSpacing="1">コレ</SvgText>
      <SvgText x="185" y="16" fontSize="7" fill="rgba(255,255,255,0.15)" textAnchor="end">PWR</SvgText>
    </Svg>
  );
}

// ─── Particle component ────────────────────────────────────────────────
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
      width: 2.5, height: 2.5, borderRadius: 1.25,
      backgroundColor: color,
      opacity: anim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.6, 0.2, 0] }),
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) }],
    }} />
  );
}

// ─── Main screen ───────────────────────────────────────────────────────
export default function KoreScoreScreen({ onBack }) {
  const { colors } = useTheme();
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [score,    setScore]    = useState(null);
  const [history,  setHistory]  = useState([]);
  const [streak,   setStreak]   = useState(0);
  const [power,    setPower]    = useState(0);
  const [level,    setLevel]    = useState(0);
  const [sharing,  setSharing]  = useState(false);

  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const statsFade = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const particles = useRef(
    Array.from({ length: 16 }, (_, i) => ({
      color: ['#4D9FFF', '#7F77DD', '#E8630A', '#1D9E75', '#FFD700'][i % 5],
      left: Math.round((i / 16) * 100),
      duration: 3000 + i * 350,
      delay: i * 280,
    }))
  ).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: -7, duration: 2200, useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => { loadScore(); }, []);

  const loadScore = async () => {
    setLoading(true); setError(null);
    cardFade.setValue(0); cardSlide.setValue(30); statsFade.setValue(0);
    try {
      const [hist, ratings, genres, currentStreak] = await Promise.all([
        getHistory(), getRatings(), getFavoriteGenres(), getStreak(),
      ]);
      setHistory(hist);
      setStreak(currentStreak);

      const loved = ratings.filter(r => r.rating === 'loved').length;
      const liked = ratings.filter(r => r.rating === 'liked').length;
      const pw = calcPower({ picks: hist.length, loved, liked, streak: currentStreak });
      const lv = calcLevel(pw);
      setPower(pw);
      setLevel(lv);

      const result = await generateKoreScore({ history: hist, ratings, favoriteGenres: genres });
      setScore(result);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(cardSlide, { toValue: 0, duration: 600, useNativeDriver: false }),
        ]),
        Animated.timing(statsFade, { toValue: 1, duration: 400, useNativeDriver: false }),
      ]).start();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (!score) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      const tier = getTier(level);
      const cfg = TIER_CONFIG[tier];
      await Share.share({
        message: `My Kore Score:\n\n${cfg.rank} · Level ${level}\n⚡ Power ${power.toLocaleString()}\n\n${score.archetype}\n"${score.tagline}"\n\nSpirit anime: ${score.spirit_anime}\n\n🔥 ${streak} day streak · コレ Kore`,
        title: 'My Kore Score',
      });
    } catch {}
    finally { setSharing(false); }
  };

  if (loading) return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.snow }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={[s.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.ink }]}>Kore Score</Text>
        <View style={s.backBtn} />
      </View>
      <View style={s.centered}>
        <Text style={{ fontSize: 44 }}>⚔️</Text>
        <Text style={[s.loadTitle, { color: colors.ink }]}>Forging your card...</Text>
        <Text style={[s.loadSub, { color: colors.charcoal }]}>Kore is analysing your taste patterns.</Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.snow }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={[s.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.ink }]}>Kore Score</Text>
        <View style={s.backBtn} />
      </View>
      <View style={s.centered}>
        <Text style={[s.loadTitle, { color: colors.ember }]}>Something went wrong</Text>
        <Text style={[s.loadSub, { color: colors.charcoal }]}>{error}</Text>
        <TouchableOpacity style={[s.retryBtn, { backgroundColor: colors.ink }]} onPress={loadScore}>
          <Text style={[s.retryTxt, { color: colors.snow }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (!score) return null;

  const tier = getTier(level);
  const cfg = TIER_CONFIG[tier];
  const maxPower = tier === 'legend' ? 30000 : tier === 'devotee' ? 15000 : 5000;
  const powerPct = Math.min((power / maxPower) * 100, 100);
  const glowOp = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.45] });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.snow }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={[s.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.ink }]}>Kore Score</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* Unlock badge */}
        <View style={[s.unlockBadge, { backgroundColor: cfg.colorFaint, borderColor: cfg.colorDim }]}>
          <Text style={{ fontSize: 12 }}>🔥</Text>
          <Text style={[s.unlockTxt, { color: cfg.color }]}>30 DAY UNLOCK</Text>
        </View>

        {/* Floating card */}
        <Animated.View style={[s.cardWrap, {
          opacity: cardFade,
          transform: [{ translateY: cardSlide }, { translateY: floatAnim }],
          shadowColor: cfg.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 1,
          shadowRadius: 20,
          elevation: 12,
        }]}>

          {/* Bordered card using gradient border trick */}
          <View style={[s.cardBorderWrap, { padding: 2, borderRadius: 18 }]}>
            <LinearGradient
              colors={cfg.border}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[s.card, { backgroundColor: cfg.bg }]}>

              {/* Particles */}
              <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                {particles.map((p, i) => <Particle key={i} {...p} />)}
              </View>

              {/* Header */}
              <View style={[s.cardHeader, { backgroundColor: cfg.bg, borderBottomColor: cfg.statBorder }]}>
                <Text style={[s.cardLogo, { color: `${cfg.color}66` }]}>コレ · KORE</Text>
                <View style={[s.rankBanner, { borderTopColor: cfg.colorDim, borderBottomColor: cfg.colorDim, backgroundColor: cfg.colorFaint }]}>
                  <Text style={[s.rankBannerTxt, { color: cfg.color }]}>{cfg.rankSymbol}</Text>
                </View>
                <View style={s.lvRow}>
                  <Text style={s.lvLabel}>LEVEL</Text>
                  <Text style={[s.lvVal, { color: cfg.color }]}>{level}</Text>
                </View>
              </View>

              {/* Art */}
              <View style={s.artWrap}>
                {tier === 'watcher'  && <WatcherArt />}
                {tier === 'devotee'  && <DevoteeArt />}
                {tier === 'legend'   && <LegendArt />}
                {/* Top + bottom fade */}
                <View style={[s.artFadeTop, { backgroundColor: cfg.bg }]} />
                <View style={[s.artFadeBot, { backgroundColor: cfg.bg }]} />
                {/* Glow on icon */}
                <Animated.View style={[s.artGlow, { backgroundColor: cfg.color, opacity: glowOp }]} />
              </View>

              {/* Name section */}
              <View style={[s.nameSection, { backgroundColor: cfg.bgCard, borderBottomColor: cfg.statBorder }]}>
                <Text style={[s.archetypeName, { color: tier === 'legend' ? cfg.color : '#F5F5F5' }]}>
                  {score.archetype}
                </Text>
                <Text style={[s.archetypeTag, { color: cfg.color }]}>{score.tagline}</Text>
              </View>

              {/* Ornament */}
              <View style={[s.ornamentRow, { backgroundColor: cfg.bgCard }]}>
                <Text style={[s.ornament, { color: `${cfg.color}44` }]}>{cfg.ornament}</Text>
              </View>

              {/* Power bar */}
              <View style={[s.powerSection, { backgroundColor: cfg.bgCard, borderBottomColor: cfg.statBorder }]}>
                <View style={s.powerRow}>
                  <Text style={s.powerLbl}>POWER LEVEL</Text>
                  <Text style={[s.powerVal, { color: cfg.color }]}>{power.toLocaleString()}</Text>
                </View>
                <View style={[s.barBg, { backgroundColor: cfg.statBorder }]}>
                  <LinearGradient
                    colors={cfg.barColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.barFill, { width: `${powerPct}%` }]}
                  />
                </View>
              </View>

              {/* Stats grid */}
              <View style={[s.statsGrid, { backgroundColor: cfg.bgCard, borderBottomColor: cfg.statBorder }]}>
                {[
                  { val: history.length, label: '🎬 Picks' },
                  { val: streak, label: '🔥 Streak' },
                  { val: score.rated ?? '-', label: '⭐ Rated' },
                  { val: score.loved ?? '-', label: '❤️ Loved' },
                ].map((st, i) => (
                  <View key={i} style={[s.statCell, { backgroundColor: cfg.statBg, borderColor: cfg.statBorder }]}>
                    <Text style={s.statVal}>{st.val}</Text>
                    <Text style={s.statLbl}>{st.label}</Text>
                  </View>
                ))}
              </View>

              {/* Hidden obsession */}
              {score.hidden_obsession ? (
                <View style={[s.obsSection, { backgroundColor: cfg.bgCard, borderBottomColor: cfg.statBorder }]}>
                  <Text style={s.obsLabel}>HIDDEN OBSESSION</Text>
                  <Text style={s.obsTxt}>{score.hidden_obsession}</Text>
                </View>
              ) : null}

              {/* Spirit anime */}
              {score.spirit_anime ? (
                <View style={[s.spiritSection, { backgroundColor: cfg.bgCard }]}>
                  <Text style={{ fontSize: 18 }}>
                    {tier === 'legend' ? '⚔️' : tier === 'devotee' ? '🔥' : '💫'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.spiritLabel}>SPIRIT ANIME</Text>
                    <Text style={s.spiritVal}>{score.spirit_anime}</Text>
                  </View>
                </View>
              ) : null}

              {/* Footer ornament */}
              <View style={[s.ornamentRow, { backgroundColor: cfg.bg }]}>
                <Text style={[s.ornament, { color: `${cfg.color}33`, fontSize: 8 }]}>· · · · ·</Text>
              </View>

              {/* Footer */}
              <View style={[s.cardFoot, { backgroundColor: cfg.footerBg }]}>
                <Text style={[s.cardFootLogo, { color: `${cfg.color}44` }]}>コレ</Text>
                <Text style={s.serial}>{score.serial_number || `KS-2026-${String(level).padStart(4, '0')}`}</Text>
              </View>

            </View>
          </View>
        </Animated.View>

        {/* Stats below */}
        <Animated.View style={[s.belowRow, { opacity: statsFade }]}>
          {[
            { val: level, label: 'Level' },
            { val: streak, label: 'Day streak' },
            { val: history.length, label: 'Total picks' },
          ].map((st, i) => (
            <View key={i} style={s.belowBox}>
              <Text style={s.belowVal}>{st.val}</Text>
              <Text style={s.belowLbl}>{st.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={{ opacity: statsFade }}>
          <TouchableOpacity
            style={[s.shareBtn, { backgroundColor: cfg.color }]}
            onPress={handleShare}
            disabled={sharing}
          >
            <Text style={s.shareTxt}>
              {sharing ? 'Sharing...' : `${cfg.shareEmoji} Share my Kore Score`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.regenBtn, { borderColor: colors.border }]} onPress={loadScore}>
            <Text style={[s.regenTxt, { color: colors.charcoal }]}>Regenerate card</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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

  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start', borderWidth: 0.5, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  unlockTxt:   { fontSize: 10, fontWeight: '500', letterSpacing: 0.5 },

  cardWrap:        { marginBottom: 14 },
  cardBorderWrap:  { borderRadius: 18, overflow: 'hidden', position: 'relative' },
  card:            { borderRadius: 16, overflow: 'hidden' },

  cardHeader:      { padding: 10, paddingHorizontal: 14, textAlign: 'center', alignItems: 'center', borderBottomWidth: 0.5 },
  cardLogo:        { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  rankBanner:      { width: '100%', borderTopWidth: 0.5, borderBottomWidth: 0.5, paddingVertical: 4, marginBottom: 6 },
  rankBannerTxt:   { fontSize: 10, fontWeight: '500', letterSpacing: 1.5, textAlign: 'center' },
  lvRow:           { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  lvLabel:         { fontSize: 9, color: '#333' },
  lvVal:           { fontSize: 9, fontWeight: '500' },

  artWrap:    { position: 'relative', overflow: 'hidden' },
  artFadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 16, opacity: 0.9 },
  artFadeBot: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, opacity: 0.95 },
  artGlow:    { position: 'absolute', top: '20%', left: '35%', width: 70, height: 70, borderRadius: 35 },

  nameSection:     { padding: 10, paddingHorizontal: 14, alignItems: 'center', borderBottomWidth: 0.5 },
  archetypeName:   { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, marginBottom: 3 },
  archetypeTag:    { fontSize: 10, fontStyle: 'italic', textAlign: 'center' },

  ornamentRow: { paddingVertical: 4, alignItems: 'center' },
  ornament:    { fontSize: 9, letterSpacing: 4 },

  powerSection: { paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 0.5 },
  powerRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  powerLbl:     { fontSize: 8, color: '#444', letterSpacing: 0.8 },
  powerVal:     { fontSize: 10, fontWeight: '500' },
  barBg:        { borderRadius: 3, height: 5, overflow: 'hidden' },
  barFill:      { height: 5, borderRadius: 3 },

  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 5, padding: 10, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  statCell:   { width: '47%', borderRadius: 6, padding: 6, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.03)' },
  statVal:    { fontSize: 14, fontWeight: '500', color: '#F5F5F5' },
  statLbl:    { fontSize: 8, color: '#444' },

  obsSection: { padding: 10, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  obsLabel:   { fontSize: 8, color: '#444', letterSpacing: 0.8, marginBottom: 4 },
  obsTxt:     { fontSize: 11, color: '#777', fontStyle: 'italic', lineHeight: 16 },

  spiritSection: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14 },
  spiritLabel:   { fontSize: 8, color: '#444', letterSpacing: 0.8, marginBottom: 3 },
  spiritVal:     { fontSize: 12, fontWeight: '500', color: '#F5F5F5' },

  cardFoot:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6 },
  cardFootLogo: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  serial:       { fontSize: 8, color: '#1A1A1A', fontFamily: 'monospace', letterSpacing: 1 },

  belowRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  belowBox: { flex: 1, backgroundColor: '#111', borderRadius: 12, borderWidth: 0.5, borderColor: '#1A1A1A', padding: 12, alignItems: 'center', gap: 4 },
  belowVal: { fontSize: 18, fontWeight: '500', color: '#F5F5F5' },
  belowLbl: { fontSize: 10, color: '#444', textAlign: 'center' },

  shareBtn:  { padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  shareTxt:  { fontSize: 15, fontWeight: '500', color: '#fff' },
  regenBtn:  { padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  regenTxt:  { fontSize: 14 },
});