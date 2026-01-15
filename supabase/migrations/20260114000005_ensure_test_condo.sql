-- ==================================================================================
-- MIGRAÇÃO: GARANTIR CONDOMÍNIO DE TESTE EXISTE COM TODOS OS CAMPOS
-- ==================================================================================
-- Garante que o condomínio de teste existe com todos os campos necessários
-- ==================================================================================

DO $$
BEGIN
  -- Verificar se o condomínio existe
  IF EXISTS (SELECT 1 FROM condos WHERE id = 'condo-test-prod') THEN
    -- Atualizar condomínio existente
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
  ELSE
    -- Inserir novo condomínio
    INSERT INTO condos (
      id, 
      name, 
      plan_type, 
      staff_limit, 
      unit_limit, 
      trial_end_date, 
      is_active, 
      subscription_status,
      document_type,
      document_number
    )
    VALUES (
      'condo-test-prod',
      'Edifício Teste Produção',
      'trial',
      2,
      50,
      NOW() - INTERVAL '1 day',
      true,
      'expired',
      'CNPJ',
      '12345678000199'
    );
  END IF;
END $$;
