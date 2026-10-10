// Friends, outside the 1v1 lobby (Profile → Friends). Same tables the Blacktop
// 1v1 lobby uses (components/VersusLobby.jsx):
//   friend_requests  { id, from_id, from_username, to_id, to_username, status }
//                    status: 'pending' | 'accepted' | 'declined' (| 'removed')
//   accounts         { id, username, cos, classic_mvps … }   (public parts only)
//   simulations      saved seasons (public: leaderboards read them)
//   vs_results       { user_id, result }  1v1 record (the lobby reads friends' rows)
// Nothing here reads another player's private columns (email, wallet, ads).
import { supabase } from './supabase'
import { seedCos } from './peopleCos'

const pair = (a, b) => `and(from_id.eq.${a},to_id.eq.${b}),and(from_id.eq.${b},to_id.eq.${a})`

// My friends (fresh names from accounts), requests waiting on me, and the ones I sent
export async function loadFriends(uid) {
  if (!supabase || !uid) return { friends: [], incoming: [], outgoing: [] }
  const [accRes, inRes, outRes] = await Promise.all([
    supabase.from('friend_requests').select('*').or(`from_id.eq.${uid},to_id.eq.${uid}`).eq('status', 'accepted'),
    supabase.from('friend_requests').select('*').eq('to_id', uid).eq('status', 'pending'),
    supabase.from('friend_requests').select('*').eq('from_id', uid).eq('status', 'pending'),
  ])
  // one row per friend, even if a pair ended up with two accepted rows
  const byId = new Map()
  for (const f of accRes.data ?? []) {
    const id = f.from_id === uid ? f.to_id : f.from_id
    const username = f.from_id === uid ? f.to_username : f.from_username
    if (!byId.has(id)) byId.set(id, { id, username: username || 'Player', reqId: f.id })
  }
  const ids = [...byId.keys()]
  if (ids.length) {
    const { data } = await supabase.from('accounts').select('id, username, cos').in('id', ids.slice(0, 150))
    for (const a of data ?? []) {
      const f = byId.get(a.id)
      if (f && a.username) f.username = a.username
      if (a.cos) seedCos(a.id, a.cos)
    }
  }
  const friends = [...byId.values()].sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }))
  return { friends, incoming: inRes.data ?? [], outgoing: outRes.data ?? [] }
}

// Usernames starting with what was typed (exact match first). Each result says
// where we stand with that player: none | friends | sent | incoming (+ reqId)
export async function searchPlayers(q, uid) {
  const term = q.trim()
  if (!supabase || !term) return []
  const like = term.replace(/[\\%_]/g, m => `\\${m}`)
  const { data, error } = await supabase.from('accounts').select('id, username, cos').ilike('username', `${like}%`).limit(8)
  if (error) throw error
  const rows = (data ?? []).filter(r => r.username && r.id !== uid)
  rows.sort((a, b) => (b.username.toLowerCase() === term.toLowerCase()) - (a.username.toLowerCase() === term.toLowerCase()) || a.username.length - b.username.length)
  const found = rows.slice(0, 5)
  if (!found.length) return []
  found.forEach(r => r.cos && seedCos(r.id, r.cos))
  const { data: rel } = await supabase.from('friend_requests').select('id, from_id, to_id, status')
    .or(found.map(r => pair(uid, r.id)).join(','))
  return found.map(r => {
    const rows2 = (rel ?? []).filter(x => (x.from_id === r.id && x.to_id === uid) || (x.from_id === uid && x.to_id === r.id))
    const acc = rows2.find(x => x.status === 'accepted')
    const inc = rows2.find(x => x.status === 'pending' && x.from_id === r.id)
    const out = rows2.find(x => x.status === 'pending' && x.from_id === uid)
    const state = acc ? 'friends' : inc ? 'incoming' : out ? 'sent' : 'none'
    return { id: r.id, username: r.username, state, reqId: (acc || inc || out)?.id ?? null }
  })
}

export async function sendFriendRequest(me, myName, target) {
  const row = { from_id: me, from_username: myName || 'Player', to_id: target.id, to_username: target.username, status: 'pending' }
  const { error } = await supabase.from('friend_requests').insert(row)
  if (!error) return
  // an old declined/removed row for this pair: reopen it instead
  if (error.code === '23505') {
    const { data, error: e2 } = await supabase.from('friend_requests').update({ status: 'pending' })
      .eq('from_id', me).eq('to_id', target.id).select('id')
    if (!e2 && data?.length) return
  }
  throw error
}

export async function respondToRequest(reqId, accept) {
  const { error } = await supabase.from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', reqId)
  if (error) throw error
}

// Deletes the pair's rows; if the table's policies don't allow deleting, marks
// them 'removed' instead (friend lists only read 'accepted'). Throws if neither
// went through (supabase/friends_profile.sql adds the policies for both).
export async function removeFriend(me, friendId) {
  const del = await supabase.from('friend_requests').delete().or(pair(me, friendId)).select('id')
  if (!del.error && del.data?.length) return
  const upd = await supabase.from('friend_requests').update({ status: 'removed' }).or(pair(me, friendId)).eq('status', 'accepted').select('id')
  if (!upd.error && upd.data?.length) return
  throw upd.error || del.error || new Error("Couldn't remove this friend")
}

const countOf = q => q.then(r => (r.error ? null : r.count ?? 0), () => null)

// What anyone can already see of a player (leaderboards, award boards, 1v1):
// name, look, seasons, rings, awards, 1v1 record and best saved builds.
export async function loadPublicProfile(id) {
  if (!supabase || !id) return null
  const base = () => supabase.from('simulations').select('id', { count: 'exact', head: true }).eq('user_id', id)
  const [acct, seasons, rings, best, vs] = await Promise.all([
    supabase.from('accounts').select('username, cos, classic_mvps, alltime_mvps, classic_opoys, alltime_opoys, classic_dpoys, alltime_dpoys').eq('id', id).maybeSingle()
      .then(r => r.data ?? null, () => null),
    countOf(base()),
    countOf(base().eq('champion', true)),
    supabase.from('simulations').select('game_mode, position, ovr, archetype, wins, losses, champion, playoffs, build, created_at')
      .eq('user_id', id).not('build', 'is', null)
      .order('ovr', { ascending: false }).order('wins', { ascending: false }).limit(3)
      .then(r => r.data ?? [], () => []),
    supabase.from('vs_results').select('result').eq('user_id', id).then(r => r.data ?? [], () => []),
  ])
  if (acct?.cos) seedCos(id, acct.cos)
  const awards = acct ? ['classic_mvps', 'alltime_mvps', 'classic_opoys', 'alltime_opoys', 'classic_dpoys', 'alltime_dpoys']
    .reduce((s, k) => s + (Number.isFinite(acct[k]) ? acct[k] : 0), 0) : 0
  const level = Number.isFinite(acct?.cos?.level) ? acct.cos.level : null   // only if their game shares it
  return {
    username: acct?.username ?? null,
    seasons, rings, awards, level,
    best,
    vsWins: vs.filter(r => r.result === 'win').length,
    vsLosses: vs.filter(r => r.result === 'loss' || r.result === 'forfeit').length,
  }
}

// "QB · Classic", "Guard · All-Time" …
const POS = { rb: 'RB', wr: 'WR', te: 'TE', db: 'DB', ol: 'OL' }
export function modeLabel(gameMode, position) {
  const m = String(gameMode || 'classic')
  if (m.startsWith('bucket-')) {
    const pos = position === 'big' ? 'Big' : position === 'guard' ? 'Guard' : 'Bucket'
    return `${pos} · ${m === 'bucket-all-time' ? 'All-Time' : 'Classic'}`
  }
  const [head, ...rest] = m.split('-')
  const pos = POS[head] || 'QB'
  const mode = POS[head] ? rest.join('-') : m
  const name = mode === 'all-time' ? 'All-Time' : mode === 'legends' ? 'Legends' : mode === 'salarycap' ? 'Salary Cap' : mode === 'daily' ? 'Daily' : 'Classic'
  return `${pos} · ${name}`
}
