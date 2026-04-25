import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

const webStorage = {
  getItem: (key) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    console.log('[GOOGLE_AUTH_DEBUG] signInWithGoogle start', {
      platform: Platform.OS,
      redirectUrl: window.location.origin,
    });
    console.log('[GOOGLE_AUTH_DEBUG] signInWithGoogle web oauth result', {
      oauthUrl: data?.url || null,
    });
    return data;
  } else {
    const redirectUrl = Linking.createURL('auth/callback', { scheme: 'kore' });
    console.log('[GOOGLE_AUTH_DEBUG] native Google redirect URL', { redirectUrl });
    console.log('[GOOGLE_AUTH_DEBUG] signInWithGoogle start', {
      platform: Platform.OS,
      redirectUrl,
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error) throw error;
    console.log('[GOOGLE_AUTH_DEBUG] signInWithGoogle native oauth result', {
      oauthUrl: data?.url || null,
      redirectUrl,
    });
    
    if (data?.url) {
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      console.log('[GOOGLE_AUTH_DEBUG] openAuthSessionAsync result', {
        type: res?.type || null,
        url: res?.url || null,
      });
      if (res.type === 'success' && res.url) {
        let sessionData = null;

        const codeMatch = res.url.match(/[?#&]code=([^&]+)/);
        // Securely extract the token parameters using a global regex match
        const accessTokenMatch = res.url.match(/access_token=([^&]+)/);
        const refreshTokenMatch = res.url.match(/refresh_token=([^&]+)/);
        console.log('[GOOGLE_AUTH_DEBUG] callback path detection', {
          matchedCodePath: Boolean(codeMatch),
          matchedTokenPath: Boolean(accessTokenMatch && refreshTokenMatch),
        });

        if (codeMatch) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            decodeURIComponent(codeMatch[1])
          );
          if (exchangeError) throw exchangeError;
          sessionData = exchangeData?.session || null;
          console.log('[GOOGLE_AUTH_DEBUG] exchangeCodeForSession result', {
            sessionUserId: sessionData?.user?.id || null,
          });
        } else if (accessTokenMatch && refreshTokenMatch) {
          const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessTokenMatch[1], 
            refresh_token: refreshTokenMatch[1] 
          });
          if (setSessionError) throw setSessionError;
          sessionData = setSessionData?.session || null;
          console.log('[GOOGLE_AUTH_DEBUG] setSession result', {
            sessionUserId: sessionData?.user?.id || null,
          });
        }
        return { ...data, session: sessionData };
      } else {
        throw new Error('cancel');
      }
    }
    return data;
  }
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: {
      emailRedirectTo: Linking.createURL('home'),
    }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

// ─── PROFILES ─────────────────────────────────────────────────────────────────

export async function createProfile({ userId, username, displayName, avatarColor = '#E8630A', avatarUrl = null }) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username, display_name: displayName, avatar_color: avatarColor, avatar_url: avatarUrl });
  if (error) throw error;
  return data;
}

export async function upsertProfile({ userId, username, displayName, avatarColor = '#E8630A', avatarUrl = null }) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, username, display_name: displayName, avatar_color: avatarColor, avatar_url: avatarUrl },
      { onConflict: 'id' }
    );
  if (error) throw error;
  return data;
}

function isProfileNotFoundError(error) {
  if (!error) return false;
  if (error.code === 'PGRST116') return true;

  const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    message.includes('0 rows') ||
    message.includes('no rows') ||
    message.includes('json object requested')
  );
}

export async function getProfileState(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (isProfileNotFoundError(error)) {
      console.log('[AVATAR_DEBUG] getProfileState missing profile', { userId });
      return { profile: null, missing: true };
    }
    throw error;
  }

  console.log('[AVATAR_DEBUG] getProfileState fetched profile', {
    userId,
    avatarField: 'avatar_url',
    rawAvatarUrl: data?.avatar_url ?? null,
  });

  return { profile: data, missing: false };
}

export async function getProfile(userId) {
  try {
    const { profile } = await getProfileState(userId);
    return profile;
  } catch (_error) {
    return null;
  }
}

const RENDERABLE_AVATAR_URI_RE = /^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|assets-library:\/\/|data:|blob:)/i;
const LOCAL_ONLY_AVATAR_URI_RE = /^(file:\/\/|content:\/\/|ph:\/\/|assets-library:\/\/|data:|blob:)/i;
const AVATAR_BUCKET = 'avatars';
const SIGNED_AVATAR_URL_TTL_SECONDS = 60 * 60 * 24 * 30;

function extractAvatarStoragePath(avatarValue) {
  const rawAvatarValue = typeof avatarValue === 'string' ? avatarValue.trim() : '';
  if (!rawAvatarValue) {
    return null;
  }

  if (LOCAL_ONLY_AVATAR_URI_RE.test(rawAvatarValue)) {
    return null;
  }

  if (/^https?:\/\//i.test(rawAvatarValue)) {
    try {
      const parsedUrl = new URL(rawAvatarValue);
      const markers = [
        `/storage/v1/object/public/${AVATAR_BUCKET}/`,
        `/storage/v1/object/sign/${AVATAR_BUCKET}/`,
      ];

      for (const marker of markers) {
        const markerIndex = parsedUrl.pathname.indexOf(marker);
        if (markerIndex >= 0) {
          return decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length));
        }
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  return rawAvatarValue
    .replace(/^\/+/, '')
    .replace(/^avatars\//, '');
}

function appendCacheBust(url, cacheBustToken) {
  if (!url || !cacheBustToken) {
    return url || null;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${cacheBustToken}`;
}

export function getRenderableAvatarUrl(avatarValue) {
  const rawAvatarValue = typeof avatarValue === 'string' ? avatarValue.trim() : '';
  if (!rawAvatarValue) {
    return null;
  }

  if (RENDERABLE_AVATAR_URI_RE.test(rawAvatarValue)) {
    return rawAvatarValue;
  }

  const normalizedPath = extractAvatarStoragePath(rawAvatarValue);
  if (!normalizedPath) {
    return null;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(normalizedPath);
  const publicUrl = data?.publicUrl || null;

  console.log('[AVATAR_DEBUG] getRenderableAvatarUrl normalized storage path', {
    rawAvatarValue,
    normalizedPath,
    publicUrl,
  });

  return publicUrl;
}

export async function resolveAvatarUrl(avatarValue, options = {}) {
  const rawAvatarValue = typeof avatarValue === 'string' ? avatarValue.trim() : '';
  const cacheBustToken = options.cacheBust ? Date.now() : null;
  if (!rawAvatarValue) {
    return null;
  }

  const storagePath = extractAvatarStoragePath(rawAvatarValue);
  if (!storagePath) {
    return appendCacheBust(rawAvatarValue, cacheBustToken);
  }

  try {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(storagePath, SIGNED_AVATAR_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      const signedUrl = appendCacheBust(data.signedUrl, cacheBustToken);
      console.log('[AVATAR_DEBUG] resolveAvatarUrl signed url success', {
        rawAvatarValue,
        storagePath,
        signedUrl,
      });
      return signedUrl;
    }

    console.log('[AVATAR_DEBUG] resolveAvatarUrl signed url fallback', {
      rawAvatarValue,
      storagePath,
      message: error?.message || null,
    });
  } catch (error) {
    console.log('[AVATAR_DEBUG] resolveAvatarUrl signed url error', {
      rawAvatarValue,
      storagePath,
      message: error?.message || String(error),
    });
  }

  const publicUrl = getRenderableAvatarUrl(storagePath);
  return appendCacheBust(publicUrl, cacheBustToken);
}

export async function updateProfile(userId, updates) {
  console.log('[AVATAR_DEBUG] updateProfile start', {
    userId,
    avatarField: Object.prototype.hasOwnProperty.call(updates || {}, 'avatar_url') ? 'avatar_url' : null,
    avatarUrl: updates?.avatar_url ?? null,
  });
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
  console.log('[AVATAR_DEBUG] updateProfile success', {
    userId,
    avatarUrl: updates?.avatar_url ?? null,
  });
  return data;
}

export async function uploadAvatar(userId, fileSource, fileType = 'image/jpeg') {
  let uploadBody = fileSource;
  let contentType = fileType || 'image/jpeg';

  console.log('[AVATAR_DEBUG] uploadAvatar start', {
    userId,
    contentType,
    sourceType: typeof fileSource === 'string' ? 'uri' : 'file',
  });

  if (typeof fileSource === 'string') {
    const response = await fetch(fileSource);
    uploadBody = await response.blob();
  } else if (fileSource?.type && !fileType) {
    contentType = fileSource.type;
  }

  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, uploadBody, { upsert: true, contentType });

  if (uploadError) {
    console.log('[AVATAR_DEBUG] uploadAvatar error', {
      userId,
      path,
      message: uploadError?.message || String(uploadError),
    });
    throw uploadError;
  }

  console.log('[AVATAR_DEBUG] uploadAvatar success', {
    userId,
    path,
  });
  return path;
}

export async function getGoogleAvatarUrl() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.user_metadata?.avatar_url || null;
}

export async function checkUsernameAvailable(username) {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username.toLowerCase().trim())
    .single();
  return !data;
}

// ─── PREFERENCES ──────────────────────────────────────────────────────────────

export async function createPreferences(userId) {
  const { error } = await supabase
    .from('preferences')
    .upsert({
      user_id: userId,
      streak: 0,
      last_used: null,
      favorite_genres: [],
      milestones_seen: [],
      era_lock: null,
      directors_cut: false,
      mix_hidden_gems: false,
    }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) console.log('Preferences create error:', error);
}

export async function getCloudPreferences(userId) {
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function updateCloudPreferences(userId, updates) {
  const { error } = await supabase
    .from('preferences')
    .update(updates)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────

export async function getCloudHistory(userId) {
  const { data, error } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map(row => row.data);
}

export async function addToCloudHistory(userId, entry) {
  const { error } = await supabase
    .from('history')
    .insert({ user_id: userId, title: entry.title, data: entry });
  if (error) throw error;
}

export async function clearCloudHistory(userId) {
  const { error } = await supabase
    .from('history')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── RATINGS ──────────────────────────────────────────────────────────────────

export async function getCloudRatings(userId) {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId);
  if (error || !data) return [];
  return data.map(row => ({ title: row.title, rating: row.rating }));
}

export async function saveCloudRating(userId, title, rating) {
  const { error } = await supabase
    .from('ratings')
    .upsert({ user_id: userId, title, rating }, { onConflict: 'user_id,title' });
  if (error) throw error;
}

export async function removeCloudRating(userId, title) {
  const { error } = await supabase
    .from('ratings')
    .delete()
    .eq('user_id', userId)
    .eq('title', title);
  if (error) throw error;
}

// ─── WATCH LATER ──────────────────────────────────────────────────────────────

export async function getCloudWatchLater(userId) {
  const { data, error } = await supabase
    .from('watch_later')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(row => row.data);
}

export async function addToCloudWatchLater(userId, entry) {
  const { error } = await supabase
    .from('watch_later')
    .upsert({ user_id: userId, title: entry.title, data: entry }, { onConflict: 'user_id,title' });
  if (error) throw error;
}

export async function removeFromCloudWatchLater(userId, title) {
  const { error } = await supabase
    .from('watch_later')
    .delete()
    .eq('user_id', userId)
    .eq('title', title);
  if (error) throw error;
}

export async function clearCloudWatchLater(userId) {
  const { error } = await supabase
    .from('watch_later')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}
