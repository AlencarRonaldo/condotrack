-- ==================================================================================
-- MIGRAÇÃO: CRIAÇÃO DE FUNÇÕES RPC PARA TRANSAÇÕES ATÔMICAS
--
-- Descrição:
-- Esta migração cria funções PostgreSQL que podem ser chamadas via RPC.
-- Agrupar a lógica de negócio em uma função de banco de dados garante que múltiplas
-- operações sejam executadas de forma atômica (tudo ou nada), o que é essencial
-- para a consistência dos dados financeiros.
-- ==================================================================================

BEGIN;

-- Função para processar um pagamento confirmado.
-- Recebe o ID da fatura e o payload do pagamento para criar a transação.
CREATE OR REPLACE FUNCTION public.handle_payment_confirmed(
    p_invoice_id UUID,
    p_payment_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
-- SECURITY DEFINER é necessário para que a função possa escrever em tabelas
-- mesmo quando chamada por um usuário que não teria permissão direta.
-- A segurança é garantida pela lógica interna da função.
SECURITY DEFINER
AS $$
DECLARE
    v_invoice_amount NUMERIC;
    v_condo_id TEXT;
BEGIN
    -- 1. Obter o valor da fatura e o ID do condomínio associado
    SELECT
        i.amount,
        c.condo_id
    INTO
        v_invoice_amount,
        v_condo_id
    FROM
        public.invoices i
    JOIN
        public.customers c ON i.customer_id = c.id
    WHERE
        i.id = p_invoice_id;

    -- Se a fatura não for encontrada, levanta um erro
    IF v_invoice_amount IS NULL THEN
        RAISE EXCEPTION 'Invoice not found with ID: %', p_invoice_id;
    END IF;

    -- 2. Inserir na tabela de transações
    INSERT INTO public.transactions (invoice_id, asaas_transaction_id, type, amount, status, provider_response, processed_at)
    VALUES (
        p_invoice_id,
        p_payment_payload ->> 'id', -- ID da transação de pagamento, se houver
        'PAYMENT',
        (p_payment_payload ->> 'value')::NUMERIC,
        'CONFIRMED',
        p_payment_payload,
        (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ
    );

    -- 3. Atualizar o status da fatura
    UPDATE public.invoices
    SET
        status = 'PAID',
        paid_at = (p_payment_payload ->> 'dateCreated')::TIMESTAMPTZ,
        updated_at = NOW()
    WHERE
        id = p_invoice_id;

    -- 4. Atualizar o status da assinatura do condomínio
    -- (Esta é uma lógica de exemplo, ajuste conforme sua regra de negócio)
    UPDATE public.condos
    SET
        subscription_status = 'active',
        updated_at = NOW()
    WHERE
        id = v_condo_id;

END;
$$;

-- Garantir que a service_role (usada pela Edge Function) possa executar esta função
GRANT EXECUTE ON FUNCTION public.handle_payment_confirmed(UUID, JSONB) TO service_role;

COMMIT;
