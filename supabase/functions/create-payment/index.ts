// ==================================================================================
// SUPABASE EDGE FUNCTION: create-payment
//
// Cria uma nova cobrança no Asaas a pedido do frontend.
// Segurança: CORS restrito, validação de condo ativo, logs sanitizados.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - ASAAS_API_KEY
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Planos válidos (whitelist)
const VALID_PLAN_SLUGS = ['basic', 'professional', 'premium'];
const VALID_BILLING_TYPES = ['PIX', 'CREDIT_CARD', 'BOLETO'];

interface PaymentRequestBody {
  planId: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  condoId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const headers = getCorsHeaders(req);

  try {
    // 1. Validar apikey
    const apikey = req.headers.get('apikey') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apikey) {
      return new Response(
        JSON.stringify({ error: 'API key não fornecida' }),
        { status: 401, headers }
      );
    }

    // 2. Inicializar cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3. Obter e validar dados do body
    const { planId, billingType, condoId: condoIdFromBody } = await req.json() as PaymentRequestBody;

    if (!planId || !billingType) {
      return new Response(
        JSON.stringify({ error: 'planId e billingType são obrigatórios.' }),
        { status: 400, headers }
      );
    }

    // Validar planId contra whitelist
    if (!VALID_PLAN_SLUGS.includes(planId)) {
      return new Response(
        JSON.stringify({ error: `planId inválido. Deve ser um de: ${VALID_PLAN_SLUGS.join(', ')}` }),
        { status: 400, headers }
      );
    }

    // Validar billingType
    if (!VALID_BILLING_TYPES.includes(billingType)) {
      return new Response(
        JSON.stringify({ error: `billingType inválido. Deve ser um de: ${VALID_BILLING_TYPES.join(', ')}` }),
        { status: 400, headers }
      );
    }

    // 4. Obter condoId (JWT ou body)
    let condoId: string | null = null;
    const authHeader = req.headers.get('Authorization');

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      if (token && token !== apikey) {
        try {
          const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
          if (!userError && user?.user_metadata?.condo_id) {
            condoId = user.user_metadata.condo_id;
          }
        } catch {}
      }
    }

    if (!condoId && condoIdFromBody) {
      condoId = condoIdFromBody.trim();
    }

    if (!condoId) {
      return new Response(
        JSON.stringify({ error: 'Condomínio não identificado.' }),
        { status: 403, headers }
      );
    }

    // 5. Buscar plano do banco (preço vem do servidor, nunca do frontend)
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('slug, price_monthly')
      .eq('slug', planId)
      .single();

    if (planError || !plan) {
      throw { status: 404, message: `Plano '${planId}' não encontrado.` };
    }

    // 6. Buscar condomínio e validar que está ativo
    const { data: condo, error: condoError } = await supabaseAdmin
      .from('condos')
      .select('name, document_number, is_active')
      .eq('id', condoId)
      .single();

    if (condoError || !condo) {
      throw { status: 404, message: 'Condomínio não encontrado.' };
    }

    console.log(`[create-payment] Condo: ${condoId}, Plano: ${planId}, Método: ${billingType}`);

    // 7. Buscar ou criar cliente no Asaas
    let { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, asaas_customer_id')
      .eq('condo_id', condoId)
      .single();

    if (customerError && customerError.code !== 'PGRST116') {
      throw { status: 500, message: 'Erro ao buscar cliente.' };
    }

    if (!customer) {
      if (!condo.document_number) {
        throw { status: 400, message: 'Condomínio não possui CPF/CNPJ cadastrado.' };
      }

      const asaasCustomerResponse = await fetch('https://api.asaas.com/v3/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': Deno.env.get('ASAAS_API_KEY')!,
        },
        body: JSON.stringify({
          name: condo.name,
          cpfCnpj: condo.document_number,
        }),
      });

      const newAsaasCustomer = await asaasCustomerResponse.json();
      if (!asaasCustomerResponse.ok) {
        console.error('[create-payment] Erro Asaas (cliente):', newAsaasCustomer?.errors?.[0]?.description || 'unknown');
        throw { status: 500, message: 'Erro ao criar cliente no Asaas.' };
      }

      const { data: newLocalCustomer, error: newCustomerError } = await supabaseAdmin
        .from('customers')
        .insert({ condo_id: condoId, asaas_customer_id: newAsaasCustomer.id })
        .select('id, asaas_customer_id')
        .single();

      if (newCustomerError) {
        throw { status: 500, message: 'Erro ao salvar cliente no DB.' };
      }
      customer = newLocalCustomer;
    }

    // 8. Criar cobrança no Asaas (valor vem da tabela plans, não do frontend)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);

    const paymentBody = {
      customer: customer.asaas_customer_id,
      billingType,
      value: plan.price_monthly,
      dueDate: dueDate.toISOString().split('T')[0],
      description: `Assinatura Plano ${planId} - Condotrack`,
    };

    const asaasPaymentResponse = await fetch('https://api.asaas.com/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': Deno.env.get('ASAAS_API_KEY')!,
      },
      body: JSON.stringify(paymentBody),
    });

    const asaasPayment = await asaasPaymentResponse.json();
    if (!asaasPaymentResponse.ok) {
      console.error('[create-payment] Erro Asaas (pagamento):', asaasPayment?.errors?.[0]?.description || 'unknown');
      throw { status: 500, message: 'Erro ao criar cobrança no Asaas.' };
    }

    console.log(`[create-payment] Pagamento criado: ${asaasPayment.id}, status: ${asaasPayment.status}`);

    // 9. PIX: buscar QR Code
    let pixQrCodeData = null;
    if (billingType === 'PIX') {
      if (asaasPayment.pixQrCode) {
        pixQrCodeData = asaasPayment.pixQrCode;
      } else {
        const pixResponse = await fetch(`https://api.asaas.com/v3/payments/${asaasPayment.id}/pixQrCode`, {
          headers: { 'access_token': Deno.env.get('ASAAS_API_KEY')! },
        });
        if (pixResponse.ok) {
          pixQrCodeData = await pixResponse.json();
        }
      }
    }

    // 10. Salvar invoice no DB
    const invoiceData: any = {
      customer_id: customer.id,
      asaas_payment_id: asaasPayment.id,
      status: asaasPayment.status || 'PENDING',
      amount: asaasPayment.value,
      due_date: asaasPayment.dueDate,
      billing_type: asaasPayment.billingType,
      plan_slug: plan.slug,
    };

    if (asaasPayment.invoiceUrl) invoiceData.payment_link = asaasPayment.invoiceUrl;
    if (pixQrCodeData?.payload) invoiceData.pix_qr_code = pixQrCodeData.payload;

    const { data: newInvoice, error: invoiceInsertError } = await supabaseAdmin
      .from('invoices')
      .insert(invoiceData)
      .select('id')
      .single();

    if (invoiceInsertError) {
      throw { status: 500, message: 'Erro ao salvar fatura no DB.' };
    }

    // 11. Resposta para o frontend
    const responseData: any = {
      paymentId: newInvoice.id,
      paymentLink: asaasPayment.invoiceUrl,
      billingType,
    };

    if (billingType === 'PIX' && pixQrCodeData) {
      responseData.pixQrCode = {
        payload: pixQrCodeData.payload,
        encodedImage: pixQrCodeData.encodedImage,
        expirationDate: pixQrCodeData.expirationDate,
      };
    } else if (billingType === 'PIX') {
      throw { status: 500, message: 'Não foi possível obter o QR Code PIX.' };
    }

    return new Response(JSON.stringify(responseData), { headers, status: 200 });

  } catch (error: any) {
    console.error('[create-payment] Erro:', error?.message || error);
    return new Response(JSON.stringify({
      error: error?.message || 'Erro interno do servidor',
    }), {
      headers: getCorsHeaders(req),
      status: error?.status || 500,
    });
  }
});
