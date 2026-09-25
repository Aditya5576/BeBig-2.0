import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Importing shared application logic from the secure deployment boundary
import { SecureEdgeGateway } from "../_shared/coach/server/edgeHandler.ts";
import { SupabaseCoachDataProvider } from "../_shared/coach/server/dataProvider.ts";
import { InMemoryUsageTracker } from "../_shared/coach/server/usageTracker.ts";
import { GeminiAdapter, GroqAdapter, CerebrasAdapter, CohereAdapter } from "../_shared/coach/server/adapters/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // 1. Authenticate user strictly via Supabase JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const verifiedUserId = user.id;

    // 2. Parse payload
    const rawClientPayload = await req.json();

    // 3. SEC-1B: Atomic Rate Limit Check (Fail-closed)
    const { data: quota, error: quotaError } = await supabaseClient.rpc('check_and_increment_ai_quota');
    if (quotaError) {
      console.error('[coach-agent] Quota error:', quotaError.message);
      return new Response(JSON.stringify({ type: 'error', message: 'Failed to verify usage quota. Please try again later.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Fail-closed on database error
      });
    }

    if (!quota || !quota.allowed) {
      return new Response(JSON.stringify({ 
        type: 'error', 
        message: 'Daily AI usage limit reached. Please try again tomorrow.',
        reset: '00:00 UTC'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // 4. Initialize dependencies passing securely authenticated Supabase client for RLS enforcement
    const dataProvider = new SupabaseCoachDataProvider(supabaseClient);
    const usageTracker = new InMemoryUsageTracker();
    
    // 5. Initialize Providers & M4B Architecture
    const gemini = new GeminiAdapter({ apiKey: Deno.env.get('GEMINI_API_KEY'), priority: 1, maxTokens: 1024 });
    const groq = new GroqAdapter({ apiKey: Deno.env.get('GROQ_API_KEY'), priority: 2, maxTokens: 1024 });
    const cerebras = new CerebrasAdapter({ apiKey: Deno.env.get('CEREBRAS_API_KEY'), priority: 3, maxTokens: 1024 });
    const cohere = new CohereAdapter({ apiKey: Deno.env.get('COHERE_API_KEY'), priority: 4, maxTokens: 1024 });

    const gateway = new SecureEdgeGateway(
      [gemini, groq, cerebras, cohere], 
      usageTracker, 
      dataProvider
    );

    // 6. Handle request securely
    const response = await gateway.handleInferenceRequest(rawClientPayload, verifiedUserId);

    // 7. Return standard CoachResponse
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error(`[coach-agent] Execution error:`, error.message);
    return new Response(JSON.stringify({ type: 'error', message: 'Internal server error.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
