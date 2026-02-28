import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, CheckCircle, Clock,
  User, Box, Shield, Trash2, AlertTriangle, X, Phone, LogIn, CheckCheck, Briefcase, LogOut, MessageCircle, Sun, Moon,
  FileText, Download, Printer, Filter, FileSpreadsheet, FileJson, Settings, Building2, Save,
  Users, CreditCard, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, BarChart3,
  Mail, ShoppingBag, UtensilsCrossed, HelpCircle,
  Camera, Loader2, UserPlus, ArrowLeft, Link2, Copy, Menu, ChevronDown, MoreHorizontal
} from 'lucide-react';

// ==================================================================================
// 🎨 CONFIGURAÇÃO DE CORES E ÍCONES POR TIPO DE ENCOMENDA
// ==================================================================================
const PACKAGE_TYPE_CONFIG = {
  'Caixa': {
    icon: Box,
    bgLight: 'bg-amber-100',
    bgDark: 'dark:bg-amber-900/50',
    textLight: 'text-amber-600',
    textDark: 'dark:text-amber-400',
    badge: 'bg-amber-500'
  },
  'Pacote': {
    icon: Package,
    bgLight: 'bg-blue-100',
    bgDark: 'dark:bg-blue-900/50',
    textLight: 'text-blue-600',
    textDark: 'dark:text-blue-400',
    badge: 'bg-blue-500'
  },
  'Envelope': {
    icon: Mail,
    bgLight: 'bg-violet-100',
    bgDark: 'dark:bg-violet-900/50',
    textLight: 'text-violet-600',
    textDark: 'dark:text-violet-400',
    badge: 'bg-violet-500'
  },
  'Mercado Livre/Shopee': {
    icon: ShoppingBag,
    bgLight: 'bg-orange-100',
    bgDark: 'dark:bg-orange-900/50',
    textLight: 'text-orange-600',
    textDark: 'dark:text-orange-400',
    badge: 'bg-orange-500'
  },
  'Delivery / Comida': {
    icon: UtensilsCrossed,
    bgLight: 'bg-emerald-100',
    bgDark: 'dark:bg-emerald-900/50',
    textLight: 'text-emerald-600',
    textDark: 'dark:text-emerald-400',
    badge: 'bg-emerald-500'
  },
  'Outro': {
    icon: HelpCircle,
    bgLight: 'bg-slate-100',
    bgDark: 'dark:bg-slate-700',
    textLight: 'text-slate-600',
    textDark: 'dark:text-slate-400',
    badge: 'bg-slate-500'
  }
};

// ==================================================================================
// 🚀 CONDOTRACK PRO - CONFIGURAÇÃO PARA PRODUÇÃO (VERCEL/NETLIFY)
// ==================================================================================
//
// 📋 INSTRUÇÕES DE DEPLOY:
//
// 1. Configure as seguintes variáveis de ambiente no painel do Vercel/Netlify:
//
//    VITE_SUPABASE_URL=https://seu-projeto.supabase.co
//    VITE_SUPABASE_ANON_KEY=sua-anon-key-publica
//
// 2. No Supabase, crie as seguintes tabelas:
//    - packages (encomendas)
//    - residents (moradores)
//    - staff (funcionários)
//    - settings (configurações do condomínio)
//
// 3. Execute os scripts SQL fornecidos na documentação para criar as tabelas.
//
// 4. Sem as variáveis de ambiente, o app usará localStorage (modo demo).
//
// ==================================================================================

// ==================================================================================
// 🖼️ LOGO DO CONDOTRACK
// ==================================================================================
const LOGO_PATH = '/assets/condotrack_logo.png';

// ==================================================================================
// ⚠️ SUPABASE CLIENT - PRODUÇÃO
// ==================================================================================
import { createClient } from '@supabase/supabase-js';

// ==================================================================================
// 🔧 VARIÁVEIS DE AMBIENTE (Vite usa import.meta.env)
// ==================================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Flag para identificar se está em modo produção (com Supabase real)
const IS_PRODUCTION = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// URL da Edge Function de autenticação
const AUTH_EDGE_FUNCTION_URL = IS_PRODUCTION
  ? `${SUPABASE_URL}/functions/v1/auth-login`
  : null;

// ==================================================================================
// 💳 ASAAS CONFIGURATION - Integração de Pagamentos (RECORRENTE)
// ==================================================================================
// IMPORTANTÍSSIMO: nenhuma chave do Asaas fica no frontend.
// O frontend apenas chama Edge Functions que conversam com o Asaas.

const ASAAS_CHECKOUT_ENDPOINT = IS_PRODUCTION
  ? `${SUPABASE_URL}/functions/v1/asaas-create-checkout`
  : null;

const ASAAS_WEBHOOK_ENDPOINT = IS_PRODUCTION
  ? `${SUPABASE_URL}/functions/v1/asaas-webhook`
  : null;

// URL da Edge Function de OCR (leitura de etiquetas)
const OCR_LABEL_ENDPOINT = IS_PRODUCTION
  ? `${SUPABASE_URL}/functions/v1/ocr-label`
  : null;

// Log para debug (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  console.log('🔧 CondoTrack Pro - Modo:', IS_PRODUCTION ? 'PRODUÇÃO (Supabase)' : 'DEMO (localStorage)');
  if (IS_PRODUCTION) {
    console.log('🔐 Edge Function URL:', AUTH_EDGE_FUNCTION_URL);
  }
}

// ==================================================================================
// 🔐 FUNÇÃO DE AUTENTICAÇÃO VIA EDGE FUNCTION (PRODUÇÃO)
// ==================================================================================
// Esta função faz a requisição segura para o backend validar a senha
async function authenticateViaEdgeFunction(email, password) {
  if (!AUTH_EDGE_FUNCTION_URL) {
    const error = new Error('Edge Function não configurada');
    error.code = 'NOT_CONFIGURED';
    error.isNetworkError = true;
    throw error;
  }

  try {
    const response = await fetch(AUTH_EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        username: email.trim().toLowerCase(),
        password: password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Trata erros específicos da Edge Function
      const errorMessage = data.error || 'Erro ao autenticar';
      const error = new Error(errorMessage);
      error.code = data.code || 'AUTH_ERROR';
      error.status = response.status;
      throw error;
    }

    return data; // { success, user, condo, condoStatus }
  } catch (fetchError) {
    // Erro de rede/CORS - marca como erro de rede para fallback
    if (fetchError.name === 'TypeError' || fetchError.message?.includes('fetch')) {
      const error = new Error('Edge Function indisponível');
      error.code = 'NETWORK_ERROR';
      error.isNetworkError = true;
      throw error;
    }
    throw fetchError;
  }
}

// ==================================================================================
// 🛠️ MOCK SUPABASE (MODO DEMO - USA localStorage) - MULTI-TENANT SaaS
// ==================================================================================
const DEMO_CONDO_ID = 'demo-condo-001'; // UUID fictício para modo demo

// Função para simular registro de novo condomínio (útil para testes e desenvolvimento)
export function simulateCondoRegistration({
  condoName,
  planType = 'basic',
  adminName,
  adminUsername,
  adminPassword
}) {
  const keyFor = (table) => `condotrack_${table}`;
  const read = (table) => JSON.parse(localStorage.getItem(keyFor(table)) || '[]');
  const write = (table, data) => localStorage.setItem(keyFor(table), JSON.stringify(data));

  // Gera UUID único para o novo condomínio
  const newCondoId = `condo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  // Define limites baseados no plano
  const planLimits = {
    basic: 2,
    professional: 5,
    premium: 10
  };

  // 1. Cria o condomínio
  const condos = read('condos');
  const newCondo = {
    id: newCondoId,
    name: condoName,
    plan_type: planType,
    staff_limit: planLimits[planType] || 3,
    created_at: now,
    updated_at: now
  };
  condos.push(newCondo);
  write('condos', condos);

  // 2. Cria o admin do condomínio
  const staffList = read('staff');
  const newAdmin = {
    id: Date.now(),
    condo_id: newCondoId,
    name: adminName,
    username: adminUsername,
    password: adminPassword,
    role: 'admin',
    created_at: now
  };
  staffList.push(newAdmin);
  write('staff', staffList);

  // 3. Cria settings padrão para o condomínio
  const settingsList = read('settings');
  const newSettings = {
    id: Date.now() + 1,
    condo_id: newCondoId,
    condo_name: condoName,
    condo_address: '',
    condo_phone: '',
    created_at: now,
    updated_at: now
  };
  settingsList.push(newSettings);
  write('settings', settingsList);

  console.log('✅ Novo condomínio registrado:', {
    condoId: newCondoId,
    name: condoName,
    plan: planType,
    admin: adminUsername
  });

  return {
    condoId: newCondoId,
    condo: newCondo,
    admin: { ...newAdmin, password: '***' } // Não retorna senha
  };
}

const mockSupabase = (() => {
  const keyFor = (table) => `condotrack_${table}`;
  const read = (table) => JSON.parse(localStorage.getItem(keyFor(table)) || '[]');
  const write = (table, data) => localStorage.setItem(keyFor(table), JSON.stringify(data));
  const ensureId = (row) => ({ id: Date.now() + Math.floor(Math.random() * 1000), ...row });

  // Seed condos (tabela de condomínios/planos)
  if (!localStorage.getItem(keyFor('condos'))) {
    const now = new Date().toISOString();
    write('condos', [{
      id: DEMO_CONDO_ID,
      name: 'Condomínio Demo',
      slug: 'condominio-demo',
      plan_type: 'basic', // 'basic' | 'professional' | 'premium'
      staff_limit: 2, // Limite de porteiros no plano básico
      created_at: now,
      updated_at: now,
    }]);
  } else {
    // Patch: adiciona slug a condos existentes que não têm
    try {
      const condos = JSON.parse(localStorage.getItem(keyFor('condos')) || '[]');
      let patched = false;
      condos.forEach(c => {
        if (!c.slug && c.name) {
          c.slug = c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').substring(0, 50) || 'condo';
          patched = true;
        }
      });
      if (patched) write('condos', condos);
    } catch {}
  }

  // Seed staff com admin padrão se vazio (com condo_id)
  if (!localStorage.getItem(keyFor('staff'))) {
    const now = new Date().toISOString();
    write('staff', [{
      id: Date.now(),
      condo_id: DEMO_CONDO_ID,
      name: 'Administrador',
      username: 'admin@demo.condotrack.com',
      password: '123',
      role: 'admin',
      created_at: now,
    }]);
  } else {
    // Patch: migrar username legado 'admin' para formato email
    try {
      const staffList = JSON.parse(localStorage.getItem(keyFor('staff')) || '[]');
      let patched = false;
      staffList.forEach(s => {
        if (s.condo_id === DEMO_CONDO_ID && s.username === 'admin') {
          s.username = 'admin@demo.condotrack.com';
          patched = true;
        }
      });
      if (patched) write('staff', staffList);
    } catch {}
  }

  // Seed settings com nome do condomínio padrão se vazio (com condo_id)
  if (!localStorage.getItem(keyFor('settings'))) {
    const now = new Date().toISOString();
    write('settings', [{
      id: 1,
      condo_id: DEMO_CONDO_ID,
      condo_name: 'CondoTrack Demo',
      condo_address: '',
      condo_phone: '',
      created_at: now,
      updated_at: now,
    }]);
  }

  // Helper para encadear múltiplos .eq()
  const createQueryBuilder = (table, initialData = null) => {
    let filters = [];
    let data = initialData !== null ? initialData : read(table);

    const builder = {
      eq: (field, value) => {
        filters.push({ field, value });
        data = data.filter(item => item[field] === value);
        return builder;
      },
      order: (_col, _opts) => {
        return Promise.resolve({ data, error: null });
      },
      single: () => {
        const result = data.length > 0 ? data[0] : null;
        return Promise.resolve({ data: result, error: null });
      },
      select: (cols = '*') => {
        return builder;
      },
      then: (resolve) => {
        resolve({ data, error: null });
      }
    };
    return builder;
  };

  const api = {
    channel: () => ({
      on: () => api,
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
    from: (table) => ({
      select: (cols = '*') => createQueryBuilder(table),
      insert: (rows) => {
        const now = new Date().toISOString();
        const current = read(table);
        const inserted = rows.map(r => {
          const base =
            table === 'packages'
              ? {
                  status: 'pending',
                  created_at: now,
                  collected_at: null,
                  collected_by: null,
                  receiver_doc: null,
                  notified_at: null,
                  notified_by: null,
                  deleted_at: null,
                  deleted_by: null,
                }
              : table === 'residents'
              ? { created_at: now }
              : table === 'staff'
              ? { created_at: now }
              : table === 'condos'
              ? { created_at: now, updated_at: now }
              : { created_at: now };
          return ensureId({ ...base, ...r });
        });
        write(table, [...current, ...inserted]);
        return {
          data: inserted.length === 1 ? inserted[0] : inserted,
          error: null,
          select: () => Promise.resolve({ data: inserted.length === 1 ? inserted[0] : inserted, error: null })
        };
      },
      update: (partial) => ({
        eq: (field, value) => {
          const current = read(table);
          const updated = current.map(item => item[field] === value ? { ...item, ...partial } : item);
          write(table, updated);
          return Promise.resolve({ data: null, error: null });
        }
      }),
      delete: () => ({
        eq: (field, value) => {
          const current = read(table);
          write(table, current.filter(item => item[field] !== value));
          return Promise.resolve({ data: null, error: null });
        }
      })
    })
  };
  return api;
})();

// ==================================================================================
// 💰 PLANOS E PREÇOS (sincronizado com tabela plans do Supabase)
// ==================================================================================
const PLANS_CONFIG = {
  basic: {
    name: 'BÁSICO',
    price: 99,
    priceFormatted: 'R$ 99',
    staffLimit: 2,
    unitLimit: 50,
    features: ['Até 2 porteiros', 'Até 50 unidades', 'Gestão de encomendas', 'Notificação WhatsApp', 'Histórico 90 dias']
  },
  professional: {
    name: 'PRO',
    price: 199,
    priceFormatted: 'R$ 199',
    staffLimit: 5,
    unitLimit: 150,
    features: ['Até 5 porteiros', 'Até 150 unidades', 'Tudo do Básico', 'Relatórios avançados', 'Exportação PDF', 'Histórico ilimitado', 'Suporte prioritário'],
    popular: true
  },
  premium: {
    name: 'PREMIUM',
    price: 349,
    priceFormatted: 'R$ 349',
    staffLimit: 10,
    unitLimit: 9999,
    features: ['Até 10 porteiros', 'Unidades ilimitadas', 'Tudo do PRO', 'API de integração', 'Suporte 24/7', 'SLA 99.9%', 'Onboarding dedicado']
  }
};

// ==================================================================================
// 💳 CREATE ASAAS CHECKOUT (RECORRENTE)
// ==================================================================================
// Cria uma assinatura/cobrança recorrente no Asaas via Edge Function (produção) ou simula (demo)
// Retorna URL para redirecionar o usuário para a página de pagamento (invoiceUrl)
export async function createAsaasCheckout(planKey, billingType, condoId) {
  const plan = PLANS_CONFIG[planKey];
  if (!plan) {
    throw new Error('Plano inválido');
  }

  // ========================================================================
  // MODO PRODUÇÃO: Chama a nova Edge Function 'create-payment' com fetch manual
  // ========================================================================
  if (IS_PRODUCTION) {
    if (!condoId) {
      throw new Error('Condo ID é necessário para criar o pagamento.');
    }
    try {
      const paymentUrl = `${SUPABASE_URL}/functions/v1/create-payment`;
      
      const response = await fetch(paymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          // NÃO ENVIAR 'Authorization' para evitar erro de "Invalid JWT" com anon_key
        },
        body: JSON.stringify({
          planId: planKey,
          billingType: billingType,
          condoId: condoId, // Passa o condoId no body para fallback
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Erro ao invocar a função de pagamento.');
      }
      
      console.log('📦 Dados recebidos da Edge Function:', {
        paymentLink: data.paymentLink,
        pixQrCode: data.pixQrCode,
        billingType: data.billingType,
        paymentId: data.paymentId,
      });

      // Validar que temos pelo menos um método de pagamento
      if (billingType === 'PIX' && !data.pixQrCode) {
        console.warn('⚠️ PIX selecionado mas pixQrCode não veio na resposta');
      }
      if ((billingType === 'CREDIT_CARD' || billingType === 'BOLETO') && !data.paymentLink) {
        console.warn('⚠️ Cartão/Boleto selecionado mas paymentLink não veio na resposta');
      }

      return {
        success: true,
        checkoutUrl: data.paymentLink, // URL para Boleto/Cartão
        pixQrCode: data.pixQrCode,   // QR Code para PIX (objeto com payload, encodedImage, expirationDate)
        billingType: data.billingType,
        paymentId: data.paymentId,
      };

    } catch (error) {
      console.error('Erro ao criar checkout Asaas via create-payment:', error);
      throw error;
    }
  }

  // ========================================================================
  // MODO DEMO: Simula criação de sessão (retorna URL fictícia)
  // ========================================================================
  return new Promise((resolve) => {
    setTimeout(() => {
      const fakeSessionId = `asaas_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('💳 Checkout criado (demo):', {
        id: fakeSessionId,
        plan: plan.name,
        price: plan.priceFormatted,
        condoId: condoId // Usando o condoId passado
      });

      resolve({
        success: true,
        checkoutUrl: `https://sandbox.asaas.com/demo/${fakeSessionId}`,
        subscriptionId: fakeSessionId,
        isDemo: true // Flag para indicar modo demo
      });
    }, 500);
  });
}

// ==================================================================================
// 🔐 SIMULATE WEBHOOK SUCCESS (Desbloqueio após pagamento)
// ==================================================================================
// Esta função simula o que um webhook do gateway (Asaas) faria após pagamento confirmado
// IMPORTANTE: Em produção, essa lógica fica APENAS na Edge Function do webhook
export async function simulateWebhookSuccess(condoId, planKey) {
  const plan = PLANS_CONFIG[planKey];
  if (!plan) {
    throw new Error('Plano inválido');
  }

  // ========================================================================
  // MODO PRODUÇÃO: Chama Edge Function para processar webhook
  // ========================================================================
  if (IS_PRODUCTION && WEBHOOK_ENDPOINT) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/simulate-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          condoId: condoId,
          planKey: planKey,
          // Em produção real, isso viria do evento do Asaas
          eventType: 'checkout.session.completed'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar pagamento');
      }

      return data;
    } catch (error) {
      console.error('Erro ao simular webhook:', error);
      throw error;
    }
  }

  // ========================================================================
  // MODO DEMO: Processa webhook localmente (localStorage)
  // ========================================================================
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const keyFor = (table) => `condotrack_${table}`;
        const read = (table) => JSON.parse(localStorage.getItem(keyFor(table)) || '[]');
        const write = (table, data) => localStorage.setItem(keyFor(table), JSON.stringify(data));

        const condos = read('condos');
        const condoIndex = condos.findIndex(c => c.id === condoId);

        if (condoIndex === -1) {
          reject(new Error('Condomínio não encontrado'));
          return;
        }

        // Calcula próximo vencimento (30 dias a partir de agora)
        const nextBillingDate = new Date();
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);

        // ================================================================
        // DESBLOQUEIO DA CONTA (lógica do webhook)
        // ================================================================
        condos[condoIndex] = {
          ...condos[condoIndex],
          is_active: true,                              // Ativa a conta
          plan_type: planKey,                           // Define o plano
          staff_limit: plan.staffLimit,                 // Limite de staff do plano
          unit_limit: plan.unitLimit,                   // Limite de unidades do plano
          trial_end_date: nextBillingDate.toISOString(), // Próximo vencimento
          last_payment_date: new Date().toISOString(),  // Data do pagamento
          subscription_status: 'active',                // Status da assinatura
          updated_at: new Date().toISOString()
        };

        write('condos', condos);

        console.log('✅ Webhook processado - Conta desbloqueada:', {
          condoId,
          plan: plan.name,
          nextBilling: nextBillingDate.toLocaleDateString('pt-BR'),
          staffLimit: plan.staffLimit,
          unitLimit: plan.unitLimit
        });

        resolve({
          success: true,
          condo: condos[condoIndex],
          plan: plan,
          nextBillingDate: nextBillingDate.toISOString(),
          message: 'Pagamento confirmado! Sua conta foi ativada.'
        });
      } catch (error) {
        reject(error);
      }
    }, 1000); // 1s de delay simulando processamento
  });
}

// ==================================================================================
// 🔐 SIMULAÇÃO DE WEBHOOK DE PAGAMENTO (Legacy - mantido para compatibilidade)
// ==================================================================================
// Esta função simula o que um webhook do gateway faria após pagamento
export function simulatePaymentConfirmation(condoId, planKey) {
  // Agora usa a nova função simulateWebhookSuccess
  return simulateWebhookSuccess(condoId, planKey);
}

// ==================================================================================
// 🔌 INICIALIZAÇÃO DO CLIENTE SUPABASE
// ==================================================================================
// Se as variáveis de ambiente existirem, usa Supabase real
// Caso contrário, usa o mock com localStorage (modo demo)
const supabase = IS_PRODUCTION
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : mockSupabase;

// ==================================================================================
// 🚀 SINGLE FILE COMPONENT: CondoTrack
// ==================================================================================
// Helpers de validação e máscara
function extractDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
function formatPhoneMask(value) {
  const d = extractDigits(value).slice(0, 11);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 7);
  const p3 = d.slice(7, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${p1}) ${p2}`;
  return `(${p1}) ${p2}-${p3}`;
}
function compressImageToBase64(file, maxWidth = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
        if (h > maxWidth) { w = Math.round(w * (maxWidth / h)); h = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function isValidFullName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2;
}
function isValidPhone11(value) {
  return extractDigits(value).length === 11;
}

export default function CondoTrackApp() {
  const SESSION_KEY = 'condotrack_session'; // Agora inclui condo_id
  const THEME_KEY = 'condotrack_theme';
  // Detecta slug na URL antes do primeiro render
  const _initSlug = (() => { try { return new URLSearchParams(window.location.search).get('condo') || null; } catch { return null; } })();
  const [viewMode, setViewMode] = useState(_initSlug ? 'resident' : 'concierge'); // 'concierge' | 'resident'
  const [accessMode, setAccessMode] = useState(_initSlug ? 'resident' : null); // null | 'concierge' | 'resident' — null = tela de seleção
  const [isConciergeAuthed, setIsConciergeAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // {id, name, role, username, condo_id}
  // Multi-Tenant: estado do condomínio atual
  const [condoId, setCondoId] = useState(null); // UUID do condomínio logado
  const [condoInfo, setCondoInfo] = useState(null); // {id, name, plan_type, staff_limit}
  const [condoStatus, setCondoStatus] = useState('active'); // 'active' | 'expired' | 'inactive'
  const [showBillingWhenExpired, setShowBillingWhenExpired] = useState(true); // Controla se mostra billing ou perfil quando expirado
  // Inicializa tema diretamente do localStorage para evitar flash
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });
  const [packages, setPackages] = useState([]);
  const [residents, setResidents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [condoSettings, setCondoSettings] = useState({ condo_name: 'CondoTrack', condo_address: '', condo_phone: '' });
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  // Sidebar & Navigation
  const [activeTab, setActiveTab] = useState('home');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  // Slug do condomínio via URL (acesso direto do morador)
  const [urlSlug] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('condo') || null;
    } catch { return null; }
  });
  const pendingCount = packages.filter(p => p.status === 'pending').length;
  const residentsIndex = useMemo(() => {
    const idx = {};
    (residents || []).forEach(r => {
      if (r && r.unit) idx[String(r.unit).toLowerCase()] = r;
    });
    return idx;
  }, [residents]);

  // Multi-Tenant: Carregar dados apenas quando condoId estiver disponível
  useEffect(() => {
    if (!condoId) {
      setLoading(false); // Não está carregando se não houver tenant
      return;
    }
    // Carrega dados filtrados pelo tenant
    fetchPackages(condoId);
    fetchResidents(condoId);
    fetchStaff(condoId);
    // Configurações do condomínio já carregadas via condoInfo

    // Real-time subscriptions
    const channel = supabase.channel('packages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => fetchPackages(condoId))
      .subscribe();
    const channelResidents = supabase.channel('residents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => fetchResidents(condoId))
      .subscribe();
    const channelStaff = supabase.channel('staff_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => fetchStaff(condoId))
      .subscribe();

    // Polling intervals como backup
    const interval = setInterval(() => fetchPackages(condoId), 1500);
    const intervalRes = setInterval(() => fetchResidents(condoId), 2000);
    const intervalStaff = setInterval(() => fetchStaff(condoId), 3000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channelResidents);
      supabase.removeChannel(channelStaff);
      clearInterval(interval);
      clearInterval(intervalRes);
      clearInterval(intervalStaff);
    };
  }, [condoId]); // Re-executa quando condoId mudar

  // Função para verificar status do condomínio (trial/ativo)
  const checkCondoStatus = (condoData) => {
    if (!condoData) return 'inactive';

    // Verifica se está inativo manualmente
    if (condoData.is_active === false) {
      return 'inactive';
    }

    // ✅ CRÍTICO: Verificar se plano pago está vencido (plan_end_date)
    if (condoData.subscription_status === 'active' && condoData.plan_end_date) {
      const planEnd = new Date(condoData.plan_end_date);
      const now = new Date();
      if (now > planEnd) {
        // Plano vencido - bloquear acesso
        return 'expired';
      }
    }

    // Se está em trial, verifica se expirou
    if (condoData.subscription_status === 'trial' && condoData.trial_end_date) {
      const trialEnd = new Date(condoData.trial_end_date);
      const now = new Date();
      if (now > trialEnd) {
        return 'expired';
      }
      // Trial ainda ativo - permite uso mas mostra contador
      return 'active';
    }

    // Se subscription_status é 'expired', 'past_due', 'canceled' ou 'inactive'
    if (['expired', 'past_due', 'canceled', 'inactive'].includes(condoData.subscription_status)) {
      return 'expired';
    }

    // Verifica se trial_end_date expirou (fallback para casos antigos)
    if (condoData.trial_end_date) {
      const trialEnd = new Date(condoData.trial_end_date);
      const now = new Date();
      if (now > trialEnd && condoData.subscription_status !== 'active') {
        return 'expired';
      }
    }

    return 'active';
  };

  // Handler para sucesso no pagamento - reativa a conta
  const handlePaymentSuccess = async (updatedCondo) => {
    // Atualiza o estado com os novos dados do condomínio
    setCondoInfo(updatedCondo);
    setCondoStatus('active');

    // Recarrega dados do condomínio
    if (updatedCondo.id) {
      fetchPackages(updatedCondo.id);
      fetchResidents(updatedCondo.id);
      fetchStaff(updatedCondo.id);
      // Configurações do condomínio já carregadas via condoInfo
    }
  };

  // Handler para logout do billing checkout
  const handleBillingLogout = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    setIsConciergeAuthed(false);
    setCurrentUser(null);
    setCondoId(null);
    setCondoInfo(null);
    setCondoStatus('active');
    setAccessMode(null);
  };

  // Restaura sessão ao carregar (Multi-Tenant: inclui condo_id)
  useEffect(() => {
    // Aplica classe dark no HTML ao carregar (tema já foi lido na inicialização do state)
    const root = document.documentElement;
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    // Se veio via link de morador (?condo=), não restaura sessão de porteiro
    if (_initSlug) return;
    const restoreSession = async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Verifica se sessão tem os campos necessários (user + condo_id)
          if (parsed && parsed.username && parsed.condo_id) {
            // Carrega info do condomínio primeiro para verificar status
            const { data: condoData, error: condoError } = await supabase
              .from('condos')
              .select('*')
              .eq('id', parsed.condo_id)
              .single();

            if (condoError) {
              console.error('Erro ao carregar configurações:', condoError);
              setError('Erro ao carregar configurações do condomínio');
              setIsConciergeAuthed(false);
              return;
            }

            if (condoData) {
              const status = checkCondoStatus(condoData);
              setCondoStatus(status);
              setCondoInfo(condoData);
              setCondoSettings({
                condo_name: condoData.name || 'CondoTrack',
                condo_address: condoData.address || '',
                condo_phone: condoData.phone || ''
              });
              setCurrentUser(parsed);
              setCondoId(parsed.condo_id);
              setIsConciergeAuthed(true);
              setAccessMode('concierge');
              // Resetar showBillingWhenExpired quando status é expired/inactive
              if (status === 'expired' || status === 'inactive') {
                setShowBillingWhenExpired(true);
              }
              // Não redireciona mais - o BillingCheckout será mostrado inline
            }
          }
        }
      } catch {}
    };
    restoreSession();
  }, []);

  // Resetar showBillingWhenExpired quando o status muda para expired/inactive
  useEffect(() => {
    if (condoStatus === 'expired' || condoStatus === 'inactive') {
      setShowBillingWhenExpired(true);
    }
  }, [condoStatus]);

  // aplica tema e persiste
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);
  // Auto-logout por inatividade (15 min)
  useEffect(() => {
    if (!isConciergeAuthed || !currentUser) return;
    let idleTimerId;
    const TIMEOUT_MS = 15 * 60 * 1000;
    const resetTimer = () => {
      if (idleTimerId) clearTimeout(idleTimerId);
      idleTimerId = setTimeout(() => {
        try { localStorage.removeItem(SESSION_KEY); } catch {}
        setIsConciergeAuthed(false);
        setCurrentUser(null);
        setAccessMode(null);
        setShowInactivityModal(true);
      }, TIMEOUT_MS);
    };
    const events = ['mousemove','mousedown','keydown','touchstart','scroll','click'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (idleTimerId) clearTimeout(idleTimerId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [isConciergeAuthed, currentUser]);

  // Multi-Tenant: fetchPackages filtra por condo_id
  const fetchPackages = async (tenantId = condoId) => {
    if (!tenantId) return; // Não busca sem tenant
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('condo_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Multi-Tenant: fetchStaff filtra por condo_id
  const fetchStaff = async (tenantId = condoId) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('condo_id', tenantId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Configurações do condomínio são gerenciadas via condoInfo (tabela condos)
  // Não há mais tabela separada 'settings'
  const handleUpdateSettings = async (newSettings) => {
    if (!condoId) return;
    try {
      const { error } = await supabase
        .from('condos')
        .update({
          name: newSettings.condo_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', condoId);
      if (error) throw error;
      
      // Atualiza estado local
      setCondoSettings(prev => ({ ...prev, ...newSettings }));
      setCondoInfo(prev => prev ? { ...prev, name: newSettings.condo_name } : null);
      showNotification('Configurações salvas com sucesso!');
    } catch (err) {
      console.error(err);
      showNotification('Erro ao salvar configurações.', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 2500);
  };

  // Multi-Tenant: handleLogout limpa todos os estados do tenant
  const handleLogout = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    setIsConciergeAuthed(false);
    setCurrentUser(null);
    setCondoId(null);
    setCondoInfo(null);
    setAccessMode(null);
    // Limpa dados do tenant anterior
    setPackages([]);
    setResidents([]);
    setStaff([]);
    setCondoSettings({ condo_name: 'CondoTrack', condo_address: '', condo_phone: '' });
  };

  // ---------- Ações (Multi-Tenant: todas incluem condo_id) ----------
  const handleAddPackage = async (formData) => {
    if (!condoId) return;
    try {
      // cria registro com condo_id
      const { data, error } = await supabase.from('packages').insert([{
        condo_id: condoId,
        unit: formData.unit,
        recipient: formData.recipient,
        phone: extractDigits(formData.phone || ''),
        type: formData.type,
        description: formData.description || '',
        status: 'pending'
      }]).select();
      if (error) throw error;

      // se houver telefone, abre WhatsApp e marca notificação
      const pkgRow = Array.isArray(data) ? data[0] : data;
      const phoneDigits = extractDigits(formData.phone || '');
      if (phoneDigits) {
        const box = String.fromCodePoint(0x1F4E6); // 📦 via code point para evitar problemas de encoding
        const text = encodeURIComponent(`Olá ${formData.recipient}! Chegou uma encomenda (${formData.type}) para você na portaria. ${box} Disponível para retirada.`);
        const url = `https://wa.me/55${phoneDigits}?text=${text}`;
        window.open(url, '_blank');

        // atualiza notified_*
        await supabase
          .from('packages')
          .update({
            notified_at: new Date().toISOString(),
            notified_by: currentUser?.name || 'Portaria'
          })
          .eq('id', pkgRow?.id);
      }

      showNotification('Encomenda registrada!');
      fetchPackages(condoId);
    } catch (err) {
      console.error(err);
      showNotification('Erro ao registrar.', 'error');
    }
  };

  const handleCollectPackage = async (pkgId, receiverName, receiverDoc) => {
    try {
      const { error } = await supabase
        .from('packages')
        .update({
          status: 'collected',
          collected_at: new Date().toISOString(),
          collected_by: receiverName,
          receiver_doc: receiverDoc
        })
        .eq('id', pkgId);
      if (error) throw error;
      showNotification('Retirada confirmada!');
      fetchPackages(condoId);
    } catch (err) {
      console.error(err);
      showNotification('Erro ao confirmar retirada.', 'error');
    }
  };

  const handleDeletePackage = async (pkgId, deletedBy) => {
    try {
      // Soft delete: marca como deleted com registro de quem excluiu
      const { error } = await supabase
        .from('packages')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy || 'Sistema'
        })
        .eq('id', pkgId);
      if (error) throw error;
      showNotification('Registro excluído.');
      fetchPackages(condoId);
    } catch (err) {
      console.error(err);
      showNotification('Erro ao excluir.', 'error');
    }
  };

  // Multi-Tenant: fetchResidents filtra por condo_id
  const fetchResidents = async (tenantId = condoId) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('condo_id', tenantId)
        .order('unit', { ascending: true });
      if (error) throw error;
      setResidents(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Multi-Tenant: handleAddResident inclui condo_id
  const handleAddResident = async (resident) => {
    if (!condoId) return;
    try {
      const payload = {
        condo_id: condoId,
        unit: resident.unit,
        name: resident.name,
        phone: resident.phone || '',
        document: resident.document || null,
        access_code: resident.access_code || null
      };
      const { error } = await supabase
        .from('residents')
        .insert([payload]);
      if (error) throw error;
      showNotification('Morador cadastrado!');
      fetchResidents(condoId);
    } catch (err) {
      // Fallback: se a coluna 'document' não existir, tenta sem ela
      const message = String(err?.message || '');
      if (message.includes('column') && (message.includes('document') || message.includes('pin') || message.includes('access_code'))) {
        try {
          const { error: err2 } = await supabase
            .from('residents')
            .insert([{
              condo_id: condoId,
              unit: resident.unit,
              name: resident.name,
              phone: resident.phone || ''
            }]);
          if (err2) throw err2;
          showNotification('Morador cadastrado! (sem documento/access_code)');
          fetchResidents(condoId);
          return;
        } catch (e2) {
          console.error(e2);
          showNotification('Erro ao cadastrar morador.', 'error');
          return;
        }
      }
      console.error(err);
      showNotification('Erro ao cadastrar morador.', 'error');
    }
  };

  const handleDeleteResident = async (residentId) => {
    try {
      const { error } = await supabase
        .from('residents')
        .delete()
        .eq('id', residentId);
      if (error) throw error;
      showNotification('Morador excluído.');
      fetchResidents(condoId);
    } catch (err) {
      console.error(err);
      showNotification('Erro ao excluir morador.', 'error');
    }
  };

  const handleUpdateResident = async (residentId, updates) => {
    try {
      const payload = {
        unit: updates.unit,
        name: updates.name,
        phone: updates.phone || ''
      };
      if (typeof updates.document !== 'undefined') {
        payload.document = updates.document || null;
      }
      if (typeof updates.access_code !== 'undefined') {
        payload.access_code = updates.access_code || null;
      }
      const { error } = await supabase
        .from('residents')
        .update(payload)
        .eq('id', residentId);
      if (error) throw error;
      showNotification('Morador atualizado!');
      fetchResidents(condoId);
    } catch (err) {
      const message = String(err?.message || '');
      if (message.includes('column') && (message.includes('document') || message.includes('pin') || message.includes('access_code'))) {
        try {
          const { error: err2 } = await supabase
            .from('residents')
            .update({
              unit: updates.unit,
              name: updates.name,
              phone: updates.phone || ''
            })
            .eq('id', residentId);
          if (err2) throw err2;
          showNotification('Morador atualizado! (sem documento/access_code)');
          fetchResidents(condoId);
          return;
        } catch (e2) {
          console.error(e2);
          showNotification('Erro ao atualizar morador.', 'error');
          return;
        }
      }
      console.error(err);
      showNotification('Erro ao atualizar morador.', 'error');
    }
  };

  // ---------- UI ----------
  const isConcierge = viewMode === 'concierge';

  // Tab title mapping
  const tabTitles = { home: 'Dashboard', packages: 'Encomendas', residents: 'Moradores', reports: 'Historico', team: 'Equipe', settings: 'Configuracoes', billing: 'Plano' };

  // Sidebar nav items
  const navItems = [
    { id: 'home', icon: Package, label: 'Inicio', badge: pendingCount > 0 ? pendingCount : null },
    { id: 'packages', icon: Box, label: 'Encomendas' },
    { id: 'residents', icon: Users, label: 'Moradores' },
    { id: 'reports', icon: FileText, label: 'Historico' },
  ];
  const adminNavItems = [
    { id: 'team', icon: Briefcase, label: 'Equipe' },
    { id: 'settings', icon: Settings, label: 'Configuracoes' },
    { id: 'billing', icon: CreditCard, label: 'Plano' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white flex items-center gap-3 animate-slide-down ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Modal de Sessão Encerrada por Inatividade */}
      {showInactivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-sm w-full animate-scale-in text-center border border-slate-200 dark:border-slate-700">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 dark:bg-amber-800 rounded-2xl mb-5">
              <Clock size={32} className="text-amber-600 dark:text-amber-200" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Sessão Encerrada</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">Sua sessão foi encerrada por inatividade. Por favor, faça login novamente.</p>
            <button
              onClick={() => setShowInactivityModal(false)}
              className="w-full px-4 py-3.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow-sm transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Tela de Seleção: Portaria ou Morador */}
      {accessMode === null && !isConciergeAuthed ? (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-sm">
            <div className="relative text-center bg-white/90 dark:bg-slate-900/70 backdrop-blur rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xl px-6 py-8">
              <img src={LOGO_PATH} alt="CondoTrack Logo" className="h-20 sm:h-24 w-auto mx-auto mb-5" onError={(e) => { e.target.style.display = 'none'; }} />
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">CondoTrack</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Gestão de Encomendas para Condomínios</p>

              <p className="text-base font-medium text-slate-700 dark:text-slate-300 mb-5">Como deseja acessar?</p>

              <div className="space-y-4">
                <button onClick={() => { setAccessMode('concierge'); setViewMode('concierge'); }} className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:border-blue-500 hover:shadow-md transition-all duration-150 group">
                  <div className="flex-shrink-0 w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-150">
                    <Shield size={28} className="text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors duration-150" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">Portaria</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Acesso para porteiros e administradores</p>
                  </div>
                </button>

                <button onClick={() => { setAccessMode('resident'); setViewMode('resident'); }} className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all duration-150 group">
                  <div className="flex-shrink-0 w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 transition-colors duration-150">
                    <User size={28} className="text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-colors duration-150" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">Sou Morador</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Consultar minhas encomendas</p>
                  </div>
                </button>
              </div>

              {/* Toggle de tema dentro do card (local indicado) */}
              <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} className="mt-7 w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl py-3 transition-colors duration-150">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="flex h-screen overflow-hidden">
        {/* ===== SIDEBAR (Desktop) ===== */}
        {isConcierge && isConciergeAuthed && (
          <aside className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sidebar z-30">
            {/* Logo */}
            <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
              <img src={LOGO_PATH} className="h-8 w-auto" alt="Logo" onError={(e) => { e.target.style.display = 'none'; }} />
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white">CondoTrack</h1>
                <p className="text-xs text-slate-400">Gestao de Encomendas</p>
              </div>
            </div>
            {/* Condo name */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{condoSettings?.condo_name || 'Condominio'}</p>
                  <p className="text-xs text-slate-400">Condominio</p>
                </div>
              </div>
            </div>
            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === item.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'}`}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.badge && <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">{item.badge}</span>}
                </button>
              ))}
              {currentUser?.role === 'admin' && (
                <>
                  <div className="pt-4 pb-2 px-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Administracao</p>
                  </div>
                  {adminNavItems.map(item => (
                    <button key={item.id} onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === item.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'}`}>
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </>
              )}
            </nav>
            {/* User info bottom */}
            {currentUser && (
              <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                    <p className="text-xs text-slate-400">{currentUser.role === 'admin' ? 'Administrador' : 'Porteiro'}</p>
                  </div>
                  <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150" title="Sair">
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ===== Mobile Sidebar Overlay ===== */}
        {isConcierge && isConciergeAuthed && mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="relative w-72 h-full bg-white dark:bg-slate-800 shadow-elevated flex flex-col">
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <img src={LOGO_PATH} className="h-8 w-auto" alt="Logo" onError={(e) => { e.target.style.display = 'none'; }} />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">CondoTrack</span>
                </div>
                <button onClick={() => setMobileSidebarOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === item.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                    <item.icon size={18} /><span>{item.label}</span>
                    {item.badge && <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">{item.badge}</span>}
                  </button>
                ))}
                {currentUser?.role === 'admin' && (
                  <>
                    <div className="pt-4 pb-2 px-3"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Administracao</p></div>
                    {adminNavItems.map(item => (
                      <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${activeTab === item.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        <item.icon size={18} /><span>{item.label}</span>
                      </button>
                    ))}
                  </>
                )}
              </nav>
            </aside>
          </div>
        )}

        {/* ===== MAIN CONTENT AREA ===== */}
        <div className={`flex-1 min-w-0 ${isConcierge && isConciergeAuthed ? 'md:pl-72' : ''} flex flex-col min-h-screen`}>
          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 h-16 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              {isConcierge && isConciergeAuthed && (
                <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150" onClick={() => setMobileSidebarOpen(true)}>
                  <Menu size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
              )}
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isConcierge && isConciergeAuthed ? (tabTitles[activeTab] || 'Dashboard') : isConcierge ? 'Portaria' : 'Area do Morador'}
              </h2>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150" title="Alternar tema">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {isConciergeAuthed && (
                <div className="flex flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                  <button onClick={() => setViewMode('concierge')} className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${isConcierge ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
                    <Shield size={14} /><span className="hidden sm:inline">Portaria</span>
                  </button>
                  <button onClick={() => setViewMode('resident')} className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${!isConcierge ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
                    <User size={14} /><span className="hidden sm:inline">Morador</span>
                  </button>
                </div>
              )}
              {/* Mobile user menu */}
              {isConcierge && isConciergeAuthed && currentUser && (
                <button onClick={handleLogout} className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150" title="Sair">
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-24 md:pb-6">
        {/* Verifica se conta está expirada/inativa - mostra Checkout de Billing (padrão) OU Perfil */}
        {isConciergeAuthed && (condoStatus === 'expired' || condoStatus === 'inactive') ? (
          <>
            {/* Botão discreto para acessar perfil quando está na tela de billing */}
            {showBillingWhenExpired && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => setShowBillingWhenExpired(false)}
                  className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2 transition-colors"
                >
                  <Settings size={16} />
                  Acessar Perfil
                </button>
              </div>
            )}
            
            {/* Banner de aviso quando está no perfil com trial expirado */}
            {!showBillingWhenExpired && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                      Período de teste expirado
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                      Você pode editar seus dados, mas para usar todas as funcionalidades, é necessário fazer upgrade do plano.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBillingWhenExpired(true)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors"
                      >
                        Fazer Upgrade Agora
                      </button>
                      <button
                        onClick={() => setShowBillingWhenExpired(true)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors"
                      >
                        Voltar para Assinatura
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Mostra BillingCheckout (padrão quando expirado) ou ConciergeView */}
            {showBillingWhenExpired ? (
              <BillingCheckout
                condoInfo={condoInfo}
                onPaymentSuccess={handlePaymentSuccess}
                onLogout={handleBillingLogout}
              />
            ) : (
              <ConciergeView
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onAdd={handleAddPackage}
                packages={packages}
                onDelete={handleDeletePackage}
                onCollect={handleCollectPackage}
                residents={residents}
                residentsIndex={residentsIndex}
                onAddResident={handleAddResident}
                onDeleteResident={handleDeleteResident}
                onUpdateResident={handleUpdateResident}
                currentUser={currentUser}
                staff={staff}
                condoInfo={condoInfo}
                onAddStaff={async (member) => {
                  if (!condoId) return;
                  // RBAC: Verifica limite de staff do plano
                  const porteiroCount = staff.filter(s => s.role === 'porteiro').length;
                  if (member.role === 'porteiro' && condoInfo && porteiroCount >= condoInfo.staff_limit) {
                    showNotification(`Limite de ${condoInfo.staff_limit} porteiros atingido. Faça upgrade do plano.`, 'error');
                    return;
                  }
                  try {
                    const { error } = await supabase.from('staff').insert([{ ...member, condo_id: condoId }]);
                    if (error) throw error;
                    showNotification('Funcionário cadastrado!');
                    fetchStaff(condoId);
                  } catch (e) {
                    console.error(e);
                    showNotification('Erro ao cadastrar funcionário.', 'error');
                  }
                }}
                onDeleteStaff={async (id) => {
                  try {
                    const { error } = await supabase.from('staff').delete().eq('id', id);
                    if (error) throw error;
                    showNotification('Funcionário excluído.');
                    fetchStaff(condoId);
                  } catch (e) {
                    console.error(e);
                    showNotification('Erro ao excluir funcionário.', 'error');
                  }
                }}
                condoSettings={condoSettings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}
          </>
        ) : isConcierge ? (
          isConciergeAuthed ? (
            <ConciergeView
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onAdd={handleAddPackage}
              packages={packages}
              onDelete={handleDeletePackage}
              onCollect={handleCollectPackage}
              residents={residents}
              residentsIndex={residentsIndex}
              onAddResident={handleAddResident}
              onDeleteResident={handleDeleteResident}
              onUpdateResident={handleUpdateResident}
              currentUser={currentUser}
              staff={staff}
              condoInfo={condoInfo}
              onAddStaff={async (member) => {
                if (!condoId) return;
                // RBAC: Verifica limite de staff do plano
                const porteiroCount = staff.filter(s => s.role === 'porteiro').length;
                if (member.role === 'porteiro' && condoInfo && porteiroCount >= condoInfo.staff_limit) {
                  showNotification(`Limite de ${condoInfo.staff_limit} porteiros atingido. Faça upgrade do plano.`, 'error');
                  return;
                }
                try {
                  const { error } = await supabase.from('staff').insert([{ ...member, condo_id: condoId }]);
                  if (error) throw error;
                  showNotification('Funcionário cadastrado!');
                  fetchStaff(condoId);
                } catch (e) {
                  console.error(e);
                  showNotification('Erro ao cadastrar funcionário.', 'error');
                }
              }}
              onDeleteStaff={async (id) => {
                try {
                  const { error } = await supabase.from('staff').delete().eq('id', id);
                  if (error) throw error;
                  showNotification('Funcionário excluído.');
                  fetchStaff(condoId);
                } catch (e) {
                  console.error(e);
                  showNotification('Erro ao excluir funcionário.', 'error');
                }
              }}
              condoSettings={condoSettings}
              onUpdateSettings={handleUpdateSettings}
            />
          ) : (
            <ConciergeLogin onBack={() => setAccessMode(null)} onSuccess={async (user, condoData, backendCondoStatus) => {
              // Em produção, usa status do backend; em demo, calcula localmente
              const status = backendCondoStatus || checkCondoStatus(condoData);
              setCondoStatus(status);
              setIsConciergeAuthed(true);
              setCurrentUser(user);
              setCondoId(user.condo_id);
              // Se condoData não tem slug, busca do banco
              let finalCondoData = condoData;
              if (condoData && !condoData.slug && user.condo_id) {
                try {
                  const { data: fullCondo } = await supabase
                    .from('condos')
                    .select('slug')
                    .eq('id', user.condo_id)
                    .single();
                  if (fullCondo?.slug) {
                    finalCondoData = { ...condoData, slug: fullCondo.slug };
                  }
                } catch {}
              }
              setCondoInfo(finalCondoData);
              setCondoSettings({
                condo_name: finalCondoData?.name || 'CondoTrack',
                condo_address: finalCondoData?.address || '',
                condo_phone: finalCondoData?.phone || ''
              });
              // Resetar showBillingWhenExpired quando status é expired/inactive
              if (status === 'expired' || status === 'inactive') {
                setShowBillingWhenExpired(true);
              }
              try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch {}
            }} />
          )
        ) : (
          <ResidentView
            initialSlug={urlSlug}
            onBack={() => {
              setAccessMode(null);
              if (urlSlug) {
                const url = new URL(window.location);
                url.searchParams.delete('condo');
                window.history.replaceState({}, '', url);
              }
            }}
          />
        )}
      </main>

          {/* Footer minimal */}
          <footer className="border-t border-slate-200 dark:border-slate-700 py-4 px-6 text-center flex-shrink-0">
            <p className="text-xs text-slate-400">
              CondoTrack &middot; Desenvolvido por{' '}
              <a href="https://playcodeagency.xyz" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-150">PlayCodeAgency</a>
            </p>
          </footer>
        </div>

        {/* ===== MOBILE BOTTOM NAV ===== */}
        {isConcierge && isConciergeAuthed && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-30 px-2 pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around py-2">
              {[
                { id: 'home', icon: Package, label: 'Inicio' },
                { id: 'packages', icon: Box, label: 'Encomendas' },
                { id: 'residents', icon: Users, label: 'Moradores' },
                { id: 'reports', icon: FileText, label: 'Historico' },
              ].map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors duration-150 ${activeTab === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}>
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </button>
              ))}
              {currentUser?.role === 'admin' && (
                <div className="relative">
                  <button onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors duration-150 ${['team','settings','billing'].includes(activeTab) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}>
                    <MoreHorizontal size={20} />
                    <span>Mais</span>
                  </button>
                  {mobileMoreOpen && (
                    <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-elevated py-2 min-w-[160px]">
                      {adminNavItems.map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMoreOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 ${activeTab === item.id ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                          <item.icon size={16} /><span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------

// ==================================================================================
// 💳 BILLING CHECKOUT - Componente de Checkout/Pagamento (Asaas)
// ==================================================================================
function BillingCheckout({ condoInfo, onPaymentSuccess, onLogout, isAdmin = false }) {
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [paymentMethod, setPaymentMethod] = useState('PIX'); // 'PIX' | 'CREDIT_CARD'
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [pixData, setPixData] = useState(null); // NOVO ESTADO PARA O PIX
  // Modal de pagamento desabilitado em produção - sempre false
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Em produção, garantir que o modal nunca seja exibido
  useEffect(() => {
    if (IS_PRODUCTION && showPaymentModal) {
      console.warn('⚠️ Modal de pagamento tentou abrir em produção. Fechando...');
      setShowPaymentModal(false);
    }
  }, [showPaymentModal]);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [error, setError] = useState('');

  // Calcula dias restantes ou expirados
  const getDaysInfo = () => {
    if (!condoInfo?.trial_end_date) return { text: 'Período expirado', expired: true };
    const trialEnd = new Date(condoInfo.trial_end_date);
    const now = new Date();
    const diffDays = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Expirado há ${Math.abs(diffDays)} dias`, expired: true };
    } else if (diffDays === 0) {
      return { text: 'Expira hoje!', expired: true };
    }
    return { text: `${diffDays} dias restantes`, expired: false };
  };

  const daysInfo = getDaysInfo();

  // ========================================================================
  // HANDLE SUBSCRIBE - Cria checkout (Asaas) e redireciona ou mostra QR Code
  // ========================================================================
  const handleSubscribe = async (planKey, condoId) => {
    // A função `createAsaasCheckout` agora usa a nova Edge Function
    setSelectedPlan(planKey);
    setIsProcessing(true);
    setError('');
    setPixData(null);

    try {
      console.log('🔄 Iniciando checkout:', { planKey, paymentMethod, condoId });
      const session = await createAsaasCheckout(planKey, paymentMethod, condoId);
      console.log('✅ Resposta do checkout:', session);

      if (!session || !session.success) {
        throw new Error('Resposta inválida do servidor. Tente novamente.');
      }

      // NOVO FLUXO: Trata PIX ou redireciona
      if (session.billingType === 'PIX' && session.pixQrCode) {
        console.log('💚 PIX detectado, exibindo QR Code:', session.pixQrCode);
        // pixQrCode agora é um objeto com payload, encodedImage, expirationDate
        setPixData(session.pixQrCode);
        setIsProcessing(false);
      } else if (session.checkoutUrl) {
        console.log('🔄 Redirecionando para Asaas:', session.checkoutUrl);
        setIsRedirecting(true);
        window.location.href = session.checkoutUrl;
      } else {
        console.error('❌ Resposta sem PIX nem checkoutUrl:', session);
        throw new Error('Não foi possível obter um link de pagamento ou QR Code. Verifique os logs do console.');
      }
    } catch (err) {
      console.error('❌ Erro ao criar sessão de checkout:', err);
      setError(err.message || 'Erro ao iniciar checkout. Tente novamente.');
      setIsProcessing(false);
    }
  };

  // ========================================================================
  // HANDLE TEST PAYMENT - Simula webhook de sucesso (apenas para testes)
  // ========================================================================
  const handleTestPayment = async () => {
    if (!condoInfo?.id) {
      setError('Erro: Condomínio não identificado.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Simula webhook de pagamento bem-sucedido
      const result = await simulateWebhookSuccess(condoInfo.id, selectedPlan);

      if (result.success) {
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentSuccess(result.condo);
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao simular pagamento:', err);
      setError(err.message || 'Erro ao simular pagamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ========================================================================
  // HANDLE PROCESS PAYMENT - Processa pagamento no modal (modo demo)
  // ========================================================================
  const handleProcessPayment = async () => {
    if (!condoInfo?.id) {
      setError('Erro: Condomínio não identificado.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Simula webhook de pagamento confirmado
      const result = await simulateWebhookSuccess(condoInfo.id, selectedPlan);

      if (result.success) {
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentSuccess(result.condo);
        }, 2000);
      }
    } catch (err) {
      console.error('Erro no pagamento:', err);
      setError(err.message || 'Erro ao processar pagamento. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Se tiver dados de PIX, mostra a tela de pagamento PIX
  if (pixData) {
    // pixData pode ser um objeto { payload, encodedImage, expirationDate } ou string (legado)
    const pixPayload = typeof pixData === 'string' ? pixData : pixData.payload;
    const pixImage = typeof pixData === 'object' ? pixData.encodedImage : null;
    const expirationDate = typeof pixData === 'object' && pixData.expirationDate 
      ? new Date(pixData.expirationDate).toLocaleString('pt-BR')
      : null;

    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
           <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Pague com PIX</h2>
           
           {/* QR Code Image (se disponível) */}
           {pixImage ? (
             <div className="bg-white p-4 rounded-lg mb-4 flex justify-center">
               <img 
                 src={`data:image/png;base64,${pixImage}`} 
                 alt="QR Code PIX" 
                 className="w-64 h-64 mx-auto"
               />
             </div>
           ) : (
             <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg mb-4">
               <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Código PIX (Copia e Cola):</p>
               <pre className="text-xs break-all text-left text-slate-600 dark:text-slate-300">{pixPayload}</pre>
             </div>
           )}

           {/* Botão Copiar Código */}
           <button
             onClick={(e) => {
               navigator.clipboard.writeText(pixPayload);
               // Feedback visual
               const btn = e.target;
               if (btn) {
                 const originalText = btn.textContent;
                 btn.textContent = '✓ Copiado!';
                 btn.classList.add('bg-green-500');
                 setTimeout(() => {
                   btn.textContent = originalText;
                   btn.classList.remove('bg-green-500');
                 }, 2000);
               }
             }}
             className="w-full px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-sm transition-all mb-4"
           >
             Copiar Código PIX
           </button>

           {/* Data de Expiração */}
           {expirationDate && (
             <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
               ⏰ Expira em: {expirationDate}
             </p>
           )}

           <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
             Após o pagamento, o sistema será atualizado automaticamente em alguns instantes.
           </p>
           
           <button 
             onClick={() => setPixData(null)} 
             className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline"
           >
             ← Voltar
           </button>
        </div>
      </div>
    );
  }

  // Modal de Redirecionamento
  if (isRedirecting) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Redirecionando para pagamento...</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Você será redirecionado para a página segura do Asaas.
          </p>
        </div>
      </div>
    );
  }

  // Modal de Sucesso
  if (paymentSuccess) {
    const plan = PLANS_CONFIG[selectedPlan];
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Pagamento Confirmado!</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Seu plano <span className="font-semibold text-emerald-500">{plan?.name}</span> foi ativado com sucesso.
          </p>
          <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">Próximo vencimento</p>
            <p className="text-lg font-semibold text-slate-800 dark:text-white">
              {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="animate-pulse text-slate-500 dark:text-slate-400 text-sm">
            Redirecionando para o sistema...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header de Alerta */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 dark:bg-amber-800 p-3 rounded-full flex-shrink-0">
              <AlertTriangle size={28} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-amber-800 dark:text-amber-300 mb-2">
                {condoInfo?.is_active === false ? 'Conta Suspensa' : 'Período de Teste Expirado'}
              </h1>
              <p className="text-slate-700 dark:text-slate-300 mb-3">
                {condoInfo?.is_active === false
                  ? 'Sua conta foi suspensa. Escolha um plano para reativar o acesso.'
                  : 'O período de teste gratuito de 15 dias chegou ao fim. Escolha um plano para continuar.'}
              </p>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="bg-white dark:bg-slate-800 rounded-lg px-4 py-2 border border-slate-200 dark:border-slate-600">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Condomínio</p>
                  <p className="font-semibold text-slate-800 dark:text-white">{condoInfo?.name || 'Não identificado'}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg px-4 py-2 border border-slate-200 dark:border-slate-600">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                  <p className={`font-semibold ${daysInfo.expired ? 'text-red-500' : 'text-amber-500'}`}>
                    {daysInfo.text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Título */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Escolha seu Plano</h2>
          <p className="text-slate-600 dark:text-slate-400">Selecione o plano ideal e continue gerenciando seu condomínio</p>
        </div>

        {/* Método de Pagamento - SEMPRE VISÍVEL */}
        <div className="mb-8" style={{ display: 'block' }}>
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Forma de Pagamento</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Escolha como deseja pagar</p>
          </div>
          <div className="flex justify-center">
            <div className="bg-white dark:bg-slate-800 border-2 border-emerald-500 dark:border-emerald-600 rounded-xl p-2 inline-flex gap-2 shadow-lg" style={{ display: 'flex' }}>
              <button
                type="button"
                onClick={() => {
                  console.log('💳 Método de pagamento alterado para: PIX');
                  setPaymentMethod('PIX');
                }}
                className={`px-4 sm:px-8 py-3 rounded-lg text-base font-bold transition-all min-w-0 sm:min-w-[120px] ${
                  paymentMethod === 'PIX'
                    ? 'bg-emerald-600 text-white shadow-lg scale-105'
                    : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                style={{ display: 'block' }}
              >
                💚 Pix
              </button>
              <button
                type="button"
                onClick={() => {
                  console.log('💳 Método de pagamento alterado para: CREDIT_CARD');
                  setPaymentMethod('CREDIT_CARD');
                }}
                className={`px-4 sm:px-8 py-3 rounded-lg text-base font-bold transition-all min-w-0 sm:min-w-[120px] ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'bg-emerald-600 text-white shadow-lg scale-105'
                    : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                style={{ display: 'block' }}
              >
                💳 Cartão
              </button>
            </div>
          </div>
        </div>

        {/* Cards de Planos */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {Object.entries(PLANS_CONFIG).map(([key, plan]) => (
            <div
              key={key}
              className={`relative bg-white dark:bg-slate-800 rounded-xl border-2 p-6 transition-all hover:shadow-md ${
                plan.popular
                  ? 'border-cyan-500 shadow-lg shadow-cyan-500/20 md:scale-105'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-cyan-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                    Mais Popular
                  </span>
                </div>
              )}
              <div className="mb-4 mt-2">
                <h3 className={`text-lg font-bold ${plan.popular ? 'text-cyan-500' : 'text-slate-800 dark:text-white'}`}>
                  {plan.name}
                </h3>
              </div>
              <div className="mb-4">
                <span className="text-4xl font-extrabold text-slate-800 dark:text-white">{plan.priceFormatted}</span>
                <span className="text-slate-500 dark:text-slate-400">/mês</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle size={16} className={`mr-2 flex-shrink-0 ${plan.popular ? 'text-cyan-500' : 'text-emerald-500'}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(key, condoInfo.id)}
                disabled={isProcessing}
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  isProcessing
                    ? 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed'
                    : plan.popular
                      ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white'
                }`}
              >
                {isProcessing && selectedPlan === key ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : (
                  'Assinar Agora'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Erro Global */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {/* Painel de Teste (Dev/Admin) */}
        {!IS_PRODUCTION && (
          <div className="mb-8">
            <button
              onClick={() => setShowTestPanel(!showTestPanel)}
              className="w-full text-left bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-xl p-4 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 dark:bg-purple-800 p-2 rounded-lg">
                    <Settings size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-purple-800 dark:text-purple-300">Painel de Teste (Dev Mode)</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Simular pagamento (modo demo)</p>
                  </div>
                </div>
                <span className="text-purple-500">{showTestPanel ? '▲' : '▼'}</span>
              </div>
            </button>

            {showTestPanel && (
              <div className="mt-4 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <h4 className="font-bold text-slate-800 dark:text-white mb-4">Simular Pagamento (Webhook)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Este botão simula a confirmação de pagamento que seria enviada pelo webhook do Asaas após um pagamento bem-sucedido.
                  A conta será desbloqueada instantaneamente.
                </p>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {Object.entries(PLANS_CONFIG).map(([key, plan]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedPlan(key)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedPlan === key
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <p className="font-semibold text-slate-800 dark:text-white">{plan.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{plan.priceFormatted}</p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleTestPayment}
                  disabled={isProcessing}
                  className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    isProcessing
                      ? 'bg-slate-400 cursor-not-allowed text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processando Webhook...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Simular Pagamento ({PLANS_CONFIG[selectedPlan]?.name})
                    </>
                  )}
                </button>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
                  Isso chama simulateWebhookSuccess() e ativa a conta imediatamente
                </p>
              </div>
            )}
          </div>
        )}

        {/* Botão de Logout */}
        <div className="text-center">
          <button
            onClick={onLogout}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm underline"
          >
            Sair e usar outra conta
          </button>
        </div>
      </div>

      {/* Modal de Pagamento (APENAS MODO DEMO - Desabilitado em produção) */}
      {showPaymentModal && !IS_PRODUCTION && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 max-w-md w-full border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Finalizar Pagamento</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={24} />
              </button>
            </div>

            {/* Badge Modo Demo */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3 mb-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 text-center font-medium">
                Modo Demo - Em produção, você seria redirecionado para o checkout do Asaas
              </p>
            </div>

            {/* Seleção de Método de Pagamento no Modal */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Escolha a forma de pagamento:
              </label>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('PIX')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                    paymentMethod === 'PIX'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  💚 Pix
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  💳 Cartão
                </button>
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-slate-600 dark:text-slate-400">Plano selecionado</p>
              <p className="text-2xl font-bold text-cyan-500">{PLANS_CONFIG[selectedPlan]?.name}</p>
              <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">
                {PLANS_CONFIG[selectedPlan]?.priceFormatted}/mês
              </p>
            </div>

            {/* Mensagem para Cartão */}
            {paymentMethod === 'CREDIT_CARD' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-700 dark:text-blue-400 text-center">
                  💳 Em produção, você será redirecionado ao checkout seguro para inserir os dados do cartão
                </p>
              </div>
            )}

            {/* Mensagem para PIX */}
            {paymentMethod === 'PIX' && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-emerald-700 dark:text-emerald-400 text-center">
                  💚 Em produção, o QR Code PIX seria exibido aqui após clicar em "Assinar Agora"
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleProcessPayment}
              disabled={isProcessing}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                isProcessing
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Shield size={20} />
                  Pagar {PLANS_CONFIG[selectedPlan]?.priceFormatted}
                </>
              )}
            </button>

            <p className="text-center text-slate-500 dark:text-slate-400 text-xs mt-4 flex items-center justify-center gap-1">
              <Shield size={14} />
              Pagamento 100% seguro e criptografado
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConciergeLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ========================================================================
  // PRE-PREENCHIMENTO: Verifica se veio do cadastro
  // ========================================================================
  useEffect(() => {
    try {
      const tempLoginInfo = localStorage.getItem('temp_login_info');
      if (tempLoginInfo) {
        const data = JSON.parse(tempLoginInfo);

        // Verifica se os dados nao sao muito antigos (5 minutos)
        const isRecent = data.timestamp && (Date.now() - data.timestamp) < 5 * 60 * 1000;

        if (isRecent && (data.email || data.username)) {
          console.log('[Login] Pre-preenchendo dados do cadastro:', data);

          setEmail(data.email || data.username || '');

          // Limpa os dados temporarios
          localStorage.removeItem('temp_login_info');
        } else {
          // Dados antigos ou incompletos - remove
          localStorage.removeItem('temp_login_info');
        }
      }
    } catch (err) {
      console.error('[Login] Erro ao ler temp_login_info:', err);
      localStorage.removeItem('temp_login_info');
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validação dos campos
    if (!email.trim()) {
      setError('Informe o e-mail.');
      return;
    }
    if (!password.trim()) {
      setError('Informe a senha.');
      return;
    }

    setIsLoading(true);
    try {
      // =====================================================================
      // ESTRATÉGIA DE AUTENTICAÇÃO:
      // 1. Tenta Edge Function se IS_PRODUCTION = true
      // 2. Se Edge Function falhar (404/CORS), usa fallback local
      // 3. Se IS_PRODUCTION = false, usa direto o modo demo
      // =====================================================================
      let useLocalAuth = !IS_PRODUCTION;

      if (IS_PRODUCTION) {
        try {
          const authResult = await authenticateViaEdgeFunction(email, password);

          if (authResult.success) {
            onSuccess(
              {
                id: authResult.user.id,
                name: authResult.user.name,
                role: authResult.user.role,
                username: authResult.user.username,
                condo_id: authResult.user.condo_id
              },
              authResult.condo,
              authResult.condoStatus
            );
            return;
          }
        } catch (authError) {
          if (authError.isNetworkError || authError.status === 404) {
            console.warn('[Login] Edge Function indisponível, usando autenticação local (localStorage)');
            useLocalAuth = true;
          } else {
            console.error('[Login] Erro Edge Function:', authError);
            setError(authError.message || 'Erro ao autenticar.');
            setIsLoading(false);
            return;
          }
        }
      }

      if (useLocalAuth) {
        // =====================================================================
        // MODO DEMO: Autenticação via Mock Local (Desenvolvimento)
        // =====================================================================
        // 1. Busca staff por email (sem filtrar condo_id)
        const { data: staffData, error: staffErr } = await supabase
          .from('staff')
          .select('id, name, role, username, password, condo_id')
          .eq('username', email.trim().toLowerCase())
          .single();

        if (staffErr || !staffData) {
          setError('E-mail não encontrado.');
          setIsLoading(false);
          return;
        }

        // 2. Valida senha localmente (APENAS modo demo)
        if (String(staffData.password) !== String(password)) {
          setError('Senha incorreta.');
          setIsLoading(false);
          return;
        }

        // 3. Busca condomínio pelo condo_id do staff
        const { data: condoData, error: condoErr } = await supabase
          .from('condos')
          .select('*')
          .eq('id', staffData.condo_id)
          .single();

        if (condoErr || !condoData) {
          setError('Condomínio não encontrado.');
          setIsLoading(false);
          return;
        }

        // 4. Sucesso: passa user + condo info
        onSuccess(
          { id: staffData.id, name: staffData.name, role: staffData.role, username: staffData.username, condo_id: staffData.condo_id },
          condoData
        );
      }
    } catch (ex) {
      console.error('[Login] Erro:', ex);
      setError('Erro ao autenticar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <div className="w-full max-w-md">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors">
            <ArrowLeft size={16} /> Voltar
          </button>
        )}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-100 dark:border-slate-700 px-6 py-8 text-center">
            <img
              src={LOGO_PATH}
              alt="CondoTrack Logo"
              className="h-16 sm:h-20 w-auto mx-auto mb-4"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Acesso da Portaria</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Entre com suas credenciais</p>
          </div>

          {/* Formulário */}
          <div className="p-6 sm:p-8">
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-300 mb-2">
                  <Mail size={14} className="inline mr-1.5 text-blue-500" />
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-slate-50 dark:bg-slate-700 dark:text-white transition-all placeholder:text-slate-800-subtle"
                  placeholder="Digite seu e-mail"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-300 mb-2">
                  <Shield size={14} className="inline mr-1.5 text-blue-500" />
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none bg-slate-50 dark:bg-slate-700 dark:text-white transition-all placeholder:text-slate-800-subtle"
                  placeholder="Digite sua senha"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-300 text-sm bg-red-100 dark:bg-red-800 p-3 rounded-xl">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Autenticando...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Entrar
                  </>
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

function ConciergeView({ onAdd, packages, onDelete, onCollect, residents, residentsIndex, onAddResident, onDeleteResident, onUpdateResident, currentUser, staff, condoInfo, onAddStaff, onDeleteStaff, condoSettings, onUpdateSettings, activeTab, setActiveTab }) {
  const tab = activeTab;
  const setTab = setActiveTab;
  const [form, setForm] = useState({ unit: '', recipient: '', phone: '', type: 'Caixa', description: '' });
  const [filterType, setFilterType] = useState('Todos');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [collectTarget, setCollectTarget] = useState(null); // pkg id
  const [collectName, setCollectName] = useState('');
  const [collectDoc, setCollectDoc] = useState('');
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [unitSuggestions, setUnitSuggestions] = useState([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const [ocrRawText, setOcrRawText] = useState(null);
  const [ocrPendingResident, setOcrPendingResident] = useState(null);
  const [unitNotFound, setUnitNotFound] = useState(false);
  const [recipientNotFound, setRecipientNotFound] = useState(false);
  const [shareSlug, setShareSlug] = useState(condoInfo?.slug || null);
  const [shareCopied, setShareCopied] = useState(false);

  // Auto-gerar slug se não existir no condomínio
  useEffect(() => {
    if (shareSlug || !condoInfo?.id || !condoInfo?.name) return;
    const ensureSlug = async () => {
      // Primeiro tenta buscar slug existente do banco
      try {
        const { data } = await supabase
          .from('condos')
          .select('slug')
          .eq('id', condoInfo.id)
          .single();
        if (data?.slug) {
          setShareSlug(data.slug);
          condoInfo.slug = data.slug;
          return;
        }
      } catch {}
      // Gera e salva novo slug
      const base = condoInfo.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
        .replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 50) || 'condo';
      const slug = base + '-' + condoInfo.id.substring(0, 4);
      try {
        const { error } = await supabase.from('condos').update({ slug }).eq('id', condoInfo.id);
        if (!error) {
          setShareSlug(slug);
          condoInfo.slug = slug;
        }
      } catch {}
    };
    ensureSlug();
  }, [condoInfo?.id, condoInfo?.name, shareSlug]);

  // Autocomplete: busca moradores por nome (ilike/similarity)
  const searchResidentsByName = (query) => {
    if (!query || query.length < 2) return [];
    const q = String(query).toLowerCase().trim();
    return (residents || []).filter(r =>
      r && r.name && String(r.name).toLowerCase().includes(q)
    ).slice(0, 8);
  };

  // Autocomplete: busca moradores por unidade
  const searchResidentsByUnit = (query) => {
    if (!query || query.length < 1) return [];
    const q = String(query).toLowerCase().trim();
    return (residents || []).filter(r =>
      r && r.unit && String(r.unit).toLowerCase().includes(q)
    ).slice(0, 8);
  };

  const handleRecipientChange = (e) => {
    const v = e.target.value;
    setForm(prev => ({ ...prev, recipient: v }));
    setRecipientNotFound(false);
    const suggestions = searchResidentsByName(v);
    setRecipientSuggestions(suggestions);
    setShowRecipientDropdown(v.length >= 2);
    if (suggestions.length === 1 && suggestions[0].name.toLowerCase() === v.toLowerCase().trim()) {
      selectResident(suggestions[0]);
      setShowRecipientDropdown(false);
    }
  };

  const handleUnitChange = (e) => {
    const v = e.target.value;
    setForm(prev => ({ ...prev, unit: v }));
    setUnitNotFound(false);
    const suggestions = searchResidentsByUnit(v);
    setUnitSuggestions(suggestions);
    setShowUnitDropdown(v.length >= 1);
    if (suggestions.length === 1 && String(suggestions[0].unit).toLowerCase() === v.toLowerCase().trim()) {
      selectResident(suggestions[0]);
      setShowUnitDropdown(false);
    }
  };

  const selectResident = (r) => {
    setForm(prev => ({
      ...prev,
      unit: r.unit || prev.unit,
      recipient: r.name || prev.recipient,
      phone: prev.phone || formatPhoneMask(r.phone || '')
    }));
    setShowRecipientDropdown(false);
    setShowUnitDropdown(false);
    setUnitNotFound(false);
    setRecipientNotFound(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.unit || !form.recipient) return;
    onAdd(form);
    setForm({ unit: '', recipient: '', phone: '', type: 'Caixa', description: '' });
    setShowRecipientDropdown(false);
    setShowUnitDropdown(false);
    setUnitNotFound(false);
    setRecipientNotFound(false);
    setOcrError(null);
    setOcrRawText(null);
  };

  const handleOcrCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError(null);
    setOcrRawText(null);
    if (!file.type.startsWith('image/')) { setOcrError('Selecione uma imagem valida.'); return; }
    if (file.size > 10 * 1024 * 1024) { setOcrError('Imagem muito grande (max 10MB).'); return; }
    if (!OCR_LABEL_ENDPOINT) { setOcrError('OCR nao disponivel no modo demo.'); return; }
    setOcrLoading(true);
    try {
      const base64 = await compressImageToBase64(file, 1280, 0.75);
      const response = await fetch(OCR_LABEL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ imageBase64: base64, condoId: condoInfo?.id || null }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Erro ao processar imagem.');
      setOcrRawText(data.rawText || '');
      const parsed = data.parsed || {};

      // Tentar encontrar morador pelo apartamento ou nome detectado
      let matched = null;
      if (parsed.unit) {
        const byUnit = searchResidentsByUnit(parsed.unit);
        if (byUnit.length === 1) matched = byUnit[0];
        else if (byUnit.length > 1 && parsed.recipient) {
          const nameLower = parsed.recipient.toLowerCase();
          matched = byUnit.find(r => r.name && r.name.toLowerCase().includes(nameLower)) || byUnit[0];
        }
      }
      if (!matched && parsed.recipient) {
        const byName = searchResidentsByName(parsed.recipient);
        if (byName.length === 1) matched = byName[0];
        else if (byName.length > 1) matched = byName[0];
      }

      if (matched) {
        // Morador encontrado: preencher com dados cadastrados (igual autocomplete)
        setForm(prev => ({
          ...prev,
          unit: matched.unit || parsed.unit || prev.unit,
          recipient: matched.name || parsed.recipient || prev.recipient,
          phone: prev.phone || formatPhoneMask(matched.phone || parsed.phone || ''),
          type: parsed.type || prev.type,
          description: parsed.description || prev.description,
        }));
        setShowRecipientDropdown(false);
        setShowUnitDropdown(false);
      } else {
        // Sem match: salvar dados OCR e redirecionar para cadastro de morador
        setOcrPendingResident({
          unit: parsed.unit || '',
          name: parsed.recipient || '',
          phone: parsed.phone ? formatPhoneMask(parsed.phone) : '',
          source: 'ocr',
        });

        // Preservar dados OCR no form de encomenda para uso posterior
        setForm(prev => ({
          ...prev,
          unit: parsed.unit || prev.unit,
          recipient: parsed.recipient || prev.recipient,
          phone: parsed.phone ? formatPhoneMask(parsed.phone) : prev.phone,
          type: parsed.type || prev.type,
          description: parsed.description || prev.description,
        }));

        // Redirecionar para aba de moradores
        setTab('residents');
      }
    } catch (err) {
      console.error('[OCR] Error:', err);
      setOcrError(err.message || 'Erro ao ler etiqueta.');
    } finally {
      setOcrLoading(false);
      e.target.value = '';
    }
  };

  const handleUnitBlur = () => {
    const unitKey = String(form.unit || '').toLowerCase();
    const found = residentsIndex[unitKey];
    if (found) {
      setForm(prev => ({
        ...prev,
        recipient: prev.recipient || found.name || '',
        phone: prev.phone || formatPhoneMask(found.phone || '')
      }));
      setUnitNotFound(false);
    } else if (form.unit && form.unit.length >= 1) {
      const bySearch = searchResidentsByUnit(form.unit);
      setUnitNotFound(bySearch.length === 0);
    } else {
      setUnitNotFound(false);
    }
    setTimeout(() => setShowUnitDropdown(false), 250);
  };

  const handleRecipientBlur = () => {
    if (form.recipient && form.recipient.length >= 2) {
      const bySearch = searchResidentsByName(form.recipient);
      setRecipientNotFound(bySearch.length === 0);
    } else {
      setRecipientNotFound(false);
    }
    setTimeout(() => setShowRecipientDropdown(false), 250);
  };

  // Lembretes: encomendas pendentes há mais de 24h
  const REMINDER_HOURS = 24;
  const packagesNeedingReminder = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - REMINDER_HOURS);
    return (packages || []).filter(p =>
      p.status === 'pending' &&
      p.created_at &&
      new Date(p.created_at) < cutoff &&
      (p.phone || p.recipient)
    );
  }, [packages]);
  const handlePhoneChange = (e) => {
    const v = e.target.value;
    setForm(prev => ({ ...prev, phone: formatPhoneMask(v) }));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    // Valida senha do usuário atual antes de excluir
    try {
      const { data } = await supabase
        .from('staff')
        .select('password')
        .eq('username', currentUser?.username)
        .single();

      if (!data || String(data.password) !== String(deleteConfirmPassword)) {
        setDeletePasswordError('Senha incorreta');
        return;
      }

      // Passa o nome do usuário que está excluindo para registro
      onDelete(deleteTarget, currentUser?.name || currentUser?.username || 'Desconhecido');
      setDeleteTarget(null);
      setDeleteConfirmPassword('');
      setDeletePasswordError('');
    } catch {
      setDeletePasswordError('Erro ao validar senha');
    }
  };

  // Filtra pacotes deletados de todas as listagens
  const activePackages = packages.filter(p => p.status !== 'deleted');
  const pendingPackages = activePackages.filter(p => p.status === 'pending');
  const filteredPackages = filterType === 'Todos'
    ? pendingPackages
    : pendingPackages.filter(p => p.type === filterType);
  const countByType = (type) => pendingPackages.filter(p => p.type === type).length;
  const historyPackages = activePackages.filter(p => p.status === 'collected');

  // Entregas do dia (apenas hoje)
  const today = new Date().toDateString();
  const todayDeliveries = historyPackages.filter(p =>
    p.collected_at && new Date(p.collected_at).toDateString() === today
  );

  return (
    <div className="space-y-6">
      {/* Modal de Exclusão com confirmação de senha */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 max-w-sm w-full animate-scale-in border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-red-100 dark:bg-red-800 rounded-lg">
                <AlertTriangle size={24} className="text-red-600 dark:text-red-200" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Confirmar Exclusão</h3>
                <p className="text-xs text-slate-500">Esta ação é irreversível</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-5 text-sm">Deseja realmente apagar este registro? Todos os dados serão perdidos permanentemente.</p>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Digite sua senha para confirmar</label>
              <input
                type="password"
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-400"
                value={deleteConfirmPassword}
                onChange={(e) => { setDeleteConfirmPassword(e.target.value); setDeletePasswordError(''); }}
                placeholder="Digite sua senha"
              />
              {deletePasswordError && <p className="text-red-500 text-sm mt-2 flex items-center gap-1"><AlertTriangle size={14} />{deletePasswordError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmPassword(''); setDeletePasswordError(''); }} className="flex-1 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium transition-colors">Cancelar</button>
              <button onClick={confirmDelete} disabled={!deleteConfirmPassword} className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 font-semibold shadow-sm disabled:opacity-50 transition-all">Sim, excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Retirada */}
      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-sm animate-scale-in border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                  <CheckCircle size={22} className="text-emerald-600 dark:text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Confirmar Retirada</h3>
                  <p className="text-xs text-slate-500">Registre quem está retirando</p>
                </div>
              </div>
              <button
                title="Excluir encomenda"
                onClick={() => { setDeleteTarget(collectTarget); setCollectTarget(null); }}
                className="text-red-600 hover:bg-red-100 dark:hover:bg-red-800 p-2 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nome de quem retira</label>
                <input
                  autoFocus
                  type="text"
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all placeholder:text-slate-400"
                  value={collectName}
                  onChange={e => setCollectName(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Documento (RG/CPF)</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all placeholder:text-slate-400"
                  value={collectDoc}
                  onChange={e => setCollectDoc(e.target.value)}
                  placeholder="Número do documento"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setCollectTarget(null); setCollectName(''); setCollectDoc(''); }} className="flex-1 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium transition-colors">Cancelar</button>
              <button
                onClick={() => { if (collectName && collectDoc) { onCollect(collectTarget, collectName, collectDoc); setCollectTarget(null); setCollectName(''); setCollectDoc(''); } }}
                disabled={!collectName || !collectDoc}
                className="flex-1 px-4 py-3 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 font-semibold shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lembretes - Encomendas pendentes há mais de 24h */}
      {showRemindersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-scale-in border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-800 rounded-lg">
                  <Clock size={22} className="text-amber-600 dark:text-amber-200" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Enviar Lembretes</h3>
                  <p className="text-xs text-slate-500">Encomendas pendentes há mais de 24h</p>
                </div>
              </div>
              <button onClick={() => setShowRemindersModal(false)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 mb-4">
              {packagesNeedingReminder.map(pkg => {
                const phone = extractDigits(pkg.phone || residentsIndex[String(pkg.unit || '').toLowerCase()]?.phone || '');
                const text = encodeURIComponent(`Olá ${pkg.recipient}! Lembrete: você tem uma encomenda (${pkg.type || 'pacote'}) aguardando retirada na portaria há mais de 24h. 📦 Disponível para retirada.`);
                const waUrl = phone ? `https://wa.me/55${phone}?text=${text}` : null;
                const hoursAgo = pkg.created_at ? Math.round((Date.now() - new Date(pkg.created_at).getTime()) / 3600000) : 0;
                return (
                  <div key={pkg.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 dark:text-white truncate">{pkg.recipient}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{pkg.unit} • {pkg.type} • há {hoursAgo}h</p>
                    </div>
                    {waUrl ? (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors">
                        <MessageCircle size={16} /> Enviar
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">Sem telefone</span>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowRemindersModal(false)} className="w-full py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Navigation is now handled by the sidebar/bottom nav in the parent layout */}

      {/* ABA INÍCIO - Dashboard */}
      {tab === 'home' && (
        <div className="space-y-6 animate-fade-in">
          {/* Widgets de Estatísticas - Cards brancos com ícones coloridos suaves */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 p-3 sm:p-6 hover:shadow-card-hover hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pendentes</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{pendingPackages.length}</p>
                </div>
                <div className="p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <Clock size={22} className="text-amber-500 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Aguardando retirada</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 p-3 sm:p-6 hover:shadow-card-hover hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Entregues Hoje</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{todayDeliveries.length}</p>
                </div>
                <div className="p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <CheckCircle size={22} className="text-emerald-500 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Retiradas concluídas</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 p-3 sm:p-6 hover:shadow-card-hover hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Moradores</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{residents?.length || 0}</p>
                </div>
                <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Users size={22} className="text-blue-500 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Cadastrados</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 p-3 sm:p-6 hover:shadow-card-hover hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total do Mês</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">{historyPackages.length}</p>
                </div>
                <div className="p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <BarChart3 size={22} className="text-indigo-500 dark:text-indigo-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Encomendas entregues</p>
            </div>
          </div>

          {/* Card: Link para Moradores */}
          {shareSlug && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <Link2 size={18} className="text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Link para Moradores</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Compartilhe para acesso direto às encomendas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/app.html?condo=${shareSlug}`}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white select-all truncate"
                  onClick={e => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/app.html?condo=${shareSlug}`);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 flex-shrink-0"
                >
                  {shareCopied ? <><CheckCircle size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Acesse suas encomendas pelo CondoTrack:\n${window.location.origin}/app.html?condo=${shareSlug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 flex-shrink-0"
                >
                  <MessageCircle size={14} /> <span className="hidden sm:inline">WhatsApp</span>
                </a>
              </div>
            </div>
          )}

          {/* Encomendas Pendentes - Tabela profissional */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <Clock className="text-amber-500 dark:text-amber-400" size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Encomendas Pendentes</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Clique para registrar retirada</p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm font-bold rounded-full">{pendingPackages.length}</span>
            </div>
            <div>
              {pendingPackages.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-xl mb-4">
                    <Package size={32} className="text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-medium">Nenhuma encomenda pendente</p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Todas as encomendas foram retiradas</p>
                </div>
              ) : (
                <>
                  {/* Tabela desktop */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700">
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Apt</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Morador</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {pendingPackages.map(pkg => (
                          <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150 cursor-pointer" onClick={() => setCollectTarget(pkg.id)}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-semibold text-slate-900 dark:text-white">{pkg.unit}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-slate-700 dark:text-slate-300 truncate block max-w-[200px]">{pkg.recipient}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{pkg.type}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                              {new Date(pkg.arrived_at).toLocaleDateString('pt-BR')} {new Date(pkg.arrived_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-soft"></span>
                                Pendente
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button onClick={(e) => { e.stopPropagation(); setCollectTarget(pkg.id); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors duration-150 active:scale-[0.98]">
                                Entregar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Cards mobile */}
                  <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700">
                    {pendingPackages.map(pkg => (
                      <div key={pkg.id} onClick={() => setCollectTarget(pkg.id)} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors duration-150">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900 dark:text-white">Apt {pkg.unit}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-soft"></span>
                            Pendente
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{pkg.recipient}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-400 dark:text-slate-500">{pkg.type} • {new Date(pkg.arrived_at).toLocaleDateString('pt-BR')}</span>
                          <button onClick={(e) => { e.stopPropagation(); setCollectTarget(pkg.id); }} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors duration-150">Entregar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Entregas do Dia */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Entregas de Hoje</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Retiradas realizadas</p>
                </div>
              </div>
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-full">{todayDeliveries.length}</span>
            </div>
            <div>
              {todayDeliveries.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-xl mb-4">
                    <CheckCircle size={32} className="text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-medium">Nenhuma entrega hoje</p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">As entregas aparecerão aqui</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {todayDeliveries.map(pkg => (
                    <div key={pkg.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex-shrink-0">
                          <CheckCircle size={18} className="text-emerald-500 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">Apt {pkg.unit}</span>
                            <span className="text-slate-500 dark:text-slate-400">•</span>
                            <span className="text-slate-700 dark:text-slate-300 truncate">{pkg.recipient}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            <span>{new Date(pkg.collected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            {pkg.collected_by && <><span>•</span><span>Retirado por {pkg.collected_by}</span></>}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0 ml-3">{pkg.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'packages' && (
        <>
          {/* Formulário Encomenda */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Package className="text-blue-500 dark:text-blue-400" size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">Registrar Encomenda</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Preencha os dados ou tire foto da etiqueta</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`flex items-center gap-2 px-3 py-1.5 ${ocrLoading ? 'bg-slate-200 dark:bg-slate-600 cursor-wait text-slate-400' : 'border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-600 dark:text-slate-300'} rounded-lg text-sm font-medium transition-colors duration-150`}>
                  {ocrLoading ? (<><Loader2 size={16} className="animate-spin" /> Lendo...</>) : (<><Camera size={16} /><span className="hidden sm:inline">Ler Etiqueta</span></>)}
                  <input type="file" accept="image/*" capture="environment" onChange={handleOcrCapture} disabled={ocrLoading} className="hidden" />
                </label>
                {packagesNeedingReminder.length > 0 && (
                  <button type="button" onClick={() => setShowRemindersModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg text-sm font-medium transition-colors duration-150">
                    <Clock size={16} />
                    {packagesNeedingReminder.length} lembrete{packagesNeedingReminder.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
            <div className="p-3 sm:p-6">
              {ocrError && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
                  <AlertTriangle size={16} />
                  <span className="flex-1">{ocrError}</span>
                  <button onClick={() => setOcrError(null)}><X size={14} /></button>
                </div>
              )}
              {ocrRawText && !ocrError && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 text-sm">
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <CheckCircle size={16} />
                    Texto detectado na etiqueta
                  </div>
                  <p className="text-xs opacity-75 line-clamp-3">{ocrRawText}</p>
                  <button onClick={() => setOcrRawText(null)} className="text-xs underline mt-1">Fechar</button>
                </div>
              )}
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-5">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Unidade *</label>
                  <input type="text" placeholder="Ex: 104-B" className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all placeholder:text-slate-400" value={form.unit} onChange={handleUnitChange} onBlur={handleUnitBlur} onFocus={() => { const s = searchResidentsByUnit(form.unit); setUnitSuggestions(s); setShowUnitDropdown(form.unit.length >= 1); }} required />
                  {showUnitDropdown && form.unit.length >= 1 && (
                    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {unitSuggestions.length > 0 ? (
                        unitSuggestions.map(r => (
                          <button key={r.id} type="button" className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 flex justify-between items-center" onClick={() => selectResident(r)}>
                            <span className="font-medium text-slate-800 dark:text-white">{r.name}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{r.unit}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-center">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum morador encontrado para esta unidade</p>
                          <button type="button" onClick={() => { setOcrPendingResident({ unit: form.unit, name: form.recipient || '', phone: '', source: 'manual' }); setTab('residents'); setShowUnitDropdown(false); }} className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1 mx-auto">
                            <UserPlus size={14} /> Cadastrar morador
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {unitNotFound && (
                    <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg flex items-center justify-between gap-2">
                      <p className="text-xs text-amber-700 dark:text-amber-300">Unidade <strong>{form.unit}</strong> não cadastrada</p>
                      <button type="button" onClick={() => { setOcrPendingResident({ unit: form.unit, name: form.recipient || '', phone: '', source: 'manual' }); setTab('residents'); }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold whitespace-nowrap flex items-center gap-1">
                        <UserPlus size={12} /> Cadastrar
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Destinatário *</label>
                  <input type="text" placeholder="Nome do morador" className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all placeholder:text-slate-400" value={form.recipient} onChange={handleRecipientChange} onBlur={handleRecipientBlur} onFocus={() => { const s = searchResidentsByName(form.recipient); setRecipientSuggestions(s); setShowRecipientDropdown(form.recipient.length >= 2); }} required />
                  {showRecipientDropdown && form.recipient.length >= 2 && (
                    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {recipientSuggestions.length > 0 ? (
                        recipientSuggestions.map(r => (
                          <button key={r.id} type="button" className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 flex justify-between items-center" onClick={() => selectResident(r)}>
                            <span className="font-medium text-slate-800 dark:text-white">{r.name}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{r.unit}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-center">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum morador encontrado com este nome</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Se a encomenda é para um morador cadastrado, preencha a unidade correta</p>
                          <button type="button" onClick={() => { setOcrPendingResident({ unit: form.unit || '', name: form.recipient, phone: '', source: 'manual' }); setTab('residents'); setShowRecipientDropdown(false); }} className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1 mx-auto">
                            <UserPlus size={14} /> Cadastrar morador
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {recipientNotFound && (
                    <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-amber-700 dark:text-amber-300">Morador <strong>{form.recipient}</strong> não encontrado</p>
                        <button type="button" onClick={() => { setOcrPendingResident({ unit: form.unit || '', name: form.recipient, phone: '', source: 'manual' }); setTab('residents'); }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold whitespace-nowrap flex items-center gap-1">
                          <UserPlus size={12} /> Cadastrar
                        </button>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Se a encomenda é para um morador cadastrado, preencha a unidade correta</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2 flex items-center gap-1.5">
                    <Phone size={14} className="text-emerald-500" /> WhatsApp
                  </label>
                  <input type="tel" placeholder="(11) 9XXXX-XXXX" className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all placeholder:text-slate-400" value={form.phone} onChange={handlePhoneChange} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Tipo de Encomenda</label>
                  <select className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all cursor-pointer font-medium" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option>Caixa</option><option>Pacote</option><option>Envelope</option><option>Mercado Livre/Shopee</option><option>Delivery / Comida</option><option>Outro</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 sm:mb-2">Descrição</label>
                  <input type="text" placeholder="Informações adicionais (opcional)" className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all placeholder:text-slate-400" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="md:col-span-2 pt-1 sm:pt-2">
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 sm:py-3.5 rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98] flex justify-center items-center gap-2 text-sm sm:text-base">
                    <CheckCircle size={20} /> Registrar Chegada
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Lista + Filtros */}
          <div className="mt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                Pendentes ({pendingPackages.length})
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto scrollbar-hide">
                {['Todos', 'Caixa', 'Pacote', 'Envelope', 'Mercado Livre/Shopee', 'Delivery / Comida', 'Outro'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all duration-150 ${filterType === type ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                  >
                    {type}
                    {type !== 'Todos' && countByType(type) > 0 &&
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filterType === type ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>{countByType(type)}</span>}
                  </button>
                ))}
              </div>
            </div>

            {filteredPackages.length === 0 ? (
              <div className="text-center py-14 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-600">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-50 dark:bg-slate-700 rounded-xl mb-4">
                  <Package size={28} className="text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-medium">Sem encomendas pendentes</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Registre uma nova encomenda acima</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Desktop: Tabela */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="px-6 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Unidade</th>
                        <th className="px-6 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Destinatário</th>
                        <th className="px-6 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredPackages.map((pkg) => {
                        const phoneDigits = String(pkg.phone || '').replace(/\D/g,'');
                        const box = String.fromCodePoint(0x1F4E6);
                        const waMsg = encodeURIComponent(`Olá ${pkg.recipient}! Chegou uma encomenda (${pkg.type}) para você na portaria. ${box} Disponível para retirada.`);
                        const wa = phoneDigits ? `https://wa.me/55${phoneDigits}?text=${waMsg}` : null;
                        return (
                          <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150">
                            <td className="px-6 py-4">
                              <span className="font-semibold text-slate-900 dark:text-white">{pkg.unit}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{pkg.recipient}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{pkg.type}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse-soft"></span>
                                Pendente
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2">
                                {wa && (
                                  <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors duration-150">
                                    <MessageCircle size={14} />
                                    WhatsApp
                                  </a>
                                )}
                                <button onClick={() => setCollectTarget(pkg.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors duration-150 active:scale-[0.98]">
                                  <CheckCircle size={14} />
                                  Entregar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: Cards */}
                <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredPackages.map((pkg) => {
                    const phoneDigits = String(pkg.phone || '').replace(/\D/g,'');
                    const box = String.fromCodePoint(0x1F4E6);
                    const waMsg = encodeURIComponent(`Olá ${pkg.recipient}! Chegou uma encomenda (${pkg.type}) para você na portaria. ${box} Disponível para retirada.`);
                    const wa = phoneDigits ? `https://wa.me/55${phoneDigits}?text=${waMsg}` : null;
                    return (
                      <div key={pkg.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">Apt {pkg.unit}</span>
                            <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-slate-700 dark:text-slate-300">{pkg.recipient}</span>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse-soft"></span>
                            Pendente
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{pkg.type}</span>
                          <div className="flex gap-2">
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors duration-150 border border-emerald-200 dark:border-emerald-800">
                                <MessageCircle size={14} />
                                WhatsApp
                              </a>
                            )}
                            <button onClick={() => setCollectTarget(pkg.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors duration-150 active:scale-[0.98]">
                              <CheckCircle size={14} />
                              Entregar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </>
      )}

      {tab === 'residents' && (
        <ResidentsManager
          residents={residents}
          onAddResident={onAddResident}
          onDeleteResident={onDeleteResident}
          onUpdateResident={onUpdateResident}
          ocrPendingResident={ocrPendingResident}
          onResidentRegistered={(newResident) => {
            setOcrPendingResident(null);
            setForm(prev => ({
              ...prev,
              unit: newResident.unit || prev.unit,
              recipient: newResident.name || prev.recipient,
              phone: formatPhoneMask(newResident.phone || '') || prev.phone,
            }));
            setTab('packages');
          }}
        />
      )}

      {tab === 'reports' && (
        <ReportQueryManager packages={packages} />
      )}

      {tab === 'team' && currentUser?.role === 'admin' && (
        <TeamManager staff={staff} onAddStaff={onAddStaff} onDeleteStaff={onDeleteStaff} />
      )}

      {tab === 'settings' && currentUser?.role === 'admin' && (
        <CondoSettingsManager condoSettings={condoSettings} onUpdateSettings={onUpdateSettings} condoInfo={condoInfo} />
      )}

      {/* ABA PLANO/BILLING - Informações do plano (apenas admin) */}
      {tab === 'billing' && currentUser?.role === 'admin' && (
        <BillingManager condoInfo={condoInfo} staff={staff} />
      )}
    </div>
  );
}

// ---------- Componente de Configurações do Condomínio ----------
function CondoSettingsManager({ condoSettings, onUpdateSettings, condoInfo }) {
  const [form, setForm] = useState({
    condo_name: condoSettings?.condo_name || '',
    condo_address: condoSettings?.condo_address || '',
    condo_phone: condoSettings?.condo_phone || ''
  });
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localSlug, setLocalSlug] = useState(condoInfo?.slug || null);

  // Auto-gerar slug se não existir
  useEffect(() => {
    if (localSlug || !condoInfo?.id || !condoInfo?.name) return;
    const generateAndSaveSlug = async () => {
      const base = condoInfo.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
        .replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 50) || 'condo';
      const slug = base + '-' + condoInfo.id.substring(0, 4);
      try {
        const { error } = await supabase
          .from('condos')
          .update({ slug })
          .eq('id', condoInfo.id);
        if (!error) {
          setLocalSlug(slug);
          condoInfo.slug = slug;
        }
      } catch {}
    };
    generateAndSaveSlug();
  }, [condoInfo?.id, condoInfo?.name, localSlug]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.condo_name.trim()) return;
    onUpdateSettings({
      condo_name: form.condo_name.trim(),
      condo_address: form.condo_address.trim(),
      condo_phone: form.condo_phone.trim()
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <Building2 className="text-blue-500 dark:text-blue-400" size={20} />
        </div>
        <h2 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">Configurações do Condomínio</h2>
      </div>
      <div className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome do Condomínio *
            </label>
            <input
              type="text"
              placeholder="Ex: Residencial Solar das Flores"
              className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
              value={form.condo_name}
              onChange={(e) => setForm({ ...form, condo_name: e.target.value })}
              required
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Este nome será exibido no cabeçalho e em todo o sistema.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Endereço
            </label>
            <input
              type="text"
              placeholder="Ex: Rua das Flores, 123 - Centro"
              className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
              value={form.condo_address}
              onChange={(e) => setForm({ ...form, condo_address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Telefone da Portaria
            </label>
            <input
              type="tel"
              placeholder="(11) 1234-5678"
              className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
              value={form.condo_phone}
              onChange={(e) => setForm({ ...form, condo_phone: e.target.value })}
            />
          </div>
          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex justify-center items-center gap-2"
            >
              <Save size={20} /> Salvar Configurações
            </button>
            {saved && (
              <p className="text-center text-emerald-600 dark:text-emerald-400 text-sm mt-2 flex items-center justify-center gap-1">
                <CheckCircle size={16} /> Configurações salvas com sucesso!
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Link compartilhável para moradores */}
      {localSlug && (
        <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4 px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Link para Moradores</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Compartilhe este link com os moradores para acesso direto às encomendas</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/app.html?condo=${localSlug}`}
              className="flex-1 px-3 py-2 text-sm border dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 dark:text-white select-all min-w-0"
              onClick={e => e.target.select()}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/app.html?condo=${localSlug}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1"
              >
                {copied ? <><CheckCircle size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Acesse suas encomendas pelo CondoTrack:\n${window.location.origin}/app.html?condo=${localSlug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Componente de Billing/Plano ----------
function BillingManager({ condoInfo, staff }) {
  const porteiroCount = staff?.filter(s => s.role === 'porteiro').length || 0;
  const adminCount = staff?.filter(s => s.role === 'admin').length || 0;
  const currentPlanType = condoInfo?.plan_type || 'basic';
  const staffLimit = condoInfo?.staff_limit || 2;
  
  // Verifica se está em trial
  const isTrial = condoInfo?.subscription_status === 'trial';
  const trialEndDate = condoInfo?.trial_end_date;
  
  // Debug: log para verificar dados
  console.log('[BillingManager] CondoInfo:', {
    subscription_status: condoInfo?.subscription_status,
    trial_end_date: condoInfo?.trial_end_date,
    plan_type: condoInfo?.plan_type,
    isTrial
  });
  
  // Calcula dias restantes do trial
  const getTrialDaysRemaining = () => {
    if (!trialEndDate) return null;
    const trialEnd = new Date(trialEndDate);
    const now = new Date();
    const diffTime = trialEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  const trialDaysRemaining = getTrialDaysRemaining();
  const isTrialExpired = trialDaysRemaining !== null && trialDaysRemaining <= 0;

  const plans = [
    {
      id: 'basic',
      name: 'Básico',
      price: 99,
      staffLimit: 2,
      unitLimit: 50,
      features: [
        { text: 'Até 2 porteiros', included: true },
        { text: 'Até 50 unidades', included: true },
        { text: 'Gestão de encomendas', included: true },
        { text: 'Notificação WhatsApp', included: true },
        { text: 'Histórico 90 dias', included: true },
        { text: 'Relatórios avançados', included: false },
        { text: 'Suporte prioritário', included: false },
      ],
      color: 'gray',
      popular: false
    },
    {
      id: 'professional',
      name: 'Profissional',
      price: 199,
      staffLimit: 5,
      unitLimit: 150,
      features: [
        { text: 'Até 5 porteiros', included: true },
        { text: 'Até 150 unidades', included: true },
        { text: 'Gestão de encomendas', included: true },
        { text: 'Notificação WhatsApp', included: true },
        { text: 'Histórico 1 ano', included: true },
        { text: 'Relatórios avançados', included: true },
        { text: 'Suporte prioritário', included: true },
      ],
      color: 'blue',
      popular: true
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 349,
      staffLimit: 10,
      unitLimit: 9999,
      features: [
        { text: 'Até 10 porteiros', included: true },
        { text: 'Unidades ilimitadas', included: true },
        { text: 'Gestão de encomendas', included: true },
        { text: 'Notificação WhatsApp', included: true },
        { text: 'Histórico ilimitado', included: true },
        { text: 'Relatórios avançados', included: true },
        { text: 'Suporte 24/7 + API', included: true },
      ],
      color: 'violet',
      popular: false
    }
  ];

  const currentPlan = plans.find(p => p.id === currentPlanType) || plans[0];

  return (
    <div className="space-y-6">
      {/* Header do Plano Atual / Trial */}
      <div className={`rounded-xl p-4 sm:p-6 border ${
        isTrial && !isTrialExpired
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : isTrialExpired
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-card'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${
              isTrial && !isTrialExpired ? 'bg-emerald-100 dark:bg-emerald-900/30' : isTrialExpired ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-50 dark:bg-blue-900/20'
            }`}>
              <CreditCard size={24} className={
                isTrial && !isTrialExpired ? 'text-emerald-600 dark:text-emerald-400' : isTrialExpired ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
              } />
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isTrial && !isTrialExpired ? 'Período de teste' : isTrialExpired ? 'Trial expirado' : 'Seu plano atual'}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {isTrial && !isTrialExpired
                  ? `Trial - ${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'}`
                  : isTrialExpired
                  ? 'Trial Expirado'
                  : `Plano ${currentPlan.name}`
                }
              </h2>
              {isTrial && !isTrialExpired && (
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  Escolha um plano para continuar após o trial
                </p>
              )}
              {isTrialExpired && (
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  Escolha um plano para continuar usando o sistema
                </p>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            {isTrial && !isTrialExpired ? (
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">Grátis</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Por {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia' : 'dias'}</p>
              </div>
            ) : isTrialExpired ? (
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">Bloqueado</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Escolha um plano</p>
              </div>
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">R$ {currentPlan.price}<span className="text-lg font-normal text-slate-500 dark:text-slate-400">/mês</span></p>
            )}
          </div>
        </div>
      </div>

      {/* Uso de Porteiros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
            <Users size={18} className="text-blue-500" />
            Uso de Porteiros
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">{porteiroCount} / {staffLimit}</span>
        </div>
        <div className="bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${porteiroCount >= staffLimit ? 'bg-red-500' : porteiroCount >= staffLimit * 0.8 ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min((porteiroCount / staffLimit) * 100, 100)}%` }}
          />
        </div>
        {porteiroCount >= staffLimit && (
          <p className="text-red-500 text-sm flex items-center gap-1">
            <AlertTriangle size={14} />
            Limite atingido! Faça upgrade para adicionar mais.
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 sm:p-4 rounded-xl text-center">
            <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{adminCount}</p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Administradores</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 sm:p-4 rounded-xl text-center">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{porteiroCount}</p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Porteiros</p>
          </div>
        </div>
      </div>

      {/* Todos os Planos */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <TrendingUp size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">Planos Disponíveis</h3>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanType;
              const isPopular = plan.popular;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-5 transition-all ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : isPopular
                        ? 'border-blue-300 dark:border-blue-700'
                        : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isPopular && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Popular
                      </span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Atual
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-4 mt-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-lg">{plan.name}</h4>
                    <div className="mt-2">
                      <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">R$ {plan.price}</span>
                      <span className="text-slate-500 dark:text-slate-400">/mês</span>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        {feature.included ? (
                          <CheckCircle size={16} className={`flex-shrink-0 ${
                            plan.color === 'blue' ? 'text-blue-500' :
                            plan.color === 'violet' ? 'text-violet-500' : 'text-emerald-500'
                          }`} />
                        ) : (
                          <X size={16} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                        )}
                        <span className={feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {(isCurrent && !isTrial) ? (
                    <button disabled className="w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 py-2.5 rounded-lg font-medium cursor-not-allowed">
                      Plano Atual
                    </button>
                  ) : (
                    <button
                      onClick={() => window.location.href = '/billing.html'}
                      className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                        plan.color === 'blue'
                          ? 'bg-blue-500 hover:bg-blue-600 text-white'
                          : plan.color === 'violet'
                            ? 'bg-violet-500 hover:bg-violet-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white'
                      }`}
                    >
                      {plans.indexOf(plan) > plans.indexOf(currentPlan) ? 'Fazer Upgrade' : 'Mudar Plano'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info do Condomínio */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <Building2 size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Informações do Condomínio</h3>
        </div>
        <div className="p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ID do Condomínio</p>
              <code className="text-sm font-mono text-slate-900 dark:text-white">{condoInfo?.id || 'N/A'}</code>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Nome</p>
              <p className="font-medium text-slate-900 dark:text-white">{condoInfo?.name || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Plano</p>
              <span className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg text-sm font-medium">
                <CheckCircle size={14} />
                {currentPlan.name}
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Limite de Porteiros</p>
              <p className="font-medium text-slate-900 dark:text-white">{staffLimit} porteiros</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResidentsManager({ residents, onAddResident, onDeleteResident, onUpdateResident, ocrPendingResident, onResidentRegistered }) {
  const [form, setForm] = useState({ unit: '', name: '', phone: '', document: '' });
  const [errors, setErrors] = useState({});
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ unit: '', name: '', phone: '', document: '' });
  const [editErrors, setEditErrors] = useState({});

  // Pre-preencher form com dados do OCR quando morador nao encontrado
  useEffect(() => {
    if (ocrPendingResident) {
      setForm({
        unit: ocrPendingResident.unit || '',
        name: ocrPendingResident.name || '',
        phone: ocrPendingResident.phone || '',
        document: '',
      });
      setErrors({});
    }
  }, [ocrPendingResident]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.unit) newErrors.unit = 'Informe a unidade';
    if (!isValidFullName(form.name)) newErrors.name = 'Digite nome e sobrenome';
    if (!isValidPhone11(form.phone)) newErrors.phone = 'Telefone deve ter 11 dígitos';
    if (!form.document) newErrors.document = 'Documento (RG/CPF) é obrigatório';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const phoneDigits = extractDigits(form.phone);
    const accessCode = phoneDigits.slice(-4);
    onAddResident({
      unit: form.unit,
      name: form.name.trim(),
      phone: phoneDigits,
      document: String(form.document).trim(),
      access_code: accessCode
    });

    // Se veio do OCR, notificar e voltar para encomendas
    if (ocrPendingResident && onResidentRegistered) {
      onResidentRegistered({ unit: form.unit, name: form.name.trim(), phone: phoneDigits });
    }

    setForm({ unit: '', name: '', phone: '', document: '' });
    setErrors({});
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setEditForm({
      unit: r.unit || '',
      name: r.name || '',
      phone: formatPhoneMask(r.phone || ''),
      document: r.document || ''
    });
    setEditErrors({});
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ unit: '', name: '', phone: '', document: '' });
    setEditErrors({});
  };
  const saveEdit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!editForm.unit) errs.unit = 'Informe a unidade';
    if (!isValidFullName(editForm.name)) errs.name = 'Digite nome e sobrenome';
    if (!isValidPhone11(editForm.phone)) errs.phone = 'Telefone deve ter 11 dígitos';
    if (!editForm.document) errs.document = 'Documento (RG/CPF) é obrigatório';
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const phoneDigits = extractDigits(editForm.phone);
    const accessCode = phoneDigits.slice(-4);
    onUpdateResident(editId, {
      unit: editForm.unit,
      name: editForm.name.trim(),
      phone: phoneDigits,
      document: String(editForm.document).trim(),
      access_code: accessCode
    });
    cancelEdit();
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <Users className="text-blue-500 dark:text-blue-400" size={20} />
        </div>
        <h2 className="font-semibold text-slate-900 dark:text-white">Gerir Moradores</h2>
      </div>
      <div className="p-6 space-y-6">
        {ocrPendingResident && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Morador não encontrado na base de dados
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Os dados da etiqueta foram preenchidos automaticamente. Complete o cadastro com telefone e documento, depois clique em "Salvar Morador".
              </p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade *</label>
            <input type="text" placeholder="Ex: 104" className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} required />
            {errors.unit && <p className="text-red-600 text-xs mt-1">{errors.unit}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome *</label>
            <input type="text" placeholder="Nome completo (Nome e Sobrenome)" className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">WhatsApp</label>
            <input type="tel" placeholder="(11) 9XXXX-XXXX" className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white" value={form.phone} onChange={e => setForm({ ...form, phone: formatPhoneMask(e.target.value) })} />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Documento (RG/CPF) *</label>
            <input type="text" placeholder="RG ou CPF" className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white" value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} required />
            {errors.document && <p className="text-red-600 text-xs mt-1">{errors.document}</p>}
          </div>
          <div className="md:col-span-4">
            <button className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg shadow-sm">Salvar Morador</button>
          </div>
        </form>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          O PIN de acesso do morador será gerado automaticamente (4 últimos dígitos do celular).
        </div>

        <div className="border-t dark:border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Moradores cadastrados ({residents?.length || 0})</h3>
          {(!residents || residents.length === 0) ? (
            <div className="text-slate-400 dark:text-slate-500 text-sm">Nenhum morador cadastrado.</div>
          ) : (
            <div className="space-y-1">
              {residents.map(r => (
                <div key={r.id}>
                  {editId === r.id ? (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                        <div>
                          <input type="text" placeholder="Unidade" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white text-sm" value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} />
                          {editErrors.unit && <p className="text-red-600 text-xs mt-1">{editErrors.unit}</p>}
                        </div>
                        <div>
                          <input type="text" placeholder="Nome" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white text-sm" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                          {editErrors.name && <p className="text-red-600 text-xs mt-1">{editErrors.name}</p>}
                        </div>
                        <div>
                          <input type="tel" placeholder="Telefone" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white text-sm" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: formatPhoneMask(e.target.value) })} />
                          {editErrors.phone && <p className="text-red-600 text-xs mt-1">{editErrors.phone}</p>}
                        </div>
                        <div>
                          <input type="text" placeholder="Documento" className="w-full px-3 py-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white text-sm" value={editForm.document} onChange={e => setEditForm({ ...editForm, document: e.target.value })} />
                          {editErrors.document && <p className="text-red-600 text-xs mt-1">{editErrors.document}</p>}
                        </div>
                        <div className="md:col-span-4 flex gap-2">
                          <button type="submit" className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Salvar</button>
                          <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium">Cancelar</button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">{r.unit}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{r.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                            {r.phone ? formatPhoneMask(r.phone) : ''}{r.phone && r.document ? ' · ' : ''}{r.document || ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => startEdit(r)} className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors" title="Editar">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                        </button>
                        <button onClick={() => onDeleteResident(r.id)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Excluir">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResidentView({ onBack, initialSlug }) {
  // Passo 1: Identificar o condomínio
  const [condoIdInput, setCondoIdInput] = useState('');
  const [condoData, setCondoData] = useState(null); // { id, name }
  const [condoError, setCondoError] = useState('');
  const [condoLoading, setCondoLoading] = useState(false);

  // Passo 2: Dados do condomínio carregados
  const [localResidents, setLocalResidents] = useState([]);
  const [localPackages, setLocalPackages] = useState([]);

  // Auto-carregar condomínio quando há slug na URL
  useEffect(() => {
    if (!initialSlug) return;
    const loadBySlug = async () => {
      setCondoLoading(true);
      setCondoError('');
      try {
        const { data, error } = await supabase
          .from('condos')
          .select('id, name')
          .eq('slug', initialSlug)
          .single();
        if (error || !data) {
          setCondoError('Condomínio não encontrado. Verifique o link.');
          return;
        }
        setCondoData(data);
        const [resResult, pkgResult] = await Promise.all([
          supabase.from('residents').select('*').eq('condo_id', data.id).order('unit', { ascending: true }),
          supabase.from('packages').select('*').eq('condo_id', data.id).order('created_at', { ascending: false }),
        ]);
        setLocalResidents(resResult.data || []);
        setLocalPackages(pkgResult.data || []);
      } catch {
        setCondoError('Erro ao conectar. Tente novamente.');
      } finally {
        setCondoLoading(false);
      }
    };
    loadBySlug();
  }, [initialSlug]);

  // Passo 3: Autenticação por unidade + PIN
  const [unitInput, setUnitInput] = useState('');
  const [authorizedUnit, setAuthorizedUnit] = useState(null);
  const [pinModalUnit, setPinModalUnit] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showModalFor, setShowModalFor] = useState(null);
  const [collectorName, setCollectorName] = useState('');
  const [collectorDoc, setCollectorDoc] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Index local de moradores por unidade
  const localResidentsIndex = useMemo(() => {
    const idx = {};
    (localResidents || []).forEach(r => {
      if (r && r.unit) idx[String(r.unit).toLowerCase()] = r;
    });
    return idx;
  }, [localResidents]);

  const condoName = condoData?.name || 'CondoTrack';

  // Buscar condomínio pelo ID ou slug
  const handleCondoSubmit = async (e) => {
    e.preventDefault();
    const input = condoIdInput.trim();
    if (!input) { setCondoError('Informe o código do condomínio.'); return; }
    setCondoError('');
    setCondoLoading(true);
    try {
      // Detecta se é UUID ou slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
      const query = supabase.from('condos').select('id, name');
      const { data, error } = await (isUUID ? query.eq('id', input) : query.eq('slug', input.toLowerCase())).single();
      if (error || !data) {
        setCondoError('Condomínio não encontrado. Verifique o código informado.');
        setCondoLoading(false);
        return;
      }
      setCondoData(data);
      // Carregar moradores e encomendas deste condomínio
      const [resResult, pkgResult] = await Promise.all([
        supabase.from('residents').select('*').eq('condo_id', data.id).order('unit', { ascending: true }),
        supabase.from('packages').select('*').eq('condo_id', data.id).order('created_at', { ascending: false }),
      ]);
      setLocalResidents(resResult.data || []);
      setLocalPackages(pkgResult.data || []);
    } catch {
      setCondoError('Erro ao conectar. Tente novamente.');
    } finally {
      setCondoLoading(false);
    }
  };

  const startSearch = () => {
    const key = String(unitInput || '').toLowerCase();
    const res = localResidentsIndex[key];
    if (res) {
      setPinModalUnit(key);
      setPinInput('');
      setPinError('');
      setNotFound(false);
    } else {
      setNotFound(true);
    }
  };
  const submitPin = () => {
    const key = pinModalUnit;
    const res = localResidentsIndex[key];
    const expected = String(res?.access_code || res?.pin || '0000');
    if (extractDigits(pinInput).padStart(4,'0') === extractDigits(expected).padStart(4,'0')) {
      setAuthorizedUnit(key);
      setPinModalUnit(null);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('PIN inválido');
    }
  };
  const logoutUnit = () => {
    setAuthorizedUnit(null);
    setUnitInput('');
    setNotFound(false);
  };

  const myPackages = localPackages.filter(p => authorizedUnit && String(p.unit).toLowerCase().includes(String(authorizedUnit)));

  const confirm = async (pkgId) => {
    if (!collectorName || !collectorDoc) return;
    try {
      const { error } = await supabase
        .from('packages')
        .update({
          status: 'collected',
          collected_at: new Date().toISOString(),
          collected_by: collectorName,
          receiver_doc: collectorDoc
        })
        .eq('id', pkgId);
      if (error) throw error;
      // Atualizar lista local
      setLocalPackages(prev => prev.map(p => p.id === pkgId ? { ...p, status: 'collected', collected_at: new Date().toISOString(), collected_by: collectorName, receiver_doc: collectorDoc } : p));
    } catch (err) {
      console.error(err);
    }
    setShowModalFor(null);
    setCollectorName('');
    setCollectorDoc('');
  };

  return (
    <div className="space-y-6">
      {/* Passo 1: Identificar o condomínio */}
      {!condoData && (
        <div className="min-h-[50vh] flex items-center justify-center py-4">
          <div className="w-full max-w-md">
            {onBack && !initialSlug && (
              <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors">
                <ArrowLeft size={16} /> Voltar
              </button>
            )}
            {/* Loading automático quando vindo de link compartilhado */}
            {initialSlug && condoLoading && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-5 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl mb-3">
                    <User className="text-emerald-500 dark:text-emerald-400" size={24} />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-0.5">Área do Morador</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Consulte suas encomendas</p>
                </div>
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-emerald-500 border-t-transparent mx-auto mb-3"></div>
                  <p className="text-slate-600 dark:text-slate-300 font-medium">Carregando condomínio...</p>
                </div>
              </div>
            )}
            {/* Erro quando slug inválido */}
            {initialSlug && !condoLoading && condoError && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-5 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl mb-3">
                    <User className="text-emerald-500 dark:text-emerald-400" size={24} />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-0.5">Área do Morador</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Consulte suas encomendas</p>
                </div>
                <div className="p-6 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 py-2.5 px-3 rounded-lg">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-medium">{condoError}</span>
                  </div>
                  <button onClick={onBack} className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium">
                    Voltar ao início
                  </button>
                </div>
              </div>
            )}
            {/* Formulário manual (sem slug na URL) */}
            {!initialSlug && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-5 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl mb-3">
                  <User className="text-emerald-500 dark:text-emerald-400" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-0.5">Área do Morador</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Consulte suas encomendas</p>
              </div>
              <div className="p-5 sm:p-6">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Identificar Condomínio</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Informe o código do seu condomínio para acessar</p>
                </div>
                <form onSubmit={handleCondoSubmit} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Código do Condomínio"
                      className="w-full pl-11 pr-4 py-3 text-base border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all bg-slate-50 dark:bg-slate-700 dark:text-white placeholder-slate-400"
                      value={condoIdInput}
                      onChange={e => setCondoIdInput(e.target.value)}
                      disabled={condoLoading}
                    />
                    <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  </div>
                  {condoError && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 py-2.5 px-3 rounded-lg">
                      <AlertTriangle size={16} />
                      <span className="text-sm font-medium">{condoError}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={condoLoading}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {condoLoading ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> Buscando...</>
                    ) : (
                      <><Search size={18} /> Acessar</>
                    )}
                  </button>
                </form>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3 text-center border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  O código do condomínio é fornecido pela administração
                </p>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Passo 2: Digitar unidade */}
      {condoData && !authorizedUnit && (
        <div className="min-h-[50vh] flex items-center justify-center py-4">
          <div className="w-full max-w-md">
            <button onClick={() => { setCondoData(null); setCondoIdInput(''); setCondoError(''); }} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 transition-colors">
              <ArrowLeft size={16} /> Trocar condomínio
            </button>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-5 py-5 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl mb-3">
                  <Package className="text-white" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-0.5">{condoName}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs">Sistema de Gestão de Encomendas</p>
              </div>

              <div className="p-5 sm:p-6">
                <div className="text-center mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white mb-1">Área do Morador</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Digite sua unidade para consultar encomendas</p>
                </div>

                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: 104, 12A"
                      className="w-full pl-11 pr-4 py-3 text-base border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all bg-slate-50 dark:bg-slate-700 dark:text-white placeholder-slate-400"
                      value={unitInput}
                      onChange={e => setUnitInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' ? startSearch() : null}
                    />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                  </div>

                  <button
                    onClick={startSearch}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Search size={18} />
                    Consultar Encomendas
                  </button>

                  {notFound && (
                    <div className="flex items-center justify-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 py-2.5 px-3 rounded-lg">
                      <AlertTriangle size={16} />
                      <span className="text-sm font-medium">Unidade não encontrada.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3 text-center border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Acesso seguro com PIN de 4 dígitos
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {authorizedUnit && (
        <div className="animate-fade-in space-y-4">
          {/* Header do morador logado */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-xl">
                  <Package className="text-emerald-500 dark:text-emerald-400" size={24} />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{condoName || 'CondoTrack'}</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Unidade {authorizedUnit.toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={logoutUnit}
                className="flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors duration-150"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Trocar Unidade</span>
              </button>
            </div>
          </div>

          {/* Título da seção */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Box size={20} className="text-emerald-600" />
              Suas Encomendas
            </h3>
            <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
              {myPackages.filter(p => p.status === 'pending').length} pendente(s)
            </span>
          </div>
          {myPackages.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 sm:p-12 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
                <Package className="text-slate-400" size={32} />
              </div>
              <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Nenhuma encomenda</h4>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Você não possui encomendas pendentes no momento.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {myPackages.map(pkg => (
                <div key={pkg.id} className={`bg-white dark:bg-slate-800 p-5 rounded-lg shadow-sm border-l-4 ${pkg.status === 'collected' ? 'border-green-500' : 'border-emerald-500'} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${pkg.status === 'collected' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'}`}>{pkg.status === 'collected' ? 'Entregue' : 'Aguardando'}</span>
                      <span className="text-xs text-slate-400">{new Date(pkg.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white">{pkg.type} - {pkg.description || 'Sem descrição'}</h4>
                    <p className="text-slate-600 dark:text-slate-400">Para: {pkg.recipient}</p>
                  </div>
                  {pkg.status === 'pending' && (
                    <div>
                      {showModalFor === pkg.id ? (
                        <div className="flex flex-col gap-2 w-full sm:min-w-[240px] animate-fade-in">
                          <input autoFocus type="text" placeholder="Nome de quem retira" className="px-3 py-2 border dark:border-slate-600 rounded text-sm w-full bg-white dark:bg-slate-700 dark:text-white" value={collectorName} onChange={(e) => setCollectorName(e.target.value)} />
                          <input type="text" placeholder="Documento (RG/CPF)" className="px-3 py-2 border dark:border-slate-600 rounded text-sm w-full bg-white dark:bg-slate-700 dark:text-white" value={collectorDoc} onChange={(e) => setCollectorDoc(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={() => confirm(pkg.id)} disabled={!collectorName || !collectorDoc} className="bg-emerald-600 text-white px-3 py-2 rounded text-sm flex-1 hover:bg-emerald-700 disabled:opacity-50">Confirmar</button>
                            <button onClick={() => setShowModalFor(null)} className="bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-2 rounded text-sm hover:bg-slate-300 dark:hover:bg-slate-500">Voltar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowModalFor(pkg.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-medium shadow-sm">Confirmar Retirada</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pinModalUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg w-full max-w-sm overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="border-b border-slate-100 dark:border-slate-700 px-6 py-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl mb-2">
                <Shield className="text-emerald-500 dark:text-emerald-400" size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verificação de Segurança</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Unidade {pinModalUnit.toUpperCase()}</p>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-4">
                Digite o PIN de 4 dígitos para acessar suas encomendas
              </p>

              {/* Input do PIN */}
              <div className="mb-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 dark:text-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition-all"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(extractDigits(e.target.value).slice(0,4))}
                  onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                  autoFocus
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
                  Use os 4 últimos dígitos do seu celular
                </p>
              </div>

              {pinError && (
                <div className="flex items-center justify-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 py-2.5 px-3 rounded-lg mb-4">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">{pinError}</span>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={() => setPinModalUnit(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitPin}
                  className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all"
                >
                  Acessar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg, residentsIndex, compact = false, onClick }) {
  const dateStr = new Date(pkg.created_at).toLocaleDateString('pt-BR');
  const phoneRaw = String(pkg?.phone || '');
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const sendWhatsapp = () => {
    if (!phoneDigits) return;
    const box = String.fromCodePoint(0x1F4E6); // 📦
    const text = encodeURIComponent(`Olá ${pkg.recipient}! Chegou uma encomenda (${pkg.type}) para você na portaria. ${box} Disponível para retirada.`);
    const url = `https://wa.me/55${phoneDigits}?text=${text}`;
    window.open(url, '_blank');
  };
  const notifiedTime = pkg?.notified_at ? new Date(pkg.notified_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;

  // Obtém configuração de cor e ícone baseado no tipo
  const typeConfig = PACKAGE_TYPE_CONFIG[pkg.type] || PACKAGE_TYPE_CONFIG['Outro'];
  const TypeIcon = typeConfig.icon;

  return (
    <div
      className={`bg-white dark:bg-slate-800 ${compact ? 'p-2' : 'p-4'} rounded-xl shadow-sm border-2 border-slate-100 dark:border-slate-700 hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-600 transition-all relative cursor-pointer`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className={`${typeConfig.badge} text-white ${compact ? 'text-[10px]' : 'text-xs'} font-bold px-2.5 py-1 rounded-lg shadow-sm`}>APT {pkg.unit}</div>
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500 dark:text-slate-400 font-medium`}>{dateStr}</span>
      </div>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${typeConfig.bgLight} ${typeConfig.bgDark} shadow-sm`}>
          <TypeIcon size={compact ? 18 : 24} className={`${typeConfig.textLight} ${typeConfig.textDark}`} />
        </div>
        <div className="flex-1">
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-slate-800 dark:text-white`}>{pkg.recipient}</h4>
          <p className={`${compact ? 'text-xs' : 'text-sm'} ${typeConfig.textLight} ${typeConfig.textDark} font-medium`}>{pkg.type} {pkg.description && <span className="text-slate-500 dark:text-slate-400">- {pkg.description}</span>}</p>
          {pkg?.notified_at && (
            <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1 font-medium`}>
              <CheckCheck size={14} /> Avisado por {pkg.notified_by || 'Portaria'} às {notifiedTime}
            </div>
          )}
          {phoneDigits && (
            compact ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); sendWhatsapp(); }} title="WhatsApp" aria-label="WhatsApp" className="inline-flex items-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mt-1">
                <MessageCircle size={16} />
              </button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); sendWhatsapp(); }} className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg text-sm mt-2 font-medium transition-colors">
                <Phone size={14} /> {pkg?.notified_at ? 'Reenviar Aviso' : 'Avisar no WhatsApp'}
              </button>
            )
          )}
        </div>
      </div>
      <div className={`mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5 ${compact ? 'text-[10px]' : 'text-xs'} text-amber-600 dark:text-amber-400 font-semibold`}>
        <Clock size={compact ? 12 : 14} className="text-amber-500" /> Aguardando morador
      </div>
    </div>
  );
}

function TeamManager({ staff, onAddStaff, onDeleteStaff }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'concierge' });
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('Preencha todos os campos.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    onAddStaff({ name: form.name, username: form.email.trim().toLowerCase(), password: form.password, role: form.role });
    setForm({ name: '', email: '', password: '', role: 'concierge' });
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <Shield className="text-blue-500 dark:text-blue-400" size={20} />
        </div>
        <h2 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">Gestão de Equipe</h2>
      </div>
      <div className="p-4 sm:p-6 space-y-6">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
            <input className="w-full px-3 py-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
            <input type="email" placeholder="porteiro@email.com" className="w-full px-3 py-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha</label>
            <input type="password" className="w-full px-3 py-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Função</label>
            <select className="w-full px-3 py-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="concierge">concierge</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="md:col-span-4">
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <button className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg shadow-sm">Adicionar Funcionário</button>
          </div>
        </form>

        <div className="border-t dark:border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Equipe ({staff?.length || 0})</h3>
          {(!staff || staff.length === 0) ? (
            <div className="text-slate-400 dark:text-slate-500 text-sm">Nenhum funcionário.</div>
          ) : (
            <div className="divide-y dark:divide-slate-700">
              {staff.map(s => (
                <div key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-sm min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
                    <span className="hidden sm:inline mx-2 text-slate-400">•</span>
                    <br className="sm:hidden" />
                    <span className="text-slate-600 dark:text-slate-400 break-all">{s.username}</span>
                    <span className="hidden sm:inline mx-2 text-slate-400">•</span>
                    <br className="sm:hidden" />
                    <span className="text-slate-600 dark:text-slate-400">{s.role}</span>
                  </div>
                  <button onClick={() => onDeleteStaff(s.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded text-sm flex-shrink-0 self-start sm:self-auto">Excluir</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================================================================================
// 📊 MÓDULO DE RELATÓRIOS E AUDITORIA
// ==================================================================================
function ReportQueryManager({ packages }) {
  const [filters, setFilters] = useState({
    unit: '',
    recipient: '',
    status: 'todos' // 'todos' | 'pending' | 'collected'
  });
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Função de busca
  const handleSearch = () => {
    let filtered = [...packages];

    // Filtro por unidade
    if (filters.unit.trim()) {
      const unitSearch = filters.unit.toLowerCase().trim();
      filtered = filtered.filter(p =>
        String(p.unit || '').toLowerCase().includes(unitSearch)
      );
    }

    // Filtro por destinatário/nome
    if (filters.recipient.trim()) {
      const recipientSearch = filters.recipient.toLowerCase().trim();
      filtered = filtered.filter(p =>
        String(p.recipient || '').toLowerCase().includes(recipientSearch)
      );
    }

    // Filtro por status
    if (filters.status !== 'todos') {
      filtered = filtered.filter(p => p.status === filters.status);
    }

    // Ordenar por data de criação (mais recente primeiro)
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setResults(filtered);
    setHasSearched(true);
  };

  // Limpar filtros
  const handleClear = () => {
    setFilters({ unit: '', recipient: '', status: 'todos' });
    setResults([]);
    setHasSearched(false);
  };

  // Exportar para CSV
  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = ['Unidade', 'Destinatário', 'Tipo', 'Status', 'Data Chegada', 'Retirado/Excluído por', 'Documento/Data Exclusão', 'Data Retirada'];
    const rows = results.map(p => [
      p.unit || '',
      p.recipient || '',
      p.type || '',
      p.status === 'pending' ? 'Pendente' : p.status === 'deleted' ? 'Excluído' : 'Retirado',
      p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '',
      p.status === 'deleted' ? (p.deleted_by || '') : (p.collected_by || ''),
      p.status === 'deleted' ? (p.deleted_at ? new Date(p.deleted_at).toLocaleString('pt-BR') : '') : (p.receiver_doc || ''),
      p.collected_at ? new Date(p.collected_at).toLocaleString('pt-BR') : ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `condotrack_relatorio_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Exportar para JSON
  const exportToJSON = () => {
    if (results.length === 0) return;

    const exportData = results.map(p => ({
      unidade: p.unit,
      destinatario: p.recipient,
      tipo: p.type,
      status: p.status === 'pending' ? 'Pendente' : p.status === 'deleted' ? 'Excluído' : 'Retirado',
      descricao: p.description || '',
      telefone: p.phone || '',
      data_chegada: p.created_at,
      retirado_por: p.collected_by || null,
      documento_retirada: p.receiver_doc || null,
      data_retirada: p.collected_at || null,
      excluido_por: p.deleted_by || null,
      data_exclusao: p.deleted_at || null,
      notificado_em: p.notified_at || null,
      notificado_por: p.notified_by || null
    }));

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `condotrack_relatorio_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Imprimir / PDF
  const handlePrint = () => {
    if (results.length === 0) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CondoTrack - Relatório de Encomendas</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e293b; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
          .info { color: #64748b; margin-bottom: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
          th { background-color: #1e293b; color: white; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .status-pending { color: #f59e0b; font-weight: bold; }
          .status-collected { color: #10b981; font-weight: bold; }
          .status-deleted { color: #ef4444; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>📦 CondoTrack - Relatório de Encomendas</h1>
        <div class="info">
          <strong>Data do Relatório:</strong> ${new Date().toLocaleString('pt-BR')}<br>
          <strong>Total de Registros:</strong> ${results.length}
        </div>
        <table>
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Destinatário</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Data Chegada</th>
              <th>Retirado/Excluído por</th>
              <th>Documento/Data Exclusão</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(p => `
              <tr>
                <td>${p.unit || '-'}</td>
                <td>${p.recipient || '-'}</td>
                <td>${p.type || '-'}</td>
                <td class="${p.status === 'pending' ? 'status-pending' : p.status === 'deleted' ? 'status-deleted' : 'status-collected'}">
                  ${p.status === 'pending' ? 'Pendente' : p.status === 'deleted' ? 'Excluído' : 'Retirado'}
                </td>
                <td>${p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td>${p.status === 'deleted' ? (p.deleted_by || '-') : (p.collected_by || '-')}</td>
                <td>${p.status === 'deleted' ? (p.deleted_at ? new Date(p.deleted_at).toLocaleString('pt-BR') : '-') : (p.receiver_doc || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          CondoTrack Pro - Sistema de Gestão de Encomendas
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Painel de Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <FileText className="text-blue-500 dark:text-blue-400" size={20} />
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Consulta Histórico de Encomendas</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
              <input
                type="text"
                placeholder="Ex: 104, 201-B"
                className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
                value={filters.unit}
                onChange={e => setFilters(prev => ({ ...prev, unit: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome / Destinatário</label>
              <input
                type="text"
                placeholder="Nome do morador"
                className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
                value={filters.recipient}
                onChange={e => setFilters(prev => ({ ...prev, recipient: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
                value={filters.status}
                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="todos">Todos</option>
                <option value="pending">Pendente</option>
                <option value="collected">Retirado</option>
                <option value="deleted">Excluído</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleSearch}
                className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg shadow-sm flex items-center justify-center gap-2"
              >
                <Filter size={18} /> Buscar
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                title="Limpar filtros"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados */}
      {hasSearched && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Barra de Exportação */}
          <div className="bg-slate-50 dark:bg-slate-700 px-6 py-3 border-b border-slate-100 dark:border-slate-600 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{results.length}</span> registro(s) encontrado(s)
            </div>
            {results.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm"
                  title="Exportar para CSV/Excel"
                >
                  <FileSpreadsheet size={16} /> CSV/Excel
                </button>
                <button
                  onClick={exportToJSON}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm"
                  title="Exportar para JSON"
                >
                  <FileJson size={16} /> JSON
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm"
                  title="Imprimir / PDF"
                >
                  <Printer size={16} /> Imprimir/PDF
                </button>
              </div>
            )}
          </div>

          {/* Tabela de Resultados */}
          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <Search size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhum registro encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            <>
              {/* Desktop: Tabela */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Unidade</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Destinatário</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Data Chegada</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Retirado por</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Documento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {results.map(pkg => (
                      <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{pkg.unit || '-'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{pkg.recipient || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{pkg.type || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            pkg.status === 'pending'
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                              : pkg.status === 'deleted'
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                              : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                          }`}>
                            {pkg.status === 'pending' ? 'Pendente' : pkg.status === 'deleted' ? 'Excluído' : 'Retirado'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {pkg.created_at ? new Date(pkg.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {pkg.status === 'deleted' ? (
                            <span className="text-red-600 dark:text-red-400">{pkg.deleted_by || '-'}</span>
                          ) : (
                            pkg.collected_by || '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {pkg.status === 'deleted' ? (
                            pkg.deleted_at ? new Date(pkg.deleted_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'
                          ) : (
                            pkg.receiver_doc || '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Cards */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700">
                {results.map(pkg => (
                  <div key={pkg.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800 dark:text-slate-200">Apt {pkg.unit || '-'}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        pkg.status === 'pending'
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                          : pkg.status === 'deleted'
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                          : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                      }`}>
                        {pkg.status === 'pending' ? 'Pendente' : pkg.status === 'deleted' ? 'Excluído' : 'Retirado'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{pkg.recipient || '-'}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{pkg.type || '-'}</span>
                      <span>•</span>
                      <span>{pkg.created_at ? new Date(pkg.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span>
                    </div>
                    {(pkg.collected_by || pkg.deleted_by) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {pkg.status === 'deleted' ? (
                          <span className="text-red-600 dark:text-red-400">Excluído por: {pkg.deleted_by || '-'}</span>
                        ) : (
                          <>Retirado por: {pkg.collected_by}</>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Dica inicial */}
      {!hasSearched && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
          <Search size={40} className="mx-auto mb-3 text-blue-400" />
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Consulte o histórico de encomendas</h3>
          <p className="text-blue-600 dark:text-blue-400 text-sm">
            Use os filtros acima para buscar encomendas por unidade, nome ou status.<br />
            Após a busca, você pode exportar os resultados em CSV, JSON ou imprimir.
          </p>
        </div>
      )}
    </div>
  );
}

