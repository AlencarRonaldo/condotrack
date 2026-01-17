# 🧪 GUIA DE TESTE: Correções do Fluxo de Pagamento

**Data:** 2025-01-16  
**Objetivo:** Validar todas as correções antes do commit

---

## 📋 O QUE FOI IMPLEMENTADO

### 1. Migrations SQL (3 arquivos)

- ✅ `20260116000002_add_plan_dates_and_slug.sql`
  - Adiciona `plan_start_date`, `plan_end_date`, `last_payment_date` em `condos`
  - Adiciona `plan_slug` em `invoices`

- ✅ `20260116000003_fix_handle_payment_confirmed.sql`
  - Recria função RPC `handle_payment_confirmed` com lógica completa

- ✅ `20260116000004_update_is_condo_active_for_plan_expiry.sql`
  - Atualiza função `is_condo_active` para verificar `plan_end_date`

### 2. Edge Functions

- ✅ `create-payment/index.ts` (MODIFICADO)
  - Agora busca `staff_limit` e `unit_limit` do plano
  - Salva `plan_slug` na invoice
  
- ✅ `check-plan-expiry/index.ts` (NOVO)
  - Deploy já realizado

### 3. Frontend

- ✅ `src/App.jsx` (MODIFICADO)
  - `checkCondoStatus` agora verifica `plan_end_date`

---

## 🚀 ORDEM DE EXECUÇÃO (TESTE)

### Passo 1: Executar Migrations no SQL Editor

Execute no Supabase SQL Editor **na ordem**:

1. **`20260116000002_add_plan_dates_and_slug.sql`**
   ```sql
   -- Copiar e colar o conteúdo completo do arquivo
   -- Verificar se as colunas foram criadas
   ```

2. **`20260116000003_fix_handle_payment_confirmed.sql`**
   ```sql
   -- Copiar e colar o conteúdo completo do arquivo
   -- Verificar se a função foi recriada
   ```

3. **`20260116000004_update_is_condo_active_for_plan_expiry.sql`**
   ```sql
   -- Copiar e colar o conteúdo completo do arquivo
   -- Verificar se a função foi atualizada
   ```

**Validação após migrations:**
```sql
-- Verificar colunas em condos
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'condos' 
  AND column_name IN ('plan_start_date', 'plan_end_date', 'last_payment_date');

-- Verificar coluna em invoices
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND column_name = 'plan_slug';

-- Verificar função handle_payment_confirmed
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_payment_confirmed';
```

---

### Passo 2: Verificar Deploy das Edge Functions

**Status:** ✅ **JÁ DEPLOYADO**

- `create-payment` → Deploy realizado
- `check-plan-expiry` → Deploy realizado

**Verificar no Dashboard:**
- Supabase Dashboard → Functions → Verificar se ambas aparecem

---

### Passo 3: Teste End-to-End Completo

#### Teste 1: Criar Pagamento PIX

1. Acesse `billing.html`
2. Selecione um plano (ex: `professional`)
3. Escolha PIX
4. Clique em "Assinar Agora"

**O que verificar:**
- ✅ QR Code é exibido
- ✅ Polling inicia automaticamente
- ✅ **No banco:** Verificar se `invoices.plan_slug` foi salvo:

```sql
SELECT id, plan_slug, status, amount, billing_type 
FROM invoices 
ORDER BY created_at DESC 
LIMIT 1;
```

**Esperado:** `plan_slug = 'professional'` (ou o plano selecionado)

---

#### Teste 2: Simular Confirmação de Pagamento (Webhook)

**IMPORTANTE:** Para testar sem pagar realmente, você pode:

**Opção A: Pagar realmente um valor pequeno no ambiente de testes**
- Use dados de teste do Asaas
- Pagamento será processado e webhook será chamado

**Opção B: Chamar função RPC manualmente (TESTE DIRETO)**

```sql
-- 1. Pegar ID da invoice criada no Teste 1
SELECT id FROM invoices ORDER BY created_at DESC LIMIT 1;

-- 2. Chamar função RPC manualmente (simula webhook)
SELECT public.handle_payment_confirmed(
    'ID_DA_INVOICE_AQUI', -- Substituir pelo ID real
    '{"id": "test_123", "value": 199.00, "dateCreated": "2025-01-16T12:00:00Z"}'::jsonb
);
```

**O que verificar após chamar a função:**

```sql
-- Verificar condomínio atualizado
SELECT 
    id,
    name,
    plan_type,
    subscription_status,
    plan_start_date,
    plan_end_date,
    last_payment_date,
    staff_limit,
    unit_limit,
    is_active
FROM condos 
WHERE id = 'SEU_CONDO_ID_AQUI'; -- Substituir pelo ID real
```

**Esperado:**
- ✅ `plan_type = 'professional'` (ou plano pago)
- ✅ `subscription_status = 'active'`
- ✅ `plan_start_date` preenchido
- ✅ `plan_end_date` = `plan_start_date + 30 dias`
- ✅ `last_payment_date` preenchido
- ✅ `staff_limit = 5` (se professional)
- ✅ `unit_limit = 150` (se professional)
- ✅ `is_active = true`

---

#### Teste 3: Verificar Invoice Atualizada

```sql
SELECT 
    id,
    status,
    plan_slug,
    paid_at,
    amount
FROM invoices 
ORDER BY created_at DESC 
LIMIT 1;
```

**Esperado:**
- ✅ `status = 'PAID'`
- ✅ `plan_slug = 'professional'`
- ✅ `paid_at` preenchido

---

#### Teste 4: Verificar Transação Criada

```sql
SELECT 
    id,
    invoice_id,
    type,
    status,
    amount
FROM transactions 
ORDER BY created_at DESC 
LIMIT 1;
```

**Esperado:**
- ✅ `type = 'PAYMENT'`
- ✅ `status = 'CONFIRMED'`
- ✅ `amount = 199.00` (ou valor do plano)

---

#### Teste 5: Verificar Frontend (checkCondoStatus)

1. Após confirmação, acesse o app (`App.jsx`)
2. Verifique no console se `checkCondoStatus` está funcionando
3. Se plano estiver ativo → deve retornar `'active'`

**Teste manual de vencimento (no SQL):**

```sql
-- Simular plano vencido (apenas para teste)
UPDATE condos 
SET plan_end_date = NOW() - INTERVAL '1 day'
WHERE id = 'SEU_CONDO_ID';

-- Verificar no frontend se acesso é bloqueado
-- Deve mostrar tela de billing/expired
```

**Esperado:**
- ✅ Frontend bloqueia acesso quando `plan_end_date < NOW()`
- ✅ Mostra tela de billing/expired

---

#### Teste 6: Verificar RLS (is_condo_active)

```sql
-- Testar função diretamente
SELECT public.is_condo_active('SEU_CONDO_ID');

-- Se plano vencido → deve retornar FALSE
-- Se plano ativo → deve retornar TRUE
```

**Teste completo:**

```sql
-- 1. Plano ativo (deve retornar TRUE)
SELECT public.is_condo_active('SEU_CONDO_ID_ATIVO');

-- 2. Simular vencido
UPDATE condos SET plan_end_date = NOW() - INTERVAL '1 day' WHERE id = 'SEU_CONDO_ID';

-- 3. Verificar função (deve retornar FALSE agora)
SELECT public.is_condo_active('SEU_CONDO_ID');

-- 4. Restaurar para teste
UPDATE condos SET plan_end_date = NOW() + INTERVAL '30 days' WHERE id = 'SEU_CONDO_ID';
```

---

#### Teste 7: Edge Function check-plan-expiry (Opcional)

```bash
# Chamar manualmente via curl ou Postman
curl -X GET \
  "https://slsmtndfsydmaixsqkcj.supabase.co/functions/v1/check-plan-expiry" \
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"
```

**Esperado:**
- ✅ Retorna JSON com `expiredCount`
- ✅ Se houver planos vencidos, atualiza status

---

## ✅ CHECKLIST DE VALIDAÇÃO

Marque conforme testar:

### Migrations
- [ ] Migration 1 executada com sucesso
- [ ] Migration 2 executada com sucesso
- [ ] Migration 3 executada com sucesso
- [ ] Colunas criadas corretamente
- [ ] Função RPC recriada

### Edge Functions
- [ ] `create-payment` deployado (já feito)
- [ ] `check-plan-expiry` deployado (já feito)

### Teste de Criação de Pagamento
- [ ] QR Code é exibido
- [ ] `invoices.plan_slug` é salvo corretamente
- [ ] Polling inicia

### Teste de Confirmação (Webhook/RPC)
- [ ] Função RPC atualiza condomínio corretamente
- [ ] `plan_type` atualizado
- [ ] `plan_end_date` calculado (30 dias)
- [ ] `staff_limit` e `unit_limit` atualizados
- [ ] `last_payment_date` preenchido
- [ ] Invoice marcada como PAID
- [ ] Transação criada

### Teste de Controle de Acesso
- [ ] Frontend bloqueia quando `plan_end_date` vencido
- [ ] Função `is_condo_active` retorna FALSE quando vencido
- [ ] RLS bloqueia acesso quando vencido

---

## 🔧 COMANDOS ÚTEIS PARA TESTE

### Verificar Invoice Criada

```sql
SELECT 
    i.id,
    i.plan_slug,
    i.status,
    i.amount,
    i.billing_type,
    i.created_at,
    c.condo_id
FROM invoices i
JOIN customers c ON i.customer_id = c.id
ORDER BY i.created_at DESC
LIMIT 5;
```

### Verificar Condomínio Após Pagamento

```sql
SELECT 
    id,
    name,
    plan_type,
    subscription_status,
    plan_start_date,
    plan_end_date,
    last_payment_date,
    staff_limit,
    unit_limit,
    is_active
FROM condos
WHERE id = 'SEU_CONDO_ID'
ORDER BY updated_at DESC;
```

### Testar Função RPC Manualmente

```sql
-- IMPORTANTE: Use ID real da invoice
DO $$
DECLARE
    v_invoice_id UUID;
BEGIN
    -- Pegar última invoice
    SELECT id INTO v_invoice_id 
    FROM invoices 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Chamar função
    PERFORM public.handle_payment_confirmed(
        v_invoice_id,
        '{"id": "test_manual", "value": 199.00, "dateCreated": "2025-01-16T12:00:00Z"}'::jsonb
    );
    
    RAISE NOTICE 'Função executada para invoice: %', v_invoice_id;
END $$;
```

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Não commitar até testar:** Todas as mudanças estão locais
2. **Testar em ambiente de desenvolvimento primeiro**
3. **Backup do banco antes de executar migrations** (recomendado)
4. **Validar cada passo antes de prosseguir**

---

## 📝 PRÓXIMOS PASSOS APÓS TESTE

Se tudo estiver funcionando:

1. ✅ Commit das migrations
2. ✅ Commit das Edge Functions
3. ✅ Commit do frontend
4. ✅ Push para repositório

Se houver problemas:

1. Reportar erro específico
2. Reverter migrations se necessário
3. Corrigir e testar novamente

---

**Status:** ⏳ **AGUARDANDO TESTES**
