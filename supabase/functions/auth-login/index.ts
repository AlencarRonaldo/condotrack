// ==================================================================================
// EDGE FUNCTION: auth-login
// ==================================================================================
// Endpoint: POST /functions/v1/auth-login
// Autenticacao segura de staff com validacao de senha (bcrypt) no backend
// Login por email + senha (sem necessidade de informar ID do condominio)
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
  email?: string
  username?: string  // backward compat
  password: string
  condoId?: string   // ignorado - mantido para backward compat
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
    const body: LoginRequest = await req.json()

    // Aceitar email ou username (backward compat)
    const loginEmail = (body.email || body.username || '').trim().toLowerCase()
    const password = body.password

    // Validação
    if (!loginEmail || !password) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: email, password', code: 'MISSING_FIELDS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cliente Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Buscar staff por email (sem filtrar por condo_id)
    const { data: staffList, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, condo_id, name, username, password, role, is_active, created_at')
      .eq('username', loginEmail)

    if (staffError || !staffList || staffList.length === 0) {
      console.log(`[auth-login] Usuário não encontrado: ${loginEmail}`)
      return new Response(
        JSON.stringify({ error: 'E-mail não encontrado.', code: 'USER_NOT_FOUND' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Se múltiplas contas com mesmo email (não deveria acontecer com UNIQUE constraint)
    if (staffList.length > 1) {
      console.log(`[auth-login] Múltiplas contas para: ${loginEmail}`)
      return new Response(
        JSON.stringify({ error: 'Múltiplas contas encontradas. Contate o suporte.', code: 'MULTIPLE_ACCOUNTS' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const staff = staffList[0] as StaffRecord

    // Verificar se staff está ativo
    if (staff.is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Usuário desativado. Contate o administrador.', code: 'USER_INACTIVE' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar condomínio pelo condo_id do staff
    const { data: condoData, error: condoError } = await supabaseAdmin
      .from('condos')
      .select('*')
      .eq('id', staff.condo_id)
      .single()

    if (condoError || !condoData) {
      return new Response(
        JSON.stringify({ error: 'Condomínio não encontrado.', code: 'CONDO_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const condo = condoData as CondoRecord

    // 3. Verificar status do condomínio
    const now = new Date()
    let condoStatus: 'active' | 'expired' | 'inactive' | 'past_due' = 'active'

    if (condo.is_active === false) {
      condoStatus = 'inactive'
    } else if (condo.subscription_status === 'past_due') {
      condoStatus = 'past_due'
    } else if (condo.subscription_status === 'canceled') {
      condoStatus = 'inactive'
    } else if (condo.trial_end_date && now > new Date(condo.trial_end_date)) {
      if (condo.subscription_status !== 'active') {
        condoStatus = 'expired'
      }
    }

    // 4. Validar senha (bcrypt ou texto plano legado)
    let isPasswordValid = false
    let needsMigration = false

    if (staff.password.startsWith('$2')) {
      try {
        isPasswordValid = compareSync(password, staff.password)
      } catch (bcryptError) {
        console.error('[auth-login] Erro ao verificar bcrypt:', bcryptError)
        isPasswordValid = false
      }
    } else {
      isPasswordValid = staff.password === password
      if (isPasswordValid) {
        needsMigration = true
      }
    }

    if (!isPasswordValid) {
      console.log(`[auth-login] Senha incorreta para: ${loginEmail}`)
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
          console.log(`[auth-login] Senha migrada para bcrypt: ${loginEmail}`)
        } else {
          console.error('[auth-login] Erro ao salvar hash:', updateError)
        }
      } catch (migrationError) {
        console.error('[auth-login] Erro na migração de senha:', migrationError)
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

    console.log(`[auth-login] Login OK: ${loginEmail} (${staff.role}) - condo: ${staff.condo_id} - status: ${condoStatus}`)

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
