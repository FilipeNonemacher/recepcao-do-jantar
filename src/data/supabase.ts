import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const defaultSupabaseUrl = 'https://sqrcdcrdwlsleemiuois.supabase.co';
const defaultSupabaseKey = 'sb_publishable_rh_KudPNlECAqkoNBz-1Fw_R8o5dFgh';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || defaultSupabaseKey;

export const isSyncConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSyncConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
