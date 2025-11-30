import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, CheckCircle, Clock,
  User, Box, Shield, Trash2, AlertTriangle, X, Phone, LogIn, CheckCheck, Briefcase, LogOut, MessageCircle, Sun, Moon,
  FileText, Download, Printer, Filter, FileSpreadsheet, FileJson, Settings, Building2, Save
} from 'lucide-react';

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

// Log para debug (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  console.log('🔧 CondoTrack Pro - Modo:', IS_PRODUCTION ? 'PRODUÇÃO (Supabase)' : 'DEMO (localStorage)');
}

// ==================================================================================
// 🛠️ MOCK SUPABASE (MODO DEMO - USA localStorage)
// ==================================================================================
const mockSupabase = (() => {
  const keyFor = (table) => `condotrack_${table}`;
  const read = (table) => JSON.parse(localStorage.getItem(keyFor(table)) || '[]');
  const write = (table, data) => localStorage.setItem(keyFor(table), JSON.stringify(data));
  const ensureId = (row) => ({ id: Date.now() + Math.floor(Math.random() * 1000), ...row });

  // Seed staff com admin padrão se vazio
  if (!localStorage.getItem(keyFor('staff'))) {
    const now = new Date().toISOString();
    write('staff', [{
      id: Date.now(),
      name: 'Administrador',
      username: 'admin',
      password: '123',
      role: 'admin',
      created_at: now,
    }]);
  }

  // Seed settings com nome do condomínio padrão se vazio
  if (!localStorage.getItem(keyFor('settings'))) {
    const now = new Date().toISOString();
    write('settings', [{
      id: 1,
      condo_name: 'CondoTrack',
      condo_address: '',
      condo_phone: '',
      created_at: now,
      updated_at: now,
    }]);
  }

  const api = {
    channel: () => ({
      on: () => api,
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
    from: (table) => ({
      select: () => ({
        order: (_col, _opts) => Promise.resolve({ data: read(table), error: null }),
        eq: (field, value) => ({
          single: () => {
            const data = read(table).find(item => item[field] === value);
            return Promise.resolve({ data, error: null });
          }
        })
      }),
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
              : { created_at: now };
          return ensureId({ ...base, ...r });
        });
        write(table, [...current, ...inserted]);
        return Promise.resolve({ data: inserted.length === 1 ? inserted : inserted, error: null });
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
function isValidFullName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2;
}
function isValidPhone11(value) {
  return extractDigits(value).length === 11;
}

export default function CondoTrackApp() {
  const SESSION_KEY = 'condotrack_user';
  const THEME_KEY = 'condotrack_theme';
  const [viewMode, setViewMode] = useState('concierge'); // 'concierge' | 'resident'
  const [isConciergeAuthed, setIsConciergeAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // {id, name, role, username}
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
  const pendingCount = packages.filter(p => p.status === 'pending').length;
  const residentsIndex = useMemo(() => {
    const idx = {};
    (residents || []).forEach(r => {
      if (r && r.unit) idx[String(r.unit).toLowerCase()] = r;
    });
    return idx;
  }, [residents]);

  // Carregar e pseudo-realtime
  useEffect(() => {
    fetchPackages();
    fetchResidents();
    fetchStaff();
    fetchSettings();
    const channel = supabase.channel('packages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => fetchPackages())
      .subscribe();
    const channelResidents = supabase.channel('residents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => fetchResidents())
      .subscribe();
    const channelStaff = supabase.channel('staff_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => fetchStaff())
      .subscribe();
    const interval = setInterval(fetchPackages, 1500);
    const intervalRes = setInterval(fetchResidents, 2000);
    const intervalStaff = setInterval(fetchStaff, 3000);
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channelResidents);
      supabase.removeChannel(channelStaff);
      clearInterval(interval);
      clearInterval(intervalRes);
      clearInterval(intervalStaff);
    };
  }, []);

  // Restaura sessão ao carregar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username) {
          setCurrentUser(parsed);
          setIsConciergeAuthed(true);
        }
      }
    } catch {}
    // Aplica classe dark no HTML ao carregar (tema já foi lido na inicialização do state)
    const root = document.documentElement;
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
  }, []);

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

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      if (data) {
        setCondoSettings(data);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    try {
      const { error } = await supabase
        .from('settings')
        .update({
          condo_name: newSettings.condo_name,
          condo_address: newSettings.condo_address || '',
          condo_phone: newSettings.condo_phone || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);
      if (error) throw error;
      setCondoSettings(prev => ({ ...prev, ...newSettings }));
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

  const handleLogout = () => {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    setIsConciergeAuthed(false);
    setCurrentUser(null);
  };

  // ---------- Ações ----------
  const handleAddPackage = async (formData) => {
    try {
      // cria registro
      const { data, error } = await supabase.from('packages').insert([{
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
      fetchPackages();
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
      fetchPackages();
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
      fetchPackages();
    } catch (err) {
      console.error(err);
      showNotification('Erro ao excluir.', 'error');
    }
  };

  const fetchResidents = async () => {
    try {
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .order('unit', { ascending: true });
      if (error) throw error;
      setResidents(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddResident = async (resident) => {
    try {
      const payload = {
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
      fetchResidents();
    } catch (err) {
      // Fallback: se a coluna 'document' não existir, tenta sem ela
      const message = String(err?.message || '');
      if (message.includes('column') && (message.includes('document') || message.includes('pin') || message.includes('access_code'))) {
        try {
          const { error: err2 } = await supabase
            .from('residents')
            .insert([{
              unit: resident.unit,
              name: resident.name,
              phone: resident.phone || ''
            }]);
          if (err2) throw err2;
          showNotification('Morador cadastrado! (sem documento/access_code)');
          fetchResidents();
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
      fetchResidents();
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
      fetchResidents();
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
          fetchResidents();
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
  const headerBg = isConcierge ? 'bg-slate-900' : 'bg-emerald-900';
  const toggleBg = isConcierge ? 'bg-slate-800' : 'bg-emerald-800';
  const activeBtn = isConcierge ? 'bg-slate-600' : 'bg-emerald-600';
  const activeShadow = 'shadow text-white';
  const inactiveText = isConcierge ? 'text-slate-200 hover:text-white' : 'text-emerald-200 hover:text-white';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-slate-700 dark:text-slate-300">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isConcierge ? 'bg-slate-50' : 'bg-emerald-50'} dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded shadow-lg text-white flex items-center gap-2 animate-bounce-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
          {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          {notification.message}
        </div>
      )}

      {/* Modal de Sessão Encerrada por Inatividade */}
      {showInactivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full mb-4">
              <Clock size={32} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Sessão Encerrada</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Sua sessão foi encerrada por inatividade. Por favor, faça login novamente.</p>
            <button
              onClick={() => setShowInactivityModal(false)}
              className="w-full px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <header className={`${headerBg} text-white shadow-md sticky top-0 z-40`}>
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Linha 1: Logo + Tema + Toggle */}
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img
                src={LOGO_PATH}
                alt="CondoTrack Logo"
                className="h-16 sm:h-20 w-auto flex-shrink-0 -my-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => window.location.reload()}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold flex items-center flex-wrap gap-1">
                  <span>CondoTrack</span>
                  <span className="text-[10px] sm:text-xs font-normal opacity-70">| Gestão de Encomendas</span>
                  {isConcierge && (
                    <span className="inline-flex items-center justify-center text-[10px] font-bold bg-slate-700 text-white px-1.5 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white p-2"
                title="Alternar tema"
                aria-label="Alternar tema"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <div className={`flex ${toggleBg} rounded-lg p-0.5 sm:p-1`}>
                <button
                  onClick={() => setViewMode('concierge')}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${isConcierge ? `${activeBtn} ${activeShadow}` : inactiveText}`}
                >
                  <Shield size={14} /> Portaria
                </button>
                <button
                  onClick={() => setViewMode('resident')}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${!isConcierge ? `${activeBtn} ${activeShadow}` : inactiveText}`}
                >
                  <User size={14} /> Morador
                </button>
              </div>
            </div>
          </div>

          {/* Linha 2: Usuário logado (se houver) */}
          {isConcierge && isConciergeAuthed && currentUser && (
            <div className="mt-3 flex justify-center sm:justify-end">
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                {currentUser.role === 'admin' ? (
                  <Briefcase size={14} className="text-white/90 flex-shrink-0" />
                ) : (
                  <User size={14} className="text-white/90 flex-shrink-0" />
                )}
                <span className="truncate max-w-[150px] sm:max-w-none">
                  {currentUser.name} - {currentUser.role === 'admin' ? 'Admin' : 'Porteiro'}
                </span>
                <button
                  title="Sair"
                  onClick={handleLogout}
                  className="ml-1 inline-flex items-center justify-center rounded hover:bg-white/10 p-1 text-white flex-shrink-0"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {isConcierge ? (
          isConciergeAuthed ? (
            <ConciergeView
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
              onAddStaff={async (member) => {
                try {
                  const { error } = await supabase.from('staff').insert([member]);
                  if (error) throw error;
                  showNotification('Funcionário cadastrado!');
                  fetchStaff();
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
                  fetchStaff();
                } catch (e) {
                  console.error(e);
                  showNotification('Erro ao excluir funcionário.', 'error');
                }
              }}
              condoSettings={condoSettings}
              onUpdateSettings={handleUpdateSettings}
            />
          ) : (
            <ConciergeLogin onSuccess={(user) => { setIsConciergeAuthed(true); setCurrentUser(user); try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch {} }} />
          )
        ) : (
          <ResidentView
            packages={packages}
            onCollect={handleCollectPackage}
            residentsIndex={residentsIndex}
            condoName={condoSettings.condo_name}
          />
        )}
      </main>

      <footer className="text-center text-gray-400 text-xs py-8 space-y-1">
        <p>CondoTrack — Gestão de Encomendas</p>
        <p>
          Desenvolvido por{' '}
          <a
            href="https://playcodeagency.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 hover:text-emerald-400 hover:underline transition-colors"
          >
            PlayCodeAgency
          </a>
        </p>
      </footer>
    </div>
  );
}

// ---------- Subcomponentes ----------
function ConciergeLogin({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Busca usuário específico pelo username (não expõe senha no select)
      const { data, error: err } = await supabase
        .from('staff')
        .select('id, name, role, username, password')
        .eq('username', username)
        .single();

      if (err || !data) {
        setError('Usuário ou senha inválidos.');
        return;
      }

      // Valida senha (em produção, usar hash bcrypt no backend)
      if (String(data.password) !== String(password)) {
        setError('Usuário ou senha inválidos.');
        return;
      }

      // Não passa a senha para o estado
      onSuccess({ id: data.id, name: data.name, role: data.role, username: data.username });
    } catch (ex) {
      console.error(ex);
      setError('Erro ao autenticar.');
    }
  };
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center gap-4 mb-6">
          <img
            src={LOGO_PATH}
            alt="CondoTrack Logo"
            className="h-24 sm:h-32 w-auto"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
          <div className="hidden bg-slate-100 dark:bg-slate-700 p-3 rounded-full">
            <LogIn size={28} className="text-slate-600 dark:text-slate-400" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">Acesso da Portaria</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Entre com suas credenciais</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-3 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Ex: admin" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Digite a senha" />
          </div>
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <button className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg shadow-md transition-colors">Entrar</button>
        </form>
      </div>
    </div>
  );
}

function ConciergeView({ onAdd, packages, onDelete, onCollect, residents, residentsIndex, onAddResident, onDeleteResident, onUpdateResident, currentUser, staff, onAddStaff, onDeleteStaff, condoSettings, onUpdateSettings }) {
  const [tab, setTab] = useState('packages'); // 'packages' | 'residents' | 'team' | 'settings'
  const [form, setForm] = useState({ unit: '', recipient: '', phone: '', type: 'Caixa', description: '' });
  const [filterType, setFilterType] = useState('Todos');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [collectTarget, setCollectTarget] = useState(null); // pkg id
  const [collectName, setCollectName] = useState('');
  const [collectDoc, setCollectDoc] = useState('');
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.unit || !form.recipient) return;
    onAdd(form);
    setForm({ unit: '', recipient: '', phone: '', type: 'Caixa', description: '' });
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
    }
  };
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

  return (
    <div className="space-y-6">
      {/* Modal de Exclusão com confirmação de senha */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Confirmar Exclusão</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Deseja realmente apagar este registro? Esta ação é irreversível.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Digite sua senha para confirmar</label>
              <input
                type="password"
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                value={deleteConfirmPassword}
                onChange={(e) => { setDeleteConfirmPassword(e.target.value); setDeletePasswordError(''); }}
                placeholder="Sua senha"
              />
              {deletePasswordError && <p className="text-red-500 text-sm mt-1">{deletePasswordError}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmPassword(''); setDeletePasswordError(''); }} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium">Cancelar</button>
              <button onClick={confirmDelete} disabled={!deleteConfirmPassword} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium shadow-md disabled:opacity-50">Sim, excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Retirada */}
      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Confirmar Retirada</h3>
              <button
                  title="Excluir encomenda"
                  onClick={() => { setDeleteTarget(collectTarget); setCollectTarget(null); }}
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded"
                >
                  <Trash2 size={18} />
                </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nome de quem retira</label>
                <input
                  autoFocus
                  type="text"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                  value={collectName}
                  onChange={e => setCollectName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Documento (RG/CPF)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                  value={collectDoc}
                  onChange={e => setCollectDoc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setCollectTarget(null); setCollectName(''); setCollectDoc(''); }} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm">Cancelar</button>
              <button
                onClick={() => { if (collectName && collectDoc) { onCollect(collectTarget, collectName, collectDoc); setCollectTarget(null); setCollectName(''); setCollectDoc(''); } }}
                disabled={!collectName || !collectDoc}
                className="px-3 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs dentro da Portaria */}
      <div className="grid grid-cols-3 sm:flex gap-1.5 sm:gap-2 sm:flex-wrap">
        <button
          onClick={() => setTab('packages')}
          className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${tab === 'packages' ? 'bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'}`}
        >
          📦 Encomendas
        </button>
        <button
          onClick={() => setTab('residents')}
          className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${tab === 'residents' ? 'bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'}`}
        >
          👥 Moradores
        </button>
        <button
          onClick={() => setTab('reports')}
          className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${tab === 'reports' ? 'bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'}`}
        >
          📋 Histórico
        </button>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setTab('team')}
            className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${tab === 'team' ? 'bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'}`}
          >
            🏢 Equipe
          </button>
        )}
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setTab('settings')}
            className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center justify-center gap-1 transition-colors ${tab === 'settings' ? 'bg-slate-700 text-white shadow-sm' : 'bg-white dark:bg-gray-800 border dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700'}`}
          >
            <Settings size={12} /> Config
          </button>
        )}
      </div>

      {/* Nome do Condomínio - Centralizado */}
      <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-gray-800 dark:to-gray-700 rounded-lg py-2 sm:py-3 px-3 sm:px-4 text-center border border-slate-200 dark:border-gray-600">
        <div className="flex items-center justify-center gap-2">
          <Building2 className="text-slate-600 dark:text-slate-400 flex-shrink-0" size={16} />
          <span className="text-sm sm:text-lg font-semibold text-slate-700 dark:text-slate-200 truncate">{condoSettings?.condo_name || 'Condomínio'}</span>
        </div>
      </div>

      {tab === 'packages' && (
        <>
          {/* Formulário Encomenda */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-slate-50 dark:bg-gray-700 px-6 py-4 border-b border-slate-100 dark:border-gray-600 flex items-center gap-2">
              <Package className="text-slate-600 dark:text-slate-300" size={20} />
              <h2 className="font-semibold text-slate-900 dark:text-white">Registrar Encomenda</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade *</label>
                  <input type="text" placeholder="Ex: 104-B" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} onBlur={handleUnitBlur} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destinatário *</label>
                  <input type="text" placeholder="Nome" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp</label>
                  <input type="tel" placeholder="(11) 9XXXX-XXXX" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.phone} onChange={handlePhoneChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                  <select className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option>Caixa</option><option>Envelope</option><option>Delivery / Comida</option><option>Outro</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                  <input type="text" placeholder="Opcional" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="md:col-span-2 pt-2">
                  <button type="submit" className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex justify-center items-center gap-2">
                    <CheckCircle size={20} /> Registrar Chegada
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Lista + Filtros */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Clock size={20} className="text-slate-600 dark:text-slate-400" /> Pendentes ({pendingPackages.length})
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto">
                {['Todos', 'Caixa', 'Envelope', 'Delivery / Comida', 'Outro'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${filterType === type ? 'bg-slate-700 text-white border-slate-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    {type}
                    {type !== 'Todos' && countByType(type) > 0 &&
                      <span className="bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 px-1.5 rounded-full text-[10px]">{countByType(type)}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
              {filteredPackages.length === 0 ? (
                <div className="col-span-2 text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500">Sem encomendas pendentes.</div>
              ) : (
                filteredPackages.map(pkg => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    residentsIndex={residentsIndex}
                    compact
                    onClick={() => setCollectTarget(pkg.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Histórico apenas na aba Encomendas */}
          {historyPackages.length > 0 && (
            <div className="mt-8 opacity-75">
              <h3 className="text-lg font-bold text-gray-600 dark:text-gray-300 mb-4">Entregas Recentes</h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700">
                {historyPackages.slice(0, 5).map(pkg => (
                  <div key={pkg.id} className="p-3 flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Apt {pkg.unit} - {pkg.recipient}</span>
                    <div className="flex flex-col text-right">
                      <span className="text-green-600 dark:text-green-400 flex items-center justify-end gap-1"><CheckCircle size={14}/> Entregue</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Retirado por: {pkg.collected_by}
                        {pkg.receiver_doc && <> • Doc: {pkg.receiver_doc}</>}
                        {pkg.collected_at && (
                          <> • Em: {new Date(pkg.collected_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'residents' && (
        <ResidentsManager
          residents={residents}
          onAddResident={onAddResident}
          onDeleteResident={onDeleteResident}
          onUpdateResident={onUpdateResident}
        />
      )}

      {tab === 'reports' && (
        <ReportQueryManager packages={packages} />
      )}

      {tab === 'team' && currentUser?.role === 'admin' && (
        <TeamManager staff={staff} onAddStaff={onAddStaff} onDeleteStaff={onDeleteStaff} />
      )}

      {tab === 'settings' && currentUser?.role === 'admin' && (
        <CondoSettingsManager condoSettings={condoSettings} onUpdateSettings={onUpdateSettings} />
      )}
    </div>
  );
}

// ---------- Componente de Configurações do Condomínio ----------
function CondoSettingsManager({ condoSettings, onUpdateSettings }) {
  const [form, setForm] = useState({
    condo_name: condoSettings?.condo_name || '',
    condo_address: condoSettings?.condo_address || '',
    condo_phone: condoSettings?.condo_phone || ''
  });
  const [saved, setSaved] = useState(false);

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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-slate-50 dark:bg-gray-700 px-6 py-4 border-b border-slate-100 dark:border-gray-600 flex items-center gap-2">
        <Building2 className="text-slate-600 dark:text-slate-300" size={20} />
        <h2 className="font-semibold text-slate-900 dark:text-white">Configurações do Condomínio</h2>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do Condomínio *
            </label>
            <input
              type="text"
              placeholder="Ex: Residencial Solar das Flores"
              className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              value={form.condo_name}
              onChange={(e) => setForm({ ...form, condo_name: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Este nome será exibido no cabeçalho e em todo o sistema.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Endereço
            </label>
            <input
              type="text"
              placeholder="Ex: Rua das Flores, 123 - Centro"
              className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              value={form.condo_address}
              onChange={(e) => setForm({ ...form, condo_address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Telefone da Portaria
            </label>
            <input
              type="tel"
              placeholder="(11) 1234-5678"
              className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
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
    </div>
  );
}

function ResidentsManager({ residents, onAddResident, onDeleteResident, onUpdateResident }) {
  const [form, setForm] = useState({ unit: '', name: '', phone: '', document: '' });
  const [errors, setErrors] = useState({});
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ unit: '', name: '', phone: '', document: '' });
  const [editErrors, setEditErrors] = useState({});
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-slate-50 dark:bg-gray-700 px-6 py-4 border-b border-slate-100 dark:border-gray-600">
        <h2 className="font-semibold text-slate-900 dark:text-white">Gerir Moradores</h2>
      </div>
      <div className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade *</label>
            <input type="text" placeholder="Ex: 104" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} required />
            {errors.unit && <p className="text-red-600 text-xs mt-1">{errors.unit}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
            <input type="text" placeholder="Nome completo (Nome e Sobrenome)" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp</label>
            <input type="tel" placeholder="(11) 9XXXX-XXXX" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.phone} onChange={e => setForm({ ...form, phone: formatPhoneMask(e.target.value) })} />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Documento (RG/CPF) *</label>
            <input type="text" placeholder="RG ou CPF" className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white" value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} required />
            {errors.document && <p className="text-red-600 text-xs mt-1">{errors.document}</p>}
          </div>
          <div className="md:col-span-4">
            <button className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg shadow-sm">Salvar Morador</button>
          </div>
        </form>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          O PIN de acesso do morador será gerado automaticamente (4 últimos dígitos do celular).
        </div>

        <div className="border-t dark:border-gray-700 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Moradores cadastrados ({residents?.length || 0})</h3>
          {(!residents || residents.length === 0) ? (
            <div className="text-gray-400 dark:text-gray-500 text-sm">Nenhum morador cadastrado.</div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {residents.map(r => (
                <div key={r.id} className="py-3">
                  {editId === r.id ? (
                    <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <div>
                        <input type="text" className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} />
                        {editErrors.unit && <p className="text-red-600 text-xs mt-1">{editErrors.unit}</p>}
                      </div>
                      <div>
                        <input type="text" className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                        {editErrors.name && <p className="text-red-600 text-xs mt-1">{editErrors.name}</p>}
                      </div>
                      <div>
                        <input type="tel" className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: formatPhoneMask(e.target.value) })} />
                        {editErrors.phone && <p className="text-red-600 text-xs mt-1">{editErrors.phone}</p>}
                      </div>
                      <div>
                        <input type="text" className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={editForm.document} onChange={e => setEditForm({ ...editForm, document: e.target.value })} />
                        {editErrors.document && <p className="text-red-600 text-xs mt-1">{editErrors.document}</p>}
                      </div>
                      <div className="md:col-span-4 flex gap-2 mt-2">
                        <button type="submit" className="px-3 py-2 rounded bg-slate-700 text-white text-sm">Salvar</button>
                        <button type="button" onClick={cancelEdit} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm">Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium text-gray-800 dark:text-gray-200">Apt {r.unit}</span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-gray-700 dark:text-gray-300">{r.name}</span>
                        {r.phone && <span className="mx-2 text-gray-400">•</span>}
                        {r.phone && <span className="text-gray-600 dark:text-gray-400">{formatPhoneMask(r.phone)}</span>}
                        {r.document && <>
                          <span className="mx-2 text-gray-400">•</span>
                          <span className="text-gray-600 dark:text-gray-400">{r.document}</span>
                        </>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-2 py-1 rounded text-sm">Editar</button>
                        <button onClick={() => onDeleteResident(r.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded text-sm">Excluir</button>
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

function ResidentView({ packages, onCollect, residentsIndex, condoName }) {
  const [unitInput, setUnitInput] = useState('');
  const [authorizedUnit, setAuthorizedUnit] = useState(null);
  const [pinModalUnit, setPinModalUnit] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showModalFor, setShowModalFor] = useState(null);
  const [collectorName, setCollectorName] = useState('');
  const [collectorDoc, setCollectorDoc] = useState('');
  const [notFound, setNotFound] = useState(false);

  const startSearch = () => {
    const key = String(unitInput || '').toLowerCase();
    const res = residentsIndex[key];
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
    const res = residentsIndex[key];
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

  const myPackages = packages.filter(p => authorizedUnit && String(p.unit).toLowerCase().includes(String(authorizedUnit)));

  const confirm = (pkgId) => {
    if (!collectorName || !collectorDoc) return;
    onCollect(pkgId, collectorName, collectorDoc);
    setShowModalFor(null);
    setCollectorName('');
    setCollectorDoc('');
  };

  return (
    <div className="space-y-6">
      {!authorizedUnit && (
        <div className="min-h-[50vh] flex items-center justify-center py-4">
          <div className="w-full max-w-md">
            {/* Card Principal */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Header com gradiente */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-5 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl mb-3">
                  <Package className="text-white" size={24} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-0.5">{condoName || 'CondoTrack'}</h1>
                <p className="text-emerald-100 text-xs">Sistema de Gestão de Encomendas</p>
              </div>

              {/* Conteúdo */}
              <div className="p-5 sm:p-6">
                <div className="text-center mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-1">Área do Morador</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Digite sua unidade para consultar encomendas</p>
                </div>

                {/* Campo de busca */}
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: 104, 12A"
                      className="w-full pl-11 pr-4 py-3 text-base border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all bg-gray-50 dark:bg-gray-700 dark:text-white placeholder-gray-400"
                      value={unitInput}
                      onChange={e => setUnitInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' ? startSearch() : null}
                    />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  </div>

                  <button
                    onClick={startSearch}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
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

              {/* Footer do card */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 text-center border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 dark:text-gray-500">
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
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl shadow-lg p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
                  <Package className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white">{condoName || 'CondoTrack'}</h1>
                  <p className="text-emerald-100 text-sm">Unidade {authorizedUnit.toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={logoutUnit}
                className="flex items-center gap-2 text-sm px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Trocar Unidade</span>
              </button>
            </div>
          </div>

          {/* Título da seção */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Box size={20} className="text-emerald-600" />
              Suas Encomendas
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              {myPackages.filter(p => p.status === 'pending').length} pendente(s)
            </span>
          </div>
          {myPackages.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-8 sm:p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <Package className="text-gray-400" size={32} />
              </div>
              <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Nenhuma encomenda</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Você não possui encomendas pendentes no momento.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {myPackages.map(pkg => (
                <div key={pkg.id} className={`bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border-l-4 ${pkg.status === 'collected' ? 'border-green-500' : 'border-emerald-500'} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${pkg.status === 'collected' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'}`}>{pkg.status === 'collected' ? 'Entregue' : 'Aguardando'}</span>
                      <span className="text-xs text-gray-400">{new Date(pkg.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white">{pkg.type} - {pkg.description || 'Sem descrição'}</h4>
                    <p className="text-gray-600 dark:text-gray-400">Para: {pkg.recipient}</p>
                  </div>
                  {pkg.status === 'pending' && (
                    <div>
                      {showModalFor === pkg.id ? (
                        <div className="flex flex-col gap-2 min-w-[240px] animate-fade-in">
                          <input autoFocus type="text" placeholder="Nome de quem retira" className="px-3 py-2 border dark:border-gray-600 rounded text-sm w-full bg-white dark:bg-gray-700 dark:text-white" value={collectorName} onChange={(e) => setCollectorName(e.target.value)} />
                          <input type="text" placeholder="Documento (RG/CPF)" className="px-3 py-2 border dark:border-gray-600 rounded text-sm w-full bg-white dark:bg-gray-700 dark:text-white" value={collectorDoc} onChange={(e) => setCollectorDoc(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={() => confirm(pkg.id)} disabled={!collectorName || !collectorDoc} className="bg-emerald-600 text-white px-3 py-2 rounded text-sm flex-1 hover:bg-emerald-700 disabled:opacity-50">Confirmar</button>
                            <button onClick={() => setShowModalFor(null)} className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-500">Voltar</button>
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl mb-2">
                <Shield className="text-white" size={24} />
              </div>
              <h3 className="text-lg font-bold text-white">Verificação de Segurança</h3>
              <p className="text-emerald-100 text-sm">Unidade {pinModalUnit.toUpperCase()}</p>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
                Digite o PIN de 4 dígitos para acessar suas encomendas
              </p>

              {/* Input do PIN */}
              <div className="mb-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(extractDigits(e.target.value).slice(0,4))}
                  onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                  autoFocus
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
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
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitPin}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-medium shadow-lg shadow-emerald-500/30 transition-all"
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

  return (
    <div
      className={`bg-white dark:bg-gray-800 ${compact ? 'p-2' : 'p-4'} rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow relative cursor-pointer`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className={`bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 ${compact ? 'text-[10px]' : 'text-xs'} font-bold px-2 py-1 rounded`}>APT {pkg.unit}</div>
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-400`}>{dateStr}</span>
      </div>
      <div className="flex items-start gap-2">
        <div className={`p-1.5 rounded-full ${pkg.type === 'Delivery / Comida' ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
          <Box size={compact ? 18 : 24} className={pkg.type === 'Delivery / Comida' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'} />
        </div>
        <div className="flex-1">
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-gray-800 dark:text-white`}>{pkg.recipient}</h4>
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400`}>{pkg.type} {pkg.description && `- ${pkg.description}`}</p>
          {pkg?.notified_at && (
            <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1`}>
              <CheckCheck size={14} /> Avisado por {pkg.notified_by || 'Portaria'} às {notifiedTime}
            </div>
          )}
          {phoneDigits && (
            compact ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); sendWhatsapp(); }} title="WhatsApp" aria-label="WhatsApp" className="inline-flex items-center text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 mt-1">
                <MessageCircle size={16} />
              </button>
            ) : (
              <button type="button" onClick={(e) => { e.stopPropagation(); sendWhatsapp(); }} className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm mt-1">
                <Phone size={14} /> {pkg?.notified_at ? 'Reenviar Aviso' : 'Avisar no WhatsApp'}
              </button>
            )
          )}
        </div>
      </div>
      <div className={`mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'} text-slate-600 dark:text-slate-400 font-medium`}>
        <Clock size={compact ? 12 : 14} /> Aguardando morador
      </div>
    </div>
  );
}

function TeamManager({ staff, onAddStaff, onDeleteStaff }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'concierge' });
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.username || !form.password) {
      setError('Preencha todos os campos.');
      return;
    }
    onAddStaff({ ...form });
    setForm({ name: '', username: '', password: '', role: 'concierge' });
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-slate-50 dark:bg-gray-700 px-6 py-4 border-b border-slate-100 dark:border-gray-600">
        <h2 className="font-semibold text-slate-900 dark:text-white">Gestão de Equipe</h2>
      </div>
      <div className="p-6 space-y-6">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
            <input className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
            <input type="password" className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Função</label>
            <select className="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="concierge">concierge</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="md:col-span-4">
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <button className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg shadow-sm">Adicionar Funcionário</button>
          </div>
        </form>

        <div className="border-t dark:border-gray-700 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Equipe ({staff?.length || 0})</h3>
          {(!staff || staff.length === 0) ? (
            <div className="text-gray-400 dark:text-gray-500 text-sm">Nenhum funcionário.</div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {staff.map(s => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{s.name}</span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="text-gray-600 dark:text-gray-400">@{s.username}</span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="text-gray-600 dark:text-gray-400">{s.role}</span>
                  </div>
                  <button onClick={() => onDeleteStaff(s.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded text-sm">Excluir</button>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-gray-700 px-6 py-4 border-b border-slate-100 dark:border-gray-600 flex items-center gap-2">
          <FileText className="text-slate-600 dark:text-slate-300" size={20} />
          <h2 className="font-semibold text-slate-900 dark:text-white">Consulta Histórico de Encomendas</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade</label>
              <input
                type="text"
                placeholder="Ex: 104, 201-B"
                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                value={filters.unit}
                onChange={e => setFilters(prev => ({ ...prev, unit: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome / Destinatário</label>
              <input
                type="text"
                placeholder="Nome do morador"
                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
                value={filters.recipient}
                onChange={e => setFilters(prev => ({ ...prev, recipient: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
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
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Barra de Exportação */}
          <div className="bg-slate-50 dark:bg-gray-700 px-6 py-3 border-b border-slate-100 dark:border-gray-600 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-semibold">{results.length}</span> registro(s) encontrado(s)
            </div>
            {results.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm"
                  title="Exportar para CSV/Excel"
                >
                  <FileSpreadsheet size={16} /> CSV/Excel
                </button>
                <button
                  onClick={exportToJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm"
                  title="Exportar para JSON"
                >
                  <FileJson size={16} /> JSON
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm"
                  title="Imprimir / PDF"
                >
                  <Printer size={16} /> Imprimir/PDF
                </button>
              </div>
            )}
          </div>

          {/* Tabela de Resultados */}
          <div className="overflow-x-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search size={48} className="mx-auto mb-3 opacity-30" />
                <p>Nenhum registro encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-gray-700">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Unidade</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Destinatário</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Data Chegada</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Retirado por</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Documento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {results.map(pkg => (
                    <tr key={pkg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{pkg.unit || '-'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{pkg.recipient || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pkg.type || '-'}</td>
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
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {pkg.created_at ? new Date(pkg.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {pkg.status === 'deleted' ? (
                          <span className="text-red-600 dark:text-red-400">{pkg.deleted_by || '-'}</span>
                        ) : (
                          pkg.collected_by || '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
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
            )}
          </div>
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

