import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Animated, Image, Text } from 'react-native';
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
import { getSession, signOut as supabaseSignOut, getProfileState, getRenderableAvatarUrl, resolveAvatarUrl, updateProfile, supabase, createPreferences } from './src/services/supabase';
import AuthScreen from './src/screens/AuthScreen';
import LandingScreen from './src/screens/LandingScreen';
import { getAnimeCoverArt } from './src/services/anilist';
import {
  getWatchedList, getFavoriteGenres, getStreak, updateStreak,
  getRatings, addToHistory, getCombinedAvoidList,
  getNewlyUnlockedMilestone, markMilestoneSeen,
  getDirectorsCutMode, getMixHiddenGems, getEraLock,
  setActiveUser, clearActiveUser,
} from './src/storage/userPrefs';
import { lightColors, darkColors } from './src/constants/colors';
import { ThemeContext } from './src/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDED_KEY = 'kore_onboarded';
const DARK_MODE_KEY = 'kore_dark_mode';
const MAX_REROLLS_PER_SESSION = 15;
const MAX_RATED_RECOMMENDATION_ATTEMPTS = 5;

const EARLY_UNLOCK_NOTIFS = {
  kore_score: {
    title: '\u30B3\u30EC Kore \u00B7 30 day reward \u2014 5 days early',
    body: '25 days without missing one. We noticed. Your Kore Score just unlocked ahead of schedule. Open the app to claim it.',
  },
  directors_cut: {
    title: '\u30B3\u30EC Kore \u00B7 60 day reward \u2014 early',
    body: "45 days straight. That's not a streak anymore \u2014 that's a habit. Your 60-day reward just dropped early. You've earned it.",
  },
};

function getNormalizedUsername(profile) {
  return typeof profile?.username === 'string' ? profile.username.trim() : '';
}

function getRecommendationTitleKey(title) {
  return typeof title === 'string'
    ? title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
    : '';
}

const AUTH_PATH_PROFILE_TIMEOUT_MS = 750;
const DEFAULT_PROFILE_TIMEOUT_MS = 4000;
const NON_AUTH_PROFILE_RETRY_DELAY_MS = 1500;

async function scheduleEarlyUnlockNotif(milestoneId) {
  const notif = EARLY_UNLOCK_NOTIFS[milestoneId];
  if (!notif) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title: notif.title, body: notif.body },
      trigger: { seconds: 30 },
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

  const [screen, setScreen]           = useState(null);
  const [user, setUser]               = useState(null);
  const [isGuest, setIsGuest]         = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [result, setResult]           = useState(null);
  const [coverArt, setCoverArt]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [watchedList, setWatchedList] = useState([]);
  const [favoriteGenres, setFavoriteGenres] = useState([]);
  const [lastAnswers, setLastAnswers] = useState(null);
  const [streak, setStreak]           = useState(0);
  const [pendingMilestone, setPendingMilestone]             = useState(null);
  const [pendingMilestoneAction, setPendingMilestoneAction] = useState(null);
  const [previousScreen, setPreviousScreen]                 = useState(null);
  const [sessionRecommended, setSessionRecommended]         = useState([]);
  const [affiliateRewardType, setAffiliateRewardType]       = useState(null);
  const [affiliateRewardReturnContext, setAffiliateRewardReturnContext] = useState(null);
  const [isOffline, setIsOffline]     = useState(false);
  const [resultKey, setResultKey]     = useState(0);
  const [rerollCount, setRerollCount] = useState(0);
  const [rerollCoolingDown, setRerollCoolingDown] = useState(false);
  
  const rerollTimerRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const authHandledRef = useRef(false);
  const currentUserRef = useRef(null);
  const screenRef = useRef(screen);
  const authHydrationPromiseRef = useRef(null);
  const authHydrationUserIdRef = useRef(null);
  const lastHandledSignedInUserIdRef = useRef(null);
  const navigationHistoryRef = useRef([]);

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const withTimeout = async (promise, ms, label) => {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const refreshCurrentUserProfile = async (fallbackProfile = null) => {
    const userId = currentUserRef.current?.id;
    const fallbackAvatarUrl = await resolveAvatarUrl(fallbackProfile?.avatar_url, { cacheBust: true });
    if (!userId) {
      if (fallbackProfile) {
        setUserProfile({
          ...fallbackProfile,
          avatar_url: fallbackAvatarUrl,
        });
      }
      return fallbackProfile;
    }

    try {
      const result = await getProfileState(userId);
      if (!result?.profile) {
        if (fallbackProfile) {
          setUserProfile({
            ...fallbackProfile,
            avatar_url: fallbackAvatarUrl,
          });
        }
        return fallbackProfile;
      }

      const fetchedAvatarUrl = await resolveAvatarUrl(result.profile.avatar_url, { cacheBust: true });
      console.log('[AVATAR_DEBUG] refreshCurrentUserProfile fetched profile payload', {
        userId,
        avatarField: 'avatar_url',
        rawAvatarUrl: result.profile.avatar_url ?? null,
        renderableAvatarUrl: fetchedAvatarUrl,
        fallbackAvatarUrl,
      });

      const refreshedProfile = {
        ...(fallbackProfile || {}),
        ...result.profile,
        avatar_url: fetchedAvatarUrl || fallbackAvatarUrl || null,
      };
      console.log('[AVATAR_DEBUG] refreshCurrentUserProfile merged profile payload', {
        userId,
        avatarField: 'avatar_url',
        mergedAvatarUrl: refreshedProfile.avatar_url ?? null,
      });
      setUserProfile(refreshedProfile);
      return refreshedProfile;
    } catch (e) {
      console.log('[AVATAR_DEBUG] refreshCurrentUserProfile error', {
        userId,
        message: e?.message || String(e),
      });
      if (fallbackProfile) {
        setUserProfile({
          ...fallbackProfile,
          avatar_url: fallbackAvatarUrl,
        });
      }
      return fallbackProfile;
    }
  };

  const hydrateAuthenticatedUser = async (sessionUser) => {
    if (!sessionUser?.id) return;
    const authPathScreens = ['auth', 'auth_profile_setup', 'landing'];
    const isAuthPath = screenRef.current == null || authPathScreens.includes(screenRef.current);
    console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser start', {
      userId: sessionUser.id,
      currentScreen: screenRef.current,
    });

    if (authHydrationPromiseRef.current && authHydrationUserIdRef.current === sessionUser.id) {
      return authHydrationPromiseRef.current;
    }

    const hydrationTask = (async () => {
      try {
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before setUser', { userId: sessionUser.id });
        setUser(sessionUser);
        currentUserRef.current = sessionUser;
        setIsGuest(false);
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after setUser', { userId: sessionUser.id });

        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before setActiveUser', { userId: sessionUser.id });
        setActiveUser(sessionUser.id);
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after setActiveUser', { userId: sessionUser.id });

        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before remove guest mode', { userId: sessionUser.id });
        await AsyncStorage.removeItem('kore_guest_mode');
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after remove guest mode', { userId: sessionUser.id });

        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before createPreferences', { userId: sessionUser.id });
        createPreferences(sessionUser.id)
          .then(() => {
            console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after createPreferences', { userId: sessionUser.id });
          })
          .catch((e) => {
            console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser createPreferences error', {
              userId: sessionUser.id,
              message: e?.message || String(e),
            });
          });

        let profile = null;
        let profileStatus = 'unavailable';
        const profileTimeoutMs = isAuthPath ? AUTH_PATH_PROFILE_TIMEOUT_MS : DEFAULT_PROFILE_TIMEOUT_MS;

        const loadProfile = async (label) => {
          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before getProfileState', {
            userId: sessionUser.id,
            label,
          });

          const result = await withTimeout(getProfileState(sessionUser.id), profileTimeoutMs, label);
          const normalizedUsername = getNormalizedUsername(result.profile);
          const renderableAvatarUrl = await resolveAvatarUrl(result.profile?.avatar_url);

          profile = result.profile
            ? {
                ...result.profile,
                avatar_url: renderableAvatarUrl || null,
              }
            : null;
          if (result.profile) {
            profileStatus = normalizedUsername ? 'valid' : 'incomplete';
          } else {
            profileStatus = result.missing ? 'missing' : 'unavailable';
          }

          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after getProfileState', {
            userId: sessionUser.id,
            label,
            profileStatus,
            hasProfile: Boolean(profile),
            username: normalizedUsername || null,
            rawAvatarUrl: result.profile?.avatar_url ?? null,
            renderableAvatarUrl,
          });
        };

        try {
          await loadProfile('getProfile');
        } catch (e) {
          profileStatus = 'unavailable';
          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser getProfileState error', {
            userId: sessionUser.id,
            message: e?.message || String(e),
          });
        }

        if (profileStatus === 'unavailable' && !isAuthPath) {
          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before profile retry delay', { userId: sessionUser.id });
          await wait(NON_AUTH_PROFILE_RETRY_DELAY_MS);
          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after profile retry delay', { userId: sessionUser.id });
          try {
            await loadProfile('retry getProfile');
          } catch (e) {
            profileStatus = 'unavailable';
            console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser retry getProfileState error', {
              userId: sessionUser.id,
              message: e?.message || String(e),
            });
          }
        }

        if (profileStatus === 'unavailable' && isAuthPath) {
          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser auth-path profile unavailable', {
            userId: sessionUser.id,
            currentScreen: screenRef.current,
          });
        }

        const refreshProfileInBackground = () => {
          if (!isAuthPath || profileStatus !== 'unavailable') return;

          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser start background profile refresh', {
            userId: sessionUser.id,
          });

          getProfileState(sessionUser.id)
            .then(async (result) => {
              if (currentUserRef.current?.id !== sessionUser.id) {
                return;
              }

              const normalizedUsername = getNormalizedUsername(result.profile);
              const refreshedStatus = result.profile
                ? (normalizedUsername ? 'valid' : 'incomplete')
                : (result.missing ? 'missing' : 'unavailable');
              const renderableAvatarUrl = await resolveAvatarUrl(result.profile?.avatar_url);

              console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser background profile refresh resolved', {
                userId: sessionUser.id,
                refreshedStatus,
                username: normalizedUsername || null,
                rawAvatarUrl: result.profile?.avatar_url ?? null,
                renderableAvatarUrl,
              });

              if (result.profile) {
                setUserProfile({
                  ...result.profile,
                  avatar_url: renderableAvatarUrl || null,
                });
              }

              if (refreshedStatus === 'missing' || refreshedStatus === 'incomplete') {
                navigateTo('auth_profile_setup');
              }
            })
            .catch((e) => {
              console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser background profile refresh error', {
                userId: sessionUser.id,
                message: e?.message || String(e),
              });
            });
        };

        if (profile) {
          const googleAvatar = sessionUser.user_metadata?.avatar_url;
          if (googleAvatar && !profile.avatar_url) {
            try {
              console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before updateProfile avatar sync', { userId: sessionUser.id });
              await updateProfile(sessionUser.id, { avatar_url: googleAvatar });
              profile = { ...profile, avatar_url: googleAvatar };
              console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after updateProfile avatar sync', { userId: sessionUser.id });
            } catch (e) {
              console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser updateProfile avatar sync error', {
                userId: sessionUser.id,
                message: e?.message || String(e),
              });
            }
          }
          setUserProfile(profile);
        } else if (profileStatus === 'missing') {
          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser profile missing', {
            userId: sessionUser.id,
          });
          setUserProfile(null);
        }

        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before onboarded lookup', { userId: sessionUser.id });
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after onboarded lookup', {
          userId: sessionUser.id,
          onboarded,
        });

        const hasValidProfile = Boolean(profile && getNormalizedUsername(profile));
        const requiresProfileSetup = profileStatus === 'missing' || profileStatus === 'incomplete';
        const fallbackScreen = onboarded === 'true' ? 'home' : 'onboarding';
        const targetScreen = requiresProfileSetup ? 'auth_profile_setup' : fallbackScreen;
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser route decision', {
          userId: sessionUser.id,
          targetScreen,
          profileStatus,
          hasProfile: Boolean(profile),
          hasValidProfile,
          username: getNormalizedUsername(profile) || null,
          isAuthPath,
        });
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser before navigateTo', {
          userId: sessionUser.id,
          targetScreen,
        });
        navigateTo(targetScreen);
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser after navigateTo', {
          userId: sessionUser.id,
          targetScreen,
        });

        refreshProfileInBackground();

        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser start background hydration', { userId: sessionUser.id });
        Promise.all([
          getStreak().catch((e) => {
            console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser getStreak error', {
              userId: sessionUser.id,
              message: e?.message || String(e),
            });
            return 0;
          }),
          getWatchedList().catch((e) => {
            console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser getWatchedList error', {
              userId: sessionUser.id,
              message: e?.message || String(e),
            });
            return [];
          }),
          getFavoriteGenres().catch((e) => {
            console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser getFavoriteGenres error', {
              userId: sessionUser.id,
              message: e?.message || String(e),
            });
            return [];
          })
        ]).then(([strk, wList, fGenres]) => {
          if (currentUserRef.current?.id !== sessionUser.id) {
            console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser stale background hydration discarded', {
              resolvedUserId: sessionUser.id,
              currentUserId: currentUserRef.current?.id || null,
            });
            return;
          }
          console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser background hydration resolved', {
            userId: sessionUser.id,
            streak: strk,
            watchedCount: wList.length,
            genreCount: fGenres.length,
          });
          setStreak(strk);
          setWatchedList(wList);
          setFavoriteGenres(fGenres);
        });
      } catch (e) {
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser fatal error', {
          userId: sessionUser.id,
          message: e?.message || String(e),
        });
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        const targetScreen = onboarded === 'true' ? 'home' : 'onboarding';
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser fatal fallback route', {
          userId: sessionUser.id,
          targetScreen,
        });
        navigateTo(targetScreen);
      } finally {
        console.log('[GOOGLE_AUTH_DEBUG] hydrateAuthenticatedUser finally', {
          userId: sessionUser.id,
        });
      }
    })();

    authHydrationPromiseRef.current = hydrationTask;
    authHydrationUserIdRef.current = sessionUser.id;
    try {
      await hydrationTask;
    } finally {
      if (authHydrationPromiseRef.current === hydrationTask) {
        authHydrationPromiseRef.current = null;
        authHydrationUserIdRef.current = null;
      }
    }
  };

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    async function init() {
      const savedDarkMode = await AsyncStorage.getItem(DARK_MODE_KEY);
      setIsDark(savedDarkMode === 'true');

      if (typeof window !== 'undefined' && typeof window.history !== 'undefined' && window.location?.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      let sessionTimeoutId = null;
      const timeout = new Promise(resolve => {
        sessionTimeoutId = setTimeout(() => resolve('timeout'), 10000);
      });

      try {
        const guestMode = await AsyncStorage.getItem('kore_guest_mode');
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        const hasLaunched = await AsyncStorage.getItem('kore_has_launched');
        const sessionResult = await Promise.race([getSession(), timeout]);
        if (sessionTimeoutId) {
          clearTimeout(sessionTimeoutId);
          sessionTimeoutId = null;
        }

        if (sessionResult && sessionResult !== 'timeout' && sessionResult?.user) {
          if (!authHandledRef.current) {
            authHandledRef.current = true;
            await hydrateAuthenticatedUser(sessionResult.user);
          }
        } else if (guestMode === 'true') {
          setIsGuest(true);
          if (!authHandledRef.current) {
            authHandledRef.current = true;
            setScreen(onboarded === 'true' ? 'home' : 'onboarding');
          }
        } else {
          if (!hasLaunched) {
            await AsyncStorage.setItem('kore_has_launched', 'true');
            if (!authHandledRef.current) {
              authHandledRef.current = true;
              setScreen('landing');
            }
          } else {
            if (!authHandledRef.current) {
              authHandledRef.current = true;
              setScreen('auth');
            }
          }
        }
      } catch (e) {
        if (sessionTimeoutId) {
          clearTimeout(sessionTimeoutId);
          sessionTimeoutId = null;
        }
        console.log('Init error:', e);
        if (!authHandledRef.current) {
          authHandledRef.current = true;
          setScreen('landing');
        }
      } finally {
        if (sessionTimeoutId) {
          clearTimeout(sessionTimeoutId);
        }
      }

      getWatchedList().then(setWatchedList);
      getFavoriteGenres().then(setFavoriteGenres);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[GOOGLE_AUTH_DEBUG] onAuthStateChange', {
        event,
        sessionUserId: session?.user?.id || null,
        currentScreen: screenRef.current,
      });
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          currentUserRef.current = session.user;
          setActiveUser(session.user.id);
        }
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        if (lastHandledSignedInUserIdRef.current === session.user.id && authHydrationPromiseRef.current) {
          return;
        }
        lastHandledSignedInUserIdRef.current = session.user.id;
        await hydrateAuthenticatedUser(session.user);
      }

      if (event === 'SIGNED_OUT') {
        lastHandledSignedInUserIdRef.current = null;
        navigationHistoryRef.current = [];
        setUser(null);
        currentUserRef.current = null;
        setScreen('landing');
      }
    });

    init();

    const handleOffline = () => setIsOffline(true);
    const handleOnline  = () => setIsOffline(false);
    const handleVisibilityChange = async () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      try {
        const currentSession = await getSession();
        if (currentSession?.user) {
          setActiveUser(currentSession.user.id);
          setUser(currentSession.user);
          currentUserRef.current = currentSession.user;
        }
      } catch {}
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online',  handleOnline);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (rerollTimerRef.current) clearTimeout(rerollTimerRef.current);
      subscription?.unsubscribe();
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online',  handleOnline);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const handleAuthSuccess = async (sessionOverride = null) => {
    if (sessionOverride?.user) {
      await hydrateAuthenticatedUser(sessionOverride.user);
      return sessionOverride.user;
    }

    const retryDelays = [0, 250, 500, 1000];

    for (const delay of retryDelays) {
      if (delay > 0) {
        await wait(delay);
      }

      const session = await getSession();
      if (session?.user) {
        await hydrateAuthenticatedUser(session.user);
        return session.user;
      }
    }

    throw new Error('Could not finish signing in. Please try again.');
  };

  const handleContinueAsGuest = async () => {
    await AsyncStorage.setItem('kore_guest_mode', 'true');
    setIsGuest(true);
    clearActiveUser();
    lastHandledSignedInUserIdRef.current = null;
    setStreak(0);
    navigateTo('onboarding', null, { resetHistory: true });
  };

  const handleSignOut = async () => {
    try { await supabaseSignOut(); } catch {}
    clearActiveUser();
    lastHandledSignedInUserIdRef.current = null;
    setUser(null);
    currentUserRef.current = null;
    setUserProfile(null);
    setIsGuest(false);
    setStreak(0);
    setWatchedList([]);
    setFavoriteGenres([]);
    setResult(null);
    setCoverArt(null);
    setSessionRecommended([]);
    setPreviousScreen(null);
    setAffiliateRewardType(null);
    setAffiliateRewardReturnContext(null);
    setPendingMilestone(null);
    setPendingMilestoneAction(null);
    navigationHistoryRef.current = [];
    
    await AsyncStorage.multiRemove([
      'kore_guest_mode',
      'kore_watched_list', 'kore_history', 'kore_ratings',
      'kore_watch_later', 'kore_streak', 'kore_last_used',
      'kore_favorite_genres', 'kore_milestones_seen',
      'kore_notif_enabled', 'kore_notif_hour',
      'kore_mix_hidden_gems', 'kore_era_lock',
    ]);
    navigateTo('auth', null, { resetHistory: true });
  };

  const transitionTo = (newScreen, callback) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      if (callback) callback();
      setScreen(newScreen);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const navigateTo = (newScreen, callback, options = {}) => {
    const { resetHistory = false } = options;
    const currentScreen = screenRef.current;

    if (resetHistory) {
      navigationHistoryRef.current = [];
    } else if (currentScreen && currentScreen !== newScreen) {
      navigationHistoryRef.current.push(currentScreen);
    }

    transitionTo(newScreen, callback);
  };

  const goBack = (fallbackScreen = 'home', callback) => {
    const previousScreen = navigationHistoryRef.current.pop() || fallbackScreen;
    transitionTo(previousScreen, callback);
  };

  const handleBackFromProfile = () => {
    getFavoriteGenres().then(setFavoriteGenres);
    getStreak().then(setStreak);
    goBack('home');
  };

  const handleSubmit = async (answers, options = {}) => {
    setLastAnswers({ ...answers, ...options });
    setRerollCount(0);
    setRerollCoolingDown(false);
    setSessionRecommended([]);

    const newStreak = await updateStreak();
    setStreak(newStreak);

    const newMilestone = await getNewlyUnlockedMilestone(newStreak);
    if (newMilestone) {
      await markMilestoneSeen(newMilestone.id);
      setPendingMilestone(newMilestone);
      setPendingMilestoneAction(() => () =>
        fetchRecommendation({ ...answers, ...options }, watchedList, favoriteGenres, [])
      );
      if (newMilestone.days < newMilestone.displayDays) {
        scheduleEarlyUnlockNotif(newMilestone.id);
      }
      navigateTo('milestone');
      return;
    }

    await fetchRecommendation({ ...answers, ...options }, watchedList, favoriteGenres, []);
  };

  const fetchRecommendation = async (answers, watched, genres, currentSessionList) => {
    setResultKey(prev => prev + 1);
    navigateTo('result');
    setLoading(true);
    setError(null);
    setResult(null);
    setCoverArt(null);

    try {
      const [ratings, avoidList, directorsCut, mixHiddenGems, eraLock] = await Promise.all([
        getRatings(),
        getCombinedAvoidList(),
        getDirectorsCutMode(),
        getMixHiddenGems(),
        getEraLock(),
      ]);

      const ratingSummary = {
        loved: ratings.filter(r => r.rating === 'loved').map(r => r.title),
        disliked: ratings.filter(r => r.rating === 'disliked').map(r => r.title),
      };
      const ratedTitles = Array.from(new Set(ratings.map(r => r?.title).filter(Boolean)));
      const ratedTitleKeys = new Set(ratedTitles.map(getRecommendationTitleKey).filter(Boolean));

      const mergedAvoidList = Array.from(new Set([
        ...avoidList,
        ...watched.map(w => w?.title || w),
        ...ratedTitles,
      ])).filter(Boolean);

      const effectiveHiddenGem = answers.hiddenGemMode || (mixHiddenGems && Math.random() < 0.3);
      const attemptSessionTitles = [...(currentSessionList || [])];
      const requestRecommendation = () => getRecommendation({
        vibe:             answers.vibe || answers.mood,
        storyType:        answers.storyType || answers.rideType,
        sessionLength:    answers.commitment || answers.sessionLength || 'A few episodes of anything',
        seriesLength:     answers.seriesLength || answers.commitment || "Don't care",
        favoriteGenres:   genres.length > 0 ? genres.join(', ') : 'No preference',
        avoidList:        mergedAvoidList.length > 0 ? mergedAvoidList.join(', ') : 'None',
        sessionAvoidList: attemptSessionTitles.length > 0 ? attemptSessionTitles.join(', ') : '',
        lovedList:        ratingSummary.loved.join(', ') || '',
        dislikedList:     ratingSummary.disliked.join(', ') || '',
        hiddenGemMode:    effectiveHiddenGem,
        directorsCutMode: directorsCut,
        eraLock:          eraLock,
      });

      let recommendation = null;

      for (let attempt = 0; attempt < MAX_RATED_RECOMMENDATION_ATTEMPTS; attempt += 1) {
        recommendation = await requestRecommendation();

        const recommendedTitle = recommendation?.title;
        const recommendedTitleKey = getRecommendationTitleKey(recommendedTitle);

        if (!recommendedTitleKey || !ratedTitleKeys.has(recommendedTitleKey)) {
          break;
        }

        attemptSessionTitles.push(recommendedTitle);
      }

      if (ratedTitleKeys.has(getRecommendationTitleKey(recommendation?.title))) {
        throw new Error('Could not find a fresh recommendation outside your rated titles. Please try again.');
      }

      if (recommendation?.title) {
        setSessionRecommended(prev => [...prev, recommendation.title]);
      }

      let art = null;
      try {
        art = await getAnimeCoverArt(recommendation.title);
        if (art) {
          const jobs = [];
          if (art.cover)  jobs.push(Image.prefetch(art.cover).catch(() => {}));
          if (art.banner) jobs.push(Image.prefetch(art.banner).catch(() => {}));
          await Promise.race([
            Promise.all(jobs),
            new Promise(res => setTimeout(res, 3000)),
          ]);
        }
      } catch {}

      setResult(recommendation);
      setCoverArt(art);

      await addToHistory({
        title:           recommendation.title,
        japanese_title:  recommendation.japanese_title,
        episode_count:   recommendation.episode_count,
        rating:          recommendation.rating,
        genre:           recommendation.genre,
        synopsis:        recommendation.synopsis,
        pitch:           recommendation.pitch,
        why_now:         recommendation.why_now,
        streaming:       recommendation.streaming,
        dub_available:   recommendation.dub_available,
        release_year:    recommendation.release_year,
        season_count:    recommendation.season_count,
        cover:           art?.cover  || null,
        banner:          art?.banner || null,
        mood:            answers.vibe || answers.mood,
        rideType:        answers.storyType || answers.rideType,
        date:            new Date().toISOString(),
        userRating:      null,
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
    getStreak().then(setStreak);
    goBack('home', () => {
      setResult(null); setError(null); setCoverArt(null);
    });
  };

  const handleMilestoneContinue = (action) => {
    const currentMilestone = pendingMilestone;
    const savedAction = pendingMilestoneAction;
    setPendingMilestone(null);
    setPendingMilestoneAction(null);

    switch (action) {
      case 'mood_insights_and_cdjapan':
        setAffiliateRewardType('cdjapan');
        setAffiliateRewardReturnContext(currentMilestone ? { screen: 'milestone', milestone: currentMilestone, pendingAction: savedAction } : null);
        navigateTo('affiliate_reward');
        break;
      case 'mood_insights':   navigateTo('mood_insights'); break;
      case 'profile_card':    navigateTo('profile_card'); break;
      case 'kore_score':      navigateTo('kore_score'); break;
      case 'cdjapan':
        setAffiliateRewardType('cdjapan');
        setAffiliateRewardReturnContext(currentMilestone ? { screen: 'milestone', milestone: currentMilestone, pendingAction: savedAction } : null);
        navigateTo('affiliate_reward');
        break;
      case 'nordvpn':
        setAffiliateRewardType('nordvpn');
        setAffiliateRewardReturnContext(currentMilestone ? { screen: 'milestone', milestone: currentMilestone, pendingAction: savedAction } : null);
        navigateTo('affiliate_reward');
        break;
      case 'era_lock':        navigateTo('era_lock'); break;
      case 'amazon_shelf':    navigateTo('amazon_shelf'); break;
      case 'home_only':
        navigateTo('home');
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

  if (!screen) return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }} />
  );

  return (
    <ThemeContext.Provider value={{ colors: themeColors, isDark, toggleDarkMode: handleToggleDarkMode }}>
      <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
        {isOffline && (
          <View style={{ backgroundColor: '#CC3333', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', zIndex: 999 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>No internet connection — some features may not work</Text>
          </View>
        )}
        
        {/* FIX: opacity: fadeAnim is now PERMANENTLY bound to this view so it doesn't stick at 0 on 'onboarding' */}
          <Animated.View style={[
          styles.inner,
          { backgroundColor: themeColors.bg, opacity: fadeAnim },
        ]}>
          {screen === 'landing' && <LandingScreen onGetStarted={() => navigateTo('auth')} />}
          {screen === 'auth' && <AuthScreen key="auth" onAuthSuccess={handleAuthSuccess} onContinueAsGuest={handleContinueAsGuest} />}
          {screen === 'auth_profile_setup' && (
            <AuthScreen
              key="auth_profile_setup"
              onAuthSuccess={handleAuthSuccess}
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
              onOpenProfileCard={() => navigateTo('profile_card')}
              onOpenEraLock={() => navigateTo('era_lock')}
              streak={streak}
            />
          )}

          {screen === 'result' && (
            <ResultScreen
              key={resultKey}
              result={result} coverArt={coverArt} loading={loading} error={error}
              onBack={handleBack} onGenerateAnother={handleGenerateAnother}
              rerollCoolingDown={rerollCoolingDown} rerollCount={rerollCount}
              maxRerolls={MAX_REROLLS_PER_SESSION}
              vibe={lastAnswers?.vibe || lastAnswers?.mood || null}
              isDetailView={false}
              isSurprise={lastAnswers?._surpriseMode || false}
              affiliateUnlockState={{ streak }}
              userRegion={userProfile?.region ?? userProfile?.country ?? null}
            />
          )}

          {screen === 'detail_view' && result && (
            <ResultScreen
              result={result} coverArt={coverArt} loading={false} error={null}
              onBack={() => goBack(previousScreen || 'home', () => {
                setResult(null); setCoverArt(null);
              })}
              onGenerateAnother={null}
              rerollCoolingDown={false} rerollCount={0} maxRerolls={0}
              vibe={result.mood || null} isDetailView={true}
              affiliateUnlockState={{ streak }}
              userRegion={userProfile?.region ?? userProfile?.country ?? null}
            />
          )}

          {screen === 'profile' && (
            <ProfileScreen
              onBack={handleBackFromProfile}
              streak={streak}
              onSignOut={handleSignOut}
              userProfile={userProfile}
              onEdit={() => navigateTo('edit_profile')}
              onOpenEraLock={() => navigateTo('era_lock')}
              setAffiliateRewardType={setAffiliateRewardType}
              navigateTo={navigateTo}
            />
          )}

          {screen === 'edit_profile' && (
            <EditProfileScreen
              onBack={() => goBack('profile')}
              userProfile={userProfile}
              onSave={async (updated) => {
                const normalizedUpdatedProfile = {
                  ...updated,
                  avatar_url: await resolveAvatarUrl(updated?.avatar_url, { cacheBust: true }),
                };
                console.log('[AVATAR_DEBUG] App onSave received profile payload', {
                  avatarField: 'avatar_url',
                  rawAvatarUrl: updated?.avatar_url ?? null,
                  normalizedAvatarUrl: normalizedUpdatedProfile.avatar_url,
                  username: normalizedUpdatedProfile.username || null,
                });
                setUserProfile(normalizedUpdatedProfile);
                await refreshCurrentUserProfile(normalizedUpdatedProfile);
                goBack('profile');
              }}
            />
          )}

          {screen === 'history' && (
            <HistoryScreen
              onBack={() => goBack('home')}
              onSelectAnime={a => handleSelectAnime(a, 'history')}
            />
          )}

          {screen === 'watchlater' && (
            <WatchLaterScreen
              onBack={() => goBack('home')}
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
            <MoodInsightsScreen onBack={() => goBack('home')} streak={streak} />
          )}

          {screen === 'kore_score' && (
            <KoreScoreScreen onBack={() => goBack('home')} />
          )}

          {screen === 'profile_card' && (
            <ProfileCardScreen onBack={() => goBack('home')} streak={streak} />
          )}

          {screen === 'affiliate_reward' && (
            <AffiliateRewardScreen
              type={affiliateRewardType}
              onBack={() => {
                const returnContext = affiliateRewardReturnContext;
                setAffiliateRewardType(null);
                setAffiliateRewardReturnContext(null);
                if (returnContext?.screen === 'milestone' && returnContext.milestone) {
                  setPendingMilestone(returnContext.milestone);
                  setPendingMilestoneAction(() => returnContext.pendingAction || null);
                  navigateTo('milestone');
                  return;
                }
                goBack('home');
              }}
            />
          )}

          {screen === 'era_lock' && (
            <EraLockScreen
              onBack={() => goBack('home')}
              onActivate={() => navigateTo('home')}
            />
          )}

          {screen === 'amazon_shelf' && (
            <AmazonShelfScreen onBack={() => goBack('home')} />
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
