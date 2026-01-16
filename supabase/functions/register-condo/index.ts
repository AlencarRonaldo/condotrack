import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
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
    // Valida variáveis de ambiente críticas
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[REGISTER] Variáveis de ambiente não configuradas')
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor inválida' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse do body JSON com tratamento de erro
    let requestData
    try {
      requestData = await req.json()
    } catch (parseError) {
      console.error('[REGISTER] Erro ao parsear JSON:', parseError)
      return new Response(
        JSON.stringify({ error: 'Formato de requisição inválido. JSON esperado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
    } = requestData

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
    // Mapeia planType para valor correto da constraint (lowercase)
    const planTypeMap: Record<string, string> = {
      basic: 'basic',
      professional: 'professional',
      premium: 'premium'
    }
    const dbPlanType = planTypeMap[planType] || 'basic'

    const { data: condoData, error: condoError } = await supabaseAdmin
      .from('condos')
      .insert([{
        id: newCondoId,
        name: condoName,
        plan_type: dbPlanType,
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
      try {
        const { error: deleteError } = await supabaseAdmin
          .from('condos')
          .delete()
          .eq('id', newCondoId)
        
        if (deleteError) {
          console.error('[REGISTER] Erro ao fazer rollback (deletar condo):', deleteError)
        } else {
          console.log('[REGISTER] Rollback concluído: condomínio removido')
        }
      } catch (rollbackError) {
        console.error('[REGISTER] Erro crítico no rollback:', rollbackError)
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar administrador',
          details: staffError.message,
          code: staffError.code || 'STAFF_CREATION_ERROR'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Cria settings (opcional, pode falhar sem quebrar o fluxo)
    const { error: settingsError } = await supabaseAdmin
      .from('settings')
      .insert([{
        condo_id: newCondoId,
        condo_name: condoName,
        condo_address: fullAddress,
        condo_phone: '',
        created_at: now,
        updated_at: now
      }])
    
    if (settingsError) {
      // Log mas não quebra o fluxo (settings é opcional)
      console.warn('[REGISTER] Erro ao criar settings (não crítico):', settingsError)
    }

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
    
    // Log detalhado para debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('[REGISTER] Stack trace:', errorStack)
    console.error('[REGISTER] Error details:', {
      message: errorMessage,
      type: error?.constructor?.name,
      url: req.url,
      method: req.method
    })
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor ao processar registro',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
