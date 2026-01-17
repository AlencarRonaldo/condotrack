-- ==================================================================================
-- GARANTIR QUE PLANOS EXISTAM
-- ==================================================================================
-- Este script garante que os planos básicos existam na tabela plans
-- Execute este script se receber erro 404 "Plano não encontrado"

-- Inserir planos padrão se não existirem (usando DO NOTHING para evitar duplicatas)
INSERT INTO plans (name, slug, price_monthly, price_yearly, staff_limit, unit_limit, features, display_order, is_active)
VALUES
  ('BÁSICO', 'basic', 99.00, 990.00, 2, 50, 
   '["Até 2 porteiros", "Até 50 unidades", "Gestão de encomendas", "Notificação WhatsApp", "Histórico 90 dias"]'::jsonb, 1, true),
  ('PRO', 'professional', 199.00, 1990.00, 5, 150, 
   '["Até 5 porteiros", "Até 150 unidades", "Tudo do Básico", "Relatórios avançados", "Exportação PDF/CSV", "Histórico ilimitado", "Suporte prioritário"]'::jsonb, 2, true),
  ('PREMIUM', 'premium', 349.00, 3490.00, 10, 9999, 
   '["Até 10 porteiros", "Unidades ilimitadas", "Tudo do PRO", "API de integração", "Suporte 24/7", "SLA 99.9%", "Onboarding dedicado"]'::jsonb, 3, true)
ON CONFLICT (slug) DO NOTHING;

-- Verificar se os planos foram criados
SELECT 
  slug,
  name,
  price_monthly,
  staff_limit,
  unit_limit,
  is_active
FROM plans
WHERE slug IN ('basic', 'professional', 'premium')
ORDER BY display_order;
