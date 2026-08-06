/**
 * Answer-matching helpers for the quiz engine.
 *
 * Lenient matching (per design): an answer counts as correct if it is an
 * exact match after normalization, or a close-enough fuzzy match (minor
 * typos still count).
 */

/**
 * Normalize an answer for comparison: trim, lowercase, collapse whitespace.
 * @param {string} value
 * @returns {string}
 */
function normalize(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Classic Levenshtein edit distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
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

/**
 * Fuzzy tolerance: allow up to 20% of the answer length in edits, with a
 * floor of 1 edit so short answers still tolerate a single typo.
 * @param {string} answer - Normalized reference answer.
 * @returns {number}
 */
function tolerance(answer) {
  return Math.max(1, Math.floor(answer.length * 0.2));
}

/**
 * Lenient match: exact (normalized) or within edit-distance tolerance.
 * @param {string} answer - Reference answer.
 * @param {string} submitted - The user's typed response.
 * @returns {boolean}
 */
function isLenientMatch(answer, submitted) {
  const a = normalize(answer);
  const b = normalize(submitted);
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;
  return levenshtein(a, b) <= tolerance(a);
}

/**
 * Exact match: both sides must be identical after normalization (trim,
 * lowercase, whitespace-collapsed). No typo tolerance.
 * @param {string} answer - Reference answer.
 * @param {string} submitted - The user's typed response.
 * @returns {boolean}
 */
function isExactMatch(answer, submitted) {
  return normalize(answer) === normalize(submitted);
}

module.exports = { normalize, levenshtein, isLenientMatch, isExactMatch };
