// ==================================================================================
// SUPABASE EDGE FUNCTION: check-payment-status
//
// Verifica o status de uma invoice/pagamento.
// Segurança: valida ownership da invoice via condoId, CORS restrito.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Domínios permitidos para CORS
const ALLOWED_ORIGINS = [
  'https://condotrack.vercel.app',
  'https://www.condotrack.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const headers = getCorsHeaders(req);

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers }
    );
  }

  try {
    // 1. Validar apikey
    const apikey = req.headers.get('apikey') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apikey) {
      return new Response(
        JSON.stringify({ error: 'API key não fornecida' }),
        { status: 401, headers }
      );
    }

    // 2. Obter parâmetros
    const url = new URL(req.url);
    const paymentId = url.searchParams.get('paymentId');
    const condoId = url.searchParams.get('condoId');

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'paymentId é obrigatório' }),
        { status: 400, headers }
      );
    }

    if (!condoId) {
      return new Response(
        JSON.stringify({ error: 'condoId é obrigatório' }),
        { status: 400, headers }
      );
    }

    // 3. Inicializar cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 4. Buscar invoice com JOIN para validar ownership
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, status, paid_at, amount, billing_type, customer:customers!inner(condo_id)')
      .eq('id', paymentId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice não encontrada' }),
        { status: 404, headers }
      );
    }

    // 5. Validar que a invoice pertence ao condomínio do solicitante
    const invoiceCondoId = (invoice.customer as any)?.condo_id;
    if (invoiceCondoId !== condoId) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Invoice não pertence a este condomínio.' }),
        { status: 403, headers }
      );
    }

    // 6. Retornar status (sem dados internos sensíveis)
    return new Response(
      JSON.stringify({
        paymentId: invoice.id,
        status: invoice.status,
        paidAt: invoice.paid_at,
        amount: invoice.amount,
        billingType: invoice.billing_type,
        isPaid: invoice.status === 'PAID',
      }),
      { headers, status: 200 }
    );

  } catch (error: any) {
    console.error('[check-payment-status] Erro:', error?.message || error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { headers: getCorsHeaders(req), status: 500 }
    );
  }
});
