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

    // 6. Storage cleanup: Purge files in 'avatars' and 'exercise-photos' buckets
    for (const bucket of ['avatars', 'exercise-photos']) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          const filePaths = files.map((f: any) => `${userId}/${f.name}`);
          await supabaseAdmin.storage.from(bucket).remove(filePaths);
        }
      } catch (storageErr) {
        console.warn(`[delete-account] Storage cleanup warning for bucket ${bucket}:`, storageErr);
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
