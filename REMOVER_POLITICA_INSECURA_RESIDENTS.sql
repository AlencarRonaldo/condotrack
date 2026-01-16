-- ==================================================================================
-- REMOVER POLÍTICA INSECURA DE RESIDENTS
-- ==================================================================================
-- Execute este script após identificar qual política é insegura
-- ==================================================================================

BEGIN;

-- ==================================================================================
-- REMOVER POLÍTICAS INSECURAS COMUNS
-- ==================================================================================

-- Remove política "Isolamento por condo" se existir
DROP POLICY IF EXISTS "Isolamento por condo" ON public.residents;

-- Remove política "Permitir acesso público total" se existir
DROP POLICY IF EXISTS "Permitir acesso público total" ON public.residents;

-- Remove política "Acesso total a moradores" (INSEGURA - permite tudo)
DROP POLICY IF EXISTS "Acesso total a moradores" ON public.residents;

-- ==================================================================================
-- Se a política insegura tiver outro nome, adicione aqui:
-- DROP POLICY IF EXISTS "NOME_DA_POLITICA" ON public.residents;
-- ==================================================================================

COMMIT;

-- ==================================================================================
-- VALIDAR APÓS REMOVER
-- ==================================================================================
-- Execute este SELECT para verificar se a política insegura foi removida:
--
-- SELECT 
--   tablename,
--   COUNT(*) AS total_policies,
--   COUNT(CASE WHEN qual::text LIKE '%is_condo_active%' OR with_check::text LIKE '%is_condo_active%' THEN 1 END) AS usa_is_condo_active,
--   COUNT(CASE WHEN qual::text LIKE '%service_role%' THEN 1 END) AS apenas_service_role,
--   COUNT(CASE WHEN (qual::text LIKE '%true%' OR with_check::text LIKE '%true%') 
--     AND qual::text NOT LIKE '%service_role%' AND with_check::text NOT LIKE '%service_role%' THEN 1 END) AS inseguras
-- FROM pg_policies
-- WHERE tablename = 'residents'
-- GROUP BY tablename;
--
-- Deve mostrar: inseguras = 0
-- ==================================================================================
