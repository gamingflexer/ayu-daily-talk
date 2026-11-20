// Helpers for checking that every language has every key.

/** Flat list of leaf keys ("a.b.c"); arrays are leaves. */
export function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
