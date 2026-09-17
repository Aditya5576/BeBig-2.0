import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }})
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server misconfiguration')
    }

    // 1. Create a service role client to bypass RLS for administrative actions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 2. Extract JWT to verify caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // 3. Verify caller is a super_admin
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || !callerRole || callerRole.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Requires super_admin privilege' }), { status: 403 })
    }

    // 4. Parse payload
    const { target_user_id, role, action } = await req.json()
    
    if (!target_user_id || !action) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 })
    }

    // 5. Execute action (assign or remove)
    if (action === 'assign') {
      if (!role) return new Response(JSON.stringify({ error: 'Missing role for assignment' }), { status: 400 })
      
      const { error: upsertError } = await supabaseAdmin
        .from('admin_roles')
        .upsert({ user_id: target_user_id, role })
      
      if (upsertError) throw upsertError

      // Log the action
      await supabaseAdmin.from('admin_audit_logs').insert({
        actor_id: user.id,
        action: 'ASSIGN_ROLE',
        target_type: 'USER',
        target_id: target_user_id,
        result: 'SUCCESS',
        metadata: { role }
      })

    } else if (action === 'remove') {
      const { error: deleteError } = await supabaseAdmin
        .from('admin_roles')
        .delete()
        .eq('user_id', target_user_id)
      
      if (deleteError) throw deleteError

      // Log the action
      await supabaseAdmin.from('admin_audit_logs').insert({
        actor_id: user.id,
        action: 'REMOVE_ROLE',
        target_type: 'USER',
        target_id: target_user_id,
        result: 'SUCCESS'
      })
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
    }

    return new Response(
      JSON.stringify({ success: true, message: `Successfully executed ${action}` }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
