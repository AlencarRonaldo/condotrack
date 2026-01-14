-- ==================================================================================
-- CONDOTRACK PRO - DADOS DE TESTE (IDEMPOTENTE)
-- ==================================================================================
-- Seguro para rodar várias vezes; usa WHERE NOT EXISTS e apenas colunas do schema atual
-- ==================================================================================

-- Condomínio de teste
INSERT INTO condos (id, name, plan_type, staff_limit, unit_limit, trial_end_date, is_active, subscription_status)
SELECT 'condo-test-prod', 'Edifício Teste Produção', 'trial', 2, 50, NOW() - INTERVAL '1 day', true, 'expired'
WHERE NOT EXISTS (SELECT 1 FROM condos WHERE id = 'condo-test-prod');

-- Admin
INSERT INTO staff (condo_id, name, username, password, role, is_active)
SELECT 'condo-test-prod', 'Admin Teste', 'admin', 'admin123', 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE condo_id='condo-test-prod' AND username='admin');

-- Porteiro
INSERT INTO staff (condo_id, name, username, password, role, is_active)
SELECT 'condo-test-prod', 'Porteiro Teste', 'porteiro', 'port123', 'porteiro', true
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE condo_id='condo-test-prod' AND username='porteiro');

-- Unidades (simplificado: 101 e 201)
INSERT INTO units (condo_id, number, block, floor, is_active)
SELECT 'condo-test-prod', '101', 'A', 1, true
WHERE NOT EXISTS (SELECT 1 FROM units WHERE condo_id = 'condo-test-prod' AND number = '101');

INSERT INTO units (condo_id, number, block, floor, is_active)
SELECT 'condo-test-prod', '201', 'A', 2, true
WHERE NOT EXISTS (SELECT 1 FROM units WHERE condo_id = 'condo-test-prod' AND number = '201');

-- Moradores (preenche unit para satisfazer NOT NULL)
INSERT INTO residents (condo_id, unit_id, unit, name, phone, is_owner, is_active)
SELECT 'condo-test-prod', u.id, u.number, 'João Silva', '11999999999', true, true
FROM units u
WHERE u.condo_id = 'condo-test-prod' AND u.number = '101'
  AND NOT EXISTS (SELECT 1 FROM residents r WHERE r.condo_id='condo-test-prod' AND r.name='João Silva');

INSERT INTO residents (condo_id, unit_id, unit, name, phone, is_owner, is_active)
SELECT 'condo-test-prod', u.id, u.number, 'Maria Santos', '11988888888', false, true
FROM units u
WHERE u.condo_id = 'condo-test-prod' AND u.number = '201'
  AND NOT EXISTS (SELECT 1 FROM residents r WHERE r.condo_id='condo-test-prod' AND r.name='Maria Santos');

-- Encomendas de exemplo
INSERT INTO packages (condo_id, unit_id, unit, unit_number, recipient, type, description, status, created_at)
SELECT 'condo-test-prod', u.id, u.number, u.number, 'João Silva', 'Caixa', 'Pacote Amazon', 'pending', NOW() - INTERVAL '2 hours'
FROM units u
WHERE u.condo_id = 'condo-test-prod' AND u.number = '101'
  AND NOT EXISTS (
    SELECT 1 FROM packages p WHERE p.condo_id='condo-test-prod' AND p.recipient='João Silva' AND p.unit_number='101'
  );

INSERT INTO packages (condo_id, unit_id, unit, unit_number, recipient, type, description, status, created_at)
SELECT 'condo-test-prod', u.id, u.number, u.number, 'Maria Santos', 'Envelope', 'Documento Correios', 'pending', NOW() - INTERVAL '1 hour'
FROM units u
WHERE u.condo_id = 'condo-test-prod' AND u.number = '201'
  AND NOT EXISTS (
    SELECT 1 FROM packages p WHERE p.condo_id='condo-test-prod' AND p.recipient='Maria Santos' AND p.unit_number='201'
  );

-- ==================================================================================
-- FIM
-- Credenciais:
-- Condo ID: condo-test-prod
-- Admin: admin / admin123
-- Porteiro: porteiro / port123
-- ==================================================================================
