// ==================================================================================
// CONDOTRACK PRO - SUPABASE CLIENT
// ==================================================================================
// Configuração centralizada do cliente Supabase
// ==================================================================================

import { createClient } from '@supabase/supabase-js';

// Variáveis de ambiente (Vite)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validação
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERRO: Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias!');
  console.error('📝 Configure o arquivo .env com suas credenciais do Supabase.');
}

// Cliente Supabase
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);

// ==================================================================================
// CONSTANTES DE CONFIGURAÇÃO
// ==================================================================================

export const IS_PRODUCTION = import.meta.env.VITE_APP_ENV === 'production';
export const IS_DEVELOPMENT = !IS_PRODUCTION;

// URL base para Edge Functions
export const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

// ==================================================================================
// FUNÇÕES DE AUTENTICAÇÃO
// ==================================================================================

/**
 * Login via Edge Function (auth-login)
 */
export async function loginStaff(username, password, condoId) {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/auth-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ username, password, condoId })
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        error: data.error || 'Erro ao fazer login',
        code: data.code 
      };
    }

    return {
      success: true,
      user: data.user,
      condo: data.condo,
      condoStatus: data.condoStatus
    };
  } catch (error) {
    console.error('[loginStaff] Erro:', error);
    return { 
      success: false, 
      error: 'Erro de conexão. Verifique sua internet.',
      code: 'NETWORK_ERROR'
    };
  }
}

// ==================================================================================
// FUNÇÕES DE DADOS (COM FILTRO POR CONDO_ID)
// ==================================================================================

/**
 * Buscar encomendas do condomínio
 */
export async function fetchPackages(condoId, options = {}) {
  const { status, limit = 100 } = options;
  
  let query = supabase
    .from('packages')
    .select('*')
    .eq('condo_id', condoId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('[fetchPackages] Erro:', error);
    return { data: [], error };
  }
  
  return { data: data || [], error: null };
}

/**
 * Criar encomenda
 */
export async function createPackage(condoId, packageData) {
  const { data, error } = await supabase
    .from('packages')
    .insert({
      condo_id: condoId,
      unit: packageData.unit,
      recipient: packageData.recipient,
      type: packageData.type || 'Caixa',
      description: packageData.description,
      phone: packageData.phone,
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('[createPackage] Erro:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Atualizar encomenda (retirada)
 */
export async function collectPackage(packageId, collectorData) {
  const { data, error } = await supabase
    .from('packages')
    .update({
      status: 'collected',
      collected_at: new Date().toISOString(),
      collected_by: collectorData.collectedBy,
      receiver_doc: collectorData.receiverDoc
    })
    .eq('id', packageId)
    .select()
    .single();

  if (error) {
    console.error('[collectPackage] Erro:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Soft delete de encomenda
 */
export async function deletePackage(packageId, deletedBy, reason = '') {
  const { data, error } = await supabase
    .from('packages')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
      delete_reason: reason
    })
    .eq('id', packageId)
    .select()
    .single();

  if (error) {
    console.error('[deletePackage] Erro:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Notificar morador
 */
export async function notifyResident(packageId, notifiedBy) {
  const { data, error } = await supabase
    .from('packages')
    .update({
      status: 'notified',
      notified_at: new Date().toISOString(),
      notified_by: notifiedBy
    })
    .eq('id', packageId)
    .select()
    .single();

  if (error) {
    console.error('[notifyResident] Erro:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ==================================================================================
// FUNÇÕES DE STAFF
// ==================================================================================

/**
 * Buscar staff do condomínio
 */
export async function fetchStaff(condoId) {
  const { data, error } = await supabase
    .from('staff')
    .select('id, condo_id, name, username, role, is_active, created_at')
    .eq('condo_id', condoId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchStaff] Erro:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

/**
 * Criar staff (via Edge Function para hash de senha)
 */
export async function createStaff(condoId, staffData) {
  // Por enquanto, criação direta (senha será migrada no próximo login)
  const { data, error } = await supabase
    .from('staff')
    .insert({
      condo_id: condoId,
      name: staffData.name,
      username: staffData.username.toLowerCase(),
      password: staffData.password, // Será hasheado no próximo login
      role: staffData.role || 'porteiro',
      is_active: true
    })
    .select('id, condo_id, name, username, role, created_at')
    .single();

  if (error) {
    console.error('[createStaff] Erro:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

/**
 * Deletar staff
 */
export async function deleteStaff(staffId) {
  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', staffId);

  if (error) {
    console.error('[deleteStaff] Erro:', error);
    return { error };
  }

  return { error: null };
}

// ==================================================================================
// FUNÇÕES DE UNIDADES
// ==================================================================================

/**
 * Buscar unidades do condomínio
 */
export async function fetchUnits(condoId) {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('condo_id', condoId)
    .eq('is_active', true)
    .order('number', { ascending: true });

  if (error) {
    console.error('[fetchUnits] Erro:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

/**
 * Criar unidade
 */
export async function createUnit(condoId, unitData) {
  const { data, error } = await supabase
    .from('units')
    .insert({
      condo_id: condoId,
      number: unitData.number,
      block: unitData.block,
      floor: unitData.floor
    })
    .select()
    .single();

  if (error) {
    console.error('[createUnit] Erro:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ==================================================================================
// FUNÇÕES DE MORADORES
// ==================================================================================

/**
 * Buscar moradores do condomínio
 */
export async function fetchResidents(condoId) {
  const { data, error } = await supabase
    .from('residents')
    .select('*, unit:units(number, block)')
    .eq('condo_id', condoId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[fetchResidents] Erro:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

/**
 * Criar morador
 */
export async function createResident(condoId, residentData) {
  const { data, error } = await supabase
    .from('residents')
    .insert({
      condo_id: condoId,
      unit_id: residentData.unitId,
      name: residentData.name,
      email: residentData.email,
      phone: residentData.phone,
      document: residentData.document,
      is_owner: residentData.isOwner || false
    })
    .select()
    .single();

  if (error) {
    console.error('[createResident] Erro:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ==================================================================================
// REALTIME SUBSCRIPTIONS
// ==================================================================================

/**
 * Inscrever-se em mudanças de encomendas
 */
export function subscribeToPackages(condoId, callback) {
  const channel = supabase
    .channel(`packages_${condoId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'packages',
        filter: `condo_id=eq.${condoId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Cancelar inscrição
 */
export function unsubscribeChannel(channel) {
  if (channel) {
    supabase.removeChannel(channel);
  }
}

// ==================================================================================
// EXPORT DEFAULT
// ==================================================================================

export default supabase;
