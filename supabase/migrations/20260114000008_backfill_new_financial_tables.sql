-- ==================================================================================
-- MIGRAÇÃO: BACKFILL DAS NOVAS TABELAS FINANCEIRAS
--
-- Descrição:
-- Este script migra os dados financeiros existentes da estrutura antiga para a nova.
-- Ele preenche as tabelas 'customers', 'invoices' e 'transactions' com base
-- nos dados de 'condos' e 'invoices_legacy'.
--
-- IMPORTANTE: Faça um backup do banco de dados antes de executar este script.
--
-- Passos:
-- 1. Popula a tabela 'customers' a partir dos 'condos' que já têm um 'asaas_customer_id'.
-- 2. Migra os dados da 'invoices_legacy' para a nova tabela 'invoices'.
-- 3. Cria transações iniciais na tabela 'transactions' para as faturas que já foram pagas.
-- ==================================================================================

BEGIN;

-- Desabilitar temporariamente RLS para permitir que o script de migração funcione
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- Passo 1: Preencher a tabela 'customers' com dados existentes da 'condos'
-- Para cada condomínio que já interagiu com o Asaas, criamos um registro de cliente.
INSERT INTO public.customers (condo_id, asaas_customer_id, created_at, updated_at)
SELECT
    id AS condo_id,
    asaas_customer_id,
    NOW() as created_at,
    NOW() as updated_at
FROM
    public.condos
WHERE
    asaas_customer_id IS NOT NULL
    AND id NOT IN (SELECT condo_id FROM public.customers) -- Evita duplicatas se o script for rodado novamente
ON CONFLICT (condo_id) DO NOTHING;


-- Passo 2: Migrar dados da 'invoices_legacy' para a nova 'invoices'
-- Mapeia os campos da tabela antiga para a nova estrutura.
INSERT INTO public.invoices (customer_id, asaas_payment_id, status, amount, due_date, paid_at, canceled_at, payment_link, billing_type, created_at, updated_at)
SELECT
    c.id AS customer_id,
    il.asaas_payment_id,
    -- Define o status com base nas datas e status antigos
    CASE
        WHEN il.status = 'canceled' THEN 'CANCELED'
        WHEN il.paid_at IS NOT NULL THEN 'PAID'
        WHEN il.due_date < NOW() AND il.paid_at IS NULL THEN 'OVERDUE'
        ELSE COALESCE(UPPER(il.status), 'PENDING')
    END AS status,
    il.amount,
    il.due_date,
    il.paid_at,
    il.canceled_at,
    il.invoice_url AS payment_link,
    il.billing_type,
    il.created_at,
    il.updated_at
FROM
    public.invoices_legacy il
JOIN
    public.condos co ON il.condo_id = co.id -- Junta com condos para encontrar o asaas_customer_id
JOIN
    public.customers c ON co.id = c.condo_id -- Junta com customers para obter o novo customer_id
WHERE
    il.asaas_payment_id IS NOT NULL
    AND il.asaas_payment_id NOT IN (SELECT asaas_payment_id FROM public.invoices WHERE asaas_payment_id IS NOT NULL) -- Evita duplicatas
ON CONFLICT (asaas_payment_id) DO NOTHING;


-- Passo 3: Criar transações de pagamento para faturas já pagas
-- Para cada fatura migrada com status 'PAID', criamos um registro de transação correspondente.
INSERT INTO public.transactions (invoice_id, type, amount, status, processed_at, created_at)
SELECT
    i.id AS invoice_id,
    'PAYMENT' AS type,
    i.amount,
    'CONFIRMED' AS status,
    i.paid_at AS processed_at,
    i.paid_at AS created_at -- Usa a data de pagamento como data de criação da transação
FROM
    public.invoices i
WHERE
    i.status = 'PAID'
    AND i.paid_at IS NOT NULL
    AND i.id NOT IN (SELECT invoice_id FROM public.transactions WHERE invoice_id = i.id) -- Evita duplicatas
ON CONFLICT (asaas_transaction_id) DO NOTHING; -- 'asaas_transaction_id' seria o ideal, mas não o temos, então controlamos pelo invoice_id

-- Reabilitar RLS após a conclusão do script
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

COMMIT;
