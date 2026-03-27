// src/screens/EditProfileScreen.js

import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, TextInput, Image, ActivityIndicator, Platform,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../constants/theme';
import {
  updateProfile, uploadAvatar, checkUsernameAvailable,
  getCurrentUser, getGoogleAvatarUrl,
} from '../services/supabase';

const AVATAR_COLORS = [
  '#E8630A', '#4D9FFF', '#7F77DD',
  '#1D9E75', '#D4537E', '#C77DFF',
];

export default function EditProfileScreen({ onBack, userProfile, onSave }) {
  const { colors, isDark } = useTheme();

  const [displayName,   setDisplayName]   = useState(userProfile?.display_name || '');
  const [username,      setUsername]      = useState(userProfile?.username || '');
  const [avatarColor,   setAvatarColor]   = useState(userProfile?.avatar_color || '#E8630A');
  const [avatarUrl,     setAvatarUrl]     = useState(userProfile?.avatar_url || null);
  const [localImageUri, setLocalImageUri] = useState(null);

  const [usernameState, setUsernameState] = useState('idle'); // 'idle'|'checking'|'available'|'taken'|'same'
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  const usernameTimer = useRef(null);
  const originalUsername = userProfile?.username || '';

  const cardBg  = isDark ? '#1A1A1A' : colors.snow;
  const borderC = isDark ? '#2A2A2A' : colors.border;
  const inputBg = isDark ? '#242424' : '#F5F4F2';

  // Auto-load Google avatar if no avatar set yet
  useEffect(() => {
    if (!avatarUrl) {
      getGoogleAvatarUrl().then(url => { if (url) setAvatarUrl(url); });
    }
  }, []);

  // Real-time username check
  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (trimmed === originalUsername) { setUsernameState('same'); return; }
    if (trimmed.length < 2) { setUsernameState('idle'); return; }
    if (!/^[a-z0-9_]+$/.test(trimmed)) { setUsernameState('idle'); return; }

    setUsernameState('checking');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(trimmed);
      setUsernameState(available ? 'available' : 'taken');
    }, 500);

    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, [username]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Camera roll permission needed'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images, // ← was MediaTypeOptions.Images (deprecated)
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) { setError('Display name is required'); return; }
    if (username.trim().length < 2) { setError('Username must be at least 2 characters'); return; }
    if (usernameState === 'taken') { setError('Username is taken — choose another'); return; }
    if (usernameState === 'checking') { setError('Still checking username availability...'); return; }

    setSaving(true); setError('');
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not logged in');

      const updates = {
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        avatar_color: avatarColor,
      };

      // Upload new photo if picked
      if (localImageUri) {
        const ext = localImageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const url = await uploadAvatar(user.id, localImageUri, mime);
        updates.avatar_url = url;
      }

      await updateProfile(user.id, updates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave({ ...userProfile, ...updates, avatar_url: updates.avatar_url || avatarUrl });
    } catch (e) {
      setError(e.message || 'Could not save changes. Try again.');
    } finally { setSaving(false); }
  };

  const initials = displayName.trim()
    ? displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (username || '?').slice(0, 2).toUpperCase();

  const displayImage = localImageUri || avatarUrl;

  const usernameInputBorder = () => {
    if (usernameState === 'available') return '#1D9E75';
    if (usernameState === 'taken') return '#E24B4A';
    return borderC;
  };

  const UsernameHint = () => {
    if (usernameState === 'checking') return <Text style={[styles.hint, { color: colors.charcoal }]}>Checking...</Text>;
    if (usernameState === 'available') return <Text style={[styles.hint, { color: '#1D9E75' }]}>✓ Available</Text>;
    if (usernameState === 'taken') return <Text style={[styles.hint, { color: '#E24B4A' }]}>✕ Already taken</Text>;
    if (usernameState === 'same') return <Text style={[styles.hint, { color: colors.charcoal }]}>Your current username</Text>;
    return null;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.chalk }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: borderC }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerSide}>
          <Text style={[styles.headerBack, { color: colors.charcoal }]}>← Profile</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Edit profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || usernameState === 'taken' || usernameState === 'checking'}
          style={styles.headerSide}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.ember} />
            : <Text style={[styles.headerSave, { color: saving ? colors.charcoal : colors.ember,
                opacity: usernameState === 'taken' ? 0.4 : 1 }]}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Avatar section ── */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
          <View style={styles.avatarCenter}>

            {/* Avatar preview */}
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickImage} activeOpacity={0.8}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={[styles.editDot, { borderColor: colors.chalk }]}>
                <Text style={styles.editIcon}>✎</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
              <Text style={[styles.changePhotoBtn, { color: colors.ember }]}>Change photo</Text>
            </TouchableOpacity>

            {/* Subtle color row */}
            <View style={styles.colorRow}>
              <Text style={[styles.colorLabel, { color: colors.charcoal }]}>Fallback colour</Text>
              <View style={styles.colorDots}>
                {AVATAR_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      avatarColor === c && [styles.colorDotActive, { borderColor: colors.chalk }],
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setAvatarColor(c);
                    }}
                  />
                ))}
              </View>
            </View>

          </View>
        </View>

        {/* ── Fields ── */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC, paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }]}>

          {/* Display name */}
          <View style={[styles.fieldRow, { borderBottomColor: borderC }]}>
            <Text style={[styles.fieldLabel, { color: colors.charcoal }]}>DISPLAY NAME</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.ink }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your display name"
              placeholderTextColor={colors.charcoal}
            />
          </View>

          {/* Username */}
          <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.fieldLabel, { color: colors.charcoal }]}>USERNAME</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.ink }]}
              value={username}
              onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              placeholderTextColor={colors.charcoal}
              autoCapitalize="none"
            />
            <UsernameHint />
          </View>

        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: isDark ? '#E8630A' : colors.ink },
            (saving || usernameState === 'taken') && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving || usernameState === 'taken' || usernameState === 'checking'}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save changes</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  headerSide:   { width: 80 },
  headerBack:   { fontSize: 14 },
  headerTitle:  { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  headerSave:   { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  scroll:       { padding: 16, paddingTop: 14 },

  card:         { borderRadius: 16, borderWidth: 0.5, padding: 16, marginBottom: 12 },

  avatarCenter: { alignItems: 'center', gap: 10 },
  avatarWrap:   { position: 'relative' },
  avatar:       { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarImg:    { width: 80, height: 80, borderRadius: 40 },
  avatarInitials:{ fontSize: 26, fontWeight: '500', color: '#fff' },
  editDot:      { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8630A', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  editIcon:     { fontSize: 11, color: '#fff' },
  changePhotoBtn:{ fontSize: 13, fontWeight: '500' },

  colorRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  colorLabel:   { fontSize: 11 },
  colorDots:    { flexDirection: 'row', gap: 8 },
  colorDot:     { width: 20, height: 20, borderRadius: 10 },
  colorDotActive:{ borderWidth: 2.5, transform: [{ scale: 1.15 }] },

  fieldRow:     { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 0.5 },
  fieldLabel:   { fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  fieldInput:   { fontSize: 15, paddingVertical: 2 },
  hint:         { fontSize: 11, marginTop: 4 },

  errorText:    { fontSize: 12, color: '#CC3333', textAlign: 'center', marginBottom: 8 },

  saveBtn:      { padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  saveBtnText:  { fontSize: 15, fontWeight: '500', color: '#fff' },
});