-- ==================================================================================
-- SCRIPT COMPLETO: ADICIONAR COLUNAS E ATUALIZAR CONDOMÍNIO DE TESTE
-- ==================================================================================
-- Execute este script no SQL Editor do Supabase
-- ==================================================================================

-- 1. Adicionar colunas se não existirem
ALTER TABLE condos ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('CPF', 'CNPJ'));
ALTER TABLE condos ADD COLUMN IF NOT EXISTS document_number TEXT;

-- 2. Atualizar condomínio de teste
UPDATE condos SET
  name = 'Edifício Teste Produção',
  plan_type = 'trial',
  staff_limit = 2,
  unit_limit = 50,
  trial_end_date = NOW() - INTERVAL '1 day',
  is_active = true,
  subscription_status = 'expired',
  document_type = 'CNPJ',
  document_number = '12345678000199',
  updated_at = NOW()
WHERE id = 'condo-test-prod';

-- 3. Verificar resultado
SELECT 
  id, 
  name, 
  plan_type,
  subscription_status,
  document_type, 
  document_number, 
  is_active,
  trial_end_date
FROM condos 
WHERE id = 'condo-test-prod';
