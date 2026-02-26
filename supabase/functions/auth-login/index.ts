// ==================================================================================
// 🔐 EDGE FUNCTION: auth-login
// ==================================================================================
// Endpoint: POST /functions/v1/auth-login
// Autenticação segura de staff com validação de senha (bcrypt) no backend
// ==================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { compareSync, hashSync } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Tipos
interface LoginRequest {
  username: string
  password: string
  condoId: string
}

interface StaffRecord {
  id: number
  condo_id: string
  name: string
  username: string
  password: string
  role: 'admin' | 'sindico' | 'porteiro'
  is_active: boolean
  created_at: string
}

interface CondoRecord {
  id: string
  name: string
  slug: string | null
  plan_type: string
  staff_limit: number
  unit_limit: number
  is_active: boolean
  trial_end_date: string | null
  subscription_status: string
  created_at: string
  updated_at: string
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { username, password, condoId }: LoginRequest = await req.json()

    // Validação
    if (!username || !password || !condoId) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: username, password, condoId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cliente Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Buscar condomínio
    const { data: condoData, error: condoError } = await supabaseAdmin
      .from('condos')
      .select('*')
      .eq('id', condoId.trim())
      .single()

    if (condoError || !condoData) {
      return new Response(
        JSON.stringify({ error: 'Condomínio não encontrado.', code: 'CONDO_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const condo = condoData as CondoRecord

    // 2. Verificar status do condomínio
    const now = new Date()
    let condoStatus: 'active' | 'expired' | 'inactive' | 'past_due' = 'active'
    
    if (condo.is_active === false) {
      condoStatus = 'inactive'
    } else if (condo.subscription_status === 'past_due') {
      condoStatus = 'past_due'
    } else if (condo.subscription_status === 'canceled') {
      condoStatus = 'inactive'
    } else if (condo.trial_end_date && now > new Date(condo.trial_end_date)) {
      // Trial expirado e não tem assinatura ativa
      if (condo.subscription_status !== 'active') {
        condoStatus = 'expired'
      }
    }

    // 3. Buscar staff
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, condo_id, name, username, password, role, is_active, created_at')
      .eq('username', username.trim().toLowerCase())
      .eq('condo_id', condoId.trim())
      .single()

    if (staffError || !staffData) {
      console.log(`[auth-login] Usuário não encontrado: ${username} no condo ${condoId}`)
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado neste condomínio.', code: 'USER_NOT_FOUND' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const staff = staffData as StaffRecord

    // Verificar se staff está ativo
    if (staff.is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Usuário desativado. Contate o administrador.', code: 'USER_INACTIVE' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Validar senha
    // Usa bcrypt diretamente (não depende de RPCs do banco)
    // Suporta: senhas hasheadas ($2...) e senhas legadas em texto plano
    let isPasswordValid = false
    let needsMigration = false

    if (staff.password.startsWith('$2')) {
      // Senha já está hasheada - verificar com bcrypt
      try {
        isPasswordValid = compareSync(password, staff.password)
      } catch (bcryptError) {
        console.error('[auth-login] Erro ao verificar bcrypt:', bcryptError)
        isPasswordValid = false
      }
    } else {
      // Senha legada em texto plano
      isPasswordValid = staff.password === password
      if (isPasswordValid) {
        needsMigration = true
      }
    }

    if (!isPasswordValid) {
      console.log(`[auth-login] Senha incorreta para: ${username}`)
      return new Response(
        JSON.stringify({ error: 'Senha incorreta.', code: 'INVALID_PASSWORD' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Migrar senha legada para bcrypt
    if (needsMigration) {
      try {
        const hashResult = hashSync(password)
        const { error: updateError } = await supabaseAdmin
          .from('staff')
          .update({ password: hashResult })
          .eq('id', staff.id)

        if (!updateError) {
          console.log(`[auth-login] Senha migrada para bcrypt: ${username}`)
        } else {
          console.error('[auth-login] Erro ao salvar hash:', updateError)
        }
      } catch (migrationError) {
        console.error('[auth-login] Erro na migração de senha:', migrationError)
        // Não bloqueia login se migração falhar
      }
    }

    // 6. Atualizar last_login_at
    await supabaseAdmin
      .from('staff')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', staff.id)

    // 7. Registrar no audit_log
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        condo_id: condo.id,
        user_id: staff.id,
        action: 'login',
        entity: 'staff',
        entity_id: String(staff.id),
        after_data: { username: staff.username, role: staff.role }
      })

    // 8. Resposta de sucesso
    const userResponse = {
      id: staff.id,
      condo_id: staff.condo_id,
      name: staff.name,
      username: staff.username,
      role: staff.role,
      created_at: staff.created_at
    }

    console.log(`[auth-login] Login OK: ${username} (${staff.role}) - condo: ${condoId} - status: ${condoStatus}`)

    return new Response(
      JSON.stringify({
        success: true,
        user: userResponse,
        condo: {
          id: condo.id,
          name: condo.name,
          slug: condo.slug || null,
          plan_type: condo.plan_type,
          staff_limit: condo.staff_limit,
          unit_limit: condo.unit_limit,
          is_active: condo.is_active,
          trial_end_date: condo.trial_end_date,
          subscription_status: condo.subscription_status
        },
        condoStatus
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[auth-login] Erro:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
