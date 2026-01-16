-- ==================================================================================
-- VALIDAÇÃO DA MIGRAÇÃO: BLOQUEIO SEGURO POR TRIAL
-- ==================================================================================
-- Execute este script no SQL Editor do Supabase para validar que a migração funcionou
-- ==================================================================================

-- ==================================================================================
-- TESTE 1: Verificar se a função foi criada
-- ==================================================================================
SELECT 
  proname AS function_name,
  pg_get_function_result(oid) AS return_type,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'is_condo_active'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Deve retornar 1 linha com os detalhes da função

-- ==================================================================================
-- TESTE 2: Testar função com condomínio existente (trial ativo)
-- ==================================================================================
-- Substitua '0c184a15-84e4-4515-b63d-a3ede95aaa8f' pelo ID do seu condomínio
SELECT 
  id,
  name,
  subscription_status,
  trial_end_date,
  is_active,
  public.is_condo_active(id) AS is_active_result
FROM public.condos
WHERE id = '0c184a15-84e4-4515-b63d-a3ede95aaa8f';

-- Deve retornar TRUE para is_active_result se trial ainda está ativo

-- ==================================================================================
-- TESTE 3: Verificar políticas RLS criadas
-- ==================================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('packages', 'residents', 'staff', 'units', 'condos')
  AND policyname LIKE '%select%' OR policyname LIKE '%insert%' OR policyname LIKE '%update%'
ORDER BY tablename, policyname;

-- Deve retornar várias políticas, incluindo as que usam is_condo_active()

-- ==================================================================================
-- TESTE 4: Verificar se políticas estão usando a função is_condo_active
-- ==================================================================================
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%is_condo_active%' THEN '✅ Usa is_condo_active'
    WHEN with_check::text LIKE '%is_condo_active%' THEN '✅ Usa is_condo_active'
    ELSE '❌ Não usa is_condo_active'
  END AS status
FROM pg_policies
WHERE tablename IN ('packages', 'residents', 'staff', 'units')
ORDER BY tablename, policyname;

-- Todas as políticas devem mostrar "✅ Usa is_condo_active"

-- ==================================================================================
-- TESTE 5: Verificar todas as políticas de uma tabela específica (packages)
-- ==================================================================================
SELECT 
  policyname,
  cmd AS operation,
  qual AS using_clause,
  with_check AS with_check_clause
FROM pg_policies
WHERE tablename = 'packages'
ORDER BY cmd, policyname;

-- Deve mostrar políticas que usam is_condo_active() nas cláusulas USING e WITH CHECK

-- ==================================================================================
-- RESUMO: Se todos os testes passaram, a migração foi aplicada com sucesso!
-- ==================================================================================
-- ✅ Função is_condo_active criada
-- ✅ Políticas RLS atualizadas
-- ✅ Políticas usando is_condo_active()
-- ✅ Bloqueio automático quando trial expira
-- ==================================================================================
