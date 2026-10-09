import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, logout as apiLogout, refreshSession, setLoggedOutHandler } from './api/client.js';

const Ctx = createContext({ user: null, ready: false, signIn: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // On page load, try to pick the session back up from the refresh cookie.
  useEffect(() => {
    let alive = true;
    refreshSession().then((u) => { if (alive) { setUser(u); setReady(true); } });
    setLoggedOutHandler(() => setUser(null));
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }, []);
  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
