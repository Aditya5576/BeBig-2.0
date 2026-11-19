import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  createCorrelationId,
  jsonResponse,
  errorResponse,
  readBoundedJson,
} from "../_shared/security.ts";

const MAX_BODY_BYTES = 16 * 1024; // 16KB
const WGER_BASE_URL = "https://wger.de/api/v2";
const FETCH_TIMEOUT_MS = 10000;

// Permitted canonical open-source & public domain licenses
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

export const ALLOWED_LICENSES = Array.from(CANONICAL_ALLOWED_LICENSES);

export function isLicenseAllowed(licenseName: string | null | undefined): boolean {
  if (!licenseName || typeof licenseName !== 'string') return false;
  const normalized = licenseName.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return false;
  return CANONICAL_ALLOWED_LICENSES.has(normalized);
}

interface SyncOptions {
  limit?: number;
  offset?: number;
  category?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Reject non-POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. POST is required.', 405, corsHeaders);
  }

  const correlationId = createCorrelationId();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[sync-wger-catalog][${correlationId}] Missing Supabase environment config`);
      return errorResponse('Service temporarily unavailable.', 500, corsHeaders, correlationId);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Authenticate Caller:
    // Either X-Cron-Secret matches CRON_SECRET/service_role_key,
    // Or Bearer token is service_role_key,
    // Or Bearer token is a valid super_admin user.
    const customCronHeader = req.headers.get('X-Cron-Secret');
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    let isAuthorized = false;

    if (cronSecret && customCronHeader === cronSecret) {
      isAuthorized = true;
    } else if (bearerToken === supabaseServiceKey) {
      isAuthorized = true;
    } else if (bearerToken) {
      // Check if user is super_admin
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (!authError && user?.id) {
        const { data: adminRole } = await supabaseAdmin
          .from('admin_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        if (adminRole?.role === 'super_admin') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return errorResponse('Unauthorized: Valid cron secret or super_admin credential required.', 401, corsHeaders);
    }

    // 4. Parse optional options
    let options: SyncOptions = {};
    if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
      const parsedBody = await readBoundedJson<SyncOptions>(req, MAX_BODY_BYTES);
      if (parsedBody.ok) {
        options = parsedBody.data;
      }
    }

    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    // 5. Fetch Wger data with timeout
    const wgerUrl = new URL(`${WGER_BASE_URL}/exerciseinfo/`);
    wgerUrl.searchParams.set('limit', String(limit));
    wgerUrl.searchParams.set('offset', String(offset));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let wgerData: any = null;
    try {
      const wgerRes = await fetch(wgerUrl.toString(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!wgerRes.ok) {
        return errorResponse(`Wger API error: HTTP ${wgerRes.status}`, 502, corsHeaders, correlationId);
      }
      wgerData = await wgerRes.json();
    } finally {
      clearTimeout(timeout);
    }

    const rawResults = Array.isArray(wgerData?.results) ? wgerData.results : [];
    const validRows: Array<{
      wger_id: number;
      name: string;
      description: string;
      category: string;
      primary_muscles: string[];
      secondary_muscles: string[];
      equipment: string[];
      image_url: string | null;
      license_name: string;
      license_author: string;
      attribution_text: string;
      is_active: boolean;
      synced_at: string;
    }> = [];

    let skippedCount = 0;

    for (const item of rawResults) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'number') {
        skippedCount++;
        continue;
      }

      // Extract English or primary translation (Wger returns translations array, or exercises array)
      const translationsList = Array.isArray(item.translations)
        ? item.translations
        : Array.isArray(item.exercises)
          ? item.exercises
          : [];

      const primaryTranslation =
        translationsList.find((ex: any) => ex?.language === 2 || ex?.language?.id === 2) ||
        translationsList.find((ex: any) => ex?.name) ||
        translationsList[0] ||
        null;

      const rawName = primaryTranslation?.name || item.name;
      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
        skippedCount++;
        continue;
      }

      // Strict Canonical Licensing Check (never infer from author presence)
      // Licenses must be an explicit, non-empty string on license_object or license
      const rawLicenseName =
        (typeof item.license_object?.full_name === 'string' && item.license_object.full_name.trim()) ||
        (typeof item.license_object?.short_name === 'string' && item.license_object.short_name.trim()) ||
        (typeof item.license?.full_name === 'string' && item.license.full_name.trim()) ||
        (typeof item.license?.short_name === 'string' && item.license.short_name.trim()) ||
        null;

      if (!rawLicenseName || !isLicenseAllowed(rawLicenseName)) {
        // Reject missing, null, blank, or non-allowlisted / proprietary exercise records
        skippedCount++;
        continue;
      }

      const rawLicenseAuthor =
        (typeof item.license_author === 'string' && item.license_author.trim()) ||
        (typeof item.license_object?.author === 'string' && item.license_object.author.trim()) ||
        'Wger Community Contributors';

      // Safe clean category
      const categoryName = item.category?.name
        ? String(item.category.name).trim().toLowerCase()
        : 'other';

      // Primary & secondary muscles
      const primaryMuscles = Array.isArray(item.muscles)
        ? item.muscles.map((m: any) => m.name_en || m.name).filter(Boolean)
        : [];
      const secondaryMuscles = Array.isArray(item.muscles_secondary)
        ? item.muscles_secondary.map((m: any) => m.name_en || m.name).filter(Boolean)
        : [];

      // Equipment
      const equipment = Array.isArray(item.equipment)
        ? item.equipment.map((eq: any) => eq.name).filter(Boolean)
        : [];

      // Safe static image
      const primaryImage = Array.isArray(item.images)
        ? item.images.find((img: any) => img.is_main) || item.images[0]
        : null;

      const imageUrl =
        primaryImage?.image && typeof primaryImage.image === 'string' && !primaryImage.image.toLowerCase().endsWith('.gif')
          ? primaryImage.image
          : null;

      const cleanDescription = (primaryTranslation?.description || item.description || '')
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .trim();

      const attributionText = `Exercise data provided by Wger.de under ${rawLicenseName} by ${rawLicenseAuthor}.`;

      validRows.push({
        wger_id: item.id,
        name: rawName.trim(),
        description: cleanDescription,
        category: categoryName,
        primary_muscles: primaryMuscles,
        secondary_muscles: secondaryMuscles,
        equipment: equipment,
        image_url: imageUrl,
        license_name: rawLicenseName,
        license_author: rawLicenseAuthor,
        attribution_text: attributionText,
        is_active: true,
        synced_at: new Date().toISOString(),
      });
    }

    // 6. Upsert batch into Supabase
    let upsertedCount = 0;
    if (validRows.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('wger_exercise_catalog')
        .upsert(validRows, { onConflict: 'wger_id' });

      if (upsertError) {
        console.error(`[sync-wger-catalog][${correlationId}] Upsert error:`, upsertError);
        return errorResponse('Failed to persist synced catalog records.', 500, corsHeaders, correlationId);
      }
      upsertedCount = validRows.length;
    }

    return jsonResponse(
      {
        ok: true,
        synced_count: upsertedCount,
        skipped_count: skippedCount,
        total_processed: rawResults.length,
        has_more: Boolean(wgerData?.next),
        next_offset: wgerData?.next ? offset + limit : null,
      },
      200,
      corsHeaders
    );
  } catch (err: any) {
    console.error(`[sync-wger-catalog][${correlationId}] Unexpected failure:`, err);
    return errorResponse(err?.message || 'Internal server error', 500, corsHeaders, correlationId);
  }
});
