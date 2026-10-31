import supabase, { isSupabaseConfigured } from '../lib/supabaseClient';

export const authService = {
  /**
   * Registers a candidate user in Supabase Auth
   */
  async signUpCandidate({ email, password, full_name, phone }) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone,
          role: 'CANDIDATE',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Registers an HR user in Supabase Auth
   */
  async signUpHR({ email, password, full_name, organization_name, department }) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          organization_name,
          department,
          role: 'HR',
        },
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Signs in user with email and password via Supabase Auth
   */
  async signIn(email, password) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Signs out current user
   */
  async signOut() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  },

  /**
   * Get current session
   */
  async getSession() {
    if (!isSupabaseConfigured) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  },

  /**
   * Send password recovery email
   */
  async resetPassword(email) {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  /**
   * Update password for authenticated user
   */
  async updatePassword(newPassword) {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },
};

export default authService;
