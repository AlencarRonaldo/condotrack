# 🚀 CondoTrack - Deploy Asaas (Produção)

## ✅ Checklist de Deploy

### 1️⃣ Regenerar API Key do Asaas (OBRIGATÓRIO)
A chave que você compartilhou está comprometida. 

1. Acesse: https://www.asaas.com/config/api
2. Revogue a chave antiga
3. Gere uma **nova API key de produção**
4. Copie e guarde em local seguro

---

### 2️⃣ Configurar Secrets no Supabase

Execute no seu terminal (substitua os valores):

```bash
# API Key do Asaas (produção)
npx supabase secrets set ASAAS_API_KEY="SUA_NOVA_CHAVE_ASAAS" --project-ref slsmtndfsydmaixsqkcj

# Base URL (produção)
npx supabase secrets set ASAAS_BASE_URL="https://api.asaas.com/v3" --project-ref slsmtndfsydmaixsqkcj

# Token do Webhook (o mesmo que você definiu no painel do Asaas)
npx supabase secrets set ASAAS_WEBHOOK_TOKEN="SEU_TOKEN_WEBHOOK" --project-ref slsmtndfsydmaixsqkcj
```

**Onde pegar cada valor:**
- `ASAAS_API_KEY`: gerada no passo 1
- `ASAAS_BASE_URL`: já está correto (`https://api.asaas.com/v3`)
- `ASAAS_WEBHOOK_TOKEN`: o token que você definiu ao criar o webhook no Asaas

---

### 3️⃣ Executar Migração Asaas Fields

No **Supabase Dashboard** → **SQL Editor**, execute:

```sql
-- Arquivo: supabase/migrations/004_asaas_fields.sql
```

Ou via terminal:
```bash
npx supabase db push --project-ref slsmtndfsydmaixsqkcj
```

---

### 4️⃣ Deploy das Edge Functions

```bash
# Deploy auth-login (já existente, mas redeploy para garantir)
npx supabase functions deploy auth-login --project-ref slsmtndfsydmaixsqkcj

# Deploy asaas-create-checkout
npx supabase functions deploy asaas-create-checkout --project-ref slsmtndfsydmaixsqkcj

# Deploy asaas-webhook
npx supabase functions deploy asaas-webhook --project-ref slsmtndfsydmaixsqkcj
```

---

### 5️⃣ Configurar Webhook no Asaas

Acesse: https://www.asaas.com/config/webhooks

**Configuração:**
- **Ativo**: Sim
- **Nome**: `CondoTrack - Produção`
- **URL**: `https://slsmtndfsydmaixsqkcj.supabase.co/functions/v1/asaas-webhook`
- **E-mail**: seu e-mail técnico
- **Versão da API**: v3
- **Token de autenticação**: o mesmo que você setou em `ASAAS_WEBHOOK_TOKEN`
- **Fila de sincronização**: Sim
- **Tipo de envio**: JSON
- **Eventos**:
  - ✅ Cobranças
  - ✅ Assinaturas

---

### 6️⃣ Criar Dados de Teste no Supabase

No **SQL Editor**, execute:

```sql
-- Criar condomínio de teste
INSERT INTO condos (id, name, plan_type, staff_limit, unit_limit, trial_end_date, is_active)
VALUES ('condo-test-prod', 'Edifício Teste Produção', 'trial', 2, 50, NOW() - INTERVAL '1 day', true);

-- Criar admin (senha: admin123)
INSERT INTO staff (condo_id, name, username, password, role)
VALUES ('condo-test-prod', 'Admin Teste', 'admin', 'admin123', 'admin');

-- Criar porteiro (senha: port123)
INSERT INTO staff (condo_id, name, username, password, role)
VALUES ('condo-test-prod', 'Porteiro Teste', 'porteiro', 'port123', 'porteiro');

-- Criar unidades
INSERT INTO units (condo_id, number, block, floor) VALUES
('condo-test-prod', '101', 'A', 1),
('condo-test-prod', '102', 'A', 1),
('condo-test-prod', '201', 'A', 2);
```

---

### 7️⃣ Configurar Variáveis de Ambiente no Frontend

Se estiver usando Vercel/Netlify, configure:

```env
VITE_SUPABASE_URL=https://slsmtndfsydmaixsqkcj.supabase.co
VITE_SUPABASE_ANON_KEY=<sua_anon_key>
VITE_APP_ENV=production
```

---

## 🧪 Testar o Fluxo Completo

### Teste 1: Login
1. Acesse: `https://seu-dominio.com/app` (ou `npm run dev` local)
2. Login:
   - **Condo ID**: `condo-test-prod`
   - **Usuário**: `admin`
   - **Senha**: `admin123`

### Teste 2: Checkout Pix
1. Após login, o sistema deve mostrar "Trial Expirado"
2. Clique em **"Assinar Agora"** no plano PRO
3. Selecione **"Pix"**
4. Deve redirecionar para página do Asaas com QR Code
5. **Não pague ainda** (só validar que gerou o link)

### Teste 3: Checkout Cartão
1. Volte para o app (cancele o pagamento Pix)
2. Clique em **"Assinar Agora"** novamente
3. Selecione **"Cartão"**
4. Deve redirecionar para página do Asaas com formulário de cartão
5. **Não pague ainda** (só validar que gerou o link)

### Teste 4: Webhook
1. No painel do Asaas, vá em **Webhooks** → **Histórico**
2. Verifique se aparecem eventos sendo enviados
3. No Supabase, vá em **Table Editor** → `webhook_events`
4. Deve aparecer registros dos eventos processados

---

## ⚠️ Troubleshooting

### Erro: "ASAAS_API_KEY not found"
- Verifique se rodou os comandos `npx supabase secrets set`
- Redeploy das funções após setar secrets

### Erro: "Webhook signature invalid"
- Certifique-se que `ASAAS_WEBHOOK_TOKEN` é o mesmo no Asaas e no Supabase

### Erro: "Customer already exists"
- Normal em testes. A função trata isso e reutiliza o customer existente

### Checkout não gera URL
- Verifique logs no Supabase: **Functions** → **Logs**
- Confirme que a API Key do Asaas está válida (teste no Postman)

---

## 📋 Status do Deploy

Marque conforme for executando:

- [ ] API Key regenerada
- [ ] Secrets configurados
- [ ] Migração 004 executada
- [ ] Edge Functions deployadas
- [ ] Webhook configurado no Asaas
- [ ] Dados de teste criados
- [ ] Teste de login OK
- [ ] Teste de checkout Pix OK
- [ ] Teste de checkout Cartão OK
- [ ] Webhook recebendo eventos OK

---

## 🎯 Próximos Passos (Após Deploy)

1. **Semana 3**: Rate limit, auditoria completa, backups
2. **Semana 4**: Testes E2E, hardening, go-live
3. **Produção**: Monitoramento, alertas, documentação de suporte

---

**Qualquer erro ou dúvida, me envie:**
- Logs da Edge Function (Supabase → Functions → Logs)
- Screenshot do erro
- Resposta da API (se houver)
