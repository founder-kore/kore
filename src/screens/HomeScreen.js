import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Animated, Platform, Dimensions,
} from 'react-native';
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getNextMilestone, isUnlocked } from '../storage/userPrefs';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const questions = [
  {
    id: 'vibe',
    question: "What's your vibe right now?",
    subtitle: 'Be honest — this shapes everything.',
    options: [
      { label: 'Chill',     sub: 'Relaxed, no stress' },
      { label: 'Hype',      sub: 'Energized, ready to go' },
      { label: 'Emotional', sub: 'Feeling deeply' },
      { label: 'Curious',   sub: 'Open minded, exploratory' },
      { label: 'Escapist',  sub: 'Want to leave reality' },
      { label: 'Social',    sub: 'Watching with someone' },
    ],
  },
  {
    id: 'storyType',
    question: 'What kind of story do you want?',
    subtitle: 'Pick the feeling you want to walk away with.',
    options: [
      { label: 'Action-packed',       sub: 'Fast, intense, fights' },
      { label: 'Slow burn',           sub: 'Deep, patient, layered' },
      { label: 'Feel-good',           sub: 'Warm, fun, wholesome' },
      { label: 'Mind-bending',        sub: 'Complex, twisty, cerebral' },
      { label: 'Emotional gut-punch', sub: 'Cry, feel, reflect' },
      { label: 'Dark & gritty',       sub: 'Heavy themes, raw' },
    ],
  },
  {
    id: 'commitment',
    question: 'How much are you committing?',
    subtitle: 'Pick the one that matches your energy tonight.',
    options: [
      { label: 'A few episodes of a short series', sub: '2–4 eps · prefer under 25 total' },
      { label: 'A few episodes of anything',       sub: '2–4 eps · series length doesn\'t matter' },
      { label: 'Start and finish a short series',  sub: 'Binge something under 15 eps tonight' },
      { label: 'Start a long series',              sub: 'Beginning of something big — 50–100+ eps' },
    ],
  },
];

const SURPRISE_OPTIONS = {
  vibe:       ['Chill', 'Hype', 'Emotional', 'Curious', 'Escapist', 'Social'],
  storyType:  ['Action-packed', 'Slow burn', 'Feel-good', 'Mind-bending', 'Emotional gut-punch', 'Dark & gritty'],
  commitment: ['A few episodes of a short series', 'A few episodes of anything', 'Start and finish a short series', 'Start a long series'],
};

function getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const GridOptionButton = memo(({ option, selected, onPress, disabled, colors }) => (
  <TouchableOpacity
    style={[styles.gridOptionBtn, { borderColor: colors.border, backgroundColor: colors.chalk }, selected && { backgroundColor: colors.ember, borderColor: colors.ember }]}
    onPress={onPress} disabled={disabled}
  >
    <Text style={[styles.optionLabel, { color: colors.ink }, selected && { color: '#fff', fontWeight: '500' }]}>{option.label}</Text>
    <Text style={[styles.optionSub, { color: selected ? 'rgba(255,255,255,0.85)' : '#666' }]}>{option.sub}</Text>
  </TouchableOpacity>
));

const FullOptionButton = memo(({ option, selected, onPress, disabled, colors }) => (
  <TouchableOpacity
    style={[styles.fullOptionBtn, { borderColor: colors.border, backgroundColor: colors.chalk }, selected && { backgroundColor: colors.ember, borderColor: colors.ember }]}
    onPress={onPress} disabled={disabled}
  >
    <Text style={[styles.fullOptionLabel, { color: colors.ink }, selected && { color: '#fff', fontWeight: '500' }]}>{option.label}</Text>
    <Text style={[styles.fullOptionSub, { color: selected ? 'rgba(255,255,255,0.85)' : '#666' }]}>{option.sub}</Text>
  </TouchableOpacity>
));

const QuestionBlock = memo(({ question, index, currentStep, answer, onSelect, colors, onLayoutCapture }) => {
  const isDimmed = index > currentStep;
  const isActive = index === currentStep;
  const isFullWidth = question.id === 'commitment';

  return (
    <View
      style={[styles.questionBlock, isDimmed && styles.questionDimmed]}
      onLayout={e => onLayoutCapture?.(index, e.nativeEvent.layout.y)}
    >
      <View style={styles.stepRow}>
        <View style={[styles.stepDot, { backgroundColor: colors.border }, answer && { backgroundColor: colors.ink }, isActive && !answer && { backgroundColor: colors.ember }]} />
        <Text style={[styles.stepLabel, { color: colors.charcoal }]}>Question {index + 1} of {questions.length}</Text>
        {answer && <Text style={[styles.stepAnswer, { color: colors.ember }]} numberOfLines={1}>— {answer}</Text>}
      </View>
      <Text style={[styles.questionText, { color: colors.ink }]}>{question.question}</Text>
      <Text style={[styles.questionSubtitle, { color: colors.charcoal }]}>{question.subtitle}</Text>

      {isFullWidth ? (
        <View style={styles.optionsColumn}>
          {question.options.map(opt => (
            <FullOptionButton key={opt.label} option={opt} selected={answer === opt.label}
              onPress={() => onSelect(question.id, opt.label)} disabled={isDimmed} colors={colors} />
          ))}
        </View>
      ) : (
        <View style={styles.optionsGrid}>
          {question.options.map(opt => (
            <GridOptionButton key={opt.label} option={opt} selected={answer === opt.label}
              onPress={() => onSelect(question.id, opt.label)} disabled={isDimmed} colors={colors} />
          ))}
        </View>
      )}
    </View>
  );
});

export default function HomeScreen({
  onSubmit, onOpenProfile, onOpenHistory, onOpenWatchLater,
  onOpenMoodInsights, onOpenKoreScore, onOpenProfileCard,
  onOpenEraLock, streak = 0,
}) {
  const { colors, isDark } = useTheme();
  const [answers, setAnswers] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const surpriseAnim = useRef(new Animated.Value(1)).current;
  const ctaAnim      = useRef(new Animated.Value(0)).current;
  const ctaSlideAnim = useRef(new Animated.Value(20)).current;

  const scrollRef = useRef(null);
  const questionsWrapperY = useRef(0);
  const questionYPositions = useRef({});

  const moodInsightsUnlocked = isUnlocked('mood_insights', streak);
  const koreScoreUnlocked    = isUnlocked('kore_score', streak);
  const profileCardUnlocked  = streak >= 14;
  const eraLockUnlocked      = isUnlocked('directors_cut', streak);
  const nextMilestone        = getNextMilestone(streak);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
  }, []);

  const allAnswered = questions.every(q => answers[q.id]);

  useEffect(() => {
    if (allAnswered) {
      Animated.parallel([
        Animated.spring(ctaAnim,      { toValue: 1, tension: 80, friction: 6, useNativeDriver: false }),
        Animated.spring(ctaSlideAnim, { toValue: 0, tension: 80, friction: 6, useNativeDriver: false }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      ctaAnim.setValue(0);
      ctaSlideAnim.setValue(20);
    }
  }, [allAnswered]);

  const handleQuestionLayout = useCallback((index, y) => {
    questionYPositions.current[index] = y;
  }, []);

  const handleSelect = useCallback((questionId, option) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => ({ ...prev, [questionId]: option }));

    setCurrentStep(prev => {
      const idx = questions.findIndex(q => q.id === questionId);
      if (idx < questions.length - 1 && idx === prev) {
        const nextIdx = idx + 1;
        // Fix #6 — Precise auto-scroll: show next question but keep question-after-next below fold
        setTimeout(() => {
          const nextY     = questionYPositions.current[nextIdx];
          const afterNextY = questionYPositions.current[nextIdx + 1];
          const wrapperY  = questionsWrapperY.current;

          if (nextY === undefined || !scrollRef.current) return;

          // Normal target: next question 24px from top of viewport
          const normalTarget = wrapperY + nextY - 24;

          // Safe target: keep the question-after-next below the fold
          // wrapperY + afterNextY should be > scrollTarget + SCREEN_HEIGHT
          let scrollTarget = normalTarget;
          if (afterNextY !== undefined) {
            const maxAllowed = wrapperY + afterNextY - SCREEN_HEIGHT + 60;
            scrollTarget = Math.min(normalTarget, maxAllowed);
          }

          scrollRef.current.scrollTo({ y: Math.max(0, scrollTarget), animated: true });
        }, 350);
        return prev + 1;
      }
      return prev;
    });
  }, []);

const handleSurprise = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  Animated.sequence([
    Animated.timing(surpriseAnim, { toValue: 0.92, duration: 100, useNativeDriver: false }),
    Animated.timing(surpriseAnim, { toValue: 1,    duration: 100, useNativeDriver: false }),
  ]).start();
  onSubmit({ vibe: getRandom(SURPRISE_OPTIONS.vibe), storyType: getRandom(SURPRISE_OPTIONS.storyType), commitment: getRandom(SURPRISE_OPTIONS.commitment), _surpriseMode: true });
};

  const progressPercent = nextMilestone ? Math.round((streak / nextMilestone.days) * 100) : 100;
  const whyNowBg = isDark ? '#2A1A00' : '#FFF5EE';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, allAnswered && { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.logo, { color: colors.ember }]}>コレ</Text>
              <Text style={[styles.appName, { color: colors.ink }]}>Kore</Text>
            </View>
            <View style={styles.headerRight}>
              {streak > 0 && (
                <View style={[styles.streakBadge, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
                  <Text style={styles.streakFire}>🔥</Text>
                  <Text style={[styles.streakCount, { color: colors.ember }]}>{streak}</Text>
                </View>
              )}
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenWatchLater(); }}>
                <Text style={styles.iconBtnText}>🔖</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenHistory(); }}>
                <Text style={[styles.iconBtnText, { color: colors.ember }]}>✦</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenProfile(); }}>
                <Text style={[styles.iconBtnText, { color: colors.charcoal }]}>☰</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.tagline, { color: colors.charcoal }]}>Your one anime. Right now.</Text>

          {nextMilestone && streak > 0 && (
            <View style={styles.milestoneCard}>
              <View style={styles.milestoneTop}>
                <Text style={styles.milestoneIcon}>{nextMilestone.icon}</Text>
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneTitle}>{nextMilestone.title}</Text>
                  <Text style={[styles.milestoneDays, { color: colors.ember }]}>
                    {nextMilestone.days - streak} day{nextMilestone.days - streak !== 1 ? 's' : ''} away
                  </Text>
                </View>
              </View>
              <View style={styles.progressBarWrap}>
                <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: colors.ember }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabelLeft}>🔥 {streak} day streak</Text>
                <Text style={styles.progressLabelRight}>Goal: {nextMilestone.days} days</Text>
              </View>
            </View>
          )}

          {(moodInsightsUnlocked || koreScoreUnlocked || profileCardUnlocked || eraLockUnlocked) && (
            <View style={styles.unlockedRow}>
              {moodInsightsUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: '#7F77DD', backgroundColor: isDark ? '#1A1A2A' : '#F0EFFE' }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenMoodInsights(); }}>
                  <Text style={styles.unlockedBtnIcon}>🧠</Text>
                  <Text style={[styles.unlockedBtnText, { color: '#7F77DD' }]}>Mood Insights</Text>
                </TouchableOpacity>
              )}
              {profileCardUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: '#4D9FFF', backgroundColor: isDark ? '#0A1628' : '#EEF2FF' }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenProfileCard?.(); }}>
                  <Text style={styles.unlockedBtnIcon}>💠</Text>
                  <Text style={[styles.unlockedBtnText, { color: '#4D9FFF' }]}>Profile Card</Text>
                </TouchableOpacity>
              )}
              {koreScoreUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: colors.ember, backgroundColor: whyNowBg }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenKoreScore(); }}>
                  <Text style={styles.unlockedBtnIcon}>⚔️</Text>
                  <Text style={[styles.unlockedBtnText, { color: colors.ember }]}>Kore Score</Text>
                </TouchableOpacity>
              )}
              {eraLockUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: '#7F77DD', backgroundColor: isDark ? '#1A1A2A' : '#F0EFFE' }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenEraLock?.(); }}>
                  <Text style={styles.unlockedBtnIcon}>👑</Text>
                  <Text style={[styles.unlockedBtnText, { color: '#7F77DD' }]}>Era Lock</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: surpriseAnim }] }}>
            <TouchableOpacity style={[styles.surpriseBtn, { backgroundColor: isDark ? '#2A2A2A' : colors.ink }]} onPress={handleSurprise}>
              <Text style={styles.surpriseEmoji}>🎲</Text>
              <View>
                <Text style={[styles.surpriseTitle, { color: isDark ? colors.ink : colors.snow }]}>Surprise me</Text>
                <Text style={[styles.surpriseSub, { color: isDark ? colors.charcoal : '#999' }]}>Skip questions — just pick for me</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.charcoal }]}>or answer 3 questions</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
        </Animated.View>

        <Animated.View
          style={{ opacity: fadeAnim }}
          onLayout={e => { questionsWrapperY.current = e.nativeEvent.layout.y; }}
        >
          {questions.map((q, index) => (
            <QuestionBlock key={q.id} question={q} index={index} currentStep={currentStep}
              answer={answers[q.id]} onSelect={handleSelect} colors={colors}
              onLayoutCapture={handleQuestionLayout} />
          ))}
        </Animated.View>

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Sticky CTA — always visible when all questions answered */}
      {allAnswered && (
        <Animated.View style={[
          styles.stickyCtaWrap,
          { backgroundColor: colors.snow, borderTopColor: colors.border, opacity: ctaAnim, transform: [{ translateY: ctaSlideAnim }] },
        ]}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.ink }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSubmit(answers); }}
          >
            <Text style={[styles.ctaText, { color: colors.snow }]}>Decide for me →</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60 },
  header: { marginBottom: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 56, fontWeight: '700', marginBottom: 2 },
  appName: { fontSize: 20, fontWeight: '400' },
  tagline: { fontSize: 13, letterSpacing: 0.3, marginBottom: 16, marginTop: 6 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10, gap: 4 },
  streakFire: { fontSize: 14 },
  streakCount: { fontSize: 14, fontWeight: '500' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 16 },
  milestoneCard: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, marginBottom: 16 },
  milestoneTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  milestoneIcon: { fontSize: 22 },
  milestoneInfo: { flex: 1 },
  milestoneTitle: { fontSize: 13, fontWeight: '500', color: '#F5F5F5', marginBottom: 2 },
  milestoneDays: { fontSize: 12 },
  progressBarWrap: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#2A2A2A', marginBottom: 6 },
  progressBar: { height: '100%', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabelLeft: { fontSize: 10, color: '#666' },
  progressLabelRight: { fontSize: 10, color: '#666' },
  unlockedRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  unlockedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5 },
  unlockedBtnIcon: { fontSize: 16 },
  unlockedBtnText: { fontSize: 12, fontWeight: '500' },
  surpriseBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, marginBottom: 10 },
  surpriseEmoji: { fontSize: 28 },
  surpriseTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  surpriseSub: { fontSize: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 28 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, letterSpacing: 0.3 },
  questionBlock: { marginBottom: 36 },
  questionDimmed: { opacity: 0.25 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepLabel: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  stepAnswer: { fontSize: 11, fontWeight: '500', flex: 1 },
  questionText: { fontSize: 21, fontWeight: '500', marginBottom: 4, lineHeight: 28 },
  questionSubtitle: { fontSize: 13, marginBottom: 16, opacity: 0.8 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridOptionBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, minWidth: '47%', flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '500', marginBottom: 3 },
  optionSub: { fontSize: 11 },
  optionsColumn: { flexDirection: 'column', gap: 10 },
  fullOptionBtn: { width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5 },
  fullOptionLabel: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  fullOptionSub: { fontSize: 12 },
  bottomPad: { height: 20 },
  stickyCtaWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 20, borderTopWidth: 0.5 },
  ctaBtn: { padding: 18, borderRadius: 14, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '500', letterSpacing: 0.3 },
});