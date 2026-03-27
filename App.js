import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Animated, Image } from 'react-native';
import * as Notifications from 'expo-notifications';
import HomeScreen from './src/screens/HomeScreen';
import ResultScreen from './src/screens/ResultScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import WatchLaterScreen from './src/screens/WatchLaterScreen';
import MilestoneCelebrationScreen from './src/screens/MilestoneCelebrationScreen';
import MoodInsightsScreen from './src/screens/MoodInsightsScreen';
import KoreScoreScreen from './src/screens/KoreScoreScreen';
import AffiliateRewardScreen from './src/screens/AffiliateRewardScreen';
import ProfileCardScreen from './src/screens/ProfileCardScreen';
import EraLockScreen from './src/screens/EraLockScreen';
import AmazonShelfScreen from './src/screens/AmazonShelfScreen';
import { getRecommendation } from './src/services/claude';
import { getSession, signOut as supabaseSignOut, getProfile, updateProfile, supabase } from './src/services/supabase';
import AuthScreen from './src/screens/AuthScreen';
import LandingScreen from './src/screens/LandingScreen';
import { getAnimeCoverArt } from './src/services/anilist';
import {
  getWatchedList, getFavoriteGenres, getStreak, updateStreak,
  getRatingSummary, addToHistory, getCombinedAvoidList,
  getNewlyUnlockedMilestone, markMilestoneSeen,
  setHiddenGemMode, getDirectorsCutMode, getMixHiddenGems, getEraLock,
  setActiveUser, clearActiveUser,
} from './src/storage/userPrefs';
import { lightColors, darkColors } from './src/constants/colors';
import { ThemeContext } from './src/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDED_KEY = 'kore_onboarded';
const DARK_MODE_KEY = 'kore_dark_mode';
const MAX_REROLLS_PER_SESSION = 15;

// Early unlock notification copy — sent when the user hits the internal threshold
// before they've been told the displayed threshold
const EARLY_UNLOCK_NOTIFS = {
  kore_score: {
    title: 'コレ Kore · 30 day reward — 5 days early',
    body: '25 days without missing one. We noticed. Your Kore Score just unlocked ahead of schedule. Open the app to claim it.',
  },
  directors_cut: {
    title: 'コレ Kore · 60 day reward — early',
    body: "45 days straight. That's not a streak anymore — that's a habit. Your 60-day reward just dropped early. You've earned it.",
  },
};

async function scheduleEarlyUnlockNotif(milestoneId) {
  const notif = EARLY_UNLOCK_NOTIFS[milestoneId];
  if (!notif) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title: notif.title, body: notif.body },
      trigger: { seconds: 30 }, // short delay so app can navigate first
    });
  } catch (e) {
    console.log('Could not schedule early unlock notif:', e);
  }
}
const SURPRISE_VIBES       = ['Chill', 'Hype', 'Emotional', 'Curious', 'Escapist', 'Social'];
const SURPRISE_STORY_TYPES = ['Action-packed', 'Slow burn', 'Feel-good', 'Mind-bending', 'Emotional gut-punch', 'Dark & gritty'];
const SURPRISE_COMMITMENTS = ['A few episodes of a short series', 'A few episodes of anything', 'Start and finish a short series', 'Start a long series'];
function getRandomSurpriseAnswers() {
  return {
    vibe:       SURPRISE_VIBES[Math.floor(Math.random() * SURPRISE_VIBES.length)],
    storyType:  SURPRISE_STORY_TYPES[Math.floor(Math.random() * SURPRISE_STORY_TYPES.length)],
    commitment: SURPRISE_COMMITMENTS[Math.floor(Math.random() * SURPRISE_COMMITMENTS.length)],
    _surpriseMode: true,
  };
}

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const themeColors = isDark ? darkColors : lightColors;

  const loadUserProfile = async (userId) => {
    try {
      const profile = await getProfile(userId);
      setUserProfile(profile);
    } catch {}
  };

  const [screen, setScreen] = useState(null);
  const [user, setUser]     = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [result, setResult] = useState(null);
  const [coverArt, setCoverArt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [watchedList, setWatchedList] = useState([]);
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [lastAnswers, setLastAnswers] = useState(null);
  const [streak, setStreak] = useState(0);
  const [pendingMilestone, setPendingMilestone] = useState(null);
  const [pendingMilestoneAction, setPendingMilestoneAction] = useState(null);
  const [previousScreen, setPreviousScreen] = useState(null);
  const [sessionRecommended, setSessionRecommended] = useState([]);
  const [affiliateRewardType, setAffiliateRewardType] = useState(null); // 'cdjapan' | 'nordvpn'


  const [isOffline, setIsOffline] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);
  const [rerollCoolingDown, setRerollCoolingDown] = useState(false);
  const rerollTimerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function init() {
     // await AsyncStorage.clear();
      const savedDarkMode = await AsyncStorage.getItem(DARK_MODE_KEY);
      setIsDark(savedDarkMode === 'true');

      const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 10000));

try {
        const guestMode = await AsyncStorage.getItem('kore_guest_mode');
        const sessionResult = await Promise.race([getSession(), timeout]);

        if (sessionResult && sessionResult !== 'timeout' && sessionResult?.user) {
          setUser(sessionResult.user);
          setIsGuest(false);
          setActiveUser(sessionResult.user.id);
          loadUserProfile(sessionResult.user.id);
          setScreen('home');
        } else if (guestMode === 'true') {
          setIsGuest(true);
          const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
          setScreen(onboarded ? 'home' : 'onboarding');
        } else {
          // No session yet — onAuthStateChange will handle INITIAL_SESSION
          setScreen('landing');
        }
      } catch (e) {
        console.log('Init error:', e);
        setScreen('landing');
      }

      getWatchedList().then(setWatchedList);
      getFavoriteGenres().then(setFavoriteGenres);
      getStreak().then(setStreak);
    }

    // Listen for auth changes
const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        setUser(session.user);
        setIsGuest(false);
        setActiveUser(session.user.id);
        await AsyncStorage.removeItem('kore_guest_mode');
        const profile = await getProfile(session.user.id);
        if (profile) {
          const googleAvatar = session.user.user_metadata?.avatar_url;
          if (googleAvatar && !profile.avatar_url) {
            await updateProfile(session.user.id, { avatar_url: googleAvatar });
            setUserProfile({ ...profile, avatar_url: googleAvatar });
          } else {
            setUserProfile(profile);
          }
          setScreen(prev => (prev === 'auth' || prev === 'landing' || prev === null) ? 'home' : prev);
        } else {
          setScreen('auth_profile_setup');
        }
      } else if (event === 'SIGNED_OUT') {
        clearActiveUser();
        setUser(null);
        setUserProfile(null);
      }
    });
    init();
const handleOffline = () => setIsOffline(true);
    const handleOnline  = () => setIsOffline(false);
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online',  handleOnline);
    }

    return () => {
      if (rerollTimerRef.current) clearTimeout(rerollTimerRef.current);
      subscription?.unsubscribe();
if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online',  handleOnline);
      }
    };
  }, []);

  const handleToggleDarkMode = async (value) => {
    setIsDark(value);
    await AsyncStorage.setItem(DARK_MODE_KEY, String(value));
  };

  const handleOnboardingDone = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
    navigateTo('home');
  };

  const handleAuthSuccess = async () => {
    const session = await getSession();
    if (session?.user) {
      setUser(session.user);
      setActiveUser(session.user.id);
      const profile = await getProfile(session.user.id);
      setUserProfile(profile);
    }
    setIsGuest(false);
    const onboarded = await AsyncStorage.getItem('kore_onboarded');
    navigateTo(onboarded ? 'home' : 'onboarding');
  };

  const handleContinueAsGuest = async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    setIsGuest(true);
    clearActiveUser();
    setStreak(0);
    navigateTo('onboarding'); 
  };

  const handleSignOut = async () => {
    try { await supabaseSignOut(); } catch {}
    clearActiveUser();
    setUser(null);
    setUserProfile(null);
    setIsGuest(false);
    await AsyncStorage.multiRemove([
      'kore_guest_mode',
      'kore_watched_list', 'kore_history', 'kore_ratings',
      'kore_watch_later', 'kore_streak', 'kore_last_used',
      'kore_favorite_genres', 'kore_milestones_seen',
      'kore_notif_enabled', 'kore_notif_hour',
      'kore_mix_hidden_gems', 'kore_era_lock',
    ]);
    navigateTo('auth');
  };

  const navigateTo = (newScreen, callback) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start(() => {
      if (callback) callback();
      setScreen(newScreen);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
    });
  };

  const handleBackFromProfile = () => {
    getFavoriteGenres().then(setFavoriteGenres);
    navigateTo('home');
  };

  const handleSubmit = async (answers, options = {}) => {
    setLastAnswers({ ...answers, ...options });
    setRerollCount(0);
    setRerollCoolingDown(false);
    setSessionRecommended([]);

    const newStreak  = await updateStreak();
    setStreak(newStreak);

    const newMilestone = await getNewlyUnlockedMilestone(newStreak);
    if (newMilestone) {
      await markMilestoneSeen(newMilestone.id);
      setPendingMilestone(newMilestone);
      setPendingMilestoneAction(() => () =>
        fetchRecommendation({ ...answers, ...options }, watchedList, favoriteGenres, [])
      );

      // Schedule early unlock push notification if this is an early unlock milestone
      if (newMilestone.days < newMilestone.displayDays) {
        scheduleEarlyUnlockNotif(newMilestone.id);
      }

      navigateTo('milestone');
      return;
    }

    await fetchRecommendation({ ...answers, ...options }, watchedList, favoriteGenres, []);
  };

  const handleHiddenGemSubmit = async (answers) => {
    await setHiddenGemMode(true);
    handleSubmit(answers, { hiddenGemMode: true });
  };

  const fetchRecommendation = async (answers, watched, genres, currentSessionList) => {
    navigateTo('result');
    setLoading(true);
    setError(null);
    setResult(null);
    setCoverArt(null);

    try {
      const [ratingSummary, avoidList, directorsCut, mixHiddenGems, eraLock] = await Promise.all([
        getRatingSummary(),
        getCombinedAvoidList(),
        getDirectorsCutMode(),
        getMixHiddenGems(),
        getEraLock(),
      ]);

      const sessionAvoidStr = currentSessionList?.length > 0 ? currentSessionList.join(', ') : '';
      const effectiveHiddenGem = answers.hiddenGemMode || (mixHiddenGems && Math.random() < 0.3);

      const recommendation = await getRecommendation({
        vibe:            answers.vibe || answers.mood,
        storyType:       answers.storyType || answers.rideType,
        sessionLength:   answers.commitment || answers.sessionLength || 'A few episodes of anything',
        seriesLength:    answers.seriesLength || answers.commitment || "Don't care",
        favoriteGenres:  genres.length > 0 ? genres.join(', ') : 'No preference',
        avoidList:       avoidList.length > 0 ? avoidList.join(', ') : 'None',
        sessionAvoidList: sessionAvoidStr,
        lovedList:       ratingSummary?.loved?.join(', ')    || '',
        dislikedList:    ratingSummary?.disliked?.join(', ') || '',
        hiddenGemMode:   effectiveHiddenGem,
        directorsCutMode: directorsCut,
        eraLock:         eraLock,
      });

      if (recommendation?.title) {
        setSessionRecommended(prev => [...prev, recommendation.title]);
      }

      // Fetch cover art and prefetch both images BEFORE showing the card
      // Prevents blurry flash — images are in cache when card appears
      let art = null;
      try {
        art = await getAnimeCoverArt(recommendation.title);
        if (art) {
          const jobs = [];
          if (art.cover)  jobs.push(Image.prefetch(art.cover).catch(() => {}));
          if (art.banner) jobs.push(Image.prefetch(art.banner).catch(() => {}));
          await Promise.race([
            Promise.all(jobs),
            new Promise(res => setTimeout(res, 3000)), // 3s cap
          ]);
        }
      } catch {}

      // Set result and art simultaneously — images already in cache
      setResult(recommendation);
      setCoverArt(art);

      await addToHistory({
        title:          recommendation.title,
        japanese_title: recommendation.japanese_title,
        episode_count:  recommendation.episode_count,
        rating:         recommendation.rating,
        genre:          recommendation.genre,
        synopsis:       recommendation.synopsis,
        pitch:          recommendation.pitch,
        why_now:        recommendation.why_now,
        streaming:      recommendation.streaming,
        dub_available:  recommendation.dub_available,
        release_year:   recommendation.release_year,
        season_count:   recommendation.season_count,
        cover:          art?.cover  || null,
        banner:         art?.banner || null,
        mood:           answers.vibe || answers.mood,
        rideType:       answers.storyType || answers.rideType,
        date:           new Date().toISOString(),
        userRating:     null,
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAnother = () => {
    if (!lastAnswers || rerollCount >= MAX_REROLLS_PER_SESSION || rerollCoolingDown) return;
    setRerollCoolingDown(true);
    setRerollCount(prev => prev + 1);
    rerollTimerRef.current = setTimeout(() => setRerollCoolingDown(false), 3000);
    const answersToUse = lastAnswers._surpriseMode ? getRandomSurpriseAnswers() : lastAnswers;
    if (lastAnswers._surpriseMode) setLastAnswers(answersToUse);
    fetchRecommendation(answersToUse, watchedList, favoriteGenres, sessionRecommended);
  };

  const handleBack = () => {
    navigateTo('home', () => { setResult(null); setError(null); setCoverArt(null); });
  };

  // MilestoneCelebrationScreen calls this with an action string to navigate
  // to the right reward screen after the celebration
  const handleMilestoneContinue = (action) => {
    const savedAction = pendingMilestoneAction;
    setPendingMilestone(null);
    setPendingMilestoneAction(null);

    switch (action) {
      case 'mood_insights':
        navigateTo('mood_insights');
        break;
      case 'profile_card':
        navigateTo('profile_card');
        break;
      case 'kore_score':
        navigateTo('kore_score');
        break;
      case 'cdjapan':
        setAffiliateRewardType('cdjapan');
        navigateTo('affiliate_reward');
        break;
      case 'nordvpn':
        setAffiliateRewardType('nordvpn');
        navigateTo('affiliate_reward');
        break;
      case 'era_lock':
        navigateTo('era_lock');
        break;
      case 'amazon_shelf':
        navigateTo('amazon_shelf');
        break;
      case 'home':
      default:
        navigateTo('home');
        if (savedAction) setTimeout(savedAction, 300);
        break;
    }
  };

  const handleSelectAnime = async (anime, returnScreen) => {
    setPreviousScreen(returnScreen);
    setResult(anime);
    const savedArt = anime.cover ? { cover: anime.cover, banner: anime.banner || null } : null;
    setCoverArt(savedArt);
    navigateTo('detail_view');

    // Fetch fresh banner in background if not saved
    if (!anime.banner && anime.title) {
      try {
        const freshArt = await getAnimeCoverArt(anime.title);
        if (freshArt) {
          if (freshArt.cover)  Image.prefetch(freshArt.cover).catch(() => {});
          if (freshArt.banner) Image.prefetch(freshArt.banner).catch(() => {});
          setCoverArt(freshArt);
        }
      } catch {}
    }
  };

  if (!screen) return null;

  return (
    <ThemeContext.Provider value={{ colors: themeColors, isDark, toggleDarkMode: handleToggleDarkMode }}>
      <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
        {isOffline && (
          <View style={{ backgroundColor: '#CC3333', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', zIndex: 999 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>No internet connection — some features may not work</Text>
          </View>
        )}
        <Animated.View style={[
          styles.inner,
          { backgroundColor: themeColors.bg },
          screen !== 'onboarding' && { opacity: fadeAnim },
        ]}>


          {screen === 'landing'    && <LandingScreen onGetStarted={() => navigateTo('auth')} />}
          {screen === 'auth'       && <AuthScreen onAuthSuccess={handleAuthSuccess} onContinueAsGuest={handleContinueAsGuest} />}
          {screen === 'auth_profile_setup' && (
            <AuthScreen
              onAuthSuccess={async () => {
                const session = await getSession();
                if (session?.user) {
                  const profile = await getProfile(session.user.id);
                  setUserProfile(profile);
                }
                navigateTo('onboarding');
              }}
              onContinueAsGuest={handleContinueAsGuest}
              startAtProfile={true}
              userId={user?.id}
            />
          )}
          {screen === 'onboarding' && <OnboardingScreen onDone={handleOnboardingDone} />}

          {screen === 'home' && (
            <HomeScreen
              onSubmit={handleSubmit}
              onOpenProfile={() => navigateTo('profile')}
              onOpenHistory={() => navigateTo('history')}
              onOpenWatchLater={() => navigateTo('watchlater')}
              onOpenMoodInsights={() => navigateTo('mood_insights')}
              onOpenKoreScore={() => navigateTo('kore_score')}
              onHiddenGemSubmit={handleHiddenGemSubmit}
              streak={streak}
            />
          )}

          {screen === 'result' && (
            <ResultScreen
              result={result} coverArt={coverArt} loading={loading} error={error}
              onBack={handleBack} onGenerateAnother={handleGenerateAnother}
              rerollCoolingDown={rerollCoolingDown} rerollCount={rerollCount}
              maxRerolls={MAX_REROLLS_PER_SESSION}
              vibe={lastAnswers?.vibe || lastAnswers?.mood || null}
              isDetailView={false}
              isSurprise={lastAnswers?._surpriseMode || false}
            />
          )}

          {screen === 'detail_view' && result && (
            <ResultScreen
              result={result} coverArt={coverArt} loading={false} error={null}
              onBack={() => navigateTo(previousScreen || 'home', () => {
                setResult(null); setCoverArt(null);
              })}
              onGenerateAnother={null}
              rerollCoolingDown={false} rerollCount={0} maxRerolls={0}
              vibe={result.mood || null} isDetailView={true}
            />
          )}

          {screen === 'profile' && <ProfileScreen onBack={handleBackFromProfile} streak={streak} onSignOut={handleSignOut} userProfile={userProfile} onEdit={() => navigateTo('edit_profile')} />}
          {screen === 'edit_profile' && (
            <EditProfileScreen
              onBack={() => navigateTo('profile')}
              userProfile={userProfile}
              onSave={(updated) => {
                setUserProfile(updated);
                navigateTo('profile');
              }}
            />
          )}

          {screen === 'history' && (
            <HistoryScreen
              onBack={() => navigateTo('home')}
              onSelectAnime={a => handleSelectAnime(a, 'history')}
            />
          )}

          {screen === 'watchlater' && (
            <WatchLaterScreen
              onBack={() => navigateTo('home')}
              onSelectAnime={a => handleSelectAnime(a, 'watchlater')}
            />
          )}

          {screen === 'milestone' && pendingMilestone && (
            <MilestoneCelebrationScreen
              milestone={pendingMilestone}
              streak={streak}
              onContinue={handleMilestoneContinue}
            />
          )}

          {screen === 'mood_insights' && (
            <MoodInsightsScreen onBack={() => navigateTo('home')} streak={streak} />
          )}

          {screen === 'kore_score' && (
            <KoreScoreScreen onBack={() => navigateTo('home')} />
          )}

          {screen === 'profile_card' && (
            <ProfileCardScreen onBack={() => navigateTo('home')} streak={streak} />
          )}

          {screen === 'affiliate_reward' && (
            <AffiliateRewardScreen
              type={affiliateRewardType}
              onBack={() => {
                setAffiliateRewardType(null);
                navigateTo('home');
              }}
            />
          )}

          {screen === 'era_lock' && (
            <EraLockScreen
              onBack={() => navigateTo('home')}
              onActivate={() => navigateTo('home')}
            />
          )}

          {screen === 'amazon_shelf' && (
            <AmazonShelfScreen onBack={() => navigateTo('home')} />
          )}

        </Animated.View>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 480, flex: 1 },
});