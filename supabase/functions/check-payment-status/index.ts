// ==================================================================================
// SUPABASE EDGE FUNCTION: check-payment-status
//
// Descrição:
// Verifica o status de uma invoice/pagamento no banco de dados.
// Usado pelo frontend para polling de confirmação de pagamento PIX.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  // Tratar requisição OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Apenas GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ✅ 1. Validar apikey
    const apikey = req.headers.get('apikey') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apikey) {
      return new Response(
        JSON.stringify({ error: 'API key não fornecida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 2. Obter paymentId da query string
    const url = new URL(req.url);
    const paymentId = url.searchParams.get('paymentId');

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'paymentId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 3. Inicializar cliente admin (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ✅ 4. Buscar invoice pelo ID
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, status, paid_at, amount, billing_type')
      .eq('id', paymentId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 5. Retornar status
    return new Response(
      JSON.stringify({
        paymentId: invoice.id,
        status: invoice.status,
        paidAt: invoice.paid_at,
        amount: invoice.amount,
        billingType: invoice.billing_type,
        isPaid: invoice.status === 'PAID',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na Edge Function check-payment-status:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro interno do servidor',
        details: error?.details || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error?.status || 500,
      }
    );
  }
});
