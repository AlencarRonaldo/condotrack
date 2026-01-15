-- ==================================================================================
-- MIGRAÇÃO: REESTRUTURAÇÃO DAS TABELAS FINANCEIRAS PARA ASAAS
--
-- Descrição:
-- Esta migração implementa um modelo de dados financeiros mais robusto e normalizado,
-- separando as responsabilidades entre clientes, cobranças, e transações, além de
-- adicionar uma tabela dedicada para garantir o processamento idempotente de webhooks.
--
-- Passos:
-- 1. Renomeia a tabela 'invoices' existente para 'invoices_legacy' para backup.
-- 2. Cria a tabela 'customers' para armazenar os dados do cliente financeiro (1-para-1 com condos).
-- 3. Cria a nova tabela 'invoices' para representar as cobranças.
-- 4. Cria a tabela 'transactions' como um log imutável de eventos de pagamento.
-- 5. Cria a tabela 'asaas_webhook_events' para garantir idempotência dos webhooks.
-- ==================================================================================

BEGIN;

-- Passo 1: Renomear a tabela de invoices antiga para preservar os dados
ALTER TABLE IF EXISTS public.invoices RENAME TO invoices_legacy;

-- Passo 2: Criar a tabela de Clientes (Customers)
-- Centraliza os dados do cliente Asaas, ligado ao condomínio.
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condo_id TEXT NOT NULL UNIQUE REFERENCES public.condos(id) ON DELETE CASCADE,
    asaas_customer_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.customers IS 'Armazena a representação financeira dos condomínios como clientes no gateway de pagamento.';
COMMENT ON COLUMN public.customers.condo_id IS 'FK para a tabela de condomínios.';
COMMENT ON COLUMN public.customers.asaas_customer_id IS 'ID do cliente no Asaas.';

CREATE INDEX IF NOT EXISTS idx_customers_condo_id ON public.customers(condo_id);
CREATE INDEX IF NOT EXISTS idx_customers_asaas_customer_id ON public.customers(asaas_customer_id);


-- Passo 3: Criar a nova tabela de Faturas (Invoices)
-- Representa uma cobrança gerada para um cliente.
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL, -- Se houver tabela de assinaturas
    asaas_payment_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING', -- Ex: PENDING, PAID, OVERDUE, CANCELED
    amount NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    payment_link TEXT,
    barcode TEXT,
    pix_qr_code TEXT,
    billing_type TEXT, -- Ex: BOLETO, PIX, CREDIT_CARD
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.invoices IS 'Representa as cobranças (faturas) geradas para os clientes.';
COMMENT ON COLUMN public.invoices.customer_id IS 'FK para a tabela de clientes.';
COMMENT ON COLUMN public.invoices.asaas_payment_id IS 'ID do pagamento/cobrança no Asaas.';
COMMENT ON COLUMN public.invoices.status IS 'Status atual da cobrança (ex: PENDING, PAID, OVERDUE).';

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_payment_id ON public.invoices(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);


-- Passo 4: Criar a tabela de Transações (Transactions)
-- Log imutável de todas as interações financeiras (pagamentos, estornos, etc).
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    asaas_transaction_id TEXT UNIQUE,
    type TEXT NOT NULL, -- Ex: PAYMENT, REFUND, CHARGEBACK
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL, -- Ex: CONFIRMED, FAILED, PENDING
    provider_response JSONB, -- Resposta completa do gateway para auditoria
    processed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.transactions IS 'Log imutável de eventos financeiros (pagamentos, estornos) para cada fatura.';
COMMENT ON COLUMN public.transactions.invoice_id IS 'FK para a fatura relacionada.';
COMMENT ON COLUMN public.transactions.type IS 'Tipo de transação (ex: PAYMENT, REFUND).';
COMMENT ON COLUMN public.transactions.provider_response IS 'Payload JSON do gateway para fins de auditoria.';

CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);


-- Passo 5: Criar a tabela de Eventos de Webhook
-- Garante o processamento idempotente de webhooks do Asaas.
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asaas_event_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- Ex: PAYMENT_CONFIRMED, PAYMENT_RECEIVED
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, PROCESSED, FAILED
    processed_at TIMESTAMPTZ,
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.asaas_webhook_events IS 'Armazena eventos de webhook do Asaas para processamento idempotente.';
COMMENT ON COLUMN public.asaas_webhook_events.asaas_event_id IS 'ID único do evento vindo do Asaas, para garantir idempotência.';
COMMENT ON COLUMN public.asaas_webhook_events.status IS 'Status do processamento do evento (RECEIVED, PROCESSED, FAILED).';


-- Habilitar RLS nas novas tabelas (as políticas serão criadas em um passo posterior)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

COMMIT;
