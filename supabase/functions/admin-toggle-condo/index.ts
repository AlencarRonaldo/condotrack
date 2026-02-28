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

async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  const ADMIN_JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET')
  if (!ADMIN_JWT_SECRET) return null

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const enc = new TextEncoder()
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

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payloadPadded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4)
    const payload = JSON.parse(atob(payloadPadded))

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

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

    const { condo_id } = await req.json()
    if (!condo_id) {
      return new Response(
        JSON.stringify({ error: 'condo_id é obrigatório' }),
        { status: 400, headers: cors }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get current status
    const { data: condo, error: fetchErr } = await supabase
      .from('condos')
      .select('id, name, is_active')
      .eq('id', condo_id)
      .single()

    if (fetchErr || !condo) {
      return new Response(
        JSON.stringify({ error: 'Condomínio não encontrado' }),
        { status: 404, headers: cors }
      )
    }

    // Toggle
    const newStatus = !condo.is_active
    const { error: updateErr } = await supabase
      .from('condos')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', condo_id)

    if (updateErr) throw updateErr

    console.log(`[admin-toggle-condo] ${condo.name} (${condo_id}): is_active = ${newStatus}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: { condo_id, name: condo.name, is_active: newStatus },
      }),
      { status: 200, headers: cors }
    )
  } catch (err) {
    console.error('[admin-toggle-condo] Error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno do servidor' }),
      { status: 500, headers: cors }
    )
  }
})
