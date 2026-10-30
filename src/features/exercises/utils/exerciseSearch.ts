/**
 * BeBig 2.0 — Tolerant Exercise Search & Matching
 *
 * Lightweight, zero-dependency fuzzy matching and normalization utility for exercises.
 * Tolerates:
 * - Capitalization differences ("LAT PULLDOWN" vs "Lat Pulldown")
 * - Extra or missing spaces ("lat  pulldown", "lat pull down" vs "Lat Pulldown")
 * - Punctuation differences ("pull-up" vs "pull up", "t-bar row" vs "t bar row")
 * - Common typos & character transpositions ("lat pulldwon", "lat pul down")
 *
 * Exact and strong matches are strictly prioritized over fuzzy matches.
 */

import { Exercise } from '../types';

/**
 * Remove all non-alphanumeric characters and lowercase.
 * E.g. "Lat Pulldown" -> "latpulldown", "lat pull-down" -> "latpulldown"
 */
export function collapseString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize whitespace and remove punctuation.
 * E.g. "lat  pull-down" -> "lat pull down"
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute Damerau-Levenshtein distance between two strings using a flat typed buffer.
 * Handles insertions, deletions, substitutions, and adjacent transpositions with zero GC pressure.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const cols = bl + 1;
  const d = new Int32Array((al + 1) * cols);

  for (let i = 0; i <= al; i++) {
    d[i * cols] = i;
  }
  for (let j = 0; j <= bl; j++) {
    d[j] = j;
  }

  for (let i = 1; i <= al; i++) {
    const aChar = a.charCodeAt(i - 1);
    const iCols = i * cols;
    const prevICols = (i - 1) * cols;
    const prevPrevICols = (i - 2) * cols;

    for (let j = 1; j <= bl; j++) {
      const bChar = b.charCodeAt(j - 1);
      const cost = aChar === bChar ? 0 : 1;

      let min = d[prevICols + j] + 1; // deletion
      const insert = d[iCols + j - 1] + 1; // insertion
      if (insert < min) min = insert;
      const sub = d[prevICols + j - 1] + cost; // substitution
      if (sub < min) min = sub;

      // Transposition check
      if (
        i > 1 &&
        j > 1 &&
        aChar === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === bChar
      ) {
        const trans = d[prevPrevICols + j - 2] + 1;
        if (trans < min) min = trans;
      }

      d[iCols + j] = min;
    }
  }

  return d[al * cols + bl];
}

/**
 * Evaluates how well a query matches an exercise name.
 * Returns a score:
 * > 0: Match (higher is better)
 * 0: No match
 */
export function calculateExerciseMatchScore(targetName: string, query: string): number {
  const qTrim = query.trim().toLowerCase();
  const tTrim = targetName.trim().toLowerCase();

  if (!qTrim) return 1; // Empty query matches all

  // 1. Exact string match (case-insensitive)
  if (tTrim === qTrim) return 100;

  // 2. Exact prefix match
  if (tTrim.startsWith(qTrim)) return 90;

  // 3. Substring match
  if (tTrim.includes(qTrim)) return 80;

  // 4. Normalized space & punctuation match (e.g. "pull up" vs "pull-up")
  const normTarget = normalizeString(targetName);
  const normQuery = normalizeString(query);

  if (normTarget === normQuery) return 78;
  if (normTarget.startsWith(normQuery)) return 75;
  if (normTarget.includes(normQuery)) return 72;

  // 5. Collapsed match (spaces & punctuation completely removed)
  // E.g. "lat pull down" -> "latpulldown" matches "Lat Pulldown" -> "latpulldown"
  const colTarget = collapseString(targetName);
  const colQuery = collapseString(query);

  if (colTarget === colQuery) return 70;
  if (colTarget.startsWith(colQuery)) return 65;
  if (colTarget.includes(colQuery)) return 60;

  // 6. Token-by-token comparison
  const targetTokens = normTarget.split(' ').filter(Boolean);
  const queryTokens = normQuery.split(' ').filter(Boolean);

  if (queryTokens.length > 1) {
    let matchedTokens = 0;
    for (const qToken of queryTokens) {
      const match = targetTokens.some((tToken) => {
        if (tToken === qToken || tToken.startsWith(qToken)) return true;
        // Allow 1 typo for tokens of length >= 4
        if (qToken.length >= 4 && damerauLevenshtein(tToken, qToken) <= 1) return true;
        return false;
      });
      if (match) matchedTokens++;
    }

    if (matchedTokens === queryTokens.length) {
      return 55;
    }
  }

  // 7. Damerau-Levenshtein distance for small typos and transpositions
  // E.g. "lat pulldwon" vs "latpulldown" (distance 1 transposition)
  // "lat pul down" -> "latpuldown" vs "latpulldown" (distance 1 deletion)
  if (colQuery.length >= 5) {
    const maxAllowedDist = colQuery.length >= 9 ? 2 : 1;

    // Direct collapsed distance
    const dist = damerauLevenshtein(colTarget, colQuery);
    if (dist <= maxAllowedDist) {
      return 50 - dist * 5; // 45 for dist 1, 40 for dist 2
    }

    // Direct token distance check against individual words (e.g. target "Barbell Lat Pulldown", query "pulldwon")
    for (const tToken of targetTokens) {
      if (Math.abs(tToken.length - normQuery.length) <= maxAllowedDist) {
        const tokenDist = damerauLevenshtein(tToken, normQuery);
        if (tokenDist <= maxAllowedDist) {
          return 45 - tokenDist * 5;
        }
      }
    }
  }

  return 0; // No match
}

export interface ScoredExercise {
  exercise: Exercise;
  score: number;
}

/**
 * Filters and ranks a list of exercises against a search query using tolerant matching.
 * Exact and strong matches appear first; weak or unrelated items are excluded.
 */
export function filterAndRankExercises(
  exercises: Exercise[],
  query?: string,
  category?: string,
): Exercise[] {
  if (!query || !query.trim()) {
    if (!category || category === 'all') {
      return exercises;
    }
    return exercises.filter((ex) => ex.category === category);
  }

  const q = query.trim();
  const scored: ScoredExercise[] = [];

  for (const ex of exercises) {
    if (category && category !== 'all' && ex.category !== category) {
      continue;
    }

    // 1. Primary score based on exercise name
    let score = calculateExerciseMatchScore(ex.name, q);

    // 2. Secondary fallback: check description, category, and muscles
    if (score === 0) {
      const qLower = q.toLowerCase();
      const descMatch = ex.description ? ex.description.toLowerCase().includes(qLower) : false;
      const catMatch = ex.categoryName ? ex.categoryName.toLowerCase().includes(qLower) : false;
      const muscleMatch = ex.primaryMuscles
        ? ex.primaryMuscles.some((m) => m.name.toLowerCase().includes(qLower))
        : false;

      if (descMatch || catMatch || muscleMatch) {
        score = 15; // Low score ensures name matches always rank above metadata
      }
    }

    if (score > 0) {
      scored.push({ exercise: ex, score });
    }
  }

  // Sort descending by score; preserve relative order for ties
  scored.sort((a, b) => b.score - a.score);

  return scored.map((item) => item.exercise);
}
