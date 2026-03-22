import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Animated,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getEraLock, setEraLock, isUnlocked, getStreak } from '../storage/userPrefs';

const ERAS = [
  {
    id: '70s',
    label: '1970s',
    emoji: '📺',
    color: '#C87941',
    headline: 'The Foundation',
    desc: 'Space Battleship Yamato, Mobile Suit Gundam, Doraemon. The decade that invented the template. Raw, ambitious, foundational.',
    examples: ['Space Battleship Yamato', 'Lupin III', 'Doraemon', 'Rose of Versailles'],
  },
  {
    id: '80s',
    label: '1980s',
    emoji: '📼',
    color: '#CC5577',
    headline: 'The OVA Golden Age',
    desc: 'Akira. Nausicaä. Macross. The decade of OVAs, synthesiser soundtracks, and visual ambition that still hasn\'t been matched.',
    examples: ['Akira', 'Nausicaä', 'Macross', 'Urusei Yatsura', 'Fist of the North Star'],
  },
  {
    id: '90s',
    label: '1990s',
    emoji: '🌊',
    color: '#5577CC',
    headline: 'The Defining Decade',
    desc: 'Evangelion rewrote the rules. Cowboy Bebop invented cool. Sailor Moon built a generation. The most artistically experimental era in anime history.',
    examples: ['Neon Genesis Evangelion', 'Cowboy Bebop', 'Sailor Moon', 'Ghost in the Shell'],
  },
  {
    id: '00s',
    label: '2000s',
    emoji: '💿',
    color: '#44AA77',
    headline: 'Post-Eva Complexity',
    desc: 'Death Note. Haruhi. Code Geass. The decade after Evangelion where everyone tried to be smarter, darker, and more psychological.',
    examples: ['Death Note', 'The Melancholy of Haruhi Suzumiya', 'Code Geass', 'Fullmetal Alchemist'],
  },
  {
    id: '10s',
    label: '2010s',
    emoji: '📱',
    color: '#7F77DD',
    headline: 'The Streaming Era',
    desc: 'Attack on Titan changed everything. Isekai became a genre. Seasonal anime peaked. The decade where anime went mainstream worldwide.',
    examples: ['Attack on Titan', 'My Hero Academia', 'Sword Art Online', 'Re:Zero', 'One Punch Man'],
  },
  {
    id: '20s',
    label: '2020s',
    emoji: '⚡',
    color: '#E8630A',
    headline: 'Right Now',
    desc: 'Demon Slayer, Jujutsu Kaisen, Frieren, Oshi no Ko. The current golden age. Peak animation quality, weekly simulcasts, global audiences.',
    examples: ['Demon Slayer', 'Jujutsu Kaisen', 'Frieren', 'Oshi no Ko', 'Vinland Saga'],
  },
];

export default function EraLockScreen({ onBack, onActivate }) {
  const { colors, isDark } = useTheme();
  const [currentEra,   setCurrentEra]   = useState(null);
  const [selectedEra,  setSelectedEra]  = useState(null);
  const [expanded,     setExpanded]     = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCurrentEra();
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: false }).start();
  }, []);

  const loadCurrentEra = async () => {
    const era = await getEraLock();
    setCurrentEra(era);
    setSelectedEra(era);
  };

  const handleSelectEra = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEra(prev => prev === id ? null : id);
    setSaved(false);
  };

  const handleExpand = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(prev => prev === id ? null : id);
  };

  const handleActivate = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);
    await setEraLock(selectedEra);
    setCurrentEra(selectedEra);
    setSaved(true);
    setSaving(false);
    // Stay on screen so user sees confirmation, then they can go back
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDisable = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setEraLock(null);
    setCurrentEra(null);
    setSelectedEra(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isActive = currentEra !== null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.charcoal }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Era Lock</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Intro card */}
          <View style={[styles.introCard, { backgroundColor: isDark ? '#1A1A2A' : '#0F0F0F' }]}>
            <View style={[styles.unlockBadge, { backgroundColor: '#7F77DD25', borderColor: '#7F77DD50' }]}>
              <Text style={[styles.unlockBadgeText, { color: '#7F77DD' }]}>👑 60 Day Unlock</Text>
            </View>
            <Text style={styles.introTitle}>Era Lock</Text>
            <Text style={styles.introSub}>
              Lock Kore to a specific anime decade. Every recommendation — including Surprise Me and the 💎 button — will only suggest anime from that era.
            </Text>
            {isActive && (
              <View style={[styles.activeRow, { backgroundColor: '#7F77DD20', borderColor: '#7F77DD40' }]}>
                <Text style={[styles.activeText, { color: '#7F77DD' }]}>
                  Active: {ERAS.find(e => e.id === currentEra)?.label || currentEra}
                </Text>
                <TouchableOpacity onPress={handleDisable} style={styles.disableBtn}>
                  <Text style={styles.disableBtnText}>Turn off</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Era selector */}
          <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>CHOOSE YOUR ERA</Text>

          {ERAS.map(era => {
            const isSelected = selectedEra === era.id;
            const isOpen     = expanded === era.id;

            return (
              <View key={era.id} style={{ marginBottom: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.eraCard,
                    { borderColor: isSelected ? era.color : colors.border, backgroundColor: colors.card },
                    isSelected && { backgroundColor: era.color + (isDark ? '20' : '10') },
                  ]}
                  onPress={() => handleSelectEra(era.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.eraEmoji}>{era.emoji}</Text>
                  <View style={styles.eraInfo}>
                    <Text style={[styles.eraLabel, { color: colors.ink }, isSelected && { color: era.color, fontWeight: '500' }]}>
                      {era.label}
                    </Text>
                    <Text style={[styles.eraHeadline, { color: isSelected ? era.color : colors.charcoal }]}>
                      {era.headline}
                    </Text>
                  </View>
                  <View style={styles.eraRight}>
                    {isSelected && (
                      <View style={[styles.selectedDot, { backgroundColor: era.color }]} />
                    )}
                    <TouchableOpacity
                      onPress={() => handleExpand(era.id)}
                      style={styles.expandBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={[styles.expandArrow, { color: colors.charcoal }]}>
                        {isOpen ? '↑' : '↓'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Expanded detail */}
                {isOpen && (
                  <View style={[styles.eraDetail, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
                    <Text style={[styles.eraDesc, { color: colors.ink }]}>{era.desc}</Text>
                    <View style={styles.examplesWrap}>
                      {era.examples.map(ex => (
                        <View key={ex} style={[styles.examplePill, { backgroundColor: era.color + '20', borderColor: era.color + '40' }]}>
                          <Text style={[styles.exampleText, { color: era.color }]}>{ex}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {/* Activate button */}
          <TouchableOpacity
            style={[
              styles.activateBtn,
              selectedEra
                ? { backgroundColor: ERAS.find(e => e.id === selectedEra)?.color || colors.ember }
                : { backgroundColor: colors.charcoal, opacity: 0.5 },
              (saving || saved) && { opacity: 0.7 },
            ]}
            onPress={selectedEra ? handleActivate : null}
            disabled={!selectedEra || saving}
          >
            <Text style={styles.activateBtnText}>
              {saved
                ? selectedEra ? `✓ Era Lock set to ${ERAS.find(e => e.id === selectedEra)?.label}` : '✓ Era Lock disabled'
                : saving
                  ? 'Saving...'
                  : selectedEra
                    ? `Activate ${ERAS.find(e => e.id === selectedEra)?.label} Era Lock →`
                    : 'Select an era to activate'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.footerNote, { color: colors.charcoal }]}>
            Era Lock applies to all recommendation modes — regular, Surprise Me, and Hidden Gem. You can change or disable it from Profile at any time.
          </Text>

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
  scroll:       { padding: 20 },

  introCard:    { borderRadius: 20, padding: 20, marginBottom: 20 },
  unlockBadge:  { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  unlockBadgeText: { fontSize: 11, fontWeight: '500' },
  introTitle:   { fontSize: 28, fontWeight: '500', color: '#F5F5F5', marginBottom: 8 },
  introSub:     { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22 },
  activeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1 },
  activeText:   { fontSize: 13, fontWeight: '500' },
  disableBtn:   { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  disableBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  sectionLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 1.5, marginBottom: 12 },

  eraCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  eraEmoji:     { fontSize: 24, width: 32 },
  eraInfo:      { flex: 1 },
  eraLabel:     { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  eraHeadline:  { fontSize: 11 },
  eraRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedDot:  { width: 8, height: 8, borderRadius: 4 },
  expandBtn:    { padding: 4 },
  expandArrow:  { fontSize: 14 },

  eraDetail:    { borderWidth: 1, borderTopWidth: 0, borderRadius: 14, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 14 },
  eraDesc:      { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  examplesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  examplePill:  { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  exampleText:  { fontSize: 11, fontWeight: '500' },

  activateBtn:    { padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 14, marginBottom: 12 },
  activateBtnText:{ fontSize: 15, fontWeight: '500', color: '#fff' },

  footerNote:   { fontSize: 11, lineHeight: 18, textAlign: 'center', opacity: 0.6, paddingHorizontal: 8 },
  bottomPad:    { height: 40 },
});