# CondoTrack Pro - Implementação Asaas (Pagamentos Recorrentes)

## Objetivo
Substituir o fluxo Stripe por **Asaas**, com:
- Assinatura recorrente (mensal) por condomínio (tenant)
- Webhook para atualizar status (`active`, `past_due`, `inactive/canceled`)
- Idempotência de webhook via tabela `webhook_events`

## Variáveis/Secrets

### Frontend (Vercel/Netlify)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> **Não existe chave do Asaas no frontend**.

### Supabase (Edge Functions) — `supabase secrets`
- `ASAAS_API_KEY`
- `ASAAS_BASE_URL` (opcional)
  - Sandbox: `https://sandbox.asaas.com/api/v3`
  - Produção: `https://api.asaas.com/v3`
- `ASAAS_WEBHOOK_TOKEN` (recomendado)

## Banco (campos Asaas)
Execute `supabase/migrations/004_asaas_fields.sql` para adicionar:
- `condos.asaas_customer_id`
- `subscriptions.asaas_subscription_id`
- `invoices.asaas_payment_id`, `invoices.invoice_url`

## Edge Functions

### 1) `asaas-create-checkout`
