// Career's team interviews (lib/careerPress.js, the lore in data/team-lore-*.js), loaded the way the app loads them.
//   A  the lore: every team of every sport Career plays has its own, with real team codes in it
//   B  every team x position x situation, on today's roster and on one where everybody has retired: every question
//      is a whole sentence (no "undefined", no stray braces), names only its own team's men, asks a man about the
//      greats at his own position, never names a man on the roster as if he were gone, and has three answers
//   C  through the Career itself: the rooms before the draft, the press conference after it, and the same man traded
//      to every team; what each answer does (reputation, the team, the vow)
//   D  whole careers: what he is asked year by year, and the season's cards that read the lore
// Prints a sample for every team. Run from the repo root:
//   node scripts/moments/interview-check.mjs            (the checks, a sample per team)
//   node scripts/moments/interview-check.mjs --all      (every question every team can ask, for reading)
import { createServer } from 'vite'

globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null }, setItem(k, v) { this._m.set(k, String(v)) }, removeItem(k) { this._m.delete(k) }, clear() { this._m.clear() }, key: () => null, length: 0 }
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const C = await server.ssrLoadModule('/src/lib/career.js')
const P = await server.ssrLoadModule('/src/lib/careerPress.js')
const { seeded } = await server.ssrLoadModule('/src/lib/rng.js')
const SX = { soccer: await server.ssrLoadModule('/src/lib/careerSoccer.js') }
await C.ensureSport('soccer')
for (const sp of ['nfl', 'bucket', 'soccer']) await C.ensureLore(sp)
const ALL = process.argv.includes('--all')
const SEASONS = Number(process.argv.find(a => /^--seasons=/.test(a))?.split('=')[1] ?? 9)

let bad = 0
const fail = (...a) => { bad++; console.log('  FAIL', ...a) }
const SPORTS = ['nfl', 'bucket', 'soccer']
// the positions a team is asked about, and basketball's five spots
const CASES = { nfl: ['qb', 'rb', 'wr', 'te', 'ol', 'dl', 'lb', 'db', 'k'].map(p => [p, null]), bucket: [['guard', 'PG'], ['guard', 'SG'], ['guard', 'SF'], ['big', 'PF'], ['big', 'C']], soccer: [['st', null]] }
const nickOf = (S, short) => S.teamOf(short).nick ?? S.teamOf(short).name.split(' ').slice(-1)[0]
const rosterNames = (sport, short) => Object.values(C.makeRoster(short, sport, 0) ?? {}).filter(Array.isArray).flat().map(p => p?.name).filter(Boolean)

// ── A: the lore ───────────────────────────────────────────────────────────────
console.log('A · the lore')
const LEGENDS = {}   // sport → name → Set(teams)
for (const sport of SPORTS) {
  const S = C.SPORT[sport], shorts = new Set(S.teams.map(t => t.short))
  let n = 0, men = 0
  for (const t of S.teams) {
    const L = P.loreOf(sport, t.short)
    if (!L) { fail(sport, t.short, 'has no lore'); continue }
    n++
    if (!L.town || !L.mark) fail(sport, t.short, 'no town or no mark')
    if (sport !== 'soccer' && !L.ache) fail(sport, t.short, 'no ache')
    for (const k of Object.keys(L.rivals ?? {})) if (!shorts.has(k) || k === t.short) fail(sport, t.short, 'rival is not a team in this sport:', k)
    for (const [key, list] of Object.entries(L.g ?? {})) for (const l of list) {
      men++
      if (!l.name || !l.did || /\.$/.test(l.did) || /^[A-Z]/.test(l.did)) fail(sport, t.short, key, 'a line that does not finish "<name> ...":', l.name, '|', l.did)
      if (/\b(still|only|never|most ever|to this day)\b/i.test(l.did) && !/people still replay/.test(l.did) && !/never (played for|left|had a season|threw an interception|missed)/.test(l.did) && !/without ever/.test(l.did)) fail(sport, t.short, 'a line a career could make untrue:', l.name, '|', l.did)
      ;((LEGENDS[sport] ??= {})[l.name] ??= new Set()).add(t.short)
    }
    if (sport === 'nfl') for (const p of ['qb', 'rb', 'wr', 'ol', 'dl', 'lb', 'db']) if (!L.g?.[p]?.length) fail(sport, t.short, 'no great at', p)
    if (sport === 'bucket') for (const p of ['guard', 'wing', 'big']) if (!L.g?.[p]?.length) fail(sport, t.short, 'no great at', p)
    for (const [key, v] of Object.entries(L.rec ?? {})) if (!Array.isArray(v) || typeof v[1] !== 'number' || !v[0]) fail(sport, t.short, 'a record that is not [name, number]:', key)
  }
  const extra = Object.keys(sport === 'nfl' ? (await server.ssrLoadModule('/src/data/team-lore-nfl.js')).NFL_LORE : sport === 'bucket' ? (await server.ssrLoadModule('/src/data/team-lore-nba.js')).NBA_LORE : (await server.ssrLoadModule('/src/data/team-lore-soccer.js')).SOCCER_LORE).filter(k => !shorts.has(k))
  if (extra.length) fail(sport, 'lore for a team Career does not play:', extra.join(' '))
  const own = sport === 'soccer' ? S.teams.filter(t => P.loreOf(sport, t.short)?.g?.st?.length).length : n
  console.log(`  ${sport}: ${n} of ${S.teams.length} teams, ${men} greats${sport === 'soccer' ? `, ${own} clubs with a striker of their own (the rest: their own history and the league's questions)` : ''}`)
}
// the greats the lore names who are on that team's roster today (asked about in the present, never as if gone)
for (const sport of SPORTS) {
  const S = C.SPORT[sport], here = []
  for (const t of S.teams) { const ro = new Set(rosterNames(sport, t.short)); for (const l of Object.values(P.loreOf(sport, t.short)?.g ?? {}).flat()) if (ro.has(l.name)) here.push(`${l.name} (${t.short})`) }
  console.log(`  ${sport}, on the roster today: ${here.join(', ') || 'none'}`)
}

// ── B: every team x position x situation ─────────────────────────────────────
console.log('\nB · every team x position x situation')
const BAD_TEXT = /undefined|null|NaN|\[object|[{}]|  |\.\.|\?\?|,\.| \.| ,|^\s|\s$/
const checkText = (where, s) => { if (typeof s !== 'string' || !s.trim() || BAD_TEXT.test(s)) fail(where, 'bad text:', JSON.stringify(s)) }
const ACTIVE = Object.fromEntries(SPORTS.map(sp => [sp, C.SPORT[sp].teams.flatMap(t => rosterNames(sp, t.short))]))
function viewOf(sport, t, pos, spot, { empty = false, sit = 'arrive' } = {}) {
  const S = C.SPORT[sport], names = empty ? [] : rosterNames(sport, t.short)
  const R = P.recordStat(pos), rec = R ? P.loreOf(sport, t.short)?.rec?.[R.key] : null
  const year = 2026 + (sport === 'nfl' ? 0 : 1) + (empty ? 14 : 0)
  // (a record in reach, or one he just passed: the two record questions)
  const chase = rec ? P.recordChase({ sport, team: t.short, pos, totals: { [R.key]: sit === 'passed' ? rec[1] + 40 : Math.round(rec[1] * 0.97) }, last: { [R.key]: Math.round(rec[1] * 0.08) }, roster: names }) : null
  const room = empty ? [] : (C.makeRoster(t.short, sport, 0)?.[pos] ?? []).slice().sort((a, b) => b.ovr - a.ovr)
  return {
    sport, team: t.short, name: S.teamOf(t.short).name, nick: nickOf(S, t.short), pos, spot, player: 'Cole Norwood', league: S.teamOf(t.short).league ?? null,
    year, roster: names, active: empty ? [] : ACTIVE[sport], star: room[0] && room[0].ovr >= 84 ? { name: room[0].name, ovr: room[0].ovr } : null, ahead: true, starter: false,
    ovr: 90, rep: 8, here: sit === 'arrive' || sit === 'drafted' ? 0 : 8, proYears: sit === 'drafted' ? 0 : 5, first: sit === 'arrive' || sit === 'drafted', how: sit === 'drafted' ? 'draft' : 'trade', top: true,
    titlesHere: sit === 'champion' || sit === 'passed' ? [year - 1] : [], alsoWon: [], lastHere: sit === 'champion' || sit === 'passed' ? { wins: 13, losses: 4, champion: true } : null,
    real: sport === 'nfl' ? { w: 4, l: 13, rec: '4-13' } : null, chase,
  }
}
const samples = {}   // sport → team → lines
let qCount = 0
for (const sport of SPORTS) {
  const S = C.SPORT[sport], byTeam = {}
  for (const [ti, t] of S.teams.entries()) {
    const L = P.loreOf(sport, t.short)
    if (!L) continue
    const mineNames = new Set(Object.values(L.g ?? {}).flat().map(l => l.name)), ownTexts = new Set(), out = (samples[sport] ??= {})[t.short] = []
    const holders = new Set(Object.values(L.rec ?? {}).map(v => v[0]))
    const ownWords = L.mark + (L.ache ?? '') + Object.values(L.rivals ?? {}).join(' ')   // (its own history can name a man from the other side: Bird stole the ball)
    for (const [ci, [pos, spot]] of CASES[sport].entries()) for (const empty of [false, true]) for (const sit of ['arrive', 'passed']) {
      const v = viewOf(sport, t, pos, spot, { empty, sit })
      const all = P.everyQuestion(v)
      if (!all) { fail(sport, t.short, pos, 'no questions at all'); continue }
      const key = P.loreKey(sport, pos, spot), mine = L.g?.[key] ?? [], ro = new Set(v.roster)
      const near = sport === 'bucket' && !mine.length ? (key === 'guard' ? L.g?.wing : key === 'wing' ? L.g?.guard : []) ?? [] : []
      const atPos = new Set([...mine, ...near].map(l => l.name))
      for (const [s, list] of Object.entries(all)) for (const q of list) {
        qCount++
        const where = `${sport} ${t.short} ${pos}${spot ? '/' + spot : ''} ${s} ${q.id}`
        checkText(where, q.q)
        if (!/[?]$/.test(q.q)) fail(where, 'not a question:', q.q)
        if (!q.answers?.length) fail(where, 'no answers')
        for (const set of q.answers ?? []) { if (set.length !== 3) fail(where, 'not three answers'); for (const a of set) { checkText(where + ' answer', a.t); if (s === 'room' ? !(typeof a.stock === 'number' && a.persona) : !P.PRESS_TONES[a.tone]) fail(where, 'an answer with no effect:', a.t) } }
        for (const n of q.names) {
          if (!q.q.includes(n)) fail(where, 'names a man the text does not:', n)
          // the wrong team: a man it names is one of this team's greats, its record holder, or on its roster
          if (!mineNames.has(n) && !holders.has(n) && !ro.has(n)) fail(where, 'names a man who is not this team\'s:', n)
          // as if he were gone: a legacy or a number question never names a man on the roster
          if (ro.has(n) && !['beside', 'star'].includes(q.kind)) fail(where, 'names a man on the roster as if he were gone:', n)
        }
        // the wrong position: the greats a man is measured against played his position
        if (['legacy', 'beside', 'veteran'].includes(q.kind)) for (const n of q.names) if (!atPos.has(n)) fail(where, 'asks a', key, 'about a man who did not play it:', n)
        // any other team's great in the text (a name this team does not also claim)
        // (the league's own question names the league's great; a name inside one of this team's own names is not another man)
        if (q.kind !== 'league') for (const [n, teams] of Object.entries(LEGENDS[sport] ?? {})) if (!teams.has(t.short) && !holders.has(n) && !ro.has(n) && q.q.includes(n) && ![...mineNames].some(m => m.includes(n)) && !ownWords.includes(n)) fail(where, 'names another team\'s man:', n)
        if (!q.sound) fail(where, 'a question the roster rules out was offered')
        if (['legacy', 'beside', 'veteran', 'mark', 'icon', 'wait', 'champion'].includes(q.kind)) ownTexts.add(q.q)
      }
      // a sample for reading: one question per situation, a different position for each team
      if (!empty && sit === 'arrive' && ci === ti % CASES[sport].length) {
        const r = seeded(`sample-${sport}-${t.short}`)
        const one = l => (l.length ? l[Math.floor(r() * l.length)] : null)
        // (each situation from a view of that situation: a champion's has a title in it, a veteran's eight seasons)
        const vet = P.everyQuestion(viewOf(sport, t, pos, spot, { sit: 'passed' }))
        for (const s of ['room', 'drafted', 'arrive', 'champion', 'record', 'veteran', 'drought']) { const q = one((['champion', 'veteran', 'drought'].includes(s) ? vet : all)[s] ?? []); if (q) out.push(`    ${s.padEnd(8)} ${q.who ? `[${q.who}] ` : ''}${q.q}${s === 'arrive' || s === 'room' ? `\n               → ${q.answers[0].map(a => `${a.t} (${a.tone ?? `${a.stock > 0 ? '+' : ''}${a.stock}`})`).join(' | ')}` : ''}`) }
        const late = P.everyQuestion(viewOf(sport, t, pos, spot, { empty: true }))
        const q2 = one((late.arrive ?? []).filter(q => q.kind === 'legacy')); if (q2) out.push(`    ${'later'.padEnd(8)} ${q2.q}`)
        out.unshift(`  ${S.teamOf(t.short).name} · ${pos}${spot ? '/' + spot : ''}`)
      }
      if (ALL && !empty && sit === 'arrive') for (const [s, list] of Object.entries(all)) for (const q of list) (byTeam[t.short] ??= new Set()).add(`${s}: ${q.q}`)
    }
    // its own questions: at least four that no other team could be asked
    if (ownTexts.size < 4) fail(sport, t.short, 'fewer than four questions of its own:', ownTexts.size)
    byTeam[`#${t.short}`] = ownTexts
  }
  // no two teams share one of their own questions word for word
  const seen = new Map()
  for (const t of S.teams) for (const q of byTeam[`#${t.short}`] ?? []) { if (seen.has(q) && seen.get(q) !== t.short) fail(sport, 'the same question for two teams:', seen.get(q), t.short, q); seen.set(q, t.short) }
  if (ALL) for (const t of S.teams) { console.log(`\n  ── ${S.teamOf(t.short).name}`); for (const q of [...(byTeam[t.short] ?? [])].sort()) console.log('    ' + q) }
}
console.log(`  ${qCount} questions read`)
if (!ALL) for (const sport of SPORTS) { console.log(`\n  ${sport.toUpperCase()}: a sample per team`); for (const lines of Object.values(samples[sport] ?? {})) console.log(lines.join('\n')) }

// ── C: through the Career ────────────────────────────────────────────────────
console.log('\nC · through the Career: the rooms, the first press conference, a trade to every team')
const strong = (S, pos, v = 10) => Object.fromEntries(S.types[pos].map(t => { const p = S.pool[pos].find(x => x.attrs) ?? {}; return [t, { type: t, val: v, qb: p.short || p.name, qbFull: p.name, team: p.team, number: p.number, subpos: p.subpos ?? null, pos: p.pos }] }))
function start(sport, pos, spot, i, v = 10) {
  const S = C.SPORT[sport]
  let c = { ...C.newCareer({ sport, pos, build: strong(S, pos, v), name: 'Cole Norwood', owner: 'Guest', games: 'off', slot: 0, ...(spot ? { spot } : {}) }), seed: `ivw-${sport}-${pos}-${spot ?? ''}-${i}` }
  c = C.setupInterviews(C.skipCombine(c))
  return c
}
let rooms = 0, loreRooms = 0, dealt = 0
const tones = {}
for (const sport of SPORTS) {
  const S = C.SPORT[sport]
  for (const [pos, spot] of CASES[sport]) for (let i = 0; i < 6; i++) {
    let c
    try { c = start(sport, pos, spot, i, i % 2 ? 6 : 10) } catch (e) { fail(sport, pos, 'career did not start:', e.message); continue }
    const list = c.draft.interviews ?? []
    if (list.length < 3) fail(sport, pos, 'fewer than three rooms:', list.length)
    const kinds = new Set()
    for (const x of list) {
      rooms++
      const where = `${sport} ${pos} room ${x.team}`
      checkText(where, x.q); checkText(where, x.who)
      if (x.a?.length !== 3 || x.a.some(a => typeof a.stock !== 'number' || !a.persona)) fail(where, 'answers are not the three with a stock and a persona')
      for (const a of x.a ?? []) checkText(where, a.t)
      if (x.lore) {
        loreRooms++
        const L = P.loreOf(sport, x.team), ro = new Set(rosterNames(sport, x.team)), ok = new Set([...Object.values(L.g ?? {}).flat().map(l => l.name), ...ro])
        const ownWords = L.mark + (L.ache ?? '') + Object.values(L.rivals ?? {}).join(' ')
        for (const [n, teams] of Object.entries(LEGENDS[sport] ?? {})) if (x.q.includes(n) && !ok.has(n) && !teams.has(x.team) && ![...ok].some(m => m.includes(n)) && !ownWords.includes(n) && !/^room-league/.test(x.lore)) fail(where, 'names another team\'s man:', n, '|', x.q)
        const kind = x.lore.split('|')[0]
        if (kinds.has(kind)) fail(where, 'two rooms asked the same kind of question:', kind)
        kinds.add(kind)
      }
    }
    if (JSON.stringify(C.setupInterviews(c).draft.interviews) !== JSON.stringify(list)) fail(sport, pos, 'the rooms are not the same when set up twice')
    // answered, drafted, into camp
    for (let k = 0; k < list.length; k++) c = C.answerInterview(c, k, k % 3)
    c = C.runDraft(c)
    if (!c.team && c.draft?.offers?.length) c = SX[sport].signAcademy(c, c.draft.offers[0])
    c = { ...c, phase: 'preseason', step: null }
    const q = C.pressFor(c)
    if (!q) { fail(sport, pos, c.team, 'no press conference after the draft'); continue }
    if (sport !== 'soccer' && q.sit !== 'drafted') fail(sport, pos, 'a rookie asked as', q.sit)
    if (JSON.stringify(C.pressFor(c)) !== JSON.stringify(q)) fail(sport, pos, 'the question changes when asked twice')
    checkText(`${sport} ${pos} press`, q.q)
    // each answer, and no comment: what it does
    for (let k = -1; k < 3; k++) {
      const n = C.answerPress(c, k), a = q.a[k], T = a ? P.PRESS_TONES[a.tone] : null
      if (C.pressFor(n)) fail(sport, pos, 'still asked after answering')
      if (k < 0) { if (n.rep !== c.rep || JSON.stringify(n.nextMods ?? null) !== JSON.stringify(c.nextMods ?? null) || C.pressSaid(n)) fail(sport, pos, 'no comment changed something') ; continue }
      tones[a.tone] = (tones[a.tone] ?? 0) + 1
      const said = C.pressSaid(n)
      if (!said?.tag || !said.line) fail(sport, pos, 'nothing said under the answer'); else checkText('said', said.line)
      if ((T.rep ?? 0) !== n.rep - c.rep) fail(sport, pos, a.tone, 'reputation moved', n.rep - c.rep)
      const side = ['db', 'dl', 'lb'].includes(pos) ? 'def' : 'off', moved = (n.nextMods?.[side] ?? 0) - (c.nextMods?.[side] ?? 0)
      if ((T.side ?? 0) !== moved) fail(sport, pos, a.tone, 'the team moved', moved)
      if (!!T.vow !== (n.press.vow === c.seasons.length)) fail(sport, pos, a.tone, 'the vow')
      // the season starts with it
      if (i === 0 && k === 0) { try { C.startSeason(n) } catch (e) { fail(sport, pos, 'the season did not start after the press conference:', e.message) } }
    }
    // the same man, five years on, traded to every team in the league
    if (i > 1) continue
    for (const t of S.teams) {
      if (t.short === c.team) continue
      const old = { team: c.team, season: c.season, wins: 9, losses: 8, stats: {}, goals: [], champion: false }
      const moved = { ...c, team: t.short, roster: undefined, seasons: [old, old, old, old, old].map((s, k) => ({ ...s, season: c.season + k })), year: 5, season: c.season + 5, age: c.age + 5, press: null,
        decisions: [...c.decisions, { year: 5, text: sport === 'soccer' ? `Signed for ${S.teamOf(t.short).name}` : `Traded to the ${nickOf(S, t.short)}` }] }
      let p
      try { p = C.pressFor(moved) } catch (e) { fail(sport, pos, 'traded to', t.short, e.message); continue }
      if (!p) { fail(sport, pos, 'traded to', t.short, 'and nobody asked him anything'); continue }
      dealt++
      if (p.sit !== 'arrive') fail(sport, pos, t.short, 'a new man asked as', p.sit)
      checkText(`${sport} ${pos} → ${t.short}`, p.q)
      const L = P.loreOf(sport, t.short), ro = new Set(rosterNames(sport, t.short)), holders = new Set(Object.values(L.rec ?? {}).map(v => v[0]))
      for (const n of p.names) if (!Object.values(L.g ?? {}).flat().some(l => l.name === n) && !holders.has(n) && !Object.values(C.CAREER_X.rosterFor(moved, t.short) ?? {}).filter(Array.isArray).flat().some(x => x.name === n)) fail(sport, pos, '→', t.short, 'names a man who is not that team\'s:', n)
    }
  }
}
console.log(`  ${rooms} rooms, ${loreRooms} with the team's own question (${Math.round(loreRooms / Math.max(1, rooms) * 100)}%); ${dealt} trades, every one asked about; answers by tone: ${Object.entries(tones).map(([k, v]) => `${k} ${v}`).join(', ')}`)

// the owner's example: a guard traded to Golden State
{
  const c0 = C.runDraft((() => { let c = start('bucket', 'guard', 'PG', 99); for (let k = 0; k < c.draft.interviews.length; k++) c = C.answerInterview(c, k, 0); return c })())
  const old = { team: c0.team, season: c0.season, wins: 41, losses: 41, stats: {}, goals: [], champion: false }
  for (const [label, yrs] of [['traded to Golden State in his second year', 1], ['traded to Golden State in his fourth year', 3], ['traded to Golden State in his sixteenth year', 15]]) {
    const seen = new Map(), N = 200
    for (let i = 0; i < N; i++) {
      const c = { ...c0, seed: `gsw-${i}`, phase: 'preseason', team: 'GSW', roster: undefined, seasons: Array.from({ length: yrs }, (_, k) => ({ ...old, team: c0.team === 'GSW' ? 'LAL' : c0.team, season: c0.season + k })), year: yrs, season: c0.season + yrs, age: c0.age + yrs, press: null, decisions: [...c0.decisions, { year: yrs, text: 'Traded to the Warriors' }] }
      const q = C.pressFor(c); if (q) seen.set(q.q, (seen.get(q.q) ?? 0) + 1)
    }
    console.log(`\n  A point guard ${label} (how often, of ${N} careers):`); for (const [q, n] of [...seen].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${q}`)
    const curry = [...seen].filter(([q]) => /Stephen Curry/.test(q)).reduce((a, [, n]) => a + n, 0)
    if (![...seen.keys()].some(q => /Stephen Curry/.test(q) && /legacy/.test(q))) fail('the Curry question never came up', label)
    if (curry < N * 0.5) fail('a guard traded to Golden State is asked about Stephen Curry less than half the time:', curry, 'of', N, label)
  }
}

// ── D: whole careers ──────────────────────────────────────────────────────────
console.log(`\nD · whole careers (${SEASONS} seasons each): what he is asked, and the season's cards that read the lore`)
const CARDS = /^(RIVALRY WEEK|RIVALRY ·|RECORD WATCH|PLAYOFF MEDIA DAY)/
const cardSeen = {}, sitSeen = {}
function playCareer(sport, pos, spot, i, toTeam = null) {
  const S = C.SPORT[sport], r = seeded(`car-${sport}-${pos}-${i}`)
  let c = start(sport, pos, spot, `d${i}`)
  for (let k = 0; k < c.draft.interviews.length; k++) c = C.answerInterview(c, k, 0)
  c = C.runDraft({ ...c, ...(toTeam ? { draftTeam: toTeam } : {}) })
  if (!c.team && c.draft?.offers?.length) c = SX[sport].signAcademy(c, c.draft.offers[0])
  c = { ...c, phase: 'preseason', step: null }
  const log = []
  for (let yr = 0; yr < SEASONS; yr++) {
    const q = C.pressFor(c)
    if (q) {
      checkText(`career ${sport} ${pos} y${yr + 1}`, q.q)
      if ((c.press?.seen ?? []).includes(q.id) && q.kind !== 'champion') log.push(`      (asked again: ${q.id})`)
      sitSeen[q.sit] = (sitSeen[q.sit] ?? 0) + 1
      const k = Math.floor(r() * 3), rep0 = c.rep
      c = C.answerPress(c, k)
      log.push(`    ${c.season} ${c.team} ${q.sit.padEnd(8)} ${q.q}\n               → ${q.a[k].t} [${q.a[k].tone}${c.rep !== rep0 ? `, reputation ${rep0} → ${c.rep}` : ''}]`)
    }
    let D; [c, D] = C.startSeason(c)
    for (let g = 0; g < 1500 && c.phase === 'season' && (c.active.k < D.total || c.active.moment || c.active.injury); g++) {
      if (C.byeNow?.(c)) { c = C.byeRest(c, D); continue }
      if (c.active.injury) { c = C.resolveInjury(c, D, false, false)[0]; continue }
      if (c.active.moment) {
        const m = c.active.moment
        if (CARDS.test(m.kicker ?? '')) {
          const kind = m.kicker.match(CARDS)[1]
          cardSeen[kind] = (cardSeen[kind] ?? 0) + 1
          checkText(`card ${m.id}`, m.body); checkText(`card ${m.id}`, m.title); for (const o of m.options) { checkText(`card ${m.id}`, o.label); checkText(`card ${m.id}`, o.sub) }
          if (cardSeen[kind] <= 2) log.push(`    ${c.season} ${c.team} card     ${m.kicker} · ${m.title}: ${m.body}\n               → ${m.options.map(o => `${o.label} (${o.sub})`).join(' | ')}`)
        }
        c = C.chooseMoment(c, D, m.options[Math.floor(r() * m.options.length)])[0]; continue
      }
      c = C.advanceWeek(c, D)[0]
    }
    if (c.phase === 'season') c = C.finishRegular(c, D)
    for (let g = 0; g < 40 && c.phase === 'season' && c.active?.po && c.active.po.stage !== 'done'; g++) c = C.playoffRound(c, null)
    if (c.phase === 'season') c = C.bookSeason(c)
    const s = c.seasons[c.seasons.length - 1]
    const vowed = c.events.filter(e => e.year === c.year + 1 && /on the record/.test(e.text ?? ''))
    for (const e of vowed) log.push(`    ${s.season} ${s.team} after    ${e.text} (reputation ${c.rep})`)
    if (C.mustRetire(c)) break
    if (Array.isArray(c.offers)) { if (!c.offers.length) break; c = C.signOffer(c, r() < 0.6 ? c.offers.find(o => o.kind === 'stay') ?? c.offers[0] : c.offers[Math.floor(r() * c.offers.length)]) }
    if (C.mustRetire(c) || c.contract.left <= 0) break
    c = C.nextSeason(c)
  }
  return { c, log }
}
for (const [sport, pos, spot, to] of [['nfl', 'qb', null, 'CHI'], ['nfl', 'wr', null, 'NYG'], ['nfl', 'rb', null, 'CLE'], ['nfl', 'db', null, 'MIN'], ['nfl', 'dl', null, 'DET'], ['bucket', 'guard', 'PG', 'CHA'], ['bucket', 'big', 'C', 'LAC'], ['bucket', 'guard', 'SF', 'IND'], ['soccer', 'st', null, null]]) {
  for (let i = 0; i < 2; i++) {
    try {
      const { c, log } = playCareer(sport, pos, spot, i, to)
      const rings = c.seasons.filter(s => s.champion).length
      console.log(`\n  ${sport}/${pos}${spot ? '/' + spot : ''} #${i}: ${c.seasons.length} seasons, ${[...new Set(c.seasons.map(s => s.team))].join(' → ')}, ${rings} title${rings === 1 ? '' : 's'}, reputation ${c.rep}`)
      console.log(log.join('\n'))
    } catch (e) { fail(sport, pos, 'a career did not play:', e.stack.split('\n').slice(0, 4).join(' | ')) }
  }
}
console.log(`\n  press conferences by situation: ${Object.entries(sitSeen).map(([k, v]) => `${k} ${v}`).join(', ')}`)
console.log(`  the season's cards that read the lore: ${Object.entries(cardSeen).map(([k, v]) => `${k} ${v}`).join(', ') || 'none came up'}`)

console.log(`\n${bad} problems`)
await server.close()
process.exit(bad ? 1 : 0)
