// Which keys every language must have. Reviewer-only text (the desktop design
// notes, the screens index, /call-test and the flow captions) stays English.

export const REVIEWER_ONLY = [/^notes\./, /^index\./, /^ct\./, /^flows\.[abc]\.(title|short|who|why)$/, /^flows\.[abc]\.s\d\.note$/];

export const isReviewerOnly = (key) => REVIEWER_ONLY.some((re) => re.test(key));

/** Flat list of leaf keys ("a.b.c"); arrays are leaves. */
export function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** Keys a translation must have: every English key except reviewer-only ones. */
export const requiredKeys = (en) => flatKeys(en).filter((k) => !isReviewerOnly(k));
