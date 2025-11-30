import React, { useState, useEffect } from 'react';
import { 
  Package, Search, CheckCircle, Clock, 
  User, Box, Shield, Trash2, Filter, AlertTriangle, X 
} from 'lucide-react';

// ==================================================================================
// ⚠️ INSTRUÇÕES PARA O SEU PROJETO REAL (VS CODE / LOCALHOST)
// ==================================================================================
// 1. Instale as dependências: npm install @supabase/supabase-js lucide-react
// 2. Descomente as linhas de importação e configuração abaixo.
// 3. Remova ou comente o bloco "MOCK SUPABASE (PARA PREVIEW)" mais abaixo.

/* import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'SUA_URL_SUPABASE_AQUI';
const SUPABASE_KEY = 'SUA_KEY_ANON_AQUI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
*/

// ==================================================================================
// 🛠️ MOCK SUPABASE (PARA PREVIEW NO NAVEGADOR - NÃO COPIE ESTA PARTE PARA PRODUÇÃO)
// ==================================================================================
// Esta implementação falsa permite que o app funcione aqui no chat usando o LocalStorage.
const mockSupabase = {
  channel: () => ({
    on: () => ({ subscribe: () => {} }),
    unsubscribe: () => {}
  }),
  removeChannel: () => {},
  from: (table) => {
    const getStorage = () => JSON.parse(localStorage.getItem('mock_packages') || '[]');
    const setStorage = (data) => localStorage.setItem('mock_packages', JSON.stringify(data));
    
    return {
      select: () => ({
        order: () => Promise.resolve({ data: getStorage(), error: null })
      }),
      insert: (rows) => {
        const current = getStorage();
        const newItems = rows.map(r => ({ ...r, id: Date.now(), created_at: new Date().toISOString() }));
        setStorage([...current, ...newItems]);
        return Promise.resolve({ error: null });
      },
      update: (data) => ({
        eq: (field, value) => {
          const current = getStorage();
          const updated = current.map(item => item[field] === value ? { ...item, ...data } : item);
          setStorage(updated);
          return Promise.resolve({ error: null });
        }
      }),
      delete: () => ({
        eq: (field, value) => {
          const current = getStorage();
          const filtered = current.filter(item => item[field] !== value);
          setStorage(filtered);
          return Promise.resolve({ error: null });
        }
      })
    };
  }
};

// Em produção, use a variável real 'supabase' criada com createClient
const supabase = mockSupabase; 

// ==================================================================================
// 🚀 APLICAÇÃO (CÓDIGO COMPATÍVEL COM AMBOS)
// ==================================================================================

export default function SupabaseApp() {
  const [viewMode, setViewMode] = useState('concierge');
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Carregar dados e configurar Realtime
  useEffect(() => {
    fetchPackages();

    // Configuração do Realtime do Supabase
    const channel = supabase
      .channel('packages_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packages' },
        (payload) => {
          fetchPackages();
        }
      )
      .subscribe();

    // Polling simples para o Mock funcionar dinamicamente sem refresh
    const interval = setInterval(fetchPackages, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
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
    } catch (error) {
      console.error('Erro ao buscar:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Ações ---

  const handleAddPackage = async (formData) => {
    try {
      const { error } = await supabase
        .from('packages')
        .insert([{
          unit: formData.unit,
          recipient: formData.recipient,
          type: formData.type,
          description: formData.description,
          status: 'pending'
        }]);

      if (error) throw error;
      showNotification('Encomenda registada com sucesso!');
      fetchPackages(); // Atualização manual para garantir UI sync
    } catch (error) {
      console.error(error);
      showNotification('Erro ao salvar.', 'error');
    }
  };

  const handleCollectPackage = async (pkgId, receiverName) => {
    try {
      const { error } = await supabase
        .from('packages')
        .update({ 
          status: 'collected',
          collected_at: new Date().toISOString(),
          collected_by: receiverName
        })
        .eq('id', pkgId);

      if (error) throw error;
      showNotification('Entrega confirmada!');
      fetchPackages();
    } catch (error) {
      console.error(error);
      showNotification('Erro ao confirmar.', 'error');
    }
  };

  const handleDeletePackage = async (pkgId) => {
    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('id', pkgId);

      if (error) throw error;
      showNotification('Registo excluído.');
      fetchPackages();
    } catch (error) {
      console.error(error);
      showNotification('Erro ao excluir.', 'error');
    }
  };

  // --- Renderização ---
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-emerald-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded shadow-lg text-white flex items-center gap-2 animate-bounce-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
          {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-emerald-900 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-2 rounded-lg"><Box size={24} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-bold">CondoTrack <span className="text-xs font-normal opacity-70 block sm:inline"> | Supabase Edition</span></h1>
            </div>
          </div>
          <div className="flex bg-emerald-800 rounded-lg p-1">
            <button onClick={() => setViewMode('concierge')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'concierge' ? 'bg-emerald-600 shadow text-white' : 'text-emerald-200 hover:text-white'}`}>
                <Shield size={16} /> Portaria
            </button>
            <button onClick={() => setViewMode('resident')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'resident' ? 'bg-emerald-600 shadow text-white' : 'text-emerald-200 hover:text-white'}`}>
                <User size={16} /> Morador
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {viewMode === 'concierge' ? (
          <ConciergeView onAdd={handleAddPackage} packages={packages} onDelete={handleDeletePackage} />
        ) : (
          <ResidentView packages={packages} onCollect={handleCollectPackage} />
        )}
      </main>
      
      <footer className="text-center text-gray-400 text-xs py-8">
          <p>Sistema de Demonstração - Integração Supabase</p>
      </footer>
    </div>
  );
}

// --- Sub-Componentes (Com melhorias de UI) ---

function ConciergeView({ onAdd, packages, onDelete }) {
  const [form, setForm] = useState({ unit: '', recipient: '', type: 'Caixa', description: '' });
  const [filterType, setFilterType] = useState('Todos');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.unit || !form.recipient) return;
    onAdd(form);
    setForm({ unit: '', recipient: '', type: 'Caixa', description: '' });
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  // Lógica de Filtros e Datas
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
            <p className="text-gray-600 mb-6">Deseja realmente apagar este registo? Esta ação é irreversível.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium shadow-md">Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center gap-2">
          <Package className="text-emerald-600" size={20} />
          <h2 className="font-semibold text-emerald-900">Registar Encomenda</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
              <input type="text" placeholder="Ex: 104-B" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinatário *</label>
              <input type="text" placeholder="Nome" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option>Caixa</option><option>Envelope</option><option>Delivery / Comida</option><option>Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input type="text" placeholder="Opcional" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="md:col-span-2 pt-2">
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex justify-center items-center gap-2">
                <CheckCircle size={20} /> Registar Chegada
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Lista com Filtros */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock size={20} className="text-orange-500" /> Pendentes ({pendingPackages.length})
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto">
                {['Todos', 'Caixa', 'Envelope', 'Delivery / Comida'].map(type => (
                <button key={type} onClick={() => setFilterType(type)} className={`px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${filterType === type ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {type}
                    {type !== 'Todos' && countByType(type) > 0 && <span className="bg-orange-100 text-orange-700 px-1.5 rounded-full text-[10px]">{countByType(type)}</span>}
                </button>
                ))}
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredPackages.length === 0 ? (
            <div className="col-span-2 text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">Sem encomendas pendentes.</div>
          ) : (
            filteredPackages.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} onDelete={() => setDeleteTarget(pkg.id)} />
            ))
          )}
        </div>
      </div>
      
       {/* Histórico Recente */}
       {historyPackages.length > 0 && (
         <div className="mt-8 opacity-75">
            <h3 className="text-lg font-bold text-gray-600 mb-4">Entregas Recentes</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
                {historyPackages.slice(0, 5).map(pkg => (
==                        <span className="text-gray-600 font-medium">Apt {pkg.unit} - {pkg.recipient}</span>
                        <div className="flex flex-col text-right">
                            <span className="text-green-600 flex items-center justify-end gap-1"><CheckCircle size={14}/> Entregue</span>
                            <span className="text-xs text-gray-400">Retirado por: {pkg.collected_by}</span>
                        </div>
                    </div>
                ))}
            </div>
         </div>
       )}
    </div>
  );
}

function ResidentView({ packages, onCollect }) {
  const [searchUnit, setSearchUnit] = useState('');
  const [showCollectorModal, setShowCollectorModal] = useState(null);
  const [collectorName, setCollectorName] = useState('');

  const myPackages = packages.filter(p => searchUnit && p.unit.toLowerCase().includes(searchUnit.toLowerCase()));

  const handleConfirmCollect = (pkgId) => {
    if (!collectorName) return;
    onCollect(pkgId, collectorName);
    setShowCollectorModal(null);
    setCollectorName('');
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
                <div key={pkg.id} className={`bg-white p-5 rounded-lg shadow-sm border-l-4 ${pkg.status === 'collected' ? 'border-green-500' : 'border-orange-500'} flex flex-col sm:flex-row justify-between items-center gap-4`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${pkg.status === 'collected' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{pkg.status === 'collected' ? 'Entregue' : 'Aguardando'}</span>
                      <span className="text-xs text-gray-400">{new Date(pkg.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-800">{pkg.type} - {pkg.description || 'Sem descrição'}</h4>
                    <p className="text-gray-600">Para: {pkg.recipient}</p>
                  </div>
                  {pkg.status === 'pending' && (
                    <div>
                      {showCollectorModal === pkg.id ? (
                        <div className="flex flex-col gap-2 min-w-[200px] animate-fade-in">
                          <input autoFocus type="text" placeholder="Nome de quem retira" className="px-3 py-2 border rounded text-sm w-full" value={collectorName} onChange={(e) => setCollectorName(e.target.value)} />
                          <div className="flex gap-2">
                             <button onClick={() => handleConfirmCollect(pkg.id)} disabled={!collectorName} className="bg-emerald-600 text-white px-3 py-2 rounded text-sm flex-1 hover:bg-emerald-700 disabled:opacity-50">Confirmar</button>
                             <button onClick={() => setShowCollectorModal(null)} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">Voltar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowCollectorModal(pkg.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-medium shadow-sm">Confirmar Retirada</button>
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

function PackageCard({ pkg, onDelete }) {
    const dateStr = new Date(pkg.created_at).toLocaleDateString('pt-BR');
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative group">
          <button onClick={onDelete} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100" title="Excluir"><Trash2 size={16} /></button>
        <div className="flex justify-between items-start mb-2">
          <div className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">APT {pkg.unit}</div>
          <span className="text-xs text-gray-400">{dateStr}</span>
        </div>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${pkg.type === 'Delivery / Comida' ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <Box size={24} className={pkg.type === 'Delivery / Comida' ? 'text-orange-600' : 'text-gray-600'} />
          </div>
          <div>
            <h4 className="font-bold text-gray-800">{pkg.recipient}</h4>
            <p className="text-sm text-gray-600">{pkg.type} {pkg.description && `- ${pkg.description}`}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-orange-600 font-medium">
          <Clock size={14} /> Aguardando morador
        </div>
      </div>
    );
  }