import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://condotrack.vercel.app',
  'https://condotrack-nine.vercel.app',
  'https://www.condotrack.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}

// Verify admin JWT token
async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  const ADMIN_JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET')
  if (!ADMIN_JWT_SECRET) return null

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const enc = new TextEncoder()

    // Verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(ADMIN_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const data = `${parts[0]}.${parts[1]}`
    const sig = parts[2].replace(/-/g, '+').replace(/_/g, '/')
    const padded = sig + '='.repeat((4 - sig.length % 4) % 4)
    const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0))

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
    if (!valid) return null

    // Decode payload
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payloadPadded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4)
    const payload = JSON.parse(atob(payloadPadded))

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ========== ACTION HANDLERS ==========

async function handleOverview(supabase: ReturnType<typeof createClient>) {
  // Get all condos
  const { data: condos, error: condosErr } = await supabase
    .from('condos')
    .select('id, name, plan_type, subscription_status, is_active, trial_end_date, plan_end_date, created_at')

  if (condosErr) throw condosErr

  const total = condos?.length || 0
  const trials = condos?.filter(c => c.subscription_status === 'trial') || []
  const active = condos?.filter(c => c.subscription_status === 'active') || []
  const churned = condos?.filter(c => ['canceled', 'expired', 'inactive'].includes(c.subscription_status)) || []

  // Calculate MRR from active paid subscriptions
  const { data: plans } = await supabase.from('plans').select('slug, price_monthly')
  const priceMap: Record<string, number> = {}
  plans?.forEach(p => { priceMap[p.slug] = Number(p.price_monthly) })

  let mrr = 0
  active.forEach(c => {
    if (c.plan_type && priceMap[c.plan_type]) {
      mrr += priceMap[c.plan_type]
    }
  })

  // Signups by month (RPC)
  const { data: signups } = await supabase.rpc('admin_signups_by_month', { months_back: 12 })

  // Revenue by month (RPC)
  const { data: revenue } = await supabase.rpc('admin_revenue_by_month', { months_back: 12 })

  // Plan distribution
  const planDist: Record<string, number> = { trial: 0, basic: 0, professional: 0, premium: 0 }
  condos?.forEach(c => {
    if (c.plan_type && planDist[c.plan_type] !== undefined) {
      planDist[c.plan_type]++
    }
  })

  // Funnel
  const funnel = {
    registered: total,
    trial: trials.length + active.length + churned.length, // everyone started as trial
    paid: active.length,
    churned: churned.length,
    trial_to_paid: total > 0 ? ((active.length / total) * 100).toFixed(1) : '0',
    paid_to_churned: active.length + churned.length > 0
      ? ((churned.length / (active.length + churned.length)) * 100).toFixed(1) : '0',
  }

  // Recent activity
  const recentCondos = (condos || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('id, amount, status, paid_at, plan_slug, customer_id')
    .eq('status', 'PAID')
    .order('paid_at', { ascending: false })
    .limit(5)

  // Map invoice customer_id → condo name
  let recentPayments: Array<Record<string, unknown>> = []
  if (recentInvoices?.length) {
    const customerIds = [...new Set(recentInvoices.map(i => i.customer_id))]
    const { data: customers } = await supabase
      .from('customers')
      .select('id, condo_id')
      .in('id', customerIds)

    const condoIdMap: Record<string, string> = {}
    customers?.forEach(cu => { condoIdMap[cu.id] = cu.condo_id })

    const condoIds = [...new Set(Object.values(condoIdMap))]
    const { data: condoNames } = await supabase
      .from('condos')
      .select('id, name')
      .in('id', condoIds)

    const nameMap: Record<string, string> = {}
    condoNames?.forEach(c => { nameMap[c.id] = c.name })

    recentPayments = recentInvoices.map(inv => ({
      amount: inv.amount,
      plan: inv.plan_slug,
      paid_at: inv.paid_at,
      condo_name: nameMap[condoIdMap[inv.customer_id]] || 'N/A',
    }))
  }

  return {
    kpis: {
      total_condos: total,
      active_trials: trials.length,
      paying: active.length,
      churned: churned.length,
      mrr,
    },
    signups_by_month: signups || [],
    revenue_by_month: revenue || [],
    plan_distribution: planDist,
    funnel,
    recent_signups: recentCondos.map(c => ({
      id: c.id,
      name: c.name,
      plan_type: c.plan_type,
      status: c.subscription_status,
      created_at: c.created_at,
    })),
    recent_payments: recentPayments,
  }
}

async function handleSubscribers(
  supabase: ReturnType<typeof createClient>,
  params: {
    page?: number
    per_page?: number
    status?: string
    plan?: string
    search?: string
    sort_by?: string
    sort_dir?: string
  }
) {
  const page = params.page || 1
  const perPage = params.per_page || 20
  const offset = (page - 1) * perPage

  let query = supabase
    .from('condos')
    .select('id, name, slug, plan_type, subscription_status, is_active, trial_end_date, plan_end_date, plan_start_date, created_at', { count: 'exact' })

  // Filters
  if (params.status) {
    query = query.eq('subscription_status', params.status)
  }
  if (params.plan) {
    query = query.eq('plan_type', params.plan)
  }
  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  // Sort
  const sortBy = params.sort_by || 'created_at'
  const sortDir = params.sort_dir === 'asc' ? true : false
  query = query.order(sortBy, { ascending: sortDir })

  // Pagination
  query = query.range(offset, offset + perPage - 1)

  const { data: condos, count, error } = await query
  if (error) throw error

  // Get staff counts for these condos
  const condoIds = condos?.map(c => c.id) || []
  let staffCounts: Record<string, number> = {}

  if (condoIds.length > 0) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('condo_id')
      .in('condo_id', condoIds)

    staffData?.forEach(s => {
      staffCounts[s.condo_id] = (staffCounts[s.condo_id] || 0) + 1
    })
  }

  // Get MRR per condo
  const { data: plans } = await supabase.from('plans').select('slug, price_monthly')
  const priceMap: Record<string, number> = {}
  plans?.forEach(p => { priceMap[p.slug] = Number(p.price_monthly) })

  const subscribers = condos?.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    plan_type: c.plan_type,
    subscription_status: c.subscription_status,
    is_active: c.is_active,
    trial_end_date: c.trial_end_date,
    plan_end_date: c.plan_end_date,
    plan_start_date: c.plan_start_date,
    created_at: c.created_at,
    staff_count: staffCounts[c.id] || 0,
    mrr: c.subscription_status === 'active' && c.plan_type ? (priceMap[c.plan_type] || 0) : 0,
  })) || []

  return {
    subscribers,
    total: count || 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count || 0) / perPage),
  }
}

async function handleSubscriberDetail(
  supabase: ReturnType<typeof createClient>,
  condoId: string
) {
  // Condo info
  const { data: condo, error } = await supabase
    .from('condos')
    .select('*')
    .eq('id', condoId)
    .single()

  if (error || !condo) {
    throw new Error('Condomínio não encontrado')
  }

  // Staff
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, username, role, is_active, created_at')
    .eq('condo_id', condoId)
    .order('created_at', { ascending: true })

  // Invoices via customer
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('condo_id', condoId)
    .single()

  let invoices: Array<Record<string, unknown>> = []
  if (customer) {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, amount, status, due_date, paid_at, billing_type, plan_slug, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(20)

    invoices = inv || []
  }

  // Usage counts
  const { count: packagesCount } = await supabase
    .from('packages')
    .select('id', { count: 'exact', head: true })
    .eq('condo_id', condoId)

  const { count: residentsCount } = await supabase
    .from('residents')
    .select('id', { count: 'exact', head: true })
    .eq('condo_id', condoId)

  const { count: unitsCount } = await supabase
    .from('units')
    .select('id', { count: 'exact', head: true })
    .eq('condo_id', condoId)

  return {
    condo,
    staff: staff || [],
    invoices,
    usage: {
      packages: packagesCount || 0,
      residents: residentsCount || 0,
      units: unitsCount || 0,
    },
  }
}

async function handleRevenue(supabase: ReturnType<typeof createClient>) {
  // MRR trend (revenue by month)
  const { data: revenueByMonth } = await supabase.rpc('admin_revenue_by_month', { months_back: 12 })

  // Revenue by plan
  const { data: paidInvoices } = await supabase
    .from('invoices')
    .select('amount, plan_slug')
    .eq('status', 'PAID')

  const revenueByPlan: Record<string, { total: number; count: number }> = {
    basic: { total: 0, count: 0 },
    professional: { total: 0, count: 0 },
    premium: { total: 0, count: 0 },
  }

  paidInvoices?.forEach(inv => {
    const slug = inv.plan_slug
    if (slug && revenueByPlan[slug]) {
      revenueByPlan[slug].total += Number(inv.amount)
      revenueByPlan[slug].count++
    }
  })

  // Total revenue
  const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0

  // Recent invoices (all statuses)
  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('id, amount, status, due_date, paid_at, billing_type, plan_slug, customer_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  // Map customer → condo names
  let invoicesWithNames: Array<Record<string, unknown>> = []
  if (recentInvoices?.length) {
    const customerIds = [...new Set(recentInvoices.map(i => i.customer_id))]
    const { data: customers } = await supabase
      .from('customers')
      .select('id, condo_id')
      .in('id', customerIds)

    const condoIdMap: Record<string, string> = {}
    customers?.forEach(cu => { condoIdMap[cu.id] = cu.condo_id })

    const condoIds = [...new Set(Object.values(condoIdMap))]
    const { data: condoNames } = await supabase
      .from('condos')
      .select('id, name')
      .in('id', condoIds)

    const nameMap: Record<string, string> = {}
    condoNames?.forEach(c => { nameMap[c.id] = c.name })

    invoicesWithNames = recentInvoices.map(inv => ({
      ...inv,
      condo_name: nameMap[condoIdMap[inv.customer_id]] || 'N/A',
    }))
  }

  // Current MRR
  const { data: activeCondos } = await supabase
    .from('condos')
    .select('plan_type')
    .eq('subscription_status', 'active')

  const { data: plans } = await supabase.from('plans').select('slug, price_monthly')
  const priceMap: Record<string, number> = {}
  plans?.forEach(p => { priceMap[p.slug] = Number(p.price_monthly) })

  let currentMrr = 0
  activeCondos?.forEach(c => {
    if (c.plan_type && priceMap[c.plan_type]) {
      currentMrr += priceMap[c.plan_type]
    }
  })

  return {
    current_mrr: currentMrr,
    total_revenue: totalRevenue,
    revenue_by_month: revenueByMonth || [],
    revenue_by_plan: revenueByPlan,
    recent_invoices: invoicesWithNames,
  }
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })
    }

    // Verify admin token
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Token não fornecido' }), { status: 401, headers: cors })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload || payload.sub !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), { status: 401, headers: cors })
    }

    const body = await req.json()
    const { action, ...params } = body

    const supabase = getSupabaseAdmin()

    let result: unknown

    switch (action) {
      case 'overview':
        result = await handleOverview(supabase)
        break
      case 'subscribers':
        result = await handleSubscribers(supabase, params)
        break
      case 'subscriber_detail':
        if (!params.condo_id) {
          return new Response(
            JSON.stringify({ error: 'condo_id é obrigatório' }),
            { status: 400, headers: cors }
          )
        }
        result = await handleSubscriberDetail(supabase, params.condo_id)
        break
      case 'revenue':
        result = await handleRevenue(supabase)
        break
      default:
        return new Response(
          JSON.stringify({ error: `Action inválida: ${action}` }),
          { status: 400, headers: cors }
        )
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: cors }
    )
  } catch (err) {
    console.error('[admin-dashboard] Error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno do servidor' }),
      { status: 500, headers: cors }
    )
  }
})
