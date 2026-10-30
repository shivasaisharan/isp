import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('smart_recruit_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (err) {
          console.error("Auth check failed:", err);
          localStorage.removeItem('smart_recruit_token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const loginCandidate = async (email, password) => {
    const res = await api.post('/auth/candidate/login', { email, password });
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    const meRes = await api.get('/auth/me');
    setUser(meRes.data);
    return meRes.data;
  };

  const registerCandidate = async (formData) => {
    const res = await api.post('/auth/candidate/register', formData);
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    const meRes = await api.get('/auth/me');
    setUser(meRes.data);
    return meRes.data;
  };

  const loginHR = async (email, password) => {
    const res = await api.post('/auth/hr/login', { email, password });
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    const meRes = await api.get('/auth/me');
    setUser(meRes.data);
    return meRes.data;
  };

  const registerHR = async (formData) => {
    const res = await api.post('/auth/hr/register', formData);
    localStorage.setItem('smart_recruit_token', res.data.access_token);
    const meRes = await api.get('/auth/me');
    setUser(meRes.data);
    return meRes.data;
  };

  const logout = async () => {
    try {
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
      isHR: user?.role === 'hr'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

