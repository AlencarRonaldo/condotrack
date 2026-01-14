// ==================================================================================
// 🔔 EDGE FUNCTION: asaas-webhook
// ==================================================================================
// Endpoint: POST /functions/v1/asaas-webhook
// Objetivo: Processar eventos do Asaas e atualizar assinatura/condo
//
// Segurança:
// - Configure um token secreto no Asaas e valide via header (recomendado).
// - Armazena eventos em webhook_events para idempotência.
//
// Secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - ASAAS_WEBHOOK_TOKEN (opcional, mas recomendado)
// ==================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-asaas-token, asaas-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getEnv(name: string) {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function getWebhookToken(req: Request) {
  return (
    req.headers.get('x-asaas-token') ||
    req.headers.get('asaas-access-token') ||
    req.headers.get('x-webhook-token') ||
    ''
  )
}

function normalizeStatus(s: string | null | undefined) {
  const v = String(s || '').toUpperCase()
  // Asaas costuma usar: RECEIVED, CONFIRMED, PENDING, OVERDUE, REFUNDED, CANCELED...
  if (v === 'RECEIVED' || v === 'CONFIRMED') return 'active'
  if (v === 'OVERDUE') return 'past_due'
  if (v === 'CANCELED' || v === 'CANCELLED') return 'canceled'
  return 'trial'
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
    const expected = Deno.env.get('ASAAS_WEBHOOK_TOKEN') || ''
    if (expected) {
      const provided = getWebhookToken(req)
      if (!provided || provided !== expected) {
        return new Response(JSON.stringify({ error: 'Webhook token inválido' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const raw = await req.text()
    const payload = raw ? JSON.parse(raw) : {}

    const event = String(payload?.event || payload?.type || '')
    const payment = payload?.payment || payload?.data || payload?.object || null

    const paymentId = payment?.id || payload?.id || null
    const condoId = payment?.externalReference || payload?.externalReference || null

    // Idempotência: usa paymentId+event se não houver id do evento
    const eventId = String(payload?.id || (paymentId ? `${paymentId}:${event}` : `${Date.now()}:${event}`))

    const supabaseAdmin = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1) idempotência: se já processou, retorna 200
    const { data: existing } = await supabaseAdmin
      .from('webhook_events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle()

    if (existing?.id) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabaseAdmin.from('webhook_events').insert({
      id: eventId,
      event_type: event || 'unknown',
      payload,
    })

    if (!condoId) {
      // sem externalReference, não dá pra correlacionar tenant
      console.warn('[asaas-webhook] Missing externalReference/condoId', { eventId, event, paymentId })
      return new Response(JSON.stringify({ received: true, warning: 'missing_condo_id' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) Atualizar invoice local
    if (paymentId) {
      await supabaseAdmin.from('invoices').insert({
        condo_id: condoId,
        asaas_payment_id: paymentId,
        amount_due: payment?.value ?? null,
        amount_paid: payment?.netValue ?? null,
        status: String(payment?.status || '').toLowerCase() || null,
        invoice_url: payment?.invoiceUrl || payment?.bankSlipUrl || null,
        paid_at: payment?.paymentDate || payment?.confirmedDate || null,
        created_at: new Date().toISOString(),
      })
    }

    // 3) Atualizar status do condo/subscription
    const newStatus = normalizeStatus(payment?.status)

    const condoUpdate: Record<string, any> = {
      subscription_status: newStatus,
      is_active: newStatus === 'active',
      last_payment_date: newStatus === 'active' ? new Date().toISOString() : undefined,
      asaas_last_payment_id: paymentId || undefined,
    }
    // remove undefined
    Object.keys(condoUpdate).forEach(k => condoUpdate[k] === undefined && delete condoUpdate[k])

    await supabaseAdmin.from('condos').update(condoUpdate).eq('id', condoId)

    // Persistir subscriptionId se vier no payload
    const subscriptionId = payment?.subscription || payment?.subscriptionId || payload?.subscription?.id || null
    if (subscriptionId) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: newStatus === 'active' ? 'active' : newStatus,
          asaas_subscription_id: String(subscriptionId),
          updated_at: new Date().toISOString(),
        })
        .eq('condo_id', condoId)
    }

    // Auditoria
    await supabaseAdmin.from('audit_logs').insert({
      condo_id: condoId,
      user_id: null,
      action: 'asaas_webhook',
      entity: 'billing',
      entity_id: paymentId ? String(paymentId) : null,
      after_data: { event, paymentId, status: payment?.status, normalized: newStatus },
      created_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[asaas-webhook] Error:', err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

