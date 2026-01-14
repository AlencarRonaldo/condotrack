-- ==================================================================================
-- FIX: Ajustar constraints da tabela condos para permitir 'trial'
-- ==================================================================================

-- Dropar constraint antiga se existir
ALTER TABLE condos DROP CONSTRAINT IF EXISTS condos_plan_type_check;

-- Adicionar nova constraint permitindo 'trial'
ALTER TABLE condos ADD CONSTRAINT condos_plan_type_check 
  CHECK (plan_type IN ('trial', 'basic', 'professional', 'premium'));

-- Dropar constraint antiga de subscription_status se existir
ALTER TABLE condos DROP CONSTRAINT IF EXISTS condos_subscription_status_check;

-- Adicionar nova constraint de subscription_status
ALTER TABLE condos ADD CONSTRAINT condos_subscription_status_check 
  CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'inactive', 'expired'));
