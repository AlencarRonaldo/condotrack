-- ==================================================================================
-- MIGRAÇÃO: IMPLEMENTAÇÃO DE POLÍTICAS DE RLS ESTRITAS
--
-- Descrição:
-- Esta migração corrige as falhas de segurança existentes e implementa políticas
-- de Row Level Security (RLS) estritas para todas as tabelas, garantindo o
-- isolamento de dados (multi-tenancy) entre os diferentes condomínios.
--
-- Passos:
-- 1. Cria uma função auxiliar para extrair o 'condo_id' do token JWT do usuário.
-- 2. Remove as políticas inseguras existentes ('USING (true)').
-- 3. Aplica políticas para as novas tabelas financeiras, baseadas no 'condo_id'.
-- 4. Aplica políticas para as tabelas do core (staff, units, etc.), baseadas no 'condo_id'.
-- 5. Garante que a tabela de webhooks seja acessível apenas pela 'service_role'.
--
-- Pré-requisito: O JWT do Supabase DEVE conter o 'condo_id' e 'role' nos metadados.
-- Exemplo de JWT payload: { ..., "user_metadata": { "condo_id": "...", "role": "admin" } }
-- ==================================================================================

BEGIN;

-- Passo 1: Função auxiliar para obter o condo_id do usuário autenticado
CREATE OR REPLACE FUNCTION auth.get_current_condo_id()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'condo_id', '')::TEXT;
$$;

-- ==================================================================================
-- Políticas para Novas Tabelas Financeiras
-- ==================================================================================

-- Tabela: customers
-- Apenas service_role pode tudo. Usuários de um condomínio podem ver seu próprio customer.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_service_role_all" ON public.customers;
CREATE POLICY "allow_service_role_all" ON public.customers FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "allow_user_to_see_own_customer" ON public.customers;
CREATE POLICY "allow_user_to_see_own_customer" ON public.customers FOR SELECT
USING (condo_id = auth.get_current_condo_id());


-- Tabela: invoices
-- Apenas service_role pode tudo. Usuários de um condomínio podem ver suas próprias invoices.
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_service_role_all" ON public.invoices;
CREATE POLICY "allow_service_role_all" ON public.invoices FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "allow_user_to_see_own_invoices" ON public.invoices;
CREATE POLICY "allow_user_to_see_own_invoices" ON public.invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = invoices.customer_id AND c.condo_id = auth.get_current_condo_id()
  )
);

-- Tabela: transactions
-- A mesma lógica de invoices se aplica aqui.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_service_role_all" ON public.transactions;
CREATE POLICY "allow_service_role_all" ON public.transactions FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "allow_user_to_see_own_transactions" ON public.transactions;
CREATE POLICY "allow_user_to_see_own_transactions" ON public.transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.customers c ON i.customer_id = c.id
    WHERE i.id = transactions.invoice_id AND c.condo_id = auth.get_current_condo_id()
  )
);


-- Tabela: asaas_webhook_events
-- Acesso EXCLUSIVO da service_role. Nenhum usuário final pode ler ou escrever aqui.
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_service_role_only" ON public.asaas_webhook_events;
CREATE POLICY "allow_service_role_only" ON public.asaas_webhook_events FOR ALL
USING (auth.role() = 'service_role');


-- ==================================================================================
-- Correção das Políticas para Tabelas Existentes
-- ==================================================================================

-- Habilitar RLS em todas as tabelas relevantes
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Tabela: staff
DROP POLICY IF EXISTS "staff_service_all" ON public.staff;
CREATE POLICY "staff_service_all" ON public.staff FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "staff_select_same_condo" ON public.staff;
CREATE POLICY "staff_select_same_condo" ON public.staff FOR SELECT
USING (condo_id = auth.get_current_condo_id());

DROP POLICY IF EXISTS "staff_admin_can_manage" ON public.staff;
CREATE POLICY "staff_admin_can_manage" ON public.staff FOR ALL
USING (condo_id = auth.get_current_condo_id());


-- Tabela: units
DROP POLICY IF EXISTS "units_service_all" ON public.units;
CREATE POLICY "units_service_all" ON public.units FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "units_auth_can_access" ON public.units;
CREATE POLICY "units_auth_can_access" ON public.units FOR ALL
USING (condo_id = auth.get_current_condo_id());


-- Tabela: residents
DROP POLICY IF EXISTS "residents_service_all" ON public.residents;
CREATE POLICY "residents_service_all" ON public.residents FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "residents_auth_can_access" ON public.residents;
CREATE POLICY "residents_auth_can_access" ON public.residents FOR ALL
USING (condo_id = auth.get_current_condo_id());


-- Tabela: packages
DROP POLICY IF EXISTS "packages_service_all" ON public.packages;
CREATE POLICY "packages_service_all" ON public.packages FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "packages_auth_can_access" ON public.packages;
CREATE POLICY "packages_auth_can_access" ON public.packages FOR ALL
USING (condo_id = auth.get_current_condo_id());


-- Tabela: plans (Pública para leitura)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select_public" ON public.plans;
CREATE POLICY "plans_select_public" ON public.plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "plans_service_all" ON public.plans;
CREATE POLICY "plans_service_all" ON public.plans FOR ALL USING (auth.role() = 'service_role');


-- Tabela: condos (Leitura pública do seu próprio condo)
ALTER TABLE public.condos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "condos_service_all" ON public.condos;
CREATE POLICY "condos_service_all" ON public.condos FOR ALL USING (auth.role() = 'service_role');

-- Permite que um usuário logado veja os detalhes do seu próprio condomínio.
-- Permite que o sistema (service_role) atualize os dados do condomínio (ex: status da assinatura).
DROP POLICY IF EXISTS "condos_access_own" ON public.condos;
CREATE POLICY "condos_access_own" ON public.condos FOR ALL
USING (id = auth.get_current_condo_id());


COMMIT;
