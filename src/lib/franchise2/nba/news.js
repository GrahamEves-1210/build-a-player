// NBA FRANCHISE: the wire. Short items in the voice of a league insider: facts, the team, the man, the terms.
// { d (the day, or null in the offseason), y (season), t (the calendar day it happened: days since 1970), k (kind),
//   tag (the chyron's word), s (team), text, i? (the man), g? (games out, an injury) }
// What makes it (newsWorthy): the stories a league follows. A role player's sprained ankle and a made-up man's
// qualifying offer stay off it; the GM's own team's news always makes it. What stays (trimNews): this season's items
// in full; older seasons' passing items (injuries, play-in lines, small moves) go first when the wire is full, so the
// stories that last (champions, awards, the draft, trades, big signings, records) are there a few summers on.
// One style (wireText): every item is a sentence that ends with a period.
import { TEAM, manOf } from './league'
import { dateOf } from './schedule'
export const NEWS_MAX = 240
const DAY = 86400000
// the cap engine writes teams by their short ("the BOS"); the wire and the screens say them the way a reporter does
// ("the Celtics", "the Heat's")
export const teamWords = t => String(t ?? '').replace(/\b(the|The) ([A-Z]{3})\b('s|')?/g, (m, the, s, pos) => {
  const n = TEAM[s]?.nick
  if (!n) return m
  return `${the} ${n}${pos ? (/s$/.test(n) ? "'" : "'s") : ''}`
})
// ── Deals as the wire says them ─────────────────────────────────────────────
// one voice for every signing, re-signing, extension and offer sheet, the way the league's reporters post them:
// "Caris LeVert re-signs with the Hornets: 1 year, $6.8 million" (the deal's total; a two-way deal by its kind)
export const millions = v => { const x = Math.round((v ?? 0) * 10) / 10; return `$${Number.isInteger(x) ? x : x.toFixed(1)} million` }
export const termsText = (y, total) => `${y} ${y === 1 ? 'year' : 'years'}, ${millions(total)}`
const dealTotal = (p, y = p.y) => [p.$ ?? 0, ...(p.sc ?? [])].slice(0, y ?? 1).reduce((a, v) => a + v, 0)
// a man's deal on the wire as it stands on him now: verb 'signs with' | 're-signs with' ...; s the team's short;
// note: words after the terms (' (mid-level exception)')
export function signText(verb, p, s, { y = null, total = null, note = '' } = {}) {
  if (p.tw) return `${p.n} ${verb} the ${s} on a two-way contract${note}`
  return `${p.n} ${verb} the ${s}: ${termsText(y ?? p.y ?? 1, total ?? dealTotal(p, y ?? p.y))}${note}`
}
// an extension: the seasons it adds and what they pay (the last `added` seasons of his deal now)
export function extensionText(p, s, added) {
  const all = [p.$ ?? 0, ...(p.sc ?? [])].slice(0, p.y ?? 1)
  const add = all.slice(Math.max(0, all.length - added))
  return `${p.n} agrees to an extension with the ${s}: ${termsText(add.length, add.reduce((a, v) => a + v, 0))}`
}
export const POS_FULL = { PG: 'point guard', SG: 'shooting guard', SF: 'small forward', PF: 'power forward', C: 'center' }

// ── The calendar: when an item happened ─────────────────────────────────────
// the season by its days; the postseason a night about every two and a half days from the play-in (three days after
// the last regular-season night); the summer the way the league's runs: the awards and the lottery the days after the Finals
// (the game holds them till then), the draft in the last week of June, free agency from June 30, camp at the end of
// September
const md = (y, m, d) => Date.UTC(y, m - 1, d)
export function wireTime(F) {
  if (F?.cal0 == null || F.days == null) return null
  const last = dateOf(F, F.days - 1).getTime()
  const po = night => last + Math.round(3 + night * 2.4) * DAY
  if (F.phase === 'season') return dateOf(F, Math.max(0, Math.min(F.day ?? 0, F.days - 1))).getTime()
  if (F.phase === 'post') return last
  if (F.phase === 'playin' || F.phase === 'playoffs' || F.phase === 'done') return po(F.po?.night ?? 0)
  if (F.phase === 'off') {
    const y = F.year + 1, fin = po(F.po?.night ?? 28)
    const step = F.off?.step
    if (step === 'awards') return fin + DAY
    if (step === 'lottery') return fin + 2 * DAY
    if (step === 'draft') return Math.max(fin + 4 * DAY, md(y, 6, 25))
    if (step === 'resign') return Math.max(fin + 6 * DAY, md(y, 6, 29))
    if (step === 'fa') return Math.max(fin + 7 * DAY, md(y, 6, 30)) + Math.max(0, F.off?.day ?? 0) * DAY
    if (step === 'camp') return md(y, 9, 29)
  }
  return null
}
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
// an item's date on the wire: 'FEB 3' within the last ten months, 'JUL 2, 2027' further back; an item from a save
// made before the dates were kept: its day this season, the season before that
export function wireDate(F, n) {
  if (n.t != null) {
    const x = new Date(n.t * DAY), now = wireTime(F)
    const old = now != null && now - n.t * DAY > 300 * DAY
    return `${MON[x.getUTCMonth()]} ${x.getUTCDate()}${old ? `, ${x.getUTCFullYear()}` : ''}`
  }
  if (n.d != null && n.y === F.year && F.cal0 != null) { const x = dateOf(F, n.d); return `${MON[x.getUTCMonth()]} ${x.getUTCDate()}` }
  return `${n.y}-${String((n.y + 1) % 100).padStart(2, '0')}`
}

// ── What makes the wire ──────────────────────────────────────────────────────
// an injury: a star out a week or more, a top-60 man out three weeks, a rotation man out two months or the season,
// anyone on the GM's team; a qualifying offer: a real man or a good one
const manNamed = (F, s, text) => [...(F.teams?.[s]?.r ?? []), ...(F.fa ?? [])].find(p => text.startsWith(`${p.n} `)) ?? null
export function newsWorthy(F, n) {
  if (n.s && n.s === F.team) return true
  if (n.k === 'inj') {
    const p = n.i != null ? manOf(F, n.i) : null
    if (!p) return true
    if (p.b != null) return true
    const g = n.g ?? p.inj?.g ?? 0
    // (by his place in the league, not his number: the 25 best, the 60 best, a rotation man)
    let rk = 0
    for (const t of Object.values(F.teams)) for (const x of t.r) if (x.o > p.o) rk++
    return (rk < 25 && g >= 5) || (rk < 60 && g >= 10) || (rk < 150 && (g >= 25 || !!p.inj?.se))
  }
  if (n.tag === 'QUALIFYING OFFER') {
    const p = manNamed(F, n.s, n.text)
    return !!p && ((p.h && p.o >= 72) || p.o >= 77)
  }
  return true
}
// the stories that last past their season
export const LASTING = new Set(['champ', 'award', 'draft', 'trade', 'record', 'retire', 'gm', 'ext', 'sheet', 'as', 'asg', 'tax'])
const lasting = (F, n) => LASTING.has(n.k) || (n.k === 'sign' && n.tag !== 'QUALIFYING OFFER') || (n.s === F.team && n.k !== 'inj')
export function trimNews(F, L) {
  if (L.length <= NEWS_MAX) return L
  let over = L.length - NEWS_MAX
  const drop = new Set()
  for (let k = L.length - 1; k >= 0 && over > 0; k--) if (L[k].y < F.year && !lasting(F, L[k])) { drop.add(k); over-- }
  return (drop.size ? L.filter((_, k) => !drop.has(k)) : L).slice(0, NEWS_MAX)
}
// ── One style for every item ─────────────────────────────────────────────────
// A wire item is a sentence, or a few: it ends with a period (one: "Derrick Jones Jr." already has his, and a list of
// names ending on a "Jr." mid-item doesn't get a second), with no space before it.
export const wireText = t => {
  let x = String(t ?? '').trim().replace(/\s+/g, ' ').replace(/([A-Za-z0-9)])\.\.(?!\.)/g, '$1.').replace(/\s+([.,;:])/g, '$1')
  if (x && !/[.!?]["')\]]?$/.test(x)) x += '.'
  return x
}
// The postseason as the wire says it. A round that's set is a sentence with its matchups in it (never the bare
// "Rockets-76ers"); the Finals' result carries the series score.
const CONF_WORD = { E: 'East', W: 'West' }
const listOf = a => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)
const nickOf = s => TEAM[s]?.nick ?? s
// rd 0..3 (first round, conference semifinals, conference finals, the Finals); S: the round's series ({ hi, lo, c });
// seed(s): a team's seed in its conference, for the first round
export function roundSetText(rd, S, seed = null) {
  const by = c => S.filter(x => x.c === c)
  const vs = x => `the ${nickOf(x.hi)} against the ${nickOf(x.lo)}`
  if (rd >= 3) { const x = S[0]; return x ? `The NBA Finals are set: the ${nickOf(x.hi)} have home-court advantage against the ${nickOf(x.lo)}` : '' }
  if (rd === 2) return `The conference finals are set: ${['E', 'W'].filter(c => by(c).length).map(c => `${vs(by(c)[0])} in the ${CONF_WORD[c]}`).join(', ')}`
  if (rd === 1) return `The conference semifinals are set. ${['E', 'W'].filter(c => by(c).length).map(c => `${CONF_WORD[c]}: ${listOf(by(c).map(vs))}`).join('. ')}`
  const one = x => `the ${seed ? `No. ${seed(x.hi)} ` : ''}${nickOf(x.hi)} against the ${seed ? `No. ${seed(x.lo)} ` : ''}${nickOf(x.lo)}`
  return `The playoff field is set. ${['E', 'W'].filter(c => by(c).length).map(c => `${CONF_WORD[c]}: ${listOf(by(c).map(one))}`).join('. ')}`
}
// the title: who beat whom, the series score, the Finals MVP
export function champText(S, mvp = null) {
  const w = S.done, l = w === S.hi ? S.lo : S.hi, lw = Math.min(S.wh ?? 0, S.wl ?? 0)
  return `The ${TEAM[w]?.name ?? w} are NBA champions, ${lw === 0 ? `sweeping the ${nickOf(l)}` : `beating the ${nickOf(l)} 4-${lw}`} in the Finals${mvp ? `. ${mvp} is the Finals MVP` : ''}`
}
// an older save's wire, brought to the one style: every item a sentence with its period, the bare matchup lines
// ("Rockets-76ers") and the second item a coaching hire used to post ("... leaves the Suns bench to become head
// coach of the Kings", beside "The Kings have hired Suns lead assistant ...") dropped
const NICK = '[A-Z0-9][A-Za-z0-9]*(?: [A-Z][a-z]+)?'
const BARE = new RegExp(`^${NICK}-${NICK}(?:, ${NICK}-${NICK})*\\.?$`)
export function fixWire(F) {
  if (!Array.isArray(F?.news) || F.wv === 1) return
  F.news = F.news.filter(n => n?.text && !(n.k === 'po' && BARE.test(n.text)) && !(n.k === 'coach' && n.tag === 'STAFF' && / bench to become head coach of the /.test(n.text)))
  for (const n of F.news) n.text = wireText(n.text)
  F.wv = 1
}
export function addNews(F, item) {
  if (!item?.text) return
  const n = { d: F.phase === 'season' ? F.day : null, y: F.year, ...item, text: wireText(teamWords(item.text)) }
  const t = wireTime(F)
  if (t != null && n.t == null) n.t = Math.floor(t / DAY)
  if (!newsWorthy(F, n)) return
  F.news = trimNews(F, [n, ...(F.news ?? [])])
}
export const newsFor = (F, s) => (F.news ?? []).filter(x => !s || x.s === s)

// ── The wire's filters (the League screen) ───────────────────────────────────
export const WIRE_FILTERS = [['all', 'All'], ['trade', 'Trades'], ['sign', 'Signings'], ['inj', 'Injuries'], ['award', 'Awards']]
const KIND_OF = { trade: 'trade', sign: 'sign', ext: 'sign', sheet: 'sign', option: 'sign', fa: 'sign', cut: 'sign', inj: 'inj', award: 'award', champ: 'award', as: 'award', asg: 'award', record: 'award' }
export const wireKind = n => KIND_OF[n.k] ?? 'other'

// ── An injury as the wire says it ────────────────────────────────────────────
// out for the season (a torn ACL or an Achilles), the rest of the regular season (more games than his team has
// left), weeks for a long one, games for the rest; in the playoffs, out for the rest of them
export function injuryText(F, p, x) {
  const g = x.g
  const po = F.phase === 'playin' || F.phase === 'playoffs'
  const left = F.phase === 'season' ? (F.sched ?? []).filter(m => m.hs == null && (m.h === x.s || m.a === x.s)).length : 0
  const who = `${p.n} (${x.k})`
  if (p.inj?.se) return `${who} is out for the season`
  if (F.phase === 'season' && g >= left) return `${who} will miss the rest of the regular season`
  if (po && g >= 12) return `${who} is out for the rest of the playoffs`
  return `${who} is expected to miss ${g >= 14 ? `${Math.round(g / 3.5)} weeks` : `${g} ${g === 1 ? 'game' : 'games'}`}`
}
