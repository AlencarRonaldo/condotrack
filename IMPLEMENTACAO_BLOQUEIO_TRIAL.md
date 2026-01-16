# 🔒 IMPLEMENTAÇÃO: BLOQUEIO SEGURO POR TRIAL

**Prioridade:** 🔴 **CRÍTICA**  
**Status:** ⚠️ **VULNERABILIDADES IDENTIFICADAS - IMPLEMENTAÇÃO NECESSÁRIA**

---

## 📊 RESUMO EXECUTIVO

### **Vulnerabilidades Críticas Encontradas:**

1. ❌ **RLS Policies não bloqueiam trial expirado** - Usuário pode fazer SELECT/INSERT/UPDATE mesmo após trial expirar
2. ❌ **Bloqueio apenas no frontend** - Pode ser bypassado via DevTools/Postman
3. ❌ **Edge Functions não validam trial** - Operações críticas não verificam status
4. ⚠️ **Problemas de timezone** - Cálculo de datas pode falhar dependendo do fuso horário
5. ⚠️ **Falta distinção entre estados** - Trial expirado vs Cancelado vs Past Due

---

## ✅ SOLUÇÃO COMPLETA

### **1. Migração SQL Criada**

Arquivo: `supabase/migrations/20260116000001_secure_trial_blocking.sql`

**O que faz:**
- Cria função `is_condo_active(condo_id)` que verifica:
  - Se `is_active = false` → bloqueia
  - Se `subscription_status = 'active'` → permite
  - Se `subscription_status = 'trial'` → verifica se `trial_end_date` expirou (em UTC)
  - Outros status → bloqueia

- Atualiza políticas RLS para:
  - `packages`: Bloqueia SELECT/INSERT/UPDATE se trial expirou
  - `residents`: Bloqueia SELECT/INSERT/UPDATE se trial expirou
  - `staff`: Bloqueia INSERT/UPDATE se trial expirou (SELECT permite para login)
  - `units`: Bloqueia SELECT/INSERT/UPDATE se trial expirou
  - `condos`: Permite SELECT (necessário para verificar status), bloqueia UPDATE

---

### **2. Próximos Passos (Edge Functions)**

Todas as Edge Functions que fazem INSERT/UPDATE/DELETE devem validar:

```typescript
// Template para Edge Functions
const { data: condo } = await supabaseAdmin
  .from('condos')
  .select('subscription_status, trial_end_date, is_active')
  .eq('id', condoId)
  .single();

if (!condo || !isCondoActive(condo)) {
  return new Response(
    JSON.stringify({ 
      error: 'Trial expirado ou conta inativa. Escolha um plano para continuar.',
      code: 'TRIAL_EXPIRED'
    }),
    { status: 403, headers: corsHeaders }
  );
}
```

**Edge Functions que precisam de validação:**
- [ ] Criar Edge Function para INSERT packages (se existir)
- [ ] Criar Edge Function para UPDATE packages (se existir)
- [ ] Criar Edge Function para INSERT residents (se existir)
- [ ] Criar Edge Function para INSERT staff (se existir)
- [ ] Criar Edge Function para INSERT units (se existir)

---

### **3. Frontend (Já Implementado - OK)**

O frontend já:
- ✅ Esconde botões quando `condoStatus === 'expired'`
- ✅ Mostra mensagem clara
- ✅ Redireciona para billing

**Melhorias sugeridas:**
- Tratar erro 403 do backend e mostrar mensagem específica
- Adicionar retry automático após pagamento bem-sucedido

---

## 🧪 TESTES DE SEGURANÇA

Após aplicar a migração, testar:

### **Teste 1: SELECT com Trial Expirado**
```sql
-- Como usuário anon (não service_role)
-- Deve retornar 0 linhas se trial expirou
SELECT * FROM packages WHERE condo_id = 'condo-com-trial-expirado';
```

### **Teste 2: INSERT com Trial Expirado**
```sql
-- Deve falhar com erro de política RLS
INSERT INTO packages (condo_id, unit, recipient) 
VALUES ('condo-com-trial-expirado', '101', 'Teste');
```

### **Teste 3: Via Postman/curl**
```bash
# Deve retornar 403 ou 0 resultados
curl -X GET \
  'https://SEU_PROJETO.supabase.co/rest/v1/packages?condo_id=eq.condo-expirado' \
  -H "apikey: SUA_ANON_KEY" \
  -H "Authorization: Bearer SUA_ANON_KEY"
```

### **Teste 4: Timezone**
```sql
-- Criar condomínio com trial_end_date em UTC
-- Testar de diferentes timezones
-- Deve bloquear corretamente em qualquer timezone
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### **Fase 1: Banco de Dados (CRÍTICO)**
- [ ] Executar migração `20260116000001_secure_trial_blocking.sql`
- [ ] Testar função `is_condo_active()` com diferentes cenários
- [ ] Verificar que políticas RLS estão ativas: `SELECT * FROM pg_policies WHERE tablename = 'packages';`
- [ ] Testar SELECT/INSERT/UPDATE com trial expirado (deve bloquear)

### **Fase 2: Edge Functions (ALTO)**
- [ ] Adicionar validação em todas as Edge Functions de escrita
- [ ] Testar cada Edge Function com trial expirado
- [ ] Adicionar logs de auditoria para tentativas bloqueadas

### **Fase 3: Frontend (MÉDIO)**
- [ ] Melhorar tratamento de erro 403
- [ ] Adicionar mensagem específica para trial expirado
- [ ] Testar fluxo completo: trial → expira → bloqueio → pagamento → desbloqueio

### **Fase 4: Testes de Segurança (CRÍTICO)**
- [ ] Testar bypass via DevTools (deve falhar)
- [ ] Testar bypass via Postman (deve falhar)
- [ ] Testar bypass via curl (deve falhar)
- [ ] Testar timezone diferente (deve funcionar)
- [ ] Testar acesso à página de billing (deve permitir)

---

## 🎯 RESPOSTAS ÀS SUAS PERGUNTAS

### **1. Cálculo de Datas e Timezones**

**Problema atual:**
```javascript
// ❌ INSEGURO - Usa timezone local
const trialEnd = new Date(condoData.trial_end_date);
const now = new Date();
if (now > trialEnd) { ... }
```

**Solução implementada:**
```sql
-- ✅ SEGURO - Compara em UTC
IF (NOW() AT TIME ZONE 'UTC') > (trial_end_date AT TIME ZONE 'UTC') THEN
  RETURN FALSE;
END IF;
```

**Resultado:** Bloqueio acontece no momento exato, independente do timezone do usuário.

---

### **2. Camada de Bloqueio**

**ANTES (Inseguro):**
- ❌ Frontend: Apenas esconde botões
- ❌ RLS: `USING (true)` - permite tudo
- ❌ Edge Functions: Não validam

**DEPOIS (Seguro):**
- ✅ Frontend: Esconde botões (UX)
- ✅ **RLS: Bloqueia no banco (SEGURANÇA REAL)**
- ✅ Edge Functions: Validam antes de executar (defense in depth)

---

### **3. Estado da Conta**

**Distinção implementada:**
- `subscription_status = 'trial'` + `trial_end_date` não expirado → ✅ Ativo
- `subscription_status = 'trial'` + `trial_end_date` expirado → ❌ Bloqueado
- `subscription_status = 'active'` → ✅ Ativo (pagou)
- `subscription_status = 'expired'` → ❌ Bloqueado (trial expirou, nunca pagou)
- `subscription_status = 'canceled'` → ❌ Bloqueado (cancelou assinatura)
- `subscription_status = 'past_due'` → ❌ Bloqueado (pagamento falhou)
- `is_active = false` → ❌ Bloqueado (admin desativou)

---

## 🚀 COMO APLICAR

### **Passo 1: Executar Migração**

No Supabase Dashboard → SQL Editor:

```sql
-- Copiar e executar o conteúdo de:
-- supabase/migrations/20260116000001_secure_trial_blocking.sql
```

### **Passo 2: Testar**

```sql
-- Verificar se função foi criada
SELECT public.is_condo_active('seu-condo-id');

-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename IN ('packages', 'residents', 'staff', 'units');
```

### **Passo 3: Validar**

1. Criar condomínio de teste
2. Esperar trial expirar (ou atualizar `trial_end_date` manualmente)
3. Tentar fazer SELECT/INSERT/UPDATE
4. Deve bloquear com erro de política RLS

---

## ⚠️ AVISOS IMPORTANTES

1. **Esta migração é DESTRUTIVA** - Vai alterar políticas RLS existentes
2. **Teste em ambiente de desenvolvimento primeiro**
3. **Backup do banco antes de aplicar em produção**
4. **Monitore logs após aplicar** - Pode haver queries legítimas sendo bloqueadas

---

## 📞 SUPORTE

Se encontrar problemas:
1. Verificar logs do Supabase: Dashboard → Logs → Postgres Logs
2. Verificar políticas ativas: `SELECT * FROM pg_policies;`
3. Testar função manualmente: `SELECT public.is_condo_active('condo-id');`

---

**Status:** 🟡 **PRONTO PARA IMPLEMENTAÇÃO - REVISAR E APLICAR**
