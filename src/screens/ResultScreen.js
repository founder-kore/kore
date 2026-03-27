import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Animated, Share, Linking, Platform, Image,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { saveRating, addToWatchLater, isInWatchLater } from '../storage/userPrefs';
import { getStreamingSearchUrl, getFillerGuide } from '../services/claude';

const LOADING_MESSAGES = {
  'Chill':     ['Finding something that won\'t stress you out...', 'Ignoring anything with a long training arc...', 'Scanning the calm end of the catalogue...', 'Almost there...'],
  'Hype':      ['Filtering out every slice-of-life in the database...', 'Finding something that actually goes hard...', 'Cross-referencing 17,000 titles...', 'Almost there...'],
  'Emotional': ['Finding something that\'ll stay with you...', 'Warning: tissues may be required...', 'Scanning every sad ending ever made...', 'Almost there...'],
  'Curious':   ['Cross-referencing 17,000 titles...', 'Ignoring anything too obvious...', 'Scanning the weird end of the catalogue...', 'Almost there...'],
  'Escapist':  ['Opening a door to somewhere else...', 'Finding a world worth disappearing into...', 'Cross-referencing alternate realities...', 'Almost there...'],
  'Social':    ['Finding something worth watching together...', 'Filtering out anything too niche to explain...', 'Cross-referencing shared taste profiles...', 'Almost there...'],
  default:     ['Cross-referencing 17,000 titles...', 'Ignoring the obvious picks...', 'Finding your match...', 'Almost there...'],
};

const VIBE_CONFIG = {
  'Chill':     { emoji: '🌸', label: 'Chill mode' },
  'Hype':      { emoji: '⚔️', label: 'Hype mode' },
  'Emotional': { emoji: '🫧', label: 'Emotional mode' },
  'Curious':   { emoji: '🦋', label: 'Curious mode' },
  'Escapist':  { emoji: '⛩️', label: 'Escapist mode' },
  'Social':    { emoji: '🎎', label: 'Social mode' },
  default:     { emoji: '🎌', label: 'Finding your pick' },
};

// Deep link schemes that go directly to search within the native app
// These are the best-known working deep link formats for each platform
const APP_DEEP_LINKS = {
  // Crunchyroll: opens search tab with query
  crunchyroll: (t) => `crunchyroll://search?q=${encodeURIComponent(t)}`,
  // Netflix: opens search with query pre-filled
  netflix: (t) => `netflix://search/${encodeURIComponent(t)}`,
  // Hulu: opens search with query
  hulu: (t) => `hulu://search?q=${encodeURIComponent(t)}`,
  // Disney+: opens search with query
  disney: (t) => `disneyplus://search?q=${encodeURIComponent(t)}`,
  // Amazon Prime Video: opens search
  amazon: (t) => `aiv://aiv/search?phrase=${encodeURIComponent(t)}`,
  // Max (HBO): opens search
  max: (t) => `max://search/${encodeURIComponent(t)}`,
};

// Fallback web search URLs if app not installed
const WEB_SEARCH_URLS = {
  crunchyroll: (t) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(t)}`,
  netflix:     (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
  hulu:        (t) => `https://www.hulu.com/search?q=${encodeURIComponent(t)}`,
  disney:      (t) => `https://www.disneyplus.com/search/${encodeURIComponent(t)}`,
  hidive:      (t) => `https://www.hidive.com/search#sortby=relevance&q=${encodeURIComponent(t)}`,
  amazon:      (t) => `https://www.amazon.com/s?k=${encodeURIComponent(t)}+anime&i=instant-video`,
  max:         (t) => `https://www.max.com/search?q=${encodeURIComponent(t)}`,
  tubi:        (t) => `https://tubitv.com/search/${encodeURIComponent(t)}`,
  peacock:     (t) => `https://www.peacocktv.com/search?q=${encodeURIComponent(t)}`,
  apple:       (t) => `https://tv.apple.com/search?term=${encodeURIComponent(t)}`,
};

function getPlatformKey(platform) {
  const p = platform.toLowerCase();
  if (p.includes('crunchyroll')) return 'crunchyroll';
  if (p.includes('netflix'))     return 'netflix';
  if (p.includes('hulu'))        return 'hulu';
  if (p.includes('disney'))      return 'disney';
  if (p.includes('hidive'))      return 'hidive';
  if (p.includes('amazon'))      return 'amazon';
  if (p.includes('hbo') || p.includes('max')) return 'max';
  if (p.includes('tubi'))        return 'tubi';
  if (p.includes('peacock'))     return 'peacock';
  if (p.includes('apple'))       return 'apple';
  return null;
}

// Platforms that have a known working deep link scheme
const PLATFORMS_WITH_APP = ['crunchyroll', 'netflix', 'hulu', 'disney', 'amazon', 'max'];

function StreamingChoiceModal({ platform, title, onClose, colors }) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: false }),
    ]).start();
  }, []);

  const close = (action) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 300, duration: 180, useNativeDriver: false }),
    ]).start(() => onClose(action));
  };

  const platformKey = getPlatformKey(platform);
  const hasAppSupport = platformKey && PLATFORMS_WITH_APP.includes(platformKey);

  return (
    <Animated.View style={[cStyles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={cStyles.backdrop} onPress={() => close(null)} activeOpacity={1} />
      <Animated.View style={[cStyles.sheet, { backgroundColor: colors.snow, transform: [{ translateY: slideAnim }] }]}>
        <View style={[cStyles.handle, { backgroundColor: colors.border }]} />
        <Text style={[cStyles.title, { color: colors.ink }]}>Open {platform}</Text>
        <Text style={[cStyles.sub, { color: colors.charcoal }]}>
          {hasAppSupport
            ? `Opens the ${platform} app and searches for "${title}" directly.`
            : `Opens ${platform} in your browser and searches for "${title}".`}
        </Text>

        {hasAppSupport && (
          <TouchableOpacity
            style={[cStyles.option, { backgroundColor: colors.ink }]}
            onPress={() => close('app')}
          >
            <Text style={cStyles.optionEmoji}>📱</Text>
            <View style={cStyles.optionText}>
              <Text style={[cStyles.optionTitle, { color: '#F5F5F5' }]}>Open in App</Text>
              <Text style={[cStyles.optionSub, { color: '#999' }]}>
                Searches for "{title}" in the {platform} app
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[cStyles.option, { backgroundColor: colors.chalk, borderColor: colors.border, borderWidth: 1.5 }]}
          onPress={() => close('browser')}
        >
          <Text style={cStyles.optionEmoji}>🌐</Text>
          <View style={cStyles.optionText}>
            <Text style={[cStyles.optionTitle, { color: colors.ink }]}>Open in Browser</Text>
            <Text style={[cStyles.optionSub, { color: colors.charcoal }]}>
              Searches for "{title}" on the {platform} website
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={cStyles.cancelBtn} onPress={() => close(null)}>
          <Text style={[cStyles.cancelText, { color: colors.charcoal }]}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const cStyles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '500', marginBottom: 6 },
  sub: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, marginBottom: 10 },
  optionEmoji: { fontSize: 24 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '500', marginBottom: 2 },
  optionSub: { fontSize: 12, lineHeight: 18 },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelText: { fontSize: 15 },
});

function PulseDot({ delay, color }) {
  const anim = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1,    duration: 500, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0.25, duration: 500, useNativeDriver: false }),
    ])).start();
  }, []);
  return <Animated.View style={[styles.dot, { opacity: anim, backgroundColor: color }]} />;
}

function LoadingScreen({ colors, vibe }) {
  const fadeAnim           = useRef(new Animated.Value(1)).current;
  const logoScaleAnim      = useRef(new Animated.Value(0.95)).current;
  const emojiScaleAnim     = useRef(new Animated.Value(0.9)).current;
  const emojiTranslateAnim = useRef(new Animated.Value(0)).current;
  const [messageIndex, setMessageIndex] = useState(0);
  const messages   = LOADING_MESSAGES[vibe] || LOADING_MESSAGES.default;
  const vibeConfig = VIBE_CONFIG[vibe]       || VIBE_CONFIG.default;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(logoScaleAnim, { toValue: 1.04, duration: 1000, useNativeDriver: false }),
      Animated.timing(logoScaleAnim, { toValue: 0.95, duration: 1000, useNativeDriver: false }),
    ])).start();

    if (vibe === 'Hype') {
      Animated.loop(Animated.sequence([
        Animated.timing(emojiTranslateAnim, { toValue: -18, duration: 300, useNativeDriver: false }),
        Animated.timing(emojiTranslateAnim, { toValue: 0,   duration: 300, useNativeDriver: false }),
        Animated.timing(emojiTranslateAnim, { toValue: -12, duration: 250, useNativeDriver: false }),
        Animated.timing(emojiTranslateAnim, { toValue: 0,   duration: 250, useNativeDriver: false }),
        Animated.delay(200),
      ])).start();
    } else if (vibe === 'Chill') {
      Animated.loop(Animated.sequence([
        Animated.timing(emojiTranslateAnim, { toValue: -10, duration: 1800, useNativeDriver: false }),
        Animated.timing(emojiTranslateAnim, { toValue: 0,   duration: 1800, useNativeDriver: false }),
      ])).start();
    } else if (vibe === 'Emotional') {
      Animated.loop(Animated.sequence([
        Animated.timing(emojiTranslateAnim, { toValue: 8,  duration: 1400, useNativeDriver: false }),
        Animated.timing(emojiTranslateAnim, { toValue: -4, duration: 1400, useNativeDriver: false }),
      ])).start();
    } else if (vibe === 'Escapist') {
      Animated.loop(Animated.sequence([
        Animated.timing(emojiScaleAnim, { toValue: 1.3, duration: 800, useNativeDriver: false }),
        Animated.timing(emojiScaleAnim, { toValue: 0.8, duration: 800, useNativeDriver: false }),
      ])).start();
    } else {
      Animated.loop(Animated.sequence([
        Animated.timing(emojiScaleAnim, { toValue: 1.2, duration: 900, useNativeDriver: false }),
        Animated.timing(emojiScaleAnim, { toValue: 0.9, duration: 900, useNativeDriver: false }),
      ])).start();
    }

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start(() => {
        setMessageIndex(prev => (prev + 1) % messages.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: false }).start();
      });
    }, 1900);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.loadingWrap, { backgroundColor: colors.snow }]}>
      <Animated.Text style={[styles.loadingLogo, { color: colors.ember, transform: [{ scale: logoScaleAnim }] }]}>コレ</Animated.Text>
      <Animated.Text style={[styles.vibeEmoji, { transform: [{ scale: emojiScaleAnim }, { translateY: emojiTranslateAnim }] }]}>{vibeConfig.emoji}</Animated.Text>
      <View style={[styles.vibeLabelWrap, { backgroundColor: colors.chalk, borderColor: colors.border }]}>
        <Text style={[styles.vibeLabel, { color: colors.ember }]}>{vibeConfig.label}</Text>
      </View>
      <Animated.Text style={[styles.loadingMessage, { color: colors.charcoal, opacity: fadeAnim }]}>{messages[messageIndex]}</Animated.Text>
      <View style={styles.dotsRow}>
        <PulseDot delay={0}   color={colors.ember} />
        <PulseDot delay={200} color={colors.ember} />
        <PulseDot delay={400} color={colors.ember} />
      </View>
    </View>
  );
}

export default function ResultScreen({
  result, coverArt, loading, error, onBack, onGenerateAnother,
  rerollCoolingDown, rerollCount, maxRerolls, vibe, isDetailView = false, isSurprise = false,
}) {
  const { colors, isDark } = useTheme();
  const coverOpacity  = useRef(new Animated.Value(0)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const [userRating,        setUserRating]        = useState(null);
  const [ratingConfirmed,   setRatingConfirmed]   = useState(false);
  const [sharing,           setSharing]           = useState(false);
  const [savedLater,        setSavedLater]        = useState(false);
  const [synopsisExpanded,  setSynopsisExpanded]  = useState(false);
  const [fillerInfo,        setFillerInfo]        = useState(null);
  const [streamingPlatform, setStreamingPlatform] = useState(null);

  useEffect(() => {
    setUserRating(null); setRatingConfirmed(false); setSavedLater(false);
    setSynopsisExpanded(false); setFillerInfo(null); setStreamingPlatform(null);
    coverOpacity.setValue(0); bannerOpacity.setValue(0);
    if (result?.title) {
      isInWatchLater(result.title).then(setSavedLater);
      if (result.episode_count >= 50) {
        getFillerGuide(result.title, result.episode_count)
          .then(info => { if (info) setFillerInfo(info); })
          .catch(() => {});
      }
    }
  }, [result]);

  useEffect(() => {
    if (coverArt?.cover)  Animated.timing(coverOpacity,  { toValue: 1, duration: 250, useNativeDriver: false }).start();
    if (coverArt?.banner) Animated.timing(bannerOpacity, { toValue: 1, duration: 350, useNativeDriver: false }).start();
  }, [coverArt]);

  const handleRate = async (rating) => {
    if (!result?.title) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUserRating(rating); setRatingConfirmed(true);
    await saveRating(result.title, rating);
  };

  const handleShare = async () => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      await Share.share({
        message: `🎌 Kore recommended me: ${result.title} (${result.japanese_title || ''})\n\n"${result.why_now || ''}"\n\n${result.rating || '?'} · ${(result.genre || []).join(', ')}\n\nRecommended by コレ Kore`,
        title: `Watch ${result.title}`,
      });
    } catch {}
    finally { setSharing(false); }
  };

  const handleSaveLater = async () => {
    if (!result || savedLater) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addToWatchLater({
      title: result.title, japanese_title: result.japanese_title,
      episode_count: result.episode_count, rating: result.rating,
      genre: result.genre, why_now: result.why_now,
      synopsis: result.synopsis, pitch: result.pitch,
      cover: coverArt?.cover || null, streaming: result.streaming,
      date: new Date().toISOString(),
    });
    setSavedLater(true);
  };

  // On web: go straight to browser search
  // On mobile: show choice modal
  const handleStreamingPress = (platform) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'web') {
      const key = getPlatformKey(platform);
      const url = key && WEB_SEARCH_URLS[key]
        ? WEB_SEARCH_URLS[key](result?.title || '')
        : getStreamingSearchUrl(platform, result?.title || '');
      if (url) Linking.openURL(url);
      return;
    }
    setStreamingPlatform(platform);
  };

  const handleStreamingChoice = async (platform, action) => {
    setStreamingPlatform(null);
    if (!action) return;
    const title = result?.title || '';
    const key   = getPlatformKey(platform);

    if (action === 'app' && key && APP_DEEP_LINKS[key]) {
      try {
        // Attempt deep link directly — opens app to search results if installed
        // No canOpenURL check: broken in Expo Go, works fine in production builds
        await Linking.openURL(APP_DEEP_LINKS[key](title));
        return;
      } catch {
        // App not installed — fall through to browser
      }
    }

    // Browser fallback — search URL goes directly to search results
    const browserUrl = key && WEB_SEARCH_URLS[key]
      ? WEB_SEARCH_URLS[key](title)
      : getStreamingSearchUrl(platform, title);

    if (browserUrl) {
      try { await Linking.openURL(browserUrl); }
      catch (e) { console.log('Could not open URL:', e); }
    }
  };

  const handleFillerLink = () => {
    if (!result?.title) return;
    const slug = result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    Linking.openURL(`https://www.animefillerlist.com/shows/${slug}`);
  };

  if (loading) return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
      <LoadingScreen colors={colors} vibe={vibe} />
    </SafeAreaView>
  );

if (error) return (
  <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
    <View style={styles.centered}>
      <Text style={[styles.errorText, { color: colors.ember }]}>Something went wrong</Text>
      <Text style={[styles.errorSub, { color: colors.charcoal }]}>
        {error?.includes('timeout') || error?.includes('fetch')
          ? 'The server took too long to respond — this happens occasionally. Try again.'
          : error}
      </Text>
      {onGenerateAnother && (
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.ember, marginBottom: 10, width: '100%' }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onGenerateAnother(); }}
        >
          <Text style={styles.generateBtnText}>Try again →</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.tryAgainBtn, { borderColor: colors.border, width: '100%' }]} onPress={onBack}>
        <Text style={[styles.tryAgainText, { color: colors.charcoal }]}>← Change my answers</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

  if (!result) return null;

  const whyNowBg = isDark ? '#2A1A00' : '#FFF5EE';
  const fillerBg = isDark ? '#1A1500' : '#FFFBEE';
  const fillerBorder    = isDark ? '#3A3000' : '#FFE5A0';
  const fillerText      = isDark ? '#FFD060' : '#7A5800';
  const fillerSubColor  = isDark ? 'rgba(255,208,96,0.6)' : '#A07800';
  const fillerPillBg    = isDark ? '#2A2000' : '#FFF0B0';
  const fillerPillBorder = isDark ? '#3A3000' : '#FFD060';

  const title          = result.title          ?? 'Unknown title';
  const japaneseTitle  = result.japanese_title ?? '';
  const episodeCount   = result.episode_count;
  const releaseYear    = result.release_year   ?? null;
  const seasonCount    = result.season_count   ?? null;
  const contentRating  = result.rating         ?? null;
  const genres         = result.genre          ?? [];
  const synopsis       = result.synopsis       ?? '';
  const pitch          = result.pitch          ?? '';
  const whyNow         = result.why_now        ?? '';
  const type           = result.type           ?? 'anime';
  const streaming      = (result.streaming ?? []).filter(p => !p.toLowerCase().includes('funimation')).slice(0, 4);
  const dubAvailable   = result.dub_available  ?? false;
  const perfectMatch   = result.perfect_match  ?? true;
  const matchNote      = result.match_note     ?? null;

  const isMovie = type === 'movie' || episodeCount === 1;
  const episodeLabel = isMovie ? 'Movie' : episodeCount ? `${episodeCount} eps` : 'Series';

  const rerollsLeft    = maxRerolls - rerollCount;
  const rerollDisabled = rerollCoolingDown || rerollCount >= maxRerolls;
  const getGenerateLabel = () => {
    if (rerollCount >= maxRerolls) return `Session limit reached (${maxRerolls}/${maxRerolls})`;
    if (rerollCoolingDown) return 'Finding next pick...';
    if (isSurprise) return rerollCount > 0 ? `Surprise me again → (${rerollsLeft} left)` : 'Surprise me again →';
    if (rerollCount > 0) return `Generate another → (${rerollsLeft} left)`;
    return 'Generate another based on my answers →';
  };

  const SYNOPSIS_LIMIT = 120;
  const synopsisShort = synopsis.length > SYNOPSIS_LIMIT ? synopsis.slice(0, SYNOPSIS_LIMIT).trim() + '...' : synopsis;

  const metaChips = [
    releaseYear                    ? { label: String(releaseYear),       key: 'year'    } : null,
    { label: episodeLabel,                                                key: 'eps'     },
    seasonCount && seasonCount > 1 ? { label: `${seasonCount} seasons`,  key: 'seasons' } : null,
    contentRating                  ? { label: contentRating,             key: 'rating'  } : null,
  ].filter(Boolean);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.snow }]}>
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>

          {/* Banner */}
          <View style={[styles.bannerWrap, { backgroundColor: '#1A1A1A' }]}>
            {coverArt?.banner ? (
              <Animated.View style={[styles.bannerImageWrap, { opacity: bannerOpacity }]}>
                <Image source={{ uri: coverArt.banner }} style={styles.bannerImage} resizeMode="cover" />
              </Animated.View>
            ) : (
              <View style={styles.bannerFallback}>
                <Text style={styles.bannerFallbackLabel}>コレ</Text>
                <Text style={styles.bannerFallbackTitle} numberOfLines={1}>{title}</Text>
              </View>
            )}
            <View style={styles.bannerFade} />
            <TouchableOpacity
              style={[styles.backPill, { backgroundColor: colors.snow }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }}
            >
              <Text style={[styles.backPillArrow, { color: colors.ink }]}>←</Text>
              <Text style={[styles.backPillText,  { color: colors.ink }]}>{isDetailView ? 'Back to list' : 'Back'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>

            {/* Hero row */}
            <View style={styles.heroRow}>
              {coverArt?.cover ? (
                <Animated.View style={[styles.coverImageWrap, { opacity: coverOpacity }]}>
                  <Image source={{ uri: coverArt.cover }} style={styles.coverImage} resizeMode="cover" />
                </Animated.View>
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: colors.chalk }]}>
                  <Text style={[styles.coverPlaceholderText, { color: colors.charcoal }]}>コレ</Text>
                </View>
              )}
              <View style={styles.heroInfo}>
                <Text style={[styles.headerLabel, { color: colors.charcoal }]}>コレ — your pick</Text>
                <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
                {japaneseTitle.length > 0 && (
                  <Text style={[styles.japaneseTitle, { color: colors.charcoal }]}>{japaneseTitle}</Text>
                )}
                <View style={styles.chipsRow}>
                  {metaChips.map(chip => (
                    <View key={chip.key} style={[styles.metaChip, { backgroundColor: colors.chalk }]}>
                      <Text style={[styles.metaChipText, { color: colors.ink }]}>{chip.label}</Text>
                    </View>
                  ))}
                  {dubAvailable && (
                    <View style={[styles.metaChipAccent, { backgroundColor: whyNowBg, borderColor: isDark ? '#F0A050' : '#FFD5B0' }]}>
                      <Text style={[styles.metaChipAccentText, { color: colors.ember }]}>Dub ✓</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Genre pills */}
            {genres.length > 0 && (
              <View style={styles.genreRow}>
                {genres.slice(0, 5).map(g => (
                  <View key={g} style={[styles.genrePill, { borderColor: colors.border, backgroundColor: colors.chalk }]}>
                    <Text style={[styles.genreText, { color: colors.charcoal }]}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Why now */}
            {whyNow.length > 0 && (
              <View style={[styles.whyNowHero, { backgroundColor: whyNowBg }]}>
                <View style={[styles.whyNowHeroBar, { backgroundColor: colors.ember }]} />
                <Text style={[styles.whyNowHeroText, { color: colors.ember }]}>{whyNow}</Text>
              </View>
            )}

            {/* Streaming */}
            {streaming.length > 0 && (
              <View style={styles.streamingSection}>
                <Text style={[styles.streamingLabel, { color: colors.charcoal }]}>Watch on</Text>
                <View style={styles.streamingRow}>
                  {streaming.map(platform => (
                    <TouchableOpacity
                      key={platform}
                      style={[styles.platformBtn, { backgroundColor: colors.ink }]}
                      onPress={() => handleStreamingPress(platform)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.platformText, { color: colors.snow }]}>{platform}</Text>
                      <Text style={styles.platformArrow}>↗</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.streamingHint, { color: colors.charcoal }]}>
                  {Platform.OS === 'web'
                    ? 'Opens search — availability may vary by region'
                    : 'Tap to search for this anime on the platform'}
                </Text>
              </View>
            )}

            {/* Details card */}
            {(synopsis.length > 0 || pitch.length > 0) && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {synopsis.length > 0 && (
                  <View style={styles.synopsisWrap}>
                    <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>What is it?</Text>
                    <Text style={[styles.synopsis, { color: colors.ink }]}>{synopsisExpanded ? synopsis : synopsisShort}</Text>
                    {synopsis.length > SYNOPSIS_LIMIT && (
                      <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSynopsisExpanded(p => !p); }}
                        style={styles.readMoreBtn}
                      >
                        <Text style={[styles.readMoreText, { color: colors.ember }]}>{synopsisExpanded ? 'Show less ↑' : 'Read more ↓'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {pitch.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.charcoal }]}>Why you, why now?</Text>
                    <Text style={[styles.pitch, { color: colors.ink }]}>{pitch}</Text>
                  </>
                )}
                {!perfectMatch && matchNote && (
                  <View style={[styles.matchNote, { backgroundColor: colors.chalk }]}>
                    <Text style={[styles.matchNoteText, { color: colors.charcoal }]}>Note: {matchNote}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Filler info */}
            {fillerInfo && (
              <View style={[styles.fillerCard, { backgroundColor: fillerBg, borderColor: fillerBorder }]}>
                <View style={styles.fillerHeader}>
                  <Text style={styles.fillerIcon}>⚠️</Text>
                  <View style={styles.fillerHeaderText}>
                    <Text style={[styles.fillerTitle, { color: fillerText }]}>{fillerInfo.fillerPercentage}% filler — {fillerInfo.fillerCount} episodes</Text>
                    <Text style={[styles.fillerSub, { color: fillerSubColor }]}>Safe to skip — doesn't affect the main story</Text>
                  </View>
                </View>
                {fillerInfo.ranges.length > 0 && (
                  <View style={styles.fillerRangeWrap}>
                    <Text style={[styles.fillerRangeLabel, { color: fillerSubColor }]}>SKIP EPISODES</Text>
                    <View style={styles.fillerRangeRow}>
                      {fillerInfo.ranges.map((range, i) => (
                        <View key={i} style={[styles.fillerRangePill, { backgroundColor: fillerPillBg, borderColor: fillerPillBorder }]}>
                          <Text style={[styles.fillerRangeText, { color: fillerText }]}>{range}</Text>
                        </View>
                      ))}
                      {fillerInfo.hasMore && (
                        <View style={[styles.fillerRangePill, { backgroundColor: fillerPillBg, borderColor: fillerPillBorder }]}>
                          <Text style={[styles.fillerRangeText, { color: fillerText }]}>more...</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
                <TouchableOpacity onPress={handleFillerLink} style={styles.fillerLink}>
                  <Text style={[styles.fillerLinkText, { color: fillerText }]}>Full filler guide ↗</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Rating */}
            <View style={[styles.ratingSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.ratingLabel, { color: colors.charcoal }]}>
                {ratingConfirmed ? 'Rating saved — Kore will remember this' : 'Already watched this? Rate it'}
              </Text>
              {ratingConfirmed ? (
                <View style={styles.ratingConfirmed}>
                  <Text style={[styles.ratingConfirmedText, { color: colors.ink }]}>
                    {userRating === 'loved' ? '❤️ Loved it' : userRating === 'liked' ? '👍 Liked it' : '👎 Not for me'}
                  </Text>
                  <Text style={[styles.ratingConfirmedSub, { color: colors.charcoal }]}>Future recommendations will reflect this</Text>
                </View>
              ) : (
                <View style={styles.ratingRow}>
                  {['loved', 'liked', 'disliked'].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.ratingBtn, { borderColor: colors.border }, userRating === r && { borderColor: colors.ember, backgroundColor: whyNowBg }]}
                      onPress={() => handleRate(r)}
                    >
                      <Text style={styles.ratingEmoji}>{r === 'loved' ? '❤️' : r === 'liked' ? '👍' : '👎'}</Text>
                      <Text style={[styles.ratingBtnText, { color: colors.charcoal }]}>
                        {r === 'loved' ? 'Loved it' : r === 'liked' ? 'Liked it' : 'Not for me'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={handleShare} disabled={sharing}
              >
                <Text style={styles.actionEmoji}>📤</Text>
                <Text style={[styles.actionBtnText, { color: colors.ink }]}>{sharing ? 'Sharing...' : 'Share'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: savedLater ? colors.ember : colors.border, backgroundColor: savedLater ? whyNowBg : colors.card }]}
                onPress={handleSaveLater} disabled={savedLater}
              >
                <Text style={styles.actionEmoji}>🔖</Text>
                <Text style={[styles.actionBtnText, { color: savedLater ? colors.ember : colors.ink }]}>
                  {savedLater ? 'Saved!' : 'Save for later'}
                </Text>
              </TouchableOpacity>
            </View>

            {!isDetailView && onGenerateAnother && (
              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: rerollDisabled ? colors.charcoal : colors.ember }, rerollDisabled && { opacity: 0.5 }]}
                onPress={() => { if (!rerollDisabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onGenerateAnother(); } }}
                disabled={rerollDisabled}
              >
                <Text style={styles.generateBtnText}>{getGenerateLabel()}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.tryAgainBtn, { borderColor: colors.border }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }}
            >
              <Text style={[styles.tryAgainText, { color: colors.charcoal }]}>
                {isDetailView ? '← Back to list' : '← Try different answers'}
              </Text>
            </TouchableOpacity>

            <View style={styles.bottomPad} />
          </View>
        </ScrollView>
      </SafeAreaView>

      {streamingPlatform && (
        <StreamingChoiceModal
          platform={streamingPlatform}
          title={result?.title || ''}
          onClose={action => handleStreamingChoice(streamingPlatform, action)}
          colors={colors}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  loadingLogo: { fontSize: 44, opacity: 0.5 },
  vibeEmoji: { fontSize: 72 },
  vibeLabelWrap: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5 },
  vibeLabel: { fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },
  loadingMessage: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  dotsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bannerWrap: { width: '100%', height: 130, position: 'relative', overflow: 'hidden' },
  bannerImageWrap: { width: '100%', height: '100%' },
  bannerImage: { width: '100%', height: '100%' },
  bannerFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24 },
  bannerFallbackLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' },
  bannerFallbackTitle: { fontSize: 22, fontWeight: '500', color: '#F5F5F5', textAlign: 'center' },
  bannerFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.3)' },
  backPill: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  backPillArrow: { fontSize: 14, fontWeight: '500' },
  backPillText: { fontSize: 13, fontWeight: '500' },
  content: { padding: 20, paddingTop: 16 },
  heroRow: { flexDirection: 'row', gap: 14, marginBottom: 14, alignItems: 'flex-start' },
  coverImageWrap: { width: 86, height: 122, borderRadius: 10, marginTop: -30, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: 86, height: 122, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: -30 },
  coverPlaceholderText: { fontSize: 18 },
  heroInfo: { flex: 1, paddingTop: 4, gap: 4 },
  headerLabel: { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '500', lineHeight: 28 },
  japaneseTitle: { fontSize: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaChip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  metaChipText: { fontSize: 12, fontWeight: '500' },
  metaChipAccent: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  metaChipAccentText: { fontSize: 12, fontWeight: '500' },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  genrePill: { paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1, borderRadius: 20 },
  genreText: { fontSize: 12 },
  whyNowHero: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: 14, marginBottom: 14 },
  whyNowHeroBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  whyNowHeroText: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  streamingSection: { marginBottom: 14 },
  streamingLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  streamingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  platformBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  platformText: { fontSize: 14, fontWeight: '500' },
  platformArrow: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  streamingHint: { fontSize: 11, opacity: 0.6 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  synopsisWrap: { marginBottom: 18 },
  synopsis: { fontSize: 14, lineHeight: 22 },
  readMoreBtn: { marginTop: 6 },
  readMoreText: { fontSize: 13, fontWeight: '500' },
  pitch: { fontSize: 14, lineHeight: 22, marginBottom: 4 },
  matchNote: { padding: 12, borderRadius: 8, marginTop: 8 },
  matchNoteText: { fontSize: 12, lineHeight: 18 },
  fillerCard: { borderWidth: 1.5, borderRadius: 16, padding: 16, marginBottom: 16 },
  fillerHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  fillerIcon: { fontSize: 20, marginTop: 1 },
  fillerHeaderText: { flex: 1 },
  fillerTitle: { fontSize: 14, fontWeight: '500', marginBottom: 3 },
  fillerSub: { fontSize: 12, lineHeight: 18 },
  fillerRangeWrap: { marginBottom: 12 },
  fillerRangeLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 1, marginBottom: 8 },
  fillerRangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fillerRangePill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  fillerRangeText: { fontSize: 12, fontWeight: '500' },
  fillerLink: { alignSelf: 'flex-start' },
  fillerLinkText: { fontSize: 12, fontWeight: '500' },
  ratingSection: { marginBottom: 16, borderWidth: 1.5, borderRadius: 16, padding: 18 },
  ratingLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, gap: 4 },
  ratingEmoji: { fontSize: 20 },
  ratingBtnText: { fontSize: 11, fontWeight: '500' },
  ratingConfirmed: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  ratingConfirmedText: { fontSize: 16, fontWeight: '500' },
  ratingConfirmedSub: { fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  actionEmoji: { fontSize: 15 },
  actionBtnText: { fontSize: 14, fontWeight: '500' },
  generateBtn: { padding: 18, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  tryAgainBtn: { padding: 18, alignItems: 'center', borderWidth: 1.5, borderRadius: 14, marginBottom: 8 },
  tryAgainText: { fontSize: 15 },
  errorText: { fontSize: 18, fontWeight: '500' },
  errorSub: { fontSize: 13, textAlign: 'center' },
  bottomPad: { height: 40 },
});