import { createClient } from '@supabase/supabase-js'
import { proRoleReady, discordIdOf, isPro, setProRole, syncProRoles } from './_discordPro'

// The BAP Pro Discord role, put right.
//   GET  /api/discord-pro-sync?key=CHECK_KEY   everyone: every Pro account with Discord linked gets the role, a batch
//                                              at a time (&from=N; the JSON says the next one). Opened in a browser
//                                              it's a page that runs every batch and shows the totals; the daily
//                                              check asks for the batches itself (&json=1).
//   POST /api/discord-pro-sync (signed in)     just this player: the game calls it once a day when a signed-in
//                                              player with Discord linked opens it, so a new Pro gets the role
//                                              without waiting for the daily check. Who it is comes from the
//                                              session, never the body.
const db = env => createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (!env.CHECK_KEY || key !== env.CHECK_KEY) return new Response('Not found', { status: 404 })
  if (!url.searchParams.has('json') && (request.headers.get('accept') || '').includes('text/html')) return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  const from = Math.max(0, parseInt(url.searchParams.get('from') ?? '0', 10) || 0)
  const out = await syncProRoles(env, db(env), from)
  return Response.json(out, { status: out.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } })
}

// the browser page: every batch in turn, then the totals (the key stays in the address it was opened with)
const PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BAP Pro role</title>
<body style="margin:0;padding:24px;background:#0b0c0e;color:#fff;font:16px/1.5 system-ui,sans-serif"><h1 style="font-size:22px">BAP Pro Discord role</h1><p id="s">Starting…</p><pre id="o" style="white-space:pre-wrap;color:#9aa3ad"></pre>
<script>
(async () => {
  const s = document.getElementById('s'), o = document.getElementById('o')
  const q = new URLSearchParams(location.search), key = q.get('key')
  let from = 0, given = 0, out = 0, d = null
  for (let i = 0; i < 200; i++) {
    const r = await fetch('?key=' + encodeURIComponent(key) + '&json=1&from=' + from)
    d = await r.json().catch(() => ({ problem: 'no answer (status ' + r.status + ')' }))
    if (d.problem) break
    given += d.given; out += d.notInServer
    s.textContent = 'Working… ' + Math.min(d.linked, from + d.given + d.notInServer) + ' of ' + d.linked
    if (d.next == null) break
    from = d.next
  }
  if (d && d.problem) { s.textContent = 'Stopped: ' + d.problem; s.style.color = '#e5383b' }
  else s.textContent = 'Done. ' + given + ' of ' + (d ? d.linked : 0) + ' Pro accounts with Discord linked have the role.'
  o.textContent = (d && d.pro != null ? d.pro + ' Pro accounts in all; ' + (d.linked ?? 0) + ' have Discord linked.\\n' : '') + (out ? out + ' of them are not in the server (they get it when they join through the site).' : '')
})()
</script>`

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 })
  if (!proRoleReady(env)) return Response.json({ role: 'off' })
  const supabase = db(env)
  const { data: { user } = {}, error } = await supabase.auth.getUser(token)
  if (error || !user) return Response.json({ error: 'Your session expired. Sign in again.' }, { status: 401 })
  const discordId = discordIdOf(user)
  if (!discordId) return Response.json({ role: 'no_discord' })
  const { data: acc } = await supabase.from('accounts').select('subscription_status').eq('id', user.id).maybeSingle()
  if (!isPro(acc)) return Response.json({ role: 'not_pro' })
  const role = await setProRole(env, discordId, true)
  if (role !== 'given' && role !== 'not_in_server') console.error('[discord-pro-sync]', role)
  return Response.json({ role })
}
