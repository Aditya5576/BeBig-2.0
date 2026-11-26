/**
 * BeBig 2.0 — Tolerant Exercise Search & Matching
 *
 * Lightweight, zero-dependency fuzzy matching, gym-synonym expansion, and normalization utility.
 * Tolerates:
 * - Capitalization, extra spaces, and punctuation differences ("pull-up" vs "pull up")
 * - Whole-token gym aliases ("bi"/"bicep"/"biceps", "tri"/"tricep"/"triceps", "db"/"dumbbell",
 *   "bb"/"barbell", "lat"/"latissimus", "delt"/"deltoid")
 * - Phrase expansions ("rdl" -> "romanian deadlift", "ohp" -> "overhead press")
 * - Order-independent multi-word matching ("curl bi" -> "Bicep Curl" / "Dumbbell Bicep Curl")
 * - Bounded Damerau-Levenshtein typos (1 edit for >=4 chars, 2 edits for >=6 chars, e.g. "biseps", "bicp")
 *
 * Exact and strong matches are strictly prioritized over fuzzy matches.
 */

import { Exercise } from '../types';
import { TREADMILL_EXERCISE_ID } from '../exerciseTracking';

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

const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['bi', 'bicep', 'biceps'],
  ['tri', 'tricep', 'triceps'],
  ['db', 'dumbbell', 'dumbbells'],
  ['bb', 'barbell', 'barbells'],
  ['lat', 'latissimus'],
  ['delt', 'delts', 'deltoid', 'deltoids'],
];

const SYNONYM_LOOKUP = new Map<string, readonly string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const token of group) {
    SYNONYM_LOOKUP.set(token, group);
  }
}

const PHRASE_EXPANSIONS: Record<string, readonly string[]> = {
  rdl: ['romanian', 'deadlift'],
  ohp: ['overhead', 'press'],
};

function getTokenVariants(token: string): readonly string[] {
  return SYNONYM_LOOKUP.get(token) || [token];
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

function scoreTokenAgainstTargets(
  qToken: string,
  targetTokens: readonly string[],
): number {
  const variants = getTokenVariants(qToken);
  let best = 0;

  for (const tToken of targetTokens) {
    for (const variant of variants) {
      const isDirect = variant === qToken;
      if (tToken === variant) {
        best = Math.max(best, isDirect ? 30 : 27);
        continue;
      }
      if (variant.length >= 2 && tToken.startsWith(variant)) {
        best = Math.max(best, isDirect ? 22 : 20);
        continue;
      }
      if (variant.length >= 3 && tToken.includes(variant)) {
        best = Math.max(best, isDirect ? 16 : 14);
        continue;
      }

      // Bounded edit-distance check: 1 edit for >=4 chars, 2 edits for >=6 chars
      const maxEdits = variant.length >= 6 ? 2 : variant.length >= 4 ? 1 : 0;
      if (maxEdits > 0 && Math.abs(tToken.length - variant.length) <= maxEdits) {
        const dist = damerauLevenshtein(tToken, variant);
        if (dist <= maxEdits) {
          const fuzzyScore = 13 - dist * 4; // 9 for dist=1, 5 for dist=2
          best = Math.max(best, isDirect ? fuzzyScore : fuzzyScore - 1);
        }
      }
    }
  }

  return best;
}

/**
 * Evaluates a query token list (including phrase expansions) against targetTokens.
 * Requires ALL query token groups to match in any order.
 */
function scoreTokenGroupsAgainstTargets(
  queryTokens: readonly string[],
  targetTokens: readonly string[],
): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  let totalScore = 0;
  let matchedGroups = 0;

  for (const qToken of queryTokens) {
    const phraseWords = PHRASE_EXPANSIONS[qToken];
    if (phraseWords) {
      // Match either literal abbreviation token (e.g. "rdl") OR all expanded phrase tokens ("romanian", "deadlift")
      const directScore = scoreTokenAgainstTargets(qToken, targetTokens);
      let expandedSum = 0;
      let allPhraseMatched = true;
      for (const word of phraseWords) {
        const wordScore = scoreTokenAgainstTargets(word, targetTokens);
        if (wordScore === 0) {
          allPhraseMatched = false;
          break;
        }
        expandedSum += wordScore;
      }
      const groupScore = Math.max(
        directScore,
        allPhraseMatched ? Math.round(expandedSum / phraseWords.length) + 4 : 0,
      );
      if (groupScore === 0) return 0;
      totalScore += groupScore;
      matchedGroups++;
    } else {
      const groupScore = scoreTokenAgainstTargets(qToken, targetTokens);
      if (groupScore === 0) return 0;
      totalScore += groupScore;
      matchedGroups++;
    }
  }

  const avgTokenScore = totalScore / matchedGroups;
  // Reward concise canonical names (fewer extra unmatched tokens)
  const extraTokenPenalty = Math.min(8, Math.max(0, targetTokens.length - matchedGroups) * 1.5);
  return Math.max(1, Math.round(45 + avgTokenScore - extraTokenPenalty));
}

/**
 * Evaluates how well a query matches an exercise name.
 * Returns a score:
 * > 0: Match (higher is better)
 * 0: No match
 */
export function calculateExerciseMatchScore(
  targetName: string,
  query: string,
  precomputed?: { normName: string; colName: string; nameTokens: readonly string[] },
): number {
  const qTrim = query.trim().toLowerCase();
  const tTrim = targetName.trim().toLowerCase();

  if (!qTrim) return 1; // Empty query matches all

  // 1. Exact string match (case-insensitive)
  if (tTrim === qTrim) return 120;

  // 2. Exact prefix match
  if (tTrim.startsWith(qTrim)) return 105;

  // 3. Substring match
  if (tTrim.includes(qTrim)) return 92;

  // 4. Normalized space & punctuation match (e.g. "pull up" vs "pull-up")
  const normTarget = precomputed ? precomputed.normName : normalizeString(targetName);
  const normQuery = normalizeString(query);

  if (normTarget === normQuery) return 90;
  if (normTarget.startsWith(normQuery)) return 86;
  if (normTarget.includes(normQuery)) return 82;

  // 5. Collapsed match (spaces & punctuation completely removed)
  const colTarget = precomputed ? precomputed.colName : collapseString(targetName);
  const colQuery = collapseString(query);

  if (colTarget === colQuery) return 80;
  if (colTarget.startsWith(colQuery)) return 76;
  if (colTarget.includes(colQuery)) return 72;

  // 6. Token-group comparison (gym aliases, phrase expansions, order-independent & bounded typos)
  const targetTokens = precomputed ? precomputed.nameTokens : normTarget.split(' ').filter(Boolean);
  const queryTokens = normQuery.split(' ').filter(Boolean);

  if (queryTokens.length > 0) {
    const tokenGroupScore = scoreTokenGroupsAgainstTargets(queryTokens, targetTokens);
    if (tokenGroupScore > 0) {
      return tokenGroupScore;
    }
  }

  // 7. Whole-string collapsed Damerau-Levenshtein fallback (e.g. "lat pulldwon" vs "latpulldown")
  if (colQuery.length >= 4) {
    const maxAllowedDist = colQuery.length >= 6 ? 2 : 1;
    if (Math.abs(colTarget.length - colQuery.length) <= maxAllowedDist) {
      const dist = damerauLevenshtein(colTarget, colQuery);
      if (dist <= maxAllowedDist) {
        return 50 - dist * 5;
      }
    }
  }

  return 0;
}

interface CachedExerciseProjection {
  revisionKey: string;
  normName: string;
  colName: string;
  nameTokens: string[];
  allTokens: string[];
}

const projectionCache = new WeakMap<Exercise, CachedExerciseProjection>();

function getExerciseProjection(ex: Exercise): CachedExerciseProjection {
  const revisionKey = `${ex.id}::${ex.name || ''}::${ex.updatedAt || ''}`;
  const existing = projectionCache.get(ex);
  if (existing && existing.revisionKey === revisionKey) {
    return existing;
  }

  const normName = normalizeString(ex.name || '');
  const colName = collapseString(ex.name || '');
  const nameTokens = normName.split(' ').filter(Boolean);

  const metaString = `${ex.name || ''} ${ex.categoryName || ''} ${(ex.equipment || [])
    .map((eq) => (typeof eq === 'string' ? eq : eq?.name || ''))
    .join(' ')} ${(ex.primaryMuscles || [])
    .map((m) => (typeof m === 'string' ? m : m?.name || ''))
    .join(' ')}`;
  const allTokens = normalizeString(metaString).split(' ').filter(Boolean);

  const projected: CachedExerciseProjection = {
    revisionKey,
    normName,
    colName,
    nameTokens,
    allTokens,
  };
  projectionCache.set(ex, projected);
  return projected;
}

export interface ScoredExercise {
  exercise: Exercise;
  score: number;
}

/**
 * Filters and ranks a list of exercises against a search query using tolerant matching.
 * Exact and strong matches appear first; weak or unrelated items are excluded.
 * Preserves canonical `seed-treadmill` priority when matching treadmill queries.
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
  const normQ = normalizeString(q);
  const qTokens = normQ.split(' ').filter(Boolean);
  const scored: ScoredExercise[] = [];

  for (const ex of exercises) {
    if (category && category !== 'all' && ex.category !== category) {
      continue;
    }

    const proj = getExerciseProjection(ex);

    // 1. Primary score based on exercise name
    let score = calculateExerciseMatchScore(ex.name, q, proj);

    // 2. Secondary fallback: check combined tokens (name + category + equipment + primaryMuscles) & description
    if (score === 0) {
      const metaScore = scoreTokenGroupsAgainstTargets(qTokens, proj.allTokens);
      if (metaScore > 0) {
        score = Math.max(15, Math.round(metaScore * 0.45));
      } else if (ex.description && ex.description.toLowerCase().includes(q.toLowerCase())) {
        score = 12;
      }
    }

    if (score > 0) {
      const isCanonicalTreadmill = ex.id === TREADMILL_EXERCISE_ID;
      const finalScore =
        (ex.isCustom ? score + 1 : score) +
        (isCanonicalTreadmill && q.toLowerCase().includes('tread') ? 200 : 0);
      scored.push({ exercise: ex, score: finalScore });
    }
  }

  // Sort descending by score; preserve relative order for ties
  scored.sort((a, b) => b.score - a.score);

  return scored.map((item) => item.exercise);
}
