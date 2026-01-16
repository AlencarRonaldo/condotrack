-- ==================================================================================
-- VALIDAÇÃO COMPLETA: TODAS AS POLÍTICAS RLS
-- ==================================================================================
-- Execute este script para verificar se todas as tabelas estão protegidas
-- ==================================================================================

-- ==================================================================================
-- VERIFICAR SE HÁ POLÍTICAS INSECURAS (USING true ou WITH CHECK true)
-- ==================================================================================
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%true%' AND qual::text NOT LIKE '%service_role%' THEN '❌ INSEGURO - USING true'
    WHEN with_check::text LIKE '%true%' AND with_check::text NOT LIKE '%service_role%' THEN '❌ INSEGURO - WITH CHECK true'
    WHEN qual::text LIKE '%is_condo_active%' OR with_check::text LIKE '%is_condo_active%' THEN '✅ SEGURO - Usa is_condo_active'
    WHEN qual::text LIKE '%service_role%' THEN '✅ OK - Apenas service_role'
    ELSE '⚠️ Verificar manualmente'
  END AS status_seguranca,
  qual AS using_clause,
  with_check AS with_check_clause
FROM pg_policies
WHERE tablename IN ('packages', 'residents', 'staff', 'units', 'condos')
  AND policyname NOT LIKE '%service%' OR policyname LIKE '%service%'
ORDER BY tablename, cmd, policyname;

-- ==================================================================================
-- RESUMO POR TABELA
-- ==================================================================================
SELECT 
  tablename,
  COUNT(*) AS total_policies,
  COUNT(CASE WHEN qual::text LIKE '%is_condo_active%' OR with_check::text LIKE '%is_condo_active%' THEN 1 END) AS policies_com_is_condo_active,
  COUNT(CASE WHEN qual::text LIKE '%true%' AND qual::text NOT LIKE '%service_role%' THEN 1 END) AS policies_inseguras
FROM pg_policies
WHERE tablename IN ('packages', 'residents', 'staff', 'units')
GROUP BY tablename
ORDER BY tablename;

-- ==================================================================================
-- DETALHES POR TABELA
-- ==================================================================================

-- packages
SELECT '=== PACKAGES ===' AS info;
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'packages'
ORDER BY cmd, policyname;

-- residents
SELECT '=== RESIDENTS ===' AS info;
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'residents'
ORDER BY cmd, policyname;

-- staff
SELECT '=== STAFF ===' AS info;
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'staff'
ORDER BY cmd, policyname;

-- units
SELECT '=== UNITS ===' AS info;
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'units'
ORDER BY cmd, policyname;

-- ==================================================================================
-- RESULTADO ESPERADO
-- ==================================================================================
-- ✅ Todas as políticas de SELECT/INSERT/UPDATE devem usar is_condo_active()
-- ✅ Apenas políticas de service_role podem ter USING (service_role)
-- ❌ NÃO deve haver políticas com USING (true) ou WITH CHECK (true)
-- ==================================================================================
