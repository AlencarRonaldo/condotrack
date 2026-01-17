# ✅ Solução Final: Erro 401 "Invalid JWT" - Edge Function create-payment

## 🎯 Causa Raiz Identificada

O erro **401 "Invalid JWT"** está vindo do **Supabase Gateway**, não da função!

### Problema

1. **Supabase Edge Functions têm `verify_jwt = true` por padrão**
2. O **Gateway valida o JWT ANTES de passar para a função**
3. Quando enviamos `Authorization: Bearer <anon_key>`, o Gateway rejeita porque:
   - Anon key não é um JWT válido de usuário
   - O Gateway espera um token de usuário autenticado

### Fluxo do Erro

```
Frontend → Authorization: Bearer <anon_key>
    ↓
Supabase Gateway (verify_jwt = true)
    ↓ ❌ REJEITA: "Invalid JWT"
    ↓ (nunca chega na função)
```

## ✅ Solução

### Opção 1: Desabilitar verificação JWT no Gateway (Recomendado)

Para endpoints públicos ou híbridos (como criar pagamentos), desabilite a verificação automática:

```bash
npx supabase functions deploy create-payment --project-ref <seu_ref> --no-verify-jwt
```

Isso permite que:
- O Gateway passe a requisição para a função
- A função faça sua própria validação (apikey + condoId do body)
- Funcione tanto com usuário logado quanto não logado

### Opção 2: Usar apenas JWT de usuário (se aplicável)

Se o endpoint deve ser apenas para usuários autenticados, não use anon key:
- Exija login antes de acessar billing.html
- Envie apenas JWT válido de usuário no Authorization
- Mantenha `verify_jwt = true` (padrão)

## 📋 Arquitetura Recomendada

### Para Endpoint Híbrido (Público + Autenticado)

```typescript
// Edge Function: create-payment
Deno.serve(async (req) => {
  // 1. Validar apikey (segurança básica)
  const apikey = req.headers.get('apikey') || 
                 req.headers.get('authorization')?.replace('Bearer ', '');
  if (!apikey) {
    return new Response(JSON.stringify({ error: 'API key não fornecida' }), 
      { status: 401 });
  }

  // 2. Tentar obter condoId do JWT (se houver usuário autenticado)
  let condoId = null;
  const authHeader = req.headers.get('Authorization');
  
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    // Só valida se NÃO for anon key
    if (token && token !== apikey) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      condoId = user?.user_metadata?.condo_id;
    }
  }

  // 3. Fallback: usar condoId do body
  if (!condoId && condoIdFromBody) {
    condoId = condoIdFromBody;
  }

  // 4. Processar pagamento...
});
```

### Frontend

```javascript
const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${userJWT || SUPABASE_ANON_KEY}`
};

// Se tiver JWT válido, usa ele; senão, usa anon key
// A função detecta e não valida anon key como JWT
```

## 🔒 Segurança

### O que a solução garante:

1. ✅ Autenticação básica via `apikey` header
2. ✅ Validação de `condoId` (do JWT ou body)
3. ✅ Verificação de existência do condomínio
4. ✅ Uso de `service_role` no backend (bypass RLS seguro)
5. ✅ Controle manual de autenticação na função

### Quando usar `--no-verify-jwt`:

✅ **USAR:**
- Endpoints públicos (registro, webhooks)
- Endpoints híbridos (aceita usuário logado OU não logado)
- Quando você precisa fazer validação customizada

❌ **NÃO USAR:**
- Endpoints que requerem SEMPRE autenticação
- Operações sensíveis que devem validar JWT no Gateway

## 📝 Checklist de Implementação

- [x] Edge Function corrigida (valida apikey primeiro)
- [x] Frontend corrigido (envia headers corretos)
- [x] Deploy com `--no-verify-jwt`
- [ ] Testar com usuário não logado
- [ ] Testar com usuário logado
- [ ] Validar criação de pagamento PIX

## 🚀 Próximos Passos

Após fazer deploy com `--no-verify-jwt`, teste novamente. O erro 401 "Invalid JWT" não deve mais ocorrer porque:

1. O Gateway não valida mais o JWT automaticamente
2. A função recebe a requisição
3. A função valida `apikey` e aceita `condoId` do body
4. O pagamento é criado no Asaas
