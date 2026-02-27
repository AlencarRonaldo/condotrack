-- ==================================================================================
-- MIGRATION: Admin demo com acesso vitalício
-- ==================================================================================
-- Cria login admin@demo.condotrack.com no condo demo com acesso permanente
-- ==================================================================================

-- Passo 1: Atualizar username do admin demo para email padrao
UPDATE staff
SET username = 'admin@demo.condotrack.com'
WHERE condo_id = 'demo-condo-001'
  AND role = 'admin'
  AND id = 1;

-- Passo 2: Garantir que a senha é '123' (texto plano - será migrada para bcrypt no primeiro login)
UPDATE staff
SET password = '123'
WHERE condo_id = 'demo-condo-001'
  AND username = 'admin@demo.condotrack.com';

-- Passo 3: Dar acesso vitalício ao condomínio demo
UPDATE condos
SET is_active = true,
    subscription_status = 'active',
    trial_end_date = NULL,
    plan_type = 'premium',
    staff_limit = 999,
    unit_limit = 9999
WHERE id = 'demo-condo-001';
