// ==================================================================================
// 💳 EDGE FUNCTION: asaas-create-checkout
// ==================================================================================
// Endpoint: POST /functions/v1/asaas-create-checkout
// Objetivo: Criar cliente + assinatura recorrente no Asaas (BOLETO/PIX) e retornar invoiceUrl
//
// Secrets (Supabase):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - ASAAS_API_KEY
// - ASAAS_BASE_URL (opcional: https://sandbox.asaas.com/api/v3 | https://api.asaas.com/v3)
// - ASAAS_WEBHOOK_TOKEN (opcional, usado no webhook)
// ==================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type BillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD'

interface CreateCheckoutRequest {
  condoId: string
  condoName: string
  planKey: 'basic' | 'professional' | 'premium'
  billingType?: BillingType
  // dados opcionais do pagador (recomendado para produção)
  payer?: {
    name?: string
    email?: string
    phone?: string
    cpfCnpj?: string
  }
  successUrl?: string
  cancelUrl?: string
}

type Condo = {
  id: string
  name: string
  plan_type: string | null
  subscription_status: string | null
  staff_limit: number | null
  unit_limit: number | null
  is_active: boolean | null
  trial_end_date: string | null
  asaas_customer_id: string | null
}

type PlanRow = {
  name: string
  price_monthly: number
  staff_limit: number
  unit_limit: number
}

function getEnv(name: string) {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function asaasFetch(path: string, init: RequestInit) {
  const baseUrl = Deno.env.get('ASAAS_BASE_URL') || 'https://sandbox.asaas.com/api/v3'
  const apiKey = getEnv('ASAAS_API_KEY')

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
      ...(init.headers || {}),
    },
  })

  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.description || json?.message || text || 'Asaas error'
    throw new Error(`Asaas ${res.status}: ${msg}`)
  }

  return json
}

async function getFirstSubscriptionPayment(subscriptionId: string) {
  // Busca o primeiro pagamento gerado para a assinatura
  const data = await asaasFetch(`/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=1&offset=0`, {
    method: 'GET',
  })
  const first = data?.data?.[0]
  return first || null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as CreateCheckoutRequest
    const condoId = body.condoId?.trim()
    const planKey = body.planKey
    const condoName = body.condoName?.trim()
    const billingType: BillingType = body.billingType || 'PIX'

    if (!condoId || !planKey || !condoName) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: condoId, condoName, planKey' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Buscar condo
    const { data: condoData, error: condoError } = await supabaseAdmin
      .from('condos')
      .select('id, name, plan_type, subscription_status, staff_limit, unit_limit, is_active, trial_end_date, asaas_customer_id')
      .eq('id', condoId)
      .single()

    if (condoError || !condoData) {
      return new Response(JSON.stringify({ error: 'Condomínio não encontrado', code: 'CONDO_NOT_FOUND' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const condo = condoData as Condo

    // Buscar plano na tabela plans (schema atual do usuário: plan_name/price_mrr)
    const planName = planKey === 'basic' ? 'BÁSICO' : planKey === 'professional' ? 'PRO' : 'PREMIUM'
    const { data: planData, error: planError } = await supabaseAdmin
      .from('plans')
      .select('name, price_monthly, staff_limit, unit_limit')
      .eq('name', planName)
      .single()

    if (planError || !planData) {
      return new Response(JSON.stringify({ error: 'Plano não encontrado no banco', code: 'PLAN_NOT_FOUND' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const plan = planData as PlanRow

    // 1) Garantir customer no Asaas
    let asaasCustomerId = condo.asaas_customer_id
    if (!asaasCustomerId) {
      const payerName = body.payer?.name || condo.name || condoName
      const customer = await asaasFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: payerName,
          email: body.payer?.email,
          phone: body.payer?.phone,
          cpfCnpj: condo.document_number || body.payer?.documentNumber || '12345678000199', // CNPJ padrão para teste
          cpfCnpj: body.payer?.cpfCnpj,
          externalReference: condoId,
        }),
      })

      asaasCustomerId = customer?.id
      if (!asaasCustomerId) throw new Error('Asaas customer id missing')

      await supabaseAdmin
        .from('condos')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', condoId)
    }

    // 2) Criar assinatura recorrente (mensal) BOLETO/PIX
    const nextDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) // yyyy-mm-dd
    const subscription = await asaasFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType,
        value: Number(plan.price_monthly),
        cycle: 'MONTHLY',
        nextDueDate,
        description: `CondoTrack ${planName} - condo ${condoId}`,
        externalReference: condoId,
      }),
    })

    const asaasSubscriptionId = subscription?.id
    if (!asaasSubscriptionId) throw new Error('Asaas subscription id missing')

    // Persistir subscription
    const { data: subRow, error: subInsertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        condo_id: condoId,
        plan_name: plan.name,
        status: 'trialing',
        asaas_subscription_id: asaasSubscriptionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (subInsertError) {
      // se já existir, só atualiza
      await supabaseAdmin
        .from('subscriptions')
        .update({
          plan_name: plan.name,
          status: 'trialing',
          asaas_subscription_id: asaasSubscriptionId,
          updated_at: new Date().toISOString(),
        })
        .eq('condo_id', condoId)
    }

    // 3) Buscar o primeiro pagamento da assinatura (para redirecionar)
    const firstPayment = await getFirstSubscriptionPayment(asaasSubscriptionId)
    const paymentId = firstPayment?.id || null
    const invoiceUrl = firstPayment?.invoiceUrl || firstPayment?.bankSlipUrl || firstPayment?.invoiceUrl

    // Persistir invoice (se existir payment)
    if (paymentId) {
      await supabaseAdmin.from('invoices').insert({
        condo_id: condoId,
        subscription_id: subRow?.id || null,
        asaas_payment_id: paymentId,
        amount_due: Number(plan.price_monthly),
        status: String(firstPayment?.status || 'open').toLowerCase(),
        invoice_url: invoiceUrl || null,
        created_at: new Date().toISOString(),
      })
    }

    // Atualizar condo para “em cobrança”
    await supabaseAdmin
      .from('condos')
      .update({
        plan_type: planKey,
        staff_limit: plan.staff_limit,
        unit_limit: plan.unit_limit,
        subscription_status: 'trial',
      })
      .eq('id', condoId)

    return new Response(JSON.stringify({
      success: true,
      url: invoiceUrl, // pode ser null se Asaas ainda não gerou pagamento
      subscriptionId: asaasSubscriptionId,
      paymentId,
      billingType,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[asaas-create-checkout] Error:', err)
    return new Response(JSON.stringify({ error: String(err?.message || err), code: 'ASAAS_CHECKOUT_ERROR' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

