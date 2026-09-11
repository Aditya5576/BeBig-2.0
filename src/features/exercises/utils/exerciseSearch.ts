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
 * Compute Damerau-Levenshtein distance between two strings.
 * Handles insertions, deletions, substitutions, and adjacent transpositions.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  // Optimize: single array or matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );

      // Transposition check
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[al][bl];
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

    // Sliding window check if query is a substring with small typo
    // E.g. target is "Barbell Lat Pulldown", query is "lat pulldwon"
    if (colTarget.length > colQuery.length) {
      const qLen = colQuery.length;
      for (let start = 0; start <= colTarget.length - qLen + 2; start++) {
        for (let len = Math.max(3, qLen - 1); len <= Math.min(colTarget.length - start, qLen + 1); len++) {
          const slice = colTarget.slice(start, start + len);
          const windowDist = damerauLevenshtein(slice, colQuery);
          if (windowDist <= maxAllowedDist) {
            return 45 - windowDist * 5;
          }
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
