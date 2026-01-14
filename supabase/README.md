# CondoTrack Pro - Supabase Setup

## 📋 Pré-requisitos

1. Conta no [Supabase](https://supabase.com)
2. Projeto criado no Supabase Dashboard
3. [Supabase CLI](https://supabase.com/docs/guides/cli) instalado (opcional, mas recomendado)

## 🚀 Executar Migrações

### Opção 1: Via SQL Editor (Dashboard)

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **SQL Editor**
3. Execute os arquivos na ordem:
   - `migrations/002_condotrack_schema_update.sql`
   - `migrations/003_rls_policies.sql`

### Opção 2: Via Supabase CLI

```bash
# Login
npx supabase login

# Linkar projeto
npx supabase link --project-ref SEU_PROJECT_REF

# Executar migrações
npx supabase db push
```

## 🔐 Configurar Secrets (Edge Functions)

```bash
# Supabase Service Role Key (já está configurado automaticamente)
# Billing com Asaas:
# - ASAAS_API_KEY (sandbox ou produção)
# - ASAAS_BASE_URL (opcional)
# - ASAAS_WEBHOOK_TOKEN (recomendado)

npx supabase secrets set ASAAS_API_KEY=asaas_api_key_aqui --project-ref SEU_REF
npx supabase secrets set ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3 --project-ref SEU_REF
npx supabase secrets set ASAAS_WEBHOOK_TOKEN=seu_token_webhook --project-ref SEU_REF
```

## 📦 Deploy Edge Functions

```bash
# Deploy auth-login
npx supabase functions deploy auth-login --project-ref SEU_PROJECT_REF

# Billing (Asaas):
npx supabase functions deploy asaas-create-checkout --project-ref SEU_PROJECT_REF
npx supabase functions deploy asaas-webhook --project-ref SEU_PROJECT_REF
```

## 🧪 Testar Localmente

```bash
# Iniciar Supabase local (requer Docker)
npx supabase start

# Executar função localmente
npx supabase functions serve auth-login --env-file .env.local
```

## 📊 Schema do Banco

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `condos` | Condomínios (tenants) |
| `staff` | Funcionários (admin, síndico, porteiro) |
| `units` | Unidades/Apartamentos |
| `residents` | Moradores |
| `packages` | Encomendas |
| `plans` | Planos de assinatura |
| `subscriptions` | Assinaturas ativas |
| `invoices` | Faturas |
| `audit_logs` | Logs de auditoria |
| `webhook_events` | Idempotência para webhooks |

### Multitenancy

Todas as tabelas (exceto `plans`) possuem coluna `condo_id` para isolamento de dados.

**RLS (Row Level Security)** está habilitado em todas as tabelas.

### Funções do Banco

| Função | Uso |
|--------|-----|
| `hash_password(password)` | Gera hash bcrypt |
| `verify_password(password, hash)` | Verifica senha |
| `update_updated_at()` | Trigger para updated_at |

## 🔄 Criar Dados de Teste

Execute no SQL Editor:

```sql
-- Criar condomínio de teste
INSERT INTO condos (id, name, plan_type, staff_limit, unit_limit, trial_end_date)
VALUES ('demo-condo-001', 'Edifício Demonstração', 'trial', 5, 100, NOW() + INTERVAL '15 days');

-- Criar admin (senha: admin123)
INSERT INTO staff (condo_id, name, username, password, role)
VALUES ('demo-condo-001', 'Administrador', 'admin', 'admin123', 'admin');

-- Criar porteiro (senha: port123)
INSERT INTO staff (condo_id, name, username, password, role)
VALUES ('demo-condo-001', 'João Porteiro', 'joao', 'port123', 'porteiro');

-- Criar algumas unidades
INSERT INTO units (condo_id, number, block, floor) VALUES
('demo-condo-001', '101', 'A', 1),
('demo-condo-001', '102', 'A', 1),
('demo-condo-001', '201', 'A', 2),
('demo-condo-001', '202', 'A', 2);
```

## ⚠️ Notas de Segurança

1. **NUNCA** exponha a `service_role` key no frontend
2. Sempre use `anon` key no cliente
3. RLS garante isolamento de dados entre condomínios
4. Senhas são migradas automaticamente para bcrypt no primeiro login
