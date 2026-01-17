# 🔍 AUDITORIA COMPLETA: Fluxo Pós-Confirmação de Pagamento PIX

**Data:** 2025-01-16  
**Analista:** AI Assistant (Arquiteto de Software Sênior)  
**Versão Analisada:** Commit 389e5ef (polling automático implementado)

---

## 📋 SUMÁRIO EXECUTIVO

Esta auditoria valida todo o fluxo de negócio após a confirmação do pagamento PIX, desde o webhook do Asaas até a liberação do acesso ao sistema.

### Status Geral: ⚠️ **REQUER CORREÇÕES**

**Problemas Críticos Identificados:**
1. ❌ Função RPC `handle_payment_confirmed` NÃO atualiza `plan_type` do condomínio
2. ❌ NÃO há definição de data de vencimento do plano após pagamento
3. ❌ NÃO há lógica para renovação automática
4. ⚠️ Falta verificação se o plano contratado corresponde ao `planId` do pagamento

---

## 🔄 FLUXO ATUAL (PASSO A PASSO)

### 1. Pagamento Confirmado pelo Asaas ✅

**Trigger:** Webhook `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`

**Arquivo:** `supabase/functions/asaas-webhook-handler/index.ts`

```typescript
case 'PAYMENT_CONFIRMED':
case 'PAYMENT_RECEIVED': {
  // Encontrar invoice pelo asaas_payment_id
  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, status')
    .eq('asaas_payment_id', payload.payment.id)
    .single();

  // Chamar função RPC
  await supabaseAdmin.rpc('handle_payment_confirmed', {
    p_invoice_id: invoice.id,
    p_payment_payload: payload.payment,
  });
}
```

**Status:** ✅ **CORRETO**

---

### 2. Função RPC `handle_payment_confirmed` ⚠️

**Arquivo:** `supabase/migrations/20260114000009_create_rpc_functions.sql`

**O que faz:**
1. ✅ Busca invoice e condo_id
2. ✅ Cria registro em `transactions`
3. ✅ Atualiza `invoices.status = 'PAID'`
4. ✅ Atualiza `invoices.paid_at`
5. ⚠️ Atualiza `condos.subscription_status = 'active'`
6. ❌ **NÃO atualiza `condos.plan_type`**
7. ❌ **NÃO define data de vencimento do plano**
8. ❌ **NÃO associa plano contratado ao condomínio**

**Código Atual:**
```sql
-- 4. Atualizar o status da assinatura do condomínio
UPDATE public.condos
SET
    subscription_status = 'active',
    updated_at = NOW()
WHERE
    id = v_condo_id;
```

**Problemas Identificados:**

1. **❌ CRÍTICO: Não atualiza `plan_type`**
   - O pagamento foi feito para um plano específico (`basic`, `professional`, `premium`)
   - Mas o `plan_type` do condomínio não é atualizado
   - Usuário pode estar pagando `premium` mas usando `basic`

2. **❌ CRÍTICO: Não define data de vencimento**
   - Não há campo para armazenar quando o plano vence
   - Não há lógica para calcular vencimento (ex: +30 dias)
   - Sistema não sabe quando bloquear acesso

3. **❌ FALTA: Não associa plano à invoice**
   - Invoice não tem referência direta ao `plan_id` ou `plan_slug`
   - Não há como saber qual plano foi contratado

---

### 3. Estrutura da Tabela `invoices` 📊

**Campos Atuais:**
- `id` (UUID)
- `customer_id` (UUID → customers)
- `asaas_payment_id` (TEXT)
- `status` (TEXT)
- `amount` (NUMERIC)
- `due_date` (DATE) ← **Data de vencimento do PIX, não do plano**
- `paid_at` (TIMESTAMPTZ)
- `billing_type` (TEXT)
- `payment_link` (TEXT)
- `pix_qr_code` (TEXT)

**Campos Faltantes:**
- ❌ `plan_id` ou `plan_slug` → Qual plano foi contratado
- ❌ `plan_start_date` → Quando o plano começa
- ❌ `plan_end_date` → Quando o plano vence

---

### 4. Estrutura da Tabela `condos` 📊

**Campos Relevantes:**
- `id` (TEXT)
- `name` (TEXT)
- `plan_type` (TEXT) → `'trial' | 'basic' | 'professional' | 'premium'`
- `subscription_status` (TEXT) → `'trial' | 'active' | 'past_due' | 'canceled' | 'inactive' | 'expired'`
- `trial_end_date` (TIMESTAMPTZ) → **Usado apenas para trial**
- `is_active` (BOOLEAN)
- `staff_limit` (INTEGER)
- `unit_limit` (INTEGER)

**Campos Faltantes:**
- ❌ `plan_start_date` → Quando o plano atual começou
- ❌ `plan_end_date` → Quando o plano atual vence
- ❌ `last_payment_date` → Último pagamento confirmado
- ❌ `next_billing_date` → Próxima cobrança

---

### 5. Controle de Acesso no Frontend ⚠️

**Arquivo:** `src/App.jsx`

**Função `checkCondoStatus`:**
```javascript
const checkCondoStatus = (condoData) => {
  // Verifica se está inativo manualmente
  if (condoData.is_active === false) return 'inactive';

  // Se está em trial, verifica se expirou
  if (condoData.subscription_status === 'trial' && condoData.trial_end_date) {
    const trialEnd = new Date(condoData.trial_end_date);
    if (now > trialEnd) return 'expired';
    return 'active';
  }

  // Se subscription_status é expired/past_due/canceled/inactive
  if (['expired', 'past_due', 'canceled', 'inactive'].includes(condoData.subscription_status)) {
    return 'expired';
  }

  return 'active';
}
```

**Problemas Identificados:**

1. **⚠️ Não verifica data de vencimento do plano**
   - Apenas verifica `trial_end_date` para trial
   - Para planos pagos, não há verificação de `plan_end_date`
   - Sistema depende apenas de `subscription_status`

2. **⚠️ Lógica incompleta**
   - Se `subscription_status = 'active'` mas plano venceu, ainda permite acesso
   - Não há sincronização entre status e data de vencimento

---

### 6. RLS (Row Level Security) 🔒

**Arquivo:** `supabase/migrations/20260116000001_secure_trial_blocking.sql`

**Políticas Identificadas:**
- ✅ Políticas básicas para `condos`
- ✅ Políticas para `staff`, `residents`, `units`
- ⚠️ **NÃO há política que bloqueia acesso baseado em data de vencimento**

**Status:** ⚠️ **PARCIALMENTE IMPLEMENTADO**
- RLS existe, mas não valida vencimento de planos pagos

---

## ❌ PROBLEMAS CRÍTICOS

### Problema 1: `plan_type` não é atualizado após pagamento

**Impacto:** 🔴 **ALTO**
- Usuário paga `premium` mas continua com `basic`
- Limites (staff, units) não são atualizados
- Billing inconsistente

**Solução Necessária:**
- Associar `plan_slug` na tabela `invoices`
- Atualizar `condos.plan_type` na função RPC
- Atualizar `staff_limit` e `unit_limit` baseado no plano

---

### Problema 2: Não há data de vencimento do plano

**Impacto:** 🔴 **CRÍTICO**
- Sistema não sabe quando bloquear acesso
- Não há lógica de renovação
- Usuário pode usar indefinidamente após primeiro pagamento

**Solução Necessária:**
- Adicionar `plan_start_date` e `plan_end_date` em `condos`
- Calcular vencimento baseado no tipo de cobrança (mensal/anual)
- Atualizar na função RPC quando pagamento for confirmado

---

### Problema 3: Invoice não associa plano contratado

**Impacto:** 🟡 **MÉDIO**
- Não há como saber qual plano foi pago
- Dificulta auditoria e relatórios
- Impossível validar se plano correto foi aplicado

**Solução Necessária:**
- Adicionar `plan_slug` ou `plan_id` na tabela `invoices`
- Preencher quando criar invoice
- Usar na função RPC para atualizar condomínio

---

### Problema 4: Controle de acesso não verifica vencimento

**Impacto:** 🟡 **MÉDIO**
- Frontend não valida `plan_end_date`
- Usuário pode acessar após vencimento se `subscription_status = 'active'`

**Solução Necessária:**
- Adicionar verificação de `plan_end_date` em `checkCondoStatus`
- Bloquear acesso se data atual > `plan_end_date`
- Atualizar `subscription_status` para `expired` automaticamente

---

## ✅ RECOMENDAÇÕES PRIORITÁRIAS

### Prioridade 1: Corrigir Função RPC `handle_payment_confirmed`

**Ações:**
1. Adicionar `plan_slug` como parâmetro (ou buscar da invoice)
2. Atualizar `condos.plan_type` com o plano contratado
3. Calcular e definir `plan_start_date` e `plan_end_date`
4. Atualizar `staff_limit` e `unit_limit` baseado no plano

**Código Sugerido:**
```sql
-- Buscar informações do plano da invoice (se plan_slug estiver na invoice)
-- OU receber como parâmetro

-- Atualizar condomínio
UPDATE public.condos
SET
    plan_type = v_plan_slug, -- 'basic', 'professional', 'premium'
    subscription_status = 'active',
    plan_start_date = NOW(),
    plan_end_date = CASE
        WHEN v_billing_type = 'monthly' THEN NOW() + INTERVAL '1 month'
        WHEN v_billing_type = 'yearly' THEN NOW() + INTERVAL '1 year'
        ELSE NOW() + INTERVAL '1 month' -- Default mensal
    END,
    staff_limit = v_staff_limit, -- Baseado no plano
    unit_limit = v_unit_limit,   -- Baseado no plano
    updated_at = NOW()
WHERE id = v_condo_id;
```

---

### Prioridade 2: Adicionar campos faltantes

**Migration Necessária:**

```sql
-- Adicionar campos em condos
ALTER TABLE public.condos 
ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plan_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- Adicionar campo em invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS plan_slug TEXT; -- 'basic', 'professional', 'premium'
```

---

### Prioridade 3: Atualizar `create-payment` para salvar `plan_slug`

**Arquivo:** `supabase/functions/create-payment/index.ts`

**Ação:**
- Ao criar invoice, salvar `plan_slug` (já temos `planId` no request)

---

### Prioridade 4: Melhorar `checkCondoStatus`

**Arquivo:** `src/App.jsx`

**Ação:**
- Adicionar verificação de `plan_end_date`
- Bloquear acesso se `plan_end_date < NOW()`
- Atualizar `subscription_status` para `expired` se necessário

---

### Prioridade 5: Job/Cron para verificar vencimentos

**Sugestão:**
- Edge Function agendada (via Supabase Cron ou externo)
- Verifica `plan_end_date` diariamente
- Atualiza `subscription_status = 'expired'` para planos vencidos
- Envia alertas antes de vencer

---

## 📊 MATRIZ DE IMPACTO E PRIORIZAÇÃO

| # | Problema | Impacto | Urgência | Esforço | Prioridade |
|---|----------|---------|----------|---------|------------|
| 1 | `plan_type` não atualizado após pagamento | 🔴 **Alto** | 🔴 **Crítico** | 🟢 Baixo | **P1 - IMEDIATO** |
| 2 | Sem data de vencimento do plano (`plan_end_date`) | 🔴 **Alto** | 🔴 **Crítico** | 🟡 Médio | **P1 - IMEDIATO** |
| 3 | Invoice não armazena `plan_slug` | 🟡 Médio | 🔴 **Crítico** | 🟢 Baixo | **P1 - IMEDIATO** |
| 4 | `staff_limit` e `unit_limit` não atualizados | 🟡 Médio | 🟡 Alta | 🟢 Baixo | **P2 - CURTO PRAZO** |
| 5 | Controle de acesso não verifica `plan_end_date` | 🟡 Médio | 🟡 Alta | 🟡 Médio | **P2 - CURTO PRAZO** |
| 6 | Sem job/cron para verificar vencimentos | 🟢 Baixo | 🟡 Média | 🔴 Alto | **P3 - MÉDIO PRAZO** |
| 7 | Sem lógica de renovação automática | 🟢 Baixo | 🟢 Baixa | 🔴 Alto | **P4 - LONGO PRAZO** |

---

## 🔐 SEGURANÇA E CONSISTÊNCIA

### Pontos Positivos ✅
- Webhook valida assinatura (HMAC)
- Idempotência garantida (asaas_webhook_events)
- Transações atômicas (função RPC)
- RLS habilitado

### Pontos de Atenção ⚠️
- Falta validação se plano contratado corresponde ao acesso
- Não há bloqueio automático por data
- Dependência apenas de `subscription_status` pode ser burlada

---

## 📝 PRÓXIMOS PASSOS SUGERIDOS

1. **Imediato (Crítico):**
   - [ ] Criar migration para adicionar campos faltantes
   - [ ] Atualizar função RPC `handle_payment_confirmed`
   - [ ] Atualizar `create-payment` para salvar `plan_slug`

2. **Curto Prazo (Alta Prioridade):**
   - [ ] Melhorar `checkCondoStatus` no frontend
   - [ ] Testes end-to-end do fluxo completo
   - [ ] Validação de limites (staff, units) após atualização

3. **Médio Prazo:**
   - [ ] Job agendado para verificar vencimentos
   - [ ] Alertas de renovação (email/notificação)
   - [ ] Dashboard administrativo para monitorar planos

4. **Longo Prazo:**
   - [ ] Renovação automática de planos
   - [ ] Histórico de mudanças de plano
   - [ ] Relatórios de billing e conversão

---

## ✅ CONCLUSÃO

O fluxo atual **funciona parcialmente**, mas tem **lacunas críticas** que impedem o controle adequado de planos e acesso:

1. ✅ Webhook funciona corretamente
2. ✅ Polling funciona corretamente
3. ⚠️ Atualização do condomínio está incompleta
4. ❌ Não há controle de vencimento
5. ❌ Não há associação entre pagamento e plano

**Recomendação:** Implementar correções de **Prioridade 1 e 2** antes de colocar em produção com usuários reais.

---

**Arquivo gerado automaticamente em:** 2025-01-16  
**Versão do código analisado:** Commit 389e5ef
