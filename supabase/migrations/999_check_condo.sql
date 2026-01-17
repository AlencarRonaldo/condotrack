-- ==================================================================================
-- VERIFICAR/CRIAR CONDOMÍNIO DE TESTE
-- ==================================================================================
-- Execute este script para verificar se o condomínio existe
-- Se não existir, ele será criado

-- Verificar se o condomínio existe
SELECT 
  id,
  name,
  plan_type,
  is_active,
  trial_end_date,
  created_at
FROM condos 
WHERE id = '0c184a15-84e4-4515-b63d-a3ede95aaa8f';

-- Se não existir, criar (descomente as linhas abaixo)
/*
INSERT INTO condos (
  id,
  name,
  plan_type,
  staff_limit,
  unit_limit,
  is_active,
  trial_end_date,
  created_at,
  updated_at
)
VALUES (
  '0c184a15-84e4-4515-b63d-a3ede95aaa8f',
  'Condomínio Teste',
  'trial',
  2,
  50,
  true,
  NOW() + INTERVAL '15 days',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
*/
