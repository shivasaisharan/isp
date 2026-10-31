import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import supabase, { isSupabaseConfigured } from '../lib/supabaseClient';
import authService from '../services/authService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync session with FastAPI /auth/me
  const syncBackendUser = async (token) => {
    try {
      if (token) {
        localStorage.setItem('smart_recruit_token', token);
      }
      const res = await api.get('/auth/me');
      setUser(res.data);
      return res.data;
    } catch (err) {
      console.error("Auth sync error:", err);
      localStorage.removeItem('smart_recruit_token');
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    let subscription = null;

    const initAuth = async () => {
      if (isSupabaseConfigured) {
        // Listen to Supabase Auth state changes
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.access_token) {
            localStorage.setItem('smart_recruit_token', session.access_token);
            await syncBackendUser(session.access_token);
          } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem('smart_recruit_token');
            setUser(null);
          }
          setLoading(false);
        });
        subscription = data?.subscription;

        // Check active session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          await syncBackendUser(sessionData.session.access_token);
        } else {
          setLoading(false);
        }
      } else {
        // Fallback to local token sync
        const token = localStorage.getItem('smart_recruit_token');
        if (token) {
          await syncBackendUser(token);
        }
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const loginCandidate = async (email, password) => {
    if (isSupabaseConfigured) {
      const data = await authService.signIn(email, password);
      if (data?.session?.access_token) {
        return await syncBackendUser(data.session.access_token);
      }
    }
    // Fallback directly to FastAPI
    const res = await api.post('/auth/candidate/login', { email, password });
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    return await syncBackendUser(res.data.access_token);
  };

  const registerCandidate = async (formData) => {
    if (isSupabaseConfigured) {
      const data = await authService.signUpCandidate(formData);
      if (data?.session?.access_token) {
        return await syncBackendUser(data.session.access_token);
      }
    }
    // Fallback directly to FastAPI
    const res = await api.post('/auth/candidate/register', formData);
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    return await syncBackendUser(res.data.access_token);
  };

  const loginHR = async (email, password) => {
    if (isSupabaseConfigured) {
      const data = await authService.signIn(email, password);
      if (data?.session?.access_token) {
        return await syncBackendUser(data.session.access_token);
      }
    }
    // Fallback directly to FastAPI
    const res = await api.post('/auth/hr/login', { email, password });
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    return await syncBackendUser(res.data.access_token);
  };

  const registerHR = async (formData) => {
    if (isSupabaseConfigured) {
      const data = await authService.signUpHR(formData);
      if (data?.session?.access_token) {
        return await syncBackendUser(data.session.access_token);
      }
    }
    // Fallback directly to FastAPI
    const res = await api.post('/auth/hr/register', formData);
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    return await syncBackendUser(res.data.access_token);
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await authService.signOut();
      }
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('smart_recruit_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      loginCandidate,
      registerCandidate,
      loginHR,
      registerHR,
      logout,
      isCandidate: user?.role === 'candidate',
      isHR: user?.role === 'hr',
      isOrgAdmin: user?.role === 'org_admin',
      isSuperAdmin: user?.role === 'super_admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
