-- ==================================================================================
-- CRIAR TABELAS FINANCEIRAS SE NÃO EXISTIREM
-- ==================================================================================
-- Execute este script no SQL Editor do Supabase se receber erro:
-- "Could not find the table 'public.customers' in the schema cache"
-- ==================================================================================

BEGIN;

-- 1. Criar a tabela de Clientes (Customers)
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

-- 2. Renomear tabela invoices antiga se existir (para não perder dados)
-- Se a tabela invoices já existe mas não tem customer_id, renomeamos para invoices_legacy
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invoices'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'invoices' 
        AND column_name = 'customer_id'
    ) THEN
        -- Renomear tabela antiga
        ALTER TABLE IF EXISTS public.invoices RENAME TO invoices_legacy;
        RAISE NOTICE 'Tabela invoices antiga renomeada para invoices_legacy';
    END IF;
END $$;

-- 3. Criar a tabela de Faturas (Invoices) se não existir
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    subscription_id UUID, -- Referência opcional para subscriptions (se existir)
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

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas básicas para service_role (Edge Functions)
-- Nota: Você pode precisar criar políticas mais específicas depois
DROP POLICY IF EXISTS "allow_service_role_all_customers" ON public.customers;
CREATE POLICY "allow_service_role_all_customers" ON public.customers FOR ALL 
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "allow_service_role_all_invoices" ON public.invoices;
CREATE POLICY "allow_service_role_all_invoices" ON public.invoices FOR ALL 
    USING (auth.role() = 'service_role');

COMMIT;

-- Verificar se as tabelas foram criadas
SELECT 
    table_name,
    '✅ Criada' as status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('customers', 'invoices')
ORDER BY table_name;
