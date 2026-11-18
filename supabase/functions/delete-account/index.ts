import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = [
  'https://be-big-2-0.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'http://localhost:5173',
];

const VERCEL_PREVIEW_REGEX = /^https:\/\/be-big-[a-z0-9-]+-adityas-projects-[a-z0-9]+\.vercel\.app$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  let allowedOrigin = 'https://be-big-2-0.vercel.app';
  if (ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW_REGEX.test(origin)) {
    allowedOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Reject non-POST methods with 405 Method Not Allowed (AUD-010)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. POST is required.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // 5. Parse and validate payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body?.confirm !== 'DELETE_MY_ACCOUNT') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid confirmation: confirm must equal "DELETE_MY_ACCOUNT"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.error('[delete-account] auth.admin.deleteUser error:', deleteUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete authentication credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account, cloud storage, and database records successfully purged.',
        deleted_user_id: userId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[delete-account] Unexpected exception:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected server error occurred during account deletion.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
