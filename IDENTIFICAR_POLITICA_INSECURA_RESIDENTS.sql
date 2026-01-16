-- ==================================================================================
-- IDENTIFICAR POLÍTICA INSECURA EM RESIDENTS
-- ==================================================================================
-- Execute este script para encontrar a política insegura
-- ==================================================================================

SELECT 
  policyname,
  cmd AS operation,
  qual AS using_clause,
  with_check AS with_check_clause,
  CASE 
    WHEN qual::text LIKE '%true%' AND qual::text NOT LIKE '%service_role%' THEN '❌ INSEGURO - USING true'
    WHEN with_check::text LIKE '%true%' AND with_check::text NOT LIKE '%service_role%' THEN '❌ INSEGURO - WITH CHECK true'
    WHEN qual::text LIKE '%is_condo_active%' OR with_check::text LIKE '%is_condo_active%' THEN '✅ SEGURO'
    WHEN qual::text LIKE '%service_role%' THEN '✅ OK - service_role'
    ELSE '⚠️ Verificar'
  END AS status
FROM pg_policies
WHERE tablename = 'residents'
ORDER BY cmd, policyname;

-- ==================================================================================
-- Após identificar, execute o script REMOVER_POLITICA_INSECURA_RESIDENTS.sql
-- ==================================================================================
