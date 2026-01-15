// ==================================================================================
// SUPABASE EDGE FUNCTION: create-payment
//
// Descrição:
// Cria uma nova cobrança no Asaas a pedido do frontend.
// Responsabilidades:
// 1. Autenticar o usuário.
// 2. Validar o plano e o usuário.
// 3. Garantir que um cliente Asaas exista para o condomínio.
// 4. Chamar a API do Asaas para criar a cobrança.
// 5. Salvar a cobrança no banco de dados local.
// 6. Retornar os dados de pagamento (link ou QR code) para o frontend.
//
// Variáveis de Ambiente Obrigatórias:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - ASAAS_API_KEY
// ==================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Tipos (simplificado) ---
interface PaymentRequestBody {
  planId: string; // ou slug do plano
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
}

Deno.serve(async (req) => {
  // Tratar requisição OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Autenticar o usuário via JWT
    const authHeader = req.headers.get('Authorization')!;
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user) {
      throw { status: 401, message: 'Usuário não autenticado.' };
    }

    const { planId, billingType } = await req.json() as PaymentRequestBody;
    if (!planId || !billingType) {
      throw { status: 400, message: 'planId e billingType são obrigatórios.' };
    }

    // --- Lógica Principal ---
    const condoId = user.user_metadata?.condo_id;
    if (!condoId) {
      throw { status: 403, message: 'Usuário não associado a um condomínio.' };
    }

    // 2. Buscar dados do plano e do condomínio
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('price_monthly')
      .eq('slug', planId) // Usando slug é mais robusto que ID numérico
      .single();

    if (planError || !plan) {
      throw { status: 404, message: `Plano '${planId}' não encontrado.` };
    }
    
    const { data: condo, error: condoError } = await supabaseAdmin
        .from('condos')
        .select('name, document_number')
        .eq('id', condoId)
        .single();

    if (condoError || !condo) {
        throw { status: 404, message: 'Condomínio não encontrado.' };
    }

    // 3. Buscar ou criar cliente no Asaas
    let { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('asaas_customer_id')
      .eq('condo_id', condoId)
      .single();

    if (customerError && customerError.code !== 'PGRST116') { // PGRST116 = 'not found'
        throw { status: 500, message: 'Erro ao buscar cliente: ' + customerError.message };
    }

    if (!customer) {
        // Cliente não existe, criar no Asaas
        const asaasCustomerResponse = await fetch('https://api.asaas.com/v3/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': Deno.env.get('ASAAS_API_KEY')!,
            },
            body: JSON.stringify({
                name: condo.name,
                cpfCnpj: condo.document_number,
                // Adicionar outros campos obrigatórios como email, phone, etc.
            }),
        });

        const newAsaasCustomer = await asaasCustomerResponse.json();
        if (!asaasCustomerResponse.ok) {
            throw { status: 500, message: 'Erro ao criar cliente no Asaas.', details: newAsaasCustomer.errors };
        }

        // Salvar o novo cliente no nosso banco
        const { data: newLocalCustomer, error: newCustomerError } = await supabaseAdmin
            .from('customers')
            .insert({ condo_id: condoId, asaas_customer_id: newAsaasCustomer.id })
            .select('asaas_customer_id')
            .single();
        
        if(newCustomerError){
            throw { status: 500, message: 'Erro ao salvar novo cliente no DB.', details: newCustomerError.message };
        }
        customer = newLocalCustomer;
    }

    // 4. Criar a cobrança no Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5); // Vencimento em 5 dias

    const asaasPaymentResponse = await fetch('https://api.asaas.com/v3/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': Deno.env.get('ASAAS_API_KEY')!,
        },
        body: JSON.stringify({
            customer: customer.asaas_customer_id,
            billingType,
            value: plan.price_monthly,
            dueDate: dueDate.toISOString().split('T')[0],
            description: `Assinatura Plano ${planId} - Condotrack`,
        }),
    });

    const asaasPayment = await asaasPaymentResponse.json();
    if (!asaasPaymentResponse.ok) {
        throw { status: 500, message: 'Erro ao criar cobrança no Asaas.', details: asaasPayment.errors };
    }

    // 5. Persistir a cobrança no nosso banco de dados
    const { data: newInvoice, error: invoiceInsertError } = await supabaseAdmin
      .from('invoices')
      .insert({
        customer_id: customer.id, // O ID do nosso DB, não do Asaas
        asaas_payment_id: asaasPayment.id,
        status: asaasPayment.status, // Geralmente PENDING
        amount: asaasPayment.value,
        due_date: asaasPayment.dueDate,
        billing_type: asaasPayment.billingType,
        payment_link: asaasPayment.invoiceUrl,
        pix_qr_code: asaasPayment.pixQrCode?.payload, // Apenas para PIX
        barcode: asaasPayment.barcode, // Apenas para Boleto
      })
      .select('id')
      .single();

    if (invoiceInsertError) {
        throw { status: 500, message: 'Erro ao salvar a fatura no DB.', details: invoiceInsertError.message };
    }
    
    // 6. Retornar os dados para o frontend
    return new Response(JSON.stringify({
        paymentId: newInvoice.id,
        paymentLink: asaasPayment.invoiceUrl,
        pixQrCode: asaasPayment.pixQrCode?.payload,
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    console.error('Erro na Edge Function create-payment:', error);
    return new Response(JSON.stringify({ 
        error: error.message || 'Erro interno.',
        details: error.details || null
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.status || 500,
    });
  }
});
