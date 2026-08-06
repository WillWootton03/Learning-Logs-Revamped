/**
 * Fuzzy search helpers for list filtering (e.g. the All Concepts page).
 *
 * Fuzzy here means character-tolerant: the query doesn't have to be an exact
 * substring — its characters just need to appear in order in the text, so
 * typos, dropped letters, and out-of-order input still hit. Plain substring
 * matches are a subset of this behavior.
 */

/** Normalize text for matching: trim, lowercase, collapse whitespace. */
function normalize(value: string): string {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Fuzzy match — every character of the query appears in the text in order
 * (a subsequence). An empty query matches everything.
 * @param query - The user's search input.
 * @param text - The text to search (e.g. a concept's prompt or answer).
 * @returns True when the query fuzzy-matches the text.
 */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = normalize(query);
  const t = normalize(text);
  if (!q) return true;
  if (q.length > t.length) return false;

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) qi += 1;
  }
  return qi === q.length;
}
