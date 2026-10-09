// A tiny i18n: Hindi and English only (decision D3), switched from the header and remembered on this device.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import en from './en.json';
import hi from './hi.json';

const DICT = { en, hi };
const KEY = 'govlang';

function initial() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'hi' || v === 'en') return v;
  } catch { /* storage blocked */ }
  return 'en';
}

const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (k) => k, pick: (n) => '' });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initial);
  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l;
  }, []);
  const t = useCallback((key, vars) => {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [lang]);
  /** Picks the right language from a {hi, en} object that came from the API. */
  const pick = useCallback((names) => (names ? names[lang] || names.en || names.hi || '' : ''), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, pick }), [lang, setLang, t, pick]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
