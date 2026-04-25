import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Animated, Platform, Easing, LayoutAnimation, UIManager,
} from 'react-native';
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getNextMilestone, isUnlocked } from '../storage/userPrefs';

const questions = [
  {
    id: 'vibe',
    question: "What's your vibe right now?",
    subtitle: 'Be honest \u2014 this shapes everything.',
    options: [
      { label: 'Chill', sub: 'Relaxed, no stress' },
      { label: 'Hype', sub: 'Energized, ready to go' },
      { label: 'Emotional', sub: 'Feeling deeply' },
      { label: 'Curious', sub: 'Open minded, exploratory' },
      { label: 'Escapist', sub: 'Want to leave reality' },
      { label: 'Social', sub: 'Watching with someone' },
    ],
  },
  {
    id: 'storyType',
    question: 'What kind of story do you want?',
    subtitle: 'Pick the feeling you want to walk away with.',
    options: [
      { label: 'Action-packed', sub: 'Fast, intense, fights' },
      { label: 'Slow burn', sub: 'Deep, patient, layered' },
      { label: 'Feel-good', sub: 'Warm, fun, wholesome' },
      { label: 'Mind-bending', sub: 'Complex, twisty, cerebral' },
      { label: 'Emotional gut-punch', sub: 'Cry, feel, reflect' },
      { label: 'Dark & gritty', sub: 'Heavy themes, raw' },
    ],
  },
  {
    id: 'commitment',
    question: 'How much are you committing?',
    subtitle: 'Pick the one that matches your energy tonight.',
    options: [
      { label: 'A few episodes of a short series', sub: '2\u20134 eps \u00b7 prefer under 25 total' },
      { label: 'A few episodes of anything', sub: "2\u20134 eps \u00b7 series length doesn't matter" },
      { label: 'Start and finish a short series', sub: 'Binge something under 15 eps tonight' },
      { label: 'Start a long series', sub: 'Beginning of something big \u2014 50\u2013100+ eps' },
    ],
  },
];

const SURPRISE_OPTIONS = {
  vibe: ['Chill', 'Hype', 'Emotional', 'Curious', 'Escapist', 'Social'],
  storyType: ['Action-packed', 'Slow burn', 'Feel-good', 'Mind-bending', 'Emotional gut-punch', 'Dark & gritty'],
  commitment: ['A few episodes of a short series', 'A few episodes of anything', 'Start and finish a short series', 'Start a long series'],
};

const MILESTONE_ICONS = {
  mood_insights: '\uD83E\uDDE0',
  profile_card: '\uD83D\uDCA0',
  kore_score: '\u2694\uFE0F',
  directors_cut: '\uD83D\uDC51',
};

const QUESTION_REVEAL_DURATION_MS = 520;
const QUESTION_SCROLL_DURATION_MS = 700;
const QUESTION_REVEAL_EASING = Easing.bezier(0.22, 1, 0.36, 1);

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const GridOptionButton = memo(({ option, selected, onPress, disabled, colors }) => (
  <TouchableOpacity
    style={[
      styles.gridOptionBtn,
      { borderColor: colors.border, backgroundColor: colors.chalk },
      selected && { backgroundColor: colors.ember, borderColor: colors.ember },
    ]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.optionLabel, { color: colors.ink }, selected && { color: '#fff', fontWeight: '500' }]}>{option.label}</Text>
    <Text style={[styles.optionSub, { color: selected ? 'rgba(255,255,255,0.85)' : '#666' }]}>{option.sub}</Text>
  </TouchableOpacity>
));

const FullOptionButton = memo(({ option, selected, onPress, disabled, colors }) => (
  <TouchableOpacity
    style={[
      styles.fullOptionBtn,
      { borderColor: colors.border, backgroundColor: colors.chalk },
      selected && { backgroundColor: colors.ember, borderColor: colors.ember },
    ]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={[styles.fullOptionLabel, { color: colors.ink }, selected && { color: '#fff', fontWeight: '500' }]}>{option.label}</Text>
    <Text style={[styles.fullOptionSub, { color: selected ? 'rgba(255,255,255,0.85)' : '#666' }]}>{option.sub}</Text>
  </TouchableOpacity>
));

const QuestionContent = memo(({ question, index, isActive, answer, onSelect, colors }) => {
  const isFullWidth = question.id === 'commitment';

  return (
    <View style={styles.questionBlockContent}>
      <View style={styles.stepRow}>
        <View
          style={[
            styles.stepDot,
            { backgroundColor: colors.border },
            answer && { backgroundColor: colors.ink },
            isActive && !answer && { backgroundColor: colors.ember },
          ]}
        />
        <Text style={[styles.stepLabel, { color: colors.charcoal }]}>Question {index + 1} of {questions.length}</Text>
        {answer && (
          <Text style={[styles.stepAnswer, { color: colors.ember }]} numberOfLines={1}>
            {`\u2014 ${answer}`}
          </Text>
        )}
      </View>
      <Text style={[styles.questionText, { color: colors.ink }]}>{question.question}</Text>
      <Text style={[styles.questionSubtitle, { color: colors.charcoal }]}>{question.subtitle}</Text>

      {isFullWidth ? (
        <View style={styles.optionsColumn}>
          {question.options.map((opt) => (
            <FullOptionButton
              key={opt.label}
              option={opt}
              selected={answer === opt.label}
              onPress={() => onSelect(question.id, opt.label)}
              colors={colors}
            />
          ))}
        </View>
      ) : (
        <View style={styles.optionsGrid}>
          {question.options.map((opt) => (
            <GridOptionButton
              key={opt.label}
              option={opt}
              selected={answer === opt.label}
              onPress={() => onSelect(question.id, opt.label)}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const QuestionBlock = memo(({ question, index, currentStep, answer, onSelect, colors, onLayoutCapture }) => {
  const isActive = index === currentStep;
  const isFirstQuestion = index === 0;
  const revealProgress = useRef(new Animated.Value(isFirstQuestion ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState(isFirstQuestion ? null : 0);

  useEffect(() => {
    if (isFirstQuestion || !contentHeight) return;

    Animated.timing(revealProgress, {
      toValue: 1,
      duration: QUESTION_REVEAL_DURATION_MS,
      easing: QUESTION_REVEAL_EASING,
      useNativeDriver: false,
    }).start();
  }, [contentHeight, isFirstQuestion, revealProgress]);

  const animatedWrapperStyle = isFirstQuestion ? null : {
    height: revealProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, contentHeight],
    }),
    opacity: revealProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    marginBottom: revealProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 36],
    }),
    transform: [{
      translateY: revealProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [36, 0],
      }),
    }],
  };

  return (
    <View onLayout={(e) => onLayoutCapture?.(index, e.nativeEvent.layout.y)}>
      {!isFirstQuestion && contentHeight === 0 && (
        <View
          pointerEvents="none"
          style={styles.questionMeasure}
          onLayout={(e) => {
            if (!contentHeight) {
              setContentHeight(e.nativeEvent.layout.height);
            }
          }}
        >
          <QuestionContent
            question={question}
            index={index}
            isActive={isActive}
            answer={answer}
            onSelect={onSelect}
            colors={colors}
          />
        </View>
      )}

      {(isFirstQuestion || contentHeight > 0) && (
        <Animated.View style={[styles.questionBlock, !isFirstQuestion && animatedWrapperStyle]}>
          <QuestionContent
            question={question}
            index={index}
            isActive={isActive}
            answer={answer}
            onSelect={onSelect}
            colors={colors}
          />
        </Animated.View>
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const surpriseAnim = useRef(new Animated.Value(1)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaSlideAnim = useRef(new Animated.Value(20)).current;

  const scrollRef = useRef(null);
  const questionsWrapperY = useRef(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const scrollAnimListenerRef = useRef(null);
  const pendingScrollIndexRef = useRef(null);

  const moodInsightsUnlocked = isUnlocked('mood_insights', streak);
  const koreScoreUnlocked = isUnlocked('kore_score', streak);
  const profileCardUnlocked = streak >= 14;
  const eraLockUnlocked = streak >= 45;
  const nextMilestone = getNextMilestone(streak);
  const hasCompletedMilestones = !nextMilestone && streak > 0;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    scrollAnimListenerRef.current = scrollAnim.addListener(({ value }) => {
      scrollRef.current?.scrollTo({ y: value, animated: false });
    });

    return () => {
      if (scrollAnimListenerRef.current) {
        scrollAnim.removeListener(scrollAnimListenerRef.current);
      }
    };
  }, [scrollAnim]);

  const allAnswered = questions.every((q) => answers[q.id]);

  useEffect(() => {
    if (allAnswered) {
      Animated.parallel([
        Animated.spring(ctaAnim, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.spring(ctaSlideAnim, { toValue: 0, tension: 80, friction: 6, useNativeDriver: true }),
      ]).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      ctaAnim.setValue(0);
      ctaSlideAnim.setValue(20);
    }
  }, [allAnswered, ctaAnim, ctaSlideAnim]);

  const animateScrollTo = useCallback((targetY) => {
    const boundedTargetY = Math.max(0, targetY);
    scrollAnim.stopAnimation((currentValue) => {
      scrollAnim.setValue(currentValue);
      Animated.timing(scrollAnim, {
        toValue: boundedTargetY,
        duration: QUESTION_SCROLL_DURATION_MS,
        easing: QUESTION_REVEAL_EASING,
        useNativeDriver: false,
      }).start();
    });
  }, [scrollAnim]);

  const handleQuestionLayout = useCallback((index, y) => {
    if (pendingScrollIndexRef.current === index) {
      pendingScrollIndexRef.current = null;
      animateScrollTo(questionsWrapperY.current + y - 8);
    }
  }, [animateScrollTo]);

  const handleSelect = useCallback((questionId, option) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers((prev) => ({ ...prev, [questionId]: option }));

    setCurrentStep((prev) => {
      const idx = questions.findIndex((q) => q.id === questionId);
      if (idx < questions.length - 1 && idx === prev) {
        LayoutAnimation.configureNext({
          duration: QUESTION_REVEAL_DURATION_MS,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
            duration: QUESTION_REVEAL_DURATION_MS,
          },
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
            duration: QUESTION_REVEAL_DURATION_MS,
          },
        });
        pendingScrollIndexRef.current = idx + 1;
        return prev + 1;
      }
      return prev;
    });
  }, []);

  const handleSurprise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(surpriseAnim, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.timing(surpriseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onSubmit({
      vibe: getRandom(SURPRISE_OPTIONS.vibe),
      storyType: getRandom(SURPRISE_OPTIONS.storyType),
      commitment: getRandom(SURPRISE_OPTIONS.commitment),
      _surpriseMode: true,
    });
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
              <Text style={[styles.logo, { color: colors.ember }]}>{'\u30B3\u30EC'}</Text>
              <Text style={[styles.appName, { color: colors.ink }]}>Kore</Text>
            </View>
            <View style={styles.headerRight}>
              {streak > 0 && (
                <View style={[styles.streakBadge, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
                  <Text style={styles.streakFire}>{'\uD83D\uDD25'}</Text>
                  <Text style={[styles.streakCount, { color: colors.ember }]}>{streak}</Text>
                </View>
              )}
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]} onPress={() => onOpenWatchLater()}>
                <Text style={styles.iconBtnText}>{'\uD83D\uDD16'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]} onPress={() => onOpenHistory()}>
                <Text style={[styles.iconBtnText, { color: colors.ember }]}>{'\u2726'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]} onPress={() => onOpenProfile()}>
                <Text style={[styles.iconBtnText, { color: colors.charcoal }]}>{'\u2630'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.tagline, { color: colors.charcoal }]}>Your one anime. Right now.</Text>

          {nextMilestone && (
            <View style={styles.milestoneCard}>
              <View style={styles.milestoneTop}>
                <Text style={styles.milestoneIcon}>{MILESTONE_ICONS[nextMilestone.id] || nextMilestone.icon}</Text>
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
            </View>
          )}

          {hasCompletedMilestones && (
            <View style={styles.milestoneCard}>
              <View style={styles.milestoneTop}>
                <Text style={styles.milestoneIcon}>{'\uD83D\uDD25'}</Text>
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneTitle}>Current streak</Text>
                  <Text style={[styles.milestoneDays, { color: colors.ember }]}>
                    {streak} day{streak !== 1 ? 's' : ''} and climbing
                  </Text>
                </View>
              </View>
              <View style={styles.progressBarWrap}>
                <View style={[styles.progressBar, { width: '100%', backgroundColor: colors.ember }]} />
              </View>
            </View>
          )}

          {(moodInsightsUnlocked || koreScoreUnlocked || profileCardUnlocked || eraLockUnlocked) && (
            <View style={styles.unlockedRow}>
              {moodInsightsUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: '#7F77DD', backgroundColor: isDark ? '#1A1A2A' : '#F0EFFE' }]} onPress={onOpenMoodInsights}>
                  <Text style={styles.unlockedBtnIcon}>{'\uD83E\uDDE0'}</Text>
                  <Text style={[styles.unlockedBtnText, { color: '#7F77DD' }]}>Mood Insights</Text>
                </TouchableOpacity>
              )}
              {profileCardUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: '#4D9FFF', backgroundColor: isDark ? '#0A1628' : '#EEF2FF' }]} onPress={onOpenProfileCard}>
                  <Text style={styles.unlockedBtnIcon}>{'\uD83D\uDCA0'}</Text>
                  <Text style={[styles.unlockedBtnText, { color: '#4D9FFF' }]}>Profile Card</Text>
                </TouchableOpacity>
              )}
              {koreScoreUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: colors.ember, backgroundColor: whyNowBg }]} onPress={onOpenKoreScore}>
                  <Text style={styles.unlockedBtnIcon}>{'\u2694\uFE0F'}</Text>
                  <Text style={[styles.unlockedBtnText, { color: colors.ember }]}>Kore Score</Text>
                </TouchableOpacity>
              )}
              {eraLockUnlocked && (
                <TouchableOpacity style={[styles.unlockedBtn, { borderColor: '#7F77DD', backgroundColor: isDark ? '#1A1A2A' : '#F0EFFE' }]} onPress={onOpenEraLock}>
                  <Text style={styles.unlockedBtnIcon}>{'\uD83D\uDC51'}</Text>
                  <Text style={[styles.unlockedBtnText, { color: '#7F77DD' }]}>Era Lock</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: surpriseAnim }] }}>
            <TouchableOpacity style={[styles.surpriseBtn, { backgroundColor: isDark ? '#2A2A2A' : colors.ink }]} onPress={handleSurprise}>
              <Text style={styles.surpriseEmoji}>{'\uD83C\uDFB2'}</Text>
              <View>
                <Text style={[styles.surpriseTitle, { color: isDark ? colors.ink : colors.snow }]}>Surprise me</Text>
                <Text style={[styles.surpriseSub, { color: isDark ? colors.charcoal : '#999' }]}>Skip questions {'\u2014'} just pick for me</Text>
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
          onLayout={(e) => {
            questionsWrapperY.current = e.nativeEvent.layout.y;
          }}
        >
          {questions.slice(0, currentStep + 1).map((q, index) => (
            <QuestionBlock
              key={q.id}
              question={q}
              index={index}
              currentStep={currentStep}
              answer={answers[q.id]}
              onSelect={handleSelect}
              colors={colors}
              onLayoutCapture={handleQuestionLayout}
            />
          ))}
        </Animated.View>

        <View style={styles.bottomPad} />
      </ScrollView>

      {allAnswered && (
        <Animated.View
          style={[
            styles.stickyCtaWrap,
            {
              backgroundColor: colors.snow,
              borderTopColor: colors.border,
              opacity: ctaAnim,
              transform: [{ translateY: ctaSlideAnim }],
            },
          ]}
        >
          <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: colors.ink }]} onPress={() => onSubmit(answers)}>
            <Text style={[styles.ctaText, { color: colors.snow }]}>Decide for me {'\u2192'}</Text>
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
  unlockedRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  unlockedBtn: { width: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5, marginBottom: 10 },
  unlockedBtnIcon: { fontSize: 16 },
  unlockedBtnText: { fontSize: 11, fontWeight: '500' },
  surpriseBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, marginBottom: 10 },
  surpriseEmoji: { fontSize: 28 },
  surpriseTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  surpriseSub: { fontSize: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 28 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, letterSpacing: 0.3 },
  questionBlock: { overflow: 'hidden' },
  questionBlockContent: { marginBottom: 36 },
  questionMeasure: { position: 'absolute', left: 0, right: 0, opacity: 0, zIndex: -1 },
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
