-- ==================================================================================
-- REMOVER POLÍTICAS INSECURAS QUE PERMITEM ACESSO TOTAL
-- ==================================================================================
-- Execute este script no SQL Editor do Supabase para remover políticas antigas
-- que permitem acesso total e podem anular o bloqueio por trial
-- ==================================================================================

BEGIN;

-- ==================================================================================
-- REMOVER POLÍTICAS INSECURAS DA TABELA packages
-- ==================================================================================

-- Remove política "Isolamento por condo" que permite tudo (USING true)
DROP POLICY IF EXISTS "Isolamento por condo" ON public.packages;

-- Remove política "Permitir acesso público total" que permite tudo
DROP POLICY IF EXISTS "Permitir acesso público total" ON public.packages;

-- ==================================================================================
-- VERIFICAR E REMOVER POLÍTICAS SIMILARES EM OUTRAS TABELAS
-- ==================================================================================

-- residents
DROP POLICY IF EXISTS "Isolamento por condo" ON public.residents;
DROP POLICY IF EXISTS "Permitir acesso público total" ON public.residents;

-- staff
DROP POLICY IF EXISTS "Isolamento por condo" ON public.staff;
DROP POLICY IF EXISTS "Permitir acesso público total" ON public.staff;

-- units
DROP POLICY IF EXISTS "Isolamento por condo" ON public.units;
DROP POLICY IF EXISTS "Permitir acesso público total" ON public.units;

-- ==================================================================================
-- VERIFICAR SE HÁ OUTRAS POLÍTICAS COM USING (true) OU WITH CHECK (true)
-- ==================================================================================
-- Execute este SELECT após remover as políticas acima para verificar se há mais:
-- 
-- SELECT 
--   tablename,
--   policyname,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE (qual::text LIKE '%true%' OR with_check::text LIKE '%true%')
--   AND tablename IN ('packages', 'residents', 'staff', 'units')
--   AND policyname NOT LIKE '%service%';
--
-- Se retornar resultados, essas políticas também devem ser removidas

COMMIT;

-- ==================================================================================
-- VALIDAÇÃO APÓS REMOVER
-- ==================================================================================
-- Execute este SELECT para verificar se as políticas inseguras foram removidas:
--
-- SELECT 
--   tablename,
--   policyname,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename = 'packages'
-- ORDER BY policyname;
--
-- Deve mostrar apenas:
-- - packages_service_all (service_role - OK)
-- - packages_delete (service_role - OK)
-- - packages_insert (usa is_condo_active - OK)
-- - packages_select_same_condo (usa is_condo_active - OK)
-- - packages_update (usa is_condo_active - OK)
--
-- NÃO deve ter políticas com USING (true) ou WITH CHECK (true)
-- ==================================================================================
