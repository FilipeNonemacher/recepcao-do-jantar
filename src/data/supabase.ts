import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const defaultSupabaseUrl = 'https://sqrcdcrdwlsleemiuois.supabase.co';
const defaultSupabaseKey = 'sb_publishable_rh_KudPNlECAqkoNBz-1Fw_R8o5dFgh';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || defaultSupabaseKey;
const volatileSession = new Map<string, string>();
let persistAuthSession = true;

const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return volatileSession.get(key) ?? AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (persistAuthSession) {
      volatileSession.delete(key);
      await AsyncStorage.setItem(key, value);
    } else {
      volatileSession.set(key, value);
      await AsyncStorage.removeItem(key);
    }
  },
  async removeItem(key: string): Promise<void> {
    volatileSession.delete(key);
    await AsyncStorage.removeItem(key);
  },
};

export function setSessionPersistence(persist: boolean): void {
  persistAuthSession = persist;
}

export const isSyncConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSyncConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: sessionStorage,
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
