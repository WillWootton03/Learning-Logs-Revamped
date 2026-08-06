/**
 * Answer-matching helpers for the quiz player.
 *
 * Mirrors the backend's scoring in backend/services/matching.js so the fill-in
 * reveal screen agrees with what the server records. An answer counts as
 * correct if it matches after normalization, or is within a small edit-distance
 * tolerance (minor typos still count).
 */

/** Normalize an answer for comparison: trim, lowercase, collapse whitespace. */
export function normalize(value: string): string {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Classic Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    const curr = new Array(b.length + 1);
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Allow up to 20% of the answer length in edits, with a floor of 1 edit. */
function tolerance(answer: string): number {
  return Math.max(1, Math.floor(answer.length * 0.2));
}

/** Lenient match: exact (normalized) or within edit-distance tolerance. */
export function isLenientMatch(answer: string, submitted: string): boolean {
  const a = normalize(answer);
  const b = normalize(submitted);
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;
  return levenshtein(a, b) <= tolerance(a);
}
