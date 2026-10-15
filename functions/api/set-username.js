import { createClient } from '@supabase/supabase-js'

// A username for an account that came in without one (Sign in with Apple: Apple
// only shares a name the very first time, and many players hide it). Runs once,
// from the "pick your username" sheet right after that sign-in:
//   { username: 'Name' } → that name, if it's valid, clean and free
//   {}                   → one made up for them (their Apple name if there is one)
// Discord accounts get theirs from discord-join.js instead. An account that
// already has a username keeps it: this never renames anyone. Who the player is
// comes from their verified Supabase session, never the body.

const VALID = /^[a-zA-Z0-9_-]{3,20}$/
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'fag', 'nigg', 'retard', 'kys', 'killyourself', 'rape', 'nazi', 'porn', 'sex', 'admin', 'buildaplayer']
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' }
const rude = s => { const n = s.toLowerCase().replace(/[01345 7]/g, c => LEET[c] ?? c).replace(/[^a-z]/g, ''); return BAD.some(b => n.includes(b)) }
const cleanName = s => (s || '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'Not signed in' }, { status: 401 })
  const { username: asked } = await request.json().catch(() => ({}))

  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: { user } = {}, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return Response.json({ error: 'Your session expired. Sign in again.' }, { status: 401 })

  // already named: nothing to do
  if (user.user_metadata?.username) return Response.json({ username: user.user_metadata.username })

  // case-insensitive exact match on the names in use; `_` is a LIKE wildcard, so escape it
  const taken = async name => {
    const { data } = await supabase.from('accounts').select('id').ilike('username', name.replace(/[\\%_]/g, '\\$&')).neq('id', user.id).limit(1)
    return !!data?.length
  }

  let username
  if (asked != null) {
    const name = String(asked).trim()
    if (!VALID.test(name)) return Response.json({ error: 'Use 3 to 20 letters, numbers, _ or -.' }, { status: 400 })
    if (rude(name)) return Response.json({ error: 'Pick a different name.' }, { status: 400 })
    if (await taken(name)) return Response.json({ error: 'That name is taken. Try another.' }, { status: 409 })
    username = name
  } else {
    const m = user.user_metadata ?? {}
    const fromApple = cleanName(m.full_name) || cleanName(m.name)
    const base = fromApple && !rude(fromApple) ? fromApple : 'player'
    let candidate = base.length >= 3 ? base : `${base}player`.slice(0, 20)
    for (let i = 0; i < 8 && (candidate === 'player' || await taken(candidate)); i++) {
      candidate = `${base.slice(0, 15)}${Math.floor(100 + Math.random() * 9900)}`
    }
    username = candidate
  }

  const { error: metaErr } = await supabase.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, username } })
  if (metaErr) return Response.json({ error: 'Could not save that. Try again.' }, { status: 500 })
  const { error: accErr } = await supabase.from('accounts').upsert({ id: user.id, username }, { onConflict: 'id' })
  if (accErr) console.error('[set-username] accounts username', accErr)
  return Response.json({ username })
}
