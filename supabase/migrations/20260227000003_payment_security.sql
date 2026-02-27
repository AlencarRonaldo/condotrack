-- ==================================================================================
-- MIGRATION: Correções de Segurança no Sistema de Pagamentos
-- ==================================================================================
-- 1. Criar RPC handle_payment_refunded (estornos e chargebacks)
-- 2. Adicionar validação de valor pago vs cobrado em handle_payment_confirmed
-- ==================================================================================

BEGIN;

-- ==================================================================================
-- 1. CRIAR FUNÇÃO RPC: handle_payment_refunded
-- ==================================================================================
-- Processa estornos e chargebacks: reverte invoice, desativa condomínio
-- ==================================================================================

CREATE OR REPLACE FUNCTION public.handle_payment_refunded(
    p_invoice_id UUID,
    p_refund_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_condo_id TEXT;
    v_invoice_status TEXT;
BEGIN
    -- 1. Buscar invoice e condo associado
    SELECT
        i.status,
        c.condo_id
    INTO
        v_invoice_status,
        v_condo_id
    FROM public.invoices i
    JOIN public.customers c ON i.customer_id = c.id
    WHERE i.id = p_invoice_id;

    IF v_condo_id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found with ID: %', p_invoice_id;
    END IF;

    -- 2. Registrar transação de estorno
    INSERT INTO public.transactions (
        invoice_id,
        asaas_transaction_id,
        type,
        amount,
        status,
        provider_response,
        processed_at
    ) VALUES (
        p_invoice_id,
        p_refund_payload ->> 'id',
        CASE
            WHEN p_refund_payload ->> 'event_type' = 'CHARGEBACK' THEN 'CHARGEBACK'
            ELSE 'REFUND'
        END,
        (p_refund_payload ->> 'value')::NUMERIC,
        'CONFIRMED',
        p_refund_payload,
        NOW()
    );

    -- 3. Atualizar status da invoice
    UPDATE public.invoices
    SET
        status = 'REFUNDED',
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- 4. Desativar condomínio
    UPDATE public.condos
    SET
        subscription_status = 'canceled',
        is_active = false,
        updated_at = NOW()
    WHERE id = v_condo_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_payment_refunded(UUID, JSONB) TO service_role;

COMMENT ON FUNCTION public.handle_payment_refunded(UUID, JSONB) IS
'Processa estorno/chargeback: cria transação REFUND, atualiza invoice para REFUNDED, desativa condomínio.';

-- ==================================================================================
-- 2. ATUALIZAR handle_payment_confirmed - Validar valor pago
-- ==================================================================================

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
    v_paid_amount NUMERIC;
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
    FROM public.invoices i
    JOIN public.customers c ON i.customer_id = c.id
    WHERE i.id = p_invoice_id;

    IF v_invoice_amount IS NULL THEN
        RAISE EXCEPTION 'Invoice not found with ID: %', p_invoice_id;
    END IF;

    IF v_plan_slug IS NULL THEN
        RAISE EXCEPTION 'Invoice % does not have plan_slug.', p_invoice_id;
    END IF;

    -- ✅ SEGURANÇA: Validar que o valor pago >= valor da invoice
    v_paid_amount := (p_payment_payload ->> 'value')::NUMERIC;
    IF v_paid_amount IS NOT NULL AND v_paid_amount < v_invoice_amount THEN
        RAISE EXCEPTION 'Valor pago (%) inferior ao valor da invoice (%). Possível fraude.',
            v_paid_amount, v_invoice_amount;
    END IF;

    -- 2. Buscar limites do plano
    SELECT staff_limit, unit_limit
    INTO v_staff_limit, v_unit_limit
    FROM public.plans
    WHERE slug = v_plan_slug;

    IF v_staff_limit IS NULL THEN
        v_staff_limit := 2;
        v_unit_limit := 50;
        RAISE WARNING 'Plan % not found. Using default limits.', v_plan_slug;
    END IF;

    -- 3. Calcular data de vencimento
    v_plan_end_date := NOW() + INTERVAL '1 month';

    -- 4. Inserir transação
    INSERT INTO public.transactions (
        invoice_id, asaas_transaction_id, type, amount, status, provider_response, processed_at
    ) VALUES (
        p_invoice_id,
        p_payment_payload ->> 'id',
        'PAYMENT',
        v_paid_amount,
        'CONFIRMED',
        p_payment_payload,
        COALESCE(
            (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ,
            (p_payment_payload ->> 'paymentDate')::TIMESTAMPTZ,
            NOW()
        )
    );

    -- 5. Atualizar invoice
    UPDATE public.invoices
    SET
        status = 'PAID',
        paid_at = COALESCE(
            (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ,
            (p_payment_payload ->> 'paymentDate')::TIMESTAMPTZ,
            NOW()
        ),
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- 6. Atualizar condomínio
    UPDATE public.condos
    SET
        plan_type = v_plan_slug,
        subscription_status = 'active',
        plan_start_date = NOW(),
        plan_end_date = v_plan_end_date,
        last_payment_date = COALESCE(
            (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ,
            (p_payment_payload ->> 'paymentDate')::TIMESTAMPTZ,
            NOW()
        ),
        staff_limit = v_staff_limit,
        unit_limit = v_unit_limit,
        is_active = true,
        updated_at = NOW()
    WHERE id = v_condo_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_payment_confirmed(UUID, JSONB) TO service_role;

COMMIT;
