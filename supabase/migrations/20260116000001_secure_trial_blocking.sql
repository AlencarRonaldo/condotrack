-- ==================================================================================
-- MIGRAÇÃO: BLOQUEIO SEGURO POR TRIAL EXPIrado
-- ==================================================================================
-- Esta migração implementa bloqueio REAL no banco de dados (RLS) para impedir
-- acesso quando o trial expira ou a conta está inativa.
-- 
-- IMPORTANTE: Esta é a ÚNICA camada de segurança real. Frontend pode ser bypassado.
-- ==================================================================================

BEGIN;

-- ==================================================================================
-- FUNÇÃO AUXILIAR: Verifica se condomínio está ativo (trial válido ou assinatura ativa)
-- ==================================================================================
CREATE OR REPLACE FUNCTION public.is_condo_active(condo_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  condo_record RECORD;
BEGIN
  -- Busca dados do condomínio
  SELECT 
    subscription_status,
    trial_end_date,
    is_active
  INTO condo_record
  FROM public.condos
  WHERE id = condo_id_param;
  
  -- Se não encontrou, bloqueia acesso
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Conta inativa manualmente (admin desativou)
  IF condo_record.is_active = FALSE THEN
    RETURN FALSE;
  END IF;
  
  -- Se tem assinatura ativa, permite acesso total
  IF condo_record.subscription_status = 'active' THEN
    RETURN TRUE;
  END IF;
  
  -- Se está em trial, verifica se expirou
  IF condo_record.subscription_status = 'trial' THEN
    -- Trial sem data = inválido, bloqueia
    IF condo_record.trial_end_date IS NULL THEN
      RETURN FALSE;
    END IF;
    
    -- Compara em UTC para evitar problemas de timezone
    -- Se NOW() > trial_end_date, trial expirou
    IF (NOW() AT TIME ZONE 'UTC') > (condo_record.trial_end_date AT TIME ZONE 'UTC') THEN
      RETURN FALSE; -- Trial expirado
    END IF;
    
    RETURN TRUE; -- Trial ainda ativo
  END IF;
  
  -- Outros status (expired, canceled, past_due, inactive) = bloqueado
  -- Apenas 'active' e 'trial' (dentro do prazo) permitem acesso
  RETURN FALSE;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.is_condo_active(TEXT) IS 
'Verifica se um condomínio está ativo (trial válido ou assinatura ativa). Retorna FALSE se trial expirou, conta cancelada ou inativa.';

-- ==================================================================================
-- ATUALIZA POLÍTICAS RLS: packages
-- ==================================================================================
-- Bloqueia SELECT, INSERT, UPDATE se trial expirou
-- DELETE já está restrito a service_role

DROP POLICY IF EXISTS "packages_select_same_condo" ON public.packages;
CREATE POLICY "packages_select_same_condo" ON public.packages
  FOR SELECT
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id) -- ✅ BLOQUEIA se trial expirou
  );

DROP POLICY IF EXISTS "packages_insert" ON public.packages;
CREATE POLICY "packages_insert" ON public.packages
  FOR INSERT
  WITH CHECK (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id) -- ✅ BLOQUEIA INSERT se trial expirou
  );

DROP POLICY IF EXISTS "packages_update" ON public.packages;
CREATE POLICY "packages_update" ON public.packages
  FOR UPDATE
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id) -- ✅ BLOQUEIA UPDATE se trial expirou
  );

-- DELETE já está restrito a service_role (mantém)

-- ==================================================================================
-- ATUALIZA POLÍTICAS RLS: residents
-- ==================================================================================
DROP POLICY IF EXISTS "residents_select_same_condo" ON public.residents;
CREATE POLICY "residents_select_same_condo" ON public.residents
  FOR SELECT
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id)
  );

DROP POLICY IF EXISTS "residents_insert" ON public.residents;
CREATE POLICY "residents_insert" ON public.residents
  FOR INSERT
  WITH CHECK (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id)
  );

DROP POLICY IF EXISTS "residents_update" ON public.residents;
CREATE POLICY "residents_update" ON public.residents
  FOR UPDATE
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id)
  );

-- ==================================================================================
-- ATUALIZA POLÍTICAS RLS: staff
-- ==================================================================================
-- IMPORTANTE: SELECT deve permitir busca para login (auth-login precisa verificar)
-- Mas INSERT/UPDATE/DELETE devem bloquear se trial expirou

-- SELECT: Permite para login, mas bloqueia para outras operações se trial expirou
-- Nota: A Edge Function auth-login usa service_role, então não é afetada
DROP POLICY IF EXISTS "staff_select_same_condo" ON public.staff;
CREATE POLICY "staff_select_same_condo" ON public.staff
  FOR SELECT
  USING (
    condo_id IS NOT NULL
    AND (
      -- Permite se condomínio está ativo
      public.is_condo_active(condo_id)
      -- OU se é service_role (para Edge Functions)
      OR auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "staff_insert_admin" ON public.staff;
CREATE POLICY "staff_insert_admin" ON public.staff
  FOR INSERT
  WITH CHECK (
    condo_id IS NOT NULL
    AND (
      public.is_condo_active(condo_id)
      OR auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "staff_update_admin" ON public.staff;
CREATE POLICY "staff_update_admin" ON public.staff
  FOR UPDATE
  USING (
    condo_id IS NOT NULL
    AND (
      public.is_condo_active(condo_id)
      OR auth.role() = 'service_role'
    )
  );

-- ==================================================================================
-- ATUALIZA POLÍTICAS RLS: units
-- ==================================================================================
DROP POLICY IF EXISTS "units_select_same_condo" ON public.units;
CREATE POLICY "units_select_same_condo" ON public.units
  FOR SELECT
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id)
  );

DROP POLICY IF EXISTS "units_insert" ON public.units;
CREATE POLICY "units_insert" ON public.units
  FOR INSERT
  WITH CHECK (
    condo_id IS NOT NULL
    AND (
      public.is_condo_active(condo_id)
      OR auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "units_update" ON public.units;
CREATE POLICY "units_update" ON public.units
  FOR UPDATE
  USING (
    condo_id IS NOT NULL
    AND (
      public.is_condo_active(condo_id)
      OR auth.role() = 'service_role'
    )
  );

-- ==================================================================================
-- ATUALIZA POLÍTICAS RLS: condos
-- ==================================================================================
-- IMPORTANTE: SELECT deve permitir leitura pública por ID (necessário para login)
-- Mas UPDATE deve bloquear (apenas service_role pode atualizar)

-- SELECT: Permite leitura pública por ID (necessário para verificar status no login)
-- A Edge Function auth-login precisa buscar o condomínio antes de autenticar
DROP POLICY IF EXISTS "condos_select_own" ON public.condos;
CREATE POLICY "condos_select_own" ON public.condos
  FOR SELECT
  USING (
    -- Permite leitura pública (necessário para login verificar status)
    -- OU se é service_role
    auth.role() = 'service_role'
    OR true -- Permite leitura pública por ID (usado no login)
  );

-- UPDATE: Apenas service_role (Edge Functions podem atualizar status de assinatura)
DROP POLICY IF EXISTS "condos_update_blocked" ON public.condos;
CREATE POLICY "condos_update_blocked" ON public.condos
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ==================================================================================
-- EXCEÇÕES: Tabelas que devem permanecer acessíveis
-- ==================================================================================
-- plans: Leitura pública (necessário para escolher plano)
-- condos: SELECT permitido (necessário para verificar status no login)
-- settings: Pode precisar de ajuste similar

-- ==================================================================================
-- TESTES DE VALIDAÇÃO
-- ==================================================================================
-- Execute estes testes após aplicar a migração:

-- 1. Testar função is_condo_active com trial ativo
-- SELECT public.is_condo_active('condo-test-prod'); -- Deve retornar TRUE se trial ativo

-- 2. Testar função is_condo_active com trial expirado
-- UPDATE condos SET trial_end_date = NOW() - INTERVAL '1 day' WHERE id = 'condo-test-prod';
-- SELECT public.is_condo_active('condo-test-prod'); -- Deve retornar FALSE

-- 3. Testar função is_condo_active com subscription_status = 'active'
-- UPDATE condos SET subscription_status = 'active' WHERE id = 'condo-test-prod';
-- SELECT public.is_condo_active('condo-test-prod'); -- Deve retornar TRUE

COMMIT;

-- ==================================================================================
-- NOTAS IMPORTANTES
-- ==================================================================================
-- 1. Esta migração bloqueia acesso REAL no banco de dados
-- 2. Frontend ainda deve esconder botões (UX), mas não é segurança
-- 3. Edge Functions devem validar também (defense in depth)
-- 4. Timezone: Função usa UTC para evitar problemas
-- 5. Performance: Função é STABLE, PostgreSQL pode otimizar
-- ==================================================================================
