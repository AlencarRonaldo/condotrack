-- ==================================================================================
-- FIX: Ajustar tabela plans para estrutura esperada
-- ==================================================================================

-- Renomear plan_name para name se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='plans' AND column_name='plan_name'
  ) THEN
    ALTER TABLE plans RENAME COLUMN plan_name TO name;
  END IF;
END $$;

-- Adicionar colunas faltantes
ALTER TABLE plans ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_yearly NUMERIC(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features JSONB;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Renomear price_mrr para price_monthly se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='plans' AND column_name='price_mrr'
  ) THEN
    ALTER TABLE plans RENAME COLUMN price_mrr TO price_monthly;
  END IF;
END $$;

-- Adicionar constraint única em slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'plans_slug_key'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Popular slugs se estiverem vazios
UPDATE plans SET slug = 'basic' WHERE (name ILIKE '%basic%' OR name ILIKE '%básico%') AND slug IS NULL;
UPDATE plans SET slug = 'professional' WHERE name ILIKE '%pro%' AND slug IS NULL;
UPDATE plans SET slug = 'premium' WHERE name ILIKE '%premium%' AND slug IS NULL;

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
