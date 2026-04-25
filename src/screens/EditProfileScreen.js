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
  getCurrentUser, getGoogleAvatarUrl, getRenderableAvatarUrl, resolveAvatarUrl,
} from '../services/supabase';

const AVATAR_DEBUG_PREFIX = '[AVATAR_DEBUG]';
const AVATAR_COLORS = [
  '#E8630A', '#4D9FFF', '#7F77DD',
  '#1D9E75', '#D4537E', '#C77DFF',
];

function getAvatarSource(avatarUri) {
  const normalizedUri = typeof avatarUri === 'string' ? avatarUri.trim() : '';
  if (!normalizedUri) return null;
  return { uri: normalizedUri, cache: 'reload' };
}

export default function EditProfileScreen({ onBack, userProfile, onSave }) {
  const { colors, isDark } = useTheme();

  const [displayName,   setDisplayName]   = useState(userProfile?.display_name || '');
  const [username,      setUsername]      = useState(userProfile?.username || '');
  const [avatarColor,   setAvatarColor]   = useState(userProfile?.avatar_color || '#E8630A');
  const [avatarUrl,     setAvatarUrl]     = useState(getRenderableAvatarUrl(userProfile?.avatar_url) || null);
  const [localImageUri, setLocalImageUri] = useState(null);

  const [usernameState, setUsernameState] = useState('idle');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  const usernameTimer  = useRef(null);
  const fileInputRef   = useRef(null); // web file input ref
  const originalUsername = userProfile?.username || '';

  useEffect(() => {
    setDisplayName(userProfile?.display_name || '');
    setUsername(userProfile?.username || '');
    setAvatarColor(userProfile?.avatar_color || '#E8630A');
    setAvatarUrl(getRenderableAvatarUrl(userProfile?.avatar_url) || null);
    setLocalImageUri(null);
    setError('');
    setUsernameState('idle');

    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current._file = null;
      fileInputRef.current.value = '';
    }
  }, [userProfile]);

  const cardBg  = isDark ? '#1A1A1A' : colors.snow;
  const borderC = isDark ? '#2A2A2A' : colors.border;

  // Auto-load Google avatar if no avatar set yet
  useEffect(() => {
    if (!avatarUrl && !localImageUri) {
      getGoogleAvatarUrl().then(url => { if (url) setAvatarUrl(url); });
    }
  }, [avatarUrl, localImageUri]);

  // Inject hidden file input on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setLocalImageUri(url);
      // Store the actual File object for upload
      if (fileInputRef.current) {
        fileInputRef.current._file = file;
      }
    });
    document.body.appendChild(input);
    fileInputRef.current = input;
    return () => {
      document.body.removeChild(input);
    };
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
    console.log(`${AVATAR_DEBUG_PREFIX} Change photo tapped`, {
      platform: Platform.OS,
    });

    if (Platform.OS === 'web') {
      // On web, trigger the hidden file input
      console.log(`${AVATAR_DEBUG_PREFIX} opening web file input`);
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }

    try {
      setError('');
      const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log(`${AVATAR_DEBUG_PREFIX} current media permission`, {
        status: currentPermission?.status || null,
        granted: currentPermission?.granted ?? null,
        accessPrivileges: currentPermission?.accessPrivileges || null,
      });

      let finalPermission = currentPermission;
      const permissionGranted = currentPermission?.granted === true || currentPermission?.status === 'granted';

      if (!permissionGranted) {
        finalPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log(`${AVATAR_DEBUG_PREFIX} requested media permission`, {
          status: finalPermission?.status || null,
          granted: finalPermission?.granted ?? null,
          accessPrivileges: finalPermission?.accessPrivileges || null,
        });
      }

      const hasLibraryAccess = finalPermission?.granted === true || finalPermission?.status === 'granted';
      if (!hasLibraryAccess) {
        setError('Photo library access is required to change your avatar.');
        return;
      }

      console.log(`${AVATAR_DEBUG_PREFIX} launching image library`);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      const canceled = result?.canceled ?? result?.cancelled ?? false;
      const selectedAsset = Array.isArray(result?.assets) ? result.assets[0] : null;
      console.log(`${AVATAR_DEBUG_PREFIX} image picker result`, {
        canceled,
        assetCount: Array.isArray(result?.assets) ? result.assets.length : 0,
        selectedUri: selectedAsset?.uri || null,
      });

      if (canceled) {
        return;
      }

      if (!selectedAsset?.uri) {
        throw new Error('No image was selected.');
      }

      setLocalImageUri(selectedAsset.uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.log(`${AVATAR_DEBUG_PREFIX} image picker error`, {
        message: e?.message || String(e),
      });
      setError(e?.message || 'Could not open your photo library. Try again.');
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
        let mime = 'image/jpeg';

        if (Platform.OS === 'web' && fileInputRef.current?._file) {
          const file = fileInputRef.current._file;
          mime = file.type || 'image/jpeg';
          console.log(`${AVATAR_DEBUG_PREFIX} avatar upload start`, {
            userId: user.id,
            platform: Platform.OS,
            mime,
            source: 'web-file',
          });
          updates.avatar_url = await uploadAvatar(user.id, file, mime);
        } else {
          const ext = localImageUri.split('.').pop()?.toLowerCase() || 'jpg';
          mime = ext === 'png' ? 'image/png' : 'image/jpeg';
          console.log(`${AVATAR_DEBUG_PREFIX} avatar upload start`, {
            userId: user.id,
            platform: Platform.OS,
            mime,
            source: 'native-uri',
            localImageUri,
          });
          updates.avatar_url = await uploadAvatar(user.id, localImageUri, mime);
        }
        console.log(`${AVATAR_DEBUG_PREFIX} avatar upload success`, {
          userId: user.id,
          avatarUrl: updates.avatar_url,
        });
      }

      console.log(`${AVATAR_DEBUG_PREFIX} profile update start`, {
        userId: user.id,
        hasAvatarUpdate: Boolean(updates.avatar_url),
        avatarField: 'avatar_url',
        avatarUrlToSave: updates.avatar_url ?? null,
      });
      await updateProfile(user.id, updates);
      console.log(`${AVATAR_DEBUG_PREFIX} profile update success`, {
        userId: user.id,
        avatarUrl: updates.avatar_url || avatarUrl || null,
      });
      const savedAvatarUrl = await resolveAvatarUrl(updates.avatar_url || avatarUrl, { cacheBust: true });
      if (updates.avatar_url) {
        setAvatarUrl(savedAvatarUrl);
        setLocalImageUri(null);
        if (Platform.OS === 'web' && fileInputRef.current) {
          fileInputRef.current._file = null;
          fileInputRef.current.value = '';
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const savedProfilePayload = { ...(userProfile || {}), ...updates, avatar_url: savedAvatarUrl };
      await onSave?.(savedProfilePayload);
      console.log(`${AVATAR_DEBUG_PREFIX} profile handoff success`, {
        avatarField: 'avatar_url',
        avatarUrl: savedAvatarUrl || null,
        profilePayload: savedProfilePayload,
      });
    } catch (e) {
      console.log(`${AVATAR_DEBUG_PREFIX} profile save error`, {
        message: e?.message || String(e),
      });
      setError(e.message || 'Could not save changes. Try again.');
    } finally { setSaving(false); }
  };

  const initials = displayName.trim()
    ? displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (username || '?').slice(0, 2).toUpperCase();

  const displayImage = localImageUri || avatarUrl;
  const displayImageSource = getAvatarSource(displayImage);

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

            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickImage} activeOpacity={0.8}>
              {displayImageSource ? (
                <Image testID="edit-profile-avatar-image" source={displayImageSource} style={styles.avatarImg} />
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
