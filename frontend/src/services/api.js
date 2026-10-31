import axios from 'axios';
import supabase, { isSupabaseConfigured } from '../lib/supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Checks if a JWT is expired or expiring within bufferSeconds
 */
function isJwtExpired(token, bufferSeconds = 15) {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false; // not a standard JWT, don't treat as expired
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const payload = JSON.parse(atob(base64));
    if (payload.exp) {
      return Date.now() / 1000 >= payload.exp - bufferSeconds;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Retrieve the active auth token with automatic fallback across:
 * 1. Existing smart_recruit_token in localStorage (if valid)
 * 2. Active Supabase session from supabase.auth.getSession()
 * 3. Supabase localStorage token cache (sb-*-auth-token)
 */
export async function getValidAuthToken() {
  let token = localStorage.getItem('smart_recruit_token');

  // If token is present and not expired, use it immediately
  if (token && !isJwtExpired(token)) {
    return token;
  }

  // If token is absent or expired, attempt to get it from Supabase session
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        token = data.session.access_token;
        localStorage.setItem('smart_recruit_token', token);
        return token;
      }
    } catch (e) {
      console.warn('Error reading Supabase session:', e);
    }
  }

  // Fallback: Check localStorage for any sb-*-auth-token entries
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const itemStr = localStorage.getItem(key);
        if (itemStr) {
          const parsed = JSON.parse(itemStr);
          const sbToken = parsed?.access_token || parsed?.currentSession?.access_token;
          if (sbToken && !isJwtExpired(sbToken)) {
            localStorage.setItem('smart_recruit_token', sbToken);
            return sbToken;
          }
        }
      }
    }
  } catch (e) {
    // ignore parsing errors
  }

  // Return existing token even if near expiry if no other valid token was found
  return token || null;
}

api.interceptors.request.use(async (config) => {
  const token = await getValidAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration & retry once on 401
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      if (isSupabaseConfigured) {
        try {
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && data?.session?.access_token) {
            const newToken = data.session.access_token;
            localStorage.setItem('smart_recruit_token', newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          console.warn('Supabase session refresh failed on 401:', refreshErr);
        }
      }
    }

    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const detail = error.response.data?.detail;
      if (typeof detail === 'string') {
        // Clear tokens only for explicit role permission rejections or invalid deleted accounts
        if (
          detail.includes("Candidate portal permission required") ||
          detail.includes("HR Recruiter portal permission required") ||
          detail.includes("User associated with token no longer exists")
        ) {
          localStorage.removeItem('smart_recruit_token');
          localStorage.removeItem('smart_recruit_user');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
