-- ==================================================================================
-- FIX: Remover referências antigas ao Stripe e ajustar para Asaas
-- ==================================================================================

-- Dropar índices antigos do Stripe se existirem
DROP INDEX IF EXISTS idx_subscriptions_stripe;
DROP INDEX IF EXISTS idx_invoices_stripe;
DROP INDEX IF EXISTS idx_condos_stripe_customer;

-- Renomear colunas Stripe para Asaas se existirem
DO $$
BEGIN
  -- subscriptions (dropar colunas antigas do stripe se existirem)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE subscriptions DROP COLUMN stripe_subscription_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='stripe_customer_id') THEN
    ALTER TABLE subscriptions DROP COLUMN stripe_customer_id;
  END IF;
  
  -- invoices (dropar colunas antigas do stripe se existirem)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='stripe_invoice_id') THEN
    ALTER TABLE invoices DROP COLUMN stripe_invoice_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='stripe_payment_intent_id') THEN
    ALTER TABLE invoices DROP COLUMN stripe_payment_intent_id;
  END IF;
  
  -- condos (dropar colunas antigas do stripe se existirem)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condos' AND column_name='stripe_customer_id') THEN
    ALTER TABLE condos DROP COLUMN stripe_customer_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='condos' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE condos DROP COLUMN stripe_subscription_id;
  END IF;
  
  -- plans
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plans' AND column_name='stripe_price_id_monthly') THEN
    ALTER TABLE plans DROP COLUMN stripe_price_id_monthly;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plans' AND column_name='stripe_price_id_yearly') THEN
    ALTER TABLE plans DROP COLUMN stripe_price_id_yearly;
  END IF;
END $$;

-- Criar índices para Asaas
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas ON subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_asaas ON invoices(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_condos_asaas_customer ON condos(asaas_customer_id);
