// Forgot password (POST /api/reset-request { username }). Accounts log in with a username
// (its login address is made up from it, so Supabase's own reset email has nowhere to go);
// the real address is the contact email given at sign-up (accounts.email). This finds it,
// makes a Supabase recovery link, and sends it with Resend. The answer never says whether
// the account exists or has an email, so nobody can probe for accounts.
//
// Needs, on the Worker (secrets): SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
//   npx wrangler secret put RESEND_API_KEY
// Optional [vars]: RESET_FROM (default "Build-A-Player <noreply@build-a-player.com>", a
// sender on the domain verified in Resend), RESET_REDIRECT (where the link lands).

const ORIGINS = [/^https:\/\/(www\.)?build-a-player\.com$/, /^https:\/\/([a-z0-9-]+\.)?build-a-player\.pages\.dev$/, /^https?:\/\/localhost(:\d+)?$/, /^capacitor:\/\/localhost$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/]
const corsFor = req => {
  const o = req.headers.get('Origin') || ''
  return ORIGINS.some(re => re.test(o))
    ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' }
    : {}
}
const json = (body, status, cors) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })
const SAME = { ok: true }    // the one answer for every username

// a little rate limiting (per Worker instance): a username every 2 minutes, a caller 6 times in 10
const byName = new Map(), byIp = new Map()
const limited = (name, ip) => {
  const now = Date.now()
  if ((byName.get(name) ?? 0) > now - 120000) return true
  const hits = (byIp.get(ip) ?? []).filter(t => t > now - 600000)
  if (hits.length >= 6) return true
  byName.set(name, now); byIp.set(ip, [...hits, now])
  if (byName.size > 5000) byName.clear()
  if (byIp.size > 5000) byIp.clear()
  return false
}

const esc = s => s.replace(/[\\%_]/g, c => `\\${c}`)
const html = link => `<!doctype html><html><body style="margin:0;background:#0b0f0d;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#eef8f1">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<div style="font-size:22px;font-weight:800;letter-spacing:.5px;margin-bottom:18px">BUILD-A-PLAYER</div>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px">Someone asked to reset the password for this Build-A-Player account. If it was you, set a new one here:</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#2ecf8f;color:#04130c;font-weight:800;text-decoration:none;padding:13px 22px;border-radius:12px">Set a new password</a></p>
<p style="font-size:13px;line-height:1.5;color:#9fb6aa;margin:0">The link works once and expires soon. If you didn't ask, ignore this email: nothing changes.</p>
</div></body></html>`

export async function handleReset(req, env) {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors)
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY'].filter(k => !env[k])
  if (missing.length) return json({ error: `not set up: ${missing.join(', ')}` }, 503, cors)
  const body = await req.json().catch(() => null)
  const name = String(body?.username || '').trim()
  if (!/^[A-Za-z0-9_.-]{2,32}$/.test(name)) return json(SAME, 200, cors)
  if (limited(name.toLowerCase(), req.headers.get('CF-Connecting-IP') || 'x')) return json(SAME, 200, cors)

  const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  try {
    const a = await fetch(`${env.SUPABASE_URL}/rest/v1/accounts?select=id,email&username=ilike.${encodeURIComponent(esc(name))}&limit=1`, { headers: svc })
    const acc = a.ok ? (await a.json())?.[0] : null
    if (!acc?.id) return json(SAME, 200, cors)
    const u = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${acc.id}`, { headers: svc })
    const user = u.ok ? await u.json() : null
    // the private copy (lib/contactEmail.js), then the old accounts column for accounts not yet moved
    const to = (user?.user_metadata?.contact_email || acc.email || '').trim()
    if (!user?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json(SAME, 200, cors)

    const g = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST', headers: { ...svc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'recovery', email: user.email, redirect_to: env.RESET_REDIRECT || 'https://build-a-player.com/?reset=1' }),
    })
    const gen = g.ok ? await g.json() : null
    const link = gen?.action_link ?? gen?.properties?.action_link
    if (!link) { console.error('[reset] no link', g.status); return json(SAME, 200, cors) }

    const s = await fetch(`${env.RESEND_URL || 'https://api.resend.com'}/emails`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESET_FROM || 'Build-A-Player <noreply@build-a-player.com>', to: [to],
        subject: 'Reset your Build-A-Player password',
        html: html(link),
        text: `Someone asked to reset the password for this Build-A-Player account. If it was you, set a new one here: ${link}\n\nThe link works once and expires soon. If you didn't ask, ignore this email.`,
      }),
    })
    if (!s.ok) console.error('[reset] send failed', s.status, await s.text().catch(() => ''))
  } catch (e) { console.error('[reset]', e?.message) }
  return json(SAME, 200, cors)
}
