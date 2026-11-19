import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  getCorsHeaders,
  createCorrelationId,
  readBoundedJson,
  errorResponse,
  jsonResponse,
} from "../_shared/security.ts"

const MAX_BODY_BYTES = 4 * 1024; // 4KB

/**
 * Recursively and paginatedly removes all files and subfolders under a given prefix in a bucket.
 * Throws on error so that account deletion aborts with HTTP 500 if files cannot be cleanly deleted (P1-02).
 */
async function deleteUserStorageFolder(
  adminClient: any,
  bucket: string,
  prefix: string
): Promise<void> {
  const PAGE_SIZE = 100;
  let folderOffset = 0;

  while (true) {
    const { data: items, error: listError } = await adminClient.storage
      .from(bucket)
      .list(prefix, {
        limit: PAGE_SIZE,
        offset: folderOffset,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (listError) {
      if (
        listError.message?.includes('not found') ||
        (listError as any).statusCode === 404 ||
        (listError as any).statusCode === '404'
      ) {
        return;
      }
      throw new Error(`Failed to list storage items in bucket "${bucket}" under "${prefix}": ${listError.message}`);
    }

    if (!items || items.length === 0) {
      break;
    }

    const filesToDelete: string[] = [];
    const subfolders: string[] = [];

    for (const item of items) {
      if (item.id === null || !item.id) {
        subfolders.push(`${prefix}/${item.name}`);
      } else {
        filesToDelete.push(`${prefix}/${item.name}`);
      }
    }

    if (filesToDelete.length > 0) {
      const { error: removeError } = await adminClient.storage
        .from(bucket)
        .remove(filesToDelete);

      if (removeError) {
        throw new Error(`Failed to remove files in bucket "${bucket}": ${removeError.message}`);
      }
    }

    // Only advance folderOffset by the count of folders that were NOT deleted,
    // because deleted files shift subsequent entries down to folderOffset (P1-02)!
    folderOffset += subfolders.length;

    // Recurse into every nested subfolder
    for (const subfolder of subfolders) {
      await deleteUserStorageFolder(adminClient, bucket, subfolder);
    }

    // If total items returned was less than PAGE_SIZE, all entries have been processed
    if (items.length < PAGE_SIZE) {
      break;
    }
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Reject non-POST methods with 405 Method Not Allowed (AUD-010)
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. POST is required.', 405, corsHeaders);
  }

  const correlationId = createCorrelationId();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse('Server misconfiguration', 500, corsHeaders, correlationId);
    }

    // 3. Create service role admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 4. Extract and verify JWT caller (AUD-006)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user || !user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Parse and validate bounded payload
    const parsed = await readBoundedJson<{ confirm?: unknown }>(req, MAX_BODY_BYTES);
    if (!parsed.ok) {
      return errorResponse(parsed.error, parsed.status, corsHeaders);
    }
    const body = parsed.data;

    if (body?.confirm !== 'DELETE_MY_ACCOUNT') {
      return errorResponse(
        'Missing or invalid confirmation: confirm must equal "DELETE_MY_ACCOUNT"',
        400,
        corsHeaders
      );
    }

    const userId = user.id;

    // 6. Storage cleanup: Recursively and paginatedly purge user files across all relevant buckets (P1-02)
    const storageBuckets = ['avatars', 'exercise-photos', 'exercise-demos'];
    for (const bucket of storageBuckets) {
      try {
        await deleteUserStorageFolder(supabaseAdmin, bucket, userId);
      } catch (storageErr: any) {
        console.error(`[delete-account][${correlationId}] Storage cleanup failed for bucket ${bucket}:`, storageErr);
        return errorResponse(
          `Failed to delete user media files from ${bucket}: ${storageErr?.message || 'Storage deletion error'}`,
          500,
          corsHeaders,
          correlationId
        );
      }
    }

    // 7. Explicit database cleanup across user tables
    await supabaseAdmin.from('workout_sessions').delete().eq('user_id', userId);
    await supabaseAdmin.from('workout_templates').delete().eq('user_id', userId);
    await supabaseAdmin.from('custom_exercises').delete().eq('user_id', userId);
    await supabaseAdmin.from('scheduled_workouts').delete().eq('user_id', userId);
    await supabaseAdmin.from('ai_usage_quotas').delete().eq('user_id', userId);
    await supabaseAdmin.from('admin_roles').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 8. Log audit trail in admin_audit_logs before deleting user
    try {
      await supabaseAdmin.from('admin_audit_logs').insert({
        actor_id: userId,
        action: 'DELETE_ACCOUNT',
        target_type: 'USER',
        target_id: userId,
        result: 'SUCCESS',
        metadata: {
          timestamp: new Date().toISOString(),
          email: user.email ? `${user.email.slice(0, 3)}***@***` : undefined,
        },
      });
    } catch (auditErr) {
      console.warn('[delete-account] Audit log insert error:', auditErr);
    }

    // 9. Delete user from auth.users via Supabase Admin API
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error(`[delete-account][${correlationId}] auth.admin.deleteUser error:`, deleteUserError);
      return errorResponse(
        'Failed to delete authentication credentials',
        500,
        corsHeaders,
        correlationId
      );
    }

    return jsonResponse(
      {
        success: true,
        message: 'Account, cloud storage, and database records successfully purged.',
        deleted_user_id: userId,
      },
      200,
      corsHeaders
    );
  } catch (error: unknown) {
    console.error(
      `[delete-account][${correlationId}] Unexpected exception:`,
      error instanceof Error ? error.message : 'unknown'
    );
    return errorResponse(
      'An unexpected server error occurred during account deletion.',
      500,
      corsHeaders,
      correlationId
    );
  }
});
