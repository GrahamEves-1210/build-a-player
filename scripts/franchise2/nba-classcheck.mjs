// NBA Franchise: the draft class, the builds' picks, the opening data and the camp fill, headless.
//   - builds: every build his own 2026 first-round pick, none shared with a real rookie, a 90+ build first
//   - the class: no folded pathway, ages, no name twice over sixty classes (the retired list counts), the board's tags
//   - scouting reports don't pile up; a build cut off the street gets his year and a wire line
//   - camp: a roster short of 14 can always get there
//   - the data: Holland's deal, service years, the rookies, team colours, payrolls against the data
//   FR_TMP=... bash scripts/franchise2/run.sh scripts/franchise2/nba-classcheck.mjs
import * as N from '../../src/lib/franchise2/nba/index'
import { NBA_DEALS } from '../../src/data/nba-contracts'
import { NBA_GUARD_PLAYERS } from '../../src/data/nba-guards'
import { NBA_BIG_PLAYERS } from '../../src/data/nba-bigs'
let bad = 0
const ok = (c, text) => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${text}`) }
const asB = a => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { val: v }]))
const gs = NBA_GUARD_PLAYERS.filter(p => p.attrs), bs = NBA_BIG_PLAYERS.filter(p => p.attrs)
const rated = (list, pos) => list.map(p => ({ p, o: N.ovrOfAttrs(pos, p.attrs) })).sort((a, b) => b.o - a.o)
const G = rated(gs, 'guard'), B = rated(bs, 'big')
const pickAt = (L, o) => L.slice().sort((a, b) => Math.abs(a.o - o) - Math.abs(b.o - o))[0].p
const allMen = F => [...N.SHORTS.flatMap(s => F.teams[s].r), ...(F.fa ?? [])]

// ── 1. the builds' picks ─────────────────────────────────────────────────────
console.log('slot by OVR:', [70, 72, 75, 80, 85, 88, 90, 95, 99].map(o => `${o}:${N.buildSlot(o)}`).join(' '))
ok(N.buildSlot(90) === 1 && N.buildSlot(95) === 1 && N.buildSlot(99) === 1, 'a 90+ build is the No. 1 pick')
ok(N.buildSlot(89) > 1 && N.buildSlot(72) === 30, 'an 89 goes after the first pick, a 72 last')
ok(JSON.stringify(N.buildSlots([95, 95, 95])) === '[1,2,3]', `three 95s go 1, 2, 3: ${N.buildSlots([95, 95, 95])}`)
ok(new Set(N.buildSlots([70, 70, 70])).size === 3 && Math.max(...N.buildSlots([70, 70, 70])) <= 30, `three 70s keep to the round: ${N.buildSlots([70, 70, 70])}`)
const realFirst = F => allMen(F).filter(p => p.b == null && p.dr?.[0] === 2026 && p.dr[1] === 1)
const base = N.createNbaFranchise({ seed: 'cc0', team: 'WAS', owner: 'QA' })
const order0 = realFirst(base).sort((a, b) => a.dr[2] - b.dr[2]).map(p => p.n)
for (const [tag, team, list] of [
  ['95 guard + 95 big + mid guard', 'WAS', [[G, 'guard', 96], [B, 'big', 96], [G, 'guard', 78]]],
  ['three mid guards', 'CHA', [[G, 'guard', 78], [G, 'guard', 78], [G, 'guard', 78]]],
  ['three low bigs', 'BKN', [[B, 'big', 66], [B, 'big', 66], [B, 'big', 66]]],
  ['one 85', 'ATL', [[G, 'guard', 85]]],
]) {
  const builds = list.map(([L, pos, o], k) => ({ pos, build: asB(pickAt(L, o).attrs), name: `Build ${'ABC'[k]} ${tag.length}`, num: 60 + k }))
  const F = N.createNbaFranchise({ seed: 'cc1', team, owner: 'QA', builds })
  const mine = allMen(F).filter(p => p.b != null)
  const slots = {}
  for (const p of allMen(F).filter(p => p.dr?.[0] === 2026 && p.dr[1] === 1)) (slots[p.dr[2]] ??= []).push(p.n)
  const twice = Object.entries(slots).filter(([, v]) => v.length > 1)
  ok(!twice.length, `${tag}: no 2026 first-round pick held twice${twice.length ? ' ' + JSON.stringify(twice) : ''}`)
  ok(mine.every(p => p.dr[2] >= 1 && p.dr[2] <= 30), `${tag}: builds at ${mine.map(p => `${p.o} -> No. ${p.dr[2]}`).join(', ')}`)
  ok(mine.filter(p => p.o >= 90).every(p => p.dr[2] <= mine.filter(q => q.o >= 90).length), `${tag}: 90+ builds hold the first picks`)
  ok(realFirst(F).every(p => p.dr[2] >= 1 && p.dr[2] <= 30), `${tag}: every real first-rounder still in the first round`)
  ok(JSON.stringify(realFirst(F).sort((a, b) => a.dr[2] - b.dr[2]).map(p => p.n)) === JSON.stringify(order0), `${tag}: the real rookies keep their order`)
  ok(mine.every(p => Math.abs(p.$ - N.CAP_SIM.rookieScale(p.dr[2], 2026)[0]) < 0.06), `${tag}: each build is paid his own pick's scale`)
  const moved = realFirst(F).filter(p => p.dr[2] !== NBA_DEALS[p.n]?.dr?.[2])
  console.log(`     real men a pick off their real one: ${moved.length}${moved.length ? ` (${moved.slice(0, 3).map(p => `${p.n} ${NBA_DEALS[p.n].dr[2]} -> ${p.dr[2]}`).join(', ')}${moved.length > 3 ? ', ...' : ''})` : ''}`)
}

// ── 2. the class ─────────────────────────────────────────────────────────────
const F = N.createNbaFranchise({ seed: 'cc2', team: 'BOS', owner: 'QA' })
const ages = {}, paths = { college: 0, abroad: 0, nbl: 0, ote: 0, gl: 0 }
const tags = { top: {}, rest: {} }, truth = { top: [0, 0], rest: [0, 0] }
let ignite = 0, dupes = 0, n = 0, flagged90 = 0, odd = 0
const ODD = /\b(Bobo|Outlaw|Cheeks|Crump|Pugh|Tubbs)$/
const seen = new Set(N.leagueNames(F))
for (const p of F.dc) seen.delete(p.n)
for (let k = 0; k < 60; k++) {
  if (k) { F.year = 2026 + k; N.makeClass(F) }
  for (const p of F.dc) {
    n++
    if (seen.has(p.n)) dupes++
    seen.add(p.n)
    ages[p.ag] = (ages[p.ag] ?? 0) + 1
    if (/Ignite/.test(p.c)) ignite++
    if (ODD.test(p.n)) odd++
    paths[/NBL Next Stars/.test(p.c) ? 'nbl' : /Overtime Elite/.test(p.c) ? 'ote' : /G League/.test(p.c) ? 'gl' : /\(/.test(p.c) ? 'abroad' : 'college']++
    const b = p.rank <= 10 ? 'top' : 'rest', t = N.rangeOf({ ...p, sc: 2 }).tag
    tags[b][t] = (tags[b][t] ?? 0) + 1
    truth[b][0]++; if (p.pk <= p.o + 2) truth[b][1]++
    if (t === 'BUST' && p.pk >= 88) flagged90++
  }
  // (the class leaves the board: the men go into the league's memory the way the retired list keeps them)
  F.retired = [...F.retired, ...F.dc.map(p => ({ i: p.i, n: p.n }))]
}
const pc = (a, b) => `${(100 * a / b).toFixed(0)}%`
console.log('ages (the age he turns in his draft year):', Object.entries(ages).map(([a, c]) => `${a}: ${pc(c, n)}`).join(' '))
console.log('pathways:', Object.entries(paths).map(([k, c]) => `${k} ${pc(c, n)}`).join(' '))
ok(ignite === 0, 'no G League Ignite')
ok(odd === 0, 'none of the surnames that read as a joke')
ok(dupes === 0, `no name twice over 60 classes (${n} prospects): ${dupes} repeats`)
ok((ages[19] ?? 0) + (ages[20] ?? 0) + (ages[21] ?? 0) + (ages[22] ?? 0) >= n * 0.9 && !ages[18] && !ages[24], 'ages 19 to 22 for nine in ten, none under 19 or over 23')
const share = (b, t) => (tags[b][t] ?? 0) / truth[b][0]
console.log(`tags, top ten of the board: ${JSON.stringify(tags.top)}; after: ${JSON.stringify(tags.rest)}`)
console.log(`BUST tag ${pc(tags.top.BUST ?? 0, truth.top[0])} of the top ten (men who won't develop: ${pc(truth.top[1], truth.top[0])}); after ${pc(tags.rest.BUST ?? 0, truth.rest[0])} (${pc(truth.rest[1], truth.rest[0])})`)
ok(Math.abs(share('top', 'BUST') - truth.top[1] / truth.top[0]) < 0.04, 'the BUST tag runs at the rate the top ten really bust')
ok(flagged90 === 0, 'no prospect with an 88+ ceiling is tagged BUST')
ok(share('rest', 'GEM') > 0.01 && share('rest', 'GEM') < 0.08, `GEM is rare (${pc(tags.rest.GEM ?? 0, truth.rest[0])} after the top ten)`)
// a 90 ceiling the board read as a 94
ok(N.rangeOf({ pk: 90, seen: 94, o: 78, sc: 2 }).tag === 'SOLID', 'a 90 ceiling read as a 94 is SOLID')
ok(N.rangeOf({ pk: 76, seen: 88, o: 76, sc: 2, tg: 'SOLID' }).tag === 'BUST', 'a man who is what he is, read ten points high, is a BUST (whatever an old save stored)')

// ── 3. scouting reports ──────────────────────────────────────────────────────
{
  const S = N.createNbaFranchise({ seed: 'cc3', team: 'DEN', owner: 'QA' })
  const sp = []
  for (let y = 0; y < 3; y++) {
    N.simTo(S, S.days); N.startPostseason(S); N.simPostseason(S); N.closeSeason(S)
    while (S.phase === 'off') { if (S.off.step === 'draft') sp.push(S.sp); N.nextStep(S); if (S.off?.step === 'resign') sp.push(`-> ${S.sp}`) }
  }
  console.log('reports at the draft, then after it, three summers with none spent:', sp.join(' '))
  ok(sp.filter(x => typeof x === 'number').every(x => x <= N.SCOUT_MAX), `never more than ${N.SCOUT_MAX} reports`)
  ok(S.sp <= N.SCOUT_CARRY + 4, `only ${N.SCOUT_CARRY} carry past a draft (now ${S.sp})`)
  const old = { ...S, sp: 58 }
  N.scoutSpring(old)
  ok(old.sp === N.SCOUT_MAX, `a save holding 58 reports comes down to ${N.SCOUT_MAX}`)
}

// ── 4. a build cut off the street ────────────────────────────────────────────
{
  const builds = [{ pos: 'guard', build: asB(pickAt(G, 70).attrs), name: 'Street Build', num: 77 }]
  const S = N.createNbaFranchise({ seed: 'cc4', team: 'ORL', owner: 'QA', builds })
  const p = S.teams.ORL.r.find(x => x.b != null)
  S.teams.ORL.r = S.teams.ORL.r.filter(x => x !== p)
  p.o = 41; p.ag = 33; p.ys = 9
  S.fa = [...S.fa, p, ...Array.from({ length: 60 }, (_, k) => ({ i: 90000 + k, n: `Street Man ${k}`, o: 70, ag: 27, gn: 1, a: {}, g: 'guard', p: 'SG' }))]
  const news0 = S.news.length
  N.pruneStreet(S)
  const line = S.news.slice(0, S.news.length - news0).concat(S.news).find(x => /Street Build/.test(x.text) && x.tag === 'RETIRES')
  ok(S.builds[0].done === S.year, `the build's card keeps his retirement year (${S.builds[0].done})`)
  ok(!!line, `the wire says so: ${line?.text}`)
  ok(S.retired.some(r => r.b === 0 && r.k), 'he is on the retired list, kept')
  ok(!S.fa.some(x => x.b != null), 'and off the street')
}

// ── 5. camp can always reach 14 ──────────────────────────────────────────────
{
  const S = N.createNbaFranchise({ seed: 'cc5', team: 'MIL', owner: 'QA' })
  N.simTo(S, S.days); N.startPostseason(S); N.simPostseason(S); N.closeSeason(S)
  while (S.phase === 'off' && S.off.step !== 'camp') { if (S.off.step === 'resign') for (const id of [...(S.off.mine ?? [])]) N.resignMine(S, id, true); N.nextStep(S) }
  const T = S.teams.MIL, std = () => T.r.filter(p => !p.tw)
  const snap = JSON.stringify(S)
  // (a) the GM waives down to 11: every man he waived is barred, the list still fills the roster
  while (std().length > 11) N.CAP_SIM.cutMan(S, 'MIL', std().filter(p => p.b == null).sort((a, b) => a.o - b.o)[0].i)
  ok(!N.campCheck(S).ok, `11 standard contracts: camp isn't legal (${N.campCheck(S).why})`)
  const pool = N.minPool(S)
  ok(pool.length >= 3 && pool.every(p => N.CAP_SIM.canSign(S, 'MIL', p, { $: N.CAP_SIM.minOf(p.ys ?? 0, N.CAP_SIM.capYear(S)), y: 1, r: 0 }).ok), `the minimum list has ${pool.length} men and every one can sign`)
  for (const p of N.minPool(S)) { if (std().length >= 14) break; N.signMin(S, p.i) }
  ok(std().length >= 14 && N.campCheck(S).ok, `filled to ${std().length}: camp is legal`)
  // (b) an empty street: camp invites
  const E = JSON.parse(snap)
  const TE = E.teams.MIL, stdE = () => TE.r.filter(p => !p.tw)
  while (stdE().length > 12) TE.r = TE.r.filter(p => p !== stdE().sort((a, b) => a.o - b.o)[0])
  E.fa = []
  ok(N.minPool(E).length === 0 && !N.campCheck(E).ok, 'an empty street, 12 men: not legal, nobody to sign')
  let g = 0
  while (stdE().length < 14 && g++ < 5) { const r = N.campInvite(E); if (!r.ok) { console.log('     invite refused:', r.why); break } }
  ok(stdE().length === 14 && N.campCheck(E).ok, `two camp invites make 14 (${stdE().slice(-2).map(p => `${p.n} ${p.o}, age ${p.ag}, $${p.$}M`).join('; ')})`)
  ok(!N.campInvite(E).ok, 'no invite once the roster has its 14')
  // (c) a hard cap with no room for a rookie's minimum: the season can still start, a man short
  const H = JSON.parse(snap)
  const TH = H.teams.MIL, stdH = () => TH.r.filter(p => !p.tw)
  while (stdH().length > 13) TH.r = TH.r.filter(p => p !== stdH().sort((a, b) => a.o - b.o)[0])
  const y = N.CAP_SIM.capYear(H)
  TH.exc = { ...(TH.exc ?? {}), yr: y, hc: 'a1' }
  const gap = N.CAP_SIM.apron1Of(y) - N.CAP_SIM.payroll(H, 'MIL', y)
  const star = stdH().sort((a, b) => b.$ - a.$)[0]
  star.$ = Math.round((star.$ + gap - 0.4) * 10) / 10
  const ck = N.campCheck(H)
  ok(N.minPool(H).length === 0 && !N.campInvite(H).ok, `hard-capped ${(N.CAP_SIM.apron1Of(y) - N.CAP_SIM.payroll(H, 'MIL', y)).toFixed(1)}M under the apron: no minimum deal fits`)
  ok(ck.ok && ck.short === 1, `camp lets the season start a man short: ${ck.why}`)
  N.nextStep(H)
  ok(H.phase === 'season', 'and the season starts')
}

// ── 6. the opening data ──────────────────────────────────────────────────────
{
  const S = N.createNbaFranchise({ seed: 'cc6', team: 'DET', owner: 'QA' })
  const man = n => allMen(S).find(p => p.n === n)
  const h = man('Ronald Holland II')
  ok(h && Math.abs(h.$ - 9.07) < 0.01 && h.y === 2 && h.opt?.k === 'T' && h.opt?.yr === 2027 && h.dr?.[2] === 5 && h.rs === 1, `Ronald Holland II: $${h?.$}M, ${h?.y} seasons, team option ${h?.opt?.yr}, the No. ${h?.dr?.[2]} pick of ${h?.dr?.[0]}`)
  const want = { 'Klay Thompson': 15, 'Jonathan Isaac': 9, 'Joel Embiid': 12, 'Kawhi Leonard': 15, 'Kevin Durant': 19, 'Chet Holmgren': 4, 'Dwight Powell': 12, 'Bruce Brown': 8, 'Haywood Highsmith': 6, 'Jeremy Sochan': 4, 'Andre Jackson Jr.': 3, 'Miles Bridges': 7, 'Trey Lyles': 10 }
  const off = Object.entries(want).filter(([n2, v]) => man(n2)?.ys !== v)
  ok(!off.length, `years of service: ${Object.entries(want).map(([n2, v]) => `${n2.split(' ').slice(-1)[0] === 'Jr.' ? 'Jackson' : n2.split(' ').slice(-1)[0]} ${man(n2)?.ys}`).join(', ')}${off.length ? ' WRONG: ' + off.map(x => x[0]).join(', ') : ''}`)
  const sorber = man('Thomas Sorber')
  ok(sorber?.rk === 2026 && sorber?.ys === 1, `Sorber is a rookie with a year of service (rk ${sorber?.rk}, ys ${sorber?.ys})`)
  const rooks = allMen(S).filter(p => p.rk === 2026 && p.h)
  ok(rooks.every(p => p.ys === 0 || p.n === 'Thomas Sorber'), `${rooks.length} real rookies, none with service but Sorber`)
  ok(N.TEAM.UTA.color === '#4E008E' && N.TEAM.LAC.color === '#12173F' && N.TEAM.LAC.color2 === '#C8102E', `Utah ${N.TEAM.UTA.color} / ${N.TEAM.UTA.color2}, Clippers ${N.TEAM.LAC.color} / ${N.TEAM.LAC.color2}`)
  // payrolls against the data: the real men the game carries, on their real money; what the data has for men it
  // doesn't carry (g: 0) is the gap a payroll may sit under the real one by (owner, 11-23: fillers on the minimum)
  const rows = []
  for (const s of N.SHORTS) {
    const carried = Object.entries(NBA_DEALS).filter(([, d]) => d.t === s && d.g !== 0 && !d.tw && d.s?.length)
    const lost = carried.filter(([n2, d]) => { const p = S.teams[s].r.find(x => x.n === n2); return !p || Math.abs((p.$ ?? 0) - d.s[0]) > 0.011 })
    const g0 = Object.entries(NBA_DEALS).filter(([, d]) => d.t === s && d.g === 0 && !d.tw && d.s?.length).reduce((a, [, d]) => a + d.s[0], 0)
    if (lost.length) rows.push(`${s}: ${lost.map(([n2, d]) => `${n2} $${d.s[0]}M`).join(', ')}`)
    if (['DET', 'CHI', 'LAC'].includes(s)) console.log(`     ${s}: ${carried.length} carried men on their real deals; $${g0.toFixed(1)}M in the data belongs to men the game doesn't carry`)
  }
  ok(!rows.length, `every carried man with a deal in the data opens on it${rows.length ? ': ' + rows.join(' | ') : ''}`)
}
console.log(bad ? `\n${bad} FAILED` : '\nall ok')
process.exit(bad ? 1 : 0)
