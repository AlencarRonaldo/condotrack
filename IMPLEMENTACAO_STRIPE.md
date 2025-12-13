# CondoTrack Pro - Implementacao Stripe e Sistema de Pagamentos

## Resumo do Projeto

**CondoTrack Pro** e um SaaS Multi-Tenant para gestao de encomendas em condominios.
Este documento descreve toda a implementacao do sistema de pagamentos com Stripe.

---

## 1. Arquitetura Implementada

### 1.1 Fluxo de Conversao (Funil SaaS)

```
Landing Page (index.html)
        |
        v
Registro (register.html) --> Cria conta com 15 dias de trial
        |
        v
App (app.html) --> Sistema principal
        |
        v (se trial expirado)
BillingCheckout --> Escolha de plano e pagamento
        |
        v
Stripe Checkout --> Pagamento seguro
        |
        v (webhook)
Conta Desbloqueada --> Acesso liberado por 30 dias
```

### 1.2 Estrutura de Arquivos

```
condotrack/
├── src/
│   └── App.jsx                    # Componente principal com BillingCheckout
├── supabase/
│   └── functions/
│       └── auth-login/
│           └── index.ts           # Edge Function de autenticacao
├── index.html                     # Landing Page
├── register.html                  # Pagina de Registro
├── app.html                       # Aplicacao principal
├── billing.html                   # Pagina de billing (fallback)
└── vercel.json                    # Configuracao de deploy
```

---

## 2. Sistema de Planos

### 2.1 Tabela de Planos (plans)

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 'BASICO', 'PRO', 'PREMIUM'
  slug TEXT UNIQUE NOT NULL,             -- 'basic', 'professional', 'premium'
  price_monthly DECIMAL(10,2) NOT NULL,  -- 99.00, 199.00, 349.00
  staff_limit INTEGER NOT NULL,          -- 2, 5, 10
  unit_limit INTEGER NOT NULL,           -- 50, 150, 9999
  features JSONB,                        -- Array de features
  is_active BOOLEAN DEFAULT true,
  stripe_price_id TEXT,                  -- Price ID do Stripe
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dados iniciais
INSERT INTO plans (name, slug, price_monthly, staff_limit, unit_limit, features, stripe_price_id) VALUES
('BASICO', 'basic', 99.00, 2, 50,
 '["Ate 2 porteiros", "Ate 50 unidades", "Gestao de encomendas", "Notificacao WhatsApp", "Historico 90 dias"]',
 'price_basic_xxx'),
('PRO', 'professional', 199.00, 5, 150,
 '["Ate 5 porteiros", "Ate 150 unidades", "Tudo do Basico", "Relatorios avancados", "Exportacao PDF", "Historico ilimitado", "Suporte prioritario"]',
 'price_pro_xxx'),
('PREMIUM', 'premium', 349.00, 10, 9999,
 '["Ate 10 porteiros", "Unidades ilimitadas", "Tudo do PRO", "API de integracao", "Suporte 24/7", "SLA 99.9%", "Onboarding dedicado"]',
 'price_premium_xxx');
```

### 2.2 Configuracao no Frontend (App.jsx)

```javascript
const PLANS_CONFIG = {
  basic: {
    name: 'BASICO',
    price: 99,
    priceFormatted: 'R$ 99',
    staffLimit: 2,
    unitLimit: 50,
    features: ['Ate 2 porteiros', 'Ate 50 unidades', ...]
  },
  professional: {
    name: 'PRO',
    price: 199,
    priceFormatted: 'R$ 199',
    staffLimit: 5,
    unitLimit: 150,
    features: [...],
    popular: true  // Destaque visual
  },
  premium: {
    name: 'PREMIUM',
    price: 349,
    priceFormatted: 'R$ 349',
    staffLimit: 10,
    unitLimit: 9999,
    features: [...]
  }
};
```

---

## 3. Sistema de Trial e Bloqueio

### 3.1 Campos na Tabela condos

```sql
ALTER TABLE condos ADD COLUMN trial_end_date TIMESTAMPTZ;
ALTER TABLE condos ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE condos ADD COLUMN last_payment_date TIMESTAMPTZ;
ALTER TABLE condos ADD COLUMN subscription_status TEXT DEFAULT 'trial';
```

### 3.2 Logica de Status

```javascript
function checkCondoStatus(condo) {
  // Conta inativa manualmente
  if (condo.is_active === false) return 'inactive';

  // Verifica trial
  if (condo.trial_end_date) {
    const trialEnd = new Date(condo.trial_end_date);
    if (new Date() > trialEnd) return 'expired';
  }

  return 'active';
}
```

### 3.3 Comportamento por Status

| Status | Comportamento |
|--------|---------------|
| `active` | Acesso total ao sistema |
| `expired` | Mostra BillingCheckout (escolha de plano) |
| `inactive` | Mostra BillingCheckout (conta suspensa) |

---

## 4. Integracao Stripe

### 4.1 Variaveis de Ambiente

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_STRIPE_WEBHOOK_SECRET=whsec_xxx
VITE_STRIPE_PRICE_BASIC=price_xxx
VITE_STRIPE_PRICE_PRO=price_xxx
VITE_STRIPE_PRICE_PREMIUM=price_xxx
```

### 4.2 Constantes no Codigo

```javascript
// Chaves Stripe
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_demo_key';
const STRIPE_WEBHOOK_SECRET = import.meta.env.VITE_STRIPE_WEBHOOK_SECRET || 'whsec_demo_secret';

// Endpoints
const CHECKOUT_ENDPOINT = IS_PRODUCTION
  ? `${SUPABASE_URL}/functions/v1/create-checkout-session`
  : null;

const WEBHOOK_ENDPOINT = IS_PRODUCTION
  ? `${SUPABASE_URL}/functions/v1/stripe-webhook`
  : null;

// Price IDs
const STRIPE_PRICE_IDS = {
  basic: import.meta.env.VITE_STRIPE_PRICE_BASIC || 'price_basic_demo',
  professional: import.meta.env.VITE_STRIPE_PRICE_PRO || 'price_pro_demo',
  premium: import.meta.env.VITE_STRIPE_PRICE_PREMIUM || 'price_premium_demo'
};
```

### 4.3 Funcao createStripeSession()

```javascript
export async function createStripeSession(planKey, condoId, condoName) {
  // PRODUCAO: Chama Edge Function
  if (IS_PRODUCTION && CHECKOUT_ENDPOINT) {
    const response = await fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        priceId: STRIPE_PRICE_IDS[planKey],
        planKey,
        condoId,
        condoName,
        successUrl: `${window.location.origin}/app?payment=success`,
        cancelUrl: `${window.location.origin}/app?payment=cancelled`
      })
    });
    return await response.json();
  }

  // DEMO: Retorna URL ficticia
  return {
    success: true,
    checkoutUrl: `https://checkout.stripe.com/demo/...`,
    sessionId: `cs_demo_${Date.now()}`,
    isDemo: true
  };
}
```

### 4.4 Funcao simulateWebhookSuccess()

```javascript
export async function simulateWebhookSuccess(condoId, planKey) {
  // PRODUCAO: Chama Edge Function
  if (IS_PRODUCTION && WEBHOOK_ENDPOINT) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulate-payment`, {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ condoId, planKey, eventType: 'checkout.session.completed' })
    });
    return await response.json();
  }

  // DEMO: Atualiza localStorage
  const condos = read('condos');
  const condoIndex = condos.findIndex(c => c.id === condoId);

  condos[condoIndex] = {
    ...condos[condoIndex],
    is_active: true,                              // Ativa a conta
    plan_type: planKey,                           // Define o plano
    staff_limit: plan.staffLimit,                 // Limite de staff
    unit_limit: plan.unitLimit,                   // Limite de unidades
    trial_end_date: nextBillingDate.toISOString(), // +30 dias
    last_payment_date: new Date().toISOString(),
    subscription_status: 'active'
  };

  write('condos', condos);
  return { success: true, condo: condos[condoIndex] };
}
```

---

## 5. Componente BillingCheckout

### 5.1 Props

```javascript
function BillingCheckout({
  condoInfo,        // Dados do condominio
  onPaymentSuccess, // Callback apos pagamento
  onLogout,         // Callback para logout
  isAdmin           // Se e admin (para painel de teste)
}) { ... }
```

### 5.2 Estados

```javascript
const [selectedPlan, setSelectedPlan] = useState('professional');
const [isProcessing, setIsProcessing] = useState(false);
const [isRedirecting, setIsRedirecting] = useState(false);
const [showPaymentModal, setShowPaymentModal] = useState(false);
const [paymentSuccess, setPaymentSuccess] = useState(false);
const [showTestPanel, setShowTestPanel] = useState(false);
const [error, setError] = useState('');
```

### 5.3 Fluxo de Assinatura

```javascript
const handleSubscribe = async (planKey) => {
  setIsProcessing(true);

  const session = await createStripeSession(planKey, condoInfo.id, condoInfo.name);

  if (session.isDemo) {
    // Modo Demo: mostra modal de pagamento simulado
    setShowPaymentModal(true);
  } else {
    // Producao: redireciona para Stripe Checkout
    setIsRedirecting(true);
    window.location.href = session.checkoutUrl;
  }
};
```

### 5.4 Painel de Teste (Dev Mode)

Aparece apenas quando `IS_PRODUCTION = false`:

- Selecao de plano (BASICO, PRO, PREMIUM)
- Botao "Simular Pagamento"
- Chama `simulateWebhookSuccess()` diretamente
- Desbloqueia conta instantaneamente

---

## 6. Edge Functions (Supabase)

### 6.1 auth-login (Implementada)

**Arquivo:** `supabase/functions/auth-login/index.ts`

**Funcionalidade:**
- Recebe username, password, condoId
- Valida credenciais no backend (seguro)
- Retorna user, condo, condoStatus

**Endpoint:** `POST /functions/v1/auth-login`

### 6.2 create-checkout-session (A Implementar)

**Arquivo:** `supabase/functions/create-checkout-session/index.ts`

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

serve(async (req) => {
  const { priceId, condoId, successUrl, cancelUrl } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { condoId }
  });

  return new Response(JSON.stringify({
    url: session.url,
    sessionId: session.id
  }));
});
```

### 6.3 stripe-webhook (A Implementar)

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

```typescript
import Stripe from 'stripe';

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    Deno.env.get('STRIPE_WEBHOOK_SECRET')
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const condoId = session.metadata.condoId;

    // Atualiza condominio no banco
    await supabaseAdmin.from('condos').update({
      is_active: true,
      plan_type: session.metadata.planKey,
      trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      last_payment_date: new Date(),
      subscription_status: 'active'
    }).eq('id', condoId);
  }

  return new Response(JSON.stringify({ received: true }));
});
```

---

## 7. Configuracao Stripe Dashboard

### 7.1 Criar Produtos

1. Acesse https://dashboard.stripe.com/products
2. Crie 3 produtos:
   - **CondoTrack BASICO** - R$ 99/mes
   - **CondoTrack PRO** - R$ 199/mes
   - **CondoTrack PREMIUM** - R$ 349/mes

### 7.2 Copiar Price IDs

Cada produto tera um Price ID (ex: `price_1ABC123...`).
Configure nas variaveis de ambiente:

```env
VITE_STRIPE_PRICE_BASIC=price_1ABC123...
VITE_STRIPE_PRICE_PRO=price_1DEF456...
VITE_STRIPE_PRICE_PREMIUM=price_1GHI789...
```

### 7.3 Configurar Webhook

1. Acesse https://dashboard.stripe.com/webhooks
2. Adicione endpoint: `https://seu-projeto.supabase.co/functions/v1/stripe-webhook`
3. Selecione eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copie o Webhook Secret para variaveis de ambiente

---

## 8. Deploy

### 8.1 Vercel (Frontend)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Variaveis de ambiente no Vercel:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PRICE_BASIC`
- `VITE_STRIPE_PRICE_PRO`
- `VITE_STRIPE_PRICE_PREMIUM`

### 8.2 Supabase (Edge Functions)

```bash
# Login
npx supabase login

# Deploy auth-login
npx supabase functions deploy auth-login --project-ref SEU_PROJECT_REF

# Deploy create-checkout-session
npx supabase functions deploy create-checkout-session --project-ref SEU_PROJECT_REF

# Deploy stripe-webhook
npx supabase functions deploy stripe-webhook --project-ref SEU_PROJECT_REF
```

**Secrets no Supabase:**

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx --project-ref SEU_PROJECT_REF
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx --project-ref SEU_PROJECT_REF
```

---

## 9. Checklist de Implementacao

### Concluido

- [x] Configuracao de constantes Stripe
- [x] Funcao `createStripeSession()`
- [x] Funcao `simulateWebhookSuccess()`
- [x] Componente `BillingCheckout` refatorado
- [x] Painel de teste para Dev Mode
- [x] Edge Function `auth-login`
- [x] Sistema de trial (15 dias)
- [x] Bloqueio por expiracao
- [x] Dark Mode mantido
- [x] Multi-Tenant mantido
- [x] Auto-PIN mantido

### Pendente (Producao)

- [ ] Criar produtos no Stripe Dashboard
- [ ] Configurar Price IDs nas variaveis de ambiente
- [ ] Implementar Edge Function `create-checkout-session`
- [ ] Implementar Edge Function `stripe-webhook`
- [ ] Configurar webhook no Stripe Dashboard
- [ ] Deploy das Edge Functions
- [ ] Testar fluxo completo em producao

---

## 10. Fluxo Completo de Pagamento

```
┌─────────────────────────────────────────────────────────────────┐
│                   FLUXO DE PAGAMENTO STRIPE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario com trial expirado acessa /app                     │
│                         |                                       │
│                         v                                       │
│  2. App detecta condoStatus = 'expired'                        │
│                         |                                       │
│                         v                                       │
│  3. Renderiza <BillingCheckout />                              │
│                         |                                       │
│                         v                                       │
│  4. Usuario clica "Assinar Agora" no plano PRO                 │
│                         |                                       │
│                         v                                       │
│  5. handleSubscribe('professional')                            │
│                         |                                       │
│                         v                                       │
│  6. createStripeSession('professional', condoId, condoName)    │
│                         |                                       │
│         ┌───────────────┴───────────────┐                      │
│         |                               |                       │
│         v                               v                       │
│    PRODUCAO                         DEMO                        │
│    Edge Function                    Modal local                 │
│         |                               |                       │
│         v                               v                       │
│  7. Stripe Checkout              Formulario cartao              │
│    (pagina externa)              (simulado)                     │
│         |                               |                       │
│         v                               v                       │
│  8. Pagamento aprovado          handleProcessPayment()          │
│         |                               |                       │
│         v                               v                       │
│  9. Webhook Stripe              simulateWebhookSuccess()        │
│    stripe-webhook                       |                       │
│         |                               |                       │
│         └───────────────┬───────────────┘                      │
│                         |                                       │
│                         v                                       │
│  10. Atualiza banco de dados:                                  │
│      - is_active = true                                        │
│      - plan_type = 'professional'                              │
│      - trial_end_date = +30 dias                               │
│      - staff_limit = 5                                         │
│      - unit_limit = 150                                        │
│                         |                                       │
│                         v                                       │
│  11. onPaymentSuccess(updatedCondo)                            │
│                         |                                       │
│                         v                                       │
│  12. setCondoStatus('active')                                  │
│                         |                                       │
│                         v                                       │
│  13. Renderiza App principal (acesso liberado)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Suporte e Contato

Desenvolvido por **PlayCodeAgency**
- Website: https://playcodeagency.xyz

---

*Documento gerado em: 30/11/2025*
*Versao: 1.0*
