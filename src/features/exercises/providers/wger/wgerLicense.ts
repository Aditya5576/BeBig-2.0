/**
 * BeBig 2.0 — Wger Licensing and Attribution Allowlist (Tier 2 High-ROI)
 *
 * Enforces strict IP and licensing compliance:
 * - Exact canonical set matching only.
 * - Rejects substring tricks (e.g. 'Not CC-BY-SA', 'Proprietary - CC-BY').
 * - Requires explicit canonical license string on every record; never infer from author.
 */

export const CANONICAL_ALLOWED_LICENSES = new Set<string>([
  'cc-by-sa 4.0',
  'cc-by-sa 3.0',
  'cc-by-sa 4',
  'cc-by-sa 3',
  'cc-by-sa',
  'cc-by 4.0',
  'cc-by 3.0',
  'cc-by 4',
  'cc-by 3',
  'cc-by',
  'cc0',
  'cc0 1.0',
  'public domain',
  'pd',
  'creative commons attribution-sharealike 4.0',
  'creative commons attribution-sharealike 3.0',
  'creative commons attribution-sharealike 4',
  'creative commons attribution-sharealike 3',
  'creative commons attribution share alike 4.0',
  'creative commons attribution share alike 3.0',
  'creative commons attribution share alike 4',
  'creative commons attribution share alike 3',
  'creative commons attribution 4.0',
  'creative commons attribution 3.0',
  'creative commons attribution 4',
  'creative commons attribution 3',
  'creative commons zero',
  'cc-by-sa-4.0',
  'cc-by-sa-3.0',
  'cc-by-sa-4',
  'cc-by-sa-3',
  'cc-by-4.0',
  'cc-by-3.0',
  'cc-by-4',
  'cc-by-3',
  'cc0-1.0',
]);

export function isLicenseAllowed(licenseName: string | null | undefined): boolean {
  if (!licenseName || typeof licenseName !== 'string') return false;
  const normalized = licenseName.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return false;
  return CANONICAL_ALLOWED_LICENSES.has(normalized);
}
