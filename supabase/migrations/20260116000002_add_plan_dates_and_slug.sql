-- ==================================================================================
-- MIGRAÇÃO: ADICIONAR CAMPOS DE PLANO E VENCIMENTO
-- ==================================================================================
-- Esta migração adiciona campos necessários para controle completo de planos:
-- - Campos em condos: plan_start_date, plan_end_date, last_payment_date
-- - Campo em invoices: plan_slug
-- ==================================================================================

BEGIN;

-- ==================================================================================
-- ADICIONAR CAMPOS EM CONDOS
-- ==================================================================================

-- Data de início do plano atual
ALTER TABLE public.condos 
ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMPTZ;

-- Data de vencimento do plano atual
ALTER TABLE public.condos 
ADD COLUMN IF NOT EXISTS plan_end_date TIMESTAMPTZ;

-- Data do último pagamento confirmado
ALTER TABLE public.condos 
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- Comentários para documentação
COMMENT ON COLUMN public.condos.plan_start_date IS 'Data de início do plano atual (não trial).';
COMMENT ON COLUMN public.condos.plan_end_date IS 'Data de vencimento do plano atual. Usado para bloquear acesso quando expirado.';
COMMENT ON COLUMN public.condos.last_payment_date IS 'Data do último pagamento confirmado (PAID).';

-- ==================================================================================
-- ADICIONAR CAMPO EM INVOICES
-- ==================================================================================

-- Slug do plano contratado nesta invoice
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS plan_slug TEXT CHECK (plan_slug IN ('basic', 'professional', 'premium'));

-- Comentário para documentação
COMMENT ON COLUMN public.invoices.plan_slug IS 'Slug do plano contratado nesta invoice (basic, professional, premium).';

-- Criar índice para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_invoices_plan_slug ON public.invoices(plan_slug);

-- ==================================================================================
-- VALIDAÇÃO
-- ==================================================================================

-- Verificar se as colunas foram criadas
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND (
    (table_name = 'condos' AND column_name IN ('plan_start_date', 'plan_end_date', 'last_payment_date'))
    OR (table_name = 'invoices' AND column_name = 'plan_slug')
  )
ORDER BY table_name, column_name;

COMMIT;
