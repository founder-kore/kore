import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Linking, Animated, Easing, Image
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getRatings, getHistory } from '../storage/userPrefs';
import { generateAmazonShelf } from '../services/claude';
import { getAmazonAffiliateUrl } from '../utils/affiliateLinks';

const PRODUCT_TYPE_CONFIG = {
  manga_volumes: { emoji: '📚', label: 'Manga', colors: ['#FF416C', '#FF4B2B'], shape: 'book' },
  art_book:      { emoji: '🎨', label: 'Art Book', colors: ['#8E2DE2', '#4A00E0'], shape: 'book' },
  ost:           { emoji: '🎵', label: 'Vinyl OST', colors: ['#1D976C', '#93F9B9'], shape: 'square' },
  figure:        { emoji: '🗿', label: 'Figure', colors: ['#F7971E', '#FFD200'], shape: 'box' },
  other:         { emoji: '📦', label: 'Merch', colors: ['#4B79A1', '#283E51'], shape: 'box' },
};

// ─── TWO-PRONGED BULLETPROOF IMAGE FETCHER ───
async function fetchAccurateCover(animeTitle) {
  if (!animeTitle) return null;
  
  // FIXED BUG: Removed the hyphen from the split regex so titles like "D.Gray-man" don't break.
  const cleanTitle = animeTitle.split(/[:(]/)[0].trim();

  // ATTEMPT 1: AniList (Fast, no rate limits)
  try {
    const query = `
      query ($search: String) {
        Media (search: $search, sort: POPULARITY_DESC) {
          coverImage { extraLarge }
        }
      }
    `;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: cleanTitle } })
    });
    const json = await res.json();
    if (json?.data?.Media?.coverImage?.extraLarge) {
      return json.data.Media.coverImage.extraLarge;
    }
  } catch (e) {
    // Silently fail and proceed to Attempt 2
  }

  // ATTEMPT 2: MyAnimeList (Jikan API)
  await new Promise(resolve => setTimeout(resolve, 400));
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`);
    const json = await res.json();
    if (json?.data?.[0]?.images?.jpg?.large_image_url) {
      return json.data[0].images.jpg.large_image_url;
    }
  } catch (e) {
    // Silently fail
  }

  return null;
}

// ─── Animated Loading Component ───
function PulsingLoader() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.loaderContainer}>
      <Animated.View style={[styles.loaderGlow, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.2], outputRange: [0.5, 0.1] }) }]} />
      <Animated.Text style={[styles.loadingEmoji, { transform: [{ scale: pulseAnim }] }]}>📦</Animated.Text>
    </View>
  );
}

// ─── Main Screen ───
export default function AmazonShelfScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [shelf, setShelf] = useState([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadShelf(); }, []);

  const loadShelf = async () => {
    setLoading(true);
    fadeAnim.setValue(0);
    try {
      const [ratings, history] = await Promise.all([getRatings(), getHistory()]);
      const loved = ratings.filter(r => r.rating === 'loved').map(r => r.title).filter(Boolean);
      const liked = ratings.filter(r => r.rating === 'liked').map(r => r.title).filter(Boolean);
      const recentTitles = history.map(entry => entry?.title).filter(Boolean);
      const seedTitles = loved.length > 0 ? loved : (liked.length > 0 ? liked : recentTitles.slice(0, 5));
      if (seedTitles.length === 0) { setShelf([]); setLoading(false); return; }
      
      const generatedItems = await generateAmazonShelf({ lovedList: seedTitles, history });
      const items = Array.isArray(generatedItems) ? generatedItems : [];

      // Fetch the accurate cover art sequentially
      const itemsWithCovers = [];
      for (const item of items) {
        const coverUrl = await fetchAccurateCover(item.anime_title);
        itemsWithCovers.push({ ...item, image_url: coverUrl });
      }

      setShelf(itemsWithCovers);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (e) { 
      console.log('Error loading shelf:', e); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleOpenProduct = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = getAmazonAffiliateUrl(item?.product_name || item?.anime_title);
    
    try { await Linking.openURL(url); } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: '#0A0A0A' }]}>
        <PulsingLoader />
        <Text style={styles.loadingTitle}>Building your shelf...</Text>
        <Text style={styles.loadingSub}>
          Kore is curating physical editions for the anime you loved.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0A0A0A' }]}>
      <View style={[styles.header, { borderBottomColor: '#222' }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerSide}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Your Anime Shelf</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          
          <View style={styles.heroSection}>
            <View style={styles.unlockBadge}><Text style={styles.unlockBadgeText}>👑 60 DAY REWARD</Text></View>
            <Text style={styles.heroTitle}>Your Anime Shelf</Text>
            <Text style={styles.heroSub}>Personalized picks based on your anime activity.</Text>
          </View>

          {shelf.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>Not enough activity yet</Text>
              <Text style={styles.emptyStateText}>
                Keep rating and saving anime to build your personalized shelf.
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {shelf.map((item, i) => {
              const typeConfig = PRODUCT_TYPE_CONFIG[item.product_type] || PRODUCT_TYPE_CONFIG.other;
              const isSquare = typeConfig.shape === 'square';
              const isBook = typeConfig.shape === 'book';
              
              return (
                <TouchableOpacity key={i} style={styles.shelfCard} onPress={() => handleOpenProduct(item)} activeOpacity={0.8}>
                  
                  {/* Physical Display Compartment */}
                  <View style={styles.imageWrap}>
                    
                    {/* NEW: Floating Emoji Overlay to signify item type */}
                    <View style={styles.itemTypeBadgeOverlay}>
                      <Text style={styles.itemTypeBadgeEmoji}>{typeConfig.emoji}</Text>
                    </View>

                    {item.image_url ? (
                      <View style={[styles.actualImageContainer, isBook ? styles.shapeBookImg : (isSquare ? styles.shapeSquareImg : styles.shapeBoxImg)]}>
                        <Image source={{ uri: item.image_url }} style={styles.actualImage} />
                        
                        {/* Glossy Plastic Reflection Overlay */}
                        <LinearGradient
                          colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.5)']}
                          start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                          style={StyleSheet.absoluteFillObject}
                        />
                      </View>
                    ) : (
                      // Final Safety Fallback Gradient
                      <LinearGradient
                        colors={typeConfig.colors}
                        start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                        style={[styles.imageGradient, isBook ? styles.shapeBookImg : (isSquare ? styles.shapeSquareImg : styles.shapeBoxImg)]}
                      >
                        <Text style={styles.productEmoji}>{typeConfig.emoji}</Text>
                      </LinearGradient>
                    )}
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeLabel}>{typeConfig.label}</Text>
                    </View>
                    <Text style={styles.forLabel} numberOfLines={1}>{item.anime_title}</Text>
                    <Text style={styles.productTitle} numberOfLines={3}>{item.product_name}</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.amazonLink}>View on Amazon ↗</Text>
                  </View>
                </TouchableOpacity>
              );
              })}
            </View>
          )}
          
          <TouchableOpacity style={styles.mainBtn} onPress={loadShelf}>
            <Text style={styles.mainBtnText}>Regenerate Shelf</Text>
          </TouchableOpacity>
          <View style={{height: 40}}/>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  headerSide: { width: 60 },
  backText: { fontSize: 14, color: '#888' },
  scroll: { padding: 16 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loaderContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 30, height: 100, width: 100 },
  loaderGlow: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#7F77DD' },
  loadingEmoji: { fontSize: 50, zIndex: 2 },
  loadingTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 12 },
  loadingSub: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22, maxWidth: 280 },

  heroSection: { marginBottom: 24, marginTop: 10 },
  unlockBadge: { backgroundColor: 'rgba(127,119,221,0.15)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(127,119,221,0.4)' },
  unlockBadgeText: { color: '#7F77DD', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  heroSub: { fontSize: 15, color: '#888', lineHeight: 22 },
  emptyStateCard: { backgroundColor: '#121212', borderRadius: 16, borderWidth: 1, borderColor: '#222', padding: 18, marginBottom: 18 },
  emptyStateTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  emptyStateText: { fontSize: 14, lineHeight: 22, color: '#888' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  shelfCard: { 
    width: '48%', 
    backgroundColor: '#121212', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#222', 
    marginBottom: 16,
    overflow: 'hidden',
    justifyContent: 'space-between'
  },
  
  imageWrap: {
    height: 160,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    padding: 10,
    position: 'relative'
  },

  // NEW: Emoji Overlay Badge
  itemTypeBadgeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  itemTypeBadgeEmoji: { fontSize: 14 },

  actualImageContainer: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 8,
    backgroundColor: '#111'
  },
  actualImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  
  shapeBookImg: { width: 85, height: 125, borderRadius: 3, borderLeftWidth: 3, borderLeftColor: 'rgba(255,255,255,0.6)' },
  shapeSquareImg: { width: 110, height: 110, borderRadius: 2, borderWidth: 1, borderColor: '#333' },
  shapeBoxImg: { width: 90, height: 130, borderRadius: 6, borderWidth: 2, borderColor: '#111' },
  
  imageGradient: { alignItems: 'center', justifyContent: 'center' },
  productEmoji: { fontSize: 38 },

  cardContent: { padding: 12, paddingBottom: 0 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: '#222', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginBottom: 8 },
  typeLabel: { fontSize: 9, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  forLabel: { fontSize: 11, fontWeight: '800', color: '#7F77DD', textTransform: 'uppercase', marginBottom: 4 },
  productTitle: { fontSize: 13, fontWeight: '600', color: '#FFF', lineHeight: 18, height: 36 },
  
  cardFooter: { padding: 12, paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: '#1A1A1A' },
  amazonLink: { fontSize: 12, fontWeight: '700', color: '#F7971E' },

  mainBtn: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  mainBtnText: { color: '#000', fontWeight: '800', fontSize: 15 }
});
