import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Keyboard
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signIn, signUp, checkUsernameAvailable, upsertProfile, supabase, getGoogleAvatarUrl, signInWithGoogle } from '../services/supabase';

const AVATAR_COLORS = [
  '#E8630A', '#7F77DD', '#1D9E75', '#D4537E',
  '#4D9FFF', '#FF6B35', '#00C9A7', '#C77DFF',
];

export default function AuthScreen({ onAuthSuccess, onContinueAsGuest, startAtProfile = false, userId: propUserId }) {
  const { colors, isDark } = useTheme();
  const [mode, setMode] = useState(startAtProfile ? 'profile' : 'welcome');

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#E8630A');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [userId,      setUserId]      = useState(propUserId || null);
  const googleTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (googleTimeoutRef.current) {
        clearTimeout(googleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (startAtProfile) {
      setMode('profile');
      if (propUserId) {
        setUserId(propUserId);
      }
      if (googleTimeoutRef.current) {
        clearTimeout(googleTimeoutRef.current);
        googleTimeoutRef.current = null;
      }
      setLoading(false);
      setError('');
    } else if (propUserId) {
      setUserId(propUserId);
    }
  }, [startAtProfile, propUserId]);

  const switchMode = (m) => { 
    Keyboard.dismiss(); 
    setError(''); 
    setMode(m); 
  };

  // ── Email sign up
  const handleSignup = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    
    try {
      await signUp(email.trim(), password);

      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session) {
        setError('Check your email to verify, OR turn off "Confirm Email" in Supabase settings.');
        setLoading(false);
        return;
      }

      setUserId(sessionData.session.user.id);
      setLoading(false);
      switchMode('profile');
    } catch (e) {
      setError(e.message?.includes('already') ? 'This email is already registered. Sign in instead.' : (e.message || 'Sign up failed.'));
      setLoading(false);
    }
  };

  // ── Email sign in
  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    
    try {
      const authData = await signIn(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onAuthSuccess(authData?.session || null);
      setLoading(false);
    } catch (e) {
      if (e.message?.includes('Email not confirmed')) {
        setError('Please verify your email address first.');
      } else if (e.message?.includes('Could not finish signing in')) {
        setError(e.message);
      } else {
        setError('Incorrect email or password.');
      }
      setLoading(false);
    }
  };

  // ── Google sign in
  const handleGoogle = async () => {
    Keyboard.dismiss();
    console.log('[GOOGLE_AUTH_DEBUG] AuthScreen handleGoogle start');
    setLoading(true); setError('');
    try {
      await signInWithGoogle();
      console.log('[GOOGLE_AUTH_DEBUG] AuthScreen handleGoogle signInWithGoogle returned', {
        returnedSession: false,
        handoffMode: 'listener_only',
      });
      if (googleTimeoutRef.current) {
        clearTimeout(googleTimeoutRef.current);
      }
      googleTimeoutRef.current = setTimeout(() => {
        console.log('[GOOGLE_AUTH_DEBUG] AuthScreen handleGoogle timeout fallback');
        setLoading(false);
        setError('Google sign in completed, but the app did not finish loading. Please try again.');
        console.log('[GOOGLE_AUTH_DEBUG] AuthScreen handleGoogle loading cleared');
        console.log('[GOOGLE_AUTH_DEBUG] AuthScreen handleGoogle error set', {
          message: 'Google sign in completed, but the app did not finish loading. Please try again.',
        });
      }, 7000);
    } catch (e) {
      if (googleTimeoutRef.current) {
        clearTimeout(googleTimeoutRef.current);
        googleTimeoutRef.current = null;
      }
      if (e.message !== 'cancel') {
        setError('Google sign in failed. Try email instead.');
        console.log('[GOOGLE_AUTH_DEBUG] AuthScreen handleGoogle error set', {
          message: 'Google sign in failed. Try email instead.',
        });
      }
      setLoading(false);
      console.log('[GOOGLE_AUTH_DEBUG] AuthScreen handleGoogle loading cleared');
    }
  };

  // ── Profile creation after signup
  const handleCreateProfile = async () => {
    Keyboard.dismiss();
    if (!username.trim())     { setError('Username is required'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Letters, numbers and underscores only'); return; }
    if (!displayName.trim())  { setError('Display name is required'); return; }
    setLoading(true); setError('');
    
    try {
      const available = await checkUsernameAvailable(username.trim().toLowerCase());
      if (!available) { setError('Username taken — try another'); setLoading(false); return; }

      const googleAvatar = await getGoogleAvatarUrl();

      await upsertProfile({
        userId,
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        avatarColor,
        avatarUrl: googleAvatar || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.removeItem('kore_onboarded'); // Force onboarding for new accounts
      await onAuthSuccess();
      setLoading(false);
    } catch (e) {
      setError(e.message || 'Could not create profile.');
      setLoading(false);
    }
  };

  const cardBg  = isDark ? '#1A1A1A' : colors.snow;
  const borderC = isDark ? '#2A2A2A' : '#E0DFDD';
  const inputBg = isDark ? '#242424' : '#F5F4F2';

  const initials = displayName.trim()
    ? displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.chalk }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={styles.logoWrap}>
            <Text style={[styles.logo, { color: colors.ember }]}>コレ</Text>
            <Text style={[styles.appName, { color: colors.ink }]}>Kore</Text>
          </View>

          {/* FIX: Animations completely removed so the layout never crashes to a white screen */}
          <View>

            {/* ── WELCOME ── */}
            {mode === 'welcome' && (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>Welcome back</Text>
                <Text style={[styles.cardSub, { color: colors.charcoal }]}>
                  Save your history, ratings and streak across every device.
                </Text>

                <TouchableOpacity
                  style={[styles.googleBtn, { backgroundColor: cardBg, borderColor: borderC }]}
                  onPress={handleGoogle}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={[styles.googleText, { color: colors.ink }]}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: borderC }]} />
                  <Text style={[styles.dividerText, { color: colors.charcoal }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: borderC }]} />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: colors.ink }]}
                  onPress={() => switchMode('signup')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnPrimaryText, { color: colors.snow }]}>Create account</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnSecondary, { borderColor: borderC }]}
                  onPress={() => switchMode('login')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnSecondaryText, { color: colors.ink }]}>Sign in</Text>
                </TouchableOpacity>

                <View style={[styles.dividerRow, { marginTop: 4 }]}>
                  <View style={[styles.dividerLine, { backgroundColor: borderC }]} />
                </View>

                <TouchableOpacity style={styles.guestBtn} onPress={onContinueAsGuest} activeOpacity={0.7}>
                  <Text style={[styles.guestText, { color: colors.charcoal }]}>Continue as guest</Text>
                </TouchableOpacity>

                <View style={[styles.guestWarning, { backgroundColor: isDark ? '#1A1200' : '#FFFBEE', borderColor: isDark ? '#2A2000' : '#FFE5A0' }]}>
                  <Text style={[styles.guestWarningText, { color: isDark ? '#FFD060' : '#7A5800' }]}>
                    Guest data is stored on this device only and won't sync across devices.
                  </Text>
                </View>
              </View>
            )}

            {/* ── SIGN IN ── */}
            {mode === 'login' && (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>Sign in</Text>

                <TouchableOpacity
                  style={[styles.googleBtn, { backgroundColor: cardBg, borderColor: borderC }]}
                  onPress={handleGoogle}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={[styles.googleText, { color: colors.ink }]}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: borderC }]} />
                  <Text style={[styles.dividerText, { color: colors.charcoal }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: borderC }]} />
                </View>

                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: borderC, color: colors.ink }]}
                  placeholder="Email"
                  placeholderTextColor={colors.charcoal}
                  value={email} onChangeText={setEmail}
                  autoCapitalize="none" keyboardType="email-address"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: borderC, color: colors.ink }]}
                  placeholder="Password"
                  placeholderTextColor={colors.charcoal}
                  value={password} onChangeText={setPassword}
                  secureTextEntry
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: colors.ember }, loading && { opacity: 0.6 }]}
                  onPress={handleLogin} disabled={loading} activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Sign in →</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.switchBtn} onPress={() => switchMode('welcome')}>
                  <Text style={[styles.switchText, { color: colors.charcoal }]}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── SIGN UP ── */}
            {mode === 'signup' && (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>Create account</Text>

                <TouchableOpacity
                  style={[styles.googleBtn, { backgroundColor: cardBg, borderColor: borderC }]}
                  onPress={handleGoogle}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={[styles.googleText, { color: colors.ink }]}>Sign up with Google</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: borderC }]} />
                  <Text style={[styles.dividerText, { color: colors.charcoal }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: borderC }]} />
                </View>

                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: borderC, color: colors.ink }]}
                  placeholder="Email"
                  placeholderTextColor={colors.charcoal}
                  value={email} onChangeText={setEmail}
                  autoCapitalize="none" keyboardType="email-address"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: borderC, color: colors.ink }]}
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor={colors.charcoal}
                  value={password} onChangeText={setPassword}
                  secureTextEntry
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: colors.ink }, loading && { opacity: 0.6 }]}
                  onPress={handleSignup} disabled={loading} activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color={colors.snow} /> : <Text style={[styles.btnPrimaryText, { color: colors.snow }]}>Continue →</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.switchBtn} onPress={() => switchMode('welcome')}>
                  <Text style={[styles.switchText, { color: colors.charcoal }]}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── PROFILE SETUP ── */}
            {mode === 'profile' && (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: borderC }]}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>Set up your profile</Text>
                <Text style={[styles.cardSub, { color: colors.charcoal }]}>Almost there — just a few details.</Text>

                <View style={styles.avatarPreviewWrap}>
                  <View style={[styles.avatarPreview, { backgroundColor: avatarColor }]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                  <Text style={[styles.avatarHint, { color: colors.charcoal }]}>Pick a colour below</Text>
                </View>

                <View style={styles.colorRow}>
                  {AVATAR_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorDot, { backgroundColor: c },
                        avatarColor === c && { borderWidth: 3, borderColor: colors.snow, transform: [{ scale: 1.2 }] }
                      ]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAvatarColor(c); }}
                    />
                  ))}
                </View>

                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: borderC, color: colors.ink }]}
                  placeholder="Display name"
                  placeholderTextColor={colors.charcoal}
                  value={displayName} onChangeText={setDisplayName}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: borderC, color: colors.ink }]}
                  placeholder="Username (letters, numbers, _)"
                  placeholderTextColor={colors.charcoal}
                  value={username}
                  onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  autoCapitalize="none"
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.btnPrimary, { backgroundColor: colors.ember }, loading && { opacity: 0.6 }]}
                  onPress={handleCreateProfile} disabled={loading} activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Start using Kore →</Text>}
                </TouchableOpacity>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  scroll:       { flexGrow: 1, padding: 24, paddingTop: 40, justifyContent: 'center' },

  logoWrap:     { alignItems: 'center', marginBottom: 28 },
  logo:         { fontSize: 52, fontWeight: '700' },
  appName:      { fontSize: 17, fontWeight: '400', marginTop: -4, letterSpacing: 0.5 },

  card:         { borderRadius: 18, borderWidth: 0.5, padding: 24, gap: 12 },
  cardTitle:    { fontSize: 22, fontWeight: '500' },
  cardSub:      { fontSize: 13, lineHeight: 20, marginBottom: 2 },

  googleBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 14, borderRadius: 12, borderWidth: 1,
  },
  googleIcon:   { fontSize: 16, fontWeight: '700', color: '#4285F4', width: 20, textAlign: 'center' },
  googleText:   { fontSize: 14, fontWeight: '500' },

  dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine:  { flex: 1, height: 0.5 },
  dividerText:  { fontSize: 12 },

  input:        { borderWidth: 0.5, borderRadius: 12, padding: 14, fontSize: 14 },

  btnPrimary:   { padding: 16, borderRadius: 12, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, fontWeight: '500', color: '#fff' },
  btnSecondary: { padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 0.5 },
  btnSecondaryText: { fontSize: 15, fontWeight: '500' },

  guestBtn:     { alignItems: 'center', paddingVertical: 4 },
  guestText:    { fontSize: 13 },

  guestWarning: { borderRadius: 10, borderWidth: 0.5, padding: 12 },
  guestWarningText: { fontSize: 12, lineHeight: 18 },

  switchBtn:    { alignItems: 'center', paddingVertical: 4 },
  switchText:   { fontSize: 13 },

  errorText:    { fontSize: 12, color: '#CC3333', textAlign: 'center' },

  avatarPreviewWrap: { alignItems: 'center', gap: 8, marginVertical: 4 },
  avatarPreview:     { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarInitials:    { fontSize: 24, fontWeight: '500', color: '#fff' },
  avatarHint:        { fontSize: 11 },

  colorRow:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  colorDot:     { width: 30, height: 30, borderRadius: 15 },
});
