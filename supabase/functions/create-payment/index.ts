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

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// --- Tipos (simplificado) ---
interface PaymentRequestBody {
  planId: string; // ou slug do plano
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  condoId?: string; // Opcional: usado como fallback quando não há JWT válido
}

Deno.serve(async (req) => {
  // Tratar requisição OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ✅ 1. Validar apikey PRIMEIRO (segurança básica)
    const apikey = req.headers.get('apikey') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apikey) {
      return new Response(
        JSON.stringify({ error: 'API key não fornecida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 2. Inicializar cliente admin (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ✅ 3. Obter dados do body
    const { planId, billingType, condoId: condoIdFromBody } = await req.json() as PaymentRequestBody & { condoId?: string };
    if (!planId || !billingType) {
      return new Response(
        JSON.stringify({ error: 'planId e billingType são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar billingType
    const validBillingTypes = ['PIX', 'CREDIT_CARD', 'BOLETO'];
    if (!validBillingTypes.includes(billingType)) {
      return new Response(
        JSON.stringify({ error: `billingType inválido. Deve ser um de: ${validBillingTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ 4. Tentar obter condoId do JWT (SE houver Authorization com JWT de usuário)
    let condoId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      
      // ✅ IMPORTANTE: Só tenta validar se NÃO for a mesma chave do apikey (anon key)
      // Se o token for igual ao apikey, é anon key e não devemos validar como JWT de usuário
      if (token && token !== apikey) {
        try {
          const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
          
          if (!userError && user?.user_metadata?.condo_id) {
            condoId = user.user_metadata.condo_id;
            console.log('[create-payment] ✅ CondoId obtido do JWT:', condoId);
          } else if (userError) {
            console.log('[create-payment] ⚠️ JWT inválido ou sem condo_id, usando fallback:', userError.message);
          }
        } catch (jwtError: any) {
          console.log('[create-payment] ⚠️ Erro ao validar JWT (ignorando):', jwtError?.message || jwtError);
        }
      } else {
        console.log('[create-payment] ℹ️ Authorization contém anon key (mesma do apikey), usando condoId do body.');
      }
    } else {
      console.log('[create-payment] ℹ️ Sem Authorization header, usando condoId do body.');
    }

    // ✅ 5. Fallback: usar condoId do body
    if (!condoId && condoIdFromBody) {
      condoId = condoIdFromBody.trim();
      console.log('[create-payment] ✅ CondoId obtido do body:', condoId);
    }

    // ✅ 6. Validar que temos condoId
    if (!condoId) {
      return new Response(
        JSON.stringify({ error: 'Condomínio não identificado. É necessário estar autenticado ou fornecer condoId no body da requisição.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        .select('name, document_number, email, phone, postal_code')
        .eq('id', condoId)
        .single();

    if (condoError || !condo) {
        throw { status: 404, message: 'Condomínio não encontrado.' };
    }

    // 3. Buscar ou criar cliente no Asaas
    let { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, asaas_customer_id')
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
                email: condo.email,
                phone: condo.phone,
                postalCode: condo.postal_code,
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
            .select('id, asaas_customer_id')
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

    // 5. Se for PIX e não vier pixQrCode na resposta, buscar via endpoint específico
    let pixQrCodeData = null;
    if (billingType === 'PIX' && !asaasPayment.pixQrCode) {
        // Buscar QR Code PIX via endpoint específico
        const pixQrCodeResponse = await fetch(`https://api.asaas.com/v3/payments/${asaasPayment.id}/pixQrCode`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'access_token': Deno.env.get('ASAAS_API_KEY')!,
            },
        });

        if (pixQrCodeResponse.ok) {
            pixQrCodeData = await pixQrCodeResponse.json();
        } else {
            console.warn('Não foi possível obter QR Code PIX via endpoint específico. Usando dados do pagamento.');
        }
    } else if (billingType === 'PIX' && asaasPayment.pixQrCode) {
        pixQrCodeData = asaasPayment.pixQrCode;
    }

    // 6. Persistir a cobrança no nosso banco de dados
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
        pix_qr_code: pixQrCodeData?.payload || asaasPayment.pixQrCode?.payload, // Payload do PIX (copia e cola)
        barcode: asaasPayment.barcode, // Apenas para Boleto
      })
      .select('id')
      .single();

    if (invoiceInsertError) {
        throw { status: 500, message: 'Erro ao salvar a fatura no DB.', details: invoiceInsertError.message };
    }
    
    // 7. Retornar os dados para o frontend
    const responseData: any = {
        paymentId: newInvoice.id,
        paymentLink: asaasPayment.invoiceUrl,
        billingType: billingType,
    };

    // Se for PIX, incluir dados do QR Code
    if (billingType === 'PIX') {
        if (pixQrCodeData) {
            console.log('✅ QR Code PIX obtido via endpoint específico');
            responseData.pixQrCode = {
                payload: pixQrCodeData.payload, // Código copia e cola
                encodedImage: pixQrCodeData.encodedImage, // QR Code em Base64 (opcional)
                expirationDate: pixQrCodeData.expirationDate, // Data de expiração
            };
        } else if (asaasPayment.pixQrCode) {
            console.log('✅ QR Code PIX obtido da resposta do pagamento');
            // Fallback: usar dados que vieram na resposta do pagamento
            responseData.pixQrCode = {
                payload: asaasPayment.pixQrCode.payload,
                encodedImage: asaasPayment.pixQrCode.encodedImage,
                expirationDate: asaasPayment.pixQrCode.expirationDate,
            };
        } else {
            console.error('❌ ERRO: PIX selecionado mas QR Code não foi obtido!');
            throw { 
                status: 500, 
                message: 'Não foi possível obter o QR Code PIX. Tente novamente ou escolha outro método de pagamento.' 
            };
        }
    }

    console.log('📤 Retornando resposta:', {
        paymentId: responseData.paymentId,
        billingType: responseData.billingType,
        hasPixQrCode: !!responseData.pixQrCode,
        hasPaymentLink: !!responseData.paymentLink,
    });

    return new Response(JSON.stringify(responseData), {
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
