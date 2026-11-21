import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ruleContext } from '../shared/journal.js';
import { setFor } from '../shared/question-sets.js';

// Everything Ayu knows lives on this phone (Om, 20 Nov 2026): no account server.
// One store holds the women, their daily entries and the question sets, so the
// woman's app and the ASHA's app on the same phone read the same real data.
// Storage can fail (private mode, blocked): every read and write is guarded and
// the app keeps working from memory.
const KEY = 'ayu:v2';

const EMPTY = {
  lang: null, // null until she picks one
  role: null, // 'woman' | 'asha'
  activeId: null, // the woman whose app is open
  selfId: null, // the woman who set this phone up for herself (if any)
  asha: null, // { name, phone } when an ASHA uses this phone
  women: {}, // id → woman
  entries: [], // newest last
  sets: {}, // id → question set made on this phone
};

/**
 * Demo profile (Om, 21 Nov 2026: "fill out all the information directly when we load the page").
 * A phone that opens Ayu with nothing saved starts as Kavita, week 34, with her ASHA set up too,
 * so a demo goes straight to Home. Everything can be changed under the profile (heart) button,
 * and "Delete everything" there starts the demo fresh. The names and numbers are made up.
 */
function demo() {
  const now = Date.now();
  const id = 'w_demo';
  return {
    ...EMPTY,
    lang: 'en',
    role: 'woman',
    activeId: id,
    selfId: id,
    asha: { name: 'Rekha Madavi', phone: '9800000001' },
    women: {
      [id]: {
        id,
        demo: true,
        name: 'Kavita',
        phone: '9800000002',
        age: 24,
        stage: 'pregnant',
        weeksAtStart: 34,
        weeksSetAt: now,
        createdAt: now,
        village: 'Jambhulni',
        lang: 'en',
        ashaName: 'Rekha tai',
        ashaPhone: '9800000001',
        centre: 'PHC Jambhulni',
      },
    },
  };
}

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v === 'object' ? { ...EMPTY, ...v } : demo();
  } catch {
    return demo();
  }
}
function save(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // private mode / storage full — carry on in memory
  }
}

let seq = 0;
export const newId = (p) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [s, setS] = useState(load);
  const set = useCallback((patch) => {
    setS((prev) => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      save(next);
      return next;
    });
  }, []);

  const actions = useMemo(
    () => ({
      setLang: (lang) => set({ lang }),
      setRole: (role) => set({ role }),
      setActive: (activeId) => set({ activeId }),
      setAsha: (asha) => set({ asha, role: 'asha' }),
      /** Back to her own app on this phone. */
      openSelf: () => set((p) => (p.women[p.selfId] ? { role: 'woman', activeId: p.selfId } : {})),

      /** Add a woman. `self` = she is setting up her own phone. Returns her id. */
      addWoman(fields, { self = false } = {}) {
        const id = newId('w');
        const now = Date.now();
        set((p) => ({
          women: { ...p.women, [id]: { ...fields, id, createdAt: now, weeksSetAt: now } },
          ...(self ? { role: 'woman', activeId: id, selfId: id } : {}),
        }));
        return id;
      },
      updateWoman(id, fields) {
        set((p) => (p.women[id] ? { women: { ...p.women, [id]: { ...p.women[id], ...fields, ...(fields.weeksAtStart ? { weeksSetAt: Date.now() } : {}) } } } : {}));
      },
      removeWoman(id) {
        set((p) => {
          const women = { ...p.women };
          delete women[id];
          return { women, entries: p.entries.filter((e) => e.womanId !== id), activeId: p.activeId === id ? null : p.activeId, selfId: p.selfId === id ? null : p.selfId };
        });
      },

      /** Save a check, a Tell Ayu, a Help now press or a BP reading. Returns the entry. */
      addEntry(entry) {
        const full = { id: newId('e'), at: Date.now(), ...entry };
        set((p) => ({ entries: [...p.entries, full].slice(-2000) }));
        return full;
      },
      markHandled(entryIds) {
        const ids = new Set([].concat(entryIds));
        set((p) => ({ entries: p.entries.map((e) => (ids.has(e.id) ? { ...e, handledAt: Date.now() } : e)) }));
      },

      saveSet(qset) {
        set((p) => ({ sets: { ...p.sets, [qset.id]: qset } }));
      },
      removeSet(id) {
        set((p) => {
          const sets = { ...p.sets };
          delete sets[id];
          return { sets };
        });
      },

      /** Wipe this phone. */
      erase() {
        set(demo());
      },
    }),
    [set],
  );

  const value = useMemo(() => {
    const women = Object.values(s.women).sort((a, b) => a.createdAt - b.createdAt);
    const woman = s.women[s.activeId] || null;
    const self = s.women[s.selfId] || null;
    return {
      ...s,
      lang: s.lang || 'en',
      langChosen: Boolean(s.lang),
      womenList: women,
      woman,
      self,
      ctx: woman ? ruleContext(woman) : null,
      qset: woman ? setFor(woman, s.sets) : null,
      ...actions,
    };
  }, [s, actions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}
