import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Search, CheckCircle, Clock,
  User, Box, Shield, Trash2, AlertTriangle, X, Phone, LogIn
} from 'lucide-react';

// ==================================================================================
// ⚠️ CÓDIGO REAL DO SUPABASE (USADO SE EXISTIREM VARIÁVEIS DE AMBIENTE)
// ==================================================================================
import { createClient } from '@supabase/supabase-js';

// ==================================================================================
// 🛠️ MOCK SUPABASE (TESTE IMEDIATO NO NAVEGADOR) - USA localStorage
// ==================================================================================
const mockSupabase = (() => {
  const STORAGE_KEY = 'mock_packages';
  const read = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const write = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const ensureId = (row) => ({ id: Date.now() + Math.floor(Math.random() * 1000), ...row });

  const api = {
    channel: () => ({
      on: () => api, // encadeia
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
    from: () => ({
      select: () => ({
        order: (_col, _opts) => Promise.resolve({ data: read(), error: null })
      }),
      insert: (rows) => {
        const now = new Date().toISOString();
        const current = read();
        const inserted = rows.map(r => ensureId({
          status: 'pending',
          created_at: now,
          collected_at: null,
          collected_by: null,
          receiver_doc: null,
          ...r,
        }));
        write([...current, ...inserted]);
        return Promise.resolve({ data: null, error: null });
      },
      update: (partial) => ({
        eq: (field, value) => {
          const current = read();
          const updated = current.map(item => item[field] === value ? { ...item, ...partial } : item);
          write(updated);
          return Promise.resolve({ data: null, error: null });
        }
      }),
      delete: () => ({
        eq: (field, value) => {
          const current = read();
          write(current.filter(item => item[field] !== value));
          return Promise.resolve({ data: null, error: null });
        }
      })
    })
  };
  return api;
})();

// Seleciona Supabase real (se env existir) ou mock
const ENV_URL = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const ENV_KEY = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;
const supabase = (ENV_URL && ENV_KEY) ? createClient(ENV_URL, ENV_KEY) : mockSupabase;

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
  const [viewMode, setViewMode] = useState('concierge'); // 'concierge' | 'resident'
  const [isConciergeAuthed, setIsConciergeAuthed] = useState(false);
  const [packages, setPackages] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
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
    const channel = supabase.channel('packages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => fetchPackages())
      .subscribe();
    const channelResidents = supabase.channel('residents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'residents' }, () => fetchResidents())
      .subscribe();
    const interval = setInterval(fetchPackages, 1500);
    const intervalRes = setInterval(fetchResidents, 2000);
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channelResidents);
      clearInterval(interval);
      clearInterval(intervalRes);
    };
  }, []);

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

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 2500);
  };

  // ---------- Ações ----------
  const handleAddPackage = async (formData) => {
    try {
      const { error } = await supabase.from('packages').insert([{
        unit: formData.unit,
        recipient: formData.recipient,
        phone: formData.phone || '',
        type: formData.type,
        description: formData.description || '',
        status: 'pending'
      }]);
      if (error) throw error;
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

  const handleDeletePackage = async (pkgId) => {
    try {
      const { error } = await supabase.from('packages').delete().eq('id', pkgId);
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
        document: resident.document || null
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
      if (message.includes('column') && message.includes('document')) {
        try {
          const { error: err2 } = await supabase
            .from('residents')
            .insert([{
              unit: resident.unit,
              name: resident.name,
              phone: resident.phone || ''
            }]);
          if (err2) throw err2;
          showNotification('Morador cadastrado! (sem documento)');
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
      const { error } = await supabase
        .from('residents')
        .update(payload)
        .eq('id', residentId);
      if (error) throw error;
      showNotification('Morador atualizado!');
      fetchResidents();
    } catch (err) {
      const message = String(err?.message || '');
      if (message.includes('column') && message.includes('document')) {
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
          showNotification('Morador atualizado! (sem documento)');
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-700">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isConcierge ? 'bg-slate-50' : 'bg-emerald-50'} font-sans text-gray-800`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded shadow-lg text-white flex items-center gap-2 animate-bounce-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
          {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          {notification.message}
        </div>
      )}

      <header className={`${headerBg} text-white shadow-md`}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`${isConcierge ? 'bg-slate-500' : 'bg-emerald-500'} p-2 rounded-lg`}>
              <Box size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                CondoTrack <span className="text-xs font-normal opacity-70 block sm:inline">| Gestão de Encomendas</span>
                {isConcierge && (
                  <span className="ml-2 inline-flex items-center justify-center text-[10px] font-bold bg-slate-700 text-white px-2 py-0.5 rounded-full align-middle">
                    {pendingCount}
                  </span>
                )}
              </h1>
            </div>
          </div>
          <div className={`flex ${toggleBg} rounded-lg p-1`}>
            <button
              onClick={() => setViewMode('concierge')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${isConcierge ? `${activeBtn} ${activeShadow}` : inactiveText}`}
            >
              <Shield size={16} /> Portaria
            </button>
            <button
              onClick={() => setViewMode('resident')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${!isConcierge ? `${activeBtn} ${activeShadow}` : inactiveText}`}
            >
              <User size={16} /> Morador
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {isConcierge ? (
          isConciergeAuthed ? (
            <ConciergeView
              onAdd={handleAddPackage}
              packages={packages}
              onDelete={handleDeletePackage}
              residents={residents}
              residentsIndex={residentsIndex}
              onAddResident={handleAddResident}
              onDeleteResident={handleDeleteResident}
              onUpdateResident={handleUpdateResident}
            />
          ) : (
            <ConciergeLogin onSuccess={() => setIsConciergeAuthed(true)} />
          )
        ) : (
          <ResidentView
            packages={packages}
            onCollect={handleCollectPackage}
          />
        )}
      </main>

      <footer className="text-center text-gray-400 text-xs py-8">
        <p>CondoTrack — Integração Supabase</p>
      </footer>
    </div>
  );
}

// ---------- Subcomponentes ----------
function ConciergeLogin({ onSuccess }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');
  const onSubmit = (e) => {
    e.preventDefault();
    if (pwd === 'admin123') {
      setError('');
      onSuccess();
    } else {
      setError('Senha incorreta.');
    }
  };
  return (
    <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <LogIn size={20} className="text-slate-600" />
        <h2 className="font-semibold text-slate-800">Acesso da Portaria</h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Senha</label>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            placeholder="Digite a senha"
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg shadow-sm">Entrar</button>
      </form>
    </div>
  );
}

function ConciergeView({ onAdd, packages, onDelete, residents, residentsIndex, onAddResident, onDeleteResident, onUpdateResident }) {
  const [tab, setTab] = useState('packages'); // 'packages' | 'residents'
  const [form, setForm] = useState({ unit: '', recipient: '', phone: '', type: 'Caixa', description: '' });
  const [filterType, setFilterType] = useState('Todos');
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const confirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const pendingPackages = packages.filter(p => p.status === 'pending');
  const filteredPackages = filterType === 'Todos'
    ? pendingPackages
    : pendingPackages.filter(p => p.type === filterType);
  const countByType = (type) => pendingPackages.filter(p => p.type === type).length;
  const historyPackages = packages.filter(p => p.status === 'collected');

  return (
    <div className="space-y-6">
      {/* Modal de Exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Confirmar Exclusão</h3>
            </div>
            <p className="text-gray-600 mb-6">Deseja realmente apagar este registro? Esta ação é irreversível.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium shadow-md">Sim, excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs dentro da Portaria */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('packages')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === 'packages' ? 'bg-slate-700 text-white' : 'bg-white border text-slate-600'}`}
        >
          Encomendas
        </button>
        <button
          onClick={() => setTab('residents')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === 'residents' ? 'bg-slate-700 text-white' : 'bg-white border text-slate-600'}`}
        >
          Gerir Moradores
        </button>
      </div>

      {tab === 'packages' ? (
        <>
          {/* Formulário Encomenda */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Package className="text-slate-600" size={20} />
              <h2 className="font-semibold text-slate-900">Registrar Encomenda</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
                  <input type="text" placeholder="Ex: 104-B" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} onBlur={handleUnitBlur} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destinatário *</label>
                  <input type="text" placeholder="Nome" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input type="tel" placeholder="(11) 9XXXX-XXXX" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.phone} onChange={handlePhoneChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option>Caixa</option><option>Envelope</option><option>Delivery / Comida</option><option>Outro</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <input type="text" placeholder="Opcional" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock size={20} className="text-slate-600" /> Pendentes ({pendingPackages.length})
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto">
                {['Todos', 'Caixa', 'Envelope', 'Delivery / Comida', 'Outro'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${filterType === type ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  >
                    {type}
                    {type !== 'Todos' && countByType(type) > 0 &&
                      <span className="bg-slate-100 text-slate-700 px-1.5 rounded-full text-[10px]">{countByType(type)}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredPackages.length === 0 ? (
                <div className="col-span-2 text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">Sem encomendas pendentes.</div>
              ) : (
                filteredPackages.map(pkg => (
                  <PackageCard key={pkg.id} pkg={pkg} onDelete={() => setDeleteTarget(pkg.id)} residentsIndex={residentsIndex} />
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <ResidentsManager
          residents={residents}
          onAddResident={onAddResident}
          onDeleteResident={onDeleteResident}
          onUpdateResident={onUpdateResident}
        />
      )}

      {/* Histórico */}
      {historyPackages.length > 0 && (
        <div className="mt-8 opacity-75">
          <h3 className="text-lg font-bold text-gray-600 mb-4">Entregas Recentes</h3>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
            {historyPackages.slice(0, 5).map(pkg => (
              <div key={pkg.id} className="p-3 flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Apt {pkg.unit} - {pkg.recipient}</span>
                <div className="flex flex-col text-right">
                  <span className="text-green-600 flex items-center justify-end gap-1"><CheckCircle size={14}/> Entregue</span>
                  <span className="text-xs text-gray-400">Retirado por: {pkg.collected_by} • Doc: {pkg.receiver_doc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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

    onAddResident({
      unit: form.unit,
      name: form.name.trim(),
      phone: extractDigits(form.phone),
      document: String(form.document).trim()
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

    onUpdateResident(editId, {
      unit: editForm.unit,
      name: editForm.name.trim(),
      phone: extractDigits(editForm.phone),
      document: String(editForm.document).trim()
    });
    cancelEdit();
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">Gerir Moradores</h2>
      </div>
      <div className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
            <input type="text" placeholder="Ex: 104" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} required />
            {errors.unit && <p className="text-red-600 text-xs mt-1">{errors.unit}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input type="text" placeholder="Nome completo (Nome e Sobrenome)" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input type="tel" placeholder="(11) 9XXXX-XXXX" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.phone} onChange={e => setForm({ ...form, phone: formatPhoneMask(e.target.value) })} />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Documento (RG/CPF) *</label>
            <input type="text" placeholder="RG ou CPF" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} required />
            {errors.document && <p className="text-red-600 text-xs mt-1">{errors.document}</p>}
          </div>
          <div className="md:col-span-4">
            <button className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg shadow-sm">Salvar Morador</button>
          </div>
        </form>

        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Moradores cadastrados ({residents?.length || 0})</h3>
          {(!residents || residents.length === 0) ? (
            <div className="text-gray-400 text-sm">Nenhum morador cadastrado.</div>
          ) : (
            <div className="divide-y">
              {residents.map(r => (
                <div key={r.id} className="py-3">
                  {editId === r.id ? (
                    <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <div>
                        <input type="text" className="w-full px-3 py-2 border rounded" value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} />
                        {editErrors.unit && <p className="text-red-600 text-xs mt-1">{editErrors.unit}</p>}
                      </div>
                      <div>
                        <input type="text" className="w-full px-3 py-2 border rounded" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                        {editErrors.name && <p className="text-red-600 text-xs mt-1">{editErrors.name}</p>}
                      </div>
                      <div>
                        <input type="tel" className="w-full px-3 py-2 border rounded" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: formatPhoneMask(e.target.value) })} />
                        {editErrors.phone && <p className="text-red-600 text-xs mt-1">{editErrors.phone}</p>}
                      </div>
                      <div>
                        <input type="text" className="w-full px-3 py-2 border rounded" value={editForm.document} onChange={e => setEditForm({ ...editForm, document: e.target.value })} />
                        {editErrors.document && <p className="text-red-600 text-xs mt-1">{editErrors.document}</p>}
                      </div>
                      <div className="md:col-span-4 flex gap-2 mt-2">
                        <button type="submit" className="px-3 py-2 rounded bg-slate-700 text-white text-sm">Salvar</button>
                        <button type="button" onClick={cancelEdit} className="px-3 py-2 rounded bg-gray-200 text-gray-800 text-sm">Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium text-gray-800">Apt {r.unit}</span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-gray-700">{r.name}</span>
                        {r.phone && <span className="mx-2 text-gray-400">•</span>}
                        {r.phone && <span className="text-gray-600">{formatPhoneMask(r.phone)}</span>}
                        {r.document && <>
                          <span className="mx-2 text-gray-400">•</span>
                          <span className="text-gray-600">{r.document}</span>
                        </>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="text-slate-700 hover:bg-slate-50 px-2 py-1 rounded text-sm">Editar</button>
                        <button onClick={() => onDeleteResident(r.id)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-sm">Excluir</button>
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

function ResidentView({ packages, onCollect }) {
  const [searchUnit, setSearchUnit] = useState('');
  const [showModalFor, setShowModalFor] = useState(null);
  const [collectorName, setCollectorName] = useState('');
  const [collectorDoc, setCollectorDoc] = useState('');

  const myPackages = packages.filter(p => searchUnit && p.unit.toLowerCase().includes(searchUnit.toLowerCase()));

  const confirm = (pkgId) => {
    if (!collectorName || !collectorDoc) return;
    onCollect(pkgId, collectorName, collectorDoc);
    setShowModalFor(null);
    setCollectorName('');
    setCollectorDoc('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Área do Morador</h2>
        <p className="text-gray-500 mb-6">Verifique se há correspondências para sua unidade.</p>
        <div className="max-w-md mx-auto relative">
          <input type="text" placeholder="Digite sua unidade (Ex: 104)" className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-full focus:border-emerald-500 outline-none transition-colors" value={searchUnit} onChange={e => setSearchUnit(e.target.value)} />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
        </div>
      </div>

      {searchUnit && (
        <div className="animate-fade-in">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Resultados para "{searchUnit}"</h3>
          {myPackages.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-sm text-center text-gray-500">Nada consta para esta unidade.</div>
          ) : (
            <div className="grid gap-4">
              {myPackages.map(pkg => (
                <div key={pkg.id} className={`bg-white p-5 rounded-lg shadow-sm border-l-4 ${pkg.status === 'collected' ? 'border-green-500' : 'border-emerald-500'} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${pkg.status === 'collected' ? 'bg-green-100 text-green-700' : 'bg-emerald-100 text-emerald-700'}`}>{pkg.status === 'collected' ? 'Entregue' : 'Aguardando'}</span>
                      <span className="text-xs text-gray-400">{new Date(pkg.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-800">{pkg.type} - {pkg.description || 'Sem descrição'}</h4>
                    <p className="text-gray-600">Para: {pkg.recipient}</p>
                  </div>
                  {pkg.status === 'pending' && (
                    <div>
                      {showModalFor === pkg.id ? (
                        <div className="flex flex-col gap-2 min-w-[240px] animate-fade-in">
                          <input autoFocus type="text" placeholder="Nome de quem retira" className="px-3 py-2 border rounded text-sm w-full" value={collectorName} onChange={(e) => setCollectorName(e.target.value)} />
                          <input type="text" placeholder="Documento (RG/CPF)" className="px-3 py-2 border rounded text-sm w-full" value={collectorDoc} onChange={(e) => setCollectorDoc(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={() => confirm(pkg.id)} disabled={!collectorName || !collectorDoc} className="bg-emerald-600 text-white px-3 py-2 rounded text-sm flex-1 hover:bg-emerald-700 disabled:opacity-50">Confirmar</button>
                            <button onClick={() => setShowModalFor(null)} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">Voltar</button>
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
    </div>
  );
}

function PackageCard({ pkg, onDelete, residentsIndex }) {
  const dateStr = new Date(pkg.created_at).toLocaleDateString('pt-BR');
  const residentByUnit = residentsIndex && pkg?.unit ? residentsIndex[String(pkg.unit).toLowerCase()] : undefined;
  const phoneRaw = (pkg?.phone ?? residentByUnit?.phone ?? '');
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  const msg = encodeURIComponent(`Olá ${pkg.recipient}, chegou uma encomenda para o apt ${pkg.unit} na portaria. (CondoTrack)`);
  const waLink = phoneDigits ? `https://wa.me/55${phoneDigits}?text=${msg}` : null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative group">
      <button onClick={onDelete} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100" title="Excluir"><Trash2 size={16} /></button>
      <div className="flex justify-between items-start mb-2">
        <div className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-1 rounded">APT {pkg.unit}</div>
        <span className="text-xs text-gray-400">{dateStr}</span>
      </div>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${pkg.type === 'Delivery / Comida' ? 'bg-emerald-100' : 'bg-gray-100'}`}>
          <Box size={24} className={pkg.type === 'Delivery / Comida' ? 'text-emerald-600' : 'text-gray-600'} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800">{pkg.recipient}</h4>
          <p className="text-sm text-gray-600">{pkg.type} {pkg.description && `- ${pkg.description}`}</p>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 text-sm mt-1">
              <Phone size={14} /> Avisar no WhatsApp
            </a>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-slate-600 font-medium">
        <Clock size={14} /> Aguardando morador
      </div>
    </div>
  );
}


