-- ==================================================================================
-- VALIDAÇÃO: RESIDENTS E STAFF
-- ==================================================================================
-- Execute este script para verificar se residents e staff estão protegidos
-- ==================================================================================

-- ==================================================================================
-- RESIDENTS: Verificar todas as políticas
-- ==================================================================================
SELECT '=== RESIDENTS ===' AS info;
SELECT 
  policyname,
  cmd AS operation,
  qual AS using_clause,
  with_check AS with_check_clause,
  CASE 
    WHEN qual::text LIKE '%is_condo_active%' OR with_check::text LIKE '%is_condo_active%' THEN '✅ SEGURO'
    WHEN qual::text LIKE '%service_role%' THEN '✅ OK - service_role'
    WHEN qual::text LIKE '%true%' OR with_check::text LIKE '%true%' THEN '❌ INSEGURO'
    ELSE '⚠️ Verificar'
  END AS status
FROM pg_policies
WHERE tablename = 'residents'
ORDER BY cmd, policyname;

-- ==================================================================================
-- STAFF: Verificar todas as políticas
-- ==================================================================================
SELECT '=== STAFF ===' AS info;
SELECT 
  policyname,
  cmd AS operation,
  qual AS using_clause,
  with_check AS with_check_clause,
  CASE 
    WHEN qual::text LIKE '%is_condo_active%' OR with_check::text LIKE '%is_condo_active%' THEN '✅ SEGURO'
    WHEN qual::text LIKE '%service_role%' THEN '✅ OK - service_role'
    WHEN qual::text LIKE '%true%' OR with_check::text LIKE '%true%' THEN '❌ INSEGURO'
    ELSE '⚠️ Verificar'
  END AS status
FROM pg_policies
WHERE tablename = 'staff'
ORDER BY cmd, policyname;

-- ==================================================================================
-- RESUMO FINAL: Todas as tabelas
-- ==================================================================================
SELECT 
  tablename,
  COUNT(*) AS total_policies,
  COUNT(CASE WHEN qual::text LIKE '%is_condo_active%' OR with_check::text LIKE '%is_condo_active%' THEN 1 END) AS usa_is_condo_active,
  COUNT(CASE WHEN qual::text LIKE '%service_role%' THEN 1 END) AS apenas_service_role,
  COUNT(CASE WHEN (qual::text LIKE '%true%' OR with_check::text LIKE '%true%') 
    AND qual::text NOT LIKE '%service_role%' AND with_check::text NOT LIKE '%service_role%' THEN 1 END) AS inseguras
FROM pg_policies
WHERE tablename IN ('packages', 'residents', 'staff', 'units')
GROUP BY tablename
ORDER BY tablename;

-- ==================================================================================
-- RESULTADO ESPERADO
-- ==================================================================================
-- ✅ Todas as tabelas devem ter políticas usando is_condo_active()
-- ✅ Políticas de service_role são OK (necessárias para Edge Functions)
-- ❌ NÃO deve haver políticas inseguras (USING true ou WITH CHECK true)
-- ==================================================================================
