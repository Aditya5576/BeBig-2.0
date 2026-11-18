import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Importing shared application logic from the secure deployment boundary
import { SecureEdgeGateway } from "../_shared/coach/server/edgeHandler.ts";
import { SupabaseCoachDataProvider } from "../_shared/coach/server/dataProvider.ts";
import { InMemoryUsageTracker } from "../_shared/coach/server/usageTracker.ts";
import { GeminiAdapter, GroqAdapter, CerebrasAdapter, CohereAdapter } from "../_shared/coach/server/adapters/index.ts";
import {
  getCorsHeaders,
  createCorrelationId,
  jsonResponse,
  errorResponse,
  readBoundedJson,
} from "../_shared/security.ts";

const MAX_BODY_BYTES = 32 * 1024; // 32KB payload cap (AUD-010)
const MAX_MESSAGE_CHARS = 4000;

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return errorResponse('Missing Authorization header.', 401, corsHeaders);
    }

    // 3. Authenticate user strictly via Supabase JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return errorResponse('Unauthorized.', 401, corsHeaders);
    }

    const verifiedUserId = user.id;

    // 4. Parse bounded JSON payload & enforce message size ceiling
    const parsed = await readBoundedJson<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!parsed.ok) {
      return errorResponse(parsed.error, parsed.status, corsHeaders);
    }
    const rawClientPayload = parsed.data;
    if (
      typeof rawClientPayload.message === 'string' &&
      rawClientPayload.message.length > MAX_MESSAGE_CHARS
    ) {
      return errorResponse('Message exceeds maximum allowed length.', 400, corsHeaders);
    }

    // 5. SEC-1B: Atomic Rate Limit Check (Fail-closed)
    const { data: quota, error: quotaError } = await supabaseClient.rpc('check_and_increment_ai_quota');
    if (quotaError) {
      console.error(`[coach-agent][${correlationId}] Quota error:`, quotaError.message);
      return jsonResponse(
        {
          type: 'error',
          message: 'Failed to verify usage quota. Please try again later.',
          correlation_id: correlationId,
        },
        500,
        corsHeaders
      );
    }

    if (!quota || !quota.allowed) {
      return jsonResponse(
        {
          type: 'error',
          message: 'Daily AI usage limit reached. Please try again tomorrow.',
          reset: '00:00 UTC',
        },
        429,
        corsHeaders
      );
    }

    // 6. Initialize dependencies passing securely authenticated Supabase client for RLS enforcement
    const dataProvider = new SupabaseCoachDataProvider(supabaseClient);
    const usageTracker = new InMemoryUsageTracker();

    // 7. Initialize Providers & M4B Architecture
    const gemini = new GeminiAdapter({ apiKey: Deno.env.get('GEMINI_API_KEY'), priority: 1, maxTokens: 1024 });
    const groq = new GroqAdapter({ apiKey: Deno.env.get('GROQ_API_KEY'), priority: 2, maxTokens: 1024 });
    const cerebras = new CerebrasAdapter({ apiKey: Deno.env.get('CEREBRAS_API_KEY'), priority: 3, maxTokens: 1024 });
    const cohere = new CohereAdapter({ apiKey: Deno.env.get('COHERE_API_KEY'), priority: 4, maxTokens: 1024 });

    const gateway = new SecureEdgeGateway(
      [gemini, groq, cerebras, cohere],
      usageTracker,
      dataProvider
    );

    // 8. Handle request securely
    const response = await gateway.handleInferenceRequest(rawClientPayload, verifiedUserId);

    // 9. Return standard CoachResponse
    return jsonResponse(response as unknown as Record<string, unknown>, 200, corsHeaders);
  } catch (error: unknown) {
    console.error(
      `[coach-agent][${correlationId}] Execution error:`,
      error instanceof Error ? error.message : 'unknown'
    );
    return jsonResponse(
      {
        type: 'error',
        message: 'Internal server error.',
        correlation_id: correlationId,
      },
      500,
      corsHeaders
    );
  }
});
