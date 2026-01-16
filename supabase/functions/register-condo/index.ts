import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Valida apikey (anon key é permitida para registro público)
  const apikey = req.headers.get('apikey') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (!apikey) {
    return new Response(
      JSON.stringify({ error: 'API key não fornecida' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const {
      condoName,
      condoDocument,
      condoCep,
      condoStreet,
      condoNumber,
      condoComplement,
      condoNeighborhood,
      condoCity,
      condoState,
      adminName,
      adminEmail,
      adminPassword,
      planType = 'basic'
    } = await req.json()

    // Validações básicas
    if (!condoName || !adminEmail || !adminPassword || !adminName) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios não preenchidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gera UUID para o novo condomínio
    const newCondoId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Calcula trial_end_date (15 dias a partir de hoje)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 15)
    const trialEndDate = trialEnd.toISOString().split('T')[0]

    // Define limites por plano
    const planLimits: Record<string, { staff: number; units: number }> = {
      basic: { staff: 2, units: 50 },
      professional: { staff: 5, units: 150 },
      premium: { staff: 10, units: 9999 }
    }
    const limits = planLimits[planType] || planLimits.basic

    // Monta endereço completo
    const fullAddress = [
      condoStreet,
      condoNumber,
      condoComplement,
      condoNeighborhood,
      condoCity,
      condoState,
      condoCep
    ].filter(Boolean).join(', ')

    // 1. Cria o condomínio
    const { data: condoData, error: condoError } = await supabaseAdmin
      .from('condos')
      .insert([{
        id: newCondoId,
        name: condoName,
        plan_type: 'BASICO',
        staff_limit: limits.staff,
        unit_limit: limits.units,
        trial_end_date: trialEndDate,
        is_active: true,
        subscription_status: 'trial',
        created_at: now,
        updated_at: now,
        document_type: condoDocument?.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ',
        document_number: condoDocument?.replace(/\D/g, '') || null,
        address: fullAddress || null
      }])
      .select()
      .single()

    if (condoError) {
      console.error('[REGISTER] Erro ao criar condomínio:', condoError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar condomínio: ' + condoError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Hash da senha usando função do banco (se disponível) ou armazena plain text temporariamente
    // NOTA: Em produção, a senha será hasheada no primeiro login via Edge Function auth-login
    const passwordHash = adminPassword // Por enquanto armazena plain text (será migrado no primeiro login)

    // 3. Cria o admin
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .insert([{
        condo_id: newCondoId,
        name: adminName,
        username: adminEmail.toLowerCase().trim(),
        password: passwordHash,
        role: 'admin',
        is_active: true,
        created_at: now
      }])
      .select()
      .single()

    if (staffError) {
      console.error('[REGISTER] Erro ao criar admin:', staffError)
      // Rollback: Remove o condo criado
      await supabaseAdmin.from('condos').delete().eq('id', newCondoId)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar administrador: ' + staffError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Cria settings (opcional, pode falhar sem quebrar o fluxo)
    await supabaseAdmin
      .from('settings')
      .insert([{
        condo_id: newCondoId,
        condo_name: condoName,
        condo_address: fullAddress,
        condo_phone: '',
        created_at: now,
        updated_at: now
      }])
      .catch(err => console.warn('[REGISTER] Erro ao criar settings (não crítico):', err))

    // Sucesso
    return new Response(
      JSON.stringify({
        success: true,
        condoId: newCondoId,
        username: adminEmail.toLowerCase().trim(),
        trialEndDate,
        condoName
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[REGISTER] Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
