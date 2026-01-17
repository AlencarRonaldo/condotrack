-- ==================================================================================
-- MIGRAÇÃO: CORRIGIR FUNÇÃO RPC handle_payment_confirmed
-- ==================================================================================
-- Esta migração corrige a função RPC para atualizar corretamente:
-- - plan_type do condomínio
-- - plan_start_date e plan_end_date
-- - staff_limit e unit_limit baseado no plano
-- - last_payment_date
-- ==================================================================================

BEGIN;

-- Recriar a função com a lógica completa
CREATE OR REPLACE FUNCTION public.handle_payment_confirmed(
    p_invoice_id UUID,
    p_payment_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice_amount NUMERIC;
    v_condo_id TEXT;
    v_plan_slug TEXT;
    v_billing_type TEXT;
    v_staff_limit INTEGER;
    v_unit_limit INTEGER;
    v_plan_end_date TIMESTAMPTZ;
BEGIN
    -- 1. Obter dados da invoice e do condomínio associado
    SELECT
        i.amount,
        i.plan_slug,
        i.billing_type,
        c.condo_id
    INTO
        v_invoice_amount,
        v_plan_slug,
        v_billing_type,
        v_condo_id
    FROM
        public.invoices i
    JOIN
        public.customers c ON i.customer_id = c.id
    WHERE
        i.id = p_invoice_id;

    -- Se a invoice não for encontrada, levanta um erro
    IF v_invoice_amount IS NULL THEN
        RAISE EXCEPTION 'Invoice not found with ID: %', p_invoice_id;
    END IF;

    -- Validar que plan_slug existe na invoice
    IF v_plan_slug IS NULL THEN
        RAISE EXCEPTION 'Invoice % does not have plan_slug. Cannot process payment.', p_invoice_id;
    END IF;

    -- 2. Buscar limites do plano
    SELECT staff_limit, unit_limit
    INTO v_staff_limit, v_unit_limit
    FROM public.plans
    WHERE slug = v_plan_slug;

    -- Se plano não encontrado, usar valores padrão seguros
    IF v_staff_limit IS NULL THEN
        v_staff_limit := 2; -- Valor mínimo seguro
        v_unit_limit := 50;
        RAISE WARNING 'Plan % not found in plans table. Using default limits.', v_plan_slug;
    END IF;

    -- 3. Calcular data de vencimento baseado no billing_type
    -- Nota: Por enquanto, assumimos mensal. Futuramente podemos ter anual também
    v_plan_end_date := NOW() + INTERVAL '1 month'; -- Default: 30 dias
    
    -- Se billing_type indicar anual (futuro)
    -- IF v_billing_type = 'YEARLY' THEN
    --     v_plan_end_date := NOW() + INTERVAL '1 year';
    -- END IF;

    -- 4. Inserir na tabela de transações
    INSERT INTO public.transactions (
        invoice_id, 
        asaas_transaction_id, 
        type, 
        amount, 
        status, 
        provider_response, 
        processed_at
    )
    VALUES (
        p_invoice_id,
        p_payment_payload ->> 'id',
        'PAYMENT',
        (p_payment_payload ->> 'value')::NUMERIC,
        'CONFIRMED',
        p_payment_payload,
        COALESCE(
            (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ,
            (p_payment_payload ->> 'paymentDate')::TIMESTAMPTZ,
            NOW()
        )
    );

    -- 5. Atualizar o status da fatura
    UPDATE public.invoices
    SET
        status = 'PAID',
        paid_at = COALESCE(
            (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ,
            (p_payment_payload ->> 'paymentDate')::TIMESTAMPTZ,
            NOW()
        ),
        updated_at = NOW()
    WHERE
        id = p_invoice_id;

    -- 6. Atualizar o condomínio com TODOS os dados do plano
    UPDATE public.condos
    SET
        plan_type = v_plan_slug,                    -- ✅ Plano contratado
        subscription_status = 'active',              -- ✅ Status ativo
        plan_start_date = NOW(),                     -- ✅ Data de início
        plan_end_date = v_plan_end_date,             -- ✅ Data de vencimento
        last_payment_date = COALESCE(
            (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ,
            (p_payment_payload ->> 'paymentDate')::TIMESTAMPTZ,
            NOW()
        ),                                          -- ✅ Último pagamento
        staff_limit = v_staff_limit,                -- ✅ Limite de staff
        unit_limit = v_unit_limit,                  -- ✅ Limite de unidades
        is_active = true,                           -- ✅ Ativar conta
        updated_at = NOW()
    WHERE
        id = v_condo_id;

    -- Log para auditoria (se necessário, pode usar RAISE NOTICE em desenvolvimento)
    -- RAISE NOTICE 'Payment confirmed for condo %. Plan: %, End date: %', 
    --     v_condo_id, v_plan_slug, v_plan_end_date;

END;
$$;

-- Garantir que a service_role possa executar esta função
GRANT EXECUTE ON FUNCTION public.handle_payment_confirmed(UUID, JSONB) TO service_role;

-- Comentário na função
COMMENT ON FUNCTION public.handle_payment_confirmed(UUID, JSONB) IS 
'Processa pagamento confirmado: cria transação, atualiza invoice e condomínio com plano, limites e datas de vencimento.';

COMMIT;
