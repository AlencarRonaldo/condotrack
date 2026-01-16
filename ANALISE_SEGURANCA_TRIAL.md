# 🔒 ANÁLISE DE SEGURANÇA - BLOQUEIO POR TRIAL

**Data:** 16 de Janeiro de 2025  
**Analista:** Arquiteto de Soluções - Supabase Security Expert

---

## 🚨 VULNERABILIDADES CRÍTICAS IDENTIFICADAS

### 1. ❌ **RLS Policies NÃO Bloqueiam Trial Expirado**

**Problema:** As políticas RLS atuais permitem acesso mesmo com trial expirado.

**Evidência:**
```sql
-- Política atual (INSEGURA):
CREATE POLICY "packages_select_same_condo" ON packages
  FOR SELECT
  USING (true); -- ❌ Permite acesso mesmo com trial expirado!
```

**Impacto:** Usuário pode fazer SELECT, INSERT, UPDATE mesmo após trial expirar.

---

### 2. ❌ **Bloqueio Apenas no Frontend**

**Problema:** O bloqueio está apenas escondendo botões no React.

**Evidência:**
```javascript
// src/App.jsx linha ~1334
{condoStatus === 'expired' || condoStatus === 'inactive' ? (
  <BillingCheckout /> // ❌ Apenas esconde a UI
) : (
  <ConciergeView /> // ❌ Mas ainda pode fazer queries diretas!
)}
```

**Impacto:** Usuário pode usar DevTools/Postman para fazer queries diretas ao Supabase, bypassando o frontend.

---

### 3. ❌ **Edge Functions NÃO Validam Trial**

**Problema:** Nenhuma Edge Function (exceto auth-login) verifica se o trial expirou antes de executar ações.

**Evidência:**
- `register-condo`: ✅ OK (criação inicial)
- `auth-login`: ✅ Verifica status
- **FALTANDO:** Validação em operações de INSERT/UPDATE/DELETE

**Impacto:** Mesmo com trial expirado, usuário pode criar/editar dados via Edge Functions (se existirem).

---

### 4. ⚠️ **Problemas de Timezone**

**Problema:** Cálculo de datas no JavaScript pode ter problemas de timezone.

**Evidência:**
```javascript
// src/App.jsx linha ~732
const trialEnd = new Date(condoData.trial_end_date); // ❌ Pode ter problema de timezone
const now = new Date(); // ❌ Usa timezone local do navegador
if (now > trialEnd) { ... }
```

**Impacto:** Bloqueio pode acontecer em horário diferente dependendo do timezone do usuário.

---

### 5. ⚠️ **Falta Distinção Entre Estados**

**Problema:** Não há distinção clara entre:
- Trial expirado (nunca pagou)
- Cancelado (pagou mas cancelou)
- Past Due (pagou mas pagamento falhou)

**Impacto:** Dificulta tratamento diferenciado e auditoria.

---

## ✅ SOLUÇÃO PROPOSTA - IMPLEMENTAÇÃO SEGURA

### **Camada 1: RLS Policies no Banco de Dados (CRÍTICO)**

Criar função auxiliar e políticas que verificam trial no banco:

```sql
-- Função auxiliar para verificar se condomínio está ativo
CREATE OR REPLACE FUNCTION public.is_condo_active(condo_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  condo_record RECORD;
BEGIN
  SELECT 
    subscription_status,
    trial_end_date,
    is_active
  INTO condo_record
  FROM public.condos
  WHERE id = condo_id_param;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Conta inativa manualmente
  IF condo_record.is_active = FALSE THEN
    RETURN FALSE;
  END IF;
  
  -- Se tem assinatura ativa, permite acesso
  IF condo_record.subscription_status = 'active' THEN
    RETURN TRUE;
  END IF;
  
  -- Se está em trial, verifica se expirou
  IF condo_record.subscription_status = 'trial' THEN
    IF condo_record.trial_end_date IS NULL THEN
      RETURN FALSE; -- Trial sem data = inválido
    END IF;
    
    -- Compara em UTC (evita problemas de timezone)
    IF NOW() AT TIME ZONE 'UTC' > condo_record.trial_end_date AT TIME ZONE 'UTC' THEN
      RETURN FALSE; -- Trial expirado
    END IF;
    
    RETURN TRUE; -- Trial ainda ativo
  END IF;
  
  -- Outros status (expired, canceled, past_due, inactive) = bloqueado
  RETURN FALSE;
END;
$$;
```

**Políticas RLS Atualizadas:**

```sql
-- Packages: Bloqueia SELECT/INSERT/UPDATE se trial expirou
DROP POLICY IF EXISTS "packages_select_same_condo" ON packages;
CREATE POLICY "packages_select_same_condo" ON packages
  FOR SELECT
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id) -- ✅ BLOQUEIA se trial expirou
  );

DROP POLICY IF EXISTS "packages_insert" ON packages;
CREATE POLICY "packages_insert" ON packages
  FOR INSERT
  WITH CHECK (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id) -- ✅ BLOQUEIA INSERT se trial expirou
  );

DROP POLICY IF EXISTS "packages_update" ON packages;
CREATE POLICY "packages_update" ON packages
  FOR UPDATE
  USING (
    condo_id IS NOT NULL
    AND public.is_condo_active(condo_id) -- ✅ BLOQUEIA UPDATE se trial expirou
  );
```

**Aplicar para TODAS as tabelas:**
- `packages`
- `residents`
- `staff` (exceto leitura para login)
- `units`
- `settings`

---

### **Camada 2: Validação em Edge Functions**

Todas as Edge Functions que fazem INSERT/UPDATE/DELETE devem validar:

```typescript
// Exemplo: Edge Function para criar encomenda
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { condoId, packageData } = await req.json();

  // ✅ VALIDAÇÃO CRÍTICA: Verifica se condomínio está ativo
  const { data: condo, error: condoError } = await supabaseAdmin
    .from('condos')
    .select('subscription_status, trial_end_date, is_active')
    .eq('id', condoId)
    .single();

  if (condoError || !condo) {
    return new Response(
      JSON.stringify({ error: 'Condomínio não encontrado' }),
      { status: 404, headers: corsHeaders }
    );
  }

  // ✅ Verifica se está ativo (função auxiliar ou lógica inline)
  const isActive = checkCondoActive(condo);
  if (!isActive) {
    return new Response(
      JSON.stringify({ 
        error: 'Trial expirado ou conta inativa. Escolha um plano para continuar.',
        code: 'TRIAL_EXPIRED'
      }),
      { status: 403, headers: corsHeaders }
    );
  }

  // Prossegue com a operação...
});
```

---

### **Camada 3: Frontend (UX apenas, não segurança)**

O frontend deve:
1. Esconder botões quando `condoStatus === 'expired'`
2. Mostrar mensagem clara
3. Redirecionar para billing
4. **MAS:** Não confiar apenas nisso para segurança!

---

### **Camada 4: Função Auxiliar SQL (Timezone-Safe)**

```sql
-- Função para verificar trial expirado (timezone-safe)
CREATE OR REPLACE FUNCTION public.is_trial_expired(
  trial_end_date_param TIMESTAMPTZ,
  subscription_status_param TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN subscription_status_param = 'active' THEN FALSE
    WHEN subscription_status_param = 'trial' THEN
      (NOW() AT TIME ZONE 'UTC') > (trial_end_date_param AT TIME ZONE 'UTC')
    ELSE TRUE -- expired, canceled, past_due, inactive
  END;
$$;
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### ✅ **Backend (RLS)**
- [ ] Criar função `is_condo_active(condo_id)`
- [ ] Atualizar políticas RLS de `packages` para verificar trial
- [ ] Atualizar políticas RLS de `residents` para verificar trial
- [ ] Atualizar políticas RLS de `staff` para verificar trial (exceto SELECT para login)
- [ ] Atualizar políticas RLS de `units` para verificar trial
- [ ] Atualizar políticas RLS de `settings` para verificar trial
- [ ] **EXCEÇÃO:** Tabela `condos` - permitir SELECT para verificar status (necessário para login)
- [ ] **EXCEÇÃO:** Tabela `plans` - leitura pública (necessário para escolher plano)

### ✅ **Edge Functions**
- [ ] Adicionar validação de trial em todas as Edge Functions que fazem INSERT/UPDATE/DELETE
- [ ] Retornar erro 403 com mensagem clara quando trial expirou
- [ ] Logar tentativas de acesso com trial expirado (auditoria)

### ✅ **Frontend**
- [ ] Manter bloqueio visual (UX)
- [ ] Tratar erro 403 do backend e mostrar mensagem
- [ ] Redirecionar para billing quando receber erro de trial expirado

### ✅ **Testes de Segurança**
- [ ] Testar: Tentar SELECT com trial expirado (deve bloquear)
- [ ] Testar: Tentar INSERT com trial expirado (deve bloquear)
- [ ] Testar: Tentar UPDATE com trial expirado (deve bloquear)
- [ ] Testar: Tentar via Postman/curl (deve bloquear)
- [ ] Testar: Tentar via DevTools console (deve bloquear)
- [ ] Testar: Timezone diferente (deve funcionar corretamente)
- [ ] Testar: Acesso à página de billing (deve permitir)

---

## 🎯 PRIORIDADES

1. **CRÍTICO:** Implementar RLS policies com bloqueio de trial
2. **ALTO:** Adicionar validação em Edge Functions
3. **MÉDIO:** Melhorar tratamento de timezone
4. **BAIXO:** Distinção entre estados (trial expirado vs cancelado)

---

## 📝 NOTAS IMPORTANTES

- **RLS é a ÚNICA camada de segurança real.** Frontend pode ser bypassado.
- **Edge Functions devem validar mesmo usando service_role** (defense in depth).
- **Timezone:** Sempre usar UTC no banco e comparar em UTC.
- **Performance:** Função `is_condo_active` será chamada em cada query. Considerar cache se necessário.

---

**Status:** 🟡 **VULNERABILIDADES CRÍTICAS IDENTIFICADAS - AÇÃO NECESSÁRIA**
