/**
 * Lightweight fuzzy matcher for the command palette (#146).
 * Returns a score (higher is better) or null when `query` is not a
 * subsequence of `text`. Consecutive runs and word starts score higher.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (!t) return null;

  const direct = t.indexOf(q);
  if (direct !== -1) {
    // Substring hit: strongly preferred, earlier is better.
    return 1000 - direct + (direct === 0 || /\W/.test(t[direct - 1]) ? 50 : 0);
  }

  let score = 0;
  let run = 0;
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti;
        ti++;
        break;
      }
      ti++;
      run = 0;
    }
    if (found === -1) return null;
    run++;
    score += 10 + run * 5;
    if (found === 0 || /\W/.test(t[found - 1])) score += 15;
  }
  return score;
}

/** Best score across several candidate fields, with the field that matched. */
export function bestFieldMatch(
  query: string,
  fields: Array<{ key: string; text?: string | null }>
): { score: number; key: string } | null {
  let best: { score: number; key: string } | null = null;
  for (const f of fields) {
    if (!f.text) continue;
    const score = fuzzyScore(query, f.text);
    if (score !== null && (!best || score > best.score)) best = { score, key: f.key };
  }
  return best;
}
