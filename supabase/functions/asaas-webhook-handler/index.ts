// ==================================================================================
// SUPABASE EDGE FUNCTION: asaas-webhook-handler
//
// Ponto de entrada para todos os webhooks enviados pelo Asaas.
// Segurança: validação HMAC-SHA256, idempotência, anti-replay, refund/chargeback.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - ASAAS_WEBHOOK_SECRET
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import crypto from 'node:crypto';

interface AsaasPaymentPayload {
  id: string;
  value: number;
  dateCreated: string;
}

interface AsaasWebhookPayload {
  event: string;
  payment: AsaasPaymentPayload;
  id: string;
}

// Domínios permitidos para CORS
const ALLOWED_ORIGINS = [
  'https://condotrack.vercel.app',
  'https://www.condotrack.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

// Limite anti-replay: rejeitar eventos com mais de 10 minutos
const MAX_EVENT_AGE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const headers = getCorsHeaders(req);

  // 1. Apenas POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers,
    });
  }

  // 2. Validar assinatura HMAC-SHA256
  const asaasSignature = req.headers.get('asaas-webhook-request-signature');
  const webhookSecret = Deno.env.get('ASAAS_WEBHOOK_SECRET');
  const requestBody = await req.text();

  if (!asaasSignature || !webhookSecret) {
    console.error('[webhook] Signature or secret missing');
    return new Response(JSON.stringify({ error: 'Signature validation failed' }), { status: 401, headers });
  }

  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(requestBody);
  const calculatedSignature = hmac.digest('hex');

  if (calculatedSignature !== asaasSignature) {
    console.error('[webhook] Invalid signature');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers });
  }

  const payload: AsaasWebhookPayload = JSON.parse(requestBody);

  // 3. Anti-replay: verificar timestamp do evento
  if (payload.payment?.dateCreated) {
    const eventDate = new Date(payload.payment.dateCreated).getTime();
    const now = Date.now();
    if (!isNaN(eventDate) && (now - eventDate) > MAX_EVENT_AGE_MS) {
      console.error(`[webhook] Evento muito antigo (${payload.payment.dateCreated}). Possível replay.`);
      return new Response(JSON.stringify({ error: 'Event too old' }), { status: 200, headers });
    }
  }

  // 4. Inicializar Supabase Admin
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 5. Idempotência: inserir evento no log
  const { error: eventInsertError } = await supabaseAdmin
    .from('asaas_webhook_events')
    .insert({
      asaas_event_id: payload.id,
      type: payload.event,
      payload: payload,
      status: 'RECEIVED',
    });

  if (eventInsertError && eventInsertError.code === '23505') {
    console.log(`[webhook] Evento ${payload.id} já processado. Ignorando.`);
    return new Response(JSON.stringify({ message: 'Event already processed' }), { status: 200, headers });
  }

  if (eventInsertError) {
    console.error('[webhook] Falha ao inserir evento:', eventInsertError.message);
    return new Response(JSON.stringify({ error: 'Failed to record event' }), { status: 500, headers });
  }

  // 6. Processar evento
  let processingError: any = null;
  let isPermanentError = false;

  try {
    // Helper: buscar invoice por asaas_payment_id
    const findInvoice = async (asaasPaymentId: string) => {
      const { data, error } = await supabaseAdmin
        .from('invoices')
        .select('id, status')
        .eq('asaas_payment_id', asaasPaymentId)
        .single();
      if (error || !data) {
        isPermanentError = true;
        throw new Error(`Invoice not found for asaas_payment_id: ${asaasPaymentId}`);
      }
      return data;
    };

    switch (payload.event) {
      // =====================================================================
      // PAGAMENTO CONFIRMADO
      // =====================================================================
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        console.log(`[webhook] Processando confirmação: ${payload.payment.id}`);
        const invoice = await findInvoice(payload.payment.id);

        if (invoice.status === 'PAID') {
          console.log(`[webhook] Invoice ${invoice.id} já paga. Ignorando.`);
          break;
        }

        const { error: rpcError } = await supabaseAdmin.rpc('handle_payment_confirmed', {
          p_invoice_id: invoice.id,
          p_payment_payload: payload.payment,
        });

        if (rpcError) throw new Error(`RPC handle_payment_confirmed failed: ${rpcError.message}`);
        console.log(`[webhook] Pagamento confirmado para invoice ${invoice.id}`);
        break;
      }

      // =====================================================================
      // ESTORNO / CHARGEBACK
      // =====================================================================
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK': {
        console.log(`[webhook] Processando ${payload.event}: ${payload.payment.id}`);
        const invoice = await findInvoice(payload.payment.id);

        if (invoice.status === 'REFUNDED') {
          console.log(`[webhook] Invoice ${invoice.id} já estornada. Ignorando.`);
          break;
        }

        const refundPayload = {
          ...payload.payment,
          event_type: payload.event === 'PAYMENT_CHARGEBACK' ? 'CHARGEBACK' : 'REFUND',
        };

        const { error: rpcError } = await supabaseAdmin.rpc('handle_payment_refunded', {
          p_invoice_id: invoice.id,
          p_refund_payload: refundPayload,
        });

        if (rpcError) throw new Error(`RPC handle_payment_refunded failed: ${rpcError.message}`);
        console.log(`[webhook] ${payload.event} processado para invoice ${invoice.id}`);
        break;
      }

      // =====================================================================
      // PAGAMENTO VENCIDO
      // =====================================================================
      case 'PAYMENT_OVERDUE': {
        console.log(`[webhook] Pagamento vencido: ${payload.payment.id}`);
        const invoice = await findInvoice(payload.payment.id);

        await supabaseAdmin
          .from('invoices')
          .update({ status: 'OVERDUE', updated_at: new Date().toISOString() })
          .eq('id', invoice.id);

        console.log(`[webhook] Invoice ${invoice.id} marcada como OVERDUE`);
        break;
      }

      default:
        console.log(`[webhook] Evento não tratado: ${payload.event}`);
    }
  } catch (err) {
    processingError = err;
  }

  // 7. Atualizar status do evento
  const finalStatus = processingError ? 'FAILED' : 'PROCESSED';
  await supabaseAdmin
    .from('asaas_webhook_events')
    .update({
      status: finalStatus,
      processed_at: new Date().toISOString(),
      error_log: processingError ? processingError.message : null,
    })
    .eq('asaas_event_id', payload.id);

  // 8. Resposta: 200 para erros permanentes (evitar retry), 500 para transitórios
  if (processingError) {
    console.error('[webhook] Erro:', processingError.message);
    if (isPermanentError) {
      return new Response(JSON.stringify({ error: processingError.message }), { status: 200, headers });
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers });
  }

  return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), { status: 200, headers });
});
