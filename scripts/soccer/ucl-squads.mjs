// The Champions League clubs' players: who joins the pool (2026-11-16).
// node scripts/soccer/ucl-squads.mjs [rawDir]        (rawDir default F:/bap-agents/socattr/raw)
//
// The wheel's clubs are the 36 of the 2026-27 league phase (UEFA's list; SI's ranking and ESPN's
// uefa.champions teams agree). Each one deals up to 8 non-defenders. The 21 clubs already in the data keep
// every player they have (the owner, 11-16: "keep the current players from these clubs") and are topped up
// to 8; the 15 new clubs get 8. Picks follow the method in data/soccer-strikers.js's header:
//   score = 35% 2026-27 league minutes + 20% 2025-26 league minutes + 45% FotMob market value, each as a share
//   of the club's best; non-defenders only (FotMob squad groups midfielders / attackers, first position not a
//   full-back or centre-back). MUST below keeps the stars a kid expects in by hand; SKIP drops a pick.
// Bio: ESPN's uefa.champions roster (name, shirt number, height, weight, age, ESPN id); a player ESPN doesn't
// list gets FotMob's height and age and no ESPN id (no photo: initials). Role from FotMob's position list.
// Writes scripts/soccer/ucl-additions.json, which grade-nine.mjs reads.
//
// Raw inputs (not in the repo): rawDir/squads/{fotmobTeamId}.json (FotMob squad page data),
// rawDir/espn/{espnTeamId}.json (ESPN roster), rawDir/fotmob/{league}_{season}/mins_played.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const RAW = process.argv[2] ?? 'F:/bap-agents/socattr/raw'
const OUT = path.join(ROOT, 'scripts', 'soccer', 'ucl-additions.json')
const CAP = 8

// short, FotMob team id, ESPN team id, domestic league (ESPN slug), name
export const UCL = [
  ['PSG', 9847, 160], ['ARS', 9825, 359], ['FCB', 9823, 132], ['BAR', 8634, 83], ['MCI', 8456, 382], ['RMA', 8633, 86],
  ['INT', 8636, 110], ['ATM', 9906, 1068], ['MUN', 10260, 360], ['LIV', 8650, 364], ['NAP', 9875, 114], ['BVB', 9789, 124],
  ['AVL', 10252, 362], ['ROM', 8686, 104], ['FCP', 9773, 437], ['CLB', 8342, 570], ['SPO', 9768, 2250], ['PSV', 8640, 148],
  ['LIL', 8639, 166], ['RBL', 178475, 11420], ['VIL', 10205, 102], ['BOD', 8402, 2980], ['GAL', 8637, 432], ['COM', 10171, 2572],
  ['BET', 8603, 244], ['RCL', 8588, 175], ['FEN', 8695, 436], ['SHA', 9728, 493], ['VFB', 10269, 134], ['FEY', 10235, 142],
  ['SLA', 7787, 494], ['SBR', 6019, 521], ['AEK', 8563, 887], ['LSK', 9977, 4411], ['VIK', 8478, 510], ['SAB', 951893, 21922],
]
// Stars kept in by hand (by FotMob name), whatever the minutes say: the famous names a kid expects at the club
// who lost minutes to injury or a slow start (Gyökeres, Ekitiké, Šeško, Dybala, Lukaku) or sit just under the
// cut (Cherki, Doku, Eze, De Jong, Rashford, Isco, Asensio). SKIP: picks left out by name.
const MUST = {
  ARS: ['Viktor Gyökeres', 'Eberechi Eze'], BAR: ['Rodri', 'Frenkie de Jong', 'Dani Olmo'], MCI: ['Rayan Cherki', 'Jérémy Doku', 'Antoine Semenyo'],
  MUN: ['Benjamin Šeško', 'Amad Diallo', 'Marcus Rashford'], LIV: ['Hugo Ekitiké', 'Cody Gakpo', 'Ryan Gravenberch'], ROM: ['Paulo Dybala'],
  BET: ['Isco'], FEN: ['Romelu Lukaku', 'Marco Asensio'],
}
const SKIP = {}
// the data's spelling where FotMob or ESPN uses another (a kept player is never added twice)
const ALIAS = { 'Tasos Douvikas': 'Anastasios Douvikas', 'Cucho Hernández': 'Juan Camilo Hernández', 'Abde Ezzalzouli': 'Abdessamad Ezzalzouli', 'Yassine Titraoui': 'Yacine Titraoui' }

const norm = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ı/g, 'i').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
const toks = s => norm(s).split(' ').filter(Boolean)
// two names are the same player: equal, one's words all in the other's, or a one-word name that is the other's last
export const sameName = (a, b) => { const A = toks(a), B = toks(b); if (!A.length || !B.length) return false; if (A.join(' ') === B.join(' ')) return true; const [s, l] = A.length <= B.length ? [A, B] : [B, A]; return s.length > 1 ? s.every(t => l.includes(t)) : s[0].length > 3 && l[l.length - 1] === s[0] }

// the data's current rows (name, team)
const DATA = fs.readFileSync(path.join(ROOT, 'src', 'data', 'soccer-strikers.js'), 'utf8')
const wcAt = DATA.indexOf('export const WC_STRIKERS')
const rows = [...DATA.slice(0, wcAt).matchAll(/\{ name: "([^"]+)"[^\n]*?team: '([A-Z0-9]+)'[^\n]*?espn: (\d+|null)/g)].map(m => ({ name: m[1], team: m[2], espn: m[3] === 'null' ? null : +m[3] }))
const allNames = rows.map(r => r.name)

// league minutes by FotMob id, per season, from scripts/soccer/fotmob-compact.mjs's file (run that first)
const FMP = JSON.parse(fs.readFileSync(path.join(RAW, 'fotmob-players.json'), 'utf8'))
const CUPS = new Set(['42', '73', '77'])
const mins = new Map()       // league minutes
const cupMins = new Map()    // where FotMob keeps no league minutes table (Ukraine, Azerbaijan): any minutes seen
const byTeamId = new Map()   // FotMob team id -> its players this season (a club with no FotMob squad page)
for (const [id, p] of Object.entries(FMP.players)) {
  for (const [key, line] of Object.entries(p.s)) {
    const L = FMP.leagues[key], k = L.now ? 'm27' : 'm26'
    const into = CUPS.has(L.lid) || line.min == null ? cupMins : mins
    const m = into.get(+id) ?? { m27: 0, m26: 0 }
    m[k] = Math.max(m[k], line.min ?? 0)
    into.set(+id, m)
    if (L.now && line.tid) { if (!byTeamId.has(line.tid)) byTeamId.set(line.tid, []); byTeamId.get(line.tid).push({ ParticiantId: +id, ParticipantName: p.n, ParticipantCountryCode: p.c, Positions: p.pos }) }
  }
}

const DEF = new Set(['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'])
const ROLE = { ST: 'ST', CF: 'ST', LW: 'LW', RW: 'RW', LM: 'LW', RM: 'RW', CAM: 'AM', AM: 'AM', CM: 'CM', CDM: 'DM', DM: 'DM' }
export function roleOf(desc) {
  const p = String(desc ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const r = ROLE[p[0]] ?? 'CM'
  // a wide player or No. 10 whose next spot is up front plays as a second striker
  if ((r === 'LW' || r === 'RW' || r === 'AM') && p[1] === 'ST') return 'SS'
  return r
}
const cmToIn = cm => (cm ? Math.round(cm / 2.54) : null)
// FotMob's numeric position ids (read off the squad pages, which carry both)
const POS_ID = { 11: 'GK', 32: 'RB', 33: 'CB', 34: 'CB', 35: 'CB', 36: 'CB', 37: 'CB', 38: 'LB', 51: 'RWB', 52: 'RWB', 59: 'LWB', 62: 'RWB', 63: 'CDM', 64: 'CDM', 65: 'CDM', 66: 'CDM', 68: 'LWB', 71: 'RM', 72: 'RM', 73: 'CM', 74: 'CM', 75: 'CM', 76: 'CM', 77: 'CM', 78: 'LM', 79: 'LM', 82: 'RW', 83: 'RW', 84: 'CAM', 85: 'CAM', 86: 'CAM', 87: 'LW', 88: 'LW', 103: 'RW', 104: 'ST', 105: 'ST', 106: 'ST', 107: 'LW', 115: 'ST' }
// No FotMob squad page (Shakhtar and Sabah, 11-16): the club's players from its 2026-27 league leaderboards, each
// on ESPN's roster as a midfielder or forward; positions from the leaderboard, no market value (minutes only)
function membersFromBoards(fmId, espn) {
  const seen = new Map()
  for (const e of byTeamId.get(fmId) ?? []) if (!seen.has(e.ParticiantId)) seen.set(e.ParticiantId, e)
  return [...seen.values()].map(e => {
    const a = espn.find(x => sameName(x.displayName, e.ParticipantName) || sameName(x.fullName, e.ParticipantName))
    const desc = [...new Set((e.Positions ?? []).map(n => POS_ID[n]).filter(Boolean))].join(',')
    const g = a?.position?.abbreviation
    return { id: e.ParticiantId, name: e.ParticipantName, positionIdsDesc: desc, ccode: e.ParticipantCountryCode, shirtNumber: a?.jersey != null ? +a.jersey : null, group: g === 'F' ? 'attackers' : g === 'M' ? 'midfielders' : g ? 'other' : (DEF.has(desc.split(',')[0]) ? 'other' : 'midfielders'), transferValue: 0 }
  })
}

const out = { made: '2026-11-16', cap: CAP, clubs: {} }
for (const [short, fmId, espnId] of UCL) {
  const sq = JSON.parse(fs.readFileSync(path.join(RAW, 'squads', `${fmId}.json`), 'utf8'))
  const espn = JSON.parse(fs.readFileSync(path.join(RAW, 'espn', `${espnId}.json`), 'utf8')).athletes ?? []
  const members = sq.squad?.squad ? sq.squad.squad.filter(g => g.title !== 'coach').flatMap(g => g.members.map(m => ({ ...m, group: g.title }))) : membersFromBoards(fmId, espn)
  const have = rows.filter(r => r.team === short)
  const isKept = name => have.some(r => sameName(r.name, name) || (ALIAS[r.name] && sameName(ALIAS[r.name], name)) || (r.espn && espn.find(a => +a.id === r.espn && (sameName(a.displayName, name) || sameName(a.fullName, name)))))
  const keepIds = have.map(r => members.find(m => sameName(m.name, r.name) || (ALIAS[r.name] && sameName(ALIAS[r.name], m.name)))?.id ?? null)
  const cands = members.filter(m => (m.group === 'midfielders' || m.group === 'attackers') && !DEF.has(String(m.positionIdsDesc ?? '').split(',')[0]))
    .filter(m => !isKept(m.name) && !keepIds.includes(m.id))
    .map(m => ({ m, ...(mins.get(m.id)?.m27 || mins.get(m.id)?.m26 ? mins.get(m.id) : cupMins.get(m.id) ?? { m27: 0, m26: 0 }), value: m.transferValue ?? 0 }))
  const mx = k => Math.max(1, ...cands.map(c => c[k]))
  const noValue = cands.every(c => !c.value)
  for (const c of cands) c.score = (noValue ? (0.35 * c.m27 / mx('m27') + 0.20 * c.m26 / mx('m26')) / 0.55 : 0.35 * c.m27 / mx('m27') + 0.20 * c.m26 / mx('m26') + 0.45 * c.value / mx('value')) + ((MUST[short] ?? []).some(n => sameName(n, c.m.name)) ? 10 : 0)
  cands.sort((a, b) => b.score - a.score)
  const need = Math.max(0, CAP - have.length)
  const picks = cands.filter(c => !(SKIP[short] ?? []).some(n => sameName(n, c.m.name)) && !allNames.some(n => sameName(n, c.m.name))).slice(0, need)
  // ESPN's player: the same name, or the same shirt number with the surname (or first name) spelt nearly alike
  // (Gabri Veiga, Samu Aghehowa, Alexey Batrakov, Oussama Targhaline)
  const near = (x, y) => { const A = toks(x), B = toks(y); return A.length && B.length && (A.at(-1).slice(0, 4) === B.at(-1).slice(0, 4) || A[0].slice(0, 3) === B[0].slice(0, 3)) }
  const espnOf = (name, number) => espn.find(a => sameName(a.displayName, name) || sameName(a.fullName, name)) ??
    (number != null ? espn.find(a => a.jersey != null && +a.jersey === +number && near(a.displayName, name)) : null)
  out.clubs[short] = {
    fotmob: fmId, espn: espnId, kept: have.map((r, i) => ({ name: r.name, fotmob: keepIds[i] })),
    added: picks.map(c => {
      const m = c.m, a = espnOf(m.name, m.shirtNumber)
      return {
        // ESPN's spelling, with FotMob's accents when ESPN drops them (Šeško, Ekitiké)
        name: a?.displayName && norm(a.displayName) === norm(m.name) && /[^\x00-\x7f]/.test(m.name) && !/[^\x00-\x7f]/.test(a.displayName) ? m.name : a?.displayName ?? m.name, fotmobName: m.name, fotmob: m.id, espn: a ? +a.id : null,
        number: (a?.jersey != null ? +a.jersey : m.shirtNumber) ?? null,
        height: a?.height ? Math.round(a.height) : cmToIn(m.height), weight: a?.weight ? Math.round(a.weight) : null,
        age: a?.age ?? m.age ?? null, nationCode: m.ccode ?? null, positions: m.positionIdsDesc ?? '', role: roleOf(m.positionIdsDesc),
        m27: c.m27, m26: c.m26, value: c.value, score: Math.round(c.score * 1000) / 1000,
      }
    }),
    nextUp: cands.filter(c => !picks.includes(c)).slice(0, 4).map(c => `${c.m.name} (${c.m.positionIdsDesc}, ${c.m27}/${c.m26} min, €${Math.round(c.value / 1e6)}m)`),
  }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
const n = Object.values(out.clubs).reduce((s, c) => s + c.added.length, 0)
console.log(`${n} players added across ${UCL.length} clubs -> ${path.relative(ROOT, OUT)}`)
for (const [k, c] of Object.entries(out.clubs)) console.log(k, c.kept.length, '+', c.added.length, c.added.map(a => `${a.name}${a.espn ? '' : '*'} ${a.role}`).join(', '), c.kept.some(k => !k.fotmob) ? `  [kept not on FotMob squad: ${c.kept.filter(k => !k.fotmob).map(k => k.name).join(', ')}]` : '')
