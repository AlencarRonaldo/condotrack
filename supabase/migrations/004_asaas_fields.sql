-- ==================================================================================
-- MIGRAÇÃO 004: CAMPOS ASAAS (substitui Stripe no Billing)
-- ==================================================================================
-- Execute no SQL Editor do Supabase.
-- Não remove campos Stripe antigos (para não quebrar histórico); apenas adiciona Asaas.
-- ==================================================================================

-- Condos: IDs do Asaas
ALTER TABLE condos ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE condos ADD COLUMN IF NOT EXISTS asaas_last_payment_id TEXT;

-- Condos: Dados do pagador (obrigatórios para Asaas)
ALTER TABLE condos ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('CPF', 'CNPJ'));
ALTER TABLE condos ADD COLUMN IF NOT EXISTS document_number TEXT;

-- Subscriptions: IDs do Asaas
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

-- Invoices: IDs/URLs do Asaas
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_url TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_condos_asaas_customer ON condos(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas ON subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_payment ON invoices(asaas_payment_id);

