-- Verificar dados na tabela plans
SELECT * FROM plans;

-- Verificar se há algum plano com plan_name = 'BÁSICO'
SELECT * FROM plans WHERE name = 'BÁSICO' OR plan_name = 'BÁSICO';