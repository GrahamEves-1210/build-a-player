// FRANCHISE: the save's shape. slim() turns the league into something small to write; fatten() turns it back.
// Only players change shape (they are nine tenths of a save): each becomes an array in a fixed field order,
// ratings as one base-12 string, a contract as an array, and for a real player nothing the data files already
// know (number, height, weight, face, photo). Anything a later engine adds to a player rides along in a
// trailing object, so an old reader never loses it.
import { SAVE_VERSION } from './consts'
import { TYPES_OF, realByName, reOvr } from './players'

const FIELDS = ['id', 'name', 'pos', 'sub', 'team', 'age', 'exp', 'a', 'dev', 'devKnown', 'xp', 'pts', 'con', 'mood', 'drives', 'wear', 'inj', 's', 'car', 'hist', 'aw', 'peak', 'kind', 'num', 'ht', 'wt', 'skin', 'photo', 'college', 'draft', 'yrsHere']
const KNOWN = new Set([...FIELDS, 'ovr', 'real', 'built', 'gen'])
const CON = ['yrs', 'sal', 'guar', 'rookie', 'rd', 'opt', 'tag']
const D12 = '0123456789ab'
const empty = v => v == null || v === 0 || v === false || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)

function slimPlayer(p) {
  const types = TYPES_OF[p.pos]
  const row = FIELDS.map(f => {
    if (f === 'a') return types.map(t => D12[Math.max(0, Math.min(11, Math.round(p.a[t] ?? 0)))]).join('')
    if (f === 'con') return p.con ? CON.map(k => (k === 'tag' ? (p.con.tag ? 1 : 0) : p.con[k] ?? 0)) : 0
    if (f === 'kind') return p.real ? 1 : p.built ? 2 : p.gen === false ? 3 : 0
    if (f === 'devKnown') return p.devKnown ? 1 : 0
    if (p.real && (f === 'num' || f === 'ht' || f === 'wt' || f === 'skin' || f === 'photo')) { const base = realByName(p.name); return base && base[f] === p[f] ? 0 : p[f] ?? 0 }
    return empty(p[f]) ? 0 : p[f]
  })
  const extra = {}
  for (const k in p) if (!KNOWN.has(k) && p[k] !== undefined) extra[k] = p[k]
  if (Object.keys(extra).length) row.push(extra)
  else while (row.length && row[row.length - 1] === 0) row.pop()
  return row
}
function fatPlayer(row) {
  const p = {}
  FIELDS.forEach((f, i) => { p[f] = row[i] ?? 0 })
  const extra = row.length > FIELDS.length ? row[FIELDS.length] : null
  const types = TYPES_OF[p.pos] ?? []
  const str = String(p.a || '')
  p.a = Object.fromEntries(types.map((t, i) => [t, Math.max(0, D12.indexOf(str[i] ?? '5'))]))
  p.con = Array.isArray(p.con) ? Object.fromEntries(CON.map((k, i) => [k, k === 'tag' ? !!p.con[i] : k === 'rd' ? p.con[i] || null : p.con[i] ?? 0])) : null
  if (p.kind === 1) p.real = true
  else if (p.kind === 2) { p.gen = false; p.built = true } else p.gen = p.kind === 0
  delete p.kind
  p.yrsHere = p.yrsHere || 0
  p.devKnown = !!p.devKnown
  p.sub = p.sub || null; p.team = p.team || null; p.inj = p.inj || null; p.college = p.college || null; p.draft = p.draft || null
  p.drives = p.drives || []; p.s = p.s || {}; p.car = p.car || {}; p.hist = p.hist || []; p.aw = p.aw || []
  const base = p.real ? realByName(p.name) : null
  for (const f of ['num', 'ht', 'wt', 'skin', 'photo']) if (!p[f]) p[f] = base ? base[f] ?? null : f === 'num' ? 0 : null
  if (extra) Object.assign(p, extra)
  reOvr(p)
  if (!(p.peak >= p.ovr)) p.peak = p.ovr
  return p
}

export function slim(F) {
  return { ...F, flash: null, players: Object.values(F.players).map(slimPlayer) }
}
export function fatten(body) {
  if (!body || !Array.isArray(body.players)) return body
  const players = {}
  for (const row of body.players) { const p = fatPlayer(row); players[p.id] = p }
  return { ...body, players }
}
// A save from an older engine, brought up to this one. (Version 1 is the first: nothing to do yet. Each later
// version adds its step here, so any save ever written still opens.)
export function migrate(F, from) {
  if (!F) return F
  F.v = SAVE_VERSION
  return F
}
