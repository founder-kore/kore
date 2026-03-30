import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Linking, Animated,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import { getRatings, getHistory } from '../storage/userPrefs';
import { generateAmazonShelf } from '../services/claude';
import { AMAZON_ASSOCIATE_TAG } from '../constants/affiliates';

const PRODUCT_TYPE_CONFIG = {
  manga_volumes: { emoji: '📚', label: 'Manga' },
  art_book:      { emoji: '🎨', label: 'Art Book' },
  ost:           { emoji: '🎵', label: 'Soundtrack' },
  figure:        { emoji: '🗿', label: 'Figure' },
  other:         { emoji: '📦', label: 'Merch' },
};

export default function AmazonShelfScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [shelf, setShelf] = useState([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadShelf(); }, []);

  const loadShelf = async () => {
    setLoading(true);
    try {
      const [ratings, history] = await Promise.all([getRatings(), getHistory()]);
      const loved = ratings.filter(r => r.rating === 'loved').map(r => r.title);
      if (loved.length === 0) { setShelf([]); setLoading(false); return; }
      const items = await generateAmazonShelf({ lovedList: loved, history });
      setShelf(Array.isArray(items) ? items : []);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleOpenProduct = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(item.product_name)}&tag=${AMAZON_ASSOCIATE_TAG}`;
    try { await Linking.openURL(url); } catch {}
  };

  if (loading) return (
    <View style={[styles.centered, { backgroundColor: '#0A0A0A' }]}>
      <Text style={styles.loadingEmoji}>📦</Text>
      <Text style={styles.loadingTitle}>Building your shelf...</Text>
      <Text style={styles.loadingSub}>
        Kore is curating physical editions for the anime you loved.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0A0A0A' }]}>
      <View style={[styles.header, { borderBottomColor: '#222' }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerSide}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Collector's Shelf</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.heroSection}>
            <View style={styles.unlockBadge}><Text style={styles.unlockBadgeText}>👑 60 DAY REWARD</Text></View>
            <Text style={styles.heroTitle}>Your Collection</Text>
            <Text style={styles.heroSub}>Physical manga and OSTs matched to your loved anime.</Text>
          </View>

          {/* This gridContainer forces the 2-column wrap */}
          <View style={styles.gridContainer}>
            {shelf.map((item, i) => {
              const typeConfig = PRODUCT_TYPE_CONFIG[item.product_type] || PRODUCT_TYPE_CONFIG.other;
              return (
                <TouchableOpacity key={i} style={styles.shelfCard} onPress={() => handleOpenProduct(item)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.typeEmoji}>{typeConfig.emoji}</Text>
                    <Text style={styles.typeLabel}>{typeConfig.label}</Text>
                  </View>
                  <Text style={styles.forLabel}>For: {item.anime_title}</Text>
                  <Text style={styles.productTitle} numberOfLines={3}>{item.product_name}</Text>
                  <View style={styles.cardFooter}><Text style={styles.amazonLink}>Amazon ↗</Text></View>
                </TouchableOpacity>
              );
            })}
          </View>
          
          <TouchableOpacity style={styles.mainBtn} onPress={loadShelf}>
            <Text style={styles.mainBtnText}>Refresh Shelf</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // FIX: Centers everything in the dead middle
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingEmoji: { fontSize: 60, marginBottom: 20 },
  loadingTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 10 },
  loadingSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  headerSide: { width: 60 },
  backText: { fontSize: 14, color: '#888' },

  scroll: { padding: 16 },
  heroSection: { marginBottom: 24 },
  unlockBadge: { backgroundColor: '#E8630A25', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E8630A50' },
  unlockBadgeText: { color: '#E8630A', fontSize: 10, fontWeight: '900' },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  heroSub: { fontSize: 15, color: '#888' },

  // FIX: Force grid wrapping
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  shelfCard: { 
    width: '48%', 
    backgroundColor: '#161616', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#222', 
    padding: 12, 
    marginBottom: 16,
    minHeight: 180,
    justifyContent: 'space-between'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  typeEmoji: { fontSize: 14 },
  typeLabel: { fontSize: 10, fontWeight: '700', color: '#666', textTransform: 'uppercase' },
  forLabel: { fontSize: 9, fontWeight: '800', color: '#E8630A', textTransform: 'uppercase', marginBottom: 4 },
  productTitle: { fontSize: 13, fontWeight: '700', color: '#EEE', lineHeight: 18 },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#222', paddingTop: 8, marginTop: 8 },
  amazonLink: { fontSize: 11, fontWeight: '700', color: '#4D9FFF' },

  mainBtn: { backgroundColor: '#F5F5F5', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  mainBtnText: { color: '#000', fontWeight: '700', fontSize: 15 }
});