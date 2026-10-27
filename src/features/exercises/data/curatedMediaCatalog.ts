/**
 * BeBig 2.0 — Curated Exercise Demonstration Media Catalog
 *
 * Ground-truth repository of verified, licensed demonstration media
 * keyed strictly by canonical exercise IDs (e.g. 'seed-bench-press', 'wger_192').
 *
 * GOVERNANCE RULES:
 * 1. Mappings MUST use exact, stable exercise IDs as keys.
 * 2. Media MUST NOT be resolved by exercise display name alone.
 * 3. Every asset MUST have an individually verified author, source URL, and license.
 * 4. Assets MUST NOT be marked `isApproved: true` without explicit verification.
 * 5. Production catalog starts empty; asset curation and licensing validation
 *    is performed movement-by-movement in dedicated curation milestones.
 */

import { ExerciseDemonstration } from '../types';

export type CuratedMediaCatalog = Readonly<Record<string, ExerciseDemonstration>>;

/**
 * Production catalog of verified demonstration media.
 * Contains only individually audited, licensed, and approved assets.
 */
export const CURATED_EXERCISE_MEDIA_CATALOG: CuratedMediaCatalog = Object.freeze({});
