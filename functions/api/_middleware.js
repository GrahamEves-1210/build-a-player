// Lets the app and the preview sites call /api/* (CORS). The iOS app runs at
// capacitor://localhost and Android at https://localhost, so every call they make
// here is cross-origin: the phone first asks (OPTIONS) whether it may, and reads
// the answer only if it carries Access-Control-Allow-Origin. Same list as the
// old API (server/server.js). Calls with no Origin (Stripe's webhook) pass as is.
const ALLOWED = ['https://build-a-player.com', 'https://www.build-a-player.com', 'capacitor://localhost', 'https://localhost']
const PREVIEW = /^https:\/\/([a-z0-9-]+\.)?build-a-player\.pages\.dev$/
const allowed = o => ALLOWED.includes(o) || PREVIEW.test(o)

const corsHeaders = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
})

export async function onRequest({ request, next }) {
  const origin = request.headers.get('origin') || ''
  const ok = origin && allowed(origin)
  if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: ok ? corsHeaders(origin) : {} })
  const res = await next()
  if (!ok) return res
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(corsHeaders(origin))) out.headers.set(k, v)
  return out
}
