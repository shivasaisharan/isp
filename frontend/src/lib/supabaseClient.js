import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  !supabaseUrl.includes('your-project') &&
  supabaseAnonKey &&
  !supabaseAnonKey.includes('your-anon-key') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE_PUBLISHABLE_KEY')
);

// Graceful fallback dummy client if environment keys are not yet filled
const fallbackClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured in .env') }),
    signUp: async () => ({ data: null, error: new Error('Supabase not configured in .env') }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  },
  channel: () => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    subscribe: () => ({ unsubscribe: () => {} }),
    unsubscribe: () => {},
  }),
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: new Error('Supabase storage not configured') }),
      createSignedUrl: async () => ({ data: null, error: new Error('Supabase storage not configured') }),
      remove: async () => ({ error: null }),
    }),
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : fallbackClient;

export default supabase;
