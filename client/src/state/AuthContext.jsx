import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        const token = getToken();
        if (!token) {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }
        const res = await apiFetch('/api/auth/me', { auth: true });
        if (mounted) {
          setUser(res.user || null);
          setLoading(false);
        }
      } catch {
        setToken(null);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    }
    bootstrap();
    return () => { mounted = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(username, password) {
      const res = await apiFetch('/api/auth/login', { method: 'POST', body: { username, password } });
      setToken(res.token);
      setUser(res.user);
      return res.user;
    },
    async register(payload) {
  const res = await apiFetch('/api/auth/register', { method: 'POST', body: payload });
  // approval required -> do NOT set token/user here
  return res;
},
    logout() {
      setToken(null);
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
