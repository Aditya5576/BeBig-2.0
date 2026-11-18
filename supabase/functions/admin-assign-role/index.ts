import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  createCorrelationId,
  jsonResponse,
  errorResponse,
  readBoundedJson,
  UUID_REGEX,
  VALID_ADMIN_ROLES,
  ValidAdminRole,
} from "../_shared/security.ts";

const MAX_BODY_BYTES = 16 * 1024; // 16KB

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // 1. CORS Preflight (allowlisted origins only — no wildcard *)
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
      console.error(`[admin-assign-role][${correlationId}] Missing Supabase environment config`);
      return errorResponse('Service temporarily unavailable.', 500, corsHeaders, correlationId);
    }

    // 3. Create service-role admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 4. Extract and verify JWT caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return errorResponse('Missing authorization header.', 401, corsHeaders);
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user || !user.id) {
      return errorResponse('Unauthorized: Invalid or expired token.', 401, corsHeaders);
    }

    // 5. Verify caller is a super_admin
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !callerRole || callerRole.role !== 'super_admin') {
      return errorResponse('Forbidden: Requires super_admin privilege.', 403, corsHeaders);
    }

    // 6. Parse and validate bounded JSON payload
    const parsed = await readBoundedJson<{
      target_user_id?: unknown;
      role?: unknown;
      action?: unknown;
    }>(req, MAX_BODY_BYTES);

    if (!parsed.ok) {
      return errorResponse(parsed.error, parsed.status, corsHeaders);
    }

    const { target_user_id, role, action } = parsed.data;

    if (typeof target_user_id !== 'string' || !UUID_REGEX.test(target_user_id)) {
      return errorResponse('Invalid target_user_id: must be a valid UUID.', 400, corsHeaders);
    }

    if (action !== 'assign' && action !== 'remove') {
      return errorResponse('Invalid action: must be "assign" or "remove".', 400, corsHeaders);
    }

    let validatedRole: ValidAdminRole | null = null;
    if (action === 'assign') {
      if (
        typeof role !== 'string' ||
        !(VALID_ADMIN_ROLES as readonly string[]).includes(role)
      ) {
        return errorResponse('Invalid role specified.', 400, corsHeaders);
      }
      validatedRole = role as ValidAdminRole;
    }

    // 7. Enforce self-mutation safety before hitting DB (AUD-019)
    if (
      target_user_id === user.id &&
      (action === 'remove' || validatedRole !== 'super_admin')
    ) {
      return errorResponse(
        'Super admins cannot demote or remove their own super_admin privilege.',
        400,
        corsHeaders
      );
    }

    // 8. Execute atomic role mutation + last-super-admin guard + audit log via RPC (AUD-019)
    const { error: rpcError } = await supabaseAdmin.rpc('admin_mutate_role_atomic', {
      p_actor_id: user.id,
      p_target_user_id: target_user_id,
      p_action: action,
      p_role: validatedRole,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('CANNOT_REMOVE_LAST_SUPER_ADMIN')) {
        return errorResponse(
          'Cannot remove or demote the last remaining super_admin.',
          409,
          corsHeaders
        );
      }
      if (msg.includes('SELF_DEMOTION_FORBIDDEN')) {
        return errorResponse(
          'Super admins cannot demote or remove their own super_admin privilege.',
          400,
          corsHeaders
        );
      }
      if (msg.includes('TARGET_NOT_FOUND')) {
        return errorResponse('Target user not found.', 404, corsHeaders);
      }
      if (msg.includes('FORBIDDEN')) {
        return errorResponse('Forbidden: Requires super_admin privilege.', 403, corsHeaders);
      }

      console.error(`[admin-assign-role][${correlationId}] RPC error:`, msg);
      return errorResponse(
        'Failed to update role. Please try again later.',
        500,
        corsHeaders,
        correlationId
      );
    }

    return jsonResponse(
      {
        success: true,
        message: `Successfully executed ${action}.`,
      },
      200,
      corsHeaders
    );
  } catch (err: unknown) {
    console.error(
      `[admin-assign-role][${correlationId}] Unexpected error:`,
      err instanceof Error ? err.message : 'unknown'
    );
    return errorResponse(
      'An unexpected server error occurred.',
      500,
      corsHeaders,
      correlationId
    );
  }
});
