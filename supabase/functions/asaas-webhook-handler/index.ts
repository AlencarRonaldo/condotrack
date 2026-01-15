// ==================================================================================
// SUPABASE EDGE FUNCTION: asaas-webhook-handler
//
// Descrição:
// Ponto de entrada para todos os webhooks enviados pelo Asaas.
// Responsável por:
// 1. Validar a assinatura do webhook para segurança.
// 2. Garantir a idempotência, prevenindo o processamento duplicado de eventos.
// 3. Delegar a lógica de negócio para funções RPC no banco de dados.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL: URL do seu projeto Supabase.
// - SUPABASE_SERVICE_ROLE_KEY: Chave de serviço do seu projeto.
// - ASAAS_WEBHOOK_SECRET: Token de verificação de webhook do Asaas.
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import crypto from 'node:crypto';

// Definição dos tipos para o payload do Asaas (simplificado)
interface AsaasPaymentPayload {
  id: string;
  value: number;
  dateCreated: string;
  // Adicione outros campos que você precise
}

interface AsaasWebhookPayload {
  event: string;
  payment: AsaasPaymentPayload;
  id: string; // ID do evento
}

// Função principal do Deno Deploy (Supabase Edge Functions)
Deno.serve(async (req) => {
  // 1. Validar o método da requisição
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Validar a assinatura do Webhook para segurança
  const asaasSignature = req.headers.get('asaas-webhook-request-signature');
  const webhookSecret = Deno.env.get('ASAAS_WEBHOOK_SECRET');
  const requestBody = await req.text(); // Ler o corpo como texto para validação

  if (!asaasSignature || !webhookSecret) {
    console.error('Webhook secret or signature is missing.');
    return new Response(JSON.stringify({ error: 'Signature validation failed' }), { status: 401 });
  }

  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(requestBody);
  const calculatedSignature = hmac.digest('hex');

  if (calculatedSignature !== asaasSignature) {
    console.error('Invalid webhook signature.');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
  }

  const payload: AsaasWebhookPayload = JSON.parse(requestBody);

  // 3. Inicializar o cliente Supabase com a chave de serviço
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 4. Garantir Idempotência: Inserir o evento no log de webhooks
  const { error: eventInsertError } = await supabaseAdmin
    .from('asaas_webhook_events')
    .insert({
      asaas_event_id: payload.id,
      type: payload.event,
      payload: payload,
      status: 'RECEIVED',
    });

  // Se o erro for de violação de chave única, o evento já foi recebido.
  if (eventInsertError && eventInsertError.code === '23505') {
    console.log(`Event ${payload.id} already received. Skipping.`);
    return new Response(JSON.stringify({ message: 'Event already processed' }), { status: 200 });
  }

  if (eventInsertError) {
    console.error('Failed to insert webhook event:', eventInsertError);
    // Mesmo com falha ao inserir, retornamos 200 para o Asaas não reenviar indefinidamente.
    // A falha será registrada nos logs da função.
    return new Response(JSON.stringify({ error: 'Failed to record event' }), { status: 500 });
  }

  // 5. Processar a lógica de negócio baseada no tipo de evento
  let processingError: any = null;

  try {
    switch (payload.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED': {
        console.log(`Processing payment confirmation for Asaas Payment ID: ${payload.payment.id}`);

        // Encontrar nossa invoice interna pelo asaas_payment_id
        const { data: invoice, error: invoiceError } = await supabaseAdmin
          .from('invoices')
          .select('id, status')
          .eq('asaas_payment_id', payload.payment.id)
          .single();

        if (invoiceError || !invoice) {
          throw new Error(`Invoice not found for asaas_payment_id: ${payload.payment.id}`);
        }

        // Evitar re-processamento se o status já for 'PAID'
        if (invoice.status === 'PAID') {
          console.log(`Invoice ${invoice.id} is already paid. Skipping logic.`);
          break;
        }

        // Chamar a função RPC para a transação atômica
        const { error: rpcError } = await supabaseAdmin.rpc('handle_payment_confirmed', {
          p_invoice_id: invoice.id,
          p_payment_payload: payload.payment,
        });

        if (rpcError) {
          throw new Error(`RPC handle_payment_confirmed failed: ${rpcError.message}`);
        }

        console.log(`Successfully processed event for invoice ${invoice.id}`);
        break;
      }

      case 'PAYMENT_REFUNDED':
        // TODO: Implementar lógica para estornos, chamando uma função RPC 'handle_payment_refunded'
        console.log(`Received (but not implemented) event: ${payload.event}`);
        break;

      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }
  } catch (err) {
    processingError = err;
  }

  // 6. Atualizar o status do evento de webhook (sucesso ou falha)
  const finalStatus = processingError ? 'FAILED' : 'PROCESSED';
  const { error: updateError } = await supabaseAdmin
    .from('asaas_webhook_events')
    .update({
      status: finalStatus,
      processed_at: new Date().toISOString(),
      error_log: processingError ? processingError.message : null,
    })
    .eq('asaas_event_id', payload.id);

  if (updateError) {
    console.error('CRITICAL: Failed to update webhook event status!', updateError);
  }

  // 7. Retornar resposta final
  if (processingError) {
    console.error('Error processing webhook:', processingError.message);
    // Retornamos 500 mas o evento foi registrado, então não será reprocessado sem intervenção.
    return new Response(JSON.stringify({ error: 'Internal server error during processing' }), { status: 500 });
  }

  return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), { status: 200 });
});
