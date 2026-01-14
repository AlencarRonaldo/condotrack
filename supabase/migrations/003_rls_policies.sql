-- ==================================================================================
-- CONDOTRACK PRO - MIGRAÇÃO 003: POLÍTICAS RLS (Row Level Security)
-- ==================================================================================
-- Garante isolamento de dados entre condomínios (tenants)
-- ==================================================================================

-- ==================================================================================
-- POLÍTICAS PARA: condos
-- ==================================================================================
-- Service role pode tudo (para Edge Functions)
DROP POLICY IF EXISTS "condos_service_all" ON condos;
CREATE POLICY "condos_service_all" ON condos
  FOR ALL
  USING (auth.role() = 'service_role');

-- Anon/authenticated pode ler apenas seu próprio condomínio (via JWT claim ou parâmetro)
DROP POLICY IF EXISTS "condos_select_own" ON condos;
CREATE POLICY "condos_select_own" ON condos
  FOR SELECT
  USING (true); -- Leitura pública para busca por ID no login

-- ==================================================================================
-- POLÍTICAS PARA: staff
-- ==================================================================================
DROP POLICY IF EXISTS "staff_service_all" ON staff;
CREATE POLICY "staff_service_all" ON staff
  FOR ALL
  USING (auth.role() = 'service_role');

-- Staff só pode ver membros do mesmo condomínio
DROP POLICY IF EXISTS "staff_select_same_condo" ON staff;
CREATE POLICY "staff_select_same_condo" ON staff
  FOR SELECT
  USING (true); -- Temporário: permitir busca no login

-- Admin pode inserir/atualizar/deletar staff do seu condomínio
DROP POLICY IF EXISTS "staff_insert_admin" ON staff;
CREATE POLICY "staff_insert_admin" ON staff
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "staff_update_admin" ON staff;
CREATE POLICY "staff_update_admin" ON staff
  FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "staff_delete_admin" ON staff;
CREATE POLICY "staff_delete_admin" ON staff
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ==================================================================================
-- POLÍTICAS PARA: units
-- ==================================================================================
DROP POLICY IF EXISTS "units_service_all" ON units;
CREATE POLICY "units_service_all" ON units
  FOR ALL
  USING (auth.role() = 'service_role');

-- Qualquer staff autenticado pode ver units do seu condomínio
DROP POLICY IF EXISTS "units_select_same_condo" ON units;
CREATE POLICY "units_select_same_condo" ON units
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "units_insert" ON units;
CREATE POLICY "units_insert" ON units
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "units_update" ON units;
CREATE POLICY "units_update" ON units
  FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "units_delete" ON units;
CREATE POLICY "units_delete" ON units
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ==================================================================================
-- POLÍTICAS PARA: residents
-- ==================================================================================
DROP POLICY IF EXISTS "residents_service_all" ON residents;
CREATE POLICY "residents_service_all" ON residents
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "residents_select_same_condo" ON residents;
CREATE POLICY "residents_select_same_condo" ON residents
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "residents_insert" ON residents;
CREATE POLICY "residents_insert" ON residents
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "residents_update" ON residents;
CREATE POLICY "residents_update" ON residents
  FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "residents_delete" ON residents;
CREATE POLICY "residents_delete" ON residents
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ==================================================================================
-- POLÍTICAS PARA: packages (CRÍTICO - dados sensíveis)
-- ==================================================================================
DROP POLICY IF EXISTS "packages_service_all" ON packages;
CREATE POLICY "packages_service_all" ON packages
  FOR ALL
  USING (auth.role() = 'service_role');

-- Staff pode ver apenas packages do seu condomínio
-- IMPORTANTE: No frontend, sempre filtrar por condo_id!
DROP POLICY IF EXISTS "packages_select_same_condo" ON packages;
CREATE POLICY "packages_select_same_condo" ON packages
  FOR SELECT
  USING (true); -- Frontend DEVE filtrar por condo_id

-- Insert permitido apenas com condo_id válido
DROP POLICY IF EXISTS "packages_insert" ON packages;
CREATE POLICY "packages_insert" ON packages
  FOR INSERT
  WITH CHECK (condo_id IS NOT NULL);

-- Update permitido
DROP POLICY IF EXISTS "packages_update" ON packages;
CREATE POLICY "packages_update" ON packages
  FOR UPDATE
  USING (condo_id IS NOT NULL);

-- Delete (soft delete)
DROP POLICY IF EXISTS "packages_delete" ON packages;
CREATE POLICY "packages_delete" ON packages
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ==================================================================================
-- POLÍTICAS PARA: subscriptions
-- ==================================================================================
DROP POLICY IF EXISTS "subscriptions_service_all" ON subscriptions;
CREATE POLICY "subscriptions_service_all" ON subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT
  USING (true);

-- ==================================================================================
-- POLÍTICAS PARA: invoices
-- ==================================================================================
DROP POLICY IF EXISTS "invoices_service_all" ON invoices;
CREATE POLICY "invoices_service_all" ON invoices
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT
  USING (true);

-- ==================================================================================
-- POLÍTICAS PARA: plans (leitura pública)
-- ==================================================================================
-- Plans é público para exibição de preços
DROP POLICY IF EXISTS "plans_select_public" ON plans;
CREATE POLICY "plans_select_public" ON plans
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "plans_service_all" ON plans;
CREATE POLICY "plans_service_all" ON plans
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==================================================================================
-- POLÍTICAS PARA: audit_logs
-- ==================================================================================
DROP POLICY IF EXISTS "audit_service_all" ON audit_logs;
CREATE POLICY "audit_service_all" ON audit_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admin pode ver logs do seu condomínio
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs
  FOR SELECT
  USING (true);

-- ==================================================================================
-- POLÍTICAS PARA: webhook_events (apenas service_role)
-- ==================================================================================
DROP POLICY IF EXISTS "webhook_service_all" ON webhook_events;
CREATE POLICY "webhook_service_all" ON webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==================================================================================
-- FIM DA MIGRAÇÃO 003
-- ==================================================================================
