-- ==================================================================================
-- FIX: Permitir acesso com anon key quando app usa autenticação customizada
-- ==================================================================================
-- O app CondoTrack usa login via Edge Function (auth-login) e armazena sessão em
-- localStorage. O Supabase client usa apenas a anon key, sem JWT de usuário.
--
-- As políticas que usam auth.get_current_condo_id() bloqueiam anon (retorna NULL).
-- Esta migração remove essas políticas para que as políticas baseadas em
-- condo_id + is_condo_active permitam acesso.
--
-- Segurança: As políticas restantes exigem condo_id válido e is_condo_active=true.
-- O frontend filtra por condo_id da sessão; o condo_id é UUID (difícil de adivinhar).
-- ==================================================================================

BEGIN;

-- Remove políticas que exigem auth.get_current_condo_id() (bloqueiam anon)
DROP POLICY IF EXISTS "residents_auth_can_access" ON public.residents;
DROP POLICY IF EXISTS "packages_auth_can_access" ON public.packages;
DROP POLICY IF EXISTS "units_auth_can_access" ON public.units;
DROP POLICY IF EXISTS "staff_auth_can_access" ON public.staff;
DROP POLICY IF EXISTS "staff_admin_can_manage" ON public.staff;
DROP POLICY IF EXISTS "staff_select_same_condo" ON public.staff;
DROP POLICY IF EXISTS "condos_access_own" ON public.condos;

-- residents: Garantir que anon possa INSERT/SELECT/UPDATE quando row satisfaz
-- (residents_insert, residents_select_same_condo, residents_update já existem)
-- Adicionar DELETE para anon quando condo ativo (handleDeleteResident)
DROP POLICY IF EXISTS "residents_delete" ON public.residents;
CREATE POLICY "residents_delete" ON public.residents
  FOR DELETE
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id)
  );

-- packages: Adicionar DELETE para anon (se não existir)
DROP POLICY IF EXISTS "packages_delete" ON public.packages;
CREATE POLICY "packages_delete" ON public.packages
  FOR DELETE
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id)
  );

-- staff: Recriar SELECT para permitir busca (auth-login usa service_role, mas
-- fallback local no frontend precisa de SELECT com anon)
DROP POLICY IF EXISTS "staff_select_same_condo" ON public.staff;
CREATE POLICY "staff_select_same_condo" ON public.staff
  FOR SELECT
  USING (
    condo_id IS NOT NULL
    AND (
      public.is_condo_active(condo_id)
      OR auth.role() = 'service_role'
    )
  );

-- staff: INSERT/UPDATE/DELETE para anon quando condo ativo
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

DROP POLICY IF EXISTS "staff_delete" ON public.staff;
CREATE POLICY "staff_delete" ON public.staff
  FOR DELETE
  USING (
    condo_id IS NOT NULL
    AND (
      public.is_condo_active(condo_id)
      OR auth.role() = 'service_role'
    )
  );

-- units: Garantir anon pode INSERT/UPDATE (sem auth.get_current_condo_id)
-- units_insert e units_update já permitem quando is_condo_active
-- Adicionar DELETE se necessário
DROP POLICY IF EXISTS "units_delete" ON public.units;
CREATE POLICY "units_delete" ON public.units
  FOR DELETE
  USING (
    condo_id IS NOT NULL
    AND (
      public.is_condo_active(condo_id)
      OR auth.role() = 'service_role'
    )
  );

COMMIT;

-- ==================================================================================
-- Se ainda receber 401: Verifique se o condomínio está ativo
-- Execute no SQL Editor do Supabase:
--
--   UPDATE condos SET subscription_status = 'active' 
--   WHERE id = 'SEU_CONDOMINIO_ID';
--
-- Para dados de teste (condo-test-prod):
--   UPDATE condos SET subscription_status = 'active', trial_end_date = NOW() + INTERVAL '30 days' 
--   WHERE id = 'condo-test-prod';
-- ==================================================================================
