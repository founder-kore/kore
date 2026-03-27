// src/services/supabase.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bresisicgwgzpsdprehp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7HLITkd5Lm2jiY7F1AW-FQ_LHpNHOMl';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
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

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId, fileUri, fileType = 'image/jpeg') {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const ext = fileType.includes('png') ? 'png' : 'jpg';
  // Path must be userId/avatar.ext so RLS policy can match on folder name
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: fileType });

  if (uploadError) throw uploadError;

  // Add cache-busting timestamp so updated avatars reload immediately
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
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
  return !data; // true = available
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────

export async function getCloudHistory(userId) {
  const { data, error } = await supabase
    .from('history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
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
  if (error) return [];
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
  if (error) return [];
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

// ─── PREFERENCES ──────────────────────────────────────────────────────────────

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