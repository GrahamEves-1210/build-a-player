// The depth chart two deep on every team, over several seasons (league.js DEPTH, fillUp, trim; roster.js byOvr):
// every room has its starters and a man behind them (the line: three tackles and four inside), no room has more
// than one filler backup, fillers are 63-68, never ahead of a real man, never in the weekly rotation, rosters
// within MIN and MAX at each season's start; a filler is never on the re-sign list, the market, a free-agency
// headline, an event card (trade ask, extension, starting job) or an award ballot. Then a save from before the fillers, read back (index.js depthOnLoad).
//   bash scripts/franchise2/run.sh scripts/franchise2/depth-check.mjs [seasons=4] [team=TEN]
import * as FR from '../../src/lib/franchise2/index'
import CONTRACTS from '../../src/data/nfl-contracts.json'
import { QBS } from '../../src/data/qbs'
import { DBS } from '../../src/data/dbs'

const N = Number(process.argv[2] ?? 4), team = process.argv[3] ?? 'TEN'
FR.useContracts(CONTRACTS)
const asBuild = p => Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, { val: v }]))
const qb = QBS.find(p => p.attrs && p.name === 'Josh Allen'), db = DBS.find(p => p.attrs && p.subpos === 's') ?? DBS.find(p => p.attrs)
const F = FR.createFranchise({ seed: 'depth-' + team, team, owner: 'G', builds: [{ pos: 'qb', build: asBuild(qb), name: 'Marcus Reed', num: 12 }, { pos: 'db', build: asBuild(db), name: 'Tre Holloway', num: 31 }] })
const problems = []
const bad = m => { if (problems.length < 60) console.log('  !! ' + m); problems.push(m) }
const isGen = p => p.b == null && !FR.realOf(p.p, p.n) && p.rk == null && p.dr == null

function audit(when, { counts = false } = {}) {
  let fill = 0, genStart = 0, genLow = 0, over = 0
  const where = {}
  for (const s of FR.SHORTS) {
    const t = F.teams[s], C = FR.depthChart(F, s)
    for (const [k, , , , n] of FR.GROUPS) {
      const men = C[k]
      if (men.length < n + 1) bad(`${when} ${s} ${k}: ${men.length} men, needs ${n + 1}`)
      // (a filler behind every real man: the league's chart by rating; the player's as he set it, new men in place)
      const firstFl = men.findIndex(p => p.fl)
      if (firstFl >= 0 && men.slice(firstFl).some(p => !p.fl) && s !== F.team) bad(`${when} ${s} ${k}: a filler ahead of a real man`)
    }
    for (const [u, pos, st] of FR.DEPTH) {
      const men = t.r.filter(p => p.p === pos && FR.unitOf(p) === u), fl = men.filter(p => p.fl)
      if (men.length < st + 1) bad(`${when} ${s} ${u}: ${men.length} men, needs ${st + 1}`)
      if (fl.length > 1) bad(`${when} ${s} ${u}: ${fl.length} fillers`)
      if (fl.length) where[u] = (where[u] ?? 0) + 1
    }
    for (const p of t.r) {
      if (p.fl) { fill++; if (p.o < 63 || p.o > 68) bad(`${when} ${s} filler ${p.n} at ${p.o}`); if (p.ag < 23 || p.ag > 30) bad(`${when} ${s} filler ${p.n} age ${p.ag}`) }
    }
    const L = FR.startersOf(F, s)
    for (const p of Object.values(L)) if (isGen(p) && !p.fl) { genStart++; if (p.o < 63) genLow++ }
    for (const p of FR.benchOf(F, s)) if (p.fl) bad(`${when} ${s} filler ${p.n} in the rotation`)
    if (counts) for (const pos of FR.POS) {
      const c = t.r.filter(p => p.p === pos).length, protectedN = t.r.filter(p => p.p === pos && p.b != null).length
      if (c < FR.MIN[pos]) bad(`${when} ${s} ${pos}: ${c} < MIN ${FR.MIN[pos]}`)
      if (c > Math.max(FR.MAX[pos], protectedN) + (s === F.team ? 2 : 0)) { over++; bad(`${when} ${s} ${pos}: ${c} > MAX ${FR.MAX[pos]}`) }
    }
  }
  const mine = F.teams[F.team].r.filter(p => p.fl).length
  console.log(`${when}: ${fill} fillers (${(fill / 32).toFixed(2)} a team; ${team} ${mine}) · by room ${Object.entries(where).map(([k, v]) => `${k} ${v}`).join(', ')} · generated starters ${genStart} (${genLow} under 63)`)
  return fill / 32
}

const per = []
const flIds = () => new Set(FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.fl).map(p => p.i)))
let events = 0
for (let y = 0; y < N; y++) {
  per.push(audit(`${F.year} wk1`, { counts: true }))
  while (F.phase === 'season') {
    FR.playWeek(F, { moments: false })
    // (an event card is never about a filler: a trade ask, an extension, a starting job, the practice report)
    if (F.ev) { for (const id of [F.ev.pid, F.ev.sid, F.ev.give, F.ev.get, F.ev.cut]) if (id != null && flIds().has(id)) bad(`${F.year} wk${F.wk} event ${F.ev.id} about a filler`); events++; FR.chooseEvent(F, y % 2) }
    if (F.wk === 9) audit(`${F.year} wk9`)
  }
  audit(`${F.year} wk18`)
  FR.intoPlayoffs(F); FR.simPlayoffs(F)
  const fl = flIds()
  FR.closeSeason(F)
  const aw = F.aw ?? {}
  const flNames = new Set(FR.SHORTS.flatMap(s => F.teams[s].r.filter(p => p.fl).map(p => p.n)))
  for (const k of FR.AWARD_KEYS) if (aw[k] && flNames.has(aw[k].n)) bad(`${F.year} ${k} to a filler`)
  for (const id of Object.keys(aw.hon ?? {})) if (fl.has(+id)) bad(`${F.year} All-Pro or Pro Bowl to a filler`)
  // (the player's offseason report: no filler's rating change or retirement)
  FR.ageLeague(F)
  for (const c of F.aging?.changes ?? F.aging ?? []) if (c?.pid != null && fl.has(c.pid)) bad(`${F.year} offseason report lists a filler`)
  FR.openResign(F)
  if (FR.SHORTS.some(s => F.teams[s].r.some(p => p.fl && p.y <= 0))) bad(`${F.year} a filler whose year is up still on a roster`)
  if ((F.fa ?? []).some(p => p.fl)) bad(`${F.year} a filler on the market`)
  const fasBefore = F.fas?.length ?? 0
  if ((F.rs ?? []).some(id => F.teams[F.team].r.find(p => p.i === id)?.fl)) bad(`${F.year} a filler on the re-sign list`)
  for (const id of [...F.rs]) { const p = F.teams[F.team].r.find(x => x.i === id); FR.resignOne(F, id, FR.optionDue(p) ? 'option' : p.o >= 76) }
  FR.openFA(F); while (F.fad) FR.nextFADay(F)
  // (free agency's signings, the wire's headlines: never a filler)
  if ((F.fas ?? []).some(([i]) => flIds().has(i))) bad(`${F.year} a filler signed in free agency`)
  for (const x of (F.news ?? []).filter(x => x.y === F.year)) {
    const p = FR.SHORTS.flatMap(s => F.teams[s].r).find(p => p.fl && x.text?.includes(p.n))
    // (a filler shares his made-up name with another man now and then: only a headline whose man IS a filler counts)
    if (p && !FR.SHORTS.flatMap(s => F.teams[s].r).concat(F.fa ?? []).some(q => !q.fl && q.n === p.n)) bad(`${F.year} a filler in a headline: ${x.text}`)
  }
  FR.openDraft(F); while (!FR.draftDone(F)) { FR.cpuPicks(F); if (!FR.draftDone(F)) FR.autoPick(F) }
  FR.closeDraft?.(F)
  FR.newSeason(F)
}
per.push(audit(`${F.year} wk1`, { counts: true }))

// a save from before the fillers: the fillers taken off (and a few backups cut, the way the old rosters were thin),
// packed, read back the way loadFranchise does
const old = JSON.parse(FR.packFranchise(F))
const G = FR.unpackFranchise(JSON.stringify(old))
for (const s of FR.SHORTS) { const t = G.teams[s]; t.r = t.r.filter(p => !p.fl) }
const thin = FR.SHORTS.reduce((a, s) => a + FR.GROUPS.filter(([k, , , , n]) => FR.depthChart(G, s)[k].length < n + 1).length, 0)
FR.depthOnLoad(G)
const thinAfter = FR.SHORTS.reduce((a, s) => a + FR.GROUPS.filter(([k, , , , n]) => FR.depthChart(G, s)[k].length < n + 1).length, 0)
const added = FR.SHORTS.reduce((a, s) => a + G.teams[s].r.filter(p => p.fl).length, 0)
console.log(`old save: ${thin} rooms with no backup before load, ${thinAfter} after, ${added} fillers signed on load`)
if (thinAfter) bad(`old save: ${thinAfter} rooms still with no backup`)
const again = JSON.parse(FR.packFranchise(G)); FR.depthOnLoad(FR.unpackFranchise(JSON.stringify(again)))
const G2 = FR.unpackFranchise(JSON.stringify(again)); FR.depthOnLoad(G2)
if (FR.SHORTS.reduce((a, s) => a + G2.teams[s].r.filter(p => p.fl).length, 0) !== added) bad('old save: a second load signed more fillers')

console.log(`${events} event cards checked`)
console.log(`fillers a team, season starts: ${per.map(x => x.toFixed(2)).join(' ')}`)
console.log(problems.length ? `${problems.length} problems` : 'depth: all good')
process.exit(problems.length ? 1 : 0)
