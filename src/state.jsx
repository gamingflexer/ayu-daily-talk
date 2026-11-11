import { createContext, useCallback, useContext, useState } from 'react';
import { getPersona } from '../shared/personas.js';

// App state for the demo. Browser storage is only a convenience: every read
// and write is guarded, and the app works without it.
const KEY = 'ayu-daily-talk:v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
function save(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // private mode / blocked storage — fine
  }
}

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [s, setS] = useState(() => ({ lang: 'en', personaId: 'sunita', phone: '', lastTalk: null, ...load() }));
  const update = useCallback((patch) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      save({ lang: next.lang, personaId: next.personaId, phone: next.phone, lastTalk: next.lastTalk });
      return next;
    });
  }, []);
  const value = { ...s, persona: getPersona(s.personaId), update };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}
