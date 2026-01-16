# 🔍 Debug: Problema Checkout PIX

## Problema Relatado

- ✅ Mensagem "Assinatura Confirmada!" apareceu
- ❌ PIX não apareceu
- ❌ Não inseriu dados do cartão
- ⚠️ **Sistema foi ativado sem pagamento real**

---

## Possíveis Causas

### 1. **Botão de Teste (Modo Demo)**
Se você estiver em modo demo (`IS_PRODUCTION = false`), há um botão "Simular Pagamento" que ativa a conta sem pagamento real.

**Como verificar:**
- Abra o console do navegador (F12)
- Procure por: `🔧 CondoTrack Pro - Modo: DEMO (localStorage)`
- Se aparecer "DEMO", você está em modo de desenvolvimento

**Solução:** Certifique-se que `VITE_APP_ENV=production` ou que `IS_PRODUCTION = true`

---

### 2. **Erro Silencioso no Checkout**
O checkout pode estar falhando e caindo em um fluxo alternativo.

**Como verificar:**
1. Abra o console do navegador (F12)
2. Tente fazer checkout novamente
3. Procure por logs:
   - `🔄 Iniciando checkout:`
   - `✅ Resposta do checkout:`
   - `❌ Erro ao criar sessão de checkout:`

**O que procurar:**
- Se aparecer erro, copie a mensagem completa
- Verifique se `pixQrCode` está presente na resposta
- Verifique se `billingType` está correto

---

### 3. **Edge Function Retornando Erro**
A Edge Function pode estar retornando erro mas o frontend não está tratando corretamente.

**Como verificar:**
1. Acesse: https://supabase.com/dashboard/project/slsmtndfsydmaixsqkcj/functions
2. Clique em `create-payment`
3. Veja os logs mais recentes
4. Procure por erros relacionados a:
   - `ASAAS_API_KEY` não encontrada
   - Erro ao criar cliente no Asaas
   - Erro ao criar pagamento no Asaas
   - QR Code PIX não obtido

---

### 4. **Resposta da API Asaas Incompleta**
A API do Asaas pode não estar retornando o `pixQrCode` na resposta inicial.

**Como verificar nos logs:**
- Procure por: `✅ QR Code PIX obtido via endpoint específico`
- Ou: `✅ QR Code PIX obtido da resposta do pagamento`
- Se aparecer: `❌ ERRO: PIX selecionado mas QR Code não foi obtido!` → problema na API Asaas

---

## Como Testar Corretamente

### Teste 1: Verificar Modo de Produção

```javascript
// No console do navegador
console.log('IS_PRODUCTION:', window.IS_PRODUCTION);
// Deve retornar: true
```

### Teste 2: Fazer Checkout PIX

1. Abra o console (F12)
2. Vá para a página de billing
3. Selecione um plano
4. Escolha **"Pix"**
5. Clique em **"Assinar"**
6. **Observe os logs:**
   - Deve aparecer: `🔄 Iniciando checkout:`
   - Deve aparecer: `✅ Resposta do checkout:`
   - Deve aparecer: `💚 PIX detectado, exibindo QR Code:`

### Teste 3: Verificar Logs da Edge Function

1. Acesse: https://supabase.com/dashboard/project/slsmtndfsydmaixsqkcj/functions
2. Clique em `create-payment`
3. Veja os logs em tempo real
4. Procure por:
   - `📤 Retornando resposta:`
   - `hasPixQrCode: true` ou `false`

---

## Correções Aplicadas

### 1. **Logs Adicionados**
- ✅ Logs no frontend para rastrear o fluxo
- ✅ Logs na Edge Function para debug
- ✅ Validação de resposta antes de processar

### 2. **Tratamento de Erros Melhorado**
- ✅ Erro explícito se PIX não vier na resposta
- ✅ Validação de `session.success`
- ✅ Mensagens de erro mais claras

### 3. **Validação de Resposta**
- ✅ Verifica se `pixQrCode` existe antes de exibir
- ✅ Verifica se `checkoutUrl` existe antes de redirecionar
- ✅ Lança erro se nenhum dos dois existir

---

## Próximos Passos

1. **Teste novamente** com os logs ativados
2. **Copie os logs** do console e da Edge Function
3. **Verifique** se está em modo produção
4. **Confirme** que a API Key do Asaas está configurada

---

## Se o Problema Persistir

Envie:
1. Logs do console do navegador (F12 → Console)
2. Logs da Edge Function (Dashboard → Functions → create-payment → Logs)
3. Screenshot da tela quando clica em "Assinar"
4. Informação se está em modo demo ou produção

---

**Última atualização:** Logs e validações adicionadas para facilitar debug.
