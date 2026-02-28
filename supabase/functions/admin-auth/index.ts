import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

// HMAC-SHA256 token generation
async function createToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const enc = new TextEncoder()

  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const b64Payload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const data = `${b64Header}.${b64Payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${data}.${b64Sig}`
}

// bcrypt compare using Web Crypto (timing-safe)
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Use bcrypt from Deno
  const { compareSync } = await import('https://deno.land/x/bcrypt@v0.4.1/mod.ts')
  return compareSync(password, hash)
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

    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email e senha são obrigatórios' }),
        { status: 400, headers: cors }
      )
    }

    const SUPER_ADMIN_EMAIL = Deno.env.get('SUPER_ADMIN_EMAIL')
    const SUPER_ADMIN_PASSWORD_HASH = Deno.env.get('SUPER_ADMIN_PASSWORD_HASH')
    const ADMIN_JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET')

    if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD_HASH || !ADMIN_JWT_SECRET) {
      console.error('[admin-auth] Missing env vars')
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: cors }
      )
    }

    // Check email
    if (email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Credenciais inválidas' }),
        { status: 401, headers: cors }
      )
    }

    // Check password
    const passwordMatch = await verifyPassword(password, SUPER_ADMIN_PASSWORD_HASH)
    if (!passwordMatch) {
      return new Response(
        JSON.stringify({ error: 'Credenciais inválidas' }),
        { status: 401, headers: cors }
      )
    }

    // Generate token (24h expiry)
    const now = Math.floor(Date.now() / 1000)
    const token = await createToken(
      {
        sub: 'super_admin',
        email: email.toLowerCase(),
        iat: now,
        exp: now + 86400, // 24 hours
      },
      ADMIN_JWT_SECRET
    )

    console.log(`[admin-auth] Super admin logged in: ${email}`)

    return new Response(
      JSON.stringify({ success: true, token }),
      { status: 200, headers: cors }
    )
  } catch (err) {
    console.error('[admin-auth] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: cors }
    )
  }
})
