import { createClient } from '@supabase/supabase-js'
import { proRoleReady, discordIdOf, isPro, setProRole, syncProRoles } from './_discordPro'

// The BAP Pro Discord role, put right.
//   GET  /api/discord-pro-sync?key=CHECK_KEY   everyone: every Pro account with Discord linked gets the role (the
//                                              daily check runs it; open it in a browser to run it now). Answers
//                                              what it did as JSON.
//   POST /api/discord-pro-sync (signed in)     just this player: the game calls it once a day when a signed-in
//                                              player with Discord linked opens it, so a new Pro gets the role
//                                              without waiting for the daily check. Who it is comes from the
//                                              session, never the body.
const db = env => createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key')
  if (!env.CHECK_KEY || key !== env.CHECK_KEY) return new Response('Not found', { status: 404 })
  const out = await syncProRoles(env, db(env))
  return Response.json(out, { status: out.ok ? 200 : 500 })
}

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
